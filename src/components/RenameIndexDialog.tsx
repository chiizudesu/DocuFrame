import React, { useState, useMemo, memo } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, VStack, Box, Text, Flex, Badge, HStack, Dialog, Portal } from '@chakra-ui/react';
import { getAllIndexKeys, getIndexInfo, extractIndexPrefix, setIndexPrefix, removeIndexPrefix } from '../utils/indexPrefix';
import type { FileItem } from '../types';

interface RenameIndexDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sourceIndex: string, targetIndex: string) => Promise<void>;
  files: FileItem[];
}

const RenameIndexDialogInner: React.FC<RenameIndexDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  files,
}) => {
  const [sourceIndex, setSourceIndex] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    selectedBg,
    textColor,
    secondaryTextColor: descColor,
  } = useDialogChrome();
  const hoverBg = useColorModeValue('gray.50', 'df.rowHover');

  const indexKeys = useMemo(() => getAllIndexKeys(), []);
  
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
    <Dialog.Root open={isOpen} size='lg' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor}>
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              Rename Files Between Indexes
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <Text mb={4} fontSize="sm" color={descColor}>
                Change index prefix for {files.length} file{files.length !== 1 ? 's' : ''}
              </Text>
              
              <VStack gap={4} align="stretch">
                {/* Source Index Selection */}
                <Box>
                  <Text fontWeight="semibold" mb={2} fontSize="sm" color={textColor}>
                    From Index:
                  </Text>
                  <VStack gap={2} align="stretch" maxH="200px" overflowY="auto">
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
                                  <Badge colorPalette="blue" size="sm">
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
                  <VStack gap={2} align="stretch" maxH="200px" overflowY="auto">
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
                                  <Badge colorPalette="blue" size="sm">
                                    Selected
                                  </Badge>
                                )}
                                {isSourceIndex && (
                                  <Badge colorPalette="gray" size="sm">
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
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button 
                colorPalette="blue" 
                onClick={handleConfirm} 
                disabled={!sourceIndex || !targetIndex || sourceIndex === targetIndex || isProcessing}
              >
                Rename Files
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export const RenameIndexDialog = memo(RenameIndexDialogInner);






