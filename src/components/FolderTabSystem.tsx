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

  // Colors - Active tab matches address bar background for seamless integration
  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const activeBg = useColorModeValue('#ffffff', 'gray.800'); // Same as address bar background
  const inactiveBg = useColorModeValue('#e2e8f0', 'gray.600');
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const hoverBg = useColorModeValue('#f1f5f9', 'gray.650');

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
    setDraggedTab(tabId);
    setIsDraggingOut(false);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTab(tabId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
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
  }, [draggedTab, tabs, closeTab]);

  // File drag/drop handlers for tabs acting as folder drop targets
  const handleFileDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    // Only handle if this is a file drag operation (not tab reordering)
    if (!draggedTab && e.dataTransfer.types.includes('text/plain')) {
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
    e.preventDefault();
    setFileDropTarget(null);
    
    if (draggedTab) return; // Ignore if this is tab reordering
    
    try {
      const dragData = e.dataTransfer.getData('text/plain');
      if (dragData) {
        const files = JSON.parse(dragData);
        const targetTab = tabs.find(tab => tab.id === tabId);
        
        if (targetTab && Array.isArray(files) && files.length > 0) {
          // Use the existing moveFiles API to move files to the target folder
          if (window.electronAPI?.moveFiles) {
            await window.electronAPI.moveFiles(files, targetTab.path);
            console.log(`Moved ${files.length} files to ${targetTab.path}`);
          }
        }
      }
    } catch (error) {
      console.error('Error handling file drop on tab:', error);
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
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => {
                handleDragOver(e, tab.id);
                handleFileDragOver(e, tab.id);
              }}
              onDragLeave={(e) => {
                handleDragLeave();
                handleFileDragLeave(e, tab.id);
              }}
              onDrop={(e) => {
                handleDrop(e, tab.id);
                handleFileDrop(e, tab.id);
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
                  minW="120px"
                  maxW="200px"
                  h={activeTabId === tab.id ? "27px" : "26px"}
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
                  fontSize="xs"
                  color={
                    fileDropTarget === tab.id
                      ? useColorModeValue('blue.700', 'blue.200')
                      : useColorModeValue('gray.700', activeTabId === tab.id ? 'white' : 'gray.300')
                  }
                  fontWeight={activeTabId === tab.id ? '500' : '400'}
                  boxShadow={fileDropTarget === tab.id ? 'sm' : 'none'}
                >
                <Text
                  fontSize="xs"
                  isTruncated
                  flex={1}
                  userSelect="none"
                  lineHeight="1.2"
                >
                  {tab.name}
                </Text>
                
                {tabs.length > 1 && (
                  <Box
                    as="button"
                    ml={2}
                    p="2px"
                    borderRadius="3px"
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
                    <X size={10} />
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
                  border="2px dashed"
                  borderColor={useColorModeValue('blue.400', 'blue.300')}
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
          h="20px"
          w="20px"
        >
          <Plus size={12} />
        </Box>
      </Flex>
    </Box>
  );
};

 