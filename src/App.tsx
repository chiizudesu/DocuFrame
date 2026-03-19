import React, { useEffect, useState, useRef } from 'react';
import { Box, useColorMode, ChakraProvider, Input, useColorModeValue, Text, Flex } from '@chakra-ui/react';
import { theme } from './theme';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
import { SettingsWindow } from './components/SettingsWindow';
import { FloatingTaskTimerWindow } from './components/FloatingTaskTimerWindow';
import { AppProvider } from './context/AppContext';
import { ClientSearchOverlay } from './components/ClientSearchOverlay';
import { Calculator } from './components/Calculator';
import { eventMatchesShortcut } from './utils/shortcuts';
import { normalizePath, joinPath } from './utils/path';
import { useDirectorySearch } from './hooks/useDirectorySearch';
import type { FileItem } from './types';

// Invalid path characters for folder names (Windows)
const INVALID_FOLDER_CHARS = /[\\/:*?"<>|]/;

// Jump mode overlay component - simple 2 rows
const JumpModeOverlay: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  onNavigate: (path: string) => void;
  onOpenFile: (file: FileItem) => void;
  initialKey?: string;
  rootDirectory: string;
  initialDirectoryOverride?: string | null;
}> = ({ isOpen, onClose, currentDirectory, onNavigate, onOpenFile, initialKey, rootDirectory, initialDirectoryOverride }) => {
  const { addLog, setStatus } = useAppContext();
  const effectiveInitialDir = initialDirectoryOverride ?? currentDirectory;
  const [overlayPath, setOverlayPath] = useState(currentDirectory);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [overlayWorkingDirectory, setOverlayWorkingDirectory] = useState(currentDirectory);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    searchText,
    setSearchText,
    searchResults,
    selectedResultIndex,
    setSelectedResultIndex,
  } = useDirectorySearch({
    directoryPath: overlayPath,
    isActive: isOpen,
    initialSearchText: isOpen ? (initialKey || '') : '',
  });

  // Reset overlay when opening/closing
  useEffect(() => {
    if (isOpen) {
      const dirToLoad = effectiveInitialDir;
      setOverlayPath(dirToLoad);
      setOverlayWorkingDirectory(dirToLoad);
      setSelectedSegmentIndex(null);
      setIsNavigating(false);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      setOverlayPath(currentDirectory);
      setOverlayWorkingDirectory(currentDirectory);
      setSelectedSegmentIndex(null);
      setIsNavigating(false);
    }
  }, [isOpen, currentDirectory, effectiveInitialDir]);

  // When search text is cleared, reset to overlay's base dir
  useEffect(() => {
    if (!searchText.trim() && !isNavigating) {
      setOverlayPath(effectiveInitialDir);
      setOverlayWorkingDirectory(effectiveInitialDir);
    }
  }, [searchText, isNavigating, effectiveInitialDir]);

  // Reset selected segment when user starts typing
  useEffect(() => {
    if (searchText.trim() && selectedSegmentIndex !== null) {
      setSelectedSegmentIndex(null);
    }
  }, [searchText, selectedSegmentIndex]);

  // When no matches, reset to overlay working directory
  useEffect(() => {
    if (searchText.trim() && searchResults.length === 0 && overlayPath !== overlayWorkingDirectory && !isNavigating) {
      setOverlayPath(overlayWorkingDirectory);
    }
  }, [searchText, searchResults.length, overlayPath, overlayWorkingDirectory, isNavigating]);
  
  // Update preview path when selected result changes (search or arrow keys)
  useEffect(() => {
    if (searchResults.length === 0) return;
    const idx = Math.min(selectedResultIndex, searchResults.length - 1);
    const match = searchResults[idx];
    if (!match.path || match.path.length <= 2 || !match.path.includes('\\')) {
      if (overlayPath !== overlayWorkingDirectory) setOverlayPath(overlayWorkingDirectory);
      return;
    }
    let pathToSet = match.path;
    if (match.type === 'file') {
      const pathParts = normalizePath(match.path).split(/[\\/]/).filter(Boolean);
      if (pathParts.length > 1) {
        pathParts.pop();
        pathToSet = normalizePath(joinPath(...pathParts));
      } else {
        pathToSet = overlayWorkingDirectory;
      }
    }
    if (overlayPath !== pathToSet) setOverlayPath(pathToSet);
  }, [searchResults, selectedResultIndex, overlayWorkingDirectory, overlayPath]);
  
  const handleTab = async () => {
    if (searchResults.length === 0) return;
    const idx = Math.min(selectedResultIndex, searchResults.length - 1);
    const currentResult = searchResults[idx];
    if (currentResult.type === 'folder') {
      setOverlayPath(currentResult.path);
      setOverlayWorkingDirectory(currentResult.path);
      setIsNavigating(true);
      setSearchText('');
      setSelectedResultIndex(0);
      setSelectedSegmentIndex(null);
    } else {
      onOpenFile(currentResult);
      onClose();
    }
  };
  
  const handleBackspace = () => {
    if (searchText.length > 0) {
      return; // Let the input handle text deletion
    }

    if (selectedSegmentIndex === null) {
      const relativePath = getRelativePath(overlayPath);
      const pathSegments = relativePath.includes(' / ') ? relativePath.split(' / ') : [relativePath];

      if (pathSegments.length > 1) {
        setSelectedSegmentIndex(pathSegments.length - 2);
      } else if (pathSegments.length === 1 && pathSegments[0] !== 'Root') {
        setSelectedSegmentIndex(0);
      }
    } else {
      const relativePath = getRelativePath(overlayPath);
      const pathSegments = relativePath.includes(' / ') ? relativePath.split(' / ') : [relativePath];
      if (selectedSegmentIndex > 0 || (selectedSegmentIndex === 0 && pathSegments[0] !== 'Root')) {
        let parentPath: string;
        if (overlayPath === rootDirectory) {
          setSelectedSegmentIndex(null);
          return;
        }

        const pathParts = overlayPath.replace(/[/\\]+$/, '').split(/[/\\]/);
        if (pathParts.length > 1) {
          pathParts.pop();
          parentPath = pathParts.join('\\');
        } else {
          parentPath = rootDirectory;
        }

        setOverlayPath(parentPath);
        setSearchText('');
        setSelectedSegmentIndex(null);
        setIsNavigating(true);
      }
    }
  };

  const handleEnter = async () => {
    
    // If we have search results, use the selected one
    if (searchResults.length > 0) {
      const idx = Math.min(selectedResultIndex, searchResults.length - 1);
      const currentResult = searchResults[idx];
      
      if (currentResult.type === 'folder') {
        // Navigate to this folder in the real app
        onNavigate(currentResult.path);
        onClose();
      } else {
        // Open the file
        onOpenFile(currentResult);
        onClose();
      }
      return;
    }
    
    // If no search results, check if we can navigate to the current overlayPath
    if (overlayPath && overlayPath !== currentDirectory) {
      
      // Since overlayPath is different from currentDirectory, it's likely a valid path to navigate to
      // We don't need to check overlayFiles because overlayPath represents the target path
      onNavigate(overlayPath);
      onClose();
      return;
    }
    
    // No matches: create new folder with typed name
    const folderName = searchText.trim();
    if (folderName.length > 0) {
      if (folderName === '.' || folderName === '..') {
        setStatus('Invalid folder name', 'error');
        addLog('Invalid folder name: . or ..', 'error');
        return;
      }
      if (INVALID_FOLDER_CHARS.test(folderName)) {
        setStatus('Folder name contains invalid characters', 'error');
        addLog('Folder name contains invalid characters: \\ / : * ? " < > |', 'error');
        return;
      }
      try {
        const fullPath = joinPath(overlayWorkingDirectory === '/' ? '' : overlayWorkingDirectory, folderName);
        await (window.electronAPI as any).createDirectory(fullPath);
        addLog(`Created folder: ${folderName}`);
        setStatus(`Created folder: ${folderName}`, 'success');
        onNavigate(fullPath);
        onClose();
      } catch (error) {
        console.error('Error creating folder:', error);
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Failed to create folder: ${errMsg}`, 'error');
        setStatus(`Failed to create folder: ${folderName}`, 'error');
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleEnter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Backspace') {
      handleBackspace();
    }
  };

  // Handle click outside to close overlay
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle window focus/blur to reset overlay state
  useEffect(() => {
    if (!isOpen) return; // Early return for closed overlay
    
    const handleWindowBlur = () => {
      setSearchText('');
    };

    const handleWindowFocus = () => {
      // Refocus the input when window regains focus
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOpen, handleTab, handleEnter, onClose]);
  
  // Get color mode values at the top level
  const currentFolderBg = useColorModeValue('gray.600', 'gray.400');
  const currentFolderColor = useColorModeValue('white', 'gray.900');
  const selectedSegmentBg = useColorModeValue('orange.400', 'orange.500');
  const selectedSegmentColor = useColorModeValue('white', 'white');
  const selectedSegmentBorderColor = useColorModeValue('orange.500', 'orange.400');
  const separatorColor = useColorModeValue('gray.500', 'gray.400');
  const inputBg = useColorModeValue('white', 'gray.800');
  const inputColor = useColorModeValue('gray.800', 'white');
  const inputBorderColor = useColorModeValue('gray.300', 'gray.600');
  const pathBg = useColorModeValue('gray.50', 'gray.700');
  const pathTextColor = useColorModeValue('gray.600', 'gray.300');
  const highlightColor = useColorModeValue('blue.400', 'blue.500');
  
  // Helper function to get relative path from root
  const getRelativePath = React.useCallback((fullPath: string) => {
    
    if (!rootDirectory || !fullPath) return 'Root';
    
    // Normalize paths for comparison
    const normRoot = rootDirectory.replace(/\\/g, '/').replace(/\/+$/, '');
    const normPath = fullPath.replace(/\\/g, '/').replace(/\/+$/, '');
    
    if (normPath === normRoot) return 'Root';
    
    if (normPath.startsWith(normRoot)) {
      const relative = normPath.substring(normRoot.length).replace(/^\/+/, '');
      if (!relative) return 'Root';
      
      // Split by path separator and return meaningful segments
      const segments = relative.split('/').filter(Boolean);
      if (segments.length === 0) return 'Root';
      
      const result = segments.join(' / ');
      return result;
    }
    
    // If path doesn't start with root, return the last segment of the path
    const pathParts = fullPath.split(/[/\\]/).filter(Boolean);
    const result = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'Root';
    console.log('Last segment result:', { pathParts, result });
    return result;
  }, [rootDirectory]);

  // Memoize the path display to prevent infinite re-renders
  const pathDisplay = React.useMemo(() => {
    // Determine which path to display
    let displayPath = overlayPath;
    
    // If no search text and no navigation has happened, show current directory
    if (!searchText.trim() && overlayPath === currentDirectory) {
      displayPath = currentDirectory;
    }
    
    // For preview paths, we want to show the path relative to the overlay working directory
    let pathToDisplay: string;
    if (searchText.trim() && searchResults.length > 0) {
      // This is a preview path - show the selected search result in context
      const idx = Math.min(selectedResultIndex, searchResults.length - 1);
      const match = searchResults[idx];
      const matchPath = match.path;
      const matchName = match.name;
      
      // Check if the match is in a subdirectory or current directory
      if (matchPath === overlayWorkingDirectory) {
        // The match IS the current working directory (self-match), don't add duplicate
        pathToDisplay = getRelativePath(overlayWorkingDirectory);
      } else if (matchPath.startsWith(overlayWorkingDirectory + '\\') || matchPath.startsWith(overlayWorkingDirectory + '/')) {
        // The match is in a subdirectory of working directory - show: working + " / " + match
        const workingDirRelativePath = getRelativePath(overlayWorkingDirectory);
        pathToDisplay = workingDirRelativePath + " / " + matchName;
      } else {
        // The match is outside current working directory - show full path
        pathToDisplay = getRelativePath(matchPath);
      }
    } else {
      // Normal path display - show relative to root
      pathToDisplay = getRelativePath(displayPath);
    }
    
    // Split by " / " since getRelativePath returns segments joined with " / "
    const pathSegments = pathToDisplay.includes(' / ') ? pathToDisplay.split(' / ') : [pathToDisplay];
    
    return { pathToDisplay, pathSegments };
  }, [searchText, overlayPath, currentDirectory, overlayWorkingDirectory, rootDirectory, getRelativePath, searchResults, selectedResultIndex]);

  // Memoize the path segments rendering to prevent unnecessary re-renders
  const pathSegmentsDisplay = React.useMemo(() => {
    const { pathSegments } = pathDisplay;
    
    return pathSegments.map((segment, index, array) => {
      const isCurrentFolder = index === array.length - 1;
      const isSelected = index === selectedSegmentIndex;
      const isPreview = searchText.trim() && searchResults.length > 0 && isCurrentFolder;
      
      return (
        <React.Fragment key={index}>
          {isPreview ? (
            // Preview pill for search results (different from backspace pill)
            <Box
              bg="blue.400"
              color="white"
              px={3}
              py={1}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="full"
              display="inline-block"
              border="1px solid"
              borderColor="blue.500"
              boxShadow="0 1px 3px rgba(0, 0, 0, 0.1)"
            >
              {segment}
            </Box>
          ) : isCurrentFolder ? (
            <Box
              bg={currentFolderBg}
              color={currentFolderColor}
              px={3}
              py={1}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="md"
              display="inline-block"
            >
              {segment}
            </Box>
          ) : isSelected ? (
            // Backspace navigation pill (transparent with current folder bg color as border)
            <Box
              bg="transparent"
              color={currentFolderBg}
              px={3}
              py={1}
              fontSize="sm"
              fontWeight="bold"
              borderRadius="md"
              display="inline-block"
              border="2px solid"
              borderColor={currentFolderBg}
              transition="all 0.2s ease"
            >
              {segment}
            </Box>
          ) : (
            <Text display="inline-block">{segment}</Text>
          )}
          {index < array.length - 1 && (
            <Text mx={2} color={separatorColor} display="inline-block">/</Text>
          )}
        </React.Fragment>
      );
    });
  }, [pathDisplay, selectedSegmentIndex, searchText, searchResults, currentFolderBg, currentFolderColor, selectedSegmentBg, selectedSegmentColor, selectedSegmentBorderColor, separatorColor, overlayPath, currentDirectory, isNavigating]);
  
  // Early return after all hooks
  if (!isOpen) return null;
  
  return (
    <>
      {/* Input for capturing keystrokes - positioned over the overlay */}
      <Input
        ref={searchInputRef}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyPress={(e) => {
          // Ensure all keypress events are captured
          if (e.key.length === 1) {
            e.preventDefault();
            setSearchText(prev => prev + e.key);
          }
        }}
        onFocus={() => {}} // Empty function to avoid console warnings
        onBlur={() => {
          setSearchText('');
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
        borderRadius="md"
        overflow="hidden"
        border="5px solid"
        borderColor={highlightColor}
      >
        {/* Row 1: Current text input */}
        <Box
          bg={inputBg}
          color={inputColor}
          px={4}
          py={3}
          fontSize="lg"
          fontWeight="medium"
          textAlign="left"
          border="1px solid"
          borderColor={inputBorderColor}
          borderBottom="none"
        >
          {searchText || 'Type to search...'}
        </Box>
        
        {/* Row 2: Current directory path */}
        <Box
          bg={pathBg}
          px={4}
          py={2}
          border="1px solid"
          borderColor={inputBorderColor}
        >
          <Flex align="center" fontSize="sm" color={pathTextColor}>
            {pathSegmentsDisplay}
          </Flex>
        </Box>
      </Box>
    </>
  );
};

// Separate component to use context
const AppContent: React.FC = () => {
  const {
    colorMode,
    setColorMode
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
    rootDirectory,
    // Bring in shortcuts from context
    calculatorShortcut,
    jumpModeShortcut,
    jumpModeOnParentShortcut,
    backspaceNavigationShortcut,
    enableBackspaceNavigationShortcut,
  } = useAppContext();
  
  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  
  // Jump mode state
  const [initialJumpKey, setInitialJumpKey] = useState<string>('');
  const [jumpModeInitialDirectory, setJumpModeInitialDirectory] = useState<string | null>(null);
  
  // Check if this is the settings window
  const isSettingsWindow = window.location.hash === '#settings';
  const isFloatingTimerWindow = window.location.hash === '#floating-timer';
  // Listen for theme changes from other windows
  useEffect(() => {
    // Listen for IPC messages about theme changes
    const handleThemeChange = (_event: any, newTheme: 'light' | 'dark') => {
      if (newTheme === 'light' || newTheme === 'dark') {
        setColorMode(newTheme);
      }
    };

    if (window.electronAPI && (window.electronAPI as any).onMessage) {
      (window.electronAPI as any).onMessage('theme-changed', handleThemeChange);
    }

    // Listen for storage events (for same-window theme changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'chakra-ui-color-mode' && e.newValue) {
        if (e.newValue === 'light' || e.newValue === 'dark') {
          setColorMode(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (window.electronAPI && (window.electronAPI as any).removeListener) {
        (window.electronAPI as any).removeListener('theme-changed', handleThemeChange);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [setColorMode]);

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

      // Navigate up one directory level (configurable shortcut, default Backspace)
      // Uses eventMatchesShortcut so modifiers like Ctrl are not matched (e.g. Ctrl+Backspace = jump mode on parent)
      // Allow when overlay is active - when search input is focused, isInputFocused blocks this so backspace deletes text
      if (enableBackspaceNavigationShortcut && !isInputFocused && !isJumpModeActive && eventMatchesShortcut(e, backspaceNavigationShortcut)) {
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
      
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && e.key === 'Enter') {
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
      
      // Jump mode shortcut (configurable) - open on current directory
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && eventMatchesShortcut(e, jumpModeShortcut)) {
        e.preventDefault();
        setJumpModeInitialDirectory(null);
        setInitialJumpKey('');
        setIsJumpModeActive(true);
        return;
      }
      
      // Jump mode on parent shortcut (configurable) - open on parent directory
      if (!isInputFocused && !isQuickNavigating && !isJumpModeActive && eventMatchesShortcut(e, jumpModeOnParentShortcut)) {
        e.preventDefault();
        const parentPath = getParentDirectory(currentDirectory);
        if (parentPath && parentPath !== currentDirectory) {
          setJumpModeInitialDirectory(parentPath);
        } else {
          setJumpModeInitialDirectory(null);
        }
        setInitialJumpKey('');
        setIsJumpModeActive(true);
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
  }, [isQuickNavigating, setIsQuickNavigating, setInitialCommandMode, currentDirectory, setCurrentDirectory, addLog, setStatus, isCalculatorOpen, isJumpModeActive, jumpModeShortcut, jumpModeOnParentShortcut, backspaceNavigationShortcut, enableBackspaceNavigationShortcut]);
  
  // If this is the settings window, render only the settings
  if (isSettingsWindow) {
    return (
      <Box w="100%" h="100vh" bg={colorMode === 'dark' ? 'gray.900' : '#f8fafc'} color={colorMode === 'dark' ? 'white' : '#334155'} overflow="hidden" position="relative">
        <SettingsWindow isOpen={true} onClose={() => window.close()} />
      </Box>
    );
  }
  
  // If this is the floating timer window, render only the timer
  if (isFloatingTimerWindow) {
    return (
      <FloatingTaskTimerWindow 
        onClose={() => window.close()} 
      />
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
          setJumpModeInitialDirectory(null);
        }}
        currentDirectory={currentDirectory}
        onNavigate={setCurrentDirectory}
        onOpenFile={async (file) => {
          try {
            // Open file using electron API
            if (window.electronAPI && typeof (window.electronAPI as any).openFile === 'function') {
              await (window.electronAPI as any).openFile(file.path);
              console.log('Opened file:', file.path);
            } else {
              console.error('Electron API not available for file opening');
            }
          } catch (error) {
            console.error('Failed to open file:', file.path, error);
          }
        }}
        initialKey={initialJumpKey}
        rootDirectory={rootDirectory}
        initialDirectoryOverride={jumpModeInitialDirectory}
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
    <ChakraProvider theme={theme}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ChakraProvider>
  );
};