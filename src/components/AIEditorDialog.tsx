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
  AlertIcon
} from '@chakra-ui/react';
import { Copy, Sparkles } from 'lucide-react';
import { rewriteEmailBlurb } from '../services/openai';
import { useAppContext } from '../context/AppContext';

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
  const { aiEditorInstructions } = useAppContext();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleRewrite = async () => {
    setLoading(true);
    setError(null);
    setResult('');
    setCopied(false);
    try {
      const rewritten = await rewriteEmailBlurb(input);
      setResult(rewritten);
    } catch (err: any) {
      setError(err.message || 'Failed to rewrite email.');
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
    setInput('');
    setResult('');
    setError(null);
    setCopied(false);
    setLoading(false);
    onClose();
  };

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
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>{aiEditorInstructions}</Text>
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