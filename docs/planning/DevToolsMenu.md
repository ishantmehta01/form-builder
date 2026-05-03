# Dev Tools Menu — Implementation Reference

> This document reflects what was actually built. Use it as a reference for E2E tests or future extension.

---

## What was built

A floating Dev Tools menu in the bottom-right corner of the viewport, visible on all routes. Two actions: **Show localStorage** and **Clear localStorage**.

### Files created / modified

| File | Change |
|------|--------|
| `src/components/DevToolsMenu.tsx` | Floating button + popover menu + confirm dialog + storage viewer modal |
| `src/components/JsonTree.tsx` | Recursive expand/collapse JSON tree component |
| `src/components/DevToolsMenu.test.tsx` | 13 tests covering all interactions |
| `src/App.tsx` | `<DevToolsMenu />` mounted after `<Routes>` |

---

## Component behaviour

### Floating button
- Fixed position, bottom-right (`bottom: 16px; right: 16px; z-index: 50`)
- Small round button with `⚙` icon
- `data-testid="dev-tools-button"`
- Clicking toggles the popover menu

### Popover menu
- `data-testid="dev-tools-menu"`
- Closes on outside click (mousedown listener)
- Two items (top to bottom):
  1. **Show localStorage** (`data-testid="show-storage-action"`)
  2. **Clear localStorage** (`data-testid="clear-storage-action"`)

### Show localStorage
- Reads `localStorage.getItem('formBuilder')`
- If key absent: shows italic `(empty — no formBuilder key found)` message
- If key present: parses JSON and renders it in `JsonTree` (expand/collapse tree)
- Opens a wide modal (`700px`, `max 90vw`, `max 80vh`) with scrollable content
- Close button (`data-testid="close-storage-viewer"`) top-right; backdrop click also closes
- Escape key closes the modal

### Clear localStorage
- Opens a confirm dialog (`role="dialog"`)
- Warning text: *"Delete all templates and responses? This wipes everything in localStorage and cannot be undone."*
- **Cancel** (`data-testid="cancel-clear-storage"`) — closes dialog, no-op; auto-focused
- **Confirm** (`data-testid="confirm-clear-storage"`) — calls `localStorage.removeItem('formBuilder')` then `window.location.reload()`
- Escape key closes the dialog without clearing

---

## JsonTree component (`src/components/JsonTree.tsx`)

Recursive tree renderer. Props: `{ value: unknown }`.

- Objects and arrays are collapsible nodes; start **expanded at depth 0**, collapsed at depth 1+
- Collapsed nodes show `{ … }` or `[ … ]` with item/key count
- Expanded nodes show children indented with a left border guide line
- Primitives: `null` gray, booleans blue, numbers blue, strings green
- Keys rendered in purple
- No external dependencies — plain React + Tailwind

---

## data-testid map

| testid | Element |
|--------|---------|
| `dev-tools-button` | Floating gear button |
| `dev-tools-menu` | Popover menu container |
| `show-storage-action` | "Show localStorage" menu item |
| `clear-storage-action` | "Clear localStorage" menu item |
| `storage-content` | Storage viewer modal body wrapper |
| `json-tree` | Root element rendered by JsonTree |
| `close-storage-viewer` | × close button on storage viewer |
| `cancel-clear-storage` | Cancel button in confirm dialog |
| `confirm-clear-storage` | Confirm button in confirm dialog |

---

## Test coverage (`src/components/DevToolsMenu.test.tsx`)

13 tests, all passing as of 2026-05-03.

**Core menu (8 tests)**
1. Floating button renders
2. Click button opens the menu
3. Click outside closes the menu
4. Click "Clear localStorage" opens confirm dialog
5. Cancel closes dialog without clearing
6. Confirm calls `localStorage.removeItem('formBuilder')`
7. Confirm triggers `window.location.reload()`
8. Escape closes confirm dialog without clearing

**Show localStorage (5 tests)**
9. Opens storage viewer dialog
10. Shows empty message when key absent
11. Shows JSON content when key present
12. Close button dismisses viewer
13. Escape closes viewer

---

## Extension: Right-side dock mode (TO IMPLEMENT)

> Paste everything in this section into a fresh Claude Code session running in `/Users/ishantmehta/Desktop/work/form-builder`. Use `/model sonnet`, `/effort high`. Should take 25–35 min.
>
> **Context:** the existing storage viewer (modal mode) is built and tested. This adds a side-by-side **dock mode** for rapid manual E2E testing — open once, watch state mutate live as you click through scenarios. The modal stays as the default; dock is opt-in.

### What to build

**Dock toggle in the existing storage viewer modal.**

When the modal is open (Show localStorage), add a `Dock to right →` button in its header. Clicking it:
1. Closes the modal
2. Opens a fixed-position right-edge panel containing the same JSON tree
3. Persists `formBuilder.devToolsDocked = true` so the dock auto-reopens on page reload

**The docked panel:**
- Position: `fixed; top: 0; right: 0; height: 100vh; width: 360px; z-index: 40` (below the modal's z-50, above page content)
- Visual: left border, white background, shadow on the left edge, scrollable content area
- Header bar: title "localStorage", refresh button (manual fallback), undock button (`← Undock`), close button (`×`)
- Body: same `<JsonTree>` component, but expanded one level deeper by default (depth 0 + depth 1 expanded since the panel is taller than the modal)
- **Auto-updates live** when localStorage changes — see "Live updates" below
- Pushes page content left? No — overlay on top with semi-transparent main content. Simpler. Add `body.dock-open { padding-right: 360px }` if you want push-mode, but overlay is fine for take-home scope.

**The dock toggle button:**
- Lives in the storage-viewer modal header, right-aligned
- `data-testid="dock-storage-viewer"`
- Closes the modal AND opens the dock in one action

**Undock button (in dock header):**
- `data-testid="undock-storage-viewer"`
- Closes the dock AND reopens the modal at the same scroll position
- Persists `formBuilder.devToolsDocked = false`

**Close button (in dock header, separate from Undock):**
- `data-testid="close-dock"`
- Closes the dock entirely (does NOT reopen modal)
- Persists `formBuilder.devToolsDocked = false`

**Persistence:**
- Use a separate localStorage key `formBuilder.devToolsDocked` (NOT inside the `formBuilder` blob — keep dev preferences out of the data schema; they shouldn't survive Clear localStorage)
- On app boot, if the key is `'true'`, auto-mount the dock
- Wait — Clear localStorage WOULD wipe this preference too because it iterates all `formBuilder.*` keys. Solution: use a different prefix entirely, e.g., `__devtools.docked`. Document this choice.

### Live updates — Zustand subscription

The dock should re-render whenever the underlying state changes. Two paths:

**Preferred: subscribe to both Zustand stores.**
```ts
import { useTemplatesStore } from '@/stores/templates';
import { useInstancesStore } from '@/stores/instances';

// In the dock component:
const templates = useTemplatesStore((s) => s.templates);
const instances = useInstancesStore((s) => s.instances);

// Re-fetch + re-render localStorage display whenever either store changes
const [storageJson, setStorageJson] = useState<unknown>(null);
useEffect(() => {
  try {
    const raw = localStorage.getItem('formBuilder');
    setStorageJson(raw ? JSON.parse(raw) : null);
  } catch {
    setStorageJson(null);
  }
}, [templates, instances]);
```

This re-reads localStorage on any store change, which covers add/update/delete operations across templates and instances. The `useEffect` dep array makes it deterministic.

**Manual refresh button** (also in the dock header, `data-testid="refresh-dock"`) — fallback for cases where state changes don't go through the Zustand stores (e.g., direct localStorage edits via DevTools, multi-tab edits via `storage` event).

### Mobile / narrow viewport

Width < 800px → hide the dock toggle button (still works in modal mode). Don't try to be clever. Document in PROGRESS.md.

### Files to modify

| File | Change |
|---|---|
| `src/components/DevToolsMenu.tsx` | Add dock toggle button to storage viewer header; conditionally render dock panel based on persisted state |
| `src/components/DevToolsDock.tsx` | NEW — the right-side dock panel component (header + JsonTree body + auto-refresh hook) |
| `src/App.tsx` | Mount `<DevToolsDock />` alongside `<DevToolsMenu />` so the dock can render independently |
| `src/components/DevToolsMenu.test.tsx` | Add 4–5 tests for dock toggle, persistence, undock, close, live update |
| `src/components/DevToolsDock.test.tsx` | NEW — unit tests for dock-only behavior (mount on persisted preference, refresh button, JsonTree integration) |

### data-testid additions

| testid | Element |
|---|---|
| `dock-storage-viewer` | "Dock to right" button in modal header |
| `dev-tools-dock` | Dock panel root |
| `undock-storage-viewer` | "← Undock" button in dock header |
| `close-dock` | "×" button in dock header |
| `refresh-dock` | Manual refresh button in dock header |

### Tests to add (~6 new tests)

**DevToolsMenu.test.tsx (extension):**
1. Modal contains "Dock to right" button when storage viewer is open
2. Clicking dock button closes modal AND mounts dock (assert `data-testid="dev-tools-dock"` visible)
3. Persists `__devtools.docked = 'true'` on dock; `'false'` on undock
4. On mount, if `__devtools.docked === 'true'` in localStorage, dock auto-shows

**DevToolsDock.test.tsx (new):**
5. Dock renders with JsonTree
6. Refresh button re-reads localStorage and updates display
7. Live update: triggering a Zustand store change re-renders the dock (write to templates store, assert dock JsonTree contains new template ID)

### Verification

After implementation:
1. `npm run typecheck` → clean
2. `npm test -- --run` → all tests pass; test count rises from 314 → ~320
3. `npm run dev` → manual sanity:
   - Open storage viewer modal → see Dock button → click → modal closes, dock appears on right
   - Click "New Template", save → dock JSON tree updates without manual refresh
   - Reload page → dock still open (persisted)
   - Click Undock → dock closes, modal reopens
   - Click × on dock → dock closes, no modal
   - Reload again → dock stays closed (preference saved as false)
   - Trigger Clear localStorage → dock preference NOT cleared (because key prefix `__devtools.` is outside `formBuilder`)
4. `npm run build` → clean

### PROGRESS.md update

```markdown
## 2026-05-03 HH:MM — DevTools dock mode (right-side panel)

Extended DevToolsMenu with optional right-side docked panel showing live localStorage state. Dock vs modal toggle, persistence via separate `__devtools.docked` key (excluded from Clear localStorage scope), Zustand subscription drives live updates without polling. Added 6 new tests across DevToolsMenu.test.tsx and new DevToolsDock.test.tsx. Total tests: 320. Useful for: (1) S1–S16 manual walkthrough — see state mutate without click-detour, (2) Playwright debugging where you want to inspect intermediate state, (3) demo'ing the app to a reviewer who's curious about the persistence model.
```

### Hard rules

- Same as DevToolsMenu's original prompt: never `cd` outside the project, never `git commit/push`, never `rm -rf`, never `sudo`, never touch `AI_USAGE_LOG.md`
- Don't break the existing 8 DevToolsMenu tests or 5 storage-viewer tests
- Don't change the modal's existing API — dock is purely additive

### Stop condition

Dock implemented, persistence works across reloads, live updates work without manual refresh, all tests pass, typecheck + build clean, PROGRESS.md updated.

---

## Other extension points (future)

To add more dev actions to the menu: add a new `<button>` inside `data-testid="dev-tools-menu"` and the corresponding state/dialog. No restructuring needed.

Potential additions: *Seed sample data*, *Export state JSON to file*, *Toggle slow-network simulation*, *View invalid templates list (quarantined per A3)*.
