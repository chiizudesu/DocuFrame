import React, { useEffect, useState } from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton, Button, FormControl, FormLabel, Input, InputGroup, InputRightElement, IconButton, VStack, Text, useColorModeValue, Divider } from '@chakra-ui/react';
import { Eye, EyeOff, FolderOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
export const SettingsDialog: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    rootDirectory,
    setRootDirectory,
    apiKey,
    setApiKey,
    addLog
  } = useAppContext();
  // Local state for form values
  const [localRootDir, setLocalRootDir] = useState(rootDirectory);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  // Reset form when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      setLocalRootDir(rootDirectory);
      setLocalApiKey(apiKey);
      setShowApiKey(false);
    }
  }, [isSettingsOpen, rootDirectory, apiKey]);
  const handleSave = () => {
    setRootDirectory(localRootDir);
    setApiKey(localApiKey);
    addLog('Settings saved');
    setIsSettingsOpen(false);
  };
  const handleBrowse = () => {
    // In a real app, this would open a directory picker
    // For now, we'll just simulate it
    addLog('Directory browser would open here');
    // Simulate selecting a directory
    setLocalRootDir('C:\\Users\\Username\\Documents');
  };
  const toggleShowApiKey = () => setShowApiKey(!showApiKey);
  return <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="sm" fontWeight="medium">
              Configure application settings
            </Text>
            <Divider />
            <FormControl>
              <FormLabel fontSize="sm">Root Directory</FormLabel>
              <InputGroup>
                <Input placeholder="Enter directory path" value={localRootDir} onChange={e => setLocalRootDir(e.target.value)} />
                <InputRightElement>
                  <IconButton aria-label="Browse folders" icon={<FolderOpen size={16} />} size="sm" variant="ghost" onClick={handleBrowse} />
                </InputRightElement>
              </InputGroup>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Path to the root folder for file operations
              </Text>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">OpenAI API Key</FormLabel>
              <InputGroup>
                <Input placeholder="Enter your API key" type={showApiKey ? 'text' : 'password'} value={localApiKey} onChange={e => setLocalApiKey(e.target.value)} />
                <InputRightElement>
                  <IconButton aria-label={showApiKey ? 'Hide API key' : 'Show API key'} icon={showApiKey ? <EyeOff size={16} /> : <Eye size={16} />} size="sm" variant="ghost" onClick={toggleShowApiKey} />
                </InputRightElement>
              </InputGroup>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Required for AI-powered features
              </Text>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={() => setIsSettingsOpen(false)}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>;
};