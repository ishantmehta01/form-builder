# Polish Fixes — Two Small Gaps

> Paste everything below the `---` line into the same Claude Code session that just finished the gap-fill (it has fresh context), OR a new session running in `/Users/ishantmehta/Desktop/work/form-builder`. Use `/model sonnet`, `/effort high`. Should take 15–20 minutes total.

---

Two small polish gaps logged in PROGRESS.md after the gap-fill. Fix both, add tests, verify, log to PROGRESS.md, stop.

## Fix 1 — `aria-describedby` on renderer inputs (M2 a11y)

Validator errors are rendered below each field but not programmatically associated with the input. Screen reader users won't hear the error when focused on the field. Wire it correctly.

**For every value-capturing field renderer** (text, textarea, number, date, single_select, multi_select, file — NOT section_header, NOT calculation read-only):

1. The errors container gets a stable ID:
   ```tsx
   const errorId = `field-${field.id}-error`;
   {errors.length > 0 && (
     <div id={errorId} role="alert" data-testid={`field-error-${field.id}`}>
       {errors.map((e, i) => <p key={i}>{e.message}</p>)}
     </div>
   )}
   ```
2. The input element conditionally references it:
   ```tsx
   <input
     ...
     aria-describedby={errors.length > 0 ? errorId : undefined}
     aria-invalid={errors.length > 0 || undefined}
   />
   ```
3. For composite renderers (single_select tiles, multi_select checkboxes), apply `aria-describedby` to the group container or the first focusable element — whichever is more semantically correct. Don't paste it on every checkbox.
4. Use `exactOptionalPropertyTypes`-friendly form: `aria-describedby={errors.length > 0 ? errorId : undefined}` (NOT `aria-describedby={errors.length > 0 ? errorId : ''}`)

**Tests:** add to each affected `*.test.tsx` (one assertion each — table-driven if you want):
- Render with `errors: []` → input does NOT have `aria-describedby` attribute
- Render with `errors: [{ rule: 'required', message: 'Required' }]` → input has `aria-describedby` matching the error container's `id`; container has `role="alert"`

## Fix 2 — Instance count in TemplatesList delete confirmation

Per decision-log D3, the delete confirmation should read like:

> *"Delete template 'Onboarding'? 14 filled responses will also be deleted. This cannot be undone."*

Currently the modal shows the template title but not the instance count.

1. In `src/pages/TemplatesList.tsx` (or wherever the delete handler lives), compute the instance count for the template-being-deleted from the instances store:
   ```ts
   const instanceCount = Object.values(instances).filter(i => i.templateId === templateId).length;
   ```
2. Update the confirm message to include the count. Use `window.confirm` if that's what's already there, OR a custom modal if one exists. Match the existing pattern.
3. Edge case: instance count of 0 — message should still be informative. *"Delete template 'Onboarding'? No filled responses exist. This cannot be undone."* OR just hide the responses sentence — pick one and stay consistent.
4. Pluralization: "1 filled response" vs "14 filled responses" — handle both.

**Tests:** update `src/pages/TemplatesList.test.tsx`:
- With 0 instances → confirm message contains template title; either omits the count line OR says "No filled responses"
- With 1 instance → confirm contains "1 filled response" (singular)
- With 5 instances → confirm contains "5 filled responses" (plural)

If the existing test mocks `window.confirm`, extend it to capture the message string and assert against it. If it uses a custom modal, query the modal text.

## Verification

Run all of these — must pass cleanly:
1. `npm run typecheck`
2. `npm test -- --run` — should show 277 + N new tests (N = however many you added; ~10–15 expected)
3. `npm run build`

## PROGRESS.md update

Append a `## 2026-05-03 HH:MM — Polish fixes (post gap-fill)` entry summarizing:
- aria-describedby wired on which renderers
- Instance count added to delete confirmation, with pluralization
- New test count, total test count

Then resolve the two ⚠️ entries from the previous run:
- Either delete the entries (they're fixed)
- OR mark them with `✅ RESOLVED — see entry at HH:MM` so the audit trail is clear

## Hard rules

- Same as previous prompts: never `cd` outside the project, never `git commit/push`, never `rm -rf`, never `sudo`, never touch `AI_USAGE_LOG.md`.
- Do NOT modify any test that's already passing unless your changes require it.
- Do NOT use `.skip()` to dodge a failing test — debug it.

## Stop condition

When both fixes are in, all tests pass, typecheck + build clean, PROGRESS.md updated. Don't wait for input.
