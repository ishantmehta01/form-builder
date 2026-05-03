# Form Builder — Type Model & Registry Contract

> Sign-off draft. Reflects feedback.md decisions: B2 dropped; registry expanded with `valueType`/`capturesValue`/`canBeCalcSource`/`operators`; Conditions discriminated by **operator** (not target type) with tuple support for `is within range`; instance snapshot retained (D4) so CSV can union-of-snapshots later.
>
> **No engine code until this is signed off.** Engine signature is included at §7 so the data flow is reviewable end-to-end.

---

## 1. Field types

### 1.1 Discriminator

```ts
type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'single_select'
  | 'multi_select'
  | 'file'
  | 'section_header'
  | 'calculation';
```

### 1.2 Bases

```ts
interface BaseFieldShared {
  id: string;                    // crypto.randomUUID()
  label: string;
  conditions: Condition[];
  conditionLogic: 'AND' | 'OR';  // default 'OR' per A1
  defaultVisible: boolean;
}

interface RequirableFieldBase extends BaseFieldShared {
  defaultRequired: boolean;
}
```

`SectionHeaderField` and `CalculationField` extend `BaseFieldShared` only — neither has a `defaultRequired` because neither accepts user input. The type system blocks "mark this Section Header required" at compile time. Conditions with `effect: 'require' | 'not_require'` whose owner is a non-requirable field fail builder validation (§2 rules).

### 1.3 Per-type field shapes

```ts
interface TextField extends RequirableFieldBase {
  type: 'text';
  config: {
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    prefix?: string;
    suffix?: string;
  };
}

interface TextareaField extends RequirableFieldBase {
  type: 'textarea';
  config: {
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
    rows?: number;
  };
}

interface NumberField extends RequirableFieldBase {
  type: 'number';
  config: {
    min?: number;
    max?: number;
    decimalPlaces: 0 | 1 | 2 | 3 | 4;  // default 0
    prefix?: string;
    suffix?: string;
  };
}

interface DateField extends RequirableFieldBase {
  type: 'date';
  config: {
    prefillToday: boolean;
    minDate?: string;  // YYYY-MM-DD (C3)
    maxDate?: string;
  };
}

interface SelectOption {
  id: string;     // stable across renames; used in conditions + values
  label: string;
}

interface SingleSelectField extends RequirableFieldBase {
  type: 'single_select';
  config: {
    options: SelectOption[];
    displayType: 'radio' | 'dropdown' | 'tiles';
  };
}

interface MultiSelectField extends RequirableFieldBase {
  type: 'multi_select';
  config: {
    options: SelectOption[];
    minSelections?: number;
    maxSelections?: number;
  };
}

interface FileField extends RequirableFieldBase {
  type: 'file';
  config: {
    allowedTypes: string[];   // e.g. ['.pdf', '.jpg']
    maxFiles: number;
  };
}

interface SectionHeaderField extends BaseFieldShared {
  type: 'section_header';
  config: {
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl';  // H4/H4/H3/H2/H2 per H4
  };
}

interface CalculationField extends BaseFieldShared {
  type: 'calculation';
  config: {
    sourceFieldIds: string[];                   // Number field IDs
    aggregation: 'sum' | 'average' | 'min' | 'max';
    decimalPlaces: 0 | 1 | 2 | 3 | 4;           // default 0
  };
}

type Field =
  | TextField
  | TextareaField
  | NumberField
  | DateField
  | SingleSelectField
  | MultiSelectField
  | FileField
  | SectionHeaderField
  | CalculationField;
```

---

## 2. Conditions

Discriminated union keyed on `operator`. Each operator variant declares its own `value` shape, including the tuple for `number_within_range`.

```ts
type Effect = 'show' | 'hide' | 'require' | 'not_require';

interface ConditionMeta {
  targetId: string;   // referenced field's id
  effect: Effect;
}

type Condition = ConditionMeta & (
  // Text + textarea targets
  | { operator: 'text_equals'; value: string }
  | { operator: 'text_not_equals'; value: string }
  | { operator: 'text_contains'; value: string }
  // Number targets (also used when target is a Calculation — its value is numeric)
  | { operator: 'number_equals'; value: number }
  | { operator: 'number_gt'; value: number }
  | { operator: 'number_lt'; value: number }
  | { operator: 'number_within_range'; value: [number, number] }   // [min, max] inclusive
  // Single Select targets
  | { operator: 'select_equals'; value: string }       // SelectOption.id
  | { operator: 'select_not_equals'; value: string }
  // Multi Select targets
  | { operator: 'multi_contains_any'; value: string[] }   // SelectOption.ids
  | { operator: 'multi_contains_all'; value: string[] }
  | { operator: 'multi_contains_none'; value: string[] }
  // Date targets
  | { operator: 'date_equals'; value: string }            // YYYY-MM-DD
  | { operator: 'date_before'; value: string }
  | { operator: 'date_after'; value: string }
);

type ConditionOperator = Condition['operator'];
```

### Validation rules (builder + load-time)

| Rule | When | Outcome |
|---|---|---|
| `targetId !== ownerFieldId` | builder save | block |
| target field exists in template | builder save & load | block / flag stale |
| `operator ∈ registry[target.type].operators` | builder save & on target type change | flag in UI, "Reset condition" affordance |
| owner extends `RequirableFieldBase` if `effect ∈ { 'require', 'not_require' }` | builder save | block |
| Calc field's `sourceFieldIds` ⊆ Number fields in same template | builder save & on field type change | flag, auto-prune (D3-style cascade) |
| no cycles in the condition dependency graph (chains of `targetId` references) | builder save | block with inline error: *"This condition would create a loop: A → B → A. Pick a different target."* |
| no cycles in the condition dependency graph (re-validation against persisted data) | data load | mark template `valid: false`; quarantine in templates list with *"Invalid conditional logic — open in builder to fix."*; "New Response" disabled until repaired |

Stale conditions don't crash the engine — at evaluation time we narrow defensively (§7) and skip conditions whose target type no longer matches. Builder UI is the primary place we surface and fix them.

**Load-time cycle validation.** Cycle blocking at builder save protects against new edits but not against old data, manual localStorage edits, devtools tampering, or migration bugs. `load()` re-runs cycle detection on every template; templates with cycles are flagged invalid and surfaced in the templates list with a fix-in-builder affordance. The engine also has a last-resort defensive fallback (§7 "Cycle defense at runtime") — even if a corrupt template slips past load-time validation, the app does not crash; it falls back to all-default visibility/required. *Trust nothing from storage* — both layers are required.

---

## 3. Values

```ts
type Values = Record<string, unknown>;   // fieldId → value
```

Per-field runtime shape (enforced by registry, not by `Values` type):

| Field type | Value shape | Empty representation |
|---|---|---|
| `text`, `textarea` | `string` | absent from record |
| `number` | `number` (finite) | absent (NaN/empty input not stored) |
| `date` | `string` `YYYY-MM-DD` | absent |
| `single_select` | `string` (`SelectOption.id`) | absent |
| `multi_select` | `string[]` (`SelectOption.ids`) | absent |
| `file` | `FileMetadata[]` | absent |
| `section_header` | never present | — |
| `calculation` | `number` (computed) | absent if no valid sources |

```ts
interface FileMetadata {
  filename: string;
  size: number;
  type: string;
}
```

`Values` is intentionally `Record<string, unknown>` — a fully-typed map needs literal-typed keys we don't have at compile time. Narrowing happens at access points via small helpers (`getNumber(values, fieldId): number | undefined`, etc.).

---

## 4. Templates and instances

```ts
interface Template {
  id: string;
  title: string;
  fields: Field[];      // array order = form order
  createdAt: string;    // ISO
  modifiedAt: string;
}

interface Instance {
  id: string;
  templateId: string;
  templateSnapshot: Template;            // deep copy at submission time (D4)
  values: Values;                        // visible field values + computed calc results for visible calcs (post-filter); hidden fields stripped
  visibility: Record<string, boolean>;   // visibility map at submit time, all fields included
  submittedAt: string;
}
```

Snapshot is a full structural copy — not a version pointer, not a diff. CSV's union-of-snapshots strategy reads `Object.values(instances).map(i => i.templateSnapshot.fields)` and dedupes by field ID.

**Live → submitted lifecycle.** During fill mode, values live in component / Zustand state; hidden values are preserved in memory per A2 so toggling a condition back doesn't lose work.

**At submit:**
1. Engine produces `{ computedValues, visibility, required }` from current `memoryValues`.
2. Run `validateForm`. Block submit if errors.
3. Build `submittedValues = filter({ ...memoryValues, ...computedValues }, visibility)` — keep entries only where `visibility[fieldId] === true`. **Computed calc results for visible calcs are merged in.**
4. Persist `Instance` with `values: submittedValues` and `visibility` (the full map from step 1).

**On re-render (instance view, PDF re-download, CSV row):**
Iterate `templateSnapshot.fields` and use `instance.visibility` directly:
- `visibility[id] === false` → skip the field entirely (hidden, not in submission)
- `visibility[id] === true` and `id in values` → render the stored value
- `visibility[id] === true` and field absent from `values` → visible-but-empty; render `—` per E2

**No engine call on re-render.** This was the original design intent ("engine is pure, re-render is deterministic") but had a real bug surfaced by Codex round 2: stripping hidden source values from `submittedValues` would change calc inputs at re-render time, producing different aggregates than what the user submitted (e.g., `T = sum(A, B, C_hidden) = 60` at submit becomes `T = sum(A, B) = 30` on re-download). Storing `visibility` + computed calc results explicitly makes re-render a pure display function, fixes the bug, and disambiguates *hidden* from *visible-but-empty* — the latter renders `—`, the former is skipped entirely.

---

## 5. localStorage shape

```ts
const CURRENT_VERSION = 1;

interface StoredData {
  version: number;
  templates: Record<string, Template>;
  instances: Record<string, Instance>;
}

type Migration = (data: unknown) => unknown;   // `unknown` forces explicit narrowing — input is untyped JSON
type Migrations = Record<number, Migration>;   // migrations[N] turns vN data into vN+1
```

`load()` runs migrations once at app boot. From then on, the app reads from in-memory state; `save()` re-stamps `CURRENT_VERSION` on every write. Failure modes: future-version data → throw + error UI; missing migration → throw with message; JSON parse failure → empty state + log.

---

## 6. Registry contract

The thing that lets us add an 11th field type without editing 6 files.

```ts
interface FieldTypeModule<F extends Field = Field> {
  type: F['type'];
  valueType: 'string' | 'number' | 'string[]' | 'date' | 'file[]' | 'none';
  capturesValue: boolean;          // true except 'section_header'
  canBeCalcSource: boolean;        // true only for 'number'
  operators: ConditionOperator[];  // valid operators when THIS type is the condition TARGET

  defaultConfig: F['config'];

  renderer: React.FC<FieldRendererProps<F>>;
  configEditor: React.FC<ConfigEditorProps<F>>;
  validator: (value: unknown, config: F['config'], ctx: ValidatorContext) => ValidationError[];
  pdfRenderer: (field: F, value: unknown) => React.ReactNode;   // print-region JSX
  csvSerializer: (field: F, value: unknown) => string;
}

interface FieldRendererProps<F extends Field> {
  field: F;
  value: unknown;                  // narrow inside renderer using valueType
  onChange: (next: unknown) => void;
  isRequired: boolean;             // resolved from default + active conditions
  errors: ValidationError[];
  disabled?: boolean;              // calc renderer always disabled
}

interface ConfigEditorProps<F extends Field> {
  config: F['config'];
  onChange: (next: F['config']) => void;
  // For condition-target dropdowns and calc-source dropdowns
  allFields: Field[];
  ownerFieldId: F['id'];
}

interface ValidatorContext {
  isRequired: boolean;
  // intentionally minimal — extend (e.g., allValues) when cross-field rules appear
}

interface ValidationError {
  rule: 'required' | 'min_length' | 'max_length' | 'min' | 'max'
      | 'min_selections' | 'max_selections' | 'min_date' | 'max_date'
      | 'allowed_types' | 'max_files' | 'invalid_format';
  message: string;
}

// Mapped type — pins each FieldType key to its specific FieldTypeModule.
// `Record<FieldType, FieldTypeModule>` allowed any module under any key, losing the link between key and field type.
type Registry = {
  [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>>;
};
```

### Per-type registry table (the source of truth for field-type-dependent behavior)

| `type` | `valueType` | `capturesValue` | `canBeCalcSource` | `operators` |
|---|---|---|---|---|
| `text` | `string` | true | false | `text_equals`, `text_not_equals`, `text_contains` |
| `textarea` | `string` | true | false | `text_equals`, `text_not_equals`, `text_contains` |
| `number` | `number` | true | **true** | `number_equals`, `number_gt`, `number_lt`, `number_within_range` |
| `date` | `date` | true | false | `date_equals`, `date_before`, `date_after` |
| `single_select` | `string` | true | false | `select_equals`, `select_not_equals` |
| `multi_select` | `string[]` | true | false | `multi_contains_any`, `multi_contains_all`, `multi_contains_none` |
| `file` | `file[]` | true | false | `[]` (not a sensible target — see §8 Q4) |
| `section_header` | `none` | **false** | false | `[]` |
| `calculation` | `number` | true | false | `number_equals`, `number_gt`, `number_lt`, `number_within_range` |

**CSV writer iteration rule:** writer iterates fields where `capturesValue: true`. Non-capturing types (Section Header) are skipped at the writer level — their `csvSerializer` is never called. PDF rendering is a separate code path: Section Header has a `pdfRenderer` (it has visual presence as a section break) but no value to serialize.

**Adding an 11th field type** is ~5 type-definition touch points (`FieldType` union, new field interface, `Field` discriminated union, new module file, registry-map registration) — *not* 6 surgeries scattered across unrelated business logic. Engine, condition editor, calc-source dropdown, CSV serializer, and PDF renderer all read from the registry, so they don't grow new branches. The cost is in the type system, where it belongs.

---

## 7. Engine signature (for sign-off; impl follows)

```ts
function evaluate(
  rawValues: Values,
  template: Template,
  registry: Registry,
): EngineResult;

interface EngineResult {
  computedValues: Values;                  // rawValues + computed calc results
  visibility: Record<string, boolean>;     // fieldId → visible
  required: Record<string, boolean>;       // fieldId → required (false for non-RequirableFieldBase)
}

function validateForm(
  template: Template,
  values: Values,
  engineResult: EngineResult,
  registry: Registry,
): Record<string, ValidationError[]>;     // fieldId → errors; only fields with errors are present
```

**Pass 1 — Calculation.** For each `CalculationField`, aggregate over `config.sourceFieldIds` looking up each source's *raw* value in `rawValues`. Filter `Number.isFinite`. Aggregate per `aggregation`. If no valid sources, omit from `computedValues` (rendered as `—` per H5). **No filtering by source visibility** — B2 dropped, calc aggregates over all source values regardless of which sources are conditionally hidden. The calc field itself can still be hidden by its own condition; if hidden, it is excluded from submission/PDF/CSV.

> ⚠️ **Single-source calc caveat.** A calc whose only source is one Number field will, by construction, expose that source's value when the calc is visible (sum/avg/min/max of one number = that number). If you need the source kept private, hide the calc with the same condition that hides the source. Builder UI should warn on single-source calcs. The engine cannot prevent this — it's a property of one-element aggregation.

**Pass 2 — Conditions, in topological order with effective-value stripping.**

Build a dependency graph:
- **Nodes:** every field in the template.
- **Edges:** for each condition on field `X` with target `Y`, add edge `Y → X`.
- Calc-source links are NOT condition edges — calcs read raw values in Pass 1; the calc's *output* participates in the condition graph only as a potential target.
- Cycles are blocked at template save time AND re-validated at load time (§2). Engine assumes DAG for the happy path but defensively detects cycles as a last resort — see "Cycle defense at runtime" below.

Initialize `effectiveValues = { ...computedValues }` (note: `computedValues` is `rawValues` plus calc results from Pass 1). Iterate fields in topological order. For each field:
1. **Group conditions by effect type** (`show`, `hide`, `require`, `not_require`).
2. **For each effect group, determine if it fires:**
   - **Empty group → does NOT fire.** Empty Hide group does not hide; empty Show group does not show. Guard with `effects.X.length > 0` before combining — `[].every(x => x) === true` is the trap, and would otherwise hide every field by Hide-wins precedence on initial load.
   - **Non-empty group:** combine via field's `conditionLogic`:
     - `OR` → any condition matches → group fires
     - `AND` → all conditions match → group fires
   - `conditionLogic` applies **per effect group, not globally.** A field with two Show conditions and one Hide condition uses `conditionLogic` to combine the Shows; the single Hide is its own group (length 1, AND/OR irrelevant).
3. **Resolve cross-effect with deterministic precedence:** Hide > Show, Not-Required > Required.
4. Fields with no firing rules fall back to `field.defaultVisible` / `field.defaultRequired`.
5. If the field is hidden, **delete its entry from `effectiveValues`** so downstream conditions read it as absent.

For Section Header / Calculation, `required` is always `false`.

Topological order with effective-value stripping is what prevents the cascade bug: a field hidden upstream propagates as "absent" to all downstream conditions. The earlier two-pass-without-cascade framing silently passed preserved-but-hidden values forward — a real correctness bug surfaced by Codex review.

**Operator semantics on absent values.** When a condition's target is absent from `effectiveValues` (never answered or hidden upstream), all comparison operators return `false` — including `not_equals` and `multi_contains_none`. The user-facing principle: *unanswered fields don't trigger logic; defaults apply.* Full operator semantics (text trim + case-insensitivity, numeric raw vs rounded, date lex compare) live in decision-log §A6.

**Stale-condition defense.** If a condition's `targetId` is missing or the target's type doesn't match the operator namespace, the condition is skipped (logged, not thrown). Builder validation should have caught it; engine doesn't crash.

**Cycle defense at runtime.** Cycles are blocked at builder save (§2) AND re-validated at load (§2 "Load-time cycle validation"). Engine still defends as a last resort — old data, manual localStorage edits, migration bugs, or devtools tampering can sneak invalid templates past both boundaries. If `topologicalSort` detects a cycle (Kahn's algorithm: nodes with in-degree > 0 remaining after the queue is drained), the engine **logs the failure and returns** an `EngineResult` with `visibility[id] = field.defaultVisible` and `required[id] = field.defaultRequired` (false for non-Requirable fields) for every field. `computedValues` from Pass 1 is preserved (Pass 1 doesn't depend on the condition graph). **The engine never throws.** UI handles "broken template" state gracefully — fillers see the form in default state, not a crash. Surfaced by Codex round 2 (P3).

`validateForm` is a sibling helper, not part of `evaluate`. Called on submit (full pass, scroll to first error), on blur after first visit, and on input for already-error'd fields (J1's real-time clearing). Iterates `template.fields`, skipping fields where `capturesValue: false` (Section Header) or `visibility[fieldId] === false` (hidden by condition — A2's "hidden never validated"). For each remaining field, calls `registry[field.type].validator(values[field.id], field.config, { isRequired: required[field.id] })`. Returns `Record<fieldId, ValidationError[]>` keyed only by fields with at least one error. Renderer reads `errors[fieldId] ?? []` and pipes through to props.

---

## 8. Sign-off — decisions confirmed

All nine questions resolved. Q7 reversed (validator now returns `ValidationError[]` with `ValidatorContext`). Q4 and Q5 noted as deliberate scope choices. Q9 extended to multi-select / file empty arrays for consistency.

| Q | Decision | Reasoning |
|---|---|---|
| Q1 | `decimalPlaces` required-with-default 0 on Number / Calculation | One less optional check at render time |
| Q2 | `SelectOption.id` UUID, distinct from `label` | Renaming options can't break conditions |
| Q3 | `Values = Record<string, unknown>` with helper narrowing | Fully-typed map needs literal keys we don't have at compile time |
| Q4 | File is **not** a condition target (`operators: []`) | Scope-aligned with spec table — File isn't listed; don't invent |
| Q5 | Calculation **is** a condition target, reusing Number operators | Extends spec table; A5 explicitly allows "show this if Total > 1000" |
| Q6 | Section Header has `defaultVisible` | "Show Spouse Info section if MaritalStatus = Married" is real |
| Q7 | Validator returns `ValidationError[]` with `ctx: ValidatorContext` | Multiple errors can co-occur; renderer chooses display; no merging across code paths |
| Q8 | Stale conditions skipped at runtime, surfaced in builder UI | Engine doesn't crash; builder is the fix surface |
| Q9 | Empty = absent from `Values` (including empty multi_select / file arrays) | Single representation; `Number.isFinite` works; no off-by-one bugs |

Next phase: scaffold (Vite + React + TS, strict tsconfig, no `any`) → engine + unit tests against the §7 signatures → storage → registry modules → UI.
