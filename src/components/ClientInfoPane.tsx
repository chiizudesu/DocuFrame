import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Tooltip, IconButton, Icon, Portal, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody } from '@chakra-ui/react';
import { ExternalLink, FileText, Info, ChevronLeft, ChevronRight, Folder, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
// Removed ReactMarkdown and related imports - document insights moved to dedicated dialog

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse }) => {
  const {
    currentDirectory,
    setCurrentDirectory,
    addLog,
    rootDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
  } = useAppContext();

  // Removed modal state - document insights moved to dedicated dialog

  // Removed document insights functionality - now available as a dedicated dialog

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');
  
  // Additional color mode values for conditional rendering
  const popoverBg = useColorModeValue('white', 'gray.800');
  const popoverBorderColor = useColorModeValue('#e2e8f0', 'gray.600');
  const dividerBorderColor = useColorModeValue('gray.300', 'gray.600');
  const clientInfoBg = useColorModeValue('blue.50', 'blue.900');
  const clientInfoColor = useColorModeValue('blue.900', 'blue.100');
  const noClientBg = useColorModeValue('gray.100', 'gray.700');
  const noClientColor = useColorModeValue('gray.600', 'gray.300');
  const transferBg = useColorModeValue('#ffffff', 'gray.800');
  const transferSectionBg = useColorModeValue('#f8fafc', 'gray.700');

  // State for loaded client info
  const [clientInfo, setClientInfo] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  // Quick access state
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

  // Extract client name and tax year from path (ensure clientName is always defined)
  const pathSegments = currentDirectory ? currentDirectory.split(/[\/\\]/).filter(segment => segment && segment !== '') : [];
  const rootSegments = rootDirectory ? rootDirectory.split(/[\/\\]/).filter(Boolean) : [];
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === (rootSegments[rootSegments.length - 1] || '').toLowerCase());
  const taxYear = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';

  // --- Auto-load client info when entering a client folder ---
  useEffect(() => {
    if (clientName) {
      handleLoadClientInfo();
    } else {
      setClientInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName]);

  // Extract document name from current directory (unused display removed)
  const documentName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'Current Folder';
  
  const getFileExtension = (filename: string) => {
    const ext = filename.split('.').pop();
    return ext && ext !== filename ? ext.toLowerCase() : null;
  };
  getFileExtension(documentName);

  // Handler for loading client info
  const handleLoadClientInfo = async () => {
    addLog(`[ClientInfoPane] pathSegments: ${JSON.stringify(pathSegments)}, rootIdx: ${rootIdx}, rootDirectory: ${rootDirectory}`);
    setLoadingClient(true);
    // Log the extracted clientName for debugging
    console.log('[ClientInfoPane] Extracted clientName:', clientName);
    addLog(`[ClientInfoPane] Extracted clientName: ${clientName}`);
    if (!clientName) {
      setClientInfo(null);
      setLoadingClient(false);
      return;
    }
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      if (!csvPath) {
        setLoadingClient(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setLoadingClient(false);
        return;
      }
      // Fuzzy/case-insensitive match
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const match = rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().replace(/\s+/g, '') === clientName.toLowerCase().replace(/\s+/g, '');
      }) || rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().includes(clientName.toLowerCase());
      });
      if (!match) {
        setClientInfo(null);
        setLoadingClient(false);
        return;
      }
      setClientInfo(match);
    } catch (err: any) {
      setClientInfo(null);
    }
    setLoadingClient(false);
  };

  // Section header style for all three sections
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

  if (collapsed) {
    return (
      <Box p={2} h="100%" bg={bgColor} display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start">
        {/* Collapse/Expand button at the very top, centered */}
        <Box w="100%" display="flex" justifyContent="center" mb={3}>
          <IconButton aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} icon={<ChevronRight size={20} strokeWidth={2.5} />} size="sm" variant="ghost" onClick={onToggleCollapse} />
        </Box>
        {/* Only 3 icons: Client Info, Client Link, Job Link */}
        <Tooltip label={<Box minW="180px"><Text fontWeight="bold">Client Information</Text><Divider my={1} />
          <Text fontSize="sm"><b>Name:</b> {clientInfo ? (clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']) : 'No client loaded'}<br/>
          <b>IRD #:</b> {clientInfo ? (clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || '-') : '-'}<br/>
          <b>Address:</b> {clientInfo && clientInfo['Address'] ? clientInfo['Address'] : '-'}</Text></Box>} placement="right" hasArrow>
          <IconButton 
            aria-label="Client Info" 
            icon={<Info size={20} strokeWidth={2.5} />} 
            size="md" 
            variant="solid" 
            bg="#6d28d9" 
            color="#ede9fe" 
            borderRadius="lg" 
            _hover={{ bg: '#6d28d9', color: '#ddd6fe' }} 
            mb={2}
            onClick={handleLoadClientInfo}
            isLoading={loadingClient}
          />
        </Tooltip>
        {clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']) && (
          <Tooltip label="Open Client Page" placement="right" hasArrow>
            <IconButton aria-label="Client Link" icon={<ExternalLink size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#1976d2" color="#e3f0fa" borderRadius="lg" _hover={{ bg: '#1976d2', color: '#cbe3f7' }} mb={2} as="a" href={clientInfo['Client Link'] || clientInfo['ClientLink']} target="_blank" />
          </Tooltip>
        )}
        {clientInfo && (clientInfo['2025 Job Link'] || clientInfo['2026 Job Link']) && (
          (() => {
            const has2025 = clientInfo['2025 Job Link'];
            const has2026 = clientInfo['2026 Job Link'];
            const currentYearLink = taxYear && clientInfo[`${taxYear} Job Link`];
            
            if (has2025 && has2026) {
              // Both years available - show popover
              return (
                                 <Popover placement="right-start">
                   <Tooltip label="Open Job (2025/2026)" placement="right" hasArrow>
                     <PopoverTrigger>
                       <IconButton
                       aria-label="Job Links"
                       icon={<FileText size={20} strokeWidth={2.5} />}
                       size="md"
                       variant="solid"
                       bg="#388e3c"
                       color="#e3fae3"
                       borderRadius="lg"
                       _hover={{ bg: '#388e3c', color: '#c8f7cb' }}
                       mb={2}
                     />
                     </PopoverTrigger>
                   </Tooltip>
                   <Portal>
                     <PopoverContent
                       zIndex={9999}
                       bg={popoverBg}
                       border="1px solid"
                       borderColor={popoverBorderColor}
                       boxShadow="lg"
                       w="auto"
                       minW="120px"
                       maxW="150px"
                     >
                       <PopoverArrow 
                         bg={popoverBg}
                         borderColor={popoverBorderColor}
                       />
                       <PopoverBody p={3}>
                         <VStack spacing={2}>
                           <Button
                         onClick={() => window.open(clientInfo['2025 Job Link'], '_blank')}
                             bg="green.500"
                             color="white"
                             fontWeight="bold"
                         fontSize="sm"
                             borderRadius="md"
                             px={4}
                             py={2}
                             w="100%"
                             h="auto"
                         _hover={{ 
                               bg: "green.600"
                         }}
                         _focus={{ 
                               bg: "green.600"
                         }}
                         _active={{
                               bg: "green.700"
                         }}
                       >
                             2025
                           </Button>
                           <Button
                         onClick={() => window.open(clientInfo['2026 Job Link'], '_blank')}
                             bg="green.500"
                             color="white"
                             fontWeight="bold"
                         fontSize="sm"
                             borderRadius="md"
                             px={4}
                             py={2}
                             w="100%"
                             h="auto"
                         _hover={{ 
                               bg: "green.600"
                         }}
                         _focus={{ 
                               bg: "green.600"
                         }}
                         _active={{
                               bg: "green.700"
                         }}
                       >
                             2026
                           </Button>
                         </VStack>
                       </PopoverBody>
                     </PopoverContent>
                   </Portal>
                 </Popover>
              );
            } else if (currentYearLink) {
              // Only current year available
              return (
                <Tooltip label={`Open ${taxYear} Job`} placement="right" hasArrow>
                  <IconButton aria-label="Job Link" icon={<FileText size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#388e3c" color="#e3fae3" borderRadius="lg" _hover={{ bg: '#388e3c', color: '#c8f7cb' }} mb={2} as="a" href={currentYearLink} target="_blank" />
                </Tooltip>
              );
            } else {
              // Other year available
              const otherYear = has2025 ? '2025' : '2026';
              const otherLink = has2025 ? clientInfo['2025 Job Link'] : clientInfo['2026 Job Link'];
              return (
                <Tooltip label={`Open ${otherYear} Job`} placement="right" hasArrow>
                  <IconButton aria-label="Job Link" icon={<FileText size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#388e3c" color="#e3fae3" borderRadius="lg" _hover={{ bg: '#388e3c', color: '#c8f7cb' }} mb={2} as="a" href={otherLink} target="_blank" />
                </Tooltip>
              );
            }
          })()
        )}
        {/* Document insights button removed - functionality moved to Utilities → Analyze Docs */}
      </Box>
    );
  }

  // Expanded sidebar: replace Xero/XPM with Client/Job buttons
  const handleOpenClientLink = () => {
    if (clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink'])) {
      window.open(clientInfo['Client Link'] || clientInfo['ClientLink'], '_blank');
    }
  };
  const handleOpenJobLink = (year?: string) => {
    if (!clientInfo) return;
    
    if (year) {
      // Open specific year
      const link = clientInfo[`${year} Job Link`];
      if (link) {
        window.open(link, '_blank');
      }
    } else {
      // Open current year if available, otherwise any available year
      if (taxYear && clientInfo[`${taxYear} Job Link`]) {
        window.open(clientInfo[`${taxYear} Job Link`], '_blank');
      } else if (clientInfo['2025 Job Link']) {
        window.open(clientInfo['2025 Job Link'], '_blank');
      } else if (clientInfo['2026 Job Link']) {
        window.open(clientInfo['2026 Job Link'], '_blank');
      }
    }
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
      {/* --- Combined Client Info and Actions Section --- */}
      <Flex mb={4} align="center" justify="space-between">
        <Box
          flex="1"
          borderRadius="lg"
          px={3}
          py={2}
          bg={clientInfo ? clientInfoBg : noClientBg}
          color={clientInfo ? clientInfoColor : noClientColor}
          boxShadow={clientInfo ? 'sm' : 'none'}
          transition="background 0.2s, color 0.2s"
        >
          {clientInfo ? (
            <Flex align="center" justify="space-between">
              <Box flex="1" minW="0">
                <Text 
                  fontSize="md" 
                  fontWeight="bold" 
                  lineHeight={1.2} 
                  noOfLines={1}
                  cursor={clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']) ? 'pointer' : 'default'}
                  onClick={clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']) ? handleOpenClientLink : undefined}
                  _hover={clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']) ? {
                    textDecoration: 'underline',
                    opacity: 0.8
                  } : undefined}
                  mb={0.5}
                >
                  {clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']}
                </Text>
                <Text fontSize="xs" fontWeight="medium" opacity={0.85} noOfLines={1}>
                  {clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || '-'}
                </Text>
              </Box>
              {(() => {
                const has2025 = clientInfo['2025 Job Link'];
                const has2026 = clientInfo['2026 Job Link'];
                const currentYearLink = taxYear && clientInfo[`${taxYear} Job Link`];

                if (has2025 && has2026) {
                  // Both years available - show popover
                  return (
                    <Popover placement="right-start">
                      <PopoverTrigger>
                        <Box ml={2} cursor="pointer" display="flex" alignItems="center">
                          <FileText size={20} color="currentColor" opacity={0.7} />
                        </Box>
                      </PopoverTrigger>
                      <Portal>
                        <PopoverContent
                          bg={popoverBg}
                          border="1px solid"
                          borderColor={popoverBorderColor}
                          boxShadow="lg"
                          w="auto"
                          minW="120px"
                          maxW="150px"
                          zIndex={9999}
                        >
                          <PopoverArrow 
                            bg={popoverBg}
                            borderColor={popoverBorderColor}
                          />
                          <PopoverBody p={3}>
                            <VStack spacing={2}>
                              <Button
                                onClick={() => handleOpenJobLink('2025')}
                                bg="green.500"
                                color="white"
                                fontWeight="bold"
                                fontSize="sm"
                                borderRadius="md"
                                px={4}
                                py={2}
                                w="100%"
                                h="auto"
                                _hover={{ 
                                  bg: "green.600"
                                }}
                                _focus={{ 
                                  bg: "green.600"
                                }}
                                _active={{
                                  bg: "green.700"
                                }}
                              >
                                2025
                              </Button>
                              <Button
                                onClick={() => handleOpenJobLink('2026')}
                                bg="green.500"
                                color="white"
                                fontWeight="bold"
                                fontSize="sm"
                                borderRadius="md"
                                px={4}
                                py={2}
                                w="100%"
                                h="auto"
                                _hover={{ 
                                  bg: "green.600"
                                }}
                                _focus={{ 
                                  bg: "green.600"
                                }}
                                _active={{
                                  bg: "green.700"
                                }}
                              >
                                2026
                              </Button>
                            </VStack>
                          </PopoverBody>
                        </PopoverContent>
                      </Portal>
                    </Popover>
                  );
                } else {
                  // Single year or current year available
                  const isDisabled = !(currentYearLink || has2025 || has2026);
                  
                  return (
                    <Box 
                      ml={2} 
                      cursor={isDisabled ? 'default' : 'pointer'} 
                      display="flex" 
                      alignItems="center"
                      onClick={isDisabled ? undefined : () => handleOpenJobLink()}
                    >
                      <FileText 
                        size={20} 
                        color="currentColor" 
                        opacity={isDisabled ? 0.3 : 0.7} 
                      />
                    </Box>
                  );
                }
              })()}
            </Flex>
          ) : (
            <Text fontSize="sm" fontWeight="medium" opacity={0.7}>
              No client loaded
            </Text>
          )}
        </Box>
        
        {/* Collapse button positioned to the right */}
        <IconButton 
          aria-label="Collapse sidebar" 
          icon={<ChevronLeft size={20} strokeWidth={2.5} />} 
          size="sm" 
          variant="ghost" 
          ml={2}
          onClick={onToggleCollapse} 
        />
      </Flex>

      {/* Add separator above Quick Access */}
      <Divider mb={2} borderColor={dividerBorderColor} />
      
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






