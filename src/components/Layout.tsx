import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Grid, GridItem, Box } from '@chakra-ui/react';
import { ClientInfoPane } from './ClientInfoPane';
import { PreviewPane } from './PreviewPane';
import { SectionChecklistPane } from './SectionChecklistPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { FileGrid } from './FileGrid';
import { ClientFolderCardView } from './ClientFolderCardView';
import { FolderTabSystem } from './FolderTabSystem';
import { Footer } from './Footer';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';
import type { MinimizedDialog, DialogType } from './MinimizedDialogsBar';
import { TransferPanel } from './TransferPanel';
import { ClientHeaderStrip } from './ClientHeaderStrip';
import { ClientListView } from './ClientListView';
import { normalizePath, getParentPath } from '../utils/path';

export const Layout: React.FC = () => {
  const { isPreviewPaneOpen, isSectionPaneOpen, currentDirectory, rootDirectory } = useAppContext();
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [previewWidth, setPreviewWidth] = useState(700);
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

  // Preview pane resize functionality (handle on its LEFT edge — pane grows leftward)
  const isPreviewDragging = useRef(false);
  const startPreviewX = useRef(0);
  const startPreviewWidth = useRef(0);
  const MIN_PREVIEW_WIDTH = 360;
  const MAX_PREVIEW_WIDTH = 1100;

  // Sidebar resize handlers
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    if (sidebarCollapsed) return; // Don't resize if collapsed
    isSidebarDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, [sidebarWidth, sidebarCollapsed]);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    isPreviewDragging.current = true;
    startPreviewX.current = e.clientX;
    startPreviewWidth.current = previewWidth;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, [previewWidth]);

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

        // Handle preview pane resize (left-edge handle → drag left grows the pane)
        if (isPreviewDragging.current) {
          const delta = e.clientX - startPreviewX.current;
          let newWidth = startPreviewWidth.current - delta;
          newWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(newWidth, MAX_PREVIEW_WIDTH));
          setPreviewWidth(newWidth);
        }
      });
    };

    const handleMouseUp = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      isSidebarDragging.current = false;
      isPreviewDragging.current = false;
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

  // Toasts should drop in below the toolbar, not from the title bar. Publish the
  // header's bottom edge as a CSS var the global toaster reads (see toaster.tsx).
  const headerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--df-toast-top', `${el.getBoundingClientRect().bottom + 8}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

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
        "sidebar main sections preview"
        "status status status status"
      `} gridTemplateRows="auto auto 1fr auto" gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr ${isSectionPaneOpen ? '420px' : '0px'} ${isPreviewPaneOpen ? `${previewWidth}px` : '0px'}`} h="100%" gap="0" bg="df.canvas">
    {/* Folder Info Bar and Function Bar - z-index above tabs so address bar covers overlapping inactive tabs */}
    <GridItem
      ref={headerRef}
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
        <Box px={2} py={1} bg="df.tabActive">
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
      ) : rootDirectory && normalizePath(getParentPath(currentDirectory)) === normalizePath(rootDirectory) ? (
        // One level into a client folder — show the big-card folder view
        <>
          <ClientHeaderStrip />
          <Box flex="1" minH={0} overflow="hidden">
            <ClientFolderCardView />
          </Box>
        </>
      ) : (
        <>
          <ClientHeaderStrip />
          <Box flex="1" minH={0} overflow="auto">
            <FileGrid />
          </Box>
        </>
      )}
    </GridItem>
    {/* Workpaper Section Checklist Pane — mount only when open (mutually exclusive with preview) */}
    <GridItem
      area="sections"
      bg="df.toolbar"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      borderLeftWidth="1px"
      borderLeftStyle="solid"
      borderLeftColor="df.border"
      visibility={isSectionPaneOpen ? 'visible' : 'hidden'}
      width={isSectionPaneOpen ? 'auto' : '0px'}
    >
      {isSectionPaneOpen && <SectionChecklistPane />}
    </GridItem>
    {/* Preview Pane */}
    <GridItem
      area="preview"
      bg="df.toolbar"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      position="relative"
      boxShadow="-1px 0px 3px rgba(0,0,0,0.05)"
      borderLeftWidth="1px"
      borderLeftStyle="solid"
      borderLeftColor="df.border"
      visibility={isPreviewPaneOpen ? 'visible' : 'hidden'}
      width={isPreviewPaneOpen ? 'auto' : '0px'}
    >
      {/* Preview Resize Handle (left edge) */}
      {isPreviewPaneOpen && (
        <Box
          position="absolute"
          top="0"
          left="-3px"
          width="6px"
          height="100%"
          cursor="col-resize"
          onMouseDown={handlePreviewMouseDown}
          bg="transparent"
          _hover={{ bg: resizeHandleHoverBg, opacity: 0.85 }}
          transition="all 0.2s"
          zIndex={10}
        />
      )}
      <PreviewPane />
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
