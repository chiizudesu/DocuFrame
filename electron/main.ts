// main.ts - Updated with IPC handlers
// Set GitHub token for auto-updates (replace with your actual token)
// GH_TOKEN should be set via environment variable or .env file

import { app, BrowserWindow, shell, ipcMain, globalShortcut, Menu, dialog, nativeImage, MenuItem, MenuItemConstructorOptions } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, promises as fsPromises } from 'fs';
import * as fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import PDFParser from 'pdf2json';
import { fileSystemService } from '../src/services/fileSystem';
import type { Config } from '../src/services/config';
import { handleCommand } from '../src/main/commandHandler';
import { transferFiles } from '../src/main/commands/transfer';
const { parse } = require('csv-parse/sync');
import yaml from 'js-yaml';
import { autoUpdaterService } from '../src/main/autoUpdater';
import * as chokidar from 'chokidar';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Config file path
const configPath = path.join(app.getPath('userData'), 'config.json');

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

    // Debounce function to prevent excessive events
    let debounceTimer: NodeJS.Timeout;
    const debouncedRefresh = (event: string, filePath: string) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        // Update last refresh time
        const watched = watchedDirectories.get(dirPath);
        if (watched) {
          watched.lastRefresh = Date.now();
        }

        // Notify all windows about the change
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('folderContentsChanged', { 
            directory: dirPath,
            event: event,
            filePath: filePath,
            newFiles: event === 'add' ? [filePath] : undefined
          });
        });
      }, 1000); // 1 second debounce for better performance
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

// Load or create config
async function loadConfig(): Promise<Config> {
  try {
    const data = await fsPromises.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Create default config if it doesn't exist
    const defaultConfig: Config = {
      rootPath: app.getPath('documents'),
      apiKey: undefined,
      gstTemplatePath: undefined,
      clientbasePath: undefined,
      templateFolderPath: undefined,
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
      aiEditorInstructions: '',
      
    };
    await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

// Save config
async function saveConfig(config: Config) {
  if (!config) {
    throw new Error('Config object is undefined or null');
  }
  
  try {
    const configData = JSON.stringify(config, null, 2);
    if (!configData) {
      throw new Error('Failed to serialize config to JSON');
    }
    
    await fsPromises.writeFile(configPath, configData);
    console.log('[Main] Config saved successfully:', config);
  } catch (error) {
    console.error('[Main] Error in saveConfig:', error);
    throw error;
  }
}

// Track settings window state
let settingsWindow: BrowserWindow | null = null;
let isSettingsWindowOpen = false;
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
  console.log('[Main] Loaded config on window start:', config);
  
  // Initialize Express server for PDF file serving
  initializeExpressServer();
  
  createWindow();
  
  // Register global shortcut for app activation
  await registerGlobalShortcut(config);
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

    
  } catch (error) {
    console.error('[Main] Error registering global shortcut:', error);
  }
}

function convertToElectronShortcut(shortcut: string): string {
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
    const foundMainWindow = windows.find(win => win !== floatingTimerWindow && !win.isDestroyed());
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
  // Stop all file watchers
  stopAllWatchers();
  // Cleanup Express server
  cleanupExpressServer();
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
    console.log('[Main] Received set-config request:', config);
    
    if (!config) {
      throw new Error('Config parameter is undefined or null');
    }
    
    await saveConfig(config);
    console.log('[Main] Config successfully saved and returned');
    return config;
  } catch (error) {
    console.error('Error occurred in handler for \'set-config\':', error);
    throw error;
  }
});

ipcMain.handle('get-directory-contents', async (_, dirPath: string) => {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const results: any[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const stats = await fsPromises.stat(fullPath);
        const fileItem: any = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'folder' : 'file',
          size: stats.size.toString(),
          modified: stats.mtime.toISOString(),
          extension: entry.isFile() ? path.extname(entry.name).toLowerCase().slice(1) : undefined
        };

        // PDF page count calculation removed for performance

        results.push(fileItem);
      } catch (error) {
        // Log and skip busy/locked/inaccessible files
        console.error(`Skipping file (stat error): ${fullPath}`, error);
        continue;
      }
    }
    return results;
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
    } catch (error) {
      // Just return the error, do not attempt any fallback
      console.error('Error renaming item:', error);
      throw error;
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
    return { success: false, error: error.message };
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
        results.push({ file: path.basename(filePath), status: 'error', error: error.message });
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
        results.push({ file: path.basename(filePath), status: 'error', error: error.message });
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
        results.push({ file: path.basename(filePath), status: 'error', error: error.message });
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
        results.push({ file: path.basename(filePath), status: 'error', error: error.message });
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
    const records = parse(content, { columns: true, skip_empty_lines: true });
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
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (err) {
    return { size: 0, mtime: '', ctime: '', atime: '', isFile: false, isDirectory: false };
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

// New window creation for tab drag-out functionality
ipcMain.handle('open-new-window', async (_, initialPath?: string) => {
  try {
    console.log('[Main] Creating new window with initial path:', initialPath);
    
    // Create a new window using the same configuration as the main window
    const newWindow = new BrowserWindow({
      width: 1200,
      height: 800,
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
      .filter(file => file.endsWith('.xlsx'))
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
      icon: path.join(__dirname, '../assets/32.ico'),
      show: false,
      frame: false, // Use custom titlebar like main window
      titleBarStyle: 'hidden',
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

// Floating Timer Window
let floatingTimerWindow: BrowserWindow | null = null;
let floatingTimerIsMinimized = false; // Track minimized state for proper snapping

const createFloatingTimerWindow = async (): Promise<{ success: boolean }> => {
  // Don't create multiple instances
  if (floatingTimerWindow && !floatingTimerWindow.isDestroyed()) {
    floatingTimerWindow.focus();
    return { success: true };
  }

  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    floatingTimerWindow = new BrowserWindow({
      width: 210,
      height: 120,
      minWidth: 60, // Allow shrinking to minimized size
      minHeight: 60, // Allow shrinking to minimized size
      maxWidth: 500, // Reasonable maximum
      maxHeight: 500, // Reasonable maximum
      x: width - 230, // Position near right edge
      y: 100, // 100px from top
      frame: false, // Frameless for custom design
      transparent: true, // Transparent background
      alwaysOnTop: true, // Always on top of other windows
      resizable: false, // No manual resizing by user
      skipTaskbar: false, // Show in taskbar
      title: 'Time Logger', // Window title
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
      },
    });

    // Load the floating timer route
    if (process.env.NODE_ENV === 'development') {
      await floatingTimerWindow.loadURL('http://localhost:5173/#floating-timer');
      // Dev tools removed for floating timer
    } else {
      await floatingTimerWindow.loadFile(join(__dirname, '../dist/index.html'), {
        hash: 'floating-timer',
      });
    }

    // Set default expanded state when opened from function panel
    floatingTimerWindow.webContents.once('did-finish-load', () => {
      floatingTimerWindow?.webContents.send('set-expanded-state', true);
    });

    // Listen to window move events and check for snapping
    let isMoving = false;
    let lastSnapCorner: string | null = null;
    
    floatingTimerWindow.on('will-move', (event, newBounds) => {
      isMoving = true;
      
      if (!floatingTimerWindow || floatingTimerWindow.isDestroyed()) return;
      
      // Use actual window size from the window, not from bounds (bounds may be stale)
      const [actualWidth, actualHeight] = floatingTimerWindow.getSize();
      const windowWidth = actualWidth;
      const windowHeight = actualHeight;
      
      // Skip snapping when expanded (1068x300) to allow FancyZones to handle it
      const isExpanded = windowWidth >= 1000 && windowHeight >= 250 && windowHeight <= 350;
      if (isExpanded) {
        // Clear any existing snap indicators
        if (lastSnapCorner !== null) {
          floatingTimerWindow.webContents.send('corner-snapped', null);
          lastSnapCorner = null;
        }
        return; // Don't perform snapping when expanded
      }
      
      const { screen } = require('electron');
      // Get the display where the window is currently positioned
      const currentDisplay = screen.getDisplayNearestPoint({ x: newBounds.x, y: newBounds.y });
      const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = currentDisplay.workArea;
      
      const x = newBounds.x - screenX; // Relative to current screen
      const y = newBounds.y - screenY; // Relative to current screen
      
      const SNAP_THRESHOLD = 80;
      let snappedCorner: string | null = null;
      
      // Calculate distance from window edges to screen edges (consistent for both minimized and normal)
      const distToTopLeft = Math.sqrt(x * x + y * y);
      const distToTopRight = Math.sqrt(Math.pow(x + windowWidth - screenWidth, 2) + y * y);
      const distToBottomLeft = Math.sqrt(x * x + Math.pow(y + windowHeight - screenHeight, 2));
      const distToBottomRight = Math.sqrt(Math.pow(x + windowWidth - screenWidth, 2) + Math.pow(y + windowHeight - screenHeight, 2));
      
      const minDist = Math.min(distToTopLeft, distToTopRight, distToBottomLeft, distToBottomRight);
      
      // Check corner snapping FIRST
      if (minDist < SNAP_THRESHOLD) {
        if (minDist === distToTopLeft) {
          snappedCorner = 'top-left';
        } else if (minDist === distToTopRight) {
          snappedCorner = 'top-right';
        } else if (minDist === distToBottomLeft) {
          snappedCorner = 'bottom-left';
        } else if (minDist === distToBottomRight) {
          snappedCorner = 'bottom-right';
        }
        
        // Send indicator during drag
        if (snappedCorner !== lastSnapCorner) {
          console.log('[FloatingTimer] Near corner:', snappedCorner);
          floatingTimerWindow.webContents.send('corner-snapped', snappedCorner);
          
          // Clear panel indicator on main window when corner is detected
          if (lastSnapCorner === 'panel' && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new CustomEvent('floating-timer-near-panel', { detail: { isNear: false } }));
            `);
          }
          
          lastSnapCorner = snappedCorner;
        }
      } else {
        // Only check for panel proximity if NOT near a corner
        let isNearPanel = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          const floatingCenterX = newBounds.x + windowWidth / 2;
          const floatingCenterY = newBounds.y + windowHeight / 2;
          
          const [mainX, mainY] = mainWindow.getPosition();
          const [mainWidth, mainHeight] = mainWindow.getSize();
          
          // The timer panel is specifically on the right side of the function panel
          // and the function panel is at the top of the main window
          // Be more specific about the timer panel location (right side, top)
          const timerPanelWidth = 300; // Approximate width of timer panel area
          const panelAreaTop = mainY - 30; // Allow some overshoot above window (moved down by 20px)
          const panelAreaBottom = mainY + 140; // Panel area (top area of main window, moved down by 20px)
          const panelAreaLeft = mainX + mainWidth - timerPanelWidth - 100; // Right side of window (moved left by 50px)
          const panelAreaRight = mainX + mainWidth + 50;
          
          // Only trigger if we're specifically near the timer panel area (right side, top)
          isNearPanel = (floatingCenterX >= panelAreaLeft && floatingCenterX <= panelAreaRight) &&
                        (floatingCenterY >= panelAreaTop && floatingCenterY <= panelAreaBottom);
        }
        
        if (isNearPanel) {
          snappedCorner = 'panel';
          if (snappedCorner !== lastSnapCorner) {
            console.log('[FloatingTimer] Near function panel');
            floatingTimerWindow.webContents.send('corner-snapped', 'panel');
            // Also notify main window to show visual indicator
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.executeJavaScript(`
                window.dispatchEvent(new CustomEvent('floating-timer-near-panel', { detail: { isNear: true } }));
              `);
            }
            lastSnapCorner = snappedCorner;
          }
        } else {
          if (lastSnapCorner !== null) {
            floatingTimerWindow.webContents.send('corner-snapped', null);
            // Also notify main window that it's no longer near panel
            if (lastSnapCorner === 'panel' && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.executeJavaScript(`
                window.dispatchEvent(new CustomEvent('floating-timer-near-panel', { detail: { isNear: false } }));
              `);
            }
            lastSnapCorner = null;
          }
        }
      }
    });
    
    floatingTimerWindow.on('moved', () => {
      if (!isMoving) return;
      isMoving = false;
      
      if (!floatingTimerWindow || floatingTimerWindow.isDestroyed()) return;
      
      const [windowWidth, windowHeight] = floatingTimerWindow.getSize();
      
      // Skip snapping when expanded (1068x300) to allow FancyZones to handle it
      const isExpanded = windowWidth >= 1000 && windowHeight >= 250 && windowHeight <= 350;
      if (isExpanded) {
        // Clear any existing snap indicators
        setTimeout(() => {
          if (floatingTimerWindow && !floatingTimerWindow.isDestroyed()) {
            floatingTimerWindow.webContents.send('corner-snapped', null);
            lastSnapCorner = null;
          }
        }, 100);
        return; // Don't perform snapping when expanded
      }
      
      const [windowX, windowY] = floatingTimerWindow.getPosition();
      const { screen } = require('electron');
      // Get the display where the window is currently positioned
      const currentDisplay = screen.getDisplayNearestPoint({ x: windowX, y: windowY });
      const { x: screenX, y: screenY, width: screenWidth, height: screenHeight } = currentDisplay.workArea;
      
      // Window position relative to current screen
      const relX = windowX - screenX;
      const relY = windowY - screenY;
      
      const SNAP_THRESHOLD = 80;
      
      // Calculate distance from window edges to screen edges (consistent for both minimized and normal)
      const distToTopLeft = Math.sqrt(relX * relX + relY * relY);
      const distToTopRight = Math.sqrt(Math.pow(relX + windowWidth - screenWidth, 2) + relY * relY);
      const distToBottomLeft = Math.sqrt(relX * relX + Math.pow(relY + windowHeight - screenHeight, 2));
      const distToBottomRight = Math.sqrt(Math.pow(relX + windowWidth - screenWidth, 2) + Math.pow(relY + windowHeight - screenHeight, 2));
      
      const minDist = Math.min(distToTopLeft, distToTopRight, distToBottomLeft, distToBottomRight);
      
      // Check corner snapping FIRST - it takes priority over panel docking
      if (minDist < SNAP_THRESHOLD) {
        let finalX = windowX; // Keep as absolute position
        let finalY = windowY; // Keep as absolute position
        
        // No padding for both minimized and normal windows - snap flush to corners
        const padding = 0;
        
        if (minDist === distToTopLeft) {
          finalX = screenX + padding;
          finalY = screenY + padding;
        } else if (minDist === distToTopRight) {
          finalX = screenX + screenWidth - windowWidth - padding;
          finalY = screenY + padding;
        } else if (minDist === distToBottomLeft) {
          finalX = screenX + padding;
          finalY = screenY + screenHeight - windowHeight - padding;
        } else if (minDist === distToBottomRight) {
          finalX = screenX + screenWidth - windowWidth - padding;
          finalY = screenY + screenHeight - windowHeight - padding;
        }
        
        console.log('[FloatingTimer] Window size:', windowWidth, 'x', windowHeight, 'minimized:', floatingTimerIsMinimized);
        console.log('[FloatingTimer] Snapping to absolute position:', finalX, finalY, 'on screen', currentDisplay.id);
        floatingTimerWindow.setPosition(Math.round(finalX), Math.round(finalY));
      } else {
        // Only check panel proximity if NOT snapping to a corner
        if (mainWindow && !mainWindow.isDestroyed()) {
          const floatingCenterX = windowX + windowWidth / 2;
          const floatingCenterY = windowY + windowHeight / 2;
          
          const [mainX, mainY] = mainWindow.getPosition();
          const [mainWidth, mainHeight] = mainWindow.getSize();
          
          // The timer panel is specifically on the right side of the function panel
          // and the function panel is at the top of the main window
          const timerPanelWidth = 300;
          const panelAreaTop = mainY - 30; // Allow some overshoot above window (moved down by 20px)
          const panelAreaBottom = mainY + 140; // Panel area (top area of main window, moved down by 20px)
          const panelAreaLeft = mainX + mainWidth - timerPanelWidth - 100; // Right side of window (moved left by 50px)
          const panelAreaRight = mainX + mainWidth + 50;
          
          const isNearPanel = (floatingCenterX >= panelAreaLeft && floatingCenterX <= panelAreaRight) &&
                              (floatingCenterY >= panelAreaTop && floatingCenterY <= panelAreaBottom);
          
          if (isNearPanel) {
            console.log('[FloatingTimer] Docking to function panel, closing window');
            // Signal to close the floating timer - it will dock back to function panel
            floatingTimerWindow.webContents.send('dock-to-panel');
            return;
          }
        }
      }
      
      // Clear indicator after snap
      setTimeout(() => {
        if (floatingTimerWindow && !floatingTimerWindow.isDestroyed()) {
          floatingTimerWindow.webContents.send('corner-snapped', null);
          lastSnapCorner = null;
        }
      }, 500);
    });
    
    // Clean up reference when window is closed
    floatingTimerWindow.on('closed', () => {
      console.log('[FloatingTimer] Window closed, broadcasting to main window');
      // Broadcast to main window that floating timer is closed
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(`
          window.dispatchEvent(new Event('floating-timer-closed'));
        `);
      }
      floatingTimerWindow = null;
      floatingTimerIsMinimized = false; // Reset minimized state
    });

    console.log('[FloatingTimer] Window created successfully');
    return { success: true };
  } catch (error) {
    console.error('[Main] Error creating floating timer window:', error);
    floatingTimerWindow = null;
    throw error;
  }
};

// Floating timer IPC handler
ipcMain.handle('open-floating-timer', async () => {
  try {
    return await createFloatingTimerWindow();
  } catch (error) {
    console.error('[Main] Error opening floating timer:', error);
    return { success: false, error: String(error) };
  }
});

// Task Summary Window
let taskSummaryWindow: BrowserWindow | null = null;

const createTaskSummaryWindow = async (): Promise<{ success: boolean }> => {
  // Don't create multiple instances
  if (taskSummaryWindow && !taskSummaryWindow.isDestroyed()) {
    taskSummaryWindow.focus();
    return { success: true };
  }

  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    taskSummaryWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      x: Math.floor((width - 1000) / 2), // Center horizontally
      y: Math.floor((height - 700) / 2), // Center vertically
      frame: false, // Frameless for custom title bar
      alwaysOnTop: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, 'preload.js'),
      },
    });

    // Load the task summary route
    if (process.env.NODE_ENV === 'development') {
      await taskSummaryWindow.loadURL('http://localhost:5173/#task-summary');
    } else {
      await taskSummaryWindow.loadFile(join(__dirname, '../dist/index.html'), {
        hash: 'task-summary',
      });
    }

    taskSummaryWindow.on('closed', () => {
      taskSummaryWindow = null;
    });

    console.log('[Main] Task summary window created successfully');
    return { success: true };
  } catch (error) {
    console.error('[Main] Error creating task summary window:', error);
    taskSummaryWindow = null;
    throw error;
  }
};

// Task summary window IPC handler
ipcMain.handle('open-task-summary-window', async () => {
  try {
    return await createTaskSummaryWindow();
  } catch (error) {
    console.error('[Main] Error opening task summary window:', error);
    return { success: false, error: String(error) };
  }
});

// Handle window position updates with snapping
ipcMain.handle('update-floating-timer-position', async (_, x: number, y: number) => {
  console.log('[Main] update-floating-timer-position called with:', x, y);
  
  if (!floatingTimerWindow || floatingTimerWindow.isDestroyed()) {
    console.log('[Main] No floating timer window available');
    return { success: false, snappedCorner: null };
  }

  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const [windowWidth, windowHeight] = floatingTimerWindow.getSize();
    
    console.log('[Main] Screen size:', screenWidth, 'x', screenHeight);
    console.log('[Main] Window size:', windowWidth, 'x', windowHeight);
    
    const SNAP_THRESHOLD = 80; // Increased threshold for easier snapping
    let snappedCorner: string | null = null;
    let finalX = x;
    let finalY = y;
    
    // Check for corner snapping
    const distToTopLeft = Math.sqrt(x * x + y * y);
    const distToTopRight = Math.sqrt(Math.pow(x + windowWidth - screenWidth, 2) + y * y);
    const distToBottomLeft = Math.sqrt(x * x + Math.pow(y + windowHeight - screenHeight, 2));
    const distToBottomRight = Math.sqrt(Math.pow(x + windowWidth - screenWidth, 2) + Math.pow(y + windowHeight - screenHeight, 2));
    
    console.log('[Main] Distances to corners:', {
      topLeft: distToTopLeft,
      topRight: distToTopRight,
      bottomLeft: distToBottomLeft,
      bottomRight: distToBottomRight
    });
    
    // Find closest corner
    const minDist = Math.min(distToTopLeft, distToTopRight, distToBottomLeft, distToBottomRight);
    console.log('[Main] Minimum distance:', minDist, 'threshold:', SNAP_THRESHOLD);
    
    if (minDist < SNAP_THRESHOLD) {
      if (minDist === distToTopLeft) {
        finalX = 0;
        finalY = 0;
        snappedCorner = 'top-left';
      } else if (minDist === distToTopRight) {
        finalX = screenWidth - windowWidth;
        finalY = 0;
        snappedCorner = 'top-right';
      } else if (minDist === distToBottomLeft) {
        finalX = 0;
        finalY = screenHeight - windowHeight;
        snappedCorner = 'bottom-left';
      } else if (minDist === distToBottomRight) {
        finalX = screenWidth - windowWidth;
        finalY = screenHeight - windowHeight;
        snappedCorner = 'bottom-right';
      }
      console.log('[Main] SNAPPED to corner:', snappedCorner);
    }
    
    console.log('[Main] Setting window position to:', finalX, finalY);
    floatingTimerWindow.setPosition(Math.round(finalX), Math.round(finalY));
    
    return { success: true, snappedCorner, x: finalX, y: finalY };
  } catch (error) {
    console.error('[Main] Error updating floating timer position:', error);
    return { success: false, snappedCorner: null };
  }
});

// Get screen info for snapping calculations
ipcMain.handle('get-screen-info', async () => {
  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    return {
      success: true,
      workArea: primaryDisplay.workAreaSize
    };
  } catch (error) {
    console.error('[Main] Error getting screen info:', error);
    return { success: false };
  }
});

// Resize floating timer window
ipcMain.handle('resize-floating-timer', async (_, width: number, height: number) => {
  try {
    if (!floatingTimerWindow || floatingTimerWindow.isDestroyed()) {
      console.log('[Main] No floating timer window to resize');
      return;
    }
    
    // Get current position and size
    const [currentX, currentY] = floatingTimerWindow.getPosition();
    const [currentWidth, currentHeight] = floatingTimerWindow.getSize();
    
    console.log('[Main] Resizing from', currentWidth, 'x', currentHeight, 'to', width, 'x', height);
    
    // Calculate offset to keep window centered when resizing
    const offsetX = Math.floor((currentWidth - width) / 2);
    const offsetY = Math.floor((currentHeight - height) / 2);
    
    // Ensure we allow resizing programmatically
    floatingTimerWindow.setResizable(true);
    
    // Set the new size (this actually changes the window dimensions)
    floatingTimerWindow.setSize(width, height, true); // animate = true for smooth transition
    
    // Update position to keep centered
    floatingTimerWindow.setPosition(currentX + offsetX, currentY + offsetY, true);
    
    // Disable manual resizing again
    floatingTimerWindow.setResizable(false);
    
    // Track if window is minimized (100x100 indicates minimized state)
    floatingTimerIsMinimized = width === 100 && height === 100;
    
    // Verify the size was actually set
    const [newWidth, newHeight] = floatingTimerWindow.getSize();
    console.log('[Main] Resized floating timer. Requested:', width, 'x', height, '| Actual:', newWidth, 'x', newHeight, '| Minimized:', floatingTimerIsMinimized);
    
    if (newWidth !== width || newHeight !== height) {
      console.warn('[Main] WARNING: Window size does not match requested size!');
    }
  } catch (error) {
    console.error('[Main] Error resizing floating timer:', error);
  }
});

// Check if floating timer is near the function panel position
ipcMain.handle('check-panel-proximity', async () => {
  try {
    if (!floatingTimerWindow || floatingTimerWindow.isDestroyed() || !mainWindow || mainWindow.isDestroyed()) {
      return { isNearPanel: false };
    }
    
    const [floatingX, floatingY] = floatingTimerWindow.getPosition();
    const [floatingWidth, floatingHeight] = floatingTimerWindow.getSize();
    const floatingCenterX = floatingX + floatingWidth / 2;
    const floatingCenterY = floatingY + floatingHeight / 2;
    
    const [mainX, mainY] = mainWindow.getPosition();
    const [mainWidth, mainHeight] = mainWindow.getSize();
    
    // Function panel is at the top of the main window
    // Check if any part of the floating timer overlaps with the main window's top area
    const panelAreaTop = mainY - 30; // Allow some overshoot above window (moved down by 20px)
    const panelAreaBottom = mainY + 220; // Top 220px of main window (moved down by 20px)
    const panelAreaLeft = mainX;
    const panelAreaRight = mainX + mainWidth;
    
    // Check if floating timer center is within the panel area
    const isInHorizontalRange = floatingCenterX >= panelAreaLeft && floatingCenterX <= panelAreaRight;
    const isInVerticalRange = floatingCenterY >= panelAreaTop && floatingCenterY <= panelAreaBottom;
    
    // Also check if floating timer is close to the main window (within 100px)
    const distanceToMainWindow = Math.min(
      Math.abs(floatingCenterX - mainX), // Distance to left edge
      Math.abs(floatingCenterX - (mainX + mainWidth)), // Distance to right edge
      Math.abs(floatingCenterY - mainY), // Distance to top edge
      Math.abs(floatingCenterY - (mainY + mainHeight)) // Distance to bottom edge
    );
    
    const isNearPanel = (isInHorizontalRange && isInVerticalRange) || (distanceToMainWindow < 100);
    
    console.log('[Main] Panel proximity check:', {
      floatingPos: { x: floatingCenterX, y: floatingCenterY },
      mainWindow: { x: mainX, y: mainY, width: mainWidth, height: mainHeight },
      panelArea: { top: panelAreaTop, bottom: panelAreaBottom, left: panelAreaLeft, right: panelAreaRight },
      isNearPanel,
      distanceToMainWindow
    });
    
    return { isNearPanel };
  } catch (error) {
    console.error('[Main] Error checking panel proximity:', error);
    return { isNearPanel: false };
  }
});

// Handle messages from floating timer to main window
ipcMain.on('send-to-main-window', (event, channel, ...args) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
    
    // Broadcast floating timer state changes
    if (channel === 'floating-timer-opened') {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new Event('floating-timer-opened'));
      `);
    } else if (channel === 'floating-timer-closed') {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new Event('floating-timer-closed'));
      `);
    }
  }
});

// Get active window title using get-windows (replacement for deprecated active-win)
// Note: get-windows is ESM-only and a native module - must be externalized and use dynamic import()
ipcMain.handle('get-active-window-title', async () => {
  try {
    console.log('[Main] 🔍 Getting active window title...');
    
    // Use dynamic import() for ESM-only native module (not bundled, loaded at runtime)
    const { activeWindow } = await import('get-windows');
    
    // activeWindow() returns a Promise<object> - must await it
    const win = await activeWindow();
    
    if (!win) {
      console.log('[Main] ⚠️ No active window found');
      return { success: true, title: '' };
    }
    
    // Debug: Log all properties of win object to see what's available
    console.log('[Main] 🔍 Full window object keys:', Object.keys(win));
    console.log('[Main] 🔍 Full window object:', JSON.stringify(win, null, 2));
    
    // get-windows returns a plain object with title, owner, etc. properties
    // Try multiple possible property names (using type assertion for properties that might exist)
    const winAny = win as any;
    const title = win.title || winAny.name || winAny.windowTitle || '';
    
    console.log('[Main] ✅ Active window:', {
      title: title,
      titleRaw: win.title,
      name: winAny.name,
      app: win.owner?.name || 'unknown',
      processId: win.owner?.processId || 'unknown',
      ownerFull: win.owner
    });
    
    // Filter out our own app windows
    const owner = win.owner;
    const isOurApp = title?.includes('DocuFrame') || 
                     owner?.name?.toLowerCase().includes('electron') || 
                     owner?.name?.includes('DocuFrame');
    
    if (isOurApp) {
      console.log('[Main] ⏭️ Skipping - this is DocuFrame itself');
      return { success: true, title: '' };
    }
    
    // Return title if it exists and is not empty
    if (title && title.trim().length > 0) {
      return { success: true, title: title.trim() };
    }
    
    console.log('[Main] ⚠️ Window title is empty or undefined');
    return { success: true, title: '' };
  } catch (error: any) {
    console.error('[Main] ❌ Error getting active window title:', error);
    console.error('[Main] ❌ Error stack:', error.stack);
    return { success: false, title: '', error: error.message };
  }
});

// Task Timer IPC handlers
ipcMain.handle('save-task-log', async (_, dateString: string, task: any) => {
  try {
    console.log('[TaskTimer] Saving task log for date:', dateString);
    
    // Get AppData path
    const appDataPath = app.getPath('appData');
    const docuFramePath = path.join(appDataPath, 'DocuFrame');
    const taskLogsPath = path.join(docuFramePath, 'task-logs');
    
    // Ensure directories exist
    if (!fs.existsSync(docuFramePath)) {
      fs.mkdirSync(docuFramePath, { recursive: true });
    }
    if (!fs.existsSync(taskLogsPath)) {
      fs.mkdirSync(taskLogsPath, { recursive: true });
    }
    
    const logFilePath = path.join(taskLogsPath, `${dateString}.json`);
    
    // Load existing logs or create new array
    let tasks: any[] = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const content = fs.readFileSync(logFilePath, 'utf8');
        tasks = JSON.parse(content);
      } catch (error) {
        console.error('[TaskTimer] Error reading existing log file:', error);
        tasks = [];
      }
    }
    
    // Check if task already exists (prevent duplicates)
    const existingTaskIndex = tasks.findIndex((t: any) => t.id === task.id);
    if (existingTaskIndex >= 0) {
      console.log('[TaskTimer] ⚠️ Task already exists, updating instead of adding duplicate:', task.id);
      tasks[existingTaskIndex] = task;
    } else {
      console.log('[TaskTimer] ➕ Adding new task:', task.id);
      tasks.push(task);
    }
    
    // Log what we're saving
    console.log('[TaskTimer] Saving task with', task.windowTitles?.length || 0, 'window titles');
    console.log('[TaskTimer] Total tasks in file:', tasks.length);
    
    // Save updated logs
    fs.writeFileSync(logFilePath, JSON.stringify(tasks, null, 2), 'utf8');
    
    console.log('[TaskTimer] Task log saved successfully:', logFilePath);
    return { success: true };
  } catch (error) {
    console.error('[TaskTimer] Error saving task log:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-task-logs', async (_, dateString: string) => {
  try {
    console.log('[TaskTimer] Loading task logs for date:', dateString);
    
    // Get AppData path
    const appDataPath = app.getPath('appData');
    const taskLogsPath = path.join(appDataPath, 'DocuFrame', 'task-logs');
    const logFilePath = path.join(taskLogsPath, `${dateString}.json`);
    
    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      console.log('[TaskTimer] No log file found for date:', dateString);
      return { success: true, tasks: [] };
    }
    
    // Read and parse log file
    const content = fs.readFileSync(logFilePath, 'utf8');
    const tasks = JSON.parse(content);
    
    console.log('[TaskTimer] Loaded', tasks.length, 'tasks for date:', dateString);
    return { success: true, tasks };
  } catch (error) {
    console.error('[TaskTimer] Error loading task logs:', error);
    return { success: false, tasks: [], error: String(error) };
  }
});

ipcMain.handle('delete-task-log', async (_, dateString: string, taskId: string) => {
  try {
    console.log('[TaskTimer] Deleting task log:', taskId, 'for date:', dateString);
    
    // Get AppData path
    const appDataPath = app.getPath('appData');
    const taskLogsPath = path.join(appDataPath, 'DocuFrame', 'task-logs');
    const logFilePath = path.join(taskLogsPath, `${dateString}.json`);
    
    // Check if file exists
    if (!fs.existsSync(logFilePath)) {
      console.log('[TaskTimer] No log file found for date:', dateString);
      return { success: false, error: 'Log file not found' };
    }
    
    // Read and parse log file
    const content = fs.readFileSync(logFilePath, 'utf8');
    let tasks = JSON.parse(content);
    
    // Filter out the task with the given ID
    const originalLength = tasks.length;
    tasks = tasks.filter((task: any) => task.id !== taskId);
    
    if (tasks.length === originalLength) {
      console.log('[TaskTimer] Task not found:', taskId);
      return { success: false, error: 'Task not found' };
    }
    
    // Save updated logs
    fs.writeFileSync(logFilePath, JSON.stringify(tasks, null, 2), 'utf8');
    
    console.log('[TaskTimer] Task deleted successfully:', taskId);
    return { success: true };
  } catch (error) {
    console.error('[TaskTimer] Error deleting task log:', error);
    return { success: false, error: String(error) };
  }
});

// Analyze window activity using Claude Haiku
ipcMain.handle('analyze-window-activity', async (_, windowActivityData: string) => {
  try {
    console.log('[TaskTimer] Analyzing window activity with Claude Haiku...');
    
    // Get config directly in main process (settingsService doesn't work here)
    const config = await loadConfig();
    const apiKey = (config as any).claudeApiKey;
    
    if (!apiKey) {
      console.error('[TaskTimer] Claude API key not found in config');
      return { success: false, error: 'Claude API key not set. Please configure it in Settings.' };
    }
    
    // Dynamically import the claude service
    const { analyzeWindowActivity } = await import('../src/services/claude');
    
    // Pass the API key directly since we're in main process
    const summary = await analyzeWindowActivity(windowActivityData, 'haiku', apiKey);
    
    console.log('[TaskTimer] Window activity analysis complete');
    return { success: true, summary };
  } catch (error: any) {
    console.error('[TaskTimer] Error analyzing window activity:', error);
    return { success: false, error: error.message || String(error) };
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