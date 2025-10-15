import React, { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { settingsService } from '../services/settings';

interface FileItem {
  name: string;
  type: 'folder' | 'file' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
  originalName?: string;
}

interface LogEntry {
  message: string;
  timestamp: string;
  type: 'error' | 'response' | 'command' | 'info';
}

interface AppContextType {
  currentDirectory: string;
  setCurrentDirectory: (path: string) => void;
  outputLogs: LogEntry[];
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  // Footer status system - independent of logs
  statusMessage: string;
  statusType: 'info' | 'success' | 'error' | 'default';
  setStatus: (message: string, type?: 'info' | 'success' | 'error' | 'default') => void;
  commandHistory: string[];
  addCommand: (command: string) => void;
  isQuickNavigating: boolean;
  setIsQuickNavigating: (value: boolean) => void;
  initialCommandMode: boolean;
  setInitialCommandMode: (value: boolean) => void;
  // Search mode state
  isSearchMode: boolean;
  setIsSearchMode: (value: boolean) => void;
  // File search system - replaced allFiles mock data
  searchResults: FileItem[];
  setSearchResults: (files: FileItem[]) => void;
  // Settings
  rootDirectory: string;
  setRootDirectory: (path: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  showOutputLog: boolean;
  setShowOutputLog: (show: boolean) => void;
  hideTemporaryFiles: boolean;
  setHideTemporaryFiles: (hide: boolean) => void;
  hideDotFiles: boolean;
  setHideDotFiles: (hide: boolean) => void;
  aiEditorInstructions: string;             // NEW
  setAiEditorInstructions: (instructions: string) => void; // NEW
  aiEditorAgent: 'openai' | 'claude';
  setAiEditorAgent: (agent: 'openai' | 'claude') => void;
  // Preview
  previewFiles: FileItem[];
  setPreviewFiles: (files: FileItem[]) => void;
  isPreviewPaneOpen: boolean;
  setIsPreviewPaneOpen: (isOpen: boolean) => void;
  selectAllFiles: () => void;
  setSelectAllFiles: (callback: () => void) => void;
  folderItems: FileItem[];
  setFolderItems: (items: FileItem[]) => void;
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  // Document insights functionality removed - now available as dedicated dialog
  // Clipboard for cut/copy/paste operations - persists across navigation
  clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
  setClipboard: (clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null }) => void;
  // Recently transferred files (for "new" indicator)
  recentlyTransferredFiles: string[];
  addRecentlyTransferredFiles: (filePaths: string[]) => void;
  clearRecentlyTransferredFiles: () => void;
  removeRecentlyTransferredFile: (filePath: string) => void;
  // New Tab Shortcut
  newTabShortcut: string;
  setNewTabShortcut: (shortcut: string) => void;
  // Task Timer file operation logging
  logFileOperation: (operation: string, details?: string) => void;
  setLogFileOperation: (fn: (operation: string, details?: string) => void) => void;
  // Close Tab Shortcut
  closeTabShortcut: string;
  setCloseTabShortcut: (shortcut: string) => void;
  // Additional shortcuts for SettingsWindow
  activationShortcut: string;
  setActivationShortcut: (shortcut: string) => void;
  calculatorShortcut: string;
  setCalculatorShortcut: (shortcut: string) => void;
  clientSearchShortcut: string;
  setClientSearchShortcut: (shortcut: string) => void;

  // Tab Management Functions
  addTabToCurrentWindow: (path?: string) => void;
  closeCurrentTab: () => void;
  // Settings reload function
  reloadSettings: () => Promise<void>;
  // Jump mode state
  isJumpModeActive: boolean;
  setIsJumpModeActive: (value: boolean) => void;
  // Quick Access (pinned folders)
  quickAccessPaths: string[];
  setQuickAccessPaths: (paths: string[]) => void;
  addQuickAccessPath: (path: string) => Promise<void>;
  removeQuickAccessPath: (path: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
  children: ReactNode;
}> = ({
  children
}) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [outputLogs, setOutputLogs] = useState<LogEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [isQuickNavigating, setIsQuickNavigating] = useState(false);
  const [initialCommandMode, setInitialCommandMode] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  // Footer status system
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'default'>('default');
  // File search system - replaced mock allFiles
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  // Settings state
  const [rootDirectory, setRootDirectoryState] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOutputLog, setShowOutputLog] = useState(true);
  const [hideTemporaryFiles, setHideTemporaryFiles] = useState<boolean>(true);
  const [hideDotFiles, setHideDotFiles] = useState<boolean>(true);
  const [aiEditorInstructions, setAiEditorInstructions] = useState<string>('Paste your raw email blurb below. The AI will rewrite it to be clearer, more professional, and polished, while keeping your tone and intent.');
  const [aiEditorAgent, setAiEditorAgent] = useState<'openai' | 'claude'>('openai');
  // Preview state
  const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);
  const [isPreviewPaneOpen, setIsPreviewPaneOpen] = useState<boolean>(false);
  const [selectAllFilesCallback, setSelectAllFilesCallback] = useState<() => void>(() => () => {});
  const [folderItems, setFolderItems] = useState<FileItem[]>([]);
  // Selected files for function buttons
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  // Clipboard for cut/copy/paste operations - persists across navigation
  const [clipboard, setClipboard] = useState<{ files: FileItem[]; operation: 'cut' | 'copy' | null }>({ files: [], operation: null });
  // Recently transferred files (for "new" indicator)
  const [recentlyTransferredFiles, setRecentlyTransferredFiles] = useState<string[]>([]);
  // New Tab Shortcut
  const [newTabShortcut, setNewTabShortcut] = useState<string>('Ctrl+T');
  // Close Tab Shortcut
  const [closeTabShortcut, setCloseTabShortcut] = useState<string>('Ctrl+W');
  // Additional shortcuts for SettingsWindow
  const [activationShortcut, setActivationShortcut] = useState<string>('`');
  const [calculatorShortcut, setCalculatorShortcut] = useState<string>('Alt+Q');
  const [clientSearchShortcut, setClientSearchShortcut] = useState<string>('Alt+F');

  // Jump mode state
  const [isJumpModeActive, setIsJumpModeActive] = useState<boolean>(false);
  // Quick Access (pinned folders)
  const [quickAccessPaths, setQuickAccessPaths] = useState<string[]>([]);
  
  // Task Timer file operation logging
  const [logFileOperation, setLogFileOperation] = useState<(operation: string, details?: string) => void>(() => () => {
    // Default no-op function
    console.log('[AppContext] logFileOperation called but not initialized yet');
  });

  // Settings loading function
  const loadSettings = useCallback(async () => {
    try {
      const settings = await settingsService.getSettings();
      if (settings.apiKey) {
        setApiKey(settings.apiKey);
      }
      if (settings.rootPath) {
        setRootDirectoryState(settings.rootPath);
        setCurrentDirectory(settings.rootPath);
      }
      // Load showOutputLog setting, default to true if not set
      setShowOutputLog(settings.showOutputLog !== false);
      // NEW: Load hideTemporaryFiles (default true when unset)
      setHideTemporaryFiles(settings.hideTemporaryFiles !== false);
      // NEW: Load hideDotFiles (default true when unset)
      setHideDotFiles(settings.hideDotFiles !== false);
      // NEW: Load AI editor instructions (default to current instructions if unset)
      if (settings.aiEditorInstructions !== undefined) {
        setAiEditorInstructions(settings.aiEditorInstructions);
      }
      // Load AI editor agent preference (default to 'openai' if unset)
      if (settings.aiEditorAgent) {
        setAiEditorAgent(settings.aiEditorAgent);
      }
      
      // Load all shortcut settings
      if (settings.newTabShortcut) {
        setNewTabShortcut(settings.newTabShortcut);
      }
      if (settings.closeTabShortcut) {
        setCloseTabShortcut(settings.closeTabShortcut);
      }
      if (settings.activationShortcut) {
        setActivationShortcut(settings.activationShortcut);
      }
      if (settings.calculatorShortcut) {
        setCalculatorShortcut(settings.calculatorShortcut);
      }
      if (settings.clientSearchShortcut) {
        setClientSearchShortcut(settings.clientSearchShortcut);
      }

      // Load quick access pinned paths
      if (Array.isArray(settings.quickAccessPaths)) {
        setQuickAccessPaths(settings.quickAccessPaths);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Wrapper functions to save to localStorage when settings change
  const setRootDirectory = (path: string) => {
    setRootDirectoryState(path);
    setCurrentDirectory(path);
  };
  
  // Enhanced setCurrentDirectory with path normalization
  const setCurrentDirectoryWithValidation = useCallback((path: string) => {
    if (!path || path.trim() === '') {
      console.warn('Attempted to set empty current directory');
      return;
    }
    
    // Basic client-side validation - the actual validation happens in components
    try {
      setCurrentDirectory(path);
    } catch (error) {
      console.error('Error setting current directory:', error);
    }
  }, []);

  // Wrapper for settings open/close with status updates
  const setIsSettingsOpenWithStatus = (isOpen: boolean) => {
    setIsSettingsOpen(isOpen);
    if (!isOpen) {
      setStatus('Settings closed', 'info');
    }
  };

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setOutputLogs(prev => [...prev, { message, timestamp, type }]);
  }, []);

  const clearLogs = useCallback(() => {
    setOutputLogs([]);
    setStatus('Cleared logs', 'success');
  }, []);

  const setStatus = useCallback((message: string, type: 'info' | 'success' | 'error' | 'default' = 'default') => {
    setStatusMessage(message);
    setStatusType(type);
  }, []);

  const addCommand = (command: string) => {
    setCommandHistory(prev => [...prev, command]);
  };

  const selectAllFiles = useCallback(() => {
    selectAllFilesCallback();
  }, [selectAllFilesCallback]);

  const setSelectAllFiles = useCallback((callback: () => void) => {
    setSelectAllFilesCallback(() => callback);
  }, []);

  const addRecentlyTransferredFiles = useCallback((filePaths: string[]) => {
    setRecentlyTransferredFiles(prev => [...prev, ...filePaths]);
  }, []);

  const clearRecentlyTransferredFiles = useCallback(() => {
    setRecentlyTransferredFiles([]);
  }, []);

  const removeRecentlyTransferredFile = useCallback((filePath: string) => {
    setRecentlyTransferredFiles(prev => prev.filter(path => path !== filePath));
  }, []);



  const addTabToCurrentWindow = useCallback((path?: string) => {
    if ((window as any).__tabFunctions?.addNewTab) {
      (window as any).__tabFunctions.addNewTab(path);
    }
  }, []);

  const closeCurrentTab = useCallback(() => {
    if ((window as any).__tabFunctions?.closeCurrentTab) {
      (window as any).__tabFunctions.closeCurrentTab();
    }
  }, []);

  // Persist helpers for quick access
  const addQuickAccessPath = useCallback(async (path: string) => {
    const normalized = path?.trim();
    if (!normalized) return;
    setQuickAccessPaths(prev => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
    try {
      const current = await settingsService.getSettings();
      const existing = Array.isArray(current.quickAccessPaths) ? current.quickAccessPaths : [];
      if (!existing.includes(normalized)) {
        await settingsService.setSettings({ ...current, quickAccessPaths: [...existing, normalized] });
      }
      setStatus('Pinned to Quick Access', 'success');
    } catch (e) {
      console.error('Failed to persist quick access:', e);
    }
  }, [setStatus]);

  const removeQuickAccessPath = useCallback(async (path: string) => {
    const normalized = path?.trim();
    if (!normalized) return;
    setQuickAccessPaths(prev => prev.filter(p => p !== normalized));
    try {
      const current = await settingsService.getSettings();
      const existing = Array.isArray(current.quickAccessPaths) ? current.quickAccessPaths : [];
      const updated = existing.filter(p => p !== normalized);
      await settingsService.setSettings({ ...current, quickAccessPaths: updated });
      setStatus('Unpinned from Quick Access', 'info');
    } catch (e) {
      console.error('Failed to persist quick access removal:', e);
    }
  }, [setStatus]);

  return (
    <AppContext.Provider value={{
      currentDirectory,
      setCurrentDirectory: setCurrentDirectoryWithValidation,
      outputLogs,
      addLog,
      clearLogs,
      statusMessage,
      statusType,
      setStatus,
      commandHistory,
      addCommand,
      isQuickNavigating,
      setIsQuickNavigating,
      initialCommandMode,
      setInitialCommandMode,
      isSearchMode,
      setIsSearchMode,
      searchResults,
      setSearchResults,
      rootDirectory,
      setRootDirectory,
      apiKey,
      setApiKey,
      isSettingsOpen,
      setIsSettingsOpen: setIsSettingsOpenWithStatus,
      showOutputLog,
      setShowOutputLog,
      hideTemporaryFiles,
      setHideTemporaryFiles,
      hideDotFiles,
      setHideDotFiles,
      aiEditorInstructions,                 // NEW
      setAiEditorInstructions,              // NEW
      aiEditorAgent,
      setAiEditorAgent,
      previewFiles,
      setPreviewFiles,
      isPreviewPaneOpen,
      setIsPreviewPaneOpen,
      selectAllFiles,
      setSelectAllFiles,
      folderItems,
      setFolderItems,
      selectedFiles,
      setSelectedFiles,
      clipboard,
      setClipboard,
      recentlyTransferredFiles,
      addRecentlyTransferredFiles,
      clearRecentlyTransferredFiles,
      removeRecentlyTransferredFile,
      newTabShortcut,
      setNewTabShortcut,
      closeTabShortcut,
      setCloseTabShortcut,
      activationShortcut,
      setActivationShortcut,
      calculatorShortcut,
      setCalculatorShortcut,
      clientSearchShortcut,
      setClientSearchShortcut,

      addTabToCurrentWindow,
      closeCurrentTab,
      reloadSettings: loadSettings,
      isJumpModeActive,
      setIsJumpModeActive,
      quickAccessPaths,
      setQuickAccessPaths,
      addQuickAccessPath,
      removeQuickAccessPath,
      logFileOperation,
      setLogFileOperation,
      // Document insights properties removed
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};