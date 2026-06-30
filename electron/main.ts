// main.ts - Updated with IPC handlers
// Set GitHub token for auto-updates (replace with your actual token)
// GH_TOKEN should be set via environment variable or .env file

import { app, BrowserWindow, shell, ipcMain, globalShortcut, Menu, dialog, nativeImage, MenuItem, MenuItemConstructorOptions, clipboard } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, promises as fsPromises } from 'fs';
import * as fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn, ChildProcess, exec, execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import PDFParser from 'pdf2json';
import { fileSystemService } from '../src/services/fileSystem';
import { findClientRow, getIrdNumber } from '../src/services/clientDatabaseCsv';
import type { Config } from '../src/services/config';
import { handleCommand } from '../src/main/commandHandler';
import { transferFiles } from '../src/main/commands/transfer';
import { extractEmlSources, type EmlSource } from '../src/main/commands/extractEml';
import { invalidateConfigCache } from '../src/main/config';
import { getRootGitStatus, rootGitPush, rootGitPull, rootGitDiscard } from '../src/main/rootGit';
const { parse } = require('csv-parse/sync');
import yaml from 'js-yaml';
import { autoUpdaterService } from '../src/main/autoUpdater';
import * as chokidar from 'chokidar';
import { uIOhook, UiohookKey } from 'uiohook-napi';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Returns a user-friendly message for common filesystem error codes
function getFileOperationErrorMessage(error: any): string {
  switch (error?.code) {
    case 'EBUSY':
      return `The file is currently in use by another application. Please close it and try again.`;
    case 'EPERM':
      return `Access was denied — the file may be open in another app (e.g. PDF reader, Word). Please close it and try again.`;
    case 'EACCES':
      return `Permission denied. You may not have access to this file or folder.`;
    default:
      return (error as Error)?.message ?? String(error);
  }
}

// Express server for serving PDF files
let expressApp: express.Application;
let expressServer: any;
const EXPRESS_PORT = 3001; // Use port 3001 to avoid conflicts

// Initialize Express server
const initializeExpressServer = () => {
  try {
    expressApp = express();
    
    // Add CORS headers to allow iframe loading
    expressApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('X-Content-Type-Options', 'nosniff');
      
      // Remove X-Frame-Options to allow iframe embedding from Electron
      // res.header('X-Frame-Options', 'SAMEORIGIN');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    // Serve static files directly from the Clients directory
    // This allows us to serve files from the specific directory we need
    const clientsPath = path.join(process.env.USERPROFILE || 'C:/Users', 'Documents', 'Clients');
    
    expressApp.use('/files', (req, res, next) => {
      // Security: Only block directory traversal attempts
      const filePath = decodeURIComponent(req.path);
      if (filePath.includes('..')) {
        console.warn('[Main] Blocked directory traversal attempt:', filePath);
        return res.status(403).send('Access denied');
      }
      
      // Set proper content-type headers for different file types
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.pdf':
          res.set('Content-Type', 'application/pdf');
          res.set('Content-Disposition', 'inline');
          console.log(`[Main] Serving PDF with headers:`, {
            'Content-Type': res.get('Content-Type'),
            'Content-Disposition': res.get('Content-Disposition'),
            'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin')
          });
          break;
        case '.jpg':
        case '.jpeg':
          res.set('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.set('Content-Type', 'image/png');
          break;
        case '.gif':
          res.set('Content-Type', 'image/gif');
          break;
        case '.bmp':
          res.set('Content-Type', 'image/bmp');
          break;
        case '.webp':
          res.set('Content-Type', 'image/webp');
          break;
        case '.svg':
          res.set('Content-Type', 'image/svg+xml');
          break;
      }
      
      next();
    });
    
    // Serve files directly from the Clients directory
    expressApp.use('/files', express.static(clientsPath));
    
    // Start the server
    expressServer = expressApp.listen(EXPRESS_PORT, () => {
      console.log(`[Main] Express server running on http://localhost:${EXPRESS_PORT}`);
      console.log(`[Main] Serving files from: ${clientsPath}`);
    });
    
    // Handle server errors
    expressServer.on('error', (error: any) => {
      console.error('[Main] Express server error:', error);
    });
    
  } catch (error) {
    console.error('[Main] Failed to initialize Express server:', error);
  }
};

// Cleanup Express server
const cleanupExpressServer = () => {
  if (expressServer) {
    try {
      expressServer.close();
      console.log('[Main] Express server stopped');
    } catch (error) {
      console.error('[Main] Error stopping Express server:', error);
    }
  }
};

// --- Chrome extension bridge (localhost PDF ingest) ---
const DEFAULT_CHROME_BRIDGE_PORT = 48721;
let chromeBridgeApp: express.Application | null = null;
let chromeBridgeServer: import('http').Server | null = null;

function getBearerTokenFromRequest(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

function sanitizeChromeBridgePdfFilename(raw: string): string {
  let s = (raw || 'page')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) s = 'page';
  const withoutExt = s.replace(/\.pdf$/i, '');
  let base = withoutExt.length > 100 ? withoutExt.slice(0, 100).trim() : withoutExt;
  if (!base) base = 'page';
  return `${base}.pdf`;
}

function isResolvedPathInsideDirectory(filePath: string, dir: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dir);
  if (process.platform === 'win32') {
    const f = resolvedFile.toLowerCase();
    const d = resolvedDir.toLowerCase();
    return f === d || f.startsWith(d + path.sep);
  }
  return resolvedFile === resolvedDir || resolvedFile.startsWith(resolvedDir + path.sep);
}

function stopChromeExtensionBridgeServer(): void {
  if (chromeBridgeServer) {
    try {
      chromeBridgeServer.close();
      console.log('[Main] Chrome extension bridge server stopped');
    } catch (error) {
      console.error('[Main] Error stopping Chrome extension bridge:', error);
    }
    chromeBridgeServer = null;
    chromeBridgeApp = null;
  }
}

/** Notify renderer(s) so DocuFrame can show in-app toasts (not only OS / extension notifications). */
function broadcastChromeBridgePdfResult(payload: { ok: true; filename: string } | { ok: false; error: string }) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('chromeBridgePdfResult', payload);
    }
  });
}

/** Ask renderer(s) to activate the given workpaper sections in the section checklist pane. */
function broadcastChromeBridgeActivateSections(sections: string[]) {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('chromeBridgeActivateSections', { sections });
    }
  });
}

async function startChromeExtensionBridgeServer(cfg: Config): Promise<void> {
  stopChromeExtensionBridgeServer();
  if (!cfg.chromeExtensionBridgeEnabled) return;

  let secret = cfg.chromeExtensionBridgeSecret;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    await saveConfig({ chromeExtensionBridgeSecret: secret });
    cfg = { ...cfg, chromeExtensionBridgeSecret: secret };
  }

  const port = cfg.chromeExtensionBridgePort ?? DEFAULT_CHROME_BRIDGE_PORT;
  const effectiveSecret = secret;

  const appBridge = express();
  chromeBridgeApp = appBridge;

  appBridge.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-DocuFrame-Filename');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  const requireAuth: express.RequestHandler = (req, res, next) => {
    const token = getBearerTokenFromRequest(req);
    if (token !== effectiveSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  appBridge.get('/health', requireAuth, async (_req, res) => {
    try {
      const cfg = await loadConfig();
      const dir = currentDirectoryPath || null;
      let currentDirectoryBase: string | null = null;
      if (dir) {
        try {
          currentDirectoryBase = path.basename(dir);
        } catch {
          currentDirectoryBase = null;
        }
      }
      res.json({
        ok: true,
        currentDirectory: dir,
        currentDirectoryBase,
        transferCommandMappings: cfg.transferCommandMappings || {},
      });
    } catch (e) {
      console.error('[ChromeBridge] /health error:', e);
      res.json({ ok: true, currentDirectory: null, currentDirectoryBase: null, transferCommandMappings: {} });
    }
  });

  appBridge.post(
    '/merge-pdfs',
    requireAuth,
    express.json({ limit: '120mb' }),
    async (req, res) => {
      try {
        const dir = currentDirectoryPath;
        if (!dir) {
          const err = 'No current directory open in DocuFrame';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        const parts = req.body?.partsBase64;
        if (!Array.isArray(parts) || parts.length === 0) {
          const err = 'partsBase64 must be a non-empty array';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        const rawName = req.body?.filename || 'merged.pdf';
        let filename = sanitizeChromeBridgePdfFilename(rawName);
        let fullPath = path.join(dir, filename);

        try {
          await fsPromises.access(fullPath);
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const baseNoExt = filename.replace(/\.pdf$/i, '');
          filename = `${baseNoExt}_${t}.pdf`;
          fullPath = path.join(dir, filename);
        } catch {
          /* use chosen name */
        }

        if (!isResolvedPathInsideDirectory(fullPath, dir)) {
          const err = 'Invalid path';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        const merged = await PDFDocument.create();
        for (const b64 of parts) {
          if (typeof b64 !== 'string' || !b64.length) continue;
          let buf: Buffer;
          try {
            buf = Buffer.from(b64, 'base64');
          } catch {
            const err = 'Invalid base64 in partsBase64';
            broadcastChromeBridgePdfResult({ ok: false, error: err });
            return res.status(400).json({ error: err });
          }
          if (buf.length === 0) continue;
          const src = await PDFDocument.load(buf, { ignoreEncryption: true });
          const copied = await merged.copyPages(src, src.getPageIndices());
          for (const p of copied) {
            merged.addPage(p);
          }
        }

        const outBuf = Buffer.from(await merged.save());
        if (outBuf.length === 0) {
          const err = 'Merged PDF is empty';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        await fsPromises.writeFile(fullPath, outBuf);
        const savedBasename = path.basename(fullPath);
        broadcastChromeBridgePdfResult({ ok: true, filename: savedBasename });

        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('folderContentsChanged', {
              directory: dir,
              event: 'add',
              filePath: fullPath,
              newFiles: [savedBasename],
            });
          }
        });

        return res.json({ success: true, path: fullPath });
      } catch (error: any) {
        console.error('[ChromeBridge] merge-pdfs error:', error);
        const err = error?.message ?? 'Merge failed';
        broadcastChromeBridgePdfResult({ ok: false, error: err });
        return res.status(500).json({ error: err });
      }
    }
  );

  appBridge.post(
    '/save-pdf',
    requireAuth,
    express.raw({ type: () => true, limit: '50mb' }),
    async (req, res) => {
      try {
        const dir = currentDirectoryPath;
        if (!dir) {
          const err = 'No current directory open in DocuFrame';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        const rawHeader = req.header('x-docuframe-filename') || 'page.pdf';
        let filename = sanitizeChromeBridgePdfFilename(rawHeader);
        let fullPath = path.join(dir, filename);

        try {
          await fsPromises.access(fullPath);
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const baseNoExt = filename.replace(/\.pdf$/i, '');
          filename = `${baseNoExt}_${t}.pdf`;
          fullPath = path.join(dir, filename);
        } catch {
          // file does not exist — use chosen name
        }

        if (!isResolvedPathInsideDirectory(fullPath, dir)) {
          const err = 'Invalid path';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        const body = req.body;
        if (!Buffer.isBuffer(body) || body.length === 0) {
          const err = 'Empty or invalid PDF body';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }

        await fsPromises.writeFile(fullPath, body);

        const savedBasename = path.basename(fullPath);
        broadcastChromeBridgePdfResult({ ok: true, filename: savedBasename });

        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('folderContentsChanged', {
              directory: dir,
              event: 'add',
              filePath: fullPath,
              newFiles: [savedBasename],
            });
          }
        });

        return res.json({ success: true, path: fullPath });
      } catch (error: any) {
        console.error('[ChromeBridge] save-pdf error:', error);
        const err = error?.message ?? 'Write failed';
        broadcastChromeBridgePdfResult({ ok: false, error: err });
        return res.status(500).json({ error: err });
      }
    }
  );

  /** Move a file from Electron's Downloads folder into the current DocuFrame directory (Auxor native export). */
  appBridge.post('/transfer-download', requireAuth, express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const dir = currentDirectoryPath;
      if (!dir) {
        const err = 'No current directory open in DocuFrame';
        broadcastChromeBridgePdfResult({ ok: false, error: err });
        return res.status(400).json({ error: err });
      }

      const downloadFilename = typeof req.body?.downloadFilename === 'string' ? req.body.downloadFilename.trim() : '';
      const targetFilenameRaw = typeof req.body?.targetFilename === 'string' ? req.body.targetFilename.trim() : '';
      if (!downloadFilename || !targetFilenameRaw) {
        return res.status(400).json({ error: 'Missing downloadFilename or targetFilename' });
      }

      const downloadsPath = app.getPath('downloads');
      let sourcePath: string;
      if (path.isAbsolute(downloadFilename)) {
        const resolved = path.resolve(downloadFilename);
        const resolvedDl = path.resolve(downloadsPath);
        if (!isResolvedPathInsideDirectory(resolved, resolvedDl)) {
          const err = 'downloadFilename must be under the Downloads folder';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }
        sourcePath = resolved;
      } else {
        sourcePath = path.join(downloadsPath, path.basename(downloadFilename));
      }

      const extFromSource = path.extname(sourcePath) || '.pdf';
      let baseTarget = targetFilenameRaw
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      baseTarget = baseTarget.replace(/\.[^/.]+$/, '').trim();
      if (!baseTarget) baseTarget = 'document';
      if (baseTarget.length > 150) baseTarget = baseTarget.slice(0, 150).trim();
      const sanitized = `${baseTarget}${extFromSource}`;

      let destPath = path.join(dir, sanitized);
      if (!isResolvedPathInsideDirectory(destPath, dir)) {
        const err = 'Invalid path';
        broadcastChromeBridgePdfResult({ ok: false, error: err });
        return res.status(400).json({ error: err });
      }

      if (!(await fsPromises.stat(sourcePath).catch(() => null))?.isFile()) {
        const err = `File not found in Downloads: ${path.basename(sourcePath)}`;
        broadcastChromeBridgePdfResult({ ok: false, error: err });
        return res.status(404).json({ error: err });
      }

      try {
        await fsPromises.access(destPath);
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const t = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const stem = baseTarget;
        destPath = path.join(dir, `${stem}_${t}${extFromSource}`);
        if (!isResolvedPathInsideDirectory(destPath, dir)) {
          const err = 'Invalid path';
          broadcastChromeBridgePdfResult({ ok: false, error: err });
          return res.status(400).json({ error: err });
        }
      } catch {
        /* destination free */
      }

      await fsPromises.copyFile(sourcePath, destPath);
      try {
        await fsPromises.unlink(sourcePath);
      } catch (e) {
        console.warn('[ChromeBridge] transfer-download could not delete source:', e);
      }

      const savedBasename = path.basename(destPath);
      broadcastChromeBridgePdfResult({ ok: true, filename: savedBasename });
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('folderContentsChanged', {
            directory: dir,
            event: 'add',
            filePath: destPath,
            newFiles: [savedBasename],
          });
        }
      });

      return res.json({ success: true, path: destPath });
    } catch (error: any) {
      console.error('[ChromeBridge] transfer-download error:', error);
      const err = error?.message ?? 'Transfer failed';
      broadcastChromeBridgePdfResult({ ok: false, error: err });
      return res.status(500).json({ error: err });
    }
  });

  /** Activate workpaper sections in DocuFrame's section checklist pane (additive — never deactivates). */
  appBridge.post('/activate-sections', requireAuth, express.json({ limit: '256kb' }), async (req, res) => {
    try {
      const raw = req.body?.sections;
      if (!Array.isArray(raw)) {
        return res.status(400).json({ error: 'sections must be an array of index keys' });
      }
      // Normalize: uppercase, trim, drop blanks/placeholders, dedupe.
      const seen = new Set<string>();
      const sections: string[] = [];
      for (const s of raw) {
        if (typeof s !== 'string') continue;
        const key = s.trim().toUpperCase();
        if (!key || key === '—' || key === '-') continue;
        if (!/^[A-Z]+\d*$/.test(key)) continue;
        if (!seen.has(key)) {
          seen.add(key);
          sections.push(key);
        }
      }
      broadcastChromeBridgeActivateSections(sections);
      return res.json({ success: true, currentDirectory: currentDirectoryPath || null, sections });
    } catch (error: any) {
      console.error('[ChromeBridge] activate-sections error:', error);
      return res.status(500).json({ error: error?.message ?? 'Activate failed' });
    }
  });

  await new Promise<void>((resolve, reject) => {
    const srv = appBridge.listen(port, '127.0.0.1', () => {
      chromeBridgeServer = srv;
      console.log(`[Main] Chrome extension bridge listening on http://127.0.0.1:${port}`);
      resolve();
    });
    srv.on('error', (err: NodeJS.ErrnoException) => {
      console.error('[Main] Chrome extension bridge listen error:', err);
      chromeBridgeServer = null;
      chromeBridgeApp = null;
      reject(err);
    });
  });
}

async function syncChromeExtensionBridgeWithConfig(): Promise<void> {
  try {
    const cfg = await loadConfig();
    stopChromeExtensionBridgeServer();
    if (cfg.chromeExtensionBridgeEnabled) {
      await startChromeExtensionBridgeServer(cfg);
    }
  } catch (e) {
    console.error('[Main] syncChromeExtensionBridgeWithConfig failed:', e);
  }
}

// Convert file path to HTTP URL for PDF viewing
const convertFilePathToHttpUrl = (filePath: string): string => {
  try {
    // Get the Clients directory path
    const clientsPath = path.join(process.env.USERPROFILE || 'C:/Users', 'Documents', 'Clients');
    
    // Check if the file is within the Clients directory
    if (!filePath.startsWith(clientsPath)) {
      console.warn('[Main] File is outside Clients directory, cannot serve via Express:', filePath);
      return filePath; // Fallback to original path
    }
    
    // Get relative path from Clients directory
    const relativePath = path.relative(clientsPath, filePath);
    
    // Convert backslashes to forward slashes and encode individual path segments
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const encodedPath = normalizedPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');
    
    const httpUrl = `http://localhost:${EXPRESS_PORT}/files/${encodedPath}`;
    console.log(`[Main] Converted file path: ${filePath} -> ${httpUrl}`);
    console.log(`[Main] Relative path from Clients: ${relativePath}`);
    console.log(`[Main] Encoded path: ${encodedPath}`);
    
    return httpUrl;
  } catch (error) {
    console.error('[Main] Error converting file path to HTTP URL:', error);
    return filePath; // Fallback to original path
  }
};

// Define the development server URL
const MAIN_WINDOW_VITE_DEV_SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5173'
  : undefined;

// Config file path (backup used when primary is corrupt / to recover from bad saves)
const configPath = path.join(app.getPath('userData'), 'config.json');
const configBackupPath = path.join(app.getPath('userData'), 'config.json.bak');

function isErrnoCode(err: unknown, code: string): boolean {
  return (err as NodeJS.ErrnoException)?.code === code;
}

function isTransientFsLock(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Windows/AV often returns EBUSY when multiple saves overlap (FileGrid column widths, sort prefs, quick access, etc.). */
async function withFileIoRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 8;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(60 * 2 ** (attempt - 1), 750));
    }
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (isTransientFsLock(e) && attempt < maxAttempts - 1) {
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** One save at a time so read→merge→write cycles never overlap (fixes EBUSY from parallel `set-config`). */
let configSaveChain: Promise<void> = Promise.resolve();

interface PDFText {
  R: Array<{
    T: string;
  }>;
}

interface PDFPage {
  Texts: PDFText[];
}

interface PDFData {
  Pages: PDFPage[];
}

let backendProcess: ChildProcess | null = null;

// File system watcher management
interface WatchedDirectory {
  path: string;
  watcher: chokidar.FSWatcher;
  lastRefresh: number;
}

const watchedDirectories = new Map<string, WatchedDirectory>();
let isWatchingEnabled = true;

// File system watcher functions
function startWatchingDirectory(dirPath: string) {
  try {
    // Check if already watching this directory
    if (watchedDirectories.has(dirPath)) {
      console.log(`[FileWatcher] Already watching directory: ${dirPath}`);
      return;
    }

    const watcher = chokidar.watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 1, // Only watch immediate children, not subdirectories
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        /node_modules/,   // Ignore node_modules
        /\.git/,          // Ignore git files
        /\.DS_Store/,     // Ignore macOS system files
        /Thumbs\.db/,     // Ignore Windows thumbnail files
        /desktop\.ini/,   // Ignore Windows desktop files
        /\.tmp$/,         // Ignore temporary files
        /\.temp$/,        // Ignore temporary files
        /~$/,             // Ignore backup files
        /\.swp$/,         // Ignore vim swap files
        /\.swo$/,         // Ignore vim swap files
      ],
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 500
      },
      usePolling: false, // Use native file system events when possible
      interval: 1000 // Only poll every 1 second if polling is needed
    });

    // Debounce function - accumulate multiple 'add' events so all new files get the indicator
    let debounceTimer: NodeJS.Timeout;
    const pendingAdds: string[] = [];
    let pendingOther: { event: string; filePath: string } | null = null;

    const flushDebounce = () => {
      const watched = watchedDirectories.get(dirPath);
      if (watched) {
        watched.lastRefresh = Date.now();
      }

      BrowserWindow.getAllWindows().forEach(win => {
        if (pendingAdds.length > 0) {
          win.webContents.send('folderContentsChanged', {
            directory: dirPath,
            event: 'add',
            filePath: pendingAdds[0],
            newFiles: [...pendingAdds]
          });
        }
        if (pendingOther) {
          win.webContents.send('folderContentsChanged', {
            directory: dirPath,
            event: pendingOther.event,
            filePath: pendingOther.filePath,
            newFiles: undefined
          });
        }
      });

      pendingAdds.length = 0;
      pendingOther = null;
    };

    const debouncedRefresh = (event: string, filePath: string) => {
      if (event === 'add') {
        pendingAdds.push(filePath);
      } else {
        pendingOther = { event, filePath };
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushDebounce, 1000);
    };

    // Set up event listeners
    watcher
      .on('add', (filePath) => {
        debouncedRefresh('add', filePath);
      })
      .on('change', (filePath) => {
        debouncedRefresh('change', filePath);
      })
      .on('unlink', (filePath) => {
        debouncedRefresh('unlink', filePath);
      })
      .on('addDir', (dirPath) => {
        debouncedRefresh('addDir', dirPath);
      })
      .on('unlinkDir', (dirPath) => {
        debouncedRefresh('unlinkDir', dirPath);
      })
      .on('error', (error) => {
        console.error(`[FileWatcher] Error watching ${dirPath}:`, error);
      });

    // Store the watcher
    watchedDirectories.set(dirPath, {
      path: dirPath,
      watcher: watcher,
      lastRefresh: Date.now()
    });

  } catch (error) {
    console.error(`[FileWatcher] Error starting watcher for ${dirPath}:`, error);
  }
}

function stopWatchingDirectory(dirPath: string) {
  try {
    const watched = watchedDirectories.get(dirPath);
    if (watched) {
      watched.watcher.close();
      watchedDirectories.delete(dirPath);
    }
  } catch (error) {
    console.error(`[FileWatcher] Error stopping watcher for ${dirPath}:`, error);
  }
}

function stopAllWatchers() {
  console.log(`[FileWatcher] Stopping all watchers (${watchedDirectories.size} active)`);
  watchedDirectories.forEach((watched, dirPath) => {
    try {
      watched.watcher.close();
    } catch (error) {
      console.error(`[FileWatcher] Error closing watcher for ${dirPath}:`, error);
    }
  });
  watchedDirectories.clear();
}

function getWatchedDirectories(): string[] {
  return Array.from(watchedDirectories.keys());
}

function buildDefaultConfig(): Config {
  return {
    rootPath: app.getPath('documents'),
    gstTemplatePath: undefined,
    clientbasePath: undefined,
    workpaperTemplateFolderPath: undefined,
    showOutputLog: true,
    activationShortcut: '`',
    enableActivationShortcut: true,
    calculatorShortcut: 'Alt+Q',
    enableCalculatorShortcut: true,
    newTabShortcut: 'Ctrl+T',
    enableNewTabShortcut: true,
    closeTabShortcut: 'Ctrl+W',
    enableCloseTabShortcut: true,
    clientSearchShortcut: 'Alt+F',
    enableClientSearchShortcut: true,
    sidebarCollapsedByDefault: false,
    hideTemporaryFiles: true,
    hideClaudeMd: true,
    showGitStatus: false, // off for fresh installs (e.g. distributed copies without a repo)
  };
}

/** If primary config is missing or invalid, try backup; only write factory defaults when there is no backup. */
async function restoreOrCreateConfigAfterPrimaryInvalid(reason: string): Promise<Config> {
  const defaultConfig = buildDefaultConfig();

  try {
    const bakRaw = await fsPromises.readFile(configBackupPath, 'utf-8');
    if (bakRaw.trim()) {
      const restored = JSON.parse(bakRaw) as Config;
      console.warn(`[Main] ${reason} — restored settings from config.json.bak`);
      await fsPromises.writeFile(configPath, JSON.stringify(restored, null, 2));
      return restored;
    }
  } catch (e) {
    if (!isErrnoCode(e, 'ENOENT')) {
      console.warn('[Main] Could not read config.json.bak:', e);
    }
  }

  try {
    if (fs.existsSync(configPath)) {
      const dir = path.dirname(configPath);
      const badName = `config.invalid.${Date.now()}.json`;
      await fsPromises.rename(configPath, path.join(dir, badName));
      console.error(
        `[Main] ${reason} — renamed broken config to ${badName}. No usable backup; wrote default settings. Check that folder for recovery.`
      );
    }
  } catch (e) {
    console.error('[Main] Could not rename invalid config file:', e);
  }

  await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
  return defaultConfig;
}

// Load or create config (never overwrite a broken file with defaults without trying .bak first)
async function loadConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await fsPromises.readFile(configPath, 'utf-8');
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      const defaultConfig = buildDefaultConfig();
      await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    throw error;
  }

  if (!raw.trim()) {
    return restoreOrCreateConfigAfterPrimaryInvalid('Config file was empty');
  }

  try {
    return JSON.parse(raw) as Config;
  } catch {
    return restoreOrCreateConfigAfterPrimaryInvalid('Config file JSON was invalid');
  }
}

// Save config - merges with existing config so undefined keys don't overwrite stored values
function saveConfig(config: Config): Promise<void> {
  if (!config) {
    return Promise.reject(new Error('Config object is undefined or null'));
  }
  const done = configSaveChain.then(() => saveConfigInternal(config));
  configSaveChain = done.catch(() => {});
  return done;
}

async function saveConfigInternal(config: Config) {
  try {
    let existing: Record<string, unknown> = {};
    try {
      const data = await withFileIoRetry(() => fsPromises.readFile(configPath, 'utf-8'));
      try {
        existing = JSON.parse(data) as Record<string, unknown>;
      } catch {
        existing = {};
      }
    } catch (e) {
      if (isErrnoCode(e, 'ENOENT')) {
        existing = {};
      } else {
        throw e;
      }
    }
    const merged = { ...existing };
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
    const configData = JSON.stringify(merged, null, 2);
    if (!configData) {
      throw new Error('Failed to serialize config to JSON');
    }
    try {
      if (fs.existsSync(configPath)) {
        await withFileIoRetry(() => fsPromises.copyFile(configPath, configBackupPath));
      }
    } catch (e) {
      console.warn('[Main] Config pre-save backup (config.json.bak) failed:', e);
    }
    await withFileIoRetry(() => fsPromises.writeFile(configPath, configData, 'utf8'));
    // src/main/config.ts keeps its own in-memory cache of config.json;
    // without this, transfer mappings saved here aren't seen until restart.
    invalidateConfigCache();
  } catch (error) {
    console.error('[Main] Error in saveConfig:', error);
    throw error;
  }
}

// Track settings window state
let settingsWindow: BrowserWindow | null = null;
let isSettingsWindowOpen = false;
let mainWindow: BrowserWindow | null = null;
let pathOverlayWindow: BrowserWindow | null = null;
let currentDirectoryPath: string = '';
let isPathPasteActive: boolean = false;

// Global key state tracking for Ctrl+Alt+V chord
const pressedKeys = new Set<number>();
const CTRL_KEY = UiohookKey.Ctrl;
const ALT_KEY = UiohookKey.Alt;
const V_KEY = UiohookKey.V;

// Check if the path paste chord (Ctrl+Alt+V) is complete
function isPathPasteChordPressed(): boolean {
  return pressedKeys.has(CTRL_KEY) && pressedKeys.has(ALT_KEY) && pressedKeys.has(V_KEY);
}

// Initialize global keyboard hook for path paste feature
function initializePathPasteHook() {
  uIOhook.on('keydown', (e) => {
    const keyCode = e.keycode;
    const wasChordComplete = isPathPasteChordPressed();
    
    // Track the key
    pressedKeys.add(keyCode);
    
    // Check if chord just became complete
    if (!wasChordComplete && isPathPasteChordPressed() && !isPathPasteActive) {
      console.log('[Main] Path paste chord activated (Ctrl+Alt+V pressed)');
      handlePathPasteActivate();
    }
  });

  uIOhook.on('keyup', (e) => {
    const keyCode = e.keycode;
    const wasChordComplete = isPathPasteChordPressed();
    
    // Remove the key from tracking
    pressedKeys.delete(keyCode);
    
    // Check if chord just broke (any chord key released while overlay is active)
    if (wasChordComplete && !isPathPasteChordPressed() && isPathPasteActive) {
      console.log('[Main] Path paste chord released, pasting');
      handlePathPasteRelease();
    }
  });

  // Start the hook
  uIOhook.start();
  console.log('[Main] Global keyboard hook initialized for path paste');
}

// Called when Ctrl+Alt+V chord is first completed
async function handlePathPasteActivate() {
  isPathPasteActive = true;

  const directoryPath = currentDirectoryPath;
  if (!directoryPath) {
    console.log('[Main] No current directory set, skipping path paste');
    isPathPasteActive = false;
    return;
  }

  // Extract client name from path to get IRD number
  let irdNumber: string | null = null;
  try {
    const config = await loadConfig();
    const csvPath = (config as any).clientbasePath;
    const rootDirectory = (config as any).rootPath;
    
    if (csvPath && rootDirectory) {
      const pathSegments = directoryPath.split(/[\/\\]/).filter(segment => segment && segment !== '');
      const rootSegments = rootDirectory.split(/[\/\\]/).filter(Boolean);
      const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === (rootSegments[rootSegments.length - 1] || '').toLowerCase());
      const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';
      
      if (clientName) {
        const rows = await new Promise<any[]>((resolve, reject) => {
          try {
            const content = fs.readFileSync(csvPath, 'utf8');
            const records = parse(content, { columns: true, skip_empty_lines: true, bom: true });
            resolve(records);
          } catch (err) {
            reject(err);
          }
        });
        
        if (rows && rows.length > 0) {
          const match = findClientRow(rows, clientName);
          if (match) {
            irdNumber = getIrdNumber(match);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Main] Error fetching IRD number:', error);
  }

  // Copy path to clipboard by default
  clipboard.writeText(directoryPath);
  console.log('[Main] Copied path to clipboard:', directoryPath);
  if (irdNumber) {
    console.log('[Main] IRD number found:', irdNumber);
  }

  // Show overlay window with both path and IRD
  createPathOverlayWindow(directoryPath, irdNumber);
}

// Called when any chord key is released
function handlePathPasteRelease() {
  // Close overlay first
  closePathOverlayWindow();
  
  // Then perform paste
  performPasteAction();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    titleBarStyle: 'hidden',
    icon: process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, '../public/256.ico')
      : path.join(__dirname, '../public/256.ico'), // Use the high-resolution icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true, // Enable webview tag for PDF viewing
    },
  });

  // Initialize autoUpdater service with the main window
  autoUpdaterService.setMainWindow(mainWindow);

  // Setup modal behavior for settings window
  setupModalBehavior();

  // Enable drag and drop for files
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Intercept window.open and open external URLs in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://')) {
      return { action: 'allow' };
    }
    // Allow OAuth popup windows for authentication (Xero, etc.)
    if (url.includes('login.xero.com') || url.includes('oauth') || url.includes('auth')) {
      return { action: 'allow' };
    }
    // Open all other external URLs in the default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Load config before creating window
  const config = await loadConfig();

  // Initialize Express server for PDF file serving
  initializeExpressServer();

  await syncChromeExtensionBridgeWithConfig();
  
  createWindow();

  void purgeOldTrash();

  // Register global shortcut for app activation
  await registerGlobalShortcut(config);
  
  // Initialize global keyboard hook for Ctrl+Alt+V path paste
  initializePathPasteHook();
});

// Global shortcut management
let currentShortcut: string | null = null;

async function registerGlobalShortcut(config: Config) {
  try {
    // Unregister all previously registered shortcuts to avoid duplicates
    globalShortcut.unregisterAll();
    currentShortcut = null;

    // Check if activation shortcut is enabled
    if (config.enableActivationShortcut !== false) {
      const shortcut = config.activationShortcut || '`';
      
      // Convert shortcut to Electron format
      const electronShortcut = convertToElectronShortcut(shortcut);
      
      // Register the global shortcut
      const success = globalShortcut.register(electronShortcut, () => {
        console.log('[Main] Global shortcut triggered:', shortcut);
        activateApp();
      });

      if (success) {
        currentShortcut = electronShortcut;
        console.log('[Main] Global shortcut registered successfully:', electronShortcut);
      } else {
        console.error('[Main] Failed to register global shortcut:', electronShortcut);
      }
    }

    // Note: Ctrl+Alt+V for path paste is handled via uIOhook for proper keyup detection
    
  } catch (error) {
    console.error('[Main] Error registering global shortcut:', error);
  }
}

// Perform the paste action using Windows SendKeys
function performPasteAction() {
  try {
    if (process.platform === 'win32') {
      const pasteScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
      exec(`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${pasteScript}"`, { maxBuffer: 1024 }, (error) => {
        if (error) {
          console.error('[Main] Error simulating paste:', error);
        } else {
          console.log('[Main] Simulated Ctrl+V paste');
        }
      });
    }
  } catch (error) {
    console.error('[Main] Error performing paste action:', error);
  }
}

function convertToElectronShortcut(shortcutRaw: string): string {
  // Normalize away any spaces (the recorder historically saved "Ctrl + Y"); the
  // exact-match cases and the "Ctrl+"/"Alt+" replacements below assume no spaces.
  const shortcut = (shortcutRaw || '').replace(/\s+/g, '');
  // Convert common shortcuts to Electron format
  switch (shortcut) {
    case '`':
      return '`';
    case 'F12':
      return 'F12';
    case 'F11':
      return 'F11';
    case 'F10':
      return 'F10';
    case 'F9':
      return 'F9';
    case 'F8':
      return 'F8';
    case 'F7':
      return 'F7';
    case 'F6':
      return 'F6';
    case 'F5':
      return 'F5';
    case 'F4':
      return 'F4';
    case 'F3':
      return 'F3';
    case 'F2':
      return 'F2';
    case 'F1':
      return 'F1';
    case 'Alt+F':
      return 'Alt+F';
    case 'Alt+Q':
      return 'Alt+Q';
    case 'Alt+W':
      return 'Alt+W';
    case 'Ctrl+T':
      return 'CommandOrControl+T';
    case 'Ctrl+W':
      return 'CommandOrControl+W';
    case 'Ctrl+Shift+F':
      return 'CommandOrControl+Shift+F';
    case 'Ctrl+Alt+F':
      return 'CommandOrControl+Alt+F';
    
    default:
      // Handle dynamic shortcuts by converting common patterns
      if (shortcut.includes('Shift+')) {
        return shortcut.replace('Shift+', 'Shift+');
      }
      if (shortcut.includes('Ctrl+')) {
        return shortcut.replace('Ctrl+', 'CommandOrControl+');
      }
      if (shortcut.includes('Alt+')) {
        return shortcut.replace('Alt+', 'Alt+');
      }
      return shortcut;
  }
}

function activateApp() {
  // Use the stored mainWindow variable instead of getting all windows
  // This ensures we activate the main window, not the floating timer
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Handle minimized state first
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    
    // Show the window if it's hidden
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    // Use a more tiling-manager-friendly approach
    if (process.platform === 'win32') {
      // On Windows, use a gentler approach that works better with tiling managers
      // First try to focus normally
      mainWindow.focus();
      
      // If that doesn't work (window might be behind others), use moveTop
      if (!mainWindow.isFocused()) {
        mainWindow.moveTop();
      }
    } else {
      // On other platforms, just focus
      mainWindow.focus();
    }
    
    console.log('[Main] App activated via global shortcut');
  } else {
    // Fallback: if mainWindow is not available, try to find it
    const windows = BrowserWindow.getAllWindows();
    const foundMainWindow = windows.find(win => !win.isDestroyed());
    if (foundMainWindow) {
      if (foundMainWindow.isMinimized()) {
        foundMainWindow.restore();
      }
      if (!foundMainWindow.isVisible()) {
        foundMainWindow.show();
      }
      foundMainWindow.focus();
      console.log('[Main] App activated via global shortcut (fallback)');
    }
  }
}



// IPC handler to update global shortcut
ipcMain.handle('update-global-shortcut', async (_, config: Config) => {
  try {
    await registerGlobalShortcut(config);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error updating global shortcut:', error);
    throw error;
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  // Stop all file watchers
  stopAllWatchers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  // Stop global keyboard hook
  uIOhook.stop();
  // Stop all file watchers
  stopAllWatchers();
  // Cleanup Express server
  cleanupExpressServer();
  stopChromeExtensionBridgeServer();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('execute-command', async (_, command: string, currentDirectory?: string, options?: any) => {
  try {
    console.log('[Main] Received command:', command, 'currentDirectory:', currentDirectory, 'options:', options);
    const result = await handleCommand(command, [], currentDirectory, options);
    console.log('[Main] Command result:', result);
    return result;
  } catch (error) {
    console.error('[Main] Error executing command:', error);
    throw error;
  }
});

ipcMain.handle('transfer-files', async (_, options: { numFiles?: number; newName?: string; command?: string; currentDirectory?: string }) => {
  try {
    const result = await transferFiles(options);
    return result;
  } catch (error) {
    console.error('[Main] Error transferring files:', error);
    throw error;
  }
});

// Root path git integration (footer status indicator)
async function getRootPathForGit(): Promise<string> {
  const config = await loadConfig();
  return (config as { rootPath?: string }).rootPath || '';
}

ipcMain.handle('root-git-status', async (_, options?: { fetch?: boolean }) => {
  try {
    return await getRootGitStatus(await getRootPathForGit(), options);
  } catch (error) {
    console.error('[Main] Error getting root git status:', error);
    throw error;
  }
});

ipcMain.handle('root-git-push', async () => {
  return await rootGitPush(await getRootPathForGit());
});

ipcMain.handle('root-git-pull', async () => {
  return await rootGitPull(await getRootPathForGit());
});

ipcMain.handle('root-git-discard', async () => {
  return await rootGitDiscard(await getRootPathForGit());
});

/**
 * Replace an existing file's content with a file from Downloads (target keeps its name).
 * downloadFileName null → use the most recently modified download (legacy "latest" behavior).
 */
async function performReplaceFromDownloads(
  downloadFileName: string | null,
  targetFilePath: string
): Promise<{ success: boolean; message: string; downloadName?: string }> {
  try {
    if (!targetFilePath || typeof targetFilePath !== 'string') {
      return {
        success: false,
        message: 'Invalid target file path'
      };
    }

    const downloadsPath = app.getPath('downloads');

    if (!fs.existsSync(downloadsPath)) {
      console.error('[Main] Downloads directory not found:', downloadsPath);
      return { success: false, message: `Downloads directory not found: ${downloadsPath}` };
    }

    let source: { file: string; filePath: string } | null = null;
    if (downloadFileName) {
      const filePath = path.join(downloadsPath, downloadFileName);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return { success: false, message: `Download not found: ${downloadFileName}` };
      }
      source = { file: downloadFileName, filePath };
    } else {
      const files = fs.readdirSync(downloadsPath)
        .map(file => {
          const filePath = path.join(downloadsPath, file);
          const stats = fs.statSync(filePath);
          return { file, filePath, mtime: stats.mtime, stats };
        })
        .filter(f => f.stats.isFile())
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (files.length === 0) {
        return { success: false, message: 'No files found in Downloads folder' };
      }
      source = files[0];
    }

    const targetDir = path.dirname(targetFilePath);
    const targetName = path.basename(targetFilePath);

    if (!fs.existsSync(targetDir)) {
      return { success: false, message: `Target directory does not exist: ${targetDir}` };
    }

    // Copy the download over the target file (overwrite) then delete original
    fs.copyFileSync(source.filePath, targetFilePath);

    if (!fs.existsSync(targetFilePath)) {
      return { success: false, message: 'File replace failed - destination file not found after copy' };
    }

    try {
      fs.unlinkSync(source.filePath);
    } catch (error) {
      console.warn('[Main] Failed to delete original downloads file after replace:', error);
    }

    // Notify renderer so FileGrid can refresh and highlight the updated file
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (mainWindow) {
      mainWindow.webContents.send('folderContentsChanged', {
        directory: targetDir,
        newFiles: [targetFilePath]
      });
    }

    return {
      success: true,
      message: `Replaced ${targetName} with ${source.file} from Downloads`,
      downloadName: source.file
    };
  } catch (error) {
    console.error('[Main] Error replacing file from Downloads:', error);
    return {
      success: false,
      message: `Error replacing file: ${getFileOperationErrorMessage(error)}`
    };
  }
}

ipcMain.handle('replace-with-latest-file', async (_event, targetFilePath: string) => {
  return performReplaceFromDownloads(null, targetFilePath);
});

ipcMain.handle('replace-file-from-downloads', async (_event, downloadFileName: string, targetFilePath: string) => {
  return performReplaceFromDownloads(downloadFileName || null, targetFilePath);
});

ipcMain.handle('get-config', async () => {
  try {
    return await loadConfig();
  } catch (error) {
    console.error('Error getting config:', error);
    throw error;
  }
});

ipcMain.handle('set-config', async (_, config: Config) => {
  try {
    if (!config) {
      throw new Error('Config parameter is undefined or null');
    }

    await saveConfig(config);
    await syncChromeExtensionBridgeWithConfig();
    return config;
  } catch (error) {
    console.error('Error occurred in handler for \'set-config\':', error);
    throw error;
  }
});

ipcMain.handle('get-directory-contents', async (_, dirPath: string) => {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    // Stat all entries concurrently — sequential awaits made a 200-folder dir on a
    // network share pay one round-trip per entry. (libuv threadpool bounds real parallelism;
    // raise UV_THREADPOOL_SIZE if the share is high-latency.)
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        try {
          const stats = await fsPromises.stat(fullPath);
          return {
            name: entry.name,
            path: fullPath,
            type: entry.isDirectory() ? 'folder' : 'file',
            size: stats.size.toString(),
            modified: stats.mtime.toISOString(),
            extension: entry.isFile() ? path.extname(entry.name).toLowerCase().slice(1) : undefined,
          };
        } catch (error) {
          // Skip busy/locked/inaccessible files
          console.error(`Skipping file (stat error): ${fullPath}`, error);
          return null;
        }
      })
    );
    return results.filter(Boolean);
  } catch (error) {
    console.error('Error getting directory contents:', error);
    throw error;
  }
});

ipcMain.handle('get-downloads-path', async () => {
  try {
    const downloadsPath = app.getPath('downloads');
    console.log('[Main] Downloads path:', downloadsPath);
    return downloadsPath;
  } catch (error) {
    console.error('Error getting downloads path:', error);
    throw error;
  }
});

ipcMain.handle('create-directory', async (_, dirPath: string) => {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    const stats = await fsPromises.stat(dirPath);
    return {
      name: path.basename(dirPath),
      path: dirPath,
      type: 'folder',
      size: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('delete-item', async (_, itemPath: string) => {
  // Fast path: Try immediate deletion first
  let stats;
  try {
    stats = await fsPromises.stat(itemPath);
    
    if (stats.isDirectory()) {
      await fsPromises.rmdir(itemPath, { recursive: true });
    } else {
      await fsPromises.unlink(itemPath);
    }
    
    // Emit folder contents changed event to trigger refresh
    const parentDirectory = path.dirname(itemPath);
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('folderContentsChanged', { directory: parentDirectory });
    });
    
    return; // Success - immediate deletion worked
  } catch (error: any) {
    // Only proceed with retries/alternatives if deletion failed
    console.log(`Fast deletion failed for ${itemPath}: ${error.code} - ${error.message}`);
    
    // Retry logic for locked files only
    if (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOTEMPTY') {
      // Quick retry with permission fix and different approaches
      try {
        if (stats && !stats.isDirectory()) {
          // Method 1: Try chmod + unlink
          try {
            await fsPromises.chmod(itemPath, 0o666);
            await fsPromises.unlink(itemPath);
            
            // Emit folder contents changed event
            const parentDirectory = path.dirname(itemPath);
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('folderContentsChanged', { directory: parentDirectory });
            });
            
            return; // Success after permission fix
          } catch (chmodError) {
            console.log(`chmod+unlink failed: ${chmodError.code}`);
          }
          
          // Method 2: Try fs.rm (newer Node.js API, sometimes more effective)
          try {
            await fsPromises.rm(itemPath, { force: true });
            console.log(`Successfully deleted ${itemPath} using fs.rm`);
            
            // Emit folder contents changed event
            const parentDirectory = path.dirname(itemPath);
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('folderContentsChanged', { directory: parentDirectory });
            });
            
            return; // Success with fs.rm
          } catch (rmError) {
            console.log(`fs.rm failed: ${rmError.code}`);
            throw rmError; // Propagate so CMD/PowerShell fallback is attempted
          }
        } else {
          // For directories, try the newer rmdir approach
          await fsPromises.rm(itemPath, { recursive: true, force: true });
          
          // Emit folder contents changed event
          const parentDirectory = path.dirname(itemPath);
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('folderContentsChanged', { directory: parentDirectory });
          });
          
          return; // Success for directory
        }
      } catch (retryError: any) {
                 // Try faster Windows alternatives before PowerShell
         if (process.platform === 'win32' && (retryError.code === 'EPERM' || retryError.code === 'EBUSY')) {
           try {
             // Method 1: Try cmd /c del - faster than PowerShell
             const { execSync } = require('child_process');
             const quotedPath = `"${itemPath}"`;
             
             console.log(`Trying CMD deletion for ${itemPath}...`);
             execSync(`cmd /c del /f /q ${quotedPath}`, { timeout: 1000 });
             console.log(`Successfully force-deleted ${itemPath} using CMD`);
             
             // Emit folder contents changed event
             const parentDirectory = path.dirname(itemPath);
             BrowserWindow.getAllWindows().forEach(win => {
               win.webContents.send('folderContentsChanged', { directory: parentDirectory });
             });
             
             return; // Success with CMD
           } catch (cmdError) {
             console.log('CMD deletion failed, trying PowerShell...');
             
             // Method 2: PowerShell as fallback (but with shorter timeout)
             try {
               const { execSync } = require('child_process');
               const escapedPath = itemPath.replace(/'/g, "''");
               
               execSync(`powershell -Command "Remove-Item -Path '${escapedPath}' -Force"`, 
                 { timeout: 1500 });
               
               console.log(`Successfully force-deleted ${itemPath} using PowerShell`);
               
               // Emit folder contents changed event
               const parentDirectory = path.dirname(itemPath);
               BrowserWindow.getAllWindows().forEach(win => {
                 win.webContents.send('folderContentsChanged', { directory: parentDirectory });
               });
               
               return; // Success with PowerShell
             } catch (powerShellError) {
               console.warn('PowerShell deletion also failed:', powerShellError);
             }
           }
         }
        
        // Final error - provide helpful message without slow process detection
        const fileName = path.basename(itemPath);
        let helpfulMessage = `Cannot delete "${fileName}". `;
        
        if (retryError.code === 'EPERM') {
          helpfulMessage += 'File is likely open in another application (PDF reader, Word, etc.). Please close the application and try again.';
        } else if (retryError.code === 'EBUSY') {
          helpfulMessage += 'File is currently in use. Please wait and try again.';
        } else if (retryError.code === 'ENOTEMPTY') {
          helpfulMessage += 'Directory is not empty or contains locked files.';
        } else {
          helpfulMessage += retryError.message;
        }
        
        throw new Error(helpfulMessage);
      }
    } else {
      // For non-permission errors, throw immediately
      throw error;
    }
  }
});

ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Directory',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error selecting directory:', error);
    throw error;
  }
});


ipcMain.handle('select-file', async (_, options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: options?.title || 'Select File',
      filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error selecting file:', error);
    throw error;
  }
});

ipcMain.handle('validate-path', async (_, dirPath: string) => {
  try {
    const stats = await fsPromises.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    console.error('Error validating path:', error);
    return false;
  }
});

ipcMain.handle('move-item', async (_, sourcePath: string, destinationPath: string) => {
  try {
    await fileSystemService.moveItem(sourcePath, destinationPath);
  } catch (error) {
    console.error('Error moving item:', error);
    throw error;
  }
});

ipcMain.handle('rename-item', async (_, oldPath: string, newPath: string) => {
  try {
    // Validate input paths
    if (!oldPath || !newPath) {
      throw new Error('Invalid paths provided for rename operation');
    }

    // Check if source file exists
    try {
      await fsPromises.access(oldPath, fs.constants.F_OK);
    } catch (error) {
      throw new Error(`Source file does not exist: ${oldPath}`);
    }

    // Check if source and target are the same
    if (path.resolve(oldPath) === path.resolve(newPath)) {
      throw new Error('Source and destination paths are identical');
    }

    // Check if target directory exists
    const targetDir = path.dirname(newPath);
    try {
      await fsPromises.access(targetDir, fs.constants.F_OK);
    } catch (error) {
      throw new Error(`Target directory does not exist: ${targetDir}`);
    }

    // Normalize paths for comparison (Windows is case-insensitive)
    const normalizedOldPath = path.resolve(oldPath).toLowerCase();
    const normalizedNewPath = path.resolve(newPath).toLowerCase();
    const isCaseOnlyRename = normalizedOldPath === normalizedNewPath && oldPath !== newPath;
    
    // Skip conflict check for case-only renames (same file, different case)
    // Case-only renames should always be allowed without dialog
    if (!isCaseOnlyRename) {
      // Check if target file already exists (different file)
      try {
        await fsPromises.access(newPath, fs.constants.F_OK);
        // File exists - check if it's actually the same file by comparing stats
        const oldStats = await fsPromises.stat(oldPath);
        const newStats = await fsPromises.stat(newPath);
        
        // If it's the same file (same inode/dev), skip dialog and allow rename
        if (oldStats.ino === newStats.ino && oldStats.dev === newStats.dev) {
          // Same file, allow rename without dialog
        } else {
          // Different file exists - ask user what to do
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'File Already Exists',
            message: `A file named "${path.basename(newPath)}" already exists.`,
            detail: 'Do you want to replace it?'
          });
          
          if (response === 1) { // Cancel
            throw new Error('Rename cancelled: Target file already exists');
          }
          
          // User chose to replace, delete the existing file
          await fsPromises.unlink(newPath);
        }
      } catch (error) {
        // If error is not about file existing, it's something else
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // ENOENT means file doesn't exist, which is good - continue with rename
      }
    }

    // Validate filename - check for invalid characters
    const fileName = path.basename(newPath);
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(fileName)) {
      throw new Error('Filename contains invalid characters');
    }

    // Check filename length (Windows has 255 char limit)
    if (fileName.length > 255) {
      throw new Error('Filename is too long (maximum 255 characters)');
    }

    // Check if the source file is currently open/locked
    try {
      const handle = await fsPromises.open(oldPath, 'r+');
      await handle.close();
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM') {
        throw new Error(`Cannot rename: File is currently open or in use by another application`);
      }
      // Other errors might not be locks, so continue
    }

    // Pure atomic rename only
    try {
      await fsPromises.rename(oldPath, newPath);
      console.log(`Successfully renamed: ${oldPath} -> ${newPath}`);
      // Emit folder contents changed event to trigger refresh
      const parentDirectory = path.dirname(oldPath);
      const targetDirectory = path.dirname(newPath);
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('folderContentsChanged', { directory: parentDirectory });
      });
      if (parentDirectory !== targetDirectory) {
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('folderContentsChanged', { directory: targetDirectory });
        });
      }
      return true;
    } catch (error: unknown) {
      console.error('Error renaming item:', error);
      const err = error as NodeJS.ErrnoException & { code?: string };
      const code = err?.code;
      if (code === 'EBUSY' || code === 'EPERM') {
        throw new Error('Cannot rename: File is currently open or in use by another application');
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  } catch (error) {
    console.error('Error renaming item:', error);
    throw error;
  }
});

ipcMain.handle('open-file', async (_, filePath: string) => {
  try {
    await shell.openPath(filePath);
    return true;
  } catch (error) {
    console.error('Error opening file:', error);
    throw error;
  }
});

ipcMain.handle('open-directory', async (_, dirPath: string) => {
  try {
    await shell.openPath(dirPath);
    return true;
  } catch (error) {
    console.error('Error opening directory:', error);
    throw error;
  }
});

ipcMain.handle('open-cmd-at-directory', async (_, dirPath: string) => {
  try {
    if (process.platform === 'win32') {
      // Try Windows Terminal first; fall back to bare powershell.exe
      const child = spawn('wt.exe', ['new-tab', 'powershell.exe', '-NoExit', '-Command', `Set-Location '${dirPath}'`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });
      child.on('error', () => {
        spawn('powershell.exe', ['-NoExit', '-Command', `Set-Location '${dirPath}'`], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', dirPath], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      spawn('xterm', ['-e', `cd "${dirPath}" && exec $SHELL`], {
        detached: true,
        stdio: 'ignore'
      }).unref().on('error', () => {
        spawn('gnome-terminal', ['--working-directory', dirPath], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error opening CMD at directory:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// ── Soft delete + undo ────────────────────────────────────────────────
// Deletes move into an app-managed trash so Ctrl+Z can restore them — a plain
// unlink (the old delete-item path) can't be undone. Buckets are timestamp-named;
// purgeOldTrash() drops anything older than 7 days on startup.
// ponytail: app trash, not the Windows Recycle Bin — keeps undo a simple move-back.
const TRASH_ROOT = path.join(app.getPath('userData'), '.trash');
const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function moveAcrossVolumes(src: string, dest: string) {
  try {
    await fsPromises.rename(src, dest);
  } catch (err: any) {
    if (err?.code === 'EXDEV') {
      await fsPromises.cp(src, dest, { recursive: true });
      await fsPromises.rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

async function purgeOldTrash() {
  try {
    const entries = await fsPromises.readdir(TRASH_ROOT, { withFileTypes: true });
    const cutoff = Date.now() - TRASH_TTL_MS;
    for (const e of entries) {
      const ts = parseInt(e.name.split('-')[0], 10);
      if (!Number.isNaN(ts) && ts < cutoff) {
        await fsPromises.rm(path.join(TRASH_ROOT, e.name), { recursive: true, force: true });
      }
    }
  } catch {}
}

ipcMain.handle('soft-delete-item', async (_, itemPath: string) => {
  await fsPromises.mkdir(TRASH_ROOT, { recursive: true });
  const bucket = path.join(TRASH_ROOT, `${Date.now()}-${randomBytes(4).toString('hex')}`);
  await fsPromises.mkdir(bucket, { recursive: true });
  const trashed = path.join(bucket, path.basename(itemPath));
  await moveAcrossVolumes(itemPath, trashed);
  const parentDirectory = path.dirname(itemPath);
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('folderContentsChanged', { directory: parentDirectory });
  });
  return { original: itemPath, trashed };
});

ipcMain.handle('restore-trashed', async (_, entries: { original: string; trashed: string }[]) => {
  const results: { original: string; status: 'success' | 'error'; error?: string }[] = [];
  for (const entry of entries) {
    try {
      await fsPromises.mkdir(path.dirname(entry.original), { recursive: true });
      await moveAcrossVolumes(entry.trashed, entry.original);
      results.push({ original: entry.original, status: 'success' });
    } catch (error: any) {
      results.push({ original: entry.original, status: 'error', error: getFileOperationErrorMessage(error) });
    }
  }
  const dirs = new Set(entries.map(e => path.dirname(e.original)));
  BrowserWindow.getAllWindows().forEach(win => {
    dirs.forEach(d => win.webContents.send('folderContentsChanged', { directory: d }));
  });
  return results;
});

ipcMain.handle('confirm-delete', async (_, fileNames: string[]) => {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Delete File(s)',
    message: `Are you sure you want to delete the following file(s)?`,
    detail: fileNames.join('\n'),
  });
  return response === 0;
});

ipcMain.handle('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.maximize();
});

ipcMain.handle('window-unmaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.unmaximize();
});

ipcMain.handle('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
});

// Get file icon using Windows file associations
ipcMain.handle('get-file-icon', async (_, filePath: string) => {
  try {
    if (process.platform === 'win32') {
      // Get system icon for the file
      const icon = await app.getFileIcon(filePath, { size: 'normal' });
      if (icon) {
        return icon.toDataURL();
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting file icon:', error);
    return null;
  }
});

// Open file in Notepad
ipcMain.handle('open-file-in-notepad', async (_, filePath: string) => {
  try {
    const { spawn } = require('child_process');
    
    // Use Windows notepad.exe to open the file
    if (process.platform === 'win32') {
      spawn('notepad.exe', [filePath], {
        detached: true,
        stdio: 'ignore'
      });
      return { success: true };
    } else {
      // For non-Windows platforms, try to use default text editor
      const { shell } = require('electron');
      await shell.openPath(filePath);
      return { success: true };
    }
  } catch (error) {
    console.error('Failed to open file in Notepad:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Windows: shell "Create Shortcut" wizard (same as Explorer New → Shortcut)
ipcMain.handle('open-windows-create-shortcut-wizard', async (_, workingDirectory: string) => {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Create Shortcut wizard is only available on Windows.' };
    }
    const dir = path.resolve(workingDirectory);
    let st;
    try {
      st = await fsPromises.stat(dir);
    } catch {
      return { success: false, error: 'Folder not found.' };
    }
    if (!st.isDirectory()) {
      return { success: false, error: 'Path is not a folder.' };
    }
    spawn('rundll32.exe', ['appwiz.cpl,NewLinkHere', dir], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to open Create Shortcut wizard:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Handle file upload via drag and drop
ipcMain.handle('upload-files', async (_, files: { path: string; name: string }[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string }> = [];
    
    for (const file of files) {
      try {
        const targetPath = path.join(targetDirectory, file.name);
        
        // Check if file already exists
        try {
          await fsPromises.access(targetPath);
          // File exists, ask user what to do
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Skip', 'Cancel'],
            defaultId: 0,
            title: 'File Already Exists',
            message: `The file "${file.name}" already exists in the destination folder.`,
            detail: 'Do you want to replace it?'
          });
          
          if (response === 2) { // Cancel
            throw new Error('Upload cancelled by user');
          } else if (response === 1) { // Skip
            results.push({ file: file.name, status: 'skipped' });
            continue;
          }
          // response === 0 means replace, continue with copy
        } catch (error) {
          // File doesn't exist, continue with copy
        }
        
        // Copy the file
        await fsPromises.copyFile(file.path, targetPath);
        results.push({ file: file.name, status: 'success', path: targetPath });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        results.push({ file: file.name, status: 'error', error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in upload-files handler:', error);
    throw error;
  }
});

// Move files by dragging
ipcMain.handle('move-files', async (_, files: string[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
    
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        const targetPath = path.join(targetDirectory, fileName);
        
        // Check if target is different from source
        if (path.dirname(filePath) === targetDirectory) {
          results.push({ file: fileName, status: 'skipped', reason: 'Same directory' });
          continue;
        }
        
        // Check if file already exists in target
        try {
          await fsPromises.access(targetPath);
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Skip', 'Cancel'],
            defaultId: 1,
            title: 'File Already Exists',
            message: `The file "${fileName}" already exists in the destination folder.`,
            detail: 'Do you want to replace it?'
          });
          
          if (response === 2) { // Cancel
            throw new Error('Move cancelled by user');
          } else if (response === 1) { // Skip
            results.push({ file: fileName, status: 'skipped', reason: 'File exists' });
            continue;
          }
          // response === 0 means replace, continue with move
        } catch (error) {
          // File doesn't exist, continue with move
        }
        
        // Copy the file first
        await fsPromises.copyFile(filePath, targetPath);
        
        // Verify the copy was successful
        try {
          await fsPromises.access(targetPath);
        } catch (error) {
          throw new Error('File copy failed - destination file not found after copy');
        }
        
        // Delete the original file
        await fsPromises.unlink(filePath);
        
        results.push({ file: fileName, status: 'success', path: targetPath });
      } catch (error) {
        console.error(`Error moving file ${filePath}:`, error);
        // If copy succeeded but delete failed, try to clean up
        const fileName = path.basename(filePath);
        const targetPath = path.join(targetDirectory, fileName);
        try {
          await fsPromises.access(targetPath);
          await fsPromises.unlink(targetPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        results.push({ file: path.basename(filePath), status: 'error', error: getFileOperationErrorMessage(error) });
      }
    }
    
    // Emit folder refresh event for successful transfers
    const successfulFiles = results.filter(r => r.status === 'success');
    const mainWindow = BrowserWindow.getAllWindows()[0]; // Get the main window
    if (successfulFiles.length > 0 && mainWindow) {
      const transferredFilePaths = successfulFiles.map(r => r.path).filter(Boolean);
      mainWindow.webContents.send('folderContentsChanged', { 
        directory: targetDirectory,
        newFiles: transferredFilePaths
      });
      console.log(`[Move Files] Triggered folder refresh for directory: ${targetDirectory}`);
      console.log(`[Move Files] New files transferred: ${transferredFilePaths.join(', ')}`);
    }
    
    return results;
  } catch (error) {
    console.error('Error in move-files handler:', error);
    throw error;
  }
});

// Copy files by dragging with Ctrl key
ipcMain.handle('copy-files', async (_, files: string[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
    
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        const targetPath = path.join(targetDirectory, fileName);
        
        // Check if file already exists in target
        try {
          await fsPromises.access(targetPath);
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Skip', 'Cancel'],
            defaultId: 1,
            title: 'File Already Exists',
            message: `The file "${fileName}" already exists in the destination folder.`,
            detail: 'Do you want to replace it?'
          });
          
          if (response === 2) { // Cancel
            throw new Error('Copy cancelled by user');
          } else if (response === 1) { // Skip
            results.push({ file: fileName, status: 'skipped', reason: 'File exists' });
            continue;
          }
          // response === 0 means replace, continue with copy
        } catch (error) {
          // File doesn't exist, continue with copy
        }
        
        // Copy the file
        const stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
          // For directories, copy recursively
          await fsPromises.cp(filePath, targetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(filePath, targetPath);
        }
        
        results.push({ file: fileName, status: 'success', path: targetPath });
      } catch (error) {
        console.error(`Error copying file ${filePath}:`, error);
        results.push({ file: path.basename(filePath), status: 'error', error: getFileOperationErrorMessage(error) });
      }
    }
    
    // Emit folder refresh event for successful transfers
    const successfulFiles = results.filter(r => r.status === 'success');
    if (successfulFiles.length > 0) {
      const transferredFilePaths = successfulFiles.map(r => r.path).filter(Boolean);
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('folderContentsChanged', { 
          directory: targetDirectory,
          newFiles: transferredFilePaths
        });
        console.log(`[Copy Files] Triggered folder refresh for directory: ${targetDirectory}`);
        console.log(`[Copy Files] New files transferred: ${transferredFilePaths.join(', ')}`);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in copy-files handler:', error);
    throw error;
  }
});

// Enhanced move files with conflict resolution and copy numbering
ipcMain.handle('move-files-with-conflict-resolution', async (_, files: string[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
    
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        let targetPath = path.join(targetDirectory, fileName);
        
        // Check if target is different from source
        if (path.dirname(filePath) === targetDirectory) {
          results.push({ file: fileName, status: 'skipped', reason: 'Same directory' });
          continue;
        }
        
        // Handle file conflicts with user choice
        if (await fileExists(targetPath)) {
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Make Copy', 'Skip', 'Cancel'],
            defaultId: 1,
            title: 'File Already Exists',
            message: `The file "${fileName}" already exists in the destination folder.`,
            detail: 'Choose how to handle this conflict:'
          });
          
          if (response === 3) { // Cancel
            throw new Error('Move cancelled by user');
          } else if (response === 2) { // Skip
            results.push({ file: fileName, status: 'skipped', reason: 'File exists, skipped by user' });
            continue;
          } else if (response === 1) { // Make Copy
            targetPath = await generateUniqueFileName(targetPath);
          }
          // response === 0 means replace, continue with original targetPath
        }
        
        // Copy the file/directory first
        const stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
          // For directories, copy recursively
          await fsPromises.cp(filePath, targetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(filePath, targetPath);
        }
        
        // Verify the copy was successful
        if (!(await fileExists(targetPath))) {
          throw new Error('File/directory copy failed - destination not found after copy');
        }
        
        // Delete the original file/directory
        if (stats.isDirectory()) {
          await fsPromises.rm(filePath, { recursive: true, force: true });
        } else {
          await fsPromises.unlink(filePath);
        }
        
        results.push({ file: path.basename(targetPath), status: 'success', path: targetPath });
      } catch (error) {
        console.error(`Error moving file ${filePath}:`, error);
        // If copy succeeded but delete failed, try to clean up
        const fileName = path.basename(filePath);
        const targetPath = path.join(targetDirectory, fileName);
        try {
          if (await fileExists(targetPath)) {
            await fsPromises.unlink(targetPath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        results.push({ file: path.basename(filePath), status: 'error', error: getFileOperationErrorMessage(error) });
      }
    }
    
    // Emit folder refresh event for successful transfers
    const successfulFiles = results.filter(r => r.status === 'success');
    const mainWindow = BrowserWindow.getAllWindows()[0]; // Get the main window
    if (successfulFiles.length > 0) {
      const transferredFilePaths = successfulFiles.map(r => r.path).filter(Boolean);
      if (mainWindow) {
        mainWindow.webContents.send('folderContentsChanged', { 
          directory: targetDirectory,
          newFiles: transferredFilePaths
        });
        console.log(`[Move Files with Conflict Resolution] Triggered folder refresh for directory: ${targetDirectory}`);
        console.log(`[Move Files with Conflict Resolution] New files transferred: ${transferredFilePaths.join(', ')}`);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in move-files-with-conflict-resolution handler:', error);
    throw error;
  }
});

// Enhanced copy files with conflict resolution and copy numbering
ipcMain.handle('copy-files-with-conflict-resolution', async (_, files: string[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
    
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        let targetPath = path.join(targetDirectory, fileName);
        
        // Handle file conflicts with user choice
        if (await fileExists(targetPath)) {
          const { response } = await dialog.showMessageBox({
            type: 'question',
            buttons: ['Replace', 'Make Copy', 'Skip', 'Cancel'],
            defaultId: 1,
            title: 'File Already Exists',
            message: `The file "${fileName}" already exists in the destination folder.`,
            detail: 'Choose how to handle this conflict:'
          });
          
          if (response === 3) { // Cancel
            throw new Error('Copy cancelled by user');
          } else if (response === 2) { // Skip
            results.push({ file: fileName, status: 'skipped', reason: 'File exists, skipped by user' });
            continue;
          } else if (response === 1) { // Make Copy
            targetPath = await generateUniqueFileName(targetPath);
          }
          // response === 0 means replace, continue with original targetPath
        }
        
        // Copy the file
        const stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
          // For directories, copy recursively
          await fsPromises.cp(filePath, targetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(filePath, targetPath);
        }
        
        results.push({ file: path.basename(targetPath), status: 'success', path: targetPath });
      } catch (error) {
        console.error(`Error copying file ${filePath}:`, error);
        results.push({ file: path.basename(filePath), status: 'error', error: getFileOperationErrorMessage(error) });
      }
    }
    
    // Emit folder refresh event for successful transfers
    const successfulFiles = results.filter(r => r.status === 'success');
    if (successfulFiles.length > 0) {
      const transferredFilePaths = successfulFiles.map(r => r.path).filter(Boolean);
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('folderContentsChanged', { 
          directory: targetDirectory,
          newFiles: transferredFilePaths
        });
        console.log(`[Copy Files with Conflict Resolution] Triggered folder refresh for directory: ${targetDirectory}`);
        console.log(`[Copy Files with Conflict Resolution] New files transferred: ${transferredFilePaths.join(', ')}`);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in copy-files-with-conflict-resolution handler:', error);
    throw error;
  }
});

// Helper function to check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Silent copy file with custom target path (no dialogs)
ipcMain.handle('copy-file-silent', async (_, sourcePath: string, targetPath: string) => {
  try {
    await fsPromises.copyFile(sourcePath, targetPath);
    return { success: true, path: targetPath };
  } catch (error) {
    console.error('Error in copy-file-silent handler:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Silent move files (no conflict dialogs - auto-rename on conflict)
ipcMain.handle('move-files-silent', async (_, files: string[], targetDirectory: string) => {
  try {
    const results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        let targetPath = path.join(targetDirectory, fileName);
        if (path.dirname(filePath) === targetDirectory) {
          results.push({ file: fileName, status: 'skipped', reason: 'Same directory' });
          continue;
        }
        if (await fileExists(targetPath)) {
          targetPath = await generateUniqueFileName(targetPath);
        }
        const stats = await fsPromises.stat(filePath);
        if (stats.isDirectory()) {
          await fsPromises.cp(filePath, targetPath, { recursive: true });
          await fsPromises.rm(filePath, { recursive: true, force: true });
        } else {
          await fsPromises.copyFile(filePath, targetPath);
          await fsPromises.unlink(filePath);
        }
        results.push({ file: path.basename(targetPath), status: 'success', path: targetPath });
      } catch (error) {
        results.push({ file: path.basename(filePath), status: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    }
    const successfulFiles = results.filter(r => r.status === 'success');
    if (successfulFiles.length > 0) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('folderContentsChanged', {
          directory: targetDirectory,
          newFiles: successfulFiles.map(r => r.path).filter(Boolean)
        });
      }
    }
    return results;
  } catch (error) {
    console.error('Error in move-files-silent handler:', error);
    throw error;
  }
});

// Helper function to generate unique filename with (#) suffix
async function generateUniqueFileName(originalPath: string): Promise<string> {
  const dir = path.dirname(originalPath);
  const ext = path.extname(originalPath);
  const nameWithoutExt = path.basename(originalPath, ext);
  
  let counter = 1;
  let newPath = originalPath;
  
  while (await fileExists(newPath)) {
    const newName = `${nameWithoutExt} (${counter})${ext}`;
    newPath = path.join(dir, newName);
    counter++;
  }
  
  return newPath;
}

// Emit events for maximize/unmaximize
app.on('browser-window-created', (event, win) => {
  win.on('maximize', () => {
    win.webContents.send('window-maximized');
  });
  win.on('unmaximize', () => {
    win.webContents.send('window-unmaximized');
  });
});

ipcMain.on('ondragstart', async (event, files) => {
  try {
    // Convert single file to array for consistent handling
    const filePaths = Array.isArray(files) ? files : [files];
    
    // Filter out any undefined or empty paths
    const validPaths = filePaths.filter(path => path && typeof path === 'string');
    
    if (validPaths.length === 0) {
      throw new Error('No valid file paths provided for drag operation');
    }

    // Get icon for the first file only (as per Electron's drag and drop API)
    let iconPath = '';
    try {
      const firstFilePath = path.isAbsolute(validPaths[0]) ? validPaths[0] : path.join(__dirname, validPaths[0]);
      const icon = await app.getFileIcon(firstFilePath, { size: 'normal' });
      if (icon) {
        const tempIconPath = path.join(__dirname, 'temp-drag-icon.png');
        const iconBuffer = icon.toPNG();
        fs.writeFileSync(tempIconPath, iconBuffer);
        iconPath = tempIconPath;
      }
    } catch (iconError) {
      console.warn('Could not get file icon:', iconError);
      // Continue without icon - Electron will use system default
    }
    
    event.sender.startDrag({
      file: validPaths[0], // Required by Electron's type definition
      files: validPaths,   // The actual array of files to drag
      icon: iconPath || '' // Ensure icon is never undefined
    });
  } catch (error) {
    console.error('Error in drag start:', error);
    // Fallback - still try to drag without icon
    const filePaths = Array.isArray(files) ? files : [files];
    const validPaths = filePaths.filter(path => path && typeof path === 'string');
    
    if (validPaths.length > 0) {
      event.sender.startDrag({
        file: validPaths[0],
        files: validPaths,
        icon: ''
      });
    } else {
      console.error('No valid paths to drag');
    }
  }
});

ipcMain.handle('read-csv', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true, bom: true });
    return records;
  } catch (err) {
    console.error('Failed to read CSV:', err);
    return [];
  }
});

// Add PDF text reading handler
ipcMain.handle('read-pdf-text', async (_, filePath: string) => {
  try {
    console.log(`Reading PDF text from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file not found');
    }

    // Create a new PDFParser instance
    const pdfParser = new PDFParser();
    
    // Read the PDF file
    const pdfBuffer = fs.readFileSync(filePath);
    
    // Parse the PDF
    const pdfData = await new Promise<PDFData>((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData as PDFData);
      });
      
      pdfParser.on('pdfParser_dataError', (error) => {
        reject(error);
      });
      
      pdfParser.parseBuffer(pdfBuffer);
    });
    
    // Extract text from all pages
    let extractedText = '';
    if (pdfData && pdfData.Pages) {
      for (const page of pdfData.Pages) {
        if (page.Texts) {
          for (const text of page.Texts) {
            if (text.R && text.R[0] && text.R[0].T) {
              extractedText += decodeURIComponent(text.R[0].T) + ' ';
            }
          }
        }
      }
    }

    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/\s+/g, ' ')  // Normalize spaces
      .trim();

    // If no text was extracted or it's too short, return a message
    if (!extractedText || extractedText.length < 50) {
      return 'No readable text could be extracted from this PDF. The file might be scanned or contain only images.';
    }

    return extractedText;
  } catch (error) {
    console.error('Error reading PDF text:', error);
    throw error;
  }
});

// Read PDF text by page
ipcMain.handle('read-pdf-pages-text', async (_, filePath: string) => {
  try {
    console.log(`Reading PDF page text from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file not found');
    }

    const pdfParser = new PDFParser();
    const pdfBuffer = fs.readFileSync(filePath);

    const pdfData = await new Promise<PDFData>((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData as PDFData);
      });

      pdfParser.on('pdfParser_dataError', (error) => {
        reject(error);
      });

      pdfParser.parseBuffer(pdfBuffer);
    });

    const pagesText: string[] = [];
    if (pdfData && pdfData.Pages) {
      for (const page of pdfData.Pages) {
        let pageText = '';
        if (page.Texts) {
          for (const text of page.Texts) {
            if (text.R && text.R[0] && text.R[0].T) {
              pageText += decodeURIComponent(text.R[0].T) + ' ';
            }
          }
        }
        pageText = pageText
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s+/g, ' ')
          .trim();
        pagesText.push(pageText);
      }
    }

    return pagesText;
  } catch (error) {
    console.error('Error reading PDF pages text:', error);
    throw error;
  }
});

// Add PDF page counting handler
ipcMain.handle('get-pdf-page-count', async (_, filePath: string) => {
  try {
    console.log(`Getting PDF page count from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file not found');
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(filePath);
    
    // Load the PDF document using pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Get the page count
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`PDF has ${pageCount} pages`);
    return { success: true, pageCount };
    
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return { success: false, error: error.message, pageCount: 0 };
  }
});

ipcMain.handle('read-file-as-buffer', async (_, filePath: string) => {
  try {
    console.log(`Reading file as buffer from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    // Read the file as a buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Convert to ArrayBuffer for the renderer process
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    
    return arrayBuffer;
  } catch (error) {
    console.error('Error reading file as buffer:', error);
    throw error;
  }
});

ipcMain.handle('load-yaml-template', async (event, filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
});

// File operations for template management
ipcMain.handle('read-text-file', async (_, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading text file:', error);
    throw error;
  }
});

ipcMain.handle('write-text-file', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing text file:', error);
    throw error;
  }
});

ipcMain.handle('delete-file', async (_, filePath: string) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
});

// Save image from clipboard
ipcMain.handle('save-image-from-clipboard', async (_, currentDirectory: string, filename: string, base64Data: string) => {
  try {
    // Ensure the filename has .png extension
    const finalFilename = filename.endsWith('.png') ? filename : filename + '.png';
    const filePath = path.join(currentDirectory, finalFilename);
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return { 
        success: false, 
        error: `File "${finalFilename}" already exists. Please choose a different name.` 
      };
    }
    
    // Convert base64 to buffer and save
    const imageBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, imageBuffer);
    
    console.log(`[Main] Saved image to: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving image from clipboard:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred while saving image' 
    };
  }
});

// Write files that were dropped without a filesystem path (e.g. emails/attachments
// dragged from "new" Outlook arrive as in-memory virtual files). Bytes come over as base64.
ipcMain.handle(
  'write-dropped-files',
  async (_, targetDirectory: string, files: Array<{ name: string; dataBase64: string }>) => {
    const results: Array<{ name: string; status: 'success' | 'error'; path?: string; error?: string }> = [];
    for (const file of files || []) {
      try {
        const rawName = file.name || 'dropped-file';
        const safeName = rawName.replace(/[<>:"/\\|?*]/g, '_');
        // Resolve a non-colliding path (append _1, _2, …) — mirrors extractEml's naming.
        let targetPath = path.join(targetDirectory, safeName);
        let counter = 1;
        while (fs.existsSync(targetPath)) {
          const ext = path.extname(safeName);
          const base = path.basename(safeName, ext);
          targetPath = path.join(targetDirectory, `${base}_${counter}${ext}`);
          counter++;
        }
        fs.writeFileSync(targetPath, Buffer.from(file.dataBase64, 'base64'));
        results.push({ name: path.basename(targetPath), status: 'success', path: targetPath });
      } catch (error) {
        results.push({
          name: file?.name || 'dropped-file',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    const successfulPaths = results.filter(r => r.status === 'success').map(r => r.path!).filter(Boolean);
    if (successfulPaths.length > 0) {
      const win = BrowserWindow.getAllWindows()[0];
      win?.webContents.send('folderContentsChanged', { directory: targetDirectory, newFiles: successfulPaths });
    }
    return results;
  }
);

// Extract attachments from a mix of email sources (on-disk .eml paths and/or base64-encoded
// virtual emails dragged from Outlook). The emails themselves are not saved.
ipcMain.handle('extract-eml-sources', async (_, targetDirectory: string, sources: EmlSource[]) => {
  const result = await extractEmlSources(targetDirectory, sources || []);
  if (result.extractedFiles.length > 0) {
    const win = BrowserWindow.getAllWindows()[0];
    win?.webContents.send('folderContentsChanged', { directory: targetDirectory, newFiles: result.extractedFiles });
  }
  return result;
});

// Update-related IPC handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    autoUpdaterService.checkForUpdates();
    return { success: true, message: 'Update check initiated' };
  } catch (error) {
    console.error('Error checking for updates:', error);
    throw error;
  }
});

// Show file/folder properties
ipcMain.handle('show-properties', async (_, filePath: string) => {
  try {
    if (process.platform === 'win32') {
      // Use rundll32.exe to directly call Shell32 Properties function
      const { spawn } = require('child_process');
      
      // This is the most direct way to open Windows Properties without shell/cmd/powershell
      // rundll32.exe is a Windows built-in utility that directly calls DLL functions
      spawn('rundll32.exe', ['shell32.dll,SHObjectProperties', filePath], {
        detached: true,
        stdio: 'ignore'
      });
      
    } else if (process.platform === 'darwin') {
      // macOS: Use open command to show file info
      const { spawn } = require('child_process');
      spawn('open', ['-R', filePath], {
        detached: true,
        stdio: 'ignore'
      });
    } else {
      // Linux: Use file manager properties if available
      const { spawn } = require('child_process');
      spawn('nautilus', ['--properties', filePath], {
        detached: true,
        stdio: 'ignore'
      }).on('error', () => {
        // Fallback to xdg-open if nautilus is not available
        spawn('xdg-open', [filePath], {
          detached: true,
          stdio: 'ignore'
        });
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error showing properties:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('quit-and-install', async () => {
  try {
    autoUpdaterService.quitAndInstall();
    return { success: true };
  } catch (error) {
    console.error('Error quitting and installing update:', error);
    throw error;
  }
});

ipcMain.handle('get-file-stats', async (_, filePath: string) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
      atime: stats.atime,
      birthtime: stats.birthtime,
      readonly: !(stats.mode & 0o200), // owner-write bit clear → read-only
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (err) {
    return { size: 0, mtime: '', ctime: '', atime: '', birthtime: '', readonly: false, isFile: false, isDirectory: false };
  }
});

ipcMain.handle('is-file-blocked', async (_, filePath: string) => {
  if (process.platform !== 'win32') return false;
  try {
    // Check for Zone.Identifier ADS
    fs.accessSync(filePath + ':Zone.Identifier');
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('unblock-file', async (_, filePath: string) => {
  if (process.platform !== 'win32') return false;
  try {
    fs.unlinkSync(filePath + ':Zone.Identifier');
    return true;
  } catch (err) {
    // If already unblocked, that's fine
    if (err.code === 'ENOENT') return true;
    throw err;
  }
});

// Calculator window management
let calculatorWindow: BrowserWindow | null = null;

const createCalculatorWindow = () => {
  // If calculator window already exists, focus it instead of creating a new one
  if (calculatorWindow && !calculatorWindow.isDestroyed()) {
    calculatorWindow.focus();
    return;
  }

  calculatorWindow = new BrowserWindow({
    width: 480,
    height: 448,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
    skipTaskbar: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    focusable: true,
    movable: true,
    title: 'Calculator',
    icon: process.env.NODE_ENV === 'development' 
      ? path.join(__dirname, '../public/256.ico')
      : path.join(__dirname, '../public/256.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Set window position to center of screen
  calculatorWindow.center();

  // Load the calculator HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    calculatorWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/calculator.html`);
  } else {
    calculatorWindow.loadFile(path.join(__dirname, '../dist/calculator.html'));
  }

  // Handle window closed
  calculatorWindow.on('closed', () => {
    calculatorWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    // calculatorWindow.webContents.openDevTools();
  }
};

// IPC handlers for calculator
ipcMain.handle('open-calculator', async () => {
  createCalculatorWindow();
  return { success: true };
});

ipcMain.handle('close-calculator', async () => {
  if (calculatorWindow && !calculatorWindow.isDestroyed()) {
    calculatorWindow.close();
  }
  return { success: true };
});

// Path paste overlay window management
const createPathOverlayWindow = (directoryPath: string, irdNumber: string | null = null) => {
  // If overlay window already exists, update it
  if (pathOverlayWindow && !pathOverlayWindow.isDestroyed()) {
    console.log('[Main] Overlay window already exists, updating path');
    pathOverlayWindow.webContents.send('update-path-data', { path: directoryPath, irdNumber });
    pathOverlayWindow.show();
    return;
  }
  
  const { screen } = require('electron');
  
  // Get the screen where the cursor is (active screen)
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const workArea = activeDisplay.workArea;
  
  // Calculate center position on active screen
  const windowWidth = 600;
  const windowHeight = 140;
  const centerX = workArea.x + Math.floor((workArea.width - windowWidth) / 2);
  const centerY = workArea.y + Math.floor((workArea.height - windowHeight) / 2);

  // Create independent window (no parent/modal) - similar to floating timer window
  pathOverlayWindow = new BrowserWindow({
    x: centerX,
    y: centerY,
    width: windowWidth,
    height: windowHeight,
    show: false,
    resizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: true,
    movable: false,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'Path Paste Overlay',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load the overlay HTML
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    pathOverlayWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/path-overlay.html`);
  } else {
    pathOverlayWindow.loadFile(path.join(__dirname, '../dist/path-overlay.html'));
  }

  // Send initial path and IRD after load
  pathOverlayWindow.webContents.once('did-finish-load', () => {
    pathOverlayWindow?.webContents.send('update-path-data', { path: directoryPath, irdNumber });
  });

  // Show window when ready (like floating timer window pattern)
  pathOverlayWindow.once('ready-to-show', () => {
    // Re-apply position to ensure it's correct (sometimes needed for multi-monitor)
    pathOverlayWindow?.setPosition(centerX, centerY);
    pathOverlayWindow?.show();
  });

  // Handle window closed
  pathOverlayWindow.on('closed', () => {
    pathOverlayWindow = null;
  });

  // Make window clickable (don't ignore mouse events so buttons work)
  pathOverlayWindow.setIgnoreMouseEvents(false);
};

// IPC handler for selecting which value to paste
ipcMain.handle('select-paste-value', async (_, value: string) => {
  try {
    clipboard.writeText(value);
    console.log('[Main] Selected value copied to clipboard:', value);
    performPasteAction();
    closePathOverlayWindow();
    return { success: true };
  } catch (error) {
    console.error('[Main] Error selecting paste value:', error);
    return { success: false, error: error.message };
  }
});

const closePathOverlayWindow = () => {
  if (pathOverlayWindow && !pathOverlayWindow.isDestroyed()) {
    pathOverlayWindow.destroy();
    pathOverlayWindow = null;
  }
  // Reset flag immediately - keyup detection handles preventing re-trigger
  isPathPasteActive = false;
};

// IPC handler to get current directory
ipcMain.handle('get-current-directory', async () => {
  return currentDirectoryPath;
});

// IPC handler for directory change notifications
ipcMain.on('current-directory-changed', (_, directory: string) => {
  currentDirectoryPath = directory || '';
  console.log('[Main] Current directory updated:', currentDirectoryPath);
});


// New window creation for tab drag-out functionality
ipcMain.handle('open-new-window', async (_, initialPath?: string) => {
  try {
    console.log('[Main] Creating new window with initial path:', initialPath);
    
    // Create a new window using the same configuration as the main window
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1200,
      minHeight: 800,
      frame: false,
      titleBarStyle: 'hidden',
      icon: process.env.NODE_ENV === 'development' 
        ? path.join(__dirname, '../public/256.ico')
        : path.join(__dirname, '../public/256.ico'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Enable drag and drop for files
    newWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://')) {
        event.preventDefault();
      }
    });

    // Intercept window.open and open external URLs in the default browser
    newWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('file://')) {
        return { action: 'allow' };
      }
      // Allow OAuth popup windows for authentication (Xero, etc.)
      if (url.includes('login.xero.com') || url.includes('oauth') || url.includes('auth')) {
        return { action: 'allow' };
      }
      // Open all other external URLs in the default browser
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Load the index.html of the app
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      let url = MAIN_WINDOW_VITE_DEV_SERVER_URL;
      if (initialPath) {
        // Pass the initial path as a URL parameter
        url += `?initialPath=${encodeURIComponent(initialPath)}`;
      }
      newWindow.loadURL(url);
    } else {
      const indexPath = path.join(__dirname, '../dist/index.html');
      if (initialPath) {
        // For production, we'll need to send the initial path after the window loads
        newWindow.loadFile(indexPath);
        newWindow.webContents.once('did-finish-load', () => {
          newWindow.webContents.send('set-initial-path', initialPath);
        });
      } else {
        newWindow.loadFile(indexPath);
      }
    }

    // Position the new window slightly offset from the main window
    const [x, y] = newWindow.getPosition();
    newWindow.setPosition(x + 30, y + 30);

    console.log('[Main] New window created successfully');
    return { success: true };
  } catch (error) {
    console.error('[Main] Error creating new window:', error);
    throw error;
  }
});

// File system watcher IPC handlers
ipcMain.handle('start-watching-directory', async (_, dirPath: string) => {
  try {
    if (!isWatchingEnabled) {
      console.log('[FileWatcher] Watching is disabled');
      return { success: false, message: 'File watching is disabled' };
    }

    startWatchingDirectory(dirPath);
    return { 
      success: true, 
      message: `Started watching directory: ${dirPath}`,
      watchedDirectories: getWatchedDirectories()
    };
  } catch (error) {
    console.error('[FileWatcher] Error starting directory watch:', error);
    throw error;
  }
});

ipcMain.handle('stop-watching-directory', async (_, dirPath: string) => {
  try {
    stopWatchingDirectory(dirPath);
    return { 
      success: true, 
      message: `Stopped watching directory: ${dirPath}`,
      watchedDirectories: getWatchedDirectories()
    };
  } catch (error) {
    console.error('[FileWatcher] Error stopping directory watch:', error);
    throw error;
  }
});

ipcMain.handle('get-watched-directories', async () => {
  try {
    return {
      success: true,
      directories: getWatchedDirectories(),
      isEnabled: isWatchingEnabled
    };
  } catch (error) {
    console.error('[FileWatcher] Error getting watched directories:', error);
    throw error;
  }
});

ipcMain.handle('enable-file-watching', async (_, enabled: boolean) => {
  try {
    isWatchingEnabled = enabled;
    if (!enabled) {
      stopAllWatchers();
    }
    return { 
      success: true, 
      message: `File watching ${enabled ? 'enabled' : 'disabled'}`,
      isEnabled: isWatchingEnabled
    };
  } catch (error) {
    console.error('[FileWatcher] Error toggling file watching:', error);
    throw error;
  }
});

// Document creation IPC handlers
ipcMain.handle('create-text-file', async (_, filePath: string) => {
  try {
    writeFileSync(filePath, '', 'utf8');
    console.log(`[Main] Created text file: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('[Main] Error creating text file:', error);
    throw error;
  }
});

ipcMain.handle('create-blank-spreadsheet', async (_, filePath: string) => {
  try {
    // Import ExcelJS dynamically to avoid issues with Electron
    const ExcelJS = require('exceljs');
    
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Add a worksheet
    const worksheet = workbook.addWorksheet('Sheet1');
    
    // Set some basic properties
    worksheet.properties.defaultRowHeight = 15;
    worksheet.properties.defaultColWidth = 10;
    
    // Write the workbook to file
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`[Main] Created blank spreadsheet: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('[Main] Error creating blank spreadsheet:', error);
    throw error;
  }
});

ipcMain.handle('create-word-document', async (_, filePath: string) => {
  try {
    // Import docx dynamically to avoid issues with Electron
    const { Document, Packer, Paragraph, TextRun } = require('docx');
    
    // Create a new document with proper TextRun usage
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "New Document",
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "",
              }),
            ],
          }),
        ],
      }],
    });
    
    // Generate the document
    const buffer = await Packer.toBuffer(doc);
    
    // Write the buffer to file
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[Main] Created Word document: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error('[Main] Error creating Word document:', error);
    throw error;
  }
});

ipcMain.handle('create-from-template', async (_, templateName: string, filePath: string) => {
  try {
    // Get the workpaper template folder path from settings
    const config = await loadConfig();
    const workpaperTemplateFolderPath = config.workpaperTemplateFolderPath || path.join(app.getPath('documents'), 'templates');
    
    // Ensure template folder exists
    if (!fs.existsSync(workpaperTemplateFolderPath)) {
      fs.mkdirSync(workpaperTemplateFolderPath, { recursive: true });
    }
    
    const templatePath = path.join(workpaperTemplateFolderPath, `${templateName}.xlsx`);
    
    if (fs.existsSync(templatePath)) {
      // Copy template to new location
      fs.copyFileSync(templatePath, filePath);
      console.log(`[Main] Created file from template: ${filePath}`);
      return { success: true, filePath };
    } else {
      throw new Error(`Template not found: ${templateName}`);
    }
  } catch (error) {
    console.error('[Main] Error creating from template:', error);
    throw error;
  }
});

ipcMain.handle('get-templates', async () => {
  try {
    const config = await loadConfig();
    const workpaperTemplateFolderPath = config.workpaperTemplateFolderPath || path.join(app.getPath('documents'), 'templates');
    
    // Ensure template folder exists
    if (!fs.existsSync(workpaperTemplateFolderPath)) {
      fs.mkdirSync(workpaperTemplateFolderPath, { recursive: true });
    }
    
    const files = fs.readdirSync(workpaperTemplateFolderPath);
    const templates = files
      .filter(file => file.endsWith('.xlsx'))
      .map(file => ({
        name: path.basename(file, '.xlsx'),
        path: path.join(workpaperTemplateFolderPath, file)
      }));
    
    return { success: true, templates };
  } catch (error) {
    console.error('[Main] Error getting templates:', error);
    throw error;
  }
});

ipcMain.handle('get-workpaper-templates', async () => {
  try {
    const config = await loadConfig();
    const workpaperTemplateFolderPath = config.workpaperTemplateFolderPath || path.join(app.getPath('documents'), 'templates');
    
    // Ensure template folder exists
    if (!fs.existsSync(workpaperTemplateFolderPath)) {
      fs.mkdirSync(workpaperTemplateFolderPath, { recursive: true });
    }
    
    const files = fs.readdirSync(workpaperTemplateFolderPath);
    const templates = files
      .filter(file => {
        if (file.startsWith('.')) return false;
        const fullPath = path.join(workpaperTemplateFolderPath, file);
        return fs.statSync(fullPath).isFile();
      })
      .map(file => ({
        name: path.basename(file),
        path: path.join(workpaperTemplateFolderPath, file)
      }));

    return { success: true, templates };
  } catch (error) {
    console.error('[Main] Error getting workpaper templates:', error);
    throw error;
  }
});

ipcMain.handle('copy-workpaper-template', async (_, templatePath: string, destPath: string) => {
  try {
    // Copy template to new location
    fs.copyFileSync(templatePath, destPath);
    console.log(`[Main] Copied workpaper template: ${templatePath} -> ${destPath}`);
    return { success: true, destPath };
  } catch (error) {
    console.error('[Main] Error copying workpaper template:', error);
    throw error;
  }
});

// Search in documents (CSV, TXT, PDF files)
ipcMain.handle('search-in-documents', async (_, options: { query: string; currentDirectory: string; maxResults?: number }) => {
  try {
    const { query, currentDirectory, maxResults = 20 } = options;
    console.log('[Search] Searching in documents for:', query, 'in:', currentDirectory);
    
    const results: any[] = [];
    const searchPath = currentDirectory || '';
    
    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    };
    
    // Helper function to extract PDF text
    const extractPdfText = async (filePath: string): Promise<string> => {
      try {
        console.log(`Reading PDF text from: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
          throw new Error('PDF file not found');
        }

        // Create a new PDFParser instance
        const pdfParser = new PDFParser();
        
        // Read the PDF file
        const pdfBuffer = fs.readFileSync(filePath);
        
        // Parse the PDF
        const pdfData = await new Promise<PDFData>((resolve, reject) => {
          pdfParser.on('pdfParser_dataReady', (pdfData) => {
            resolve(pdfData as PDFData);
          });
          
          pdfParser.on('pdfParser_dataError', (error) => {
            reject(error);
          });
          
          pdfParser.parseBuffer(pdfBuffer);
        });
        
        // Extract text from all pages
        let extractedText = '';
        if (pdfData && pdfData.Pages) {
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              for (const text of page.Texts) {
                if (text.R && text.R[0] && text.R[0].T) {
                  extractedText += decodeURIComponent(text.R[0].T) + ' ';
                }
              }
            }
          }
        }

        // Clean up the extracted text
        extractedText = extractedText
          .replace(/\r\n/g, '\n')  // Normalize line endings
          .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
          .replace(/\s+/g, ' ')  // Normalize spaces
          .trim();

        return extractedText;
      } catch (error) {
        console.error('Error reading PDF text:', error);
        throw error;
      }
    };
    
    // Get all document files in the directory and subdirectories
    const getAllDocumentFiles = async (dirPath: string): Promise<string[]> => {
      const files: string[] = [];
      try {
        const items = await fsPromises.readdir(dirPath, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dirPath, item.name);
          if (item.isDirectory()) {
            // Recursively search subdirectories
            const subFiles = await getAllDocumentFiles(fullPath);
            files.push(...subFiles);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (['.pdf', '.csv', '.txt'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
      return files;
    };
    
    const documentFiles = await getAllDocumentFiles(searchPath);
    console.log(`[Search] Found ${documentFiles.length} document files to search`);
    
    // Search in each document file
    for (const filePath of documentFiles) {
      try {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath).toLowerCase();
        const searchQuery = query.toLowerCase();
        let fileContent = '';
        
        // Extract text based on file type
        if (ext === '.pdf') {
          // Use existing PDF text extraction
          try {
            fileContent = await extractPdfText(filePath);
          } catch (pdfError) {
            console.error(`Error extracting PDF text from ${filePath}:`, pdfError);
            // Fallback to filename search
            if (fileName.includes(searchQuery)) {
              const stats = await fsPromises.stat(filePath);
              results.push({
                name: path.basename(filePath),
                type: 'pdf',
                path: filePath,
                size: formatFileSize(stats.size),
                modified: stats.mtime.toISOString()
              });
            }
            continue;
          }
        } else if (ext === '.csv' || ext === '.txt') {
          // Read text files
          try {
            fileContent = await fsPromises.readFile(filePath, 'utf-8');
          } catch (textError) {
            console.error(`Error reading text file ${filePath}:`, textError);
            // Fallback to filename search
            if (fileName.includes(searchQuery)) {
              const stats = await fsPromises.stat(filePath);
              results.push({
                name: path.basename(filePath),
                type: ext === '.csv' ? 'document' : 'document',
                path: filePath,
                size: formatFileSize(stats.size),
                modified: stats.mtime.toISOString()
              });
            }
            continue;
          }
        }
        
        // Search in file content
        if (fileContent.toLowerCase().includes(searchQuery)) {
          const stats = await fsPromises.stat(filePath);
          results.push({
            name: path.basename(filePath),
            type: ext === '.pdf' ? 'pdf' : 'document',
            path: filePath,
            size: formatFileSize(stats.size),
            modified: stats.mtime.toISOString()
          });
          
          if (results.length >= maxResults) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error searching in document ${filePath}:`, error);
        // Continue with other files
      }
    }
    
    console.log(`[Search] Found ${results.length} documents containing "${query}"`);
    return results;
  } catch (error) {
    console.error('[Search] Error searching in documents:', error);
    return [];
  }
});

// Search files by name
ipcMain.handle('search-files', async (_, options: { query: string; searchPath: string; maxResults?: number; includeFiles?: boolean; includeFolders?: boolean; recursive?: boolean }) => {
  try {
    const { query, searchPath, maxResults = 20, includeFiles = true, includeFolders = true, recursive = true } = options;
    console.log('[Search] Searching files for:', query, 'in:', searchPath);
    
    const results: any[] = [];
    const searchDir = searchPath || '';
    
    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    };
    
    // Helper function to get file type
    const getFileType = (filename: string): string => {
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.pdf') return 'pdf';
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) return 'image';
      if (['.doc', '.docx', '.txt', '.rtf'].includes(ext)) return 'document';
      return 'file';
    };
    
    // Get all files and folders in the directory
    const getAllItems = async (dirPath: string): Promise<string[]> => {
      const items: string[] = [];
      try {
        const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            if (includeFolders) {
              items.push(fullPath);
            }
            if (recursive) {
              const subItems = await getAllItems(fullPath);
              items.push(...subItems);
            }
          } else if (entry.isFile() && includeFiles) {
            items.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
      return items;
    };
    
    const allItems = await getAllItems(searchDir);
    console.log(`[Search] Found ${allItems.length} items to search`);
    
    // Filter items by query
    const normalizedQuery = query.toLowerCase();
    for (const itemPath of allItems) {
      try {
        const stats = await fsPromises.stat(itemPath);
        const itemName = path.basename(itemPath);
        const isDirectory = stats.isDirectory();
        
        // Check if name matches query
        if (itemName.toLowerCase().includes(normalizedQuery)) {
          const relativePath = path.relative(searchDir, itemPath);
          
          results.push({
            name: itemName,
            type: isDirectory ? 'folder' : getFileType(itemName),
            path: itemPath,
            size: isDirectory ? undefined : formatFileSize(stats.size),
            modified: stats.mtime.toISOString()
          });
          
          if (results.length >= maxResults) {
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing item ${itemPath}:`, error);
      }
    }
    
    // Sort results: folders first, then by name
    results.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.log(`[Search] Found ${results.length} items matching "${query}"`);
    return results;
  } catch (error) {
    console.error('[Search] Error searching files:', error);
    return [];
  }
});

// ─── File tools: clipboard files, zip, PDF convert/split, open-with ─────────

const execFileAsync = promisify(execFile);

/** Runs Windows PowerShell 5.1 (NOT pwsh — Set-Clipboard -LiteralPath needs 5.1). */
async function runPowerShell(command: string, timeoutMs = 120000): Promise<void> {
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { windowsHide: true, timeout: timeoutMs }
  );
}

/** Escape a path for embedding in a single-quoted PowerShell string literal. */
function psQuote(p: string): string {
  return `'${p.replace(/'/g, "''")}'`;
}

function uniqueOutputPath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName} (${n})${ext}`);
    n++;
  }
  return candidate;
}

// Put real files on the Windows clipboard (CF_HDROP) so they paste into Outlook/Teams/Explorer
ipcMain.handle('copy-files-to-clipboard', async (_, filePaths: string[]) => {
  try {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Only supported on Windows' };
    }
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { success: false, error: 'No files provided' };
    }
    const quoted = filePaths.map(psQuote).join(', ');
    await runPowerShell(`Set-Clipboard -LiteralPath ${quoted}`, 30000);
    return { success: true };
  } catch (error) {
    console.error('[copy-files-to-clipboard] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('zip-selection', async (_, filePaths: string[], outputPath: string) => {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { success: false, error: 'No files provided' };
    }
    let target = outputPath;
    if (!target.toLowerCase().endsWith('.zip')) target += '.zip';
    const quoted = filePaths.map(psQuote).join(', ');
    await runPowerShell(`Compress-Archive -LiteralPath ${quoted} -DestinationPath ${psQuote(target)}`, 300000);
    return { success: true, outputName: path.basename(target) };
  } catch (error) {
    console.error('[zip-selection] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Convert Word/Excel documents to PDF via Office COM automation (requires desktop Office)
ipcMain.handle('convert-file-to-pdf', async (_, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }
    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);
    const stem = path.basename(filePath, path.extname(filePath));
    const outputPath = uniqueOutputPath(dir, stem, '.pdf');
    const src = psQuote(filePath);
    const out = psQuote(outputPath);

    let script: string;
    if (ext === '.doc' || ext === '.docx') {
      script = [
        `$ErrorActionPreference = 'Stop'`,
        `$word = New-Object -ComObject Word.Application`,
        `$word.Visible = $false`,
        `$word.DisplayAlerts = 0`,
        `try {`,
        `  $doc = $word.Documents.Open(${src}, $false, $true)`,
        `  $doc.ExportAsFixedFormat(${out}, 17)`,
        `  $doc.Close($false)`,
        `} finally {`,
        `  $word.Quit()`,
        `  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null`,
        `}`,
      ].join('\n');
    } else if (['.xls', '.xlsx', '.xlsm', '.csv'].includes(ext)) {
      script = [
        `$ErrorActionPreference = 'Stop'`,
        `$excel = New-Object -ComObject Excel.Application`,
        `$excel.Visible = $false`,
        `$excel.DisplayAlerts = $false`,
        `try {`,
        `  $wb = $excel.Workbooks.Open(${src}, 0, $true)`,
        `  foreach ($ws in $wb.Worksheets) {`,
        `    $ws.Columns.AutoFit()`,
        `    $used = $ws.UsedRange`,
        `    $colCount = 0`,
        `    if ($used -ne $null) { $colCount = $used.Columns.Count }`,
        `    if ($colCount -le 5) { $ws.PageSetup.Orientation = 1 }`,
        `    else { $ws.PageSetup.Orientation = 2 }`,
        `    $ws.PageSetup.Zoom = $false`,
        `    $ws.PageSetup.FitToPagesWide = 1`,
        `    $ws.PageSetup.FitToPagesTall = 999`,
        `    $ws.PageSetup.LeftMargin = $excel.InchesToPoints(0.5)`,
        `    $ws.PageSetup.RightMargin = $excel.InchesToPoints(0.5)`,
        `    $ws.PageSetup.TopMargin = $excel.InchesToPoints(0.5)`,
        `    $ws.PageSetup.BottomMargin = $excel.InchesToPoints(0.5)`,
        `  }`,
        `  $wb.ExportAsFixedFormat(0, ${out})`,
        `  $wb.Close($false)`,
        `} finally {`,
        `  $excel.Quit()`,
        `  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null`,
        `}`,
      ].join('\n');
    } else {
      return { success: false, error: `Cannot convert ${ext || 'this'} files to PDF` };
    }

    await runPowerShell(script, 180000);
    if (!fs.existsSync(outputPath)) {
      return { success: false, error: 'Conversion produced no output — is Microsoft Office installed?' };
    }
    return { success: true, outputName: path.basename(outputPath) };
  } catch (error) {
    console.error('[convert-file-to-pdf] failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    const friendly = /80040154|REGDB_E_CLASSNOTREG|New-Object/i.test(message)
      ? 'Microsoft Office is not available on this machine.'
      : message;
    return { success: false, error: friendly };
  }
});

/** Sanitize a user-provided split output base name (no extension). */
function sanitizeSplitOutputName(raw: string, fallback: string): string {
  let s = (raw || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s) s = fallback;
  if (s.length > 150) s = s.slice(0, 150).trim();
  return s;
}

// Split a PDF. Two option shapes:
//  - { segments: [{ pages: [1-based...], name }] } — explicit pages + custom output names (thumbnail dialog)
//  - legacy { mode: 'singles' | 'ranges', ranges? } — kept for compatibility
ipcMain.handle('split-pdf', async (
  _,
  filePath: string,
  options:
    | { mode: 'singles' | 'ranges'; ranges?: string }
    | { segments: Array<{ pages: number[]; name: string }> }
) => {
  try {
    const buf = await fsPromises.readFile(filePath);
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pageCount = src.getPageCount();
    const dir = path.dirname(filePath);
    const stem = path.basename(filePath, path.extname(filePath));
    const outputs: string[] = [];

    const writePagesNamed = async (pageIndexes: number[], baseName: string) => {
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pageIndexes);
      copied.forEach((p) => out.addPage(p));
      const bytes = await out.save();
      const outPath = uniqueOutputPath(dir, baseName, '.pdf');
      await fsPromises.writeFile(outPath, bytes);
      outputs.push(path.basename(outPath));
    };
    const writePages = (pageIndexes: number[], label: string) => writePagesNamed(pageIndexes, `${stem} - ${label}`);

    if ('segments' in options && Array.isArray(options.segments)) {
      if (options.segments.length === 0) {
        return { success: false, error: 'No pages selected' };
      }
      for (let i = 0; i < options.segments.length; i++) {
        const seg = options.segments[i];
        if (!Array.isArray(seg?.pages) || seg.pages.length === 0) {
          return { success: false, error: `Output ${i + 1} has no pages` };
        }
        const pages = seg.pages.map((p) => Math.trunc(p));
        if (pages.some((p) => !Number.isFinite(p) || p < 1 || p > pageCount)) {
          return { success: false, error: `Output ${i + 1} references pages outside 1–${pageCount}` };
        }
        const name = sanitizeSplitOutputName(seg.name, `${stem} - Part ${i + 1}`);
        await writePagesNamed(pages.map((p) => p - 1), name);
      }
      return { success: true, outputFiles: outputs };
    }

    const legacy = options as { mode: 'singles' | 'ranges'; ranges?: string };
    if (legacy.mode === 'singles') {
      for (let i = 0; i < pageCount; i++) {
        await writePages([i], `Page ${i + 1}`);
      }
    } else {
      const segments = (legacy.ranges || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (segments.length === 0) {
        return { success: false, error: 'No page ranges given' };
      }
      for (const seg of segments) {
        const m = seg.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!m) {
          return { success: false, error: `Invalid range: "${seg}"` };
        }
        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : start;
        if (start < 1 || end > pageCount || start > end) {
          return { success: false, error: `Range "${seg}" is out of bounds (document has ${pageCount} page${pageCount === 1 ? '' : 's'})` };
        }
        const pageIndexes: number[] = [];
        for (let p = start; p <= end; p++) pageIndexes.push(p - 1);
        await writePages(pageIndexes, start === end ? `Page ${start}` : `Pages ${start}-${end}`);
      }
    }
    return { success: true, outputFiles: outputs };
  } catch (error) {
    console.error('[split-pdf] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Edit a PDF: rebuild it with the given 1-based pages in the given order (reorder/delete).
// outputName === original stem → overwrite in place (original backed up to temp for undo);
// otherwise a new file is written next to the original.
ipcMain.handle('edit-pdf', async (_, filePath: string, options: { pages: number[]; outputName: string }) => {
  try {
    const buf = await fsPromises.readFile(filePath);
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pageCount = src.getPageCount();
    const dir = path.dirname(filePath);
    const stem = path.basename(filePath, path.extname(filePath));

    if (!Array.isArray(options?.pages) || options.pages.length === 0) {
      return { success: false, error: 'No pages left — a PDF needs at least one page' };
    }
    const pages = options.pages.map((p) => Math.trunc(p));
    if (pages.some((p) => !Number.isFinite(p) || p < 1 || p > pageCount)) {
      return { success: false, error: `Pages outside 1–${pageCount}` };
    }

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pages.map((p) => p - 1));
    copied.forEach((p) => out.addPage(p));
    const bytes = await out.save();

    const name = sanitizeSplitOutputName(options.outputName, stem);
    const overwrite = name.toLowerCase() === stem.toLowerCase();
    if (overwrite) {
      const backupDir = path.join(app.getPath('temp'), 'docuframe-pdf-backups');
      await fsPromises.mkdir(backupDir, { recursive: true });
      const backupPath = path.join(backupDir, `${stem}-${Date.now()}.pdf`);
      await fsPromises.copyFile(filePath, backupPath);
      await fsPromises.writeFile(filePath, bytes);
      return { success: true, outputFile: path.basename(filePath), overwritten: true, backupPath };
    }
    const outPath = uniqueOutputPath(dir, name, '.pdf');
    await fsPromises.writeFile(outPath, bytes);
    return { success: true, outputFile: path.basename(outPath), overwritten: false };
  } catch (error) {
    console.error('[edit-pdf] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Restore a file from a backup created by edit-pdf (undo support)
ipcMain.handle('restore-file-backup', async (_, backupPath: string, targetPath: string) => {
  try {
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: 'Backup no longer exists' };
    }
    await fsPromises.copyFile(backupPath, targetPath);
    return { success: true };
  } catch (error) {
    console.error('[restore-file-backup] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('open-file-with', async (_, filePath: string, appId: string) => {
  try {
    // Windows shell APIs (esp. OpenAs_RunDLL) require native backslash paths; the app stores forward slashes.
    const winPath = filePath.replace(/\//g, '\\');
    switch (appId) {
      case 'excel':
        spawn('cmd.exe', ['/c', 'start', '', 'excel', winPath], { detached: true, stdio: 'ignore', windowsHide: true });
        break;
      case 'word':
        spawn('cmd.exe', ['/c', 'start', '', 'winword', winPath], { detached: true, stdio: 'ignore', windowsHide: true });
        break;
      case 'notepad':
        spawn('notepad.exe', [winPath], { detached: true, stdio: 'ignore' });
        break;
      case 'default': {
        const result = await shell.openPath(winPath);
        if (result) return { success: false, error: result };
        break;
      }
      case 'openas':
        spawn('rundll32.exe', ['shell32.dll,OpenAs_RunDLL', winPath], { detached: true, stdio: 'ignore' });
        break;
      default:
        return { success: false, error: `Unknown app: ${appId}` };
    }
    return { success: true };
  } catch (error) {
    console.error('[open-file-with] failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Settings window state is managed globally above

const createSettingsWindow = () => {
  try {
    // Close existing settings window if open
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }

    settingsWindow = new BrowserWindow({
      width: 700,
      height: 560,
      minWidth: 560,
      minHeight: 420,
      title: 'Settings - DocuFrame',
      icon: path.join(__dirname, '../public/icon.ico'),
      show: false,
      frame: false, // Use custom titlebar like main window
      titleBarStyle: 'hidden',
      roundedCorners: false,
      modal: true, // Make it a true modal window
      parent: mainWindow!, // Make it a child of the main window
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    // Set modal state
    isSettingsWindowOpen = true;

    // Enable drag and drop for files
    settingsWindow.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith('file://')) {
        event.preventDefault();
      }
    });

    // Intercept window.open and open external URLs in the default browser
    settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('file://')) {
        return { action: 'allow' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle settings window close
    settingsWindow.on('closed', () => {
      isSettingsWindowOpen = false;
      settingsWindow = null;
    });

    // Load the settings window
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      settingsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#settings`);
    } else {
      settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
    }

    // Show window when ready
    settingsWindow.once('ready-to-show', () => {
      settingsWindow?.show();
      settingsWindow?.focus();
    });

    console.log('[Main] Settings window created successfully');
    return { success: true };
  } catch (error) {
    console.error('[Main] Error creating settings window:', error);
    throw error;
  }
};

// Add focus prevention logic to main window
const setupModalBehavior = () => {
  if (!mainWindow) return;

  // Handle main window focus attempts when settings is open
  mainWindow.on('focus', () => {
    if (isSettingsWindowOpen && settingsWindow && !settingsWindow.isDestroyed()) {
      // Prevent focus on main window
      settingsWindow.focus();
      
      // Visual feedback - flash the settings window
      settingsWindow.flashFrame(true);
      
      // Stop flashing after 500ms
      setTimeout(() => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.flashFrame(false);
        }
      }, 500);
      
      // Audio feedback - play system beep
      shell.beep();
      
      console.log('[Main] Prevented focus on main window, redirected to settings');
    }
  });

  // Handle main window focus attempts when settings is open
  mainWindow.on('focus', () => {
    if (isSettingsWindowOpen && settingsWindow && !settingsWindow.isDestroyed()) {
      // Prevent focus on main window
      settingsWindow.focus();
      
      // Visual feedback - flash the settings window
      settingsWindow.flashFrame(true);
      
      // Stop flashing after 500ms
      setTimeout(() => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.flashFrame(false);
        }
      }, 500);
      
      // Audio feedback - play system beep
      shell.beep();
      
      console.log('[Main] Prevented focus on main window, redirected to settings');
    }
  });
};

// Settings window IPC handler
ipcMain.handle('open-settings-window', async () => {
  try {
    return await createSettingsWindow();
  } catch (error) {
    console.error('[Main] Error opening settings window:', error);
    throw error;
  }
});





// Convert file path to HTTP URL for PDF viewing
ipcMain.handle('convert-file-path-to-http-url', async (_, filePath: string) => {
  try {
    const httpUrl = convertFilePathToHttpUrl(filePath);
    return { success: true, url: httpUrl };
  } catch (error) {
    console.error('[Main] Error converting file path to HTTP URL:', error);
    return { success: false, error: error.message };
  }
});

// Read image file and convert to data URL (works for files outside Clients directory)
// ---------------------------------------------------------------------------
// Spreadsheet preview (ExcelJS + csv-parse) — returns lightweight JSON for
// the hover-popup table renderer.  Capped at 100 rows × 20 cols.
// ---------------------------------------------------------------------------
ipcMain.handle('read-spreadsheet-preview', async (_, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };

    const stat = fs.statSync(filePath);
    if (stat.size > 20 * 1024 * 1024) return { success: false, error: 'File too large to preview (>20 MB)' };

    const MAX_ROWS = 100;
    const MAX_COLS = 20;
    const ext = path.extname(filePath).toLowerCase();

    /** Safely convert an ExcelJS CellValue to a display string. */
    const cellToString = (v: any): string => {
      if (v == null) return '';
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (v instanceof Date) return v.toLocaleDateString();
      if (typeof v === 'object') {
        if ('result' in v && 'formula' in v) return cellToString(v.result);           // formula
        if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((r: any) => r.text ?? '').join('');
        if ('text' in v) return String(v.text);                                        // hyperlink / error
        if ('error' in v) return String(v.error);
      }
      return String(v);
    };

    if (ext === '.csv') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const records: string[][] = parse(raw, { relax_column_count: true, skip_empty_lines: true });
      const headerRow = records[0] ?? [];
      const cols = headerRow.slice(0, MAX_COLS).map((h) => ({ header: String(h), width: Math.min(Math.max(String(h).length * 8, 50), 200) }));
      const rows = records.slice(1, MAX_ROWS + 1).map((r) => r.slice(0, MAX_COLS).map(String));
      const truncated = records.length - 1 > MAX_ROWS || headerRow.length > MAX_COLS;
      return { success: true, sheets: [{ name: 'CSV', columns: cols, rows }], truncated };
    }

    // xlsx / xls / xlsm
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets: any[] = [];
    let truncated = false;

    workbook.eachSheet((ws: any) => {
      const columns: { header: string; width: number }[] = [];
      const rows: string[][] = [];

      // Build column metadata from first row
      const firstRow = ws.getRow(1);
      const colCount = Math.min(ws.columnCount || 0, MAX_COLS);
      for (let c = 1; c <= colCount; c++) {
        const cell = firstRow.getCell(c);
        const header = cellToString(cell.value);
        const colWidth = ws.getColumn(c).width;
        columns.push({ header, width: Math.min(Math.max((colWidth ?? header.length) * 8, 50), 200) });
      }

      // Build row data (skip row 1 = header)
      const rowCount = Math.min(ws.rowCount || 0, MAX_ROWS + 1);
      for (let r = 2; r <= rowCount; r++) {
        const row = ws.getRow(r);
        const cells: string[] = [];
        for (let c = 1; c <= colCount; c++) {
          cells.push(cellToString(row.getCell(c).value));
        }
        rows.push(cells);
      }

      if ((ws.rowCount || 0) > MAX_ROWS + 1) truncated = true;
      if ((ws.columnCount || 0) > MAX_COLS) truncated = true;

      sheets.push({ name: ws.name, columns, rows });
    });

    if (sheets.length === 0) return { success: false, error: 'Workbook has no sheets' };
    return { success: true, sheets, truncated };
  } catch (error: any) {
    console.error('[read-spreadsheet-preview]', error);
    return { success: false, error: error?.message ?? String(error) };
  }
});

// ---------------------------------------------------------------------------
// DOCX preview — converts .docx to clean HTML via mammoth
// ---------------------------------------------------------------------------
ipcMain.handle('read-docx-as-html', async (_, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
    const stat = fs.statSync(filePath);
    if (stat.size > 20 * 1024 * 1024) return { success: false, error: 'File too large to preview (>20 MB)' };

    const mammoth = require('mammoth');
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return { success: true, html: result.value as string };
  } catch (error: any) {
    console.error('[read-docx-as-html]', error);
    return { success: false, error: error?.message ?? String(error) };
  }
});

ipcMain.handle('read-image-as-data-url', async (_, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }
    
    // Read the file as buffer
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default
    if (ext === '.png') {
      mimeType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    } else if (ext === '.bmp') {
      mimeType = 'image/bmp';
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === '.ico') {
      mimeType = 'image/x-icon';
    }
    
    // Convert buffer to base64
    const base64 = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    return { success: true, dataUrl };
  } catch (error) {
    console.error('[Main] Error reading image file:', error);
    return { success: false, error: error.message };
  }
});

// Background image management handlers
ipcMain.handle('get-user-data-path', async () => {
  try {
    return { success: true, path: app.getPath('userData') };
  } catch (error) {
    console.error('[Main] Error getting userData path:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('copy-background-image', async (_, sourcePath: string, backgroundType: 'watermark' | 'backgroundFill') => {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    const userDataPath = app.getPath('userData');
    const backgroundsDir = path.join(userDataPath, 'Backgrounds');
    const typeDir = path.join(backgroundsDir, backgroundType);

    // Ensure directories exist
    if (!fs.existsSync(backgroundsDir)) {
      fs.mkdirSync(backgroundsDir, { recursive: true });
    }
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    // Get filename and handle duplicates
    const filename = path.basename(sourcePath);
    let destPath = path.join(typeDir, filename);
    let counter = 1;
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    while (fs.existsSync(destPath)) {
      const newFilename = `${baseName}_${counter}${ext}`;
      destPath = path.join(typeDir, newFilename);
      counter++;
    }

    // Copy file
    fs.copyFileSync(sourcePath, destPath);

    // Return relative path from Backgrounds directory
    const relativePath = path.join(backgroundType, path.basename(destPath)).replace(/\\/g, '/');
    
    return { success: true, path: destPath, relativePath };
  } catch (error) {
    console.error('[Main] Error copying background image:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('list-background-images', async (_, backgroundType: 'watermark' | 'backgroundFill') => {
  try {
    const userDataPath = app.getPath('userData');
    const typeDir = path.join(userDataPath, 'Backgrounds', backgroundType);

    if (!fs.existsSync(typeDir)) {
      return { success: true, images: [] };
    }

    const files = fs.readdirSync(typeDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    const images = imageFiles.map(file => {
      const fullPath = path.join(typeDir, file);
      const relativePath = path.join(backgroundType, file).replace(/\\/g, '/');
      return {
        filename: file,
        path: fullPath,
        relativePath
      };
    });

    return { success: true, images };
  } catch (error) {
    console.error('[Main] Error listing background images:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', images: [] };
  }
});

ipcMain.handle('delete-background-image', async (_, backgroundType: 'watermark' | 'backgroundFill', filename: string) => {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'Backgrounds', backgroundType, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }

    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('[Main] Error deleting background image:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('resolve-background-path', async (_, relativePath: string) => {
  try {
    const userDataPath = app.getPath('userData');
    const fullPath = path.join(userDataPath, 'Backgrounds', relativePath);
    
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File does not exist' };
    }

    return { success: true, path: fullPath };
  } catch (error) {
    console.error('[Main] Error resolving background path:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Note: PDF viewer functionality has been moved to inline preview pane
// The separate PDF viewer window is no longer needed

// Helper function to get PDF page count
const getPdfPageCount = async (filePath: string): Promise<{ success: boolean; pageCount: number; error?: string }> => {
  try {
    console.log(`Getting PDF page count from: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('PDF file not found');
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(filePath);
    
    // Load the PDF document using pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Get the page count
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`PDF has ${pageCount} pages`);
    return { success: true, pageCount };
    
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return { success: false, error: error.message, pageCount: 0 };
  }
};