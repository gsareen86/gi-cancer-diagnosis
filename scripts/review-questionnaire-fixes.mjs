// Independent follow-up for questionnaire review findings, selected nonsecret files only.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
const files = [
  "docs/clinical/question-inventory.md",
  "src/lib/demo/content.json",
  "src/lib/demo/questionnaire.ts",
  "src/lib/demo/clinical.ts",
  "src/components/demo/patient-flow.tsx",
  "src/components/demo/question-input.tsx",
  "src/components/demo/shared.tsx",
  "src/components/demo/queue.tsx",
  "supabase/migrations/20260922163147_questionnaire_review_fixes.sql",
  "scripts/verify-questionnaire-content.mjs",
  "supabase/tests/database/007_contextual_encounter.sql",
  "tests/unit/questionnaire.test.ts",
  "tests/e2e/questionnaire.spec.ts",
];
const inputs = files.map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));
writeFileSync(
  "var/reviews/questionnaire-fixes-hashes.json",
  JSON.stringify(
    Object.fromEntries(
      inputs.map((f) => [
        f.path,
        createHash("sha256").update(f.text).digest("hex"),
      ]),
    ),
    null,
    2,
  ),
);
const previous = JSON.parse(
  readFileSync("var/reviews/questionnaire-implementation.json", "utf8"),
).result;
const prompt =
  `Independent Claude follow-up review, required by the repository's cross-model-review rule. You previously reviewed this correction; your findings follow. Review the bounded fixes and return concrete remaining blockers only, or state no blockers found. Do not re-review unrelated original project scope; no tools or secrets are available. All clinical content is DRAFT, not approved. Current evidence: 130 unit tests including 50 contextual cases; typecheck; 419 isolated SQL assertions passed with pending migration rolled back. Browser rerun ongoing.
Fixes: Important banner now all post-consent steps including Back+reload on About you; no regex clinical-label rewriting, versioned explanation for helpers. Active/unasked/inactive note summaries distinct. Shared content type supports legacy document without casts; bundle restored to exact historical DB document (differences were noticeVersion plus display-only fields; no old clinical rules changed). Per-version advice and ranks. Missing/unknown queue versions visibly unavailable rather than downgraded. UI loads validate version before rendering. Source catalog now exact titles/dates/short quotes or explicitly unvalidated local inventory recommendation. Alternate blood appearance adds blood amount and retching. Current same-illness fever+yellowing+abdominal pain no longer requires a precise right-upper location; source adaptation remains DRAFT. First revision .1 stays supported/immutable; .2 is new default through a new forward migration. New trigger preserves original per-answer supplier/enterer for unchanged answers even when stale client omits map; changed answers use explicitly declared sources with fallback to current intake supplier. All existing consent/RLS/stale-version protections remain.
PRIOR REVIEW:\n${previous}\n` +
  inputs
    .map(
      (f) =>
        "\nFILE " +
        f.path +
        "\n" +
        (f.path.endsWith(".json")
          ? JSON.stringify(JSON.parse(f.text))
          : f.text.replace(
              /\$content\$[\s\S]*?\$content\$/,
              "$content$[identical to included current content.json]$content$",
            )),
    )
    .join("\n");
const child = spawn(
  "C:/Users/saree/.local/bin/claude.exe",
  [
    "--safe-mode",
    "--tools",
    "",
    "--no-session-persistence",
    "--print",
    "--output-format",
    "json",
  ],
  { shell: false, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
);
let out = "";
child.stdout.on("data", (b) => (out += b));
child.stderr.on("data", () => {});
child.stdin.end(prompt);
child.on("close", (code) => {
  writeFileSync("var/reviews/questionnaire-fixes.json", out);
  console.log(
    JSON.stringify({
      code,
      outputFile: "var/reviews/questionnaire-fixes.json",
      length: out.length,
    }),
  );
});
