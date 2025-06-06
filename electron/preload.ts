import { contextBridge, ipcRenderer } from 'electron';
import type { FileItem, AppSettings } from '../src/types';

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
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: AppSettings) => ipcRenderer.invoke('set-config', config),
  validatePath: (path: string) => ipcRenderer.invoke('validate-path', path),
  getDirectoryContents: (path: string) => ipcRenderer.invoke('get-directory-contents', path),
  createDirectory: (path: string) => ipcRenderer.invoke('create-directory', path),
  deleteItem: (path: string) => ipcRenderer.invoke('delete-item', path),
  renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke('rename-item', oldPath, newPath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
}); 