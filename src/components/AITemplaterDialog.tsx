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
  FormLabel
} from '@chakra-ui/react';
import { Copy, Sparkles } from 'lucide-react';
import { loadEmailTemplates } from '../services/openai';

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

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const isFinals = /[\\/]Finals[\\/]?$/i.test(currentDirectory);

  useEffect(() => {
    if (isOpen) {
      setResult('');
      setError(null);
      setCopied(false);
      setSelectedTemplate(null);
      setSelectedFiles({});
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
    try {
      // Extract text from selected PDFs
      const extracted: { [cat: string]: string } = {};
      for (const cat of selectedTemplate.categories as string[]) {
        const filePath = selectedFiles[cat];
        if (!filePath) throw new Error(`No file selected for ${cat}`);
        extracted[cat] = await (window.electronAPI as any).readPdfText(filePath);
      }
      // Prepare prompt for OpenAI
      const prompt = `You are an expert accountant. Given the following extracted text from PDFs, fill in the placeholders in the provided email template. Only use information found in the PDFs.\n\nExtracted Data:\n${(selectedTemplate.categories as string[]).map((cat: string) => `--- ${cat} ---\n${extracted[cat] || ''}`).join('\n')}\n\nTemplate:\n${selectedTemplate.template}`;
      // Call OpenAI
      const settings = await import('../services/settings');
      const apiKey = (await settings.settingsService.getSettings()).apiKey;
      if (!apiKey) throw new Error('OpenAI API key not set.');
      const body = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Fill in the template with the extracted data.' }
        ],
        max_tokens: 800,
        temperature: 0.7
      };
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'Failed to get response from OpenAI');
      }
      const data = await response.json();
      setResult(data.choices?.[0]?.message?.content?.trim() || '');
    } catch (err: any) {
      setError(err.message || 'Failed to generate email.');
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

  const handleClose = () => {
    setResult('');
    setError(null);
    setCopied(false);
    setSelectedTemplate(null);
    setSelectedFiles({});
    setLoading(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
      <ModalOverlay />
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
          {!isFinals ? (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              This function is only available in a folder named "Finals".
            </Alert>
          ) : (
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
                  h="450px"
                  display="flex"
                  flexDirection="column"
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
                    >
                      <Text 
                        whiteSpace="pre-line" 
                        fontSize="sm"
                        lineHeight="1.5"
                      >
                        {result}
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
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 