# Claude Code — Starter Prompt

> Copy everything below the `---` line into your first message in a Claude Code session running in this folder. The two reference files (`requirements.pdf` and `decision-log.md`) are already here.

---

Hey Claude. I'm working on a frontend take-home assignment — a form builder. I've already done extensive planning in a separate session, and now I want you to **review the plan critically before we write any code**.

## Context about me

Principal Engineer, 11+ years frontend (React/TS, design systems, Storybook, Playwright). I'm using this take-home as a deliberate learning exercise for end-to-end engineering with AI. Goal isn't just to ship — it's to practice **AI orchestration**: knowing when to delegate, when to verify, when to push back. Treat me as a senior peer, not a beginner. Push back when you disagree.

## The assignment

Read `requirements.pdf` first. Short version: a browser-based form builder with two modes (Builder + Fill), 10 field types, conditional logic, calculation fields, browser-native PDF export, localStorage persistence. React + TypeScript, no `any`, no third-party PDF libraries.

## The plan

Read `decision-log.md`. It's the output of a long planning session. Every architectural decision has options-considered, the chosen path, and reasoning. Sections cover:
- A — conditional logic engine (AND/OR semantics, hidden field handling, default vs condition precedence, two-pass evaluation model)
- B — calculation engine (empty/hidden/deleted source handling)
- C, H — field-level details (prefix/suffix sharing, single-select default, date format, char length, decimal places, section header semantics)
- D — persistence (snapshot semantics, localStorage versioning, migration timing, deletion cascades)
- E, K — PDF strategy and layout
- F, I — Builder UX (save behavior, field placement, validation, IDs)
- J — Fill Mode UX (validation timing, error display, focus management)
- L — File Upload specifics
- M — cross-cutting (mobile, a11y, browsers, AI usage log)
- G — one scope addition beyond spec (CSV export of all responses)
- N — what I'd do with more time (versioned templates, disabled field state, AND/OR groups, autosave, etc.)

## What the assignment grades on

From the rubric:
- **Product thinking** — sensible decisions for the 10–20% the spec doesn't cover, documented
- **Component design** — *"Can someone add an 11th field type without editing 6 existing files?"* (registry pattern test)
- **Conditional logic correctness** — chained conditions, hidden-but-required, real-time updates
- **Type safety** — discriminated unions, no `any`, types that communicate the design
- **PDF export quality** — looks like a real export, not a debug dump

The assignment also requires an `AI_USAGE_LOG.md` — 5–7 well-described prompts with what I verified, what I rejected, and at least one "plausibly wrong" example.

---

## What I want you to do FIRST (do not write code yet)

**Phase 0 — Plan review.** Read `requirements.pdf` and `decision-log.md`. Then come back with:

1. **Gaps** — decisions that should have been made but weren't, especially around the rubric's grading axes
2. **Risks** — places where the plan might break under real implementation (e.g., a decision that sounds clean in prose but creates a hard problem in code)
3. **Type-modeling concerns** — the operator-per-target-type matrix, the discriminated-union shape for fields, the engine signature; anywhere the plan handwaves over a real type challenge
4. **Rubric alignment** — am I optimizing for what they're grading? Anything I'm overinvesting in or underinvesting in?
5. **Anything you'd add or change**

Be candid. If a decision is wrong or weak, say so. If something I framed as "with more time" should actually be in scope, say so. If something in scope should be cut, say so. The decision log is a draft, not a contract.

**Don't try to be exhaustive — focus on the 5–10 most consequential observations.** I'd rather have sharp, prioritized feedback than a long list of nits.

---

## After your plan review — the build phases

In rough order:
1. **Type modeling** — discriminated unions for `Field`, typed operators per target type, `Condition`, `Effect`, `Template`, `Instance`, `StoredData`
2. **Engine** — pure functions: `computeCalculations`, `evaluateConditions`, `evaluate` (the two-pass orchestrator). Unit tests alongside.
3. **Storage** — `load()`, `save()`, migrations registry. Versioned schema.
4. **Field registry** — the per-type module pattern (`renderer`, `configEditor`, `validator`, `defaultConfig`, `pdfRenderer`, `csvSerializer`). Adding an 11th field type = one new folder.
5. **UI scaffolding** — Builder shell, Fill shell, Templates list. React Router (or similar).
6. **Field renderers + config editors** — one per type, registered.
7. **PDF print region** + stylesheet, page header/footer.
8. **CSV export** — hand-rolled escaping, snapshot reconciliation per the decision log.
9. **README + AI usage log** — final polish.

## Working mode

- I drive high-judgment phases (decisions, types, AI log entries). You drive muscle work (boilerplate, scaffolding, tests, repetitive renderers).
- Push back when you disagree. Don't rubber-stamp my plan.
- I'll capture significant prompts in `AI_USAGE_LOG.md` myself — that's part of the grading and I need it to be in my voice.
- If you produce something I should verify (logic-heavy code, types, engine math), explicitly tell me what to verify and how.

## Style preferences

- Tight responses. Lead with code for technical questions, explain second.
- No over-formatting. Avoid bullet hell. Conversational, senior-to-senior.
- Match my energy — terse for quick fixes, thorough for learning moments.

---

Start by reading both files. Then give me your Phase 0 plan review.
