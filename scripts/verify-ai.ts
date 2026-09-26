// Inference check uses only the explicitly fictional bundled report and intake.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractReport } from "../src/lib/demo/reports";
import { generateAssessment, modelHealth } from "../src/lib/demo/model-gateway";
import { readAISettings } from "../src/lib/ai/settings";
import { scenarios } from "../src/lib/demo/fixtures";
import { content } from "../src/lib/demo/clinical";
const settings = readAISettings();
mkdirSync("var/ui-review", { recursive: true });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const r = await originalFetch(...args);
  if (!r.ok)
    writeFileSync(
      "var/ui-review/provider-diagnostic.txt",
      await r.clone().text(),
    );
  return r;
};
const start = Date.now();
await modelHealth(settings);
console.log(
  `Selected provider ready: ${settings.provider}; vision ${settings.vision}`,
);
const task = getDocument({
  data: new Uint8Array(
    readFileSync("public/demo-assets/synthetic-whole-body-report.pdf"),
  ),
  useSystemFonts: true,
  verbosity: 0,
});
const doc = await task.promise,
  page = await doc.getPage(1),
  viewport = page.getViewport({ scale: 1.5 }),
  canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport })
  .promise;
const image = canvas.toBuffer("image/png");
await task.destroy();
console.log("Reading one fictional report page with vision…");
const report = await extractReport(image, "image/png", settings);
if (
  !report.fields.length ||
  report.fields.some((f) => f.verified || f.page !== 1)
)
  throw new Error("Invalid extraction provenance");
console.log(
  `Vision produced ${report.fields.length} unverified source-linked findings in ${Math.round((Date.now() - start) / 1000)} seconds.`,
);
writeFileSync(
  "var/ui-review/vision-result.json",
  JSON.stringify(
    {
      provider: settings.provider,
      model: settings.model,
      promptVersion: report.promptVersion,
      count: report.fields.length,
      seconds: Math.round((Date.now() - start) / 1000),
      fields: report.fields,
    },
    null,
    2,
  ),
);
console.log(
  "Generating a preliminary assessment from fictional questionnaire answers…",
);
const result = await generateAssessment({
  intake: scenarios[0].intake,
  reports: [],
  version: 1,
  contentVersion: content.version,
  synthetic: true,
});
writeFileSync(
  "var/ui-review/live-assessment.json",
  JSON.stringify(result, null, 2),
);
console.log(
  `Live assessment passed source and semantic checks: ${result.possibilities.length} possibilities; ${result.specialty}; ${result.urgency}.`,
);
