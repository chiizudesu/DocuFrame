import React, { useEffect, useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from "@/components/ui/toaster"
import {
  Button,
  Text,
  Box,
  VStack,
  HStack,
  Checkbox,
  Icon,
  Code,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { Info, CheckCircle } from 'lucide-react';

export interface FileProperties {
  name: string;
  extension: string;
  size: number;
  modified: string;
  path: string;
  isBlocked: boolean;
}

interface CustomPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileProperties | null;
  onUnblock: () => Promise<void>;
}

export const CustomPropertiesDialog: React.FC<CustomPropertiesDialogProps> = ({
  isOpen,
  onClose,
  file,
  onUnblock,
}) => {
  const [unblockChecked, setUnblockChecked] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [unblocked, setUnblocked] = useState(false);
  const {
    surfaceBg,
    titleBarBg,
    borderColor,
    inputBg,
    textColor: valueColor,
    secondaryTextColor: labelColor,
  } = useDialogChrome();

  useEffect(() => {
    if (isOpen) {
      setUnblockChecked(false);
      setUnblocking(false);
      setUnblocked(false);
    }
  }, [isOpen, file]);

  const handleUnblock = async () => {
    setUnblocking(true);
    try {
      await onUnblock();
      setUnblocked(true);
      showToast({
        title: 'File unblocked',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (err) {
      showToast({
        title: 'Failed to unblock file',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUnblocking(false);
    }
  };

  if (!file) return null;

  return (
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => {
      if (!e.open) {
        onClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={surfaceBg}
            borderRadius="lg"
            border="1px solid"
            borderColor={borderColor}>
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              <HStack gap={2}>
                <Icon color="blue.400" asChild><Info /></Icon>
                <Text>File Properties</Text>
              </HStack>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body py={6}>
              <VStack align="stretch" gap={6}>
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                      NAME
                    </Text>
                    <Text color={valueColor} fontWeight="medium" fontSize="sm">
                      {file.name}
                    </Text>
                  </Box>
                  
                  <HStack gap={8}>
                    <Box flex="1">
                      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                        EXTENSION
                      </Text>
                      <Text color={valueColor} fontSize="sm">
                        {file.extension}
                      </Text>
                    </Box>
                    <Box flex="1">
                      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                        SIZE
                      </Text>
                      <Text color={valueColor} fontSize="sm">
                        {(file.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 2 })} KB
                      </Text>
                    </Box>
                  </HStack>
                  
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                      DATE MODIFIED
                    </Text>
                    <Text color={valueColor} fontSize="sm">
                      {file.modified}
                    </Text>
                  </Box>
                  
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                      LOCATION
                    </Text>
                    <Box 
                      bg={useColorModeValue('gray.50', inputBg)} 
                      p={3} 
                      borderRadius="md" 
                      border="1px solid" 
                      borderColor={borderColor}
                    >
                      <Text 
                        fontSize="xs" 
                        fontFamily="mono" 
                        color={useColorModeValue('gray.700', 'gray.300')}
                        wordBreak="break-all"
                        lineHeight="tall"
                      >
                        {file.path}
                      </Text>
                    </Box>
                  </Box>
                </VStack>
                {file.isBlocked && (
                  <Box w="100%" pt={2} borderTop="1px solid" borderColor={borderColor}>
                    <Checkbox.Root
                      checked={unblockChecked || unblocked}
                      disabled={unblocking || unblocked}
                      onCheckedChange={async (d) => {
                        const next = d.checked === true;
                        setUnblockChecked(next);
                        if (next && !unblocked) {
                          await handleUnblock();
                        }
                      }}
                      colorPalette="blue"
                      size="md"
                    ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>Unblock this file
                                        </Checkbox.Label></Checkbox.Root>
                    <Tooltip content="Unblock removes the security zone marking (Zone.Identifier) so the file can be opened without warning.">
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Remove security block (Zone.Identifier) from this file.
                      </Text>
                    </Tooltip>
                    {unblocked && (
                      <HStack mt={2} color="green.500">
                        <CheckCircle size={16} />
                        <Text fontSize="sm">File is now unblocked</Text>
                      </HStack>
                    )}
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
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