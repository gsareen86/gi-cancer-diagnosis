import { chromium, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { TOTP, Secret } from "otpauth";
import { connectCloud, verifyLedger } from "./cloud.mjs";
import { scenarios } from "../src/lib/demo/fixtures";
import { generateAssessment } from "../src/lib/demo/model-gateway";
import prompts from "../src/lib/ai/prompts.json";
const demo = process.argv.includes("--demo");
const liveAI = demo || process.argv.includes("--live-ai");
const evidenceDir = demo ? "var/demo-live-review" : "var/ui-review";
const checks: string[] = [];
let stage = "setup";
for (const f of [".env", ".env.operator", ".env.test"])
  if (existsSync(f)) process.loadEnvFile(f);
const { client: db, settings } = await connectCloud(demo ? "demo" : "test");
const run = randomUUID(),
  site = randomUUID(),
  slug = `test-${run}`;
const email = `ui-${run}@demo.invalid`,
  password = randomBytes(24).toString("base64url");
const admin = createClient(settings.url, settings.admin, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const worker = createClient(settings.url, settings.admin, {
  db: { schema: "api" },
  auth: { persistSession: false, autoRefreshToken: false },
});
const origin = demo ? "http://localhost:3000" : "http://localhost:3210";
let userId: string | undefined,
  server: ReturnType<typeof spawn> | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
mkdirSync(evidenceDir, { recursive: true });
const pass = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
async function shot(page: Page, name: string) {
  for (const [w, h] of [
    [1440, 1000],
    [1024, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ))
    ) {
      await page.screenshot({
        path: `${evidenceDir}/overflow.png`,
        fullPage: true,
      });
      writeFileSync(
        `${evidenceDir}/overflow.json`,
        JSON.stringify(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll("*"))
              .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
              .map((e) => ({
                tag: e.tagName,
                cls: e.className,
                width: e.getBoundingClientRect().width,
              })),
          ),
          null,
          2,
        ),
      );
      throw new Error(`Horizontal overflow: ${name} ${w}`);
    }
    await page.screenshot({
      path: `${evidenceDir}/${name}-${w}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass(`${name}: desktop/tablet/phone layouts`);
}
try {
  await verifyLedger(db);
  const made = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { gi_compass_synthetic: true },
  });
  if (made.error) throw new Error("Test identity unavailable");
  userId = made.data.user.id;
  await db.query("insert into app.sites(id,name) values($1,$2)", [
    site,
    "GI Clinic · UI verification",
  ]);
  await db.query(
    "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
    [userId, `SYN-UI-${run}`],
  );
  await db.query(
    "insert into app.site_memberships(user_id,site_id,role) values($1,$2,'clinician'),($1,$2,'site_admin')",
    [userId, site],
  );
  await db.query(
    "insert into app.intake_sites(site_id,slug,enabled) values($1,$2,true)",
    [site, slug],
  );
  if (!demo) {
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
      APP_ENVIRONMENT: "test",
      APP_ORIGIN: origin,
      NEXT_PUBLIC_SUPABASE_URL: settings.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.key,
      SUPABASE_EXPECTED_PROJECT_REF: settings.ref,
      SUPABASE_VERIFIED_REGION: "ap-south-1",
      SUPABASE_REGION_VERIFIED_AT: process.env.TEST_SUPABASE_REGION_VERIFIED_AT,
      SUPABASE_AUTH_ADMIN_KEY: settings.admin,
      PATIENT_ENTRY_SLUG: slug,
    });
    stage = "build";
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["node_modules/next/dist/bin/next", "build"],
        { env: runtime, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      let log = "";
      child.stdout.on("data", (b) => (log += b));
      child.stderr.on("data", (b) => (log += b));
      child.on("close", (code) => {
        writeFileSync(`${evidenceDir}/build.log`, log);
        if (code === 0) resolve();
        else reject(new Error("Build failed; see build.log"));
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
      writeFileSync(`${evidenceDir}/server.log`, serverLog);
    });
  }
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(origin + "/sign-in")).ok) break;
    } catch {}
    await delay(500);
  }
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const staff = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
    }),
    patient = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 1000 },
    });
  const clinician = await staff.newPage(),
    page = await patient.newPage();
  clinician.setDefaultTimeout(30000);
  page.setDefaultTimeout(30000);
  stage = "staff authentication";
  await clinician.goto("/sign-in");
  await shot(clinician, "sign-in");
  await clinician.getByLabel("Staff email").fill(email);
  await clinician.getByLabel("Password", { exact: true }).fill(password);
  await clinician
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await clinician.waitForURL("**/mfa");
  const enrolled = clinician.waitForResponse(
    (r) =>
      r.url() === `${settings.url}/auth/v1/factors` &&
      r.request().method() === "POST",
  );
  await clinician.getByRole("button", { name: "Set up authenticator" }).click();
  const enrol = await (await enrolled).json();
  const otp = new TOTP({ secret: Secret.fromBase32(enrol.totp.secret) });
  await clinician.getByLabel("Authenticator code").fill(otp.generate());
  await clinician.getByRole("button", { name: "Verify and continue" }).click();
  await clinician.waitForURL("**/staff");
  pass("Staff login with real Auth and MFA");
  stage = "patient entry";
  await page.goto(`/start/${slug}`);
  await shot(page, "patient-entry");
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await page.waitForURL("**/patient");
  await page.getByRole("heading", { name: "Before you continue" }).waitFor();
  await shot(page, "consent");
  expect(
    (await patient.cookies()).some(
      (c) => c.name === "gi-encounter" && c.httpOnly,
    ),
  ).toBe(true);
  expect((await patient.cookies()).some((c) => c.name.startsWith("sb-"))).toBe(
    false,
  );
  pass("Public patient entry requires no Auth session");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Aarav Mehra");
  await page.getByLabel("Age in years").fill("52");
  await page.getByLabel(/^Sex/).selectOption("Male");
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await expect(page.locator(".question-card")).toHaveCount(1);
  await expect(page.getByText(/safety answers are missing/)).toHaveCount(0);
  await shot(page, "questionnaire");
  stage = "Important advice with continued answering";
  await page
    .getByRole("radio", { name: "Pain is present now", exact: true })
    .check();
  await page
    .getByRole("radio", { name: "Unbearable pain", exact: true })
    .check();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue →", exact: true }),
  ).toBeEnabled();
  await shot(page, "immediate-care");
  await page
    .getByRole("radio", { name: "No abdominal pain", exact: true })
    .check();
  pass("Linked Important advice leaves the main questionnaire available");
  await page.getByRole("button", { name: "Save and pause" }).click();
  await page.getByRole("heading", { name: "You paused your intake" }).waitFor();
  await shot(page, "paused");
  await page.getByRole("button", { name: "Continue answering" }).click();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "No abdominal pain", exact: true }),
  ).toBeChecked();
  pass("Saved topic and answers survive pause, resume and reload");
  stage = "fictional remaining intake";
  const api = async (
    action: string,
    id: string | null,
    payload: unknown = {},
  ) => {
    const r = await patient.request.post("/api/demo", {
      headers: { Origin: origin },
      data: { action, id, patient: true, payload },
    });
    const j = await r.json();
    if (!r.ok() || !j.ok)
      throw new Error(`Patient ${action} failed (HTTP ${r.status()})`);
    return j.data;
  };
  let encounter = await api("get", null);
  const id = encounter.id;
  // Remaining answers are explicit fictional fixture values, written through the normal capability boundary.
  await api("save", id, {
    version: encounter.version,
    intake: { ...scenarios[0].intake, name: "Aarav Mehra", stage: 5 },
  });
  await page.reload();
  await page
    .getByRole("heading", { name: "Bring your reports into the conversation" })
    .waitFor();
  stage = "report upload";
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("public/demo-assets/synthetic-whole-body-report.pdf");
  await page
    .getByRole("button", {
      name: "synthetic-whole-body-report.pdf",
      exact: true,
    })
    .waitFor();
  await shot(page, "report-upload");
  const footer = await page.locator(".flow-footer").boundingBox();
  const uploads = await page.locator(".report-library").boundingBox();
  if (footer && uploads)
    expect(footer.y).toBeGreaterThanOrEqual(uploads.y + uploads.height);
  if (demo) {
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles("public/demo-assets/synthetic-written-imaging-report.pdf");
    await page
      .getByRole("button", {
        name: "synthetic-written-imaging-report.pdf",
        exact: true,
      })
      .waitFor();
  }
  encounter = await api("get", id);
  const report = encounter.reports[0];
  await page
    .getByRole("button", {
      name: "synthetic-whole-body-report.pdf",
      exact: true,
    })
    .click();
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas");
    return c && c.width > 100;
  });
  pass("Authorised original PDF renders");
  // A failed extractor must still allow a real clinician to inspect and verify source evidence.
  if (!demo)
    await db.query(
      "update phi.demo_reports set extraction_status='failed',quality='Staff review required' where id=$1",
      [report.id],
    );
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for AI and clinician review" })
    .click();
  await page
    .getByRole("heading", { name: "Your preliminary assessment", exact: true })
    .waitFor();
  stage = demo
    ? "automatic extraction and actual demo worker"
    : "staff verification";
  if (demo) {
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline) {
      encounter = await api("get", id);
      if (encounter.aiAvailable) break;
      if (encounter.job?.status === "failed")
        throw new Error("Demo assessment failed: " + encounter.job.errorCode);
      if (
        encounter.reports.some(
          (r: { extractionStatus: string }) => r.extractionStatus === "failed",
        )
      )
        throw new Error("Demo report extraction failed");
      await delay(2500);
    }
    expect(encounter.aiAvailable).toBe(true);
    expect(encounter.ai.promptVersion).toBe(prompts.version);
    expect(
      encounter.reports.every(
        (r: { extractionStatus: string; fields: { verified: boolean }[] }) =>
          r.extractionStatus === "completed" &&
          r.fields.length > 0 &&
          r.fields.every((f) => !f.verified),
      ),
    ).toBe(true);
    const types = new Set(
      encounter.ai.sourceFacts
        .filter((f: { reportId?: string }) => f.reportId)
        .map((f: { reportType?: string }) => f.reportType),
    );
    for (const type of ["blood-test", "ultrasound", "ct", "mri"])
      expect(types.has(type)).toBe(true);
    expect(
      encounter.ai.possibilities.some((p: { evidenceIds: string[] }) =>
        p.evidenceIds.some((id) => id.startsWith("report:")),
      ),
    ).toBe(true);
    expect(
      new Set(
        encounter.ai.possibilities.map(
          (p: { uncertainty: string }) => p.uncertainty,
        ),
      ).size,
    ).toBe(encounter.ai.possibilities.length);
    expect(
      (
        await db.query(
          "select count(*)::int n from audit.audit_events where record_ids @> array[$1::uuid] and action='demo_report_verify' and outcome='allowed'",
          [id],
        )
      ).rows[0].n,
    ).toBe(0);
    writeFileSync(
      `${evidenceDir}/fictional-assessment.json`,
      JSON.stringify(encounter.ai, null, 2),
    );
    pass(
      "Actual demo worker uses unverified blood, ultrasound, CT and MRI text automatically",
    );
    await page
      .getByRole("heading", {
        name: "Your preliminary AI assessment",
        exact: true,
      })
      .waitFor({ timeout: 30000 });
    await shot(page, "ai-assessment");
    await page.locator(".hypothesis-open").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await shot(page, "evidence-detail");
    await page.getByRole("button", { name: "Close evidence" }).click();
    pass(
      "Current prompt, report citations and distinct uncertainty reach patient view",
    );
    await clinician.goto("/staff");
    await clinician
      .getByRole("link", { name: "Aarav Mehra", exact: true })
      .waitFor();
    await shot(clinician, "queue");
    await clinician.goto(`/staff/demo/${id}`);
  } else {
    await clinician.goto("/staff");
    await clinician
      .getByRole("link", { name: "Aarav Mehra", exact: true })
      .waitFor();
    await shot(clinician, "queue");
    await clinician.goto(`/staff/demo/${id}`);
    await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
    await clinician
      .getByRole("button", {
        name: "synthetic-whole-body-report.pdf",
        exact: true,
      })
      .click();
    await clinician
      .getByRole("button", { name: "Add a finding from the original" })
      .click();
    await clinician.getByLabel("Finding", { exact: true }).fill("Haemoglobin");
    await clinician.getByLabel("Value as printed").fill("10.4");
    await clinician.getByLabel("Unit", { exact: true }).fill("g/dL");
    await clinician
      .getByLabel("Exact source text")
      .fill("Haemoglobin 10.4 g/dL");
    await clinician
      .getByRole("checkbox", { name: "Verified against original" })
      .check();
    await clinician
      .getByRole("button", { name: "Save report corrections" })
      .click();
    await expect(
      clinician
        .getByRole("article")
        .getByText("Staff verified", { exact: true }),
    ).toBeVisible();
    await shot(clinician, "report-verification");
    pass("Staff verifies source-linked evidence");
    stage = "assessment job";
    encounter = await api("get", id);
    const claim = await worker.rpc("demo_worker", {
      p_action: "claim",
      p_id: encounter.job.id,
    });
    const job = claim.data?.data;
    if (!job) throw new Error("Assessment claim failed");
    if (liveAI) {
      const heartbeat = setInterval(() => {
        void worker
          .rpc("demo_worker", {
            p_action: "heartbeat",
            p_id: job.id,
            p_lease: job.lease,
          })
          .then((response) => {
            if (response.error || !response.data?.ok)
              console.log("Test assessment lease renewal failed");
          });
      }, 20000);
      try {
        const result = await generateAssessment(job, (raw) =>
          writeFileSync(
            `${evidenceDir}/browser-model-output.json`,
            JSON.stringify(raw, null, 2),
          ),
        );
        const published = await worker.rpc("demo_worker", {
          p_action: "complete",
          p_id: job.id,
          p_lease: job.lease,
          p_result: result,
        });
        expect(published.data?.ok).toBe(true);
        pass("Live AI generation published");
      } finally {
        clearInterval(heartbeat);
      }
      await page
        .getByRole("heading", {
          name: "Your preliminary AI assessment",
          exact: true,
        })
        .waitFor({ timeout: 30000 });
      await shot(page, "ai-assessment");
      await page.locator(".hypothesis-open").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot(page, "evidence-detail");
      await page.getByRole("button", { name: "Close evidence" }).click();
      pass("Source evidence and uncertainty detail opens");
    } else {
      await worker.rpc("demo_worker", {
        p_action: "fail",
        p_id: job.id,
        p_lease: job.lease,
        p_error: "invalid_output",
      });
      await page
        .getByRole("heading", {
          name: "AI assessment unavailable",
          exact: true,
        })
        .waitFor({ timeout: 30000 });
      await shot(page, "ai-unavailable");
      pass("Unavailable AI remains honest and does not block clinical review");
    }
  }
  stage = "clinician review";
  await clinician
    .getByRole("button", { name: "Your assessment", exact: true })
    .click();
  await clinician
    .getByLabel("Clinical impression")
    .fill(
      "Persistent bowel changes and bleeding require clinical investigation.",
    );
  await clinician.getByLabel(/^Urgency/).selectOption("prompt");
  await clinician
    .getByLabel("Instructions for the patient")
    .fill(
      "Attend gastroenterology review and bring the original reports. Discuss the investigations after examination.",
    );
  await clinician
    .getByLabel("Follow-up arrangements")
    .fill("Contact the clinic reception team to arrange the next visit.");
  await clinician
    .getByRole("checkbox", { name: "Colonoscopy", exact: true })
    .check();
  await shot(clinician, "clinical-assessment");
  await clinician
    .getByRole("button", { name: "Save independent assessment", exact: true })
    .click();
  await clinician
    .getByRole("button", { name: "Release clinician’s patient plan" })
    .waitFor();
  await clinician
    .getByRole("button", { name: "Release clinician’s patient plan" })
    .click();
  await clinician
    .getByRole("heading", { name: "Assessment saved. Patient plan released." })
    .waitFor();
  await shot(clinician, "assessment-complete");
  await page
    .getByRole("heading", { name: "Your clinician’s assessment" })
    .waitFor({ timeout: 30000 });
  await page.getByRole("heading", { name: "Tests to discuss" }).waitFor();
  await shot(page, "released-plan");
  pass("Independent assessment and structured released plan reach patient");
  await clinician
    .getByRole("button", { name: "Give optional AI feedback" })
    .click();
  await shot(clinician, "ai-comparison");
  if (liveAI) {
    await clinician.getByLabel("Overall assessment").selectOption("Accept");
    for (const label of [
      "Possible causes",
      "Evidence used",
      "Urgency",
      "Doctor type",
      "Suggested investigations",
      "Patient explanation",
    ]) {
      await clinician
        .getByLabel(label, { exact: true })
        .selectOption("Appropriate");
    }
    await clinician.getByRole("button", { name: "Save AI feedback" }).click();
    await expect(
      clinician.getByText("Feedback saved.", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await db.query(
          "select count(*)::int n from phi.ai_evaluations where encounter_id=$1",
          [id],
        )
      ).rows[0].n,
    ).toBe(1);
    pass(
      "Dimension-level AI feedback persists independently of the released plan",
    );
  }
  await clinician.goto("/staff/ai");
  await clinician
    .getByRole("heading", { name: "AI provider settings" })
    .waitFor();
  await shot(clinician, "provider-settings");
  stage = "reset";
  await page.getByRole("button", { name: "End this tablet session" }).click();
  await page.waitForURL("**/patient/ended");
  expect((await patient.cookies()).some((c) => c.name === "gi-encounter")).toBe(
    false,
  );
  pass("Patient device session clears after finishing");
  rmSync(`${evidenceDir}/failure.json`, { force: true });
  writeFileSync(
    `${evidenceDir}/results.json`,
    JSON.stringify(
      {
        status: "passed",
        checks,
        liveAI,
        environment: demo ? "demo" : "test",
        automaticallyUsedReports: demo,
        encounterId: id,
        promptVersion: prompts.version,
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (e) {
  writeFileSync(
    `${evidenceDir}/failure.json`,
    JSON.stringify(
      { stage, error: e instanceof Error ? e.message : "error" },
      null,
      2,
    ),
  );
  console.log(`FAILED ${stage}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
  if (userId) {
    await db.query(
      "update app.intake_sites set enabled=false where site_id=$1",
      [site],
    );
    await db.query(
      "update phi.demo_jobs set status='cancelled',lease=null where site_id=$1 and status in('queued','running')",
      [site],
    );
    await db.query(
      "update phi.demo_reports set extraction_status='cancelled',extraction_lease=null where site_id=$1 and extraction_status in('queued','running')",
      [site],
    );
    await db.query(
      "update app.staff_accounts set active=false where user_id=$1",
      [userId],
    );
    await admin.auth.admin.deleteUser(userId);
  }
  await db.end();
}
