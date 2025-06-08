// main.ts - Updated with IPC handlers
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { fileSystemService } from '../src/services/fileSystem';
import type { Config } from '../src/services/config';
import { handleCommand } from '../src/main/commandHandler';
import { transferFiles } from '../src/main/commands/transfer';

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the development server URL
const MAIN_WINDOW_VITE_DEV_SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:5173'
  : undefined;

// Config file path
const configPath = path.join(app.getPath('userData'), 'config.json');

// Load or create config
async function loadConfig(): Promise<Config> {
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Create default config if it doesn't exist
    const defaultConfig: Config = {
      rootPath: app.getPath('documents'),
      apiKey: undefined,
      gstTemplatePath: undefined
    };
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
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
    
    await fs.writeFile(configPath, configData);
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
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
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Load config before creating window
  const config = await loadConfig();
  console.log('[Main] Loaded config on window start:', config);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: any[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const stats = await fs.stat(fullPath);
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

ipcMain.handle('create-directory', async (_, dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    const stats = await fs.stat(dirPath);
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
    stats = await fs.stat(itemPath);
    
    if (stats.isDirectory()) {
      await fs.rmdir(itemPath, { recursive: true });
    } else {
      await fs.unlink(itemPath);
    }
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
            await fs.chmod(itemPath, 0o666);
            await fs.unlink(itemPath);
            return; // Success after permission fix
          } catch (chmodError) {
            console.log(`chmod+unlink failed: ${chmodError.code}`);
          }
          
          // Method 2: Try fs.rm (newer Node.js API, sometimes more effective)
          try {
            await fs.rm(itemPath, { force: true });
            console.log(`Successfully deleted ${itemPath} using fs.rm`);
            return; // Success with fs.rm
          } catch (rmError) {
            console.log(`fs.rm failed: ${rmError.code}`);
          }
        } else {
          // For directories, try the newer rmdir approach
          await fs.rm(itemPath, { recursive: true, force: true });
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
    const stats = await fs.stat(dirPath);
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
    await fs.rename(oldPath, newPath);
    return true;
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

// Emit events for maximize/unmaximize
app.on('browser-window-created', (event, win) => {
  win.on('maximize', () => {
    win.webContents.send('window-maximized');
  });
  win.on('unmaximize', () => {
    win.webContents.send('window-unmaximized');
  });
});