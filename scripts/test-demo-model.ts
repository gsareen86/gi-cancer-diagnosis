import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { generateAssessment } from "../src/lib/demo/model-gateway";
import { scenarios } from "../src/lib/demo/fixtures";
import { content } from "../src/lib/demo/clinical";
import { extractReport } from "../src/lib/demo/reports";
const reports = await extractReport(
  new Uint8Array(
    readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
  ),
  "application/pdf",
);
console.log(`PDF extraction: ${reports.fields.length} source-linked proposals`);
mkdirSync("var/demo-rehearsal", { recursive: true });
const start = Date.now();
try {
  const assessment = await generateAssessment({
    intake: scenarios[0].intake,
    reports: [
      {
        id: "synthetic-report",
        fields: reports.fields.map((f) => ({ ...f, verified: true })),
      },
    ],
    version: 1,
    contentVersion: content.version,
  },raw=>writeFileSync('var/demo-rehearsal/synthetic-raw-output.json',JSON.stringify(raw,null,2)));
  writeFileSync(
    "var/demo-rehearsal/live-model-result.json",
    JSON.stringify(assessment, null, 2),
  );
  console.log(
    JSON.stringify({
      status: "passed",
      seconds: Math.round((Date.now() - start) / 1000),
      possibilities: assessment.possibilities.length,
      urgency: assessment.urgency,
    }),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      status: "failed",
      code: e instanceof Error ? e.message : "unavailable",
      seconds: Math.round((Date.now() - start) / 1000),
    }),
  );
  process.exitCode = 1;
}
