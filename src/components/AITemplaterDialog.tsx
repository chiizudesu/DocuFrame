import React, { useState, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  NativeSelect,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  IconButton,
  Alert,
  HStack,
  Input,
  Field,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Copy, Sparkles, Send, Minus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { loadEmailTemplates, generateEmailFromTemplateStream, extractTemplateData } from '../services/aiService';
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
  const [followUpInput, setFollowUpInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractionStep, setExtractionStep] = useState<'generate' | 'extracting' | 'rendered'>('generate');
  const [extractedData, setExtractedData] = useState<{ placeholders: Record<string, string>; conditions: Record<string, boolean> } | null>(null);

  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    inputBg,
    cardBg,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();
  const scrollbarColor = useColorModeValue('#CBD5E0', '#4A5568');
  const scrollbarHoverColor = useColorModeValue('#A0AEC0', '#2D3748');
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

  const handleTemplateChange = (value: string) => {
    const t = templates.find(t => t.filename === value);
    setSelectedTemplate(t ?? null);
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
      const data = await extractTemplateData(selectedTemplate, extracted);
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
        {},
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
    <Dialog.Root open={isOpen} size='xl' placement='center' closeOnInteractOutside={true} onOpenChange={e => {
      if (!e.open) {
        handleOverlayClick();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            color={textColor}
            borderRadius={0}
            boxShadow="xl"
            maxW={{ base: "95vw", sm: "90vw", md: "85vw", lg: "800px", xl: "1000px" }}
            maxH="95vh"
            minH="600px"
            w="full"
            display="flex"
            flexDirection="column"
            overflow="hidden">
            <Dialog.Header 
              bg={titleBarBg} 
              borderBottom="1px solid" 
              borderColor={borderColor}
              borderRadius={0}
              py={1.5}
              minH="31px"
            >
              <Flex align="center" justify="space-between" w="full">
                <Flex align="center" gap={2}>
                  <Sparkles size={18} />
                  <Text fontSize="sm" fontWeight="600" color={textColor}>AI Templater</Text>
                </Flex>
                <HStack gap={2}>
                  {onMinimize && (
                    <IconButton aria-label="Minimize" size="sm" variant="ghost" onClick={onMinimize}><Minus size={16} /></IconButton>
                  )}
                  <IconButton aria-label="Close" size="sm" variant="ghost" onClick={onClose}><X size={16} /></IconButton>
                </HStack>
              </Flex>
            </Dialog.Header>
            <Dialog.Body p={0} overflow="hidden" flex="1" minH={0} display="flex" flexDirection="column">
              {/* Row 1: Template + PDF selection */}
              <Box 
                p={4}
                borderBottom="1px solid"
                borderColor={borderColor}
                bg={cardBg}
              >
                <Flex 
                  direction={{ base: "column", md: "row" }}
                  gap={4}
                  align={{ base: "stretch", md: "flex-end" }}
                  flexWrap="wrap"
                >
                  <Field.Root flex="1" minW="180px">
                    <Field.Label fontSize="sm">Template</Field.Label>
                    <NativeSelect.Root size="sm" disabled={loading || templates.length === 0}>
                      <NativeSelect.Field
                        w="full"
                        bg={inputBg}
                        borderColor={borderColor}
                        color={textColor}
                        value={selectedTemplate?.filename ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTemplateChange(e.target.value)}
                      >
                        <option value="" style={{ background: 'inherit', color: 'inherit' }}>
                          Select template…
                        </option>
                        {templates.map((t) => (
                          <option key={t.filename} value={t.filename} style={{ background: 'inherit', color: 'inherit' }}>
                            {t.name}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  {selectedTemplate && (selectedTemplate.categories as string[]).map((cat: string) => (
                    <Field.Root key={cat} flex="1" minW="160px">
                      <Field.Label fontSize="sm">{cat.replace(/_/g, ' ')}</Field.Label>
                      <NativeSelect.Root size="sm" disabled={loading}>
                        <NativeSelect.Field
                          w="full"
                          bg={inputBg}
                          borderColor={borderColor}
                          color={textColor}
                          value={selectedFiles[cat] ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                            const path = e.target.value;
                            if (path) {
                              const file = files.find((f) => f.path === path);
                              if (file) handleFileSelect(cat, file);
                            } else {
                              setSelectedFiles((prev) => {
                                const next = { ...prev };
                                delete next[cat];
                                return next;
                              });
                            }
                          }}
                        >
                          <option value="" style={{ background: 'inherit', color: 'inherit' }}>
                            Select PDF…
                          </option>
                          {files.map((f) => (
                            <option key={f.path} value={f.path} style={{ background: 'inherit', color: 'inherit' }}>
                              {f.name}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Field.Root>
                  ))}
                  <Button
                    colorPalette="yellow"
                    onClick={handleGenerate}
                    disabled={loading || !selectedTemplate || (selectedTemplate.categories as string[]).some((cat: string) => !selectedFiles[cat])}
                    size="sm"
                    flexShrink={0}><Sparkles size={16} />Extract & Render
                                  </Button>
                </Flex>
                {error && (
                  <Alert.Root status="error" borderRadius="md" fontSize="sm" p={3} mt={3}>
                    <Alert.Indicator boxSize={4} />
                    <Text fontSize="xs">{error}</Text>
                  </Alert.Root>
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
                  <Box 
                    bg={cardBg} 
                    borderRadius="md" 
                    p={4}
                    borderWidth="1px" 
                    borderColor={borderColor} 
                    flex="1"
                    display="flex"
                    flexDirection="column"
                    minH="0"
                    overflow="hidden"
                  >
                    {loading && (
                      <Flex justify="center" align="center" flex="1">
                        <VStack gap={3}>
                          <Spinner size="md" color="yellow.500" />
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Extracting data from PDFs...
                          </Text>
                        </VStack>
                      </Flex>
                    )}

                    {!loading && !result && !isStreaming && (
                      <Flex justify="center" align="center" flex="1">
                        <Text 
                          fontSize="sm" 
                          color={secondaryTextColor} 
                          textAlign="center"
                          maxW="250px"
                        >
                          Select a template and PDFs, then click &quot;Extract &amp; Render&quot; to generate the email.
                        </Text>
                      </Flex>
                    )}
                    
                    {isStreaming && !result && (
                      <Flex justify="center" align="center" flex="1">
                        <VStack gap={2}>
                          <Text 
                            fontSize="sm" 
                            color={secondaryTextColor}
                            animation="pulse 1.5s ease-in-out infinite"
                            css={{
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
                    
                    {!loading && (result || isStreaming) && (
                      <>
                        <Flex justify="space-between" align="center" mb={2} flexShrink={0}>
                          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                            Generated Email
                          </Text>
                          {result.trim() ? (
                            <IconButton
                              aria-label="Copy generated email"
                              size="sm"
                              onClick={handleCopy}
                              colorPalette={copied ? 'green' : 'gray'}
                              variant="ghost"
                              title={copied ? 'Copied!' : 'Copy to clipboard'}
                            ><Copy size={16} /></IconButton>
                          ) : null}
                        </Flex>
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
                            css={{
                              '& & h1, & h2, & h3, & h4': {
                                fontWeight: 'bold',
                                marginBottom: '0.5rem',
                                marginTop: '1rem'
                              },

                              '& & h1': { fontSize: 'lg' },
                              '& & h2': { fontSize: 'md' },
                              '& & h3, & h4': { fontSize: 'sm' },

                              '& & p': {
                                marginBottom: '0.75rem'
                              },

                              '& & ul, & ol': {
                                marginLeft: '1.5rem',
                                marginBottom: '0.75rem'
                              },

                              '& & li': {
                                marginBottom: '0.25rem'
                              },

                              '& & strong': {
                                fontWeight: 'bold'
                              },

                              '& & em': {
                                fontStyle: 'italic'
                              },

                              '& & code': {
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
                                css={{
                                  '@keyframes blink': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0 },
                                  }
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      </>
                    )}
                  </Box>
                  
                  {/* Follow-up Input */}
                  {result && (
                    <HStack mt={3} gap={2}>
                      <Input
                        placeholder="Ask for changes (e.g., 'make it more concise' or 'add bullet points')"
                        value={followUpInput}
                        onChange={(e) => setFollowUpInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !loading && !isStreaming && handleFollowUp()}
                        size="sm"
                        disabled={loading || isStreaming}
                        bg={inputBg}
                        borderColor={borderColor}
                      />
                      <IconButton
                        aria-label="Send follow-up"
                        onClick={handleFollowUp}
                        colorPalette="yellow"
                        size="sm"
                        disabled={!followUpInput.trim() || loading || isStreaming}><Send size={16} /></IconButton>
                    </HStack>
                  )}
                </Box>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 