import React, { useState, useCallback, memo, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  VStack,
  Box,
  Text,
  Textarea,
  HStack,
  Spinner,
  Alert,
  IconButton,
  Dialog,
  Portal,
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

const SmartRenameDialogInner: React.FC<SmartRenameDialogProps> = ({
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
  
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const inputTextColor = useColorModeValue('gray.800', 'gray.100');
  const currentFileBg = useColorModeValue('gray.50', 'gray.700');
  const currentFileTextColor = useColorModeValue('gray.600', 'gray.400');
  const placeholderColor = useColorModeValue('gray.400', 'gray.500');

  // Generate suggestion when dialog opens
  useEffect(() => {
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
      (f) => f.path !== file.path && f.name.toLowerCase() === trimmedName.toLowerCase()
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
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor}>
            <Dialog.Header>Smart Rename</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={4} align="stretch">
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
                      bg="white"
                      _dark={{ bg: inputBg }}
                      color={inputTextColor}
                      borderColor={borderColor}
                      _placeholder={{ color: placeholderColor }}
                    />
                  )}
                </Box>

                {error && (
                  <Alert.Root status="error" borderRadius="md">
                    <Alert.Indicator />
                    <Text fontSize="sm">{error}</Text>
                  </Alert.Root>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <IconButton
                aria-label="Regenerate suggestion"
                variant="ghost"
                mr={3}
                onClick={generateSuggestion}
                disabled={isGenerating}><RefreshCw size={16} /></IconButton>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button 
                colorPalette="blue" 
                onClick={handleConfirm} 
                disabled={!suggestedName.trim() || isGenerating}
              >
                Confirm Rename
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

/** Skip re-renders when FileGrid updates unrelated state but `sortedFiles` reference is unchanged. */
export const SmartRenameDialog = memo(
  SmartRenameDialogInner,
  (prev, next) =>
    prev.isOpen === next.isOpen &&
    prev.file.path === next.file.path &&
    prev.existingFiles === next.existingFiles,
);

