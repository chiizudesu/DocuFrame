export interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
  originalName?: string;
  pages?: number;
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
  clientbasePath?: string;
  quickAccessPaths?: string[];
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
      getDownloadsPath: () => Promise<string>;
      createDirectory: (path: string) => Promise<void>;
      deleteItem: (path: string) => Promise<void>;
      renameItem: (oldPath: string, newPath: string) => Promise<void>;
      selectDirectory: () => Promise<string>;
      selectFile: (options?: { title?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string>;
      
      // Native file drag and drop as documented
      startDrag: (fileName: string) => void;
    };
    
    // Electron API for renderer process
    electronAPI: {
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
      onWindowMaximize: (cb: (event: any) => void) => void;
      onWindowUnmaximize: (cb: (event: any) => void) => void;
      onFolderContentsChanged: (cb: (event: any, data: { directory: string }) => void) => void;
      removeAllListeners: (channel: string) => void;
      readCsv: (filePath: string) => Promise<any[]>;
      moveFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      copyFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      moveFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      copyFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      readPdfText: (filePath: string) => Promise<string>;
      readFileAsBuffer: (filePath: string) => Promise<ArrayBuffer>;
      getPdfPageCount: (filePath: string) => Promise<{ success: boolean; pageCount: number; error?: string }>;
      loadYamlTemplate: (filePath: string) => Promise<any>;
      readTextFile: (filePath: string) => Promise<string>;
      writeTextFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean }>;
      getFileIcon: (filePath: string) => Promise<string | null>;
      showProperties: (filePath: string) => Promise<{ success: boolean }>;
      getFileStats: (filePath: string) => Promise<{ size: number; mtime: Date; ctime: Date; atime: Date; isFile: boolean; isDirectory: boolean }>;
      isFileBlocked: (filePath: string) => Promise<boolean>;
      unblockFile: (filePath: string) => Promise<boolean>;
      checkForUpdates: () => Promise<{ success: boolean; message: string }>;
      quitAndInstall: () => Promise<{ success: boolean }>;
      onUpdateAvailable: (cb: (event: any) => void) => void;
      onUpdateDownloaded: (cb: (event: any) => void) => void;
      onUpdateNotAvailable: (cb: (event: any) => void) => void;
      onUpdateError: (cb: (event: any, error: string) => void) => void;
      onUpdateProgress: (cb: (event: any, progress: any) => void) => void;
      updateGlobalShortcut: (config: AppSettings) => Promise<{ success: boolean }>;
      openCalculator: () => Promise<{ success: boolean }>;
      closeCalculator: () => Promise<{ success: boolean }>;
      getVersion: () => string;
      startWatchingDirectory: (dirPath: string) => Promise<{ success: boolean; message: string; watchedDirectories: string[] }>;
      stopWatchingDirectory: (dirPath: string) => Promise<{ success: boolean; message: string; watchedDirectories: string[] }>;
      getWatchedDirectories: () => Promise<{ success: boolean; directories: string[]; isEnabled: boolean }>;
      enableFileWatching: (enabled: boolean) => Promise<{ success: boolean; message: string; isEnabled: boolean }>;
      createBlankSpreadsheet: (filePath: string) => Promise<{ success: boolean; filePath: string }>;
      createWordDocument: (filePath: string) => Promise<{ success: boolean; filePath: string }>;
      copyWorkpaperTemplate: (templatePath: string, destPath: string) => Promise<{ success: boolean; destPath: string }>;
      getWorkpaperTemplates: () => Promise<{ success: boolean; templates: Array<{ name: string; path: string }> }>;
      openSettingsWindow: () => Promise<{ success: boolean }>;
      searchInDocuments: (options: { query: string; currentDirectory: string; maxResults?: number }) => Promise<FileItem[]>;
      searchFiles: (options: { query: string; searchPath: string; maxResults?: number; includeFiles?: boolean; includeFolders?: boolean; recursive?: boolean }) => Promise<FileItem[]>;

      // Additional missing methods
      onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
      openNewWindow: (path: string) => Promise<void>;
      // PDF file serving
      convertFilePathToHttpUrl: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
    };
  }
} 