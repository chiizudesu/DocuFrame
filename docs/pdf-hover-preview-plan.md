# Plan: Interactive PDF Hover Preview Popup

> **Status: planned.** Separate feature from the Preview Pane — a floating,
> interactive popup that appears when hovering a PDF row, with zoom, drag-to-pan,
> and page navigation. The Preview Pane stays as-is for "pinned" previews.

Goal: hovering a PDF file row (after a short intent delay) shows a floating
popup rendering the first page. The popup is itself hoverable — the user can
move the mouse into it, scroll-zoom, drag to pan, and step through pages —
without ever opening the side Preview Pane.

## Current state (as of this plan)

- **Preview Pane** (`src/components/PreviewPane.tsx`): renders PDFs in an
  Electron `<webview>` pointed at the Express server
  (`http://localhost:3001/files/...`, see `electron/main.ts` ~54–145 and
  `convertFilePathToHttpUrl` ~600–631). Selection-driven, not hover-driven.
- **Hover infra** (`src/components/FileGrid/ListRowHoverContext.tsx`):
  fine-grained per-row hover via `use-context-selector`, 16 ms throttle,
  50 ms leave-debounce. `useListRowIsHovered(index)` already drives the
  row action strip (Eye / Rename / Prefix icons) in `FileListView.tsx` ~189–237.
- **Libraries**: `react-pdf` 10.1 and `pdfjs-dist` 5.4 are installed but
  **unused** — the webview does all rendering today. `pdf-lib` is manipulation
  only.
- **Portals**: Chakra `Portal` + `Popover` with `strategy: 'fixed'` is the
  established floating-UI pattern (see GroupHeaderDropZone transfer popover,
  `FileListView.tsx` ~1122–1383, z-index 10000).

## Key design decision: render with pdf.js canvas, not a webview

The webview approach is wrong for a hover popup:

- webviews are heavyweight to mount/destroy (hover popups open and close
  constantly);
- zoom/drag/page state lives inside the PDF.js viewer page and can only be
  poked via `executeJavaScript` injection — fragile;
- mouse events don't propagate out of a webview, so "close when the mouse
  leaves popup" becomes guesswork.

Instead, use **`react-pdf`'s `<Document>`/`<Page>`** (canvas rendering in the
renderer process). The file loads over the **existing Express HTTP URL** — no
new IPC needed, CORS is already open. Zoom/pan/page-nav become plain React
state. This is also the same loader the improved Split-PDF dialog thumbnails
will use (see `pdf-split-dialog-plan.md`) — build the document-loading utility
once, share it.

One-time setup: configure the pdf.js worker
(`pdfjs.GlobalWorkerOptions.workerSrc`) from the bundled `pdfjs-dist` build so
rendering happens off the main thread.

## Architecture

```
FileTableRow (name cell)
  └─ onMouseEnter (existing hover context)
       └─ useHoverPreviewIntent — 450 ms dwell timer, cancelled on leave
            └─ HoverPdfPopup (single instance, mounted once at FileGrid level)
                 ├─ <Portal> fixed-position card, anchored right of the row
                 ├─ usePdfDocument(filePath)  ← shared LRU-cached pdf.js loader
                 ├─ <Page pageNumber={n} scale={zoom}> on a pannable canvas
                 └─ Toolbar: ‹ page x / y ›   −  zoom%  +   ⤢ open in pane
```

### Component: one popup, not one per row

Mount a **single** `HoverPdfPopup` beside the file list (like the context
menu), driven by `{ file, anchorRect } | null` state. Rows only report hover;
the popup positions itself against the hovered row's bounding rect (flip above
/below if near viewport edge, prefer right side, clamp to window). This avoids
2000 popup instances in a virtualized list and plays well with the existing
memoized `FileTableRow`.

### Open/close lifecycle

- **Open**: row hovered for ≥ 450 ms (intent delay — quick mouse passes never
  load anything) **and** file is a PDF **and** no drag/context-menu/dialog is
  active. Also openable instantly via the existing Eye icon (hover the icon =
  no delay), keeping the icon's click behavior (open Preview Pane) unchanged.
- **Stay open**: while the mouse is over the row *or* the popup. Reuse the
  50 ms leave-debounce pattern; treat row→popup mouse travel as one hover.
- **Close**: mouse leaves both (150 ms grace), `Escape`, scroll of the file
  list, directory change, any click outside the popup, or another row reaching
  its dwell threshold (popup retargets).

### Interactions inside the popup

| Interaction | Behavior |
|---|---|
| Scroll wheel | zoom around cursor, 0.5×–4×, steps of ~1.2× |
| Drag | pan when zoom > fit (grab cursor); no-op at fit zoom |
| `‹` / `›` buttons, `←`/`→`, PgUp/PgDn | prev/next page, "Page 2 / 14" label |
| `+` / `−` buttons | zoom steps; double-click canvas = toggle fit ↔ 2× |
| ⤢ button (or `Enter`) | hand off to Preview Pane (existing quick-action path: select file + `setIsPreviewPaneOpen(true)`), close popup |

Fixed card size ~420×540 px (fits a portrait A4 at readable scale); the canvas
inside is the zoom/pan viewport. Page renders at
`devicePixelRatio`-corrected resolution so text is crisp.

### Performance

- **Document cache**: small LRU (e.g. 5 entries) of pdf.js `PDFDocumentProxy`
  keyed by file path — re-hovering a file is instant, and the Split dialog can
  share the cache. Destroy evicted proxies (`doc.destroy()`).
- **Render-task cancellation**: cancel in-flight `page.render()` when the
  popup closes/retargets (pdf.js render tasks are cancellable) — prevents
  jank when sweeping the mouse down a list of PDFs.
- **Dwell delay is the main guard**: nothing is fetched until 450 ms of
  genuine hover. Show a lightweight skeleton card immediately at open, canvas
  fades in when the page paints.
- **Size cap**: skip auto-open for PDFs > ~50 MB (show "Press Space to
  preview" hint instead) so a stray hover never pulls a 300 MB scan over HTTP.

## Phases

### Phase 1 — Core popup (static page 1)
`usePdfDocument` loader + worker setup, single `HoverPdfPopup` with dwell
timer, anchored positioning, page 1 at fit zoom, open/close lifecycle.
No zoom/pan yet. **This alone delivers most of the value.**

### Phase 2 — Interactivity
Page prev/next + keyboard, wheel zoom around cursor, drag-to-pan,
double-click fit toggle, "open in Preview Pane" handoff.

### Phase 3 — Polish & safety
LRU cache + render cancellation, size cap + manual trigger, edge-flip
positioning, light/dark chrome via `useDialogChrome()` tokens, settings toggle
(enable/disable hover preview + dwell duration) alongside the other view
settings.

## Edge cases

- Encrypted/corrupt PDFs: catch loader error, show "Can't preview" card
  (don't retry on every hover — negative-cache the path for the session).
- Virtualized scrolling: row unmount while popup open → close (anchor is gone).
- Multi-monitor/small windows: clamp popup fully on-screen; flip side.
- The popup must never steal focus — keyboard stays with the grid except for
  the explicitly listed keys, and those only apply while the popup is open.
