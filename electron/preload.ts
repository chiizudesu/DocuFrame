import { contextBridge, ipcRenderer } from 'electron';
import type { FileItem, AppSettings, TransferOptions } from '../src/types';

// Define the API interface
interface ElectronAPI {
  getConfig: () => Promise<AppSettings>;
  setConfig: (config: AppSettings) => Promise<AppSettings>;
  validatePath: (path: string) => Promise<boolean>;
  getDirectoryContents: (path: string) => Promise<FileItem[]>;
  getDownloadsPath: () => Promise<string>;
  createDirectory: (path: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
  selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string>;
  openFile: (filePath: string) => Promise<void>;
  confirmDelete: (fileNames: string[]) => Promise<void>;
  executeCommand: (command: string, currentDirectory?: string, options?: any) => Promise<any>;
  transfer: (options: TransferOptions) => Promise<any>;
  openDirectory: (dirPath: string) => Promise<void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowMaximize: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onWindowUnmaximize: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onFolderContentsChanged: (cb: (event: Electron.IpcRendererEvent, data: { directory: string }) => void) => void;
  removeAllListeners: (channel: string) => void;
  readCsv: (filePath: string) => Promise<any[]>;
  moveFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  copyFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  moveFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  copyFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  readPdfText: (filePath: string) => Promise<string>;
  loadYamlTemplate: (filePath: string) => Promise<any>;
  readTextFile: (filePath: string) => Promise<string>;
  writeTextFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean }>;
  getFileIcon: (filePath: string) => Promise<string | null>;
  showProperties: (filePath: string) => Promise<{ success: boolean }>;
  // File properties methods
  getFileStats: (filePath: string) => Promise<{ size: number; mtime: Date; ctime: Date; atime: Date; isFile: boolean; isDirectory: boolean }>;
  isFileBlocked: (filePath: string) => Promise<boolean>;
  unblockFile: (filePath: string) => Promise<boolean>;
  // Update-related methods
  checkForUpdates: () => Promise<{ success: boolean; message: string }>;
  quitAndInstall: () => Promise<{ success: boolean }>;
  onUpdateAvailable: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateDownloaded: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateNotAvailable: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateError: (cb: (event: Electron.IpcRendererEvent, error: string) => void) => void;
  onUpdateProgress: (cb: (event: Electron.IpcRendererEvent, progress: any) => void) => void;
  // Global shortcut methods
  updateGlobalShortcut: (config: AppSettings) => Promise<{ success: boolean }>;
  // Calculator methods
  openCalculator: () => Promise<{ success: boolean }>;
  closeCalculator: () => Promise<{ success: boolean }>;
  // Version method
  getVersion: () => string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Command handling
  executeCommand: async (command: string, currentDirectory?: string, options?: any) => {
    console.log('[Preload] Executing command:', command, 'currentDirectory:', currentDirectory, 'options:', options);
    const result = await ipcRenderer.invoke('execute-command', command, currentDirectory, options);
    console.log('[Preload] Command result:', result);
    return result;
  },
  
  // Transfer command
  transfer: async (options: TransferOptions) => {
    console.log('[Preload] Transfer request:', options);
    const result = await ipcRenderer.invoke('transfer-files', options);
    console.log('[Preload] Transfer result:', result);
    return result;
  },
  
  // Config management
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  setConfig: async (config: AppSettings) => {
    return await ipcRenderer.invoke('set-config', config);
  },
  
  // Directory operations
  selectDirectory: async () => {
    return await ipcRenderer.invoke('select-directory');
  },
  selectFile: async (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
    return await ipcRenderer.invoke('select-file', options);
  },
  getDirectoryContents: async (dirPath: string) => {
    return await ipcRenderer.invoke('get-directory-contents', dirPath);
  },
  getDownloadsPath: async () => {
    return await ipcRenderer.invoke('get-downloads-path');
  },
  
  // File operations
  renameItem: async (oldPath: string, newPath: string) => {
    return await ipcRenderer.invoke('rename-item', oldPath, newPath);
  },
  deleteItem: async (path: string) => {
    return await ipcRenderer.invoke('delete-item', path);
  },
  createDirectory: async (path: string) => {
    return await ipcRenderer.invoke('create-directory', path);
  },
  validatePath: (path: string) => ipcRenderer.invoke('validate-path', path),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  confirmDelete: (fileNames: string[]) => ipcRenderer.invoke('confirm-delete', fileNames),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  unmaximize: () => ipcRenderer.invoke('window-unmaximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximize: (cb) => ipcRenderer.on('window-maximized', cb),
  onWindowUnmaximize: (cb) => ipcRenderer.on('window-unmaximized', cb),
  onFolderContentsChanged: (cb) => ipcRenderer.on('folderContentsChanged', cb),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  readCsv: async (filePath: string) => {
    return await ipcRenderer.invoke('read-csv', filePath);
  },
  moveFiles: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('move-files', files, targetDirectory);
  },
  copyFiles: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('copy-files', files, targetDirectory);
  },
  moveFilesWithConflictResolution: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('move-files-with-conflict-resolution', files, targetDirectory);
  },
  copyFilesWithConflictResolution: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('copy-files-with-conflict-resolution', files, targetDirectory);
  },
  readPdfText: async (filePath: string) => {
    return await ipcRenderer.invoke('read-pdf-text', filePath);
  },
  loadYamlTemplate: async (filePath: string) => {
    return await ipcRenderer.invoke('load-yaml-template', filePath);
  },
  readTextFile: async (filePath: string) => {
    return await ipcRenderer.invoke('read-text-file', filePath);
  },
  writeTextFile: async (filePath: string, content: string) => {
    return await ipcRenderer.invoke('write-text-file', filePath, content);
  },
  deleteFile: async (filePath: string) => {
    return await ipcRenderer.invoke('delete-file', filePath);
  },
  getFileIcon: async (filePath: string) => {
    return await ipcRenderer.invoke('get-file-icon', filePath);
  },
  showProperties: async (filePath: string) => {
    return await ipcRenderer.invoke('show-properties', filePath);
  },
  // Update-related methods
  checkForUpdates: async () => {
    return await ipcRenderer.invoke('check-for-updates');
  },
  quitAndInstall: async () => {
    return await ipcRenderer.invoke('quit-and-install');
  },
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', cb),
  onUpdateError: (cb) => ipcRenderer.on('update-error', cb),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', cb),
  // Global shortcut methods
  updateGlobalShortcut: async (config: AppSettings) => {
    return await ipcRenderer.invoke('update-global-shortcut', config);
  },
  // Version method
  getVersion: () => {
    // Try to get version from various sources
    if (typeof globalThis !== 'undefined' && (globalThis as any).__APP_VERSION__) {
      return (globalThis as any).__APP_VERSION__;
    }
    if (typeof window !== 'undefined' && (window as any).__APP_VERSION__) {
      return (window as any).__APP_VERSION__;
    }
    // Fallback to current package.json version
    return '1.0.7';
  },
  // File properties methods
  getFileStats: async (filePath: string) => {
    return await ipcRenderer.invoke('get-file-stats', filePath);
  },
  isFileBlocked: async (filePath: string) => {
    return await ipcRenderer.invoke('is-file-blocked', filePath);
  },
  unblockFile: async (filePath: string) => {
    return await ipcRenderer.invoke('unblock-file', filePath);
  },
  // Calculator methods
  openCalculator: async () => {
    return await ipcRenderer.invoke('open-calculator');
  },
  closeCalculator: async () => {
    return await ipcRenderer.invoke('close-calculator');
  },
  // Window management methods
  openNewWindow: async (initialPath?: string) => {
    return await ipcRenderer.invoke('open-new-window', initialPath);
  },
  // Message handling for new windows
  onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  }
}); 

// Expose the electron API exactly as documented for native file drag and drop
contextBridge.exposeInMainWorld('electron', {
  startDrag: (files: string | string[]) => ipcRenderer.send('ondragstart', files)
});