import React, { useState, useMemo } from 'react';
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
  Grid,
  Badge,
} from '@chakra-ui/react';
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

export const IndexPrefixDialog: React.FC<IndexPrefixDialogProps> = ({
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
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const descColor = useColorModeValue('gray.600', 'gray.400');
  const infoBg = useColorModeValue('blue.50', 'blue.900');
  const infoText = useColorModeValue('blue.800', 'blue.100');
  const infoBorder = useColorModeValue('blue.200', 'blue.700');

  const indexKeys = useMemo(() => getAllIndexKeys(), []);

  const handleConfirm = (forceCopyMode?: boolean) => {
    // If removing prefix (selectedIndex is null), never use copy mode
    const copyMode = selectedIndex === null ? false : (forceCopyMode !== undefined ? forceCopyMode : isCopyMode);
    console.log('[IndexPrefixDialog] handleConfirm called', { 
      selectedIndex, 
      currentPrefix, 
      isCopyMode,
      forceCopyMode,
      finalCopyMode: copyMode,
      filesCount: files.length,
      fileNames: files.map(f => f.name)
    });
    // Allow null to remove prefix, or any selected index
    console.log('[IndexPrefixDialog] Calling onSelect with:', { indexKey: selectedIndex, isCopy: copyMode });
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
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} borderRadius="lg" maxW="520px">
        <ModalHeader fontSize="lg" pb={2}>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pt={0}>
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
                <Badge colorScheme="blue" fontSize="xs">
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
          <VStack spacing={1} align="stretch" maxH="360px" overflowY="auto">
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
        </ModalBody>
        <ModalFooter pt={2}>
          <Button variant="ghost" mr={3} onClick={onClose} size="sm">
            Cancel
          </Button>
          {allowCopy && selectedIndex && (
            <Button 
              colorScheme="green" 
              onClick={() => {
                console.log('[IndexPrefixDialog] Add a Copy button clicked', { 
                  selectedIndex, 
                  filesCount: files.length,
                  fileNames: files.map(f => f.name),
                  willSetCopyMode: true
                });
                setIsCopyMode(true);
                // Pass copy mode directly to avoid state update timing issues
                console.log('[IndexPrefixDialog] Executing copy operation with forceCopyMode=true');
                handleConfirm(true);
              }}
              isDisabled={selectedIndex === null} 
              size="sm"
              mr={3}
            >
              Add a Copy
            </Button>
          )}
          <Button 
            colorScheme="blue" 
            onClick={handleConfirm} 
            isDisabled={selectedIndex === null && !currentPrefix} 
            size="sm"
          >
            {selectedIndex === null ? 'Remove Prefix' : currentPrefix ? 'Change Prefix' : 'Change Prefix'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

