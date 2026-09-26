import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { TOTP, Secret } from "otpauth";
import assert from "node:assert/strict";
import { connectCloud, verifyLedger, isAuthAdminKey } from "./cloud.mjs";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";

let stage = "configuration";
const browserErrors = [];
const logoutSignals = [];
async function run() {
  rmSync("var/test-results/browser-evidence.json", { force: true });
  for (const file of [".env", ".env.operator", ".env.test"])
    if (existsSync(file)) process.loadEnvFile(file);
  const identity = {
    commit: currentCommit(),
    artifactHash: implementationHash(),
  };
  const { client: db, settings } = await connectCloud("test");
  const runId = randomUUID(),
    site = randomUUID(),
    patient = randomUUID();
  let userId, server, browser, admin;
  const tests = [];
  const check = (label, value) => {
    if (value !== true) stage = label.replace(/[^a-zA-Z0-9]+/g, "_");
    assert.equal(value, true, label);
    tests.push({ id: `Browser: ${label}`, status: "passed" });
  };
  const origin = "http://localhost:3210";
  try {
    await verifyLedger(db);
    if (!isAuthAdminKey(settings.admin, settings.ref))
      throw new Error("AUTH_ADMIN_KEY_REQUIRED");
    const publicClient = createClient(settings.url, settings.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const metadata = await publicClient.schema("api").rpc("environment");
    if (
      metadata.error ||
      metadata.data?.project_ref !== settings.ref ||
      metadata.data?.environment !== "test"
    )
      throw new Error("TEST_API_NOT_READY");
    // Never reuse a listener that might point at the demo or another workspace.
    try {
      await fetch(origin, { signal: AbortSignal.timeout(1000) });
      throw new Error("TEST_PORT_IN_USE");
    } catch (error) {
      if (error.message === "TEST_PORT_IN_USE") throw error;
    }
    stage = "synthetic_fixture";
    admin = createClient(settings.url, settings.admin, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `browser-${runId}@demo.invalid`,
      password = randomBytes(24).toString("base64url");
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { gi_compass_synthetic: true, test_run: runId },
    });
    if (created.error) throw new Error("AUTH_PROVISION_FAILED");
    userId = created.data.user.id;
    await db.query(
      "insert into app.sites(id,name) values($1,'SYN Browser Clinic')",
      [site],
    );
    await db.query(
      "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
      [userId, `SYN-BROWSER-${runId}`],
    );
    await db.query(
      "insert into app.site_memberships(user_id,site_id,role) values($1,$2,'clinician'),($1,$2,'site_admin')",
      [userId, site],
    );
    await db.query(
      "insert into phi.patients(id,site_id,synthetic_identifier,display_name,year_of_birth,is_synthetic) values($1,$2,$3,'Synthetic browser patient',1980,true)",
      [patient, site, `SYN-${runId}`],
    );
    const runtime = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) =>
          !/SUPABASE|OPERATOR|DATABASE|TOKEN|SECRET|PASSWORD|API_KEY/i.test(
            key,
          ),
      ),
    );
    Object.assign(runtime, {
      GI_HOSTED_BROWSER_TEST: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      APP_ENVIRONMENT: "test",
      APP_ORIGIN: origin,
      NEXT_PUBLIC_SUPABASE_URL: settings.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.key,
      SUPABASE_EXPECTED_PROJECT_REF: settings.ref,
      SUPABASE_VERIFIED_REGION: "ap-south-1",
      SUPABASE_REGION_VERIFIED_AT: process.env.TEST_SUPABASE_REGION_VERIFIED_AT,
    });
    stage = "production_test_build";
    console.log("Building the isolated production browser-test app.");
    await new Promise((resolveBuild, rejectBuild) => {
      const build = spawn(
        process.execPath,
        ["node_modules/next/dist/bin/next", "build"],
        { env: runtime, stdio: "ignore", windowsHide: true, timeout: 120000 },
      );
      build.on("error", () => rejectBuild(new Error("TEST_BUILD_FAILED")));
      build.on("exit", (code) =>
        code === 0
          ? resolveBuild()
          : rejectBuild(new Error("TEST_BUILD_FAILED")),
      );
    });
    const privilegedValues = Object.entries(process.env)
      .filter(
        ([key, value]) =>
          /SUPABASE.*(AUTH_ADMIN_KEY|ACCESS_TOKEN|DATABASE_URL)/.test(key) &&
          value &&
          value.length > 16,
      )
      .map(([, value]) => value);
    const staticFiles = readdirSync(".next-hosted-test/static", {
      recursive: true,
    }).filter((name) => /\.(js|map|json)$/.test(name));
    check(
      "privileged credentials are absent from browser bundles",
      staticFiles.length > 0 &&
        privilegedValues.length > 0 &&
        staticFiles.every((name) => {
          const content = readFileSync(
            join(".next-hosted-test/static", name),
            "utf8",
          );
          return privilegedValues.every((value) => !content.includes(value));
        }),
    );
    server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", "3210"],
      { env: runtime, stdio: "ignore", windowsHide: true },
    );
    stage = "test_server";
    const start = Date.now();
    while (true) {
      if (server.exitCode !== null) throw new Error("TEST_SERVER_EXITED");
      try {
        if (
          (
            await fetch(`${origin}/sign-in`, {
              signal: AbortSignal.timeout(2000),
            })
          ).ok
        )
          break;
      } catch {
        /* bounded startup polling */
      }
      if (Date.now() - start > 60000) throw new Error("TEST_SERVER_TIMEOUT");
      await delay(500);
    }
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL,
      headless: true,
    });
    const context = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.on("response", async (response) => {
      if (response.url() === `${settings.url}/rest/v1/rpc/end_staff_session`) {
        const payload = await response.json().catch(() => null);
        logoutSignals.push({
          operation: "app_logout",
          status: response.status(),
          accepted: payload?.ok === true,
        });
      } else if (response.url().startsWith(`${settings.url}/auth/v1/logout`)) {
        logoutSignals.push({
          operation: "auth_logout",
          status: response.status(),
        });
      }
    });
    page.on("pageerror", (error) => {
      const message = error.message
        .replace(/data:[^\s]+/g, "[image omitted]")
        .replace(/https?:[^\s]+/g, "[URL omitted]");
      browserErrors.push(
        message.startsWith("Image") || message.includes("src")
          ? "image-render-error"
          : error.name,
      );
    });
    page.setDefaultTimeout(20000);
    stage = "password_signin";
    await page.goto("/sign-in");
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByLabel("Staff email").focus();
      await page.keyboard.press("Tab");
      check(
        `sign-in keyboard order at ${width}`,
        await page
          .getByLabel("Password", { exact: true })
          .evaluate((el) => el === document.activeElement),
      );
      check(
        `sign-in has no horizontal overflow at ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/mfa");
    stage = "mfa_enrolment";
    const enrolledResponse = page.waitForResponse(
      (r) =>
        r.url() === `${settings.url}/auth/v1/factors` &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const enrolled = await (await enrolledResponse).json();
    if (typeof enrolled.totp?.secret !== "string")
      throw new Error("BROWSER_MFA_SECRET_MISSING");
    stage = "mfa_invalid_code";
    const otp = new TOTP({ secret: Secret.fromBase32(enrolled.totp.secret) });
    const wrongCode = String((Number(otp.generate()) + 1) % 1000000).padStart(
      6,
      "0",
    );
    stage = "mfa_code_entry";
    await page.getByLabel("Authenticator code").fill(wrongCode);
    stage = "mfa_wrong_submit";
    await page.getByRole("button", { name: "Verify and continue" }).click();
    stage = "mfa_wrong_feedback";
    await page
      .getByText(
        "That code could not be verified. Try the current code from your authenticator.",
        { exact: true },
      )
      .waitFor();
    check(
      "invalid MFA leaves protected content unavailable",
      !(await page.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByLabel("Authenticator code").focus();
      await page.keyboard.press("Tab");
      check(
        `MFA keyboard submit at ${width}`,
        await page
          .getByRole("button", { name: "Verify and continue" })
          .evaluate((el) => el === document.activeElement),
      );
      check(
        `MFA error and QR reflow at ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    stage = "mfa_valid_code";
    await page.getByLabel("Authenticator code").fill(otp.generate());
    await page.getByRole("button", { name: "Verify and continue" }).click();
    stage = "app_session_activation";
    await page.waitForURL("**/staff");
    const forgedContext = await browser.newContext({ baseURL: origin });
    try {
      await forgedContext.addCookies([
        {
          name: `sb-${settings.ref}-auth-token`,
          value: "base64-eyJhY2Nlc3NfdG9rZW4iOiJmb3JnZWQifQ",
          url: origin,
        },
      ]);
      const forgedPage = await forgedContext.newPage();
      await forgedPage.goto("/staff/patient");
      check(
        "forged Auth cookie cannot render protected records",
        new URL(forgedPage.url()).pathname === "/sign-in" &&
          !(await forgedPage.locator("body").innerText()).includes(
            "Synthetic browser patient",
          ),
      );
    } finally {
      await forgedContext.close();
    }
    const originRejected = await context.request.post("/staff", {
      headers: { Origin: "https://untrusted.invalid" },
    });
    check(
      "foreign-origin staff mutation is rejected",
      originRejected.status() === 403,
    );
    const rejection = await originRejected.json();
    check(
      "origin rejection is data-free with request correlation",
      typeof rejection.requestId === "string" &&
        Object.keys(rejection).sort().join(",") === "error,requestId",
    );
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
      [390, 844],
    ]) {
      stage = `workspace_${width}`;
      await page.setViewportSize({ width, height });
      const response = await page.goto("/staff");
      await page
        .getByText("Synthetic browser patient", { exact: true })
        .waitFor();
      check(
        `protected responses are no-store at ${width}`,
        (response.headers()["cache-control"] ?? "").includes("no-store"),
      );
      check(
        `workspace has no horizontal overflow at ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.getByRole("button", { name: "View record" }).click();
      await page.waitForURL("**/staff/patient");
      check(
        `record loads without identifiers in URL at ${width}`,
        await page
          .getByRole("heading", { name: "Synthetic browser patient" })
          .isVisible(),
      );
      await page.goto("/staff/audit");
      await page
        .getByRole("heading", { name: "Memberships", exact: true })
        .waitFor();
      check(
        `admin views render without RPC errors at ${width}`,
        (await page.locator('p.error[role="alert"]').count()) === 0,
      );
      check(
        `admin has no horizontal overflow at ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    stage = "membership_revocation";
    await db.query(
      "update app.site_memberships set active=false where user_id=$1 and role='clinician'",
      [userId],
    );
    await page.goto("/staff");
    check(
      "admin role alone never renders patients",
      !(await page.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    await db.query(
      "update app.site_memberships set active=true where user_id=$1 and role='clinician'",
      [userId],
    );
    await page.goto("/staff");
    await page
      .getByText("Synthetic browser patient", { exact: true })
      .waitFor();
    check(
      "browser stores no patient data in localStorage",
      await page.evaluate(
        () =>
          !JSON.stringify(localStorage).includes("Synthetic browser patient"),
      ),
    );
    const other = await context.newPage();
    await other.goto("/staff");
    await other
      .getByText("Synthetic browser patient", { exact: true })
      .waitFor();
    await other.getByRole("button", { name: "View record" }).click();
    await other.waitForURL("**/staff/patient");
    stage = "cross_tab_logout";
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    stage = "logout_navigation";
    await page.waitForURL(/\/sign-in(?:\?|$)/);
    stage = "logout_confirmation";
    await page.getByRole("heading", { name: "You're signed out" }).waitFor();
    check(
      "successful logout renders the wireframe confirmation",
      await page.getByRole("link", { name: "Sign in again" }).isVisible(),
    );
    stage = "other_tab_logout";
    await other.waitForURL(/\/sign-in(?:\?|$)/);
    check(
      "logout clears other tab",
      !(await other.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    check(
      "signout removes protected selection cookies",
      !(await context.cookies()).some((cookie) =>
        ["gi-patient", "gi-site"].includes(cookie.name),
      ),
    );
    const remainingSessions = await db.query(
      "select count(*)::int as count from app.staff_sessions a join auth.sessions s on s.id=a.session_id where a.user_id=$1 and a.revoked_at is null",
      [userId],
    );
    check(
      "logout revokes the server session",
      remainingSessions.rows[0].count === 0,
    );
    stage = "back_after_logout";
    await other.goBack();
    await other.waitForURL(/\/sign-in(?:\?|$)/);
    check(
      "Back after logout does not restore patient content",
      !(await other.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    await other.close();
    let previousCode = otp.generate();
    const signInAgain = async () => {
      const prefix = stage;
      stage = `${prefix}_password`;
      await page.goto("/sign-in");
      await page.getByLabel("Staff email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL("**/mfa");
      stage = `${prefix}_mfa`;
      // Supabase rejects replaying an already-used TOTP time step.
      while (otp.generate() === previousCode) await delay(500);
      previousCode = otp.generate();
      await page.getByLabel("Authenticator code").fill(previousCode);
      await page.getByRole("button", { name: "Verify and continue" }).click();
      stage = `${prefix}_activation`;
      await page.waitForURL("**/staff");
      await page
        .getByText("Synthetic browser patient", { exact: true })
        .waitFor();
      stage = prefix;
    };
    stage = "absolute_expiry";
    await signInAgain();
    await db.query(
      "update app.staff_sessions set expires_at=clock_timestamp()+interval '25 seconds' where user_id=$1 and revoked_at is null",
      [userId],
    );
    await page.goto("/staff");
    stage = "expiry_warning";
    await page.getByText(/Your session is about to expire/).waitFor();
    check("session warning appears before expiry", true);
    stage = "expiry_clearing";
    await page.waitForURL(/\/sign-in(?:\?|$)/, { timeout: 40000 });
    check(
      "absolute expiry clears rendered patient data",
      !(await page.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    stage = "offline_logout";
    await signInAgain();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page
      .getByRole("heading", { name: "Content cleared on this device" })
      .waitFor({ timeout: 25000 });
    check(
      "offline logout clears PHI and reports pending revocation",
      !(await page.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ) &&
        (await page
          .getByText(/Server sign-out could not be confirmed/)
          .isVisible()),
    );
    check(
      "offline logout clears project Auth cookies",
      !(await context.cookies()).some((cookie) =>
        cookie.name.startsWith(`sb-${settings.ref}-`),
      ),
    );
    await context.setOffline(false);
    await page.getByRole("link", { name: "Return to sign in" }).click();
    await page.waitForURL("**/sign-in?revocation=pending");
    await page.goto("/staff");
    await page.waitForURL(/\/sign-in(?:\?|$)/);
    check(
      "offline signout cannot reopen protected content on reconnect",
      !(await page.locator("body").innerText()).includes(
        "Synthetic browser patient",
      ),
    );
    check(
      "reconnecting clears offline selection cookies",
      !(await context.cookies()).some((cookie) =>
        ["gi-patient", "gi-site"].includes(cookie.name),
      ),
    );
    check(
      "authenticated flows have no uncaught browser errors",
      browserErrors.length === 0,
    );
  } finally {
    if (browser) await browser.close();
    if (server && server.exitCode === null) {
      server.kill();
      await delay(500);
    }
    try {
      if (userId && admin) {
        const current = await admin.auth.admin.getUserById(userId);
        if (current.error || current.data.user.app_metadata.test_run !== runId)
          throw new Error("TEST_CLEANUP_IDENTITY_MISMATCH");
        await db.query("delete from phi.patients where id=$1 and site_id=$2", [
          patient,
          site,
        ]);
        await db.query(
          "delete from app.site_memberships where user_id=$1 and site_id=$2",
          [userId, site],
        );
        await db.query("delete from app.staff_sessions where user_id=$1", [
          userId,
        ]);
        await db.query(
          "delete from app.staff_accounts where user_id=$1 and synthetic_key=$2",
          [userId, `SYN-BROWSER-${runId}`],
        );
        await db.query(
          "delete from app.sites where id=$1 and name='SYN Browser Clinic'",
          [site],
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
    "var/test-results/browser-evidence.json",
    JSON.stringify({ ...identity, tests }, null, 2),
  );
  console.log(
    `Hosted browser checks passed: ${tests.length} assertions; no screenshots, traces, tokens or passwords recorded.`,
  );
}
run().catch((error) => {
  if (logoutSignals.length)
    console.error(`Logout status codes: ${JSON.stringify(logoutSignals)}`);
  if (browserErrors.length)
    console.error(`Browser error classes: ${browserErrors.join(", ")}`);
  console.error(
    `Hosted browser verification failed at ${stage}${/^[A-Z_]+$/.test(error.message) ? `: ${error.message}` : ""}. No page content or provider payload printed.`,
  );
  process.exitCode = 1;
});
