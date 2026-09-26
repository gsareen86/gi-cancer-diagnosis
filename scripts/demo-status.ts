import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { connectCloud, verifyLedger } from "./cloud.mjs";
import prompts from "../src/lib/ai/prompts.json";
for (const file of [".env", ".env.operator"])
  if (existsSync(file)) process.loadEnvFile(file);
if (!process.env.OPERATOR_ID) throw new Error("OPERATOR_ID_REQUIRED");
const { client: db } = await connectCloud("demo");
try {
  await verifyLedger(db);
  await db.query("begin");
  const request = randomUUID();
  const retry = process.argv.includes("--retry-failed");
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,resource_type) values($1,'synthetic_rehearsal',$2,$3,'intent','encounter')",
    [process.env.OPERATOR_ID, retry ? "demo_retry" : "demo_status", request],
  );
  const scope =
    "e.notice_version='synthetic-fixture-v1' and e.site_id in('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')";
  if (retry) {
    const result = await db.query(
      `update phi.demo_jobs j set status='queued',attempts=0,available_at=now(),lease=null,error_code=null from phi.encounters e where j.encounter_id=e.id and j.source_version=e.version and j.status='failed' and e.released_at is null and e.consent_at is not null and ${scope} returning j.encounter_id`,
    );
    console.log(
      `${result.rowCount} failed prepared examples queued for another actual inference attempt.`,
    );
  }
  const status = await db.query(
    `select case when j.status='completed' and e.ai->>'promptVersion' is distinct from $1 then 'older output - refresh needed' else j.status end as status,count(*)::int as count from phi.encounters e left join phi.demo_jobs j on j.encounter_id=e.id and j.source_version=e.version where ${scope} group by 1 order by 1`,
    [prompts.version],
  );
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,resource_type) values($1,'synthetic_rehearsal',$2,$3,'completed','encounter')",
    [process.env.OPERATOR_ID, retry ? "demo_retry" : "demo_status", request],
  );
  await db.query("commit");
  for (const row of status.rows)
    console.log(`${row.status ?? "not queued"}: ${row.count}`);
} catch {
  await db.query("rollback");
  console.log(
    "Demo status unavailable; no credentials or clinical payloads logged.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
