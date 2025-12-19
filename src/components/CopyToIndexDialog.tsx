import React, { useState } from 'react';
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
  Flex,
  Badge,
} from '@chakra-ui/react';
import { getAllIndexKeys, getIndexInfo, extractIndexPrefix, setIndexPrefix } from '../utils/indexPrefix';
import type { FileItem } from '../types';

interface CopyToIndexDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetIndex: string) => Promise<void>;
  files: FileItem[];
  currentDirectory: string;
}

export const CopyToIndexDialog: React.FC<CopyToIndexDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  files,
  currentDirectory,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const descColor = useColorModeValue('gray.600', 'gray.400');

  const indexKeys = getAllIndexKeys();
  
  // Get current index prefixes from files
  const currentIndexes = new Set(files.map(f => extractIndexPrefix(f.name)).filter(Boolean) as string[]);

  const handleConfirm = async () => {
    if (!selectedIndex) return;
    
    setIsProcessing(true);
    try {
      await onConfirm(selectedIndex);
      onClose();
    } catch (error) {
      console.error('Error copying files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor}>
        <ModalHeader>Copy Files to Index</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={4} fontSize="sm" color={descColor}>
            Copy {files.length} file{files.length !== 1 ? 's' : ''} to a new index prefix
          </Text>
          <VStack spacing={2} align="stretch" maxH="400px" overflowY="auto">
            {indexKeys.map((indexKey) => {
              const info = getIndexInfo(indexKey);
              const isSelected = selectedIndex === indexKey;
              const isCurrentIndex = currentIndexes.has(indexKey);
              
              return (
                <Box
                  key={indexKey}
                  p={3}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={isSelected ? 'blue.400' : borderColor}
                  bg={isSelected ? selectedBg : bgColor}
                  cursor="pointer"
                  onClick={() => setSelectedIndex(indexKey)}
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                  opacity={isCurrentIndex ? 0.6 : 1}
                >
                  <Flex align="center" justify="space-between">
                    <Flex direction="column">
                      <Flex align="center" gap={2}>
                        <Text fontWeight="semibold" fontSize="md" color={textColor}>
                          {indexKey}
                        </Text>
                        {isSelected && (
                          <Badge colorScheme="blue" size="sm">
                            Selected
                          </Badge>
                        )}
                        {isCurrentIndex && (
                          <Badge colorScheme="gray" size="sm">
                            Current
                          </Badge>
                        )}
                      </Flex>
                      {info.description && (
                        <Text fontSize="sm" color={descColor} mt={1}>
                          {info.description}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </Box>
              );
            })}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleConfirm} 
            isDisabled={!selectedIndex || isProcessing}
            isLoading={isProcessing}
          >
            Copy Files
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};





