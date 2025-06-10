// src/types/electron.d.ts - TypeScript declarations for Electron APIs

import { Config } from '../services/config';
import type { FileItem, AppSettings } from './index';

interface PathInfo {
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
  readable: boolean;
  error?: string;
}

interface OperationResult {
  file: string;
  status: 'success' | 'error' | 'skipped';
  path?: string;
  error?: string;
  reason?: string;
}

interface ElectronAPI {
  getConfig: () => Promise<AppSettings>;
  setConfig: (config: AppSettings) => Promise<void>;
  validatePath: (path: string) => Promise<boolean>;
  getDirectoryContents: (path: string) => Promise<FileItem[]>;
  createDirectory: (path: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  renameItem: (oldPath: string, newPath: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
  selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string>;
  openFile: (filePath: string) => Promise<void>;
  confirmDelete: (fileNames: string[]) => Promise<boolean>;
  
  // Drag and drop operations
  uploadFiles: (files: { path: string; name: string }[], targetDirectory: string) => Promise<OperationResult[]>;
  moveFiles: (files: string[], targetDirectory: string) => Promise<OperationResult[]>;
  copyFiles: (files: string[], targetDirectory: string) => Promise<OperationResult[]>;
  
  // File icon support
  getFileIcon: (filePath: string) => Promise<string | null>;
  
  // CSV reading
  readCsv: (filePath: string) => Promise<any[]>;
  
  // Window operations
  minimize: () => void;
  maximize: () => void;
  unmaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onWindowMaximize: (callback: () => void) => void;
  onWindowUnmaximize: (callback: () => void) => void;
  
  // Event listeners
  onFolderContentsChanged: (callback: (event: any, data: { directory: string }) => void) => void;
  removeAllListeners: (channel: string) => void;
  startDrag: (filePath: string) => void;
}

declare global {
  interface Window {
    // Existing electron API
    electron: {
      // Settings
      getSettings: () => Promise<{ rootPath: string }>;
      setSettings: (settings: any) => Promise<void>;
      getRootPath: () => Promise<string>;
      setRootPath: (path: string) => Promise<void>;

      // File system operations
      getDirectoryContents: (path: string) => Promise<FileItem[]>;
      createDirectory: (path: string) => Promise<void>;
      deleteItem: (path: string) => Promise<void>;
      validatePath: (path: string) => Promise<boolean>;

      // Config operations
      getConfig: () => Promise<AppSettings>;
      setConfig: (config: AppSettings) => Promise<void>;
    };
    
    // New electronAPI for file explorer
    electronAPI: ElectronAPI;
  }
}

export {};