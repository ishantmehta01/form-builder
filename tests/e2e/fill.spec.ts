import { test, expect } from "@playwright/test";
import { clearStorage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.goto("/");
});

// S8 — Live conditional show/hide in fill mode
test("S8 — Live conditional show/hide in fill mode", async ({ page }) => {
  // Inject template via localStorage with fixed option IDs so condition
  // value storage (option ID, not label) is correct per the S17 bug fix.
  const templateId = "tpl-cond-001";
  const choiceId = "field-choice-001";
  const reasonId = "field-reason-001";
  const yesOptId = "opt-yes-001";
  const noOptId = "opt-no-001";

  await page.evaluate(
    ({ tid, choiceId, reasonId, yesOptId, noOptId }) => {
      const template = {
        id: tid,
        title: "Conditional Demo",
        fields: [
          {
            id: choiceId,
            type: "single_select",
            label: "Choice",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            defaultRequired: false,
            config: {
              options: [
                { id: yesOptId, label: "Yes" },
                { id: noOptId, label: "No" },
              ],
              displayType: "radio",
            },
          },
          {
            id: reasonId,
            type: "text",
            label: "Reason",
            // Show when Choice == "Yes" (stored as option ID)
            conditions: [
              { targetId: choiceId, effect: "show", operator: "select_equals", value: yesOptId },
            ],
            conditionLogic: "OR",
            defaultVisible: false,
            defaultRequired: false,
            config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }),
      );
    },
    { tid: templateId, choiceId, reasonId, yesOptId, noOptId },
  );

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Initially: Choice visible, Reason hidden (defaultVisible=false, no condition fires)
  await expect(page.locator(`[data-testid="field-${choiceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).not.toBeAttached();

  // Select "Yes" for Choice — Reason should appear immediately
  const choiceWrapper = page.locator(`[data-testid="field-${choiceId}"]`);
  // Radio buttons render with value=optionId; click the one for "Yes"
  await choiceWrapper.locator(`input[value="${yesOptId}"]`).click();

  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).toBeVisible();

  // Change to "No" — Reason should hide immediately
  await choiceWrapper.locator(`input[value="${noOptId}"]`).click();

  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).not.toBeAttached();
});

// S9 — Calc updates live including hidden sources (B2 dropped)
test("S9 — Calc updates live (sum of visible numbers)", async ({ page }) => {
  const templateId = "tpl-calc-001";
  const aId = "field-a-001";
  const bId = "field-b-001";
  const totalId = "field-total-001";

  // Inject a calc template with A, B numbers and Total calc
  await page.evaluate(
    ({ tid, aId, bId, totalId }) => {
      const template = {
        id: tid,
        title: "Calc Demo",
        fields: [
          {
            id: aId,
            type: "number",
            label: "A",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            defaultRequired: false,
            config: { decimalPlaces: 0 },
          },
          {
            id: bId,
            type: "number",
            label: "B",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            defaultRequired: false,
            config: { decimalPlaces: 0 },
          },
          {
            id: totalId,
            type: "calculation",
            label: "Total",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            config: { sourceFieldIds: [aId, bId], aggregation: "sum", decimalPlaces: 0 },
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }),
      );
    },
    { tid: templateId, aId, bId, totalId },
  );

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Type A=10
  await page.locator(`[data-testid="field-${aId}"] input`).fill("10");
  // Type B=20
  await page.locator(`[data-testid="field-${bId}"] input`).fill("20");

  // Total should update to 30
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).toContainText("30");
});

// S10 — Required validation blocks submit; error clears on input
test("S10 — Required validation blocks submit; error clears on input", async ({ page }) => {
  const templateId = "tpl-required-001";
  const nameId = "field-name-req-001";

  await page.evaluate(
    ({ tid, nameId }) => {
      const template = {
        id: tid,
        title: "Required Demo",
        fields: [
          {
            id: nameId,
            type: "text",
            label: "Full Name",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            defaultRequired: true,
            config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }),
      );
    },
    { tid: templateId, nameId },
  );

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Submit without filling anything
  await page.click('[data-testid="submit-form"]');
  await page.waitForTimeout(200);

  // Validation error should appear
  const errorEl = page.locator(`[data-testid="field-error-${nameId}"]`);
  await expect(errorEl).toBeVisible();
  const errorText = await errorEl.textContent();
  expect(errorText?.toLowerCase()).toContain("required");

  // Should not have navigated away
  await expect(page).toHaveURL(/\/fill/);

  // Type a value — error should clear
  await page.locator(`[data-testid="field-${nameId}"] input`).fill("Bob");
  await expect(errorEl).not.toBeVisible();

  // Submit again — should succeed (navigate to instance view)
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
  await expect(page).toHaveURL(/\/instances\//);
});
