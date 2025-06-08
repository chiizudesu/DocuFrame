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
  // Preview
  previewFiles: FileItem[];
  setPreviewFiles: (files: FileItem[]) => void;
  selectAllFiles: () => void;
  setSelectAllFiles: (callback: () => void) => void;
  // Folder items
  folderItems: FileItem[];
  setFolderItems: (files: FileItem[]) => void;
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
  // Footer status system
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'default'>('default');
  // File search system - replaced mock allFiles
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  // Settings state
  const [rootDirectory, setRootDirectoryState] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Preview state
  const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);
  const [selectAllFiles, setSelectAllFiles] = useState<() => void>(() => () => {});
  const [folderItems, setFolderItems] = useState<FileItem[]>([]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        if (settings.apiKey) {
          setApiKey(settings.apiKey);
        }
        if (settings.rootPath) {
          setRootDirectoryState(settings.rootPath);
          setCurrentDirectory(settings.rootPath);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Wrapper functions to save to localStorage when settings change
  const setRootDirectory = (path: string) => {
    setRootDirectoryState(path);
    setCurrentDirectory(path);
  };

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

  const value = {
    currentDirectory,
    setCurrentDirectory,
    outputLogs,
    addLog,
    clearLogs,
    // Footer status system
    statusMessage,
    statusType,
    setStatus,
    commandHistory,
    addCommand,
    isQuickNavigating,
    setIsQuickNavigating,
    initialCommandMode,
    setInitialCommandMode,
    // File search system - replaced allFiles mock data
    searchResults,
    setSearchResults,
    // Settings
    rootDirectory,
    setRootDirectory,
    apiKey,
    setApiKey,
    isSettingsOpen,
    setIsSettingsOpen: setIsSettingsOpenWithStatus,
    // Preview
    previewFiles,
    setPreviewFiles,
    selectAllFiles,
    setSelectAllFiles,
    // Folder items
    folderItems,
    setFolderItems,
  };

  return <AppContext.Provider value={value}>
    {children}
  </AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};