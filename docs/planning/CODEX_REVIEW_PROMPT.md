# Codex — Independent Pre-Build Review Prompt

> Copy below the `---` line into Codex CLI in this folder, OR paste into ChatGPT with the three reference files attached: `requirements.pdf`, `decision-log.md`, `TYPES_PROPOSAL.md`.

---

Hey. I'm working on a frontend take-home assignment — a form builder. I've already done extensive planning AND signed off on a type model with Claude. Before I start writing engine code, I want a **critical independent review from a fresh perspective**. I'm bringing this to you precisely because Claude has its own blind spots and I want a different lens.

## Context about me

Principal Engineer, 11+ years frontend (React/TS, design systems, Storybook, Playwright). This is a deliberate learning exercise in multi-model AI orchestration — I want you to push back, not rubber-stamp. Treat me as a senior peer.

## The assignment

Read `requirements.pdf` first. Short version: a browser-based form builder with two modes (Builder + Fill), 10 field types, conditional logic, calculation fields, browser-native PDF export (no third-party PDF libs), localStorage persistence. React + TypeScript, no `any`.

## What I've already produced

**1. `decision-log.md`** — every architectural decision with options-considered + reasoning. Covers:
- Conditional logic engine: per-field AND/OR toggle (default OR), Hide-wins-Show / Not-Required-wins-Required precedence, hidden field values preserved in state but excluded from submission/PDF/CSV, forward references allowed (engine is order-independent)
- **B2 was dropped**: calculations now aggregate over all source field values regardless of source visibility (the calc itself can be hidden by its own condition; if hidden, excluded from submission). Dropped because B2 + A5 created a real oscillation cycle.
- Two-pass engine: Pass 1 calc, Pass 2 conditions; no fixed-point needed because spec rules out the cases that would require it
- Snapshot semantics: instances deep-copy the template at submission time (D4)
- localStorage: single key `formBuilder` with version + migration runner that runs once at app boot
- PDF: `window.print()` + `@media print`, two-click flow (button → browser dialog → "Save as PDF")
- CSV: union of all instance snapshots for column source (because we paid for snapshot semantics in D4)
- Scope addition (deliberate): bulk CSV export of all responses
- Future extensions: versioned templates, disabled field state, AND/OR groups, autosave, cross-tab sync, a11y audit, Playwright E2E

**2. `TYPES_PROPOSAL.md`** — signed-off type model + registry contract + engine signatures. Key calls:
- Split bases: `BaseFieldShared` for all fields; `RequirableFieldBase` adds `defaultRequired` only for input-capturing types. Section Header and Calculation extend the smaller base — "mark Section Header required" is a compile error.
- Namespaced operators: `text_equals` / `number_equals` / `date_equals` etc. Single discriminator on Condition union; `number_within_range` carries `[number, number]` natively.
- Calculation can be a condition target, reusing Number's operator set (extends spec table; A5 explicitly allows this).
- File is NOT a condition target (`operators: []`) — scope-aligned with spec table.
- `Values = Record<string, unknown>` with helper-narrowing at access points. Empty = absent from record (multi-select empty arrays also absent, no dual representation).
- Registry contract per field type: `type`, `valueType`, `capturesValue`, `canBeCalcSource`, `operators`, `defaultConfig`, `renderer`, `configEditor`, `validator`, `pdfRenderer`, `csvSerializer`. Adding an 11th field type = one new module, one registry-map line.
- Engine: `evaluate(rawValues, template, registry) → { computedValues, visibility, required }` — single pure function. Sibling `validateForm(template, values, engineResult, registry) → Record<fieldId, ValidationError[]>`.
- Validator returns `ValidationError[]` (not single) with `ValidatorContext { isRequired }`.
- CSV writer iterates `capturesValue: true` fields only.

**3. Stack:** Vite + React 19 + TypeScript (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), Zustand, Tailwind, React Router v7, @dnd-kit, Vitest, native `<input type="date">`, `window.print()`, hand-rolled CSV.

## What I want you to do

**Phase 0 — Independent critical review. Do NOT write or modify any files.**

1. **Gaps** — decisions that should have been made but weren't, especially around the rubric's grading axes (product thinking, component design / 11th-field-type extensibility, conditional logic correctness, type safety, PDF quality)
2. **Risks** — places where the plan might break under real implementation. The B2-cycle bug was caught late; what other bugs are still hiding in the proposal?
3. **Type-modeling concerns** — internal inconsistencies in TYPES_PROPOSAL.md, places where types are decorative vs communicating the design, anywhere the proposal hand-waves over a real challenge
4. **Rubric alignment** — am I overinvesting or underinvesting somewhere? The rubric explicitly grades type safety, component extensibility, conditional logic, PDF quality, and product thinking on spec gaps.
5. **Things you'd change** — be specific. Cite line/section.
6. **Things Claude got wrong or oversimplified** — I want fresh eyes precisely because Claude has its own blind spots. Where is its reasoning weakest?

**Be candid.** If a decision is wrong, say so. If something framed as "with more time" should actually be in scope, say so. If something in scope should be cut, say so.

**Focus on the 5–10 most consequential observations.** Sharp prioritized feedback over a long list of nits.

## Important constraint for this review

I have an active Claude Code session in this folder. **Don't write or modify any files.** Review-only. If you think something should change, describe the change in your response and I'll apply it manually after weighing it against Claude's perspective.

## Style preferences

- Tight responses, lead with code for technical questions, explain second.
- No over-formatting (avoid bullet hell). Conversational, senior-to-senior.
- Match my energy — terse for quick fixes, thorough for substantive critique.

---

Read the three files. Then give me your review.
