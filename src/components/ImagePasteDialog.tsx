import React, { useState, useEffect, useRef } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  VStack,
  Text,
  Box,
  Flex,
  Input,
  Alert,
  HStack,
  Badge,
  Separator,
  Field,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Image as ImageIcon, Save, Copy } from 'lucide-react';

interface ImagePasteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  onImageSaved?: (filename: string) => void;
}

const COMMON_SCREENSHOTS = [
  { key: 'C', label: 'Bank Feeds Activated' },
  { key: 'F', label: 'Depreciation Run Snip' },
  { key: 'G', label: 'ACC Snip' },
];

export const ImagePasteDialog: React.FC<ImagePasteDialogProps> = ({ 
  isOpen, 
  onClose, 
  currentDirectory,
  onImageSaved 
}) => {
  const [filename, setFilename] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();
  const suggestionBg = useColorModeValue('gray.50', 'gray.700');
  const suggestionHoverBg = useColorModeValue('gray.100', 'gray.600');

  // Check for clipboard image when dialog opens
  useEffect(() => {
    if (isOpen) {
      checkClipboardForImage();
      setFilename('');
      setError(null);
      setSuccess(null);
      
      // Focus the input field after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const checkClipboardForImage = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        if (item.types.includes('image/png')) {
          const blob = await item.getType('image/png');
          const reader = new FileReader();
          reader.onload = (e) => {
            setImageData(e.target?.result as string);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      
      setError('No image found in clipboard. Please copy an image first.');
    } catch (err) {
      setError('Failed to read clipboard. Please ensure you have copied an image.');
      console.error('Clipboard read error:', err);
    }
  };

  const handleSuggestionClick = (suggestion: typeof COMMON_SCREENSHOTS[0]) => {
    const suggestedFilename = `${suggestion.key} - ${suggestion.label}.png`;
    setFilename(suggestedFilename);
    inputRef.current?.focus();
  };

  const handleSaveImage = async () => {
    if (!filename.trim()) {
      setError('Please enter a filename');
      return;
    }

    if (!imageData) {
      setError('No image data available');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Ensure filename has .png extension
      let finalFilename = filename.trim();
      if (!finalFilename.toLowerCase().endsWith('.png')) {
        finalFilename += '.png';
      }

      // Convert data URL to base64
      const base64Data = imageData.split(',')[1];
      
      // Save using Electron API
      const result = await (window as any).electronAPI.saveImageFromClipboard(
        currentDirectory,
        finalFilename,
        base64Data
      );

      if (result.success) {
        // Close dialog immediately
        handleClose();
        
        // Notify parent component for success handling
        onImageSaved?.(finalFilename);
      } else {
        setError(result.error || 'Failed to save image');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save image: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFilename('');
    setImageData(null);
    setError(null);
    setSuccess(null);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      e.preventDefault();
      handleSaveImage();
    }
  };

  return (
    <Dialog.Root open={isOpen} size='lg' placement='center' onOpenChange={e => {
      if (!e.open) {
        handleClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            color={useColorModeValue('gray.900', 'white')}
            borderRadius="lg"
            boxShadow="lg"
            maxW="600px"
            w="95%">
            <Dialog.Header fontSize="lg" fontWeight="bold" textAlign="center" pb={2}>
              <Flex align="center" justify="center" gap={2}>
                <ImageIcon size={22} />
                Save Clipboard Image
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body p={6}>
              <VStack gap={4} align="stretch">
                
                {/* Image Preview */}
                {imageData && (
                  <Box
                    border="2px dashed"
                    borderColor={borderColor}
                    borderRadius="md"
                    p={4}
                    textAlign="center"
                    bg={suggestionBg}
                  >
                    <img 
                      src={imageData} 
                      alt="Clipboard preview" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '200px', 
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }} 
                    />
                    <Text fontSize="xs" color="gray.500" mt={2}>
                      Image preview from clipboard
                    </Text>
                  </Box>
                )}

                {/* Filename Input */}
                <Field.Root>
                  <Field.Label fontSize="sm">Filename</Field.Label>
                  <Input
                    ref={inputRef}
                    placeholder="Enter filename (e.g., Screenshot_2024-01-01.png)"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    size="sm"
                    onKeyDown={handleKeyDown}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    .png extension will be added automatically if not provided
                  </Text>
                </Field.Root>

                <Separator />

                {/* Common Screenshot Suggestions */}
                <Box>
                  <Text fontSize="sm" fontWeight="semibold" mb={3}>
                    Common Screenshots
                  </Text>
                  <VStack gap={2} align="stretch">
                    {COMMON_SCREENSHOTS.map((suggestion) => (
                      <Box
                        key={suggestion.key}
                        p={3}
                        bg={suggestionBg}
                        borderRadius="md"
                        border="1px solid"
                        borderColor={borderColor}
                        cursor="pointer"
                        _hover={{ bg: suggestionHoverBg }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        transition="background 0.2s"
                      >
                        <HStack justify="space-between">
                          <HStack>
                            <Badge colorPalette="blue" fontSize="xs">
                              {suggestion.key}
                            </Badge>
                            <Text fontSize="sm">{suggestion.label}</Text>
                          </HStack>
                          <Copy size={14} />
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                  <Text fontSize="xs" color="gray.500" mt={2}>
                    Click any suggestion to use as filename template with timestamp
                  </Text>
                </Box>

                {/* Action Buttons */}
                <HStack gap={3}>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    size="sm"
                    flex="1"
                  >
                    Cancel
                  </Button>
                  <Button
                    colorPalette="blue"
                    onClick={handleSaveImage}
                    disabled={isLoading || !filename.trim() || !imageData}
                    size="sm"
                    flex="2"><Save size={16} />Save Image
                                  </Button>
                </HStack>

                {/* Status Messages */}
                {error && (
                  <Alert.Root status="error" borderRadius="md" fontSize="sm">
                    <Alert.Indicator />
                    {error}
                  </Alert.Root>
                )}

                {success && (
                  <Alert.Root status="success" borderRadius="md" fontSize="sm">
                    <Alert.Indicator />
                    {success}
                  </Alert.Root>
                )}

              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};
