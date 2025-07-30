import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Select,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  useColorModeValue,
  useColorMode,
  IconButton,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Divider,
  Badge,
  useToast,
  Card,
  CardBody,
  Textarea,
  Grid,
  GridItem,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Switch,
  Collapse,
  Code,
  Wrap,
  WrapItem,
  Slide,
  ScaleFade,
  Center
} from '@chakra-ui/react';
import { Copy, Sparkles, Brain, FileSearch, Send, RefreshCw, MessageCircle, FileText, Upload, Table as TableIcon, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Settings, Calendar, DollarSign, Users, FileX, Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { extractDocumentInsights, AI_AGENTS, type AIAgent } from '../services/aiService';

interface FileItem { 
  name: string; 
  path: string; 
  type: string; 
}

interface DocumentAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  selectedFiles: string[];
  folderItems: FileItem[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  agent?: AIAgent;
}

// Quick action presets
const QUICK_ACTIONS = [
  {
    id: 'extract_table',
    label: 'Extract Table',
    icon: TableIcon,
    prompt: 'Extract all tabular data from this document and present it in a clean table format with proper columns and rows. Include all numerical data, dates, and descriptions.',
    expectsTable: true
  },
  {
    id: 'financial_summary',
    label: 'Financial Data',
    icon: DollarSign,
    prompt: 'Extract all financial information including amounts, totals, balances, fees, and monetary transactions. Present financial data in a structured table format.',
    expectsTable: true
  },
  {
    id: 'important_dates',
    label: 'Key Dates',
    icon: Calendar,
    prompt: 'Identify and extract all important dates, deadlines, due dates, and time-sensitive information from the document.',
    expectsTable: false
  },
  {
    id: 'parties_involved',
    label: 'People & Entities',
    icon: Users,
    prompt: 'Extract all names, companies, parties, signatories, and entities mentioned in the document.',
    expectsTable: false
  },
  {
    id: 'risks_issues',
    label: 'Risks & Issues',
    icon: FileX,
    prompt: 'Identify potential risks, concerns, discrepancies, or issues highlighted in the document.',
    expectsTable: false
  }
];

// Helper function to detect if content should be rendered as a table
const detectTableContent = (prompt: string, content: string): boolean => {
  const tableKeywords = [
    'table', 'tabular', 'extract data', 'data extraction', 'spreadsheet', 'csv', 
    'rows', 'columns', 'financial data', 'make this into a spreadsheet',
    'convert to table', 'extract', 'list', 'breakdown', 'summary'
  ];
  const combinedText = (prompt + ' ' + content).toLowerCase();
  
  // Check for table keywords in prompt or content
  const hasTableKeywords = tableKeywords.some(keyword => combinedText.includes(keyword));
  
  // Check for table markup (markdown tables with | and ---)
  const hasTableMarkup = content.includes('|') && content.includes('---');
  
  // Check for structured data patterns (multiple lines with similar structure)
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const hasStructuredData = lines.length >= 3 && lines.some(line => 
    line.includes(':') || line.includes('$') || line.includes('%') || /\d/.test(line)
  );
  
  // Enhanced detection: table keywords AND (table markup OR structured data)
  const shouldShowTable = hasTableKeywords && (hasTableMarkup || hasStructuredData);
  
  console.log('Table detection details:');
  console.log('- Has table keywords:', hasTableKeywords);
  console.log('- Has table markup:', hasTableMarkup);
  console.log('- Has structured data:', hasStructuredData);
  console.log('- Final decision:', shouldShowTable);
  
  return shouldShowTable;
};

// Helper function to parse markdown table to structured data
const parseMarkdownTable = (content: string): string[][] | null => {
  console.log('Parsing table from content length:', content.length);
  
  const lines = content.split('\n');
  const tableLines = lines.filter(line => line.includes('|') && line.trim().length > 0);
  
  console.log('Found table lines:', tableLines.length);
  
  if (tableLines.length < 2) {
    console.log('Not enough table lines for a valid table');
    return null;
  }
  
  // Remove separator line (contains ---)
  const dataLines = tableLines.filter(line => !line.includes('---'));
  
  console.log('Data lines after removing separators:', dataLines.length);
  
  if (dataLines.length < 1) {
    console.log('No data lines found after filtering');
    return null;
  }
  
  const parsedData = dataLines.map(line => 
    line.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
  ).filter(row => row.length > 0); // Remove empty rows
  
  console.log('Parsed table data:', parsedData.length, 'rows');
  console.log('First row preview:', parsedData[0]);
  
  return parsedData.length > 0 ? parsedData : null;
};

export const DocumentAnalysisDialog: React.FC<DocumentAnalysisDialogProps> = ({ 
  isOpen, 
  onClose, 
  currentDirectory, 
  selectedFiles, 
  folderItems 
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>('openai');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [analysis, setAnalysis] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [documentText, setDocumentText] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedQuickAction, setSelectedQuickAction] = useState<string | null>(null);
  const [showAsTable, setShowAsTable] = useState(false);
  const [tableData, setTableData] = useState<string[][] | null>(null);
  const [currentStage, setCurrentStage] = useState<'setup' | 'results'>('setup');

  const toast = useToast();
  const { colorMode } = useColorMode();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const fileBg = useColorModeValue('gray.100', 'gray.700');
  const selectedFileBg = useColorModeValue('blue.100', 'blue.700');
  const hoverBg = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (isOpen) {
      // Reset state
      setSelectedFile(null);
      setAnalysis('');
      setChatMessages([]);
      setFollowUpQuestion('');
      setError(null);
      setDocumentText('');
      setCopied(false);
      setShowAsTable(false);
      setTableData(null);
      setSelectedQuickAction(null);
      setCustomPrompt('');
      setCurrentStage('setup');
      
      // Find all PDF files in current directory and folder items
      const pdfFiles = folderItems.filter(file => 
        file.name.toLowerCase().endsWith('.pdf')
      );
      setAvailableFiles(pdfFiles);
    }
  }, [isOpen, folderItems]);

  const handleFileSelect = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFile) {
      // Create a FileItem from the dropped file
      const fileItem: FileItem = {
        name: pdfFile.name,
        path: pdfFile.path || '',
        type: 'file'
      };
      setSelectedFile(fileItem);
      setError(null);
    } else {
      setError('Please drop a PDF file');
    }
  }, []);

  const handleQuickAction = useCallback((actionId: string) => {
    const action = QUICK_ACTIONS.find(a => a.id === actionId);
    if (action) {
      setSelectedQuickAction(actionId);
      setCustomPrompt(action.prompt);
    }
  }, []);

  const handleAnalyzeDocument = async () => {
    if (!selectedFile) {
      setError('Please select a document to analyze');
      return;
    }

    console.log('=== ANALYSIS START ===');
    console.log('Selected file:', selectedFile.name);
    console.log('Custom prompt:', customPrompt);
    console.log('Custom prompt length:', customPrompt.length);
    console.log('Custom prompt trimmed:', customPrompt.trim());
    console.log('Selected quick action:', selectedQuickAction);

    setLoading(true);
    setError(null);
    setAnalysis('');
    setShowAsTable(false);
    setTableData(null);

    try {
      // Read PDF content using the file path
      const pdfText = await window.electronAPI.readPdfText(selectedFile.path);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('Failed to extract text from PDF or PDF is empty');
      }

      console.log('PDF text length:', pdfText.length);
      setDocumentText(pdfText);
      
      // Prepare the analysis prompt with improved logic
      let analysisPrompt = '';
      let promptType = '';
      const activeAction = selectedQuickAction ? QUICK_ACTIONS.find(a => a.id === selectedQuickAction) : null;
      
      // Priority: Custom prompt > Quick action > Default analysis
      if (customPrompt.trim()) {
        // User typed custom instructions
        const instructions = customPrompt.trim();
        promptType = 'CUSTOM';
        console.log('Using CUSTOM instructions:', instructions);
        
        if (instructions.toLowerCase().includes('table') || instructions.toLowerCase().includes('extract')) {
          analysisPrompt = `${instructions}

IMPORTANT: When presenting tabular data, format it as a proper markdown table using | symbols for columns and --- for separators. Example:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

Document to analyze:
${pdfText}`;
        } else {
          analysisPrompt = `${instructions}

Document to analyze:
${pdfText}`;
        }
      } else if (activeAction) {
        // Quick action selected
        promptType = 'QUICK_ACTION';
        console.log('Using QUICK ACTION:', activeAction.id, activeAction.prompt);
        
        if (activeAction.expectsTable) {
          analysisPrompt = `${activeAction.prompt}

IMPORTANT: When presenting tabular data, format it as a proper markdown table using | symbols for columns and --- for separators. Example:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |

Document to analyze:
${pdfText}`;
        } else {
          analysisPrompt = `${activeAction.prompt}

Document to analyze:
${pdfText}`;
        }
      } else {
        // Default analysis
        promptType = 'DEFAULT';
        console.log('Using DEFAULT analysis');
        analysisPrompt = pdfText;
      }
      
      console.log('=== PROMPT ANALYSIS ===');
      console.log('Prompt type:', promptType);
      console.log('Final prompt length:', analysisPrompt.length);
      console.log('Final prompt preview (first 300 chars):', analysisPrompt.substring(0, 300));
      console.log('Selected AI agent:', selectedAgent);
      
      // Get insights from selected AI agent
      console.log('Calling extractDocumentInsights...');
      const insights = await extractDocumentInsights(analysisPrompt, selectedFile.name, selectedAgent);
      console.log('Received insights length:', insights.length);
      console.log('Insights preview (first 200 chars):', insights.substring(0, 200));
      
      setAnalysis(insights);
      
      // Check if this should be displayed as a table
      const instructionsText = customPrompt.trim() || (activeAction ? activeAction.prompt : '');
      const shouldShowAsTable = detectTableContent(instructionsText, insights);
      console.log('Table detection - Instructions:', instructionsText);
      console.log('Table detection - Should show as table:', shouldShowAsTable);
      
      if (shouldShowAsTable) {
        const parsed = parseMarkdownTable(insights);
        console.log('Parsed table data rows:', parsed?.length || 0);
        if (parsed && parsed.length > 0) {
          setTableData(parsed);
          setShowAsTable(true);
          console.log('Table view enabled');
        }
      }
      
      // Clear any existing chat messages when starting fresh analysis
      setChatMessages([]);
      
      // Transition to results stage
      setCurrentStage('results');
      
      const successMessage = promptType === 'CUSTOM' 
        ? 'Custom analysis completed' 
        : activeAction 
        ? `${activeAction.label} completed` 
        : 'Document analysis completed';

      console.log('Analysis completed successfully:', successMessage);
      
      toast({
        title: 'Analysis Complete',
        description: successMessage,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('=== ANALYSIS ERROR ===');
      console.error('Error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error message:', errorMessage);
      setError(`Failed to analyze document: ${errorMessage}`);
      toast({
        title: 'Analysis Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
      console.log('=== ANALYSIS END ===');
    }
  };

  const handleSendFollowUp = async () => {
    if (!followUpQuestion.trim() || !selectedFile || !documentText) {
      return;
    }

    console.log('=== FOLLOW-UP START ===');
    console.log('Follow-up question:', followUpQuestion.trim());
    console.log('Original custom prompt:', customPrompt);
    console.log('Selected quick action:', selectedQuickAction);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: followUpQuestion.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const question = followUpQuestion.trim();
    setFollowUpQuestion('');
    setLoading(true);

    try {
      // Build conversation context with original instructions preserved
      const conversationHistory = chatMessages.map(msg => 
        `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`
      ).join('\n\n');

      // Preserve the original analysis context (custom prompt or quick action)
      const activeAction = selectedQuickAction ? QUICK_ACTIONS.find(a => a.id === selectedQuickAction) : null;
      const originalInstructions = customPrompt.trim() || (activeAction ? activeAction.prompt : '');
      
      console.log('Original instructions for follow-up:', originalInstructions);

      let conversationalPrompt: string;

      if (originalInstructions) {
        // Preserve the original custom instructions in the follow-up
        conversationalPrompt = `You are continuing to analyze the document "${selectedFile.name}" based on these original instructions:

ORIGINAL INSTRUCTIONS: ${originalInstructions}

Here's the document content:
${documentText}

Previous conversation:
${conversationHistory}

User's new question: ${question}

Please respond to the user's new question while maintaining the context of the original instructions. If the user is asking for modifications to the previous analysis (like converting to a table, adding more details, etc.), please fulfill their request based on the document content.`;
      } else {
        // Default conversational prompt
        conversationalPrompt = `You are analyzing the document "${selectedFile.name}". Here's the document content:
        
        ${documentText}
        
        Previous conversation:
        ${conversationHistory}
        
        User's new question: ${question}
        
        Please provide a helpful, detailed response based on the document content and conversation context.`;
      }

      console.log('Follow-up prompt length:', conversationalPrompt.length);
      console.log('Follow-up prompt preview:', conversationalPrompt.substring(0, 300));

      const response = await extractDocumentInsights(conversationalPrompt, 'Conversation', selectedAgent);
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response,
        timestamp: new Date(),
        agent: selectedAgent
      };

      setChatMessages(prev => [...prev, aiMessage]);

      // Check if the new response should be displayed as a table
      const shouldShowAsTable = detectTableContent(question + ' ' + originalInstructions, response);
      console.log('Follow-up table detection:', shouldShowAsTable);
      
      if (shouldShowAsTable) {
        const parsed = parseMarkdownTable(response);
        console.log('Follow-up parsed table rows:', parsed?.length || 0);
        if (parsed && parsed.length > 0) {
          setTableData(parsed);
          setShowAsTable(true);
          console.log('Follow-up table view enabled');
        }
      }

    } catch (error) {
      console.error('Follow-up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Follow-up Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
      console.log('=== FOLLOW-UP END ===');
    }
  };

  const handleCopyAnalysis = () => {
    navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied to Clipboard',
      description: 'Analysis has been copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleCopyTable = () => {
    if (!tableData) return;
    
    // Convert table data to tab-separated values for easy pasting
    const tsvData = tableData.map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsvData);
    
    toast({
      title: 'Table Copied',
      description: 'Table data copied as tab-separated values - paste into Excel or Google Sheets',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleForceTableConversion = () => {
    if (!analysis) return;
    
    console.log('Forcing table conversion for analysis...');
    
    // Try to parse existing content as table
    let parsed = parseMarkdownTable(analysis);
    
    if (!parsed || parsed.length === 0) {
      // If no markdown table found, try to create one from structured text
      console.log('No markdown table found, attempting to parse structured data...');
      
      const lines = analysis.split('\n').filter(line => line.trim().length > 0);
      const dataLines = lines.filter(line => 
        line.includes(':') || line.includes('$') || /\d+/.test(line)
      );
      
      if (dataLines.length >= 2) {
        // Create a simple two-column table from structured data
        const tableRows: string[][] = [['Item', 'Value']]; // Header
        
        dataLines.forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) {
              tableRows.push([
                key.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, ''), // Remove bullets/numbers
                value
              ]);
            }
          } else if (line.includes('$') || /\d+/.test(line)) {
            // For lines with financial data or numbers
            tableRows.push([line.trim(), '']);
          }
        });
        
        if (tableRows.length > 1) {
          parsed = tableRows;
          console.log('Created table from structured data:', parsed.length, 'rows');
        }
      }
    }
    
    if (parsed && parsed.length > 0) {
      setTableData(parsed);
      setShowAsTable(true);
      toast({
        title: 'Table Created',
        description: 'Content converted to table format',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } else {
      toast({
        title: 'Table Conversion Failed',
        description: 'Could not find structured data to convert to table format',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleBackToSetup = () => {
    setCurrentStage('setup');
  };

  const handleStartNewAnalysis = () => {
    setAnalysis('');
    setChatMessages([]);
    setFollowUpQuestion('');
    setError(null);
    setShowAsTable(false);
    setTableData(null);
    setSelectedQuickAction(null);
    setCustomPrompt('');
    setCurrentStage('setup');
  };

  const handleClose = () => {
    setSelectedFile(null);
    setAnalysis('');
    setChatMessages([]);
    setFollowUpQuestion('');
    setError(null);
    setDocumentText('');
    setCopied(false);
    setSelectedAgent('openai');
    setCustomPrompt('');
    setSelectedQuickAction(null);
    setShowAsTable(false);
    setTableData(null);
    setCurrentStage('setup');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl">
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        maxW="900px" 
        maxH="85vh" 
        h="650px"
        overflow="hidden"
        my="auto"
      >
        <ModalHeader>
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <Brain size={20} />
              <Text>Analyze Documents</Text>
            </Flex>
            {currentStage === 'results' && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<ArrowLeft size={14} />}
                onClick={handleBackToSetup}
              >
                Setup
              </Button>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody p={0} overflow="hidden">
          {currentStage === 'setup' ? (
            // Setup Stage
            <ScaleFade initialScale={0.9} in={currentStage === 'setup'}>
              <Grid templateColumns="1fr 1fr" h="550px" overflow="hidden">
                {/* Left Panel - File Selection */}
                <GridItem bg={cardBg} borderRight="1px" borderColor={borderColor} overflow="hidden">
                  <VStack p={4} spacing={3} h="100%" overflow="hidden">
                    <Box w="100%" flex="1" overflow="hidden" display="flex" flexDirection="column">
                      <Flex align="center" justify="space-between" mb={3}>
                        <Heading size="sm">Select Document</Heading>
                        {selectedFile && (
                          <Box 
                            px={2} 
                            py={1} 
                            bg={useColorModeValue('green.100', 'green.800')} 
                            borderRadius="md" 
                            border="1px" 
                            borderColor={useColorModeValue('green.200', 'green.600')}
                            maxW="180px"
                          >
                            <Flex align="center" gap={1}>
                              <Box flexShrink={0}>
                                <CheckCircle size={12} color={useColorModeValue('#16a34a', '#22c55e')} />
                              </Box>
                              <Text 
                                fontSize="xs" 
                                color={useColorModeValue('green.700', 'green.200')} 
                                fontWeight="medium"
                                noOfLines={1}
                                title={selectedFile.name}
                              >
                                {selectedFile.name}
                              </Text>
                            </Flex>
                          </Box>
                        )}
                      </Flex>
                      
                      {/* Drag & Drop Zone */}
                      <Box
                        border="2px dashed"
                        borderColor={isDragOver ? 'blue.400' : borderColor}
                        borderRadius="md"
                        p={4}
                        textAlign="center"
                        mb={3}
                        bg={isDragOver ? 'blue.50' : 'transparent'}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        cursor="pointer"
                        transition="all 0.2s"
                        flexShrink={0}
                      >
                        <Upload size={24} style={{ margin: '0 auto 8px' }} />
                        <Text fontSize="sm" fontWeight="medium" mb={1}>
                          Drop PDF here
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          or select from list below
                        </Text>
                      </Box>
                      
                      {/* File List */}
                      <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
                        <Text fontSize="sm" fontWeight="medium" mb={2} flexShrink={0}>
                          Available PDFs ({availableFiles.length})
                        </Text>
                        <Box flex="1" overflowY="auto" minH="0">
                          {availableFiles.length === 0 ? (
                            <Center h="100px">
                              <Text fontSize="sm" color="gray.500" textAlign="center">
                                No PDF files found in current directory
                              </Text>
                            </Center>
                          ) : (
                            <VStack spacing={1} align="stretch">
                              {availableFiles.map((file, index) => (
                                <Box
                                  key={index}
                                  p={3}
                                  bg={selectedFile?.name === file.name ? useColorModeValue('blue.50', 'blue.800') : useColorModeValue('white', 'gray.900')}
                                  borderRadius="md"
                                  cursor="pointer"
                                  border="1px solid"
                                  borderColor={selectedFile?.name === file.name ? useColorModeValue('blue.400', 'blue.300') : 'transparent'}
                                  _hover={{
                                    bg: selectedFile?.name === file.name ? useColorModeValue('blue.100', 'blue.700') : useColorModeValue('gray.100', 'gray.700'),
                                    borderColor: useColorModeValue('blue.200', 'blue.400'),
                                    transform: 'translateY(-1px)',
                                    boxShadow: useColorModeValue('sm', 'dark-lg'),
                                  }}
                                  onClick={() => handleFileSelect(file)}
                                  transition="all 0.15s"
                                  display="flex"
                                  alignItems="center"
                                  gap={2}
                                >
                                  <FileText size={18} color={selectedFile?.name === file.name ? '#2563eb' : useColorModeValue('#64748b', '#cbd5e1')} />
                                  <Text
                                    fontSize="sm"
                                    fontWeight={selectedFile?.name === file.name ? 'medium' : 'normal'}
                                    noOfLines={2}
                                    title={file.name}
                                    flex="1"
                                    color={selectedFile?.name === file.name ? useColorModeValue('blue.800', 'blue.100') : undefined}
                                  >
                                    {file.name}
                                  </Text>
                                  {selectedFile?.name === file.name && (
                                    <CheckCircle size={16} color={useColorModeValue('#2563eb', '#60a5fa')} />
                                  )}
                                </Box>
                              ))}
                            </VStack>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </VStack>
                </GridItem>

                {/* Right Panel - Controls */}
                <GridItem overflow="hidden">
                  <VStack p={4} spacing={4} h="100%" overflow="hidden">
                    {/* AI Agent Selection */}
                    <Box w="100%">
                      <FormControl>
                        <FormLabel fontSize="sm" fontWeight="medium">AI Agent</FormLabel>
                        <Select
                          value={selectedAgent}
                          onChange={(e) => setSelectedAgent(e.target.value as AIAgent)}
                          size="sm"
                        >
                          {AI_AGENTS.map(agent => (
                            <option key={agent.value} value={agent.value}>
                              {agent.label}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {AI_AGENTS.find(a => a.value === selectedAgent)?.description}
                        </Text>
                      </FormControl>
                    </Box>

                    {/* Quick Actions */}
                    <Box w="100%">
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Quick Actions</Text>
                      <Wrap spacing={1}>
                        {QUICK_ACTIONS.map((action) => {
                          const Icon = action.icon;
                          return (
                            <WrapItem key={action.id}>
                              <Button
                                size="xs"
                                variant={selectedQuickAction === action.id ? 'solid' : 'outline'}
                                colorScheme={selectedQuickAction === action.id ? 'blue' : 'gray'}
                                leftIcon={<Icon size={12} />}
                                onClick={() => handleQuickAction(action.id)}
                                fontSize="xs"
                              >
                                {action.label}
                              </Button>
                            </WrapItem>
                          );
                        })}
                      </Wrap>
                    </Box>

                    {/* Custom Instructions */}
                    <Box w="100%" flex="1" overflow="hidden" display="flex" flexDirection="column">
                      <FormControl flex="1" display="flex" flexDirection="column">
                        <FormLabel fontSize="sm" fontWeight="medium" flexShrink={0} mb={2}>
                          Custom Instructions
                          {customPrompt.trim() && (
                            <Badge ml={2} colorScheme="blue" fontSize="xs">
                              Active
                            </Badge>
                          )}
                        </FormLabel>
                        <Textarea
                          placeholder="Type custom analysis instructions here...
e.g., 'extract first 5 rows to a table with description, debit and credit columns'"
                          value={customPrompt}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            console.log('Custom prompt changed:', newValue); // Debug log
                            setCustomPrompt(newValue);
                            setSelectedQuickAction(null); // Clear quick action when typing custom
                          }}
                          size="sm"
                          flex="1"
                          resize="none"
                          minH="80px"
                          bg={useColorModeValue('white', 'gray.800')}
                          borderColor={customPrompt.trim() ? 'blue.300' : borderColor}
                          borderRadius="md"
                          _focus={{
                            borderColor: 'blue.500',
                            boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)'
                          }}
                        />
                        {customPrompt.trim() && (
                          <Text fontSize="xs" color="blue.500" mt={1}>
                            Custom instructions will override quick actions
                          </Text>
                        )}
                      </FormControl>
                    </Box>
                    
                    {/* Analyze Button */}
                    <Button
                      leftIcon={<Sparkles size={16} />}
                      colorScheme="blue"
                      size="sm"
                      isDisabled={!selectedFile || loading}
                      isLoading={loading}
                      onClick={handleAnalyzeDocument}
                      w="100%"
                    >
                      Analyze Document
                    </Button>

                    {error && (
                      <Alert status="error" size="sm">
                        <AlertIcon />
                        <Text fontSize="sm">{error}</Text>
                      </Alert>
                    )}
                  </VStack>
                </GridItem>
              </Grid>
            </ScaleFade>
          ) : (
            // Results Stage
            <ScaleFade initialScale={0.9} in={currentStage === 'results'}>
              <VStack h="550px" spacing={0} overflow="hidden">
                {error && (
                  <Alert status="error" size="sm" flexShrink={0}>
                    <AlertIcon />
                    <Text fontSize="sm">{error}</Text>
                  </Alert>
                )}
                
                {loading && (
                  <Flex flex={1} align="center" justify="center" direction="column" gap={4}>
                    <Spinner size="lg" />
                    <Text color="gray.500">Analyzing document...</Text>
                    {selectedFile && (
                      <Text fontSize="sm" color="gray.400">
                        Processing: {selectedFile.name}
                      </Text>
                    )}
                  </Flex>
                )}
                
                {analysis && (
                  <VStack flex={1} spacing={0} align="stretch" overflow="hidden" w="100%">
                    {/* Analysis Results Header */}
                    <Flex justify="space-between" align="center" p={4} borderBottom="1px" borderColor={borderColor} flexShrink={0}>
                      <Heading size="sm">Analysis Results</Heading>
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStartNewAnalysis}
                          leftIcon={<RefreshCw size={14} />}
                        >
                          New Analysis
                        </Button>
                        
                        {/* Manual table conversion button */}
                        <IconButton
                          aria-label="Force table conversion"
                          icon={<Settings size={14} />}
                          size="sm"
                          variant="ghost"
                          onClick={handleForceTableConversion}
                          title="Convert to table format"
                        />
                        
                        {tableData && (
                          <HStack spacing={2}>
                            <Text fontSize="xs" color="gray.500">Table View</Text>
                            <Switch 
                              size="sm" 
                              isChecked={showAsTable} 
                              onChange={(e) => setShowAsTable(e.target.checked)}
                            />
                            {showAsTable && (
                              <IconButton
                                aria-label="Copy table"
                                icon={<TableIcon size={16} />}
                                size="sm"
                                variant="ghost"
                                onClick={handleCopyTable}
                                title="Copy table data"
                              />
                            )}
                          </HStack>
                        )}
                        <IconButton
                          aria-label="Copy analysis"
                          icon={<Copy size={16} />}
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyAnalysis}
                          colorScheme={copied ? "green" : "gray"}
                        />
                      </HStack>
                    </Flex>
                    
                    {/* Results Content */}
                    <Box flex={1} overflowY="auto" p={4} minH="0">
                      {showAsTable && tableData ? (
                        <Box
                          overflowX="auto"
                          bg={useColorModeValue('white', 'gray.900')}
                          border="1px solid"
                          borderColor={useColorModeValue('gray.300', 'gray.700')}
                          borderRadius="md"
                          p={2}
                          mb={2}
                          boxShadow={useColorModeValue('sm', 'dark-lg')}
                        >
                          <Table variant="simple" size="sm">
                            <Thead bg={useColorModeValue('gray.100', 'gray.800')} borderBottom="2px solid" borderColor={useColorModeValue('gray.300', 'gray.700')}
                            >
                              <Tr>
                                {tableData[0]?.map((header, index) => (
                                  <Th key={index} fontSize="xs" borderColor={useColorModeValue('gray.300', 'gray.700')}>
                                    {header}
                                  </Th>
                                ))}
                              </Tr>
                            </Thead>
                            <Tbody>
                              {tableData.slice(1).map((row, rowIndex) => (
                                <Tr key={rowIndex}>
                                  {row.map((cell, cellIndex) => (
                                    <Td key={cellIndex} fontSize="xs" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                                      {cell}
                                    </Td>
                                  ))}
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                          <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
                            Click the table icon to copy this data to your clipboard
                          </Text>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            '& h1, & h2, & h3, & h4': {
                              fontWeight: 'bold',
                              marginBottom: '0.5rem',
                              marginTop: '1rem'
                            },
                            '& h1': { fontSize: 'lg' },
                            '& h2': { fontSize: 'md' },
                            '& h3, & h4': { fontSize: 'sm' },
                            '& p': {
                              marginBottom: '0.75rem'
                            },
                            '& ul, & ol': {
                              marginLeft: '1.5rem',
                              marginBottom: '0.75rem'
                            },
                            '& li': {
                              marginBottom: '0.25rem'
                            },
                            '& strong': {
                              fontWeight: 'bold'
                            },
                            '& em': {
                              fontStyle: 'italic'
                            },
                            '& code': {
                              backgroundColor: useColorModeValue('gray.200', 'gray.600'),
                              padding: '0.125rem 0.25rem',
                              borderRadius: '0.25rem',
                              fontSize: 'xs'
                            }
                          }}
                        >
                          <ReactMarkdown>{analysis}</ReactMarkdown>
                        </Box>
                      )}
                      
                      {/* Chat Messages */}
                      {chatMessages.length > 0 && (
                        <VStack spacing={3} align="stretch" mt={4}>
                          <Divider />
                          <Heading size="xs" color="gray.600">Follow-up Conversation</Heading>
                          {chatMessages.map(message => (
                            <Box key={message.id}>
                              <Flex align="center" gap={2} mb={1}>
                                <Text fontSize="xs" fontWeight="medium" color="gray.500">
                                  {message.type === 'user' ? 'You' : `AI (${message.agent})`}
                                </Text>
                                <Text fontSize="xs" color="gray.400">
                                  {message.timestamp.toLocaleTimeString()}
                                </Text>
                              </Flex>
                              <Box
                                bg={message.type === 'user' ? useColorModeValue('blue.50', 'blue.900') : cardBg}
                                p={3}
                                borderRadius="md"
                                border="1px"
                                borderColor={borderColor}
                                fontSize="sm"
                                sx={{
                                  '& h1, & h2, & h3, & h4': {
                                    fontWeight: 'bold',
                                    marginBottom: '0.5rem',
                                    marginTop: '0.5rem'
                                  },
                                  '& p': {
                                    marginBottom: '0.5rem'
                                  },
                                  '& ul, & ol': {
                                    marginLeft: '1rem',
                                    marginBottom: '0.5rem'
                                  },
                                  '& strong': {
                                    fontWeight: 'bold'
                                  }
                                }}
                              >
                                <ReactMarkdown>{message.content}</ReactMarkdown>
                              </Box>
                            </Box>
                          ))}
                        </VStack>
                      )}
                    </Box>
                    
                    {/* Follow-up Input */}
                    <Box p={4} borderTop="1px" borderColor={borderColor} flexShrink={0}>
                      <Flex gap={2}>
                        <Input
                          placeholder="Ask a follow-up question..."
                          value={followUpQuestion}
                          onChange={(e) => setFollowUpQuestion(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendFollowUp()}
                          size="sm"
                          disabled={loading}
                          bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                          color={colorMode === 'dark' ? 'white' : 'gray.900'}
                          borderColor={borderColor}
                          _focus={{
                            borderColor: 'blue.500',
                            boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
                            bg: colorMode === 'dark' ? 'gray.800' : 'white'
                          }}
                          _hover={{
                            bg: colorMode === 'dark' ? 'gray.800' : 'white'
                          }}
                          _placeholder={{
                            color: colorMode === 'dark' ? 'gray.400' : 'gray.500'
                          }}
                          style={{
                            backgroundColor: colorMode === 'dark' ? '#1a202c' : '#ffffff',
                            color: colorMode === 'dark' ? '#ffffff' : '#1a202c',
                          }}
                          sx={{
                            backgroundColor: colorMode === 'dark' ? '#1a202c' : '#ffffff' + ' !important',
                            '&::placeholder': {
                              color: colorMode === 'dark' ? '#a0aec0' : '#718096' + ' !important'
                            },
                            '&:hover': {
                              backgroundColor: colorMode === 'dark' ? '#1a202c' : '#ffffff' + ' !important'
                            },
                            '&:focus': {
                              backgroundColor: colorMode === 'dark' ? '#1a202c' : '#ffffff' + ' !important'
                            }
                          }}
                        />
                        <IconButton
                          aria-label="Send message"
                          icon={<Send size={16} />}
                          onClick={handleSendFollowUp}
                          colorScheme="blue"
                          size="sm"
                          isDisabled={!followUpQuestion.trim() || loading}
                          isLoading={loading}
                        />
                      </Flex>
                    </Box>
                  </VStack>
                )}
              </VStack>
            </ScaleFade>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 