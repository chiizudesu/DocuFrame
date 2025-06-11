import { contextBridge, ipcRenderer } from 'electron';
import type { FileItem, AppSettings, TransferOptions } from '../src/types';

// Define the API interface
interface ElectronAPI {
  getConfig: () => Promise<AppSettings>;
  setConfig: (config: AppSettings) => Promise<AppSettings>;
  validatePath: (path: string) => Promise<boolean>;
  getDirectoryContents: (path: string) => Promise<FileItem[]>;
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
  readPdfText: (filePath: string) => Promise<string>;
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
  readPdfText: async (filePath: string) => {
    return await ipcRenderer.invoke('read-pdf-text', filePath);
  },
}); 

// Expose the electron API exactly as documented for native file drag and drop
contextBridge.exposeInMainWorld('electron', {
  startDrag: (files: string | string[]) => ipcRenderer.send('ondragstart', files)
});