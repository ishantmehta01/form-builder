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
- _Manual only:_ layout looks like a real form, not a debug dump

**Playwright assertion:** `#print-region` exists in `document.body`, contains `Contact Form`, `Alice`, `30`. (Cannot assert print preview opens in headless.)

---

## S6 — Export CSV from instances list

**Preconditions:** At least 1 instance exists for `Contact Form`.

**Steps:**

1. Navigate to `/templates/<contactFormId>/instances`
2. Click "Export CSV"

**Expected:**

- File downloads (browser download notification)
- _Manual:_ open in Sheets — header row = `Name, Age` (or `Submitted At, Name, Age` if meta columns included); data row = `Alice, 30`
- _Playwright:_ capture download via `page.waitForEvent('download')`, parse CSV content, assert header + row content

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

## M5 — DnD reorder preserves field configuration (manual only)

Drag a field with conditions and calc-source membership to a new position on the canvas. After drop, verify:

- The dragged field's conditions still resolve to their target IDs (not broken by the reorder)
- Calc fields that referenced the dragged field still aggregate correctly
- `conditionLogic`, `defaultVisible`, `defaultRequired` all preserved
- Field order in localStorage matches what's on the canvas
- Open Fill mode → conditions and calcs work as expected

DnD must be a pure array reorder, not a destructive operation that nullifies field state. Hard to assert in Playwright because synthetic drag events don't reproduce real DnD reliably; manual verification is the canonical check.

## M6 — Long answer wraps in PDF, doesn't truncate (K4)

Fill a Multi-line Text field with 500+ characters of mixed content (multi-paragraph). Submit. Open instance, click Download PDF. In print preview verify:

- Text wraps to multiple lines (no `…` truncation)
- `page-break-inside: avoid` keeps label + value on the same page when possible
- Long single words break with `word-wrap: break-word`
- Preserved newlines via `white-space: pre-wrap`
- Cross-page wrapping is clean (no half-character cutoff)

Visual-only — Playwright in headless can assert print-region content but can't grade visual quality.

## M7 — Screen reader announces error on focus (M2 baseline)

Use VoiceOver (Mac) or NVDA (Windows) with the dev server open. After a failed submit:

- Tab to the first errored field
- Screen reader should announce: field label + "required" or specific validation message
- Without the `aria-describedby` wiring (PolishFixes), the error would be invisible to screen reader users despite being visible on screen

Tests the M2 a11y baseline beyond what jsdom can verify (jsdom doesn't run accessibility trees). Run on at least one major flow before shipping.

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
  JSON.parse(localStorage.getItem("formBuilder")!),
);
expect(Object.keys(stored.instances)).toEqual(["I3"]);
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

# Extended coverage — S18–S40

These scenarios were added after the initial S1–S17 set to push beyond happy-path coverage into the corners that distinguish a senior engineer's test suite from a basic one. Grouped by what bug they're guarding against. Tier markers indicate Playwright priority (Tier 1 = must-cover; Tier 3 = nice-to-have).

---

## Conditional logic — chains, precedence, edge cases

### S18 — 4-level cascade through hidden chain (Tier 1)

Tests deep effective-value stripping. A→B→C→D, each reveals the next via a Show condition. Without correct topological order + per-step stripping, hiding A only hides B; C and D stay visible reading B's preserved-but-hidden value.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template `Cascade Test`:
   - A: Single Select (`Yes` / `No`), defaultVisible=true
   - B: Text "Reason", defaultVisible=false, **show if A=Yes**
   - C: Text "Detail", defaultVisible=false, **show if B equals "deep dive"**
   - D: Text "Notes", defaultVisible=false, **show if C equals "yes please"**
2. Save → New Response
3. Pick A=Yes → assert B visible; C, D hidden
4. Type B="deep dive" → assert C visible; D hidden
5. Type C="yes please" → assert D visible
6. Change A back to No → assert B, C, D **all hidden** in a single render frame

**Expected:** All four fields collapse together when A is unset, despite B's and C's values being preserved in memory. The engine's effective-value stripping at each topo level prevents stale-value leak through the chain.

**Playwright assertion:** `await expect(page.getByTestId('field-D')).not.toBeVisible();` after step 6.

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S19 — Calc-as-condition-target (Tier 1)

Tests the dependency edge from calc value → condition graph. Calcs are condition targets per A5; their output must flow into Pass 2 of the engine.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A: Number, defaultVisible=true
   - B: Number, defaultVisible=true
   - Total: Calculation, sources=[A, B], aggregation=`sum`, decimalPlaces=0
   - Bonus: Number "Bonus", defaultVisible=false, **show if Total > 100**
2. Save → New Response
3. Type A=20, B=30 → Total displays `50`, Bonus hidden
4. Type A=80 → Total updates to `110`, **Bonus appears immediately**
5. Type A=10 → Total drops to `40`, Bonus hidden again

**Expected:** Bonus's visibility tracks Total's value in real time within the same render frame as the source change. Exercises calc-output → condition-graph dependency.

**Playwright assertion:** poll Bonus visibility after each input; assert state matches Total threshold at every step.

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S20 — Hidden + required field does NOT block submit (A2 cornerstone, Tier 1)

The make-or-break A2 rule. Without this guard, every form with a default-hidden required field would be unsubmittable.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A: Text "Name", required, defaultVisible=true
   - B: Text "Reason", required, defaultVisible=false, no triggering condition (perma-hidden)
2. Save → New Response
3. Type A="Alice"
4. Click Submit (don't fill B because the UI doesn't render it)

**Expected:**

- Submit succeeds
- Instance created with `values: { A: "Alice" }`, no `B` value
- `instance.visibility.B === false`
- No validation error for B (per A2: hidden never validated, even if required)
- Toast: "Response submitted"

**Playwright assertion:**

```ts
const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("formBuilder")!),
);
const inst = Object.values(stored.instances)[0] as any;
expect(inst.visibility.B).toBe(false);
expect(inst.values.B).toBeUndefined();
```

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S21 — Hide-wins precedence when both Show and Hide fire (Tier 1)

Tests A1 cross-effect precedence in the real DOM (not just engine units).

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A: Single Select (`Yes` / `No`)
   - B: Single Select (`Yes` / `No`)
   - X: Text "Conditional", defaultVisible=false, with TWO conditions:
     - Show: `A equals Yes`
     - Hide: `B equals Yes`
2. Save → New Response
3. Pick A=Yes, B=No → X visible (Show fires; Hide doesn't)
4. Pick A=Yes, B=Yes → **X hidden** (both fire; Hide wins per A1)
5. Pick A=No, B=Yes → X hidden (Hide fires)
6. Pick A=No, B=No → X hidden (no rule fires; defaultVisible=false applies)

**Expected:** Step 4 is the critical assertion. Hide-wins-Show is deterministic per A1's cross-effect precedence rule.

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S22 — Per-effect-group AND vs OR (Tier 1)

Tests A1 conditionLogic scoping (per-effect-group, not global across all conditions of a field).

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A: Single Select (Yes / No)
   - B: Single Select (Yes / No)
   - X: Text "AND-test", defaultVisible=false, conditionLogic=AND, with TWO Show conditions: `A equals Yes`, `B equals Yes`
2. Save → New Response
3. A=Yes, B=No → X hidden (only one Show condition matches)
4. A=No, B=Yes → X hidden (only one Show condition matches)
5. A=Yes, B=Yes → X **visible** (both Show conditions match → AND combined fires)

**Expected:** AND-combined Show group requires all conditions to match. (Compare to OR which would show on either alone.)

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S23 — Empty effect group is inactive (P4 regression guard, Tier 1)

Tests that empty groups must NOT fire via vacuous truth. Without the `length > 0` guard, every field would default to hidden (Hide-wins on empty group).

**Preconditions:** localStorage clear.

**Steps:**

1. Build template with one Text field "X", **zero conditions**, conditionLogic=AND, defaultVisible=true
2. Save → New Response
3. Inspect X's visibility

**Expected:**

- X is **visible**
- Empty Show + empty Hide groups are both inactive; default applies
- Without the guard, `[].every(x => x) === true` would make every effect group fire, and Hide-wins precedence would hide every field on initial load

**Maps to:** `tests/e2e/fill.spec.ts`.

---

## Calculation — boundary + precision

### S24 — All sources empty calc shows `—`, not `0` (Tier 1)

Distinguishes "no answer" from "answer is zero." H5 + B1 rule combined.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A, B, C: Number, defaultVisible=true (all optional)
   - Total: Calc `sum(A, B, C)`, decimalPlaces=0
2. Save → New Response → don't fill any field
3. Inspect Total field renderer

**Expected:**

- Total displays `—` (em dash), NOT `0`
- Submit form (all fields optional → submission succeeds)
- `instance.values.Total` is undefined (per H5 + B1: skip empty sources, no valid sources → omit)
- PDF: Total label shows `—`
- CSV: Total cell empty

**Maps to:** `tests/e2e/fill.spec.ts` + `tests/e2e/instance.spec.ts` + `tests/e2e/export.spec.ts`.

---

### S25 — Single-source calc warning visible in builder (B2 leakage caveat, Tier 2)

Tests that the builder UX surfaces the leakage advisory documented in B2.

**Preconditions:** localStorage clear, in Builder.

**Steps:**

1. Add Number field "Salary"
2. Add Calculation field, set sources=[Salary] (single source)
3. Inspect calc config panel
4. Add a second Number source and re-inspect

**Expected:**

- Step 3: inline warning visible near the source list — text contains "single source" or "may expose" or "consider hiding the calc"
- Step 4: warning disappears after a second source is added (multi-source mitigates the most extreme leakage)

**Maps to:** `tests/e2e/builder.spec.ts`.

---

### S26 — Number raw value used in conditions (A6, Tier 1)

The surprising-but-correct A6 rule. The displayed value is the rounded version; conditions compare against the raw user-entered value.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - Score: Number, decimalPlaces=0
   - Bonus: Text "Bonus", defaultVisible=false, **show if Score > 99.9**
2. Save → New Response
3. Type Score=99.9 → display rounds to `100`
4. Inspect Bonus visibility
5. Type Score=100
6. Inspect Bonus visibility

**Expected:**

- Step 4: Bonus is **hidden** (raw 99.9 is NOT > 99.9, even though display shows `100`)
- Step 6: Bonus is **visible** (raw 100 > 99.9)

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S27 — Decimal precision in aggregation (Tier 2)

Tests output formatting beyond raw math. Floating-point can produce `6.6000000000000005`; the formatter must clamp to declared decimal places.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template:
   - A, B, C: Number, decimalPlaces=1
   - Total: Calc `sum`, decimalPlaces=2
2. Save → fill A=1.1, B=2.2, C=3.3
3. Inspect Total

**Expected:**

- Total displays `6.60` (decimalPlaces=2 formatting)
- NOT `6.6000000000000005` (raw float toString)

**Maps to:** `tests/e2e/fill.spec.ts`.

---

## Snapshot semantics — schema evolution

### S28 — Edit template after instances exist (D4 cornerstone, Tier 1)

Without snapshot semantics, schema evolution would break history. Old instances must continue rendering against their captured snapshot, not the live template.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template "Survey" with one field "Email"
2. Save → fill → submit instance I1
3. Edit "Survey": rename "Email" to "Contact", add new field "Phone"
4. Save → fill → submit instance I2 (now sees Contact + Phone)
5. View I1 → labels show "Email" (its snapshot is preserved)
6. View I2 → labels show "Contact" + "Phone" (new schema)

**Expected:**

- I1's `templateSnapshot.fields[0].label === "Email"` (old name)
- I2's `templateSnapshot.fields[0].label === "Contact"`, has Phone field
- Both render correctly against their own snapshot
- The live template at `templates['Survey']` matches I2's snapshot (it was edited last)

**Playwright assertion:** read both instances from localStorage, assert distinct snapshot labels.

**Maps to:** `tests/e2e/instance.spec.ts`.

---

### S29 — CSV with renamed field uses latest label (G1, Tier 2)

Tests union-of-snapshots header reconciliation when labels change across versions.

**Preconditions:** Same setup as S28 (two instances, evolved template).

**Steps:**

1. Open InstancesList for "Survey"
2. Click Export CSV → capture download

**Expected:**

- Header includes "Contact" (latest label across snapshots), NOT "Email"
- I1's row populates the "Contact" column with its old "Email" data (same field ID, latest label wins)
- I2's row populates "Contact" with its own data
- Headers also include the meta columns (Instance ID, Submitted At, Template Version) before field columns

**Playwright assertion:** parse downloaded CSV, assert exact header + per-row cell content.

**Maps to:** `tests/e2e/export.spec.ts`.

---

### S30 — CSV with removed field still appears as column for older instances (Tier 2)

Tests the "don't drop history" rule from G1.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template T with fields A, B
2. Submit instance I1 (both filled)
3. Edit T → remove field B
4. Submit instance I2 (only A available)
5. Export CSV

**Expected:**

- Header has both A and B columns (B comes from I1's snapshot which still includes it)
- I1's row populates both A and B
- I2's B cell is empty (B not in I2's snapshot)
- Removed-field columns appear after present-in-latest columns per G1 ordering

**Maps to:** `tests/e2e/export.spec.ts`.

---

## Three displayTypes — equivalence

### S31 — Single Select all three displayTypes submit identical instance (Tier 1)

Tests displayType is presentation-only, not data-shape. Selecting "Blue" via radio, dropdown, or tiles must store the same option ID.

**Preconditions:** localStorage clear.

**Steps:**

1. Build three templates differing ONLY in displayType:
   - T-radio: Single Select (Red, Blue, Green), displayType=`radio`
   - T-dropdown: same options, displayType=`dropdown`
   - T-tiles: same options, displayType=`tiles`
2. Fill each: pick "Blue"
3. Submit each
4. Read each instance's `values`

**Expected:**

- All three instances have `values: { color: "<id-of-blue>" }`
- Same option ID stored regardless of how UI presented the options
- Per-instance UI differs (visually radio/dropdown/tiles) but data shape is identical

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S32 — Single Select tiles support keyboard navigation (M2 a11y, Tier 2)

Tests tile-display a11y baseline.

**Preconditions:** localStorage clear, template with tiles-displayType Single Select.

**Steps:**

1. Open Fill mode
2. Tab into the tile group → first tile receives focus (focus-visible style)
3. Press `ArrowRight` → focus moves to next tile
4. Press `Space` → tile selected
5. Tab away from group → return via Shift+Tab → selected tile preserved

**Expected:** Keyboard nav matches radio-group behavior. Focus order is left-to-right, wrapping. Selection state persists across tab cycles.

**Playwright assertion:** `await page.keyboard.press('ArrowRight')`, then assert focused tile via `:focus` selector or `aria-checked`.

**Maps to:** `tests/e2e/fill.spec.ts`.

---

## File field — metadata-only enforcement

### S33 [Not automated] — File max_files boundary + allowedTypes case-insensitive (Tier 2)

Tests file validator edge cases per L1/L3 + decision-log file rules.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template with File field, `maxFiles=2`, `allowedTypes=['.pdf']`
2. Save → New Response
3. Attach `report.PDF` (uppercase ext) → **accepted** (case-insensitive match)
4. Attach `notes.pdf` → 2 files now, accepted
5. Attempt to attach 3rd file (any type) → **blocked** with inline error
6. Attempt to attach `image.jpg` (with maxFiles still at 1 of 2 used) → **blocked** with allowed-types error

**Expected:**

- Case-insensitive extension matching (REPORT.PDF matches .pdf)
- maxFiles enforced at boundary (3rd attachment rejected)
- Per-error message specifies which rule fired (max_files vs allowed_types)
- File metadata-only stored (no file content), per spec L2

**Maps to:** `tests/e2e/fill.spec.ts`.

---

## Persistence — load-time invariants

### S34 — Quarantine UI for invalid templates on load (Tier 1)

Tests load-time cycle re-validation per §2.

**Preconditions:** localStorage clear. Need access to the DevTools dock OR `page.evaluate` to inject malformed data.

**Steps:**

1. Inject a template with a condition cycle directly into localStorage. Example payload (simplified): two fields A, B, where A has `show if B=x` and B has `show if A=y` — produces A→B→A cycle when `findCycle` runs at load.
2. Reload page (or trigger `loadFromStorage`)
3. Open templates list

**Expected:**

- Template card shows quarantine badge: "⚠ Invalid conditional logic — open in builder to fix. New responses disabled."
- "New Response" button disabled
- Click "Edit" → builder opens, surfaces the cycle inline so user can fix

**Playwright assertion:** `await page.evaluate(() => localStorage.setItem('formBuilder', cyclicPayload));` then reload and assert quarantine badge testid.

**Maps to:** `tests/e2e/builder.spec.ts`.

---

### S35 — Future-version data throws cleanly (Tier 2)

Tests load-time defensive guards for forward-compat mismatch per §5.

**Preconditions:** localStorage clear.

**Steps:**

1. Inject `{ version: 999, templates: {}, instances: {} }` into localStorage
2. Reload page

**Expected:**

- App shows error UI / fallback ("Newer data version detected — please update")
- Doesn't crash
- Doesn't silently corrupt or downgrade data

**Maps to:** `tests/e2e/persistence.spec.ts` (new file) or extends `builder.spec.ts`.

---

### S36 — Malformed JSON falls back to empty state (Tier 2)

Tests load-time JSON parse failure recovery per §5.

**Preconditions:** localStorage clear.

**Steps:**

1. Inject `formBuilder = "{ this isn't json"` (raw broken JSON)
2. Reload page

**Expected:**

- App opens to empty templates list
- No error toast, no crash, no white-screen-of-death
- Console has logged warning per D1 fail-quiet rule

**Maps to:** `tests/e2e/persistence.spec.ts`.

---

## Real-world misuse — adversarial input

### S37 [Not automated]— Pasting formatted text into a Text field strips formatting (Tier 3)

Tests browser-native paste handling. Users paste from Word/web all the time.

**Preconditions:** localStorage clear, template with Text field.

**Steps:**

1. Open Fill mode
2. Set clipboard to rich-text content (HTML markup or RTF)
3. Paste into Text field

**Expected:**

- Stored value is plain text (no HTML, no formatting markup)
- React's `<input type="text">` and `<textarea>` strip formatting natively
- Submitted value matches what's visible in the input

**Playwright assertion:** use `page.evaluate(() => navigator.clipboard.writeText(html))` then `page.keyboard.press('Cmd+V')` and assert input value.

**Maps to:** `tests/e2e/fill.spec.ts`.

---

### S38 — Special characters in field labels survive round-trip (Tier 2)

Tests escaping across the entire data path: storage → render → PDF → CSV.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template with field labeled `Order #1, "priority" <test>`
2. Save → reload page → reopen builder
3. Open Fill mode → fill any value → submit
4. Open Instance view (label should display correctly)
5. Export CSV

**Expected:**

- Builder, Fill, Instance view all render the label correctly (no HTML injection, no double-escaping)
- PDF print region shows label correctly
- CSV header column escapes per RFC 4180: `"Order #1, ""priority"" <test>"`
- localStorage round-trip preserves the literal string (no normalization)

**Maps to:** `tests/e2e/builder.spec.ts` + `tests/e2e/export.spec.ts`.

---

### S39 — Browser back/forward across Builder → Fill → Submit → Instance (Tier 3)

Tests routing state consistency. Users hit Back/Forward without thinking; pages must rehydrate cleanly.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template, save (URL: `/templates/:id/edit`)
2. Click Preview (URL: `/templates/:id/fill`, with `state.from = 'builder'`)
3. Fill, submit (URL: `/instances/:id`)
4. Browser back button (multiple times)
5. Browser forward button

**Expected:**

- No "Cannot read property of undefined" errors in console
- Each page rehydrates correctly with its data
- Stores re-load from localStorage on each navigation
- Preview-mode badge appears/disappears correctly based on `location.state.from`

**Maps to:** `tests/e2e/golden.spec.ts`.

---

## Stress / performance

### S40 [Not automated] — Form with 50 fields renders without performance issue (Tier 3)

Tests engine + UI scale. Catches O(n²) issues hidden at small N.

**Preconditions:** localStorage clear.

**Steps:**

1. Programmatically build a template with 50 fields including:
   - 10 conditional dependencies (mixed Show/Hide effects across various target types)
   - 5 calculations referencing different sources
   - mix of all 9 field types
2. Save → New Response
3. Type a value into the first field

**Expected:**

- Initial fill-mode render < 200ms (measured via `performance.now()` before/after)
- Each value change propagates within ~16ms (60fps target)
- Engine `evaluate()` call < 5ms even at this size
- No "long task" warnings via `PerformanceObserver`

**Playwright assertion:**

```ts
const t = await page.evaluate(() => {
  const start = performance.now();
  // trigger an input change
  return performance.now() - start;
});
expect(t).toBeLessThan(50);
```

**Maps to:** `tests/e2e/fill.spec.ts` (or new `tests/e2e/perf.spec.ts`). Lower priority — adds Playwright complexity for marginal coverage at small project scale.

---

### S41 — Preview with unsaved changes prompts confirm dialog (Tier 1)

**Bug surfaced 2026-05-03:** clicking Preview with unsaved changes silently navigated to the _last saved_ template — not the in-memory canvas state — leaving the user confused why their latest edits didn't appear in preview. Fix: explicit confirm dialog ("Save & preview") that runs the full save flow (including cycle validation) before navigating. Cancel button preserves edits in builder. UX option B from the design discussion.

**Preconditions:** localStorage clear.

**Steps:**

1. Build template "Survey", add one field "Email", save → templates list shows "Survey, 1 field"
2. Click Edit on "Survey" to re-enter Builder
3. Add a new field "Phone" — `Unsaved changes` indicator appears
4. Click Preview
5. **Confirm dialog opens** — title `Unsaved changes`, two buttons: `Cancel` and `Save & preview`
6. Click Cancel → dialog closes, still in Builder, "Phone" field still on canvas, still dirty
7. Click Preview again, this time click `Save & preview`
8. Builder saves (cycle validation runs), navigates to Fill mode with `state.from = 'builder'`
9. Preview shows BOTH "Email" AND "Phone" fields (latest state)

**Expected:**

- Preview button does NOT navigate when dirty without confirmation
- Cancel preserves builder state, never persists
- Save & preview persists + navigates only if save succeeds (cycle blocks save → blocks navigation)
- If form is clean (`isDirty: false`), Preview navigates directly without dialog
- `[data-testid="preview-confirm-dialog"]` has `role="dialog"` and `aria-modal="true"` for a11y
- Cancel button is auto-focused for safety (avoid accidental save)

**Negative test (regression guard):**

- Build with cycle → click Preview → click Save & preview → save fails (cycle detected) → dialog closes, navigation blocked, inline cycle error visible in builder, error toast shown

**Maps to:** `tests/e2e/builder.spec.ts`. One Playwright `test()` titled `S41 — Preview with unsaved changes prompts confirm dialog`.

---

# Bugs caught during Codex final audit (2026-05-04)

Before submission I ran one more independent pass with OpenAI Codex over the implemented repo (not the plan). Codex's "would I ship this exact repo" verdict came back as *no, not without a fix pass* — engine and architecture passed cleanly, but a handful of implementation/doc drift items had crept in during the build that earlier reviews (which were plan-focused) couldn't catch. Two were code bugs worth scenario-ifying; two were doc drift fixes that don't need scenarios but are noted here for traceability.

## S42 — Templates list shows correct response counts after cold reload (spec compliance)

**Bug surfaced during Codex final audit 2026-05-04:** `TemplatesList` reads `useInstancesStore().instances` for the `{N} responses` card metadata, but only called `loadFromStorage()` on the templates store. The instances store starts empty and stays empty until the user navigates to a page that loads it (Fill, InstanceView). Net effect: on a cold reload of `/`, every card shows `0 responses` even when localStorage has dozens of submissions. This violates the spec line *"Each template card shows: title, number of fields, **number of filled instances**, last modified date"* and is the first thing a reviewer sees after refreshing the deployed link. Fixed in `src/pages/TemplatesList.tsx` by also calling `useInstancesStore().loadFromStorage()` in the mount effect.

**Preconditions:** localStorage seeded with one template `T1` having ≥2 submitted instances.

**Steps:**

1. Hard reload `/` (cold load — no prior in-session navigation).
2. Read the metadata line on `T1`'s card.

**Expected:**

- Card shows `N fields · 2 responses · Modified <date>` (not `0 responses`).
- Refreshing again does not change the count.

**Playwright assertion:**

```ts
await page.goto('/');
const meta = await page.getByTestId(`template-meta-${t1.id}`).textContent();
expect(meta).toContain('2 responses');
```

**Maps to:** `tests/e2e/builder.spec.ts`. One Playwright `test()` titled `S42 — Templates list response count survives cold reload`.

---

## S43 — Date field `prefillToday` respects local timezone, not UTC

**Bug surfaced during Codex final audit 2026-05-04:** `src/fields/date/index.tsx` was using `new Date().toISOString().slice(0, 10)` for the `prefillToday` default. `toISOString()` returns the UTC date, which differs from the user's local date for a non-trivial slice of every day (in IST, midnight–05:30 local; in PST, 16:00–23:59 local). A US-Pacific reviewer opening the deployed link in the late afternoon would see "today" prefilled as *tomorrow's* date — a visible off-by-one. Fixed by constructing `YYYY-MM-DD` from `getFullYear/getMonth/getDate` (local) instead of `toISOString`.

**Preconditions:** Field with `type: 'date', prefillToday: true`. Browser clock and timezone such that local date ≠ UTC date (e.g., set system timezone to PST and run between 16:00 and 23:59 local).

**Steps:**

1. Open Fill mode for the template.
2. Read the date field's prefilled value.

**Expected:**

- Prefilled value matches the user's local date, not UTC.

**Playwright note:** harder to assert deterministically because Playwright inherits the host clock/TZ. The cheap regression guard is a unit test pinning `Date.now()` and `Intl.DateTimeFormat().resolvedOptions().timeZone` via `vi.setSystemTime` and a TZ shim, asserting the formatter returns local-date components. Manual scenario kept here for the cross-browser verification path.

**Maps to:** `src/fields/date/date.test.ts` (unit) — primary guard. Manual repro across timezones — secondary.

---

## Doc drift fixes (no scenario needed)

Two doc-code drift items Codex flagged were straight documentation fixes:

- **README future-version claim trimmed.** The `localStorage schema` section had said *"Future-version data throws a recoverable error surfaced in the UI."* In reality `load()` throws, the throw is logged, and we fall back to empty state — there's no UI surfacing wired up. README updated to match: *"throws on load (logged, falls back to empty state — surfacing as a toast/banner is on the polish list)."* The toast/banner work is a real candidate for the *What I'd do with more time* list.
- **AI_USAGE_LOG.md path precision.** Line 18 referenced `decision-log.md` and `TYPES_PROPOSAL.md` without the `docs/planning/` prefix. Updated to the full paths so an interviewer following the link doesn't have to guess.

## Items intentionally not fixed in this pass

For traceability — Codex also flagged these; conscious scope calls to defer:

- **`deleteField` doesn't strip stale conditions/calc sources** (`src/pages/Builder.tsx`). The confirm dialog says *"Other fields reference this field. Delete anyway?"* which the user accepts before delete proceeds — the orphaned references are recoverable (engine treats absent targets as `false` per operator semantics, so dependent fields default to hidden rather than firing wrongly). Not a correctness hole, but a polish item.
- **Save-time validation is cycle-only.** `handleSave` in Builder doesn't block calc-with-no-sources, `min > max`, empty labels, or `maxSelections < minSelections`. Each is a real validation gap; the right fix is per-field-type config validators wired into the same save guard. Logged for the polish list.
- **Quota-exceeded toast.** `save()` calls `localStorage.setItem` directly. A `QuotaExceededError` would propagate as an unhandled exception. Real risk only at large file-attachment counts; deferred.
- **DevTools UI ships in production.** Intentional — the floating menu and dock are useful for an interviewer wanting to inspect localStorage directly on the deployed link. Documented as a feature, not a debug surface.

---

## Future / reserved

When you find a manual bug not covered by S1–S41, append a new scenario in this section, fix the bug, then add to Playwright. Keeps the test suite a living spec, not a frozen snapshot.
