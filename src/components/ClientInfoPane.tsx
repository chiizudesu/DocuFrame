import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Tooltip, IconButton, Spacer, Input, Menu, MenuButton, MenuList, MenuItem, Icon, Portal, Spinner, Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody } from '@chakra-ui/react';
import { ExternalLink, FileText, Info, ChevronLeft, ChevronRight, RefreshCw, X, ChevronDown, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
// Removed ReactMarkdown and related imports - document insights moved to dedicated dialog
import type { FileItem } from '../types';
import { DraggableFileItem } from './DraggableFileItem';

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse }) => {
  const {
    currentDirectory,
    setCurrentDirectory,
    addLog,
    rootDirectory,
    setStatus,
    setFolderItems
  } = useAppContext();

  // Removed modal state - document insights moved to dedicated dialog

  // Removed document insights functionality - now available as a dedicated dialog

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const accentColor = useColorModeValue('#3b82f6', 'blue.400');
  const labelColor = useColorModeValue('#64748b', 'gray.400');
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
  const transferBorderColor = useColorModeValue('#e2e8f0', 'gray.600');
  const transferItemBg = useColorModeValue('white', 'gray.700');
  const transferItemBorderColor = useColorModeValue('gray.300', 'gray.600');
  const transferButtonBg = useColorModeValue('blue.600', 'blue.400');
  const transferSectionBorderColor = useColorModeValue('#f1f5f9', 'gray.700');

  // State for loaded client info
  const [clientInfo, setClientInfo] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Add at the top, after other useState imports
  const [clientInfoOpen, setClientInfoOpen] = useState(true);
  // Quick access state
  const [quickAccessOpen, setQuickAccessOpen] = useState(true);
  const [quickAccessFolders, setQuickAccessFolders] = useState<FileItem[]>([]);
  const [loadingQuickAccess, setLoadingQuickAccess] = useState(false);
  
  // Transfer Files state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFileName, setTransferFileName] = useState('');
  const [transferFileCount, setTransferFileCount] = useState(1);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferPreviewFiles, setTransferPreviewFiles] = useState<FileItem[]>([]);
  
  // Auto-update preview when inputs change
  useEffect(() => {
    if (transferOpen && transferFileCount >= 1) {
      const timeoutId = setTimeout(() => {
        handleTransferPreview();
      }, 300); // Debounce to avoid excessive API calls
      
      return () => clearTimeout(timeoutId);
    }
  }, [transferFileCount, transferFileName, transferOpen]);

  // Extract client name and tax year from path (ensure clientName is always defined)
  const pathSegments = currentDirectory ? currentDirectory.split(/[/\\]/).filter(segment => segment && segment !== '') : [];
  const rootSegments = rootDirectory ? rootDirectory.split(/[/\\]/).filter(Boolean) : [];
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === (rootSegments[rootSegments.length - 1] || '').toLowerCase());
  const taxYear = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';

  // --- Auto-load client info when entering a client folder ---
  useEffect(() => {
    // Only try to load client info if we have a plausible clientName
    if (clientName) {
      handleLoadClientInfo();
    } else {
      setClientInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientName]);

  // --- Fix quick access scan to not run if rootDirectory is empty ---
  useEffect(() => {
    if (!rootDirectory) return;
    const loadFolders = async () => {
      setLoadingQuickAccess(true);
      try {
        const folders = await window.electronAPI.getDirectoryContents(rootDirectory);
        // Filter only folders, exclude dot folders, and sort alphabetically
        const sortedFolders = folders
          .filter((item: FileItem) => item.type === 'folder' && !item.name.startsWith('.'))
          .sort((a: FileItem, b: FileItem) => a.name.localeCompare(b.name));
        setQuickAccessFolders(sortedFolders);
      } catch (error) {
        console.error('Failed to load quick access folders:', error);
        addLog('Failed to load quick access folders', 'error');
      } finally {
        setLoadingQuickAccess(false);
      }
    };
    loadFolders();
  }, [rootDirectory]);
  
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

  // Handler for loading quick access folders
  const handleLoadQuickAccess = async () => {
    setLoadingQuickAccess(true);
    try {
      const folders = await window.electronAPI.getDirectoryContents(rootDirectory);
      // Filter only folders and sort alphabetically
      const sortedFolders = folders
        .filter((item: FileItem) => item.type === 'folder')
        .sort((a: FileItem, b: FileItem) => a.name.localeCompare(b.name));
      setQuickAccessFolders(sortedFolders);
    } catch (error) {
      console.error('Failed to load quick access folders:', error);
      addLog('Failed to load quick access folders', 'error');
    } finally {
      setLoadingQuickAccess(false);
    }
  };

  // Handler for transfer preview
  const handleTransferPreview = async () => {
    if (transferFileCount < 1) {
      addLog('Number of files must be at least 1', 'error');
      return;
    }

    try {
      const previewResult = await window.electronAPI.transfer({ 
        numFiles: transferFileCount,
        command: 'preview',
        currentDirectory: currentDirectory // Pass current directory
      });
      
      if (previewResult.success && previewResult.files) {
        setTransferPreviewFiles(previewResult.files.slice(0, 3)); // Limit to 3 files
        addLog(`Preview: ${previewResult.files.length} files will be transferred`, 'info');
      } else {
        addLog(previewResult.message, 'error');
        setTransferPreviewFiles([]);
      }
    } catch (error) {
      console.error('Error during transfer preview:', error);
      addLog(`Error during transfer preview: ${error}`, 'error');
      setTransferPreviewFiles([]);
    }
  };

  // Handler for transfer files
  const handleTransferFiles = async () => {
    if (transferFileCount < 1) {
      addLog('Number of files must be at least 1', 'error');
      return;
    }

    setTransferLoading(true);
    try {
      // Execute the actual transfer
      const transferResult = await window.electronAPI.transfer({ 
        numFiles: transferFileCount,
        command: 'transfer',
        currentDirectory: currentDirectory, // Pass current directory
        newName: transferFileName || undefined // Pass new filename if provided
      });
      
      if (transferResult.success) {
        addLog(transferResult.message, 'response');
        setStatus('Transfer completed', 'success');
        // Clear form and preview
        setTransferFileName('');
        setTransferFileCount(1);
        setTransferPreviewFiles([]);
        // Refresh folder view
        setStatus('Refreshing folder...', 'info');
        if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
          const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
          if (typeof setFolderItems === 'function') setFolderItems(contents);
          setStatus('Folder refreshed', 'success');
        }
      } else {
        addLog(transferResult.message, 'error');
        setStatus('Transfer failed', 'error');
      }
    } catch (error) {
      console.error('Error during transfer:', error);
      addLog(`Error during transfer: ${error}`, 'error');
      setStatus('Transfer failed', 'error');
    } finally {
      setTransferLoading(false);
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
                maxH="240px" // Increased to fit one more folder row
                minH="100px"
              >
                {loadingQuickAccess ? (
                  <Flex justify="center" align="center" py={3}>
                    <Spinner size="sm" color={accentColor} />
                  </Flex>
                ) : quickAccessFolders.length > 0 ? (
                  quickAccessFolders.map((folder, index) => (
                    <Flex
                      key={folder.path}
                      align="center"
                      px={3}
                      py={1}
                      fontSize="sm" // Reduced font size by 1px
                      _hover={{
                        bg: transferSectionBg
                      }}
                      color={textColor}
                      cursor="pointer"
                      style={{ userSelect: 'none' }}
                      onClick={() => setCurrentDirectory(folder.path)}
                      borderRadius={0}
                    >
                      <Text
                        noOfLines={1}
                        color="inherit"
                        fontWeight="normal" // Not bold
                      >
                        {folder.name}
                      </Text>
                    </Flex>
                  ))
                ) : (
                  <Flex justify="center" align="center" py={3}>
                    <Text fontSize="sm" color={secondaryTextColor}>
                      No folders found
                    </Text>
                  </Flex>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
      {/* Add this separator */}
      <Divider mb={2} borderColor={dividerBorderColor} />
      {/* Transfer Files Section */}
      <Box mb={2} flexShrink={0}>
        <Box {...sectionHeaderStyle}
          onClick={() => {
            const newOpen = !transferOpen;
            setTransferOpen(newOpen);
            // Auto-preview when expanding
            if (newOpen && transferFileCount >= 1) {
              handleTransferPreview();
            }
          }}
        >
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            TRANSFER FILES
          </Text>
          <IconButton
            aria-label={transferOpen ? 'Collapse' : 'Expand'}
            icon={<ChevronDown size={18} style={{ transform: transferOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />}
            size="xs"
            variant="ghost"
            onClick={e => { 
              e.stopPropagation(); 
              const newOpen = !transferOpen;
              setTransferOpen(newOpen);
              // Auto-preview when expanding
              if (newOpen && transferFileCount >= 1) {
                handleTransferPreview();
              }
            }}
            tabIndex={-1}
          />
        </Box>
        {transferOpen && (
          <Box borderRadius="md" bg="transparent" w="100%" p={3}>
            <VStack align="stretch" spacing={3}>
              {/* Number of Files */}
              <Box>
                <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={1}>
                  Number of Files
                </Text>
                <Input
                  type="number"
                  value={transferFileCount}
                  onChange={(e) => {
                    const newCount = Math.max(1, parseInt(e.target.value) || 1);
                    setTransferFileCount(newCount);
                  }}
                  size="sm"
                  min={1}
                  fontSize="sm"
                  color={textColor}
                  bg={transferItemBg}
                  borderColor={transferItemBorderColor}
                  _focus={{
                    borderColor: accentColor,
                    boxShadow: `0 0 0 1px ${accentColor}`
                  }}
                />
              </Box>
              
              {/* New File Name */}
              <Box>
                <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={1}>
                  New File Name
                </Text>
                <Input
                  placeholder="Enter new filename"
                  value={transferFileName}
                  onChange={(e) => setTransferFileName(e.target.value)}
                  size="sm"
                  fontSize="sm"
                  color={textColor}
                  bg={transferItemBg}
                  borderColor={transferItemBorderColor}
                  _focus={{
                    borderColor: accentColor,
                    boxShadow: `0 0 0 1px ${accentColor}`
                  }}
                  isDisabled={transferFileCount > 1}
                  opacity={transferFileCount > 1 ? 0.5 : 1}
                />

              </Box>
              
              {/* Transfer Button */}
              <Button
                leftIcon={<Upload size={16} />}
                onClick={handleTransferFiles}
                isLoading={transferLoading}
                loadingText="Transferring..."
                size="sm"
                colorScheme="blue"
                fontWeight="medium"
                _hover={{
                  bg: transferButtonBg
                }}
              >
                Transfer Files
              </Button>
            </VStack>
            
            {/* Preview Area */}
            {transferPreviewFiles.length > 0 && (
              <Box mt={3} border="1px solid" borderColor={borderColor} borderRadius="md" bg="transparent" w="100%">
                <Box
                  bg={transferSectionBg}
                  borderBottom="1px solid"
                  borderColor={transferBorderColor}
                  px={3}
                  py={2}
                >
                  <Flex align="center" fontSize="xs" fontWeight="medium" color={secondaryTextColor}>
                    <Text>Preview ({transferPreviewFiles.length} files)</Text>
                  </Flex>
                </Box>
                
                <Box
                  maxH="120px"
                  minH="60px"
                  overflowY="auto"
                  className="enhanced-scrollbar"
                >
                  {transferPreviewFiles.map((file, index) => (
                    <Flex
                      key={file.path}
                      align="flex-start"
                      px={3}
                      py={2}
                      fontSize="xs"
                      borderBottom={index < transferPreviewFiles.length - 1 ? "1px solid" : "none"}
                      borderColor={transferSectionBorderColor}
                      _hover={{
                        bg: transferSectionBg}
                      }
                      color={textColor}
                      cursor="default"
                      style={{ userSelect: 'none' }}
                      borderRadius={0}
                    >
                      <Icon
                        as={getFileIcon(file.type, file.name)}
                        color={getIconColor(file.type, file.name)}
                        boxSize={4}
                        mt={0.5}
                        flexShrink={0}
                      />
                      <Text
                        noOfLines={transferPreviewFiles.length === 1 ? 2 : 1}
                        color="inherit"
                        fontWeight="medium"
                        ml={2}
                        wordBreak="break-word"
                      >
                        {file.name}
                      </Text>
                    </Flex>
                  ))}
                </Box>
              </Box>
            )}
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






