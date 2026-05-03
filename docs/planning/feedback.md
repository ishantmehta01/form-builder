Review is sharp. Accepting all seven, with light nuance on a few. Going point-by-point so you can map back when you respond:

**1. The cycle in B2 — accept the fix. Drop B2.**

Claude Code is right. The B2/A5 combination creates a real oscillation, and I missed it. The "indirect leakage" worry that motivated B2 was overstated — the calc itself being hideable is the actual leakage control. Excel-style aggregation (sum over all sources regardless of source visibility) is simpler, well-understood by users, and breaks the cycle without iteration.

→ Tell Claude Code: drop B2. Calculations aggregate over all source field values regardless of source visibility. The calc field itself can be hidden by its own condition; if hidden, it's excluded from submission, PDF, and CSV. One sentence in the README.

**2. Registry contract is incomplete — accept the additions.**

Genuinely critical for the rubric. Without `operators`, `valueType`, `canBeCalcSource`, and `capturesValue` in each per-type module, the engine, condition editor, calc-source dropdown, and CSV serializer all need editing on field #11. That's literally the anti-pattern they're testing for.

→ Tell Claude Code: lock the registry contract before any engine code. Each field-type module exports:

```ts
{
  type: FieldType;
  valueType: 'string' | 'number' | 'string[]' | 'date' | 'file[]' | 'none';
  capturesValue: boolean;
  canBeCalcSource: boolean;
  operators: ConditionOperator[];  // typed per field type per spec table
  defaultConfig: FieldConfig;
  renderer: React.FC<FieldRendererProps>;
  configEditor: React.FC<ConfigEditorProps>;
  validator: (value, config) => ValidationError | null;
  pdfRenderer: (value, config) => PdfNode;
  csvSerializer: (value, config) => string;
}
```

**3. Condition typing — accept the operator-discriminated union + lazy resolve.**

The "is within range" tuple-value catch is exactly the kind of typing detail that separates "types as documentation" from "types as decoration." Discriminating by **operator** (not by target type) is correct.

→ Tell Claude Code:

- Storage stores `{ targetId: string, operator: ConditionOperator, value, effect }`
- Discriminate the union by operator: each operator variant declares its own value shape (`string` for `equals` text, `[number, number]` for `is within range`, `string[]` for `contains all of`)
- Builder validates conditions against current field types on save — stale conditions (because target field's type changed) get flagged in the UI and auto-clearable
- Engine evaluates by ID lookup, defensively narrows at runtime

This is a meaningful upgrade from the plan I wrote. Worth taking the time on.

**4. CSV vs snapshot inconsistency — flip to union-of-snapshots.**

Claude Code caught a real contradiction. We paid for snapshot semantics in D4; using a CSV strategy that drops historical data defeats the point. The "easier" choice landed without weighing the cost — Claude Code is right.

→ Tell Claude Code: CSV columns = union of fields across all instance snapshots, deduped by field ID, ordered by appearance in the most recent snapshot. Field labels come from the most recent snapshot that has each field (handles renames). Document the rule in README.

This is a small additional implementation cost (~30 mins) but consistent with the architectural choice.

**5. PDF spike day 1 — accept and reorder.**

Spot on. `@page` + `counter(page)` cross-browser, Safari quirks, page-break-inside on field rows — all real and time-sensitive. Discovering Safari's `@page` weirdness at hour 7 is the failure mode here.

→ Tell Claude Code: do a print stylesheet spike _immediately after type modeling_, before any UI work. Throwaway HTML, three browsers (Chrome/Firefox/Safari), validate `@page` margins, page numbers, and avoid-break behavior. Confirm constraints before committing to layout patterns in renderers.

**6. DnD vs up/down — make the call now.**

Spec says "DnD preferred." With your Storybook + design-system background, @dnd-kit is well within your wheelhouse and the polish difference is real. Up/down buttons read as "didn't have time" even if functionally equivalent.

My take: **ship @dnd-kit** with keyboard fallback (which @dnd-kit handles for free with KeyboardSensor). Budget 2 hours including accessibility wiring. If you're behind schedule by Phase 5, fall back to up/down — but don't pre-emptively cut.

→ Tell Claude Code: @dnd-kit with vertical-only constraint, KeyboardSensor enabled. Up/down buttons as fallback only if behind schedule.

**7. AI log discipline + README size — accept both.**

Both parts are right. The decision log is _planning notes_, not the README's architecture section. Reviewers reading 30K chars of prose before seeing code is the wrong shape of attention.

→ Tell Claude Code:

- Decision log stays in repo as `PLANNING_NOTES.md` (or similar) for completeness, but is **not** linked from README
- README's architecture section is **5–7 high-signal decisions**, each one paragraph: AND/OR, hidden-field-value, snapshot semantics, two-pass engine, registry pattern, PDF strategy, CSV column source. The actual write-up happens at submission time, not now.

For the AI log: capture entries as you go. The "plausibly wrong" example will appear naturally — when Claude Code suggests something and you go _"hmm, that's wrong"_ and fix it. Note that moment immediately, don't backfill.

---

## Summary of net changes to the plan

| #   | Change                                                                                            |
| --- | ------------------------------------------------------------------------------------------------- |
| 1   | Drop B2 — calcs aggregate over all sources                                                        |
| 2   | Expand registry: + operators, valueType, canBeCalcSource, capturesValue                           |
| 3   | Condition union discriminated by **operator**, not target type; tuple value for `is within range` |
| 4   | CSV columns = union of all instance snapshots                                                     |
| 5   | PDF spike before UI work, not at the end                                                          |
| 6   | @dnd-kit with keyboard fallback                                                                   |
| 7   | README architecture = 5–7 distilled items, not the full decision log                              |

## Answer to "Want to start there?"

Yes — lock the type model + registry contract on paper before any engine code. That's the highest-leverage thing in your next hour. Tell Claude Code: _"Accepting all seven points with these nuances [paste above]. Start with the type model + registry contract. Don't write engine code until I've signed off on the types."_

The signoff matters because the engine signature is downstream of the registry contract. If the registry is right, the engine practically writes itself. If the registry is missing pieces, you'll be re-typing through six files when the gap shows up.

Go run it.
