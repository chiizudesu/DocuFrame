import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  Box,
  Flex,
  Icon,
  useColorModeValue,
  Badge,
} from '@chakra-ui/react';
import { CheckCircle, FileText, Archive, Mail } from 'lucide-react';

interface ExtractionResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'zip' | 'eml';
  extractedFiles: string[];
  sourceFiles?: string[];
}

export const ExtractionResultDialog: React.FC<ExtractionResultDialogProps> = ({
  isOpen,
  onClose,
  type,
  extractedFiles,
  sourceFiles = []
}) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const successColor = useColorModeValue('green.500', 'green.400');
  
  const getIcon = () => {
    switch (type) {
      case 'zip':
        return Archive;
      case 'eml':
        return Mail;
      default:
        return FileText;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'zip':
        return 'ZIP Extraction Complete';
      case 'eml':
        return 'EML Extraction Complete';
      default:
        return 'Extraction Complete';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'zip':
        return 'orange.400';
      case 'eml':
        return 'cyan.400';
      default:
        return 'blue.400';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader>
          <Flex align="center">
            <Icon as={CheckCircle} color={successColor} mr={3} boxSize={6} />
            {getTitle()}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {/* Summary */}
            <Box
              p={4}
              borderRadius="md"
              border="1px"
              borderColor={borderColor}
              bg={useColorModeValue('green.50', 'green.900')}
            >
              <Flex align="center" mb={2}>
                <Icon as={getIcon()} color={getColor()} mr={2} boxSize={5} />
                <Text fontWeight="bold">
                  Successfully extracted {extractedFiles.length} file{extractedFiles.length !== 1 ? 's' : ''}
                </Text>
              </Flex>
              {sourceFiles.length > 0 && (
                <Text fontSize="sm" color="gray.600">
                  From {sourceFiles.length} {type.toUpperCase()} file{sourceFiles.length !== 1 ? 's' : ''}
                </Text>
              )}
            </Box>

            {/* Extracted Files List */}
            {extractedFiles.length > 0 && (
              <Box>
                <Text fontWeight="semibold" mb={3}>
                  Extracted Files:
                </Text>
                <Box
                  maxH="300px"
                  overflowY="auto"
                  border="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                  p={3}
                >
                  <VStack align="stretch" spacing={2}>
                    {extractedFiles.map((file, index) => (
                      <Flex
                        key={index}
                        align="center"
                        p={2}
                        borderRadius="md"
                        bg={useColorModeValue('gray.50', 'gray.700')}
                      >
                        <Icon as={FileText} mr={2} color="blue.400" boxSize={4} />
                        <Text fontSize="sm" flex="1">
                          {file}
                        </Text>
                        <Badge colorScheme="green" size="sm">
                          New
                        </Badge>
                      </Flex>
                    ))}
                  </VStack>
                </Box>
              </Box>
            )}

            {extractedFiles.length === 0 && (
              <Box
                p={4}
                borderRadius="md"
                border="1px"
                borderColor={borderColor}
                bg={useColorModeValue('yellow.50', 'yellow.900')}
              >
                <Text color={useColorModeValue('yellow.700', 'yellow.300')}>
                  No files were extracted. The {type.toUpperCase()} file{sourceFiles.length !== 1 ? 's' : ''} may be empty or contain no {type === 'zip' ? 'files' : 'attachments'}.
                </Text>
              </Box>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 