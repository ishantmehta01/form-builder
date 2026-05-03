# Implementation Prompt — Form Builder

> Paste everything below the `---` line into a fresh Claude Code session running in `/Users/ishantmehta/Desktop/work/form-builder`. Use **Sonnet** (default Sonnet for muscle work, switch to high-effort Sonnet for the engine phase). Do NOT use Opus — the design is locked, only execution remains.

---

> **Note from prior planning session:** All planning cleanups + two rounds of Codex review applied to `TYPES_PROPOSAL.md` and `decision-log.md`. Highlights:
>
> - **§4 Instance schema** carries `visibility: Record<string, boolean>` and stores computed calc values explicitly. **No engine call on re-render** — PDF/CSV/instance view iterate fields and use stored visibility map directly. (Fixes calc-loses-value-on-redownload bug; see lifecycle paragraph in §4.)
> - **§7 engine** uses topological evaluation with effective-value stripping (cascade fix). Empty effect groups are inactive (`length > 0 && combine(...)` guard — never `[].every` directly). Cycle defense at runtime returns all-default visibility/required, never throws.
> - **§2 validation rules** include load-time cycle re-validation; invalid templates are quarantined.
> - **B2 (decision-log)** dropped: calc aggregates over all sources regardless of source visibility. Builder warning rule expanded to any source that _can become hidden_ (defaultVisible:false OR has any Hide condition attached).
> - **Other locked items:** F3 DnD = @dnd-kit + KeyboardSensor + up/down fallback; E1 PDF spike _before_ UI scaffolding; line 244 prose = Zustand; line 248 migration type = `(data: unknown) => unknown`; A1 conditionLogic is per-effect-group, not global; A6 operator semantics on absent values = uniform false.
>
> All architectural decisions are locked. Start at Phase 0.

## Context — read these first, in order

You are picking up a frontend take-home assignment that has been extensively planned. **Do not redo the planning.** Read these four files to understand the locked architecture:

1. **`assignment.pdf`** — the spec. 10 field types, 2 modes (Builder + Fill), conditional logic, calculations, browser-native PDF export, localStorage persistence. React + TypeScript, no `any`, no third-party PDF libraries.
2. **`TYPES_PROPOSAL.md`** — **signed-off type model + registry contract + engine signature.** This is your spec for the engine. §7 is the source of truth for `evaluate` and `validateForm`. Do not invent types — translate what's in this file.
3. **`decision-log.md`** — full architectural decisions. Pay attention to A1 (AND/OR per-field, Hide > Show, Not-Required > Required precedence), A2 (preserve hidden values during fill, strip at submit), A3 (forward refs allowed, **cycles blocked at builder save**), A5 (two-pass: calc then **topological-with-effective-values** condition pass), A6 (operator semantics — uniform "absent → false"), B2 (**dropped** — calcs aggregate over all sources regardless of source visibility), C3 (date as `YYYY-MM-DD` strings), D1/D4 (single-key localStorage, snapshot semantics), G1 (**CSV columns = union of all instance snapshots**), I3 (block save on invalid config), K2 (no "Page X of Y" promise — Safari unreliable).
4. **`feedback.md`** — earlier round of decisions to apply. Already reflected in TYPES*PROPOSAL.md and decision-log.md, but useful for understanding the \_why* on a few choices.

There is also a `CODEX_REVIEW_PROMPT.md` in the repo — that's an earlier review artifact, you can skim it if curious but the changes are already merged.

## What you are not doing

- **Plan review.** Done. Don't re-litigate the architecture.
- **AI usage log.** The user writes `AI_USAGE_LOG.md` themselves in their voice — that's part of the take-home grading and intentionally not delegated. Don't create or edit this file unless explicitly asked.
- **Architectural changes.** If you find yourself wanting to deviate from TYPES_PROPOSAL.md or decision-log.md, **stop and ask the user**. The spec is locked.

## Working mode

- The user is a Principal Engineer (11+ years frontend). Treat them as a senior peer, not a beginner.
- Tight responses. Lead with code for technical questions, explain second.
- Push back if you disagree with something. Don't rubber-stamp.
- If you produce logic-heavy code (engine math, types, condition evaluation), explicitly tell the user what to verify and how.
- Default Sonnet effort for scaffolding/types/UI. Switch to **high effort** when implementing `evaluate` and writing engine tests — that's where subtle bugs hide.

## Stack — locked

- **Vite + React 19 + TypeScript** (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
- No `any`. Use `unknown` + narrowing when needed.
- **Vitest** for unit tests
- **Zustand** for state (templates, instances, builder UI state)
- **Tailwind** for styling
- **@dnd-kit** for drag-and-drop (with KeyboardSensor for accessibility)
- **React Router v7** for navigation

Routes:

- `/` — Templates list (home)
- `/templates/new` — Builder (new template)
- `/templates/:templateId/edit` — Builder (edit existing)
- `/templates/:templateId/fill` — Fill mode (new instance)
- `/templates/:templateId/instances` — list of submitted instances for a template
- `/instances/:instanceId` — view a submitted instance + re-download PDF

## Permissions setup (Phase 0 — do this first, before scaffolding)

**The user has authorized full autonomy for this build inside the form-builder folder only.** They want to sleep while you work. Set up permissions so you don't pause for every command, but stay strictly within the project folder.

**Step 1.** Create `.claude/settings.local.json` in the form-builder folder with the contents from Appendix A.1. This auto-approves dev-tooling commands and explicitly denies destructive operations (rm, git commit, git push).

**Step 2.** Confirm working directory before every Bash call. **Never `cd` out of `/Users/ishantmehta/Desktop/work/form-builder`.** Never write files outside this folder. Never modify anything in `~/.claude/`, `/etc/`, or any system directory.

**Step 3.** Even with auto-approval, do NOT run:

- `git commit` / `git push` (user will commit at their own pace)
- `rm -rf` of anything you didn't create yourself
- `sudo` of anything
- Network calls beyond `npm install` (no curl, no fetch to external services)

If a tool you need isn't covered by the allow-list, log it to `PROGRESS.md` (see "Stuck recovery protocol" below) and continue with what you can do.

## Phased execution — checkpoint after each phase

**The user can step away between phases.** At each checkpoint, summarize what landed, run the relevant verification command, and wait for approval before moving to the next phase.

---

### Phase 1 — Scaffold (~15 min)

Set up the project:

1. `npm init -y` then install React 19, TypeScript, Vite, Vitest, Tailwind, Zustand, @dnd-kit/core, @dnd-kit/sortable, react-router-dom@7
2. Create `vite.config.ts`, `tsconfig.json` (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes), `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css` (with Tailwind directives)
3. Folder layout:
   ```
   src/
     types/           # types.ts (from TYPES_PROPOSAL §1–§6)
     engine/          # evaluate.ts, validateForm.ts, graph.ts, operators.ts
     storage/         # load.ts, save.ts, migrations.ts
     registry/        # contract.ts, index.ts (registry map), and per-field-type folders later
     fields/          # one folder per field type — text/, number/, date/, etc. each exports a FieldTypeModule
     stores/          # zustand stores
     pages/           # route components
     components/      # shared components (AffixedInput, etc.)
     lib/             # csv.ts, pdf.ts, utils.ts
   ```
4. Add npm scripts: `dev`, `build`, `test`, `test:watch`, `typecheck` (`tsc --noEmit`)
5. Verify: `npm run dev` opens, `npm run typecheck` passes, `npm test` runs (zero tests, no failures)

**Checkpoint:** show the user `npm run typecheck` output and a screenshot or note that dev server starts. Wait for approval.

---

### Phase 2 — Types (~30 min)

Translate TYPES_PROPOSAL.md §1–§6 into `src/types/` files. Split sensibly:

- `src/types/field.ts` — `FieldType`, `BaseFieldShared`, `RequirableFieldBase`, all per-type field interfaces, `Field` discriminated union, `SelectOption`, `FileMetadata`
- `src/types/condition.ts` — `Effect`, `ConditionMeta`, `Condition` (operator-discriminated union), `ConditionOperator`, `ValidatorContext`, `ValidationError`
- `src/types/template.ts` — `Template`, `Instance`, `Values`
- `src/types/storage.ts` — `StoredData`, `Migration`, `Migrations`, `CURRENT_VERSION`
- `src/registry/contract.ts` — `FieldTypeModule<F>`, `FieldRendererProps<F>`, `ConfigEditorProps<F>`, `Registry` (the **mapped type** from §6, not `Record<>`)

Verify with `npm run typecheck`. Fix any strict-mode complaints. Don't add `any` to silence errors — use `unknown` and narrow.

**Checkpoint:** show typecheck passing. Wait for approval.

---

### Phase 3 — Engine (~90 min, **bump effort to high**)

Implement the engine per TYPES_PROPOSAL.md §7. **Pure functions, no React imports.**

**`src/engine/operators.ts`** — one function per `ConditionOperator`. Signature:

```ts
function evaluateOperator(condition: Condition, targetValue: unknown): boolean;
```

Implement per **decision-log A6**:

- Absent target → `false` uniformly (across all operators)
- Text: trim + case-insensitive
- Number: raw value, not rounded
- `number_within_range`: inclusive on both ends
- Select: option-ID comparison
- Multi-select: `multi_contains_none` is `false` if target absent (per uniform rule), else true if intersection is empty
- Date: lex compare on `YYYY-MM-DD`

**`src/engine/graph.ts`** — dependency graph + topological sort + cycle detection.

- `buildConditionGraph(template: Template): Map<fieldId, Set<fieldId>>` — edges target → owner
- `topologicalSort(graph): fieldId[]` — Kahn's algorithm
- `findCycle(graph): fieldId[] | null` — for builder-save validation; returns the cycle path or null

**`src/engine/evaluate.ts`** — the main engine.

```ts
export function evaluate(
  rawValues: Values,
  template: Template,
  registry: Registry,
): EngineResult;
```

- Pass 1: iterate `template.fields`, for each `CalculationField` compute the aggregate over `sourceFieldIds` using raw values (no visibility filter — B2 dropped). Filter `Number.isFinite`. Empty result → omit from `computedValues`. Write to `computedValues`.
- Pass 2: `effectiveValues = { ...computedValues }`. Topologically sort the condition graph. For each field in topo order:
  - Evaluate each condition's operator against `effectiveValues[targetId]` (which is `undefined` if hidden upstream — that's the absent case)
  - Group by effect type. Combine with field's `conditionLogic` (AND/OR).
  - Resolve cross-effect: Hide wins over Show, Not-Required wins over Required.
  - No matching rules → fall back to `defaultVisible` / `defaultRequired`.
  - For Section Header / Calculation, `required` always `false`.
  - If hidden, **delete** `effectiveValues[fieldId]`.
- Stale-condition defense: if `targetId` missing or operator namespace doesn't match target type, skip the condition silently (log if you want).
- Return `{ computedValues, visibility, required }`.

**`src/engine/validateForm.ts`** — per TYPES_PROPOSAL.md §7.

```ts
export function validateForm(
  template,
  values,
  engineResult,
  registry,
): Record<string, ValidationError[]>;
```

- Iterate `template.fields`
- Skip if `registry[field.type].capturesValue === false`
- Skip if `engineResult.visibility[field.id] === false`
- Otherwise call `registry[field.type].validator(values[field.id], field.config, { isRequired: engineResult.required[field.id] })`
- Collect errors; only include fields with `errors.length > 0` in the result

**Checkpoint:** show `npm run typecheck` passes. No tests yet — they're next phase. Wait for approval before writing tests.

---

### Phase 4 — Engine tests (~60 min, **stay on high effort**)

Write Vitest tests in `src/engine/*.test.ts`. **Table-driven where possible.** Required cases:

**`operators.test.ts`:**

- Each operator with valid input, expected output
- Each operator with absent target → `false`
- Text equals/contains: trimming + case sensitivity
- `number_within_range`: inclusive endpoints
- `number_gt`: raw value not rounded (build a Number field with `decimalPlaces: 0`, user value 99.9, condition `> 99.9` → false)
- `multi_contains_none` with empty selection (absent) → false; with non-empty selection that doesn't intersect → true
- `date_before`/`after` with lex compare

**`graph.test.ts`:**

- `buildConditionGraph` produces correct edges
- `topologicalSort` returns valid order
- `findCycle` detects A→B→A; returns null for DAG; finds longer cycles A→B→C→A

**`evaluate.test.ts`:**

- **Calc with all-empty sources** → calc value omitted from `computedValues`
- **Calc with mixed visible/hidden sources** — B2 dropped, calc aggregates over all (3 sources, hide one via condition, calc is still sum of all 3). This is the test that proves B2 is dropped.
- **Single-source calc** → calc value equals source (just confirming behavior, not testing "leakage")
- **AND combination** — two conditions, both must match
- **OR combination** — two conditions, either matches
- **Hide-wins precedence** — Hide rule + Show rule both fire → Hide wins
- **Not-Required-wins** — Require rule + Not-Required rule both fire → Not-Required wins
- **Cascade test (the Codex bug)** — A controls B's visibility, B's value controls C's visibility. Set A=hide-trigger, set B=value-that-would-show-C. Without effective-value stripping, C stays visible (BUG). With stripping, C should hide. **This test must pass — it's the headline correctness test.**
- **Forward references** — condition target appears later in `template.fields` array; engine still resolves correctly via ID lookup
- **Deep chain** — A → B → C → D, four levels, each visibility controlled by previous
- **Default fallback** — field with no matching conditions falls to defaultVisible/defaultRequired
- **Calc-as-condition-target** — calc value drives a condition, condition fires correctly
- **Stale condition** — condition with non-existent targetId → skipped, no throw
- **Section Header `required` always false** — even if a condition tries to mark it required
- **Empty effect groups are inactive (P4)** — field with zero Hide conditions is NOT hidden by vacuous-truth `[].every(...)`. Build a field with `defaultVisible: true`, `conditionLogic: 'AND'`, no conditions at all → assert visibility is `true`. Build another with one Show condition that doesn't match and zero Hide conditions → assert visibility falls back to `defaultVisible`, NOT to "Hide fires because empty group".
- **Cycle defense (P3)** — feed a known-cyclic template (A→B→A) directly to `evaluate` (bypassing builder validation). Assert: engine does NOT throw; returns `EngineResult` with all `visibility[id] = field.defaultVisible` and `required[id] = field.defaultRequired ?? false`; `computedValues` from Pass 1 preserved; cycle was logged.
- **Conditional logic per-effect-group (P4)** — field with two Show conditions (combined AND) and one Hide condition. Build a case where Show-AND fails but Hide fires → field hidden. Build another where Show-AND succeeds and Hide doesn't fire → field visible. The single Hide is its own group regardless of conditionLogic.

**`validateForm.test.ts`:**

- Field hidden → not validated even if required
- Section Header skipped
- Required-empty produces `'required'` error
- Multiple errors per field (e.g., required + min_length both fire)
- Returns sparse map (no entry for valid fields)

**`storage.test.ts` / load-time validation:**

- **Cycle re-validation on load (P3)** — write a template containing A→B→A directly into localStorage, call `load()`, assert: template is flagged invalid / quarantined; "New Response" is disabled in UI; engine fallback path also kicks in if the template is somehow opened.
- Round-trip: save then load returns equal data
- Future-version data throws
- Empty localStorage returns empty state

**`instance.test.ts` (instance lifecycle, P1):**

- **Calc value preserved on re-render** — submit a form where T = sum(A, B, C) with C hidden. Assert `instance.values.T` equals the at-submit total (e.g., 60), not the recomputed-on-load total (which would be 30 if engine were called on re-render). Render the instance — total still shows 60.
- **Visibility map round-trips** — load instance, iterate fields, confirm `visibility[id]` returns the same boolean as at submit.
- **Visible-but-empty distinguishable from hidden** — submit with one optional field left empty (visible) and one field hidden by condition. Assert PDF/CSV iteration: empty field renders `—` (E2), hidden field is skipped entirely.

**Checkpoint:** `npm test` — all tests pass. Tell the user explicitly which test cases were tricky and what to spot-check. Wait for approval.

---

### Phase 5 — Storage (~30 min)

`src/storage/`:

- `load.ts` — read `localStorage.getItem('formBuilder')`, parse, run migrations to current version, return `StoredData`. Handle: missing key → empty state; future version → throw + surface error UI; parse failure → empty state + log
- `save.ts` — stamp `CURRENT_VERSION`, JSON.stringify, write to localStorage
- `migrations.ts` — `migrations: Migrations = {}` (empty today, framework ready). `Migration = (data: unknown) => unknown` per §5

Tests:

- Round-trip: save then load returns equal data
- Future-version data throws
- Empty localStorage returns empty state

**Checkpoint:** tests pass. Wait for approval.

---

### Phase 6 — PDF spike, EARLY (~45 min)

**Per feedback.md decision #5: do this BEFORE the heavy UI work, not at hour 7.**

Build a throwaway page that renders a hardcoded "submitted instance" view as a print region. Define `@media print` rules:

- `body > *:not(#print-region) { display: none; }`
- `#print-region { display: block; }`
- Solid typography, margins, page-break-inside-avoid on field rows
- Try `@page` margin boxes for header (form title + timestamp) and footer (page number via `counter(page)`)
- **Test in Chrome, Firefox, Safari.** Note what works and what doesn't.

Don't build the real PDF rendering yet — just confirm the constraints.

**Checkpoint:** report findings to user. _"`@page` works in Chrome, partially in Firefox, Safari ignores X."_ Decide: ship `counter(page)` only? Skip page numbers entirely? User decides; document. Wait for approval.

---

### Phase 7 — Field registry (~120 min, mechanical)

Implement one module per field type in `src/fields/<type>/index.tsx`. Each exports:

```ts
export const textFieldModule: FieldTypeModule<TextField> = {
  type: "text",
  valueType: "string",
  capturesValue: true,
  canBeCalcSource: false,
  operators: ["text_equals", "text_not_equals", "text_contains"],
  defaultConfig: {
    /* ... */
  },
  renderer: TextRenderer,
  configEditor: TextConfigEditor,
  validator: validateText,
  pdfRenderer: renderTextForPdf,
  csvSerializer: serializeText,
};
```

Per-type registry values come from TYPES_PROPOSAL.md §6 table. Implement all 10 modules:

- text, textarea, number, date, single_select (radio/dropdown/tiles — three sub-displays), multi_select, file (metadata only, no upload), section_header, calculation

`src/registry/index.ts`:

```ts
export const registry: Registry = {
  text: textFieldModule,
  textarea: textareaFieldModule,
  // ...
};
```

The **mapped Registry type** ensures each key gets the right module.

Build a small `<AffixedInput>` primitive shared by Text and Number (per C1).

**Checkpoint:** typecheck passes. Wait for approval.

---

### Phase 8 — UI scaffolding (~45 min)

React Router v7 setup. Page shells (empty for now):

- `pages/TemplatesList.tsx`
- `pages/Builder.tsx` (three-panel layout)
- `pages/Fill.tsx`
- `pages/InstancesList.tsx`
- `pages/InstanceView.tsx`

Zustand stores:

- `stores/templates.ts` — CRUD operations, persists via storage module
- `stores/instances.ts` — read-only after create

**Checkpoint:** can navigate between routes, no errors. Wait for approval.

---

### Phase 9 — Builder mode (~120 min)

- Left panel: list of field types from registry, click-to-add (or drag — see DnD below)
- Center canvas: ordered field list, click to select
- Right panel: config editor for selected field — render `registry[selected.type].configEditor`
- @dnd-kit Sortable on the canvas with KeyboardSensor for keyboard-accessible reorder
- **Save button** — block save if validation fails (cycle in conditions, calc with no sources, min > max, etc.). Use `findCycle` from graph.ts
- Preview button → opens Fill mode in modal or inline
- `beforeunload` warning on unsaved changes (per F1)
- Field auto-select on add, insertion after currently selected (or end if none) per F2
- Confirmation modal on field deletion if it has dependents (other conditions / calc sources reference it) — per B3/D3

**Checkpoint:** can build a form with all 10 field types, conditions, calcs. Save persists. Wait for approval.

---

### Phase 10 — Fill mode (~90 min)

- Render fields in template order via `registry[field.type].renderer`
- Wire up live `evaluate()` on every value change (debounce if perf issues, but unlikely at this scale)
- Calc fields update in real-time
- Hidden fields don't render
- Required fields show asterisk via `aria-required`
- Validation per J1: on submit (full pass + scroll to first error), on blur after first visit, real-time clearing once errored
- Submit → strip hidden values → save Instance with `templateSnapshot`

**Checkpoint:** can fill and submit a form. Conditions work in real-time. Wait for approval.

---

### Phase 11 — PDF + CSV exports (~75 min)

**PDF:** populate the print region with the submitted instance, run `evaluate(submittedValues, templateSnapshot, registry)` to get visibility, render only visible fields. Trigger `window.print()`.

**CSV:** per decision-log G1 — union of all instance snapshots' fields, deduped by ID, ordered by latest-snapshot position. Per-type csvSerializer from registry. Hand-rolled escaping (RFC 4180). Browser-native download via Blob + URL.createObjectURL.

**Checkpoint:** PDF looks clean (not a debug dump). CSV opens correctly in Excel/Sheets with the right schema. Wait for approval.

---

### Phase 12 — README + polish (~45 min)

`README.md` — concise, NOT the full decision log:

- How to run locally
- localStorage schema (single key, version, structure) with reasoning
- Top 5–7 architectural decisions, one paragraph each:
  - Two-pass engine with topological condition pass + effective-value stripping (cite the cascade fix)
  - Hidden-field handling (preserve in memory, strip at submit)
  - Snapshot semantics for instance fidelity
  - Registry pattern (with mapped type) for adding field types
  - PDF strategy (browser-native print, what's reliable cross-browser)
  - CSV column source = union of snapshots
  - AND/OR per-field with deterministic precedence
- "What I'd do with more time" — distill from decision-log §N

**Do NOT touch `AI_USAGE_LOG.md`** — that's the user's deliverable.

Final polish:

- A11y baseline per M2 (labels, aria-required, focus-visible, error association)
- Mobile/tablet sanity check (Builder is desktop-only per M1; Fill mode degrades)
- Run typecheck + all tests one more time

**Checkpoint:** ready to ship. Final approval from user.

---

## How to verify your engine math (when Phase 4 completes)

Tell the user explicitly:

1. **The cascade test** in `evaluate.test.ts` is the headline correctness test. Walk them through what it asserts: A=hide-trigger sets B's visibility to false; B's preserved-but-stripped value means C's condition sees absent → C also hides. If this test passes, the topological-with-effective-values model works.
2. **The B2-dropped test:** calc aggregates over all sources regardless of which are hidden. Show the specific assertion.
3. **Precedence tests:** Hide > Show, Not-Required > Required. Show specific cases.
4. **The cycle test:** `findCycle` detects A→B→A. Show what the builder save does with this.
5. **Operator semantics tests (A6):** absent → false uniformly. Show the `not_equals` and `multi_contains_none` cases that look counter-intuitive but follow the uniform rule.

---

## Continuous progress logging — append to PROGRESS.md as you work

The user is sleeping. They want to scroll through `PROGRESS.md` in the morning and see, in order, exactly what you did. Not a final summary — a running log.

**Create `PROGRESS.md` at the start of Phase 0** with a header. Then **append an entry after every meaningful unit of work.**

### Format

Each entry is a 2nd-level heading (`##`) with timestamp + phase + sub-task, followed by 1–3 sentences of description. Optionally include file paths touched and the verification you ran.

```markdown
# Form Builder — Build Progress

## 2026-05-03 02:14 — Phase 0: Permissions

Wrote .claude/settings.local.json with allow-list (npm, node, tsc, vitest, vite, tailwind, basic file ops) and deny-list (git commit/push, rm, sudo, network fetchers). Confirmed working directory is /Users/ishantmehta/Desktop/work/form-builder.

## 2026-05-03 02:21 — Phase 1: Scaffold

Initialized Vite + React 19 + TypeScript. Installed react-router-dom@7, zustand, @dnd-kit/core, @dnd-kit/sortable, tailwindcss, vitest. Configured strict tsconfig (noUncheckedIndexedAccess, exactOptionalPropertyTypes). Created folder structure under src/. `npm run typecheck` clean, `npm run dev` starts on port 5173.

## 2026-05-03 02:54 — Phase 2: Types — field.ts

Translated TYPES_PROPOSAL.md §1 into src/types/field.ts. FieldType union, BaseFieldShared, RequirableFieldBase, all 9 per-type interfaces, Field discriminated union. Typecheck passes.

## 2026-05-03 03:02 — Phase 2: Types — condition.ts

Operator-discriminated Condition union per §2 with all 14 operators including number_within_range tuple. Typecheck passes.

## 2026-05-03 03:15 — Phase 3: Engine — operators.ts

Implemented evaluateOperator for all 14 ConditionOperator variants per decision-log A6. Absent target returns false uniformly. Text trim + case-insensitive. Number raw value (not rounded). Tests: 28/28 passing.

## 2026-05-03 03:38 — Phase 3: Engine — evaluate.ts

Implemented two-pass evaluate per §7. Pass 1 calc with no visibility filtering (B2 dropped). Pass 2 topological with effective-value stripping. Stale-condition defense skips silently. Cascade test passes — A→B→C with B preserved-but-hidden correctly hides C.
```

### Granularity

- **After each file written** (types, engine functions, tests, modules)
- **After each test suite passes** (note count)
- **After each phase completes** (summary entry: "Phase N complete. X tests passing, typecheck clean.")
- **NOT after every line edit** — that's noise
- **NOT batched** — append in real-time so the user sees order of operations

### Description content

For each entry, briefly say:

- _What you did_ — "implemented X", "translated Y to TS", "added Z test cases"
- _How you verified_ — "typecheck clean", "12/12 tests passing", "cascade test confirms fix"
- _Anything noteworthy_ — "Safari quirk with @page found", "had to reshape Field union for narrowing"

Keep it terse. The user is scanning, not reading.

## Stuck recovery protocol — IMPORTANT for overnight runs

The user is sleeping. **Do not wait for input.** If you hit a blocker, follow this protocol:

1. **Try three different approaches** before declaring "stuck." Failures are normal — debug them. Read error messages carefully. Search the codebase for similar patterns. Try a workaround.
2. **If still stuck after 3 honest attempts**, append a `⚠️ BLOCKER` entry to `PROGRESS.md` with:
   - Timestamp
   - Phase + sub-task
   - What you tried (the three approaches)
   - What blocked you (specific error, missing dependency, ambiguous spec, etc.)
   - What you did next (skipped to next phase, used a workaround, etc.)

   Example:

   ```markdown
   ## 2026-05-03 04:12 — ⚠️ BLOCKER: Phase 6 PDF spike — Safari @page

   Tried three approaches for cross-browser page header: @page margin boxes (Safari ignores), running headers via `position: running()` (Chrome only), JavaScript-injected per-page divs (breaks pagination). Could not get a header that works in all three browsers. Skipping reliable cross-browser header; shipping form-title-on-first-page only. Documented in README PDF section.
   ```

3. **Continue to the next phase or sub-task.** Do not block the entire run on one issue. If a single field type's renderer is broken, finish the other 9 and skip the broken one. If one engine test fails, mark it `it.skip()` with a comment pointing to the PROGRESS.md blocker entry and keep going.
4. **Never delete code or files to "fix" a blocker.** Always escalate via PROGRESS.md instead.

The user will scroll through PROGRESS.md when they wake up. Continuous progress entries + occasional `⚠️ BLOCKER` entries = exactly the picture they want.

### Self-testing during the run

Run tests aggressively, don't wait for the user to ask:

- After implementing each engine function (`evaluate`, `validateForm`, each operator), run `npm test -- <file>` immediately
- After implementing each field-type module, run `npm run typecheck` to catch type errors before moving on
- Before each phase boundary, run the full `npm test` and `npm run typecheck` to catch regressions
- If a test fails, debug it. If you can't debug it after 3 attempts, follow the stuck-recovery protocol above.

### Hard rules that override everything else

- **Never `cd` outside `/Users/ishantmehta/Desktop/work/form-builder`.**
- **Never write outside this folder** except `PROGRESS.md` (which is in the folder anyway).
- **Never run `git commit`, `git push`, `rm -rf`, or `sudo`.**
- **Never modify `AI_USAGE_LOG.md`** (user's deliverable, in their voice).
- **Never deviate from TYPES_PROPOSAL.md / decision-log.md without logging it to PROGRESS.md.**
- **If you encounter unfamiliar files or branches in the project, leave them alone.** They may be the user's in-progress work.

## When to stop (only these — otherwise keep going)

- A blocker that survives the stuck-recovery protocol (already logged to PROGRESS.md, no further action possible)
- All 12 phases complete

Everything else is normal work. Keep moving.

## End-of-run summary — append as the final entry in PROGRESS.md

When all phases complete (or you've gone as far as the protocol allows), append a final `## FINAL SUMMARY` entry on top of the running log:

```markdown
## 2026-05-03 09:42 — ✅ FINAL SUMMARY

**Phases completed:** 0, 1, 2, 3, 4, 5, 6 (PDF spike), 7, 8, 9, 10, 11, 12
**Phases partial:** —
**Phases skipped:** —

**Test status:** 87/87 passing (engine 42, validateForm 9, storage 6, registry modules 30)
**Typecheck:** clean (`npm run typecheck` exits 0)
**Build:** clean (`npm run build` exits 0)
**Dev server:** starts on port 5173

**Blockers logged:** 1 (see entry at 04:12 — Safari @page header skipped, form title still on first page)

**What to review first:**

1. Cascade test in src/engine/evaluate.test.ts:142 — verify the assertion matches your reading of the cascade fix
2. PDF output in browser print preview (Cmd+P on /instances/:id) — validate "looks like a real form" rubric
3. README architecture section — 6 distilled decisions, ~600 words, you may want to revise the AND/OR paragraph in your voice
4. AI_USAGE_LOG.md is untouched — that's your deliverable to write
```

Then stop. Don't wait for further instructions — the user will read PROGRESS.md and decide next steps.

---

## Estimated total time

~12–15 hours of agent-clock if everything goes smoothly. Maybe 16–18 with debugging. The user's spec budget is 6–8 hours of _their_ time — this prompt is structured to make most of those hours review-and-approve rather than active driving.

---

## Appendix A — Copy-paste starters

### A.1 `.claude/settings.local.json` (Phase 0 — overnight-friendly allow-list)

Pre-approved by the user for overnight autonomous execution. Write this immediately at Phase 0 start. The deny list is the safety net — never override it.

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install)",
      "Bash(npm install:*)",
      "Bash(npm uninstall:*)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npm exec:*)",
      "Bash(npm pkg:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(vitest:*)",
      "Bash(tsc:*)",
      "Bash(vite:*)",
      "Bash(tailwindcss:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(grep:*)",
      "Bash(rg:*)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(touch:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(echo:*)",
      "Bash(pwd)",
      "Bash(which:*)",
      "Bash(git status)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git branch)",
      "Bash(git branch:*)",
      "Bash(git ls-files:*)",
      "Bash(git init)",
      "Bash(git add:*)",
      "Read(*)",
      "Write(*)",
      "Edit(*)"
    ],
    "deny": [
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git reset:*)",
      "Bash(git checkout:*)",
      "Bash(git rebase:*)",
      "Bash(git merge:*)",
      "Bash(rm:*)",
      "Bash(rmdir:*)",
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(ssh:*)",
      "Bash(scp:*)",
      "Bash(brew:*)",
      "Bash(apt:*)",
      "Bash(open:*)",
      "Bash(launchctl:*)",
      "Bash(killall:*)",
      "Bash(pkill:*)"
    ]
  }
}
```

**Why this is safe overnight:**

- Allow-list is dev-tooling only (npm, node, tsc, vitest, vite, tailwindcss). No network calls beyond `npm install` (which is necessary for scaffolding).
- Deny-list blocks destructive git ops, file deletion, sudo, network fetchers, and process killers.
- Read/Write/Edit are unrestricted in path because the agent is constrained to the project folder by the prompt's hard rules. The agent will not attempt absolute paths outside the working directory.
- No `curl`, `wget`, `ssh` — no exfiltration paths.

### A.2 `tsconfig.json` (strict mode, no excuses)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "verbatimModuleSyntax": false,
    "types": ["vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "vite.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### A.3 `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### A.4 Engine skeleton — `src/engine/evaluate.ts`

This is the structure to fill in, NOT the final implementation. Use it as a guide; verify each step against TYPES_PROPOSAL.md §7.

```ts
import type { Field, Template, Values, FieldType } from "@/types/field";
import type { Condition, Effect } from "@/types/condition";
import type { Registry } from "@/registry/contract";
import { topologicalSort, buildConditionGraph } from "./graph";
import { evaluateOperator } from "./operators";

export interface EngineResult {
  computedValues: Values;
  visibility: Record<string, boolean>;
  required: Record<string, boolean>;
}

export function evaluate(
  rawValues: Values,
  template: Template,
  registry: Registry,
): EngineResult {
  // Pass 1 — Calculation. No visibility filtering (B2 dropped).
  const computedValues: Values = { ...rawValues };
  for (const field of template.fields) {
    if (field.type !== "calculation") continue;
    const sourceValues = field.config.sourceFieldIds
      .map((id) => rawValues[id])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (sourceValues.length === 0) continue; // omit; renderer shows '—'
    computedValues[field.id] = aggregate(
      sourceValues,
      field.config.aggregation,
    );
  }

  // Pass 2 — Conditions, in topological order with effective-value stripping.
  const graph = buildConditionGraph(template);
  const order = topologicalSort(
    graph,
    template.fields.map((f) => f.id),
  );

  const effectiveValues: Values = { ...computedValues };
  const visibility: Record<string, boolean> = {};
  const required: Record<string, boolean> = {};

  for (const fieldId of order) {
    const field = template.fields.find((f) => f.id === fieldId);
    if (!field) continue;

    // Group condition results by effect type
    const effects: Record<Effect, boolean[]> = {
      show: [],
      hide: [],
      require: [],
      not_require: [],
    };
    for (const cond of field.conditions) {
      const targetValue = effectiveValues[cond.targetId]; // undefined if absent OR hidden upstream
      const result = evaluateOperator(cond, targetValue); // returns false on absent target per A6
      effects[cond.effect].push(result);
    }

    // Per-effect-group combine (AND/OR). Empty groups are INACTIVE — guard with length > 0
    // because [].every(x => x) === true would otherwise hide every field by Hide-wins precedence.
    const combine =
      field.conditionLogic === "AND"
        ? (arr: boolean[]) => arr.every(Boolean)
        : (arr: boolean[]) => arr.some(Boolean);
    const fires = (arr: boolean[]) => arr.length > 0 && combine(arr);

    const showFires = fires(effects.show);
    const hideFires = fires(effects.hide);
    const requireFires = fires(effects.require);
    const notRequireFires = fires(effects.not_require);

    // Visibility resolution
    let isVisible: boolean;
    if (hideFires) isVisible = false;
    else if (showFires) isVisible = true;
    else isVisible = field.defaultVisible;
    visibility[fieldId] = isVisible;

    // Required resolution (only for RequirableFieldBase)
    const capturesValue = registry[field.type].capturesValue;
    if (!capturesValue || field.type === "calculation") {
      required[fieldId] = false;
    } else if (notRequireFires) {
      required[fieldId] = false;
    } else if (requireFires) {
      required[fieldId] = true;
    } else {
      // We need to narrow to a RequirableFieldBase — only those have defaultRequired
      required[fieldId] =
        "defaultRequired" in field ? field.defaultRequired : false;
    }

    // Strip hidden field's effective value so downstream conditions see it as absent
    if (!isVisible) delete effectiveValues[fieldId];
  }

  return { computedValues, visibility, required };
}

function aggregate(
  values: number[],
  type: "sum" | "average" | "min" | "max",
): number {
  switch (type) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "average":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}
```

**Things to verify here:**

- The `find` in topo iteration is O(n) per field — fine at 50 fields, switch to a `Map<string, Field>` if perf matters.
- The Registry mapped type means `registry[field.type]` returns the right module; no narrowing needed.
- `'defaultRequired' in field` is the type guard for `RequirableFieldBase`.
- Stale-condition handling lives inside `evaluateOperator` — if target type doesn't match operator, return false.
- **Empty-group guard is mandatory.** `[].every(x => x) === true` will hide every field on initial load via Hide-wins. Use the `fires(arr)` helper that requires `arr.length > 0`.
- **Cycle defense.** Wrap `topologicalSort` in try/catch (or have it return `{ ok, order } | { ok: false }`). On cycle: log, build `EngineResult` with all `visibility[id] = field.defaultVisible` and `required[id] = field.defaultRequired ?? false`, preserve `computedValues` from Pass 1, return. Never throw. (Tests should cover this — feed a known-cyclic template, assert the engine returns defaults rather than throwing.)

### A.5 The cascade test — Phase 4 headline

Place in `src/engine/evaluate.test.ts`. **This test failing means the engine is wrong.**

```ts
import { describe, it, expect } from "vitest";
import { evaluate } from "./evaluate";
import { registry } from "@/registry";
import type { Template } from "@/types/template";

describe("cascade through hidden-but-preserved values", () => {
  it("strips hidden upstream values so downstream conditions see them as absent", () => {
    const template: Template = {
      id: "t1",
      title: "Cascade Test",
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      fields: [
        // A: text. When A === 'show', B is visible.
        {
          id: "a",
          type: "text",
          label: "A",
          conditions: [],
          conditionLogic: "OR",
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
        // B: text. Hidden by default; shown when A === 'show'. Has a value of 'blue'.
        {
          id: "b",
          type: "text",
          label: "B",
          conditions: [
            {
              targetId: "a",
              operator: "text_equals",
              value: "show",
              effect: "show",
            },
          ],
          conditionLogic: "OR",
          defaultVisible: false,
          defaultRequired: false,
          config: {},
        },
        // C: text. Visible only when B === 'blue'. THIS is the cascade test.
        {
          id: "c",
          type: "text",
          label: "C",
          conditions: [
            {
              targetId: "b",
              operator: "text_equals",
              value: "blue",
              effect: "show",
            },
          ],
          conditionLogic: "OR",
          defaultVisible: false,
          defaultRequired: false,
          config: {},
        },
      ],
    };

    // User flow: A='show' (B becomes visible), B='blue' (C becomes visible).
    // Then user sets A='hide' — B should hide, AND C should also hide.
    const rawValues = { a: "hide", b: "blue" }; // B has preserved value

    const result = evaluate(rawValues, template, registry);

    expect(result.visibility.a).toBe(true); // A always visible
    expect(result.visibility.b).toBe(false); // hidden because A !== 'show'
    expect(result.visibility.c).toBe(false); // CASCADE: hidden because B is hidden,
    // even though raw values still has b='blue'.
    // This is the bug Codex caught.
  });

  it("B2 dropped: calc aggregates over all sources regardless of source visibility", () => {
    const template: Template = {
      id: "t2",
      title: "Calc B2 Test",
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      fields: [
        {
          id: "trigger",
          type: "text",
          label: "Trigger",
          conditions: [],
          conditionLogic: "OR",
          defaultVisible: true,
          defaultRequired: false,
          config: {},
        },
        {
          id: "n1",
          type: "number",
          label: "N1",
          conditions: [
            // Hide N1 if trigger === 'hide'
            {
              targetId: "trigger",
              operator: "text_equals",
              value: "hide",
              effect: "hide",
            },
          ],
          conditionLogic: "OR",
          defaultVisible: true,
          defaultRequired: false,
          config: { decimalPlaces: 0 },
        },
        {
          id: "n2",
          type: "number",
          label: "N2",
          conditions: [],
          conditionLogic: "OR",
          defaultVisible: true,
          defaultRequired: false,
          config: { decimalPlaces: 0 },
        },
        {
          id: "total",
          type: "calculation",
          label: "Total",
          conditions: [],
          conditionLogic: "OR",
          defaultVisible: true,
          config: {
            sourceFieldIds: ["n1", "n2"],
            aggregation: "sum",
            decimalPlaces: 0,
          },
        },
      ],
    };

    // Hide N1 via trigger, but keep its value
    const rawValues = { trigger: "hide", n1: 10, n2: 20 };
    const result = evaluate(rawValues, template, registry);

    expect(result.visibility.n1).toBe(false);
    expect(result.computedValues.total).toBe(30); // B2 dropped: sum is over ALL sources
  });
});
```

### A.6 Reading order for the new session — TLDR

If the agent only reads three things before starting, in order:

1. `TYPES_PROPOSAL.md` §7 (engine spec) — most important
2. `decision-log.md` A1, A2, A3, A5, A6, B2, G1 (the conditional + calc + CSV decisions)
3. The phase headers in this file (skim section for what's expected at each checkpoint)

Everything else is reference material to consult as needed.

---

## Appendix B — Things that have surprised previous sessions

Capture from the planning conversation; pre-empt these mistakes:

1. **Don't wrap field discriminated union with `Record<FieldType, FieldTypeModule>` for the registry.** Use the mapped type from §6 — it pins each key to its specific module type. The non-mapped version was a real type-safety hole.
2. **Don't filter calc sources by visibility.** B2 was dropped specifically. Aggregate over all source values regardless of which sources are conditionally hidden. Hide the calc itself if you need to avoid leaking source values.
3. **Don't add fixed-point iteration.** With B2 dropped and cycles blocked at builder save, the engine converges in one ordered pass (calc → topological condition pass).
4. **Don't make `Migration = (data: any) => any`.** Use `unknown` and narrow inside. Strict mode rejects implicit any.
5. **Do store computed calc values + `visibility` map on `Instance`.** This was inverted by Codex round 2 (P1). The original "engine is pure, just re-derive" logic missed that hidden source values are stripped at submit, so re-running the engine on `submittedValues` produces _different_ calc results than what was submitted. Persisted instance must include the visibility map and the computed calc results for visible calcs. Re-render is then a pure display function — no engine call. See §4 lifecycle paragraph.
6. **Don't promise "Page X of Y" in the PDF.** `counter(pages)` is unreliable in Safari. Ship `counter(page)` if it works in target browsers, skip the "of Y" part.
7. **Don't return `ValidationError | null` from validators.** Per the signed-off contract, validators return `ValidationError[]`. Empty array means valid. Co-occurring errors (required + min_length) need to surface together.
8. **Don't let empty effect groups fire.** `[].every(x => x) === true` — if you don't guard with `length > 0`, every field with no Hide conditions gets hidden via Hide-wins precedence on initial load. Use a `fires(arr)` helper that requires `arr.length > 0 && combine(arr)`. (P4)
9. **Don't let cycles throw at runtime.** Cycle blocking exists at builder save AND load time, but the engine still defends as a last resort. Topo-sort failure → return `EngineResult` with all-default visibility/required, log, never throw. (P3)
10. **Don't claim multi-source calcs prevent leakage.** With one hidden source, sum/avg are reverse-engineerable; min/max directly expose the hidden source if it's the extreme. The honest rule: any calc with at least one source that _can become hidden_ (defaultVisible:false OR has any Hide condition attached) needs a builder warning. (P2)
11. **Don't write `AI_USAGE_LOG.md`.** That's the user's deliverable, in their voice. Mention significant prompts to them so they can capture, but don't author the log yourself.
