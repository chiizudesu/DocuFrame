import React, { useEffect, useState } from 'react';
import { useColorMode } from "./components/ui/color-mode";
import { Box } from '@chakra-ui/react';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
import { SettingsWindow } from './components/SettingsWindow';
import { Calculator } from './components/Calculator';
import { eventMatchesShortcut } from './utils/shortcuts';
import { showToast } from './components/ui/toaster';

const AppContent: React.FC = () => {
  const { colorMode, setColorMode } = useColorMode();
  const {
    isQuickNavigating,
    setIsQuickNavigating,
    setInitialCommandMode,
    isSettingsOpen,
    setIsSettingsOpen,
    setCurrentDirectory,
    setStatus,
    addLog,
    calculatorShortcut,
    jumpModeOnParentShortcut,
    enableJumpModeOnParentShortcut,
    addressBarJumpRef,
    rootDirectory,
    jumpModeQuickFolderPaths,
  } = useAppContext();
  
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const isSettingsWindow = window.location.hash === '#settings';

  useEffect(() => {
    const handleThemeChange = (_event: unknown, newTheme: 'light' | 'dark') => {
      if (newTheme === 'light' || newTheme === 'dark') {
        setColorMode(newTheme);
      }
    };

    if (window.electronAPI && (window.electronAPI as { onMessage?: (ch: string, fn: (e: unknown, t: 'light' | 'dark') => void) => void }).onMessage) {
      (window.electronAPI as { onMessage: (ch: string, fn: (e: unknown, t: 'light' | 'dark') => void) => void }).onMessage('theme-changed', handleThemeChange);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chakra-ui-color-mode' && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark') {
          setColorMode(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (window.electronAPI && (window.electronAPI as { removeListener?: (ch: string, fn: unknown) => void }).removeListener) {
        (window.electronAPI as { removeListener: (ch: string, fn: unknown) => void }).removeListener('theme-changed', handleThemeChange);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [setColorMode]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialPath = urlParams.get('initialPath');
    if (initialPath) {
      setCurrentDirectory(initialPath);
      setStatus(`Opened new window at: ${initialPath}`, 'info');
    }

    const handleSetInitialPath = (_event: unknown, path: string) => {
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

  useEffect(() => {
    window.electronAPI?.onUpdateAvailable?.((_event: Electron.IpcRendererEvent) => {
      addLog('Update available - downloading in background', 'info');
      setStatus('Update available - downloading in background', 'info');
    });

    window.electronAPI?.onUpdateDownloaded?.((_event: Electron.IpcRendererEvent) => {
      addLog('Update downloaded - restart to install', 'info');
      setStatus('Update downloaded - restart to install', 'info');
    });

    window.electronAPI?.onUpdateNotAvailable?.((_event: Electron.IpcRendererEvent) => {
      addLog('No updates available', 'info');
      setStatus('No updates available', 'info');
    });

    window.electronAPI?.onUpdateError?.((_event: Electron.IpcRendererEvent, error: string) => {
      addLog(`Update error: ${error}`, 'error');
      setStatus('Update check failed', 'error');
    });

    window.electronAPI?.onUpdateProgress?.((_event: Electron.IpcRendererEvent, progress: { percent?: number }) => {
      const percent = Math.round(progress.percent || 0);
      addLog(`Downloading update: ${percent}%`, 'info');
      setStatus(`Downloading update: ${percent}%`, 'info');
    });

    return () => {
      window.electronAPI?.removeAllListeners?.('update-available');
      window.electronAPI?.removeAllListeners?.('update-downloaded');
      window.electronAPI?.removeAllListeners?.('update-not-available');
      window.electronAPI?.removeAllListeners?.('update-error');
      window.electronAPI?.removeAllListeners?.('update-progress');
    };
  }, [addLog, setStatus]);

  useEffect(() => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { ok: true; filename: string } | { ok: false; error: string }
    ) => {
      if (data.ok) {
        showToast({
          title: 'Saved from Chrome extension',
          description: data.filename,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        showToast({
          title: 'Chrome extension save failed',
          description: data.error,
          status: 'error',
          duration: 8000,
          isClosable: true,
        });
      }
    };
    window.electronAPI?.onChromeBridgePdfResult?.(handler);
    return () => {
      window.electronAPI?.removeAllListeners?.('chromeBridgePdfResult');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const jump = addressBarJumpRef.current;

      if (
        enableJumpModeOnParentShortcut &&
        !isInputFocused &&
        !isQuickNavigating &&
        jump &&
        eventMatchesShortcut(e, jumpModeOnParentShortcut)
      ) {
        e.preventDefault();
        if (jump.isActive()) {
          jump.globalBackspace();
        } else {
          jump.openAtParentDirectory({ initialText: '' });
        }
        return;
      }
      
      if (!isInputFocused && !isQuickNavigating && jump) {
        const openJumpValidated = async (folderPath: string) => {
          if (!folderPath?.trim()) return;
          try {
            const ok = await window.electronAPI.validatePath(folderPath);
            if (!ok) {
              setStatus('Jump folder path is not accessible', 'error');
              return;
            }
            const api = addressBarJumpRef.current;
            const opened = api?.openAtPath(folderPath, { initialText: '' });
            if (opened === false) {
              setStatus('Jump shortcut folder is outside the current workspace trail', 'error');
            }
          } catch {
            setStatus('Jump folder path is not accessible', 'error');
          }
        };
        if (e.key === 'F1') {
          if (rootDirectory?.trim()) {
            e.preventDefault();
            void openJumpValidated(rootDirectory);
          }
          return;
        }
        const fn = ['F2', 'F3', 'F4'].indexOf(e.key);
        if (fn >= 0) {
          const p = jumpModeQuickFolderPaths[fn]?.trim();
          if (p) {
            e.preventDefault();
            void openJumpValidated(p);
            return;
          }
        }
      }

      if (!isInputFocused && !isQuickNavigating && e.key === 'Enter') {
        if (jump?.isActive()) {
          jump.applyEnterNavigation();
          e.preventDefault();
          return;
        }
        e.preventDefault();
        return;
      }
      
      if (!isInputFocused && !isQuickNavigating && e.ctrlKey && e.code === 'Space') {
        setIsQuickNavigating(true);
        setInitialCommandMode(true);
        e.preventDefault();
        return;
      }

      if (!isInputFocused && eventMatchesShortcut(e, calculatorShortcut)) {
        setIsCalculatorOpen(true);
        e.preventDefault();
        return;
      }
      
      if (
        !isInputFocused &&
        !isQuickNavigating &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (jump?.isActive()) {
          jump.appendFilterText(e.key);
        } else {
          jump?.openAtCurrentDirectory({ initialText: e.key });
        }
        return;
      }
      
      const jumpActive = addressBarJumpRef.current?.isActive() ?? false;
      if (!jumpActive && e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('escape-key-pressed'));
      }
    };

    // Capture phase so parent-folder Backspace / jump keys run before bubble handlers on the grid
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    isQuickNavigating,
    setIsQuickNavigating,
    setInitialCommandMode,
    calculatorShortcut,
    jumpModeOnParentShortcut,
    enableJumpModeOnParentShortcut,
    addressBarJumpRef,
    rootDirectory,
    jumpModeQuickFolderPaths,
    setStatus,
  ]);

  if (isSettingsWindow) {
    return (
      <Box
        w="100%"
        h="100vh"
        bg="df.canvas"
        color={colorMode === 'dark' ? 'white' : '#334155'}
        overflow="hidden"
        position="relative"
      >
        <SettingsWindow isOpen={true} onClose={() => window.close()} />
      </Box>
    );
  }
  
  return (
    <Box
      w="100%"
      h="100vh"
      bg="df.canvas"
      color={colorMode === 'dark' ? 'white' : '#334155'}
      overflow="hidden"
      position="relative"
    >
      <Layout />
      <QuickNavigateOverlay />
      {isSettingsOpen && <SettingsWindow isOpen onClose={() => setIsSettingsOpen(false)} />}
      {isCalculatorOpen && <Calculator isOpen onClose={() => setIsCalculatorOpen(false)} />}
    </Box>
  );
};

export const App: React.FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  useEffect(() => {
    const savedTheme = localStorage.getItem('chakra-ui-color-mode');
    if (!savedTheme && colorMode !== 'dark') {
      toggleColorMode();
    }
  }, []);
  return <AppContent />;
};
