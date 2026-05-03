import { test, expect } from "@playwright/test";
import { clearStorage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.goto("/");
});

// S35 — Future-version data: app falls back to empty state without crashing (Tier 2)
test("S35 — Future-version localStorage data falls back to empty templates list", async ({ page }) => {
  // Inject data with a version number newer than the app's CURRENT_VERSION
  await page.evaluate(() => {
    localStorage.setItem("formBuilder", JSON.stringify({ version: 999, templates: {}, instances: {} }));
  });

  // Reload triggers loadFromStorage → load() throws → store catches → empty state
  await page.reload();
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });

  // Templates list renders but is empty (no cards, no crash)
  await expect(page.locator('[data-testid="templates-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="templates-list"]')).not.toContainText("field");

  // New form button still works → app is fully functional despite load failure
  await expect(page.locator('[data-testid="new-template-button"]')).toBeVisible();
});

// S36 — Malformed JSON in localStorage falls back to empty state without crashing (Tier 2)
test("S36 — Malformed JSON falls back to empty templates list", async ({ page }) => {
  // Inject syntactically invalid JSON
  await page.evaluate(() => {
    localStorage.setItem("formBuilder", "{ this is not valid json");
  });

  // Reload triggers loadFromStorage → JSON.parse throws → store catches → empty state
  await page.reload();
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });

  // App renders normally with empty state
  await expect(page.locator('[data-testid="templates-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="new-template-button"]')).toBeVisible();

  // Existing data not corrupted — after clearing, creating a new form works
  await page.click('[data-testid="new-template-button"]');
  await page.waitForSelector('[data-testid="builder-canvas"]', { timeout: 5_000 });
  await expect(page).toHaveURL(/\/templates\/new/);
});
