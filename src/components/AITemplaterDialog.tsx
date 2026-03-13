import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Select,
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
import { Copy, Sparkles, Send, Minus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { loadEmailTemplates, generateEmailFromTemplateStream, extractTemplateData, AI_AGENTS, type AIAgent } from '../services/aiService';
import { renderTemplate, parseTemplate } from '../services/templateService';

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
  const [selectedAgent, setSelectedAgent] = useState<AIAgent>('claude');
  const [followUpInput, setFollowUpInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractionStep, setExtractionStep] = useState<'generate' | 'extracting' | 'rendered'>('generate');
  const [extractedData, setExtractedData] = useState<{ placeholders: Record<string, string>; conditions: Record<string, boolean> } | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const modalTextColor = useColorModeValue('gray.900', 'white');
  const panelBg = useColorModeValue('gray.50', 'gray.700');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const textColorMuted = useColorModeValue('gray.600', 'gray.300');
  const textColorSubtle = useColorModeValue('gray.500', 'gray.400');
  const scrollbarColor = useColorModeValue('#CBD5E0', '#4A5568');
  const scrollbarHoverColor = useColorModeValue('#A0AEC0', '#2D3748');
  const resultBg = useColorModeValue('yellow.50', 'gray.900');
  const codeBg = useColorModeValue('gray.200', 'gray.600');

  // Remove finals folder restriction - allow AI templater to work in any folder
  // const isFinals = /[\\/]Finals[\\/]?$/i.test(currentDirectory);

  useEffect(() => {
    if (isOpen) {
      if (!result) {
        setError(null);
        setCopied(false);
        setSelectedTemplate(null);
        setSelectedFiles({});
        setSelectedAgent('claude');
        setIsStreaming(false);
        setExtractionStep('generate');
        setExtractedData(null);
      }
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
    setExtractedData(null);
    setExtractionStep('extracting');
    try {
      const extracted: { [cat: string]: string } = {};
      for (const cat of selectedTemplate.categories as string[]) {
        const filePath = selectedFiles[cat];
        if (!filePath) throw new Error(`No file selected for ${cat}`);
        extracted[cat] = await (window.electronAPI as any).readPdfText(filePath);
      }
      const data = await extractTemplateData(selectedTemplate, extracted, selectedAgent);
      setExtractedData(data);
      const parsed = parseTemplate(selectedTemplate.template);
      const placeholders: Record<string, string> = { ...data.placeholders };
      parsed.placeholders.forEach((p) => {
        if (!(p.name in placeholders)) placeholders[p.name] = '';
      });
      const conditions: Record<string, boolean> = { ...data.conditions };
      parsed.conditions.forEach((c) => {
        if (!(c.name in conditions)) conditions[c.name] = false;
      });
      const rendered = renderTemplate(selectedTemplate.template, { placeholders, conditions });
      setResult(rendered);
      setExtractionStep('rendered');
    } catch (err: any) {
      setError(err.message || 'Failed to extract data.');
      setExtractionStep('generate');
    } finally {
      setLoading(false);
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
    setSelectedAgent('claude');
    setFollowUpInput('');
    setLoading(false);
    setIsStreaming(false);
    setExtractionStep('generate');
    setExtractedData(null);
    onClose();
  };

  const handleOverlayClick = () => {
    // Auto-dock when clicking outside if minimize handler is provided and result exists
    if (onMinimize && result) {
      onMinimize();
    } else {
      handleClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleOverlayClick} size="xl" isCentered closeOnOverlayClick={true}>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        bg={bgColor} 
        color={modalTextColor} 
        borderRadius={0}
        boxShadow="xl" 
        maxW={{ base: "95vw", sm: "90vw", md: "85vw", lg: "800px", xl: "1000px" }}
        maxH="95vh"
        minH="600px"
        w="full"
      >
        <ModalHeader 
          bg={itemBgColor} 
          borderBottom="1px solid" 
          borderColor={borderColor}
          borderRadius={0}
          py={3}
        >
          <Flex align="center" justify="space-between" w="full">
            <Flex align="center" gap={2}>
              <Sparkles size={20} />
              <Text fontSize="lg" fontWeight="semibold">AI Templater</Text>
            </Flex>
            <HStack spacing={2}>
              <Select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value as AIAgent)}
                isDisabled={loading}
                size="sm"
                w="140px"
                bg={bgColor}
              >
                {AI_AGENTS.map(agent => (
                  <option key={agent.value} value={agent.value}>
                    {agent.label}
                  </option>
                ))}
              </Select>
              {onMinimize && (
                <IconButton
                  aria-label="Minimize"
                  icon={<Minus size={16} />}
                  size="sm"
                  variant="ghost"
                  onClick={onMinimize}
                />
              )}
              <IconButton
                aria-label="Close"
                icon={<X size={16} />}
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            </HStack>
          </Flex>
        </ModalHeader>
        <ModalBody p={0} overflow="hidden" display="flex" flexDirection="column">
          {/* Row 1: Template + PDF selection */}
          <Box 
            p={4}
            borderBottom="1px solid"
            borderColor={borderColor}
            bg={panelBg}
          >
            <Flex 
              direction={{ base: "column", md: "row" }}
              gap={4}
              align={{ base: "stretch", md: "flex-end" }}
              flexWrap="wrap"
            >
              <FormControl flex="1" minW="180px">
                <FormLabel fontSize="sm">Template</FormLabel>
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
              {selectedTemplate && (selectedTemplate.categories as string[]).map((cat: string) => (
                <FormControl key={cat} flex="1" minW="160px">
                  <FormLabel fontSize="sm">{cat.replace(/_/g, ' ')}</FormLabel>
                  <Select
                    placeholder="Select PDF..."
                    value={selectedFiles[cat] || ''}
                    onChange={(e) => {
                      const path = e.target.value;
                      if (path) {
                        const file = files.find(f => f.path === path);
                        if (file) handleFileSelect(cat, file);
                      } else {
                        setSelectedFiles(prev => { const next = {...prev}; delete next[cat]; return next; });
                      }
                    }}
                    isDisabled={loading}
                    size="sm"
                  >
                    <option value="">Select PDF...</option>
                    {files.map(f => (
                      <option key={f.path} value={f.path}>{f.name}</option>
                    ))}
                  </Select>
                </FormControl>
              ))}
              <Button
                leftIcon={<Sparkles size={16} />}
                colorScheme="yellow"
                onClick={handleGenerate}
                isLoading={loading}
                loadingText="Extracting..."
                isDisabled={loading || !selectedTemplate || (selectedTemplate.categories as string[]).some((cat: string) => !selectedFiles[cat])}
                size="sm"
                flexShrink={0}
              >
                Extract & Render
              </Button>
            </Flex>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm" p={3} mt={3}>
                <AlertIcon boxSize={4} />
                <Text fontSize="xs">{error}</Text>
              </Alert>
            )}
          </Box>

          {/* Row 2: Generated Email */}
          <Box 
            flex="1"
            minH="300px"
            display="flex"
            flexDirection="column"
            p={4}
            overflow="hidden"
          >
              <Text fontSize="sm" color={textColorMuted} fontWeight="semibold" mb={2}>
                Generated Email
              </Text>
              <Box 
                bg={resultBg} 
                borderRadius="md" 
                p={4}
                borderWidth="1px" 
                borderColor={borderColor} 
                position="relative"
                flex="1"
                display="flex"
                flexDirection="column"
                minH="0"
                overflow="hidden"
              >
                {loading && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack spacing={3}>
                      <Spinner size="md" color="yellow.500" />
                      <Text fontSize="xs" color={textColorMuted}>
                        Extracting data from PDFs...
                      </Text>
                    </VStack>
                  </Flex>
                )}

                {!loading && !result && !isStreaming && (
                  <Flex justify="center" align="center" flex="1">
                    <Text 
                      fontSize="sm" 
                      color={textColorSubtle} 
                      textAlign="center"
                      maxW="250px"
                    >
                      Select a template and PDFs, then click "Extract & Render" to generate the email.
                    </Text>
                  </Flex>
                )}
                
                {isStreaming && !result && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack spacing={2}>
                      <Text 
                        fontSize="sm" 
                        color={textColorMuted}
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
                        background: scrollbarColor,
                        borderRadius: '3px',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        background: scrollbarHoverColor,
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
                          backgroundColor: codeBg,
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
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 