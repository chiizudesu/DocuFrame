import React, { useEffect, useState, useRef } from 'react';
import { Box, useColorMode, ChakraProvider, Input, useColorModeValue, Text, Flex } from '@chakra-ui/react';
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
  rootDirectory: string;
}> = ({ isOpen, onClose, currentDirectory, sortedFiles, onNavigate, onOpenFile, initialKey, rootDirectory }) => {
  const [searchText, setSearchText] = useState('');
  const [overlayPath, setOverlayPath] = useState(currentDirectory);
  const [overlayFiles, setOverlayFiles] = useState<FileItem[]>([]);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number | null>(null); // Track which segment is "selected" for backspace navigation
  const [isNavigating, setIsNavigating] = useState(false); // Track if we're actively navigating (not just searching)
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Reset overlay when opening
  useEffect(() => {
    if (isOpen) {
      setOverlayPath(currentDirectory);
      setOverlayFiles(sortedFiles);
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
      setOverlayFiles(sortedFiles);
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
      }
      return;
    }
    
    // Only reset selected segment when user starts typing AND we're not in backspace navigation mode
    if (selectedSegmentIndex !== null) {
      console.log('Resetting selectedSegmentIndex because user started typing');
      setSelectedSegmentIndex(null);
    }
    
    const query = searchText.toLowerCase();
    
    // Load files from the current overlayPath if they don't match
    // Also check if overlayPath is valid before trying to load files
    if (overlayFiles.length === 0 || !overlayFiles.some(file => file.path.startsWith(overlayPath)) || !overlayPath || overlayPath.length < 3 || !overlayPath.includes('\\')) {
      // If overlayPath is invalid, use currentDirectory instead
      const pathToLoad = (overlayPath && overlayPath.length >= 3 && overlayPath.includes('\\')) ? overlayPath : currentDirectory;
      console.log('Loading files for path:', pathToLoad, 'overlayPath was:', overlayPath);
      console.log('Current overlayFiles:', overlayFiles.map((f: FileItem) => ({ name: f.name, path: f.path, type: f.type })));
      
      // Load files from the valid path
      (window.electronAPI as any).getDirectoryContents(pathToLoad).then((contents: any) => {
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
        setOverlayFiles(files);
        // Also fix overlayPath if it was corrupted
        if (!overlayPath || overlayPath.length < 3 || !overlayPath.includes('\\')) {
          setOverlayPath(pathToLoad);
          console.log('Fixed corrupted overlayPath from', overlayPath, 'to', pathToLoad);
        }
        console.log('Loaded', files.length, 'files for path:', pathToLoad);
        console.log('Sample files:', files.slice(0, 3).map((f: any) => ({ name: f.name, path: f.path, type: f.type })));
      }).catch((error: any) => {
        console.error('Failed to load directory contents for path:', pathToLoad, error);
      });
      return; // Wait for files to load before searching
    }
    
    // Only search in the current directory level, not in subdirectories
    // Add safety check for corrupted overlayPath
    let currentLevelFiles: FileItem[];
    if (!overlayPath || overlayPath.length < 3 || !overlayPath.includes('\\')) {
      console.warn('overlayPath is corrupted, using currentDirectory for filtering:', overlayPath);
      // Use currentDirectory for filtering if overlayPath is corrupted
      currentLevelFiles = overlayFiles.filter(file => {
        const fileDir = file.path.substring(0, file.path.lastIndexOf('\\') !== -1 ? file.path.lastIndexOf('\\') : file.path.lastIndexOf('/'));
        const currentDir = currentDirectory.substring(0, currentDirectory.lastIndexOf('\\') !== -1 ? currentDirectory.lastIndexOf('\\') : currentDirectory.lastIndexOf('/'));
        return fileDir === currentDir;
      });
      console.log('Searching in current level - currentDirectory:', currentDirectory, 'currentLevelFiles count:', currentLevelFiles.length, 'overlayFiles count:', overlayFiles.length);
    } else {
      currentLevelFiles = overlayFiles.filter(file => {
        // Check if the file is at the same directory level as overlayPath
        const fileDir = file.path.substring(0, file.path.lastIndexOf('\\') !== -1 ? file.path.lastIndexOf('\\') : file.path.lastIndexOf('/'));
        const overlayDir = overlayPath.substring(0, overlayPath.lastIndexOf('\\') !== -1 ? overlayPath.lastIndexOf('\\') : overlayPath.lastIndexOf('/'));
        return fileDir === overlayDir;
      });
      console.log('Searching in current level - overlayPath:', overlayPath, 'currentLevelFiles count:', currentLevelFiles.length, 'overlayFiles count:', overlayFiles.length);
    }
    
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
    
    console.log('Search results - query:', query, 'matches:', matches, 'currentLevelFiles count:', currentLevelFiles.length);
    setSearchResults(matches);
    
    // Update preview path as user types - this is the key for dynamic preview
    if (matches.length > 0) {
      const match = matches[0];
      
      // Always update overlayPath to show the preview path
      // This allows users to see what they're about to navigate to
      // Validate that match.path is a proper full path
      if (match.path && match.path.length > 2 && match.path.includes('\\')) {
        setOverlayPath(match.path);
        console.log('Updating overlayPath to show preview:', match.path);
      } else {
        console.warn('Invalid match.path, not updating overlayPath:', match.path);
        // Fallback to current directory
        setOverlayPath(currentDirectory);
      }
    } else {
      // If no matches, reset to the current directory for clean state
      // Don't try to manipulate overlayPath if it's corrupted
      if (overlayPath !== currentDirectory) {
        setOverlayPath(currentDirectory);
        console.log('No matches, resetting overlayPath to currentDirectory:', currentDirectory);
      }
    }
  }, [searchText, overlayFiles, currentDirectory, isNavigating, selectedSegmentIndex, overlayPath]);
  
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
        setIsNavigating(true); // Mark that we're actively navigating
        // Reset search text for new directory
        setSearchText('');
        setSearchResults([]);
      } catch (error) {
        console.error('Failed to load directory contents:', error);
        // Fallback: just update the path
        setOverlayPath(currentResult.path);
        setIsNavigating(true); // Mark that we're actively navigating
        setSearchText('');
        setSearchResults([]);
      }
    } else {
      // Open the file
      onOpenFile(currentResult);
      onClose();
    }
  };
  
  const handleBackspace = () => {
    if (searchText.length > 0) {
      // Normal backspace behavior - let the input handle it
      return;
    }
    
    console.log('handleBackspace called - searchText:', searchText, 'selectedSegmentIndex:', selectedSegmentIndex);
    
    // Smart backspace navigation when no text
    if (selectedSegmentIndex === null) {
      // First backspace: highlight the last segment
      const pathSegments = getRelativePath(overlayPath).split(/[/\\]/);
      console.log('First backspace - pathSegments:', pathSegments, 'overlayPath:', overlayPath);
      
      if (pathSegments.length > 1) {
        const newIndex = pathSegments.length - 1;
        setSelectedSegmentIndex(newIndex);
        console.log('Setting selectedSegmentIndex to:', newIndex, 'Highlighting segment:', pathSegments[newIndex]);
      }
    } else {
      // Second backspace: navigate up to parent folder
      const pathSegments = getRelativePath(overlayPath).split(/[/\\]/);
      if (selectedSegmentIndex > 0) {
        // Remove the selected segment and navigate up
        const parentSegments = pathSegments.slice(0, selectedSegmentIndex);
        
        console.log('Parent segments:', parentSegments, 'selectedSegmentIndex:', selectedSegmentIndex);
        
        // Build the parent path properly
        let parentPath: string;
        if (parentSegments.length === 0) {
          parentPath = 'Root';
        } else if (parentSegments[0] === 'Root') {
          // If first segment is 'Root', just use the remaining segments
          parentPath = parentSegments.slice(1).join('/');
        } else {
          parentPath = parentSegments.join('/');
        }
        
        console.log('Calculated parentPath:', parentPath);
        
        // Convert relative path back to full path
        if (parentPath === 'Root' || parentPath === '') {
          setOverlayPath(rootDirectory);
          console.log('Setting overlayPath to rootDirectory:', rootDirectory);
        } else {
          // Build the correct parent path without duplicating root folder name
          const fullParentPath = rootDirectory + '/' + parentPath;
          setOverlayPath(fullParentPath);
          console.log('Setting overlayPath to fullParentPath:', fullParentPath);
        }
        
        // Reset search state when navigating up
        setSearchText('');
        setSearchResults([]);
        setSelectedSegmentIndex(null);
        
        // Load files for the new parent directory
        const newPath = parentPath === 'Root' || parentPath === '' ? rootDirectory : rootDirectory + '/' + parentPath;
        (window.electronAPI as any).getDirectoryContents(newPath).then((contents: any) => {
          const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []);
          setOverlayFiles(files);
          console.log('Loaded', files.length, 'files for new parent path:', newPath);
        }).catch((error: any) => {
          console.error('Failed to load directory contents for new parent path:', newPath, error);
        });
        
        console.log('Navigating up to parent:', parentPath);
      }
    }
  };

  const handleEnter = () => {
    console.log('handleEnter called, searchResults:', searchResults, 'overlayPath:', overlayPath); // Debug log
    
    // If we have search results, use the first one
    if (searchResults.length > 0) {
      const currentResult = searchResults[0];
      console.log('Using search result:', currentResult); // Debug log
      
      if (currentResult.type === 'folder') {
        // Navigate to this folder in the real app
        console.log('Navigating to folder:', currentResult.path); // Debug log
        onNavigate(currentResult.path);
        onClose();
      } else {
        // Open the file
        console.log('Opening file:', currentResult.path); // Debug log
        onOpenFile(currentResult);
        onClose();
      }
      return;
    }
    
    // If no search results, check if we can navigate to the current overlayPath
    if (overlayPath && overlayPath !== currentDirectory) {
      console.log('No search results, trying to navigate to overlayPath:', overlayPath); // Debug log
      
      // Since overlayPath is different from currentDirectory, it's likely a valid path to navigate to
      // We don't need to check overlayFiles because overlayPath represents the target path
      console.log('Navigating to overlayPath:', overlayPath); // Debug log
      onNavigate(overlayPath);
      onClose();
      return;
    }
    
    console.log('No action possible - no search results and no valid overlayPath'); // Debug log
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      console.log('Enter pressed, calling handleEnter'); // Debug log
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
  
  // Early return after all hooks
  if (!isOpen) return null;
  
  // Helper function to get relative path from root
  const getRelativePath = (fullPath: string) => {
    if (!rootDirectory || fullPath === rootDirectory) return 'Root';
    
    // Normalize paths for comparison
    const normRoot = rootDirectory.replace(/\\/g, '/').replace(/\/+$/, '');
    const normPath = fullPath.replace(/\\/g, '/').replace(/\/+$/, '');
    
    if (normPath.startsWith(normRoot)) {
      const relative = normPath.substring(normRoot.length).replace(/^\/+/, '');
      if (!relative) return 'Root';
      
      // Just return the relative path without prepending root folder name
      // This prevents the triplication issue
      return relative;
    }
    
    return fullPath;
  };
  
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
        boxShadow="0 4px 20px rgba(0, 0, 0, 0.15)"
        borderRadius="md"
        overflow="hidden"
      >
        {/* Row 1: Current text input */}
        <Box
          bg={useColorModeValue('white', 'gray.800')}
          color={useColorModeValue('gray.800', 'white')}
          px={4}
          py={3}
          fontSize="lg"
          fontWeight="medium"
          textAlign="left"
          border="1px solid"
          borderColor={useColorModeValue('gray.300', 'gray.600')}
          borderBottom="none"
        >
          {searchText || 'Type to search...'}
        </Box>
        
        {/* Row 2: Current directory path */}
        <Box
          bg={useColorModeValue('gray.50', 'gray.700')}
          px={4}
          py={2}
          border="1px solid"
          borderColor={useColorModeValue('gray.300', 'gray.600')}
        >
          <Flex align="center" fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
            {(() => {
              // Determine which path to display
              let displayPath = overlayPath;
              
              // If no search text and no navigation has happened, show current directory
              if (!searchText.trim() && overlayPath === currentDirectory) {
                displayPath = currentDirectory;
              }
              
              // Debug logging for path display
              console.log('Path display debug - searchText:', searchText, 'overlayPath:', overlayPath, 'currentDirectory:', currentDirectory, 'displayPath:', displayPath);
              
              // For preview paths, we want to show the path relative to the current directory, not the root
              let pathToDisplay: string;
              if (searchText.trim() && overlayPath !== currentDirectory) {
                // This is a preview path - show it relative to current directory
                if (overlayPath.startsWith(currentDirectory)) {
                  // If the preview path is within the current directory, show the relative part
                  const relativePart = overlayPath.substring(currentDirectory.length).replace(/^[/\\]+/, '');
                  if (relativePart) {
                    // Extract just the filename/folder name, not the full path
                    const lastSegment = relativePart.split(/[/\\]/)[0];
                    // Show: currentDirectory + " / " + lastSegment
                    pathToDisplay = getRelativePath(currentDirectory) + " / " + lastSegment;
                  } else {
                    pathToDisplay = getRelativePath(currentDirectory);
                  }
                } else {
                  // If the preview path is outside current directory, show the full relative path from root
                  pathToDisplay = getRelativePath(overlayPath);
                }
              } else {
                // Normal path display - show relative to root
                pathToDisplay = getRelativePath(displayPath);
              }
              
              console.log('Final pathToDisplay:', pathToDisplay);
              
              const pathSegments = pathToDisplay.split(/[/\\]/);
              console.log('Path segments after split:', pathSegments);
              
              // Debug logging for highlighting
              if (selectedSegmentIndex !== null) {
                console.log('Path display - selectedSegmentIndex:', selectedSegmentIndex, 'pathSegments:', pathSegments, 'overlayPath:', overlayPath, 'displayPath:', displayPath);
                console.log('Path segments array:', pathSegments.map((seg, i) => `${i}: ${seg}`));
              }
              
              return pathSegments.map((segment, index, array) => {
                const isCurrentFolder = index === array.length - 1;
                const isSelected = index === selectedSegmentIndex;
                
                // Debug logging for each segment
                if (selectedSegmentIndex !== null) {
                  console.log(`Segment ${index}: "${segment}" - isCurrentFolder: ${isCurrentFolder}, isSelected: ${isSelected}`);
                }
                
                return (
                  <React.Fragment key={index}>
                    {isCurrentFolder ? (
                      <Box
                        bg={useColorModeValue('gray.600', 'gray.400')}
                        color={useColorModeValue('white', 'gray.900')}
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
                      // Highlight the selected segment for backspace navigation
                      <Box
                        bg={useColorModeValue('gray.500', 'gray.500')}
                        color={useColorModeValue('white', 'gray.900')}
                        px={3}
                        py={1}
                        fontSize="sm"
                        fontWeight="bold"
                        borderRadius="md"
                        display="inline-block"
                        border="2px solid"
                        borderColor={useColorModeValue('gray.400', 'gray.300')}
                      >
                        {segment}
                      </Box>
                    ) : (
                      <Text>{segment}</Text>
                    )}
                    {index < array.length - 1 && (
                      <Text mx={2} color={useColorModeValue('gray.500', 'gray.400')}>/</Text>
                    )}
                  </React.Fragment>
                );
              });
            })()}
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