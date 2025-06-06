import React, { useEffect, useState } from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useToast,
  InputGroup,
  InputRightElement,
  Flex,
} from '@chakra-ui/react';
import { FolderOpen } from 'lucide-react';
import { settingsService } from '../services/settings';
import { useAppContext } from '../context/AppContext';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const toast = useToast();
  const { setRootDirectory, setCurrentDirectory } = useAppContext();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        setRootPath(settings.rootPath);
        setApiKey(settings.apiKey || '');
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    };

    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, toast]);

  const handleSave = async () => {
    try {
      await settingsService.setSettings({
        rootPath,
        apiKey: apiKey || undefined,
      });
      setRootDirectory(rootPath);
      setCurrentDirectory(rootPath);
      toast({
        title: 'Success',
        description: 'Settings saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const result = await window.electron.selectDirectory();
      if (result) {
        setRootPath(result);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      toast({
        title: 'Error',
        description: 'Failed to select directory',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl mb={4}>
            <FormLabel>Root Path</FormLabel>
            <InputGroup>
              <Input
                value={rootPath}
                onChange={(e) => setRootPath(e.target.value)}
                placeholder="Enter root path"
              />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={handleBrowseFolder}>
                  <FolderOpen size={16} />
                </Button>
              </InputRightElement>
            </InputGroup>
          </FormControl>
          <FormControl>
            <FormLabel>API Key</FormLabel>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
            />
          </FormControl>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={handleSave}>
            Save
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};