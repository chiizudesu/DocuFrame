export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
  modified?: Date;
}

export interface AppSettings {
  rootPath: string;
  apiKey?: string;
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
    };
  }
} 