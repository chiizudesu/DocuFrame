import React from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, Text, VStack, Box, Flex, Icon, Badge, Dialog, Portal } from '@chakra-ui/react';
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
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg } = useDialogChrome();
  const successColor = useColorModeValue('green.500', 'green.400');
  const summaryBoxBg = useColorModeValue('green.50', 'green.900');
  const fileRowBg = useColorModeValue('gray.50', 'gray.700');
  const emptyStateBg = useColorModeValue('yellow.50', 'yellow.900');
  const emptyStateTextColor = useColorModeValue('yellow.700', 'yellow.300');

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

  const SummaryTypeIcon = getIcon();

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
            <Dialog.Header>
              <Flex align="center">
                <Icon color={successColor} mr={3} boxSize={6} asChild>
                  <CheckCircle />
                </Icon>
                {getTitle()}
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                {/* Summary */}
                <Box
                  p={4}
                  borderRadius="md"
                  border="1px"
                  borderColor={borderColor}
                  bg={summaryBoxBg}
                >
                  <Flex align="center" mb={2}>
                    <Icon color={getColor()} mr={2} boxSize={5} asChild>
                      <SummaryTypeIcon />
                    </Icon>
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
                      <VStack align="stretch" gap={2}>
                        {extractedFiles.map((file, index) => (
                          <Flex
                            key={index}
                            align="center"
                            p={2}
                            borderRadius="md"
                            bg={fileRowBg}
                          >
                            <Icon mr={2} color="blue.400" boxSize={4} asChild>
                              <FileText />
                            </Icon>
                            <Text fontSize="sm" flex="1">
                              {file}
                            </Text>
                            <Badge colorPalette="green" size="sm">
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
                    bg={emptyStateBg}
                  >
                    <Text color={emptyStateTextColor}>
                      No files were extracted. The {type.toUpperCase()} file{sourceFiles.length !== 1 ? 's' : ''} may be empty or contain no {type === 'zip' ? 'files' : 'attachments'}.
                    </Text>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="blue" onClick={onClose}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 