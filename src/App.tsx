import React, { useEffect, useState, useRef } from 'react';
import { Box, useColorMode, ChakraProvider, Input, useColorModeValue } from '@chakra-ui/react';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
import { SettingsWindow } from './components/SettingsWindow';
import { AppProvider } from './context/AppContext';
import { ClientSearchOverlay } from './components/ClientSearchOverlay';
import { Calculator } from './components/Calculator';
import { eventMatchesShortcut } from './utils/shortcuts';
import type { FileItem } from './types';

// Jump mode overlay component - simple 2 rows
const JumpModeOverlay: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  sortedFiles: FileItem[];
  onNavigate: (path: string) => void;
  onOpenFile: (file: FileItem) => void;
  initialKey?: string;
}> = ({ isOpen, onClose, currentDirectory, sortedFiles, onNavigate, onOpenFile, initialKey }) => {
  const [searchText, setSearchText] = useState('');
  const [overlayPath, setOverlayPath] = useState(currentDirectory);
  const [overlayFiles, setOverlayFiles] = useState<FileItem[]>([]);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Reset overlay when opening
  useEffect(() => {
    if (isOpen) {
      setOverlayPath(currentDirectory);
      setOverlayFiles(sortedFiles);
      setSearchText(initialKey || '');
      setSearchResults([]);
      // Focus input after a short delay to ensure overlay is rendered
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Reset all state when overlay closes
      setSearchText('');
      setOverlayPath(currentDirectory);
      setOverlayFiles(sortedFiles);
      setSearchResults([]);
    }
  }, [isOpen, currentDirectory, sortedFiles, initialKey]);
  
  // Update search results when search text or overlay files change
  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    
    const query = searchText.toLowerCase();
    const matches = overlayFiles
      .filter(file => file.name.toLowerCase().includes(query))
      .sort((a, b) => {
        // Prioritize exact matches and folder matches
        const aStartsWith = a.name.toLowerCase().startsWith(query);
        const bStartsWith = b.name.toLowerCase().startsWith(query);
        const aIsFolder = a.type === 'folder';
        const bIsFolder = b.type === 'folder';
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        
        return a.name.localeCompare(b.name);
      })
      .slice(0, 1); // Only take first result
    
    setSearchResults(matches);
  }, [searchText, overlayFiles]);
  
  const handleTab = async () => {
    if (searchResults.length === 0) return;
    
    const currentResult = searchResults[0];
    if (currentResult.type === 'folder') {
      try {
        // Load files from the new folder
        const contents = await (window.electronAPI as any).getDirectoryContents(currentResult.path);
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
        
        // Navigate overlay to this folder
        setOverlayPath(currentResult.path);
        setOverlayFiles(files);
        setSearchText('');
        setSearchResults([]);
      } catch (error) {
        console.error('Failed to load directory contents:', error);
        // Fallback: just update the path
        setOverlayPath(currentResult.path);
        setSearchText('');
        setSearchResults([]);
      }
    } else {
      // Open the file
      onOpenFile(currentResult);
      onClose();
    }
  };
  
  const handleEnter = () => {
    if (searchResults.length === 0) return;
    
    const currentResult = searchResults[0];
    if (currentResult.type === 'folder') {
      // Navigate to this folder in the real app
      onNavigate(currentResult.path);
      onClose();
    } else {
      // Open the file
      onOpenFile(currentResult);
      onClose();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleEnter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Handle window focus/blur to reset overlay state
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isOpen) {
        setSearchText('');
        setSearchResults([]);
      }
    };

    const handleWindowFocus = () => {
      if (isOpen) {
        // Refocus the input when window regains focus
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };

    // Global keyboard handler for the overlay
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Tab') {
        e.preventDefault();
        handleTab();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleEnter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, handleTab, handleEnter, onClose]);
  
  if (!isOpen) return null;
  
  const currentResult = searchResults[0] || null;
  const previewPath = currentResult ? currentResult.path : overlayPath;
  
  return (
    <>
      {/* Input for capturing keystrokes - positioned over the overlay */}
      <Input
        ref={searchInputRef}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {}} // Empty function to avoid console warnings
        onBlur={() => {
          // Reset text when input loses focus
          setSearchText('');
          setSearchResults([]);
        }}
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={10000}
        opacity={0}
        autoFocus
        tabIndex={-1}
        w="1px"
        h="1px"
        border="none"
        outline="none"
        bg="transparent"
        pointerEvents="none"
      />
      
      {/* Simple 2-row overlay */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={9999}
        minW="500px"
        maxW="700px"
      >
        {/* Row 1: Current text path */}
        <Box
          bg={useColorModeValue('white', 'gray.800')}
          color={useColorModeValue('gray.800', 'white')}
          p={2}
          mb={1}
          borderRadius="md"
          fontSize="xs"
          textAlign="center"
          border="1px solid"
          borderColor={useColorModeValue('gray.200', 'gray.600')}
          boxShadow="lg"
        >
          {searchText || 'Type to search...'}
        </Box>
        
        {/* Row 2: Preview navigation path */}
        <Box
          bg={useColorModeValue('blue.50', 'blue.900')}
          color={useColorModeValue('blue.800', 'blue.100')}
          p={2}
          borderRadius="md"
          fontSize="xs"
          textAlign="center"
          border="1px solid"
          borderColor={useColorModeValue('blue.200', 'blue.700')}
          boxShadow="md"
        >
          {previewPath}
        </Box>
      </Box>
    </>
  );
};

// Separate component to use context
const AppContent: React.FC = () => {
  const {
    colorMode
  } = useColorMode();
  const {
    isQuickNavigating,
    setIsQuickNavigating,
    setInitialCommandMode,
    isSettingsOpen,
    setIsSettingsOpen,
    currentDirectory,
    setCurrentDirectory,
    setStatus,
    addLog,
    isJumpModeActive,
    setIsJumpModeActive,
    folderItems,
    // Bring in shortcuts from context
    calculatorShortcut,
  } = useAppContext();
  
  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  
  // Jump mode state
  const [initialJumpKey, setInitialJumpKey] = useState<string>('');

  // Check if this is the settings window
  const isSettingsWindow = window.location.hash === '#settings';

  // Handle initial path for new windows
  useEffect(() => {
    // Check URL parameters for initial path (development mode)
    const urlParams = new URLSearchParams(window.location.search);
    const initialPath = urlParams.get('initialPath');
    if (initialPath) {
      console.log('[App] Setting initial path from URL:', initialPath);
      setCurrentDirectory(initialPath);
      setStatus(`Opened new window at: ${initialPath}`, 'info');
    }

    // Listen for initial path from main process (production mode)
    const handleSetInitialPath = (_event: any, path: string) => {
      console.log('[App] Setting initial path from main process:', path);
      setCurrentDirectory(path);
      setStatus(`Opened new window at: ${path}`, 'info');
    };

    if (window.electronAPI?.onMessage) {
      window.electronAPI.onMessage('set-initial-path', handleSetInitialPath);
    }

    return () => {
      if (window.electronAPI?.removeListener) {
        window.electronAPI.removeListener('set-initial-path', handleSetInitialPath);
      }
    };
  }, [setCurrentDirectory, setStatus]);

  // Handle update events from main process
  useEffect(() => {
    // Update available
    window.electronAPI?.onUpdateAvailable?.((_event: Electron.IpcRendererEvent) => {
      addLog('Update available - downloading in background', 'info');
      setStatus('Update available - downloading in background', 'info');
    });

    // Update downloaded
    window.electronAPI?.onUpdateDownloaded?.((_event: Electron.IpcRendererEvent) => {
      addLog('Update downloaded - restart to install', 'info');
      setStatus('Update downloaded - restart to install', 'info');
    });

    // No update available
    window.electronAPI?.onUpdateNotAvailable?.((_event: Electron.IpcRendererEvent) => {
      addLog('No updates available', 'info');
      setStatus('No updates available', 'info');
    });

    // Update error
    window.electronAPI?.onUpdateError?.((_event: Electron.IpcRendererEvent, error: string) => {
      addLog(`Update error: ${error}`, 'error');
      setStatus('Update check failed', 'error');
    });

    // Update progress
    window.electronAPI?.onUpdateProgress?.((_event: Electron.IpcRendererEvent, progress: any) => {
      const percent = Math.round(progress.percent || 0);
      addLog(`Downloading update: ${percent}%`, 'info');
      setStatus(`Downloading update: ${percent}%`, 'info');
    });

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI?.removeAllListeners?.('update-available');
      window.electronAPI?.removeAllListeners?.('update-downloaded');
      window.electronAPI?.removeAllListeners?.('update-not-available');
      window.electronAPI?.removeAllListeners?.('update-error');
      window.electronAPI?.removeAllListeners?.('update-progress');
    };
  }, [addLog, setStatus]);



  // Handle keyboard events for quick navigation, backspace navigation, and jump mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input/textarea is focused
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      

      // Backspace to go up one directory level (only when jump mode is not active)
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && e.key === 'Backspace') {
        console.log('[App] Backspace navigation triggered:', { isInputFocused, isQuickNavigating, isJumpModeActive });
        e.preventDefault();
        const parentPath = getParentDirectory(currentDirectory);
        if (parentPath && parentPath !== currentDirectory) {
          setCurrentDirectory(parentPath);
          addLog(`Navigated up to: ${parentPath}`);
          setStatus(`Navigated up to: ${parentPath.split('\\').pop() || parentPath.split('/').pop() || parentPath}`, 'info');
        } else {
          setStatus('Already at root directory', 'info');
        }
        return;
      }
      
      // Debug Enter key handling (but allow it to pass through when jump mode is active)
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && e.key === 'Enter') {
        console.log('[App] Enter key pressed after navigation, preventing default');
        e.preventDefault();
        return;
      }
      

      
      // If Ctrl + Space is pressed, open in command mode
      if (!isInputFocused && !isQuickNavigating && e.ctrlKey && e.code === 'Space') {
        setIsQuickNavigating(true);
        setInitialCommandMode(true);
        e.preventDefault();
        return;
      }
      // Calculator shortcut (configurable)
      if (!isInputFocused && eventMatchesShortcut(e, calculatorShortcut)) {
        setIsCalculatorOpen(true);
        e.preventDefault();
        return;
      }
      
      // Activate jump mode on any key press when no input is focused and app is active
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setInitialJumpKey(e.key);
        setIsJumpModeActive(true);
        return;
      }
      

      
      // Escape key to cancel any ongoing operations (drag, etc.) - but allow it to pass through when jump mode is active
      if (!isJumpModeActive && e.key === 'Escape') {
        // Dispatch a custom event that components can listen to for resetting their state
        window.dispatchEvent(new CustomEvent('escape-key-pressed'));
      }
    };

    // Helper function to get parent directory
    const getParentDirectory = (path: string): string | null => {
      if (!path || path === '/') return null;
      
      // Handle Windows paths
      if (path.includes('\\')) {
        const parts = path.split('\\').filter(Boolean);
        if (parts.length <= 1) return null; // Already at root
        return parts.slice(0, -1).join('\\') + '\\';
      }
      
      // Handle Unix paths
      if (path.includes('/')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length <= 1) return null; // Already at root
        return '/' + parts.slice(0, -1).join('/');
      }
      
      return null;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isQuickNavigating, setIsQuickNavigating, setInitialCommandMode, currentDirectory, setCurrentDirectory, addLog, setStatus, isCalculatorOpen, isJumpModeActive]);
  
  // If this is the settings window, render only the settings
  if (isSettingsWindow) {
    return (
      <Box w="100%" h="100vh" bg={colorMode === 'dark' ? 'gray.900' : '#f8fafc'} color={colorMode === 'dark' ? 'white' : '#334155'} overflow="hidden" position="relative">
        <SettingsWindow isOpen={true} onClose={() => window.close()} />
      </Box>
    );
  }
  
  return <Box w="100%" h="100vh" bg={colorMode === 'dark' ? 'gray.900' : '#f8fafc'} color={colorMode === 'dark' ? 'white' : '#334155'} overflow="hidden" position="relative">
      <Layout />
      <QuickNavigateOverlay />
      <ClientSearchOverlay />
      <SettingsWindow isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <Calculator isOpen={isCalculatorOpen} onClose={() => setIsCalculatorOpen(false)} />
      <JumpModeOverlay
        isOpen={isJumpModeActive}
        onClose={() => {
          setIsJumpModeActive(false);
          setInitialJumpKey('');
        }}
        currentDirectory={currentDirectory}
        sortedFiles={folderItems}
        onNavigate={setCurrentDirectory}
        onOpenFile={(file) => {
          // Handle file opening - you may need to implement this based on your app's needs
          console.log('Opening file:', file.path);
        }}
        initialKey={initialJumpKey}
      />
    </Box>;
};

export const App: React.FC = () => {
  const {
    colorMode,
    toggleColorMode
  } = useColorMode();
  // Force dark mode on initial render only if no theme preference is set
  useEffect(() => {
    const savedTheme = localStorage.getItem('chakra-ui-color-mode');
    if (!savedTheme && colorMode !== 'dark') {
      toggleColorMode();
    }
  }, []);
  return (
    <ChakraProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ChakraProvider>
  );
};