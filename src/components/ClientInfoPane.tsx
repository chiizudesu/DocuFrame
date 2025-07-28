import React, { useState } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Tooltip, IconButton, Spacer, Input, Menu, MenuButton, MenuList, MenuItem, Icon, Portal, Spinner, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody } from '@chakra-ui/react';
import { ExternalLink, FileText, Info, ChevronLeft, ChevronRight, RefreshCw, X, ChevronDown, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
// Removed ReactMarkdown and related imports - document insights moved to dedicated dialog
import type { FileItem } from '../types';
import { DraggableFileItem } from './DraggableFileItem';

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse }) => {
  const {
    currentDirectory,
    addLog,
    rootDirectory,
    setStatus
  } = useAppContext();

  // Removed modal state - document insights moved to dedicated dialog

  // Removed document insights functionality - now available as a dedicated dialog

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const accentColor = useColorModeValue('#3b82f6', 'blue.400');
  const labelColor = useColorModeValue('#64748b', 'gray.400');
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');

  // State for loaded client info
  const [clientInfo, setClientInfo] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Add at the top, after other useState imports
  const [clientInfoOpen, setClientInfoOpen] = useState(false);
  // Removed document insights state
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [downloadsFiles, setDownloadsFiles] = useState<FileItem[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [selectedDownloads, setSelectedDownloads] = useState<string[]>([]);
  const [lastSelectedDownloadIndex, setLastSelectedDownloadIndex] = useState<number | null>(null);

  // Extract client name and tax year from path
  const pathSegments = currentDirectory.split(/[/\\]/).filter(segment => segment && segment !== '');
  // Find the index of the root (Client) folder
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === rootDirectory.split(/[/\\]/).filter(Boolean).pop()?.toLowerCase());
  // Client Name is the third segment after root, Tax Year is the second segment after root
  const taxYear = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';
  
  // Extract document name from current directory
  const documentName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'Current Folder';
  
  // Get file extension if it's a file
  const getFileExtension = (filename: string) => {
    const ext = filename.split('.').pop();
    return ext && ext !== filename ? ext.toLowerCase() : null;
  };
  
  const fileExtension = getFileExtension(documentName);
  const documentDisplayName = fileExtension ? `${documentName}` : documentName;

  // Utility functions for file icons and formatting
  const getFileIcon = (type: string, name: string) => {
    if (type === 'folder') {
      return FileText;
    }
    
    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return FileText;
      case 'doc':
      case 'docx':
        return FileText;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return FileText;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return FileText;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return FileText;
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        return FileText;
      default:
        return FileText;
    }
  };

  const getIconColor = (type: string, name: string) => {
    if (type === 'folder') return 'blue.400';
    
    const extension = name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'red.400';
      case 'doc':
      case 'docx':
        return 'blue.400';
      case 'xls':
      case 'xlsx':
      case 'csv':
        return 'green.400';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        return 'purple.400';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return 'orange.400';
      case 'txt':
      case 'md':
      case 'json':
      case 'xml':
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        return 'yellow.400';
      default:
        return 'gray.400';
    }
  };

  // Format file size
  const formatFileSize = (size: string | undefined) => {
    if (!size) return '';
    const sizeNum = parseFloat(size);
    if (isNaN(sizeNum)) return size;
    return `${(sizeNum / 1024).toFixed(1)} KB`;
  };

  // Handler for loading downloads files
  const handleLoadDownloads = async () => {
    setLoadingDownloads(true);
    try {
      const downloadsPath = await window.electronAPI.getDownloadsPath();
      const files = await window.electronAPI.getDirectoryContents(downloadsPath);
      // Sort by modified date, newest first, and limit to 20 items
      const sortedFiles = files
        .filter((file: FileItem) => file.type === 'file')
        .sort((a: FileItem, b: FileItem) => {
          const dateA = new Date(a.modified || '');
          const dateB = new Date(b.modified || '');
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 20);
      setDownloadsFiles(sortedFiles);
    } catch (error) {
      console.error('Failed to load downloads:', error);
      addLog('Failed to load downloads folder', 'error');
    } finally {
      setLoadingDownloads(false);
    }
  };

  // Handler for loading client info
  const handleLoadClientInfo = async () => {
    // Log path info for debugging only when loading client info
    addLog(`[ClientInfoPane] pathSegments: ${JSON.stringify(pathSegments)}, rootIdx: ${rootIdx}, rootDirectory: ${rootDirectory}`);
    setLoadingClient(true);
    setClientError(null);
    // Log the extracted clientName for debugging
    console.log('[ClientInfoPane] Extracted clientName:', clientName);
    addLog(`[ClientInfoPane] Extracted clientName: ${clientName}`);
    if (!clientName) {
      setClientError('Could not extract client name from path.');
      setClientInfo(null);
      setLoadingClient(false);
      return;
    }
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = config.clientbasePath;
      if (!csvPath) {
        setClientError('Clientbase CSV path not configured');
        setLoadingClient(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setClientError('No client data found');
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
        setClientError('No matching client found');
        setClientInfo(null);
        setLoadingClient(false);
        return;
      }
      setClientInfo(match);
    } catch (err: any) {
      setClientError('Failed to load client info');
      setClientInfo(null);
    }
    setLoadingClient(false);
  };

  // Removed handleBrainIconClick - document analysis moved to dedicated dialog

  // Handler for selecting downloads (multi-select logic)
  const handleSelectDownload = (file: FileItem, index: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedDownloadIndex !== null) {
      // Range select
      const start = Math.min(lastSelectedDownloadIndex, index);
      const end = Math.max(lastSelectedDownloadIndex, index);
      const range = downloadsFiles.slice(start, end + 1).map(f => f.name);
      setSelectedDownloads(prev => Array.from(new Set([...prev, ...range])));
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle select
      setSelectedDownloads(prev =>
        prev.includes(file.name)
          ? prev.filter(name => name !== file.name)
          : [...prev, file.name]
      );
      setLastSelectedDownloadIndex(index);
    } else {
      // Single select
      setSelectedDownloads([file.name]);
      setLastSelectedDownloadIndex(index);
    }
  };

  // Section header style for all three sections
  const sectionHeaderStyle = {
    w: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    px: 2,
    py: 2,
    borderRadius: "md",
    bg: "transparent",
    _hover: { bg: useColorModeValue('gray.50', 'gray.800') },
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
                       bg={useColorModeValue('white', 'gray.800')}
                       border="1px solid"
                       borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
                       boxShadow="lg"
                       w="auto"
                       minW="120px"
                       maxW="150px"
                     >
                       <PopoverArrow 
                         bg={useColorModeValue('white', 'gray.800')}
                         borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
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
      {/* Quick Actions (no label) with collapse button at top right */}
      <Flex mb={6} alignItems="center" flexShrink={0}>
        <Flex gap={3} flex="1">
          <Button 
            leftIcon={<Info size={16} />} 
            variant="outline" 
            size="sm" 
            flex="1" 
            onClick={handleOpenClientLink} 
            borderColor={accentColor} 
            color={accentColor}
            fontWeight="medium"
            isDisabled={!(clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']))}
            _hover={{
              bg: useColorModeValue('#f1f5f9', 'gray.700'),
              borderColor: accentColor
            }}
          >
            Client
          </Button>
          {(() => {
            if (!clientInfo) {
              return (
                <Button 
                  leftIcon={<FileText size={16} />} 
                  variant="outline" 
                  size="sm" 
                  flex="1" 
                  isDisabled={true}
                  borderColor="green.500" 
                  color="green.600"
                  fontWeight="medium"
                  _hover={{
                    bg: useColorModeValue('#f0fdf4', 'gray.700'),
                    borderColor: "green.500"
                  }}
                >
                  Job
                </Button>
              );
            }

            const has2025 = clientInfo['2025 Job Link'];
            const has2026 = clientInfo['2026 Job Link'];
            const currentYearLink = taxYear && clientInfo[`${taxYear} Job Link`];

            if (has2025 && has2026) {
              // Both years available - show popover
              return (
                                 <Box flex="1">
                   <Popover placement="right-start">
                     <PopoverTrigger>
                       <Button
                       leftIcon={<FileText size={16} />}
                       rightIcon={<ChevronDown size={16} />}
                       variant="outline"
                       size="sm"
                       w="100%"
                       borderColor="green.500"
                       color="green.600"
                       fontWeight="medium"
                       _hover={{
                         bg: useColorModeValue('#f0fdf4', 'gray.700'),
                         borderColor: "green.500"
                       }}
                     >
                       Job
                       </Button>
                     </PopoverTrigger>
                     <Portal>
                       <PopoverContent
                       bg={useColorModeValue('white', 'gray.800')}
                       border="1px solid"
                         borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
                         boxShadow="lg"
                         w="auto"
                         minW="120px"
                         maxW="150px"
                         zIndex={9999}
                       >
                         <PopoverArrow 
                           bg={useColorModeValue('white', 'gray.800')}
                           borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
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
                 </Box>
              );
            } else {
              // Single year or current year available
              const isDisabled = !(currentYearLink || has2025 || has2026);
              
              return (
                <Button 
                  leftIcon={<FileText size={16} />} 
                  variant="outline" 
                  size="sm" 
                  flex="1" 
                  onClick={() => handleOpenJobLink()} 
                  borderColor="green.500" 
                  color="green.600"
                  fontWeight="medium"
                  isDisabled={isDisabled}
                  _hover={{
                    bg: useColorModeValue('#f0fdf4', 'gray.700'),
                    borderColor: "green.500"
                  }}
                >
                  Job
                </Button>
              );
            }
          })()}
        </Flex>
        <IconButton aria-label="Collapse sidebar" icon={<ChevronLeft size={20} strokeWidth={2.5} />} size="sm" variant="ghost" ml={2} onClick={onToggleCollapse} />
      </Flex>

      {/* Downloads Section */}
      <Box mb={2} flexShrink={0}>
        <Box {...sectionHeaderStyle}
          onClick={() => {
            setDownloadsOpen((open) => !open);
            if (!downloadsOpen && downloadsFiles.length === 0) {
              handleLoadDownloads();
            }
          }}
        >
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Downloads
          </Text>
          <Flex align="center" gap={1}>
            <IconButton
              aria-label="Refresh downloads"
              icon={<RefreshCw size={16} />}
              size="xs"
              isLoading={loadingDownloads}
              onClick={e => { e.stopPropagation(); handleLoadDownloads(); }}
              variant="ghost"
              color={accentColor}
              _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
            />
            <IconButton
              aria-label={downloadsOpen ? 'Collapse' : 'Expand'}
              icon={<ChevronDown size={18} style={{ transform: downloadsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />}
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setDownloadsOpen((open) => !open); }}
              tabIndex={-1}
            />
          </Flex>
        </Box>
        {downloadsOpen && (
          <Box w="100%" flex="1" display="flex" flexDirection="column" minHeight="0" pt={2} pb={2}>
            <Box
              position="relative"
              flex="1"
              minH="0"
          display="flex"
              flexDirection="column"
              bg={useColorModeValue('#ffffff', 'gray.800')}
              border="1px solid"
              borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
          borderRadius="md"
              overflow="hidden"
            >
              {/* Mini folder view header */}
              <Box
                bg={useColorModeValue('#f8fafc', 'gray.700')}
                borderBottom="1px solid"
                borderColor={useColorModeValue('#e2e8f0', 'gray.600')}
                px={3}
                py={2}
              >
                <Flex align="center" fontSize="xs" fontWeight="medium" color={secondaryTextColor}>
                  <Text>Name</Text>
                </Flex>
              </Box>
              
              {/* Files list */}
              <Box
                flex="1"
                overflowY="auto"
                className="enhanced-scrollbar"
                maxH="200px"
                minH="100px"
              >
                {loadingDownloads ? (
                  <Flex justify="center" align="center" py={4}>
                    <Spinner size="sm" color={accentColor} />
                  </Flex>
                ) : downloadsFiles.length > 0 ? (
                  downloadsFiles.map((file, index) => (
                    <DraggableFileItem
                      key={file.path}
                      file={file}
                      isSelected={selectedDownloads.includes(file.name)}
                      selectedFiles={selectedDownloads}
                      sortedFiles={downloadsFiles}
                      index={index}
                      onSelect={(f, i, e) => handleSelectDownload(f, i, e)}
                      onContextMenu={() => {}}
                      onDragStateReset={() => {}}
                      onFileMouseDown={() => {}}
                      onFileClick={() => {}}
                      as="box"
                    >
                      <Flex
                        align="center"
                        px={3}
                        py={2}
                        fontSize="xs"
                        borderBottom="1px solid"
                        borderColor={useColorModeValue('#f1f5f9', 'gray.700')}
                        _hover={{
                          bg: useColorModeValue('#f8fafc', 'gray.700')
                        }}
                        bg={selectedDownloads.includes(file.name) ? useColorModeValue('#dbeafe', 'blue.800') : 'transparent'}
                        color={selectedDownloads.includes(file.name) ? useColorModeValue('#1e40af', 'white') : textColor}
                        cursor="default"
                        style={{ userSelect: 'none' }}
                        onClick={e => handleSelectDownload(file, index, e)}
                        borderRadius={0}
                      >
                        <Icon
                          as={getFileIcon(file.type, file.name)}
                          color={getIconColor(file.type, file.name)}
                          boxSize={4}
                        />
                        <Text
                          noOfLines={1}
                          color="inherit"
                          fontWeight="medium"
                          ml={2}
                        >
                          {file.name}
                        </Text>
                      </Flex>
                    </DraggableFileItem>
                  ))
                ) : (
                  <Flex justify="center" align="center" py={4}>
                    <Text fontSize="xs" color={secondaryTextColor}>
                      No files in Downloads
                    </Text>
                  </Flex>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* Client Information */}
      <Box mb={2} flexShrink={0}>
        <Box {...sectionHeaderStyle}
          onClick={() => setClientInfoOpen((open) => !open)}
        >
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Client Information
          </Text>
          <Flex align="center" gap={1}>
            <IconButton
              aria-label="Refresh client info"
              icon={<RefreshCw size={16} />}
              size="xs"
              isLoading={loadingClient}
              onClick={e => { e.stopPropagation(); handleLoadClientInfo(); }}
              variant="ghost"
              color={accentColor}
              _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
            />
            <IconButton
              aria-label={clientInfoOpen ? 'Collapse' : 'Expand'}
              icon={<ChevronDown size={18} style={{ transform: clientInfoOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />}
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setClientInfoOpen((open) => !open); }}
              tabIndex={-1}
            />
          </Flex>
        </Box>
        {clientInfoOpen && (
          <Box border="1px solid" borderColor={borderColor} borderRadius="md" bg="transparent" w="100%" p={3}>
            <Box mb={2} py={1} borderRadius="md" bg="transparent">
              <Text fontSize="md" fontWeight="bold" color={clientInfo ? textColor : 'gray.500'} textAlign="left">
                {clientInfo ? (clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']) : 'No client is loaded'}
              </Text>
            </Box>
            <VStack align="stretch" spacing={3}>
              {/* IRD Number */}
              <Box>
                <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={0.5}>IRD Number</Text>
                <Text fontSize="sm" color={secondaryTextColor} fontFamily="mono">
                  {clientInfo ? (clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || '-') : '-'}
                </Text>
              </Box>
              {/* Address */}
              {clientInfo && clientInfo['Address'] && (
                <Box>
                  <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={0.5}>Address</Text>
                  <Text fontSize="sm" color={secondaryTextColor}>{clientInfo['Address']}</Text>
                </Box>
              )}
              {clientError && <Text color="red.500" fontSize="sm">{clientError}</Text>}
            </VStack>
          </Box>
        )}
      </Box>

      {/* Document Insights functionality moved to dedicated dialog */}

      {/* Downloads Section */}
      {/* Removed as per user request */}

      {/* Recent Activity */}
      {/* Removed as per user request */}

      {/* Document Insights Modal removed - functionality moved to dedicated dialog */}
    </Box>
  );
};






