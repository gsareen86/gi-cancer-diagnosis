// Focused inference check with explicitly fictional, manually specified source evidence.
import { mkdirSync, writeFileSync } from "node:fs";
import { generateAssessment } from "../src/lib/demo/model-gateway";
import { content } from "../src/lib/demo/clinical";
import { scenarios } from "../src/lib/demo/fixtures";
mkdirSync("var/ui-review", { recursive: true });
const started = Date.now();
try {
  const result = await generateAssessment(
    {
      intake: scenarios[0].intake,
      version: 1,
      contentVersion: content.version,
      synthetic: true,
      reports: [
        {
          id: "fictional-report",
          fields: [
            {
              id: "p1-hb",
              label: "Haemoglobin",
              value: "10.4",
              unit: "g/dL",
              page: 1,
              date: "",
              sourceText: "Haemoglobin 10.4 g/dL",
              confidence: "manual-transcription",
              verified: true,
            },
          ],
        },
      ],
    },
    (raw) =>
      writeFileSync(
        "var/ui-review/focused-assessment-output.json",
        JSON.stringify(raw, null, 2),
      ),
  );
  writeFileSync(
    "var/ui-review/focused-assessment-result.json",
    JSON.stringify(
      {
        status: "passed",
        seconds: Math.round((Date.now() - started) / 1000),
        assessment: result,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${result.promptVersion}: ${result.possibilities.length} possibilities; source and semantic checks passed.`,
  );
} catch (error) {
  console.log(
    error instanceof Error ? error.message : "Assessment unavailable",
  );
  process.exitCode = 1;
}
