import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
  Textarea,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  useColorModeValue,
  IconButton,
  Alert,
  AlertIcon,
  Select,
  Tooltip,
  HStack,
  Collapse,
  useDisclosure,
  Input,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { Copy, Sparkles, Edit3, ChevronDown, ChevronUp, Send, Minus, X, Clipboard, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rewriteEmailBlurbStream, AI_AGENTS, AIAgent } from '../services/aiService';
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
  const { aiEditorInstructions, setAiEditorInstructions, aiEditorAgent, setAiEditorAgent } = useAppContext();
  const [localInstructions, setLocalInstructions] = useState(aiEditorInstructions);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const { isOpen: isInstructionsExpanded, onToggle: toggleInstructions } = useDisclosure();
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

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  // Pre-compute all color values to avoid conditional hook calls
  const textColor = useColorModeValue('gray.900', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.400');
  const emptyStateBg = useColorModeValue('gray.50', 'gray.900');
  const emptyStateBorder = useColorModeValue('gray.300', 'gray.700');
  const emptyStateText = useColorModeValue('gray.500', 'gray.400');
  const resultBg = useColorModeValue('gray.50', 'gray.900');
  const resultBoxBg = useColorModeValue('white', 'gray.800');
  const resultBoxShadow = useColorModeValue('sm', 'dark-lg');
  const resultBoxBorder = useColorModeValue('gray.200', 'gray.700');
  const resultHeaderText = useColorModeValue('gray.700', 'gray.300');
  const instructionsBg = useColorModeValue('gray.50', 'gray.700');

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
        aiEditorAgent as AIAgent, 
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

  const handleAgentChange = async (agent: 'openai' | 'claude') => {
    try {
      setAiEditorAgent(agent);
      const settings = await settingsService.getSettings();
      await settingsService.setSettings({ ...settings, aiEditorAgent: agent });
    } catch (err: any) {
      console.error('Failed to save agent preference:', err);
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
        aiEditorAgent as AIAgent, 
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
    <Modal isOpen={isOpen} onClose={handleOverlayClick} size="4xl" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        bg={bgColor} 
        color={useColorModeValue('gray.900', 'white')} 
        borderRadius={0}
        boxShadow="xl" 
        w="720px"
        maxW="95vw"
        h="750px"
        maxH="90vh"
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
              <Text fontSize="lg" fontWeight="semibold">AI Email Editor</Text>
            </Flex>
            <HStack spacing={2}>
              <Select
                value={aiEditorAgent}
                onChange={(e) => handleAgentChange(e.target.value as 'openai' | 'claude')}
                size="sm"
                w="140px"
                bg={bgColor}
                isDisabled={loading}
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
                onClick={handleClose}
              />
            </HStack>
          </Flex>
        </ModalHeader>
        <ModalBody p={0} overflow="hidden" display="flex" flexDirection="column">
          {/* Row 1: Paste from Clipboard + Rewrite */}
          <Box
            p={4}
            borderBottom="1px solid"
            borderColor={borderColor}
            bg={itemBgColor}
          >
            <Flex gap={4} align="flex-end" flexWrap="wrap">
              <FormControl flex="1" minW="200px">
                <FormLabel fontSize="sm">Input Content</FormLabel>
                <HStack>
                  <Button
                    leftIcon={<Clipboard size={14} />}
                    size="sm"
                    variant="outline"
                    onClick={handlePasteFromClipboard}
                  >
                    Paste from Clipboard
                  </Button>
                  {clipboardPasteStatus === 'success' && (
                    <HStack spacing={1} color="green.500">
                      <Check size={16} />
                      <Text fontSize="xs" noOfLines={1} maxW="120px">
                        {input.length} chars
                      </Text>
                    </HStack>
                  )}
                  {clipboardPasteStatus === 'empty' && (
                    <HStack spacing={1} color="red.500">
                      <X size={16} />
                      <Text fontSize="xs">Clipboard empty</Text>
                    </HStack>
                  )}
                  {clipboardPasteStatus === 'error' && (
                    <HStack spacing={1} color="red.500">
                      <X size={16} />
                      <Text fontSize="xs">Paste failed</Text>
                    </HStack>
                  )}
                  {input && (
                    <Button size="xs" variant="ghost" onClick={handleClearInput}>
                      Clear
                    </Button>
                  )}
                </HStack>
              </FormControl>
              <HStack spacing={2} flexShrink={0}>
                <HStack spacing={1} px={2}>
                  <Text fontSize="xs" color={secondaryTextColor}>Custom Instructions</Text>
                  <Tooltip label={isEditingInstructions ? "Cancel" : "Edit"}>
                    <IconButton
                      aria-label="Edit instructions"
                      icon={<Edit3 size={12} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        if (isEditingInstructions) setLocalInstructions(aiEditorInstructions);
                        setIsEditingInstructions(!isEditingInstructions);
                        if (!isEditingInstructions && !isInstructionsExpanded) toggleInstructions();
                      }}
                    />
                  </Tooltip>
                  <IconButton
                    aria-label="Toggle instructions"
                    icon={isInstructionsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    size="xs"
                    variant="ghost"
                    onClick={toggleInstructions}
                  />
                </HStack>
                <Button
                  leftIcon={<Sparkles size={16} />}
                  colorScheme="yellow"
                  onClick={handleRewrite}
                  isLoading={loading}
                  loadingText="Rewriting..."
                  isDisabled={!input.trim() || loading}
                  size="sm"
                >
                  Rewrite Email
                </Button>
              </HStack>
            </Flex>
            <Collapse in={isInstructionsExpanded} animateOpacity>
              {isEditingInstructions ? (
                <VStack spacing={2} align="stretch" mt={3}>
                  <Textarea
                    value={localInstructions}
                    onChange={(e) => setLocalInstructions(e.target.value)}
                    minH="60px"
                    maxH="100px"
                    resize="vertical"
                    borderColor={borderColor}
                    bg={bgColor}
                    fontSize="xs"
                  />
                  <HStack spacing={2}>
                    <Button size="xs" colorScheme="green" onClick={handleSaveInstructions}>Save</Button>
                    <Button size="xs" variant="ghost" onClick={() => { setLocalInstructions(aiEditorInstructions); setIsEditingInstructions(false); }}>Cancel</Button>
                  </HStack>
                </VStack>
              ) : (
                <Text fontSize="xs" color={secondaryTextColor} mt={2} px={1}>{aiEditorInstructions}</Text>
              )}
            </Collapse>
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm" p={3} mt={3}>
                <AlertIcon boxSize={4} />
                {error}
              </Alert>
            )}
          </Box>

          {/* Row 2: Generated text */}
          <Box flex="1" p={4} overflow="hidden" display="flex" flexDirection="column" minH="200px">
            {!result && !loading && (
              <Flex 
                justify="center" 
                align="center" 
                flex="1"
                bg={emptyStateBg}
                borderRadius="md"
                border="2px dashed"
                borderColor={emptyStateBorder}
              >
                <VStack spacing={3} color={emptyStateText}>
                  <Sparkles size={48} opacity={0.3} />
                  <Text fontSize="sm" fontWeight="medium">
                    AI Rewritten Email Will Appear Here
                  </Text>
                  <Text fontSize="xs" maxW="280px" textAlign="center">
                    Paste from clipboard above and click &quot;Rewrite Email&quot; to get started
                  </Text>
                </VStack>
              </Flex>
            )}
            {loading && !result && (
              <Flex justify="center" align="center" flex="1">
                <VStack spacing={3}>
                  <Spinner size="lg" color="yellow.500" />
                  <Text fontSize="sm" color={secondaryTextColor}>Rewriting...</Text>
                </VStack>
              </Flex>
            )}
            {result && !loading && (
              <Box h="100%" display="flex" flexDirection="column">
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontWeight="semibold" fontSize="sm" color={resultHeaderText}>
                    AI Rewritten Email:
                  </Text>
                  <IconButton
                    aria-label="Copy rewritten email"
                    icon={<Copy size={16} />}
                    size="sm"
                    onClick={handleCopy}
                    colorScheme={copied ? 'green' : 'gray'}
                    variant="ghost"
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                  />
                </Flex>
                
                <Box
                  ref={resultBoxRef}
                  flex="1"
                  minH="0"
                  overflowY="auto"
                  bg={resultBg}
                  borderRadius="lg"
                  p={3}
                >
                  <Box
                    bg={resultBoxBg}
                    p={4}
                    borderRadius="lg"
                    boxShadow={resultBoxShadow}
                    border="1px solid"
                    borderColor={resultBoxBorder}
                    sx={{
                      '& h1, & h2, & h3, & h4': {
                        fontWeight: 'bold',
                        marginBottom: '0.25rem',
                        marginTop: '0.5rem',
                        '&:first-child': { marginTop: '0' }
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
                      '& strong': { fontWeight: '600' },
                      '& table': {
                        borderCollapse: 'collapse',
                        width: '100%',
                        marginTop: '1rem',
                        marginBottom: '1rem',
                        border: '1px solid',
                        borderColor: useColorModeValue('gray.300', 'gray.600')
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
                          <Text fontSize="sm">AI is writing...</Text>
                        </Flex>
                      ) : null}
                    </Box>
                  </Box>

                </Box>
                
                {/* Follow-up Input */}
                <Box mt={2}>
                  <Flex gap={2}>
                    <Input
                      placeholder="Ask to refine the email further..."
                      value={followUpInput}
                      onChange={(e) => setFollowUpInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleFollowUp()}
                      size="sm"
                      disabled={loading || isStreaming}
                      borderColor={borderColor}
                    />
                    <IconButton
                      aria-label="Send refinement request"
                      icon={<Send size={16} />}
                      onClick={handleFollowUp}
                      colorScheme="blue"
                      size="sm"
                      isDisabled={!followUpInput.trim() || loading || isStreaming}
                      isLoading={loading && !isStreaming}
                    />
                  </Flex>
                </Box>
              </Box>
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 