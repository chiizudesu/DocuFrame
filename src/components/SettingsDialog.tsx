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
  Icon,
  useColorModeValue,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Heading,
  Spacer,
  Kbd,
  Select,
  Divider,
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
  Save,
  X
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
  const [workpaperTemplateFolderPath, setWorkpaperTemplateFolderPath] = useState<string>('');
  const [activationShortcut, setActivationShortcut] = useState('`');
  const [enableActivationShortcut, setEnableActivationShortcut] = useState(true);
  const [calculatorShortcut, setCalculatorShortcut] = useState('Alt+Q');
  const [enableCalculatorShortcut, setEnableCalculatorShortcut] = useState(true);
  const [newTabShortcut, setNewTabShortcut] = useState('Ctrl+T');
  const [enableNewTabShortcut, setEnableNewTabShortcut] = useState(true);
  const [closeTabShortcut, setCloseTabShortcut] = useState('Ctrl+W');
  const [enableFileWatching, setEnableFileWatching] = useState(true);
  const [enableCloseTabShortcut, setEnableCloseTabShortcut] = useState(true);
  const toast = useToast();
  const { setRootDirectory, showOutputLog, setShowOutputLog } = useAppContext();

  // Theme colors
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
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
        settingsService.getWorkpaperTemplateFolderPath().then(path => setWorkpaperTemplateFolderPath(path || ''));
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

  const handleWorkpaperTemplateFolderChange = async () => {
    try {
      const result = await (window.electronAPI as any).selectDirectory();
      if (result) {
        setWorkpaperTemplateFolderPath(result);
        await settingsService.setWorkpaperTemplateFolderPath(result);
      }
    } catch (error) {
      console.error('Error selecting workpaper template folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to select workpaper template folder',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleShortcutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActivationShortcut(event.target.value);
  };



  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="xl" 
      isCentered 
      motionPreset="slideInBottom"
      scrollBehavior="inside"
    >
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        boxShadow="xl"
        mx={4}
        maxW="1000px"
        w="90vw"
        h="80vh"
        maxH="800px"
        minH="600px"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        position="relative"
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
        
        <ModalBody p={0} flex="1" display="flex">
          <Tabs variant="line" colorScheme="blue" orientation="vertical" h="full" display="flex" w="full">
            <TabList 
              borderRight="1px solid" 
              borderColor={borderColor}
              w="200px"
              p={4}
              gap={1}
            >
              <Tab 
                justifyContent="flex-start" 
                px={3} 
                py={2.5}
                borderRadius="md"
                _selected={{ bg: 'blue.50', color: 'blue.600', _dark: { bg: 'blue.900', color: 'blue.200' } }}
                _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}
              >
                <Icon as={Folder} boxSize={4} mr={3} />
                <Text>Paths</Text>
              </Tab>
              <Tab 
                justifyContent="flex-start" 
                px={3} 
                py={2.5}
                borderRadius="md"
                _selected={{ bg: 'blue.50', color: 'blue.600', _dark: { bg: 'blue.900', color: 'blue.200' } }}
                _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}
              >
                <Icon as={Key} boxSize={4} mr={3} />
                <Text>API & Data</Text>
              </Tab>
              <Tab 
                justifyContent="flex-start" 
                px={3} 
                py={2.5}
                borderRadius="md"
                _selected={{ bg: 'blue.50', color: 'blue.600', _dark: { bg: 'blue.900', color: 'blue.200' } }}
                _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}
              >
                <Icon as={Keyboard} boxSize={4} mr={3} />
                <Text>Shortcuts</Text>
              </Tab>
              <Tab 
                justifyContent="flex-start" 
                px={3} 
                py={2.5}
                borderRadius="md"
                _selected={{ bg: 'blue.50', color: 'blue.600', _dark: { bg: 'blue.900', color: 'blue.200' } }}
                _hover={{ bg: 'gray.50', _dark: { bg: 'gray.700' } }}
              >
                <Icon as={Eye} boxSize={4} mr={3} />
                <Text>Interface</Text>
              </Tab>
            </TabList>

            <TabPanels flex="1" p={0} overflow="hidden">
              {/* Paths Tab */}
              <TabPanel 
                h="full" 
                overflowY="auto" 
                overflowX="hidden"
                p={6}
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'gray.400',
                    borderRadius: '4px',
                  },
                }}
              >
                <VStack align="stretch" spacing={0}>
                  <Box pb={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                      <Icon as={Folder} boxSize={4} />
                      Root Directory
                    </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                      Default directory for file operations
                    </Text>
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
                  </Box>
                  
                  <Divider />
                  
                  <Box py={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                      <Icon as={FileText} boxSize={4} />
                      Template Files
                    </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                      GST template and template folder paths
                    </Text>
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
                        <FormLabel fontSize="sm" color={textColor}>AI Email Template Folder</FormLabel>
                        <Text fontSize="xs" color={secondaryTextColor} mb={2}>
                          Folder containing YAML email templates for AI Templater
                        </Text>
                        <InputGroup>
                          <Input
                            value={templateFolderPath} 
                            isReadOnly 
                            placeholder="Select AI email template folder..." 
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

                      <FormControl>
                        <FormLabel fontSize="sm" color={textColor}>Workpaper Template Folder</FormLabel>
                        <Text fontSize="xs" color={secondaryTextColor} mb={2}>
                          Folder containing Excel templates for workpaper creation
                        </Text>
                        <InputGroup>
                          <Input
                            value={workpaperTemplateFolderPath} 
                            isReadOnly 
                            placeholder="Select workpaper template folder..." 
                            bg="white"
                            _dark={{ bg: 'gray.600' }}
                          />
                          <InputRightElement width="4.5rem">
                            <Button h="1.75rem" size="sm" onClick={handleWorkpaperTemplateFolderChange}>
                              <Icon as={FolderOpen} boxSize={4} />
                            </Button>
                          </InputRightElement>
                        </InputGroup>
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              </TabPanel>

              {/* API & Data Tab */}
              <TabPanel 
                h="full" 
                overflowY="auto" 
                overflowX="hidden"
                p={6}
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'gray.400',
                    borderRadius: '4px',
                  },
                }}
              >
                <VStack align="stretch" spacing={0}>
                  <Box pb={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                      <Icon as={Key} boxSize={4} />
                      API Configuration
                    </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                      API keys for AI features
                    </Text>
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
                  </Box>
                  
                  <Divider />
                  
                  <Box py={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                      <Icon as={Database} boxSize={4} />
                      Data Sources
                    </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                      Client database and reference files
                    </Text>
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
                  </Box>
                </VStack>
              </TabPanel>

              {/* Shortcuts Tab */}
              <TabPanel 
                h="full" 
                overflowY="auto" 
                overflowX="hidden"
                p={6}
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'gray.400',
                    borderRadius: '4px',
                  },
                }}
              >
                <VStack spacing={4} align="stretch">
                  <Box pb={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Keyboard} boxSize={4} />
                        Keyboard Shortcuts
                      </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                        Configure keyboard shortcuts for quick access
                      </Text>
                  </Box>
                  
                  <Divider />
                  
                  <Box py={6}>
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
                  </Box>

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
              <TabPanel 
                h="full" 
                overflowY="auto" 
                overflowX="hidden"
                p={6}
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'gray.400',
                    borderRadius: '4px',
                  },
                }}
              >
                <VStack spacing={6} align="stretch">
                  <Box pb={6}>
                    <Heading size="sm" mb={4} color={textColor} display="flex" alignItems="center" gap={2}>
                        <Icon as={Eye} boxSize={4} />
                        Display Options
                      </Heading>
                    <Text fontSize="xs" color={secondaryTextColor} mb={4}>
                        Control interface visibility and behavior
                      </Text>
                  </Box>
                  
                  <Divider />
                  
                  <Box py={6}>
                    <VStack spacing={4} align="stretch">
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
                    </VStack>
                  </Box>
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