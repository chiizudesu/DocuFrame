import { contextBridge, ipcRenderer } from 'electron';
import type { FileItem, AppSettings, TransferOptions } from '../src/types';

// Define the API interface
interface ElectronAPI {
  getConfig: () => Promise<AppSettings>;
  setConfig: (config: AppSettings) => Promise<void>;
  validatePath: (path: string) => Promise<boolean>;
  getDirectoryContents: (path: string) => Promise<FileItem[]>;
  createDirectory: (path: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
  openFile: (filePath: string) => Promise<void>;
  confirmDelete: (fileNames: string[]) => Promise<void>;
  executeCommand: (command: string) => Promise<any>;
  transfer: (options: TransferOptions) => Promise<any>;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Command handling
  executeCommand: async (command: string) => {
    console.log('[Preload] Executing command:', command);
    const result = await ipcRenderer.invoke('execute-command', command);
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
  getConfig: async (key: string) => {
    return await ipcRenderer.invoke('get-config');
  },
  setConfig: async (key: string, value: any) => {
    return await ipcRenderer.invoke('set-config', value);
  },
  
  // Directory operations
  selectDirectory: async () => {
    return await ipcRenderer.invoke('select-directory');
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
}); 