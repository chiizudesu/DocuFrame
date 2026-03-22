# FileGrid vs AI File Manager checklist — perceived performance

## Observation

The **AI File Manager** file checklist often feels more responsive than the **main FileGrid**, even when both show files from the same directory. That difference is mostly architectural, not “the checklist is inherently faster at drawing rows.”

## Why the main grid feels heavier

### 1. Whole-context subscription (`useAppContext`)

`FileGrid` uses `useAppContext()` and destructures many fields: `selectedFiles`, `clipboard`, `recentlyTransferredFiles`, `fileSearchFilter`, `contentSearchResults`, `currentDirectory`, `folderItems`, shortcuts-related state, etc.

With a standard React context implementation, **any change to the provider value re-renders every consumer** that uses that context. So operations that feel unrelated to the table—updating selection, clipboard, footer status, search filter, recent-transfer highlights—can still trigger a **full re-run of the entire `FileGrid` function**, including all hooks and top-level memo work in a very large component.

### 2. Global selection vs local selection

- **File manager** keeps checklist state in **local** `useState` (e.g. `Set` of selected names). Toggling checkboxes does not need to broadcast through global app state.
- **FileGrid** drives selection through **`selectedFiles` on `AppContext`**. Every selection change updates context and therefore contributes to re-renders for every `useAppContext()` subscriber, including `FileGrid` itself.

### 3. UI surface area per interaction

`FileGrid` drives `FileListView`: table chrome, sorting, optional **group-by-index** layout, **virtualization**, drag-and-drop, multiple columns, index pills, context menus, native icon loading, and more. Even with memoized rows, an expensive **parent** render still schedules reconciliation and prop propagation down the tree.

The file manager list is comparatively **simple rows** (checkbox, icon, filename) with optional preview/plan rows when there is pending AI work.

### 4. Intentional narrow subscription in the file manager

`AIFileManagerPane` uses `useAIFileManagerContextSelection()`, built on `use-context-selector`, so it **only re-renders when selected slices change** (e.g. `folderItems`, `currentDirectory`, pane open state)—not when `selectedFiles` or other unrelated context fields change.

That pattern is exactly what reduces “noise” re-renders for the pane.

## Probable solutions (highest impact first)

### A. Selective context for FileGrid (recommended direction)

Mirror the file-manager approach for the grid:

- Subscribe with **`use-context-selector`** (already in the project) to **only** the fields `FileGrid` truly needs for render.
- Optionally split context: e.g. **`FileGridStateContext`** (directory, folder list, selection, filters) vs **`AppChromeContext`** (status, logs, dialogs), so high-churn values don’t invalidate the grid.

**Goal:** selection or clipboard updates should not force a full `FileGrid` body re-render unless the grid actually depends on those values for what’s on screen.

### B. Stabilize or externalize high-churn props

- Pass **`selectedFiles` as a `Set` or ref** updated imperatively if you must avoid context churn (trade-offs: harder to reason about, need careful sync).
- Or use a **tiny store** (Zustand, Jotai, or a custom event + `useSyncExternalStore`) with **per-field subscriptions** for selection only.

### C. Split `FileGrid` by concern

The file is very large. Extracting **data subscription + list container** from **IPC / dialogs / context menu orchestration** reduces how much code runs per render and makes selective subscriptions easier to apply cleanly.

### D. Keep virtualization; fix the parent first

Virtualization limits **DOM** work, but it does not stop a **large parent** from re-rendering and recomputing virtualizer inputs. Optimizing row components helps at the margin; **reducing `FileGrid` re-renders from context** is usually the bigger win.

## Summary

| Factor | Main FileGrid | AI File Manager checklist |
|--------|----------------|---------------------------|
| Context scope | Broad `useAppContext()` | Narrow `useAIFileManagerContextSelection()` |
| Selection | Global `selectedFiles` | Local `useState` |
| Row / layout cost | Table, DnD, grouping, many features | Simple flex rows |
| Re-renders on unrelated app updates | Often | Much less |

The checklist feels snappier mainly because it **avoids whole-app context churn** and keeps **selection local**, while FileGrid is a **large** component subscribed to **many** frequently changing context fields.

## Related code (for navigation)

- `src/components/FileGrid.tsx` — uses selective hooks (`useFileGridDirectoryState`, `useFileGridSelectionState`, etc.) instead of full `useAppContext()` so unrelated app updates do not re-render the grid.
- `src/components/FileGrid/FileGridDialogs.tsx` — extracted dialog orchestration; subscription boundary for dialogs vs list.
- `src/components/FileGrid/FileGridUI.tsx` — `useFileGridNavigationRefs()` for `addressBarJumpRef` / `isQuickNavigating` only.
- `src/components/AIFileManagerPane.tsx` — local selection; simple row render.
- `src/context/AppContext.tsx` — `useAIFileManagerContextSelection` and FileGrid hooks above; `useAppContext` remains for components that truly need the full bag.

## Profiler verification

To confirm fewer FileGrid re-renders after the selective-context changes:

1. Run the app with React DevTools Profiler enabled (`npm run profiler` or `VITE_REACT_DEVTOOLS=true npm run dev`).
2. Start a Profiler recording.
3. Change footer status (e.g. open Settings, run a command) — FileGrid commit count should stay low.
4. Change selection or filter — FileGrid should commit (expected).
