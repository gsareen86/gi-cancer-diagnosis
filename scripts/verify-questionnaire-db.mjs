// Existing isolated Cloud test project only. All migrations/fixtures roll back.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { connectCloud, parseTap, localMigrations } from "./cloud.mjs";
for (const path of [".env", ".env.operator", ".env.test"])
  if (existsSync(path)) process.loadEnvFile(path);
const { client } = await connectCloud("test");
try {
  const { rows: applied } = await client.query(
    "select name,sha256 from public.gi_schema_migrations",
  );
  const local = localMigrations();
  if (
    applied.some(
      (row) =>
        !local.some(
          (file) => file.name === row.name && file.sha256 === row.sha256,
        ),
    )
  )
    throw new Error("MIGRATION_DRIFT");
  const pending = local.filter(
    (file) => !applied.some((row) => row.name === file.name),
  );
  if (
    pending.some(
      (file) =>
        ![
          "20260922155406_contextual_questionnaire.sql",
          "20260922163147_questionnaire_review_fixes.sql",
          "20260922181320_clinician_review_validation.sql",
          "20260922183249_report_processing_recovery.sql",
          "20260922190112_report_verification_noop.sql",
        ].includes(file.name),
    )
  )
    throw new Error("UNREVIEWED_PENDING_MIGRATION");
  let total = 0;
  for (const name of readdirSync("supabase/tests/database")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    await client.query("begin");
    try {
      for (const file of pending)
        await client.query(
          readFileSync("supabase/migrations/" + file.name, "utf8"),
        );
      await client.query("set local search_path=public,extensions,pg_catalog");
      const result = await client.query(
        readFileSync("supabase/tests/database/" + name, "utf8"),
      );
      const tap =
        (Array.isArray(result) ? result : [result])
          .flatMap((r) => r.rows)
          .flatMap((row) => Object.values(row))
          .filter((v) => typeof v === "string")
          .join("\n") + "\n";
      const parsed = await parseTap(tap);
      total += parsed.count;
      console.log(name + ": " + parsed.count + " assertions passed");
    } finally {
      await client.query("rollback");
    }
  }
  console.log(
    total +
      " SQL assertions passed; draft migration and fictional fixtures rolled back.",
  );
} catch (e) {
  console.log("Questionnaire SQL verification failed: " + e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
