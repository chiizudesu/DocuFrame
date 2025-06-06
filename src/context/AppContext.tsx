import React, { useEffect, useState, createContext, useContext } from 'react';
interface FileItem {
  name: string;
  type: 'folder' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
}
interface AppContextType {
  currentDirectory: string;
  setCurrentDirectory: (path: string) => void;
  outputLogs: LogEntry[];
  addLog: (message: string, type?: string) => void;
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
}
interface LogEntry {
  timestamp: string;
  message: string;
  type: string;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export const AppProvider: React.FC<{
  children: ReactNode;
}> = ({
  children
}) => {
  const [currentDirectory, setCurrentDirectory] = useState<string>('/Clients');
  const [outputLogs, setOutputLogs] = useState<LogEntry[]>([{
    timestamp: getCurrentTime(),
    message: 'Application started',
    type: 'info'
  }, {
    timestamp: getCurrentTime(),
    message: 'Ready for commands',
    type: 'info'
  }]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [isQuickNavigating, setIsQuickNavigating] = useState(false);
  const [initialCommandMode, setInitialCommandMode] = useState(false);
  // Settings state
  const [rootDirectory, setRootDirectoryState] = useState<string>('');
  const [apiKey, setApiKeyState] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Load settings from localStorage on initial render
  useEffect(() => {
    const savedRootDir = localStorage.getItem('rootDirectory') || '';
    const savedApiKey = localStorage.getItem('apiKey') || '';
    setRootDirectoryState(savedRootDir);
    setApiKeyState(savedApiKey);
  }, []);
  // Wrapper functions to save to localStorage when settings change
  const setRootDirectory = (path: string) => {
    setRootDirectoryState(path);
    localStorage.setItem('rootDirectory', path);
  };
  const setApiKey = (key: string) => {
    setApiKeyState(key);
    localStorage.setItem('apiKey', key);
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
  function getCurrentTime(): string {
    return new Date().toLocaleTimeString();
  }
  const addLog = (message: string, type: string = 'info') => {
    setOutputLogs(prev => [...prev, {
      timestamp: getCurrentTime(),
      message,
      type
    }]);
  };
  const clearLogs = () => {
    setOutputLogs([{
      timestamp: getCurrentTime(),
      message: 'Logs cleared',
      type: 'info'
    }]);
  };
  const addCommand = (command: string) => {
    setCommandHistory(prev => [...prev, command]);
  };
  return <AppContext.Provider value={{
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
    setIsSettingsOpen
  }}>
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