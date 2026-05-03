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

---

## Entry 7 — 22-minute build handoff: trust but verify

**Phase:** Implementation kickoff (Phases 1–12 of `ImplementationPrompt.md`)
**Tool:** Claude Code

**Prompt:** Pasted `ImplementationPrompt.md` into a fresh session and walked away. Came back to a "✻ Crunched for 22m 33s" message claiming all 12 phases complete, with a `PROGRESS.md` and a five-point handoff list.

**Output summary:** The session shipped real engine + storage + 9 field modules + Builder + Fill + InstanceView + PDF stylesheet + CSV writer in 22 minutes. The engine layer was genuinely well-tested (115 unit tests passing, including the cascade test and the B2-dropped test).

**Verified:** Ran `find src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l`, `npm test -- --run`, `npm run typecheck`, `npm run build`, plus `grep -rn "it.skip\|it.todo\|TODO\|FIXME"`. Actual numbers: 42 production files, 115 unique tests (reported as 230 because a `tsc -b` build-config leak was emitting `.js` files into `src/` and vitest was picking them up), no skipped tests. UI was implemented but had zero tests. The headline P1 instance-lifecycle test the handoff summary claimed existed — `grep` for it: not there.

**Used:** The engine + UI implementation as-is (it works). Wrote a follow-up `CompletionPrompt.md` (G0–G10) to fill the gaps — fix the build leak, add the P1 test, add ~110 missing tests across field validators, renderers, CSV, PDF, Builder UI, Fill UI, TemplatesList, plus an audit of 7 polish features. Second pass landed in 19 minutes with 277 tests passing.

**Reflection:** "Crunched for 22m" looks like a victory; without verification it's a confident-sounding skip. The verification commands took 30 seconds and surfaced the gap. Treating completion claims as untrusted-by-default is the right discipline when the agent's own summary is the only evidence.

---

## Entry 8 — PDF empty bug: my first diagnosis was wrong

**Phase:** Manual smoke testing (S5 from `E2E_SCENARIOS.md`)
**Tool:** Claude Code (consulting)

**Prompt:** Just finished verifying gap-fill completion. Built a form, filled it, opened the instance view, hit Cmd+P. Print preview was blank. Reported: *"PDF is empty."*

**Output summary:** Claude's first hypothesis was a CSS specificity issue — the print region had `style={{ display: 'none' }}` inline; the print stylesheet had `#print-region { display: block !important }`; Claude reasoned that inline styles beat external CSS even with `!important`. That diagnosis was wrong. The real cause: the print-region was nested inside `<div id="root">`, and the print rule `body > *:not(#print-region) { display: none }` hides `#root` directly. Once `#root` is `display: none`, every descendant — including the print region — is removed from the layout tree, regardless of the descendant's own `display: block !important`. Fixed by rendering the print-region via `createPortal(printRegion, document.body)` so it's a *sibling* of `#root`, not a descendant.

**Verified:** Manually triggered Cmd+P after the fix — print preview rendered the form correctly. Updated the InstanceView unit tests to query `document.body.querySelector('#print-region')` instead of `container.querySelector` (portal escapes the rendered tree). All 7 InstanceView tests pass; full suite still green.

**Used:** Modified — accepted the portal fix; rejected the initial CSS-specificity diagnosis after Claude walked it back.

**Reflection — this is the implementation-phase "plausibly wrong" moment.** The first diagnosis was confident, technical-sounding, and used real CSS specificity terminology. It was also wrong, and would have led me to chase `!important` chains that wouldn't have fixed anything. Lesson: when a technical explanation doesn't quite fit the symptom (the CSS rule already had `!important`; specificity wasn't actually being contested), don't accept the explanation — go look at the actual DOM. Also worth noting: my InstanceView unit test was passing the whole time because it asserted the print-region's existence in the rendered tree, which it had. The unit test couldn't catch the rendering bug because jsdom doesn't run `@media print`. Real-browser verification was the only path to catching this.

---

## Entry 9 — Cascade delete bug: structural argument, broken implementation

**Phase:** Manual smoke testing
**Tool:** Claude Code (consulting)

**Prompt:** During manual testing I asked: *"If we delete the templates, what happens to their instances?"* Claude answered confidently — single-key localStorage, decision-log D3, "no orphans possible." Then I tried it: built two templates, filled responses for both, deleted one. The deleted template's instances stayed in the DevTools dock's localStorage view. Reported: *"instances are still there even if we delete the templates."*

**Output summary:** Investigated `src/stores/templates.ts`. `deleteTemplate(id)` was destructuring the template out of the templates map and calling `save({ templates: next, instances })` *with the original instances object unchanged*. The cascade-delete confirm dialog already told users "X filled responses will also be deleted" (per D3) but the actual delete handler didn't honor it. Fixed by filtering `instances` to drop entries where `instance.templateId === id` before saving. Added 5 unit tests in a new `src/stores/templates.test.ts`: cascade removes orphans, preserves instances of other templates, persisted state has no orphans, zero-instance delete is a no-op for instances, non-existent id leaves state unchanged.

**Verified:** All 5 tests passed. Re-ran the manual scenario: deleted T1 with 2 responses; T1 gone, its 2 responses gone, T2 and its 1 response preserved. Documented as scenario S16 in `E2E_SCENARIOS.md`.

**Used:** Modified — Claude's earlier "no orphans possible" answer was a structural-shape claim (single-key storage = atomic write); the actual implementation had a code path that violated the contract. Both can be true at the same time.

**Reflection:** "Structurally impossible" is a claim about the shape of data, not about whether the code uses the shape correctly. Storage being a single key meant orphans couldn't survive across sessions if writes were always consistent — but the bug was that writes weren't consistent. Lesson: when I (or an AI) argue *"X is structurally guaranteed by the design,"* verify the implementation actually reaches that guarantee. The decision log was correct. The code wasn't.

---

## Entry 10 — Spec compliance gap: instance count missing from template cards

**Phase:** UX polish
**Tool:** Claude Code

**Prompt:** While adding save-feedback toasts, I asked: *"in the forms list, can we show how many instances are there?"*

**Output summary:** Claude pointed out — correctly — that this wasn't a polish question. The assignment spec literally says: *"Each template card shows: title, number of fields, number of filled instances, last modified date."* The previous Claude Code session that built TemplatesList had implemented title + field count + modified date but skipped the instance count. The instance count *was* being computed (it's used in the cascade-delete confirm dialog) but never rendered on the card itself. Direct spec violation. Fixed by computing `instanceCountByTemplate` once per render via single-pass map reduction (O(instances), not O(templates × instances)) and surfacing as `{N} fields · {M} responses · Modified {date}` with singular/plural handling. Added `data-testid="template-card-${id}"` and `data-testid="template-meta-${id}"` for E2E.

**Verified:** `npm run typecheck` clean. `npm test -- --run` 340 passing, no regressions. Manual: cards now show response count alongside field count.

**Used:** As-is. Mechanical fix once the gap was identified.

**Reflection:** I'd been operating from `decision-log.md` and `TYPES_PROPOSAL.md` without re-checking the assignment spec during the build. The decision log is detailed and self-consistent, which makes it easy to forget the spec is the actual contract. Lesson: include "spec re-read" as part of every UI phase checkpoint. The decision log doesn't mention card metadata at all — it's spec-only territory, and I'd been operating from the decision log alone for ~2 days.

---

## Entry 11 — Reflection: retroactive logging + verification cadence

**Phase:** End of implementation
**Tool:** N/A

Implementation entries 7–10 were reconstructed at the end of the build phase rather than captured live, despite the `AI_LOG_DISCIPLINE_FOR_CLAUDE_CODE.md` rule that said *"capture live, not retroactive."* I'm noting this honestly because the alternative — pretending live capture happened — would be worse. Next time I'd enforce live capture by adding a "log this phase if anything significant happened" prompt at every checkpoint, and treat the log as a build artifact rather than an end-of-day chore.

The single most valuable habit during the build was the verification cadence I added: after every "I'm done" claim from Claude Code, run `find` for file count, `wc -l` for line counts on suspicious files, `grep` for `it.skip` / `TODO` / `FIXME`, `npm test -- --run`, `npm run typecheck`, `npm run build`. That cadence surfaced four real issues:

- **22-minute build handoff** (Entry 7): claimed completion, was missing ~110 tests + the headline P1 instance-lifecycle test
- **PDF empty bug** (Entry 8): unit tests passed, manual Cmd+P revealed it
- **Cascade delete bug** (Entry 9): "no orphans possible" was technically true at the storage layer but false at the code path
- **Instance count spec gap** (Entry 10): the decision log was followed; the spec wasn't re-checked

Each would have shipped silently if I'd trusted the agent's summary. None were catastrophic individually; collectively they would have meaningfully degraded the submission.

What I'd carry forward:

1. Verification commands belong in the prompt as mandatory phase-checkpoint steps, not optional.
2. Manual smoke (~10 min through key user flows) catches what unit tests can't — layout, rendering, real-browser-only behavior. Run before any "done."
3. The spec is the contract. The decision log is the implementation guide. Re-read both at audit checkpoints.
4. Multi-model review during *implementation* (not just planning) would have helped. I did this for planning (Cowork → Claude Code → Codex → Codex round 2) but not during the build. Next time, schedule a Codex pass at the end of each major phase.
