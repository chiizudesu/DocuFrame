import { contextBridge, ipcRenderer } from 'electron';
import type { FileItem, AppSettings, TransferOptions } from '../src/types';

function getIpcErrorMessage(e: unknown): string {
  if (e == null) return 'Unknown error';
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

// Define the API interface
interface ElectronAPI {
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
  openCmdAtDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowMaximize: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onWindowUnmaximize: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onFolderContentsChanged: (cb: (event: Electron.IpcRendererEvent, data: { directory: string }) => void) => void;
  onChromeBridgePdfResult: (
    cb: (event: Electron.IpcRendererEvent, data: { ok: true; filename: string } | { ok: false; error: string }) => void
  ) => void;
  onChromeBridgeActivateSections: (
    cb: (event: Electron.IpcRendererEvent, data: { sections: string[] }) => void
  ) => void;
  removeAllListeners: (channel: string) => void;
  readCsv: (filePath: string) => Promise<any[]>;
  moveFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  copyFiles: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  moveFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  copyFilesWithConflictResolution: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  copyFileSilent: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
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
  onVaultUploadProgress: (
    cb: (event: Electron.IpcRendererEvent, data: { step: string; message: string }) => void,
  ) => void;
  moveFilesSilent: (files: string[], targetDirectory: string) => Promise<Array<{ file: string; status: string; path?: string; error?: string; reason?: string }>>;
  /** Puts real files on the Windows clipboard (CF_HDROP) for pasting into Outlook/Explorer */
  copyFilesToClipboard: (filePaths: string[]) => Promise<{ success: boolean; error?: string }>;
  zipSelection: (filePaths: string[], outputPath: string) => Promise<{ success: boolean; outputName?: string; error?: string }>;
  convertFileToPdf: (filePath: string) => Promise<{ success: boolean; outputName?: string; error?: string }>;
  splitPdf: (filePath: string, options: { mode: 'singles' | 'ranges'; ranges?: string } | { segments: Array<{ pages: number[]; name: string }> }) => Promise<{ success: boolean; outputFiles?: string[]; error?: string }>;
  editPdf: (filePath: string, options: { pages: number[]; outputName: string }) => Promise<{ success: boolean; outputFile?: string; overwritten?: boolean; backupPath?: string; error?: string }>;
  restoreFileBackup: (backupPath: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
  openFileWith: (filePath: string, app: string) => Promise<{ success: boolean; error?: string }>;
  readPdfText: (filePath: string) => Promise<string>;
  readPdfPagesText: (filePath: string) => Promise<string[]>;
  readSpreadsheetPreview: (filePath: string) => Promise<{ success: boolean; sheets?: Array<{ name: string; columns: Array<{ header: string; width: number }>; rows: string[][] }>; truncated?: boolean; error?: string }>;
  readDocxAsHtml: (filePath: string) => Promise<{ success: boolean; html?: string; error?: string }>;
  readFileAsBuffer: (filePath: string) => Promise<ArrayBuffer>;
  getPdfPageCount: (filePath: string) => Promise<{ success: boolean; pageCount: number; error?: string }>;
  loadYamlTemplate: (filePath: string) => Promise<any>;
  readTextFile: (filePath: string) => Promise<string>;
  writeTextFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
  deleteFile: (filePath: string) => Promise<{ success: boolean }>;
  getFileIcon: (filePath: string) => Promise<string | null>;
  openFileInNotepad: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  /** Windows: opens the Create Shortcut wizard for the given folder (Explorer New → Shortcut). */
  openWindowsCreateShortcutWizard: (workingDirectory: string) => Promise<{ success: boolean; error?: string }>;
  showProperties: (filePath: string) => Promise<{ success: boolean }>;
  // File properties methods
  getFileStats: (filePath: string) => Promise<{ size: number; mtime: Date; ctime: Date; atime: Date; isFile: boolean; isDirectory: boolean }>;
  isFileBlocked: (filePath: string) => Promise<boolean>;
  unblockFile: (filePath: string) => Promise<boolean>;
  // Update-related methods
  checkForUpdates: () => Promise<{ success: boolean; message: string }>;
  quitAndInstall: () => Promise<{ success: boolean }>;
  onUpdateAvailable: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateDownloaded: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateNotAvailable: (cb: (event: Electron.IpcRendererEvent) => void) => void;
  onUpdateError: (cb: (event: Electron.IpcRendererEvent, error: string) => void) => void;
  onUpdateProgress: (cb: (event: Electron.IpcRendererEvent, progress: any) => void) => void;
  // Global shortcut methods
  updateGlobalShortcut: (config: AppSettings) => Promise<{ success: boolean }>;
  // Calculator methods
  openCalculator: () => Promise<{ success: boolean }>;
  closeCalculator: () => Promise<{ success: boolean }>;
  // Version method
  getVersion: () => string;
  // File system watcher methods
  startWatchingDirectory: (dirPath: string) => Promise<{ success: boolean; message: string; watchedDirectories: string[] }>;
  stopWatchingDirectory: (dirPath: string) => Promise<{ success: boolean; message: string; watchedDirectories: string[] }>;
  getWatchedDirectories: () => Promise<{ success: boolean; directories: string[]; isEnabled: boolean }>;
  enableFileWatching: (enabled: boolean) => Promise<{ success: boolean; message: string; isEnabled: boolean }>;
  // Document creation methods
  createBlankSpreadsheet: (filePath: string) => Promise<{ success: boolean; filePath: string }>;
  createWordDocument: (filePath: string) => Promise<{ success: boolean; filePath: string }>;
  copyWorkpaperTemplate: (templatePath: string, destPath: string) => Promise<{ success: boolean; destPath: string }>;
  getWorkpaperTemplates: () => Promise<{ success: boolean; templates: Array<{ name: string; path: string }> }>;
  // Settings window method
  openSettingsWindow: () => Promise<{ success: boolean }>;
  // Search methods
  searchInDocuments: (options: { query: string; currentDirectory: string; maxResults?: number }) => Promise<FileItem[]>;
  searchFiles: (options: { query: string; searchPath: string; maxResults?: number; includeFiles?: boolean; includeFolders?: boolean; recursive?: boolean }) => Promise<FileItem[]>;
  // Additional missing methods
  onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
  openNewWindow: (path: string) => Promise<void>;
  selectPasteValue: (value: string) => Promise<{ success: boolean; error?: string }>;
  // PDF file serving
  convertFilePathToHttpUrl: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>;
  // Image clipboard methods
  saveImageFromClipboard: (currentDirectory: string, filename: string, base64Data: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  // Path paste methods
  getCurrentDirectory: () => Promise<string>;
  onCurrentDirectoryChanged: (callback: (directory: string) => void) => void;
  sendCurrentDirectoryChanged: (directory: string) => void;
  // Background image management methods
  getUserDataPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
  copyBackgroundImage: (sourcePath: string, backgroundType: 'watermark' | 'backgroundFill') => Promise<{ success: boolean; path?: string; relativePath?: string; error?: string }>;
  listBackgroundImages: (backgroundType: 'watermark' | 'backgroundFill') => Promise<{ success: boolean; images?: Array<{ filename: string; path: string; relativePath: string }>; error?: string }>;
  deleteBackgroundImage: (backgroundType: 'watermark' | 'backgroundFill', filename: string) => Promise<{ success: boolean; error?: string }>;
  resolveBackgroundPath: (relativePath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  // Path paste methods
  getCurrentDirectory: () => Promise<string>;
  onCurrentDirectoryChanged: (callback: (directory: string) => void) => void;
  // Replace selected file with latest Downloads file
  replaceWithLatestFile: (targetFilePath: string) => Promise<{ success: boolean; message: string }>;
  // Replace an existing file with a specific (named) Downloads file
  replaceFileFromDownloads: (downloadFileName: string, targetFilePath: string) => Promise<{ success: boolean; message: string; downloadName?: string }>;
  // Root path git integration (footer status indicator)
  rootGitStatus: (options?: { fetch?: boolean }) => Promise<{
    isRepo: boolean;
    gitRoot?: string;
    branch?: string;
    upstream?: string;
    ahead: number;
    behind: number;
    changedCount: number;
    untrackedCount: number;
    fetchFailed?: boolean;
  }>;
  rootGitPush: () => Promise<{ success: boolean; message: string }>;
  rootGitPull: () => Promise<{ success: boolean; message: string }>;
  rootGitDiscard: () => Promise<{ success: boolean; message: string }>;
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
    return await ipcRenderer.invoke('transfer-files', options);
  },

  // Root path git integration (footer status indicator)
  rootGitStatus: async (options?: { fetch?: boolean }) => {
    return await ipcRenderer.invoke('root-git-status', options);
  },
  rootGitPush: async () => {
    return await ipcRenderer.invoke('root-git-push');
  },
  rootGitPull: async () => {
    return await ipcRenderer.invoke('root-git-pull');
  },
  rootGitDiscard: async () => {
    return await ipcRenderer.invoke('root-git-discard');
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
  getDownloadsPath: async () => {
    return await ipcRenderer.invoke('get-downloads-path');
  },
  
  // File operations
  renameItem: async (oldPath: string, newPath: string) => {
    try {
      return await ipcRenderer.invoke('rename-item', oldPath, newPath);
    } catch (e: unknown) {
      // IPC often deserializes main-process throws as plain objects, not `instanceof Error`
      const msg = getIpcErrorMessage(e);
      const err = new Error(msg);
      if (typeof e === 'object' && e !== null && 'code' in e) {
        const c = (e as { code: unknown }).code;
        if (c === 'EBUSY' || c === 'EPERM' || c === 'ENOENT' || c === 'EACCES') {
          (err as NodeJS.ErrnoException).code = c;
        }
      }
      throw err;
    }
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
  openCmdAtDirectory: (dirPath: string) => ipcRenderer.invoke('open-cmd-at-directory', dirPath),
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  unmaximize: () => ipcRenderer.invoke('window-unmaximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximize: (cb) => ipcRenderer.on('window-maximized', cb),
  onWindowUnmaximize: (cb) => ipcRenderer.on('window-unmaximized', cb),
  onFolderContentsChanged: (cb) => ipcRenderer.on('folderContentsChanged', cb),
  onChromeBridgePdfResult: (cb) => ipcRenderer.on('chromeBridgePdfResult', cb),
  onChromeBridgeActivateSections: (cb) => ipcRenderer.on('chromeBridgeActivateSections', cb),
  onVaultUploadProgress: (cb) => ipcRenderer.on('vault-upload-progress', cb),
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
  moveFilesWithConflictResolution: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('move-files-with-conflict-resolution', files, targetDirectory);
  },
  copyFilesWithConflictResolution: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('copy-files-with-conflict-resolution', files, targetDirectory);
  },
  writeDroppedFiles: async (targetDirectory: string, files: Array<{ name: string; dataBase64: string }>) => {
    return await ipcRenderer.invoke('write-dropped-files', targetDirectory, files);
  },
  extractEmlSources: async (
    targetDirectory: string,
    sources: Array<{ name?: string; path?: string; dataBase64?: string }>,
  ) => {
    return await ipcRenderer.invoke('extract-eml-sources', targetDirectory, sources);
  },
  copyFileSilent: async (sourcePath: string, targetPath: string) => {
    return await ipcRenderer.invoke('copy-file-silent', sourcePath, targetPath);
  },
  uploadClientPdfsToVaults: async (payload) => {
    return await ipcRenderer.invoke('upload-client-pdfs-to-vaults', payload);
  },
  moveFilesSilent: async (files: string[], targetDirectory: string) => {
    return await ipcRenderer.invoke('move-files-silent', files, targetDirectory);
  },
  copyFilesToClipboard: async (filePaths: string[]) => {
    return await ipcRenderer.invoke('copy-files-to-clipboard', filePaths);
  },
  zipSelection: async (filePaths: string[], outputPath: string) => {
    return await ipcRenderer.invoke('zip-selection', filePaths, outputPath);
  },
  convertFileToPdf: async (filePath: string) => {
    return await ipcRenderer.invoke('convert-file-to-pdf', filePath);
  },
  splitPdf: async (filePath: string, options: { mode: 'singles' | 'ranges'; ranges?: string } | { segments: Array<{ pages: number[]; name: string }> }) => {
    return await ipcRenderer.invoke('split-pdf', filePath, options);
  },
  editPdf: async (filePath: string, options: { pages: number[]; outputName: string }) => {
    return await ipcRenderer.invoke('edit-pdf', filePath, options);
  },
  restoreFileBackup: async (backupPath: string, targetPath: string) => {
    return await ipcRenderer.invoke('restore-file-backup', backupPath, targetPath);
  },
  openFileWith: async (filePath: string, app: string) => {
    return await ipcRenderer.invoke('open-file-with', filePath, app);
  },
  readPdfText: async (filePath: string) => {
    return await ipcRenderer.invoke('read-pdf-text', filePath);
  },
  readPdfPagesText: async (filePath: string) => {
    return await ipcRenderer.invoke('read-pdf-pages-text', filePath);
  },
  readFileAsBuffer: async (filePath: string) => {
    return await ipcRenderer.invoke('read-file-as-buffer', filePath);
  },
  getPdfPageCount: async (filePath: string) => {
    return await ipcRenderer.invoke('get-pdf-page-count', filePath);
  },
  loadYamlTemplate: async (filePath: string) => {
    return await ipcRenderer.invoke('load-yaml-template', filePath);
  },
  readTextFile: async (filePath: string) => {
    return await ipcRenderer.invoke('read-text-file', filePath);
  },
  writeTextFile: async (filePath: string, content: string) => {
    return await ipcRenderer.invoke('write-text-file', filePath, content);
  },
  deleteFile: async (filePath: string) => {
    return await ipcRenderer.invoke('delete-file', filePath);
  },
  getFileIcon: async (filePath: string) => {
    return await ipcRenderer.invoke('get-file-icon', filePath);
  },
  openFileInNotepad: async (filePath: string) => {
    return await ipcRenderer.invoke('open-file-in-notepad', filePath);
  },
  openWindowsCreateShortcutWizard: async (workingDirectory: string) => {
    return await ipcRenderer.invoke('open-windows-create-shortcut-wizard', workingDirectory);
  },
  showProperties: async (filePath: string) => {
    return await ipcRenderer.invoke('show-properties', filePath);
  },
  // Update-related methods
  checkForUpdates: async () => {
    return await ipcRenderer.invoke('check-for-updates');
  },
  quitAndInstall: async () => {
    return await ipcRenderer.invoke('quit-and-install');
  },
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', cb),
  onUpdateError: (cb) => ipcRenderer.on('update-error', cb),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', cb),
  // Global shortcut methods
  updateGlobalShortcut: async (config: AppSettings) => {
    return await ipcRenderer.invoke('update-global-shortcut', config);
  },
  // Version method
  getVersion: () => {
    // Try to get version from various sources
    if (typeof globalThis !== 'undefined' && (globalThis as any).__APP_VERSION__) {
      return (globalThis as any).__APP_VERSION__;
    }
    if (typeof window !== 'undefined' && (window as any).__APP_VERSION__) {
      return (window as any).__APP_VERSION__;
    }
    // Fallback to current package.json version
    return '1.0.7';
  },
  // File properties methods
  getFileStats: async (filePath: string) => {
    return await ipcRenderer.invoke('get-file-stats', filePath);
  },
  isFileBlocked: async (filePath: string) => {
    return await ipcRenderer.invoke('is-file-blocked', filePath);
  },
  unblockFile: async (filePath: string) => {
    return await ipcRenderer.invoke('unblock-file', filePath);
  },
  // Calculator methods
  openCalculator: async () => {
    return await ipcRenderer.invoke('open-calculator');
  },
  closeCalculator: async () => {
    return await ipcRenderer.invoke('close-calculator');
  },
  // Window management methods
  openNewWindow: async (initialPath?: string) => {
    return await ipcRenderer.invoke('open-new-window', initialPath);
  },
  // Message handling for new windows
  onMessage: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  removeListener: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  // File system watcher methods
  startWatchingDirectory: async (dirPath: string) => {
    return await ipcRenderer.invoke('start-watching-directory', dirPath);
  },
  stopWatchingDirectory: async (dirPath: string) => {
    return await ipcRenderer.invoke('stop-watching-directory', dirPath);
  },
  getWatchedDirectories: async () => {
    return await ipcRenderer.invoke('get-watched-directories');
  },
  enableFileWatching: async (enabled: boolean) => {
    return await ipcRenderer.invoke('enable-file-watching', enabled);
  },
  // Document creation methods
  createTextFile: async (filePath: string) => {
    return await ipcRenderer.invoke('create-text-file', filePath);
  },
  createBlankSpreadsheet: async (filePath: string) => {
    return await ipcRenderer.invoke('create-blank-spreadsheet', filePath);
  },
  createWordDocument: async (filePath: string) => {
    return await ipcRenderer.invoke('create-word-document', filePath);
  },
  copyWorkpaperTemplate: async (templatePath: string, destPath: string) => {
    return await ipcRenderer.invoke('copy-workpaper-template', templatePath, destPath);
  },
  getWorkpaperTemplates: async () => {
    return await ipcRenderer.invoke('get-workpaper-templates');
  },
  // Settings window method
  openSettingsWindow: async () => {
    return await ipcRenderer.invoke('open-settings-window');
  },
  // Search methods
  searchInDocuments: async (options: { query: string; currentDirectory: string; maxResults?: number }) => {
    return await ipcRenderer.invoke('search-in-documents', options);
  },
  searchFiles: async (options: { query: string; searchPath: string; maxResults?: number; includeFiles?: boolean; includeFolders?: boolean; recursive?: boolean }) => {
    return await ipcRenderer.invoke('search-files', options);
  },
  // Additional missing methods
    convertFilePathToHttpUrl: async (filePath: string) => {
      return await ipcRenderer.invoke('convert-file-path-to-http-url', filePath);
    },
    readImageAsDataUrl: async (filePath: string) => {
      return await ipcRenderer.invoke('read-image-as-data-url', filePath);
    },
    readSpreadsheetPreview: async (filePath: string) => {
      return await ipcRenderer.invoke('read-spreadsheet-preview', filePath);
    },
    readDocxAsHtml: async (filePath: string) => {
      return await ipcRenderer.invoke('read-docx-as-html', filePath);
    },
  // Image clipboard methods
  saveImageFromClipboard: async (currentDirectory: string, filename: string, base64Data: string) => {
    return await ipcRenderer.invoke('save-image-from-clipboard', currentDirectory, filename, base64Data);
  },
  // Background image management methods
  getUserDataPath: async () => {
    return await ipcRenderer.invoke('get-user-data-path');
  },
  copyBackgroundImage: async (sourcePath: string, backgroundType: 'watermark' | 'backgroundFill') => {
    return await ipcRenderer.invoke('copy-background-image', sourcePath, backgroundType);
  },
  listBackgroundImages: async (backgroundType: 'watermark' | 'backgroundFill') => {
    return await ipcRenderer.invoke('list-background-images', backgroundType);
  },
  deleteBackgroundImage: async (backgroundType: 'watermark' | 'backgroundFill', filename: string) => {
    return await ipcRenderer.invoke('delete-background-image', backgroundType, filename);
  },
  resolveBackgroundPath: async (relativePath: string) => {
    return await ipcRenderer.invoke('resolve-background-path', relativePath);
  },
  // Path paste methods
  getCurrentDirectory: async () => {
    return await ipcRenderer.invoke('get-current-directory');
  },
  onCurrentDirectoryChanged: (callback: (directory: string) => void) => {
    ipcRenderer.on('current-directory-changed', (_, directory: string) => {
      callback(directory);
    });
  },
  sendCurrentDirectoryChanged: (directory: string) => {
    ipcRenderer.send('current-directory-changed', directory);
  },
  // Replace selected file with latest Downloads file
  replaceWithLatestFile: async (targetFilePath: string) => {
    return await ipcRenderer.invoke('replace-with-latest-file', targetFilePath);
  },
  // Replace an existing file with a specific (named) Downloads file
  replaceFileFromDownloads: async (downloadFileName: string, targetFilePath: string) => {
    return await ipcRenderer.invoke('replace-file-from-downloads', downloadFileName, targetFilePath);
  },
  selectPasteValue: async (value: string) => {
    return await ipcRenderer.invoke('select-paste-value', value);
  },

}); 

// Expose the electron API exactly as documented for native file drag and drop
contextBridge.exposeInMainWorld('electron', {
  startDrag: (files: string | string[]) => ipcRenderer.send('ondragstart', files)
});