# Plan: Visual Split-PDF Dialog (page thumbnails + filename control)

> **Status: planned.** Replaces the text-input range dialog with a thumbnail
> grid where the user *sees* the pages they're splitting, and names the output
> files (sensible default, fully editable).

Goal: right-click → PDF → Split PDF… opens a dialog showing every page as a
thumbnail. The user selects pages (or split points), sees exactly which output
files will be created and what they'll be called, edits names if wanted, and
confirms.

## Current state (as of this plan)

- **Dialog** (`src/components/FileGrid/SplitPdfDialog.tsx`, 138 lines): radio
  choice between "Extract page ranges" (free-text `1-3, 5`) and "Split into
  single pages". Page count fetched via `getPdfPageCount` IPC. No visual
  feedback, no filename control.
- **Backend** (`electron/main.ts` ~3909–3957, `split-pdf` IPC): pdf-lib
  `copyPages` per segment; names hardcoded to `{stem} - Page N.pdf` /
  `{stem} - Pages A-B.pdf`; collision-safe via `uniqueOutputPath()` (~3801).
- **Frontend handler** (`src/components/FileGrid.tsx` ~2531–2552): refresh,
  green-highlight outputs, log/status, **undo** (deletes outputs) — all reusable
  unchanged.
- **Wiring**: `split_pdf` context-menu case at `FileGrid.tsx` ~1839 sets
  `splitPdfFile` + `isSplitPdfOpen`. Menu item in `FileGridUI.tsx` ~371.
- **Rendering libs**: `react-pdf` 10.1 / `pdfjs-dist` 5.4 installed, unused.
  The hover-preview plan (`pdf-hover-preview-plan.md`) introduces a shared
  `usePdfDocument` LRU loader + worker setup — this dialog consumes the same
  utility, loading the file over the existing Express HTTP URL.
- **Dialog conventions**: Chakra `Dialog.Root` + `Portal` + `useDialogChrome()`
  (see MergePDFDialog, IndexPrefixDialog for list-selection and filename-input
  patterns).

## UX design

### Layout (Dialog size="lg")

```
┌─ Split "GST Return Mar 2026.pdf" — 14 pages ────────────────┐
│  [Select pages ▾]  [Split at points]  [Every page]          │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  [1]  [2]  [3]  [4]  [5]  [6]   ← thumbnail grid         │ │
│ │  [7]  [8]  [9] [10] [11] [12]      (scrolls, virtualized)│ │
│ │ [13] [14]                                                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│  Output files (2):                                           │
│  ▸ pages 1–3   [GST Return Mar 2026 - Pages 1-3        ].pdf │
│  ▸ pages 7, 9  [GST Return Mar 2026 - Pages 7, 9       ].pdf │
│                                   [Cancel]  [Split → 2 PDFs] │
└──────────────────────────────────────────────────────────────┘
```

### Two modes (segmented control, replaces the radios)

1. **Select pages** (default): click toggles a page in/out of the current
   selection; Shift+click selects a range; Ctrl+click adds disjoint pages.
   One selection = **one output file**. An "**+ Add another output**" action
   freezes the current selection as output #1 (colored badge on its pages)
   and starts selection #2 — so one dialog visit can extract several
   documents (the real-world case: pulling statements/invoices out of a
   scanned bundle).
2. **Split at points**: hovering the *gutter between* two thumbnails shows a
   scissors line; clicking sets a split point. N points = N+1 segments, every
   page used exactly once. This is "cut the document up" as opposed to
   "extract from it". Each segment gets a colored underline matching its row
   in the output list.
3. **Every page** button = shortcut that fills the output list with one
   segment per page (current "singles" mode, now previewable before commit).

Selected pages get a blue ring + check badge (selection mode) or per-segment
color coding (split-points mode). A text field above the grid still accepts
typed ranges (`1-3, 5`) for keyboard users — typing updates the visual
selection live, so the old workflow isn't lost.

### Thumbnails

- `react-pdf` `<Page>` at thumbnail scale (~120 px wide), rendered lazily:
  only visible rows render (reuse `@tanstack/react-virtual`, already a
  dependency, for the grid rows). Placeholder skeletons until painted.
- Click a thumbnail's magnifier (or double-click) → enlarged single-page
  peek (simple overlay, reuses the hover-preview popup component if Phase 2
  of that plan has landed; otherwise a plain larger render).
- Document proxy comes from the shared LRU cache, so opening Split right
  after hover-previewing the same file is instant.

### Filename control

- Every output row shows an **editable name input**, pre-filled with the
  current default (`{stem} - Pages 1-3`), `.pdf` shown as a fixed suffix
  outside the input (matches MergePDFDialog).
- Validation per row, live: invalid Windows chars (`/[<>:"/\\|?*\x00-\x1f]/`,
  same rule as `electron/main.ts` ~1895), max length, non-empty, duplicate
  names *within the dialog*, and collision with existing files in the
  directory (check against the grid's current file list; on conflict show
  "will save as … (2)" hint — backend `uniqueOutputPath` remains the final
  guard).
- In **Every page** mode with many pages, a single **pattern field** instead
  of N inputs: `{stem} - Page {n}` with `{n}`/`{name}` tokens, plus the first
  three rows previewed beneath it.

## Backend change (one, backward-compatible)

Extend the `split-pdf` IPC options with an explicit-segments form:

```ts
splitPdf(filePath, {
  segments: Array<{ pages: number[]   // 1-based page numbers, in output order
                    name: string }>   // base name, no extension
})
```

Handler: validate page bounds + sanitize names (reuse the invalid-char rule;
`uniqueOutputPath(dir, name, '.pdf')` for collisions), then the existing
`writePages` loop with the provided name instead of the generated label.
Keep the legacy `{ mode, ranges }` shape working so nothing else breaks during
the transition; delete it once the new dialog ships.

`FileGrid.tsx`'s `handleSplitPdfConfirm` needs no structural change — it
already consumes `result.outputFiles` and wires refresh/highlight/undo.

## Phases

### Phase 1 — Thumbnail selection + single output
New dialog body: thumbnail grid (lazy rendering), click/Shift/Ctrl selection,
one output row with editable, validated filename. Extend the IPC with
`segments`. Range text field kept in sync. Ship behind the existing menu item.

### Phase 2 — Multi-output
"+ Add another output" with per-segment color badges; split-at-points mode
with gutter scissors; "Every page" with pattern field. Output-list rows get
remove/reorder.

### Phase 3 — Polish
Enlarged page peek, virtualized grid tuning for 200+ page documents
(thumbnail render cancellation on scroll, same pattern as the hover-preview
plan), drag-rubber-band selection over thumbnails, remember last-used mode.

## Edge cases

- **Encrypted PDFs**: backend already loads with `ignoreEncryption: true`;
  if pdf.js can't render thumbnails for one, fall back to numbered placeholder
  tiles — selection and split still work (the visual layer degrades, the
  operation doesn't).
- **Huge documents**: cap initial render to visible tiles only; page count is
  known up-front from `getPdfPageCount`, so the grid sizes correctly without
  rendering anything.
- **Zero-page selection / empty segment**: Split button disabled with reason
  text, never an error dialog after the fact.
- **Name races**: directory contents can change while the dialog is open;
  `uniqueOutputPath` on the backend is the source of truth, the renderer
  check is advisory only.
