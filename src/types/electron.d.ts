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
    electronAPI: {
      readDirectory: (dirPath: string) => Promise<FileItem[]>;
      checkPath: (dirPath: string) => Promise<PathInfo>;
      getHomeDirectory: () => Promise<string>;
      getRootDirectories: () => Promise<FileItem[]>;
    };
  }
}

export {};