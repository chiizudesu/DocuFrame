import { contextBridge, ipcRenderer } from 'electron';
import { transferFiles } from './main/commands/transfer';
import { getConfig, setConfig } from './main/config';
import {
  selectDirectory,
  selectFile,
  getDirectoryContents,
  renameItem,
  deleteItem,
  createDirectory
} from './main/fileOperations';
import { handleCommand } from './main/commandHandler';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Command handling
  executeCommand: async (command: string, currentDirectory?: string) => {
    return await handleCommand(command, [], currentDirectory);
  },
  
  // Transfer command
  transfer: async (options: { numFiles?: number; newName?: string; command?: string; currentDirectory?: string }) => {
    return await transferFiles(options);
  },
  
  // Config management
  getConfig: async (key: string) => {
    return await getConfig(key);
  },
  setConfig: async (key: string, value: any) => {
    return await setConfig(key, value);
  },
  
  // Directory operations
  selectDirectory: async () => {
    return await selectDirectory();
  },
  selectFile: async (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => {
    return await selectFile(options);
  },
  getDirectoryContents: async (dirPath: string) => {
    return await getDirectoryContents(dirPath);
  },
  
  // File operations
  renameItem: async (oldPath: string, newPath: string) => {
    return await renameItem(oldPath, newPath);
  },
  deleteItem: async (path: string) => {
    return await deleteItem(path);
  },
  createDirectory: async (path: string) => {
    return await createDirectory(path);
  },
  
  // Drag and drop operations
  uploadFiles: async (files: { path: string; name: string }[], targetDirectory: string) => {
    return await ipcRenderer.invoke('upload-files', files, targetDirectory);
  },
  moveFiles: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('move-files', files, targetDirectory);
  },
  copyFiles: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('copy-files', files, targetDirectory);
  },
  
  // File icon support
  getFileIcon: async (filePath: string) => {
    return await ipcRenderer.invoke('get-file-icon', filePath);
  },
  
  // Window operations (from the existing API you have)
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  unmaximize: () => ipcRenderer.invoke('window-unmaximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximize: (callback: () => void) => ipcRenderer.on('window-maximized', callback),
  onWindowUnmaximize: (callback: () => void) => ipcRenderer.on('window-unmaximized', callback),
  
  // Other existing operations
  validatePath: async (dirPath: string) => {
    return await ipcRenderer.invoke('validate-path', dirPath);
  },
  openFile: async (filePath: string) => {
    return await ipcRenderer.invoke('open-file', filePath);
  },
  openDirectory: async (dirPath: string) => {
    return await ipcRenderer.invoke('open-directory', dirPath);
  },
  confirmDelete: async (fileNames: string[]) => {
    return await ipcRenderer.invoke('confirm-delete', fileNames);
  },
  
  // Folder contents changed event listener
  onFolderContentsChanged: (callback: (event: any, data: { directory: string }) => void) => {
    ipcRenderer.on('folderContentsChanged', callback);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  startDrag: (filePath: string) => ipcRenderer.send('ondragstart', filePath),
  readCsv: async (filePath: string) => {
    return await ipcRenderer.invoke('read-csv', filePath);
  }
}); 