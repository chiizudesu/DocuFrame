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
  HStack,
} from '@chakra-ui/react';
import { getAllIndexKeys, getIndexInfo, extractIndexPrefix, setIndexPrefix, removeIndexPrefix } from '../utils/indexPrefix';
import type { FileItem } from '../types';

interface RenameIndexDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sourceIndex: string, targetIndex: string) => Promise<void>;
  files: FileItem[];
}

export const RenameIndexDialog: React.FC<RenameIndexDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  files,
}) => {
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const descColor = useColorModeValue('gray.600', 'gray.400');

  const indexKeys = getAllIndexKeys();
  
  // Get unique source indexes from selected files
  const sourceIndexes = Array.from(new Set(files.map(f => extractIndexPrefix(f.name)).filter(Boolean) as string[]));
  
  // Auto-select first source index if only one
  React.useEffect(() => {
    if (isOpen && sourceIndexes.length === 1 && !sourceIndex) {
      setSourceIndex(sourceIndexes[0]);
    }
  }, [isOpen, sourceIndexes, sourceIndex]);

  const handleConfirm = async () => {
    if (!sourceIndex || !targetIndex) return;
    
    setIsProcessing(true);
    try {
      await onConfirm(sourceIndex, targetIndex);
      onClose();
      setSourceIndex(null);
      setTargetIndex(null);
    } catch (error) {
      console.error('Error renaming files:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor}>
        <ModalHeader>Rename Files Between Indexes</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={4} fontSize="sm" color={descColor}>
            Change index prefix for {files.length} file{files.length !== 1 ? 's' : ''}
          </Text>
          
          <VStack spacing={4} align="stretch">
            {/* Source Index Selection */}
            <Box>
              <Text fontWeight="semibold" mb={2} fontSize="sm" color={textColor}>
                From Index:
              </Text>
              <VStack spacing={2} align="stretch" maxH="200px" overflowY="auto">
                {sourceIndexes.map((indexKey) => {
                  const info = getIndexInfo(indexKey);
                  const isSelected = sourceIndex === indexKey;
                  
                  return (
                    <Box
                      key={indexKey}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={isSelected ? 'blue.400' : borderColor}
                      bg={isSelected ? selectedBg : bgColor}
                      cursor="pointer"
                      onClick={() => setSourceIndex(indexKey)}
                      _hover={{ bg: hoverBg }}
                      transition="all 0.2s"
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
            </Box>

            {/* Target Index Selection */}
            <Box>
              <Text fontWeight="semibold" mb={2} fontSize="sm" color={textColor}>
                To Index:
              </Text>
              <VStack spacing={2} align="stretch" maxH="200px" overflowY="auto">
                {indexKeys.map((indexKey) => {
                  const info = getIndexInfo(indexKey);
                  const isSelected = targetIndex === indexKey;
                  const isSourceIndex = sourceIndex === indexKey;
                  
                  return (
                    <Box
                      key={indexKey}
                      p={3}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={isSelected ? 'blue.400' : borderColor}
                      bg={isSelected ? selectedBg : bgColor}
                      cursor="pointer"
                      onClick={() => setTargetIndex(indexKey)}
                      _hover={{ bg: hoverBg }}
                      transition="all 0.2s"
                      opacity={isSourceIndex ? 0.5 : 1}
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
                            {isSourceIndex && (
                              <Badge colorScheme="gray" size="sm">
                                Same as source
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
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={handleConfirm} 
            isDisabled={!sourceIndex || !targetIndex || sourceIndex === targetIndex || isProcessing}
            isLoading={isProcessing}
          >
            Rename Files
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

