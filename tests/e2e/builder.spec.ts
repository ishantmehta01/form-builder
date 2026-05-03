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

// S15 — Single-source calc warning shown in builder (B2 leakage caveat)
test("S15 — Single-source calc warning shown in builder (B2 leakage caveat)", async ({ page }) => {
  await gotoNewBuilder(page);

  // Add Number field "Salary"
  await addField(page, "number");
  await setLabel(page, "Salary");

  // Add Calculation field → auto-selected, config panel shows calc config
  await addField(page, "calculation");

  // Check "Salary" as source — sourceFieldIds.length becomes 1 → warning appears
  await page.locator('label:has-text("Salary") input[type="checkbox"]').click();
  await page.waitForTimeout(150);

  const warning = page.locator('text=⚠ Single-source calc');
  await expect(warning).toBeVisible();

  // Add second Number field "Bonus"
  await addField(page, "number");
  await setLabel(page, "Bonus");

  // Re-select the Calculation field (index 1: Salary=0, Calc=1, Bonus=2)
  await page.click('[data-testid="canvas-field-1"]');
  await page.waitForTimeout(200);

  // Check "Bonus" as additional source — sourceFieldIds.length becomes 2 → warning gone
  await page.locator('label:has-text("Bonus") input[type="checkbox"]').click();
  await page.waitForTimeout(150);

  await expect(warning).not.toBeVisible();
});

// S16 — Deleting a template cascades to its filled responses (D3)
test("S16 — Deleting a template cascades to its filled responses (D3)", async ({ page }) => {
  const t1Id = "tpl-001-cascade";
  const t2Id = "tpl-002-cascade";
  const i1Id = "inst-001-cascade";
  const i2Id = "inst-002-cascade";
  const i3Id = "inst-003-cascade";

  await page.evaluate(
    ({ t1Id, t2Id, i1Id, i2Id, i3Id }) => {
      const makeTemplate = (id: string, title: string, fieldId: string) => ({
        id, title,
        fields: [{ id: fieldId, type: "text", label: "Name", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      });
      const t1 = makeTemplate(t1Id, "T1", "f1");
      const t2 = makeTemplate(t2Id, "T2", "f2");
      const makeInst = (id: string, tid: string, t: unknown) => ({
        id, templateId: tid, templateSnapshot: t,
        values: {}, visibility: {}, submittedAt: new Date().toISOString(),
      });
      localStorage.setItem("formBuilder", JSON.stringify({
        version: 1,
        templates: { [t1Id]: t1, [t2Id]: t2 },
        instances: {
          [i1Id]: makeInst(i1Id, t1Id, t1),
          [i2Id]: makeInst(i2Id, t1Id, t1),
          [i3Id]: makeInst(i3Id, t2Id, t2),
        },
      }));
    },
    { t1Id, t2Id, i1Id, i2Id, i3Id },
  );

  await page.goto("/");
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });

  await expect(page.locator(`[data-testid="template-card-${t1Id}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="template-card-${t2Id}"]`)).toBeVisible();

  // Accept the window.confirm before clicking delete
  page.once("dialog", (dialog) => dialog.accept());
  await page.click(`[data-testid="delete-template-${t1Id}"]`);
  await page.waitForTimeout(300);

  // T1 gone, T2 still visible
  await expect(page.locator(`[data-testid="template-card-${t1Id}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="template-card-${t2Id}"]`)).toBeVisible();

  // Only I3 remains in localStorage — I1 and I2 cascade-deleted
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const instanceKeys = Object.keys(stored.instances);
  expect(instanceKeys).toHaveLength(1);
  expect(instanceKeys[0]).toBe(i3Id);
  expect(stored.instances[i3Id].templateId).toBe(t2Id);
});

// S17 — Condition value editor renders correctly per operator
test("S17 — Condition value editor renders correctly per operator", async ({ page }) => {
  await gotoNewBuilder(page);

  // Add Single Select field "Choice" with Yes/No options
  await addField(page, "single_select");
  await setLabel(page, "Choice");

  // Add "Yes" option
  await page.click('button:has-text("+ Add option")');
  await page.waitForTimeout(100);
  await page.locator('input[placeholder="Option 1"]').fill("Yes");

  // Add "No" option
  await page.click('button:has-text("+ Add option")');
  await page.waitForTimeout(100);
  await page.locator('input[placeholder="Option 2"]').fill("No");

  // Add Text field "Reason"
  await addField(page, "text");
  await setLabel(page, "Reason");

  // Add condition on Reason → auto-targets Choice with select_equals operator
  await page.click('button:has-text("+ Add condition")');
  await page.waitForTimeout(200);

  // Value editor for select_equals should be a <select> listing "Yes" and "No" by label
  const valueEditorSelect = page.locator('select:has(option:has-text("Yes"))');
  await expect(valueEditorSelect).toBeVisible();
  const optionTexts = await valueEditorSelect.locator("option").allTextContents();
  expect(optionTexts).toContain("Yes");
  expect(optionTexts).toContain("No");

  // Regression guard: no plain text input in the condition value slot
  // (before the S17 fix, a plain <input type="text"> was rendered here)
  // The value-editor area is inside the operator+value row.
  // Assert the valueEditorSelect is genuinely a <select> element
  const tagName = await valueEditorSelect.evaluate((el) => el.tagName.toLowerCase());
  expect(tagName).toBe("select");
});

// S41 — Preview with unsaved changes prompts confirm dialog
test("S41 — Preview with unsaved changes prompts confirm dialog", async ({ page }) => {
  await gotoNewBuilder(page);

  // Build "Survey" with one field "Email", save
  await page.fill('[data-testid="template-title"]', "Survey");
  await addField(page, "text");
  await setLabel(page, "Email");
  await saveTemplate(page);
  // Now on edit URL for the saved template

  // Add "Phone" field → isDirty becomes true
  await addField(page, "text");
  await setLabel(page, "Phone");
  await expect(page.locator('text=Unsaved changes')).toBeVisible();

  // Click Preview → confirm dialog opens (dirty state)
  await page.click('[data-testid="preview-button"]');
  const dialog = page.locator('[data-testid="preview-confirm-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Unsaved changes");

  // Cancel → dialog closes, still in builder, Phone still on canvas
  await page.click('[data-testid="preview-confirm-cancel"]');
  await expect(dialog).not.toBeVisible();
  // Phone field still present (index 1)
  await expect(page.locator('[data-testid="canvas-field-1"]')).toBeVisible();
  // Still dirty
  await expect(page.locator('text=Unsaved changes')).toBeVisible();

  // Click Preview again → dialog opens again
  await page.click('[data-testid="preview-button"]');
  await expect(dialog).toBeVisible();

  // Click "Save & preview" → saves and navigates to fill mode
  await page.click('[data-testid="preview-confirm-save"]');
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Preview badge visible (came from builder)
  await expect(page.locator('[data-testid="preview-badge"]')).toBeVisible();

  // Both Email and Phone fields visible in fill mode
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const tpl = Object.values(stored.templates as Record<string, { fields: Array<{ id: string; label: string }> }>)[0]!;
  const emailField = tpl.fields.find((f) => f.label === "Email")!;
  const phoneField = tpl.fields.find((f) => f.label === "Phone")!;
  expect(emailField).toBeTruthy();
  expect(phoneField).toBeTruthy();
  await expect(page.locator(`[data-testid="field-${emailField.id}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${phoneField.id}"]`)).toBeVisible();
});

// S34 — Quarantine badge shown for templates with cycles; New Response disabled (Tier 1)
test("S34 — Cyclic template shows quarantine badge and disables New Response", async ({ page }) => {
  const templateId = "tpl-cyclic-s34";
  const aId = "field-a-s34";
  const bId = "field-b-s34";

  // Inject cyclic template: A shows if B=x, B shows if A=x
  await page.evaluate(
    ({ templateId, aId, bId }) => {
      const template = {
        id: templateId, title: "Cyclic Template",
        fields: [
          {
            id: aId, type: "text", label: "A",
            conditions: [{ targetId: bId, effect: "show", operator: "text_equals", value: "x" }],
            conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {},
          },
          {
            id: bId, type: "text", label: "B",
            conditions: [{ targetId: aId, effect: "show", operator: "text_equals", value: "x" }],
            conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [templateId]: template }, instances: {} }));
    },
    { templateId, aId, bId },
  );

  // Reload so the store runs load-time cycle detection
  await page.reload();
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });

  // Quarantine badge visible
  await expect(page.locator(`[data-testid="quarantine-badge-${templateId}"]`)).toBeVisible();
  const badgeText = await page.locator(`[data-testid="quarantine-badge-${templateId}"]`).textContent();
  expect(badgeText).toMatch(/invalid conditional logic/i);

  // New Response button absent for the quarantined template
  await expect(page.locator(`[data-testid="new-response-${templateId}"]`)).not.toBeAttached();

  // Edit button still present (user must fix the cycle)
  await expect(page.locator(`[data-testid="open-template-${templateId}"]`)).toBeVisible();
});
