import React, { useState } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Tooltip, IconButton, Spacer, Spinner, Input, Menu, MenuButton, MenuList, MenuItem, Portal, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure, Icon } from '@chakra-ui/react';
import { ExternalLink, FileText, Info, ChevronLeft, ChevronRight, RefreshCw, X, Brain, Send, ChevronDown, Maximize2, Upload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';
import { Heading, List, ListItem } from '@chakra-ui/react';
import type { FileItem } from '../types';
import { DraggableFileItem } from './DraggableFileItem';

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse }) => {
  const {
    currentDirectory,
    addLog,
    rootDirectory,
    documentInsights,
    setDocumentInsights,
    isExtractingInsights,
    setStatus
  } = useAppContext();

  // Chat functionality state
  const [chatInput, setChatInput] = useState('');
  const [modalChatInput, setModalChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Modal state
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // State for document summary
  const [documentSummary, setDocumentSummary] = useState<string>('');

  // Generate document summary
  const generateDocumentSummary = async () => {
    if (!documentInsights || documentSummary) return;
    
    try {
      const { extractDocumentInsights } = await import('../services/openai');
      const prompt = `Please provide a very brief 1-line summary (max 100 characters) of this document analysis:\n\n${documentInsights.substring(0, 500)}`;
      const summary = await extractDocumentInsights(prompt, 'Document Summary');
      setDocumentSummary(summary.substring(0, 100)); // Ensure it's short
    } catch (error) {
      console.log('Failed to generate summary:', error);
      setDocumentSummary('Document analysis available');
    }
  };

  // Generate summary when insights change
  React.useEffect(() => {
    if (documentInsights && !documentSummary) {
      generateDocumentSummary();
    }
  }, [documentInsights]);

  // Handle follow-up questions
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !documentInsights) return;

    setIsSendingMessage(true);
    const userMessage = chatInput.trim();
    setChatInput('');

    try {
      // Add user message to insights
      const userQuestion = `\n\n---\n**Follow-up Question:** ${userMessage}\n`;
      setDocumentInsights((documentInsights || '') + userQuestion);

      // Import and call OpenAI service
      const { extractDocumentInsights } = await import('../services/openai');
      const context = `Previous analysis:\n${documentInsights}\n\nUser's follow-up question: ${userMessage}\n\nPlease provide a focused answer to the user's question based on the document analysis.`;
      
      const response = await extractDocumentInsights(context, 'Follow-up Analysis');
      
      // Add response to insights
      const aiResponse = `\n**AI Response:**\n${response}\n`;
      setDocumentInsights((documentInsights || '') + userQuestion + aiResponse);
      
      addLog(`Follow-up question answered: ${userMessage}`, 'response');
      setStatus('Follow-up question answered', 'success');
    } catch (error) {
      const errorMsg = `Failed to answer follow-up question: ${error instanceof Error ? error.message : 'Unknown error'}`;
      addLog(errorMsg, 'error');
      setStatus('Failed to answer question', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle follow-up questions for modal
  const handleSendMessageModal = async () => {
    if (!modalChatInput.trim() || !documentInsights) return;

    setIsSendingMessage(true);
    const userMessage = modalChatInput.trim();
    setModalChatInput('');

    try {
      // Add user message to insights
      const userQuestion = `\n\n---\n**Follow-up Question:** ${userMessage}\n`;
      setDocumentInsights((documentInsights || '') + userQuestion);

      // Import and call OpenAI service
      const { extractDocumentInsights } = await import('../services/openai');
      const context = `Previous analysis:\n${documentInsights}\n\nUser's follow-up question: ${userMessage}\n\nPlease provide a focused answer to the user's question based on the document analysis.`;
      
      const response = await extractDocumentInsights(context, 'Follow-up Analysis');
      
      // Add response to insights
      const aiResponse = `\n**AI Response:**\n${response}\n`;
      setDocumentInsights((documentInsights || '') + userQuestion + aiResponse);
      
      addLog(`Follow-up question answered: ${userMessage}`, 'response');
      setStatus('Follow-up question answered', 'success');
    } catch (error) {
      const errorMsg = `Failed to answer follow-up question: ${error instanceof Error ? error.message : 'Unknown error'}`;
      addLog(errorMsg, 'error');
      setStatus('Failed to answer question', 'error');
    } finally {
      setIsSendingMessage(false);
    }
  };

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
  const [documentInsightsOpen, setDocumentInsightsOpen] = useState(false);
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

  // Force immediate modal opening for collapsed sidebar
  const handleBrainIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Brain icon clicked, current isOpen state:', isOpen);
    
    // Ensure the modal opens immediately
    if (!isOpen) {
      onOpen();
      console.log('Modal should now be open');
    }
  };

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
              // Both years available - show dropdown menu
              return (
                                 <Menu>
                   <Tooltip label="Open Job (2025/2026)" placement="right" hasArrow>
                     <MenuButton
                       as={IconButton}
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
                   </Tooltip>
                   <Portal>
                     <MenuList 
                       zIndex={9999}
                       bg={useColorModeValue('white', 'gray.800')}
                       border="1px solid"
                       borderColor="green.500"
                       color={useColorModeValue("green.600", "green.400")}
                       fontWeight="medium"
                       boxShadow="lg"
                       minW="160px"
                       borderRadius="md"
                       p={1}
                     >
                       <MenuItem 
                         onClick={() => window.open(clientInfo['2025 Job Link'], '_blank')}
                         bg="transparent"
                         color={useColorModeValue("green.600", "green.400")}
                         fontWeight="medium"
                         fontSize="sm"
                         borderRadius="sm"
                         _hover={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _focus={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _active={{
                           bg: "transparent"
                         }}
                       >
                         Open 2025 Job
                       </MenuItem>
                       <MenuItem 
                         onClick={() => window.open(clientInfo['2026 Job Link'], '_blank')}
                         bg="transparent"
                         color={useColorModeValue("green.600", "green.400")}
                         fontWeight="medium"
                         fontSize="sm"
                         borderRadius="sm"
                         _hover={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _focus={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _active={{
                           bg: "transparent"
                         }}
                       >
                         Open 2026 Job
                       </MenuItem>
                     </MenuList>
                   </Portal>
                 </Menu>
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
        <Tooltip 
          label={
            documentInsights 
              ? `Document insights loaded` 
              : "No document loaded"
          } 
          placement="right" 
          hasArrow
        >
          <IconButton 
            aria-label="Document Insights" 
            icon={<Brain size={20} strokeWidth={2.5} />} 
            size="md" 
            variant="solid" 
            bgGradient="linear(to-r, #3b82f6, #8b5cf6)" 
            color="white" 
            borderRadius="lg" 
            _hover={{ bgGradient: "linear(to-r, #2563eb, #7c3aed)" }} 
            mb={2}
            onClick={handleBrainIconClick}
          />
        </Tooltip>
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
              // Both years available - show dropdown
              return (
                                 <Box flex="1">
                   <Menu placement="bottom-start" strategy="absolute">
                     <MenuButton
                       as={Button}
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
                     </MenuButton>
                     <MenuList
                       bg={useColorModeValue('white', 'gray.800')}
                       border="1px solid"
                       borderColor="green.500"
                       color={useColorModeValue("green.600", "green.400")}
                       fontWeight="medium"
                       w="100%"
                       minW="auto"
                       borderRadius="md"
                       p={1}
                       mt={1}
                     >
                       <MenuItem 
                         onClick={() => handleOpenJobLink('2025')}
                         bg="transparent"
                         color={useColorModeValue("green.600", "green.400")}
                         fontWeight="medium"
                         fontSize="sm"
                         borderRadius="sm"
                         _hover={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _focus={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _active={{
                           bg: "transparent"
                         }}
                       >
                         Open 2025 Job
                       </MenuItem>
                       <MenuItem 
                         onClick={() => handleOpenJobLink('2026')}
                         bg="transparent"
                         color={useColorModeValue("green.600", "green.400")}
                         fontWeight="medium"
                         fontSize="sm"
                         borderRadius="sm"
                         _hover={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _focus={{ 
                           bg: useColorModeValue('#f0fdf4', 'gray.700'),
                           color: useColorModeValue("green.600", "green.400")
                         }}
                         _active={{
                           bg: "transparent"
                         }}
                       >
                         Open 2026 Job
                       </MenuItem>
                     </MenuList>
                   </Menu>
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

      {/* Document Insights */}
      <Box mb={2} flexShrink={0}>
        <Box {...sectionHeaderStyle}
          onClick={() => setDocumentInsightsOpen((open) => !open)}
        >
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Document Insights
          </Text>
          <Flex align="center" gap={1}>
            <IconButton
              aria-label="Expand chat"
              icon={<Maximize2 size={16} />}
              size="xs"
              onClick={e => { e.stopPropagation(); onOpen(); }}
              variant="ghost"
              color={accentColor}
              _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
            />
            <IconButton
              aria-label={documentInsightsOpen ? 'Collapse' : 'Expand'}
              icon={<ChevronDown size={18} style={{ transform: documentInsightsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />}
              size="xs"
              variant="ghost"
              onClick={e => { e.stopPropagation(); setDocumentInsightsOpen((open) => !open); }}
              tabIndex={-1}
            />
          </Flex>
        </Box>
        {documentInsightsOpen && (
          <Box w="100%" flex="1" display="flex" flexDirection="column" minHeight="0" pt={2} pb={2}>
            <Box 
              position="relative"
              flex="1"
              minH="0"
              display="flex"
              flexDirection="column"
              _before={{
                content: '""',
                position: "absolute",
                inset: "-2px",
                padding: "2px",
                background: "linear-gradient(45deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)",
                borderRadius: "md",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "subtract",
                animation: "glow 3s ease-in-out infinite alternate",
              }}
            >
              {/* Background container */}
              <Box
                position="absolute"
                inset="2px"
                bg={useColorModeValue(
                  'linear-gradient(135deg, rgba(254,254,254,0.7) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,0.9) 100%)',
                  'linear-gradient(135deg, rgba(31,41,55,0.7) 0%, rgba(55,65,81,0.8) 50%, rgba(75,85,99,0.9) 100%)'
                )}
                borderRadius="md"
              />
              
              {/* Content container */}
              <Box
                position="relative"
                flex="1"
                display="flex"
                flexDirection="column"
                overflowY="auto"
                overflowX="hidden"
                className="enhanced-scrollbar"
                p={{ base: 3, md: 4 }}
                maxW="none"
                minH="0"
              >
                {isExtractingInsights ? (
                  <Flex direction="column" align="center" justify="center" flex="1">
                    <Spinner size="lg" color={accentColor} thickness="3px" mb={4} />
                    <Text color={textColor} textAlign="center" fontSize="sm">
                      Analyzing documents...
                    </Text>
                  </Flex>
                ) : documentInsights ? (
                  <Box maxW="100%" w="100%" p={2}>
                    <ReactMarkdown
                      components={{
                        h1: (props) => <Heading as="h1" size="sm" mb={2} {...props} />,
                        h2: (props) => <Heading as="h2" size="xs" mb={2} {...props} />,
                        h3: (props) => <Heading as="h3" size="xs" mb={1} {...props} />,
                        p: (props) => <Text fontSize="sm" mb={1} {...props} />,
                        li: (props) => <ListItem fontSize="sm" ml={4} {...props} />,
                        ul: (props) => <List styleType="disc" pl={4} mb={1} {...props} />,
                        ol: (props) => <List as="ol" styleType="decimal" pl={4} mb={1} {...props} />,
                        strong: (props) => <Text as="span" fontWeight="bold" {...props} />,
                        em: (props) => <Text as="span" fontStyle="italic" {...props} />,
                      }}
                    >
                      {documentInsights}
                    </ReactMarkdown>
                  </Box>
                ) : (
                  <Flex direction="column" align="center" justify="center" flex="1">
                    <Brain size={48} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <Text color="gray.500" textAlign="center">
                      No document insights available.
                      <br />
                      Navigate to a folder with documents to generate insights.
                    </Text>
                  </Flex>
                )}
              </Box>
            </Box>
            
            {/* Chat Input */}
            <Box mt={3}>
              <Flex gap={2}>
                                  <Input
                    placeholder="Ask a follow-up question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    size="sm"
                    fontSize="sm"
                    disabled={isSendingMessage}
                    bg={useColorModeValue('#f8fafc', 'gray.700')}
                    border="2px solid"
                    borderColor={useColorModeValue('gray.300', 'gray.600')}
                    borderRadius="md"
                    _focus={{
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 1px #3b82f6",
                      bg: useColorModeValue('#ffffff', 'gray.600')
                    }}
                    _hover={{
                      borderColor: "blue.400"
                    }}
                  />
                <IconButton
                  aria-label="Send message"
                  icon={<Send size={16} />}
                  size="sm"
                  onClick={handleSendMessage}
                  isLoading={isSendingMessage}
                  disabled={!chatInput.trim() || isSendingMessage}
                  bgGradient="linear(to-r, #3b82f6, #8b5cf6)"
                  color="white"
                  _hover={{
                    bgGradient: "linear(to-r, #2563eb, #7c3aed)"
                  }}
                  _active={{
                    bgGradient: "linear(to-r, #1d4ed8, #6d28d9)"
                  }}
                />
              </Flex>
            </Box>
          </Box>
        )}
      </Box>

      {/* Downloads Section */}
      {/* Removed as per user request */}

      {/* Recent Activity */}
      {/* Removed as per user request */}

      {/* Document Insights Modal */}
      <Portal>
        <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "2xl" }} isCentered blockScrollOnMount={false}>
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent 
            maxH={{ base: "100vh", md: "80vh" }}
            h={{ base: "100vh", md: "auto" }}
            maxW={{ base: "100vw", sm: "95vw", md: "700px", lg: "800px", xl: "900px" }}
            w={{ base: "100%", md: "90%" }}
            mx={{ base: 0, md: "auto" }}
            my={{ base: 0, md: 6 }}
            bg={useColorModeValue('white', 'gray.800')}
            borderRadius={{ base: 0, md: "xl" }}
            boxShadow="2xl"
            display="flex"
            flexDirection="column"
          >
            <ModalHeader 
              bg={useColorModeValue('gray.50', 'gray.700')} 
              borderBottom="1px solid" 
              borderColor={useColorModeValue('gray.200', 'gray.600')}
              borderTopRadius={{ base: 0, md: "xl" }}
              py={4}
            >
              <Flex align="center">
                <Brain size={20} strokeWidth={2.5} style={{ marginRight: '8px' }} />
                <Text fontSize="lg" fontWeight="semibold">Document Insights</Text>
                <Text fontSize="sm" color="gray.500" ml={3} fontWeight="normal">
                  📄 {documentName}
                </Text>
              </Flex>
            </ModalHeader>
            <ModalCloseButton top={4} right={4} />
            <ModalBody 
              p={0} 
              display="flex" 
              flexDirection="column" 
              overflow="hidden"
            >
              {/* Border container for gradient effect */}
              <Box
                position="relative"
                flex="1"
                m={{ base: 3, md: 4 }}
                minH="0"
                display="flex"
                flexDirection="column"
                _before={{
                  content: '""',
                  position: "absolute",
                  inset: "-2px",
                  padding: "2px",
                  background: "linear-gradient(45deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)",
                  borderRadius: "md",
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "subtract",
                  animation: "glow 3s ease-in-out infinite alternate",
                }}
              >
                {/* Background container */}
                <Box
                  position="absolute"
                  inset="2px"
                  bg={useColorModeValue(
                    'linear-gradient(135deg, rgba(254,254,254,0.7) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,0.9) 100%)',
                    'linear-gradient(135deg, rgba(31,41,55,0.7) 0%, rgba(55,65,81,0.8) 50%, rgba(75,85,99,0.9) 100%)'
                  )}
                  borderRadius="md"
                />
                
                {/* Content container */}
                <Box
                  position="relative"
                  flex="1"
                  display="flex"
                  flexDirection="column"
                  overflowY="auto"
                  overflowX="hidden"
                  className="enhanced-scrollbar"
                  p={{ base: 3, md: 4 }}
                  maxW="none"
                  minH="0"
                >
                  {isExtractingInsights ? (
                    <Flex direction="column" align="center" justify="center" flex="1">
                      <Spinner size="lg" color={accentColor} thickness="3px" mb={4} />
                      <Text color={textColor} textAlign="center" fontSize="sm">
                        Analyzing documents...
                      </Text>
                    </Flex>
                  ) : documentInsights ? (
                    <Box maxW="100%" w="100%">
                      <ReactMarkdown
                        components={{
                          h1: (props) => <Heading as="h1" size="sm" mb={2} {...props} />,
                          h2: (props) => <Heading as="h2" size="xs" mb={2} {...props} />,
                          h3: (props) => <Heading as="h3" size="xs" mb={1} {...props} />,
                          p: (props) => <Text fontSize="sm" mb={1} {...props} />,
                          li: (props) => <ListItem fontSize="sm" ml={4} {...props} />,
                          ul: (props) => <List styleType="disc" pl={4} mb={1} {...props} />,
                          ol: (props) => <List as="ol" styleType="decimal" pl={4} mb={1} {...props} />,
                          strong: (props) => <Text as="span" fontWeight="bold" {...props} />,
                          em: (props) => <Text as="span" fontStyle="italic" {...props} />,
                        }}
                      >
                        {documentInsights}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <Flex direction="column" align="center" justify="center" flex="1">
                      <Brain size={48} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: '16px' }} />
                      <Text color="gray.500" textAlign="center">
                        No document insights available.
                        <br />
                        Navigate to a folder with documents to generate insights.
                      </Text>
                    </Flex>
                  )}
                </Box>
              </Box>
              
              {/* Chat input fixed at bottom */}
              {documentInsights && (
                <Box 
                  p={{ base: 3, md: 4 }} 
                  borderTop="1px solid" 
                  borderColor={useColorModeValue('gray.200', 'gray.600')}
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  borderBottomRadius={{ base: 0, md: "xl" }}
                >
                  <Flex gap={2}>
                    <Input
                      placeholder="Ask a follow-up question..."
                      value={modalChatInput}
                      onChange={(e) => setModalChatInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessageModal();
                        }
                      }}
                      size="sm"
                      borderRadius="md"
                      bg={useColorModeValue('white', 'gray.800')}
                      borderColor={useColorModeValue('gray.300', 'gray.600')}
                      _focus={{ 
                        borderColor: accentColor, 
                        boxShadow: `0 0 0 1px ${accentColor}`,
                        bg: useColorModeValue('#f8fafc', 'gray.600')
                      }}
                      _hover={{
                        borderColor: useColorModeValue('gray.400', 'gray.500')
                      }}
                      isDisabled={isSendingMessage}
                    />
                    <IconButton
                      aria-label="Send message"
                      icon={<Send size={16} />}
                      size="sm"
                      onClick={handleSendMessageModal}
                      isLoading={isSendingMessage}
                      colorScheme="blue"
                      isDisabled={!modalChatInput.trim() || isSendingMessage}
                    />
                  </Flex>
                </Box>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Portal>
    </Box>
  );
};






