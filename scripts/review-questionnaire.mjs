// Independent Claude review of explicitly selected nonsecret questionnaire files.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
const files = [
  "openspec/config.yaml",
  "docs/clinical/question-inventory.md",
  "openspec/changes/hospital-demo-journey/specs/hospital-demo/spec.md",
  "src/lib/demo/questionnaire.ts",
  "src/lib/demo/clinical.ts",
  "src/lib/demo/content.json",
  "src/lib/demo/content-2026-09-21.json",
  "src/components/demo/patient-flow.tsx",
  "src/components/demo/question-input.tsx",
  "src/components/demo/shared.tsx",
  "src/components/demo/assessment.tsx",
  "src/components/demo/clinician-workspace.tsx",
  "src/components/demo/queue.tsx",
  "src/app/api/demo/route.ts",
  "src/lib/ai/assessment.ts",
  "supabase/migrations/20260922155406_contextual_questionnaire.sql",
  "tests/unit/questionnaire.test.ts",
  "tests/e2e/questionnaire.spec.ts",
];
const inputs = files.map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));
const hashes = Object.fromEntries(
  inputs.map((f) => [
    f.path,
    createHash("sha256").update(f.text).digest("hex"),
  ]),
);
const prompt =
  "Independent Claude implementation review required by AGENTS.md. Review ONLY this questionnaire correction, not unrelated deployment/clinical approval work. User requested contextual linked questions and an Important banner that never forces a new screen or stops answering. Clinical content is DRAFT. Check all urgency rules against the inventory, current versus historical pain/fainting, unknown/declined, alternative bleeding paths, inactive/conflicting answers, version pinning, SQL/client parity, source facts and continued navigation. Prior planning findings were incorporated: prompt floor for incomplete warning facts, retained current danger exceptions, metadata, source/unknown/clinical provenance. Independent Codex review found raw inactive summaries; these now use AnswerSummary. 47 current questionnaire unit tests and 400 SQL assertions (including legacy access/consent/snapshots) passed; a real fictional Gemini assessment passed evidence/semantic checks. Browser tests are being completed. Return only concrete blocking bugs with file references and fixes, then nonblocking issues, or explicitly no blocking issues found. Do not claim clinical approval. No tools or secrets; complete context follows.\n" +
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
              "$content$[identical to included src/lib/demo/content.json]$content$",
            )),
    )
    .join("\n");
mkdirSync("var/reviews", { recursive: true });
writeFileSync(
  "var/reviews/questionnaire-input-hashes.json",
  JSON.stringify(hashes, null, 2),
);
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
let output = "";
child.stdout.on("data", (b) => (output += b));
child.stderr.on("data", () => {});
child.stdin.end(prompt);
child.on("close", (code) => {
  writeFileSync("var/reviews/questionnaire-implementation.json", output);
  console.log(
    JSON.stringify({
      code,
      outputFile: "var/reviews/questionnaire-implementation.json",
      length: output.length,
    }),
  );
});
