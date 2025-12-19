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
  Input
} from '@chakra-ui/react';
import { Copy, Sparkles, Brain, Send, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { loadEmailTemplates, generateEmailFromTemplateStream, AI_AGENTS, type AIAgent } from '../services/aiService';

interface FileItem { name: string; path: string; type: string; }

interface AITemplaterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  onMinimize?: () => void;
}

export const AITemplaterDialog: React.FC<AITemplaterDialogProps> = ({ isOpen, onClose, currentDirectory, onMinimize }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<{ [cat: string]: string }>({});
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>('openai');
  const [followUpInput, setFollowUpInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

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
      setSelectedAgent('openai');
      setIsStreaming(false);
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

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    setCopied(false);
    setIsStreaming(false);
    try {
      // Extract text from selected PDFs
      const extracted: { [cat: string]: string } = {};
      for (const cat of selectedTemplate.categories as string[]) {
        const filePath = selectedFiles[cat];
        if (!filePath) throw new Error(`No file selected for ${cat}`);
        extracted[cat] = await (window.electronAPI as any).readPdfText(filePath);
      }
      
      // Switch to streaming mode
      setLoading(false);
      setIsStreaming(true);
      
      // Use the streaming version to show real-time generation
      await generateEmailFromTemplateStream(
        selectedTemplate, 
        extracted, 
        selectedAgent,
        (chunk: string) => {
          // Accumulate text as it streams in
          setResult(prev => prev + chunk);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate email.');
      setLoading(false);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !result) return;
    
    setError(null);
    setIsStreaming(false);
    
    try {
      const followUpPrompt = `Based on the previously generated email:

${result}

User's request: ${followUpInput}

Please modify or enhance the email according to the user's request. Only provide the modified email, no explanations.`;

      // Create a simple template with just the follow-up prompt
      // No need to re-extract PDFs, just use the existing context
      const modifiedTemplate = {
        name: 'Follow-up',
        template: followUpPrompt,
        categories: []
      };
      
      // Clear result and switch to streaming mode
      setResult('');
      setIsStreaming(true);
      
      // Stream the new response with empty extracted data
      await generateEmailFromTemplateStream(
        modifiedTemplate, 
        {}, // No PDF data needed for follow-up
        selectedAgent,
        (chunk: string) => {
          // Accumulate text as it streams in
          setResult(prev => prev + chunk);
        }
      );
      setFollowUpInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to process follow-up request.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClose = () => {
    setResult('');
    setError(null);
    setCopied(false);
    setSelectedTemplate(null);
    setSelectedFiles({});
    setSelectedAgent('openai');
    setFollowUpInput('');
    setLoading(false);
    setIsStreaming(false);
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
                  {selectedTemplate && (selectedTemplate.categories as string[]).map((cat: string) => (
                    <FormControl key={cat} mb={4} flex="1" display="flex" flexDirection="column">
                      <FormLabel fontSize="sm">
                        Select PDF for {cat.replace(/_/g, ' ')}
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
                  loadingText="Generating..."
                  isDisabled={loading || !selectedTemplate || (selectedTemplate.categories as string[]).some((cat: string) => !selectedFiles[cat])}
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
                flex="1"
                display="flex"
                flexDirection="column"
                minH="0"
                maxH="539px"
              >
                {loading && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack spacing={3}>
                      <Spinner size="md" color="yellow.500" />
                      <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.300')}>
                        Generating email...
                      </Text>
                    </VStack>
                  </Flex>
                )}
                
                {!loading && !result && !isStreaming && (
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
                
                {isStreaming && !result && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack spacing={2}>
                      <Text 
                        fontSize="sm" 
                        color={useColorModeValue('gray.600', 'gray.300')}
                        animation="pulse 1.5s ease-in-out infinite"
                        sx={{
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                          }
                        }}
                      >
                        Streaming response...
                      </Text>
                    </VStack>
                  </Flex>
                )}
                
                {result && !loading && (
                  <Box 
                    flex="1"
                    overflowY="auto" 
                    pr={2}
                    minH="0"
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
                  >
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
                      <ReactMarkdown>{result}</ReactMarkdown>
                      {isStreaming && (
                        <Box
                          as="span"
                          display="inline-block"
                          w="2px"
                          h="1em"
                          bg="yellow.500"
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
                    </Box>
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
              
              {/* Follow-up Input */}
              {result && (
                <HStack mt={3} spacing={2}>
                  <Input
                    placeholder="Ask for changes (e.g., 'make it more concise' or 'add bullet points')"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !loading && !isStreaming && handleFollowUp()}
                    size="sm"
                    isDisabled={loading || isStreaming}
                  />
                  <IconButton
                    aria-label="Send follow-up"
                    icon={<Send size={16} />}
                    onClick={handleFollowUp}
                    colorScheme="yellow"
                    size="sm"
                    isDisabled={!followUpInput.trim() || loading || isStreaming}
                    isLoading={loading}
                  />
                </HStack>
              )}
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 