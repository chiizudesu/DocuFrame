import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Divider, useColorModeValue, Icon } from '@chakra-ui/react';
import { Folder, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const ClientInfoPane: React.FC = () => {
  const {
    setCurrentDirectory,
    rootDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
  } = useAppContext();

  const bgColor = useColorModeValue('white', 'gray.850'); // Light theme: bright sidebar; dark: unchanged
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');
  const dividerBorderColor = useColorModeValue('gray.300', 'gray.600');
  const transferBg = 'transparent';
  const transferSectionBg = useColorModeValue('#f8fafc', 'gray.700');

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
      p={4} 
      h="100%" 
      bg={bgColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Quick Access Section */}
      <Box mb={1} flexShrink={0}>
        <Box {...sectionHeaderStyle} py={1} mb={0}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor} letterSpacing={0.5}>
            QUICK ACCESS
          </Text>
          {/* Removed refresh button */}
        </Box>
        {quickAccessOpen && (
          <Box w="100%" flex="1" display="flex" flexDirection="column" minHeight="0" pt={0} pb={0}>
            <Box
              position="relative"
              flex="1"
              minH="0"
              display="flex"
              flexDirection="column"
              bg={transferBg}
              borderRadius="md"
              overflow="hidden"
            >
              {/* Folders list */}
              <Box
                flex="1"
                overflowY="auto"
                overflowX="hidden"
                className="enhanced-scrollbar"
                maxH="600px" // Increased height to show more Quick Access folders
                minH="100px"
              >
                <>
                  {/* Hard-coded shortcuts at the top */}
                  <Flex
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
                    onClick={() => setCurrentDirectory('C:\\Users\\EdwardMatias\\Documents')}
                    borderRadius={0}
                    position="relative"
                  >
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
                    >
                      Documents
                    </Text>
                  </Flex>
                  
                  <Flex
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
                    onClick={() => setCurrentDirectory('C:\\Users\\EdwardMatias\\Documents\\Scripts')}
                    borderRadius={0}
                    position="relative"
                  >
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
                    >
                      Scripts
                    </Text>
                  </Flex>
                  
                  {/* Pinned quick access folders */}
                  {Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0 ? (
                    quickAccessPaths.map((pinnedPath) => (
                      <Flex
                        key={pinnedPath}
                        align="center"
                        px={4}
                        py={1.5}
                        fontSize="sm" // Reduced font size by 1px
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
                          fontWeight="normal" // Not bold
                        >
                          {pinnedPath.split(/[/\\]/).filter(Boolean).pop()}
                        </Text>
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
          </Box>
        )}
      </Box>
      {/* Add this separator */}
      <Divider mb={2} borderColor={dividerBorderColor} />
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






