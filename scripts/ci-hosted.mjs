import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { cloudSettings } from "./cloud.mjs";

try {
  cloudSettings("test");
  if (
    !process.env.TEST_SUPABASE_AUTH_ADMIN_KEY ||
    !(
      process.env.TEST_SUPABASE_ACCESS_TOKEN ||
      process.env.SUPABASE_ACCESS_TOKEN
    ) ||
    !process.env.OPERATOR_ID
  )
    throw new Error("MISSING_CONFIGURATION");
} catch {
  console.error(
    "NOT RUN: protected hosted verification requires every designated test credential and region/target setting.",
  );
  process.exit(1);
}
const ca = "var/ci-test-ca.pem";
try {
  if (process.env.TEST_SUPABASE_DATABASE_CA_PEM) {
    mkdirSync("var", { recursive: true });
    writeFileSync(ca, process.env.TEST_SUPABASE_DATABASE_CA_PEM, {
      mode: 0o600,
      flag: "wx",
    });
    process.env.TEST_SUPABASE_DATABASE_CA_FILE = ca;
  }
  for (const args of [
    ["scripts/cloud.mjs", "migrate", "--test"],
    ["scripts/cloud.mjs", "migrate", "--test", "--apply"],
    ["scripts/cloud.mjs", "verify", "--test"],
    ["scripts/operator.mjs", "seed", "--test", "--reason", "CI_FIXED_SEED"],
    ["scripts/unit-tests.mjs"],
    ["scripts/cloud.mjs", "test"],
    ["scripts/cloud.mjs", "types-check"],
    ["scripts/hosted-tests.mjs"],
    ["scripts/operator-tests.mjs"],
    ["scripts/hosted-browser.mjs"],
    ["scripts/check-invariants.mjs", "--require-automated-foundation"],
  ]) {
    const result = spawnSync(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) process.exitCode = 1;
    if (process.exitCode) break;
  }
} finally {
  if (process.env.TEST_SUPABASE_DATABASE_CA_PEM) rmSync(ca, { force: true });
}
