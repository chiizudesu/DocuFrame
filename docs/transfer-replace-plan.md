# Plan: Replace-as-New-Version in the Transfer Panel

> **Status: implemented** (all four phases). Remaining future work: the backup/
> version-history idea under "Edge cases & safety", and carrying version
> registry entries through renames/moves.

Goal: let the Transfer panel seamlessly replace an existing file in the current
folder with a download, bumping its version — instead of erroring on a name
conflict or requiring the separate "Replace with Latest File" context menu action.

## Current state (as of this plan)

- **Context menu replace**: `FileGrid.tsx` (`replace_with_latest` case) → IPC
  `replace-with-latest-file` in `electron/main.ts` (~line 1445). Always picks the
  *newest* file in Downloads, copies it over the target (name kept), deletes the
  download. Now also calls `versionStore.bump(targetPath)` on success.
- **Transfer panel**: `TransferPanel.tsx` knows only about Downloads — it has no
  concept of a target *file*, only a target *directory*.
- **Conflict handling** in `src/main/commands/transfer.ts` (~line 136):
  - Manual transfer → throws `File already exists at destination` (transfer fails).
  - Command-mapping transfer (filename template) → **silently overwrites**.
- **Version registry**: `src/services/versionStore.ts` (renderer-side, persisted
  in electron config under `fileVersionRegistry`, keyed by normalized path).

## Integration design

### Phase 1 — Conflict interception (highest value, smallest change)

When `executeTransfer` fails with "File already exists at destination":

1. Catch that specific error in `TransferPanel.executeTransfer` (and in the
   group-header transfer path in `FileGrid.tsx`).
2. Instead of a red error box, render an inline **conflict card** in the status
   area: *"`C - Bank Rec.pdf` already exists — replace it? v1 → v2"* with
   **[Replace]** / **[Keep both (rename)]** / **[Cancel]** buttons.
3. **Replace** calls a new IPC `replace-file-from-downloads(downloadFileName, targetFilePath)`
   (see Phase 3), then `versionStore.bump(targetPath)`, refreshes, and highlights
   the row green like a normal transfer.
4. **Keep both** re-runs the transfer with an auto-suffixed name (`" (2)"`).

Also fix the silent-overwrite hole: when a command-mapping transfer overwrites an
existing file, call `versionStore.bump` for that path too, so the Version column
stays honest no matter which path replaced the file.

### Phase 2 — Explicit Replace mode in the panel

A small toggle in the rename-fields row: **⇄ Replace existing**.

- When active, the Index/Filename inputs swap for a **target picker**: a compact
  searchable list of *files in the current directory* (reuse the grid's
  `sortedFiles` via context, newest first, index prefix shown as a pill).
- Selecting a target shows a preview strip:
  `latest-download.pdf  →  C - Bank Rec.pdf   v1 → v2`.
- The Transfer button relabels to **Replace (v2)** and runs the same IPC as
  Phase 1. Multi-select of downloads disables the toggle (one source → one target).

### Phase 3 — Main-process IPC

Generalize the existing `replace-with-latest-file` handler into
`replace-file-from-downloads`:

- Args: `{ downloadFileName: string, targetFilePath: string }` — the *chosen*
  download, not just the newest one (the panel already lists 10 named downloads,
  so it can pass the selected one).
- Same body as today's handler: copy over target (keep target name), delete the
  download, emit `folderContentsChanged`.
- Keep `replace-with-latest-file` as a thin wrapper (latest download → same code
  path) so the context-menu action and the panel share one implementation.

### Phase 4 — Entry point from the grid

Context menu: **"Replace via Transfer Panel…"** on a file row opens the
TransferPanel with Replace mode pre-armed and that file pre-selected as target —
the user just picks which download to use. (The existing one-click
"Replace with Latest File" stays for the fast path.)

### Edge cases & safety

- **Version registry key is the path**: renames/moves reset to v1 for now —
  acceptable; revisit when rename flows can carry the registry entry along.
- **GST button**: leave untouched; it has its own rename pipeline.
- **Backup (future)**: before overwrite, copy the old file to
  `%APPDATA%/DocuFrame/version-cache/<hash>-vN.ext` — this turns the Version
  column into a real history with one-click rollback later.

### Suggested order of work

1. Phase 3 IPC (foundation, ~30 lines in main.ts + preload).
2. Phase 1 conflict card (most daily value).
3. Phase 2 toggle + target picker.
4. Phase 4 context-menu entry point.
