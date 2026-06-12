# Plan: Edit PDF (reorder/delete pages) + page-level Merge

> **Status: implemented.** Both features build on the shared pdf.js layer from
> the split/hover work (`src/pdf/pdfDocument.ts`, `PdfPageCanvas.tsx`, and the
> now-shared `LazyPdfThumbnail.tsx`). Drag-reorder uses SortableJS — already a
> dependency and already the pattern in `ClientInfoPane` (Quick Access pins).

## Edit PDF

Context menu → PDF → **Edit PDF…** opens `src/components/FileGrid/EditPdfDialog.tsx`:

- Thumbnail grid of all pages; **drag to reorder** (SortableJS, same config as
  the sidebar: `animation: 150, forceFallback, fallbackTolerance: 5`).
- Hover a tile → red ✕ **removes** the page; removed pages collect in a strip
  below and click-restore back into original-number position. Moved pages get
  a blue underline + "(was N)" caption. Reset reverts everything.
- **Save as** name pre-filled with the original stem:
  - same name → **overwrite in place**: the `edit-pdf` IPC backs the original
    up to `%TEMP%\docuframe-pdf-backups\` first and returns `backupPath`;
    undo restores it via the new `restore-file-backup` IPC. The Version column
    bumps (`versionStore.bump`) so edits read as replacements.
  - different name → new file next to the original (collision-safe via
    `uniqueOutputPath`); undo deletes it.
- Backend: `edit-pdf` IPC (`electron/main.ts`, next to `split-pdf`) — pdf-lib
  `copyPages` with the explicit 1-based order; validates bounds and non-empty.

## Page-level Merge

`MergePDFDialog.tsx` keeps its file checkbox list, and once **2+ files** are
selected a **Pages** strip appears:

- One tile per page of every selected file, color-coded per source (the
  checkbox rows show the same color dot once selected).
- **Click a tile** to exclude/include it (excluded = dimmed, dashed red
  border); **drag** to reorder freely — including interleaving pages across
  source files. "Reset pages" rebuilds selection order.
- Each selected file loads through an invisible `SourcePdfLoader` into the
  shared document cache (cache sized to 12 docs for this dialog).
- Degraded mode: if any selected file can't be parsed by pdf.js, a notice
  appears and the merge falls back to the legacy whole-file behavior.
- Backend: `mergePdfs.ts` accepts an optional
  `pages: [{ file, page }]` payload (wins over whole-file merging); loads each
  unique source once, copies single pages in output order. Legacy callers
  (FunctionPanels, pdfinc command) are untouched.

## Future work

- Cross-document page *insertion* in Edit PDF (drag a page in from another PDF)
  — the merge plumbing already supports the output side.
- Rotate-page button on tiles (pdf-lib `setRotation`).
- Undo for merge outputs (parity with split/edit).
