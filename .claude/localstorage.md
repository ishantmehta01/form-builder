Cross-Tab localStorage Sync

Context

Two tabs of the form-builder app open at the same origin currently drift: a template added in Tab A is invisible in Tab B until B is reloaded. Reason: every save() writes to
localStorage['formBuilder'], but no tab listens for the browser's storage event, which fires in other same-origin tabs whenever localStorage changes. The user wants a save in one tab to surface in
all open tabs.

The fix is to install a single global storage event listener that re-reads localStorage and rebroadcasts the result to the Zustand stores. The trade-off is conflict handling for the Builder page,
which holds significant unsaved local state — the user has chosen "warn and offer reload" so cross-tab writes never silently destroy in-progress edits.

Decisions (confirmed by user)

1.  Builder conflict policy: Warn + offer reload. If a remote tab writes while Builder has isDirty=true for the same template, show a banner; do NOT replace the local Builder state. User clicks
    "Reload" to discard local edits and re-hydrate.
2.  Bulk clear (key === null): Treat as a sync trigger. load() returns empty defaults; both stores empty.
3.  Remove redundant loadFromStorage in TemplatesList.tsx — global hook is the single hydration source.

Approach

Three new modules + small edits to existing files:

New: src/storage/syncFromStorage.ts

export function syncFromStorage(): void

Calls load() once, broadcasts to both stores via useTemplatesStore.setState and useInstancesStore.setState. Wrapped in try/catch — on failure (e.g. version-newer-than-app), logs and leaves stores in
their prior state.

Why one shared function instead of per-store: avoids running load() (which re-validates cycles) twice per event, and guarantees both stores see the same snapshot.

New: src/storage/activeEditorRegistry.ts

A minimal module-level registry so the listener knows which template (if any) is being actively edited:

let active: { templateId: string; isDirty: boolean } | null = null
export function setActiveEditor(v: { templateId: string; isDirty: boolean } | null): void
export function getActiveEditor(): { templateId: string; isDirty: boolean } | null

Builder calls setActiveEditor on mount and whenever isDirty changes, and setActiveEditor(null) on unmount/save.

New: src/storage/useStorageSync.ts

React hook used once at the top of App.tsx:

- On mount: run syncFromStorage() for initial hydration.
- Register window.addEventListener('storage', handler).
- Handler logic:
  - If e.key !== 'formBuilder' && e.key !== null → ignore.
  - Re-read via load(). Compare incoming templates[active.templateId] against current store value.
  - If getActiveEditor() is non-null AND isDirty === true AND the incoming snapshot of that template differs from what's currently in the store → push a sticky toast/banner: "Another tab changed
    this form. Reload to see changes." with a Reload action that calls syncFromStorage() (and Builder's effect will then re-hydrate from the store).
  - Otherwise → call syncFromStorage() normally.
- Cleanup on unmount.

Existing: extend toast store to support an action button

src/stores/toasts.ts currently holds { id, message, type } and renders text only (per memory: toast store created May 3). Extend the type to optional action?: { label: string; onClick: () => void }
and update ToastContainer to render a button when action is present. This is a minimum addition — needed for the "Reload" affordance.

If extending the toast feels too invasive, the alternative is an inline banner inside Builder.tsx driven by a pendingRemoteChange flag. Either works; toast extension is cleaner and reusable.

Edits

┌───────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ File │ Change │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/App.tsx │ Call useStorageSync() once inside the App component. │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/stores/templates.ts │ loadFromStorage → thin wrapper delegating to syncFromStorage(). Public API preserved for tests. │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/stores/instances.ts │ Same — loadFromStorage → syncFromStorage(). │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/pages/TemplatesList.tsx │ Remove the useEffect that calls loadFromStorage() / loadInstances() (now handled globally). │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/pages/Builder.tsx │ On mount: setActiveEditor({ templateId, isDirty: false }). Update on isDirty change. On unmount and after successful save: │
│ │ setActiveEditor(null). │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/stores/toasts.ts │ Add optional action field to toast type. │
├───────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ src/components/ToastContainer.tsx (or wherever toasts │ Render action button when present. │
│ render) │ │
└───────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Files (critical)

- src/storage/syncFromStorage.ts (new)
- src/storage/useStorageSync.ts (new)
- src/storage/activeEditorRegistry.ts (new)
- src/storage/load.ts (read-only — already does cycle validation, version check, parse safety; reused as-is)
- src/storage/save.ts (untouched — storage event browser semantics mean we don't self-filter)
- src/App.tsx (mount the hook)
- src/stores/templates.ts, src/stores/instances.ts (delegate to shared sync)
- src/stores/toasts.ts (add action field)
- src/pages/Builder.tsx (active-editor registration)
- src/pages/TemplatesList.tsx (remove redundant load)

Out of Scope

- CRDT / merge / vector clocks. Last-write-wins remains the model for non-active templates and is documented.
- Quota exceeded handling on save. Pre-existing gap; separate ticket.
- DevTools dock state (\_\_devtools.docked). Per-window preference; intentionally not synced.
- BroadcastChannel. storage event is sufficient and supported everywhere we care about. If we ever add a second sync path, we'd need self-write filtering.

Verification

1.  Unit tests (vitest):

- src/storage/syncFromStorage.test.ts — seeded localStorage replays into both stores; corrupt JSON → empty defaults; version mismatch → stores untouched.
- src/storage/useStorageSync.test.ts — renderHook, dispatch synthetic StorageEvent for key='formBuilder', assert store updated. Test key='other' ignored, key=null triggers sync,
  dirty-active-editor case shows toast (mock toast store) instead of mutating store.
- src/storage/activeEditorRegistry.test.ts — set/get/clear semantics.

2.  Manual cross-tab verification (E2E doesn't easily exercise true cross-tab storage events; document in PR):

- Open / in two tabs. Add template in A → appears in B's list within ~50ms.
- Delete template in A → drops from B's list and any orphan instances are gone.
- Submit instance via Fill in A → B's /templates/:id/instances shows it (refresh-free if already on that route).
- Edit a form in B (make it dirty), save same form in A → B shows banner/toast with Reload action; clicking it discards B's edits and re-hydrates.
- DevTools → Application → Clear storage in A → B's stores empty (list shows empty state).

3.  Type/build/test gates:

- npm run typecheck clean.
- npm test — existing 343+ tests still pass; new tests added.
- npm run build green.
