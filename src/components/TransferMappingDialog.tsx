import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  Input,
  IconButton,
  Box,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  VStack,
  HStack,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon } from '@chakra-ui/icons';

interface TransferMapping {
  command: string;
  filename: string;
}

interface TransferMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    electronAPI: {
      executeCommand: (command: string, currentDirectory?: string) => Promise<any>;
      transfer: (options: { numFiles?: number; newName?: string; command?: string; currentDirectory?: string }) => Promise<any>;
      getConfig: (key: string) => Promise<any>;
      setConfig: (key: string, value: any) => Promise<void>;
      selectDirectory: () => Promise<string>;
      getDirectoryContents: (dirPath: string) => Promise<any>;
      renameItem: (oldPath: string, newPath: string) => Promise<void>;
      deleteItem: (path: string) => Promise<void>;
      createDirectory: (path: string) => Promise<void>;
    }
  }
}

export const TransferMappingDialog: React.FC<TransferMappingDialogProps> = ({ isOpen, onClose }) => {
  const [mappings, setMappings] = useState<TransferMapping[]>([]);
  const [newCommand, setNewCommand] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const toast = useToast();

  useEffect(() => {
    const loadMappings = async () => {
      if (isOpen) {
        try {
          const settings = await window.electronAPI.getConfig('settings');
          if (settings?.transferCommandMappings) {
            const mappingArray = Object.entries(settings.transferCommandMappings).map(([command, filename]) => ({
              command,
              filename: filename as string
            }));
            setMappings(mappingArray);
          }
        } catch (error) {
          console.error('Error loading mappings:', error);
          toast({
            title: 'Error',
            description: 'Failed to load transfer mappings',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    };
    loadMappings();
  }, [isOpen, toast]);

  const handleSave = async () => {
    try {
      const transferCommandMappings = mappings.reduce((acc, { command, filename }) => {
        acc[command] = filename;
        return acc;
      }, {} as { [key: string]: string });

      const settings = await window.electronAPI.getConfig('settings');
      await window.electronAPI.setConfig('settings', {
        ...settings,
        transferCommandMappings
      });
      
      toast({
        title: 'Success',
        description: 'Transfer mappings saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving transfer mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save transfer mappings',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAdd = () => {
    if (newCommand && newFilename) {
      setMappings([...mappings, { command: newCommand, filename: newFilename }]);
      setNewCommand('');
      setNewFilename('');
    }
  };

  const handleDelete = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Transfer Command Mappings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Add New Mapping
              </Text>
              <HStack spacing={2}>
                <FormControl>
                  <FormLabel fontSize="sm">Command</FormLabel>
                  <Input
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="e.g., FAR"
                    size="sm"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Filename Template</FormLabel>
                  <Input
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    placeholder="e.g., F - Fixed Assets Reconciliation"
                    size="sm"
                  />
                </FormControl>
                <IconButton
                  aria-label="Add mapping"
                  icon={<AddIcon />}
                  onClick={handleAdd}
                  colorScheme="blue"
                  isDisabled={!newCommand || !newFilename}
                  alignSelf="flex-end"
                  mt={6}
                />
              </HStack>
            </Box>

            <Box borderWidth={1} borderRadius="md" overflow="hidden">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Command</Th>
                    <Th>Filename Template</Th>
                    <Th width="100px">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {mappings.map((mapping, index) => (
                    <Tr key={index}>
                      <Td>{mapping.command}</Td>
                      <Td>{mapping.filename}</Td>
                      <Td>
                        <IconButton
                          aria-label="Delete mapping"
                          icon={<DeleteIcon />}
                          onClick={() => handleDelete(index)}
                          colorScheme="red"
                          size="sm"
                          variant="ghost"
                        />
                      </Td>
                    </Tr>
                  ))}
                  {mappings.length === 0 && (
                    <Tr>
                      <Td colSpan={3} textAlign="center" color="gray.500">
                        No mappings defined
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 