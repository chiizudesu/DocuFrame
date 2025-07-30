import React, { useEffect, useState } from 'react';
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
  Box,
  VStack,
  HStack,
  Checkbox,
  useColorModeValue,
  useToast,
  Tooltip,
  Icon,
  Code,
} from '@chakra-ui/react';
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
  const toast = useToast();
  const labelColor = useColorModeValue('gray.600', 'gray.300');
  const valueColor = useColorModeValue('gray.800', 'white');
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

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
      toast({
        title: 'File unblocked',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (err) {
      toast({
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
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
        <ModalHeader>
          <HStack spacing={2}>
            <Icon as={Info} color="blue.400" />
            <Text>File Properties</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={6}>
          <VStack align="stretch" spacing={6}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
                  NAME
                </Text>
                <Text color={valueColor} fontWeight="medium" fontSize="sm">
                  {file.name}
                </Text>
              </Box>
              
              <HStack spacing={8}>
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
                  bg={useColorModeValue('gray.50', 'gray.900')} 
                  p={3} 
                  borderRadius="md" 
                  border="1px solid" 
                  borderColor={useColorModeValue('gray.200', 'gray.700')}
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
                <Checkbox
                  isChecked={unblockChecked || unblocked}
                  isDisabled={unblocking || unblocked}
                  onChange={async (e) => {
                    setUnblockChecked(e.target.checked);
                    if (e.target.checked && !unblocked) {
                      await handleUnblock();
                    }
                  }}
                  colorScheme="blue"
                  size="md"
                >
                  Unblock this file
                </Checkbox>
                <Tooltip label="Unblock removes the security zone marking (Zone.Identifier) so the file can be opened without warning.">
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
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 