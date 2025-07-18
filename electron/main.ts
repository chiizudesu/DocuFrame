// main.ts - Updated with IPC handlers
// Set GitHub token for auto-updates (replace with your actual token)
process.env.GH_TOKEN = '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';

import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import { fileSystemService } from '../src/services/fileSystem';
import type { Config } from '../src/services/config';
import { handleCommand } from '../src/main/commandHandler';
import { transferFiles } from '../src/main/commands/transfer';
import { PDFDocument } from 'pdf-lib';
import PDFParser from 'pdf2json';
const { parse } = require('csv-parse/sync');
import yaml from 'js-yaml';
import { spawn, ChildProcess } from 'child_process';
import { autoUpdaterService } from '../src/main/autoUpdater';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      gstTemplatePath: undefined
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

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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
    },
  });

  // Initialize autoUpdater service with the main window
  autoUpdaterService.setMainWindow(mainWindow);

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
  createWindow();
  
  // Register global shortcut for app activation
  await registerGlobalShortcut(config);
});

// Global shortcut management
let currentShortcut: string | null = null;

async function registerGlobalShortcut(config: Config) {
  try {
    // Unregister existing shortcut if any
    if (currentShortcut) {
      globalShortcut.unregister(currentShortcut);
      currentShortcut = null;
    }

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
    default:
      return shortcut;
  }
}

function activateApp() {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    const mainWindow = windows[0];
    
    // Show the window if it's hidden
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    // Focus the window
    mainWindow.focus();
    
    // Restore if minimized
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    
    // Bring to front
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
    
    console.log('[Main] App activated via global shortcut');
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
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
    console.log('[Main] Received transfer request:', options);
    const result = await transferFiles(options);
    console.log('[Main] Transfer result:', result);
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
        results.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'folder' : 'file',
          size: stats.size.toString(),
          modified: stats.mtime.toISOString(),
          extension: entry.isFile() ? path.extname(entry.name).toLowerCase().slice(1) : undefined
        });
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

    // Check if target file already exists
    try {
      await fsPromises.access(newPath, fs.constants.F_OK);
      // If we get here, file exists - ask user what to do
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
    } catch (error) {
      // If error is not about file existing, it's something else
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // ENOENT means file doesn't exist, which is good - continue with rename
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
        
        // Copy the file first
        await fsPromises.copyFile(filePath, targetPath);
        
        // Verify the copy was successful
        if (!(await fileExists(targetPath))) {
          throw new Error('File copy failed - destination file not found after copy');
        }
        
        // Delete the original file
        await fsPromises.unlink(filePath);
        
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

ipcMain.handle('quit-and-install', async () => {
  try {
    autoUpdaterService.quitAndInstall();
    return { success: true };
  } catch (error) {
    console.error('Error quitting and installing update:', error);
    throw error;
  }
});