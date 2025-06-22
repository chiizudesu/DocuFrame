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
  Switch,
  Box,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  HStack,
  Divider,
  Icon,
  useColorModeValue,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Flex,
  Spacer,
  Tooltip,
  Kbd,
  Select,
} from '@chakra-ui/react';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  Database, 
  Key, 
  Settings as SettingsIcon,
  Keyboard,
  Eye,
  EyeOff,
  Save,
  X,
  Info
} from 'lucide-react';
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
  clientbasePath?: string;
  showOutputLog?: boolean;
  activationShortcut?: string;
  enableActivationShortcut?: boolean;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [gstTemplatePath, setGstTemplatePath] = useState('');
  const [clientbasePath, setClientbasePath] = useState('');
  const [templateFolderPath, setTemplateFolderPath] = useState<string>('');
  const [activationShortcut, setActivationShortcut] = useState('`');
  const [enableActivationShortcut, setEnableActivationShortcut] = useState(true);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  
  const toast = useToast();
  const { setRootDirectory, setCurrentDirectory, showOutputLog, setShowOutputLog } = useAppContext();

  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.getSettings() as Settings;
        setRootPath(loadedSettings.rootPath);
        setApiKey(loadedSettings.apiKey || '');
        setGstTemplatePath(loadedSettings.gstTemplatePath || '');
        setClientbasePath(loadedSettings.clientbasePath || '');
        setActivationShortcut(loadedSettings.activationShortcut || '`');
        setEnableActivationShortcut(loadedSettings.enableActivationShortcut !== false);
        settingsService.getTemplateFolderPath().then(path => setTemplateFolderPath(path || ''));
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
        clientbasePath: clientbasePath || undefined,
        showOutputLog,
        activationShortcut,
        enableActivationShortcut,
      };
      
      await settingsService.setSettings(newSettings as any);
      
      // Update global shortcut in main process
      try {
        await (window.electronAPI as any).updateGlobalShortcut(newSettings);
      } catch (error) {
        console.error('Error updating global shortcut:', error);
        // Don't fail the save operation if shortcut update fails
      }
      
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

  const handleBrowseClientbase = async () => {
    try {
      const result = await (window.electronAPI as any).selectFile({
        title: 'Select Clientbase CSV File',
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result) {
        setClientbasePath(result);
      }
    } catch (error) {
      console.error('Error selecting clientbase CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to select clientbase CSV file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleTemplateFolderChange = async () => {
    try {
      const result = await (window.electronAPI as any).selectDirectory();
      if (result) {
        setTemplateFolderPath(result);
        await settingsService.setTemplateFolderPath(result);
      }
    } catch (error) {
      console.error('Error selecting template folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to select template folder',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleShortcutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActivationShortcut(event.target.value);
  };

  const handleShortcutRecording = () => {
    setIsRecordingShortcut(true);
    // In a real implementation, you would listen for key events here
    // For now, we'll just simulate it
    setTimeout(() => {
      setIsRecordingShortcut(false);
    }, 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered motionPreset="slideInBottom">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        boxShadow="xl"
        mx={4}
        maxW="800px"
        w="90vw"
        maxH="90vh"
        minH="650px"
        overflow="hidden"
      >
        <ModalHeader
          borderBottom="1px solid"
          borderColor={borderColor}
          pb={4}
          display="flex"
          alignItems="center"
          gap={3}
          flexShrink={0}
        >
          <Icon as={SettingsIcon} boxSize={6} color="blue.500" />
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            Settings
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={6} overflow="hidden" flex="1" display="flex" flexDirection="column">
          <Tabs variant="soft-rounded" colorScheme="blue" size="sm" h="full" display="flex" flexDirection="column">
            <TabList mb={6} gap={2} flexShrink={0}>
              <Tab fontSize="sm" fontWeight="medium">
                <Icon as={Folder} boxSize={4} mr={2} />
                Paths
              </Tab>
              <Tab fontSize="sm" fontWeight="medium">
                <Icon as={Key} boxSize={4} mr={2} />
                API & Data
              </Tab>
              <Tab fontSize="sm" fontWeight="medium">
                <Icon as={Keyboard} boxSize={4} mr={2} />
                Shortcuts
              </Tab>
              <Tab fontSize="sm" fontWeight="medium">
                <Icon as={Eye} boxSize={4} mr={2} />
                Interface
              </Tab>
            </TabList>

            <TabPanels flex="1" overflow="auto">
              {/* Paths Tab */}
              <TabPanel p={0} h="full">
                <VStack spacing={6} align="stretch" minH="400px">
                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Folder} boxSize={4} />
                        Root Directory
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        Default directory for file operations
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <InputGroup>
                        <Input
                          value={rootPath}
                          onChange={(e) => setRootPath(e.target.value)}
                          placeholder="Enter root path"
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                        />
                        <InputRightElement width="4.5rem">
                          <Button h="1.75rem" size="sm" onClick={handleBrowseFolder}>
                            <Icon as={FolderOpen} boxSize={4} />
                          </Button>
                        </InputRightElement>
                      </InputGroup>
                    </CardBody>
                  </Card>

                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={FileText} boxSize={4} />
                        Template Files
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        GST template and template folder paths
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <VStack spacing={4}>
                        <FormControl>
                          <FormLabel fontSize="sm" color={textColor}>GST Template Path</FormLabel>
                          <InputGroup>
                            <Input
                              value={gstTemplatePath}
                              onChange={(e) => setGstTemplatePath(e.target.value)}
                              placeholder="Enter GST template file path"
                              bg="white"
                              _dark={{ bg: 'gray.600' }}
                            />
                            <InputRightElement width="4.5rem">
                              <Button h="1.75rem" size="sm" onClick={handleBrowseGstTemplate}>
                                <Icon as={FolderOpen} boxSize={4} />
                              </Button>
                            </InputRightElement>
                          </InputGroup>
                        </FormControl>
                        
                        <FormControl>
                          <FormLabel fontSize="sm" color={textColor}>Template Folder Path</FormLabel>
                          <InputGroup>
                            <Input 
                              value={templateFolderPath} 
                              isReadOnly 
                              placeholder="Select template folder..." 
                              bg="white"
                              _dark={{ bg: 'gray.600' }}
                            />
                            <InputRightElement width="4.5rem">
                              <Button h="1.75rem" size="sm" onClick={handleTemplateFolderChange}>
                                <Icon as={FolderOpen} boxSize={4} />
                              </Button>
                            </InputRightElement>
                          </InputGroup>
                        </FormControl>
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              </TabPanel>

              {/* API & Data Tab */}
              <TabPanel p={0} h="full">
                <VStack spacing={6} align="stretch" minH="400px">
                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Key} boxSize={4} />
                        API Configuration
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        OpenAI API key for AI features
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <FormControl>
                        <FormLabel fontSize="sm" color={textColor}>OpenAI API Key</FormLabel>
                        <Input
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          type="password"
                          placeholder="Enter your OpenAI API key"
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                        />
                      </FormControl>
                    </CardBody>
                  </Card>

                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Database} boxSize={4} />
                        Data Sources
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        Client database and reference files
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <FormControl>
                        <FormLabel fontSize="sm" color={textColor}>Clientbase CSV Path</FormLabel>
                        <InputGroup>
                          <Input
                            value={clientbasePath}
                            onChange={(e) => setClientbasePath(e.target.value)}
                            placeholder="Enter clientbase CSV file path"
                            bg="white"
                            _dark={{ bg: 'gray.600' }}
                          />
                          <InputRightElement width="4.5rem">
                            <Button h="1.75rem" size="sm" onClick={handleBrowseClientbase}>
                              <Icon as={FolderOpen} boxSize={4} />
                            </Button>
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                    </CardBody>
                  </Card>
                </VStack>
              </TabPanel>

              {/* Shortcuts Tab */}
              <TabPanel p={0} h="full">
                <VStack spacing={6} align="stretch" minH="400px">
                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Keyboard} boxSize={4} />
                        Activation Shortcut
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        Global shortcut to activate the application
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <VStack spacing={4} align="stretch">
                        <FormControl>
                          <FormLabel fontSize="sm" color={textColor}>Enable Activation Shortcut</FormLabel>
                          <HStack justify="space-between">
                            <Text fontSize="sm" color={secondaryTextColor}>
                              Allow global shortcut to bring app to front
                            </Text>
                            <Switch
                              isChecked={enableActivationShortcut}
                              onChange={(e) => setEnableActivationShortcut(e.target.checked)}
                              colorScheme="blue"
                            />
                          </HStack>
                        </FormControl>

                        {enableActivationShortcut && (
                          <FormControl>
                            <FormLabel fontSize="sm" color={textColor}>Shortcut Key</FormLabel>
                            <HStack spacing={3}>
                              <Select
                                value={activationShortcut}
                                onChange={handleShortcutChange}
                                bg="white"
                                _dark={{ bg: 'gray.600' }}
                                maxW="120px"
                              >
                                <option value="`">` (Backtick)</option>
                                <option value="F12">F12</option>
                                <option value="F11">F11</option>
                                <option value="F10">F10</option>
                                <option value="F9">F9</option>
                                <option value="F8">F8</option>
                                <option value="F7">F7</option>
                                <option value="F6">F6</option>
                              </Select>
                              <Kbd fontSize="sm" px={2} py={1} borderRadius="md">
                                {activationShortcut}
                              </Kbd>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleShortcutRecording}
                                isLoading={isRecordingShortcut}
                                loadingText="Recording..."
                              >
                                Record Custom
                              </Button>
                            </HStack>
                          </FormControl>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>

                  <Alert status="info" borderRadius="lg">
                    <AlertIcon />
                    <Box>
                      <AlertTitle fontSize="sm">Shortcut Information</AlertTitle>
                      <AlertDescription fontSize="xs">
                        The activation shortcut works globally, even when the app is minimized or in the background.
                        Press the shortcut key to bring DocuFrame to the front.
                      </AlertDescription>
                    </Box>
                  </Alert>
                </VStack>
              </TabPanel>

              {/* Interface Tab */}
              <TabPanel p={0} h="full">
                <VStack spacing={6} align="stretch" minH="400px">
                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Eye} boxSize={4} />
                        Display Options
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        Control interface visibility and behavior
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <FormControl>
                        <FormLabel fontSize="sm" color={textColor}>Show Output Log</FormLabel>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="sm" color={textColor}>
                              Display output log area
                            </Text>
                            <Text fontSize="xs" color={secondaryTextColor}>
                              Toggle the visibility of the output log at the bottom
                            </Text>
                          </VStack>
                          <Switch
                            isChecked={showOutputLog}
                            onChange={(e) => setShowOutputLog(e.target.checked)}
                            colorScheme="blue"
                          />
                        </HStack>
                      </FormControl>
                    </CardBody>
                  </Card>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter
          borderTop="1px solid"
          borderColor={borderColor}
          pt={4}
          gap={3}
          flexShrink={0}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            leftIcon={<Icon as={X} boxSize={4} />}
            color={secondaryTextColor}
            _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
          >
            Cancel
          </Button>
          <Spacer />
          <Button
            colorScheme="blue"
            onClick={handleSave}
            leftIcon={<Icon as={Save} boxSize={4} />}
          >
            Save Settings
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};