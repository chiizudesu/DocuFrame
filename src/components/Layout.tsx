import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Grid, GridItem, Box, Flex, useColorModeValue, Text, HStack, IconButton } from '@chakra-ui/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { ClientInfoPane } from './ClientInfoPane';
import { ClientInfoBar } from './ClientInfoBar';
import { PreviewPane } from './PreviewPane';
import { AIFileManagerPane } from './AIFileManagerPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { ThemeToggle } from './ThemeToggle';
import { FileGrid } from './FileGrid';
import { FolderTabSystem } from './FolderTabSystem';
import { Footer } from './Footer';
import { useAppContext } from '../context/AppContext';
import { useClientInfo } from '../hooks/useClientInfo';
import { settingsService } from '../services/settings';
import type { MinimizedDialog, DialogType } from './MinimizedDialogsBar';

export const Layout: React.FC = () => {
  const { isPreviewPaneOpen, isAIFileManagerOpen, showClientInfoBar, currentDirectory, rootDirectory } = useAppContext();
  const { clientInfo } = useClientInfo(currentDirectory, rootDirectory);
  const [sidebarWidth, setSidebarWidth] = useState(263);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [minimizedDialogs, setMinimizedDialogs] = useState<MinimizedDialog[]>([]);
  const [onRestoreDialog, setOnRestoreDialog] = useState<((type: DialogType) => void) | undefined>();
  const [onCloseMinimizedDialog, setOnCloseMinimizedDialog] = useState<((type: DialogType) => void) | undefined>();
  const borderColor = useColorModeValue('#cbd5e1', 'gray.600');
  const subtleBorderColor = useColorModeValue('#e2e8f0', 'gray.600');
  const accentBorderColor = useColorModeValue('#d1d5db', 'gray.700');
  const bgColor = useColorModeValue('#ffffff', 'gray.800');
  const headerBgColor = useColorModeValue('white', 'gray.700'); // Light theme: match active tab; dark: unchanged
  const mainBgColor = useColorModeValue('white', 'gray.850'); // Light theme: bright content area; dark: unchanged

  // Sidebar resize functionality
  const isSidebarDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const lastUpdateTime = useRef(0);
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 600;
  const COLLAPSE_THRESHOLD = 180;
  const THROTTLE_MS = 16; // ~60fps

  // Sidebar resize handlers
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (sidebarCollapsed) return; // Don't resize if collapsed
    isSidebarDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, [sidebarWidth, sidebarCollapsed]);

  useEffect(() => {
    let animationFrame: number;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Use requestAnimationFrame for smooth resizing
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      
      animationFrame = requestAnimationFrame(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime.current;
        
        // Throttle updates for better performance
        if (timeSinceLastUpdate < THROTTLE_MS) {
          return;
        }
        
        lastUpdateTime.current = now;
        
        // Handle sidebar resize
        if (isSidebarDragging.current) {
          const delta = e.clientX - startX.current;
          let newWidth = startWidth.current + delta;
          newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(newWidth, MAX_SIDEBAR_WIDTH));
          setSidebarWidth(newWidth);
          
          // Auto-collapse if width gets too small
          if (newWidth < COLLAPSE_THRESHOLD && !sidebarCollapsed) {
            setSidebarCollapsed(true);
          }
        }
      });
    };
    
    const handleMouseUp = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      isSidebarDragging.current = false;
      document.body.style.cursor = '';
    };
    
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth, sidebarCollapsed]);

  const handleActiveTabChange = useCallback((path: string) => {
    // This ensures all path-related functions work with the active tab
    // The currentDirectory is already updated by the tab system
  }, []);

    useEffect(() => {
  const loadSidebarSettings = async () => {
    try {
      const settings = await settingsService.getSettings();
      if (settings.sidebarCollapsedByDefault !== undefined) {
        setSidebarCollapsed(settings.sidebarCollapsedByDefault);
      }
    } catch (error) {
      console.error('Error loading sidebar settings:', error);
    }
  };
  loadSidebarSettings();
}, []);

  return <Grid templateAreas={`
        "tabs tabs tabs tabs"
        "header header header header"
        "sidebar main preview aiFileManager"
        "status status status status"
      `} gridTemplateRows="auto auto 1fr auto" gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr ${isPreviewPaneOpen ? '700px' : '0px'} ${isAIFileManagerOpen ? '420px' : '0px'}`} h="100%" gap="0" bg={mainBgColor}>
    {/* Folder Info Bar and Function Bar - z-index above tabs so address bar covers overlapping inactive tabs */}
    <GridItem area="header" bg={headerBgColor} p={0} overflow="hidden" position="relative" zIndex={2}>
      <Box>
        <Box p={2}>
          <FolderInfoBar />
        </Box>
      </Box>
      <Box borderTop="1px" borderColor={accentBorderColor} bg={bgColor} overflow="hidden">
        <FunctionPanels 
          minimizedDialogs={minimizedDialogs}
          setMinimizedDialogs={setMinimizedDialogs}
          setOnRestoreDialog={setOnRestoreDialog}
          setOnCloseMinimizedDialog={setOnCloseMinimizedDialog}
        />
      </Box>
    </GridItem>
    {/* Folder Tab System - z-index below header so address bar renders on top when tabs overlap */}
    <GridItem area="tabs" position="relative" zIndex={1}>
      <FolderTabSystem 
        onActiveTabChange={handleActiveTabChange}
        minimizedDialogs={minimizedDialogs}
        onRestoreDialog={onRestoreDialog}
        onCloseMinimizedDialog={onCloseMinimizedDialog}
      />
    </GridItem>
    {/* Client Info Sidebar (formerly Folder Tree) */}
    <GridItem area="sidebar" borderRight="1px" borderRightColor={subtleBorderColor} borderTop="1px" borderTopColor={useColorModeValue('gray.200', 'gray.600')} bg={mainBgColor} overflow="hidden" display="flex" flexDirection="column" position="relative">
      <Box flex="1" overflow="hidden">
        <ClientInfoPane />
      </Box>
      {/* Sidebar Resize Handle */}
      {!sidebarCollapsed && (
        <Box
          position="absolute"
          top="0"
          right="-3px"
          width="6px"
          height="100%"
          cursor="col-resize"
          onMouseDown={handleSidebarMouseDown}
          bg="transparent"
          _hover={{
            bg: useColorModeValue('blue.200', 'blue.600'),
            opacity: 0.7
          }}
          transition="all 0.2s"
          zIndex={10}
        />
      )}
    </GridItem>
    {/* Main Content Area - z-index 0 so dropdowns from header (z-index 10000) render above */}
    <GridItem 
      area="main" 
      bg={mainBgColor} 
      borderTop="1px"
      borderColor={borderColor}
      overflow="hidden" 
      display="flex" 
      flexDirection="column" 
      minHeight="0"
      position="relative"
      zIndex={0}
    >
      <ScrollArea.Root
        type="always"
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 4 }}
        className="filegrid-scroll-area"
      >
        <ScrollArea.Viewport style={{ height: '100%', width: '100%' }}>
          <FileGrid />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
      {showClientInfoBar && clientInfo && (
        <Box flexShrink={0} borderTop="1px" borderColor={accentBorderColor} overflow="hidden">
          <ClientInfoBar />
        </Box>
      )}
    </GridItem>
    {/* Preview Pane */}
    <GridItem 
      area="preview" 
      bg={bgColor} 
      borderLeft="1px" 
      borderColor={borderColor} 
      overflow="hidden" 
      display="flex" 
      flexDirection="column" 
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      visibility={isPreviewPaneOpen ? 'visible' : 'hidden'}
      width={isPreviewPaneOpen ? 'auto' : '0px'}
    >
      <PreviewPane />
    </GridItem>
    {/* AI File Manager Pane - lazy-mount: only render when open to avoid re-renders on context change */}
    <GridItem 
      area="aiFileManager" 
      bg={bgColor} 
      borderLeft="1px" 
      borderColor={borderColor} 
      overflow="hidden" 
      display="flex" 
      flexDirection="column" 
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      visibility={isAIFileManagerOpen ? 'visible' : 'hidden'}
      width={isAIFileManagerOpen ? 'auto' : '0px'}
    >
      {isAIFileManagerOpen && <AIFileManagerPane />}
    </GridItem>
    {/* Status Footer */}
    <GridItem area="status" bg={bgColor} borderTop="1px" borderColor={borderColor}>
      <Footer />
    </GridItem>
  </Grid>;
};