import { test, expect } from "@playwright/test";
import { gotoHome, gotoNewBuilder, addField, setLabel, saveTemplate, clearStorage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.goto("/");
});

// S1 — Create empty template, save, see in list
test("S1 — Create empty template, save, see in list", async ({ page }) => {
  await gotoNewBuilder(page);

  await page.fill('[data-testid="template-title"]', "My First Form");
  const saved = await saveTemplate(page);
  expect(saved).toBe(true);

  // After save of new template, we're redirected to the edit URL; navigate home
  await gotoHome(page);

  const card = page.locator('[data-testid="templates-list"]');
  await expect(card).toContainText("My First Form");
  // 0 fields shown
  await expect(card).toContainText("0 fields");
});

// S2 — Build template with Text + Number, save
test("S2 — Build template with Text + Number, save", async ({ page }) => {
  await gotoNewBuilder(page);

  await page.fill('[data-testid="template-title"]', "Contact Form");

  // Add Text field
  await addField(page, "text");
  await setLabel(page, "Name");

  // Add Number field
  await addField(page, "number");
  await setLabel(page, "Age");

  // Set min = 0, max = 120 (decimal places already defaults to 0)
  // Min/Max inputs have no placeholder; use the label's parent div to target them
  await page.locator('div:has(> label:has-text("Min")) input[type="number"]').fill("0");
  await page.locator('div:has(> label:has-text("Max")) input[type="number"]').fill("120");

  const saved = await saveTemplate(page);
  expect(saved).toBe(true);

  await gotoHome(page);
  const list = page.locator('[data-testid="templates-list"]');
  await expect(list).toContainText("Contact Form");
  await expect(list).toContainText("2 fields");
});

// S7 — Cycle detection blocks save with informative error
test("S7 — Cycle detection blocks save with informative error", async ({ page }) => {
  await gotoNewBuilder(page);

  await page.fill('[data-testid="template-title"]', "Cycle Test");

  // Add field A
  await addField(page, "text");
  await setLabel(page, "A");

  // Add field B
  await addField(page, "text");
  await setLabel(page, "B");

  // Select field A (index 0) and add condition: show if B equals "go"
  await page.click('[data-testid="canvas-field-0"]');
  await page.waitForTimeout(200);

  // Click "+ Add condition"
  await page.click('button:has-text("+ Add condition")');
  await page.waitForTimeout(200);

  // The condition auto-targets B (first other field) with the first text operator.
  // We need effect=show (default), target=B, operator=text_equals, value=go
  // The target dropdown should already have "B" selected since it's the only other field.
  // Just set the value:
  const valueInputs = page.locator('.border.rounded.px-1.py-0\\.5.flex-1').last();
  await valueInputs.fill("go");

  // Select field B (index 1) and add condition: show if A equals "go"
  await page.click('[data-testid="canvas-field-1"]');
  await page.waitForTimeout(200);

  await page.click('button:has-text("+ Add condition")');
  await page.waitForTimeout(200);

  // Field B condition targets A (only other field)
  const valueInputsB = page.locator('.border.rounded.px-1.py-0\\.5.flex-1').last();
  await valueInputsB.fill("go");

  // Save — should be blocked by cycle detection
  await page.click('[data-testid="save-template"]');
  await page.waitForTimeout(400);

  const saveError = page.locator('[data-testid="save-error"]');
  await expect(saveError).toBeVisible();
  const errorText = await saveError.textContent();
  expect(errorText?.toLowerCase()).toMatch(/cycle|loop/);

  // Verify template NOT saved — navigate to home
  await gotoHome(page);
  await expect(page.locator('[data-testid="templates-list"]')).not.toContainText("Cycle Test");
});
