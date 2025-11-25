import React, { useEffect, useState, useRef } from 'react';
import { Box, useColorMode, ChakraProvider, Input, useColorModeValue, Text, Flex } from '@chakra-ui/react';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
import { SettingsWindow } from './components/SettingsWindow';
import { FloatingTaskTimerWindow } from './components/FloatingTaskTimerWindow';
import { TaskTimerSummaryDialog } from './components/TaskTimerSummaryDialog';
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
  rootDirectory: string;
}> = ({ isOpen, onClose, currentDirectory, sortedFiles, onNavigate, onOpenFile, initialKey, rootDirectory }) => {
  const [searchText, setSearchText] = useState('');
  const [overlayPath, setOverlayPath] = useState(currentDirectory);
  const [overlayFiles, setOverlayFiles] = useState<FileItem[]>([]);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null); // Track which segment is "selected" for backspace navigation
  const [isNavigating, setIsNavigating] = useState(false); // Track if we're actively navigating (not just searching)
  const [overlayWorkingDirectory, setOverlayWorkingDirectory] = useState(currentDirectory); // Track overlay's current working directory context
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Reset overlay when opening
  useEffect(() => {
    if (isOpen) {
      setOverlayPath(currentDirectory);
      setOverlayWorkingDirectory(currentDirectory); // Reset overlay working directory
      // Load files from the current directory instead of using sortedFiles from root
      (window.electronAPI as any).getDirectoryContents(currentDirectory).then((contents: any) => {
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
        setOverlayFiles(files);
        console.log('Loaded files from current directory:', currentDirectory, 'File count:', files.length);
        console.log('First 5 items in current directory:', files.slice(0, 5).map((f: any) => ({ name: f.name, path: f.path, type: f.type })));
      }).catch((error: any) => {
        console.error('Failed to load directory contents for current directory:', currentDirectory, error);
        // Fallback to sortedFiles if loading fails
      setOverlayFiles(sortedFiles);
      });
      setSearchText(initialKey || '');
      setSearchResults([]);
      setSelectedSegmentIndex(null); // Reset selected segment
      setIsNavigating(false); // Reset navigation flag
      // Focus input immediately to capture first keystroke
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      // Reset all state when overlay closes
      setSearchText('');
      setOverlayPath(currentDirectory);
      setOverlayWorkingDirectory(currentDirectory); // Reset overlay working directory
      setOverlayFiles([]); // Clear files when closing
      setSearchResults([]);
      setSelectedSegmentIndex(null); // Reset selected segment
      setIsNavigating(false); // Reset navigation flag
    }
  }, [isOpen, currentDirectory, sortedFiles, initialKey]);
  
  // Update search results when search text or overlay files change
  useEffect(() => {
    if (!searchText.trim()) {
      setSearchResults([]);
      
      // When search text is completely cleared, only reset to current directory
      // if we're not actively navigating (preserves Tab navigation state)
      if (!isNavigating) {
        setOverlayPath(currentDirectory);
        setOverlayWorkingDirectory(currentDirectory);
      }
      return;
    }
    
    // Reset selected segment when user starts typing (clears pill indicator)
    if (selectedSegmentIndex !== null) {
      setSelectedSegmentIndex(null);
      console.log('Cleared segment selection due to typing');
    }
    
    const query = searchText.toLowerCase();
    
    // Load files from the current directory if overlayFiles is empty or doesn't match current context
    if (overlayFiles.length === 0) {
      // Load files from the current overlayPath (which should be the directory we want to search in)
      const pathToLoad = overlayPath || currentDirectory;
      
      console.log('Loading files for search from:', pathToLoad);
      
      // Load files from the valid path
      (window.electronAPI as any).getDirectoryContents(pathToLoad).then((contents: any) => {
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
        setOverlayFiles(files);
        console.log('Loaded files for search:', files.length);
      }).catch((error: any) => {
        console.error('Failed to load directory contents for path:', pathToLoad, error);
      });
      return; // Wait for files to load before searching
    }
    
    // Since we're loading files from the correct directory, use all loaded files for searching
    // No need for complex path filtering since overlayFiles already contains the right files
    const currentLevelFiles = overlayFiles;
    
    console.log('Search filtering debug:', {
      query,
      overlayPath,
      currentDirectory,
      overlayFilesCount: overlayFiles.length,
      searchText: searchText
    });
    
    const matches = currentLevelFiles
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
    
    console.log('Search results debug:', {
      query,
      currentLevelFiles: currentLevelFiles.length,
      matches: matches.map(m => ({ name: m.name, path: m.path, type: m.type }))
    });
    
    // Debug: Show first few files/folders and whether they match the query
    console.log('First 5 files/folders with match status:');
    currentLevelFiles.slice(0, 5).forEach((file: any) => {
      const matchesQuery = file.name.toLowerCase().includes(query);
      console.log(`- ${file.name} (${file.type}): ${matchesQuery ? 'MATCH' : 'no match'} - query: "${query}"`);
    });
    
    setSearchResults(matches);
    
    // Update preview path as user types - this is the key for dynamic preview
    if (matches.length > 0) {
      const match = matches[0];
      
      console.log('Updating overlayPath with match:', {
        matchName: match.name,
        matchPath: match.path,
        currentOverlayPath: overlayPath
      });
      
      // Always update overlayPath to show the preview path
      // This allows users to see what they're about to navigate to
      // Validate that match.path is a proper full path
      if (match.path && match.path.length > 2 && match.path.includes('\\')) {
        // Only update if the path is actually different to prevent unnecessary re-renders
        if (overlayPath !== match.path) {
          console.log('Setting overlayPath to match.path:', match.path);
        setOverlayPath(match.path);
        }
      } else {
        // Fallback to overlay working directory
        if (overlayPath !== overlayWorkingDirectory) {
          console.log('Fallback: setting overlayPath to overlayWorkingDirectory:', overlayWorkingDirectory);
          setOverlayPath(overlayWorkingDirectory);
        }
      }
    } else {
      // If no matches, reset to the overlay working directory (not original currentDirectory)
      // This preserves navigation state when user clears search or has no matches
      if (overlayPath !== overlayWorkingDirectory && !isNavigating) {
        console.log('No matches, resetting overlayPath to overlayWorkingDirectory:', overlayWorkingDirectory);
        setOverlayPath(overlayWorkingDirectory);
      }
    }
  }, [searchText, overlayFiles, currentDirectory, overlayWorkingDirectory, isNavigating, selectedSegmentIndex]);
  
  const handleTab = async () => {
    if (searchResults.length === 0) return;
    
    const currentResult = searchResults[0];
    if (currentResult.type === 'folder') {
      try {
        // Load files from the new folder
        const contents = await (window.electronAPI as any).getDirectoryContents(currentResult.path);
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
        
        // Navigate overlay to this folder - update overlay context to this new directory
        setOverlayPath(currentResult.path);
        setOverlayFiles(files);
        setOverlayWorkingDirectory(currentResult.path); // Update overlay's working directory
        setIsNavigating(true); // Mark that we're actively navigating
        // Reset search text for new directory
        setSearchText('');
        setSearchResults([]);
        setSelectedSegmentIndex(null); // Reset segment selection
        
        console.log('Tab navigation to:', currentResult.path);
        console.log('Updated overlay working directory to:', currentResult.path);
        console.log('Loaded files in new directory:', files.length);
      } catch (error) {
        console.error('Failed to load directory contents:', error);
        // Fallback: just update the path
        setOverlayPath(currentResult.path);
        setOverlayWorkingDirectory(currentResult.path); // Update overlay's working directory
        setIsNavigating(true); // Mark that we're actively navigating
        setSearchText('');
        setSearchResults([]);
        setSelectedSegmentIndex(null); // Reset segment selection
      }
    } else {
      // Open the file
      onOpenFile(currentResult);
      onClose();
    }
  };
  
  const handleBackspace = () => {
    console.log('Backspace handler called:', {
      searchTextLength: searchText.length,
      selectedSegmentIndex,
      overlayPath
    });
    
    if (searchText.length > 0) {
      // Normal backspace behavior - let the input handle it
      console.log('Backspace: letting input handle text deletion');
      return;
    }
    
    // Smart backspace navigation when no text
    if (selectedSegmentIndex === null) {
      // First backspace: highlight the last segment (for visual pill indicator)
      const relativePath = getRelativePath(overlayPath);
      const pathSegments = relativePath.includes(' / ') ? relativePath.split(' / ') : [relativePath];
      
      console.log('First backspace logic:', {
        relativePath,
        pathSegments,
        segmentsLength: pathSegments.length
      });
      
      if (pathSegments.length > 1) {
        // Highlight the parent segment (second to last), not the current segment
        const parentIndex = pathSegments.length - 2;
        setSelectedSegmentIndex(parentIndex);
        console.log('SETTING SEGMENT INDEX TO:', parentIndex, 'for parent segment:', pathSegments[parentIndex]);
      } else if (pathSegments.length === 1 && pathSegments[0] !== 'Root') {
        // If we're one level deep, highlight the current segment to go to Root
        const currentIndex = 0;
        setSelectedSegmentIndex(currentIndex);
        console.log('SETTING SEGMENT INDEX TO:', currentIndex, 'to go to Root from:', pathSegments[currentIndex]);
      } else {
        console.log('Cannot highlight segment - already at root');
      }
    } else {
      // Second backspace: navigate up to parent folder
      const relativePath = getRelativePath(overlayPath);
      const pathSegments = relativePath.includes(' / ') ? relativePath.split(' / ') : [relativePath];
      if (selectedSegmentIndex > 0 || (selectedSegmentIndex === 0 && pathSegments[0] !== 'Root')) {
        
        // Calculate parent path - go up one level from current overlayPath
        let parentPath: string;
        if (overlayPath === rootDirectory) {
          // Already at root, can't go higher
          console.log('Already at root directory');
          setSelectedSegmentIndex(null);
          return;
        }
        
        // Get parent directory by removing last path segment
        const pathParts = overlayPath.replace(/[/\\]+$/, '').split(/[/\\]/);
        if (pathParts.length > 1) {
          pathParts.pop(); // Remove last segment
          parentPath = pathParts.join('\\');
        } else {
          parentPath = rootDirectory;
        }
        
        console.log('Backspace navigation:', {
          from: overlayPath,
          to: parentPath,
          segments: pathSegments,
          selectedIndex: selectedSegmentIndex
        });
        
        // Update overlay state
        setOverlayPath(parentPath);
        setSearchText('');
        setSearchResults([]);
        setSelectedSegmentIndex(null);
        setIsNavigating(true); // Mark as navigating to prevent reset to currentDirectory
        
        // Load files for the new parent directory
        (window.electronAPI as any).getDirectoryContents(parentPath).then((contents: any) => {
          const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
          setOverlayFiles(files);
          console.log('Loaded files for parent directory:', parentPath, 'count:', files.length);
        }).catch((error: any) => {
          console.error('Failed to load directory contents for parent path:', parentPath, error);
        });
      }
    }
  };

  const handleEnter = () => {
    
    // If we have search results, use the first one
    if (searchResults.length > 0) {
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
      setSearchResults([]);
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
    console.log('getRelativePath called with:', { fullPath, rootDirectory });
    
    if (!rootDirectory || !fullPath) return 'Root';
    
    // Normalize paths for comparison
    const normRoot = rootDirectory.replace(/\\/g, '/').replace(/\/+$/, '');
    const normPath = fullPath.replace(/\\/g, '/').replace(/\/+$/, '');
    
    console.log('Normalized paths:', { normRoot, normPath });
    
    if (normPath === normRoot) return 'Root';
    
    if (normPath.startsWith(normRoot)) {
      const relative = normPath.substring(normRoot.length).replace(/^\/+/, '');
      if (!relative) return 'Root';
      
      // Split by path separator and return meaningful segments
      const segments = relative.split('/').filter(Boolean);
      if (segments.length === 0) return 'Root';
      
      const result = segments.join(' / ');
      console.log('Relative path result:', { relative, segments, result });
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
      // This is a preview path - show the search result in context
      const match = searchResults[0];
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
  }, [searchText, overlayPath, currentDirectory, overlayWorkingDirectory, rootDirectory, getRelativePath, searchResults]);

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
    rootDirectory,
    // Bring in shortcuts from context
    calculatorShortcut,
  } = useAppContext();
  
  // Calculator state
  const [isCalculatorOpen, setIsCalculatorOpen] = React.useState(false);
  
  // Jump mode state
  const [initialJumpKey, setInitialJumpKey] = useState<string>('');

  // Check if this is the settings window
  const isSettingsWindow = window.location.hash === '#settings';
  const isFloatingTimerWindow = window.location.hash === '#floating-timer';
  const isTaskSummaryWindow = window.location.hash === '#task-summary';

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
      // But don't interfere if jump mode is already active
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
  
  // If this is the floating timer window, render only the timer
  if (isFloatingTimerWindow) {
    return (
      <FloatingTaskTimerWindow 
        onClose={() => window.close()} 
        onOpenSummary={async () => {
          // Open task timer summary window
          try {
            const result = await (window.electronAPI as any).openTaskSummaryWindow();
            if (!result.success) {
              console.error('[FloatingTimer] Error opening summary window:', result.error);
            }
          } catch (error) {
            console.error('[FloatingTimer] Error opening summary:', error);
          }
        }}
      />
    );
  }

  // If this is the task summary window, render only the summary
  if (isTaskSummaryWindow) {
    return (
      <Box w="100%" h="100vh" bg={colorMode === 'dark' ? 'gray.900' : '#f8fafc'} color={colorMode === 'dark' ? 'white' : '#334155'} overflow="hidden" position="relative">
        <TaskTimerSummaryDialog 
          isOpen={true} 
          onClose={() => window.close()} 
        />
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