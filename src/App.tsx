import React, { useEffect } from 'react';
import { Box, useColorMode, ChakraProvider } from '@chakra-ui/react';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
import { SettingsWindow } from './components/SettingsWindow';
import { AppProvider } from './context/AppContext';
import { ClientSearchOverlay } from './components/ClientSearchOverlay';
import { Calculator } from './components/Calculator';

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

  } = useAppContext();
  
  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);

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
      

      // Backspace to go up one directory level
      if (!isInputFocused && !isQuickNavigating && e.key === 'Backspace') {
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
      
      // If Ctrl + Space is pressed, open in command mode
      if (!isInputFocused && !isQuickNavigating && e.ctrlKey && e.code === 'Space') {
        setIsQuickNavigating(true);
        setInitialCommandMode(true);
        e.preventDefault();
        return;
      }
      // Calculator shortcut (Alt + Q)
      if (e.altKey && e.key.toLowerCase() === 'q') {
        setIsCalculatorOpen(true);
        e.preventDefault();
        return;
      }
      

      
      // Escape key to cancel any ongoing operations (drag, etc.)
      if (e.key === 'Escape') {
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
  }, [isQuickNavigating, setIsQuickNavigating, setInitialCommandMode, currentDirectory, setCurrentDirectory, addLog, setStatus, isCalculatorOpen]);
  
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