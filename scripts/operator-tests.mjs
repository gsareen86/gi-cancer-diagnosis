import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { TOTP, Secret } from "otpauth";
import { connectCloud, verifyLedger, isAuthAdminKey } from "./cloud.mjs";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";

let stage = "configuration";
async function run() {
  rmSync("var/test-results/operator-lifecycle-evidence.json", { force: true });
  for (const file of [".env", ".env.operator", ".env.test"])
    if (existsSync(file)) process.loadEnvFile(file);
  const identity = {
    commit: currentCommit(),
    artifactHash: implementationHash(),
  };
  const { client: db, settings } = await connectCloud("test");
  const runId = randomUUID(),
    site = "11111111-1111-4111-8111-111111111111";
  let admin, userId;
  const tests = [];
  const check = (label, value) => {
    stage = label.replace(/[^a-zA-Z0-9]+/g, "_");
    if (value !== true) throw new Error("ASSERTION_FAILED");
    tests.push({ id: `Operator: ${label}`, status: "passed" });
  };
  try {
    await verifyLedger(db);
    if (!isAuthAdminKey(settings.admin, settings.ref))
      throw new Error("AUTH_ADMIN_KEY_REQUIRED");
    if (
      !(
        await db.query(
          "select 1 from app.sites where id=$1 and name='Demo Clinic'",
          [site],
        )
      ).rows.length
    )
      throw new Error("FIXED_TEST_SEED_REQUIRED");
    admin = createClient(settings.url, settings.admin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const password = randomBytes(24).toString("base64url"),
      email = `operator-${runId}@demo.invalid`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { gi_compass_synthetic: true, test_run: runId },
    });
    if (created.error) throw new Error("AUTH_PROVISION_FAILED");
    userId = created.data.user.id;
    await db.query(
      "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
      [userId, `SYN-OPERATOR-${runId}`],
    );
    const staff = createClient(settings.url, settings.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if ((await staff.auth.signInWithPassword({ email, password })).error)
      throw new Error("AUTH_SIGNIN_FAILED");
    const enrolled = await staff.auth.mfa.enroll({ factorType: "totp" });
    if (enrolled.error) throw new Error("FACTOR_ENROL_FAILED");
    const code = new TOTP({
      secret: Secret.fromBase32(enrolled.data.totp.secret),
    }).generate();
    if (
      (
        await staff.auth.mfa.challengeAndVerify({
          factorId: enrolled.data.id,
          code,
        })
      ).error
    )
      throw new Error("FACTOR_VERIFY_FAILED");
    if (!(await staff.schema("api").rpc("begin_staff_session")).data?.ok)
      throw new Error("APP_SESSION_FAILED");
    const token = (await staff.auth.getSession()).data.session.access_token;
    const captured = createClient(settings.url, settings.key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const command = async (
      action,
      { fault, extra = [], expected = "completed" } = {},
    ) => {
      stage = `${action}_${fault ?? expected}`;
      const args = [
        ...(fault
          ? ["--import", "./tests/helpers/operator-auth-fault.mjs"]
          : []),
        "scripts/operator.mjs",
        action,
        "--test",
        "--user",
        userId,
        "--reason",
        "SYNTHETIC_LIFECYCLE_TEST",
        ...extra,
      ];
      const result = await new Promise((resolve) =>
        execFile(
          process.execPath,
          args,
          {
            env: {
              ...process.env,
              GI_OPERATOR_TEST_USER: userId,
              GI_OPERATOR_TEST_FAULT: fault ?? "",
            },
            timeout: 60000,
            maxBuffer: 100000,
            windowsHide: true,
          },
          (error, stdout) => resolve({ failed: Boolean(error), stdout }),
        ),
      );
      const requestId = result.stdout.match(
        /Operator request: ([a-f0-9-]{36})/,
      )?.[1];
      check(
        `${action} ${fault ?? expected} records its request`,
        Boolean(requestId),
      );
      const events = (
        await db.query(
          "select outcome from audit.operator_events where request_id=$1 and target_user_id=$2 order by occurred_at",
          [requestId, userId],
        )
      ).rows.map((row) => row.outcome);
      const expectedEvents =
        expected === "interrupted" ? ["intent"] : ["intent", expected];
      check(
        `${action} ${fault ?? expected} persists the correct audit outcome`,
        JSON.stringify(events) === JSON.stringify(expectedEvents) &&
          result.failed === (expected !== "completed"),
      );
    };
    await command("grant", { extra: ["--site", site, "--role", "clinician"] });
    check(
      "grant enables only the requested membership",
      (
        await db.query(
          "select count(*)::int as count from app.site_memberships where user_id=$1 and site_id=$2 and role='clinician' and active",
          [userId, site],
        )
      ).rows[0].count === 1,
    );
    await command("revoke", { extra: ["--site", site, "--role", "clinician"] });
    check(
      "revoke takes effect without refreshing the token",
      (await captured.schema("api").rpc("my_memberships")).data?.data
        ?.length === 0,
    );
    await command("recover-mfa", { expected: "failed" });
    check(
      "recovery without identity verification preserves the session",
      (await captured.schema("api").rpc("session_status")).data?.ok === true,
    );
    await command("recover-mfa", {
      fault: "fail",
      extra: ["--identity-verified"],
      expected: "failed",
    });
    check(
      "failed Auth recovery keeps the old factor",
      (await admin.auth.admin.mfa.listFactors({ userId })).data?.factors.some(
        (f) => f.id === enrolled.data.id,
      ) === true,
    );
    check(
      "failed Auth recovery blocks captured session",
      (await captured.schema("api").rpc("begin_staff_session")).data?.ok ===
        false,
    );
    await command("recover-mfa", { extra: ["--identity-verified"] });
    check(
      "successful recovery removes factors through Auth",
      (await admin.auth.admin.mfa.listFactors({ userId })).data?.factors
        .length === 0,
    );
    check(
      "successful recovery does not revive captured session",
      (await captured.schema("api").rpc("begin_staff_session")).data?.ok ===
        false,
    );
    await command("disable", { fault: "interrupt", expected: "interrupted" });
    check(
      "interrupted disable commits account and session revocation before Auth",
      (
        await db.query(
          "select active from app.staff_accounts where user_id=$1",
          [userId],
        )
      ).rows[0].active === false &&
        (await captured.schema("api").rpc("session_status")).data?.ok === false,
    );
    await command("disable", { fault: "fail", expected: "failed" });
    check(
      "failed disable does not restore app access",
      (await captured.schema("api").rpc("begin_staff_session")).data?.ok ===
        false,
    );
    await command("disable");
    const disabled = await admin.auth.admin.getUserById(userId);
    check(
      "reconciled disable bans the same synthetic Auth account",
      !disabled.error &&
        Date.parse(disabled.data.user.banned_until) > Date.now(),
    );
  } finally {
    try {
      if (userId && admin) {
        const current = await admin.auth.admin.getUserById(userId);
        if (current.error || current.data.user.app_metadata.test_run !== runId)
          throw new Error("TEST_CLEANUP_IDENTITY_MISMATCH");
        await db.query("delete from app.site_memberships where user_id=$1", [
          userId,
        ]);
        await db.query("delete from app.staff_sessions where user_id=$1", [
          userId,
        ]);
        await db.query(
          "delete from app.staff_accounts where user_id=$1 and synthetic_key=$2",
          [userId, `SYN-OPERATOR-${runId}`],
        );
        if ((await admin.auth.admin.deleteUser(userId)).error)
          throw new Error("TEST_AUTH_CLEANUP_FAILED");
      }
    } finally {
      await db.end();
    }
  }
  if (
    identity.commit !== currentCommit() ||
    identity.artifactHash !== implementationHash()
  )
    throw new Error("TEST_SOURCE_CHANGED");
  mkdirSync("var/test-results", { recursive: true });
  writeFileSync(
    "var/test-results/operator-lifecycle-evidence.json",
    JSON.stringify({ ...identity, tests }, null, 2),
  );
  console.log(
    `Operator lifecycle passed: ${tests.length} assertions; scoped synthetic account removed, audit retained.`,
  );
}
run().catch(() => {
  console.error(
    `Operator lifecycle verification failed at ${stage}; no credentials or provider payloads printed.`,
  );
  process.exitCode = 1;
});
