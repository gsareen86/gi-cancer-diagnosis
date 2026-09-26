import {
  readFileSync,
  existsSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { Parser } from "tap-parser";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";

/** @param {string} kind @param {Record<string, string | undefined>} env */
export function cloudSettings(kind = "demo", env = process.env) {
  const prefix = kind === "test" ? "TEST_" : "";
  const get = (name) => env[`${prefix}SUPABASE_${name}`] ?? "";
  const settings = {
    kind,
    ref: get("EXPECTED_PROJECT_REF"),
    url: get("URL") || (kind === "demo" ? env.NEXT_PUBLIC_SUPABASE_URL : ""),
    key:
      get("PUBLISHABLE_KEY") ||
      (kind === "demo" ? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : ""),
    database: get("DATABASE_URL"),
    ca: get("DATABASE_CA_FILE"),
    admin: get("AUTH_ADMIN_KEY"),
    management: get("ACCESS_TOKEN") || env.SUPABASE_ACCESS_TOKEN,
  };
  if (
    !["demo", "test"].includes(kind) ||
    !settings.database ||
    !settings.key?.startsWith("sb_publishable_") ||
    !settings.ref.match(/^[a-z0-9]{20}$/) ||
    settings.url !== `https://${settings.ref}.supabase.co` ||
    get("VERIFIED_REGION") !== "ap-south-1" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(get("REGION_VERIFIED_AT")) ||
    !Number.isFinite(Date.parse(get("REGION_VERIFIED_AT")))
  )
    throw new Error("CONFIGURATION_REQUIRED");
  if (
    kind === "test" &&
    (!env.SUPABASE_EXPECTED_PROJECT_REF ||
      settings.ref === env.SUPABASE_EXPECTED_PROJECT_REF)
  )
    throw new Error("TEST_TARGET_NOT_ISOLATED");
  const connection = new URL(settings.database);
  const direct =
    connection.hostname === `db.${settings.ref}.supabase.co` &&
    decodeURIComponent(connection.username) === "postgres";
  const pooled =
    connection.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(connection.username) === `postgres.${settings.ref}` &&
    connection.port === "5432";
  if (
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    !(direct || pooled) ||
    connection.pathname !== "/postgres"
  )
    throw new Error("DATABASE_TARGET_MISMATCH");
  connection.search = "";
  settings.database = connection.toString();
  return settings;
}
export function isAuthAdminKey(value, projectRef) {
  if (typeof value !== "string") return false;
  if (value.startsWith("sb_secret_") && value.length > 20) return true;
  // This is a type/target check only. Supabase verifies the credential itself.
  try {
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload.role === "service_role" && payload.ref === projectRef;
  } catch {
    return false;
  }
}
export function localMigrations() {
  return readdirSync("supabase/migrations")
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => ({
      name,
      sha256: createHash("sha256")
        .update(readFileSync(resolve("supabase/migrations", name)))
        .digest("hex"),
    }));
}
export async function verifyLedger(client) {
  const result = await client.query(
    "select name,sha256 from public.gi_schema_migrations order by name",
  );
  if (JSON.stringify(result.rows) !== JSON.stringify(localMigrations()))
    throw new Error("MIGRATION_DRIFT");
}
export async function parseTap(tap) {
  const assertions = [];
  const parsed = await new Promise((resolveResult) => {
    const parser = new Parser();
    parser.on("assert", (assertion) =>
      assertions.push({
        name: assertion.name,
        status:
          assertion.ok && !assertion.skip && !assertion.todo
            ? "passed"
            : "failed",
      }),
    );
    parser.on("complete", resolveResult);
    parser.end(tap);
  });
  if (
    !parsed.ok ||
    !parsed.count ||
    parsed.skip ||
    parsed.todo ||
    parsed.plan.end !== parsed.count
  )
    throw new Error("DATABASE_ASSERTION_FAILED");
  return { count: parsed.count, assertions };
}
export async function validateTap(tap) {
  return (await parseTap(tap)).count;
}
async function verifyRunnerFailureAndRollback(client) {
  let refused = false;
  await client.query("begin");
  try {
    await client.query("set local search_path=public,extensions,pg_catalog");
    await client.query(
      "create temporary table gi_runner_rollback_probe(value integer)",
    );
    const result = await client.query(
      "select plan(1) as tap; select ok(false,'deliberate runner failure') as tap; select * from finish()",
    );
    const tap =
      result
        .flatMap((r) => r.rows)
        .flatMap((row) => Object.values(row))
        .join("\n") + "\n";
    try {
      await parseTap(tap);
    } catch (error) {
      if (error.message !== "DATABASE_ASSERTION_FAILED") throw error;
      refused = true;
    }
  } finally {
    await client.query("rollback");
  }
  const probe = await client.query(
    "select to_regclass('pg_temp.gi_runner_rollback_probe') is null as rolled_back",
  );
  if (!refused || !probe.rows[0].rolled_back)
    throw new Error("DATABASE_RUNNER_SELF_TEST_FAILED");
  console.log(
    "Runner self-check: deliberate failure rejected and transaction rolled back.",
  );
}
export async function connectCloud(kind = "demo") {
  const settings = cloudSettings(kind);
  const client = new pg.Client({
    connectionString: settings.database,
    ssl: {
      rejectUnauthorized: true,
      ...(settings.ca ? { ca: readFileSync(settings.ca, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select to_regclass('app.settings') is not null as present",
    );
    if (rows[0].present) {
      const result = await client.query(
        "select project_ref,environment from app.settings",
      );
      if (
        result.rows.length !== 1 ||
        result.rows[0].project_ref !== settings.ref ||
        result.rows[0].environment !== kind
      )
        throw new Error("DATABASE_MARKER_MISMATCH");
    }
    return { client, settings, present: rows[0].present };
  } catch (error) {
    await client.end();
    throw error;
  }
}
export async function migrate(kind, apply = false) {
  const { client, settings } = await connectCloud(kind);
  try {
    if (!apply) {
      const ledger = await client.query(
        "select to_regclass('public.gi_schema_migrations') is not null as present",
      );
      const applied = ledger.rows[0].present
        ? (
            await client.query(
              "select name,sha256 from public.gi_schema_migrations",
            )
          ).rows
        : [];
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
      for (const file of local)
        console.log(
          `${applied.some((row) => row.name === file.name) ? "Applied" : "Pending"}: ${file.name}`,
        );
      console.log(
        "Read-only migration plan. Review pending SQL before adding --apply.",
      );
      return;
    }
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtext('gi_compass_migrations'))",
    );
    await client.query(
      "create table if not exists public.gi_schema_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now())",
    );
    await client.query(
      "revoke all on public.gi_schema_migrations from public,anon,authenticated,service_role",
    );
    const applied = await client.query(
      "select name,sha256 from public.gi_schema_migrations",
    );
    const files = readdirSync("supabase/migrations")
      .filter((n) => /^\d+_[a-z0-9_]+\.sql$/.test(n))
      .sort();
    if (applied.rows.some((row) => !files.includes(row.name)))
      throw new Error("UNKNOWN_REMOTE_MIGRATION");
    for (const file of files) {
      const text = readFileSync(resolve("supabase/migrations", file), "utf8");
      const sha = createHash("sha256").update(text).digest("hex");
      const previous = applied.rows.find((row) => row.name === file);
      if (previous) {
        if (previous.sha256 !== sha) throw new Error("MIGRATION_DRIFT");
        continue;
      }
      await client.query(text);
      await client.query(
        "insert into public.gi_schema_migrations(name,sha256) values($1,$2)",
        [file, sha],
      );
    }
    await client.query(
      "update app.settings set project_ref=$1,environment=$2 where singleton",
      [settings.ref, kind],
    );
    await client.query("commit");
    console.log(
      "Reviewed migrations applied to the verified synthetic target.",
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
export async function testDatabase() {
  rmSync("var/test-results/database-evidence.json", { force: true });
  const identity = {
    commit: currentCommit(),
    artifactHash: implementationHash(),
  };
  const tests = [];
  const { client, present } = await connectCloud("test");
  try {
    if (!present) throw new Error("MIGRATIONS_REQUIRED");
    await verifyLedger(client);
    await client.query(
      "create extension if not exists pgtap with schema extensions",
    );
    await verifyRunnerFailureAndRollback(client);
    const testFiles = readdirSync("supabase/tests/database")
      .filter((n) => n.endsWith(".sql"))
      .sort();
    if (!testFiles.length) throw new Error("DATABASE_ASSERTION_FAILED");
    for (const name of testFiles) {
      await client.query("begin");
      try {
        await client.query(
          "set local search_path=public,extensions,pg_catalog",
        );
        const results = await client.query(
          readFileSync(resolve("supabase/tests/database", name), "utf8"),
        );
        const tap =
          (Array.isArray(results) ? results : [results])
            .flatMap((r) => r.rows)
            .flatMap((row) => Object.values(row))
            .filter((v) => typeof v === "string")
            .join("\n") + "\n";
        const parsed = await parseTap(tap);
        tests.push(
          ...parsed.assertions.map((assertion) => ({
            id: `${name}: ${assertion.name}`,
            status: assertion.status,
          })),
        );
        console.log(`${name}: ${parsed.count} assertions passed`);
      } finally {
        await client.query("rollback");
      }
    }
    if (
      identity.commit !== currentCommit() ||
      identity.artifactHash !== implementationHash()
    )
      throw new Error("TEST_SOURCE_CHANGED");
    mkdirSync("var/test-results", { recursive: true });
    writeFileSync(
      "var/test-results/database-evidence.json",
      JSON.stringify({ ...identity, tests }, null, 2),
    );
  } finally {
    await client.end();
  }
}
async function main() {
  const test = process.argv.includes("--test");
  const command = process.argv[2];
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (existsSync(".env.operator")) process.loadEnvFile(".env.operator");
  if (existsSync(".env.test")) process.loadEnvFile(".env.test");
  if (command === "migrate") {
    return migrate(test ? "test" : "demo", process.argv.includes("--apply"));
  }
  if (command === "test") return testDatabase();
  if (command === "types" || command === "types-check") {
    const { client, settings, present } = await connectCloud("test");
    try {
      if (present) await verifyLedger(client);
    } finally {
      await client.end();
    }
    if (!present || !settings.management)
      throw new Error("TYPE_GENERATION_CONFIGURATION_REQUIRED");
    const result = spawnSync(
      process.execPath,
      [
        resolve("node_modules/supabase/dist/supabase.js"),
        "gen",
        "types",
        "typescript",
        "--project-id",
        settings.ref,
        "--schema",
        "api",
      ],
      {
        encoding: "utf8",
        shell: false,
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: settings.management },
        timeout: 60000,
      },
    );
    if (result.status !== 0 || !result.stdout?.includes("export type Database"))
      throw new Error("TYPE_GENERATION_FAILED");
    if (command === "types-check") {
      if (
        !existsSync("src/lib/database.types.ts") ||
        readFileSync("src/lib/database.types.ts", "utf8").replace(
          /\r\n/g,
          "\n",
        ) !== result.stdout.replace(/\r\n/g, "\n")
      )
        throw new Error("GENERATED_TYPES_DRIFT");
      console.log("Remote API types match the checked-in artifact.");
      return;
    }
    writeFileSync("src/lib/database.types.ts", result.stdout);
    console.log("API types generated from designated test project.");
    return;
  }
  const { client, present } = await connectCloud(test ? "test" : "demo");
  try {
    if (present) await verifyLedger(client);
  } finally {
    await client.end();
  }
  console.log(
    present
      ? "Cloud target and marker verified."
      : "Cloud target verified; migrations not applied.",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    const configurationCodes = [
      "CONFIGURATION_REQUIRED",
      "TEST_TARGET_NOT_ISOLATED",
      "DATABASE_TARGET_MISMATCH",
      "DATABASE_MARKER_MISMATCH",
      "MIGRATIONS_REQUIRED",
      "TYPE_GENERATION_CONFIGURATION_REQUIRED",
    ];
    const failureCodes = [
      "DATABASE_ASSERTION_FAILED",
      "MIGRATION_DRIFT",
      "UNKNOWN_REMOTE_MIGRATION",
      "GENERATED_TYPES_DRIFT",
      "TYPE_GENERATION_FAILED",
    ];
    const code = [...configurationCodes, ...failureCodes].includes(
      error?.message,
    )
      ? error.message
      : "CONNECTION_OR_DATABASE_ERROR";
    console.error(
      `${configurationCodes.includes(code) ? "NOT RUN" : "FAILED"}: ${code}. No provider payloads or credentials are printed; no fallback was attempted.`,
    );
    process.exitCode = 1;
  });
}
