import { test, expect } from "@playwright/test";

test.describe("critical journey", () => {
  test("landing loads and navigation reaches account", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: /^account$/i }).first().click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /your workspace/i })).toBeVisible();
  });
});
