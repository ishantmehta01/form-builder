# E2E Scenarios — Form Builder

> Single source of truth for end-to-end verification. Each scenario is human-runnable (manual smoke test) AND machine-runnable (Playwright). Manual gives you visual/UX feel; Playwright gives you regression protection.
>
> **Format per scenario:** stable ID, title, preconditions (what state to start in), numbered steps, expected outcomes (assertions). Outcomes are explicit so manual and Playwright assertions match.
>
> **Order of work:** (1) verify these manually in `npm run dev` to confirm the app actually works, (2) implement them as Playwright `.spec.ts` files mapping 1:1.

---

## Setup (run before each scenario session)

1. `npm run dev` opens app at `http://localhost:5173`
2. **Clear localStorage between scenarios** unless explicitly chained: in DevTools console run `localStorage.clear()` and refresh. Playwright will do this in `test.beforeEach`.

---

# Golden Path (S1–S6)

These six scenarios cover the core happy path. If all six pass, the basic product works end-to-end.

## S1 — Create empty template, save, see in list

**Preconditions:** localStorage clear.

**Steps:**
1. Navigate to `/`
2. Click "New Template"
3. In the title input, type `My First Form`
4. Click Save

**Expected:**
- Redirected to templates list (URL = `/`)
- A card titled `My First Form` appears with field count = 0

---

## S2 — Build template with Text + Number, save

**Preconditions:** localStorage clear.

**Steps:**
1. Navigate to `/templates/new`
2. Title = `Contact Form`
3. Add a Text field, set label = `Name`
4. Add a Number field, set label = `Age`, decimal places = 0, min = 0, max = 120
5. Click Save

**Expected:**
- Template "Contact Form" appears in list with field count = 2

---

## S3 — Fill simple form, submit, see instance

**Preconditions:** Template from S2 exists.

**Steps:**
1. From templates list, click "New Response" on `Contact Form`
2. Type `Alice` in Name
3. Type `30` in Age
4. Click Submit

**Expected:**
- Redirected to instance view (URL = `/instances/<id>`)
- Page shows `Alice` and `30` for the two fields
- Submission timestamp visible

---

## S4 — View instance from instances list

**Preconditions:** Instance from S3 exists.

**Steps:**
1. Navigate to `/templates/<contactFormId>/instances`
2. Click the instance row

**Expected:**
- Instance view loads
- Same content as in S3

---

## S5 — Download PDF (manual: visual check; Playwright: print region content)

**Preconditions:** Instance from S3 exists. Open instance view.

**Steps:**
1. Click "Download PDF" button (or Cmd+P)
2. Browser print preview opens

**Expected:**
- Print preview shows form title `Contact Form`
- "Submitted: <timestamp>" line visible
- `Name: Alice` and `Age: 30` visible
- No screen-only UI (header nav, buttons) appears in preview
- *Manual only:* layout looks like a real form, not a debug dump

**Playwright assertion:** `#print-region` exists in `document.body`, contains `Contact Form`, `Alice`, `30`. (Cannot assert print preview opens in headless.)

---

## S6 — Export CSV from instances list

**Preconditions:** At least 1 instance exists for `Contact Form`.

**Steps:**
1. Navigate to `/templates/<contactFormId>/instances`
2. Click "Export CSV"

**Expected:**
- File downloads (browser download notification)
- *Manual:* open in Sheets — header row = `Name, Age` (or `Submitted At, Name, Age` if meta columns included); data row = `Alice, 30`
- *Playwright:* capture download via `page.waitForEvent('download')`, parse CSV content, assert header + row content

---

# Edge Cases (S7–S15)

These are the tests that prove the rubric criteria — conditional logic correctness, type safety side effects, accessibility, etc.

## S7 — Cycle detection blocks save with informative error

**Preconditions:** localStorage clear.

**Steps:**
1. Navigate to `/templates/new`
2. Title = `Cycle Test`
3. Add Text field A, label = `A`
4. Add Text field B, label = `B`
5. On A, add condition: show if B equals "go"
6. On B, add condition: show if A equals "go"
7. Click Save

**Expected:**
- Save blocked
- Inline error visible containing the words "loop" or "cycle" (case-insensitive)
- Template NOT in templates list (navigate to `/`, confirm empty)

---

## S8 — Live conditional show/hide in fill mode

**Preconditions:** localStorage clear.

**Steps:**
1. Build template `Conditional Demo`:
   - Field A: Single Select with options `Yes`, `No`, default visible
   - Field B: Text, label `Reason`, hidden by default, **show** if A equals `Yes`
2. Save
3. Open New Response
4. Initially: A is visible, B is hidden
5. Select `Yes` for A
6. **Assert:** B becomes visible immediately (no submit needed)
7. Change A to `No`
8. **Assert:** B becomes hidden immediately

**Expected:**
- B's visibility tracks A's value in real time
- Toggling A back and forth works without page reload

---

## S9 — Calc updates live including hidden sources (B2 dropped)

**Preconditions:** localStorage clear.

**Steps:**
1. Build template `Calc Demo`:
   - Number A
   - Number B
   - Number C, hidden by default
   - Calculation `Total` = sum of [A, B, C], decimal places = 0
2. Save → New Response
3. Type A = 10, B = 20 → assert Total = 30
4. (C is hidden, can't be filled via UI — its value remains absent → contributes 0)
5. Now make C visible by toggling its `defaultVisible` in builder, save → re-open response
6. Type C = 30 → assert Total = 60

**Expected:**
- Calc updates within ~100ms of typing
- B2-dropped behavior confirmed: even when C was hidden in step 3-4, if C had a value it would still count (covered more directly in unit tests; this scenario covers the live-update path)

---

## S10 — Required validation blocks submit; error clears on input

**Preconditions:** Template `Required Demo` with one required Text field.

**Steps:**
1. Open New Response
2. Without typing anything, click Submit
3. **Assert:** validation error appears below the field (red, contains "required" or similar); not redirected
4. Type any value
5. **Assert:** error message clears (real-time clearing per J1)
6. Click Submit
7. **Assert:** instance created

**Expected:**
- Submit button doesn't redirect when invalid
- Error appears under the field (not in a top-of-form summary)
- Error clears as soon as input is valid

---

## S11 — Hidden required field is NOT validated

**Preconditions:** Template with field B that is required AND hidden by default (no triggering condition).

**Steps:**
1. Open New Response — B is hidden
2. Click Submit (form is otherwise valid)

**Expected:**
- Submit succeeds (no validation error for B even though required)
- Instance created
- B not present in instance.values
- B not present in PDF print region
- B not in CSV export

---

## S12 — Hidden field excluded from PDF and CSV

**Preconditions:** Template `Privacy Demo` with one always-visible field `Public` and one always-hidden field `Secret`.

**Steps:**
1. Try to fill — `Secret` is hidden, can only fill `Public`
2. Submit → instance
3. View instance → `Public` shown, `Secret` not shown
4. Download PDF → `Secret` label NOT in print preview
5. Export CSV → `Secret` column either absent (if never filled in any instance snapshot) or has empty cell for hidden fields

**Expected:**
- Hidden fields invisible in instance view, PDF, CSV — three layers all consistent

---

## S13 — Visible-but-empty renders `—` in PDF (E2)

**Preconditions:** Template with one optional Text field.

**Steps:**
1. Fill nothing
2. Submit (passes because field is optional)
3. View instance → field label shown with `—` placeholder
4. Cmd+P → print preview shows label with `—`

**Expected:**
- Distinguishable from hidden: hidden = absent entirely, visible-empty = label + dash

---

## S14 — Section Header uses semantic heading levels (H4)

**Preconditions:** Template `Headings Demo`:
- Section Header `Big`, size = XL
- Section Header `Med`, size = M
- Section Header `Small`, size = XS

**Steps:**
1. Open New Response
2. Inspect DOM (DevTools)

**Expected:**
- `Big` rendered as `<h2>` (XL → h2 per H4 decision)
- `Med` rendered as `<h3>` (M → h3)
- `Small` rendered as `<h4>` (XS → h4)
- Form title is `<h1>` (only one h1 per page for a11y)

**Playwright assertion:** query by role `heading` with `level: 2/3/4`, assert content matches.

---

## S15 — Single-source calc warning shown in builder (B2 leakage caveat)

**Preconditions:** localStorage clear.

**Steps:**
1. Navigate to `/templates/new`
2. Add Number field `A`
3. Add Calculation `Total` with sources = [A] only
4. Click on `Total` to view config

**Expected:**
- Inline warning visible near the source list, containing text like "single source" or "may expose source value" or "consider hiding"
- Warning does NOT appear when calc has 2+ sources OR when the single source is not hideable

---

# Scenarios outside automated scope (manual only)

These cover the rubric's "modern SaaS visual quality" line — automation can verify functional correctness but not aesthetic quality.

## M1 — DnD reorder feels right (manual only)

Drag a field up/down on the Builder canvas. Should: smooth animation, drop indicator visible, keyboard nav works (Tab to focus, Space to grab, arrows to move, Space to drop).

## M2 — beforeunload warning on unsaved changes (manual only)

Make changes in Builder, try to close tab → browser prompts "leave site?" warning.

## M3 — PDF actually looks like a real form (manual only)

Open PDF preview, eyeball it. Typography, spacing, page breaks, no widow/orphan label-without-value, header/footer presence (per browser support).

## M4 — A11y baseline (manual only with axe DevTools)

Run axe browser extension on Builder, Fill, InstanceView pages. Should report 0 critical, 0 serious issues.

---

# Mapping to Playwright

When implementing as Playwright tests, recommended file split:

- `tests/e2e/builder.spec.ts` — S1, S2, S7, S15 (and S14's structural assertions if not covered elsewhere)
- `tests/e2e/fill.spec.ts` — S8, S9, S10, S11, S14 (heading levels rendered in fill mode)
- `tests/e2e/instance.spec.ts` — S3, S4, S5, S12, S13
- `tests/e2e/export.spec.ts` — S6 (CSV download)
- `tests/e2e/golden.spec.ts` — full S1→S2→S3→S5→S6 chain as one integration test

Total: ~15 scenarios × ~3 assertions each = ~45 Playwright assertions across ~5 spec files.

---

# Future scenarios (incremental, add as you find bugs in manual testing)

These were discovered during manual smoke testing AFTER S1–S15 were specified. Playwright should cover them too.

## S16 — Deleting a template cascades to its filled responses (D3)

**Bug surfaced during manual smoke 2026-05-03:** instances persisted after their parent template was deleted, leaving orphan rows in localStorage. Fixed in `src/stores/templates.ts` by filtering instances on `deleteTemplate`. Unit-tested in `src/stores/templates.test.ts` (5 cases). This Playwright scenario is the end-to-end proof.

**Preconditions:** localStorage clear.

**Steps:**
1. Build template `T1` (any field), save
2. Build template `T2` (any field), save
3. Open `T1` → New Response → fill + submit (creates instance `I1`)
4. Open `T1` again → New Response → fill + submit (creates `I2`)
5. Open `T2` → New Response → fill + submit (creates `I3`)
6. Navigate to `/` (templates list)
7. Click Delete on `T1` → confirm modal shows "2 filled responses will also be deleted"
8. Click Confirm

**Expected:**
- `T1` no longer in templates list
- `T2` still in templates list
- Navigate to `T2`'s instances list → `I3` still present
- localStorage `formBuilder.instances` contains only `I3` (not `I1` or `I2`) — verify via Dev Tools menu → Show localStorage, JSON tree shows `instances: { I3: ... }` only
- No orphans persist after a page reload

**Playwright assertion:** after delete, read storage directly and assert exact instance IDs:
```ts
const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('formBuilder')!)
);
expect(Object.keys(stored.instances)).toEqual(['I3']);
```

**Maps to spec file:** `tests/e2e/builder.spec.ts` (templates-list flow). One Playwright `test()` titled `S16 — Deleting a template cascades to its filled responses (D3)`.

---

## S17 — Condition value editor must match operator's expected shape

**Bug surfaced during manual S8 walkthrough 2026-05-03:** Single Select target with `select_equals` operator never matched. The Builder's condition value editor was a plain text input, so users typed the option label (e.g. "Yes") which got stored as a string. But Single Select fields store the option's `id` (UUID) as the runtime value, not the label. Engine compared `"<UUID>" === "Yes"` and always returned false, so dependent fields never appeared. Fixed in `src/pages/Builder.tsx` by making the value editor type-aware per operator.

**Preconditions:** localStorage clear.

**Steps:**
1. Build template `Conditional Demo`:
   - Field A: Single Select with options `Yes`, `No`, defaultVisible=true
   - Field B: Text, label `Reason`, defaultVisible=false
2. On Field B, add condition: target=A, operator=`select_equals`, effect=show
3. **In the condition value editor:** assert it's a `<select>` dropdown (NOT a text input) listing both options by their labels
4. Pick `Yes` from the dropdown
5. Save
6. Open New Response
7. **Initial state:** A visible, B hidden
8. Pick `Yes` for A → **B becomes visible immediately**
9. Pick `No` → **B becomes hidden immediately**

**Expected:**
- Step 3: value editor renders as a dropdown with options "Yes" / "No" (not a text input)
- Stored condition value is the option's UUID, not the label string
- B's visibility tracks A's value in real time

**Negative test (regression guard):**
- Authoring with `number_within_range` shows two `min`/`max` number inputs (not a single text field)
- Authoring with `multi_contains_any` shows checkboxes for each target option
- Authoring with `date_before` shows a `<input type="date">`
- Authoring with `text_equals` keeps the existing plain text input

**Maps to spec file:** `tests/e2e/builder.spec.ts` (Builder authoring flow) AND `tests/e2e/fill.spec.ts` (live behavior). Two Playwright `test()`s titled `S17 — Condition value editor renders correctly per operator` and `S17 — Single Select condition fires correctly in fill mode`.

---

## Reserved slots

- S18 — *(reserved)*

When you find a manual bug, add a scenario here, fix the bug, then add the scenario to Playwright. Keeps the test suite a living spec, not a frozen snapshot.
