import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Intake, Answers } from "../../src/lib/demo/clinical";
const content = JSON.parse(readFileSync("src/lib/demo/content.json", "utf8"));
const blankIntake: Intake = {
  name: "",
  age: 0,
  sex: "Prefer not to answer",
  suppliedBy: "patient",
  enteredBy: "patient",
  relationship: "",
  stage: 1,
  answers: {},
};

// Browser behavior with a synthetic in-memory API; database rules are tested separately in pgTAP.
async function openIntake(
  page: Page,
  answers: Answers = {},
  stage = 2,
  failSave = false,
) {
  let intake: Intake = {
    ...blankIntake,
    name: "Fictional questionnaire patient",
    age: 40,
    stage,
    answers,
  };
  let version = 1,
    status = "intake";
  const encounter = () => ({
    id: "90000000-0000-4000-8000-000000000001",
    siteId: "90000000-0000-4000-8000-000000000002",
    patientId: "90000000-0000-4000-8000-000000000003",
    assignedTo: "90000000-0000-4000-8000-000000000004",
    status,
    version,
    consentAt: "2026-09-22T00:00:00Z",
    contentVersion: content.version,
    intake,
    reports: [],
    messages: [],
    job:
      status === "intake"
        ? null
        : {
            id: "synthetic-job",
            status: "failed",
            attempts: 1,
            errorCode: "unavailable",
          },
    ai: null,
    independent: null,
    release: null,
  });
  await page.route("**/api/demo", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "save") {
      if (failSave)
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: "Connection unavailable; answers not saved",
          },
        });
      intake = body.payload.intake;
      version++;
    }
    if (body.action === "submit") status = "review_needed";
    if (body.action === "reopen") status = "intake";
    await route.fulfill({ json: { ok: true, data: encounter() } });
  });
  await page.goto("/patient");
  await expect(
    page.getByRole("heading", {
      name:
        stage === 2
          ? "A few important checks first."
          : stage === 3
            ? "Let’s understand your symptoms."
            : "Review your information.",
    }),
  ).toBeVisible();
  return () => intake;
}
async function next(page: Page) {
  await page.getByRole("button", { name: "Continue →", exact: true }).click();
}
async function choose(page: Page, name: string) {
  await page.getByRole("radio", { name, exact: true }).check();
}
async function checkWidth(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

const question = (page: Page, id: string) =>
  page.getByRole("group", {
    name: content.questions.find((q: { id: string }) => q.id === id).label,
    exact: true,
  });
test("Important advice preserves topic navigation, pause/resume, assisted entry and saved details", async ({
  page,
}, testInfo) => {
  const saved = await openIntake(page);
  await expect(page.getByText(/safety answers are missing/)).toHaveCount(0);
  await choose(page, "Pain is present now");
  await choose(page, "Severe — I cannot carry on with usual activities");
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", {
      name: "Severe — I cannot carry on with usual activities",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", {
      name: "Please get medical help now",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue →", exact: true }),
  ).toBeEnabled();
  await choose(page, "Unbearable pain");
  await page
    .getByRole("button", { name: "Continue →", exact: true })
    .scrollIntoViewIfNeeded();
  const adviceBox = await page
    .getByRole("alert", { name: "Important medical advice" })
    .boundingBox();
  expect(adviceBox).not.toBeNull();
  expect(adviceBox!.y).toBeGreaterThanOrEqual(0);
  expect(adviceBox!.y + adviceBox!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await choose(page, "Severe — I cannot carry on with usual activities");
  await question(page, "pain_now_severity")
    .getByText("Add a detail in your own words (optional)", { exact: true })
    .click();
  await question(page, "pain_now_severity")
    .getByLabel("Anything the options do not capture")
    .fill("Fictional episode began while eating.");
  await next(page);
  await expect(
    page.getByRole("heading", { name: "Faintness and awareness", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save and pause", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "You paused your intake", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Faintness and awareness", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  expect(saved().navigation?.topicId).toBe("awareness");
  expect(saved().answers.pain_now_severity__note).toContain(
    "Fictional episode",
  );
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tell us a little about yourself." }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await page
    .getByLabel("Who is entering the answers?")
    .selectOption("coordinator");
  await next(page);
  await expect(question(page, "pain_presence")).toBeVisible();
  await choose(page, "Mild — I can carry on with usual activities");
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "var/questionnaire/topics-" + testInfo.project.name + ".png",
    fullPage: true,
  });
  await checkWidth(page);
});
test("recurring pain supports optional locations without an endless main sequence", async ({
  page,
}) => {
  const saved = await openIntake(page);
  await choose(page, "Pain comes and goes; no pain right now");
  await choose(page, "Longstanding pain without a recent change");
  await expect(
    page.getByRole("progressbar", { name: "Main topics answered" }),
  ).toHaveAttribute("value", "1");
  await page
    .getByRole("button", { name: "Review answers so far", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your information." }),
  ).toBeVisible();
  await page
    .locator(".optional-topics")
    .getByRole("button", { name: /^Tummy pain/ })
    .click();
  await page
    .getByRole("checkbox", { name: "Right upper", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Upper middle", exact: true })
    .check();
  await question(page, "pain_site")
    .getByRole("checkbox", { name: "Not sure", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "Right upper", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "Right upper", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Upper middle", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save and return to review", exact: true })
    .click();
  expect(JSON.parse(saved().answers.pain_site)).toEqual([
    "Right upper",
    "Upper middle",
  ]);
  expect(saved().answers.food_effect).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Review your information." }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toHaveCount(0);
  await checkWidth(page);
});
test("urgent advice stays visible when topic saving fails", async ({
  page,
}) => {
  await openIntake(
    page,
    {
      stool_colour: "Black and sticky",
      appearance_stool_timing: "Happening now",
    },
    3,
    true,
  );
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await next(page);
  await expect(
    page.getByText("Connection unavailable; answers not saved", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your main concern", exact: true }),
  ).toBeVisible();
});
test("review and unavailable AI preserve Important advice with optional detail left unknown", async ({
  page,
}) => {
  await openIntake(
    page,
    {
      pain_presence: "Pain is present now",
      pain_now_severity: "Unbearable pain",
      pain_now_severity__note: "Fictional additional context.",
    },
    6,
  );
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }),
  ).toBeVisible();
  await page
    .locator(".topic-answer-review summary")
    .filter({ hasText: "Tummy pain" })
    .click();
  await expect(
    page.getByText("Additional detail: Fictional additional context.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Submit for AI and clinician review",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "AI assessment unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Important medical advice" }).first(),
  ).toBeVisible();
  await checkWidth(page);
});
