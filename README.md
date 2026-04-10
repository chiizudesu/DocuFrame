# DocuFrame

A purpose-built desktop file explorer for accountants, built with Electron and React. DocuFrame replaces generic file managers with accounting-specific workflows: smart file organisation, index-prefix grouping, PDF tools, AI-assisted document analysis, and fast keyboard-driven navigation.

---

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Jump Mode](#jump-mode)
- [Index Prefix System](#index-prefix-system)
- [AI Tools](#ai-tools)
- [PDF Tools](#pdf-tools)
- [File Operations](#file-operations)
- [Templates](#templates)
- [Auto-Updates](#auto-updates)
- [Development](#development)
- [License](#license)

---

## Installation

### For Users

1. Go to the [Releases](https://github.com/chiizudesu/DocuFrame/releases) page
2. Download the latest `DocuFrame Setup x.x.x.exe`
3. Run the installer — no admin rights required (installs per-user by default)
4. Launch DocuFrame from the desktop shortcut or Start Menu

Updates are delivered automatically. When a new version is available, DocuFrame will notify you and install it on the next restart.

### For Developers

```bash
git clone https://github.com/chiizudesu/DocuFrame.git
cd DocuFrame
npm install
npm run dev
```

---

## Configuration

On first launch, DocuFrame will prompt you to set your workspace root in **Settings**. This is the top-level folder that contains your client files (e.g. `C:\Users\YourName\Documents\Clients`).

You can also edit `config.json` directly in the app data folder. A sample is provided at `config.sample.json`:

```json
{
  "rootPath": "C:/Users/YourName/Documents/Clients"
}
```

All navigation in DocuFrame stays within this root by default.

---

## Features

### File Management
- **File grid** with sortable columns (name, size, modified date, type)
- **Index-prefix grouping** — files are automatically grouped by their numeric prefix (`01 Letter.pdf`, `02 Invoice.pdf`)
- **Smart rename** — batch rename files with prefix assignment
- **Inline folder creation** — create folders without leaving the keyboard
- **Drag and drop** — move files within the app or drag in files from Windows Explorer
- **Clipboard operations** — cut, copy, paste with Ctrl+X / C / V
- **Multi-select** — Shift+click, Ctrl+click, or rubber-band marquee selection
- **Quick file search** — type to filter files instantly within the current directory
- **Preview pane** — preview PDFs, images, and documents inline

### Navigation
- **Folder tab system** — open multiple directories in tabs
- **Jump mode** (F1–F4) — instant keyboard navigation to configured quick-access folders
- **Address bar jump** — start typing anywhere to open the address bar and jump to a path
- **Backspace navigation** — navigate to parent directory
- **Quick Navigate overlay** — command palette for rapid folder switching
- **Breadcrumb trail** — visual path with click-to-navigate segments
- **F5 refresh** — reload current directory

### PDF Tools
- **PDF Merge** — combine multiple PDFs into one, with drag-and-drop page reordering
- **PDF viewer** — inline PDF preview via embedded viewer
- **PDF to CSV** — extract structured data from PDFs into spreadsheet format
- **PDF text extraction** — extract raw text from PDF documents

### AI Tools
- **AI File Manager** — describe a task in natural language; Claude reorganises, renames, and moves files
- **AI Editor** — select files and apply AI-driven edits or transformations
- **AI Templater** — generate documents from YAML templates using AI
- **Document Analysis** — extract structured data from scanned documents

### Other
- **Calculator** — built-in calculator accessible via keyboard shortcut
- **Transfer tool** — move or copy files between directories with conflict resolution
- **Upload to Vaults** — commit and push PDFs to a configured Vaults git repository
- **Settings window** — all preferences in one place
- **Native Windows icons** — real OS file type icons in the grid
- **Auto-updater** — silent background updates via GitHub Releases
- **Dark/light theme** — system-aware with manual toggle

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F1` | Jump to workspace root |
| `F2` | Jump to Quick Folder 1 |
| `F3` | Jump to Quick Folder 2 |
| `F4` | Jump to Quick Folder 3 |
| `F5` | Refresh current directory |
| `Ctrl+Space` | Open Quick Navigate overlay |
| `Ctrl+X` | Cut selected files |
| `Ctrl+C` | Copy selected files |
| `Ctrl+V` | Paste files |
| `Ctrl+A` | Select all files |
| `F2` | Rename selected file |
| `Delete` | Delete selected files |
| `Backspace` | Navigate to parent directory |
| `Enter` | Open selected file or folder |
| `Escape` | Close active overlay or dialog |
| Any letter | Open address bar jump at current directory, pre-filled |

The jump mode folders (F2–F4), calculator shortcut, and backspace navigation are all configurable in **Settings**.

---

## Jump Mode

Jump mode lets you instantly navigate to any folder in your workspace by typing partial path segments.

**Activating jump mode:**
- Press **F1** to open at your workspace root
- Press **F2**, **F3**, or **F4** to open at a configured quick-access folder (set in Settings → Jump Mode)
- Start typing any letter while the file grid is focused to open jump mode at the current directory

**Using jump mode:**
- Type to filter folders — results narrow as you type
- Arrow keys to move through results
- Enter to navigate into the selected folder
- Escape to close

System shortcuts like **Alt+F4** always take priority over F-key jump shortcuts.

---

## Index Prefix System

Files are named with a numeric prefix to define their display order and group:

```
01 Engagement Letter.pdf
02 Financial Statements.pdf
02 Tax Return.pdf
03 Correspondence.pdf
```

Files sharing a prefix are grouped together in the grid. Use **Smart Rename** to assign or change prefixes in bulk. The prefix determines which group header a file appears under and can be reassigned by dragging a file onto a different group header.

---

## AI Tools

AI features require an [Anthropic API key](https://console.anthropic.com/).

Set it in **Settings → AI → API Key**.

### AI File Manager
Open the AI File Manager pane and describe what you want done (e.g. *"move all 2023 invoices into a subfolder called Invoices 2023"*). Claude will plan and execute the file operations.

### AI Editor
Select one or more files in the grid, open the AI Editor, describe a transformation, and Claude will process the file content. Results can be copied or saved directly.

### AI Templater
Choose a YAML template, provide context, and Claude fills in the document structure. Templates live in the `templates/` folder.

---

## PDF Tools

### Merge PDFs
Select multiple PDFs → right-click → **Merge**, or use the Merge PDF button in the toolbar. Drag to reorder before merging.

### PDF to CSV
Right-click a PDF → **Extract to CSV**. DocuFrame parses the PDF and produces a structured CSV file in the same directory.

### Preview
Click any PDF in the file grid to open it in the preview pane on the right. The pane can be toggled with the preview button in the toolbar.

---

## File Operations

### Drag and Drop
- **Within DocuFrame** — drag files onto a group header to reassign their prefix, or onto a folder to move inside it
- **From Windows Explorer** — drag files into the DocuFrame window to copy them into the current directory

### Transfer Tool
Available via the command panel. Move or copy files between two directories with conflict detection and resolution options.

---

## Templates

Templates are YAML files stored in the `templates/` directory. They define document structure for common accounting outputs (tax returns, management reports, etc.).

To add a template, create a `.yaml` file in `templates/` following the structure of the existing examples, then reference it from the AI Templater.

---

## Auto-Updates

DocuFrame checks for updates automatically in the background. When a new version is available:

1. A dialog appears: **"A new version (x.x.x) is available"**
2. The update downloads silently
3. Another dialog appears: **"Update Ready — Restart Now or Later"**
4. Click **Restart Now** to apply, or **Later** to install on the next launch

You can also trigger a manual check from the command panel using the `update` command.

---

## Development

```bash
# Start in development mode (hot reload)
npm run dev

# Type-check without building
npx tsc --noEmit

# Start with standalone React DevTools (Profiler tab)
npm run profiler
```

### Project Structure

```
src/
  App.tsx                  # Root component, global keyboard handlers
  components/              # UI components
    FileGrid.tsx            # Main file grid (core of the app)
    FileGrid/               # FileGrid sub-components
    FolderInfoBar.tsx       # Address bar + breadcrumbs
    CommandPanel.tsx        # Command palette
    PreviewPane.tsx         # File preview
    SettingsWindow.tsx      # Settings
  context/
    AppContext.tsx           # Global state
  main/                    # Electron main-process helpers
    commandHandler.ts
    commands/               # Command implementations
    autoUpdater.ts
  services/                # Business logic (file system, AI, config)
  utils/                   # Pure helpers
electron/
  main.ts                  # Electron main process
  preload.ts               # Context bridge
templates/                 # YAML document templates
```

---

## License

MIT — see [LICENSE](LICENSE)
