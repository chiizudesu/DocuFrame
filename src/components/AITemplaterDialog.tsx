import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Select,
  Checkbox,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  useColorModeValue,
  IconButton,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement
} from '@chakra-ui/react';
import { Copy, Sparkles, Brain, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { loadEmailTemplates, generateEmailFromTemplate, AI_AGENTS, type AIAgent } from '../services/aiService';

interface FileItem { name: string; path: string; type: string; }

interface AITemplaterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
}

export const AITemplaterDialog: React.FC<AITemplaterDialogProps> = ({ isOpen, onClose, currentDirectory }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<{ [cat: string]: string }>({});
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>('claude-sonnet');
  const [refinementInput, setRefinementInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [extractedData, setExtractedData] = useState<{ [key: string]: string } | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Remove finals folder restriction - allow AI templater to work in any folder
  // const isFinals = /[\\/]Finals[\\/]?$/i.test(currentDirectory);

  useEffect(() => {
    if (isOpen) {
      setResult('');
      setError(null);
      setCopied(false);
      setSelectedTemplate(null);
      setSelectedFiles({});
      setSelectedAgent('claude-sonnet');
      setRefinementInput('');
      setExtractedData(null);
      loadEmailTemplates().then(setTemplates).catch(e => setError(e.message));
      (async () => {
        const items = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
        setFiles(items.filter((f: FileItem) => f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')));
      })();
    }
  }, [isOpen, currentDirectory]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = templates.find(t => t.filename === e.target.value);
    setSelectedTemplate(t);
    setSelectedFiles({});
  };

  const handleFileSelect = (cat: string, file: FileItem) => {
    setSelectedFiles(prev => ({ ...prev, [cat]: file.path }));
  };

  // Helper to get category names (supports both old and new formats)
  const getCategoryNames = (template: any): string[] => {
    if (Array.isArray(template.categories)) {
      return template.categories;
    } else if (typeof template.categories === 'object') {
      return Object.keys(template.categories);
    }
    return [];
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    setCopied(false);
    setProgressMessage('Reading PDF files...');
    
    try {
      // Extract text from selected PDFs
      const extracted: { [cat: string]: string } = {};
      const categoryNames = getCategoryNames(selectedTemplate);
      
      for (const cat of categoryNames) {
        const filePath = selectedFiles[cat];
        if (!filePath) throw new Error(`No file selected for ${cat}`);
        setProgressMessage(`📖 Reading ${cat}...`);
        extracted[cat] = await (window.electronAPI as any).readPdfText(filePath);
      }
      
      // Store extracted data for refinements
      setExtractedData(extracted);
      
      // Use the unified AI service with the selected agent and progress callback
      const result = await generateEmailFromTemplate(
        selectedTemplate, 
        extracted, 
        selectedAgent,
        (message: string) => setProgressMessage(message)
      );
      
      setResult(result);
      setProgressMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate email.');
      setProgressMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleRefinement = async () => {
    if (!refinementInput.trim() || !result || !extractedData) return;
    
    setIsRefining(true);
    setError(null);
    
    try {
      // Create a refinement prompt
      const refinementPrompt = `You are an expert accountant. I have the following email that was generated from a template. Please refine it based on the user's request.

Current Email:
${result}

User Request:
${refinementInput}

Extracted Data Context:
${Object.entries(extractedData).map(([cat, text]) => `--- ${cat} ---\n${text || ''}`).join('\n')}

Please provide the refined email, maintaining the same professional tone and structure. Only use information from the extracted data.`;

      // Use the same agent for refinement
      const refined = await generateEmailFromTemplate(
        { ...selectedTemplate, template: refinementPrompt }, 
        {}, 
        selectedAgent
      );
      
      setResult(refined);
      setRefinementInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to refine email.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleRefinementKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefinement();
    }
  };

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleClose = () => {
    setResult('');
    setError(null);
    setCopied(false);
    setSelectedTemplate(null);
    setSelectedFiles({});
    setSelectedAgent('claude-sonnet');
    setRefinementInput('');
    setExtractedData(null);
    setLoading(false);
    setIsRefining(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        bg={bgColor} 
        color={useColorModeValue('gray.900', 'white')} 
        borderRadius="lg"
        boxShadow="lg" 
        maxW={{ base: "95vw", sm: "90vw", md: "85vw", lg: "800px", xl: "1000px" }}
        maxH="95vh"
        minH="600px"
        w="full"
      >
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={2}>
          <Flex align="center" justify="center" gap={2}>
            <Sparkles size={22} />
            AI Templater
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6} overflow="hidden" display="flex" flexDirection="column">
          <Flex 
            direction={{ base: "column", md: "row" }}
            gap={6}
            flex="1"
            overflow="hidden"
          >
            {/* Left Column - Form */}
            <Box 
              flex={{ base: "none", md: "0 0 400px" }}
              minH={{ base: "auto", md: "0" }}
              display="flex"
              flexDirection="column"
              p={4}
              bg={useColorModeValue('gray.50', 'gray.700')}
              borderRadius="md"
            >
              <VStack align="stretch" spacing={4} h="full">
                <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                  Generate a client email from a template, using data extracted from selected PDFs.
                </Text>
                
                <FormControl>
                  <FormLabel fontSize="sm">AI Agent</FormLabel>
                  <Select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value as AIAgent)}
                    isDisabled={loading}
                    size="sm"
                  >
                    {AI_AGENTS.map(agent => (
                      <option key={agent.value} value={agent.value}>
                        {agent.label}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')} mt={1}>
                    {AI_AGENTS.find(a => a.value === selectedAgent)?.description}
                  </Text>
                </FormControl>
                
                <FormControl>
                  <FormLabel fontSize="sm">Select Template</FormLabel>
                  <Select 
                    placeholder="Select template..." 
                    value={selectedTemplate?.filename || ''} 
                    onChange={handleTemplateChange} 
                    isDisabled={loading || templates.length === 0}
                    size="sm"
                  >
                    {templates.map(t => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </Select>
                </FormControl>

                {/* PDF Selection Area - Scrollable */}
                <Box flex="1" minH="0" display="flex" flexDirection="column">
                  {selectedTemplate && getCategoryNames(selectedTemplate).map((cat: string) => (
                    <FormControl key={cat} mb={4} flex="1" display="flex" flexDirection="column">
                      <FormLabel fontSize="sm">
                        Select PDF for {cat.replace(/_/g, ' ')}
                        {selectedTemplate.categories[cat]?.description && (
                          <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')} fontWeight="normal" mt={0.5}>
                            {selectedTemplate.categories[cat].description}
                          </Text>
                        )}
                      </FormLabel>
                      <Box 
                        flex="1"
                        maxH="150px"
                        overflowY="auto"
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="md"
                        p={3}
                        css={{
                          '&::-webkit-scrollbar': {
                            width: '4px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'transparent',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: useColorModeValue('#CBD5E0', '#4A5568'),
                            borderRadius: '2px',
                          },
                        }}
                      >
                        <VStack align="start" spacing={2}>
                          {files.map(f => (
                            <Checkbox
                              key={f.path}
                              isChecked={selectedFiles[cat] === f.path}
                              onChange={() => handleFileSelect(cat, f)}
                              isDisabled={loading}
                              size="sm"
                              w="full"
                            >
                              <Text fontSize="xs" noOfLines={1} w="full">
                                {f.name}
                              </Text>
                            </Checkbox>
                          ))}
                        </VStack>
                      </Box>
                    </FormControl>
                  ))}
                </Box>

                <Button
                  leftIcon={<Sparkles size={16} />}
                  colorScheme="yellow"
                  onClick={handleGenerate}
                  isLoading={loading}
                  loadingText={progressMessage || "Generating..."}
                  isDisabled={loading || !selectedTemplate || getCategoryNames(selectedTemplate).some((cat: string) => !selectedFiles[cat])}
                  size="sm"
                  w="full"
                  mt={3}
                >
                  Generate Email
                </Button>

                {error && (
                  <Alert status="error" borderRadius="md" fontSize="sm" p={3}>
                    <AlertIcon boxSize={4} />
                    <Text fontSize="xs">{error}</Text>
                  </Alert>
                )}
              </VStack>
            </Box>

            {/* Right Column - Generated Email */}
            <Box 
              flex="1"
              minH={{ base: "300px", md: "0" }}
              display="flex"
              flexDirection="column"
              p={4}
              bg={useColorModeValue('gray.50', 'gray.700')}
              borderRadius="md"
            >
              <Text 
                fontSize="sm" 
                color={useColorModeValue('gray.600', 'gray.300')} 
                fontWeight="semibold"
                mb={4}
              >
                Generated Email
              </Text>
              
              <Box 
                bg={useColorModeValue('yellow.50', 'gray.900')} 
                borderRadius="md" 
                p={4}
                borderWidth="1px" 
                borderColor={borderColor} 
                position="relative"
                h="450px"
                display="flex"
                flexDirection="column"
              >
                {loading && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack spacing={3}>
                      <Spinner size="md" color="yellow.500" />
                      <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.300')}>
                        {progressMessage || 'Generating email...'}
                      </Text>
                    </VStack>
                  </Flex>
                )}
                
                {!loading && !result && (
                  <Flex justify="center" align="center" flex="1">
                    <Text 
                      fontSize="sm" 
                      color={useColorModeValue('gray.500', 'gray.400')} 
                      textAlign="center"
                      maxW="250px"
                    >
                      Select a template and PDFs, then click "Generate Email" to see the result here.
                    </Text>
                  </Flex>
                )}
                
                {result && !loading && (
                  <Box 
                    flex="1"
                    overflowY="auto" 
                    pr={2}
                    css={{
                      '&::-webkit-scrollbar': {
                        width: '6px',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'transparent',
                      },
                      '&::-webkit-scrollbar-thumb': {
                        background: useColorModeValue('#CBD5E0', '#4A5568'),
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: useColorModeValue('#A0AEC0', '#2D3748'),
                      },
                    }}
                    sx={{
                      '& h1': {
                        fontSize: '1.5em',
                        fontWeight: 'bold',
                        marginTop: '0.5em',
                        marginBottom: '0.5em',
                      },
                      '& h2': {
                        fontSize: '1.3em',
                        fontWeight: 'bold',
                        marginTop: '0.5em',
                        marginBottom: '0.5em',
                      },
                      '& h3': {
                        fontSize: '1.1em',
                        fontWeight: 'bold',
                        marginTop: '0.5em',
                        marginBottom: '0.5em',
                      },
                      '& p': {
                        marginBottom: '0.75em',
                        lineHeight: '1.6',
                      },
                      '& strong': {
                        fontWeight: 'bold',
                        color: useColorModeValue('gray.800', 'yellow.200'),
                      },
                      '& ul, & ol': {
                        paddingLeft: '1.5em',
                        marginBottom: '0.75em',
                      },
                      '& li': {
                        marginBottom: '0.25em',
                      },
                      '& code': {
                        backgroundColor: useColorModeValue('gray.100', 'gray.700'),
                        padding: '0.1em 0.3em',
                        borderRadius: '3px',
                        fontSize: '0.9em',
                      },
                      '& pre': {
                        backgroundColor: useColorModeValue('gray.100', 'gray.700'),
                        padding: '0.75em',
                        borderRadius: '5px',
                        overflowX: 'auto',
                        marginBottom: '0.75em',
                      },
                    }}
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <Text fontSize="sm" mb={2}>
                            {children}
                          </Text>
                        ),
                        h1: ({ children }) => (
                          <Text fontSize="xl" fontWeight="bold" mt={3} mb={2}>
                            {children}
                          </Text>
                        ),
                        h2: ({ children }) => (
                          <Text fontSize="lg" fontWeight="bold" mt={3} mb={2}>
                            {children}
                          </Text>
                        ),
                        h3: ({ children }) => (
                          <Text fontSize="md" fontWeight="bold" mt={2} mb={1}>
                            {children}
                          </Text>
                        ),
                        ul: ({ children }) => (
                          <VStack align="start" spacing={1} pl={4} mb={2}>
                            {children}
                          </VStack>
                        ),
                        ol: ({ children }) => (
                          <VStack align="start" spacing={1} pl={4} mb={2}>
                            {children}
                          </VStack>
                        ),
                        li: ({ children }) => (
                          <Text fontSize="sm" display="list-item">
                            {children}
                          </Text>
                        ),
                        strong: ({ children }) => (
                          <Text as="strong" fontWeight="bold" color={useColorModeValue('gray.800', 'yellow.200')}>
                            {children}
                          </Text>
                        ),
                      }}
                    >
                      {result}
                    </ReactMarkdown>
                  </Box>
                )}
                
                {/* Chat Input for Refinements */}
                {result && !loading && (
                  <Box mt={3} pt={3} borderTop="1px solid" borderColor={borderColor}>
                    <InputGroup size="sm">
                      <Input
                        placeholder="Ask for refinements... (e.g., 'Make it more concise' or 'Add emphasis on tax savings')"
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        onKeyPress={handleRefinementKeyPress}
                        isDisabled={isRefining}
                        bg={useColorModeValue('white', 'gray.800')}
                        borderColor={borderColor}
                        _focus={{
                          borderColor: useColorModeValue('yellow.400', 'yellow.500'),
                          boxShadow: `0 0 0 1px ${useColorModeValue('#ECC94B', '#D69E2E')}`
                        }}
                        pr="2.5rem"
                      />
                      <InputRightElement width="2.5rem">
                        <IconButton
                          aria-label="Send refinement"
                          icon={isRefining ? <Spinner size="xs" /> : <Send size={14} />}
                          size="xs"
                          onClick={handleRefinement}
                          isDisabled={!refinementInput.trim() || isRefining}
                          colorScheme="yellow"
                          variant="ghost"
                        />
                      </InputRightElement>
                    </InputGroup>
                    <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')} mt={1}>
                      Press Enter to send, Shift+Enter for new line
                    </Text>
                  </Box>
                )}
                
                <IconButton
                  aria-label="Copy generated email"
                  icon={<Copy size={16} />}
                  size="sm"
                  position="absolute"
                  top={2}
                  right={2}
                  onClick={handleCopy}
                  colorScheme={copied ? 'green' : 'gray'}
                  variant="ghost"
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                  style={{ display: result && !loading ? 'flex' : 'none' }}
                />
              </Box>
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 