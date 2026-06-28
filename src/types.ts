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

export interface Note {
  id: string;
  title: string;
  html: string;
}

export interface AppSettings {
  rootPath?: string;
  transferCommandMappings?: Record<string, string>;
  clientbasePath?: string;
  quickAccessPaths?: string[];
  notes?: Note[];
}

export interface TransferOptions {
  numFiles?: number;
  newName?: string;
  command?: string;
  currentDirectory?: string;
  preview?: boolean;
  fileNames?: string[];
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
      softDeleteItem: (path: string) => Promise<{ original: string; trashed: string }>;
      restoreTrashed: (entries: { original: string; trashed: string }[]) => Promise<{ original: string; status: 'success' | 'error'; error?: string }[]>;
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
      softDeleteItem: (path: string) => Promise<{ original: string; trashed: string }>;
      restoreTrashed: (entries: { original: string; trashed: string }[]) => Promise<{ original: string; status: 'success' | 'error'; error?: string }[]>;
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
      onChromeBridgePdfResult: (
        cb: (event: any, data: { ok: true; filename: string } | { ok: false; error: string }) => void
      ) => void;
      removeAllListeners: (channel: string) => void;
      readCsv: (filePath: string) => Promise<any[]>;
      moveFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      copyFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      moveFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      copyFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
      readPdfText: (filePath: string) => Promise<string>;
      readPdfPagesText: (filePath: string) => Promise<string[]>;
      readFileAsBuffer: (filePath: string) => Promise<ArrayBuffer>;
      getPdfPageCount: (filePath: string) => Promise<{ success: boolean; pageCount: number; error?: string }>;
      loadYamlTemplate: (filePath: string) => Promise<any>;
      readTextFile: (filePath: string) => Promise<string>;
      writeTextFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
      deleteFile: (filePath: string) => Promise<{ success: boolean }>;
      getFileIcon: (filePath: string) => Promise<string | null>;
      openFileInNotepad: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      openWindowsCreateShortcutWizard: (workingDirectory: string) => Promise<{ success: boolean; error?: string }>;
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
      createTextFile: (filePath: string) => Promise<{ success: boolean; filePath: string }>;
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
      readImageAsDataUrl: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
      getHomeDirectory: () => Promise<string>;
      getRootDirectories: () => Promise<FileItem[]>;
      checkPath: (path: string) => Promise<{ exists: boolean; isDirectory: boolean; isFile?: boolean }>;
      readDirectory: (path: string) => Promise<Array<FileItem & { isHidden?: boolean }>>;
      // Replace selected file with latest Downloads file
      replaceWithLatestFile: (targetFilePath: string) => Promise<{ success: boolean; message: string }>;
      uploadClientPdfsToVaults: (payload: {
        sourcePaths: string[];
        clientName: string;
        year: string;
        targetDir: string;
      }) => Promise<{
        success: boolean;
        message: string;
        copiedPaths?: string[];
        gitRoot?: string;
        stderr?: string;
      }>;
      onVaultUploadProgress: (cb: (event: any, data: { step: string; message: string }) => void) => void;
    };
  }
} 