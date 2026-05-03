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

// S29 — CSV header uses latest label when field is renamed across instances (G1, Tier 2)
test("S29 — CSV header uses latest snapshot label for renamed field", async ({ page }) => {
  const templateId = "tpl-rename-s29";
  const fieldId = "field-contact-s29";
  const phoneId = "field-phone-s29";
  const inst1Id = "inst-old-s29";
  const inst2Id = "inst-new-s29";

  await page.evaluate(
    ({ templateId, fieldId, phoneId, inst1Id, inst2Id }) => {
      const liveTemplate = {
        id: templateId, title: "Survey",
        fields: [
          { id: fieldId, type: "text", label: "Contact", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
          { id: phoneId, type: "text", label: "Phone", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-02T00:00:00.000Z",
      };
      const snap1 = {
        id: templateId, title: "Survey",
        fields: [{ id: fieldId, type: "text", label: "Email", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      const snap2 = { ...liveTemplate };
      // inst2 has newer submittedAt so it appears first in sorted list → its labels win
      localStorage.setItem("formBuilder", JSON.stringify({
        version: 1,
        templates: { [templateId]: liveTemplate },
        instances: {
          [inst1Id]: { id: inst1Id, templateId, templateSnapshot: snap1, values: { [fieldId]: "alice@example.com" }, visibility: { [fieldId]: true }, submittedAt: "2026-01-01T12:00:00.000Z" },
          [inst2Id]: { id: inst2Id, templateId, templateSnapshot: snap2, values: { [fieldId]: "bob@example.com", [phoneId]: "555-1234" }, visibility: { [fieldId]: true, [phoneId]: true }, submittedAt: "2026-01-02T12:00:00.000Z" },
        },
      }));
    },
    { templateId, fieldId, phoneId, inst1Id, inst2Id },
  );

  await page.goto(`/templates/${templateId}/instances`);
  await page.waitForSelector('[data-testid="instances-list"]', { timeout: 5_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-testid="export-csv"]'),
  ]);

  const csv = await fs.readFile((await download.path())!, "utf-8");
  const lines = csv.trim().split("\n");
  const header = lines[0]!;

  // Latest label "Contact" used, not old "Email"
  expect(header).toContain("Contact");
  expect(header).not.toContain("Email");

  // Both instances populate the Contact column (same field ID)
  const dataRows = lines.slice(1).join("\n");
  expect(dataRows).toContain("alice@example.com");
  expect(dataRows).toContain("bob@example.com");
});

// S30 — CSV includes removed-field column for older instances (G1, Tier 2)
test("S30 — CSV includes removed field as column from older instance snapshots", async ({ page }) => {
  const templateId = "tpl-removed-s30";
  const aId = "field-a-s30";
  const bId = "field-b-s30";
  const inst1Id = "inst-with-b-s30";
  const inst2Id = "inst-no-b-s30";

  await page.evaluate(
    ({ templateId, aId, bId, inst1Id, inst2Id }) => {
      // Live template has only field A (B was removed)
      const liveTemplate = {
        id: templateId, title: "T",
        fields: [{ id: aId, type: "text", label: "A", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-02T00:00:00.000Z",
      };
      // I1 snapshot: had both A and B
      const snap1 = {
        id: templateId, title: "T",
        fields: [
          { id: aId, type: "text", label: "A", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
          { id: bId, type: "text", label: "B", conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {} },
        ],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      // inst2 submitted later (no B in snapshot)
      localStorage.setItem("formBuilder", JSON.stringify({
        version: 1,
        templates: { [templateId]: liveTemplate },
        instances: {
          [inst1Id]: { id: inst1Id, templateId, templateSnapshot: snap1, values: { [aId]: "hello", [bId]: "world" }, visibility: { [aId]: true, [bId]: true }, submittedAt: "2026-01-01T12:00:00.000Z" },
          [inst2Id]: { id: inst2Id, templateId, templateSnapshot: liveTemplate, values: { [aId]: "later" }, visibility: { [aId]: true }, submittedAt: "2026-01-02T12:00:00.000Z" },
        },
      }));
    },
    { templateId, aId, bId, inst1Id, inst2Id },
  );

  await page.goto(`/templates/${templateId}/instances`);
  await page.waitForSelector('[data-testid="instances-list"]', { timeout: 5_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-testid="export-csv"]'),
  ]);

  const csv = await fs.readFile((await download.path())!, "utf-8");
  const lines = csv.trim().split("\n");
  const header = lines[0]!;

  // Both A and B columns present (B from I1's older snapshot)
  expect(header).toContain("A");
  expect(header).toContain("B");

  // I2's row (newest, sorted first) has value for A but empty for B
  const rows = lines.slice(1);
  expect(rows.length).toBe(2);
  // Strip trailing \r from lines (CSV uses \r\n; split("\n") leaves \r on non-final rows)
  const newerRow = rows[0]!.replace(/\r$/, "");
  const olderRow = rows[1]!.replace(/\r$/, "");

  expect(olderRow).toContain("hello");
  expect(olderRow).toContain("world");
  expect(newerRow).toContain("later");
  // newerRow's B cell is empty — it has no B value
  const headerCols = header.replace(/\r$/, "").split(",");
  const bIndex = headerCols.findIndex((h) => h.trim() === "B");
  const newerCols = newerRow.split(",");
  expect(newerCols[bIndex]!.trim()).toBe("");
});

// S38 — Special characters in field labels survive round-trip through storage and CSV (Tier 2)
test("S38 — Special characters in labels: no injection, RFC 4180 CSV escaping", async ({ page }) => {
  const templateId = "tpl-special-s38";
  const fieldId = "field-special-s38";
  const instanceId = "inst-special-s38";
  const specialLabel = `Order #1, "priority" <test>`;

  await page.evaluate(
    ({ templateId, fieldId, instanceId, specialLabel }) => {
      const template = {
        id: templateId, title: "Special Chars",
        fields: [{
          id: fieldId, type: "text", label: specialLabel,
          conditions: [], conditionLogic: "OR", defaultVisible: true, defaultRequired: false, config: {},
        }],
        createdAt: "2026-01-01T00:00:00.000Z", modifiedAt: "2026-01-01T00:00:00.000Z",
      };
      const instance = {
        id: instanceId, templateId,
        templateSnapshot: template,
        values: { [fieldId]: "test value" },
        visibility: { [fieldId]: true },
        submittedAt: "2026-01-01T12:00:00.000Z",
      };
      localStorage.setItem("formBuilder", JSON.stringify({
        version: 1, templates: { [templateId]: template }, instances: { [instanceId]: instance },
      }));
    },
    { templateId, fieldId, instanceId, specialLabel },
  );

  // Instance view: label renders as plain text (no HTML injection, no double-escaping)
  await page.goto(`/instances/${instanceId}`);
  await page.waitForSelector('[data-testid="instance-view"]', { timeout: 5_000 });
  await expect(page.locator('[data-testid="instance-view"]')).toContainText(specialLabel);

  // CSV: header column must be RFC 4180 escaped (quotes doubled, wrapped in outer quotes)
  await page.goto(`/templates/${templateId}/instances`);
  await page.waitForSelector('[data-testid="instances-list"]', { timeout: 5_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('[data-testid="export-csv"]'),
  ]);

  const csv = await fs.readFile((await download.path())!, "utf-8");
  const header = csv.split("\n")[0]!;
  // RFC 4180: contains comma+quote → must be wrapped and internal quotes doubled
  expect(header).toContain(`"Order #1, ""priority"" <test>"`);
});
