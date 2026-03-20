import React, { useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, VStack, Box, Text, Flex, Badge, Dialog, Portal } from '@chakra-ui/react';
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
  
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    selectedBg,
    textColor,
    secondaryTextColor: descColor,
  } = useDialogChrome();
  const hoverBg = useColorModeValue('gray.50', 'df.rowHover');

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
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor}>
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              Copy Files to Index
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <Text mb={4} fontSize="sm" color={descColor}>
                Copy {files.length} file{files.length !== 1 ? 's' : ''} to a new index prefix
              </Text>
              <VStack gap={2} align="stretch" maxH="400px" overflowY="auto">
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
                              <Badge colorPalette="blue" size="sm">
                                Selected
                              </Badge>
                            )}
                            {isCurrentIndex && (
                              <Badge colorPalette="gray" size="sm">
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
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button 
                colorPalette="blue" 
                onClick={handleConfirm} 
                disabled={!selectedIndex || isProcessing}
              >
                Copy Files
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};








