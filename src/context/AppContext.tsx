import React, { useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { settingsService } from '../services/settings';
import { normalizePath, getClientFolderPath } from '../utils/path';
import type { AddressBarJumpApi } from '../types/addressBarJump';
import {
  DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  LEGACY_JUMP_MODE_ON_PARENT_SHORTCUT,
} from '../constants/shortcutDefaults';

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
  addLog: (message: string, type?: LogEntry['type']) => void;
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
  // File search filter for filtering current directory
  fileSearchFilter: string;
  setFileSearchFilter: (filter: string) => void;
  // Content search results (files that match content search)
  contentSearchResults: FileItem[];
  setContentSearchResults: React.Dispatch<React.SetStateAction<FileItem[]>>;
  // File search system - replaced allFiles mock data
  searchResults: FileItem[];
  setSearchResults: (files: FileItem[]) => void;
  // Settings
  rootDirectory: string;
  setRootDirectory: (path: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  hideTemporaryFiles: boolean;
  setHideTemporaryFiles: (hide: boolean) => void;
  hideDotFiles: boolean;
  setHideDotFiles: (hide: boolean) => void;
  aiEditorInstructions: string;             // NEW
  setAiEditorInstructions: (instructions: string) => void; // NEW
  // Preview
  previewFiles: FileItem[];
  setPreviewFiles: (files: FileItem[]) => void;
  isPreviewPaneOpen: boolean;
  setIsPreviewPaneOpen: (isOpen: boolean) => void;
  isAIFileManagerOpen: boolean;
  setIsAIFileManagerOpen: (isOpen: boolean) => void;
  fileManagerInitialSelection: string[] | null;
  setFileManagerInitialSelection: (names: string[] | null) => void;
  selectAllFiles: () => void;
  setSelectAllFiles: (callback: () => void) => void;
  folderItems: FileItem[];
  setFolderItems: (items: FileItem[]) => void;
  setDisplayedDirectory: (path: string) => void;
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
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
  jumpModeOnParentShortcut: string;
  setJumpModeOnParentShortcut: (shortcut: string) => void;
  enableJumpModeOnParentShortcut: boolean;
  setEnableJumpModeOnParentShortcut: (value: boolean) => void;
  /** Three folder paths for F2–F4 jump mode (empty string = unset; F5 = refresh) */
  jumpModeQuickFolderPaths: string[];
  addressBarJumpRef: React.MutableRefObject<AddressBarJumpApi | null>;
  showClientInfoBar: boolean;
  setShowClientInfoBar: (show: boolean) => void;
  // Create folder dialog (opened from context menu or shortcut)
  isCreateFolderOpen: boolean;
  setIsCreateFolderOpen: (open: boolean) => void;

  // Tab Management Functions
  addTabToCurrentWindow: (path?: string) => void;
  closeCurrentTab: () => void;
  // Settings reload function
  reloadSettings: () => Promise<void>;
  // Quick Access (pinned folders)
  quickAccessPaths: string[];
  setQuickAccessPaths: (paths: string[]) => void;
  addQuickAccessPath: (path: string) => Promise<void>;
  removeQuickAccessPath: (path: string) => Promise<void>;
  moveQuickAccessPath: (path: string, direction: 'up' | 'down') => Promise<void>;
  // Recent client folders (latest 5 visited)
  recentClientPaths: string[];
  // File grouping by index prefix (computed from settings: always on except blacklist)
  isGroupedByIndex: boolean;
  /** Session-only: when false, flat list regardless of group-view settings (not persisted). */
  sessionLayerViewEnabled: boolean;
  setSessionLayerViewEnabled: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{
  children: ReactNode;
}> = ({
  children
}) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [isQuickNavigating, setIsQuickNavigating] = useState(false);
  const [initialCommandMode, setInitialCommandMode] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [fileSearchFilter, setFileSearchFilter] = useState<string>('');
  const [contentSearchResults, setContentSearchResults] = useState<FileItem[]>([]);
  // Footer status system
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'default'>('default');
  // File search system - replaced mock allFiles
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  // Settings state
  const [rootDirectory, setRootDirectoryState] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hideTemporaryFiles, setHideTemporaryFiles] = useState<boolean>(true);
  const [hideDotFiles, setHideDotFiles] = useState<boolean>(true);
  const [aiEditorInstructions, setAiEditorInstructions] = useState<string>('Paste your raw email blurb below. The AI will rewrite it to be clearer, more professional, and polished, while keeping your tone and intent.');
  // Preview state
  const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);
  const [isPreviewPaneOpen, setIsPreviewPaneOpen] = useState<boolean>(false);
  const [isAIFileManagerOpen, setIsAIFileManagerOpen] = useState<boolean>(false);
  const [fileManagerInitialSelection, setFileManagerInitialSelection] = useState<string[] | null>(null);
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
  const [jumpModeOnParentShortcut, setJumpModeOnParentShortcut] = useState<string>(
    DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  );
  const [enableJumpModeOnParentShortcut, setEnableJumpModeOnParentShortcut] = useState<boolean>(true);
  const [jumpModeQuickFolderPaths, setJumpModeQuickFolderPaths] = useState<string[]>(['', '', '']);
  const addressBarJumpRef = useRef<AddressBarJumpApi | null>(null);
  const [showClientInfoBar, setShowClientInfoBar] = useState<boolean>(true);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);

  // Quick Access (pinned folders)
  const [quickAccessPaths, setQuickAccessPaths] = useState<string[]>([]);
  // Recent client folders (latest 5 visited)
  const [recentClientPaths, setRecentClientPaths] = useState<string[]>([]);
  // File grouping by index prefix - always on except blacklisted directories (from settings)
  const [groupViewAlwaysEnabled, setGroupViewAlwaysEnabled] = useState<boolean>(true);
  const [groupViewBlacklist, setGroupViewBlacklist] = useState<string[]>([]);
  const [sessionLayerViewEnabled, setSessionLayerViewEnabled] = useState<boolean>(true);
  /** No-op: FileGrid still calls this after loads; group view uses currentDirectory only */
  const setDisplayedDirectory = useCallback((_path: string) => {}, []);
  
  // Task Timer file operation logging
  const [logFileOperation, setLogFileOperation] = useState<(operation: string, details?: string) => void>(() => () => {
    // Default no-op function
    console.log('[AppContext] logFileOperation called but not initialized yet');
  });

  // Settings loading function
  const loadSettings = useCallback(async () => {
    try {
      const settings = await settingsService.getSettings();
      if (settings.rootPath) {
        setRootDirectoryState(settings.rootPath);
        setCurrentDirectory(settings.rootPath);
      }
      // Load hideTemporaryFiles (default true when unset)
      setHideTemporaryFiles(settings.hideTemporaryFiles !== false);
      // NEW: Load hideDotFiles (default true when unset)
      setHideDotFiles(settings.hideDotFiles !== false);
      // NEW: Load AI editor instructions (default to current instructions if unset)
      if (settings.aiEditorInstructions !== undefined) {
        setAiEditorInstructions(settings.aiEditorInstructions);
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
      const jp = settings.jumpModeOnParentShortcut;
      if (!jp) {
        setJumpModeOnParentShortcut(DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT);
      } else if (jp === LEGACY_JUMP_MODE_ON_PARENT_SHORTCUT) {
        setJumpModeOnParentShortcut(DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT);
        settingsService
          .getSettings()
          .then((c) =>
            settingsService.setSettings({
              ...c,
              jumpModeOnParentShortcut: DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
            }),
          )
          .catch(() => {});
      } else {
        setJumpModeOnParentShortcut(jp);
      }
      setEnableJumpModeOnParentShortcut(settings.enableJumpModeOnParentShortcut !== false);
      {
        const next = ['', '', ''];
        const q = settings.jumpModeQuickFolderPaths;
        if (Array.isArray(q)) {
          for (let i = 0; i < 3; i++) {
            next[i] = typeof q[i] === 'string' ? q[i].trim() : '';
          }
        }
        setJumpModeQuickFolderPaths(next);
      }
      setShowClientInfoBar(settings.showClientInfoBar !== false);
      setGroupViewAlwaysEnabled(settings.groupViewAlwaysEnabled !== false);
      setGroupViewBlacklist(Array.isArray(settings.groupViewBlacklist) ? settings.groupViewBlacklist.map((p: string) => normalizePath(p)).filter(Boolean) : []);

      // Load quick access pinned paths
      if (Array.isArray(settings.quickAccessPaths)) {
        setQuickAccessPaths(settings.quickAccessPaths);
      }
      // Load recent client paths
      if (Array.isArray(settings.recentClientPaths)) {
        setRecentClientPaths(settings.recentClientPaths.slice(0, 5));
      }

    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Send current directory changes to main process for path paste shortcut
  useEffect(() => {
    if (currentDirectory) {
      try {
        // Send directly to main process via IPC
        if ((window as any).electronAPI?.sendCurrentDirectoryChanged) {
          (window as any).electronAPI.sendCurrentDirectoryChanged(currentDirectory);
        }
      } catch (error) {
        console.error('Error sending directory change to main process:', error);
      }
    }
  }, [currentDirectory]);

  // Update recent client folders when navigating to a client folder
  useEffect(() => {
    if (!currentDirectory || !rootDirectory) return;
    const clientPath = getClientFolderPath(currentDirectory, rootDirectory);
    if (!clientPath) return;
    setRecentClientPaths(prev => {
      const normalized = normalizePath(clientPath);
      const filtered = prev.filter(p => normalizePath(p) !== normalized);
      return [clientPath, ...filtered].slice(0, 5);
    });
  }, [currentDirectory, rootDirectory]);

  // Persist recent client paths when they change
  const prevRecentRef = useRef<string>('');
  useEffect(() => {
    if (prevRecentRef.current === JSON.stringify(recentClientPaths)) return;
    prevRecentRef.current = JSON.stringify(recentClientPaths);
    if (recentClientPaths.length === 0) return;
    settingsService.getSettings().then(current => {
      settingsService.setSettings({ ...current, recentClientPaths }).catch(() => {});
    });
  }, [recentClientPaths]);

  // Blacklist = disable group view only when the current folder path exactly matches an entry
  // (not for subfolders — e.g. Annual Accounts listed, but A & E Glass inside it still groups).
  const isGroupedByIndexFromSettings = useMemo(() => {
    if (!groupViewAlwaysEnabled) {
      return false;
    }
    const dir = normalizePath(currentDirectory || '');
    if (!dir) {
      return true;
    }
    const blacklistHits: string[] = [];
    const isBlacklisted = groupViewBlacklist.some((b) => {
      const nb = normalizePath(b);
      if (!nb) return false;
      if (dir === nb) {
        blacklistHits.push(nb);
        return true;
      }
      return false;
    });
    const result = !isBlacklisted;
    const hits = blacklistHits.length > 0 ? blacklistHits.join(' | ') : 'none';
    return result;
  }, [currentDirectory, groupViewAlwaysEnabled, groupViewBlacklist]);

  const isGroupedByIndex = sessionLayerViewEnabled && isGroupedByIndexFromSettings;

  // Wrapper functions to save to localStorage when settings change (stable ref for context consumers)
  const setRootDirectory = useCallback((path: string) => {
    setRootDirectoryState(path);
    setCurrentDirectory(path);
  }, []);

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

  const addLog = useCallback((_message: string, _type?: LogEntry['type']) => {
    // Output log removed - no-op for backward compatibility
  }, []);

  const setStatus = useCallback((message: string, type: 'info' | 'success' | 'error' | 'default' = 'default') => {
    setStatusMessage(message);
    setStatusType(type);
  }, []);

  // Wrapper for settings open/close with status updates
  const setIsSettingsOpenWithStatus = useCallback((isOpen: boolean) => {
    setIsSettingsOpen(isOpen);
    if (!isOpen) {
      setStatus('Settings closed', 'info');
    }
  }, [setStatus]);

  const addCommand = useCallback((command: string) => {
    setCommandHistory((prev) => [...prev, command]);
  }, []);

  const selectAllFiles = useCallback(() => {
    selectAllFilesCallback();
  }, [selectAllFilesCallback]);

  const setSelectAllFiles = useCallback((callback: () => void) => {
    setSelectAllFilesCallback(() => callback);
  }, []);

  const removeRecentlyTransferredFile = useCallback((filePath: string) => {
    const normalizedToRemove = filePath.replace(/\\/g, '/');
    setRecentlyTransferredFiles(prev =>
      prev.filter(p => p !== filePath && p.replace(/\\/g, '/') !== normalizedToRemove)
    );
  }, []);

  const addRecentlyTransferredFiles = useCallback((filePaths: string[]) => {
    if (filePaths.length === 0) return;
    setRecentlyTransferredFiles(prev => [...prev, ...filePaths]);
    filePaths.forEach((fp) => {
      setTimeout(() => removeRecentlyTransferredFile(fp), 5000);
    });
  }, [removeRecentlyTransferredFile]);

  const clearRecentlyTransferredFiles = useCallback(() => {
    setRecentlyTransferredFiles([]);
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

  const moveQuickAccessPath = useCallback(async (path: string, direction: 'up' | 'down') => {
    const normalized = path?.trim();
    if (!normalized) return;
    setQuickAccessPaths(prev => {
      const idx = prev.indexOf(normalized);
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
    try {
      const current = await settingsService.getSettings();
      const existing = Array.isArray(current.quickAccessPaths) ? current.quickAccessPaths : [];
      const idx = existing.indexOf(normalized);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= existing.length) return;
      const updated = [...existing];
      [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
      await settingsService.setSettings({ ...current, quickAccessPaths: updated });
    } catch (e) {
      console.error('Failed to persist quick access reorder:', e);
    }
  }, []);

  return (
    <AppContext.Provider value={{
      currentDirectory,
      setCurrentDirectory: setCurrentDirectoryWithValidation,
      addLog,
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
      fileSearchFilter,
      setFileSearchFilter,
      contentSearchResults,
      setContentSearchResults,
      searchResults,
      setSearchResults,
      rootDirectory,
      setRootDirectory,
      isSettingsOpen,
      setIsSettingsOpen: setIsSettingsOpenWithStatus,
      hideTemporaryFiles,
      setHideTemporaryFiles,
      hideDotFiles,
      setHideDotFiles,
      aiEditorInstructions,                 // NEW
      setAiEditorInstructions,              // NEW
      previewFiles,
      setPreviewFiles,
      isPreviewPaneOpen,
      setIsPreviewPaneOpen,
      isAIFileManagerOpen,
      setIsAIFileManagerOpen,
      fileManagerInitialSelection,
      setFileManagerInitialSelection,
      selectAllFiles,
      setSelectAllFiles,
      folderItems,
      setFolderItems,
      setDisplayedDirectory,
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
      jumpModeOnParentShortcut,
      setJumpModeOnParentShortcut,
      enableJumpModeOnParentShortcut,
      setEnableJumpModeOnParentShortcut,
      jumpModeQuickFolderPaths,
      addressBarJumpRef,
      showClientInfoBar,
      setShowClientInfoBar,
      isCreateFolderOpen,
      setIsCreateFolderOpen,

      addTabToCurrentWindow,
      closeCurrentTab,
      reloadSettings: loadSettings,
      quickAccessPaths,
      setQuickAccessPaths,
      addQuickAccessPath,
      removeQuickAccessPath,
      moveQuickAccessPath,
      recentClientPaths,
      logFileOperation,
      setLogFileOperation,
      isGroupedByIndex,
      sessionLayerViewEnabled,
      setSessionLayerViewEnabled,
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

/** Selective context hook for AIFileManagerPane - only re-renders when these values change, not on selectedFiles etc. */
export const useAIFileManagerContextSelection = () => {
  const currentDirectory = useContextSelector(AppContext, (v) => v?.currentDirectory ?? '');
  const folderItems = useContextSelector(AppContext, (v) => v?.folderItems ?? []);
  const isAIFileManagerOpen = useContextSelector(AppContext, (v) => v?.isAIFileManagerOpen ?? false);
  const setIsAIFileManagerOpen = useContextSelector(AppContext, (v) => v?.setIsAIFileManagerOpen);
  const fileManagerInitialSelection = useContextSelector(AppContext, (v) => v?.fileManagerInitialSelection ?? null);
  const setFileManagerInitialSelection = useContextSelector(AppContext, (v) => v?.setFileManagerInitialSelection);
  const addLog = useContextSelector(AppContext, (v) => v?.addLog);
  const setStatus = useContextSelector(AppContext, (v) => v?.setStatus);
  const logFileOperation = useContextSelector(AppContext, (v) => v?.logFileOperation);
  if (!setIsAIFileManagerOpen || !setFileManagerInitialSelection || !addLog || !setStatus || !logFileOperation) {
    throw new Error('useAIFileManagerContextSelection must be used within an AppProvider');
  }
  return {
    currentDirectory,
    folderItems,
    isAIFileManagerOpen,
    setIsAIFileManagerOpen,
    fileManagerInitialSelection,
    setFileManagerInitialSelection,
    addLog,
    setStatus,
    logFileOperation,
  };
};

// --- FileGrid: use useContextSelector so unrelated app state (status, settings flags, etc.)
// does not re-render the large FileGrid tree. See docs/filegrid-vs-file-manager-performance.md

export function useFileGridDirectoryState() {
  const currentDirectory = useContextSelector(AppContext, (v) => v?.currentDirectory ?? '');
  const setCurrentDirectory = useContextSelector(AppContext, (v) => v?.setCurrentDirectory);
  const rootDirectory = useContextSelector(AppContext, (v) => v?.rootDirectory ?? '');
  const folderItems = useContextSelector(AppContext, (v) => v?.folderItems ?? []);
  const setFolderItems = useContextSelector(AppContext, (v) => v?.setFolderItems);
  const setDisplayedDirectory = useContextSelector(AppContext, (v) => v?.setDisplayedDirectory);
  if (!setCurrentDirectory || !setFolderItems || !setDisplayedDirectory) {
    throw new Error('useFileGridDirectoryState must be used within an AppProvider');
  }
  return {
    currentDirectory,
    setCurrentDirectory,
    rootDirectory,
    folderItems,
    setFolderItems,
    setDisplayedDirectory,
  };
}

export function useFileGridSelectionState() {
  const selectedFiles = useContextSelector(AppContext, (v) => v?.selectedFiles ?? []);
  const setSelectedFiles = useContextSelector(AppContext, (v) => v?.setSelectedFiles);
  const setSelectAllFiles = useContextSelector(AppContext, (v) => v?.setSelectAllFiles);
  if (!setSelectedFiles || !setSelectAllFiles) {
    throw new Error('useFileGridSelectionState must be used within an AppProvider');
  }
  return { selectedFiles, setSelectedFiles, setSelectAllFiles };
}

export function useFileGridClipboardAndTransfers() {
  const clipboard = useContextSelector(
    AppContext,
    (v) => v?.clipboard ?? { files: [] as FileItem[], operation: null as 'cut' | 'copy' | null },
  );
  const setClipboard = useContextSelector(AppContext, (v) => v?.setClipboard);
  const recentlyTransferredFiles = useContextSelector(AppContext, (v) => v?.recentlyTransferredFiles ?? []);
  const addRecentlyTransferredFiles = useContextSelector(AppContext, (v) => v?.addRecentlyTransferredFiles);
  const clearRecentlyTransferredFiles = useContextSelector(AppContext, (v) => v?.clearRecentlyTransferredFiles);
  const removeRecentlyTransferredFile = useContextSelector(AppContext, (v) => v?.removeRecentlyTransferredFile);
  if (!setClipboard || !addRecentlyTransferredFiles || !clearRecentlyTransferredFiles || !removeRecentlyTransferredFile) {
    throw new Error('useFileGridClipboardAndTransfers must be used within an AppProvider');
  }
  return {
    clipboard,
    setClipboard,
    recentlyTransferredFiles,
    addRecentlyTransferredFiles,
    clearRecentlyTransferredFiles,
    removeRecentlyTransferredFile,
  };
}

export function useFileGridFiltersAndVisibility() {
  const fileSearchFilter = useContextSelector(AppContext, (v) => v?.fileSearchFilter ?? '');
  const setFileSearchFilter = useContextSelector(AppContext, (v) => v?.setFileSearchFilter);
  const contentSearchResults = useContextSelector(AppContext, (v) => v?.contentSearchResults ?? []);
  const hideTemporaryFiles = useContextSelector(AppContext, (v) => v?.hideTemporaryFiles ?? true);
  const hideDotFiles = useContextSelector(AppContext, (v) => v?.hideDotFiles ?? true);
  const isGroupedByIndex = useContextSelector(AppContext, (v) => v?.isGroupedByIndex ?? false);
  if (!setFileSearchFilter) {
    throw new Error('useFileGridFiltersAndVisibility must be used within an AppProvider');
  }
  return {
    fileSearchFilter,
    setFileSearchFilter,
    contentSearchResults,
    hideTemporaryFiles,
    hideDotFiles,
    isGroupedByIndex,
  };
}

export function useFileGridQuickAccessPaths() {
  const quickAccessPaths = useContextSelector(AppContext, (v) => v?.quickAccessPaths ?? []);
  return { quickAccessPaths };
}

export function useFileGridActions() {
  const addLog = useContextSelector(AppContext, (v) => v?.addLog);
  const setStatus = useContextSelector(AppContext, (v) => v?.setStatus);
  const addTabToCurrentWindow = useContextSelector(AppContext, (v) => v?.addTabToCurrentWindow);
  const addQuickAccessPath = useContextSelector(AppContext, (v) => v?.addQuickAccessPath);
  const removeQuickAccessPath = useContextSelector(AppContext, (v) => v?.removeQuickAccessPath);
  const logFileOperation = useContextSelector(AppContext, (v) => v?.logFileOperation);
  const setIsCreateFolderOpen = useContextSelector(AppContext, (v) => v?.setIsCreateFolderOpen);
  const setIsAIFileManagerOpen = useContextSelector(AppContext, (v) => v?.setIsAIFileManagerOpen);
  const setFileManagerInitialSelection = useContextSelector(AppContext, (v) => v?.setFileManagerInitialSelection);
  if (
    !addLog ||
    !setStatus ||
    !addTabToCurrentWindow ||
    !addQuickAccessPath ||
    !removeQuickAccessPath ||
    !logFileOperation ||
    !setIsCreateFolderOpen ||
    !setIsAIFileManagerOpen ||
    !setFileManagerInitialSelection
  ) {
    throw new Error('useFileGridActions must be used within an AppProvider');
  }
  return {
    addLog,
    setStatus,
    addTabToCurrentWindow,
    addQuickAccessPath,
    removeQuickAccessPath,
    logFileOperation,
    setIsCreateFolderOpen,
    setIsAIFileManagerOpen,
    setFileManagerInitialSelection,
  };
}

/** FileGridUI: address bar jump + quick-nav flag (avoid full useAppContext). */
export function useFileGridNavigationRefs() {
  const addressBarJumpRef = useContextSelector(AppContext, (v) => v?.addressBarJumpRef);
  const isQuickNavigating = useContextSelector(AppContext, (v) => v?.isQuickNavigating ?? false);
  if (!addressBarJumpRef) {
    throw new Error('useFileGridNavigationRefs must be used within an AppProvider');
  }
  return { addressBarJumpRef, isQuickNavigating };
}