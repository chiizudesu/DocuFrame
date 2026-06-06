import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Grid, GridItem, Box } from '@chakra-ui/react';
import { ClientInfoPane } from './ClientInfoPane';
import { PreviewPane } from './PreviewPane';
import { JobContextPane } from './JobContextPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { FileGrid } from './FileGrid';
import { FolderTabSystem } from './FolderTabSystem';
import { Footer } from './Footer';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';
import type { MinimizedDialog, DialogType } from './MinimizedDialogsBar';
import { TransferPanel } from './TransferPanel';
import { ClientHeaderStrip } from './ClientHeaderStrip';
import { ClientListView } from './ClientListView';
import { normalizePath } from '../utils/path';

export const Layout: React.FC = () => {
  const { isPreviewPaneOpen, isJobContextOpen, currentDirectory, rootDirectory } = useAppContext();
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [minimizedDialogs, setMinimizedDialogs] = useState<MinimizedDialog[]>([]);
  const [onRestoreDialog, setOnRestoreDialog] = useState<((type: DialogType) => void) | undefined>();
  const [onCloseMinimizedDialog, setOnCloseMinimizedDialog] = useState<((type: DialogType) => void) | undefined>();
  const resizeHandleHoverBg = useColorModeValue('rgba(59, 130, 246, 0.35)', 'rgba(59, 130, 246, 0.45)');

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

  return (
    <>
    <Grid templateAreas={`
        "tabs tabs tabs tabs"
        "header header header header"
        "sidebar main preview jobContext"
        "status status status status"
      `} gridTemplateRows="auto auto 1fr auto" gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr ${isPreviewPaneOpen ? '700px' : '0px'} ${isJobContextOpen ? '420px' : '0px'}`} h="100%" gap="0" bg="df.canvas">
    {/* Folder Info Bar and Function Bar - z-index above tabs so address bar covers overlapping inactive tabs */}
    <GridItem
      area="header"
      bg="df.toolbar"
      p={0}
      overflow="hidden"
      position="relative"
      zIndex={2}
      borderBottomWidth="1px"
      borderBottomStyle="solid"
      borderBottomColor="df.border"
    >
      <Box>
        <Box px={2} py={2} bg="df.tabStrip">
          <FolderInfoBar />
        </Box>
      </Box>
      <Box
        borderTopWidth="1px"
        borderTopStyle="solid"
        borderTopColor="df.border"
        bg="df.toolbar"
        overflow="hidden"
      >
        <FunctionPanels 
          minimizedDialogs={minimizedDialogs}
          setMinimizedDialogs={setMinimizedDialogs}
          setOnRestoreDialog={setOnRestoreDialog}
          setOnCloseMinimizedDialog={setOnCloseMinimizedDialog}
        />
      </Box>
    </GridItem>
    {/* Folder Tab System - z-index below header so address bar renders on top when tabs overlap */}
    <GridItem area="tabs" position="relative" zIndex={1} bg="df.toolbar">
      <FolderTabSystem 
        onActiveTabChange={handleActiveTabChange}
        minimizedDialogs={minimizedDialogs}
        onRestoreDialog={onRestoreDialog}
        onCloseMinimizedDialog={onCloseMinimizedDialog}
      />
    </GridItem>
    {/* Client Info Sidebar (formerly Folder Tree) */}
    <GridItem
      area="sidebar"
      bg="df.sidebar"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      position="relative"
      borderRightWidth="1px"
      borderRightStyle="solid"
      borderRightColor="df.border"
    >
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
            bg: resizeHandleHoverBg,
            opacity: 0.85,
          }}
          transition="all 0.2s"
          zIndex={10}
        />
      )}
    </GridItem>
    {/* Main Content Area - z-index 0 so dropdowns from header (z-index 10000) render above */}
    <GridItem
      area="main"
      bg="df.canvas"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      minHeight={0}
      position="relative"
      zIndex={0}
    >
      {normalizePath(currentDirectory) === normalizePath(rootDirectory) ? (
        <Box flex="1" minH={0} overflow="auto">
          <ClientListView />
        </Box>
      ) : (
        <>
          <ClientHeaderStrip />
          <Box flex="1" minH={0} overflow="auto">
            <FileGrid />
          </Box>
        </>
      )}
    </GridItem>
    {/* Preview Pane */}
    <GridItem 
      area="preview" 
      bg="df.toolbar" 
      overflow="hidden" 
      display="flex" 
      flexDirection="column" 
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      borderLeftWidth="1px"
      borderLeftStyle="solid"
      borderLeftColor="df.border"
      visibility={isPreviewPaneOpen ? 'visible' : 'hidden'}
      width={isPreviewPaneOpen ? 'auto' : '0px'}
    >
      <PreviewPane />
    </GridItem>
    {/* Job Context Pane - always mounted to preserve state when toggled */}
    <GridItem
      area="jobContext"
      bg="df.toolbar"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      borderLeftWidth="1px"
      borderLeftStyle="solid"
      borderLeftColor="df.border"
      visibility={isJobContextOpen ? 'visible' : 'hidden'}
      width={isJobContextOpen ? 'auto' : '0px'}
    >
      <JobContextPane />
    </GridItem>
    {/* Status Footer */}
    <GridItem
      area="status"
      bg="df.footer"
      borderTopWidth="1px"
      borderTopStyle="solid"
      borderTopColor="df.border"
    >
      <Footer />
    </GridItem>
  </Grid>
  <TransferPanel />
  </>
  );
};
