import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
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
  Grid,
  GridItem
} from '@chakra-ui/react';
import { Copy, Sparkles, Edit3, ChevronDown, ChevronUp, Send, Minus } from 'lucide-react';
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
  const resultBoxRef = React.useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
    onClose();
  };

  // Sync local instructions when context instructions change
  React.useEffect(() => {
    setLocalInstructions(aiEditorInstructions);
  }, [aiEditorInstructions]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} color={useColorModeValue('gray.900', 'white')} boxShadow="lg" maxW="1200px" maxH="85vh">
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={0}>
          <Flex align="center" justify="center" gap={2}>
            <Sparkles size={22} />
            AI Email Editor
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
        <ModalBody p={4} h="calc(85vh - 80px)">
          <Grid templateColumns="1fr 1fr" gap={4} h="100%">
            {/* Left Column - Input */}
            <GridItem>
              <VStack align="stretch" spacing={3} h="100%">
                {/* AI Agent Selector at Top */}
                <Select
                  value={aiEditorAgent}
                  onChange={(e) => handleAgentChange(e.target.value as 'openai' | 'claude')}
                  size="sm"
                  borderColor={borderColor}
                  isDisabled={loading}
                  fontWeight="medium"
                >
                  {AI_AGENTS.map(agent => (
                    <option key={agent.value} value={agent.value}>
                      {agent.label}
                    </option>
                  ))}
                </Select>

                {/* Custom Instructions - Compact */}
                <HStack spacing={2} px={1}>
                  <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} flex={1}>
                    Custom Instructions
                  </Text>
                  <Tooltip label={isEditingInstructions ? "Cancel" : "Edit instructions"}>
                    <IconButton
                      aria-label="Edit instructions"
                      icon={<Edit3 size={12} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        if (isEditingInstructions) {
                          setLocalInstructions(aiEditorInstructions);
                        }
                        setIsEditingInstructions(!isEditingInstructions);
                        if (!isEditingInstructions && !isInstructionsExpanded) {
                          toggleInstructions();
                        }
                      }}
                    />
                  </Tooltip>
                  <Tooltip label={isInstructionsExpanded ? "Hide" : "Show"}>
                    <IconButton
                      aria-label="Toggle instructions"
                      icon={isInstructionsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      size="xs"
                      variant="ghost"
                      onClick={toggleInstructions}
                    />
                  </Tooltip>
                </HStack>

                <Collapse in={isInstructionsExpanded} animateOpacity>
                  {isEditingInstructions ? (
                    <VStack spacing={2} align="stretch">
                      <Textarea
                        value={localInstructions}
                        onChange={(e) => setLocalInstructions(e.target.value)}
                        minH="70px"
                        maxH="120px"
                        resize="vertical"
                        borderColor={borderColor}
                        bg={useColorModeValue('gray.50', 'gray.700')}
                        fontSize="xs"
                      />
                      <HStack spacing={2}>
                        <Button
                          size="xs"
                          colorScheme="green"
                          onClick={handleSaveInstructions}
                        >
                          Save
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setLocalInstructions(aiEditorInstructions);
                            setIsEditingInstructions(false);
                          }}
                        >
                          Cancel
                        </Button>
                      </HStack>
                    </VStack>
                  ) : (
                    <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} px={1}>
                      {aiEditorInstructions}
                    </Text>
                  )}
                </Collapse>

                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Paste your email blurb here..."
                  minH="290px"
                  flex={1}
                  resize="vertical"
                  borderColor={borderColor}
                  bg={useColorModeValue('gray.50', 'gray.700')}
                  fontSize="sm"
                  isDisabled={loading}
                />
                <Button
                  leftIcon={<Sparkles size={18} />}
                  colorScheme="yellow"
                  onClick={handleRewrite}
                  isLoading={loading}
                  loadingText="Rewriting..."
                  isDisabled={!input.trim() || loading}
                  alignSelf="flex-end"
                  mt={2}
                >
                  Rewrite Email
                </Button>
              </VStack>
            </GridItem>

            {/* Right Column - Results */}
            <GridItem>
              <VStack align="stretch" spacing={3} h="100%">
                {!result && !loading && !error && (
                  <Flex 
                    justify="center" 
                    align="center" 
                    h="100%" 
                    bg={useColorModeValue('gray.50', 'gray.900')}
                    borderRadius="lg"
                    border="2px dashed"
                    borderColor={useColorModeValue('gray.300', 'gray.700')}
                  >
                    <VStack spacing={3} color={useColorModeValue('gray.500', 'gray.400')}>
                      <Sparkles size={48} opacity={0.3} />
                      <Text fontSize="sm" fontWeight="medium">
                        AI Rewritten Email Will Appear Here
                      </Text>
                      <Text fontSize="xs" maxW="250px" textAlign="center">
                        Paste your email text on the left and click "Rewrite Email" to get started
                      </Text>
                    </VStack>
                  </Flex>
                )}
                {loading && (
                  <Flex justify="center" align="center" minH="200px"><Spinner size="xl" /></Flex>
                )}
                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
                {result && !loading && (
              <Box h="100%" display="flex" flexDirection="column">
                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontWeight="semibold" fontSize="sm" color={useColorModeValue('gray.700', 'gray.300')}>
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
                  maxH="290px"
                  overflowY="auto"
                  bg={useColorModeValue('gray.50', 'gray.900')}
                  borderRadius="lg"
                  p={3}
                >
                  <Box
                    bg={useColorModeValue('white', 'gray.800')}
                    p={4}
                    borderRadius="lg"
                    boxShadow={useColorModeValue('sm', 'dark-lg')}
                    border="1px solid"
                    borderColor={useColorModeValue('gray.200', 'gray.700')}
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
              </VStack>
            </GridItem>
          </Grid>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 