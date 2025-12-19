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
  Collapse,
  Code,
  Wrap,
  WrapItem,
  Slide,
  ScaleFade,
  Center
} from '@chakra-ui/react';
import { Copy, Sparkles, Brain, FileSearch, Send, RefreshCw, MessageCircle, FileText, Upload, Table as TableIcon, ChevronDown, ChevronUp, Calendar, DollarSign, Users, FileX, Zap, ArrowLeft, CheckCircle, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DOCUMENT_AI_AGENTS, type DocumentAIAgent, type AIAgent, analyzePdfDocument, analyzePdfDocumentStream } from '../services/aiService';

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
  onMinimize?: () => void;
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
  folderItems,
  onMinimize
}) => {
  const [selectedAgent, setSelectedAgent] = useState<DocumentAIAgent>('claude');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileItems, setSelectedFileItems] = useState<FileItem[]>([]);
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
  const [currentStage, setCurrentStage] = useState<'setup' | 'results'>('setup');
  const [isStreaming, setIsStreaming] = useState(false);
  const analysisBoxRef = React.useRef<HTMLDivElement>(null);

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
      setSelectedFileItems([]);
      setAnalysis('');
      setChatMessages([]);
      setFollowUpQuestion('');
      setError(null);
      setDocumentText('');
      setCopied(false);
      setSelectedQuickAction(null);
      setCustomPrompt('');
      setCurrentStage('setup');
      setIsStreaming(false);
      
      // Find all PDF files in current directory and folder items
      const pdfFiles = folderItems.filter(file => 
        file.name.toLowerCase().endsWith('.pdf')
      );
      setAvailableFiles(pdfFiles);
    }
  }, [isOpen, folderItems]);

  const handleFileSelect = useCallback((file: FileItem, event?: React.MouseEvent) => {
    const isMultiSelect = event?.ctrlKey || event?.metaKey || event?.shiftKey;
    
    if (isMultiSelect) {
      setSelectedFileItems(prev => {
        const isSelected = prev.some(f => f.name === file.name);
        if (isSelected) {
          return prev.filter(f => f.name !== file.name);
        } else {
          return [...prev, file];
        }
      });
      // Keep selectedFile for backward compatibility, but use the first selected file
      setSelectedFile(file);
    } else {
      setSelectedFileItems([file]);
      setSelectedFile(file);
    }
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
    const filesToAnalyze = selectedFileItems.length > 0 ? selectedFileItems : (selectedFile ? [selectedFile] : []);
    
    if (filesToAnalyze.length === 0) {
      setError('Please select at least one document to analyze');
      return;
    }

    console.log('=== ANALYSIS START ===');
    console.log('Selected files:', filesToAnalyze.map(f => f.name));
    console.log('Custom prompt:', customPrompt);
    console.log('Custom prompt length:', customPrompt.length);
    console.log('Custom prompt trimmed:', customPrompt.trim());
    console.log('Selected quick action:', selectedQuickAction);
    
    // Use the first file for single-file operations, or combine analysis for multiple files
    const primaryFile = filesToAnalyze[0];

    // Transition to results stage immediately
    setCurrentStage('results');
    setError(null);
    setAnalysis(''); // Clear to show loading state
    setIsStreaming(true);
    setLoading(false);
    
    // Set a placeholder immediately so UI switches to results view with loading indicator
    setAnalysis(' '); // Single space to trigger results display

    try {
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
| Data 1   | Data 2   | Data 3   |`;
        } else {
          analysisPrompt = instructions;
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
| Data 1   | Data 2   | Data 3   |`;
        } else {
          analysisPrompt = activeAction.prompt;
        }
      } else {
        // Default analysis
        promptType = 'DEFAULT';
        console.log('Using DEFAULT analysis');
        analysisPrompt = `You are an expert business document analyst with deep expertise in accounting, legal, and business documents. Analyze this PDF document thoughtfully and provide insights that would be genuinely useful to someone working with it.

Please provide a conversational, intelligent analysis covering:

**📋 Document Overview**
- What type of document is this and why was it likely created?
- Who would typically use this and for what purpose?

**💰 Financial & Business Insights**
- Key financial figures, metrics, or business indicators
- Any interesting trends, patterns, or anomalies you notice
- Risk factors or opportunities highlighted

**📅 Important Dates & Deadlines**
- Critical dates, periods, or time-sensitive information
- Filing deadlines, compliance dates, or milestone dates

**✅ Action Items & Next Steps**
- What actions does this document require or suggest?
- Any compliance requirements, follow-ups, or decisions needed

**🔍 Notable Observations**
- Anything unusual, interesting, or particularly important
- Context that might not be immediately obvious
- Professional insights based on document patterns

Please be conversational and insightful - imagine you're briefing a colleague who needs to understand this document quickly but thoroughly. Feel free to ask clarifying questions at the end if there are aspects that would benefit from follow-up discussion.`;
      }
      
      console.log('=== PROMPT ANALYSIS ===');
      console.log('Prompt type:', promptType);
      console.log('Final prompt length:', analysisPrompt.length);
      console.log('Final prompt preview (first 300 chars):', analysisPrompt.substring(0, 300));
      console.log('Selected AI agent:', selectedAgent);
      console.log('PDF file path:', selectedFile.path);
      
      // Use Claude's native PDF document API with streaming
      console.log('Calling analyzePdfDocumentStream...');
      
      if (filesToAnalyze.length === 1) {
        // Single file analysis
        await analyzePdfDocumentStream(
          primaryFile.path, 
          primaryFile.name, 
          analysisPrompt, 
          selectedAgent,
          (chunk: string) => {
            // Accumulate text as it streams in
            setAnalysis(prev => {
              const newContent = prev + chunk;
              // Auto-scroll to bottom during streaming
              setTimeout(() => {
                if (analysisBoxRef.current) {
                  analysisBoxRef.current.scrollTop = analysisBoxRef.current.scrollHeight;
                }
              }, 0);
              return newContent;
            });
          }
        );
        // Store the PDF path for follow-up questions
        setDocumentText(primaryFile.path);
      } else {
        // Multiple files analysis - read all files first, then make combined summary
        setAnalysis(`# Reading ${filesToAnalyze.length} Documents...\n\nPlease wait while all documents are being loaded.\n\n`);
        
        // Helper function to convert ArrayBuffer to base64
        const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary);
        };
        
        // Read all PDF files first
        const fileReadPromises = filesToAnalyze.map(async (file) => {
          const pdfBuffer = await (window.electronAPI as any).readFileAsBuffer(file.path);
          const pdfBase64 = arrayBufferToBase64(pdfBuffer);
          return {
            name: file.name,
            path: file.path,
            base64: pdfBase64
          };
        });
        
        const readFiles = await Promise.all(fileReadPromises);
        
        setAnalysis(`# Analysis of ${filesToAnalyze.length} Documents\n\nAll documents have been read. Generating combined analysis...\n\n`);
        
        // Now create a combined prompt that references all documents
        const fileNamesList = filesToAnalyze.map((f, idx) => `${idx + 1}. ${f.name}`).join('\n');
        const combinedPrompt = `${analysisPrompt}

You are analyzing ${filesToAnalyze.length} documents together:
${fileNamesList}

Please provide a comprehensive analysis that:
1. Summarizes key information from all documents
2. Identifies common themes, patterns, or relationships across the documents
3. Highlights any important differences or contrasts between documents
4. Provides actionable insights based on the combined information

Structure your response to be useful for someone who needs to understand all these documents together.`;

        // Analyze each file sequentially but with context about all files
        // The combined prompt ensures the AI knows it's analyzing multiple documents together
        let combinedAnalysis = `# Analysis of ${filesToAnalyze.length} Documents\n\n`;
        
        for (let i = 0; i < filesToAnalyze.length; i++) {
          const file = filesToAnalyze[i];
          const fileSpecificPrompt = i === 0 
            ? combinedPrompt 
            : `${combinedPrompt}\n\nNote: You have already analyzed ${i} document(s). This is document ${i + 1} of ${filesToAnalyze.length}. Continue building on your previous analysis.`;
          
          let fileAnalysis = '';
          await analyzePdfDocumentStream(
            file.path,
            file.name,
            fileSpecificPrompt,
            selectedAgent,
            (chunk: string) => {
              fileAnalysis += chunk;
              // Update analysis with combined view
              const currentContent = combinedAnalysis + (i > 0 ? '\n\n---\n\n' : '') + `## Document ${i + 1}: ${file.name}\n\n${fileAnalysis}`;
              setAnalysis(currentContent);
              setTimeout(() => {
                if (analysisBoxRef.current) {
                  analysisBoxRef.current.scrollTop = analysisBoxRef.current.scrollHeight;
                }
              }, 0);
            }
          );
          
          combinedAnalysis += (i > 0 ? '\n\n---\n\n' : '') + `## Document ${i + 1}: ${file.name}\n\n${fileAnalysis}`;
        }
        
        // Store paths for follow-up (use first file for now)
        setDocumentText(primaryFile.path);
      }
      
      console.log('Streaming complete');
      
      // Clear any existing chat messages when starting fresh analysis
      setChatMessages([]);
      
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
      setAnalysis(''); // Clear placeholder on error
      toast({
        title: 'Analysis Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsStreaming(false);
      setLoading(false);
      
      // After streaming completes, check if table detection is needed
      // This runs in finally so it happens whether success or error
      if (analysis) {
        const activeAction = selectedQuickAction ? QUICK_ACTIONS.find(a => a.id === selectedQuickAction) : null;
        const instructionsText = customPrompt.trim() || (activeAction ? activeAction.prompt : '');
        const shouldShowAsTable = detectTableContent(instructionsText, analysis);
        console.log('Post-stream table detection:', shouldShowAsTable);
        
        if (shouldShowAsTable) {
          const parsed = parseMarkdownTable(analysis);
          console.log('Post-stream parsed table rows:', parsed?.length || 0);
        }
      }
      
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
      const filesToAnalyze = selectedFileItems.length > 0 ? selectedFileItems : (selectedFile ? [selectedFile] : []);
      const primaryFile = filesToAnalyze[0];
      
      console.log('Original instructions for follow-up:', originalInstructions);

      let conversationalPrompt: string;

      if (originalInstructions) {
        // Preserve the original custom instructions in the follow-up
        const fileNames = filesToAnalyze.map(f => f.name).join(', ');
        conversationalPrompt = `You are continuing to analyze ${filesToAnalyze.length === 1 ? 'the PDF document' : 'PDF documents'} "${fileNames}" based on these original instructions:

ORIGINAL INSTRUCTIONS: ${originalInstructions}

Previous conversation:
${conversationHistory}

User's new question: ${question}

Please respond to the user's new question while maintaining the context of the original instructions. If the user is asking for modifications to the previous analysis (like converting to a table, adding more details, etc.), please fulfill their request based on the PDF document content.`;
      } else {
        // Default conversational prompt
        const fileNames = filesToAnalyze.map(f => f.name).join(', ');
        conversationalPrompt = `You are analyzing ${filesToAnalyze.length === 1 ? 'the PDF document' : 'PDF documents'} "${fileNames}".

Previous conversation:
${conversationHistory}

User's new question: ${question}

Please provide a helpful, detailed response based on the PDF document content and conversation context.`;
      }

      console.log('Follow-up prompt length:', conversationalPrompt.length);
      console.log('Follow-up prompt preview:', conversationalPrompt.substring(0, 300));
      console.log('PDF file path:', documentText);

      // Use PDF document API for follow-up questions (use first file for follow-ups)
      const response = await analyzePdfDocument(documentText, primaryFile.name, conversationalPrompt, selectedAgent);
      
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


  const handleBackToSetup = () => {
    setCurrentStage('setup');
  };

  const handleStartNewAnalysis = () => {
    setAnalysis('');
    setChatMessages([]);
    setFollowUpQuestion('');
    setError(null);
    setSelectedQuickAction(null);
    setCustomPrompt('');
    setCurrentStage('setup');
    setIsStreaming(false);
  };

  const handleClose = () => {
      setSelectedFile(null);
      setAnalysis('');
      setChatMessages([]);
      setFollowUpQuestion('');
      setError(null);
      setDocumentText('');
      setCopied(false);
      setSelectedAgent('claude');
      setCustomPrompt('');
      setSelectedQuickAction(null);
      setCurrentStage('setup');
      setIsStreaming(false);
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
        {onMinimize && (
          <IconButton
            aria-label="Minimize"
            icon={<Minus size={16} />}
            size="sm"
            variant="ghost"
            position="absolute"
            top={4}
            right={12}
            onClick={onMinimize}
          />
        )}
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
                        {(selectedFileItems.length > 0 || selectedFile) && (
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
                                title={selectedFileItems.length > 0 ? `${selectedFileItems.length} file(s) selected` : selectedFile?.name}
                              >
                                {selectedFileItems.length > 1 
                                  ? `${selectedFileItems.length} files selected`
                                  : (selectedFileItems[0]?.name || selectedFile?.name || '')}
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
                              {availableFiles.map((file, index) => {
                                const isSelected = selectedFileItems.some(f => f.name === file.name) || selectedFile?.name === file.name;
                                return (
                                  <Box
                                    key={index}
                                    p={3}
                                    bg={isSelected ? useColorModeValue('blue.50', 'blue.800') : useColorModeValue('white', 'gray.900')}
                                    borderRadius="md"
                                    cursor="pointer"
                                    border="1px solid"
                                    borderColor={isSelected ? useColorModeValue('blue.400', 'blue.300') : 'transparent'}
                                    _hover={{
                                      bg: isSelected ? useColorModeValue('blue.100', 'blue.700') : useColorModeValue('gray.100', 'gray.700'),
                                      borderColor: useColorModeValue('blue.200', 'blue.400'),
                                      transform: 'translateY(-1px)',
                                      boxShadow: useColorModeValue('sm', 'dark-lg'),
                                    }}
                                    onClick={(e) => handleFileSelect(file, e)}
                                    transition="all 0.15s"
                                    display="flex"
                                    alignItems="center"
                                    gap={2}
                                  >
                                    <FileText size={18} color={isSelected ? '#2563eb' : useColorModeValue('#64748b', '#cbd5e1')} />
                                    <Text
                                      fontSize="sm"
                                      fontWeight={isSelected ? 'medium' : 'normal'}
                                      noOfLines={2}
                                      title={file.name}
                                      flex="1"
                                      color={isSelected ? useColorModeValue('blue.800', 'blue.100') : undefined}
                                    >
                                      {file.name}
                                    </Text>
                                    {isSelected && (
                                      <CheckCircle size={16} color={useColorModeValue('#2563eb', '#60a5fa')} />
                                    )}
                                  </Box>
                                );
                              })}
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
                          onChange={(e) => setSelectedAgent(e.target.value as DocumentAIAgent)}
                          size="sm"
                        >
                          {DOCUMENT_AI_AGENTS.map(agent => (
                            <option key={agent.value} value={agent.value}>
                              {agent.label}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          {DOCUMENT_AI_AGENTS.find(a => a.value === selectedAgent)?.description}
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
                      isDisabled={(selectedFileItems.length === 0 && !selectedFile) || loading}
                      isLoading={loading}
                      onClick={handleAnalyzeDocument}
                      w="100%"
                    >
                      {selectedFileItems.length > 1 
                        ? `Analyze ${selectedFileItems.length} Documents`
                        : 'Analyze Document'}
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
                
                {loading && !isStreaming && (
                  <Flex flex={1} align="center" justify="center" direction="column" gap={4}>
                    <Spinner size="lg" />
                    <Text color="gray.500">Analyzing document...</Text>
                    {(selectedFileItems.length > 0 || selectedFile) && (
                      <Text fontSize="sm" color="gray.400">
                        Processing: {selectedFileItems.length > 1 
                          ? `${selectedFileItems.length} documents`
                          : (selectedFileItems[0]?.name || selectedFile?.name || '')}
                      </Text>
                    )}
                  </Flex>
                )}
                
                {analysis && (
                  <VStack flex={1} spacing={0} align="stretch" overflow="hidden" w="100%">
                    {/* Analysis Results Header */}
                    <Flex justify="space-between" align="center" p={4} borderBottom="1px" borderColor={borderColor} flexShrink={0}>
                      <HStack spacing={2}>
                        <Heading size="sm">Analysis Results</Heading>
                        {isStreaming && (
                          <Badge colorScheme="blue" fontSize="xs" animation="pulse 2s ease-in-out infinite">
                            Streaming...
                          </Badge>
                        )}
                      </HStack>
                      <HStack spacing={2}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStartNewAnalysis}
                          leftIcon={<RefreshCw size={14} />}
                        >
                          New Analysis
                        </Button>
                        
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
                    <Box 
                      flex={1} 
                      overflowY="auto" 
                      p={6} 
                      minH="0" 
                      ref={analysisBoxRef}
                      bg={useColorModeValue('gray.50', 'gray.900')}
                    >
                      <Box
                          bg={useColorModeValue('white', 'gray.800')}
                          p={6}
                          borderRadius="lg"
                          boxShadow={useColorModeValue('sm', 'dark-lg')}
                          border="1px solid"
                          borderColor={useColorModeValue('gray.200', 'gray.700')}
                          sx={{
                            '& h1, & h2, & h3, & h4': {
                              fontWeight: 'bold',
                              marginBottom: '0.25rem',
                              marginTop: '0.5rem',
                              '&:first-child': {
                                marginTop: '0'
                              }
                            },
                            '& h1': { fontSize: 'lg' },
                            '& h2': { fontSize: 'md' },
                            '& h3, & h4': { fontSize: 'sm', fontWeight: '600' },
                            '& p': {
                              marginBottom: '0.25rem',
                              lineHeight: '1.4',
                              fontSize: 'sm'
                            },
                            '& ul, & ol': {
                              marginLeft: '1rem',
                              marginBottom: '0.25rem',
                              marginTop: '0.25rem',
                              paddingLeft: '0.5rem'
                            },
                            '& li': {
                              marginBottom: '0.125rem',
                              fontSize: 'sm',
                              lineHeight: '1.4'
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
                          <Box 
                            whiteSpace="pre-wrap"
                            sx={{
                              '& table': {
                                borderCollapse: 'collapse',
                                width: '100%',
                                marginTop: '1rem',
                                marginBottom: '1rem',
                                border: '1px solid',
                                borderColor: useColorModeValue('gray.300', 'gray.600'),
                              },
                              '& th': {
                                border: '1px solid',
                                borderColor: useColorModeValue('gray.300', 'gray.600'),
                                padding: '0.5rem',
                                backgroundColor: useColorModeValue('gray.100', 'gray.700'),
                                fontWeight: 'bold',
                                fontSize: 'sm',
                                textAlign: 'left'
                              },
                              '& td': {
                                border: '1px solid',
                                borderColor: useColorModeValue('gray.300', 'gray.600'),
                                padding: '0.5rem',
                                fontSize: 'sm'
                              },
                              '& tr:nth-of-type(even)': {
                                backgroundColor: useColorModeValue('gray.50', 'gray.800')
                              }
                            }}
                          >
                            {analysis.trim() ? (
                              <>
                                <ReactMarkdown key={analysis.length} remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                                {isStreaming && (
                                  <Box
                                    as="span"
                                    display="inline-block"
                                    w="2px"
                                    h="1em"
                                    bg="blue.500"
                                    ml={1}
                                    animation="blink 1s step-end infinite"
                                    sx={{
                                      '@keyframes blink': {
                                        '0%, 100%': { opacity: 1 },
                                        '50%': { opacity: 0 },
                                      }
                                    }}
                                  />
                                )}
                              </>
                            ) : isStreaming ? (
                              <Flex align="center" gap={2} color={useColorModeValue('gray.500', 'gray.400')}>
                                <Spinner size="sm" />
                                <Text fontSize="sm">AI is analyzing...</Text>
                              </Flex>
                            ) : null}
                          </Box>
                        </Box>
                      
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
                                    marginBottom: '0.25rem',
                                    marginTop: '0.5rem',
                                    '&:first-child': {
                                      marginTop: '0'
                                    }
                                  },
                                  '& h3, & h4': {
                                    fontSize: 'sm',
                                    fontWeight: '600'
                                  },
                                  '& p': {
                                    marginBottom: '0.25rem',
                                    lineHeight: '1.4',
                                    fontSize: 'sm'
                                  },
                                  '& ul, & ol': {
                                    marginLeft: '1rem',
                                    marginBottom: '0.25rem',
                                    marginTop: '0.25rem'
                                  },
                                  '& li': {
                                    fontSize: 'sm',
                                    marginBottom: '0.125rem',
                                    lineHeight: '1.4'
                                  },
                                  '& strong': {
                                    fontWeight: '600'
                                  },
                                  '& table': {
                                    borderCollapse: 'collapse',
                                    width: '100%',
                                    marginTop: '1rem',
                                    marginBottom: '1rem',
                                    border: '1px solid',
                                    borderColor: useColorModeValue('gray.300', 'gray.600'),
                                  },
                                  '& th': {
                                    border: '1px solid',
                                    borderColor: useColorModeValue('gray.300', 'gray.600'),
                                    padding: '0.5rem',
                                    backgroundColor: useColorModeValue('gray.100', 'gray.700'),
                                    fontWeight: 'bold',
                                    fontSize: 'sm',
                                    textAlign: 'left'
                                  },
                                  '& td': {
                                    border: '1px solid',
                                    borderColor: useColorModeValue('gray.300', 'gray.600'),
                                    padding: '0.5rem',
                                    fontSize: 'sm'
                                  },
                                  '& tr:nth-of-type(even)': {
                                    backgroundColor: useColorModeValue('gray.50', 'gray.800')
                                  }
                                }}
                              >
                                <Box whiteSpace="pre-wrap">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                                </Box>
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
                          disabled={loading || isStreaming}
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
                          isDisabled={!followUpQuestion.trim() || loading || isStreaming}
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