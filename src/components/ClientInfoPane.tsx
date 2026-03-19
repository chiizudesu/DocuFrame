import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Divider, useColorModeValue, Icon, IconButton, HStack } from '@chakra-ui/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Folder, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const ClientInfoPane: React.FC = () => {
  const {
    setCurrentDirectory,
    rootDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
    moveQuickAccessPath,
    recentClientPaths,
  } = useAppContext();

  const bgColor = useColorModeValue('white', 'gray.850'); // Light theme: bright sidebar; dark: unchanged
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');
  const dividerBorderColor = useColorModeValue('gray.300', 'gray.600');
  const transferBg = 'transparent';
  const transferSectionBg = useColorModeValue('#f8fafc', 'gray.700');
  const recentClientsSectionBg = useColorModeValue('#f1f5f9', 'gray.800');

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

  return (
    <Box 
      h="100%" 
      bg={bgColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      minH={0}
    >
      <ScrollArea.Root
        type="always"
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 4 }}
        className="sidebar-scroll-area"
      >
        <ScrollArea.Viewport style={{ height: '100%', width: '100%' }}>
          <Box p={4}>
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
                        py={1.5}
                        fontSize="sm"
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
                          as={Star}
                          boxSize={2.5}
                          color="yellow.400"
                          fill="yellow.400"
                          position="absolute"
                          left="8px"
                          top="50%"
                          transform="translateY(-50%)"
                          flexShrink={0}
                        />
                        <Icon
                          as={Folder}
                          boxSize={4}
                          mr={2}
                          ml={2}
                          color="blue.400"
                          flexShrink={0}
                        />
                        <Text
                          noOfLines={1}
                          color="inherit"
                          fontWeight="normal"
                          flex={1}
                        >
                          {pinnedPath.split(/[/\\]/).filter(Boolean).pop()}
                        </Text>
                        {/* Move up/down buttons */}
                        <HStack spacing={0} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            aria-label="Move up"
                            icon={<ChevronUp size={14} />}
                            size="xs"
                            variant="ghost"
                            minW={6}
                            h={6}
                            isDisabled={index === 0}
                            onClick={() => moveQuickAccessPath(pinnedPath, 'up')}
                          />
                          <IconButton
                            aria-label="Move down"
                            icon={<ChevronDown size={14} />}
                            size="xs"
                            variant="ghost"
                            minW={6}
                            h={6}
                            isDisabled={index === quickAccessPaths.length - 1}
                            onClick={() => moveQuickAccessPath(pinnedPath, 'down')}
                          />
                        </HStack>
                      </Flex>
                    ))
                  ) : null}

                  {/* Separator between pinned and auto-populated when both exist */}
                  {Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0 && rootFolders.filter(f => !quickAccessPaths?.includes(f.path)).length > 0 && (
                    <Divider
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
                          py={1.5}
                          fontSize="sm"
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
                          <Icon as={Folder} boxSize={4} mr={2} ml={2} color="blue.400" flexShrink={0} />
                          <Text noOfLines={1} color="inherit" fontWeight="normal">
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

        {/* Recent Clients Section */}
      {Array.isArray(recentClientPaths) && recentClientPaths.length > 0 && (
        <Box
          mb={0}
          flexShrink={0}
          mt={3}
          bg={recentClientsSectionBg}
          borderRadius={0}
          px={2}
          py={2}
        >
          <Box {...sectionHeaderStyle} py={1} mb={0}>
            <Text fontSize="sm" fontWeight="semibold" color={textColor} letterSpacing={0.5}>
              RECENT CLIENTS
            </Text>
          </Box>
          <Box
            position="relative"
            display="flex"
            flexDirection="column"
          >
              {recentClientPaths.map((clientPath) => (
                <Flex
                  key={clientPath}
                  align="center"
                  px={2}
                  py={1.5}
                  fontSize="sm"
                  _hover={{ bg: transferSectionBg }}
                  color={textColor}
                  cursor="pointer"
                  style={{ userSelect: 'none' }}
                  onClick={() => setCurrentDirectory(clientPath)}
                  borderRadius={0}
                  position="relative"
                >
                  <Icon
                    as={Folder}
                    boxSize={4}
                    mr={2}
                    color="blue.400"
                    flexShrink={0}
                  />
                  <Text noOfLines={1} color="inherit" fontWeight="normal" flex={1}>
                    {clientPath.split(/[/\\]/).filter(Boolean).pop()}
                  </Text>
                </Flex>
              ))}
          </Box>
        </Box>
      )}

          </Box>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
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






