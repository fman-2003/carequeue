import { expect, test } from "@playwright/test";

test.describe("CareQueue landing page", () => {
  test("loads the public value proposition and primary calls to action", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("CareQueue");
    await expect(
      page.getByRole("heading", { name: /healthcare scheduling reimagined/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in/i }).first(),
    ).toHaveAttribute("href", "/login");
    await expect(
      page.getByRole("link", { name: /get started/i }).first(),
    ).toHaveAttribute("href", "/signup");
  });

  test("navigates to sign in from the landing page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /sign in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
