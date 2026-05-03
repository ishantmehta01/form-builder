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

## Extension points

To add more dev actions: add a new `<button>` inside `data-testid="dev-tools-menu"` and the corresponding state/dialog. No restructuring needed.

Potential additions: *Seed sample data*, *Export state JSON to file*, *Toggle slow-network simulation*.
