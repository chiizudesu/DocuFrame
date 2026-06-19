import React, { useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  Textarea,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  IconButton,
  Alert,
  HStack,
  Collapsible,
  useDisclosure,
  Input,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { Copy, Sparkles, Edit3, ChevronDown, ChevronUp, Send, Minus, X, Clipboard, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rewriteEmailBlurbStream } from '../services/claude';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';

interface AIEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
}

export const AIEditorDialog: React.FC<AIEditorDialogProps> = ({ isOpen, onClose, onMinimize }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { aiEditorInstructions, setAiEditorInstructions } = useAppContext();
  const [localInstructions, setLocalInstructions] = useState(aiEditorInstructions);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const { open: isInstructionsExpanded, onToggle: toggleInstructions } = useDisclosure();
  const [followUpInput, setFollowUpInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [clipboardPasteStatus, setClipboardPasteStatus] = useState<'idle' | 'success' | 'empty' | 'error'>('idle');
  const resultBoxRef = React.useRef<HTMLDivElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setClipboardPasteStatus('empty');
        setInput('');
      } else {
        setInput(text);
        setClipboardPasteStatus('success');
      }
    } catch {
      setClipboardPasteStatus('error');
      setInput('');
    }
  };

  const handleClearInput = () => {
    setInput('');
    setClipboardPasteStatus('idle');
  };

  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    inputBg,
    cardBg,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();
  const itemBgColor = cardBg;
  const mdTableBorder = useColorModeValue('gray.300', 'gray.600');
  const mdTableHeaderBg = useColorModeValue('gray.100', 'gray.700');
  const mdTableRowAlt = useColorModeValue('gray.50', '#171923');
  const streamingMuted = useColorModeValue('gray.500', 'gray.400');

  const handleRewrite = async () => {
    setError(null);
    setResult(''); // Clear result to ensure we show empty state
    setCopied(false);
    setIsStreaming(true);
    setLoading(false); // Don't show loading spinner
    
    // Set a placeholder immediately so UI switches to results view
    setResult(' '); // Single space to trigger results display
    
    try {
      let accumulatedText = '';
      await rewriteEmailBlurbStream(
        input,
        'sonnet',
        aiEditorInstructions,
        (chunk) => {
          accumulatedText += chunk;
          setResult(accumulatedText);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            if (resultBoxRef.current) {
              resultBoxRef.current.scrollTop = resultBoxRef.current.scrollHeight;
            }
          }, 0);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to rewrite email.');
      setResult(''); // Clear on error
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSaveInstructions = async () => {
    try {
      setAiEditorInstructions(localInstructions);
      const settings = await settingsService.getSettings();
      await settingsService.setSettings({ ...settings, aiEditorInstructions: localInstructions });
      setIsEditingInstructions(false);
    } catch (err: any) {
      console.error('Failed to save instructions:', err);
    }
  };

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/^#{1,6}\s+/gm, '')           // headers
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')   // bold+italic
      .replace(/\*\*(.+?)\*\*/g, '$1')        // bold
      .replace(/\*(.+?)\*/g, '$1')            // italic
      .replace(/_(.+?)_/g, '$1')              // italic underscore
      .replace(/`{3}[\s\S]*?`{3}/g, '')       // code blocks
      .replace(/`(.+?)`/g, '$1')              // inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')     // links
      .replace(/!\[.*?\]\(.+?\)/g, '')        // images
      .replace(/^[-*_]{3,}\s*$/gm, '')        // horizontal rules
      .replace(/^>\s+/gm, '')                 // blockquotes
      .replace(/^[\s]*[-*+]\s+/gm, '')        // unordered lists
      .replace(/^[\s]*\d+\.\s+/gm, '')        // ordered lists
      .replace(/\n{3,}/g, '\n\n')             // collapse 3+ newlines to 1 blank line
      .trim();
  };

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(stripMarkdown(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !result) return;
    
    setIsStreaming(true);
    setError(null);
    
    const currentQuestion = followUpInput;
    setFollowUpInput('');
    
    try {
      // Create a context-aware prompt
      const contextPrompt = `Previous email version:\n\n${result}\n\nUser's refinement request: ${currentQuestion}\n\nPlease provide an updated version of the email based on the user's request.`;
      
      let accumulatedText = '';
      await rewriteEmailBlurbStream(
        contextPrompt,
        'sonnet',
        aiEditorInstructions,
        (chunk) => {
          accumulatedText += chunk;
          setResult(accumulatedText);
          
          // Auto-scroll to bottom of result
          setTimeout(() => {
            if (resultBoxRef.current) {
              resultBoxRef.current.scrollTop = resultBoxRef.current.scrollHeight;
            }
          }, 0);
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to refine email.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleClose = () => {
    setInput('');
    setResult('');
    setError(null);
    setCopied(false);
    setLoading(false);
    setIsEditingInstructions(false);
    setLocalInstructions(aiEditorInstructions);
    setFollowUpInput('');
    setIsStreaming(false);
    setClipboardPasteStatus('idle');
    onClose();
  };

  // Sync local instructions when context instructions change
  React.useEffect(() => {
    setLocalInstructions(aiEditorInstructions);
  }, [aiEditorInstructions]);

  const handleOverlayClick = () => {
    // Auto-dock when clicking outside if minimize handler is provided and result exists
    if (onMinimize && result) {
      onMinimize();
    } else {
      handleClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} size='xl' placement='center' onOpenChange={e => {
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
            w="720px"
            maxW="95vw"
            h="750px"
            maxH="90vh"
            display="flex"
            flexDirection="column"
            overflow="hidden">
            {/* Plain Box layout: Chakra Dialog.Header/Body slots can overlap the body when Content uses grid placement. */}
            <Box
              flexShrink={0}
              bg={titleBarBg}
              borderBottom="1px solid"
              borderColor={borderColor}
              px={3}
              py={2}
              role="banner"
            >
              <Flex align="center" justify="space-between" w="full" minH="32px">
                <Flex align="center" gap={2}>
                  <Sparkles size={18} />
                  <Text fontSize="sm" fontWeight="600" color={textColor}>AI Email Editor</Text>
                </Flex>
                <HStack gap={2}>
                  {onMinimize && (
                    <IconButton aria-label="Minimize" size="sm" variant="ghost" onClick={onMinimize}><Minus size={16} /></IconButton>
                  )}
                  <IconButton aria-label="Close" size="sm" variant="ghost" onClick={handleClose}><X size={16} /></IconButton>
                </HStack>
              </Flex>
            </Box>
            <Box
              flex="1"
              minH={0}
              overflow="hidden"
              display="flex"
              flexDirection="column"
              p={0}
            >
              {/* Toolbar: Paste + Rewrite */}
              <Box
                p={4}
                pb={3}
                borderBottom="1px solid"
                borderColor={borderColor}
                bg={itemBgColor}
              >
                {/* Row 1: Input controls + Rewrite button */}
                <Flex gap={3} align="center" mb={3}>
                  <HStack gap={2} flex="1">
                    <Button size="sm" variant="outline" onClick={handlePasteFromClipboard} flexShrink={0}>
                      <Clipboard size={14} />Paste from Clipboard
                    </Button>
                    {clipboardPasteStatus === 'success' && (
                      <HStack gap={1} color="green.500">
                        <Check size={14} />
                        <Text fontSize="xs">{input.length} chars</Text>
                      </HStack>
                    )}
                    {clipboardPasteStatus === 'empty' && (
                      <HStack gap={1} color="red.500">
                        <X size={14} />
                        <Text fontSize="xs">Clipboard empty</Text>
                      </HStack>
                    )}
                    {clipboardPasteStatus === 'error' && (
                      <HStack gap={1} color="red.500">
                        <X size={14} />
                        <Text fontSize="xs">Paste failed</Text>
                      </HStack>
                    )}
                    {input && (
                      <Button size="xs" variant="ghost" onClick={handleClearInput}>Clear</Button>
                    )}
                  </HStack>
                  <Button
                    colorPalette="yellow"
                    onClick={handleRewrite}
                    disabled={!input.trim() || loading}
                    size="sm"
                    flexShrink={0}
                  >
                    <Sparkles size={16} />Rewrite Email
                  </Button>
                </Flex>

                {/* Row 2: Custom Instructions collapsible */}
                <Box
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                  overflow="hidden"
                >
                  <Flex
                    align="center"
                    justify="space-between"
                    px={3}
                    py={1.5}
                    bg={bgColor}
                    cursor="pointer"
                    onClick={toggleInstructions}
                    _hover={{ opacity: 0.85 }}
                    userSelect="none"
                  >
                    <HStack gap={2} flex="1" minW={0}>
                      <Edit3 size={11} color="currentColor" style={{ opacity: 0.5, flexShrink: 0 }} />
                      <Text fontSize="xs" fontWeight="semibold" color={secondaryTextColor} flexShrink={0}>
                        Custom Instructions
                      </Text>
                      {aiEditorInstructions && !isInstructionsExpanded && (
                        <Text
                          fontSize="xs"
                          color={secondaryTextColor}
                          opacity={0.6}
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          minW={0}
                        >
                          — {aiEditorInstructions}
                        </Text>
                      )}
                    </HStack>
                    <HStack gap={1} flexShrink={0}>
                      <Tooltip content={isEditingInstructions ? "Cancel edit" : "Edit instructions"}>
                        <IconButton
                          aria-label="Edit instructions"
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditingInstructions) setLocalInstructions(aiEditorInstructions);
                            setIsEditingInstructions(!isEditingInstructions);
                            if (!isEditingInstructions && !isInstructionsExpanded) toggleInstructions();
                          }}
                        >
                          <Edit3 size={12} />
                        </IconButton>
                      </Tooltip>
                      <Box color={secondaryTextColor} opacity={0.6}>
                        {isInstructionsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </Box>
                    </HStack>
                  </Flex>
                  <Collapsible.Root open={isInstructionsExpanded}>
                    <Collapsible.Content>
                      <Box px={3} py={2} borderTop="1px solid" borderColor={borderColor}>
                        {isEditingInstructions ? (
                          <VStack gap={2} align="stretch">
                            <Textarea
                              value={localInstructions}
                              onChange={(e) => setLocalInstructions(e.target.value)}
                              minH="60px"
                              maxH="120px"
                              resize="vertical"
                              borderColor={borderColor}
                              bg={bgColor}
                              fontSize="xs"
                              placeholder="e.g. Keep tone professional, use Australian English, sign off as 'Regards'"
                            />
                            <HStack gap={2}>
                              <Button size="xs" colorPalette="green" onClick={handleSaveInstructions}>Save</Button>
                              <Button size="xs" variant="ghost" onClick={() => { setLocalInstructions(aiEditorInstructions); setIsEditingInstructions(false); }}>Cancel</Button>
                            </HStack>
                          </VStack>
                        ) : (
                          <Text fontSize="xs" color={secondaryTextColor} lineHeight="1.5">
                            {aiEditorInstructions || <Box as="span" opacity={0.5} fontStyle="italic">No custom instructions set. Click the edit icon to add some.</Box>}
                          </Text>
                        )}
                      </Box>
                    </Collapsible.Content>
                  </Collapsible.Root>
                </Box>

                {error && (
                  <Alert.Root status="error" borderRadius="md" fontSize="sm" p={3} mt={3}>
                    <Alert.Indicator boxSize={4} />
                    {error}
                  </Alert.Root>
                )}
              </Box>

              {/* Output + pinned footer */}
              <Box flex="1" p={4} overflow="hidden" display="flex" flexDirection="column" minH="200px">
                {!result && !loading && (
                  <Text fontSize="xs" color={secondaryTextColor} flex="1" alignSelf="center" textAlign="center" py={6}>
                    1. Paste content above · 2. Click &quot;Rewrite Email&quot; — output appears here.
                  </Text>
                )}
                {loading && !result && (
                  <Flex justify="center" align="center" flex="1">
                    <VStack gap={3}>
                      <Spinner size="lg" color="yellow.500" />
                      <Text fontSize="sm" color={secondaryTextColor}>Rewriting...</Text>
                    </VStack>
                  </Flex>
                )}
                {result && !loading && (
                  <Box h="100%" display="flex" flexDirection="column" flex="1" minH={0}>
                    <Flex justify="space-between" align="center" mb={2} flexShrink={0}>
                      <Text fontWeight="semibold" fontSize="sm" color={textColor}>
                        AI Rewritten Email:
                      </Text>
                      <IconButton
                        aria-label="Copy rewritten email"
                        size="sm"
                        onClick={handleCopy}
                        colorPalette={copied ? 'green' : 'gray'}
                        variant="ghost"
                        title={copied ? 'Copied!' : 'Copy to clipboard'}><Copy size={16} /></IconButton>
                    </Flex>

                    <Box
                      ref={resultBoxRef}
                      flex="1"
                      minH="0"
                      overflowY="auto"
                      bg={cardBg}
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius="md"
                      p={4}
                      css={{
                        '& & h1, & h2, & h3, & h4': {
                          fontWeight: 'bold',
                          marginBottom: '0.25rem',
                          marginTop: '0.5rem',
                          '&:first-child': { marginTop: '0' },
                        },
                        '& & h1': { fontSize: 'lg' },
                        '& & h2': { fontSize: 'md' },
                        '& & h3, & h4': { fontSize: 'sm', fontWeight: '600' },
                        '& & p': {
                          marginBottom: '0.25rem',
                          lineHeight: '1.4',
                          fontSize: 'sm',
                        },
                        '& & ul, & ol': {
                          marginLeft: '1rem',
                          marginBottom: '0.25rem',
                          marginTop: '0.25rem',
                          paddingLeft: '0.5rem',
                        },
                        '& & li': {
                          marginBottom: '0.125rem',
                          fontSize: 'sm',
                          lineHeight: '1.4',
                        },
                        '& & strong': { fontWeight: '600' },
                        '& & table': {
                          borderCollapse: 'collapse',
                          width: '100%',
                          marginTop: '1rem',
                          marginBottom: '1rem',
                          border: '1px solid',
                          borderColor: mdTableBorder,
                        },
                        '& & th': {
                          border: '1px solid',
                          borderColor: mdTableBorder,
                          padding: '0.5rem',
                          backgroundColor: mdTableHeaderBg,
                          fontWeight: 'bold',
                          fontSize: 'sm',
                          textAlign: 'left',
                        },
                        '& & td': {
                          border: '1px solid',
                          borderColor: mdTableBorder,
                          padding: '0.5rem',
                          fontSize: 'sm',
                        },
                        '& & tr:nth-of-type(even)': {
                          backgroundColor: mdTableRowAlt,
                        },
                      }}
                    >
                      <Box whiteSpace="pre-wrap">
                        {result.trim() ? (
                          <>
                            <ReactMarkdown key={result.length} remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                            {isStreaming && (
                              <Box
                                as="span"
                                display="inline-block"
                                w="2px"
                                h="1em"
                                bg="blue.500"
                                ml={1}
                                animation="blink 1s step-end infinite"
                                css={{
                                  '@keyframes blink': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0 },
                                  },
                                }}
                              />
                            )}
                          </>
                        ) : isStreaming ? (
                          <Flex align="center" gap={2} color={streamingMuted}>
                            <Spinner size="sm" />
                            <Text fontSize="sm">AI is writing...</Text>
                          </Flex>
                        ) : null}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>

              <Box
                flexShrink={0}
                px={4}
                py={3}
                borderTop="1px solid"
                borderColor={borderColor}
                bg={bgColor}
              >
                <Flex gap={2}>
                  <Input
                    placeholder="Ask to refine the email further..."
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleFollowUp()}
                    size="sm"
                    disabled={!result.trim() || loading || isStreaming}
                    borderColor={borderColor}
                    bg={inputBg}
                  />
                  <IconButton
                    aria-label="Send refinement request"
                    onClick={handleFollowUp}
                    colorPalette="blue"
                    size="sm"
                    disabled={!result.trim() || !followUpInput.trim() || loading || isStreaming}
                  ><Send size={16} /></IconButton>
                </Flex>
              </Box>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 