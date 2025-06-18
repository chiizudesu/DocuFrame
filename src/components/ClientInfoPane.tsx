import React, { useState } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Tooltip, IconButton, Spacer, Spinner, Input, Menu, MenuButton, MenuList, MenuItem, Portal, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, useDisclosure } from '@chakra-ui/react';
import { ExternalLink, FileText, Info, ChevronLeft, ChevronRight, RefreshCw, X, Brain, Send, ChevronDown, Maximize2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

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

  // Simple markdown parser component
  const MarkdownText: React.FC<{ children: string }> = ({ children }) => {
    const parseMarkdown = (text: string) => {
      const lines = text.split('\n');
      const elements: JSX.Element[] = [];
      let i = 0;
      
      while (i < lines.length) {
        const line = lines[i];
        
        // Check for markdown table
        if (line.includes('|') && lines[i + 1]?.includes('|') && lines[i + 1]?.includes('-')) {
          // Parse table
          const tableLines = [];
          let j = i;
          
          // Collect all table lines
          while (j < lines.length && lines[j].includes('|')) {
            if (lines[j].trim() !== '' && !lines[j].match(/^\|[\s\-\|]*\|$/)) {
              tableLines.push(lines[j]);
            }
            j++;
          }
          
          if (tableLines.length >= 2) {
            // Skip separator line if it exists
            const headerLine = tableLines[0];
            const dataLines = tableLines.slice(1).filter(line => !line.match(/^\|[\s\-\|]*\|$/));
            
            // Parse header
            const headers = headerLine.split('|')
              .map(cell => cell.trim())
              .filter(cell => cell !== '');
            
            // Parse data rows
            const rows = dataLines.map(line => 
              line.split('|')
                .map(cell => cell.trim())
                .filter(cell => cell !== '')
            );
            
            if (headers.length > 0 && rows.length > 0) {
              elements.push(
                <Box key={`table-${i}`} mb={4} overflowX="auto">
                  <Box
                    border="1px solid"
                    borderColor={useColorModeValue('gray.300', 'gray.600')}
                    borderRadius="md"
                    overflow="hidden"
                    bg={useColorModeValue('white', 'gray.700')}
                    display="table"
                    width="100%"
                  >
                    {/* Table Header */}
                    <Box
                      display="table-row"
                      bg={useColorModeValue('gray.50', 'gray.600')}
                    >
                      {headers.map((header, headerIndex) => (
                        <Box
                          key={headerIndex}
                          display="table-cell"
                          p={3}
                          borderRight={headerIndex < headers.length - 1 ? "1px solid" : "none"}
                          borderColor={useColorModeValue('gray.300', 'gray.600')}
                          borderBottom="1px solid"
                          verticalAlign="top"
                        >
                          <Text fontSize="sm" fontWeight="bold" color={useColorModeValue('gray.700', 'gray.200')}>
                            {header}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                    
                    {/* Table Rows */}
                    {rows.map((row, rowIndex) => (
                      <Box
                        key={rowIndex}
                        display="table-row"
                      >
                        {row.map((cell, cellIndex) => (
                          <Box
                            key={cellIndex}
                            display="table-cell"
                            p={3}
                            borderRight={cellIndex < row.length - 1 ? "1px solid" : "none"}
                            borderColor={useColorModeValue('gray.200', 'gray.600')}
                            borderBottom={rowIndex < rows.length - 1 ? "1px solid" : "none"}
                            verticalAlign="top"
                          >
                            <Text 
                              fontSize="sm" 
                              overflowWrap="break-word"
                              wordBreak="break-word"
                              whiteSpace="pre-wrap"
                            >
                              {cell}
                            </Text>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            }
            
            i = j;
            continue;
          }
        }
        
        // Handle other markdown elements
        if (line.startsWith('**') && line.endsWith('**')) {
          // Bold headings
          const content = line.slice(2, -2);
          elements.push(
            <Text 
              key={i} 
              fontWeight="bold" 
              fontSize="sm" 
              color="blue.300" 
              mb={1}
              overflowWrap="break-word"
              wordBreak="break-word"
            >
              {content}
            </Text>
          );
        } else if (line.startsWith('- **') && line.includes('**')) {
          // Bold bullet points
          const match = line.match(/^- \*\*(.*?)\*\*(.*)/);
          if (match) {
            elements.push(
              <Text 
                key={i} 
                fontSize="sm" 
                ml={2} 
                mb={1}
                overflowWrap="break-word"
                wordBreak="break-word"
              >
                • <Text as="span" fontWeight="bold" color="blue.200">{match[1]}</Text>{match[2]}
              </Text>
            );
          }
        } else if (line.startsWith('- ')) {
          // Regular bullet points
          elements.push(
            <Text 
              key={i} 
              fontSize="sm" 
              ml={2} 
              mb={1}
              overflowWrap="break-word"
              wordBreak="break-word"
            >
              • {line.slice(2)}
            </Text>
          );
        } else if (line.trim() === '') {
          // Empty lines
          elements.push(<Box key={i} height="8px" />);
        } else {
          // Regular text
          elements.push(
            <Text 
              key={i} 
              fontSize="sm" 
              mb={1}
              overflowWrap="break-word"
              wordBreak="break-word"
            >
              {line}
            </Text>
          );
        }
        
        i++;
      }
      
      return elements;
    };

    return (
      <Box 
        overflowWrap="break-word" 
        wordBreak="break-word" 
        maxWidth="100%"
        overflowX="hidden"
      >
        {parseMarkdown(children)}
      </Box>
    );
  };

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

      {/* Client Information */}
      <Box mb={2} flexShrink={0}>
        <Flex align="center" mb={2}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Client Information
          </Text>
          <Spacer />
          <IconButton
            aria-label="Load client info"
            icon={<RefreshCw size={16} />}
            size="sm"
            ml={2}
            isLoading={loadingClient}
            onClick={handleLoadClientInfo}
            variant="ghost"
            color={accentColor}
            _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
          />
        </Flex>
        {/* Client name indicator below header, revert to previous box style */}
        <Box mb={2} px={2} py={1} borderRadius="md" bg={useColorModeValue('#e0e7ef', 'gray.700')}>
          <Text fontSize="md" fontWeight="bold" color={clientInfo ? textColor : 'gray.500'} textAlign="left">
            {clientInfo ? (clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']) : 'No client is loaded'}
          </Text>
        </Box>
        <Box 
          p={3} 
          borderRadius="md" 
          border="1px solid" 
          borderColor={borderColor} 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          boxShadow="none"
        >
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
      </Box>

      <Divider mb={6} borderColor={useColorModeValue('#e2e8f0', 'gray.700')} flexShrink={0} />

      {/* Document Insights */}
      <Box mb={2} flex="1" display="flex" flexDirection="column" minHeight="0">
        <Flex align="center" mb={2}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Document Insights
          </Text>
          <Spacer />
          {documentInsights && (
            <>
              <IconButton
                aria-label="Open in dialog"
                icon={<Maximize2 size={16} />}
                size="sm"
                ml={2}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                variant="ghost"
                color={accentColor}
                _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
              />
              <IconButton
                aria-label="Clear insights"
                icon={<X size={16} />}
                size="sm"
                ml={1}
                onClick={() => {
                  setDocumentInsights('');
                  setDocumentSummary('');
                }}
                variant="ghost"
                color="gray.500"
                _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
              />
            </>
          )}
        </Flex>
        
        {isExtractingInsights ? (
          <Box 
            borderRadius="md" 
            position="relative"
            minHeight="120px"
            _before={{
              content: '""',
              position: 'absolute',
              inset: 0,
              padding: '3px',
              background: 'linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)',
              borderRadius: 'md',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'xor',
              animation: 'ai-glow 2s ease-in-out infinite alternate',
              zIndex: 1
            }}
            sx={{
              '@keyframes ai-glow': {
                '0%': { opacity: 0.8 },
                '100%': { opacity: 1 }
              }
            }}
          >
            <Box 
              position="absolute"
              inset="3px"
              bg={useColorModeValue(
                'linear-gradient(135deg, rgba(254,254,254,0.7) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,0.9) 100%)',
                'linear-gradient(135deg, rgba(31,41,55,0.7) 0%, rgba(55,65,81,0.8) 50%, rgba(75,85,99,0.9) 100%)'
              )}
              borderRadius="md"
              display="flex"
              alignItems="center"
              justifyContent="center"
              zIndex={2}
            >
              <VStack spacing={2}>
                <Spinner size="sm" color="blue.500" />
                <Text fontSize="sm" color="gray.500">Analyzing document...</Text>
              </VStack>
            </Box>
          </Box>
        ) : documentInsights ? (
          <Box flex="1" display="flex" flexDirection="column" minHeight="0">
            <Box 
              flex="1"
              borderRadius="md" 
              position="relative"
              minHeight="200px"
              maxHeight="calc(100vh - 400px)"
              _before={{
                content: '""',
                position: 'absolute',
                inset: 0,
                padding: '3px',
                background: 'linear-gradient(45deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)',
                borderRadius: 'md',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'xor',
                animation: 'ai-glow 3s ease-in-out infinite alternate',
                zIndex: 1
              }}
              sx={{
                '@keyframes ai-glow': {
                  '0%': { 
                    filter: 'brightness(1) saturate(1)',
                    opacity: 0.8
                  },
                  '100%': { 
                    filter: 'brightness(1.1) saturate(1.2)',
                    opacity: 1
                  }
                }
              }}
            >
              <Box 
                position="absolute"
                inset="3px"
                bg={useColorModeValue(
                  'linear-gradient(135deg, rgba(254,254,254,0.7) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,0.9) 100%)',
                  'linear-gradient(135deg, rgba(31,41,55,0.7) 0%, rgba(55,65,81,0.8) 50%, rgba(75,85,99,0.9) 100%)'
                )}
                borderRadius="md"
                overflow="hidden"
                zIndex={2}
              >
                                  <Box 
                    p={4}
                    height="100%"
                    overflowY="auto"
                    overflowX="hidden"
                    overflowWrap="break-word"
                    wordBreak="break-word"
                    whiteSpace="pre-wrap"
                    className="enhanced-scrollbar"
                    bg="transparent"
                  >
                  <MarkdownText>{documentInsights}</MarkdownText>
                </Box>
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
        ) : (
          <Box 
            p={4} 
            borderRadius="md" 
            border="1px solid" 
            borderColor={borderColor} 
            bg={useColorModeValue('gray.100', 'gray.700')} 
            boxShadow="none"
            minHeight="120px"
            textAlign="center"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="sm" color="gray.500" fontStyle="italic">
              No insights loaded. Select a document and click "Extract Insights" to analyze it.
            </Text>
          </Box>
        )}
      </Box>

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
                      <Text color={textColor} textAlign="center">
                        Analyzing documents...
                      </Text>
                    </Flex>
                  ) : documentInsights ? (
                    <Box maxW="100%" w="100%">
                      <MarkdownText>{documentInsights}</MarkdownText>
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






