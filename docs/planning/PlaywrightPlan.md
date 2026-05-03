# Playwright E2E Plan — Form Builder

---

## Context

The form-builder project has a complete implementation + extensive unit test coverage (~230 tests after gap-fill). What's missing is **end-to-end browser verification** — proof that the full Builder → Fill → Submit → Export flows actually work in a real browser, not just in jsdom.

Read these to understand the current state — **do not re-implement, do not change existing tests**:

1. **`docs/planning/TYPES_PROPOSAL.md`** — locked architecture
2. **`docs/planning/decision-log.md`** — locked decisions (especially A1 cycle blocking, A2 hidden values, A5 topological eval, B2 dropped, G1 CSV union-of-snapshots)
3. **`docs/planning/PROGRESS.md`** — what's already built
4. **`README.md`** — feature overview

## Working mode

- Senior peer treatment. Tight responses. Push back if you disagree.
- Do NOT modify existing source code or unit tests unless required to make E2E pass (and if so, log the change in PROGRESS.md with rationale).
- Do NOT touch `AI_USAGE_LOG.md`.
- Same hard rules as previous prompts: never `cd` outside the project folder, never `git commit/push`, never `rm -rf`, never `sudo`.

## Stack addition

- **`@playwright/test`** — install as dev dependency
- **Chromium only** — Safari and Firefox cross-browser is out of scope here (covered manually per K2)
- **Headless by default** — for CI-friendliness. Agent can use `--headed` only when debugging a flaky test
- Tests live in `tests/e2e/*.spec.ts` (NOT in `src/` — keeps unit and E2E separated)

## Phased execution

### Phase E1 — Install + config (10 min)

1. `npm install -D @playwright/test`
2. `npx playwright install chromium` (downloads ~150MB; expect to see download progress)
3. Create `playwright.config.ts` at project root:

   ```ts
   import { defineConfig, devices } from "@playwright/test";

   export default defineConfig({
     testDir: "./tests/e2e",
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: "html",
     use: {
       baseURL: "http://localhost:5173",
       trace: "on-first-retry",
       screenshot: "only-on-failure",
     },
     projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
     webServer: {
       command: "npm run dev",
       url: "http://localhost:5173",
       reuseExistingServer: !process.env.CI,
       timeout: 120_000,
     },
   });
   ```

4. Add npm scripts to `package.json`:
   ```json
   "test:e2e": "playwright test",
   "test:e2e:ui": "playwright test --ui",
   "test:e2e:debug": "playwright test --debug"
   ```
5. Add to `.gitignore`:
   ```
   playwright-report/
   test-results/
   /tests/e2e/.auth/
   ```
6. Verify: `npx playwright --version` works; `npm run test:e2e -- --list` lists 0 tests cleanly (no errors)

**Checkpoint:** install clean, config in place, scripts wired. Log to PROGRESS.md.

---

### Phase E2 — Test helpers + page objects (15 min)

Create `tests/e2e/helpers.ts` with reusable helpers:

```ts
import type { Page, Locator } from "@playwright/test";

// Navigate to home and wait for templates list to render
export async function gotoHome(page: Page) {
  await page.goto("/");
  await page.waitForSelector('[data-testid="templates-list"]', {
    timeout: 5_000,
  });
}

// Navigate to builder for new template
export async function gotoNewBuilder(page: Page) {
  await page.goto("/templates/new");
  await page.waitForSelector('[data-testid="builder-canvas"]', {
    timeout: 5_000,
  });
}

// Add a field of given type from the left palette
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
  await page.waitForTimeout(100); // brief wait for state propagation; replace with selector wait if flake
}

// Set the label of the currently-selected field
export async function setLabel(page: Page, label: string) {
  await page.fill('[data-testid="config-label"]', label);
}

// Save the template; returns true if save succeeded (no inline error)
export async function saveTemplate(page: Page): Promise<boolean> {
  await page.click('[data-testid="save-template"]');
  await page.waitForTimeout(300);
  const errorVisible = await page
    .locator('[data-testid="save-error"]')
    .isVisible()
    .catch(() => false);
  return !errorVisible;
}

// localStorage cleanup between tests
export async function clearStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}
```

> **NOTE on `data-testid`:** the existing UI may NOT have these test IDs yet. Phase E3 will add them where missing. The spec is: every interactive element a test needs to target gets a stable `data-testid`. Do not use brittle selectors (text content, CSS classes) for E2E.

**Checkpoint:** helpers file written, ready to use. Log to PROGRESS.md.

---

### Phase E3 — Add `data-testid` attributes to UI (30 min)

Audit the following components and add `data-testid` attributes where E2E needs them. **Do not change behavior, only add attributes.**

Required test IDs (minimum):

**TemplatesList page:**

- `[data-testid="templates-list"]` — root container
- `[data-testid="new-template-button"]` — "New Template" button
- `[data-testid="template-card-${id}"]` — each template card (templated by ID)
- `[data-testid="open-template-${id}"]` — edit link
- `[data-testid="new-response-${id}"]` — "New Response" button
- `[data-testid="delete-template-${id}"]` — delete button

**Builder page:**

- `[data-testid="builder-canvas"]` — center canvas
- `[data-testid="add-field-${type}"]` — left-panel field-type buttons (one per type)
- `[data-testid="canvas-field-${index}"]` — each field row on canvas
- `[data-testid="config-label"]` — right-panel label input (for selected field)
- `[data-testid="save-template"]` — save button
- `[data-testid="save-error"]` — inline error container (visible when save fails)
- `[data-testid="template-title"]` — title input

**Fill page:**

- `[data-testid="fill-form"]` — root form container
- `[data-testid="field-${id}"]` — each rendered field wrapper (use field id)
- `[data-testid="submit-form"]` — submit button
- `[data-testid="field-error-${id}"]` — inline validation error container per field

**InstanceView page:**

- `[data-testid="instance-view"]` — root container
- `[data-testid="download-pdf"]` — Download PDF button
- `[data-testid="export-csv"]` — Export CSV button (likely on InstancesList, not InstanceView)
- `#print-region` — already exists; do not change

**InstancesList page:**

- `[data-testid="instances-list"]` — root
- `[data-testid="instance-row-${id}"]` — each row

Run `npm run dev`, click through quickly to verify the test IDs are reachable. Run unit tests after — `npm test -- --run` should still pass (adding data-testid is non-behavioral).

**Checkpoint:** all test IDs in place, unit tests still pass. Log to PROGRESS.md.

---

### Phase E4 — Implement scenarios from `E2E_SCENARIOS.md` (~2 hours)

**The source of truth for what to test is `docs/planning/E2E_SCENARIOS.md` — NOT this prompt.** That file has **41 numbered scenarios (S1–S41)** plus **7 manual-only scenarios (M1–M7)**, with stable IDs, preconditions, numbered steps, and explicit expected outcomes. Each S1–S17 + S41 was hand-verified manually before this Playwright phase. S18–S40 are extended-coverage scenarios with **tier markers** (Tier 1 = must-cover, Tier 2 = strong, Tier 3 = nice-to-have). Your job is **mechanical translation**, not invention.

**Read `docs/planning/E2E_SCENARIOS.md` end-to-end first.** Each scenario has a `Maps to:` annotation pointing to its target spec file — use that as the routing. Suggested file structure (final layout based on the per-scenario annotations):

| Spec file                       | Scenarios                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `tests/e2e/builder.spec.ts`     | S1, S2, S7, S15, S16, S17 (builder portion), S25, S34, S38 (builder portion), S41        |
| `tests/e2e/fill.spec.ts`        | S8, S9, S10, S11, S14, S17 (fill portion), S18, S19, S20, S21, S22, S23, S24, S26, S27, S31, S32, S33, S37, S40 |
| `tests/e2e/instance.spec.ts`    | S3, S4, S5, S12, S13, S28                                                                |
| `tests/e2e/export.spec.ts`      | S6, S29, S30, S38 (export portion)                                                       |
| `tests/e2e/persistence.spec.ts` | S35, S36 (new file for load-time invariants)                                             |
| `tests/e2e/golden.spec.ts`      | end-to-end chain S1 → S2 → S3 → S5 → S6 as one integration flow + S39 navigation        |

**Implementation scope — Tiers are how you triage if you fall behind:**

- **Mandatory (must implement):** S1–S17 (all original golden + edge cases), S41 (preview-confirm), and all S18–S40 marked **Tier 1** in the scenarios file. Approximately **29 scenarios.** This is the must-ship floor.
- **Strong (do unless out of time):** S18–S40 marked **Tier 2.** Approximately **9 more scenarios** (38 total).
- **Nice-to-have:** S18–S40 marked **Tier 3** (S37, S39, S40). Implement if quota and time allow.

**Rules for implementation:**

1. **One Playwright `test()` per scenario.** Title = `Sx — <scenario title>` so failures are traceable back to the spec. Match the scenario's title verbatim.
2. **Comment each test with the scenario ID** at the top, e.g., `// S7 — Cycle detection blocks save with informative error`.
3. **Use the scenario's `Preconditions`** to write `test.beforeEach` setup. Use scenario's `Steps` as the sequence of Playwright actions. Use scenario's `Expected` to write assertions.
4. **Do NOT add scenarios that aren't in S1–S41.** If you find missing coverage during implementation, append the new scenario to `E2E_SCENARIOS.md` first (in the Future / reserved section), then implement.
5. **Do NOT skip mandatory scenarios.** All Tier-1 + S1–S17 + S41 must have a corresponding Playwright test. If a scenario is genuinely impossible to automate (e.g., visual-only check), still create the test and mark it `test.fixme()` with a comment pointing to the relevant manual scenario in M1–M7. Log every `test.fixme()` to PROGRESS.md with a clear reason.
6. **Manual-only scenarios M1–M7 do NOT get Playwright tests.** They're documented in E2E_SCENARIOS.md for human verification only.
7. **Tier 2 / Tier 3 honesty rule.** If you can't reach Tier 2 in time, log a `⚠️ BLOCKER` listing the unimplemented scenario IDs and reason. Don't silently skip.

**Special handling notes:**

- **S5 (PDF):** `window.print()` opens browser native dialog (untestable headless). Mock or stub it: `await page.exposeFunction('mockPrint', () => {})` and override `window.print` early. Then assert `#print-region` content per scenario expected outcomes. The print-region lives in `document.body` (rendered via portal) — query via `page.locator('#print-region')`, not within the React tree.
- **S6 (CSV):** use `const downloadPromise = page.waitForEvent('download'); await page.click('[data-testid="export-csv"]'); const download = await downloadPromise; const path = await download.path(); const csv = await fs.readFile(path, 'utf-8');` Then parse and assert.
- **S8 / S9 (live updates):** use `expect(...).toBeVisible()` and `expect(...).toHaveText()` with default 5s timeout — Playwright auto-waits. Don't `waitForTimeout`.
- **S14 (heading levels):** `await expect(page.getByRole('heading', { level: 2, name: 'Big' })).toBeVisible();` etc.

**Checkpoint:** all 15 scenarios implemented, one `test()` per scenario, file structure matches the mapping table. Log to PROGRESS.md per-scenario count.

---

### Phase E5 — Run + fix flakes (30 min)

1. Run `npm run test:e2e`
2. **Expect 1–3 failures** on first run. Common causes: timing (selector not visible yet), wrong test ID, state pollution between tests.
3. For each failure:
   - Read the trace (`playwright show-trace test-results/<trace>.zip`)
   - Replace `waitForTimeout` with `waitForSelector` where possible (timing-based waits are the #1 flake source)
   - Add `clearStorage(page)` to `test.beforeEach` if state pollution detected
   - DO NOT mark a test `.skip` to "fix" it — debug it. If genuinely stuck, log a `⚠️ BLOCKER` in PROGRESS.md and continue.
4. Goal: all mandatory scenarios (S1–S17 + S41 + S18–S40 Tier 1 = 29 total minimum) pass on a single `npm run test:e2e` invocation, 3 runs in a row (manually verify by running 3x). If Tier 2 was implemented, those must pass too. Test titles match `Sx — <scenario title>` so failures are easy to map back to E2E_SCENARIOS.md.
5. If a test is genuinely flaky (passes 2/3): mark with `test.fixme()` (NOT `.skip`) and log the flake in PROGRESS.md with a reproduction note

**Checkpoint:** `npm run test:e2e` passes 3 runs in a row. Log final test count to PROGRESS.md.

---

### Phase E6 — Document + final verify (15 min)

1. Add to `README.md` a brief "End-to-end tests" section:

   ```markdown
   ## End-to-end tests

   E2E tests use Playwright + headless Chromium. To run:

       npm run test:e2e          # headless
       npm run test:e2e:ui       # Playwright UI mode (interactive)

   First run requires `npx playwright install chromium` (~150MB download).
   Tests live in `tests/e2e/*.spec.ts`. Coverage: Build → Fill → Submit → PDF → CSV golden paths plus cycle-detection negative test.
   ```

2. Run final verification suite:
   - `npm run typecheck` → must pass
   - `npm test -- --run` → must pass
   - `npm run test:e2e` → must pass
   - `npm run build` → must pass
3. Append `## ✅ E2E COMPLETION SUMMARY` to PROGRESS.md with:
   - E2E scenario count: X mandatory (target 29) / Y Tier-2 done / Z Tier-3 done
   - Total project test count: 343 unit + N E2E = ~370+ (depending on tier coverage)
   - Any `test.fixme()`d scenarios with scenario ID + reason
   - Any unimplemented Tier 2 / Tier 3 scenarios logged as `⚠️ BLOCKER` with reason
   - Time elapsed
   - Confirmation that all implemented scenario titles in test files match `Sx — <title>` from E2E_SCENARIOS.md
4. Stop. Don't wait for input.

---

## Hard rules (same as before)

- **Never `cd` outside** `/Users/ishantmehta/Desktop/work/form-builder`
- **Never `git commit`, `git push`, `rm -rf`, `sudo`** — even with permissions
- **Never modify** `~/.claude/`, `/etc/`, or any system directory
- **Never touch** `AI_USAGE_LOG.md`
- **Never `.skip()` tests** to "fix" failures. Either debug + fix, or `test.fixme()` + blocker log
- **Never modify existing unit tests or production source** unless required for E2E to work; if so, log the change with rationale in PROGRESS.md

## Stuck recovery protocol

Same as CompletionPrompt:

1. Try 3 different approaches (different selectors, different waits, different assertions)
2. If still stuck → log `⚠️ BLOCKER` to PROGRESS.md with what you tried + what blocked
3. Continue to next test. Don't stall the whole run.

## Estimated time

E1: 10m + E2: 15m + E3: 30m + E4: ~120m + E5: 45m + E6: 15m = **~3.75 hours of agent-clock for mandatory scope (29 scenarios)**

- **Mandatory scope (29 scenarios):** 3–4 hours realistic with debugging
- **Mandatory + Tier 2 (38 scenarios):** 4.5–5.5 hours
- **Full coverage (41 scenarios):** 5–6.5 hours

Faster than 2.5h is suspicious — likely missed test IDs, `.fixme()`'d scenarios without justification, or skipped Tier-1 mandatory scenarios.

## Final test count target

Current state + this prompt:

- **343 unit tests** (existing — 115 engine + 162 gap-fill + 26 toast/store/cascade additions + InstanceView portal fix retests + condition value editor fix tests)
- **29+ E2E scenarios** (mandatory minimum: S1–S17 + S41 + S18–S40 Tier 1) → up to 41 if full coverage
- **Total: ~372–384 tests across unit + E2E** depending on tier coverage

If `npm run test:e2e` reports fewer than 29 tests, something mandatory was skipped — check PROGRESS.md for `⚠️ BLOCKER` entries and `test.fixme()` markers.
