import { existsSync, readFileSync, readdirSync } from "node:fs";
import { connectCloud, localMigrations, parseTap } from "./cloud.mjs";
for (const file of [".env", ".env.operator", ".env.test"])
  if (existsSync(file)) process.loadEnvFile(file);
const { client } = await connectCloud("test");
let stage = "ledger";
try {
  const applied = (
    await client.query("select name,sha256 from public.gi_schema_migrations")
  ).rows;
  const local = localMigrations();
  if (
    applied.some(
      (r) => !local.some((m) => m.name === r.name && m.sha256 === r.sha256),
    )
  )
    throw new Error("MIGRATION_DRIFT");
  await client.query("begin");
  for (const migration of local) {
    if (applied.some((r) => r.name === migration.name)) continue;
    stage = migration.name;
    await client.query(
      readFileSync(`supabase/migrations/${migration.name}`, "utf8"),
    );
    console.log(`Validated pending migration: ${migration.name}`);
  }
  const selected = process.argv.find((v) => v.startsWith("--file="))?.slice(7);
  for (const name of readdirSync("supabase/tests/database")
    .filter((n) => n.endsWith(".sql") && (!selected || n === selected))
    .sort()) {
    stage = name;
    await client.query("savepoint fictional_test");
    await client.query("set local search_path=public,extensions,pg_catalog");
    const results = await client.query(
      readFileSync(`supabase/tests/database/${name}`, "utf8"),
    );
    const tap =
      (Array.isArray(results) ? results : [results])
        .flatMap((r) => r.rows)
        .flatMap(Object.values)
        .filter((v) => typeof v === "string")
        .join("\n") + "\n";
    // Assertion descriptions only; do not emit returned encounter fields.
    for (const line of tap.split("\n").filter((s) => /^not ok \d+/.test(s)))
      console.log(line);
    const parsed = await parseTap(tap);
    console.log(
      `${name}: ${parsed.count} assertions passed with pending schema`,
    );
    await client.query("rollback to savepoint fictional_test");
  }
} catch (error) {
  console.log(
    JSON.stringify({
      stage,
      code: error.code || error.message,
      position: error.position,
    }),
  );
  process.exitCode = 1;
} finally {
  await client.query("rollback");
  await client.end();
}
