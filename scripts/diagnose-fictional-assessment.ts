// Only a rehearsal-generated fictional snapshot is eligible. No arbitrary visit input.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { connectCloud, verifyLedger } from "./cloud.mjs";
import { generateAssessment } from "../src/lib/demo/model-gateway";
for (const name of [".env", ".env.operator"])
  if (existsSync(name)) process.loadEnvFile(name);
const { client: db } = await connectCloud("demo");
mkdirSync("var/demo-live-review", { recursive: true });
try {
  await verifyLedger(db);
  if (!process.env.OPERATOR_ID) throw new Error("OPERATOR_REQUIRED");
  const request = randomUUID();
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,resource_type) values($1,'synthetic_rehearsal','fictional_assessment_diagnostic',$2,'intent','encounter')",
    [process.env.OPERATOR_ID, request],
  );
  const { rows } = await db.query(
    "select j.snapshot,e.id from phi.demo_jobs j join phi.encounters e on e.id=j.encounter_id join app.sites s on s.id=e.site_id join app.staff_accounts a on a.user_id=e.assigned_to where s.name='GI Clinic · UI verification' and a.synthetic_key like 'SYN-UI-%' and e.synthetic and e.intake->>'name'='Aarav Mehra' and j.status='failed' order by j.created_at desc limit 1",
  );
  const row = rows[0];
  if (
    !row ||
    row.snapshot.reports.length !== 2 ||
    row.snapshot.reports.some(
      (r: { name: string }) =>
        ![
          "synthetic-whole-body-report.pdf",
          "synthetic-written-imaging-report.pdf",
        ].includes(r.name),
    )
  )
    throw new Error("FICTIONAL_FIXTURE_REQUIRED");
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,record_ids,resource_type) values($1,'synthetic_rehearsal','fictional_assessment_diagnostic',$2,'completed',$3,'encounter')",
    [process.env.OPERATOR_ID, request, [row.id]],
  );
  let attempt = 0;
  try {
    const result = await generateAssessment(row.snapshot, (raw) =>
      writeFileSync(
        `var/demo-live-review/diagnostic-${++attempt}.json`,
        JSON.stringify(raw, null, 2),
      ),
    );
    console.log(
      `Fictional diagnostic generation passed with ${result.possibilities.length} possibilities.`,
    );
  } catch (error) {
    console.log(
      `Fictional diagnostic failed: ${error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "unknown"}; captured outputs: ${attempt}`,
    );
    process.exitCode = 1;
  }
} finally {
  await db.end();
}
