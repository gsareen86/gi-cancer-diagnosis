import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { currentCommit, implementationHash } from "./invariant-lib.mjs";
mkdirSync("var/test-results", { recursive: true });
rmSync("var/test-results/unit-evidence.json", { force: true });
const identity = {
  commit: currentCommit(),
  artifactHash: implementationHash(),
};
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--project",
    "unit",
    "--reporter=default",
    "--reporter=json",
    "--outputFile.json=var/test-results/unit.json",
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  if (
    identity.commit !== currentCommit() ||
    identity.artifactHash !== implementationHash()
  )
    throw new Error("Sources changed during testing; rerun verification.");
  const report = JSON.parse(readFileSync("var/test-results/unit.json", "utf8"));
  const tests = report.testResults.flatMap((suite) =>
    suite.assertionResults.map((test) => ({
      id: test.fullName,
      status: test.status,
    })),
  );
  writeFileSync(
    "var/test-results/unit-evidence.json",
    JSON.stringify({ ...identity, tests }, null, 2),
  );
}
