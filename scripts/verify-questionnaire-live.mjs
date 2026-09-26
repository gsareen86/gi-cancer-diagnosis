// One fictional visit through the real running application and existing synthetic demo database.
import { chromium, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
const doc = JSON.parse(readFileSync("src/lib/demo/content.json", "utf8"));
const base = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(base + "/start/gi-clinic");
  await page.getByRole("button", { name: "Begin questionnaire" }).click();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Agree and continue", exact: true })
    .click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Fictional questionnaire verification");
  await page.getByLabel("Age in years").fill("40");
  const next = () =>
    page.getByRole("button", { name: "Continue →", exact: true }).click();
  await next();
  await page
    .getByRole("radio", { name: "Pain is present now", exact: true })
    .check();
  await next();
  await page
    .getByRole("radio", { name: "Unbearable pain", exact: true })
    .check();
  await page.getByRole("alert", { name: "Important medical advice" }).waitFor();
  assert(
    await page
      .getByRole("button", { name: "Continue →", exact: true })
      .isEnabled(),
  );
  await next();
  await expect(page.locator("legend")).toContainText("How did this episode");
  await page
    .getByRole("button", { name: "Save and pause", exact: true })
    .click();
  await page.getByRole("heading", { name: "You paused your intake" }).waitFor();
  const response = await context.request.post(base + "/api/demo", {
    headers: { origin: base },
    data: { action: "get", id: null, payload: {}, patient: true },
  });
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.data.contentVersion, doc.version);
  assert.equal(result.data.intake.answers.pain_now_severity, "Unbearable pain");
  assert.equal(
    result.data.intake.answerSources.pain_now_severity.suppliedBy,
    "patient",
  );
  await page.reload();
  await page.getByRole("alert", { name: "Important medical advice" }).waitFor();
  assert.equal(
    await page
      .getByRole("heading", {
        name: "Please get medical help now",
        exact: true,
      })
      .count(),
    0,
  );
  mkdirSync("var/questionnaire", { recursive: true });
  await page.screenshot({
    path: "var/questionnaire/live-demo.png",
    fullPage: true,
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "End this tablet session", exact: true })
    .click();
  await page.waitForURL("**/patient/ended");
  console.log(
    "PASS real demo: new content version, consent, contextual answers, Important banner with continued navigation, persisted attribution, pause/reload and session reset.",
  );
} finally {
  await browser.close();
}
