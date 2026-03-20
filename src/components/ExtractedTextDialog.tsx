import React, { useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from "@/components/ui/toaster"
import {
  Button,
  Text,
  Textarea,
  VStack,
  HStack,
  Box,
  Icon,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Copy, FileText, CheckCircle } from 'lucide-react';

interface ExtractedTextDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  extractedText: string;
}

export const ExtractedTextDialog: React.FC<ExtractedTextDialogProps> = ({
  isOpen,
  onClose,
  fileName,
  extractedText,
}) => {
  const [copied, setCopied] = useState(false);
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();
  const textAreaBg = useColorModeValue('gray.50', 'gray.700');

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      showToast({
        title: 'Text copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast({
        title: 'Failed to copy text',
        description: 'Could not copy text to clipboard',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Dialog.Root open={isOpen} size='xl' scrollBehavior="inside" placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} maxH="80vh">
            <Dialog.Header borderBottom="1px solid" borderColor={borderColor}>
              <HStack gap={3}>
                <Icon color="blue.500" asChild><FileText /></Icon>
                <VStack align="start" gap={0}>
                  <Text fontSize="lg" fontWeight="bold">
                    Extracted Text
                  </Text>
                  <Text fontSize="sm" color="gray.500" fontWeight="normal">
                    {fileName}
                  </Text>
                </VStack>
              </HStack>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body py={4}>
              <VStack gap={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <Text fontSize="sm" color="gray.600">
                    {extractedText.length} characters extracted
                  </Text>
                  <Button
                    size="sm"
                    colorPalette={copied ? "green" : "blue"}
                    onClick={handleCopyAll}
                    variant={copied ? "solid" : "outline"}>{copied ? <CheckCircle size={16} /> : <Copy size={16} />}{copied ? 'Copied!' : 'Copy All'}</Button>
                </HStack>
                
                <Box>
                  <Textarea
                    value={extractedText}
                    readOnly
                    bg={textAreaBg}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="md"
                    minH="400px"
                    maxH="500px"
                    resize="vertical"
                    fontSize="sm"
                    fontFamily="monospace"
                    whiteSpace="pre-wrap"
                    _focus={{
                      borderColor: "blue.500",
                      boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
                    }}
                    placeholder="No text extracted from PDF"
                  />
                </Box>
                
                {extractedText.length === 0 && (
                  <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                    No text could be extracted from this PDF file.
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer borderTop="1px solid" borderColor={borderColor}>
              <Button onClick={onClose}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 