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
  Info,
  Calculator as CalculatorIcon,
  Plus
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
  claudeApiKey?: string;
  gstTemplatePath?: string;
  clientbasePath?: string;
  showOutputLog?: boolean;
  activationShortcut?: string;
  enableActivationShortcut?: boolean;
  calculatorShortcut?: string;
  enableCalculatorShortcut?: boolean;
  newTabShortcut?: string;
  enableNewTabShortcut?: boolean;
  closeTabShortcut?: string;
  enableCloseTabShortcut?: boolean;
  enableFileWatching?: boolean;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [originalRootPath, setOriginalRootPath] = useState(''); // Track original root path
  const [apiKey, setApiKey] = useState('');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [gstTemplatePath, setGstTemplatePath] = useState('');
  const [clientbasePath, setClientbasePath] = useState('');
  const [templateFolderPath, setTemplateFolderPath] = useState<string>('');
  const [activationShortcut, setActivationShortcut] = useState('`');
  const [enableActivationShortcut, setEnableActivationShortcut] = useState(true);
  const [calculatorShortcut, setCalculatorShortcut] = useState('Alt+Q');
  const [enableCalculatorShortcut, setEnableCalculatorShortcut] = useState(true);
  const [newTabShortcut, setNewTabShortcut] = useState('Ctrl+T');
  const [enableNewTabShortcut, setEnableNewTabShortcut] = useState(true);
  const [closeTabShortcut, setCloseTabShortcut] = useState('Ctrl+W');
  const [enableFileWatching, setEnableFileWatching] = useState(true);
  const [enableCloseTabShortcut, setEnableCloseTabShortcut] = useState(true);
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
        setOriginalRootPath(loadedSettings.rootPath); // Track original root path
        setApiKey(loadedSettings.apiKey || '');
        setClaudeApiKey(loadedSettings.claudeApiKey || '');
        setGstTemplatePath(loadedSettings.gstTemplatePath || '');
        setClientbasePath(loadedSettings.clientbasePath || '');
        setActivationShortcut(loadedSettings.activationShortcut || '`');
        setEnableActivationShortcut(loadedSettings.enableActivationShortcut !== false);
        setCalculatorShortcut(loadedSettings.calculatorShortcut || 'Alt+Q');
        setEnableCalculatorShortcut(loadedSettings.enableCalculatorShortcut !== false);
        setNewTabShortcut(loadedSettings.newTabShortcut || 'Ctrl+T');
        setEnableNewTabShortcut(loadedSettings.enableNewTabShortcut !== false);
        setCloseTabShortcut(loadedSettings.closeTabShortcut || 'Ctrl+W');
        setEnableCloseTabShortcut(loadedSettings.enableCloseTabShortcut !== false);
        setEnableFileWatching(loadedSettings.enableFileWatching !== false);
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
        claudeApiKey: claudeApiKey || undefined,
        gstTemplatePath: gstTemplatePath || undefined,
        clientbasePath: clientbasePath || undefined,
        showOutputLog,
        activationShortcut,
        enableActivationShortcut,
        calculatorShortcut,
        enableCalculatorShortcut,
        newTabShortcut,
        enableNewTabShortcut,
        closeTabShortcut,
        enableCloseTabShortcut,
        enableFileWatching,
      };
      
      await settingsService.setSettings(newSettings as any);
      
      // Update global shortcut in main process
      try {
        await (window.electronAPI as any).updateGlobalShortcut(newSettings);
      } catch (error) {
        console.error('Error updating global shortcut:', error);
        // Don't fail the save operation if shortcut update fails
      }
      
      // Only change directories if root path has actually changed
      if (rootPath !== originalRootPath) {
        setRootDirectory(rootPath); // This will automatically set current directory to root path
      }
      
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
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
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
                        API keys for AI features
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <VStack spacing={4} align="stretch">
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
                        
                        <FormControl>
                          <FormLabel fontSize="sm" color={textColor}>Claude API Key</FormLabel>
                          <Input
                            value={claudeApiKey}
                            onChange={(e) => setClaudeApiKey(e.target.value)}
                            type="password"
                            placeholder="Enter your Claude (Anthropic) API key"
                            bg="white"
                            _dark={{ bg: 'gray.600' }}
                          />
                        </FormControl>
                      </VStack>
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
                <VStack spacing={4} align="stretch" minH="400px">
                  <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                    <CardHeader pb={3}>
                      <Heading size="sm" color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Keyboard} boxSize={4} />
                        Keyboard Shortcuts
                      </Heading>
                      <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                        Configure keyboard shortcuts for quick access
                      </Text>
                    </CardHeader>
                    <CardBody pt={0}>
                      <VStack spacing={4} align="stretch">
                        
                        {/* Activation Shortcut */}
                        <Box borderBottom="1px solid" borderColor={borderColor} pb={3}>
                          <HStack justify="space-between" mb={2}>
                            <Box>
                              <Text fontSize="sm" fontWeight="500" color={textColor}>Global Activation</Text>
                              <Text fontSize="xs" color={secondaryTextColor}>Bring app to front from anywhere</Text>
                            </Box>
                            <Switch
                              isChecked={enableActivationShortcut}
                              onChange={(e) => setEnableActivationShortcut(e.target.checked)}
                              colorScheme="blue"
                            />
                          </HStack>
                        {enableActivationShortcut && (
                            <HStack spacing={2}>
                              <Select
                                value={activationShortcut}
                                onChange={handleShortcutChange}
                                bg="white"
                                _dark={{ bg: 'gray.600' }}
                                maxW="120px"
                                size="sm"
                              >
                                <option value="`">` (Backtick)</option>
                                <option value="F12">F12</option>
                                <option value="F11">F11</option>
                                <option value="F10">F10</option>
                                <option value="F9">F9</option>
                              </Select>
                              <Kbd fontSize="xs" px={2} py={1}>
                                {activationShortcut}
                              </Kbd>
                            </HStack>
                        )}
                        </Box>

                        {/* Calculator Shortcut */}
                        <Box borderBottom="1px solid" borderColor={borderColor} pb={3}>
                          <HStack justify="space-between" mb={2}>
                            <Box>
                              <Text fontSize="sm" fontWeight="500" color={textColor}>Open Calculator</Text>
                              <Text fontSize="xs" color={secondaryTextColor}>Quick calculator access</Text>
                            </Box>
                            <Switch
                              isChecked={enableCalculatorShortcut}
                              onChange={(e) => setEnableCalculatorShortcut(e.target.checked)}
                              colorScheme="blue"
                            />
                          </HStack>
                        {enableCalculatorShortcut && (
                            <HStack spacing={2}>
                              <Select
                                value={calculatorShortcut}
                                onChange={(e) => setCalculatorShortcut(e.target.value)}
                                bg="white"
                                _dark={{ bg: 'gray.600' }}
                                maxW="140px"
                                size="sm"
                              >
                                <option value="Alt+Q">Alt + Q</option>
                                <option value="Alt+C">Alt + C</option>
                                <option value="Ctrl+Alt+C">Ctrl + Alt + C</option>
                                <option value="Ctrl+Shift+C">Ctrl + Shift + C</option>
                              </Select>
                              <Kbd fontSize="xs" px={2} py={1}>
                                {calculatorShortcut}
                              </Kbd>
                            </HStack>
                          )}
                        </Box>

                        {/* New Tab Shortcut */}
                        <Box borderBottom="1px solid" borderColor={borderColor} pb={3}>
                          <HStack justify="space-between" mb={2}>
                            <Box>
                              <Text fontSize="sm" fontWeight="500" color={textColor}>New Tab</Text>
                              <Text fontSize="xs" color={secondaryTextColor}>Create new folder tab</Text>
                            </Box>
                            <Switch
                              isChecked={enableNewTabShortcut}
                              onChange={(e) => setEnableNewTabShortcut(e.target.checked)}
                              colorScheme="blue"
                            />
                          </HStack>
                          {enableNewTabShortcut && (
                            <HStack spacing={2}>
                              <Select
                                value={newTabShortcut}
                                onChange={(e) => setNewTabShortcut(e.target.value)}
                                bg="white"
                                _dark={{ bg: 'gray.600' }}
                                maxW="140px"
                                size="sm"
                              >
                                <option value="Ctrl+T">Ctrl + T</option>
                                <option value="Ctrl+Shift+T">Ctrl + Shift + T</option>
                                <option value="Alt+T">Alt + T</option>
                                <option value="Ctrl+N">Ctrl + N</option>
                              </Select>
                              <Kbd fontSize="xs" px={2} py={1}>
                                {newTabShortcut}
                              </Kbd>
                            </HStack>
                          )}
                        </Box>

                        {/* Close Tab Shortcut */}
                        <Box pb={3}>
                          <HStack justify="space-between" mb={2}>
                            <Box>
                              <Text fontSize="sm" fontWeight="500" color={textColor}>Close Tab</Text>
                              <Text fontSize="xs" color={secondaryTextColor}>Close current tab</Text>
                            </Box>
                            <Switch
                              isChecked={enableCloseTabShortcut}
                              onChange={(e) => setEnableCloseTabShortcut(e.target.checked)}
                              colorScheme="blue"
                            />
                          </HStack>
                          {enableCloseTabShortcut && (
                            <HStack spacing={2}>
                              <Select
                                value={closeTabShortcut}
                                onChange={(e) => setCloseTabShortcut(e.target.value)}
                                bg="white"
                                _dark={{ bg: 'gray.600' }}
                                maxW="140px"
                                size="sm"
                              >
                                <option value="Ctrl+W">Ctrl + W</option>
                                <option value="Ctrl+F4">Ctrl + F4</option>
                                <option value="Alt+F4">Alt + F4</option>
                                <option value="Ctrl+Shift+W">Ctrl + Shift + W</option>
                              </Select>
                              <Kbd fontSize="xs" px={2} py={1}>
                                {closeTabShortcut}
                              </Kbd>
                            </HStack>
                          )}
                        </Box>

                      </VStack>
                    </CardBody>
                  </Card>

                  <Alert status="info" borderRadius="lg" size="sm">
                    <AlertIcon />
            <Box>
                      <AlertTitle fontSize="xs">Shortcut Information</AlertTitle>
                      <AlertDescription fontSize="xs">
                        Global shortcuts work anywhere. Tab shortcuts work when the app is focused.
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

                      <FormControl>
                        <FormLabel fontSize="sm" color={textColor}>File System Watching</FormLabel>
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <Text fontSize="sm" color={textColor}>
                              Auto-refresh folders
                            </Text>
                            <Text fontSize="xs" color={secondaryTextColor}>
                              Automatically detect and refresh when files are added/changed externally
                            </Text>
                          </VStack>
              <Switch
                isChecked={enableFileWatching}
                onChange={(e) => setEnableFileWatching(e.target.checked)}
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