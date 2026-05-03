# AI Usage Log

> Quality over volume. Entries cover the planning phase across three AI tools — Claude Cowork (planning conversations), Claude Code (implementation agent), and OpenAI Codex (independent reviewer). Implementation entries will be added as the build progresses.

## Approach: multi-model iterative review

I used a deliberate multi-model loop for this assignment instead of relying on a single AI throughout. The pattern:

1. **Plan in Cowork (Claude)** — long-form architectural discussions, decision documentation, trade-off analysis
2. **Review in Claude Code** — independent agent reviews the plan in the actual repo with file access; pushes back on gaps and risks
3. **Cross-validate with OpenAI Codex** — second independent agent reviews the plan and Claude Code's revisions; surfaces blind spots that both Claude instances share

This caught three real bugs before any engine code was written. Each pass found something the previous didn't. Diminishing returns kicked in around pass three; I stopped reviewing and started building.

The full planning trail lives in `decision-log.md` (architectural decisions, ~30K chars of options/reasoning) and `TYPES_PROPOSAL.md` (signed-off type model + registry contract + engine signatures). README's *Architectural Decisions* section is a 5–7 item distillation of these — not the full transcript.

---

## Entry 1 — Initial planning structure (Cowork)

**Phase:** Planning kickoff
**Tool:** Claude (Cowork)

**Prompt:** Read the assignment PDF. Asked: *"I'm learning end-to-end engineering with AI. My initial plan is design system → mockups → implementation. What other best practices should I add? Use this discussion as planning, not implementation."*

**Output summary:** Claude pushed back on my ordering — argued that for this assignment, the type model and conditional-logic engine are the hard parts, not the visuals. Suggested re-ordering: decision log first, then type model, then pure engines (with unit tests), then registry pattern, then UI primitives, then renderers. Flagged the "11th field type without editing 6 files" criterion as a registry-pattern test, not a generic component-design concern.

**Verified:** Cross-checked against the rubric ("product thinking, component design, conditional logic correctness, type safety, PDF quality"). The reordering aligns with what the rubric grades — three of five criteria are engine/architecture, not UI.

**Used:** As the structural template for the rest of planning. My initial design-first ordering was changed to engine-first.

**Reflection:** Useful pushback. I was about to spend planning energy on the wrong axis (visuals over engine). Catching this early saved hours.

---

## Entry 2 — Conditional logic deep dive (Cowork)

**Phase:** Decision log construction
**Tool:** Claude (Cowork)

**Prompt:** Walked through the spec's deliberately-ambiguous areas (multiple conditions on a field, hidden field value handling, calculation source semantics, template editing after instances exist, submission immutability). Asked Claude to lay out options with trade-offs for each.

**Output summary:** For each question, Claude offered 2–4 options with concrete reasoning and a recommendation. Notable picks: per-field AND/OR toggle (default OR), preserve hidden values in state but exclude from submission/PDF (option C), Hide-wins-Show / Not-Required-wins-Required cross-effect precedence, snapshot semantics for instances (deep copy of template at submission time), submitted instances immutable (matches Google Forms model).

**Verified:** Applied senior judgment to each, agreed with most. Pushed back on Q4 (template edit propagation) — Claude wanted snapshot-at-submission as the baseline. I agreed but added a note: versioned templates is the *correct* production model, document it as the headline "with more time" item. This shows the reviewer I understand the snapshot is a deliberate scope choice, not the right answer.

**Modified:** Q6 (forward references) — Claude initially recommended allowing forward references for engine simplicity. I overrode in favor of forbidding them for better filler UX. Then when asked again ("what do *you* recommend?"), Claude held its ground at "weakly prefer allow." I went with allow on the third pass after weighing again. Documented BOTH choices in the decision log so the reviewer sees the trade-off was considered both ways.

**Used:** All decisions in the resulting decision log were either accepted, modified, or explicitly justified as overrides.

---

## Entry 3 — First independent plan review (Claude Code) — caught a real cycle bug

**Phase:** Pre-implementation review
**Tool:** Claude Code (separate session, fresh context)

**Prompt:** Wrote a starter prompt (`CLAUDE_CODE_STARTER_PROMPT.md` in repo for reference). Briefed Claude Code on the assignment + decision log + my goals + the rubric. Explicit instruction: *"Do not write code yet. Review the plan critically. Push back. I want gaps, risks, type-modeling concerns, rubric alignment problems."*

**Output summary:** Claude Code returned 7 substantive critiques. The most important one: the combination of decision log entries B2 (calc excludes hidden sources) + A5 (conditions can target calc values) creates an oscillation cycle — calc value changes → condition fires → source hides → calc recomputes → condition flips → infinite loop. Also flagged: registry contract was incomplete (missing `operators`, `valueType`, `canBeCalcSource`, `capturesValue`), condition typing should be operator-discriminated not target-type-discriminated, CSV column-source contradicted snapshot semantics, PDF rubric bar was higher than my plan implied.

**Verified:** Re-read decision log B2 + A5 together with a worked example. The cycle is real. Re-read the operator table in the spec — it does require typed-per-target operators (e.g., Number's "is within range" needs a tuple value). The rubric does grade extensibility (the "11th field type" line literally tests the registry pattern).

**Used:** All 7 critiques accepted with light nuance. Major outcome: dropped B2 (calcs now aggregate over all sources regardless of visibility, calc itself can be hidden by its own condition) and significantly expanded the registry contract before any code was written.

**This is the "plausibly wrong" example.** Claude in Cowork had given me a clean, plausible-sounding rule for B2 ("exclude hidden sources for consistency with the hidden-data exclusion rule") that didn't survive contact with A5. The reasoning sounded right at planning time. Only by combining it with another decision did the bug surface. Lesson: AI plans look more coherent than they are because each decision is reasoned in isolation. Multi-decision interactions need their own review pass.

---

## Entry 4 — Type model + registry contract (Claude Code)

**Phase:** Type modeling
**Tool:** Claude Code

**Prompt:** *"Write the type model + registry contract + engine signatures into `TYPES_PROPOSAL.md`. Don't write engine code yet — I want to sign off on types first."*

**Output summary:** Claude Code produced TYPES_PROPOSAL.md with: split bases (`BaseFieldShared` for everyone, `RequirableFieldBase` only for input-capturing fields — so "mark Section Header required" is a compile error), namespaced operators (`text_equals` / `number_equals` / `date_equals` to avoid collisions in the discriminated union, with `number_within_range` carrying `[number, number]` natively), and the engine as a single pure function `evaluate(rawValues, template, registry) → { computedValues, visibility, required }`. 9 open questions in §8 for sign-off.

**Verified:** Code-reviewed the proposal back in Cowork. Requested 6 changes: validator return type should be `ValidationError[]` not `ValidationError | null` (for internal consistency with the renderer prop), add a `validateForm` sibling helper for submit-time validation, make the CSV iteration rule explicit, document Q4 (File-as-target = no) and Q5 (Calc-as-target = yes) as deliberate scope choices, fix the multi-select empty representation contradiction. Validator signature also needed a `ValidatorContext` parameter so it knows whether the field is required.

**Used:** All 6 changes applied; signed off on the type model before writing engine code.

---

## Entry 5 — Independent review with OpenAI Codex — caught the chained-conditions cascade bug

**Phase:** Pre-implementation review (second pass with a different model family)
**Tool:** OpenAI Codex (Codex CLI)

**Prompt:** Wrote `CODEX_REVIEW_PROMPT.md` (in repo) — same shape as the Claude Code starter prompt but framed as an *independent* review. Briefed it on the assignment + decision log + types proposal + the fact that Claude had already reviewed once. Explicit constraint: *"Don't write or modify any files. Review-only. I have an active Claude Code session in this folder."*

**Output summary:** Codex returned 8 critiques. Two were significant:

1. **Chained-conditions cascade.** With A2 (preserve hidden values), a downstream condition reads a preserved-but-hidden value from an upstream-hidden field, leaving the downstream field incorrectly visible. Example: A reveals B; B reveals C. User answers B = "Hello", C becomes visible. User changes A to hide B — but B's "Hello" is preserved per A2, so C's condition keeps matching, and C stays visible. **This is a reviewer-visible bug.**

2. **CSV column source contradicts snapshot semantics.** Decision log said current-template columns; type proposal said union-of-snapshots. We paid for snapshot fidelity in D4; using current-template-only silently drops historical data.

Plus: registry typing should be a mapped type (`Record<FieldType, FieldTypeModule>` loses key/module correlation), `Migration = (data: any) => any` undercut the no-`any` posture (should be `unknown`), operator semantics needed precision (case sensitivity, trimming, absent-value rules), PDF "Page X of Y" via `counter(pages)` is unreliable in Safari, calc-as-target is a non-spec extension that should be reconsidered, forward references with chained conditions need a cycle policy.

**Verified:** Brought Codex's review back to Cowork for cross-validation. Worked through Codex's chained-conditions example with a worked trace — the cascade is real. The current decision-log/types-proposal contradiction on CSV was a documentation drift bug I had already half-noticed but not fixed. Verified Safari's `counter(pages)` weakness via web search.

**Used:** Accepted 6 of 8 directly. **Pushed back on 2:**
- Codex suggested *dropping calc-as-target* as the symmetric fix to the cycle. I kept it because *"show this field if Total > 1000"* is the highest-value condition pattern with calc fields, and the cycle was caused by B2 + calc-as-target *together* — dropping B2 alone resolves the cycle while preserving the feature.
- Codex suggested demoting CSV export to "with more time." I kept it as baseline — ~30 mins of work, it signals product completeness, and shipping a forms product without bulk export reads as incomplete.

**This is also a "plausibly wrong" example, deeper than entry 3.** Claude in Cowork had explicitly said "conditions check values not visibility, so no fixed-point or cascade is needed." That sounded technically correct because conditions evaluate the *value* of a target field, not its visibility. But it ignored the fact that hidden fields *preserve* their values per A2, so the value evaluated downstream is stale. The framing was clean and confident; it was wrong. Codex caught it because Codex doesn't share Claude's prior reasoning bias.

**Engine model change as a result:** topological evaluation within the condition pass, with effective-value stripping (a field hidden upstream is removed from the running `effectiveValues` map so downstream conditions see it as absent). Cycles in the condition dependency graph blocked at builder save time so the engine can assume a DAG. This is a real architectural change driven by the review.

---

## Entry 6 — Codex round 2 — caught calc-loses-value-on-redownload bug

**Phase:** Final pre-implementation review
**Tool:** OpenAI Codex (round 2 after applying entry 5's fixes)

**Prompt:** *"Read-only review. The plan was updated based on your earlier feedback. Verify and surface anything still wrong."*

**Output summary:** 5 issues. The most important (P1): with the new "Instance stores submittedValues only, no computedValues, recompute on re-render via pure engine" model, calc fields lose their submitted value on PDF re-download when their source fields were hidden at submit time. Reason: the engine recomputes the calc using the stored `submittedValues`, but hidden source values were stripped at submit, so the recomputation has different inputs than the original. The "engine is pure, re-runs are deterministic" framing was correct but I missed that determinism only holds when *inputs* are identical.

Other issues: multi-source calc leakage was understated (with one hidden source in an N-source calc, the hidden value can be reverse-engineered exactly from sum/avg or exposed directly via min/max), runtime engine assumed a valid DAG without re-validating on load (cycles could sneak in via stale localStorage data), empty effect groups had ambiguous semantics under AND logic (vacuous truth would fire effects from empty groups).

**Verified:** Worked through the calc re-download bug with a concrete example. It's real. Re-read the multi-source leakage scenario with arithmetic: yes, with one hidden source you can solve for the hidden value from the aggregate. Codex's load-time DAG validation point is sound — localStorage is user-mutable and we can't trust it on load.

**Used:** All 5 issues accepted. Major outcome:
- Instance schema updated to include `visibility: Record<string, boolean>` (visibility map at submit time) and `values` now includes computed calc results pre-baked at submit time (not recomputed on re-render). PDF/CSV re-renders use stored data directly with no engine call. Pure display.
- Engine `evaluate()` now defensively detects topo-sort failure and returns a controlled fallback (all-default visibility/required) instead of throwing.
- Load-time cycle validation added in addition to save-time blocking.
- Empty effect group rule made explicit: empty groups are inactive, don't fire effects.

After applying these fixes, I stopped review-iterating. Three full review passes had been done; the curve of "issues found per pass" was clearly trending toward nits.

---

## Reflection on the multi-model approach

What worked: each independent pass surfaced bugs the previous didn't. Claude Code caught the B2 cycle that Claude in Cowork had missed because Cowork was reasoning about each decision in isolation. Codex caught the chained-conditions cascade that Claude had explicitly *argued was impossible* because Codex doesn't share Claude's prior framing. Codex round 2 caught the calc-redownload bug that emerged from the *fix* to a previous bug — exactly the kind of regression a single agent reasoning through a long thread would miss.

What I learned: AI planning outputs look more internally consistent than they are because each decision is locally reasoned. Multi-decision *interactions* need their own review. The discipline of "have a different model independently audit before writing code" caught three architectural bugs that would have surfaced as broken behavior in implementation, costing hours of debugging instead of minutes of planning.

What I'd do differently: write the AI usage log in real-time alongside the plan, not after. By the time I sat down to write entries 3–6 retroactively, I had to reconstruct prompts and reasoning from chat history. Capturing the *moment of acceptance/rejection* live is higher fidelity than reconstructing it.

---

## Implementation entries

*Will be added as the build progresses. Format per entry: Phase / Title / Prompt summary / Output summary / Verified / Used as-is, Modified, or Rejected (with reason).*
