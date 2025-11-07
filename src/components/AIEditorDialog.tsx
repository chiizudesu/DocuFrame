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
  useDisclosure
} from '@chakra-ui/react';
import { Copy, Sparkles, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { rewriteEmailBlurb, AI_AGENTS, AIAgent } from '../services/aiService';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';

interface AIEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIEditorDialog: React.FC<AIEditorDialogProps> = ({ isOpen, onClose }) => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { aiEditorInstructions, setAiEditorInstructions, aiEditorAgent, setAiEditorAgent } = useAppContext();
  const [localInstructions, setLocalInstructions] = useState(aiEditorInstructions);
  const [isEditingInstructions, setIsEditingInstructions] = useState(false);
  const { isOpen: isInstructionsExpanded, onToggle: toggleInstructions } = useDisclosure();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleRewrite = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    setCopied(false);
    try {
      const rewritten = await rewriteEmailBlurb(input, aiEditorAgent as AIAgent);
      setResult(rewritten);
    } catch (err: any) {
      setError(err.message || 'Failed to rewrite email.');
    } finally {
      setLoading(false);
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

  const handleAgentChange = async (agent: AIAgent) => {
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

  const handleClose = () => {
    setInput('');
    setResult('');
    setError(null);
    setCopied(false);
    setLoading(false);
    setIsEditingInstructions(false);
    setLocalInstructions(aiEditorInstructions);
    onClose();
  };

  // Sync local instructions when context instructions change
  React.useEffect(() => {
    setLocalInstructions(aiEditorInstructions);
  }, [aiEditorInstructions]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} color={useColorModeValue('gray.900', 'white')} boxShadow="lg" maxW="540px">
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={0}>
          <Flex align="center" justify="center" gap={2}>
            <Sparkles size={22} />
            AI Email Editor
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          <VStack align="stretch" spacing={4}>
            {/* AI Agent Selector */}
            <HStack spacing={3}>
              <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('gray.700', 'gray.200')}>
                AI Agent:
              </Text>
              <Select
                value={aiEditorAgent}
                onChange={(e) => handleAgentChange(e.target.value as AIAgent)}
                size="sm"
                maxW="200px"
                borderColor={borderColor}
                isDisabled={loading}
              >
                {AI_AGENTS.map(agent => (
                  <option key={agent.value} value={agent.value}>
                    {agent.label}
                  </option>
                ))}
              </Select>
            </HStack>

            {/* Instructions Section with Edit Button */}
            <Box>
              <HStack justify="space-between" mb={2}>
                <HStack spacing={2}>
                  <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('gray.700', 'gray.200')}>
                    Custom Instructions
                  </Text>
                  <Tooltip label={isEditingInstructions ? "Cancel editing" : "Edit instructions"}>
                    <IconButton
                      aria-label="Edit instructions"
                      icon={<Edit3 size={14} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        if (isEditingInstructions) {
                          setLocalInstructions(aiEditorInstructions);
                        }
                        setIsEditingInstructions(!isEditingInstructions);
                      }}
                    />
                  </Tooltip>
                  <IconButton
                    aria-label="Toggle instructions"
                    icon={isInstructionsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    size="xs"
                    variant="ghost"
                    onClick={toggleInstructions}
                  />
                </HStack>
              </HStack>

              <Collapse in={isInstructionsExpanded} animateOpacity>
                {isEditingInstructions ? (
                  <VStack spacing={2} align="stretch">
                    <Textarea
                      value={localInstructions}
                      onChange={(e) => setLocalInstructions(e.target.value)}
                      minH="100px"
                      maxH="200px"
                      resize="vertical"
                      borderColor={borderColor}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      fontSize="sm"
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
                  <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                    {aiEditorInstructions}
                  </Text>
                )}
              </Collapse>
            </Box>

            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste your email blurb here..."
              minH="120px"
              maxH="240px"
              resize="vertical"
              borderColor={borderColor}
              bg={useColorModeValue('gray.50', 'gray.700')}
              fontSize="md"
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
            {loading && (
              <Flex justify="center" align="center" minH="60px"><Spinner /></Flex>
            )}
            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}
            {result && !loading && (
              <Box bg={useColorModeValue('yellow.50', 'gray.900')} borderRadius="md" p={4} borderWidth="1px" borderColor={borderColor} position="relative">
                <Text fontWeight="semibold" mb={2} color={useColorModeValue('yellow.700', 'yellow.200')}>AI Rewritten Email:</Text>
                <Text whiteSpace="pre-line" fontSize="md">{result}</Text>
                <IconButton
                  aria-label="Copy rewritten email"
                  icon={<Copy size={18} />}
                  size="sm"
                  position="absolute"
                  top={2}
                  right={2}
                  onClick={handleCopy}
                  colorScheme={copied ? 'green' : 'gray'}
                  variant="ghost"
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                />
              </Box>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 