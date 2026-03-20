import React, { useState, useMemo, memo } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, VStack, Box, Text, Flex, Grid, Badge, Dialog, Portal } from '@chakra-ui/react';
import { getAllIndexKeys, getIndexInfo, WORKPAPER_DESCRIPTIONS } from '../utils/indexPrefix';
import type { FileItem } from '../types';

interface IndexPrefixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (indexKey: string | null, isCopy?: boolean) => void;
  currentPrefix?: string | null;
  title?: string;
  files?: FileItem[];
  allowCopy?: boolean;
}

const IndexPrefixDialogInner: React.FC<IndexPrefixDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentPrefix,
  title = 'Select Index Prefix',
  files = [],
  allowCopy = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<string | null>(currentPrefix || null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    selectedBg,
    textColor,
    secondaryTextColor: descColor,
  } = useDialogChrome();
  const hoverBg = useColorModeValue('gray.50', 'df.rowHover');
  const infoBg = useColorModeValue('blue.50', 'blue.900');
  const infoText = useColorModeValue('blue.800', 'blue.100');
  const infoBorder = useColorModeValue('blue.200', 'blue.700');

  const indexKeys = useMemo(() => getAllIndexKeys(), []);

  const handleConfirm = (forceCopyMode?: boolean) => {
    // If removing prefix (selectedIndex is null), never use copy mode
    const copyMode = selectedIndex === null ? false : (forceCopyMode !== undefined ? forceCopyMode : isCopyMode);
    onSelect(selectedIndex, copyMode);
    onClose();
  };

  // Reset copy mode when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsCopyMode(false);
      setSelectedIndex(currentPrefix || null);
    }
  }, [isOpen, currentPrefix]);

  return (
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderRadius="lg" maxW="520px">
            <Dialog.Header fontSize="lg" pb={2} bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              {title}
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body pt={0}>
              {/* File indicator */}
              {files.length > 0 && (
                <Box
                  mb={3}
                  p={2}
                  bg={infoBg}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={infoBorder}
                >
                  <Flex align="center" gap={2}>
                    <Badge colorPalette="blue" fontSize="xs">
                      {files.length} {files.length === 1 ? 'file' : 'files'} selected
                    </Badge>
                    <Text fontSize="sm" color={infoText} fontWeight="medium">
                      {files.length === 1 
                        ? files[0].name 
                        : `${files[0].name}${files.length > 1 ? ` and ${files.length - 1} more` : ''}`
                      }
                    </Text>
                  </Flex>
                </Box>
              )}
              <VStack gap={1} align="stretch" maxH="360px" overflowY="auto">
                <Grid templateColumns="repeat(2, 1fr)" gap={1} width="100%">
                  {indexKeys.map((indexKey, index) => {
                    const info = getIndexInfo(indexKey);
                    const isSelected = selectedIndex === indexKey;
                    
                    // Calculate row and column for row-first layout
                    const row = Math.floor(index / 2);
                    const col = index % 2;
                    
                    return (
                      <Box
                        key={indexKey}
                        p={2}
                        borderRadius={0}
                        borderWidth="1px"
                        borderColor={isSelected ? 'blue.400' : borderColor}
                        bg={isSelected ? selectedBg : bgColor}
                        cursor="pointer"
                        onClick={() => setSelectedIndex(indexKey)}
                        _hover={{ bg: hoverBg }}
                        transition="all 0.2s"
                        gridColumn={col + 1}
                        gridRow={row + 1}
                      >
                        <Flex align="center" gap={2}>
                          <Text fontWeight="semibold" fontSize="sm" color={textColor}>
                            {indexKey}
                          </Text>
                          {info.description && (
                            <Text fontSize="sm" color={descColor}>
                              - {info.description}
                            </Text>
                          )}
                        </Flex>
                      </Box>
                    );
                  })}
                </Grid>
                {/* Option to remove prefix */}
                <Box
                  p={2}
                  borderRadius={0}
                  borderWidth="1px"
                  borderColor={selectedIndex === null ? 'blue.400' : borderColor}
                  bg={selectedIndex === null ? selectedBg : bgColor}
                  cursor="pointer"
                  onClick={() => setSelectedIndex(null)}
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                  mt={1}
                >
                  <Flex align="center" justify="space-between">
                    <Text fontWeight="semibold" fontSize="sm" color={textColor}>
                      Remove Prefix
                    </Text>
                  </Flex>
                </Box>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer pt={2}>
              <Button variant="ghost" mr={3} onClick={onClose} size="sm">
                Cancel
              </Button>
              {allowCopy && selectedIndex && (
                <Button 
                  colorPalette="green" 
                  onClick={() => {
                    setIsCopyMode(true);
                    handleConfirm(true);
                  }}
                  disabled={selectedIndex === null} 
                  size="sm"
                  mr={3}
                >
                  Add a Copy
                </Button>
              )}
              <Button 
                colorPalette="blue" 
                onClick={() => handleConfirm(false)} 
                disabled={selectedIndex === null && !currentPrefix} 
                size="sm"
              >
                {selectedIndex === null ? 'Remove Prefix' : currentPrefix ? 'Change Prefix' : 'Change Prefix'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
};

export const IndexPrefixDialog = memo(IndexPrefixDialogInner);

