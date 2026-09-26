import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { connectCloud, verifyLedger } from "./cloud.mjs";

for (const file of [".env", ".env.operator", ".env.test"])
  if (existsSync(file)) process.loadEnvFile(file);
const kind = process.argv.includes("--test") ? "test" : "demo";
async function run() {
  const { client, settings, present } = await connectCloud(kind);
  try {
    if (!present) throw new Error("MIGRATIONS_REQUIRED");
    await verifyLedger(client);
  } finally {
    await client.end();
  }
  if (!settings.management) throw new Error("MANAGEMENT_TOKEN_REQUIRED");
  const base = `https://api.supabase.com/v1/projects/${settings.ref}`;
  async function request(path, body) {
    const result = await fetch(base + path, {
      method: body ? "PATCH" : "GET",
      headers: {
        Authorization: `Bearer ${settings.management}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok)
      throw new Error(
        `MANAGEMENT_${body ? "WRITE" : "READ"}_${path === "/config/auth" ? "AUTH" : path === "/postgrest" ? "API" : "PROJECT"}_HTTP_${result.status}`,
      );
    return result.json();
  }
  const project = await request("");
  if (project.region !== "ap-south-1" || project.status !== "ACTIVE_HEALTHY")
    throw new Error("PROJECT_NOT_READY");
  const auth = await request("/config/auth");
  const api = await request("/postgrest");
  const desiredAuth = {
    disable_signup: true,
    external_anonymous_users_enabled: false,
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true,
    password_min_length: Math.max(auth.password_min_length ?? 0, 12),
    site_url: process.env.APP_ORIGIN ?? "http://localhost:3000",
  };
  const previous = {
    auth: Object.fromEntries(
      Object.keys(desiredAuth).map((key) => [key, auth[key]]),
    ),
    api: { db_schema: api.db_schema },
  };
  const authMatches = Object.entries(desiredAuth).every(
    ([key, value]) => auth[key] === value,
  );
  const apiMatches = api.db_schema === "api";
  if (authMatches && apiMatches) {
    console.log(
      `${kind}: Auth and API settings already match; no changes needed.`,
    );
    return;
  }
  console.log(
    `${kind}: region verified; reviewed settings require invite-only Auth, TOTP, minimum 12-character passwords and only api exposed.`,
  );
  if (!process.argv.includes("--apply")) {
    console.log("Read-only configuration plan; add --apply after review.");
    return;
  }
  mkdirSync("var/cloud-settings", { recursive: true });
  const path = `var/cloud-settings/${kind}-${Date.now()}.json`;
  writeFileSync(
    path,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectRef: settings.ref,
        previous,
        desired: { auth: desiredAuth, api: { db_schema: "api" } },
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  if (!authMatches) await request("/config/auth", desiredAuth);
  if (!apiMatches) await request("/postgrest", { db_schema: "api" });
  const verifiedAuth = await request("/config/auth"),
    verifiedApi = await request("/postgrest");
  if (
    Object.entries(desiredAuth).some(
      ([key, value]) => verifiedAuth[key] !== value,
    ) ||
    verifiedApi.db_schema !== "api"
  )
    throw new Error("SETTINGS_VERIFICATION_FAILED");
  console.log(
    `${kind}: Auth and API settings applied and read back. Non-secret change record: ${path}`,
  );
}
run().catch((error) => {
  console.error(
    /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "CLOUD_CONFIGURATION_FAILED",
  );
  process.exitCode = 1;
});
