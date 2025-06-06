import React, { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';
import { settingsService } from '../services/settings';

interface FileItem {
  name: string;
  type: 'folder' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
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
  commandHistory: string[];
  addCommand: (command: string) => void;
  isQuickNavigating: boolean;
  setIsQuickNavigating: (value: boolean) => void;
  initialCommandMode: boolean;
  setInitialCommandMode: (value: boolean) => void;
  allFiles: FileItem[];
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
  // Settings state
  const [rootDirectory, setRootDirectoryState] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Preview state
  const [previewFiles, setPreviewFiles] = useState<FileItem[]>([]);

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

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setOutputLogs(prev => [...prev, { message, timestamp, type }]);
  }, []);

  const clearLogs = useCallback(() => {
    setOutputLogs([]);
  }, []);

  const addCommand = (command: string) => {
    setCommandHistory(prev => [...prev, command]);
  };

  // Mock files for quick navigation
  const [allFiles, setAllFiles] = useState<FileItem[]>([{
    name: 'Documents',
    type: 'folder',
    path: '/Documents'
  }, {
    name: 'Images',
    type: 'folder',
    path: '/Images'
  }, {
    name: 'Templates',
    type: 'folder',
    path: '/Templates'
  }, {
    name: 'Invoice Templates',
    type: 'folder',
    path: '/Templates/Invoice Templates'
  }, {
    name: 'Report Templates',
    type: 'folder',
    path: '/Templates/Report Templates'
  }, {
    name: 'Clients',
    type: 'folder',
    path: '/Clients'
  }, {
    name: 'ABC Corp',
    type: 'folder',
    path: '/Clients/ABC Corp'
  }, {
    name: 'Financial Reports',
    type: 'folder',
    path: '/Clients/ABC Corp/Financial Reports'
  }, {
    name: 'Tax Documents',
    type: 'folder',
    path: '/Clients/ABC Corp/Tax Documents'
  }, {
    name: 'XYZ Ltd',
    type: 'folder',
    path: '/Clients/XYZ Ltd'
  }, {
    name: 'Contracts',
    type: 'folder',
    path: '/Clients/XYZ Ltd/Contracts'
  }, {
    name: 'Smith & Co',
    type: 'folder',
    path: '/Clients/Smith & Co'
  }, {
    name: 'Scripts',
    type: 'folder',
    path: '/Scripts'
  }, {
    name: 'report.pdf',
    type: 'pdf',
    path: '/Clients/ABC Corp/report.pdf',
    size: '2.4 MB'
  }, {
    name: 'invoice.pdf',
    type: 'pdf',
    path: '/Clients/ABC Corp/invoice.pdf',
    size: '1.2 MB'
  }, {
    name: 'screenshot.png',
    type: 'image',
    path: '/Images/screenshot.png',
    size: '856 KB'
  }, {
    name: 'notes.docx',
    type: 'document',
    path: '/Documents/notes.docx',
    size: '45 KB'
  }, {
    name: 'pdf_merge.js',
    type: 'document',
    path: '/Scripts/pdf_merge.js',
    size: '12 KB'
  }, {
    name: 'gst_rename.js',
    type: 'document',
    path: '/Scripts/gst_rename.js',
    size: '8 KB'
  }, {
    name: 'statement.pdf',
    type: 'pdf',
    path: '/Clients/XYZ Ltd/statement.pdf',
    size: '1.8 MB'
  }]);

  const value = {
    currentDirectory,
    setCurrentDirectory,
    outputLogs,
    addLog,
    clearLogs,
    commandHistory,
    addCommand,
    isQuickNavigating,
    setIsQuickNavigating,
    initialCommandMode,
    setInitialCommandMode,
    allFiles,
    // Settings
    rootDirectory,
    setRootDirectory,
    apiKey,
    setApiKey,
    isSettingsOpen,
    setIsSettingsOpen,
    // Preview
    previewFiles,
    setPreviewFiles
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