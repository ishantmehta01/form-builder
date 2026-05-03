# Completion Prompt — Form Builder Gap Fill

> Paste everything below the `---` line into a fresh Claude Code session in `/Users/ishantmehta/Desktop/work/form-builder`. Run with `/model sonnet` and `/effort high`. Do NOT use Opus.
>
> This is a **gap-fill follow-up** to the original `ImplementationPrompt.md`. The previous session built the project in 22 minutes and produced a real engine + UI but skipped most non-engine tests, the P1 instance-lifecycle test, polish features, and left a `tsc -b` build-config bug. This prompt fills those gaps to bring the project to the original 100% spec.

---

## Context

The codebase already exists. Read these to understand current state, **do not re-implement**:

1. **`assignment.pdf`** — the spec
2. **`TYPES_PROPOSAL.md`** — locked architecture (engine signature, registry contract, Instance schema)
3. **`decision-log.md`** — locked decisions (A1 conditionLogic per-effect-group, A2 hidden value handling, A5 topological evaluation, A6 operator semantics, B2 dropped, etc.)
4. **`ImplementationPrompt.md`** — the original full-build plan you are now completing
5. **`PROGRESS.md`** — the previous run's log

## What is already done (verified 2026-05-03)

- ✅ Scaffold: Vite + React 19 + TS strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes), Vitest, Tailwind v4, Zustand, @dnd-kit, React Router v7
- ✅ Types (TYPES_PROPOSAL §1–§6 translated): `field.ts`, `condition.ts`, `template.ts`, `storage.ts`, `registry/contract.ts`
- ✅ Engine: `evaluate.ts`, `validateForm.ts`, `graph.ts`, `operators.ts` — pure, two-pass, topological with effective-value stripping
- ✅ Engine tests: 115 unique tests passing — operators (66), evaluate (26 incl. cascade, B2-dropped, cycle defense, empty-group, precedence), graph (11), validateForm (5)
- ✅ Storage: `load.ts`, `save.ts`, `migrations.ts` + 7 tests
- ✅ All 9 field-type modules: text, textarea, number, date, single_select, multi_select, file, section_header, calculation (real implementations, 56–158 LOC each, registered in mapped Registry)
- ✅ UI: `Builder.tsx` (492 LOC, three-panel + DnD), `Fill.tsx` (162 LOC), `InstancesList.tsx`, `InstanceView.tsx`, `TemplatesList.tsx`
- ✅ Stores: `templates.ts`, `instances.ts` (Zustand)
- ✅ CSV: `lib/csv.ts` — union-of-snapshots, capturesValue filter, RFC 4180 escaping, blob download
- ✅ PDF: `InstanceView.tsx` print-region + `lib/pdf.css` `@media print` + `@page` margin boxes with Safari caveat comments
- ✅ AffixedInput shared primitive (per C1)
- ✅ `npm run typecheck` clean, `npm run build` clean

## What is NOT done — your work

**The previous session skipped all of these.** Implement them, in order, with checkpoints. Use the same PROGRESS.md continuous-logging discipline as the original prompt.

---

## Phase G0 — Build config fix (5 min)

`tsc -b` is leaking 41 compiled `.js` files into `src/` alongside the `.ts` sources. Tests run twice as a result (115 unique × 2 = 230 reported). Fix:

1. Inspect `tsconfig.json` — likely has `composite: true` without a separate `outDir`, OR the build script runs `tsc -b` without `--noEmit`
2. Either:
   - Change `npm run build` from `tsc -b && vite build` to `tsc --noEmit && vite build` (Vite handles transpilation; tsc only needs to typecheck)
   - OR add `outDir: "./dist-tsc"` and gitignore it
3. Delete all leaked `.js` files from `src/`: `find src -name "*.js" -not -name "*.config.js" -delete`
4. Verify: `npm test -- --run` should now show **5 test files** (not 10) and **115 tests** (not 230)
5. Verify: `npm run build` should still pass
6. Add `*.js` (under src/) to `.gitignore` if not already

**Checkpoint:** test count is honest, build still clean. Log to PROGRESS.md.

---

## Phase G1 — P1 instance-lifecycle test (15 min)

The headline P1 test from the original prompt is **missing**. This is the most important gap — it verifies the calc-preserved-on-redownload bug fix.

Create `src/engine/instance.test.ts` (or extend `evaluate.test.ts`):

**Test 1: Calc value preserved on re-render.** Build a template with Number A, Number B, Number C, Calc T = sum(A, B, C). Add a condition on C: hide if some trigger. Set rawValues = { A: 10, B: 20, C: 30, trigger: hide-value }. Run `evaluate()` to get computedValues + visibility. Build the *expected submitted instance*: `{ values: filter({ ...rawValues, ...computedValues }, visibility), visibility }`. Assert `instance.values.T === 60` (NOT 30 — the at-submit total is preserved). This is what fixes the re-download bug.

**Test 2: Visibility map round-trips.** Same template. Submit. Iterate template.fields; for each field assert `instance.visibility[id]` matches the engine's at-submit map.

**Test 3: Visible-but-empty distinguishable from hidden.** Submit with one optional field left empty (visible) and one field hidden by condition. Iterate template snapshot using `instance.visibility`:
- Hidden field: `visibility[id] === false` → not in iteration result
- Visible-empty field: `visibility[id] === true` && `id not in values` → renders `—` per E2

**Checkpoint:** P1 test passes. Log to PROGRESS.md.

---

## Phase G2 — Per-field validator tests (45 min)

`src/fields/<type>/<type>.test.ts` for each of the 9 field types. Test the validator function from each module against config + value combinations. Required cases per type:

- **text / textarea:** required-empty produces `'required'` error; min_length / max_length boundary cases (under, exact, over); empty optional value produces no error
- **number:** required-empty error; min/max boundary (decimal places matter — value 99.9, decimalPlaces 0, max 99 → fails on 99.9 raw, not rounded 100); invalid input (non-numeric string) handled
- **date:** required-empty; min/max date boundaries (lex compare on YYYY-MM-DD); invalid date string handled
- **single_select:** required-empty; value must be an option ID present in config.options
- **multi_select:** required-empty; min_selections / max_selections boundary; value must be subset of option IDs
- **file:** required-empty; max_files boundary; allowed_types boundary (extension match, case-insensitive)
- **section_header:** validator should be a no-op (returns `[]`) — assert this
- **calculation:** validator should be a no-op (read-only, never user-input) — assert this

Use vitest's `describe.each` / `it.each` for table-driven where it reduces noise.

**Checkpoint:** all 9 field validator suites pass. Log per-type counts to PROGRESS.md.

---

## Phase G3 — Field renderer + config editor smoke tests (30 min)

For each of the 9 field types, write minimal smoke tests in the same per-type test file. Use `@testing-library/react` (install if missing). For each:

- **Renderer renders without error** with a valid config + value
- **Renderer fires `onChange` with correctly typed value** when user interacts (use `fireEvent` or `user.type`)
- **Renderer marks required state visibly** when `isRequired: true` (asterisk OR aria-required="true")
- **ConfigEditor renders without error** with default config
- **ConfigEditor fires `onChange` with updated config** when user modifies a field

Don't test every config option — that's overkill. Smoke level only.

**Special cases:**
- Single Select: assert all three displayTypes render (radio, dropdown, tiles)
- Multi Select: assert min/max selection enforcement at UI level
- File: assert metadata-only handling (no actual upload)
- Section Header: assert correct heading level per size (per H4: XS+S → h4, M → h3, L+XL → h2)
- Calculation: assert read-only / disabled rendering, value styled as computed (per H5)

**Checkpoint:** all renderer + configEditor smoke tests pass. Log to PROGRESS.md.

---

## Phase G4 — CSV serialization tests (20 min)

Create `src/lib/csv.test.ts`. Test cases per decision-log G1:

- **Union of snapshots:** 3 instances with different snapshots (one removed field after instance 2, one renamed label after instance 1). Assert columns = union, deduped by ID, ordered by latest snapshot position with removed-fields appended.
- **Renamed field uses latest label** in header row
- **Field removed from current template still appears** as a column for older instances
- **Hidden fields → empty cell** (not skipped row)
- **Visible-but-empty → empty cell**
- **Per-type serialization:**
  - Text with comma → wrapped in quotes per RFC 4180
  - Text with embedded quote → quote escaped as `""`
  - Text with newline → wrapped in quotes
  - Number → numeric string with configured decimal places
  - Date → `YYYY-MM-DD`
  - Single select → option label (not ID)
  - Multi select → pipe-separated `Apple|Banana`
  - File → pipe-separated filenames
  - Section header → no column (capturesValue: false, skipped)
  - Calculation → numeric string with configured decimal places
- **Empty instances list** → empty CSV (not crash, not malformed)

**Checkpoint:** CSV tests pass. Log to PROGRESS.md.

---

## Phase G5 — PDF rendering tests (20 min)

PDF can't be tested visually in vitest, but the print-region rendering can be:

Create `src/pages/InstanceView.test.tsx`. Use `@testing-library/react` to render the InstanceView with a known instance + snapshot. Assert:

- **Print region exists** (`#print-region` div present in the DOM)
- **Form title in print region** (h1 with template title)
- **Submission timestamp** present
- **Hidden fields not rendered** in print region (use a template with one hidden-by-condition field; assert its label is not in the print region)
- **Visible-but-empty fields render `—`** placeholder (per E2)
- **Section Headers preserve heading hierarchy** in PDF region (per K1 — XS/S → h4, M → h3, L/XL → h2)
- **Multi-select displays comma-separated** in PDF (per K3 — `Banana, Mango, Apple`, not bulleted)
- **Calculation displays computed value** with decimal places (no formula, per K5)

You CANNOT test the actual `window.print()` invocation in vitest. Document that as a manual-test caveat in PROGRESS.md.

**Checkpoint:** InstanceView print-region tests pass. Log + manual-test reminder. Log to PROGRESS.md.

---

## Phase G6 — Builder UI integration tests (30 min)

Create `src/pages/Builder.test.tsx`. Required cases:

- **Add field from left panel** → appears on canvas, auto-selects (per F2)
- **Click field on canvas** → right panel shows config editor for that field type
- **Edit field config** → state updates (verify via store assertion)
- **Save with valid template** → calls store's save, navigates to templates list
- **Save with invalid config blocked** (per I3): min > max, calc with no sources, max selections > options count → save button disabled or shows inline error
- **Cycle detection on condition save** (per A3 cycle blocking): build a template with two fields, add condition A→B, then try to add B→A; assert save is blocked with error message containing "loop" or "cycle"
- **Field deletion with dependents** (per B3/D3): delete a field referenced by another field's calc source or condition target → confirmation modal appears listing dependents
- **DnD reorder** (smoke level — full DnD interaction is hard to unit-test): assert that the canvas uses `<SortableContext>` from @dnd-kit; that's enough confidence for the rubric

**Checkpoint:** Builder UI tests pass. Log to PROGRESS.md.

---

## Phase G7 — Fill mode integration tests (30 min)

Create `src/pages/Fill.test.tsx`. Required cases:

- **Renders all fields per template order** (loop through fields, assert each label is in the DOM)
- **Hidden field via condition not rendered** initially (build a template with default-hidden field; assert not in DOM; trigger the condition; assert appears)
- **Calc field updates in real-time** as source values change
- **Required field validation on submit**: submit empty → required error appears below field; fill in → error clears
- **Hidden required field not validated** (per A2): build template with required-but-hidden field; submit → no error
- **Submit success persists Instance** with `values` + `visibility` (verify via instances store)
- **Submit strips hidden values** from persisted instance per A2

**Checkpoint:** Fill UI tests pass. Log to PROGRESS.md.

---

## Phase G8 — Templates list + load-time validation (15 min)

Create `src/pages/TemplatesList.test.tsx`:

- **Lists all templates** with title, field count, instance count, last-modified date
- **Quarantined template** (one with cycles in conditions, written directly to localStorage) shows quarantine UI per §2 load-time validation: invalid badge, "New Response" disabled, message "Open in builder to fix"
- **New Response button disabled on empty templates** (per I3)
- **Cascade delete confirmation** (per D3): clicking delete on a template with N instances shows modal mentioning instance count

**Checkpoint:** Templates list tests pass. Log to PROGRESS.md.

---

## Phase G9 — Polish features audit (20 min)

These were in the original prompt but the previous session may not have implemented them. **Verify each is present; if missing, implement.**

1. **Single-source / can-become-hidden calc warning** (per B2 + TYPES_PROPOSAL §7 caveat): in Builder's calc config editor, if the source list contains any field with `defaultVisible: false` or any Hide condition attached, show inline warning: *"This calc may expose source values when sources are hidden. Consider hiding the calc with the same condition."*
2. **`beforeunload` warning** (per F1): in Builder, if there are unsaved changes, `window.beforeunload` returns a string to trigger the browser's "leave page?" prompt
3. **Section Header semantic heading levels** (per H4): verify the renderer uses `<h2>` for L+XL, `<h3>` for M, `<h4>` for XS+S — NOT just font-size on a `<div>`
4. **Date `prefillToday`**: when a new instance is opened and a Date field has `prefillToday: true`, the value is set to today's `YYYY-MM-DD`
5. **A11y baseline** (per M2): every input has a `<label>` (or aria-label); required fields have `aria-required="true"`; errors use `aria-describedby` to link to their messages; tile-display Single Select supports keyboard nav (arrow keys + space); focus-visible styles on all interactive elements
6. **AffixedInput shared between Text and Number** (per C1): verify both renderers wrap an `<AffixedInput>` instead of duplicating affix logic
7. **Conditional UI in Number config editor**: decimalPlaces dropdown, min/max numeric inputs, prefix/suffix text inputs all functional

For each, log to PROGRESS.md whether it was already done or you implemented it. Be honest.

**Checkpoint:** all 7 polish items present and working. Log to PROGRESS.md.

---

## Phase G10 — README + final polish (30 min)

Check if `README.md` exists. If not, create it. If yes, audit it.

Required sections (concise — 5–7 architectural decisions, one paragraph each, NOT the full decision log):
- **How to run locally** (`npm install`, `npm run dev`)
- **localStorage schema** — single key (`formBuilder`), shape `{ version, templates, instances }`, why versioned + migration framework
- **Conditional logic** — AND/OR per-field with deterministic precedence (Hide > Show, Not-Required > Required); operator semantics on absent values (uniform false); cycle blocking at save + load + engine fallback
- **Engine model** — two-pass: calc then conditions in topological order with effective-value stripping; cite the cascade fix
- **Snapshot semantics** — instances carry templateSnapshot for historical fidelity; CSV uses union-of-snapshots
- **PDF strategy** — browser-native `window.print()` + `@media print` stylesheet; constraints (Safari `@page` quirks, no "Page X of Y" promise)
- **Registry pattern** — mapped type pins each FieldType key to its module; adding an 11th field type is ~5 type-definition touch points, not 6 scattered surgeries
- **What I'd improve with more time** — distill from decision-log §N: versioned templates, autosave + drafts, expanded condition AND/OR groups, axe a11y audit, Playwright E2E

Run `npm run typecheck` + `npm test -- --run` + `npm run build` one final time. All clean.

**Do NOT touch `AI_USAGE_LOG.md`** — that's the user's deliverable in their voice.

**Checkpoint:** README written/audited, final test sweep clean. Log to PROGRESS.md.

---

## Hard rules (same as original prompt)

- **Never `cd` outside** `/Users/ishantmehta/Desktop/work/form-builder`
- **Never `git commit`, `git push`, `rm -rf`, `sudo`** — even with permissions
- **Never modify** `~/.claude/`, `/etc/`, or any system directory
- **Never touch** `AI_USAGE_LOG.md`
- **Never deviate** from TYPES_PROPOSAL.md / decision-log.md without logging it to PROGRESS.md
- **If stuck** after 3 honest attempts: log a `⚠️ BLOCKER` entry to PROGRESS.md and continue to the next phase. Do not stall.

## PROGRESS.md continuous logging

Append entries as you work, same format as the previous run:

```markdown
## 2026-05-03 HH:MM — Phase G0: Build config fix
Removed tsc -b output leak from src/. Build script now `tsc --noEmit && vite build`. Deleted 41 compiled .js files. `npm test` reports 5 files, 115 tests (was 10/230 due to .js shadows). Build still clean.

## 2026-05-03 HH:MM — Phase G1: P1 instance-lifecycle test
Added src/engine/instance.test.ts with 3 tests: calc preserved on re-render, visibility map round-trip, visible-but-empty vs hidden. Cascade scenario: A=10, B=20, C=30 (hidden), T=sum=60. Assert instance.values.T === 60, not 30. Pass.
```

## End-of-run summary

When all 11 phases (G0–G10) complete, append a `## ✅ COMPLETION SUMMARY` entry to PROGRESS.md:
- Phases completed
- Phases partial (with reasons)
- Test status: file count, test count, pass/fail
- Typecheck + build status
- Any blockers logged
- What the user should review first

Then stop. Don't wait for input.

---

## Estimated time

3–5 hours of agent-clock for G0–G10 if everything goes smoothly. The test work is mechanical (table-driven), the polish audit may surface 1–3 missing items requiring real implementation. Per-phase wall-clock: G0 (5m), G1 (15m), G2 (45m), G3 (30m), G4 (20m), G5 (20m), G6 (30m), G7 (30m), G8 (15m), G9 (20m), G10 (30m) = ~4 hours of focused work + tool/test latency overhead.
