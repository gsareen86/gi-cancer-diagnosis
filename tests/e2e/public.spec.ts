import { test, expect } from "@playwright/test";
test("patient entry is readable and separate from staff sign-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Start your visit" }),
  ).toBeVisible();
  await expect(
    page.getByText("No account or sign-in needed.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/Synthetic demonstration/)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Staff sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("unauthenticated protected navigation exposes no patient records", async ({
  page,
}) => {
  await page.goto("/staff/patient");
  await expect(page).toHaveURL(/\/(setup|sign-in)$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByText("Synthetic patient 1", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("keyboard navigation and safe setup are available without Cloud credentials", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.goto("/setup");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
