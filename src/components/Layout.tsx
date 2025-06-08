import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Grid, GridItem, Box, Flex, useColorModeValue, Text, HStack, IconButton } from '@chakra-ui/react';
import { ClientInfoPane } from './ClientInfoPane';
import { FolderInfoBar } from './FolderInfoBar';
import { FunctionPanels } from './FunctionPanels';
import { OutputLog } from './OutputLog';
import { ThemeToggle } from './ThemeToggle';
import { FileGrid } from './FileGrid';
import { Footer } from './Footer';
import { ChevronLeft, ChevronRight, Minimize2, Maximize2, X, Square } from 'lucide-react';

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
      <Box display="flex" alignItems="center" gap={2} pl={2}>
        {/* Logo placeholder */}
        <Box w="20px" h="20px" bg={useColorModeValue('#3b82f6', 'blue.400')} borderRadius="md" mr={2} />
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
          minW="32px"
          h="32px"
          p={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
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
          cursor="pointer"
          outline="none"
          transition="background-color 0.2s"
          _hover={{ bg: useColorModeValue('#e5e7eb', 'gray.600') }}
          _focus={{ boxShadow: 'none', bg: 'transparent' }}
          _active={{ bg: useColorModeValue('#d1d5db', 'gray.500') }}
          borderRadius={0}
          minW="32px"
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
          minW="32px"
          h="32px"
          p={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          icon={<X size={16} strokeWidth={1.5} style={{ display: 'block', margin: 'auto' }} />}
        />
      </Flex>
    </Flex>
  );
};

export const Layout: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(280);
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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startHeight.current = logHeight;
    document.body.style.cursor = 'row-resize';
  }, [logHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientY - startY.current;
      let newHeight = startHeight.current - delta;
      newHeight = Math.max(100, Math.min(newHeight, 500)); // Clamp height
      setLogHeight(newHeight);
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [logHeight]);

  return <Grid templateAreas={`
        "titlebar titlebar titlebar"
        "ribbon ribbon ribbon"
        "sidebar header header"
        "sidebar main main"
        "sidebar footer footer"
        "status status status"
      `} gridTemplateRows={`auto auto auto 1fr ${logMinimized ? 40 : logHeight}px auto`} gridTemplateColumns={`${sidebarCollapsed ? 64 : sidebarWidth}px 1fr 1fr`} h="100%" gap="0" bg={mainBgColor}>
    {/* Custom Title Bar */}
    <GridItem area="titlebar" bg={bgColor} zIndex={100}>
      <CustomTitleBar />
    </GridItem>
    {/* Function Ribbon */}
    <GridItem area="ribbon" borderBottom="1px" borderColor={accentBorderColor} bg={bgColor} boxShadow="sm">
      <FunctionPanels />
    </GridItem>
    {/* Client Info Sidebar (formerly Folder Tree) */}
    <GridItem area="sidebar" borderRight="1px" borderColor={borderColor} bg={bgColor} overflowY="auto" display="flex" flexDirection="column" boxShadow="1px 0px 3px rgba(0,0,0,0.05)" className="enhanced-scrollbar">
      <Box flex="1" overflowY="auto" className="enhanced-scrollbar">
        <ClientInfoPane collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} isCollapsed={sidebarCollapsed} />
      </Box>
    </GridItem>
    {/* Folder Info Bar */}
    <GridItem area="header" bg={bgColor} p={2} borderBottom="1px" borderColor={borderColor}>
      <FolderInfoBar />
    </GridItem>
    {/* Main Content Area */}
    <GridItem area="main" bg={mainBgColor} overflow="auto" className="enhanced-scrollbar">
      <FileGrid />
    </GridItem>
    {/* Resize Handle for Output Log (only over main content, not sidebar) */}
    {!logMinimized && (
      <Box
        onMouseDown={handleMouseDown}
        cursor="row-resize"
        bg={useColorModeValue('#e5e7eb', 'gray.700')}
        h="6px"
        zIndex={10}
        style={{ gridColumn: '2 / span 2', gridRow: 5 }}
        _hover={{ bg: useColorModeValue('#d1d5db', 'gray.600') }}
      />
    )}
    {/* Output Log */}
    <GridItem area="footer" bg={bgColor} borderTop="1px" borderColor={borderColor} position="relative">
      <OutputLog minimized={logMinimized} setMinimized={setLogMinimized} />
    </GridItem>
    {/* Status Footer */}
    <GridItem area="status" bg={bgColor} borderTop="1px" borderColor={borderColor}>
      <Footer />
    </GridItem>
  </Grid>;
};