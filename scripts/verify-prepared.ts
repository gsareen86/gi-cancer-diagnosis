// Only the three deterministic, generated current-prompt clinic fixtures are eligible.
// Optional refresh uses versioned invalidation and never changes clinician work.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { connectCloud, verifyLedger } from "./cloud.mjs";
import prompts from "../src/lib/ai/prompts.json";
import {
  assessmentSchema,
  evaluate,
  validateAssessment,
} from "../src/lib/demo/clinical";
for (const file of [".env", ".env.operator"])
  if (existsSync(file)) process.loadEnvFile(file);
if (!process.env.OPERATOR_ID) throw new Error("OPERATOR_REQUIRED");
const refreshInvalid = process.argv.includes("--refresh-invalid");
const { client: db } = await connectCloud("demo");
try {
  await verifyLedger(db);
  const request = randomUUID();
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,resource_type) values($1,'synthetic_rehearsal','prepared_current_review',$2,'intent','encounter')",
    [process.env.OPERATOR_ID, request],
  );
  // Preserve evidence of the read even if validation or a later refresh rolls back.
  await db.query("begin");
  const patients = (
    await db.query(
      "select id from phi.patients where site_id='11111111-1111-4111-8111-111111111111' and is_synthetic and synthetic_identifier ~ '^SYN-CLINIC-00[1-3]$' order by synthetic_identifier",
    )
  ).rows;
  const ids = patients.map((p: { id: string }) => {
    const h = createHash("sha256")
      .update(`hospital-demo-${prompts.version}:${p.id}`)
      .digest("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  });
  const rows = (
    await db.query(
      "select e.id,e.ai,e.ai_version=e.version as current,j.status,j.snapshot,(e.released_at is null and e.clinician_draft is null and e.independent is null and e.status in('queued','review_needed')) as refreshable from phi.encounters e left join phi.demo_jobs j on j.encounter_id=e.id and j.source_version=e.version where e.id=any($1::uuid[]) and e.synthetic and e.notice_version='synthetic-fixture-v1' and e.site_id='11111111-1111-4111-8111-111111111111' for update of e",
      [ids],
    )
  ).rows;
  if (rows.length !== 3) throw new Error("PREPARED_FIXTURES_MISSING");
  const invalid: string[] = [];
  for (const row of rows) {
    if (
      row.status !== "completed" ||
      !row.current ||
      row.ai?.promptVersion !== prompts.version
    )
      throw new Error("PREPARED_ASSESSMENT_NOT_CURRENT");
    try {
      validateAssessment(
        Object.fromEntries(
          Object.keys(assessmentSchema.shape).map((key) => [key, row.ai[key]]),
        ),
        row.ai.sourceFacts,
        evaluate(row.snapshot.intake.answers, row.snapshot.contentVersion)
          .urgency,
      );
    } catch {
      if (!refreshInvalid || !row.refreshable)
        throw new Error("PREPARED_ASSESSMENT_REVIEW_REQUIRED");
      invalid.push(row.id);
    }
  }
  await db.query(
    "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,record_ids,resource_type) values($1,'synthetic_rehearsal','prepared_current_review',$2,'completed',$3,'encounter')",
    [process.env.OPERATOR_ID, request, ids],
  );
  for (const id of invalid) {
    const refreshRequest = randomUUID();
    await db.query(
      "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,record_ids,resource_type) values($1,'synthetic_rehearsal','prepared_ai_refresh',$2,'intent',$3,'encounter')",
      [process.env.OPERATOR_ID, refreshRequest, [id]],
    );
    await db.query("select private.report_evidence_changed($1)", [id]);
    await db.query(
      "insert into audit.operator_events(operator_id,reason_code,action,request_id,outcome,record_ids,resource_type) values($1,'synthetic_rehearsal','prepared_ai_refresh',$2,'completed',$3,'encounter')",
      [process.env.OPERATOR_ID, refreshRequest, [id]],
    );
  }
  await db.query("commit");
  mkdirSync("var/demo-live-review", { recursive: true });
  for (const row of rows) {
    const prefix = row.id.slice(0, 8).toUpperCase();
    if (invalid.includes(row.id)) {
      console.log(
        `Queued fresh AI for fictional example ${prefix}; recheck after worker completion.`,
      );
      continue;
    }
    writeFileSync(
      `var/demo-live-review/prepared-${prefix}.json`,
      JSON.stringify(row.ai, null, 2),
    );
    console.log(
      `PASS current fictional example ${prefix}; ${row.ai.possibilities.length} possibilities; ${row.ai.sourceFacts.filter((f: { reportId?: string }) => f.reportId).length} report facts`,
    );
  }
} catch (error) {
  await db.query("rollback");
  console.log(
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "PREPARED_REVIEW_UNAVAILABLE",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
