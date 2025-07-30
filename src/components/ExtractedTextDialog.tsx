import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  Textarea,
  VStack,
  HStack,
  useToast,
  Box,
  useColorModeValue,
  Icon,
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
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textAreaBg = useColorModeValue('gray.50', 'gray.700');

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      toast({
        title: 'Text copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Failed to copy text',
        description: 'Could not copy text to clipboard',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} maxH="80vh">
        <ModalHeader borderBottom="1px solid" borderColor={borderColor}>
          <HStack spacing={3}>
            <Icon as={FileText} color="blue.500" />
            <VStack align="start" spacing={0}>
              <Text fontSize="lg" fontWeight="bold">
                Extracted Text
              </Text>
              <Text fontSize="sm" color="gray.500" fontWeight="normal">
                {fileName}
              </Text>
            </VStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={4}>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between" align="center">
              <Text fontSize="sm" color="gray.600">
                {extractedText.length} characters extracted
              </Text>
              <Button
                size="sm"
                leftIcon={copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                colorScheme={copied ? "green" : "blue"}
                onClick={handleCopyAll}
                variant={copied ? "solid" : "outline"}
              >
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
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
        </ModalBody>

        <ModalFooter borderTop="1px solid" borderColor={borderColor}>
          <Button onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 