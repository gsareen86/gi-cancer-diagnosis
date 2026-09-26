import { readFileSync, existsSync } from "node:fs";
import {
  inspectRegistry,
  currentCommit,
  implementationHash,
  mergeEvidence,
} from "./invariant-lib.mjs";
const registry = JSON.parse(
  readFileSync("tests/invariants/registry.json", "utf8").replace(/^\uFEFF/, ""),
);
const identity = {
  commit: currentCommit(),
  artifactHash: implementationHash(),
};
const evidence = mergeEvidence(
  [
    "unit",
    "database",
    "hosted",
    "browser",
    "operator",
    "operator-lifecycle",
  ].flatMap((kind) => {
    const file = `var/test-results/${kind}-evidence.json`;
    return existsSync(file) ? [JSON.parse(readFileSync(file, "utf8"))] : [];
  }),
  identity,
);
// Verification is for this exact source snapshot, not a permanent green flag in
// a source file. Unprivileged CI can inspect the registry without hosted secrets.
const checkedRegistry = structuredClone(registry);
const requireAutomated = process.argv.includes(
  "--require-automated-foundation",
);
if (requireAutomated) {
  for (const invariant of checkedRegistry.invariants)
    for (const control of invariant.controls)
      if (
        control.owner === "foundation" &&
        control.evidenceType === "automated"
      )
        control.status = "verified";
}
const { errors, summary } = inspectRegistry(
  checkedRegistry,
  evidence,
  identity,
);
for (const error of errors) console.error(error);
for (const [id, status] of Object.entries(summary))
  console.log(`${id}: ${status}`);
if (
  process.argv.includes("--require-foundation") &&
  registry.invariants.some((i) =>
    i.controls.some((c) => c.owner === "foundation" && c.status !== "verified"),
  )
) {
  console.error("Foundation verification is incomplete.");
  process.exitCode = 1;
}
if (errors.length) process.exitCode = 1;
else if (requireAutomated)
  console.log(
    "Automated foundation controls verified for this source snapshot. Manual and deferred controls remain separate.",
  );
