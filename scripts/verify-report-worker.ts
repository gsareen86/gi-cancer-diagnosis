// Regression for actual report processing lasting longer than the initial 90-second lease.
// Only the bundled fictional report and an isolated test clinic are used.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { connectCloud, verifyLedger } from "./cloud.mjs";
for (const file of [".env", ".env.operator", ".env.test"])
  if (existsSync(file)) process.loadEnvFile(file);
const { client: db, settings } = await connectCloud("test");
const site = randomUUID(),
  user = randomUUID(),
  slug = `report-${randomUUID()}`;
let encounterId: string | undefined;
try {
  await verifyLedger(db);
  await db.query(
    "insert into auth.users(id,email,role,aud) values($1,$2,'authenticated','authenticated')",
    [user, `${user}@demo.invalid`],
  );
  await db.query(
    "insert into app.sites(id,name) values($1,'Fictional report worker verification')",
    [site],
  );
  await db.query(
    "insert into app.staff_accounts(user_id,synthetic_key) values($1,$2)",
    [user, `SYN-${user}`],
  );
  await db.query(
    "insert into app.site_memberships(user_id,site_id,role) values($1,$2,'clinician')",
    [user, site],
  );
  await db.query(
    "insert into app.intake_sites(site_id,slug,enabled) values($1,$2,true)",
    [site, slug],
  );
  const service = createClient(settings.url, settings.admin, {
    db: { schema: "api" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const publicClient = createClient(settings.url, settings.key, {
    db: { schema: "api" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const entry = await service.rpc("patient_start", { p_slug: slug });
  if (!entry.data?.ok) throw new Error("Entry failed");
  encounterId = entry.data.data.id;
  const token = entry.data.data.token;
  async function action(action: string, payload: object) {
    const r = await publicClient.rpc("demo_action", {
      p_action: action,
      p_id: encounterId,
      p_token: token,
      p_payload: payload,
    });
    if (!r.data?.ok) throw new Error(`Fictional report ${action} failed`);
    return r.data.data;
  }
  await action("consent", {
    accepted: true,
    noticeVersion: "gi-privacy-2026-09-22",
  });
  const task = getDocument({
    data: new Uint8Array(
      readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
    ),
    useSystemFonts: true,
    verbosity: 0,
  });
  const document = await task.promise,
    page = await document.getPage(1),
    viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
  }).promise;
  const image = canvas.toBuffer("image/png");
  await task.destroy();
  const encounter = await action("report_add", {
    name: "Fictional report page.png",
    mime: "image/png",
    body: image.toString("base64"),
    fields: [],
    quality: "Processing",
  });
  const reportId = encounter.reports[0].id;
  const started = Date.now();
  console.log("Processing fictional report through the independent worker…");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/demo-worker.ts",
        "--test",
        "--once",
        "--report-id",
        reportId,
      ],
      { windowsHide: true, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Worker failed")),
    );
  });
  const { rows } = await db.query(
    "select extraction_status status,jsonb_array_length(fields) count,not exists(select 1 from jsonb_array_elements(fields) f where f->>'verified'='true') unverified from phi.demo_reports where id=$1",
    [reportId],
  );
  const beats = (
    await db.query(
      "select count(*)::int count from audit.audit_events where action='demo_report_worker_heartbeat' and record_ids=array[$1::uuid] and outcome='allowed'",
      [encounterId],
    )
  ).rows[0].count;
  if (
    rows[0]?.status !== "completed" ||
    rows[0].count < 1 ||
    !rows[0].unverified ||
    beats < 1
  )
    throw new Error("Report processing or lease renewal assertion failed");
  const result = {
    status: "passed",
    fields: rows[0].count,
    unverified: true,
    heartbeats: beats,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  mkdirSync("var/ui-review", { recursive: true });
  writeFileSync(
    "var/ui-review/report-worker.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (error) {
  console.log(
    error instanceof Error ? error.message : "Report verification failed",
  );
  process.exitCode = 1;
} finally {
  await db.query("update app.intake_sites set enabled=false where site_id=$1", [
    site,
  ]);
  await db.query(
    "update app.staff_accounts set active=false where user_id=$1",
    [user],
  );
  await db.query(
    "update phi.demo_reports set extraction_status='cancelled',extraction_lease=null where site_id=$1 and extraction_status in('queued','running')",
    [site],
  );
  await db.end();
}
