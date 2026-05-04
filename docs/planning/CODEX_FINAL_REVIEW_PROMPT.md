# Codex — Final Pre-Submission Audit Prompt

> Paste everything below the `---` line into Codex CLI in this folder. **Read-only review** — no file modifications. This is the audit pass before submission, not another planning round.

---

Hey. I'm submitting a frontend take-home assignment — a form builder. The build is essentially complete. Before I ship, I want one final critical audit from you on the whole repo: code, docs, and the AI usage log together.

## Context — what's already happened

You reviewed this plan twice during the planning phase (see [`docs/planning/CODEX_REVIEW_PROMPT.md`](CODEX_REVIEW_PROMPT.md) for the original brief — it walks through the assignment, my decisions, and the multi-model methodology I've used). Round 1 caught the chained-conditions cascade bug. Round 2 caught the calc-loses-value-on-redownload regression. Both fixes landed before any engine code was written.

This is a **different pass**. The code is built. The docs are in final form. **I'm not asking you to re-debate decisions** — I'm asking you to audit the result.

## What's in the repo

**Code:**
- `src/types/` — discriminated unions for fields, conditions, templates, instances
- `src/engine/` — `evaluate()` two-pass engine + `validateForm()` + topological graph + operator semantics + tests
- `src/storage/` — versioned localStorage with migration framework
- `src/registry/` — mapped-type registry contract; the "11th field type" extensibility test
- `src/fields/<type>/` — 9 field-type modules, each self-contained (renderer, configEditor, validator, defaultConfig, pdfRenderer, csvSerializer)
- `src/pages/` — TemplatesList, Builder, Fill, InstanceView, InstancesList
- `src/lib/csv.ts`, `src/lib/pdf.ts` + `src/lib/pdf.css` — exports
- `tests/e2e/` — Playwright suite (38 scenarios)
- 343 unit tests + 38 E2E tests, all passing locally

**Docs:**
- `README.md` — entry point. 7 architectural decisions, each with a worked example. Run instructions, localStorage schema, "what I'd do with more time."
- `AI_USAGE_LOG.md` — 11 entries (6 planning + 4 implementation + 1 reflection). Documents the multi-model loop you participated in, the bugs caught, the verification cadence developed during the build, and a candid disclosure that entries were reconstructed rather than captured live.
- `docs/planning/` — full planning trail: `decision-log.md` (~30 KB of options/reasoning), `TYPES_PROPOSAL.md` (signed-off type model), `E2E_SCENARIOS.md` (48 scenarios with root-cause analysis on bugs caught during manual testing), `requirements.pdf` (original brief), prompts I used at each phase.

## What I want you to do — five audit categories

### 1. Code ↔ docs consistency

Read the README's *Architectural decisions* section, then spot-check the code against each claim. Specifically:

- **#1 Two-pass engine.** README claims topological iteration with effective-value stripping. Does `src/engine/evaluate.ts` actually do this? Walk the loop. Are hidden fields' entries deleted from `effectiveValues` before downstream fields are processed? Is the cycle-fallback path real, or hand-waved?
- **#3 Snapshot semantics.** README claims `Instance` stores `templateSnapshot`, `visibility`, and pre-computed calc values, and that re-render is a pure display function. Verify in `src/types/template.ts` and the InstanceView page.
- **#4 Registry mapped type.** README shows a `Registry = { [K in FieldType]: FieldTypeModule<Extract<Field, { type: K }>> }` claim. Does the actual code hold this contract? If a field-type module under the wrong key compiles cleanly, the type isn't load-bearing.
- **#6 AND/OR per-effect-group.** README claims empty groups are inactive (guarded against vacuous truth). Find the guard in the code. Confirm it covers all four effect types.
- **#7 Absent values uniformly false.** Confirm in `src/engine/operators.ts` that *every* operator (including `text_not_equals`, `multi_contains_none`) returns false when target is undefined, not just by accident of falsy comparison.

If any claim is over-promised vs the code, name it.

### 2. Rubric alignment

The assignment grades five things. Audit how well the submission hits each:

1. **Product thinking** — sensible decisions for spec gaps, documented. Look in `decision-log.md` for the gap calls. Are they real product calls or paper-thin?
2. **Component design** — *"add an 11th field type without editing 6 files."* Identify the *exact* files that would need editing for a new field type. README claims ~5 type-definition touch points. Verify by tracing.
3. **Conditional logic correctness** — chained conditions, hidden-but-required, real-time. Check the engine implementation against the spec's correctness requirements.
4. **Type safety** — `npm run typecheck` is clean and there's no `any` in production code. Check `Migration` (in storage), check the registry generic, check whether discriminated unions actually narrow at use sites.
5. **PDF export quality** — *"real export, not debug dump."* Read `src/lib/pdf.css` and `src/pages/InstanceView.tsx`. Is the print stylesheet actually thoughtful, or just `display: none` for non-print elements?

For each axis, score where the submission lands (strong / adequate / weak) and explain.

### 3. Real bugs in the code

Look for actual implementation bugs, not architectural concerns. Specific things worth probing:

- **Engine edge cases.** What happens when `template.fields` is empty? When a calc field's `sourceFieldIds` references a non-existent ID? When a condition's `targetId` references a field that was deleted?
- **Storage edge cases.** Future-version data, malformed JSON, quota exceeded — are all three surfaced gracefully?
- **CSV escaping.** Does `escapeCSV` handle all of: comma, double-quote, newline, CR, leading whitespace, tabs? Are RFC 4180 corner cases covered?
- **Race conditions.** Two stores modifying the same in-memory state. Two tabs writing localStorage. Does anything assume single-tab?
- **PDF rendering.** Is `#print-region` actually a portal sibling of `#root`, or nested? (The AI log Entry 8 says it's a portal — verify.)
- **Validation timing.** Per spec: hidden required fields must not be validated. Does `validateForm` actually skip hidden fields? Trace the logic.

Flag real bugs, not stylistic suggestions.

### 4. AI usage log credibility

Read `AI_USAGE_LOG.md` end-to-end. The reviewer will scrutinize this. Specifically:

- **Voice consistency** — does it read like one engineer wrote it, or does the tone shift suspiciously? The author has disclosed reconstruction in Entry 11; check if the disclosure matches what's actually visible in the prose.
- **The "plausibly wrong" examples** — Entries 3, 5, 8 contain bugs the author claims AI got wrong. Are these substantive engineering moments, or contrived to satisfy the rubric requirement?
- **Quantity / quality** — 11 entries. Is each entry pulling its weight, or is anything padding?
- **Reflection in Entry 11** — does it read as honest learning, or performative humility?
- **Methodology framing** — the intro says the multi-model approach *emerged*, not was *designed*. Does that reframe match what you'd expect, given you participated in two of the rounds?

Flag entries that should be cut, merged, or rewritten. Flag voice issues. Flag any place where the claim doesn't match what you witnessed in the actual review rounds.

### 5. Submission-readiness

Practical checks before the repo goes to a reviewer:

- Does the README's architectural-decisions section actually parse cleanly top-down for someone reading it cold?
- Are all internal links in the README (`docs/planning/...`, `AI_USAGE_LOG.md`) valid? Do they resolve?
- Are there leftover artifacts that shouldn't ship: `.DS_Store`, `playwright-report/`, untracked `.claude/` directory, debug `console.log`s, commented-out code, TODO/FIXME markers in production code?
- Is `package.json` clean — no abandoned dependencies, version pins reasonable?
- Is `tsconfig.json` actually strict (look for `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`)?

## What I do NOT want

- **No file modifications.** Read-only. If you think something should change, describe it; I'll apply manually.
- **No re-litigating settled decisions.** AND/OR semantics, snapshot vs versioned, calc-as-target — these were decided through the previous reviews and the reasoning is in the decision log. Skip them.
- **No bikeshed-level nits.** I want substantive findings: real bugs, real over-promises, real submission risks. If your top-5 list is "consider renaming this variable for clarity," you're padding.
- **No flattery.** Tell me what's actually weak. The point of bringing you in is independent scrutiny, not validation.

## Style preferences

- Tight responses. Lead with the finding, then the evidence.
- Categorize findings by severity (Blocker / Should-fix / Polish).
- Quote specific file paths + line numbers when you reference code.
- Give each audit category (1–5 above) at least one concrete finding, even if "no significant issues" — that confirms you actually looked.

## Output format I'd find most useful

```
## Audit verdict

[2-sentence top-line: would you ship this, what's the strongest concern]

## Per-category findings

### 1. Code ↔ docs consistency
- [Blocker / Should-fix / Polish] [finding] — [file:line evidence]

### 2. Rubric alignment
- [score per axis with reasoning]

### 3. Real bugs in the code
- [findings with file:line]

### 4. AI usage log credibility
- [findings, voice issues, entries to cut/rewrite]

### 5. Submission-readiness
- [practical issues to fix before push]

## What I'd change before submission
[ranked list of the 3-5 highest-value fixes]
```

---

Read the repo. Audit. Be candid. Treat me as a senior peer.
