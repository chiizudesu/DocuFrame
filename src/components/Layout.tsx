import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Grid, GridItem, Box, Flex, useColorModeValue, Text, HStack, IconButton } from '@chakra-ui/react';
import { ClientInfoPane } from './ClientInfoPane';
import { PreviewPane } from './PreviewPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { OutputLog } from './OutputLog';
import { ThemeToggle } from './ThemeToggle';
import { FileGrid } from './FileGrid';
import { FolderTabSystem } from './FolderTabSystem';
import { Footer } from './Footer';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';
import type { MinimizedDialog, DialogType } from './MinimizedDialogsBar';

export const Layout: React.FC = () => {
  const { showOutputLog, isPreviewPaneOpen } = useAppContext();
  const [sidebarWidth, setSidebarWidth] = useState(263);
  const [logHeight, setLogHeight] = useState(200);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logMinimized, setLogMinimized] = useState(false);
  const [minimizedDialogs, setMinimizedDialogs] = useState<MinimizedDialog[]>([]);
  const [onRestoreDialog, setOnRestoreDialog] = useState<((type: DialogType) => void) | undefined>();
  const [onCloseMinimizedDialog, setOnCloseMinimizedDialog] = useState<((type: DialogType) => void) | undefined>();
  const borderColor = useColorModeValue('#cbd5e1', 'gray.600');
  const subtleBorderColor = useColorModeValue('#e2e8f0', 'gray.600');
  const accentBorderColor = useColorModeValue('#d1d5db', 'gray.700');
  const bgColor = useColorModeValue('#ffffff', 'gray.800');
  const headerBgColor = useColorModeValue('#4a5a68', 'gray.700'); // Match active tab color - darker
  const mainBgColor = useColorModeValue('#e8eef3', 'gray.850'); // Softer transition for modern UI harmony
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Sidebar resize functionality
  const isSidebarDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const lastUpdateTime = useRef(0);
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 600;
  const COLLAPSE_THRESHOLD = 180;
  const THROTTLE_MS = 16; // ~60fps

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = logHeight;
    document.body.style.cursor = 'row-resize';
  }, [logHeight]);

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
        
        // Handle log resize
        if (isDragging.current) {
          const delta = e.clientY - startY.current;
          let newHeight = startHeight.current - delta;
          newHeight = Math.max(100, Math.min(newHeight, 500)); // Clamp height
          setLogHeight(newHeight);
        }
        
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
      isDragging.current = false;
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
  }, [logHeight, sidebarWidth, sidebarCollapsed]);

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
        "tabs tabs tabs"
        "header header header"
        "sidebar main preview"
        ${showOutputLog ? '"sidebar footer preview"' : ''}
        "status status status"
      `} gridTemplateRows={`auto auto 1fr ${showOutputLog ? (logMinimized ? 40 : logHeight) + 'px' : ''} auto`} gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr ${isPreviewPaneOpen ? '700px' : '0px'}`} h="100%" gap="0" bg={mainBgColor}>
    {/* Folder Info Bar and Function Bar */}
    <GridItem area="header" bg={headerBgColor} p={0} overflow="hidden">
      <Box p={2}>
        <FolderInfoBar />
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
    {/* Folder Tab System */}
    <GridItem area="tabs">
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
    {/* Main Content Area */}
    <GridItem 
      area="main" 
      bg={mainBgColor} 
      borderTop="1px"
      borderColor={borderColor}
      overflow="auto" 
      className="enhanced-scrollbar" 
      display="flex" 
      flexDirection="column" 
      minHeight="0"
    >
      <FileGrid />
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
    {/* Resize Handle for Output Log (only over main content, not sidebar) */}
    {showOutputLog && !logMinimized && (
      <Box
        onMouseDown={handleMouseDown}
        cursor="row-resize"
        bg={useColorModeValue('#e5e7eb', 'gray.700')}
        h="6px"
        zIndex={10}
        style={{ gridColumn: '2 / 3', gridRow: 5 }}
        _hover={{ bg: useColorModeValue('#d1d5db', 'gray.600') }}
      />
    )}
    {/* Output Log */}
    {showOutputLog && (
      <GridItem 
        area="footer" 
        bg={bgColor} 
        borderTop="1px" 
        borderColor={borderColor} 
        position="relative"
      >
        <OutputLog minimized={logMinimized} setMinimized={setLogMinimized} />
      </GridItem>
    )}
    {/* Status Footer */}
    <GridItem area="status" bg={bgColor} borderTop="1px" borderColor={borderColor}>
      <Footer />
    </GridItem>
  </Grid>;
};