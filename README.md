# Form Builder

A browser-based form builder and filler with conditional logic, calculations, PDF export, and CSV export. Built with React 19, TypeScript, Vite, Zustand, and Tailwind CSS.

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

The engine runs `evaluate(rawValues, template, registry) → { computedValues, visibility, required }` in two passes.

**Pass 1** computes all calculation fields from raw values (no visibility filtering — see B2 below). **Pass 2** evaluates conditions in topological order over the condition dependency graph (edges: `target → owner`). The key correctness property: when a field becomes hidden, its entry is deleted from the `effectiveValues` map *before* downstream fields are processed. Without this stripping, a field hidden upstream (e.g., B) could still satisfy a downstream condition via its preserved-but-hidden value, leaving the downstream field (C) incorrectly visible. This cascade bug was caught in review and the fix — topological iteration with effective-value stripping — is the headline engine correctness property.

Cycles are blocked at builder save time and re-validated on storage load. The engine still defends as a last resort: if `topologicalSort` detects a cycle, it logs and returns all-default visibility/required without throwing.

### 2. Hidden field handling: preserve in state, strip at submit

During fill mode, hidden field values are preserved in component state (decision A2). This means toggling a condition back doesn't lose the user's input. At submit, only visible field values are stored in the instance. This is a pure transformation: `filter(memoryValues, visibility) → submittedValues`.

### 3. Instance snapshot semantics for fidelity

Submitted instances store a full structural copy of the template at submission time (`templateSnapshot`). This means re-rendering an old response uses the field types and options that existed when the user filled it, not the current (potentially changed) template. CSV export reads `instance.templateSnapshot.fields` across all instances, deduping by field ID and ordering by latest-snapshot position — the union-of-snapshots strategy.

Instances also store `visibility` (the full map at submit time) and computed calc values for visible calcs. Re-rendering is a pure display function with no engine call, which avoids the re-computation bug: if a source field was hidden and stripped from `submittedValues`, re-running the engine on submitted values would produce different aggregates than what the user saw at submit time.

### 4. Registry pattern with mapped type for adding field types

```ts
type Registry = {
  [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>>;
};
```

Each key is pinned to its specific field type module. Adding an 11th field type requires: adding to the `FieldType` union, writing a new field interface, a new `FieldTypeModule` implementation, and registering in `registry/index.ts`. The engine, condition editor, calc source picker, CSV serializer, and PDF renderer all read from the registry — no scattered `switch` statements.

### 5. PDF: browser-native print with @media print isolation

PDF export calls `window.print()` with `@media print` CSS that hides everything except `#print-region`. The print region renders fields using their `pdfRenderer` (same JSX, different layout). `@page` margin boxes with `counter(page)` work in Chrome and Firefox. Safari ignores `@page` margin boxes, so "Page X of Y" is not promised — only "Page X" via `counter(page)` when it works. This is documented in the CSS and not surfaced as a feature.

### 6. AND/OR logic is per-effect-group with deterministic precedence

A field's `conditionLogic` (AND or OR) applies *within* each effect group separately. A field with two Show conditions and one Hide condition uses `conditionLogic` to combine the Shows; the single Hide is its own group. Cross-effect precedence: Hide > Show, Not-Required > Required. Empty groups are inactive — `[].every(x => x) === true` is guarded with `arr.length > 0 && combine(arr)` to prevent vacuous Hide from hiding every field on initial load.

### 7. Operator semantics: absent values are uniformly false

When a condition's target is absent from `effectiveValues` (never answered, or hidden upstream), all comparison operators return `false` — including `not_equals` and `multi_contains_none`. The user-facing principle: *unanswered fields don't trigger logic; defaults apply.* This keeps AND/OR combination simple (no third "skip" state) and matches builder intuition.

## What I'd do with more time

- **Condition builder UI:** the current condition editor is minimal (raw dropdowns). A visual "if/then" builder with field-type-aware operator lists and value pickers (date picker, option checkboxes) would greatly reduce mis-configuration.
- **Undo/redo in builder:** `useReducer` + action history; currently unsaved changes are only protected by the `beforeunload` warning.
- **File uploads:** the file field captures metadata but doesn't actually upload files (no backend). Real upload would need presigned URLs or IndexedDB.
- **Template versioning:** instances carry a snapshot, but the template list shows only the current version. A "view at submission time" affordance would help auditors.
- **Richer PDF:** running headers and "Page X of Y" in Safari require JavaScript-injected per-page divs and `ResizeObserver`, which is a significant spike. Skipped per K2.
- **Accessibility:** labels and `aria-required` are wired, but keyboard navigation of tiles/drag-and-drop and error announcement via `aria-live` need deeper testing with a screen reader.
- **Performance:** engine re-runs on every keystroke. At 50 fields with dense conditions this is fine; at 200+ fields a debounce or a more granular reactivity model (Zustand selectors) would help.
