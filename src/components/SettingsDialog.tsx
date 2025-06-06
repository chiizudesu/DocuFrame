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

interface Settings {
  rootPath: string;
  apiKey?: string;
  transferCommandMappings: {
    [key: string]: string;  // command -> filename template
  };
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [transferMappings, setTransferMappings] = useState<{ command: string; filename: string }[]>([]);
  const [newCommand, setNewCommand] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const toast = useToast();
  const { setRootDirectory, setCurrentDirectory } = useAppContext();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.getSettings() as Settings;
        setRootPath(loadedSettings.rootPath);
        setApiKey(loadedSettings.apiKey || '');
        // Convert transfer mappings object to array for easier editing
        const mappings = Object.entries(loadedSettings.transferCommandMappings || {}).map(([command, filename]) => ({
          command,
          filename: filename as string
        }));
        setTransferMappings(mappings);
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
      // Convert transfer mappings array back to object
      const transferCommandMappings = transferMappings.reduce((acc, { command, filename }) => {
        acc[command] = filename;
        return acc;
      }, {} as { [key: string]: string });

      const newSettings: Settings = {
        rootPath,
        apiKey: apiKey || undefined,
        transferCommandMappings
      };
      
      await settingsService.setSettings(newSettings as any); // Type assertion needed due to AppSettings interface
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

  const handleAddMapping = () => {
    if (newCommand && newFilename) {
      setTransferMappings([...transferMappings, { command: newCommand, filename: newFilename }]);
      setNewCommand('');
      setNewFilename('');
    }
  };

  const handleRemoveMapping = (index: number) => {
    setTransferMappings(transferMappings.filter((_, i) => i !== index));
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
          <FormControl>
            <FormLabel>Transfer Command Mappings</FormLabel>
            <div className="mt-2 space-y-2">
              {transferMappings.map((mapping, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={mapping.command}
                    onChange={(e) => {
                      const newMappings = [...transferMappings];
                      newMappings[index].command = e.target.value;
                      setTransferMappings(newMappings);
                    }}
                    placeholder="Command"
                  />
                  <Input
                    value={mapping.filename}
                    onChange={(e) => {
                      const newMappings = [...transferMappings];
                      newMappings[index].filename = e.target.value;
                      setTransferMappings(newMappings);
                    }}
                    placeholder="Filename Template"
                  />
                  <Button
                    onClick={() => handleRemoveMapping(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <Input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="New Command"
                />
                <Input
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  placeholder="New Filename Template"
                />
                <Button
                  onClick={handleAddMapping}
                >
                  Add
                </Button>
              </div>
            </div>
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