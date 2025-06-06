// main.ts - Updated with IPC handlers
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { fileSystemService } from '../src/services/fileSystem';
import type { Config } from '../src/services/config';

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
      rootPath: app.getPath('documents')
    };
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

// Save config
async function saveConfig(config: Config) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
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
  await loadConfig();
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
    await saveConfig(config);
    return config;
  } catch (error) {
    console.error('Error setting config:', error);
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
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          lastModified: stats.mtime,
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
      type: 'directory',
      size: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('delete-item', async (_, itemPath: string) => {
  try {
    const stats = await fs.stat(itemPath);
    if (stats.isDirectory()) {
      await fs.rmdir(itemPath, { recursive: true });
    } else {
      await fs.unlink(itemPath);
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
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