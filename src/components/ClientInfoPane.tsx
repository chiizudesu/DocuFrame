import React, { useState, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Text, Flex, Icon, IconButton, HStack, Separator } from '@chakra-ui/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Folder, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { docuFramePalette as P } from '../docuFrameColors';

export const ClientInfoPane: React.FC = () => {
  const {
    setCurrentDirectory,
    rootDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
    moveQuickAccessPath,
    recentClientPaths,
  } = useAppContext();

  const bgColor = useColorModeValue(P.light.sidebar, P.dark.sidebar);
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', P.dark.subtext);
  const dividerBorderColor = useColorModeValue('gray.300', P.dark.tableBorder);
  const transferBg = 'transparent';
  const transferSectionBg = useColorModeValue('#f8fafc', '#182438');
  const recentClientsSectionBg = useColorModeValue('#f1f5f9', '#1a202c');

  const [quickAccessOpen] = useState(true);
  const [rootFolders, setRootFolders] = useState<Array<{ name: string; path: string }>>([]);

  // Load root directory folders for default Quick Access
  useEffect(() => {
    const loadRootFolders = async () => {
      if (!rootDirectory) {
        setRootFolders([]);
        return;
      }
      try {
        const entries = await window.electronAPI.getDirectoryContents(rootDirectory);
        const folders = Array.isArray(entries)
          ? entries.filter((item: any) => item?.type === 'folder' && typeof item?.name === 'string' && !item.name.startsWith('.'))
          : [];
        folders.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setRootFolders(folders.map((f: any) => ({ name: f.name, path: f.path })));
      } catch (error) {
        console.error('Failed to load root folders for Quick Access:', error);
        setRootFolders([]);
      }
    };
    loadRootFolders();
  }, [rootDirectory]);

  const sectionHeaderHoverBg = useColorModeValue('gray.50', 'gray.800');
  const sectionHeaderStyle = {
    w: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    px: 2,
    py: 2,
    borderRadius: "md",
    bg: "transparent",
    _hover: { bg: sectionHeaderHoverBg },
    transition: "background 0.2s",
    border: "none",
    mb: 0,
  };

  const hasRecentClients =
    Array.isArray(recentClientPaths) && recentClientPaths.length > 0;

  return (
    <Box 
      h="100%" 
      bg={bgColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      minH={0}
    >
      {/* Quick Access only: must not wrap Recent — ScrollArea content height follows children, so flex-grow inside it never fills the pane. */}
      <ScrollArea.Root
        type="always"
        style={{
          flex: hasRecentClients ? '0 1 auto' : '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          padding: 4,
        }}
        className="sidebar-scroll-area"
      >
        <ScrollArea.Viewport style={{ height: '100%', width: '100%' }}>
          <Box p={4} pb={hasRecentClients ? 2 : 4}>
        {/* Quick Access Section */}
        <Box mb={1} flexShrink={0}>
          <Box {...sectionHeaderStyle} py={1} mb={0}>
            <Text fontSize="sm" fontWeight="semibold" color={textColor} letterSpacing={0.5}>
              QUICK ACCESS
            </Text>
          </Box>
          {quickAccessOpen && (
            <Box w="100%" display="flex" flexDirection="column" pt={0} pb={0}>
              <Box
                position="relative"
                display="flex"
                flexDirection="column"
                bg={transferBg}
              >
                {/* Folders list */}
                <>
                  {/* Pinned quick access folders */}
                  {Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0 ? (
                    quickAccessPaths.map((pinnedPath, index) => (
                      <Flex
                        key={pinnedPath}
                        align="center"
                        px={4}
                        py="3px"
                        mb="3px"
                        fontSize="13px"
                        _hover={{
                          bg: transferSectionBg
                        }}
                        color={textColor}
                        cursor="pointer"
                        style={{ userSelect: 'none' }}
                        onClick={() => setCurrentDirectory(pinnedPath)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          removeQuickAccessPath(pinnedPath);
                        }}
                        borderRadius={0}
                        position="relative"
                        role="group"
                      >
                        {/* Star icon for pinned items */}
                        <Icon
                          boxSize={2.5}
                          color="yellow.400"
                          fill="yellow.400"
                          position="absolute"
                          left="8px"
                          top="50%"
                          transform="translateY(-50%)"
                          flexShrink={0}
                          asChild><Star /></Icon>
                        <Icon boxSize={4} mr={2} ml={2} color="blue.400" flexShrink={0} asChild><Folder /></Icon>
                        <Text
                          lineClamp={1}
                          color="inherit"
                          fontWeight="normal"
                          flex={1}
                        >
                          {pinnedPath.split(/[/\\]/).filter(Boolean).pop()}
                        </Text>
                        {/* Move up/down buttons */}
                        <HStack gap={0} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            aria-label="Move up"
                            size="xs"
                            variant="ghost"
                            minW={6}
                            h={6}
                            disabled={index === 0}
                            onClick={() => moveQuickAccessPath(pinnedPath, 'up')}><ChevronUp size={14} /></IconButton>
                          <IconButton
                            aria-label="Move down"
                            size="xs"
                            variant="ghost"
                            minW={6}
                            h={6}
                            disabled={index === quickAccessPaths.length - 1}
                            onClick={() => moveQuickAccessPath(pinnedPath, 'down')}><ChevronDown size={14} /></IconButton>
                        </HStack>
                      </Flex>
                    ))
                  ) : null}

                  {/* Separator between pinned and auto-populated when both exist */}
                  {Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0 && rootFolders.filter(f => !quickAccessPaths?.includes(f.path)).length > 0 && (
                    <Separator
                      my={1}
                      borderColor={dividerBorderColor}
                      opacity={0.25}
                      width="85%"
                      mx="auto"
                    />
                  )}

                  {/* Root path folders (excluding pinned duplicates) */}
                  {Array.isArray(rootFolders) && rootFolders.length > 0 ? (
                    rootFolders
                      .filter(f => !quickAccessPaths?.includes(f.path))
                      .map((folder) => (
                        <Flex
                          key={folder.path}
                          align="center"
                          px={4}
                          py="3px"
                          mb="3px"
                          fontSize="13px"
                          _hover={{ bg: transferSectionBg }}
                          color={textColor}
                          cursor="pointer"
                          style={{ userSelect: 'none' }}
                          onClick={() => setCurrentDirectory(folder.path)}
                          borderRadius={0}
                          position="relative"
                        >
                          {/* Invisible placeholder to align with starred items */}
                          <Box
                            boxSize={2.5}
                            position="absolute"
                            left="8px"
                            top="50%"
                            transform="translateY(-50%)"
                            flexShrink={0}
                          />
                          <Icon boxSize={4} mr={2} ml={2} color="blue.400" flexShrink={0} asChild><Folder /></Icon>
                          <Text lineClamp={1} color="inherit" fontWeight="normal">
                            {folder.name}
                          </Text>
                        </Flex>
                      ))
                  ) : null}

                  {/* Empty state when neither pinned nor root has items */}
                  {(!quickAccessPaths || quickAccessPaths.length === 0) && rootFolders.length === 0 && (
                    <Flex justify="center" align="center" py={3}>
                      <Text fontSize="sm" color={secondaryTextColor}>
                        No folders found
                      </Text>
                    </Flex>
                  )}
                </>
              </Box>
            </Box>
          )}
        </Box>

          </Box>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {hasRecentClients && (
        <Box
          flex={1}
          minH={0}
          mt={2}
          mx={4}
          mb={4}
          bg={recentClientsSectionBg}
          borderRadius="lg"
          overflow="hidden"
          px={2}
          py={2}
          display="flex"
          flexDirection="column"
        >
          <Box {...sectionHeaderStyle} py={1} mb={0} flexShrink={0}>
            <Text fontSize="sm" fontWeight="semibold" color={textColor} letterSpacing={0.5}>
              RECENT CLIENTS
            </Text>
          </Box>
          <Box flex={1} minH={0} overflowY="auto" position="relative" display="flex" flexDirection="column">
            {recentClientPaths.map((clientPath) => (
              <Flex
                key={clientPath}
                align="center"
                px={2}
                py="3px"
                mb="3px"
                fontSize="13px"
                _hover={{ bg: transferSectionBg }}
                color={textColor}
                cursor="pointer"
                style={{ userSelect: 'none' }}
                onClick={() => setCurrentDirectory(clientPath)}
                borderRadius={0}
                position="relative"
                flexShrink={0}
              >
                <Icon boxSize={4} mr={2} color="blue.400" flexShrink={0} asChild><Folder /></Icon>
                <Text lineClamp={1} color="inherit" fontWeight="normal" flex={1}>
                  {clientPath.split(/[/\\]/).filter(Boolean).pop()}
                </Text>
              </Flex>
            ))}
          </Box>
        </Box>
      )}
      {/* Transfer Files Section removed */}
      {/* Document Insights functionality moved to dedicated dialog */}
      {/* Downloads Section */}
      {/* Removed as per user request */}
      {/* Recent Activity */}
      {/* Removed as per user request */}
      {/* Document Insights Modal removed - functionality moved to dedicated dialog */}
    </Box>
  );
};






