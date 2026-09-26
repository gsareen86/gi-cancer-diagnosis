import { chromium, expect, type Page, type Route } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { TOTP, Secret } from "otpauth";
import { connectCloud, verifyLedger } from "./cloud.mjs";

const checks: string[] = [];
let stage = "setup";
for (const f of [".env", ".env.operator", ".env.test"])
  if (existsSync(f)) process.loadEnvFile(f);
const { client: db, settings } = await connectCloud("test");
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
const origin = "http://localhost:3211";
let userId: string | undefined,
  server: ReturnType<typeof spawn> | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
mkdirSync("var/intake-recovery", { recursive: true });
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
        path: "var/intake-recovery/overflow.png",
        fullPage: true,
      });
      writeFileSync(
        "var/intake-recovery/overflow.json",
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
      path: `var/intake-recovery/${name}-${w}.png`,
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
      writeFileSync("var/intake-recovery/build.log", log);
      if (code === 0) resolve();
      else reject(new Error("Build failed; see build.log"));
    });
  });
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", "3211"],
    { env: runtime, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let serverLog = "";
  server.stderr?.on("data", (b) => {
    serverLog += b;
    writeFileSync("var/intake-recovery/server.log", serverLog);
  });
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

  stage = "fictional patient and report";
  await page.goto("/start/" + slug);
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Agree and continue" }).click();
  const patientAction = async (
    action: string,
    id: string | null,
    payload: unknown = {},
  ) => {
    const response = await patient.request.post("/api/demo", {
      headers: { Origin: origin },
      data: { action, id, patient: true, payload },
    });
    const result = await response.json();
    if (!response.ok() || !result.ok)
      throw new Error("Patient action failed: " + action);
    return result.data;
  };
  let encounter = await patientAction("get", null);
  const id = encounter.id;
  encounter = await patientAction("save", id, {
    version: encounter.version,
    intake: {
      name: "Fictional Recovery Patient",
      age: 40,
      sex: "Male",
      suppliedBy: "patient",
      enteredBy: "patient",
      relationship: "",
      stage: 5,
      answers: {},
    },
  });
  const uploaded = await patient.request.post("/api/demo/report", {
    headers: { Origin: origin },
    multipart: {
      encounterId: id,
      file: {
        name: "fictional-whole-body.pdf",
        mimeType: "application/pdf",
        buffer: readFileSync(
          "public/demo-assets/synthetic-whole-body-report.pdf",
        ),
      },
    },
  });
  const upload = await uploaded.json();
  if (!uploaded.ok() || !upload.ok) throw new Error("Fictional upload failed");
  encounter = upload.data;
  const reportId = encounter.reports[0].id;
  const claimed = await worker.rpc("report_worker", {
    p_action: "claim",
    p_id: reportId,
  });
  if (!claimed.data?.data) throw new Error("Fictional claim failed");
  const failed = await worker.rpc("report_worker", {
    p_action: "fail",
    p_id: reportId,
    p_lease: claimed.data.data.lease,
    p_error: "invalid_output",
  });
  if (!failed.data?.ok) throw new Error("Fictional failure setup failed");
  await page.reload();
  await expect(
    page.getByText("Processing failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your original report is saved. Staff can retry processing or review it directly.",
    ),
  ).toBeVisible();
  pass("Actual PDF upload and explicit patient failure feedback");
  encounter = await patientAction("submit", id);
  await clinician.goto("/staff/demo/" + id);
  // Keep these edits unsaved to detect UI data loss even when persistence is unavailable.
  const holdDraft = async (route: Route) => {
    if (route.request().postDataJSON()?.action === "draft")
      await route.abort("failed");
    else await route.continue();
  };
  await clinician.route("**/api/demo", holdDraft);
  const unsavedImpression = "Fictional assessment retained during extraction";
  const unsavedPlan =
    "Fictional patient instructions retained during extraction";
  await clinician.getByLabel("Clinical impression").fill(unsavedImpression);
  await clinician.getByLabel("Instructions for the patient").fill(unsavedPlan);
  const checkUnsaved = async () => {
    await clinician
      .getByRole("button", { name: "Your assessment", exact: true })
      .click();
    await expect(clinician.getByLabel("Clinical impression")).toHaveValue(
      unsavedImpression,
    );
    await expect(
      clinician.getByLabel("Instructions for the patient"),
    ).toHaveValue(unsavedPlan);
    await expect(
      clinician.getByText("Unsaved changes — save before leaving.", {
        exact: true,
      }),
    ).toBeVisible();
  };
  await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
  await expect(
    clinician.getByText("Processing failed", { exact: true }),
  ).toBeVisible();
  await expect(
    clinician.getByText(/processor’s response could not be validated/),
  ).toBeVisible();
  await shot(clinician, "report-failure");
  await clinician
    .getByRole("button", { name: "Retry processing fictional-whole-body.pdf" })
    .click();
  await expect(
    clinician.getByText("Waiting to process", { exact: true }),
  ).toBeVisible();
  await checkUnsaved();
  pass("Report retry preserves unsaved clinician text and dirty state");
  await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
  stage = "actual report worker";
  const extraction = new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/demo-worker.ts",
        "--test",
        "--report-id",
        reportId,
        "--once",
      ],
      {
        env: process.env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let log = "";
    child.stdout.on("data", (b) => (log += b));
    child.stderr.on("data", (b) => (log += b));
    child.on("error", reject);
    child.on("close", (code) => {
      writeFileSync("var/intake-recovery/worker.log", log);
      if (code === 0) resolve();
      else reject(new Error("Fictional worker failed"));
    });
  });
  await Promise.all([
    expect(
      clinician.getByText(/Processing · [0-9]+ of 3 pages read/),
    ).toBeVisible({ timeout: 60000 }),
    extraction,
  ]);
  pass("Worker page progress reaches the rendered clinician screen");
  await expect(
    clinician.getByText("Processed · Available to AI", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  encounter = await patientAction("get", id);
  expect(encounter.reports[0].fields.length).toBeGreaterThan(0);
  expect(
    encounter.reports[0].fields.every(
      (f: { verified: boolean; confidence: string }) =>
        !f.verified && f.confidence === "text-extracted",
    ),
  ).toBe(true);
  pass(
    "Gemini text extraction publishes unverified source-linked findings via leased worker",
  );
  await shot(clinician, "report-completed");
  await checkUnsaved();
  pass(
    "Report progress and completion polling preserve unsaved clinician text",
  );

  stage = "report verification and draft provenance";
  await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
  await clinician
    .getByRole("button", { name: "fictional-whole-body.pdf", exact: true })
    .click();
  const verify = async () => {
    const response = clinician.waitForResponse(
      (r) =>
        r.url() === origin + "/api/demo" &&
        r.request().postDataJSON()?.action === "report_verify",
    );
    await clinician
      .getByRole("button", { name: "Save report corrections", exact: true })
      .click();
    const saved = await response;
    expect(saved.ok()).toBe(true);
    return (await saved.json()).data;
  };
  const beforeVerification = encounter.version;
  encounter = await verify();
  expect(encounter.version).toBe(beforeVerification);
  await checkUnsaved();
  pass(
    "Unchanged report verification preserves version, unsaved text and dirty state",
  );

  await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
  await clinician
    .getByRole("button", { name: "fictional-whole-body.pdf", exact: true })
    .click();
  await clinician
    .getByRole("checkbox", { name: "Verified against original" })
    .first()
    .check();
  encounter = await verify();
  expect(encounter.version).toBe(beforeVerification + 1);
  await checkUnsaved();
  await expect(
    clinician.getByText(/The source information changed/),
  ).toBeVisible();
  await expect(
    clinician.getByRole("button", {
      name: "Save independent assessment",
      exact: true,
    }),
  ).toBeDisabled();
  pass(
    "Changed report evidence retains unsaved text and blocks signing against old facts",
  );

  await clinician.unroute("**/api/demo", holdDraft);
  await clinician
    .getByRole("button", {
      name: "I have reviewed the updated facts",
      exact: true,
    })
    .click();
  await expect(
    clinician.getByText(/The source information changed/),
  ).not.toBeVisible();
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue(
    unsavedImpression,
  );
  pass(
    "Clinician explicitly accepts updated facts without losing unsaved work",
  );
  await clinician
    .getByLabel("Clinical impression")
    .fill("Fictional saved draft before verification");
  await clinician
    .getByLabel("Instructions for the patient")
    .fill("Fictional saved instructions");
  await clinician
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(
    clinician.getByText("Unsaved changes — save before leaving.", {
      exact: true,
    }),
  ).not.toBeVisible();
  await clinician.getByRole("button", { name: /Reports & evidence/ }).click();
  await clinician
    .getByRole("button", { name: "fictional-whole-body.pdf", exact: true })
    .click();
  await clinician
    .getByRole("checkbox", { name: "Verified against original" })
    .nth(1)
    .check();
  encounter = await verify();
  await clinician
    .getByRole("button", { name: "Your assessment", exact: true })
    .click();
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue(
    "Fictional saved draft before verification",
  );
  await expect(clinician.getByLabel(/^Urgency/)).toHaveValue("review");
  await expect(
    clinician.getByText(/The source information changed/),
  ).toBeVisible();
  pass(
    "Optional evidence correction preserves saved draft and requires acknowledgement of newer facts",
  );
  await clinician.reload();
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue(
    "Fictional saved draft before verification",
  );
  await expect(
    clinician.getByText(/The source information changed/),
  ).toBeVisible();
  await clinician
    .getByRole("button", {
      name: "I have reviewed the updated facts",
      exact: true,
    })
    .click();

  await clinician
    .getByLabel("Clinical impression")
    .fill("Fictional draft before external evidence change");
  await clinician
    .getByLabel("Instructions for the patient")
    .fill("Retain this text while reviewing updated facts");
  await clinician
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  const external = await staff.request.post("/api/demo", {
    headers: { Origin: origin },
    data: {
      action: "report_verify",
      id,
      payload: {
        reportId,
        sourceVersion: encounter.version,
        fields: encounter.reports[0].fields.map(
          (f: { verified: boolean }, i: number) =>
            i === 1 ? { ...f, verified: false } : f,
        ),
      },
    },
  });
  expect(external.ok()).toBe(true);
  await expect(
    clinician.getByText(/The source information changed/),
  ).toBeVisible({ timeout: 15000 });
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue(
    "Fictional draft before external evidence change",
  );
  await expect(
    clinician.getByRole("button", {
      name: "Save independent assessment",
      exact: true,
    }),
  ).toBeDisabled();
  pass("Externally changed evidence never silently rebases a clinician form");
  stage = "independent assessment";
  // Simulate a historical minimal draft only on this newly created fictional visit.
  await db.query(
    "update phi.encounters set clinician_draft=$1::jsonb,draft_source_version=version,draft_at=now() where id=$2 and site_id=$3",
    [
      JSON.stringify({
        impression: "GERD",
        plan: "Review",
        specialty: "Gastroenterology",
        urgency: "review",
        privateNotes: "",
      }),
      id,
      site,
    ],
  );
  await clinician.reload();
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue("GERD");
  await clinician.getByLabel("Clinical impression").fill("   ");
  await clinician
    .getByRole("button", { name: "Save independent assessment", exact: true })
    .click();
  await expect(clinician.getByLabel("Clinical impression")).toBeFocused();
  await expect(clinician.getByLabel("Clinical impression")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    clinician.getByLabel("Instructions for the patient"),
  ).toHaveValue("Review");
  pass(
    "Field validation focuses the missing impression and preserves authored instructions",
  );
  await clinician.getByLabel("Clinical impression").fill("IBS");
  await clinician
    .getByRole("button", { name: "Save independent assessment", exact: true })
    .click();
  await expect(
    clinician
      .getByRole("status")
      .filter({ hasText: "Independent assessment saved." }),
  ).toBeVisible();
  await shot(clinician, "independent-saved");
  await clinician.reload();
  await expect(clinician.getByLabel("Clinical impression")).toHaveValue("IBS");
  await expect(
    clinician
      .getByRole("status")
      .filter({ hasText: "Independent assessment saved." }),
  ).toBeVisible();
  pass(
    "Short independent assessment saves through real Auth, API and SQL and survives reload",
  );
  rmSync("var/intake-recovery/failure.json", { force: true });
  writeFileSync(
    "var/intake-recovery/results.json",
    JSON.stringify(
      {
        status: "passed",
        checks,
        liveReportExtraction: true,
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
} catch (e) {
  writeFileSync(
    "var/intake-recovery/failure.json",
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
