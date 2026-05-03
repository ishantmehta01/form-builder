import { test, expect } from "@playwright/test";
import { promises as fs } from "fs";
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

test.beforeEach(async ({ page }) => {
  await clearStorage(page);
  await page.goto("/");
});

// S6 — Export CSV from instances list
test("S6 — Export CSV from instances list", async ({ page }) => {
  const instanceId = "instance-001";

  // Seed template + instance into localStorage
  await page.evaluate(
    ({ tid, iid, nameId, ageId, template }) => {
      const instance = {
        id: iid,
        templateId: tid,
        templateSnapshot: template,
        values: { [nameId]: "Alice", [ageId]: 30 },
        visibility: { [nameId]: true, [ageId]: true },
        submittedAt: "2026-01-01T12:00:00.000Z",
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
  await expect(page.locator('[data-testid="export-csv"]')).toBeVisible();

  // Capture the download
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-testid="export-csv"]'),
  ]);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const csv = await fs.readFile(downloadPath!, "utf-8");
  const lines = csv.trim().split("\n");

  // At least 2 lines: header + data row
  expect(lines.length).toBeGreaterThanOrEqual(2);

  const header = lines[0]!;
  expect(header).toContain("Name");
  expect(header).toContain("Age");

  // Data row has Alice and 30
  const dataRows = lines.slice(1).join("\n");
  expect(dataRows).toContain("Alice");
  expect(dataRows).toContain("30");
});
