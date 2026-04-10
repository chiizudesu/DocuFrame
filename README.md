# DocuFrame

A purpose-built desktop file explorer for accountants, built with Electron and React. DocuFrame replaces generic file managers with accounting-specific workflows: smart file organisation, index-prefix grouping, PDF tools, Xero integration, AI-assisted document analysis, and fast keyboard-driven navigation.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Xero Integration](#xero-integration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Jump Mode](#jump-mode)
- [AI Tools](#ai-tools)
- [PDF Tools](#pdf-tools)
- [File Operations](#file-operations)
- [Templates](#templates)
- [Auto-Updater](#auto-updater)
- [Development](#development)
- [Building](#building)
- [License](#license)

---

## Features

### File Management
- **File grid** with sortable columns (name, size, modified date, type)
- **Index-prefix grouping** — files are automatically grouped by their numeric prefix (e.g. `01 Letter.pdf`, `02 Invoice.pdf`)
- **Smart rename** — batch rename files with prefix assignment
- **Inline folder creation** — create folders without leaving the keyboard
- **Drag and drop** — move files within the app or drag in files from Windows Explorer
- **Clipboard operations** — cut, copy, paste with Ctrl+X/C/V
- **Multi-select** — Shift+click, Ctrl+click, or rubber-band marquee selection
- **Quick file search** — type to filter files instantly within a directory
- **Preview pane** — preview PDFs, images, and documents inline

### Navigation
- **Folder tab system** — open multiple directories in tabs
- **Jump mode** (F1–F4) — instant keyboard navigation to configured quick-access folders
- **Address bar jump** — start typing anywhere to open the address bar and jump to a path
- **Backspace navigation** — navigate to parent directory
- **Quick Navigate Overlay** — command palette for rapid folder switching
- **Breadcrumb trail** — visual path with click-to-navigate segments
- **F5 refresh** — reload current directory

### PDF Tools
- **PDF Merge** — combine multiple PDFs into one, with drag-and-drop reordering
- **PDF viewer** — inline PDF preview via embedded viewer
- **PDF to CSV** — extract structured data from PDFs into spreadsheet format
- **PDF text extraction** — extract raw text from PDF documents

### AI Tools (requires Anthropic API key)
- **AI File Manager** — describe a task in natural language; Claude reorganises, renames, and moves files
- **AI Editor** — select files and apply AI-driven edits or transformations
- **AI Templater** — generate documents from YAML templates using AI
- **Document Analysis** — extract structured data from scanned documents

### Xero Integration
- OAuth 2.0 authentication flow
- Upload PDFs directly to Xero Vaults (client document storage)
- Client database lookup from CSV for fast client selection
- IRD number and client info bar

### Other
- **Calculator** — built-in calculator accessible via keyboard shortcut
- **Transfer tool** — move or copy files between directories with conflict resolution
- **Custom properties** — attach metadata to files
- **Organisation codes dialog** — manage chart-of-accounts-style org codes
- **Settings window** — all preferences in one place
- **Native Windows icons** — real OS file type icons in the grid
- **Auto-updater** — silent background updates via GitHub Releases
- **Dark/light theme** — system-aware with manual toggle

---

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later
- Windows 10/11 (primary target; macOS/Linux builds possible but untested)

---

## Installation

```bash
git clone https://github.com/chiizudesu/DocuFrame.git
cd DocuFrame
npm install
```

### Backend (Xero OAuth server)

```bash
npm run install-backend
```

---

## Configuration

Copy the sample config and update it for your environment:

```bash
cp config.sample.json config.json
```

Edit `config.json`:

```json
{
  "rootPath": "C:/Users/YourName/Documents/Clients"
}
```

`rootPath` is the root directory DocuFrame opens on launch. All navigation stays within this tree by default.

---

## Xero Integration

Copy the environment template:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
SESSION_SECRET=some_long_random_string
XERO_CLIENT_ID=your_xero_app_client_id
XERO_CLIENT_SECRET=your_xero_app_client_secret
XERO_REDIRECT_URI=http://localhost:5173/oauth/callback.html
PORT=3001
```

To get Xero credentials:
1. Go to [developer.xero.com](https://developer.xero.com) → My Apps → New App
2. Set redirect URI to `http://localhost:5173/oauth/callback.html`
3. Copy Client ID and Client Secret into `.env`

Start the backend before using Xero features:

```bash
npm run start-backend
```

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
| `Enter` | Open selected file/folder |
| `Escape` | Close active overlay/dialog |
| Any letter | Open address bar jump at current directory, pre-filled |

Shortcuts for Jump Mode quick folders (F2–F4), the calculator, and backspace navigation are configurable in Settings.

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

**Note:** F1–F4 shortcuts are skipped when modifier keys are held. This ensures system shortcuts like Alt+F4 (close window) work normally.

---

## AI Tools

AI features require an [Anthropic API key](https://console.anthropic.com/).

Set it in **Settings → AI → API Key**.

### AI File Manager
Open the AI File Manager pane, describe what you want done (e.g. "move all 2023 invoices into a subfolder called Invoices 2023"), and Claude will plan and execute the file operations.

### AI Editor
Select one or more files in the grid, open the AI Editor, describe a transformation, and Claude will process the file content. Results can be copied or saved.

### AI Templater
Choose a YAML template from the Templates folder, provide context, and Claude fills in the document structure.

---

## PDF Tools

### Merge PDFs
Right-click selected PDFs → Merge, or use the Merge PDF button in the toolbar. Drag to reorder pages before merging.

### PDF to CSV
Right-click a PDF → Extract to CSV. DocuFrame parses the PDF and produces a structured CSV file in the same directory.

### Preview
Click any PDF in the file grid to open it in the preview pane on the right. The pane can be toggled with the preview button in the toolbar.

---

## File Operations

### Index Prefix System
Files are named with a numeric prefix to define their display order and group:

```
01 Engagement Letter.pdf
02 Financial Statements.pdf
02 Tax Return.pdf
03 Correspondence.pdf
```

Files sharing a prefix are grouped together in the grid. Use **Smart Rename** to assign or change prefixes in bulk.

### Drag and Drop
- **Within DocuFrame** — drag files onto a group header to move them into that prefix group, or drag onto a folder to move inside it
- **From Windows Explorer** — drag files into the DocuFrame window to copy them into the current directory

### Transfer Tool
Use the Transfer dialog (accessible via command panel) to move or copy files between two directories with conflict detection and resolution options.

---

## Templates

Templates are YAML files stored in the `templates/` directory. They define document structure for common accounting outputs (tax returns, management reports, etc.).

To add a template, create a `.yaml` file in `templates/` following the structure of the existing examples.

---

## Auto-Updater

DocuFrame uses `electron-updater` to check for and apply updates from GitHub Releases.

### For users
Updates are checked automatically. When a new version is available, a dialog will appear asking you to restart and install. You can also trigger a manual check from the command panel (`update` command).

### For developers (releasing an update)
1. Bump the version in `package.json`
2. Set your GitHub PAT with `repo` scope:
   ```bash
   $env:GH_TOKEN="ghp_yourtoken"   # PowerShell
   ```
3. Build and publish:
   ```bash
   npm run publish-github
   ```
   This builds the installer and uploads it to GitHub Releases along with `latest.yml` (which the updater polls).

The repository is public, so no token is needed in the distributed app — `electron-updater` can fetch `latest.yml` and download the installer anonymously.

---

## Development

```bash
# Start the app in development mode (hot reload)
npm run dev

# Start with standalone React DevTools (Profiler)
npm run profiler

# Type-check without building
npx tsc --noEmit
```

### Project Structure

```
src/
  App.tsx                  # Root component, global keyboard handlers
  components/              # UI components
    FileGrid.tsx            # Main file grid (5000+ lines, core of the app)
    FileGrid/               # FileGrid sub-components
      FileGridUI.tsx        # Visual chrome
      FileListView.tsx      # Virtualised list + group view
      FileGridUtils.tsx     # Drag/drop helpers, sort types
      FileListThead.tsx     # Sticky column headers
    FolderInfoBar.tsx       # Address bar + breadcrumbs
    CommandPanel.tsx        # Command palette
    PreviewPane.tsx         # File preview
    SettingsWindow.tsx      # Settings
    ...
  context/
    AppContext.tsx           # Global state (current directory, settings, etc.)
  main/                    # Electron main-process code called from renderer
    commandHandler.ts
    commands/               # Individual command implementations
    autoUpdater.ts
  services/                # Business logic (file system, AI, config, etc.)
  utils/                   # Pure helpers (paths, shortcuts, index prefixes)
electron/
  main.ts                  # Electron main process (IPC handlers, window management)
  preload.ts               # Context bridge (exposes electronAPI to renderer)
templates/                 # YAML document templates
server/                    # Express backend (Xero OAuth)
```

---

## Building

```bash
# Build installer (unsigned, for local testing)
npm run dist-win-unsigned

# Build and publish to GitHub Releases
npm run publish-github
```

Output goes to `release/`.

---

## License

MIT — see [LICENSE](LICENSE)
