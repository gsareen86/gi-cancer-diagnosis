import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
export function implementationHash() {
  const files = [];
  const walk = (path) => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const next = resolve(path, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx|mjs|sql|json|css|md|yaml|yml)$/.test(entry.name))
        files.push(next);
    }
  };
  ["src", "scripts", "tests", "supabase", "openspec", ".github"].forEach(walk);
  [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "vitest.config.ts",
    "playwright.config.ts",
    "eslint.config.mjs",
    "postcss.config.mjs",
  ].forEach((f) => {
    if (existsSync(f)) files.push(resolve(f));
  });
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest.update(relative(process.cwd(), file).replaceAll("\\", "/"));
    digest.update(readFileSync(file));
  }
  return digest.digest("hex");
}
export function currentCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}
// Never relabel a stale suite with the current identity while combining results.
export function mergeEvidence(suites, identity) {
  const tests = new Map();
  for (const suite of suites) {
    if (
      suite?.commit !== identity.commit ||
      suite?.artifactHash !== identity.artifactHash
    )
      continue;
    for (const test of suite.tests ?? []) {
      const previous = tests.get(test.id);
      tests.set(
        test.id,
        previous && previous.status !== "passed" ? previous : test,
      );
    }
  }
  return { ...identity, tests: [...tests.values()] };
}
export function inspectRegistry(registry, evidence, identity) {
  const errors = [];
  const required = [
    ...Array.from({ length: 10 }, (_, i) => `S${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `D${i + 1}`),
  ];
  const seen = new Set();
  /** @type {Record<string,string>} */ const summary = {};
  for (const invariant of registry.invariants ?? []) {
    if (!required.includes(invariant.id) || seen.has(invariant.id)) {
      errors.push("Unknown or duplicate invariant");
      continue;
    }
    seen.add(invariant.id);
    if (!invariant.controls?.length)
      errors.push(`Missing controls: ${invariant.id}`);
    const ids = new Set();
    for (const control of invariant.controls ?? []) {
      if (ids.has(control.id) || !control.id.startsWith(`${invariant.id}.`))
        errors.push(`Invalid control: ${control.id}`);
      ids.add(control.id);
      if (
        !control.owner ||
        !control.rationale ||
        !["pending", "implemented", "verified", "deferred"].includes(
          control.status,
        )
      )
        errors.push(`Invalid state: ${control.id}`);
      if (control.status === "verified") {
        if (control.evidenceType === "automated") {
          if (
            evidence?.commit !== identity.commit ||
            evidence?.artifactHash !== identity.artifactHash
          )
            errors.push(`Stale or missing evidence: ${control.id}`);
          if (
            !control.tests?.length ||
            control.tests.some(
              (id) =>
                !evidence?.tests?.some(
                  (t) => t.id === id && t.status === "passed",
                ),
            )
          )
            errors.push(`Missing, skipped or failed tests: ${control.id}`);
        } else if (control.evidenceType === "manual") {
          if (
            !control.review?.reviewer ||
            !control.review?.date ||
            !control.review?.reference
          )
            errors.push(`Missing manual review: ${control.id}`);
        } else errors.push(`Missing evidence type: ${control.id}`);
      }
    }
    summary[invariant.id] = invariant.controls?.every(
      (c) => c.status === "verified",
    )
      ? "verified"
      : invariant.controls?.some(
            (c) => c.status === "verified" || c.status === "implemented",
          )
        ? "partial"
        : "pending";
  }
  for (const id of required)
    if (!seen.has(id)) errors.push(`Missing invariant: ${id}`);
  for (const test of evidence?.tests ?? []) {
    for (const match of test.id.matchAll(/\[(S\d+|D\d+)\]/g)) {
      if (!required.includes(match[1]))
        errors.push(`Unknown invariant tag in test: ${test.id}`);
    }
  }
  return { errors, summary };
}
