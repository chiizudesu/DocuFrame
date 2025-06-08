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
} from '@chakra-ui/react';
import { FolderOpen } from 'lucide-react';
import { settingsService } from '../services/settings';
import { useAppContext } from '../context/AppContext';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Settings {
  rootPath: string;
  apiKey?: string;
  gstTemplatePath?: string;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [gstTemplatePath, setGstTemplatePath] = useState('');
  const toast = useToast();
  const { setRootDirectory, setCurrentDirectory } = useAppContext();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.getSettings() as Settings;
        setRootPath(loadedSettings.rootPath);
        setApiKey(loadedSettings.apiKey || '');
        setGstTemplatePath(loadedSettings.gstTemplatePath || '');
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
      const newSettings: Settings = {
        rootPath,
        apiKey: apiKey || undefined,
        gstTemplatePath: gstTemplatePath || undefined,
      };
      
      await settingsService.setSettings(newSettings as any);
      setRootDirectory(rootPath);
      setCurrentDirectory(rootPath);
      toast({
        title: 'Settings saved',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error saving settings',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const result = await (window.electronAPI as any).selectDirectory();
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

  const handleBrowseGstTemplate = async () => {
    try {
      const result = await (window.electronAPI as any).selectFile({
        title: 'Select GST Template',
        filters: [
          { name: 'Spreadsheet Files', extensions: ['xlsx', 'xls', 'csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result) {
        setGstTemplatePath(result);
      }
    } catch (error) {
      console.error('Error selecting GST template:', error);
      toast({
        title: 'Error',
        description: 'Failed to select GST template file',
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
          <FormControl mb={4}>
            <FormLabel>GST Template Path</FormLabel>
            <InputGroup>
              <Input
                value={gstTemplatePath}
                onChange={(e) => setGstTemplatePath(e.target.value)}
                placeholder="Enter GST template file path"
              />
              <InputRightElement width="4.5rem">
                <Button h="1.75rem" size="sm" onClick={handleBrowseGstTemplate}>
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