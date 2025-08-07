import React, { useEffect, useState } from 'react';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
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
  Divider,
  Select,
  Kbd,
  Flex,
  Heading,
  Spacer,
  IconButton,
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
  X
} from 'lucide-react';
import { settingsService } from '../services/settings';
import { useAppContext } from '../context/AppContext';

interface SettingsWindowProps {
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
  clientSearchShortcut?: string;
  enableClientSearchShortcut?: boolean;
  sidebarCollapsedByDefault?: boolean;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const [rootPath, setRootPath] = useState('');
  const [originalRootPath, setOriginalRootPath] = useState('');
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
  const [clientSearchShortcut, setClientSearchShortcut] = useState('Alt+F');
  const [enableClientSearchShortcut, setEnableClientSearchShortcut] = useState(true);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [sidebarCollapsedByDefault, setSidebarCollapsedByDefault] = useState(false);
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
        setOriginalRootPath(loadedSettings.rootPath);
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
        setClientSearchShortcut(loadedSettings.clientSearchShortcut || 'Alt+F');
        setEnableClientSearchShortcut(loadedSettings.enableClientSearchShortcut !== false);
        setSidebarCollapsedByDefault(loadedSettings.sidebarCollapsedByDefault || false);
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
        clientSearchShortcut,
        enableClientSearchShortcut,
        sidebarCollapsedByDefault,
      };
      
      await settingsService.setSettings(newSettings as any);
      
      // Update global shortcut in main process
      try {
        await (window.electronAPI as any).updateGlobalShortcut(newSettings);
      } catch (error) {
        console.error('Error updating global shortcut:', error);
      }
      
      // Only change directories if root path has actually changed
      if (rootPath !== originalRootPath) {
        setRootDirectory(rootPath);
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

  if (!isOpen) return null;

  return (
    <Box
      w="100vw"
      h="100vh"
      bg={bgColor}
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* Custom Title Bar */}
      <Flex
        align="center"
        width="100%"
        bg={useColorModeValue('#f8fafc', 'gray.800')}
        h="31px"
        style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
        px={0}
        borderBottom="1px solid"
        borderColor={borderColor}
        flexShrink={0}
      >
        <Box display="flex" alignItems="center" gap={2} pl={3}>
          <Icon as={SettingsIcon} boxSize={3.5} color="blue.500" />
          <Text fontWeight="600" fontSize="sm" color={textColor} userSelect="none">
            Settings
          </Text>
        </Box>
        <Spacer />
        <Flex height="31px" align="center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            color={textColor}
            _hover={{ bg: useColorModeValue('#e5e7eb', 'gray.600') }}
            _focus={{ boxShadow: 'none', bg: 'transparent' }}
            _active={{ bg: useColorModeValue('#d1d5db', 'gray.500') }}
            borderRadius={0}
            minW="44px"
            h="31px"
            p={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="default"
          >
            <Icon as={X} boxSize={3.5} />
          </Button>
        </Flex>
      </Flex>

      {/* Main Content */}
      <Box flex="1" display="flex" overflow="hidden">
        <Tabs variant="line" colorScheme="blue" orientation="vertical" h="full" display="flex" w="full">
          <TabList 
            w="176px"
            p={4}
            gap={1}
            borderRight="1px solid"
            borderColor={borderColor}
            bg={useColorModeValue('gray.50', 'gray.750')}
          >
            <Tab 
              justifyContent="flex-start" 
              px={2.5} 
              py={2}
              borderRadius="sm"
              fontSize="sm"
              fontWeight="500"
              _selected={{ 
                bg: 'blue.50', 
                color: 'blue.600', 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
                _dark: { bg: 'blue.900', color: 'blue.200' } 
              }}
              _hover={{ bg: useColorModeValue('white', 'gray.700') }}
              transition="all 0.2s"
            >
              <Text>Paths</Text>
            </Tab>
            <Tab 
              justifyContent="flex-start" 
              px={2.5} 
              py={2}
              borderRadius="sm"
              fontSize="sm"
              fontWeight="500"
              _selected={{ 
                bg: 'blue.50', 
                color: 'blue.600', 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
                _dark: { bg: 'blue.900', color: 'blue.200' } 
              }}
              _hover={{ bg: useColorModeValue('white', 'gray.700') }}
              transition="all 0.2s"
            >
              <Text>API & Data</Text>
            </Tab>
            <Tab 
              justifyContent="flex-start" 
              px={2.5} 
              py={2}
              borderRadius="sm"
              fontSize="sm"
              fontWeight="500"
              _selected={{ 
                bg: 'blue.50', 
                color: 'blue.600', 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
                _dark: { bg: 'blue.900', color: 'blue.200' } 
              }}
              _hover={{ bg: useColorModeValue('white', 'gray.700') }}
              transition="all 0.2s"
            >
              <Text>Shortcuts</Text>
            </Tab>
            <Tab 
              justifyContent="flex-start" 
              px={2.5} 
              py={2}
              borderRadius="sm"
              fontSize="sm"
              fontWeight="500"
              _selected={{ 
                bg: 'blue.50', 
                color: 'blue.600', 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
                _dark: { bg: 'blue.900', color: 'blue.200' } 
              }}
              _hover={{ bg: useColorModeValue('white', 'gray.700') }}
              transition="all 0.2s"
            >
              <Text>Interface</Text>
            </Tab>
          </TabList>

          <TabPanels flex="1" p={0} overflow="hidden">
            {/* Paths Tab */}
            <TabPanel 
              h="full" 
              overflowY="auto" 
              overflowX="hidden"
              px={6}
              py={4}
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: useColorModeValue('gray.300', 'gray.600'),
                  borderRadius: '2px',
                },
              }}
            >
              <VStack align="stretch" spacing={0}>
                <Box pb={3.5}>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    Root Directory
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    Default directory for file operations
                  </Text>
                  <InputGroup size="sm">
                    <Input
                      value={rootPath}
                      onChange={(e) => setRootPath(e.target.value)}
                      placeholder="Enter root path"
                      bg="white"
                      _dark={{ bg: 'gray.600' }}
                      borderRadius="sm"
                      fontSize="xs"
                      h="31px"
                    />
                    <InputRightElement width="3.5rem" h="31px">
                      <Button h="22px" size="xs" onClick={handleBrowseFolder} borderRadius="sm">
                        <Icon as={FolderOpen} boxSize={3.5} />
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </Box>
                
                <Divider mb={3.5} />
                
                <Box>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    Template Files
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    GST template and template folder paths
                  </Text>
                  <VStack spacing={2.5}>
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>GST Template Path</FormLabel>
                      <InputGroup size="sm">
                        <Input
                          value={gstTemplatePath}
                          onChange={(e) => setGstTemplatePath(e.target.value)}
                          placeholder="Enter GST template file path"
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                        <InputRightElement width="3.5rem" h="31px">
                          <Button h="22px" size="xs" onClick={handleBrowseGstTemplate} borderRadius="sm">
                            <Icon as={FolderOpen} boxSize={3.5} />
                          </Button>
                        </InputRightElement>
                      </InputGroup>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>AI Email Template Folder</FormLabel>
                      <Text fontSize="xs" color={secondaryTextColor} mb={1}>
                        Folder containing YAML email templates for AI Templater
                      </Text>
                      <InputGroup size="sm">
                        <Input
                          value={templateFolderPath} 
                          isReadOnly 
                          placeholder="Select AI email template folder..." 
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                        <InputRightElement width="3.5rem" h="31px">
                          <Button h="22px" size="xs" onClick={handleTemplateFolderChange} borderRadius="sm">
                            <Icon as={FolderOpen} boxSize={3.5} />
                          </Button>
                        </InputRightElement>
                      </InputGroup>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Workpaper Template Folder</FormLabel>
                      <Text fontSize="xs" color={secondaryTextColor} mb={1}>
                        Folder containing Excel templates for workpaper creation
                      </Text>
                      <InputGroup size="sm">
                        <Input
                          value={workpaperTemplateFolderPath} 
                          isReadOnly 
                          placeholder="Select workpaper template folder..." 
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                        <InputRightElement width="3.5rem" h="31px">
                          <Button h="22px" size="xs" onClick={handleWorkpaperTemplateFolderChange} borderRadius="sm">
                            <Icon as={FolderOpen} boxSize={3.5} />
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
              px={6}
              py={4}
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: useColorModeValue('gray.300', 'gray.600'),
                  borderRadius: '2px',
                },
              }}
            >
              <VStack align="stretch" spacing={0}>
                <Box pb={3.5}>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    API Configuration
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    API keys for AI features
                  </Text>
                  <VStack spacing={2.5} align="stretch">
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>OpenAI API Key</FormLabel>
                      <InputGroup size="sm">
                        <Input
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          type={showOpenAIKey ? "text" : "password"}
                          placeholder="Enter your OpenAI API key"
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                        <InputRightElement width="3rem" h="31px">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={showOpenAIKey ? <Icon as={EyeOff} boxSize={3.5} /> : <Icon as={Eye} boxSize={3.5} />}
                            onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                            aria-label={showOpenAIKey ? "Hide API key" : "Show API key"}
                            h="22px"
                          />
                        </InputRightElement>
                      </InputGroup>
                    </FormControl>
                    
                    <FormControl>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Claude API Key</FormLabel>
                      <InputGroup size="sm">
                        <Input
                          value={claudeApiKey}
                          onChange={(e) => setClaudeApiKey(e.target.value)}
                          type={showClaudeKey ? "text" : "password"}
                          placeholder="Enter your Claude (Anthropic) API key"
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                        <InputRightElement width="3rem" h="31px">
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={showClaudeKey ? <Icon as={EyeOff} boxSize={3.5} /> : <Icon as={Eye} boxSize={3.5} />}
                            onClick={() => setShowClaudeKey(!showClaudeKey)}
                            aria-label={showClaudeKey ? "Hide API key" : "Show API key"}
                            h="22px"
                          />
                        </InputRightElement>
                      </InputGroup>
                    </FormControl>
                  </VStack>
                </Box>
                
                <Divider mb={3.5} />
                
                <Box>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    Data Sources
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    Client database and reference files
                  </Text>
                  <FormControl>
                    <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Clientbase CSV Path</FormLabel>
                    <InputGroup size="sm">
                      <Input
                        value={clientbasePath}
                        onChange={(e) => setClientbasePath(e.target.value)}
                        placeholder="Enter clientbase CSV file path"
                        bg="white"
                        _dark={{ bg: 'gray.600' }}
                        borderRadius="sm"
                        fontSize="xs"
                        h="31px"
                      />
                      <InputRightElement width="3.5rem" h="31px">
                        <Button h="22px" size="xs" onClick={handleBrowseClientbase} borderRadius="sm">
                          <Icon as={FolderOpen} boxSize={3.5} />
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
              px={6}
              py={4}
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: useColorModeValue('gray.300', 'gray.600'),
                  borderRadius: '2px',
                },
              }}
            >
              <VStack spacing={0} align="stretch">
                <Box pb={3.5}>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    Keyboard Shortcuts
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    Configure keyboard shortcuts for quick access
                  </Text>
                </Box>
                
                <VStack spacing={2.5} align="stretch">
                  
                  {/* Activation Shortcut */}
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <HStack justify="space-between" mb={2}>
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>Global Activation</Text>
                        <Text fontSize="xs" color={secondaryTextColor}>Bring app to front from anywhere</Text>
                      </Box>
                      <Switch
                        isChecked={enableActivationShortcut}
                        onChange={(e) => setEnableActivationShortcut(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                  {enableActivationShortcut && (
                      <HStack spacing={2.5}>
                        <Select
                          value={activationShortcut}
                          onChange={handleShortcutChange}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          maxW="132px"
                          size="xs"
                          borderRadius="sm"
                        >
                          <option value="`">` (Backtick)</option>
                          <option value="F12">F12</option>
                          <option value="F11">F11</option>
                          <option value="F10">F10</option>
                          <option value="F9">F9</option>
                        </Select>
                        <Kbd fontSize="xs" px={2.5} py={0.5} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="sm">
                          {activationShortcut}
                        </Kbd>
                      </HStack>
                  )}
                  </Box>

                  {/* Calculator Shortcut */}
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <HStack justify="space-between" mb={2}>
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>Open Calculator</Text>
                        <Text fontSize="xs" color={secondaryTextColor}>Quick calculator access</Text>
                      </Box>
                      <Switch
                        isChecked={enableCalculatorShortcut}
                        onChange={(e) => setEnableCalculatorShortcut(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                  {enableCalculatorShortcut && (
                      <HStack spacing={2.5}>
                        <Select
                          value={calculatorShortcut}
                          onChange={(e) => setCalculatorShortcut(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          maxW="132px"
                          size="xs"
                          borderRadius="sm"
                        >
                          <option value="Alt+Q">Alt + Q</option>
                          <option value="Alt+C">Alt + C</option>
                          <option value="Ctrl+Alt+C">Ctrl + Alt + C</option>
                          <option value="Ctrl+Shift+C">Ctrl + Shift + C</option>
                        </Select>
                        <Kbd fontSize="xs" px={2.5} py={0.5} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="sm">
                          {calculatorShortcut}
                        </Kbd>
                      </HStack>
                    )}
                  </Box>

                  {/* New Tab Shortcut */}
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <HStack justify="space-between" mb={2}>
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>New Tab</Text>
                        <Text fontSize="xs" color={secondaryTextColor}>Create new folder tab</Text>
                      </Box>
                      <Switch
                        isChecked={enableNewTabShortcut}
                        onChange={(e) => setEnableNewTabShortcut(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                    {enableNewTabShortcut && (
                      <HStack spacing={2.5}>
                        <Select
                          value={newTabShortcut}
                          onChange={(e) => setNewTabShortcut(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          maxW="132px"
                          size="xs"
                          borderRadius="sm"
                        >
                          <option value="Ctrl+T">Ctrl + T</option>
                          <option value="Ctrl+Shift+T">Ctrl + Shift + T</option>
                          <option value="Alt+T">Alt + T</option>
                          <option value="Ctrl+N">Ctrl + N</option>
                        </Select>
                        <Kbd fontSize="xs" px={2.5} py={0.5} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="sm">
                          {newTabShortcut}
                        </Kbd>
                      </HStack>
                    )}
                  </Box>

                  {/* Close Tab Shortcut */}
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <HStack justify="space-between" mb={2}>
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>Close Tab</Text>
                        <Text fontSize="xs" color={secondaryTextColor}>Close current tab</Text>
                      </Box>
                      <Switch
                        isChecked={enableCloseTabShortcut}
                        onChange={(e) => setEnableCloseTabShortcut(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                    {enableCloseTabShortcut && (
                      <HStack spacing={2.5}>
                        <Select
                          value={closeTabShortcut}
                          onChange={(e) => setCloseTabShortcut(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          maxW="132px"
                          size="xs"
                          borderRadius="sm"
                        >
                          <option value="Ctrl+W">Ctrl + W</option>
                          <option value="Ctrl+F4">Ctrl + F4</option>
                          <option value="Alt+F4">Alt + F4</option>
                          <option value="Ctrl+Shift+W">Ctrl + Shift + W</option>
                        </Select>
                        <Kbd fontSize="xs" px={2.5} py={0.5} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="sm">
                          {closeTabShortcut}
                        </Kbd>
                      </HStack>
                    )}
                  </Box>

                  {/* Client Search Shortcut */}
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <HStack justify="space-between" mb={2}>
                      <Box>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>Search Clients</Text>
                        <Text fontSize="xs" color={secondaryTextColor}>Open client search overlay</Text>
                      </Box>
                      <Switch
                        isChecked={enableClientSearchShortcut}
                        onChange={(e) => setEnableClientSearchShortcut(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                    {enableClientSearchShortcut && (
                      <HStack spacing={2.5}>
                        <Select
                          value={clientSearchShortcut}
                          onChange={(e) => setClientSearchShortcut(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          maxW="132px"
                          size="xs"
                          borderRadius="sm"
                        >
                          <option value="Alt+F">Alt + F</option>
                          <option value="Ctrl+Shift+F">Ctrl + Shift + F</option>
                          <option value="Ctrl+Alt+F">Ctrl + Alt + F</option>
                          <option value="F6">F6</option>
                        </Select>
                        <Kbd fontSize="xs" px={2.5} py={0.5} bg={useColorModeValue('gray.100', 'gray.600')} borderRadius="sm">
                          {clientSearchShortcut}
                        </Kbd>
                      </HStack>
                    )}
                  </Box>

                </VStack>

                <Alert status="info" size="sm" mt={2.5} borderRadius="sm">
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
              px={6}
              py={4}
              sx={{
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: useColorModeValue('gray.300', 'gray.600'),
                  borderRadius: '2px',
                },
              }}
            >
              <VStack spacing={0} align="stretch">
                <Box pb={3.5}>
                  <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                    Display Options
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    Control interface visibility and behavior
                  </Text>
                </Box>
                
                <VStack spacing={2.5} align="stretch">
                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <FormControl>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Show Output Log</FormLabel>
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Toggle the visibility of the output log at the bottom
                          </Text>
                        </VStack>
            <Switch
              isChecked={showOutputLog}
              onChange={(e) => setShowOutputLog(e.target.checked)}
              colorScheme="blue"
              size="sm"
            />
                      </HStack>
                    </FormControl>
                  </Box>

                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <FormControl>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>File System Watching</FormLabel>
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Automatically detect and refresh when files are added/changed externally
                          </Text>
                        </VStack>
            <Switch
              isChecked={enableFileWatching}
              onChange={(e) => setEnableFileWatching(e.target.checked)}
              colorScheme="blue"
              size="sm"
            />
                      </HStack>
                    </FormControl>
                  </Box>

                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
  <FormControl>
    <HStack justify="space-between">
      <VStack align="start" spacing={1}>
        <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Sidebar Collapsed by Default</FormLabel>
        <Text fontSize="xs" color={secondaryTextColor}>
          Start with the sidebar in collapsed state when opening the app
        </Text>
      </VStack>
      <Switch
        isChecked={sidebarCollapsedByDefault}
        onChange={(e) => setSidebarCollapsedByDefault(e.target.checked)}
        colorScheme="blue"
        size="sm"
      />
    </HStack>
  </FormControl>
</Box>
                </VStack>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

      {/* Footer */}
      <Box
        borderTop="1px solid"
        borderColor={borderColor}
        px={6}
        py={3}
        bg={useColorModeValue('gray.50', 'gray.800')}
        flexShrink={0}
      >
        <Flex gap={2.5} justify="flex-end">
          <Button
            variant="ghost"
            onClick={onClose}
            leftIcon={<Icon as={X} boxSize={3.5} />}
            color={secondaryTextColor}
            _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
            borderRadius="sm"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSave}
            leftIcon={<Icon as={Save} boxSize={3.5} />}
            borderRadius="sm"
            fontWeight="500"
            size="sm"
          >
            Save Settings
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}; 