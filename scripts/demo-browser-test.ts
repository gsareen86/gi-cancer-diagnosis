import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { TOTP, Secret } from "otpauth";
import assert from "node:assert/strict";
import { connectCloud, verifyLedger } from "./cloud.mjs";
import { generateAssessment } from "../src/lib/demo/model-gateway";
const tests: string[] = [];
const reviewOnly = process.argv.includes("--review-only");
let stage = "setup";
const check = (name: string, value: unknown) => {
  assert.equal(value, true, name);
  tests.push(name);
  console.log(`PASS ${name}`);
};
for (const f of [".env", ".env.operator", ".env.test"])
  if (existsSync(f)) process.loadEnvFile(f);
const { client: db, settings } = await connectCloud("test");
let databaseDisconnected = false;
db.on("error", () => {
  databaseDisconnected = true;
});
const databaseKeepalive = setInterval(() => {
  void db.query("select 1").catch(() => {
    databaseDisconnected = true;
  });
}, 25000);
const runId = randomUUID(),
  site = randomUUID(),
  patient = randomUUID();
const admin = createClient(settings.url, settings.admin, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `journey-${runId}@demo.invalid`,
  password = randomBytes(24).toString("base64url");
let userId: string | undefined,
  server: ReturnType<typeof spawn> | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const origin = "http://localhost:3210";
mkdirSync("var/demo-rehearsal", { recursive: true });
try {
  await verifyLedger(db);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { gi_compass_synthetic: true, test_run: runId },
  });
  if (created.error) throw new Error("AUTH_CREATE_FAILED");
  userId = created.data.user.id;
  await db.query("insert into app.sites(id,name) values($1,$2)", [
    site,
    `SYN Journey ${runId}`,
  ]);
  await db.query(
    "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
    [userId, `SYN-JOURNEY-${runId}`],
  );
  await db.query(
    "insert into app.site_memberships(user_id,site_id,role) values($1,$2,'clinician')",
    [userId, site],
  );
  await db.query(
    "insert into phi.patients(id,site_id,synthetic_identifier,display_name,year_of_birth,is_synthetic) values($1,$2,$3,'Synthetic journey patient',1974,true)",
    [patient, site, `SYN-JOURNEY-${runId}`],
  );
  const runtime = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/SUPABASE|OPERATOR|DATABASE|TOKEN|SECRET|PASSWORD|API_KEY/i.test(key),
    ),
  );
  Object.assign(runtime, {
    GI_HOSTED_BROWSER_TEST: "1",
    APP_ENVIRONMENT: "test",
    APP_ORIGIN: origin,
    NEXT_PUBLIC_SUPABASE_URL: settings.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.key,
    SUPABASE_EXPECTED_PROJECT_REF: settings.ref,
    SUPABASE_VERIFIED_REGION: "ap-south-1",
    SUPABASE_REGION_VERIFIED_AT: process.env.TEST_SUPABASE_REGION_VERIFIED_AT,
  });
  stage = "build";
  console.log("Building isolated production demo test.");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "build"],
      { env: runtime, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    child.stdout?.on("data", (b) => (log += b));
    child.stderr?.on("data", (b) => (log += b));
    child.on("close", (code) => {
      writeFileSync("var/demo-rehearsal/build.log", log);
      if (code === 0) resolve();
      else reject(new Error("BUILD_FAILED"));
    });
  });
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3210"],
    { env: runtime, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let serverLog = "";
  server.stderr?.on("data", (b) => {
    serverLog += b;
    writeFileSync("var/demo-rehearsal/test-server.log", serverLog);
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(origin + "/sign-in")).ok) break;
    } catch {}
    await delay(500);
  }
  stage = "browser_launch";
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
  });
  const staffContext = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await staffContext.newPage();
  page.setDefaultTimeout(30000);
  stage = "login";
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL("**/mfa");
  const enrolResponse = page.waitForResponse(
    (r) =>
      r.url() === `${settings.url}/auth/v1/factors` &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const enrol = await (await enrolResponse).json();
  const otp = new TOTP({ secret: Secret.fromBase32(enrol.totp.secret) });
  await page.getByLabel("Authenticator code").fill(otp.generate());
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL("**/staff");
  check("actual staff login and MFA", true);
  const authCookies = await staffContext.cookies();
  stage = "new_encounter";
  await page.getByRole("button", { name: "Start new encounter" }).click();
  await page.waitForURL("**/staff/demo/*");
  const encounterId = page.url().split("/").pop()!;
  await page
    .getByRole("button", { name: "Start / resume patient intake" })
    .click();
  await page.waitForURL("**/patient");
  await page.getByRole("heading", { name: "Before we begin" }).waitFor();
  const afterHandoff = await staffContext.cookies();
  check(
    "handoff clears staff cookies",
    !afterHandoff.some((c) => c.name.startsWith("sb-")),
  );
  check(
    "handoff sets HttpOnly encounter capability",
    afterHandoff.some((c) => c.name === "gi-encounter" && c.httpOnly),
  );
  const oldSessionContext = await browser.newContext({ baseURL: origin });
  await oldSessionContext.addCookies(authCookies);
  const probe = await oldSessionContext.request.post("/api/demo", {
    headers: { Origin: origin },
    data: { action: "get", id: encounterId },
  });
  check("old staff session cannot access encounter after handoff", !probe.ok());
  await oldSessionContext.close();
  if (process.argv.includes("--reset-only")) {
    stage = "cross_tab_reset";
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await page.getByRole("button", { name: /Aarav Mehra/ }).click();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    const other = await staffContext.newPage();
    await other.goto("/patient");
    await other
      .getByRole("heading", {
        name: "Check for symptoms needing immediate help",
      })
      .waitFor();
    await page.getByRole("button", { name: "End this tablet session" }).click();
    await page.waitForURL("**/patient/ended");
    await other
      .getByText("This tablet session ended. Ask staff for a new handoff.", {
        exact: true,
      })
      .waitFor({ timeout: 5000 });
    check(
      "tablet reset immediately clears clinical UI in another open tab",
      (await other
        .getByRole("heading", {
          name: "Check for symptoms needing immediate help",
        })
        .count()) === 0,
    );
    writeFileSync(
      "var/demo-rehearsal/browser-reset-results.json",
      JSON.stringify(
        { status: "passed", tests, completedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  } else {
    stage = "consent";
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await page.getByRole("button", { name: /Aarav Mehra/ }).click();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Check for symptoms needing immediate help",
      })
      .waitFor();
    check("questionnaire safety stage works", true);
    for (const [width, height] of [
      [1440, 1000],
      [1024, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      check(
        `patient has no horizontal overflow at ${width}`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: `var/demo-rehearsal/patient-${width}.png`,
        fullPage: false,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    stage = "questionnaire";
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("heading", { name: "Tell the patient’s symptom story" })
      .waitFor();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("heading", { name: "History and care so far" })
      .waitFor();
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    stage = "report_upload";
    await page
      .getByLabel("Add a synthetic report")
      .setInputFiles("public/demo-assets/synthetic-whole-body-report.pdf");
    await page
      .getByRole("button", { name: /synthetic-whole-body-report.pdf/ })
      .waitFor({ timeout: 60000 });
    await page
      .getByRole("button", { name: /synthetic-whole-body-report.pdf/ })
      .click();
    await page
      .getByRole("heading", { name: "Check extracted findings" })
      .waitFor();
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas");
      return canvas && canvas.width > 100 && canvas.toDataURL().length > 10000;
    });
    check("original PDF renders on the report canvas", true);
    const boxes = page.getByRole("checkbox", {
      name: "I checked this against the original page",
    });
    const count = await boxes.count();
    check("full-body PDF creates source-linked proposals", count >= 10);
    for (let i = 0; i < count; i++) await boxes.nth(i).check();
    await page.getByRole("button", { name: "Save verification" }).click();
    await page
      .getByRole("button", {
        name: /synthetic-whole-body-report.pdf · Checked/,
      })
      .waitFor();
    await page.screenshot({
      path: "var/demo-rehearsal/report-evidence.png",
      fullPage: false,
    });
    stage = "submit";
    await page.getByRole("button", { name: "Continue →", exact: true }).click();
    await page
      .getByRole("button", { name: "Submit for AI and clinician review" })
      .click();
    await page
      .getByRole("heading", { name: "Your preliminary assessment" })
      .waitFor();
    const worker = createClient(settings.url, settings.admin, {
      db: { schema: "api" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    stage = "live_ai";
    const currentJob = (
      await db.query(
        "select id from phi.demo_jobs where encounter_id=$1 order by created_at desc limit 1",
        [encounterId],
      )
    ).rows[0]?.id;
    const claimed = await worker.rpc("demo_worker", {
      p_action: "claim",
      p_id: currentJob,
    });
    if (
      claimed.error ||
      !claimed.data?.data ||
      claimed.data.data.encounterId !== encounterId
    )
      throw new Error("JOB_CLAIM_FAILED");
    const job = claimed.data.data;
    const heartbeat = setInterval(
      () =>
        void worker
          .rpc("demo_worker", {
            p_action: "heartbeat",
            p_id: job.id,
            p_lease: job.lease,
          })
          .then(() => {}),
      20000,
    );
    try {
      if (reviewOnly) {
        await worker.rpc("demo_worker", {
          p_action: "fail",
          p_id: job.id,
          p_lease: job.lease,
          p_error: "invalid_output",
        });
      } else {
        const output = await generateAssessment(job, (raw) =>
          writeFileSync(
            "var/demo-rehearsal/browser-synthetic-raw.json",
            JSON.stringify(raw, null, 2),
          ),
        );
        const done = await worker.rpc("demo_worker", {
          p_action: "complete",
          p_id: job.id,
          p_lease: job.lease,
          p_result: output,
        });
        check(
          "live AI result published through leased worker",
          done.data?.ok === true,
        );
      }
    } finally {
      clearInterval(heartbeat);
    }
    if (reviewOnly) {
      await page
        .getByText("AI assessment unavailable", { exact: true })
        .waitFor({ timeout: 30000 });
      check("clinician workflow remains available after rejected AI", true);
    } else {
      await page
        .getByRole("heading", { name: "Possible explanations to discuss" })
        .waitFor({ timeout: 30000 });
      check("patient sees actual preliminary AI", true);
    }
    const clinicianContext = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
    });
    const clinician = await clinicianContext.newPage();
    stage = "clinician_login";
    await clinician.goto("/sign-in");
    await clinician.getByLabel("Staff email").fill(email);
    await clinician.getByLabel("Password", { exact: true }).fill(password);
    await clinician
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await clinician.waitForURL("**/mfa");
    await clinician.getByLabel("Authenticator code").fill(otp.generate());
    await clinician
      .getByRole("button", { name: "Verify and continue" })
      .click();
    await clinician.waitForURL("**/staff");
    await clinician.goto(`/staff/demo/${encounterId}`);
    stage = "clarification";
    await clinician
      .getByLabel("Request missing information")
      .fill("Please confirm whether the bowel change began six weeks ago.");
    await clinician
      .getByRole("button", { name: "Send clarification", exact: true })
      .click();
    await page
      .getByText(
        "Please confirm whether the bowel change began six weeks ago.",
        {
          exact: true,
        },
      )
      .waitFor({ timeout: 30000 });
    await page
      .getByLabel("Reply or ask for clarification")
      .fill("Yes, the change started about six weeks ago.");
    await page
      .getByRole("button", { name: "Send clarification", exact: true })
      .click();
    await clinician
      .getByText("Yes, the change started about six weeks ago.", {
        exact: true,
      })
      .waitFor({ timeout: 30000 });
    check(
      "clarification request and patient reply persist in both views",
      true,
    );
    stage = "independent_review";
    await clinician
      .getByLabel("Clinical impression")
      .fill(
        "Persistent altered bowel habit with rectal bleeding and anaemia. Colorectal pathology requires investigation.",
      );
    await clinician
      .getByLabel("Instructions for the patient")
      .fill(
        "Attend gastroenterology review promptly. Bring original blood reports and medicines. The clinician will decide on endoscopy after examination.",
      );
    await clinician
      .getByRole("button", { name: "Save independent assessment", exact: true })
      .click();
    await clinician
      .getByRole("button", { name: "Compare with AI", exact: true })
      .waitFor();
    for (const [width, height] of [
      [1440, 1000],
      [1024, 900],
      [390, 844],
    ]) {
      await clinician.setViewportSize({ width, height });
      check(
        `clinician has no horizontal overflow at ${width}`,
        await clinician.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await clinician.screenshot({
        path: `var/demo-rehearsal/clinician-${width}.png`,
        fullPage: false,
      });
    }
    await clinician.setViewportSize({ width: 1440, height: 1000 });
    await clinician
      .getByRole("button", { name: "Compare with AI", exact: true })
      .click();
    await clinician
      .getByRole("heading", { name: "AI and clinician assessment" })
      .waitFor();
    check(
      reviewOnly
        ? "comparison shows unavailable AI after independent assessment"
        : "comparison reveals AI after independent assessment",
      true,
    );
    await clinician
      .getByLabel("Agreement / disagreement")
      .selectOption("different_diagnosis");
    await clinician
      .getByLabel("Reason / correction")
      .fill(
        "Broad differential; examination and colonoscopy will guide the assessment.",
      );
    await clinician
      .getByRole("button", { name: "Return to final patient plan" })
      .click();
    await clinician
      .getByRole("button", { name: "Release clinician’s patient plan" })
      .click();
    await clinician
      .getByRole("heading", { name: "Your clinician’s assessment" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Your clinician’s assessment" })
      .waitFor({ timeout: 30000 });
    check("separate clinician plan reaches patient", true);
    stage = "reset";
    await page.getByRole("button", { name: "End this tablet session" }).click();
    await page.waitForURL("**/patient/ended");
    check(
      "tablet reset clears patient cookie",
      !(await staffContext.cookies()).some((c) => c.name === "gi-encounter"),
    );
    stage = "no_report_journey";
    await clinician.goto("/staff");
    await clinician
      .getByRole("button", { name: "Start new encounter", exact: true })
      .click();
    await clinician.waitForURL("**/staff/demo/*");
    const noReportId = clinician.url().split("/").pop()!;
    await clinician
      .getByRole("button", { name: "Start / resume patient intake" })
      .click();
    await clinician.waitForURL("**/patient");
    const oldTab = await clinicianContext.request.post("/api/demo", {
      headers: { Origin: origin },
      data: { action: "get", id: encounterId, patient: true },
    });
    check(
      "old encounter tab cannot read through a new patient cookie",
      !oldTab.ok(),
    );
    const oldWrite = await clinicianContext.request.post("/api/demo", {
      headers: { Origin: origin },
      data: { action: "reset", id: encounterId, patient: true },
    });
    check(
      "old encounter tab cannot reset the new patient session",
      !oldWrite.ok(),
    );
    await clinician.getByRole("checkbox").check();
    await clinician.getByRole("button", { name: "Agree and continue" }).click();
    await clinician.getByRole("button", { name: /Kavita Rao/ }).click();
    for (let step = 0; step < 5; step++)
      await clinician
        .getByRole("button", { name: "Continue →", exact: true })
        .click();
    await clinician
      .getByRole("button", { name: "Submit for AI and clinician review" })
      .click();
    await clinician
      .getByRole("heading", { name: "Your preliminary assessment" })
      .waitFor();
    const noReport = await clinicianContext.request.post("/api/demo", {
      headers: { Origin: origin },
      data: { action: "get", id: noReportId, patient: true },
    });
    const noReportEncounter = (await noReport.json()).data;
    check(
      "caregiver intake without reports persists and queues AI",
      noReportEncounter.reports.length === 0 &&
        noReportEncounter.job.status === "queued" &&
        noReportEncounter.intake.suppliedBy === "caregiver",
    );
    const noReportJob = (
      await worker.rpc("demo_worker", {
        p_action: "claim",
        p_id: noReportEncounter.job.id,
      })
    ).data.data;
    await worker.rpc("demo_worker", {
      p_action: "fail",
      p_id: noReportJob.id,
      p_lease: noReportJob.lease,
      p_error: "invalid_output",
    });
    await clinician
      .getByText("AI assessment unavailable", { exact: true })
      .waitFor({ timeout: 30000 });
    check(
      "rejected output shows unavailable state without a fabricated diagnosis",
      (await clinician
        .getByRole("heading", { name: "Possible explanations to discuss" })
        .count()) === 0,
    );
    await clinician
      .getByRole("button", { name: "End this tablet session" })
      .click();
    await clinician.waitForURL("**/patient/ended");
    writeFileSync(
      reviewOnly
        ? "var/demo-rehearsal/browser-review-results.json"
        : "var/demo-rehearsal/browser-results.json",
      JSON.stringify(
        { status: "passed", tests, completedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  }
} catch (e) {
  console.log(`FAILED ${stage}: ${e instanceof Error ? e.name : "error"}`);
  writeFileSync(
    "var/demo-rehearsal/browser-failure.json",
    JSON.stringify(
      { stage, error: e instanceof Error ? e.message : "error" },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  clearInterval(databaseKeepalive);
  await browser?.close();
  server?.kill();
  // Keep immutable encounter/audit evidence in the isolated test site. Disable the temporary identity.
  if (userId) {
    const cleanup = databaseDisconnected
      ? (await connectCloud("test")).client
      : db;
    await cleanup.query(
      "update phi.demo_jobs set status='cancelled',lease=null where site_id=$1 and status in('queued','running')",
      [site],
    );
    await cleanup.query(
      "update app.staff_accounts set active=false where user_id=$1",
      [userId],
    );
    await admin.auth.admin.deleteUser(userId);
    if (cleanup !== db) await cleanup.end();
  }
  await db.end();
}
