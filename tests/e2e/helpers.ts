import type { Page } from "@playwright/test";

export async function gotoHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });
}

export async function gotoNewBuilder(page: Page) {
  await page.goto("/templates/new");
  await page.waitForSelector('[data-testid="builder-canvas"]', { timeout: 5_000 });
}

export async function addField(
  page: Page,
  type:
    | "text"
    | "number"
    | "date"
    | "single_select"
    | "multi_select"
    | "file"
    | "section_header"
    | "calculation"
    | "textarea",
) {
  await page.click(`[data-testid="add-field-${type}"]`);
  await page.waitForTimeout(150);
}

export async function setLabel(page: Page, label: string) {
  const labelInput = page.locator('[data-testid="config-label"]');
  await labelInput.clear();
  await labelInput.fill(label);
}

export async function saveTemplate(page: Page): Promise<boolean> {
  await page.click('[data-testid="save-template"]');
  await page.waitForTimeout(400);
  const errorVisible = await page
    .locator('[data-testid="save-error"]')
    .isVisible()
    .catch(() => false);
  return !errorVisible;
}

export async function clearStorage(page: Page) {
  // Must be on the app origin before accessing localStorage.
  const currentUrl = page.url();
  if (!currentUrl.startsWith("http://localhost")) {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  }
  await page.evaluate(() => localStorage.clear());
}
