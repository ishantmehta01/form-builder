# Form Builder

A browser-based form builder and filler with conditional logic, calculations, PDF export, and CSV export. Built with React 19, TypeScript, Vite, Zustand, and Tailwind CSS.

**Live demo:** https://form-builder-dusky-eta.vercel.app/

## Running locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build
npm test           # unit tests
npm run typecheck  # TypeScript strict mode check
```

## localStorage schema

Everything is stored in a single key:

```
localStorage['formBuilder'] = {
  version: 1,
  templates: { [id]: Template },
  instances: { [id]: Instance }
}
```

**Why single key:** atomic reads/writes, trivially snapshottable, easy to inspect in devtools. Migrations run at app boot (`storage/migrations.ts` framework ready). Future-version data throws a recoverable error surfaced in the UI. JSON parse failures return empty state.

## Architectural decisions

### 1. Two-pass engine with topological condition evaluation and effective-value stripping

The engine runs `evaluate(rawValues, template, registry) → { computedValues, visibility, required }` in two passes — calculations first, then conditions in topological order.

**Pass 1: Calculations.** For each calculation field, aggregate its source field values from `rawValues`. No visibility filtering happens here (see B2 in the decision log) — calc fields aggregate over all source values regardless of which sources are conditionally hidden. The calc itself can be hidden by its own condition; if hidden, it's excluded from submission/PDF/CSV.

**Pass 2: Conditions.** Evaluate each field's conditions in topological order over the condition dependency graph (edges: `target → owner`). The key correctness property: **when a field becomes hidden, its entry is deleted from the `effectiveValues` map before downstream fields are processed.** This *effective-value stripping* prevents what would otherwise be a real cascade bug.

**Worked example.** Three fields:

- `A`: a single-select with options Yes / No
- `B`: a text field with condition *show if A = Yes*
- `C`: a text field with condition *show if B = "hello"*

User picks Yes for A, types "hello" in B, types something in C. Now both B and C are visible. User then changes A to No. What happens?

- *Without* effective-value stripping: B's value ("hello") is preserved per A2 — the engine just hides B's display, not its data. C's condition reads B's preserved value and stays visible. **Bug: C is shown even though B (its trigger) is hidden.**
- *With* effective-value stripping: when B is marked hidden in Pass 2, its entry is deleted from `effectiveValues`. C is processed *after* B in topological order, so when C's condition tries to read B, it sees nothing. C correctly hides too.

This bug was caught in pre-implementation review (see [AI usage log](AI_USAGE_LOG.md) Entry 5). The fix — topological iteration plus effective-value stripping — is the headline correctness property of the engine.

**Cycle handling — three layers of defense.** Cycles in the condition graph are blocked at builder save time (a condition that would create a loop is rejected with an inline error). On storage load, the same cycle validation runs again — corrupt or hand-edited localStorage can't slip a cyclic template past the engine. As a last resort, the engine itself defends: if `topologicalSort` somehow encounters a cycle at runtime, it logs and returns all-default visibility/required instead of throwing.

### 2. Hidden field handling: preserve in state, strip at submit

During fill mode, hidden field values are preserved in component state (decision A2). This means toggling a condition back doesn't lose the user's typed input. At submit, only visible field values land in the saved instance — `filter(memoryValues, visibility) → submittedValues`.

**Worked example.** A user types "John" into the Name field. A condition then hides Name (e.g., they ticked "I'd rather not say my name"). Two scenarios:

1. *They reverse the toggle before submitting:* "John" is still in the input. No data lost.
2. *They submit while Name is hidden:* "John" is **not** saved in the instance. The submission only contains visible-at-submit-time values; PDF and CSV exports never see "John."

We keep typed data through accidental toggles, but ensure hidden values never leak into PDF, CSV, or stored instances. One pure function (`filter(memoryValues, visibility)`) enforces this at every export path — there's no second code path for "what counts as submitted."

### 3. Instance snapshot semantics for fidelity

Submitted instances store a full structural copy of the template at submission time (`templateSnapshot`). Re-rendering an old response uses the field types and options that existed *when the user filled it*, not the current (potentially changed) template.

**Worked example.** A user submits a response against template V1 today. Tomorrow the builder renames "Email" to "Contact Address," removes the "Phone" field entirely, and changes a Single Select's option labels. Re-downloading the user's PDF still shows V1's layout — same field order, same labels, same options as when they filled it. The user's "Phone" answer still appears in their PDF, even though that field no longer exists in the live template.

CSV export reads `instance.templateSnapshot.fields` across all instances, deduping by field ID and ordering by latest-snapshot position — the *union-of-snapshots* strategy. Older instances' values for fields that no longer exist in the current template still appear as columns; field labels come from the latest snapshot that still has each field (handles renames cleanly).

Instances also store `visibility` (the full map at submit time) and pre-computed calc values for visible calcs. Re-rendering is a *pure display function* with no engine call. This avoids a subtle bug: if we re-ran the engine on submitted values, hidden source values would have been stripped at submit, so calc aggregates would compute differently than what the user actually saw and submitted. Storing the computed values prevents that drift.

### 4. Registry pattern with mapped type for adding field types

```ts
type Registry = {
  [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>>;
};
```

Each key is pinned to its specific field type module. Adding an 11th field type requires: adding to the `FieldType` union, writing a new field interface, a new `FieldTypeModule` implementation, and registering in `registry/index.ts`. The engine, condition editor, calc source picker, CSV serializer, and PDF renderer all read from the registry — no scattered `switch` statements.

### 5. PDF: browser-native print with @media print isolation

PDF export calls `window.print()` with `@media print` CSS that hides everything except `#print-region`. The print region renders fields using their `pdfRenderer` (same JSX, different layout). `@page` margin boxes with `counter(page)` give per-page numbering in Chrome and Firefox. Safari ignores `@page` margin boxes — the cross-browser path is JavaScript-injected per-page divs measured with `ResizeObserver` to know where pages break, then numbered manually. That's the right solution and it's listed under _What I'd do with more time_; for the time budget here I scoped to "Page X" where the browser supports it and surfaced the limitation in the CSS rather than ship a half-implemented `ResizeObserver` path.

### 6. AND/OR logic is per-effect-group with deterministic precedence

A field's `conditionLogic` (AND or OR) applies _within_ each effect group separately. A field with two Show conditions and one Hide condition uses `conditionLogic` to combine the Shows; the single Hide is its own group. Cross-effect precedence: Hide > Show, Not-Required > Required. Empty groups are inactive — `[].every(x => x) === true` is guarded with `arr.length > 0 && combine(arr)` to prevent vacuous Hide from hiding every field on initial load.

### 7. Operator semantics: absent values are uniformly false

When a condition's target is absent from `effectiveValues` (never answered, or hidden upstream), all comparison operators return `false` — *including* `not_equals` and `multi_contains_none`.

**Worked example.** A field has condition `Email != "spam@x.com"` → *show this field*. The user opens the form but hasn't filled in Email yet (Email is absent). Naively, "absent != 'spam@x.com'" looks true, so the field would show. Instead, our rule treats absent as "no signal," the condition evaluates to `false`, and the field falls back to its `defaultVisible`.

The user-facing principle: *unanswered fields don't trigger logic; defaults apply.* This keeps AND/OR combination simple (no third "skip" state to merge) and matches builder intuition — no one writes a `not_equals` rule expecting it to fire on empty inputs.

## What I'd do with more time

- **Condition builder UI:** the current condition editor is a flat row of raw dropdowns where the value input doesn't adapt to the operator — you type a date string into a text box for `date_after`, paste an option ID into a text box for `select_equals`, and there's no live preview of what the rule does. A visual `[field] [operator] [value-aware-input]` row with a preview line (*"this rule will hide Field X when DOB is after 2026-01-01"*) would compress mis-configuration significantly. The hard part isn't the layout — it's the value-input switching: a date picker for date operators, option checkboxes for `select_equals` / `multi_contains_*`, a two-slot number input for `number_within_range`. Each operator type needs its own micro-component, and the builder UI has to swap them inline as the operator dropdown changes.
- **Undo/redo in builder:** `useReducer` + action history; currently unsaved changes are only protected by the `beforeunload` warning.
- **Live drafts for in-progress fills:** today, fill state lives in component state until Submit. A debounced autosave on every keystroke (persisted as a separate `draft` collection in localStorage, distinct from submitted instances) would let users close a tab mid-fill and resume without losing work. Drafts would clear automatically on successful submit or explicit discard.
- **File uploads:** the file field captures metadata but doesn't actually upload files (no backend). Real upload would need presigned URLs or IndexedDB.
- **Template versioning:** instances carry a snapshot, but there's no explicit version registry — the template list shows only the live version, and there's no diff between what an instance was filled against and what the template looks like today. The natural extension: each builder-save creates a `Template v1`, `v2`… in storage; instances reference a version ID instead of carrying a full snapshot; the builder shows *"this template has 5 historical versions"* with a per-version preview and diff view. The migration path is straightforward — existing snapshots are deduped into the version registry on first run. Useful for any audit-trail use case (compliance, contract changes, regulatory review).
- **Richer PDF:** running headers and "Page X of Y" in Safari require JavaScript-injected per-page divs and `ResizeObserver`, which is a significant spike. Skipped per K2.
- **Accessibility:** labels and `aria-required` are wired, but keyboard navigation of tiles/drag-and-drop and error announcement via `aria-live` need deeper testing with a screen reader.
- **Performance:** engine re-runs on every keystroke. At 50 fields with dense conditions this is fine; at 200+ fields a debounce or a more granular reactivity model (Zustand selectors) would help.
- **Cross-browser and small-device support:** the E2E suite runs Chromium only; Firefox and Safari (WebKit's `@media print` behaviour, date-input quirks) are untested. Separately, the builder canvas assumes a comfortable viewport — on narrow screens the config panel overflows, drag handles are hard to tap, and the condition editor is unusable. A CI matrix across all three engines plus a mobile-first rework of the builder (or at minimum a read-only fill experience for phones) would be the next platform milestone.

## Planning artifacts

The architectural decisions section above is a 7-item distillation. The full planning trail lives in [`docs/planning/`](docs/planning/). Highlights worth opening:

- [**TYPES_PROPOSAL.md**](docs/planning/TYPES_PROPOSAL.md) — signed-off type model, registry contract, and engine signatures. Source of truth for everything in `src/types/`, `src/engine/`, and `src/registry/`.
- [**decision-log.md**](docs/planning/decision-log.md) — every architectural decision with options-considered, chosen path, and reasoning (~40 KB). The long-form version of the _Architectural decisions_ section above, including the "evolution" notes that show how decisions changed under review.
- [**E2E_SCENARIOS.md**](docs/planning/E2E_SCENARIOS.md) — 48 hand-verified scenarios (S1–S41 + M1–M7) serving as the spec for both manual smoke and Playwright. Each has stable ID, preconditions, steps, and explicit expected outcomes; the four bugs caught during manual testing (S16 cascade delete, S17 condition-value editor, S41 preview-with-unsaved, plus a PDF rendering bug) are documented as scenarios with their root-cause analysis.
- [**requirements.pdf**](docs/planning/requirements.pdf) — the original project requirements, kept alongside the planning docs for cross-reference.

The directory also contains the AI prompts used at each phase: [`CLAUDE_CODE_STARTER_PROMPT.md`](docs/planning/CLAUDE_CODE_STARTER_PROMPT.md) and [`CODEX_REVIEW_PROMPT.md`](docs/planning/CODEX_REVIEW_PROMPT.md) (independent plan reviews), [`ImplementationPrompt.md`](docs/planning/ImplementationPrompt.md) (initial build), [`CompletionPrompt.md`](docs/planning/CompletionPrompt.md) (gap-fill), and [`PlaywrightPlan.md`](docs/planning/PlaywrightPlan.md) (E2E). These exist as evidence of the multi-model orchestration documented in [AI_USAGE_LOG.md](AI_USAGE_LOG.md) — entries 3, 5, and 6 reference them directly.
