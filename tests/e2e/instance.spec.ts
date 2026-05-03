import { test, expect } from "@playwright/test";
import { clearStorage } from "./helpers";

const TEMPLATE_ID = "template-contact-001";
const NAME_FIELD_ID = "field-name-001";
const AGE_FIELD_ID = "field-age-001";

const contactFormTemplate = {
  id: TEMPLATE_ID,
  title: "Contact Form",
  fields: [
    {
      id: NAME_FIELD_ID,
      type: "text",
      label: "Name",
      conditions: [],
      conditionLogic: "OR",
      defaultVisible: true,
      defaultRequired: false,
      config: {},
    },
    {
      id: AGE_FIELD_ID,
      type: "number",
      label: "Age",
      conditions: [],
      conditionLogic: "OR",
      defaultVisible: true,
      defaultRequired: false,
      config: { decimalPlaces: 0, min: 0, max: 120 },
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  modifiedAt: "2026-01-01T00:00:00.000Z",
};

async function seedTemplate(page: import("@playwright/test").Page) {
  await page.evaluate(
    ({ id, template }) => {
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({ version: 1, templates: { [id]: template }, instances: {} }),
      );
    },
    { id: TEMPLATE_ID, template: contactFormTemplate },
  );
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.goto("/");
});

// S3 — Fill simple form, submit, see instance
test("S3 — Fill simple form, submit, see instance", async ({ page }) => {
  await seedTemplate(page);
  await page.goto(`/templates/${TEMPLATE_ID}/fill`);
  await page.waitForSelector('[data-testid="fill-form"]', { timeout: 5_000 });

  // Fill Name field
  await page.locator(`[data-testid="field-${NAME_FIELD_ID}"] input`).fill("Alice");
  // Fill Age field
  await page.locator(`[data-testid="field-${AGE_FIELD_ID}"] input`).fill("30");

  await page.click('[data-testid="submit-form"]');

  // Should redirect to instance view
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
  await expect(page).toHaveURL(/\/instances\//);

  // Labels are visible as text content
  await expect(page.locator('[data-testid="instance-view"]')).toContainText("Name");
  await expect(page.locator('[data-testid="instance-view"]')).toContainText("Age");

  // Values are rendered inside disabled inputs; verify via toHaveValue
  await expect(page.locator(`[data-testid="instance-field-${NAME_FIELD_ID}"] input`)).toHaveValue("Alice");
  await expect(page.locator(`[data-testid="instance-field-${AGE_FIELD_ID}"] input`)).toHaveValue("30");

  // Submission timestamp visible
  await expect(page.locator('[data-testid="instance-view"]')).toContainText("Submitted");
});

// S4 — View instance from instances list
test("S4 — View instance from instances list", async ({ page }) => {
  await seedTemplate(page);

  // Create an instance in localStorage
  const instanceId = "instance-001";
  await page.evaluate(
    ({ tid, iid, nameId, ageId, template }) => {
      const instance = {
        id: iid,
        templateId: tid,
        templateSnapshot: template,
        values: { [nameId]: "Alice", [ageId]: 30 },
        visibility: { [nameId]: true, [ageId]: true },
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({
          version: 1,
          templates: { [tid]: template },
          instances: { [iid]: instance },
        }),
      );
    },
    {
      tid: TEMPLATE_ID,
      iid: instanceId,
      nameId: NAME_FIELD_ID,
      ageId: AGE_FIELD_ID,
      template: contactFormTemplate,
    },
  );

  await page.goto(`/templates/${TEMPLATE_ID}/instances`);
  await page.waitForSelector('[data-testid="instances-list"]', { timeout: 5_000 });

  // Instance row should be visible
  const row = page.locator(`[data-testid="instance-row-${instanceId}"]`);
  await expect(row).toBeVisible();

  // Click View link to open instance
  await row.locator('a:has-text("View")').click();

  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
  // Values are in disabled inputs; verify via toHaveValue
  await expect(page.locator(`[data-testid="instance-field-${NAME_FIELD_ID}"] input`)).toHaveValue("Alice");
  await expect(page.locator(`[data-testid="instance-field-${AGE_FIELD_ID}"] input`)).toHaveValue("30");
});

// S5 — Download PDF (Playwright: assert #print-region content)
test("S5 — Download PDF (print region content)", async ({ page }) => {
  await seedTemplate(page);

  const instanceId = "instance-001";
  await page.evaluate(
    ({ tid, iid, nameId, ageId, template }) => {
      const instance = {
        id: iid,
        templateId: tid,
        templateSnapshot: template,
        values: { [nameId]: "Alice", [ageId]: 30 },
        visibility: { [nameId]: true, [ageId]: true },
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(
        "formBuilder",
        JSON.stringify({
          version: 1,
          templates: { [tid]: template },
          instances: { [iid]: instance },
        }),
      );
    },
    {
      tid: TEMPLATE_ID,
      iid: instanceId,
      nameId: NAME_FIELD_ID,
      ageId: AGE_FIELD_ID,
      template: contactFormTemplate,
    },
  );

  await page.goto(`/instances/${instanceId}`);
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Print button exists
  await expect(page.locator('[data-testid="download-pdf"]')).toBeVisible();

  // The print region is rendered via React portal into document.body.
  // It has display:none on screen but its content is always present in the DOM.
  const printRegion = page.locator("#print-region");
  await expect(printRegion).toBeAttached();

  // Assert content of print region
  const printContent = await printRegion.textContent();
  expect(printContent).toContain("Contact Form");
  expect(printContent).toContain("Alice");
  expect(printContent).toContain("30");
  expect(printContent).toContain("Submitted");
});

// S12 — Hidden field excluded from instance view and PDF
test("S12 — Hidden field excluded from instance view and PDF", async ({ page }) => {
  const templateId = "tpl-privacy-001";
  const publicId = "field-public-001";
  const secretId = "field-secret-001";
  const instanceId = "inst-privacy-001";

  await page.evaluate(
    ({ tid, iid, publicId, secretId }) => {
      const template = {
        id: tid,
        title: "Privacy Demo",
        fields: [
          { id: publicId, type: "text", label: "Public Info", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
          { id: secretId, type: "text", label: "Secret Info", conditions: [], conditionLogic: "OR", defaultVisible: false, defaultRequired: false, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      const instance = {
        id: iid, templateId: tid, templateSnapshot: template,
        values: { [publicId]: "visible value" },
        visibility: { [publicId]: true, [secretId]: false },
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: { [iid]: instance } }));
    },
    { tid: templateId, iid: instanceId, publicId, secretId },
  );

  await page.goto(`/instances/${instanceId}`);
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Public shown, Secret absent from instance view
  await expect(page.locator(`[data-testid="instance-field-${publicId}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="instance-field-${secretId}"]`)).not.toBeAttached();

  // Print region: Public present, Secret label absent
  const printContent = await page.locator("#print-region").textContent();
  expect(printContent).toContain("Public Info");
  expect(printContent).not.toContain("Secret Info");
});

// S13 — Visible-but-empty renders — in instance view and PDF (E2)
test("S13 — Visible-but-empty renders — in instance view and PDF", async ({ page }) => {
  const templateId = "tpl-empty-001";
  const fieldId = "field-opt-001";
  const instanceId = "inst-empty-001";

  await page.evaluate(
    ({ tid, iid, fieldId }) => {
      const template = {
        id: tid,
        title: "Optional Demo",
        fields: [
          { id: fieldId, type: "text", label: "Optional Field", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      const instance = {
        id: iid, templateId: tid, templateSnapshot: template,
        values: {}, // field not filled — intentionally absent
        visibility: { [fieldId]: true },
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem("formBuilder", JSON.stringify({ version: 1, templates: { [tid]: template }, instances: { [iid]: instance } }));
    },
    { tid: templateId, iid: instanceId, fieldId },
  );

  await page.goto(`/instances/${instanceId}`);
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });

  // Visible-but-empty shows — placeholder (distinguishable from hidden)
  const emptyEl = page.locator(`[data-testid="instance-empty-${fieldId}"]`);
  await expect(emptyEl).toBeVisible();
  await expect(emptyEl).toContainText("—");

  // Label visible
  await expect(page.locator('[data-testid="instance-view"]')).toContainText("Optional Field");

  // Print region also shows — for the empty field
  const printContent = await page.locator("#print-region").textContent();
  expect(printContent).toContain("Optional Field");
  expect(printContent).toContain("—");
});
