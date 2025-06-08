export interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
  originalName?: string;
}

export interface LogEntry {
  message: string;
  timestamp: string;
  type: 'error' | 'response' | 'command' | 'info';
}

export interface AppSettings {
  rootPath?: string;
  apiKey?: string;
  transferCommandMappings?: Record<string, string>;
}

export interface TransferOptions {
  numFiles?: number;
  newName?: string;
  command?: string;
  currentDirectory?: string;
  preview?: boolean;
}

// Extend the Window interface to include our electron API
declare global {
  interface Window {
    electron: {
      getConfig: () => Promise<AppSettings>;
      setConfig: (config: AppSettings) => Promise<void>;
      validatePath: (path: string) => Promise<boolean>;
      getDirectoryContents: (path: string) => Promise<FileItem[]>;
      createDirectory: (path: string) => Promise<void>;
      deleteItem: (path: string) => Promise<void>;
      renameItem: (oldPath: string, newPath: string) => Promise<void>;
      selectDirectory: () => Promise<string>;
  selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string>;
    };
  }
} 