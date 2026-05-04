# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # dev server at http://localhost:5173
npm test              # unit tests (vitest, run once)
npm run test:watch    # unit tests in watch mode
npm run typecheck     # tsc --noEmit (strict mode)
npm run build         # typecheck + vite production build

# Run a single unit test file
npx vitest run src/engine/evaluate.test.ts

# Run unit tests matching a pattern
npx vitest run --reporter=verbose -t "cascade"

# E2E tests (requires dev server or uses webServer auto-start)
npm run test:e2e          # headless Chromium
npm run test:e2e:ui       # Playwright interactive UI
npm run test:e2e:debug    # step-through debug mode

# Run a single E2E spec
npx playwright test tests/e2e/fill.spec.ts
```

**Critical:** never run `tsc -b` — it emits compiled `.js` files into `src/`, which causes Vitest to double-count tests by importing both `.ts` and `.js` versions of every file. Always use `tsc --noEmit`.

## Architecture

### Data flow

```
localStorage['formBuilder'] = { version, templates: {[id]: Template}, instances: {[id]: Instance} }
    ↓ load() on mount (cycle-validates every template, quarantines cycles)
Zustand stores (templates, instances, toasts, devtools)
    ↓ evaluate(rawValues, template, registry) on every render in Fill
    → { computedValues, visibility, required }
    ↓ submit → Instance (snapshot + filtered values + visibility map stored)
    ↓ re-render → pure display from stored data, no engine re-run
```

### Engine (`src/engine/`)

The core is `evaluate.ts` — a two-pass pure function:

1. **Pass 1 — Calculations:** aggregates raw number values into calc field results. Hidden sources are **not** excluded (B2 was deliberately dropped — see `decision-log.md`). If all sources are absent, the calc field is omitted from `computedValues` entirely (shows `—`, not `0`).
2. **Pass 2 — Conditions:** evaluates in topological order over the condition dependency graph. After each field is processed, if it becomes hidden its value is deleted from `effectiveValues` before the next field sees it. This effective-value stripping prevents the chained-conditions cascade bug (hidden field preserving a value that satisfies a downstream condition).

`conditionLogic` (AND/OR) applies *per effect group* (Show group, Hide group separately), not globally. Empty groups are inactive — `[].every()` vacuous-truth is guarded by `arr.length > 0`. Cross-effect precedence: Hide > Show, Not-Required > Required.

Cycles are blocked at builder save time (`graph.ts → findCycle`) and re-validated at `load()`. The engine has a last-resort fallback that returns all-default visibility if `topologicalSort` fails, rather than throwing.

### Registry pattern (`src/registry/`)

Every field type implements `FieldTypeModule<F>` from `registry/contract.ts`:

```ts
{ type, valueType, capturesValue, canBeCalcSource, operators,
  defaultConfig, renderer, configEditor, validator, pdfRenderer, csvSerializer }
```

`Registry` is a mapped type `{ [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>> }` — each key is pinned to its concrete field type so the compiler catches mismatches. Adding a new field type requires: adding to the `FieldType` union in `types/field.ts`, writing a `FieldTypeModule`, and registering in `registry/index.ts`. Nothing else needs editing.

### Instance snapshot semantics

When a form is submitted, the instance stores:
- `templateSnapshot` — a deep copy of the template **at submission time**
- `values` — visible field values + pre-computed calc values (calc values are baked in, not recomputed on re-render)
- `visibility` — the full visibility map at submit time

Re-rendering an instance (InstanceView, PDF, CSV) is pure display from stored data — no engine call. This is intentional: re-running the engine on submitted values would produce different calc results if source fields were hidden and stripped at submit time.

CSV export reads `instance.templateSnapshot.fields` across all instances, deduplicating by field ID (first-seen wins for the label, instances sorted newest-first so the latest label wins). This union-of-snapshots strategy preserves historical data for renamed/removed fields.

### Storage (`src/storage/`)

`load()` returns `StoredData & { invalidTemplateIds: Set<string> }`. On version mismatch (`version > CURRENT_VERSION`) it throws; the Zustand store catches and falls back to empty state. On malformed JSON it returns empty state. Migrations run at boot for older version numbers (`migrations.ts` framework is in place; no migrations exist yet at version 1).

### Zustand stores (`src/stores/`)

- `templates` — templates map + `invalidTemplateIds` set + `loadFromStorage` / `saveToStorage` / `deleteTemplate` (cascade-deletes orphan instances)
- `instances` — instances map + load/save
- `toasts` — push/pop for transient notifications
- `devtools` — dock open/closed state for the storage inspector

### Pages and routing

```
/                              → TemplatesList
/templates/new                 → Builder (create mode)
/templates/:id/edit            → Builder (edit mode)
/templates/:id/fill            → Fill
/templates/:id/instances       → InstancesList
/instances/:id                 → InstanceView
```

Builder tracks `isDirty` and shows an unsaved-changes warning. Clicking Preview with dirty state opens a confirm dialog that runs the full save flow (including cycle validation) before navigating.

### PDF export

PDF renders via `window.print()` with `@media print` CSS. The print region (`#print-region`) is rendered via React portal to `document.body` (sibling of `#root`, not descendant) — this is required because `body > *:not(#print-region) { display: none }` would hide `#root` and all its descendants including the print region if it were nested inside.

### E2E tests (`tests/e2e/`)

Tests use `localStorage` injection via `page.evaluate()` for setup (avoids brittle UI traversal for preconditions). All selectors use `data-testid`. The `beforeEach` calls `clearStorage` (navigates to `/` first before clearing, because `localStorage.clear()` throws on `about:blank`). Playwright is configured Chromium-only; the dev server is auto-started via `webServer` in `playwright.config.ts`.

Vitest is explicitly configured to exclude `tests/e2e/**` — without this, Vitest picks up Playwright spec files and errors on `test.beforeEach`.
