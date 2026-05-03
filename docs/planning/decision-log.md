# Form Builder — Decision Log

> Living document. Each open question gets a **call** and **reasoning**.
> This file becomes the *Architectural Decisions* section of the README at submission time.

Legend:
- 🔴 **Blocker** — must decide before any code
- 🟡 **Phase-gated** — decide before the relevant phase
- 🟢 **Polish** — defer if short on time
- 💡 **Claude's recommendation** — my opinion; reject freely

---

## A. Conditional Logic

### A1. 🔴 Multiple conditions on the same field — AND or OR?
**Why it matters:** the brief explicitly asks this to be documented. Affects evaluator complexity and UX.
**Options considered:**
- (A) All AND — every condition must be true for the effect to apply
- (B) All OR — any condition triggers the effect
- (C) Per-field toggle — builder picks AND/OR in field config (default OR)
- (D) Per-effect group — Show/Hide rules ANDed within type, but Show wins over Hide

✅ **Decision: (C) — per-field AND/OR toggle, default OR. Across effect types, deterministic precedence: Hide wins over Show, Not-Required wins over Required.**

**Reasoning:** OR matches builder intuition for the common case (Typeform, Google Forms convention) — *"show this if reason is Other, or if topic is Bug."* But AND is needed for narrowing scenarios — *"show only if status is Active AND tier is Enterprise."* Both patterns are real. A single radio in field config gives full expressive power for ~30 minutes of work.

For cross-effect precedence, Hide-wins is the safer call: an explicit Hide rule signals deliberate intent that shouldn't be overridden by a Show rule. Not-Required-wins follows the same principle — a "Mark Not Required" rule is typically an explicit override of a default-required field (e.g., *"don't require this if user says 'prefer not to answer'"*), so respecting it preserves builder intent.

**Scope of `conditionLogic` (added after Codex round 2).** The AND/OR toggle applies **per effect group, not globally**. A field with two Show conditions and one Hide condition uses `conditionLogic` to combine the Shows; the single Hide is its own group (length 1, AND/OR irrelevant). This matches the deterministic-precedence model — each effect type evaluates independently, then resolves via Hide > Show / Not-Required > Required.

**Empty effect groups are inactive.** A field with no Hide conditions does NOT have a "vacuously true" empty Hide group that fires. The implementation must guard against `[].every(x => x) === true`, which would otherwise hide every field by default via Hide-wins precedence on initial load. The engine evaluates `effects.X.length > 0 && combine(effects.X)` per group. Codex round 2 (P4) caught this — easy to miss because `Array.prototype.every` returning true on empty arrays is the standard JavaScript semantics.

**Worked example.** Field B with `conditionLogic: 'OR'`, `defaultVisible: true`, two Show conditions, one Hide condition:
- Show group has 2 entries → combine via OR.
- Hide group has 1 entry → AND/OR irrelevant for length-1 groups.
- Require / Not-Required groups are empty → inactive (don't fire).
- If the Hide condition matches → Hide fires → field hidden (Hide-wins precedence).
- If neither Show condition matches AND the Hide condition doesn't match → no rule fires → fall back to `defaultVisible: true` → visible.

---

### A2. 🔴 Hidden field — clear value or preserve it?
**Why it matters:** affects state shape, PDF export, and re-submission UX.
**Options considered:**
- (A) Preserve — value stays in state, just not rendered/exported
- (B) Clear — value wiped when field becomes hidden
- (C) Preserve in state, but exclude from submission and PDF

✅ **Decision: (C) — preserve during editing, exclude from submission and PDF.**

**Reasoning:** The spec mandates exclusion at submission/export time, so that part is non-negotiable. Within editing state, preserving values prevents data loss from accidental toggles — a real UX pain point in form builders. The engine's submission view becomes a pure transformation `(values, visibilityMap) → submissionData`, used identically by submit logic and PDF generator. Single source of truth for "what counts as submitted."

---

### A3. 🔴 Forward references — can a condition target a field that appears *later* in the form?
**Why it matters:** affects builder UX and evaluation order. The brief is silent.
**Options considered:**
- (A) Forbid — target field must come earlier in the order; reorders that would create forward refs are blocked
- (B) Allow — order-independent evaluation
- (C) Allow but warn in builder UI

✅ **Decision: (B) — allow forward references. Engine evaluates by ID lookup, not iteration order.**

**Reasoning:** The conditional engine is a pure function `(values, configs) → state` that does ID lookups, not ordered iteration — forward references work correctly with no extra cost. Allowing them gives the builder freedom to structure forms by logical grouping rather than dependency order, which is the more common authoring need.

**Alternative considered — (A) forbid forward references.** Stronger guarantee that fillers see triggers before dependent questions, since the dependent field is always physically below its trigger. Cost: builder UI must validate every reorder and every new condition against form order, blocking operations that would create forward refs. Defensible for forms with novice fillers — documented here as the runner-up. The "filler scrolls past a hidden trigger" concern that motivates (A) is partly self-correcting in practice: when the trigger is answered, the dependent field appears, and the filler sees it on their next pass.

**Cycle blocking (added after Codex review).** Forward refs are allowed, but **cycles** in the condition dependency graph are blocked at template save time. When a builder adds or edits a condition, the engine builds the condition graph (edges from each condition's target to its owner) and rejects any save that would create a cycle. Inline error: *"This condition would create a loop: A → B → A. Pick a different target."* Self-references were already blocked. The DAG guarantee is what lets the engine evaluate conditions in topological order with effective-value stripping (see A5).

---

### A4. 🔴 Default state vs condition — precedence?
**Why it matters:** the spec defines defaults *and* conditions. What if both apply?
**Options considered:**
- (A) Conditions always override defaults when active
- (B) Defaults apply only when no rule matched; conflicts resolved by deterministic precedence
- (C) Last-declared rule wins (declaration order)

✅ **Decision: (B) — defaults apply when no rule matches. When rules conflict, deterministic precedence: Hide > Show, Not-Required > Required.**

**Reasoning:** Tied to A1's cross-effect precedence rules. Deterministic resolution is preferable to declaration-order — builders shouldn't have to think about rule ordering to get correct behavior. Defaults are the fallback state, conditions override, and conflicts resolve by the principle of "respect the explicit override." Hide wins because explicitly hiding is intentional. Not-Required wins because it's almost always an intentional opt-out from a stricter default.

---

### A5. 🔴 Engine evaluation model — single-pass, two-pass, or fixed-point?
**Why it matters:** Calculation fields are derived values. Conditions can target Calculation fields (e.g. *show this if Total > 1000*). The order in which the engine computes calcs vs evaluates conditions determines whether conditions see fresh or stale calc values.
**Options considered:**
- (A) Single-pass — iterate fields once, do everything per field. Order-dependent bugs.
- (B) Fixed-point iteration — re-run until stable, with cycle detection. Robust but heavyweight.
- (C) Two-pass ordered evaluation — Pass 1 computes all calc values, Pass 2 evaluates conditions in **topological order** over the condition dependency graph, using **effective values** (hidden fields treated as absent for downstream conditions).

✅ **Decision: (C) — two-pass: calc pass, then conditions in topological order with effective-value stripping.**

**Evolution of this decision (Codex review).** The original framing of (C) said "Pass 2 doesn't need to iterate or cascade — one sweep produces the final visibility/required map." That was wrong. Codex caught a chained-conditions cascade bug: with A2 (preserve hidden values), a downstream condition can read a preserved-but-hidden value from an upstream-hidden field, leaving the downstream field incorrectly visible. Example: A→hides→B (B's value preserved); C's condition reads B's preserved value and stays visible. The fix is topological iteration with effective-value stripping — when a field becomes hidden in Pass 2, its entry is removed from the running `effectiveValues` map so downstream conditions see it as absent.

**Reasoning:**
1. Calc fields cannot depend on other calc fields → Pass 1 is one level deep, no topological sort needed there.
2. With B2 dropped (calc aggregates over all sources regardless of source visibility), Pass 1 has no dependency on visibility — calc values are pure functions of raw inputs.
3. Pass 2 is topological over the condition dependency graph (edges: `target → owner`). Cycles are blocked at template save time (A3 cycle-blocking note), so the graph is a DAG and topological sort always succeeds.
4. Effective-value stripping is what prevents the cascade bug; without it, hidden upstream values bleed into downstream conditions.

The engine remains a single pure function: `evaluate(rawValues, template, registry) → { computedValues, visibility, required }`. Always converges in one ordered run. No fixed-point. Topological sort is O(V+E), trivial at form-builder scale.

**Why not fixed-point?** With B2 dropped and cycles blocked at save time, no real cycle can exist at runtime. Fixed-point iteration would add complexity (cycle detection, iteration cap, divergence handling) for cases the validation rules already forbid.

---

### A6. 🔴 Operator semantics — what does each operator actually do?
**Why it matters:** the spec defines operator names but not their evaluation rules — case sensitivity, whitespace handling, behavior on absent values, raw-vs-rounded comparison for Number, date format. These are decisions, not lookups. Added after Codex review surfaced the gap.

**Decisions:**

| Operator | Rule |
|---|---|
| **All operators, target absent** | **`false`** — uniform rule across all operators including `not_equals` and `multi_contains_none`. Principle: *unanswered fields don't trigger logic; defaults apply.* See note below on the vacuous-truth edge cases. |
| `text_equals`, `text_not_equals` | Trim leading/trailing whitespace on both target value and condition value, then compare **case-insensitively**. *"yes "* equals *"YES"*. |
| `text_contains` | Trim, case-insensitive substring match. |
| `number_equals`, `number_gt`, `number_lt`, `number_within_range` | Compare against the **raw** user-entered numeric value, not the rounded display value. If a Number field has `decimalPlaces: 0` and the user types 99.9 (displays as "100"), a condition `number_gt 99.9` evaluates against 99.9, returning false. Document this — it surprises users. `number_within_range [a, b]` is inclusive on both ends. |
| `select_equals`, `select_not_equals` | Compare option IDs (not labels). Renaming an option label doesn't break the condition. |
| `multi_contains_any` | True if intersection between target's selected option IDs and condition value is non-empty. |
| `multi_contains_all` | True if condition value is a subset of target's selected option IDs. |
| `multi_contains_none` | True if intersection is empty AND target has at least one selection. **False if target is absent** (per uniform absent rule). |
| `date_equals`, `date_before`, `date_after` | Lexicographic string comparison on `YYYY-MM-DD`. No timezone math (per C3). |

**Note on vacuous truth.** `not_equals X` against an absent target *could* be argued to evaluate true ("absent ≠ X"). Same for `multi_contains_none []` against absent ("the empty selection contains none of anything"). We pick **false** uniformly because: (1) the user-facing rule is simpler — *"conditions on unanswered fields don't fire, defaults apply"* — and (2) the alternative ("skip absent") complicates AND/OR combination, since "skip" is a third state alongside true/false. The trade-off is documented; the choice is consistent.

**Implementation:** these rules live in the engine's condition evaluator, indexed by operator. Each operator is one small function. No conditional sprawl in the engine — operator-by-operator pattern matches the discriminated `Condition` union (TYPES_PROPOSAL.md §2).

---

## B. Calculation Field

### B1. 🔴 Source field empty or invalid — how does it count?
**Options considered:**
- (A) Treat as 0
- (B) Skip — exclude from aggregation
- (C) Calculation shows blank until all sources have values

✅ **Decision: (B) — skip empty and invalid (NaN) source values. If no valid sources remain, render the calculation as `—` instead of `0`.**

**Reasoning:** Skipping is the only consistent rule across all four aggregations. For Sum, treating empty as 0 happens to match (additive identity). But for Average, Min, and Max, treating empty as 0 produces wrong answers — `avg(5, 0, 10) = 5` vs the correct `avg(5, 10) = 7.5`; `min(5, 0, 10) = 0` vs the correct `min(5, 10) = 5`. One rule covers all four.

The `—` placeholder when no valid sources exist signals "not yet computable" — a literal `0` would be a misleading real number that looks like a real answer. Implementation-wise, defensively check `Number.isFinite(value)` before including in any aggregation.

---

### B2. 🔴 Source field hidden by condition — include in calculation?
**Options considered:**
- (A) Include — calc aggregates over all source values regardless of visibility
- (B) Exclude — hidden = doesn't exist for this submission, treat identically to empty

❌ **Original decision (B) — DROPPED after Claude Code review.**

✅ **Final decision: (A) — calc aggregates over all source values regardless of source visibility.**

**Reasoning for the reversal:** The original (B) decision combined with A5 (conditions can target calc values) creates an oscillation cycle: calc aggregates only visible sources → calc value drives a condition → condition hides a source → recompute calc → source unhidden → recompute again. The cycle is a fixed-point problem with no clean termination. Dropping B2 eliminates the cycle without introducing fixed-point machinery. Excel-style aggregation (sum over all sources regardless of visibility) is also the more familiar mental model for users.

**The leakage concern is real but partially mitigated:**
- The calc field can still be hidden by its own condition; if the calc is hidden, it's excluded from submission/PDF/CSV.
- **Aggregates can be reverse-engineered when one source is hidden.** With one hidden source: `sum` and `average` allow exact reverse-engineering (`hidden = total − sumOfVisible` for sum; analogous for average). `min` / `max` directly expose the hidden source's value when the hidden source is the extreme.
- **With two or more hidden sources**, only the aggregate of the hidden subset can be derived, not individual values. So multi-hidden helps but doesn't eliminate the concern.
- Codex round 2 caught the original *"multi-source prevents leakage"* claim as overstated; the statement above replaces it.

**Implication: builder warning rule.** Warn on **any** calc whose source list contains at least one field that *can become hidden* — i.e., a source field with `defaultVisible: false`, OR a source field that has at least one Hide condition attached to it (effect = `hide`). The warning suggests the same fix in every case: hide the calc with the same condition that hides the source. This is a static check on the template, computable in O(fields × conditions) — trivial. Originally scoped to single-source calcs; expanded after P2.

**Alternative considered:** drop calc-as-condition-target instead of dropping B2. Codex round 1 proposed this as the symmetric fix. We kept calc-as-target because *"show this field if Total > 1000"* is the highest-value condition pattern with calculation fields, and the leakage trade-off is acceptable with the warning rule documented.

---

### B3. 🔴 Source field deleted from the form — what happens to the calculation?
**Why it matters:** also applies to fields referenced as condition targets — same dependency-graph problem.
**Options considered:**
- (A) Silent auto-cleanup — remove from sources, recompute
- (B) Block deletion outright
- (C) Allow deletion, mark calculation as broken until fixed
- (D) Confirmation modal listing all dependents, then auto-cleanup on confirm

✅ **Decision: (D) — confirmation modal listing all dependents (calculation sources, condition targets), then auto-cleanup on confirm.**

**Reasoning:** Same pattern as deleting a column referenced by formulas in Excel/Sheets — explicit, informative, non-blocking. (A) silently mutates form behavior (bad). (B) blocks legitimate edits. (C) leaves the form in a broken state requiring manual cleanup. (D) tells the builder exactly what's about to break, lets them decide, and cleans up so the form is always in a valid state post-confirm.

Note: this only applies to template editing. Submitted instances are immune (see D2 + D4 — instances are snapshots).

---

## C. Field-level details

### C1. 🟡 Single Line Text vs Number — share the prefix/suffix component?
**Why it matters:** component design rubric. Both have prefix/suffix; behavior differs slightly.

✅ **Decision:** Shared `<AffixedInput>` primitive that takes `prefix`, `suffix`, and a typed `inputType`. Single Line Text and Number renderers each wrap it with type-specific input handling.

**Reasoning:** Demonstrates good composition for the component-design rubric. Reuses one primitive across two field types instead of duplicating the affix layout logic.

---

### C2. 🟡 Single Select — pre-select first option or start empty?
**Options considered:**
- (A) Always empty until user picks
- (B) Pre-select first option
- (C) Configurable per field

✅ **Decision: (A) — always empty until user picks.**

**Reasoning:** Pre-selecting hides the "required" intent and biases user responses. Matches Google Forms behavior. Adding a per-field toggle (C) is over-engineered for a take-home.

---

### C3. 🟡 Date — timezone and format
**Options considered:**
- (A) ISO 8601 datetime storage, browser-locale display
- (B) Store and display as `YYYY-MM-DD` strings only — no time, no timezone

✅ **Decision: (B) — `YYYY-MM-DD` strings throughout.**

**Reasoning:** Eliminates timezone ambiguity entirely. Min/max bounds use the same format with lexicographic comparison (which works correctly for ISO dates). No date library needed — string comparison + native `<input type="date">` handles everything.

---

### C4. 🟢 File Upload — what shows in the PDF?
**Why it matters:** spec says file contents can't be embedded.
**Options considered:**
- (A) Comma-separated filenames: `Files attached: report.pdf, photo.jpg, notes.txt`
- (B) Filename + size list
- (C) Just count: `[3 files]`

✅ **Decision: (A) — comma-separated filenames. Truncate at 5 files with `... and N more`. No file sizes (clutter). No links (content not embeddable per spec).**

**Reasoning:** Most informative without bloating the PDF. Filenames carry meaning; sizes don't. Same rule applies to the CSV export (pipe-separated to avoid column collision).

---

## D. Persistence

### D1. 🔴 localStorage schema versioning + storage layout
**Options considered:**
- (A) Bare data, no version field
- (B) Single top-level key with version field and migration runner
- (C) Per-entity keys (`template:abc`, `instance:xyz`) with per-key versioning

✅ **Decision: (B) — single localStorage key (`formBuilder`) holding `{ version, templates, instances }`. Migrations run inside `load()` at app boot.**

**Reasoning:** Single-key gives atomic writes and centralized version management. 5MB localStorage budget easily holds hundreds of templates with thousands of instances. Per-entity keys would add bookkeeping (deleting a template means iterating to find its instances) for no real benefit at this scale.

**Schema shape:**
```ts
{
  version: 1,
  templates: Record<string, Template>,   // keyed by ID for O(1) lookup
  instances: Record<string, Instance>,   // keyed by ID for O(1) lookup
}
```
`templates` and `instances` are objects keyed by ID, not arrays — supports direct lookup from URL params and partial updates without re-saving collection order. Within a single `Template`, `fields: Field[]` IS an array, because field order is meaningful (it IS the form order).

**Migration timing — when does it run?**
- **Once per app boot.** The `load()` function reads localStorage, parses JSON, checks `data.version`, and runs migrations one-by-one until current. Result is loaded into in-memory state (Zustand).
- **From boot onward, the app reads from memory, not localStorage.** localStorage is touched only on *writes* — every `save()` persists the full state with the current version stamp.
- **Subsequent boots find current-version data and skip migration entirely** (because save() always writes current-version).

**Migration registry:** `migrations: Record<number, (data: unknown) => unknown>` — empty today, ready to receive `migrations[1]` (v1→v2) when the schema next changes. `unknown` (not `any`) forces explicit narrowing inside each migration — the right way to type untrusted JSON. Even with zero migrations to write today, the framework signals production-readiness in the README and costs ~15 minutes to wire up.

**Failure modes to handle:**
- `data.version > CURRENT_VERSION` (user has newer data than this code expects) → throw, surface error UI; don't silently corrupt
- Missing migration in the chain → throw with explicit message
- JSON parse failure → fall back to empty state, log error

---

### D2. 🔴 Submission immutability
**Options considered:**
- (A) Submitted instances are immutable — view + re-download PDF only
- (B) Submitted instances are editable in place (re-submit overwrites)
- (C) Editable creates new instance — original preserved as historical record

✅ **Decision: (A) — submitted instances are immutable.**

**Reasoning:** Matches the "form response" mental model from Google Forms / Typeform. The spec's language ("submission timestamp," "Re-download PDF") implies submission as an event, not an editable document. Simpler engine, cleaner audit trail. To "fix a typo" the user creates a new response — same workflow as every mainstream forms product.

---

### D4. 🔴 Editing a template after instances exist — propagate or freeze?
**Why it matters:** templates are mutable in Builder Mode. What happens to historical submissions when the template they were filled against changes?
**Options considered:**
- (A) Snapshot at submission — instance deep-copies the template structure into itself; future edits don't affect it
- (B) Reference-only — instance stores `{ templateId, values }`; renders against the live template
- (C) Versioned templates — every edit creates a new version; instances reference a specific version
- (D) Lock template after first instance — force builder to clone for any change

✅ **Decision: (A) — snapshot at submission. Each instance carries a deep copy of the template structure as it existed at submit time.**

**Reasoning:** Historical fidelity is preserved without the complexity of explicit versioning. Storage cost is negligible (~5KB per template structure; well within localStorage's 5MB budget for any realistic instance count). (B) breaks instances when fields are removed from the template — bad. (D) is annoying for builders during the iteration phase. (C) is the "right" production answer but is over-scoped for a take-home.

**Future extension (see "What I'd do with more time"):** evolve (A) into (C) — a versioned templates model where each template edit creates a new version, instances reference a version ID, and the snapshot is replaced by a normalized version lookup. The snapshot model is the seed of that — same data shape, just denormalized for now.

---

### D3. 🟡 Template deletion — what happens to its filled instances?
**Options considered:**
- (A) Cascade delete (with confirmation showing instance count)
- (B) Orphan instances become read-only, accessible from a separate list
- (C) Block template deletion if instances exist

✅ **Decision: (A) cascade delete with confirmation modal.** Modal shows: *"Delete template 'Onboarding'? 14 filled responses will also be deleted. This cannot be undone."*

**Reasoning:** Matches user mental model. (B) introduces a separate "orphan instances" UI for an edge case. (C) is restrictive — builders should be able to delete their own forms.

---

## E. PDF Export

### E1. 🔴 PDF strategy — print CSS or canvas?
**Options considered:**
- (A) `window.print()` + hidden render with `@media print` stylesheet
- (B) `<canvas>` + `toDataURL` + manual PDF assembly
- (C) `Blob` with hand-rolled PDF byte generation

✅ **Decision: (A) — `window.print()` triggered by Download PDF button, with a hidden `#print-region` styled via `@media print`.**

**Reasoning:** Only viable browser-native path. (B) and (C) require generating PDF bytes manually, which is impractical without a library and effectively prohibited by the constraint.

**Implementation shape:**
1. A dedicated `<div id="print-region">` outside the React tree (or rendered via portal) populated with print-friendly markup of the current instance — semantic headings, no buttons, no scrollbars.
2. A print stylesheet:
   ```css
   @media print {
     body > *:not(#print-region) { display: none; }
     #print-region { display: block; }
     /* page-break, margins, typography rules here */
   }
   ```
3. Download PDF button → populate region with current instance data → call `window.print()` → user picks "Save as PDF" in the browser's print dialog.

**Caveat to document in README:** the user must select "Save as PDF" in the browser's print dialog. We cannot directly trigger a `.pdf` file download because that requires PDF byte generation. This two-click flow (button → browser dialog → save) is the expected interaction model when "browser-native APIs only" is the constraint. Reviewers will check we didn't sneak in jsPDF or pdfmake.

**Where the real effort goes:** print typography. Margins, page breaks, font sizes, label/value layout. That's where the rubric's *"real export vs debug dump"* line gets graded — not on the API choice.

**Implementation order — spike before UI scaffolding (added after Codex review).** The print stylesheet gets a throwaway-HTML spike *immediately after type modeling, before any builder/fill UI work*. Three browsers — Chrome, Firefox, Safari — to validate `@page` margin boxes, `counter(page)` (per-page), `page-break-inside: avoid` on field rows, and basic typography. Discover Safari's quirks at hour 1 of PDF work, not hour 7. Findings feed back into K2 (drop "Page X of Y" if `counter(pages)` fails). The full PDF integration (real instance rendering) lands later in the build sequence; the spike just confirms what's reliable.

---

### E2. 🟡 Empty optional fields in PDF
**Options considered:**
- (A) Render label with `—` placeholder
- (B) Omit entirely

✅ **Decision: (A) — render the label with `—` placeholder.**

**Reasoning:** Keeps form structure visible, signals "this was asked, no answer given." Matches real-world form printouts. Hidden fields (per A2) are still excluded entirely — `—` is only for *visible-but-empty*.

---

## F. Builder UX

### F1. 🟡 Save behavior — autosave or explicit Save button only?
**Spec says "Save button"** so explicit Save is the baseline.

✅ **Decision: explicit Save button only + `beforeunload` warning when there are unsaved changes.**

**Reasoning:** Spec literally says "Save button" — adding autosave risks being read as ignoring the requirement. The `beforeunload` warning is a small polish that catches accidental tab-close.

---

### F2. 🟡 Adding a new field — where in the order does it land?
**Options considered:**
- (A) End of the form
- (B) After currently selected field
- (C) Top

✅ **Decision: (B) when a field is selected, (A) otherwise. Auto-select the newly inserted field.**

**Reasoning:** Matches Notion/Linear patterns. Builder is usually iterating around the field they're working on, so inserting after the selection minimizes pointer travel. Falling back to "end of form" when nothing is selected handles the common "I just opened the builder" case.

---

### F3. 🟡 Field reordering — drag-and-drop or up/down buttons?
**Why it matters:** the spec says *"drag-and-drop preferred; up/down buttons are acceptable."* Real polish-vs-time trade-off. Up/down buttons read as "didn't have time" even when functionally equivalent.

**Options considered:**
- (A) `@dnd-kit` with `KeyboardSensor` for accessibility (vertical-only sortable on builder canvas)
- (B) Up/down arrow buttons next to each field row
- (C) Both, with DnD as the primary path

✅ **Decision: (A) — `@dnd-kit/core` + `@dnd-kit/sortable` with `PointerSensor` and `KeyboardSensor`. Vertical-only constraint on the builder canvas.**

**Reasoning:** Spec explicitly prefers DnD. `@dnd-kit` is the modern React DnD library, gets keyboard accessibility for free via `KeyboardSensor` (arrow keys + space — covers the M2 a11y baseline for tile-display Single Select reordering as well, though that's a different concern). Budget: ~2 hours including a11y wiring.

**Fallback:** if behind schedule by Phase 8 (Builder UI), drop to up/down buttons. ~30 minutes to implement. Worth the swap only if the rest of the build is at genuine time risk — the polish difference is real and the rubric calls out "interaction patterns of a modern SaaS product."

**Why not Both (C):** Two reorder paths in one UI is harder to learn, not easier. Pick one and execute well. DnD handles every reorder gesture if implemented properly.

---

## G. Scope addition (beyond spec)
*One feature added beyond the literal spec to demonstrate product thinking. Documented in the README as a deliberate scope choice.*

### G1. Bulk CSV export of all responses for a template
**Why:** Common feature in any forms product (Google Forms, Typeform). Useful for builders who want to analyze responses externally.

✅ **Decision:** Add an "Export responses (CSV)" button on the template detail view. Generates a single CSV with one row per submitted instance.

**Column source — schema reconciliation:**
Options considered:
- (A) Current (live) template's fields as columns
- (B) Union of all instance snapshots' fields, deduped by field ID, ordered by appearance in the most recent snapshot
- (C) Most-recent instance's snapshot

✅ **Choice: (B) — union of all instance snapshots' fields.**

**Reasoning (updated after Codex review).** D4 picks snapshot semantics for instance fidelity — every instance carries the template structure as it existed at submission time. Choosing (A) for CSV silently drops historical data: instances submitted under an older template version lose any columns whose fields have since been removed. That contradicts the snapshot decision. (B) honors the snapshot model: every column that ever existed in any submitted instance appears in the export. Field labels come from the most recent snapshot that still contains the field (handles renames). Ordering follows position in the most recent snapshot, with removed-fields appended.

**Implementation cost:** ~15 minutes more than (A). Read all instances, union the field IDs across each `templateSnapshot.fields`, sort by latest-snapshot-position, then iterate per-instance writing cells (empty cell when the instance's snapshot doesn't include the field).

**Meta columns (always first):** `Instance ID`, `Submitted At` (ISO timestamp), `Template Version` (snapshot's modification date).

**Per-field serialization:**
| Field type | Cell content |
|---|---|
| Single Line / Multi-line Text | escaped string (RFC 4180; wrap in quotes if contains `,`, `"`, or `\n`) |
| Number | numeric value, configured decimal places |
| Date | `YYYY-MM-DD` |
| Single Select | selected option label |
| Multi Select | pipe-separated: `Apple\|Banana\|Mango` (comma collides with column separator) |
| File Upload | pipe-separated filenames |
| Section Header | not a column (no value) |
| Calculation | computed value at submission time, configured decimal places |

**Hidden fields (conditional):** excluded per-instance from the row, consistent with the submitted-data rule.

**Implementation:** hand-rolled CSV string → `Blob` → `URL.createObjectURL` → `<a download>`. No third-party library; CSV escaping is ~20 lines. Browser-native, consistent with the PDF approach.

---

## H. Field-level details

### H1. Min/max character length — what counts?
✅ Count `string.length` after trimming leading/trailing whitespace. Internal whitespace counts. Newlines count. Multi-codepoint emojis count as their JS string length. Document the call. Not a Unicode-correct counter, but defensible.

### H2. Multi Select min — when does it apply?
✅ Only applies when user has provided ≥1 selection (or when the field is required). 0 selections on an optional field is valid. Min = "if you answer, answer with at least N."

### H3. Number field decimal places — restrict input or display?
✅ Accept any input, round half-up at submission and display time. Restricting input is fragile UX (paste from external source breaks). Document this.

### H4. Section Header sizes — semantic heading levels
✅ Map to two real heading levels with font-size variants: `<h2>` for L+XL, `<h3>` for M, `<h4>` for XS+S. Form title is `<h1>`. Better a11y than h1–h5 stacked. Visual differentiation comes from font-size, not heading level.

### H5. Calculation field display in form
✅ Greyed-out background, distinct visual treatment to signal "computed not entered." Show `—` when no valid sources. Numeric value formatted with configured decimal places. Read-only.

---

## I. Builder UX (additional)

### I1. Field selection focus behavior
✅ Click selects → right panel shows config → no scroll-into-view. Click outside any field deselects.

### I2. Duplicate field action — out of scope
✅ Skip for take-home. Mention in "with more time."

### I3. Save validation
✅ Allow saving an empty template (builder mid-iteration). Disable "New Response" button on empty templates so fillers can't open broken forms. **Block** save if any field has invalid config (min > max, calc with no sources, max selections > options count). Inline errors on Save click.

### I4. Field IDs
✅ UUIDs via `crypto.randomUUID()`. Stable across reorderings. Used as keys in conditions, calc sources, and CSV column lookups. Never use array index.

---

## J. Fill Mode UX

### J1. Validation timing
✅ Hybrid:
- **On submit** — full validation pass, surface all errors, scroll to first error
- **On blur** — only after the user has visited and left a field
- **Real-time clearing** — once an error is shown, re-validate on input and clear when fixed

Standard "Material Design / Linear" pattern. Don't yell at the user mid-typing in a field they haven't finished.

### J2. Error display
✅ Inline message below each field (red, rule-specific text). No top-of-form summary unless time permits.

### J3. Focus management on conditional reveal
✅ Focus stays where the user is. Newly-visible fields appear in Tab order naturally. Auto-stealing focus is jarring.

---

## K. PDF details (additional)

### K1. Section Headers in PDF
✅ Preserve visual hierarchy from the form — XL stays XL. Different font sizes per size variant. Section headers are the structural backbone of a printable form.

### K2. Page header / footer
✅ **Reliable cross-browser:**
- Form title prominent on the first page (regular CSS, not `@page` margin boxes)
- Submission timestamp inline at the top of the body
- `page-break-inside: avoid` on field rows so a label and its value never split across pages
- Solid print typography (font sizes, line heights, margins)

**Stretch (try, ship if it works in target browsers):**
- `@page` margin boxes for repeating header/footer — Safari support is uneven
- `counter(page)` for current page number — generally OK across modern browsers
- ❌ "Page X of Y" via `counter(pages)` — **not promising this**. `counter(pages)` is unreliable in Safari. Originally drafted; **dropped after Codex flagged the cross-browser risk.**

*"Looks like a real form"* per the rubric is achievable without "Page X of Y" — typography, margins, page-break-inside-avoid, and a clean first-page header carry most of the weight. Focus effort there.

### K3. Multi-select display
✅ Comma-separated inline (`Banana, Mango, Apple`). Not bulleted — too vertical for a printed form.

### K4. Long answers
✅ Wrap, never truncate. Submission integrity > pagination. `word-wrap: break-word; white-space: pre-wrap;` in print stylesheet.

### K5. Calculation display
✅ Just the computed value, formatted to configured decimal places. No formula. Label communicates intent.

---

## L. File Upload specifics

### L1. Max file size per file
✅ Soft cap of 10MB per file (configurable in the field config later if needed). Reject larger with inline error.

### L2. Image preview
✅ Skip. No actual file content loading per spec.

### L3. At-max behavior
✅ Block + inline error. *"Max N files. Remove one to add another."* No silent replacement.

---

## M. Cross-cutting

### M1. Mobile viewport
✅ Desktop and tablet (768px+) supported. Phone-sized viewport out of scope — three-panel Builder doesn't make sense on phone. Fill Mode degrades to phone-friendly. Document in README.

### M2. Accessibility baseline
✅ Floor:
- Every input has `<label>` (or aria-label)
- Required fields: `aria-required="true"` + visible asterisk
- Errors associated via `aria-describedby`
- Focus-visible styles on all interactive elements
- Keyboard nav for tile-display Single Select (arrow keys + space)

Full a11y audit (axe + screen reader pass) is "with more time."

### M3. Browser support
✅ Modern evergreen — Chrome, Firefox, Safari, Edge (last 2 versions). Target ES2022. No IE, no legacy. Document in README.

### M4. AI usage log
✅ `AI_USAGE_LOG.md` at repo root. Format per entry: Phase / Title / Prompt / Output summary / Verified / Used as-is, Modified, or Rejected (with reason). Target 5–7 well-described entries. Include at least one "plausibly wrong" example deliberately.

---

## N. What I'd Do With More Time
*This section feeds the README's "Future Improvements" section directly.*

**Versioned templates.** Today, instances are denormalized snapshots of the template at submission time (D4 → A). The natural evolution is explicit template versioning: each template edit creates an immutable version (`v1`, `v2`, …), instances reference a specific version, the editor sees a "this template has 5 historical versions" indicator. Migration is straightforward — existing snapshots become the seed for the version registry. This is the "correct" production model for any system that captures form responses over time.

**Disabled / draft state for fields.** Builders often need to park work-in-progress fields without deleting them — common feature in Typeform, Notion forms. Implementation would add a `disabled: boolean` to field config (distinct from conditional hide — that's runtime/value-driven; this is build-time/builder-controlled). Engine treats disabled fields identically to hidden-by-condition (same code path, no new logic). Builder canvas renders them with reduced opacity + "DISABLED" badge. Skipped from Fill Mode, PDF, and CSV. Edge cases (conditions/calcs referencing a disabled field) fall through to default state with builder warnings.

**Explicit AND/OR groups in conditional logic.** Today, conditions on a single field share one AND/OR mode (A1 → C). A natural extension is groups — `((A=X AND B=Y) OR (C=Z))` — typically modelled as a tree of condition nodes. Most form builders eventually need this for power-user flows.

**Real autosave + draft instances.** Today, fill state lives in component state until Submit. With more time: persist a draft on every keystroke (debounced) so a refresh mid-fill doesn't lose work. Drafts vs submitted instances become distinct collections in localStorage.

**Cross-tab sync via `storage` events.** Two tabs editing the same template currently last-write-wins silently. A `storage` event listener could detect external changes and prompt the user.

**Accessibility audit.** Keyboard nav for tile-display Single Select, focus management on conditional show/hide, ARIA live regions for calculation updates, error message association via `aria-describedby`. Pass with axe + manual screen-reader test.

**E2E tests with Playwright.** Cover: build a form with all 10 field types → fill it with conditional + calculation interactions → export PDF → assert PDF contents. One happy-path E2E catches a class of regressions that unit tests miss.

