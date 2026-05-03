# AI Log Discipline — Paste into Claude Code

> Copy everything below the `---` line into Claude Code at the start of any session where implementation work happens. Or add it to `CLAUDE.md` so it auto-loads every session.

---

You're maintaining `AI_USAGE_LOG.md` in this folder as we build. Read it now to see the format and the planning-phase entries that already exist.

**Discipline rules:**

**1. Append, don't rewrite.** New entries go after the `## Implementation entries` line at the bottom of `AI_USAGE_LOG.md`. Never modify or delete the existing planning entries (entries 1–6) — those are signed-off historical record.

**2. Capture live, not retroactive.** When you do work that warrants an entry, write the entry in the same response where the work happens — not at end-of-session, not at end-of-day. Imperfectly-captured-now beats perfectly-reconstructed-later. The reviewer can tell the difference between a real-time entry and a backfilled one.

**3. What counts as a "significant" entry.** Not every prompt deserves an entry. The bar:

- Architectural choices (e.g., "should this be a hook or a context provider," "Zustand slice or separate store")
- Non-obvious bugs you produced that Ishant caught — or you caught yourself during testing
- Cases where Ishant pushed back and you changed direction
- Cases where you produced something that *looked* right but was actually wrong
- Implementation surprises (the type model assumed X but reality needs Y)
- Tooling/dependency decisions made during the build (not the planning-phase ones — those are already logged)
- Test failures that revealed a design flaw, not just a typo

Skip: routine boilerplate, mechanical type translation, one-line fixes, formatting changes.

**4. Format per entry** (match existing entries):

```
## Entry N — [Short specific title]
**Phase:** [Type translation / Engine / Storage / Field registry / Builder UI / Fill UI / PDF / CSV / Polish]
**Tool:** Claude Code

**Prompt:** what Ishant asked, summarized in 1–2 sentences
**Output summary:** what you produced (the substance, not the syntax)
**Verified:** what was checked before merging — test results, type-check pass, manual review, browser test, etc.
**Used as-is / Modified / Rejected:** which one, with the reason in 1–2 sentences

[Optional 1–2 sentence reflection if there's a real lesson worth capturing]
```

**5. Voice — first-person from Ishant's perspective.** He's the one keeping the log. Use "I asked Claude Code to..." not "Claude Code was asked to..." When in doubt, write what *Ishant verified* and *Ishant accepted/rejected*, not what you generated. Avoid passive voice. Avoid AI-sounding boilerplate ("This entry documents..." / "In conclusion..." / "It is worth noting..."). Match the tone of the existing entries 1–6.

**6. The "plausibly wrong" discipline.** Across the implementation phase, at least one entry should describe a case where you produced output that *looked* correct but was actually wrong — and Ishant caught it, or it surfaced during testing. **Do not manufacture this.** Let it happen naturally and capture it when it does. If you genuinely never produce a plausibly-wrong output across the whole build, that itself is worth noting in a final reflection entry.

**7. Quality over quantity.** Five rich entries beat twenty thin ones. The whole-build target is roughly **5–8 substantial implementation entries** added on top of the existing 6 planning entries — total log of ~11–14 entries. If you find yourself adding more than 8, you're padding; cut.

**8. When you finish a phase**, before moving to the next phase, do a quick pass: did anything from this phase warrant an entry? Capture it now if so. Phase boundaries are natural reflection points.

Confirm you've read `AI_USAGE_LOG.md` and these discipline rules before continuing with implementation work.
