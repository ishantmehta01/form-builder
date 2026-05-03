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

// S11 — Hidden required field is NOT validated (A2 cornerstone)
test("S11 — Hidden required field is NOT validated", async ({ page }) => {
  const templateId = "tpl-hidden-req-001";
  const nameId = "field-name-hr-001";
  const reasonId = "field-reason-hr-001";

  await page.evaluate(
    ({ tid, nameId, reasonId }) => {
      const template = {
        id: tid,
        title: "Hidden Required Demo",
        fields: [
          { id: nameId, type: "text", label: "Name", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: true, config: {} },
          { id: reasonId, type: "text", label: "Reason", conditions: [], conditionLogic: "OR", defaultVisible: false, defaultRequired: true, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid: templateId, nameId, reasonId },
  );

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Reason (hidden) not rendered in DOM at all
  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).not.toBeAttached();

  // Fill only Name
  await page.locator(`[data-testid="field-${nameId}"] input`).fill("Alice");

  // Submit — should succeed despite Reason being required (A2: hidden fields never validated)
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
  await expect(page).toHaveURL(/\/instances\//);

  // Instance values: Name present, Reason absent; visibility.Reason = false
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const inst = Object.values(stored.instances)[0] as Record<string, unknown> & { values: Record<string, unknown>; visibility: Record<string, unknown> };
  expect(inst.values[nameId]).toBe("Alice");
  expect(inst.values[reasonId]).toBeUndefined();
  expect(inst.visibility[reasonId]).toBe(false);
});

// S14 — Section Header uses semantic heading levels (H4 decision)
test("S14 — Section Header uses semantic heading levels", async ({ page }) => {
  const templateId = "tpl-headings-001";

  await page.evaluate((tid) => {
    const template = {
      id: tid,
      title: "Headings Demo",
      fields: [
        { id: "sh-xl-001", type: "section_header", label: "Big", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { size: "xl" } },
        { id: "sh-md-001", type: "section_header", label: "Med", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { size: "md" } },
        { id: "sh-xs-001", type: "section_header", label: "Small", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { size: "xs" } },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    };
    localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
  }, templateId);

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Form title is h1
  await expect(page.getByRole("heading", { level: 1, name: "Headings Demo" })).toBeVisible();
  // XL/LG → h2
  await expect(page.getByRole("heading", { level: 2, name: "Big" })).toBeVisible();
  // MD → h3
  await expect(page.getByRole("heading", { level: 3, name: "Med" })).toBeVisible();
  // XS/SM → h4
  await expect(page.getByRole("heading", { level: 4, name: "Small" })).toBeVisible();
});

// S17 — Single Select condition fires correctly in fill mode
test("S17 — Single Select condition fires correctly in fill mode", async ({ page }) => {
  // Inject template with option-ID-based condition (same shape as S8 but with different
  // field IDs to prove the condition storage is ID-based, not label-based)
  const templateId = "tpl-s17-fill-001";
  const choiceId = "field-s17-choice-001";
  const reasonId = "field-s17-reason-001";
  const yesOptId = "opt-s17-yes-001";
  const noOptId = "opt-s17-no-001";

  await page.evaluate(
    ({ tid, choiceId, reasonId, yesOptId, noOptId }) => {
      const template = {
        id: tid,
        title: "S17 Fill Demo",
        fields: [
          {
            id: choiceId,
            type: "single_select",
            label: "Answer",
            conditions: [],
            conditionLogic: "OR",
            defaultVisible: true,
            defaultRequired: false,
            config: {
              options: [
                { id: yesOptId, label: "Agree" },
                { id: noOptId, label: "Disagree" },
              ],
              displayType: "radio",
            },
          },
          {
            id: reasonId,
            type: "text",
            label: "Details",
            // Stored value is option ID (UUID-like), not the label "Agree"
            conditions: [{ targetId: choiceId, effect: "show", operator: "select_equals", value: yesOptId }],
            conditionLogic: "OR",
            defaultVisible: false,
            defaultRequired: false,
            config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid: templateId, choiceId, reasonId, yesOptId, noOptId },
  );

  await page.goto(`/templates/${templateId}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Initially: Answer visible, Details hidden
  await expect(page.locator(`[data-testid="field-${choiceId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).not.toBeAttached();

  // Select "Agree" (stored by ID, not label) → Details appears
  await page.locator(`[data-testid="field-${choiceId}"] input[value="${yesOptId}"]`).click();
  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).toBeVisible();

  // Select "Disagree" → Details hidden again
  await page.locator(`[data-testid="field-${choiceId}"] input[value="${noOptId}"]`).click();
  await expect(page.locator(`[data-testid="field-${reasonId}"]`)).not.toBeAttached();
});

// S18 — 4-level cascade through hidden chain (Tier 1)
test("S18 — 4-level cascade through hidden chain", async ({ page }) => {
  const tid = "tpl-cascade4-001";
  const aId = "f-a-c4-001";
  const bId = "f-b-c4-001";
  const cId = "f-c-c4-001";
  const dId = "f-d-c4-001";
  const yesOptId = "opt-yes-c4-001";
  const noOptId = "opt-no-c4-001";

  await page.evaluate(
    ({ tid, aId, bId, cId, dId, yesOptId, noOptId }) => {
      const template = {
        id: tid,
        title: "Cascade Test",
        fields: [
          {
            id: aId, type: "single_select", label: "A",
            conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false,
            config: { options: [{ id: yesOptId, label: "Yes" }, { id: noOptId, label: "No" }], displayType: "radio" },
          },
          {
            id: bId, type: "text", label: "B",
            conditions: [{ targetId: aId, effect: "show", operator: "select_equals", value: yesOptId }],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
          {
            id: cId, type: "text", label: "C",
            conditions: [{ targetId: bId, effect: "show", operator: "text_equals", value: "deep dive" }],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
          {
            id: dId, type: "text", label: "D",
            conditions: [{ targetId: cId, effect: "show", operator: "text_equals", value: "yes please" }],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, cId, dId, yesOptId, noOptId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Initially: A visible, B/C/D hidden
  await expect(page.locator(`[data-testid="field-${aId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${bId}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="field-${cId}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="field-${dId}"]`)).not.toBeAttached();

  // Pick A=Yes → B visible; C, D still hidden
  await page.locator(`[data-testid="field-${aId}"] input[value="${yesOptId}"]`).click();
  await expect(page.locator(`[data-testid="field-${bId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${cId}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="field-${dId}"]`)).not.toBeAttached();

  // Type B="deep dive" → C visible; D still hidden
  await page.locator(`[data-testid="field-${bId}"] input`).fill("deep dive");
  await expect(page.locator(`[data-testid="field-${cId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="field-${dId}"]`)).not.toBeAttached();

  // Type C="yes please" → D visible
  await page.locator(`[data-testid="field-${cId}"] input`).fill("yes please");
  await expect(page.locator(`[data-testid="field-${dId}"]`)).toBeVisible();

  // Change A back to No → B, C, D ALL hidden in same render frame
  await page.locator(`[data-testid="field-${aId}"] input[value="${noOptId}"]`).click();
  await expect(page.locator(`[data-testid="field-${bId}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="field-${cId}"]`)).not.toBeAttached();
  await expect(page.locator(`[data-testid="field-${dId}"]`)).not.toBeAttached();
});
