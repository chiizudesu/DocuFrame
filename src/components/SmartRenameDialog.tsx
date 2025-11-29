import React, { useState, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  Box,
  Text,
  useColorModeValue,
  Textarea,
  HStack,
  Spinner,
  Alert,
  AlertIcon,
  IconButton,
} from '@chakra-ui/react';
import { RefreshCw } from 'lucide-react';
import { rewriteEmailBlurbStream } from '../services/claude';
import type { FileItem } from '../types';

interface SmartRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newName: string) => Promise<void>;
  file: FileItem;
  existingFiles?: FileItem[]; // List of existing files to check for duplicates
}

export const SmartRenameDialog: React.FC<SmartRenameDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  file,
  existingFiles = [],
}) => {
  const [suggestedName, setSuggestedName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const inputBg = useColorModeValue('gray.50', 'gray.700');
  const inputTextColor = useColorModeValue('gray.800', 'gray.100');
  const currentFileBg = useColorModeValue('gray.50', 'gray.700');
  const currentFileTextColor = useColorModeValue('gray.600', 'gray.400');
  const placeholderColor = useColorModeValue('gray.400', 'gray.500');

  // Generate suggestion when dialog opens
  React.useEffect(() => {
    if (isOpen && file) {
      generateSuggestion();
    } else {
      setSuggestedName('');
      setStreamingText('');
      setError(null);
    }
  }, [isOpen, file]);

  const generateSuggestion = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setStreamingText('');
    setSuggestedName('');

    try {
      const prompt = `You are a filename optimization expert. Analyze this filename and suggest a better, clearer, more professional filename.

Current filename: "${file.name}"

CRITICAL REQUIREMENTS:
1. Keep the exact same file extension (do not change it)
2. Remove underscores (_) and replace them with spaces or proper capitalization
3. Remove hyphens (-) unless they're part of a standard format (like dates)
4. Use proper capitalization (Title Case or Sentence case as appropriate)
5. Make it more descriptive and professional
6. Maintain any important prefixes or patterns (like index prefixes: "A5 - ", "C - ", etc.)
7. Remove redundant words or abbreviations that can be expanded
8. Ensure the filename is clean and readable

IMPORTANT: Only return the suggested filename itself, nothing else. No explanations, no quotes, just the filename with extension.`;

      let accumulatedText = '';
      let isStreamComplete = false;
      
      await rewriteEmailBlurbStream(
        file.name,
        'haiku', // Use haiku for faster response
        prompt,
        (chunk: string) => {
          // Only process if we have a new chunk and stream hasn't completed
          if (!chunk || chunk.length === 0 || isStreamComplete) return;
          
          // Append only new chunk to accumulated text
          accumulatedText += chunk;
          const trimmedText = accumulatedText.trim();
          
          // Update state with accumulated text
          setStreamingText(accumulatedText);
          setSuggestedName(trimmedText);
        }
      );
      
      // Mark stream as complete and set final state once
      isStreamComplete = true;
      const finalTrimmed = accumulatedText.trim();
      if (finalTrimmed) {
        setSuggestedName(finalTrimmed);
        setStreamingText(accumulatedText);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate suggestion';
      setError(errorMessage);
      console.error('Error generating rename suggestion:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [file]);

  const handleConfirm = async () => {
    if (!suggestedName.trim()) return;
    
    const trimmedName = suggestedName.trim();
    
    // Check if the new name is the same as the current name (case-insensitive)
    // Allow renaming if only case changes (e.g., "file.pdf" -> "File.pdf")
    const isSameNameCaseInsensitive = trimmedName.toLowerCase() === file.name.toLowerCase();
    const isOnlyCaseChange = isSameNameCaseInsensitive && trimmedName !== file.name;
    
    if (isSameNameCaseInsensitive && !isOnlyCaseChange) {
      setError('The suggested name is the same as the current filename.');
      return;
    }
    
    // Check for duplicate filenames (excluding the current file being renamed)
    // Use case-insensitive comparison but exclude the current file by path
    const duplicateExists = existingFiles.some(
      f => f.path !== file.path && f.name.toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (duplicateExists) {
      setError(`A file named "${trimmedName}" already exists in this directory. Please choose a different name.`);
      return;
    }
    
    try {
      await onConfirm(trimmedName);
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename file';
      setError(errorMessage);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor}>
        <ModalHeader>Smart Rename</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color={textColor}>
                Current filename:
              </Text>
              <Text fontSize="sm" color={currentFileTextColor} fontFamily="mono" p={2} bg={currentFileBg} borderRadius="md">
                {file.name}
              </Text>
            </Box>

            <Box>
              <Text fontSize="sm" fontWeight="medium" mb={2} color={textColor}>
                Suggested filename:
              </Text>
              {isGenerating ? (
                <Box p={4} textAlign="center">
                  <Spinner size="md" />
                  <Text mt={2} fontSize="sm" color="gray.500">
                    Analyzing filename...
                  </Text>
                  {streamingText && (
                    <Text mt={2} fontSize="sm" fontFamily="mono" color={inputTextColor}>
                      {streamingText}
                    </Text>
                  )}
                </Box>
              ) : (
                <Textarea
                  value={suggestedName}
                  onChange={(e) => setSuggestedName(e.target.value)}
                  placeholder="AI suggestion will appear here..."
                  fontFamily="mono"
                  fontSize="sm"
                  minH="80px"
                  bg={inputBg}
                  color={inputTextColor}
                  borderColor={borderColor}
                  _placeholder={{ color: placeholderColor }}
                />
              )}
            </Box>

            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">{error}</Text>
              </Alert>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <IconButton
            aria-label="Regenerate suggestion"
            icon={<RefreshCw size={16} />}
            variant="ghost"
            mr={3}
            onClick={generateSuggestion}
            isDisabled={isGenerating}
            isLoading={isGenerating}
          />
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleConfirm} 
            isDisabled={!suggestedName.trim() || isGenerating}
          >
            Confirm Rename
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

