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

// S19 — Calc output as condition target (A5, Tier 1)
test("S19 — Calc output as condition target", async ({ page }) => {
  const tid = "tpl-calc-cond-001";
  const aId = "f-a-cc-001";
  const bId = "f-b-cc-001";
  const totalId = "f-total-cc-001";
  const bonusId = "f-bonus-cc-001";

  await page.evaluate(
    ({ tid, aId, bId, totalId, bonusId }) => {
      const template = {
        id: tid, title: "Calc Condition",
        fields: [
          { id: aId, type: "number", label: "A", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } },
          { id: bId, type: "number", label: "B", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } },
          { id: totalId, type: "calculation", label: "Total", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { sourceFieldIds: [aId, bId], aggregation: "sum", decimalPlaces: 0 } },
          {
            id: bonusId, type: "text", label: "Bonus Note",
            conditions: [{ targetId: totalId, effect: "show", operator: "number_gt", value: 100 }],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, totalId, bonusId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // A=20, B=30 → Total=50, Bonus hidden
  await page.locator(`[data-testid="field-${aId}"] input`).fill("20");
  await page.locator(`[data-testid="field-${bId}"] input`).fill("30");
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).toContainText("50");
  await expect(page.locator(`[data-testid="field-${bonusId}"]`)).not.toBeAttached();

  // A=80 → Total=110 > 100, Bonus appears
  await page.locator(`[data-testid="field-${aId}"] input`).fill("80");
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).toContainText("110");
  await expect(page.locator(`[data-testid="field-${bonusId}"]`)).toBeVisible();

  // A=10 → Total=40, Bonus hidden again
  await page.locator(`[data-testid="field-${aId}"] input`).fill("10");
  await expect(page.locator(`[data-testid="field-${bonusId}"]`)).not.toBeAttached();
});

// S20 — Hidden required field does not block submit; visibility recorded false (A2, Tier 1)
test("S20 — Hidden required field does not block submit", async ({ page }) => {
  const tid = "tpl-s20-001";
  const nameId = "f-name-s20-001";
  const reasonId = "f-reason-s20-001";

  await page.evaluate(
    ({ tid, nameId, reasonId }) => {
      const template = {
        id: tid, title: "Hidden Required S20",
        fields: [
          { id: nameId, type: "text", label: "Name", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: true, config: {} },
          { id: reasonId, type: "text", label: "Reason", conditions: [], conditionLogic: "OR", defaultVisible: false, defaultRequired: true, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, nameId, reasonId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  await page.locator(`[data-testid="field-${nameId}"] input`).fill("Alice");
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const inst = Object.values(stored.instances)[0] as { values: Record<string, unknown>; visibility: Record<string, unknown> };
  expect(inst.visibility[reasonId]).toBe(false);
  expect(inst.values[reasonId]).toBeUndefined();
  expect(inst.values[nameId]).toBe("Alice");
});

// S21 — Hide-wins precedence when both Show and Hide fire (A1, Tier 1)
test("S21 — Hide-wins precedence when both Show and Hide fire", async ({ page }) => {
  const tid = "tpl-hidewins-001";
  const aId = "f-a-hw-001";
  const bId = "f-b-hw-001";
  const xId = "f-x-hw-001";
  const aYes = "opt-a-yes-hw";
  const aNo = "opt-a-no-hw";
  const bYes = "opt-b-yes-hw";
  const bNo = "opt-b-no-hw";

  await page.evaluate(
    ({ tid, aId, bId, xId, aYes, aNo, bYes, bNo }) => {
      const mkSel = (id: string, label: string, yId: string, nId: string) => ({
        id, type: "single_select", label, conditions: [], conditionLogic: "OR",
        defaultVisible: true, defaultRequired: false,
        config: { options: [{ id: yId, label: "Yes" }, { id: nId, label: "No" }], displayType: "radio" },
      });
      const template = {
        id: tid, title: "Hide Wins",
        fields: [
          mkSel(aId, "A", aYes, aNo),
          mkSel(bId, "B", bYes, bNo),
          {
            id: xId, type: "text", label: "X",
            conditions: [
              { targetId: aId, effect: "show", operator: "select_equals", value: aYes },
              { targetId: bId, effect: "hide", operator: "select_equals", value: bYes },
            ],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, xId, aYes, aNo, bYes, bNo },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // A=Yes, B=No → Show fires, Hide doesn't → X visible
  await page.locator(`[data-testid="field-${aId}"] input[value="${aYes}"]`).click();
  await page.locator(`[data-testid="field-${bId}"] input[value="${bNo}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).toBeVisible();

  // A=Yes, B=Yes → both fire → Hide wins → X hidden (A1 cross-effect precedence)
  await page.locator(`[data-testid="field-${bId}"] input[value="${bYes}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).not.toBeAttached();

  // A=No, B=Yes → only Hide fires → X hidden
  await page.locator(`[data-testid="field-${aId}"] input[value="${aNo}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).not.toBeAttached();

  // A=No, B=No → no rules fire → defaultVisible=false → X hidden
  await page.locator(`[data-testid="field-${bId}"] input[value="${bNo}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).not.toBeAttached();
});

// S22 — Per-effect-group AND logic (A1 conditionLogic scoping, Tier 1)
test("S22 — Per-effect-group AND requires all conditions to match", async ({ page }) => {
  const tid = "tpl-andlogic-001";
  const aId = "f-a-and-001";
  const bId = "f-b-and-001";
  const xId = "f-x-and-001";
  const aYes = "opt-a-yes-and";
  const aNo = "opt-a-no-and";
  const bYes = "opt-b-yes-and";
  const bNo = "opt-b-no-and";

  await page.evaluate(
    ({ tid, aId, bId, xId, aYes, aNo, bYes, bNo }) => {
      const mkSel = (id: string, label: string, yId: string, nId: string) => ({
        id, type: "single_select", label, conditions: [], conditionLogic: "OR",
        defaultVisible: true, defaultRequired: false,
        config: { options: [{ id: yId, label: "Yes" }, { id: nId, label: "No" }], displayType: "radio" },
      });
      const template = {
        id: tid, title: "AND Logic",
        fields: [
          mkSel(aId, "A", aYes, aNo),
          mkSel(bId, "B", bYes, bNo),
          {
            id: xId, type: "text", label: "AND-test",
            conditions: [
              { targetId: aId, effect: "show", operator: "select_equals", value: aYes },
              { targetId: bId, effect: "show", operator: "select_equals", value: bYes },
            ],
            conditionLogic: "AND", defaultVisible: false, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, xId, aYes, aNo, bYes, bNo },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // A=Yes, B=No → only 1 of 2 Show conditions → AND fails → X hidden
  await page.locator(`[data-testid="field-${aId}"] input[value="${aYes}"]`).click();
  await page.locator(`[data-testid="field-${bId}"] input[value="${bNo}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).not.toBeAttached();

  // A=No, B=Yes → only 1 of 2 Show conditions → AND fails → X hidden
  await page.locator(`[data-testid="field-${aId}"] input[value="${aNo}"]`).click();
  await page.locator(`[data-testid="field-${bId}"] input[value="${bYes}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).not.toBeAttached();

  // A=Yes, B=Yes → both conditions match → AND passes → X visible
  await page.locator(`[data-testid="field-${aId}"] input[value="${aYes}"]`).click();
  await expect(page.locator(`[data-testid="field-${xId}"]`)).toBeVisible();
});

// S23 — Empty effect group is inactive; defaultVisible applies (P4, Tier 1)
test("S23 — Empty condition group is inactive; field respects defaultVisible", async ({ page }) => {
  const tid = "tpl-empty-cond-001";
  const xId = "f-x-ec-001";

  await page.evaluate(
    ({ tid, xId }) => {
      const template = {
        id: tid, title: "Empty Conditions",
        fields: [
          {
            id: xId, type: "text", label: "X",
            conditions: [], conditionLogic: "AND",
            defaultVisible: true, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, xId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Zero conditions + AND logic must NOT trigger vacuous-truth hide.
  // Without the length > 0 guard, [].every(…) === true would cause Hide to win.
  await expect(page.locator(`[data-testid="field-${xId}"]`)).toBeVisible();
});

// S24 — All sources empty calc shows `—` (H5 + B1, Tier 1)
test("S24 — All-empty sources calc shows em dash, not zero", async ({ page }) => {
  const tid = "tpl-empty-calc-001";
  const aId = "f-a-ec-001";
  const bId = "f-b-ec-001";
  const totalId = "f-total-ec-001";

  await page.evaluate(
    ({ tid, aId, bId, totalId }) => {
      const template = {
        id: tid, title: "Empty Calc",
        fields: [
          { id: aId, type: "number", label: "A", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } },
          { id: bId, type: "number", label: "B", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } },
          { id: totalId, type: "calculation", label: "Total", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { sourceFieldIds: [aId, bId], aggregation: "sum", decimalPlaces: 0 } },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, totalId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Neither A nor B filled → Total shows — (not 0)
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).toContainText("—");

  // Submit without filling anything (all optional)
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Instance: Total value absent (per H5+B1: no valid sources → omit)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const inst = Object.values(stored.instances)[0] as { values: Record<string, unknown> };
  expect(inst.values[totalId]).toBeUndefined();

  // Instance view: Total renders as instance-empty (visible-but-undefined path)
  await expect(page.locator(`[data-testid="instance-empty-${totalId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="instance-empty-${totalId}"]`)).toContainText("—");
});

// S26 — Number raw value used in conditions (A6, Tier 1)
test("S26 — Number condition uses raw stored value, not rounded display", async ({ page }) => {
  const tid = "tpl-raw-num-001";
  const scoreId = "f-score-rn-001";
  const bonusId = "f-bonus-rn-001";

  await page.evaluate(
    ({ tid, scoreId, bonusId }) => {
      const template = {
        id: tid, title: "Raw Number Cond",
        fields: [
          { id: scoreId, type: "number", label: "Score", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 0 } },
          {
            id: bonusId, type: "text", label: "Bonus",
            conditions: [{ targetId: scoreId, effect: "show", operator: "number_gt", value: 99.9 }],
            conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {},
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, scoreId, bonusId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Score=99.9 → raw=99.9, display rounds to "100" (decimalPlaces=0)
  // Condition: 99.9 > 99.9 === false → Bonus hidden
  await page.locator(`[data-testid="field-${scoreId}"] input`).fill("99.9");
  await expect(page.locator(`[data-testid="field-${scoreId}"] input`)).toHaveValue("99.9");
  await expect(page.locator(`[data-testid="field-${bonusId}"]`)).not.toBeAttached();

  // Score=100 → raw=100, condition: 100 > 99.9 === true → Bonus visible
  await page.locator(`[data-testid="field-${scoreId}"] input`).fill("100");
  await expect(page.locator(`[data-testid="field-${bonusId}"]`)).toBeVisible();
});

// S27 — Decimal precision in aggregation (Tier 2)
test("S27 — Calc sum decimal precision: 1.1+2.2+3.3 renders as 6.60 not float artifact", async ({ page }) => {
  const tid = "tpl-decimal-001";
  const aId = "f-a-dp-001";
  const bId = "f-b-dp-001";
  const cId = "f-c-dp-001";
  const totalId = "f-total-dp-001";

  await page.evaluate(
    ({ tid, aId, bId, cId, totalId }) => {
      const template = {
        id: tid, title: "Decimal Precision",
        fields: [
          { id: aId, type: "number", label: "A", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 1 } },
          { id: bId, type: "number", label: "B", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 1 } },
          { id: cId, type: "number", label: "C", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: { decimalPlaces: 1 } },
          { id: totalId, type: "calculation", label: "Total", conditions: [], conditionLogic: "OR", defaultVisible: true, config: { sourceFieldIds: [aId, bId, cId], aggregation: "sum", decimalPlaces: 2 } },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, aId, bId, cId, totalId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  await page.locator(`[data-testid="field-${aId}"] input`).fill("1.1");
  await page.locator(`[data-testid="field-${bId}"] input`).fill("2.2");
  await page.locator(`[data-testid="field-${cId}"] input`).fill("3.3");

  // 1.1+2.2+3.3 = 6.6000000000000005 in JS; toFixed(2) must render "6.60"
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).toContainText("6.60");
  await expect(page.locator(`[data-testid="field-${totalId}"]`)).not.toContainText("6.6000000000000");
});

// S31 — Single Select all three displayTypes store identical option ID (Tier 1)
test("S31 — radio, dropdown, and tiles displayTypes all submit the same option ID", async ({ page }) => {
  const blueId = "opt-blue-s31";
  const redId = "opt-red-s31";
  const greenId = "opt-green-s31";
  const colorId = "field-color-s31";
  const t1Id = "tpl-radio-s31";
  const t2Id = "tpl-dropdown-s31";
  const t3Id = "tpl-tiles-s31";

  await page.evaluate(
    ({ t1Id, t2Id, t3Id, colorId, redId, blueId, greenId }) => {
      const opts = [{ id: redId, label: "Red" }, { id: blueId, label: "Blue" }, { id: greenId, label: "Green" }];
      const mkTpl = (id: string, title: string, displayType: string) => ({
        id, title,
        fields: [{
          id: colorId, type: "single_select", label: "Color",
          conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false,
          config: { options: opts, displayType },
        }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      });
      localStorage.setItem("formBuilder", JSON.stringify({
        version: 1,
        templates: {
          [t1Id]: mkTpl(t1Id, "Radio", "radio"),
          [t2Id]: mkTpl(t2Id, "Dropdown", "dropdown"),
          [t3Id]: mkTpl(t3Id, "Tiles", "tiles"),
        },
        instances: {},
      }));
    },
    { t1Id, t2Id, t3Id, colorId, redId, blueId, greenId },
  );

  // Fill radio → select Blue via radio input
  await page.goto(`/templates/${t1Id}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });
  await page.locator(`[data-testid="field-${colorId}"] input[value="${blueId}"]`).click();
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Fill dropdown → select Blue via select option
  await page.goto(`/templates/${t2Id}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });
  await page.locator(`[data-testid="field-${colorId}"] select`).selectOption(blueId);
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Fill tiles → click Blue tile button
  await page.goto(`/templates/${t3Id}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });
  await page.locator(`[data-testid="field-${colorId}"] button:has-text("Blue")`).click();
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // All three instances must store the same option ID (blueId)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("formBuilder")!));
  const instances = Object.values(stored.instances) as Array<{ values: Record<string, unknown> }>;
  expect(instances).toHaveLength(3);
  for (const inst of instances) {
    expect(inst.values[colorId]).toBe(blueId);
  }
});

// S32 — Tiles displayType supports keyboard selection (aria-pressed, Tier 2)
test("S32 — Tiles support keyboard selection via Space and update aria-pressed", async ({ page }) => {
  const tid = "tpl-tiles-kb-001";
  const colorId = "field-color-kb-001";
  const redId = "opt-red-kb-001";
  const blueId = "opt-blue-kb-001";

  await page.evaluate(
    ({ tid, colorId, redId, blueId }) => {
      const template = {
        id: tid, title: "Tiles Keyboard",
        fields: [{
          id: colorId, type: "single_select", label: "Color",
          conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false,
          config: { options: [{ id: redId, label: "Red" }, { id: blueId, label: "Blue" }], displayType: "tiles" },
        }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, colorId, redId, blueId },
  );

  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  const redBtn = page.locator(`[data-testid="field-${colorId}"] button:has-text("Red")`);
  const blueBtn = page.locator(`[data-testid="field-${colorId}"] button:has-text("Blue")`);

  // Initially no tile selected
  await expect(redBtn).toHaveAttribute("aria-pressed", "false");
  await expect(blueBtn).toHaveAttribute("aria-pressed", "false");

  // Focus Red tile and press Space → Red selected
  await redBtn.focus();
  await page.keyboard.press("Space");
  await expect(redBtn).toHaveAttribute("aria-pressed", "true");
  await expect(blueBtn).toHaveAttribute("aria-pressed", "false");

  // Tab to Blue tile and press Space → Blue selected, Red deselected
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(blueBtn).toHaveAttribute("aria-pressed", "true");
  await expect(redBtn).toHaveAttribute("aria-pressed", "false");
});

// S39 — Browser back/forward preserves page state without crashes (Tier 3)
test("S39 — Browser back/forward rehydrates pages cleanly", async ({ page }) => {
  const tid = "tpl-nav-s39-001";
  const nameId = "f-name-s39-001";

  await page.evaluate(
    ({ tid, nameId }) => {
      const template = {
        id: tid, title: "Nav Test",
        fields: [{ id: nameId, type: "text", label: "Name", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: {} }));
    },
    { tid, nameId },
  );

  // Navigate to fill → fill → submit → instance view
  await page.goto(`/templates/${tid}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });
  await page.locator(`[data-testid="field-${nameId}"] input`).fill("Alice");
  await page.click('[data-testid="submit-form"]');
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Back → fill form rehydrates (empty form, template still in localStorage)
  await page.goBack();
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Back again → templates list
  await page.goBack();
  await page.waitForSelector('[data-testid="templates-list"]', { timeout: 5_000 });

  // Forward → fill form
  await page.goForward();
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Forward again → instance view
  await page.goForward();
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
});
