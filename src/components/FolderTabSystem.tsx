import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  IconButton,
  useColorModeValue,
  Button,
} from '@chakra-ui/react';
import { X, Plus, ExternalLink } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface FolderTab {
  id: string;
  path: string;
  name: string;
}

interface FolderTabSystemProps {
  onActiveTabChange: (path: string) => void;
}

export const FolderTabSystem: React.FC<FolderTabSystemProps> = ({ onActiveTabChange }) => {
  const { currentDirectory, setCurrentDirectory, rootDirectory, newTabShortcut, closeTabShortcut, addTabToCurrentWindow, closeCurrentTab } = useAppContext();
  const [tabs, setTabs] = useState<FolderTab[]>([
    {
      id: '1',
      path: currentDirectory || '',
      name: getDirectoryName(currentDirectory || ''),
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState<string | null>(null);
  const [isDraggingOut, setIsDraggingOut] = useState(false);
  const [fileDropTarget, setFileDropTarget] = useState<string | null>(null); // For file drag/drop
  const tabsRef = useRef<HTMLDivElement>(null);

  // Colors - Updated to match light theme design with better contrast
  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const activeBg = useColorModeValue('#ffffff', 'gray.800'); // Active tab - white background
  const inactiveBg = useColorModeValue('#f1f5f9', 'gray.700'); // Inactive tabs - light gray, darker in dark mode
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const hoverBg = useColorModeValue('#e2e8f0', 'gray.650');

  // Helper function to get directory name from path
  function getDirectoryName(path: string): string {
    if (!path) return 'Root';
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Root';
  }

  // Update current tab when currentDirectory changes
  useEffect(() => {
    if (currentDirectory) {
      setTabs(prevTabs => 
        prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, path: currentDirectory, name: getDirectoryName(currentDirectory) }
            : tab
        )
      );
    }
  }, [currentDirectory, activeTabId]);

  // Handle tab activation
  const handleTabClick = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      setCurrentDirectory(tab.path);
      onActiveTabChange(tab.path);
    }
  }, [tabs, setCurrentDirectory, onActiveTabChange]);

  // Add new tab - defaults to root directory
  const addNewTab = useCallback((path?: string) => {
    const newTabId = Date.now().toString();
    const targetPath = path || rootDirectory || currentDirectory;
    const newTab: FolderTab = {
      id: newTabId,
      path: targetPath,
      name: getDirectoryName(targetPath),
    };
    setTabs(prev => [...prev, newTab]);
    // Don't switch to the new tab - keep the current active tab
    // setActiveTabId(newTabId);
    // setCurrentDirectory(newTab.path);
    // onActiveTabChange(newTab.path);
  }, [rootDirectory, currentDirectory]);



   // Keyboard shortcut for new tab (configurable)
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       // Parse the configured shortcut
       const shortcut = newTabShortcut || 'Ctrl+T';
       const parts = shortcut.split('+');
       const key = parts[parts.length - 1].toLowerCase();
       const needsCtrl = parts.includes('Ctrl');
       const needsAlt = parts.includes('Alt');
       const needsShift = parts.includes('Shift');
       
       // Check if the pressed keys match the configured shortcut
       if (e.key.toLowerCase() === key &&
           e.ctrlKey === needsCtrl &&
           e.altKey === needsAlt &&
           e.shiftKey === needsShift) {
         e.preventDefault();
         addNewTab();
       }
     };

     window.addEventListener('keydown', handleKeyDown);
     return () => {
       window.removeEventListener('keydown', handleKeyDown);
     };
   }, [addNewTab, newTabShortcut]);

  // Close tab
  const closeTab = useCallback((tabId: string) => {
    if (tabs.length === 1) return; // Don't close the last tab
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    if (activeTabId === tabId) {
      // Switch to the tab on the left of the closed tab, or the first tab if closing the leftmost tab
      const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      
      if (remainingTabs.length > 0) {
        const newActiveTab = remainingTabs[Math.min(newActiveIndex, remainingTabs.length - 1)];
        setActiveTabId(newActiveTab.id);
        setCurrentDirectory(newActiveTab.path);
        onActiveTabChange(newActiveTab.path);
      }
    }
  }, [tabs, activeTabId, setCurrentDirectory, onActiveTabChange]);

  // Keyboard shortcut for close tab (configurable)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse the configured shortcut
      const shortcut = closeTabShortcut || 'Ctrl+W';
      const parts = shortcut.split('+');
      const key = parts[parts.length - 1].toLowerCase();
      const needsCtrl = parts.includes('Ctrl');
      const needsAlt = parts.includes('Alt');
      const needsShift = parts.includes('Shift');
      
      // Check if the pressed keys match the configured shortcut
      if (e.key.toLowerCase() === key &&
          e.ctrlKey === needsCtrl &&
          e.altKey === needsAlt &&
          e.shiftKey === needsShift) {
        e.preventDefault();
        // Close the current active tab if there are more than one tabs
        if (tabs.length > 1) {
          closeTab(activeTabId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeTabShortcut, tabs.length, activeTabId, closeTab]);

  // Register tab functions with AppContext
  useEffect(() => {
    // Store the functions in a global object that AppContext can access
    (window as any).__tabFunctions = {
      addNewTab,
      closeCurrentTab: () => closeTab(activeTabId)
    };
  }, [addNewTab, activeTabId, closeTab]);

  // Tab switching shortcuts (Ctrl+1, Ctrl+2, etc. and Ctrl+Tab)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1, Ctrl+2, etc. for direct tab switching
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          const tabIndex = num - 1;
          if (tabIndex < tabs.length) {
            const targetTab = tabs[tabIndex];
            setActiveTabId(targetTab.id);
            setCurrentDirectory(targetTab.path);
            onActiveTabChange(targetTab.path);
          }
        }
      }
      
      // Ctrl+Tab for next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        const nextTab = tabs[nextIndex];
        setActiveTabId(nextTab.id);
        setCurrentDirectory(nextTab.path);
        onActiveTabChange(nextTab.path);
      }
      
      // Ctrl+Shift+Tab for previous tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
        const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
        const prevTab = tabs[prevIndex];
        setActiveTabId(prevTab.id);
        setCurrentDirectory(prevTab.path);
        onActiveTabChange(prevTab.path);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabs, activeTabId, setCurrentDirectory, onActiveTabChange]);

  // Drag handlers for tab reordering
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    // Only handle tab drag start if this is actually a tab being dragged
    // (not a file being dragged over a tab)
    if (e.dataTransfer.types.includes('Files')) {
      return; // Don't start tab drag for file drags
    }
    setDraggedTab(tabId);
    setIsDraggingOut(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    // Only handle tab drag over if this is actually a tab being dragged
    if (e.dataTransfer.types.includes('Files')) {
      return; // Don't handle tab drag over for file drags
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTab(tabId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    // Only handle tab drop if this is actually a tab being dragged
    if (e.dataTransfer.types.includes('Files')) {
      return; // Don't handle tab drop for file drags
    }
    e.preventDefault();
    const sourceTabId = draggedTab;
    
    if (sourceTabId && sourceTabId !== targetTabId) {
      setTabs(prev => {
        const newTabs = [...prev];
        const sourceIndex = newTabs.findIndex(tab => tab.id === sourceTabId);
        const targetIndex = newTabs.findIndex(tab => tab.id === targetTabId);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const [sourceTab] = newTabs.splice(sourceIndex, 1);
          newTabs.splice(targetIndex, 0, sourceTab);
        }
        
        return newTabs;
      });
    }
    
    setDraggedTab(null);
    setDragOverTab(null);
  }, [draggedTab]);

  // Handle dragging tab out of the application
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    console.log('=== DRAG END DEBUG ===');
    console.log('Dragged tab:', draggedTab);
    console.log('File drop target:', fileDropTarget);
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer files length:', e.dataTransfer.files.length);

    const rect = tabsRef.current?.getBoundingClientRect();
    if (rect && (e.clientY < rect.top || e.clientY > rect.bottom || 
                 e.clientX < rect.left || e.clientX > rect.right)) {
      // Tab was dragged outside the tab area
      const draggedTabData = tabs.find(tab => tab.id === draggedTab);
      if (draggedTabData && window.electronAPI?.openNewWindow) {
        // Create new window with this folder path
        window.electronAPI.openNewWindow(draggedTabData.path);
        // Remove tab from current window if it's not the last one
        if (tabs.length > 1) {
          closeTab(draggedTab!);
        }
      }
    }
    
    setDraggedTab(null);
    setDragOverTab(null);
    setIsDraggingOut(false);
    setFileDropTarget(null); // Also clear file drop target
  }, [draggedTab, tabs, closeTab, fileDropTarget]);

  // File drag/drop handlers for tabs acting as folder drop targets
  const handleFileDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    // Only handle if this is a file drag operation (not tab reordering)
    if (!draggedTab && (e.dataTransfer.types.includes('text/plain') || e.dataTransfer.types.includes('Files'))) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setFileDropTarget(tabId);
    }
  }, [draggedTab]);

  const handleFileDragLeave = useCallback((e: React.DragEvent, tabId: string) => {
    // Check if we're actually leaving the tab (not just moving between child elements)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setFileDropTarget(null);
    }
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent, tabId: string) => {
    console.log('=== FILE DROP DEBUG ===');
    console.log('Tab ID:', tabId);
    console.log('Dragged tab:', draggedTab);
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer files length:', e.dataTransfer.files.length);
    console.log('DataTransfer items length:', e.dataTransfer.items.length);

    e.preventDefault();
    setFileDropTarget(null);

    // If this is a tab reordering drag, ignore
    if (draggedTab) {
      console.log('Ignoring - this is a tab reordering drag');
      return;
    }

    // External file drop (from OS)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      console.log('Processing external file drop');
      const filePaths = Array.from(e.dataTransfer.files).map(f => f.path);
      console.log('File paths:', filePaths);
      const targetTab = tabs.find(tab => tab.id === tabId);
      if (targetTab && filePaths.length > 0 && window.electronAPI?.moveFiles) {
        console.log('Moving files to:', targetTab.path);
        await window.electronAPI.moveFiles(filePaths, targetTab.path);
        console.log('Files moved successfully');
      }
      return;
    }

    // Internal drag (from app)
    console.log('Processing internal drag');
    try {
      const dragData = e.dataTransfer.getData('text/plain');
      console.log('Drag data:', dragData);
      if (dragData) {
        const files = JSON.parse(dragData);
        const targetTab = tabs.find(tab => tab.id === tabId);
        if (targetTab && Array.isArray(files) && files.length > 0) {
          if (window.electronAPI?.moveFiles) {
            await window.electronAPI.moveFiles(files, targetTab.path);
          }
        }
      }
    } catch (error) {
      console.log('Error processing internal drag:', error);
      // Ignore
    }
  }, [draggedTab, tabs]);

  return (
    <Box
      ref={tabsRef}
      bg={bgColor}
      px={1}
      pt={1}
      pb={0}
      position="relative"
      _after={{
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '1px',
        bg: borderColor,
        zIndex: 1,
      }}
    >
      <Flex align="end" gap="1px">
        {/* Tabs */}
        {tabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            <Box
              draggable={true}
              onDragStart={(e) => {
                // Only start tab drag if not dragging files
                if (!e.dataTransfer.types.includes('Files')) {
                  handleDragStart(e, tab.id);
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                // Visual feedback for file drops
                if (e.dataTransfer.types.includes('Files') || 
                    e.dataTransfer.types.includes('application/x-docuframe-files')) {
                  setFileDropTarget(tab.id);
                }
              }}
              onDragOver={(e) => {
                // MUST prevent default for ALL drag overs
                e.preventDefault();
                e.stopPropagation();
                // Set the appropriate drop effect
                if (e.dataTransfer.types.includes('Files') || 
                    e.dataTransfer.types.includes('application/x-docuframe-files')) {
                  e.dataTransfer.dropEffect = 'copy';
                  setFileDropTarget(tab.id);
                } else if (draggedTab) {
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverTab(tab.id);
                }
              }}
              onDragLeave={(e) => {
                // Only clear if actually leaving the element
                const rect = e.currentTarget.getBoundingClientRect();
                if (e.clientX < rect.left || e.clientX > rect.right || 
                    e.clientY < rect.top || e.clientY > rect.bottom) {
                  setFileDropTarget(null);
                  setDragOverTab(null);
                }
              }}
                              onDrop={async (e) => {
                  // CRITICAL: Must prevent default
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('=== TAB DROP EVENT ===');
                  console.log('Tab:', tab.name);
                  console.log('Types:', Array.from(e.dataTransfer.types));
                  console.log('Files:', e.dataTransfer.files.length);
                  // Clear visual states
                  setFileDropTarget(null);
                  setDragOverTab(null);
                  
                  let filesMoved = false;
                  
                  // Handle file drops
                  if (e.dataTransfer.files.length > 0) {
                    // External files from OS
                    const filePaths = Array.from(e.dataTransfer.files)
                      .map(f => (f as any).path)
                      .filter(Boolean);
                    if (filePaths.length > 0) {
                      console.log('Moving external files:', filePaths);
                      try {
                        await window.electronAPI.moveFiles(filePaths, tab.path);
                        filesMoved = true;
                      } catch (error) {
                        console.error('Failed to move files:', error);
                      }
                    }
                  } else if (e.dataTransfer.types.includes('application/x-docuframe-files')) {
                    // Internal drag from file list
                    try {
                      const data = e.dataTransfer.getData('application/x-docuframe-files');
                      if (data) {
                        const filePaths = JSON.parse(data);
                        console.log('Moving internal files:', filePaths);
                        await window.electronAPI.moveFiles(filePaths, tab.path);
                        filesMoved = true;
                      }
                    } catch (error) {
                      console.error('Failed to parse internal drag data:', error);
                    }
                  } else if (draggedTab) {
                    // Tab reordering
                    handleDrop(e, tab.id);
                  }
                  
                  // Refresh folder view if files were moved to the active tab
                  if (filesMoved && tab.id === activeTabId) {
                    console.log('Refreshing folder view after file transfer to active tab');
                    setCurrentDirectory(tab.path);
                    
                    // Emit folderContentsChanged event for FileGrid refresh
                    window.dispatchEvent(new CustomEvent('folderContentsChanged', {
                      detail: {
                        directory: tab.path,
                        newFiles: [] // FileGrid will refresh the entire directory
                      }
                    }));
                  }
                  
                  // If files were moved to a different tab, refresh the current active tab to show files disappeared
                  if (filesMoved && tab.id !== activeTabId) {
                    console.log('Refreshing current tab view to show files disappeared');
                    setCurrentDirectory(currentDirectory);
                    
                    // Emit folderContentsChanged event for FileGrid refresh
                    window.dispatchEvent(new CustomEvent('folderContentsChanged', {
                      detail: {
                        directory: currentDirectory,
                        newFiles: [] // FileGrid will refresh the entire directory
                      }
                    }));
                  }
                }}
              onDragEnd={handleDragEnd}
              position="relative"
            >
              <Flex
                align="center"
                bg={
                  fileDropTarget === tab.id 
                    ? useColorModeValue('blue.50', 'blue.900')
                    : activeTabId === tab.id 
                      ? activeBg 
                      : inactiveBg
                }
                border="1px solid"
                borderColor={
                  fileDropTarget === tab.id 
                    ? useColorModeValue('blue.300', 'blue.600')
                    : borderColor
                }
                borderBottom={activeTabId === tab.id ? 'none' : `1px solid ${borderColor}`}
                borderTopRadius="8px"
                px={3}
                py={1}
                cursor="pointer"
                _hover={{ 
                  bg: fileDropTarget === tab.id 
                    ? useColorModeValue('blue.100', 'blue.800')
                    : activeTabId === tab.id 
                      ? activeBg 
                      : hoverBg 
                }}
                onClick={() => handleTabClick(tab.id)}
                minW="159px"
                maxW="200px"
                h={activeTabId === tab.id ? "33px" : "32px"}
                position="relative"
                opacity={draggedTab === tab.id ? 0.5 : 1}
                zIndex={activeTabId === tab.id ? 5 : fileDropTarget === tab.id ? 2 : 1}
                mb={activeTabId === tab.id ? "-1px" : "0"}
                transform={
                  dragOverTab === tab.id && draggedTab !== tab.id 
                    ? 'translateX(2px)' 
                    : fileDropTarget === tab.id 
                      ? 'scale(1.02)'
                      : 'none'
                }
                transition="all 0.15s ease"
                fontSize="sm"
                color={
                  fileDropTarget === tab.id
                    ? useColorModeValue('blue.700', 'blue.200')
                    : useColorModeValue('gray.800', activeTabId === tab.id ? 'white' : 'gray.300')
                }
                fontWeight={activeTabId === tab.id ? '600' : '400'}
                boxShadow={fileDropTarget === tab.id ? 'sm' : 'none'}
              >
                <Text
                  fontSize="sm"
                  isTruncated
                  flex={1}
                  userSelect="none"
                  lineHeight="1.3"
                >
                  {tab.name}
                </Text>
                
                {tabs.length > 1 && (
                  <Box
                    as="button"
                    ml={2}
                    p="3px"
                    borderRadius="4px"
                    opacity={0.6}
                    _hover={{ 
                      opacity: 1,
                      bg: useColorModeValue('gray.200', 'gray.600')
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    transition="all 0.15s ease"
                  >
                    <X size={12} />
                  </Box>
                )}
              </Flex>
              
              {/* Tab reorder drag indicator */}
              {dragOverTab === tab.id && draggedTab !== tab.id && (
                <Box
                  position="absolute"
                  left="-1px"
                  top="2px"
                  bottom="2px"
                  w="2px"
                  bg="blue.400"
                  borderRadius="full"
                  zIndex={4}
                />
              )}

              {/* File drop indicator */}
              {fileDropTarget === tab.id && (
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  borderRadius="6px"
                  bg={useColorModeValue('blue.50', 'blue.900')}
                  opacity={0.8}
                  zIndex={4}
                  pointerEvents="none"
                />
              )}
            </Box>

            {/* Tab separator */}
            {index < tabs.length - 1 && activeTabId !== tab.id && (
              <Box
                w="1px"
                h="16px"
                bg={useColorModeValue('gray.300', 'gray.600')}
                opacity={0.5}
                alignSelf="end"
                mb="4px"
              />
            )}
          </React.Fragment>
        ))}
        
        {/* Add new tab button */}
        <Box
          as="button"
          ml={1}
          p={1}
          borderRadius="4px"
          opacity={0.7}
          _hover={{ 
            opacity: 1,
            bg: useColorModeValue('gray.100', 'gray.700')
          }}
                      onClick={() => addNewTab()}
          display="flex"
          alignItems="center"
          justifyContent="center"
          transition="all 0.15s ease"
          color={useColorModeValue('gray.600', 'gray.400')}
          h="24px"
          w="24px"
        >
          <Plus size={14} />
        </Box>
      </Flex>
    </Box>
  );
};

 