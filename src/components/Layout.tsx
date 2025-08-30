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
import { ChevronLeft, ChevronRight, Minimize2, Maximize2, X, Square } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';

// CustomTitleBar component
const CustomTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  // Window controls
  const handleMinimize = useCallback(() => window.electronAPI?.minimize?.(), []);
  const handleMaximize = useCallback(() => window.electronAPI?.maximize?.(), []);
  const handleUnmaximize = useCallback(() => window.electronAPI?.unmaximize?.(), []);
  const handleClose = useCallback(() => window.electronAPI?.close?.(), []);

  useEffect(() => {
    if (!window.electronAPI) return;
    let mounted = true;
    window.electronAPI.isMaximized?.().then((val: boolean) => {
      if (mounted) setIsMaximized(val);
    });
    const onMax = () => setIsMaximized(true);
    const onUnmax = () => setIsMaximized(false);
    window.electronAPI.onWindowMaximize?.(onMax);
    window.electronAPI.onWindowUnmaximize?.(onUnmax);
    return () => {
      mounted = false;
      // No off/unsubscribe available in this API, so nothing to clean up
    };
  }, []);



  const bgColor = useColorModeValue('#f1f5f9', 'gray.800');
  const iconColor = useColorModeValue('#64748b', 'gray.400');
  return (
    <Flex align="center" width="100%" bg={bgColor} h="32px" style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties} px={0} borderBottom="1px solid" borderColor={useColorModeValue('#d1d5db', 'gray.700')}>
      <Box display="flex" alignItems="center" gap={1} pl={2}>
        {/* App Icon */}
        <Box w="20px" h="20px" mr={1}>
          <img src="./32.ico" alt="DocuFrame" style={{ width: '20px', height: '20px' }} />
        </Box>
        <Text fontWeight="bold" fontSize="sm" color={iconColor} userSelect="none">DocuFrame</Text>
      </Box>
      <Box flex="1" />
      <Flex height="32px" align="center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Minimize */}
        <IconButton
          aria-label="Minimize"
          variant="ghost"
          size="sm"
          onClick={handleMinimize}
          color={iconColor}
          _hover={{ bg: '#e5e7eb' }}
          _focus={{ boxShadow: 'none', bg: 'transparent' }}
          _active={{ bg: '#d1d5db' }}
          borderRadius={0}
          minW="46px"
          h="32px"
          p={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="default"
          icon={<Box w="10px" h="1px" bg={iconColor} borderRadius="1px" />}
        />
        {/* Maximize/Restore */}
        <Box
          as="button"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          onClick={isMaximized ? handleUnmaximize : handleMaximize}
          color={iconColor}
          bg="transparent"
          border="none"
          cursor="default"
          outline="none"
          transition="background-color 0.2s"
          _hover={{ bg: useColorModeValue('#e5e7eb', 'gray.600') }}
          _focus={{ boxShadow: 'none', bg: 'transparent' }}
          _active={{ bg: useColorModeValue('#d1d5db', 'gray.500') }}
          borderRadius={0}
          minW="46px"
          h="32px"
          p={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          sx={{
            '& .window-icon': {
              borderColor: 'currentColor',
            },
            '& .maximize-icon': {
              display: isMaximized ? 'none' : 'block',
            },
            '& .restore-icon': {
              display: isMaximized ? 'block' : 'none',
            },
          }}
        >
          {/* Maximize icon - single square */}
          <Box
            className="window-icon maximize-icon"
            w="10px"
            h="10px"
            border="1px solid"
            bg="transparent"
          />
          {/* Restore icon - two overlapping squares */}
          <Box className="window-icon restore-icon" position="relative" w="10px" h="10px">
            <Box
              position="absolute"
              top="0px"
              right="0px"
              w="7px"
              h="7px"
              border="1px solid"
              bg="transparent"
            />
            <Box
              position="absolute"
              bottom="0px"
              left="0px"
              w="7px"
              h="7px"
              border="1px solid"
              bg="transparent"
            />
          </Box>
        </Box>
        {/* Close */}
        <IconButton
          aria-label="Close"
          variant="ghost"
          size="sm"
          onClick={handleClose}
          color={iconColor}
          _hover={{ bg: '#ef4444', color: 'white' }}
          _focus={{ boxShadow: 'none', bg: 'transparent' }}
          _active={{ bg: '#dc2626', color: 'white' }}
          borderRadius={0}
          minW="46px"
          h="32px"
          p={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="default"
          icon={<X size={16} strokeWidth={1.5} style={{ display: 'block', margin: 'auto' }} />}
        />
      </Flex>
    </Flex>
  );
};

export const Layout: React.FC = () => {
  const { showOutputLog, isPreviewPaneOpen } = useAppContext();
  const [sidebarWidth, setSidebarWidth] = useState(263);
  const [logHeight, setLogHeight] = useState(200);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logMinimized, setLogMinimized] = useState(false);
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const accentBorderColor = useColorModeValue('#d1d5db', 'gray.700');
  const bgColor = useColorModeValue('#ffffff', 'gray.800');
  const mainBgColor = useColorModeValue('#f8fafc', 'gray.900');
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
        "titlebar titlebar titlebar"
        "ribbon ribbon ribbon"
        "sidebar tabs tabs"
        "sidebar header header"
        "sidebar main preview"
        ${showOutputLog ? '"sidebar footer preview"' : ''}
        "status status status"
      `} gridTemplateRows={`auto auto auto auto 1fr ${showOutputLog ? (logMinimized ? 40 : logHeight) + 'px' : ''} auto`} gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr ${isPreviewPaneOpen ? '700px' : '0px'}`} h="100%" gap="0" bg={mainBgColor}>
    {/* Custom Title Bar */}
    <GridItem area="titlebar" bg={bgColor} zIndex={100}>
      <CustomTitleBar />
    </GridItem>
    {/* Function Ribbon */}
    <GridItem area="ribbon" borderBottom="1px" borderColor={accentBorderColor} bg={bgColor} boxShadow="sm">
      <FunctionPanels />
    </GridItem>
    {/* Client Info Sidebar (formerly Folder Tree) */}
    <GridItem area="sidebar" borderRight="1px" borderColor={borderColor} bg={bgColor} overflowY="auto" display="flex" flexDirection="column" boxShadow="1px 0px 3px rgba(0,0,0,0.05)" className="enhanced-scrollbar" position="relative">
      <Box flex="1" overflowY="auto" className="enhanced-scrollbar">
        <ClientInfoPane 
          collapsed={sidebarCollapsed} 
          onToggleCollapse={() => {
            setSidebarCollapsed(c => {
              // If expanding from collapsed state, ensure minimum width
              if (c && sidebarWidth < MIN_SIDEBAR_WIDTH) {
                setSidebarWidth(MIN_SIDEBAR_WIDTH);
              }
              return !c;
            });
          }} 
          isCollapsed={sidebarCollapsed} 
        />
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
    {/* Folder Info Bar */}
    <GridItem area="header" bg={bgColor} p={2} borderBottom="1px" borderColor={borderColor}>
      <FolderInfoBar />
    </GridItem>
    {/* Folder Tab System */}
    <GridItem area="tabs" bg={bgColor}>
      <FolderTabSystem onActiveTabChange={handleActiveTabChange} />
    </GridItem>
    {/* Main Content Area */}
    <GridItem 
      area="main" 
      bg={mainBgColor} 
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