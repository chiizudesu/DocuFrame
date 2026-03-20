# DocuFrame

DocuFrame is a modern file explorer built in Electron, designed specifically for accountants and professionals working with Xero.

## Features
- **Xero-centric file management**: Organize, rename, and manage client files for Xero workflows
- **Bulk file renaming**: Smart, accountant-friendly renaming tools
- **Drag-and-drop**: Move and organize files and folders with ease
- **Native Windows icons**: See real file type icons for a familiar experience
- **AI-powered tools**: (Optional) Anthropic Claude for document analysis and automation
- **Customizable templates**: YAML-based templates for common accounting documents
- **Secure**: Designed to keep sensitive data out of your repository

## Getting Started
1. Clone the repository
2. Copy `config.sample.json` to `config.json` and update your paths
3. For Xero integration: Copy `.env.example` to `.env` and set `SESSION_SECRET`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`
4. Run `npm install` and `npm run dev`

## React Profiler (standalone DevTools)

Use `npm run profiler` instead of `npm run dev` when you want the **standalone** React DevTools (Profiler tab, component tree). It runs `react-devtools` and Vite together, waits until port **8097** is listening before starting Vite, and injects a small loader that **retries** the bridge script if the app window loads first.

**If the DevTools window goes blank or disconnects**

- Reload the **DocuFrame** window (the bridge often drops after a full Vite/Electron reload).
- Restart `npm run profiler` so the standalone app and your app reconnect.
- Ensure nothing else is bound to port **8097** (or set `REACT_DEVTOOLS_PORT` for both `react-devtools` and the same value in the environment where Vite runs so the injected port matches).
- The `react-devtools` package ships with its **own** Electron (older than DocuFrame’s); occasional glitches there are upstream. You can still use **Electron’s built-in DevTools** (main process) for general debugging without the React Profiler.

After list-view hover optimizations, profile again in **grouped** view: moving the pointer across rows should show small commits (mostly the previous and current row) instead of the whole `FileListView` tree.

## Security
Sensitive files and API keys are excluded from the repository. See `.gitignore` for details.

## License
MIT
