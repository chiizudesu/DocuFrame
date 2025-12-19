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
  useColorMode,
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
  Textarea,
  SimpleGrid,
  Image,
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
  Edit,
  Sun,
  Moon,
  Image as ImageIcon,
  Plus,
  Trash2
} from 'lucide-react';
import { settingsService } from '../services/settings';
import { useAppContext } from '../context/AppContext';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BackgroundThumbnailProps {
  img: { filename: string; path: string; relativePath: string };
  isSelected: boolean;
  borderColor: string;
  onSelect: () => void;
  onDelete: () => void;
}

const BackgroundThumbnail: React.FC<BackgroundThumbnailProps> = ({ img, isSelected, borderColor, onSelect, onDelete }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const bgColor = useColorModeValue('white', 'gray.700');
  const overlayBg = useColorModeValue('blackAlpha.600', 'blackAlpha.800');

  useEffect(() => {
    const loadThumbnail = async () => {
      if (window.electronAPI && (window.electronAPI as any).readImageAsDataUrl) {
        try {
          const result = await (window.electronAPI as any).readImageAsDataUrl(img.path);
          if (result.success && result.dataUrl) {
            setThumbnailUrl(result.dataUrl);
          } else {
            setThumbnailUrl(`file://${img.path.replace(/\\/g, '/')}`);
          }
        } catch (error) {
          setThumbnailUrl(`file://${img.path.replace(/\\/g, '/')}`);
        }
      } else {
        setThumbnailUrl(`file://${img.path.replace(/\\/g, '/')}`);
      }
    };
    loadThumbnail();
  }, [img.path]);

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor={isSelected ? 'blue.500' : borderColor}
      borderRadius="sm"
      overflow="hidden"
      cursor="pointer"
      bg={bgColor}
      _hover={{
        borderColor: 'blue.400',
        '& .delete-button': {
          opacity: 1,
        },
      }}
      onClick={onSelect}
      width="150px"
      sx={{
        aspectRatio: '16 / 9',
      }}
    >
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt={img.filename}
          w="100%"
          h="100%"
          objectFit="contain"
          onError={(e) => {
            console.error('Failed to load thumbnail:', img.path);
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      {isSelected && (
        <Box
          position="absolute"
          top={1}
          right={1}
          bg="blue.500"
          color="white"
          borderRadius="full"
          w={5}
          h={5}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon as={Save} boxSize={3} />
        </Box>
      )}
      <IconButton
        aria-label="Delete background"
        icon={<Icon as={Trash2} boxSize={3.5} />}
        size="xs"
        colorScheme="red"
        position="absolute"
        top={1}
        left={1}
        opacity={0}
        className="delete-button"
        transition="opacity 0.2s"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      />
      <Box
        p={1}
        bg={overlayBg}
        position="absolute"
        bottom={0}
        left={0}
        right={0}
      >
        <Text
          fontSize="xs"
          color="white"
          isTruncated
          title={img.filename}
        >
          {img.filename}
        </Text>
      </Box>
    </Box>
  );
};

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
  hideTemporaryFiles?: boolean;
  hideDotFiles?: boolean;
  aiEditorInstructions?: string; // NEW
  workShiftStart?: string;
  workShiftEnd?: string;
  productivityTargetHours?: number;
  enableActivityTracking?: boolean;
  fileGridBackgroundPath?: string;
  backgroundType?: 'watermark' | 'backgroundFill';
  backgroundFillPath?: string;

}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const { colorMode, toggleColorMode, setColorMode } = useColorMode();
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
  const [hideTemporaryFiles, setHideTemporaryFiles] = useState(true);
  const [hideDotFiles, setHideDotFiles] = useState(true);
  const [aiEditorInstructions, setAiEditorInstructions] = useState(''); // NEW
  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [productivityTargetHours, setProductivityTargetHours] = useState(7.5);
  const [enableActivityTracking, setEnableActivityTracking] = useState(true);
  const [fileGridBackgroundPath, setFileGridBackgroundPath] = useState('');
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark');
  const [backgroundFillPath, setBackgroundFillPath] = useState('');
  const [backgroundImages, setBackgroundImages] = useState<Array<{ filename: string; path: string; relativePath: string }>>([]);
  const [selectedBackground, setSelectedBackground] = useState<string>('');

  
  // Keyboard recorder state
  const [isKeyRecorderOpen, setIsKeyRecorderOpen] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [currentEditingShortcut, setCurrentEditingShortcut] = useState<string>('');
  
  const toast = useToast();
  const { setRootDirectory, showOutputLog, setShowOutputLog, reloadSettings, setAiEditorInstructions: setContextAiEditorInstructions } = useAppContext();

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
        // NEW: file grid setting (default true when unset)
        setHideTemporaryFiles(loadedSettings.hideTemporaryFiles !== false);
        setHideDotFiles(loadedSettings.hideDotFiles !== false);
        // NEW: AI editor instructions
        setAiEditorInstructions(loadedSettings.aiEditorInstructions || 'Paste your raw email blurb below. The AI will rewrite it to be clearer, more professional, and polished, while keeping your tone and intent.');
        // Work shift settings
        setWorkShiftStart(loadedSettings.workShiftStart || '06:00');
        setWorkShiftEnd(loadedSettings.workShiftEnd || '15:00');
        setProductivityTargetHours(loadedSettings.productivityTargetHours || 7.5);
        setEnableActivityTracking(loadedSettings.enableActivityTracking !== false);
        setFileGridBackgroundPath(loadedSettings.fileGridBackgroundPath || '');
        // Migration: if fileGridBackgroundPath exists but backgroundType is not set, default to corner mascot (watermark)
        if (loadedSettings.fileGridBackgroundPath && !loadedSettings.backgroundType) {
          setBackgroundType('watermark');
        } else {
          setBackgroundType(loadedSettings.backgroundType || 'watermark');
        }
        setBackgroundFillPath(loadedSettings.backgroundFillPath || '');

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

  // Load background images when background type changes
  useEffect(() => {
    const loadBackgroundImages = async () => {
      try {
        if (window.electronAPI && (window.electronAPI as any).listBackgroundImages) {
          const result = await (window.electronAPI as any).listBackgroundImages(backgroundType);
          if (result.success && result.images) {
            setBackgroundImages(result.images);
            // Set selected background based on current path
            if (backgroundType === 'watermark' && fileGridBackgroundPath) {
              const matchingImage = result.images.find((img: any) => img.path === fileGridBackgroundPath || img.relativePath === fileGridBackgroundPath);
              if (matchingImage) {
                setSelectedBackground(matchingImage.relativePath);
              }
            } else if (backgroundType === 'backgroundFill' && backgroundFillPath) {
              const matchingImage = result.images.find((img: any) => img.path === backgroundFillPath || img.relativePath === backgroundFillPath);
              if (matchingImage) {
                setSelectedBackground(matchingImage.relativePath);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading background images:', error);
      }
    };
    
    if (isOpen) {
      loadBackgroundImages();
    }
  }, [isOpen, backgroundType, fileGridBackgroundPath, backgroundFillPath]);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
        hideTemporaryFiles,
        hideDotFiles,
        aiEditorInstructions, // NEW
        workShiftStart,
        workShiftEnd,
        productivityTargetHours,
        enableActivityTracking,
        fileGridBackgroundPath,
        backgroundType,
        backgroundFillPath,

      };
      
      await settingsService.setSettings(newSettings as any);
      
      // Clear the settings cache to force fresh reload
      (settingsService as any).clearCache();
      
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
      
      // Show what shortcuts were saved
      console.log('Saved shortcuts:', {
        activationShortcut,
        calculatorShortcut,
        newTabShortcut,
        closeTabShortcut,
        clientSearchShortcut
      });
      
      // Immediately reload settings to update the UI
      await reloadSettings();
      
      // Immediately update the app context with the new AI editor instructions
      setContextAiEditorInstructions(aiEditorInstructions);
      console.log('Settings saved - AI Editor Instructions updated to:', aiEditorInstructions);
      
      // Force a re-render to show updated shortcuts immediately
      setActivationShortcut(activationShortcut);
      setCalculatorShortcut(calculatorShortcut);
      setNewTabShortcut(newTabShortcut);
      setCloseTabShortcut(closeTabShortcut);
      setClientSearchShortcut(clientSearchShortcut);
      
      // Dispatch event to notify other components of settings change
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: newSettings }));
      
      toast({
        title: 'Settings saved',
        description: 'All settings have been updated and applied immediately.',
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

  const handleBrowseFileGridBackground = async () => {
    try {
      const result = await (window.electronAPI as any).selectFile({
        title: 'Select File Grid Background Image',
        filters: [
          { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result) {
        setFileGridBackgroundPath(result);
      }
    } catch (error) {
      console.error('Error selecting background image:', error);
      toast({
        title: 'Error',
        description: 'Failed to select background image',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddBackground = async () => {
    try {
      const result = await (window.electronAPI as any).selectFile({
        title: `Select ${backgroundType === 'watermark' ? 'Corner Mascot' : 'Background Fill'} Image`,
        filters: [
          { name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      if (result && window.electronAPI && (window.electronAPI as any).copyBackgroundImage) {
        const copyResult = await (window.electronAPI as any).copyBackgroundImage(result, backgroundType);
        if (copyResult.success) {
          // Reload background images
          const listResult = await (window.electronAPI as any).listBackgroundImages(backgroundType);
          if (listResult.success && listResult.images) {
            setBackgroundImages(listResult.images);
            // Auto-select the newly added image
            setSelectedBackground(copyResult.relativePath);
            if (backgroundType === 'watermark') {
              setFileGridBackgroundPath(copyResult.path);
            } else {
              setBackgroundFillPath(copyResult.path);
            }
            
            // Auto-save the newly added background
            const currentSettings = await settingsService.getSettings();
            const updatedSettings = {
              ...currentSettings,
              backgroundType,
              ...(backgroundType === 'watermark' 
                ? { fileGridBackgroundPath: copyResult.path } 
                : { backgroundFillPath: copyResult.path }
              ),
            };
            
            await settingsService.setSettings(updatedSettings as any);
            (settingsService as any).clearCache();
            window.dispatchEvent(new CustomEvent('settings-updated', { detail: updatedSettings }));
          }
          toast({
            title: 'Success',
            description: 'Background image added and applied successfully',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        } else {
          throw new Error(copyResult.error || 'Failed to copy image');
        }
      }
    } catch (error) {
      console.error('Error adding background image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add background image',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSelectBackground = async (relativePath: string, fullPath: string) => {
    setSelectedBackground(relativePath);
    
    // Update the appropriate state based on background type
    if (backgroundType === 'watermark') {
      setFileGridBackgroundPath(fullPath);
    } else {
      setBackgroundFillPath(fullPath);
    }
    
    // Auto-save the selection immediately
    try {
      const currentSettings = await settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        backgroundType,
        ...(backgroundType === 'watermark' 
          ? { fileGridBackgroundPath: fullPath } 
          : { backgroundFillPath: fullPath }
        ),
      };
      
      console.log('Saving background selection:', {
        backgroundType,
        fullPath,
        updatedSettings
      });
      
      await settingsService.setSettings(updatedSettings as any);
      
      // Clear cache and dispatch event to notify other components
      (settingsService as any).clearCache();
      
      // Wait a bit for cache to clear
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Dispatching settings-updated event');
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: updatedSettings }));
      
      toast({
        title: 'Background applied',
        description: `${backgroundType === 'watermark' ? 'Corner mascot' : 'Background fill'} has been set successfully.`,
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to save background selection:', error);
      toast({
        title: 'Error',
        description: 'Failed to save background selection.',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDeleteBackground = async (filename: string, relativePath: string) => {
    try {
      if (window.electronAPI && (window.electronAPI as any).deleteBackgroundImage) {
        const result = await (window.electronAPI as any).deleteBackgroundImage(backgroundType, filename);
        if (result.success) {
          // Reload background images
          const listResult = await (window.electronAPI as any).listBackgroundImages(backgroundType);
          if (listResult.success && listResult.images) {
            setBackgroundImages(listResult.images);
          }
          // Clear selection if deleted image was selected
          if (selectedBackground === relativePath) {
            setSelectedBackground('');
            if (backgroundType === 'watermark') {
              setFileGridBackgroundPath('');
            } else {
              setBackgroundFillPath('');
            }
            
            // Auto-save to clear the background from settings
            const currentSettings = await settingsService.getSettings();
            const updatedSettings = {
              ...currentSettings,
              ...(backgroundType === 'watermark' 
                ? { fileGridBackgroundPath: '' } 
                : { backgroundFillPath: '' }
              ),
            };
            
            await settingsService.setSettings(updatedSettings as any);
            (settingsService as any).clearCache();
            window.dispatchEvent(new CustomEvent('settings-updated', { detail: updatedSettings }));
          }
          toast({
            title: 'Success',
            description: 'Background image deleted',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        } else {
          throw new Error(result.error || 'Failed to delete image');
        }
      }
    } catch (error) {
      console.error('Error deleting background image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete background image',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleShortcutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setActivationShortcut(event.target.value);
  };

  // Keyboard recorder functions
  const openKeyRecorder = (shortcutType: string) => {
    setCurrentEditingShortcut(shortcutType);
    setRecordingKeys([]);
    setIsKeyRecorderOpen(true);
    
    // Add global keyboard listener
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  };

  const closeKeyRecorder = () => {
    setIsKeyRecorderOpen(false);
    setRecordingKeys([]);
    setCurrentEditingShortcut('');
    
    // Remove global keyboard listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  };

  const clearRecording = () => {
    setRecordingKeys([]);
  };

  const saveRecording = () => {
    if (recordingKeys.length === 0) return;
    
    const newShortcut = recordingKeys.join(' + ');
    
    // Update the appropriate shortcut based on currentEditingShortcut
    switch (currentEditingShortcut) {
      case 'activationShortcut':
        setActivationShortcut(newShortcut);
        break;
      case 'calculatorShortcut':
        setCalculatorShortcut(newShortcut);
        break;
      case 'newTabShortcut':
        setNewTabShortcut(newShortcut);
        break;
      case 'closeTabShortcut':
        setCloseTabShortcut(newShortcut);
        break;
      case 'clientSearchShortcut':
        setClientSearchShortcut(newShortcut);
        break;

    }
    
    closeKeyRecorder();
    toast({
      title: 'Shortcut updated',
      description: `New shortcut: ${newShortcut}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const key = e.key;
    const modifiers: string[] = [];
    
    if (e.ctrlKey) modifiers.push('Ctrl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');
    if (e.metaKey) modifiers.push('Meta');
    
    // Add the main key if it's not a modifier
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      modifiers.push(key);
    }
    
    // Update recording keys
    setRecordingKeys(modifiers);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    // Handle Enter key to save
    if (e.key === 'Enter' && isKeyRecorderOpen) {
      e.preventDefault();
      e.stopPropagation();
      saveRecording();
    }
    
    // Handle Escape key to cancel
    if (e.key === 'Escape' && isKeyRecorderOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeKeyRecorder();
    }
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
              <Text>Display</Text>
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
              <Text>File Grid</Text>
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
              <Text>AI</Text>
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
                
                {/* Shortcuts Table - VS Code Style */}
                <Box
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="sm"
                  overflow="hidden"
                  bg={useColorModeValue('white', 'gray.700')}
                  sx={{
                    '& table': {
                      width: '100%',
                      borderCollapse: 'collapse',
                      borderSpacing: 0,
                    },
                    '& th, & td': {
                      border: 'none',
                      padding: '4px 12px',
                      fontSize: '11px',
                      textAlign: 'left',
                      verticalAlign: 'middle',
                    },
                    '& th': {
                      backgroundColor: useColorModeValue('gray.50', 'gray.800'),
                      borderBottom: `1px solid ${useColorModeValue('gray.200', 'gray.600')}`,
                      fontWeight: '600',
                      color: textColor,
                    },
                    '& tr:nth-of-type(even)': {
                      backgroundColor: useColorModeValue('gray.50', 'gray.700') + ' !important',
                    },
                    '& tr:nth-of-type(odd)': {
                      backgroundColor: useColorModeValue('gray.100', 'gray.750') + ' !important',
                    },
                    '& tr:hover': {
                      backgroundColor: useColorModeValue('gray.150', 'gray.600') + ' !important',
                    },
                    '& tr': {
                      borderBottom: `1px solid ${useColorModeValue('gray.200', 'gray.600')} !important`,
                    },
                    '& td:not(:last-child)': {
                      borderRight: `1px solid ${useColorModeValue('gray.200', 'gray.600')} !important`,
                    },
                  }}
                >
                  <table>
                    {/* Table Header */}
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <Icon as={Edit} boxSize={3} color={useColorModeValue('gray.400', 'gray.500')} />
                        </th>
                        <th>Command</th>
                        <th>Keybinding</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Global Activation */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={<Icon as={Edit} boxSize={2.5} />}
                            onClick={() => openKeyRecorder('activationShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}
                          />
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          Global Activation
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {activationShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Bring app to front from anywhere
                        </td>
                      </tr>

                      {/* Calculator Shortcut */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={<Icon as={Edit} boxSize={2.5} />}
                            onClick={() => openKeyRecorder('calculatorShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}
                          />
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          Open Calculator
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {calculatorShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Quick calculator access
                        </td>
                      </tr>

                      {/* New Tab Shortcut */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={<Icon as={Edit} boxSize={2.5} />}
                            onClick={() => openKeyRecorder('newTabShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}
                          />
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          New Tab
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {newTabShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Create new folder tab
                        </td>
                      </tr>

                      {/* Close Tab Shortcut */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={<Icon as={Edit} boxSize={2.5} />}
                            onClick={() => openKeyRecorder('closeTabShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}
                          />
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          Close Tab
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {closeTabShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Close current tab
                        </td>
                      </tr>

                      {/* Client Search Shortcut */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            icon={<Icon as={Edit} boxSize={2.5} />}
                            onClick={() => openKeyRecorder('clientSearchShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}
                          />
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          Search Clients
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {clientSearchShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Open client search overlay
                        </td>
                      </tr>


                    </tbody>
                  </table>
                </Box>

                <Alert status="info" size="sm" mt={3} borderRadius="sm">
                  <AlertIcon />
          <Box>
                    <AlertTitle fontSize="xs">Shortcut Information</AlertTitle>
                    <AlertDescription fontSize="xs">
                      Global shortcuts work anywhere. Tab shortcuts work when the app is focused. App activation shortcuts work globally.
                    </AlertDescription>
                  </Box>
                </Alert>
              </VStack>

              {/* Keyboard Shortcut Recorder Modal */}
              {isKeyRecorderOpen && (
                <Box
                  position="fixed"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  bg={useColorModeValue('white', 'gray.800')}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius="md"
                  p={6}
                  boxShadow="xl"
                  zIndex={9999}
                  minW="400px"
                  maxW="500px"
                >
                  <VStack spacing={4} align="stretch">
                    <Text fontSize="lg" fontWeight="600" color={textColor} textAlign="center">
                      Press desired key combination and then press ENTER
                    </Text>
                    
                    <Box
                      border="1px solid"
                      borderColor={borderColor}
                      borderRadius="sm"
                      p={4}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      minH="60px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="lg" fontWeight="500" color={textColor}>
                        {recordingKeys.length > 0 ? recordingKeys.join(' + ') : 'Press keys...'}
                      </Text>
                    </Box>

                    {/* Visual Key Representation */}
                    {recordingKeys.length > 0 && (
                      <HStack spacing={2} justify="center">
                        {recordingKeys.map((key, index) => (
                          <React.Fragment key={index}>
                            <Box
                              px={3}
                              py={1.5}
                              bg={useColorModeValue('gray.200', 'gray.600')}
                              borderRadius="md"
                              border="1px solid"
                              borderColor={borderColor}
                            >
                              <Text fontSize="sm" fontWeight="500" color={textColor}>
                                {key}
                              </Text>
                            </Box>
                            {index < recordingKeys.length - 1 && (
                              <Text fontSize="lg" color={secondaryTextColor}>+</Text>
                            )}
                          </React.Fragment>
                        ))}
                      </HStack>
                    )}

                    <HStack spacing={3} justify="center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearRecording}
                        colorScheme="gray"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={closeKeyRecorder}
                        colorScheme="gray"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={saveRecording}
                        isDisabled={recordingKeys.length === 0}
                      >
                        Save
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              )}
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
                    Interface Options
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                    Control interface behavior and functionality
                  </Text>
                </Box>
                
                <VStack spacing={2.5} align="stretch">
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
                          <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Activity Tracking</FormLabel>
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Track active window titles while timer is running (for productivity insights)
                          </Text>
                        </VStack>
                        <Switch
                          isChecked={enableActivityTracking}
                          onChange={(e) => setEnableActivityTracking(e.target.checked)}
                          colorScheme="blue"
                          size="sm"
                        />
                      </HStack>
                    </FormControl>
                  </Box>

                  <Divider my={3.5} />

                  <Box pb={3.5}>
                    <Heading size="sm" mb={1.5} color={textColor} display="flex" alignItems="center" gap={2}>
                      Work Shift
                    </Heading>
                    <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                      Configure your work shift hours for the timer infographic
                    </Text>
                    <VStack spacing={2.5} align="stretch">
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Shift Start Time</FormLabel>
                        <Input
                          type="time"
                          value={workShiftStart}
                          onChange={(e) => setWorkShiftStart(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Shift End Time</FormLabel>
                        <Input
                          type="time"
                          value={workShiftEnd}
                          onChange={(e) => setWorkShiftEnd(e.target.value)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                      </FormControl>
                      <FormControl>
                        <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Productivity Target (hours)</FormLabel>
                        <Text fontSize="xs" color={secondaryTextColor} mb={1}>
                          Daily target for time worked (e.g., 7.5 for 7 hours 30 minutes)
                        </Text>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={productivityTargetHours}
                          onChange={(e) => setProductivityTargetHours(parseFloat(e.target.value) || 0)}
                          bg="white"
                          _dark={{ bg: 'gray.600' }}
                          borderRadius="sm"
                          fontSize="xs"
                          h="31px"
                        />
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              </VStack>
            </TabPanel>

            {/* Display Tab */}
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
                    Control interface visibility and appearance
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

                  <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="sm" border="1px solid" borderColor={borderColor}>
                    <FormControl>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Theme</FormLabel>
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Switch between light and dark mode
                          </Text>
                        </VStack>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="Light mode"
                            icon={<Sun size={16} />}
                            size="sm"
                            variant={colorMode === 'light' ? 'solid' : 'ghost'}
                            colorScheme={colorMode === 'light' ? 'blue' : 'gray'}
                            onClick={() => {
                              setColorMode('light');
                              localStorage.setItem('chakra-ui-color-mode', 'light');
                              if (window.electronAPI && (window.electronAPI as any).broadcastThemeChange) {
                                (window.electronAPI as any).broadcastThemeChange('light');
                              }
                              window.dispatchEvent(new StorageEvent('storage', {
                                key: 'chakra-ui-color-mode',
                                newValue: 'light',
                                storageArea: localStorage
                              }));
                            }}
                          />
                          <IconButton
                            aria-label="Dark mode"
                            icon={<Moon size={16} />}
                            size="sm"
                            variant={colorMode === 'dark' ? 'solid' : 'ghost'}
                            colorScheme={colorMode === 'dark' ? 'blue' : 'gray'}
                            onClick={() => {
                              setColorMode('dark');
                              localStorage.setItem('chakra-ui-color-mode', 'dark');
                              if (window.electronAPI && (window.electronAPI as any).broadcastThemeChange) {
                                (window.electronAPI as any).broadcastThemeChange('dark');
                              }
                              window.dispatchEvent(new StorageEvent('storage', {
                                key: 'chakra-ui-color-mode',
                                newValue: 'dark',
                                storageArea: localStorage
                              }));
                            }}
                          />
                        </HStack>
                      </HStack>
                    </FormControl>
                  </Box>

                  <Divider my={3.5} />

                  <Box>
                    <Heading size="sm" mb={1.5} color={textColor}>Background Images</Heading>
                    <Text fontSize="sm" color={secondaryTextColor} mb={2}>
                      Customize background images for the file grid
                    </Text>
                    
                    <FormControl mb={4}>
                      <FormLabel fontSize="xs" fontWeight="500" color={textColor} mb={1}>Background Type</FormLabel>
                      <Select
                        value={backgroundType}
                        onChange={(e) => setBackgroundType(e.target.value as 'watermark' | 'backgroundFill')}
                        bg="white"
                        color="black"
                        _dark={{ bg: 'gray.600', color: 'white' }}
                        borderRadius="0"
                        fontSize="xs"
                        h="46px"
                        size="sm"
                        sx={{
                          '& option': {
                            minHeight: '46px',
                            lineHeight: '46px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                          },
                        }}
                      >
                        <option value="watermark" style={{ background: 'inherit', color: 'inherit' }}>Corner Mascot (Bottom-right corner, 100% opacity)</option>
                        <option value="backgroundFill" style={{ background: 'inherit', color: 'inherit' }}>Background Fill (Fills filegrid, 15% opacity)</option>
                      </Select>
                    </FormControl>

                    <Box mb={4}>
                      <HStack justify="space-between" mb={2}>
                        <Text fontSize="xs" fontWeight="500" color={textColor}>
                          Available {backgroundType === 'watermark' ? 'Corner Mascots' : 'Background Fills'}
                        </Text>
                        <Button
                          size="xs"
                          leftIcon={<Icon as={Plus} boxSize={3.5} />}
                          onClick={handleAddBackground}
                          colorScheme="blue"
                        >
                          Add Background
                        </Button>
                      </HStack>
                      
                      {backgroundImages.length === 0 ? (
                        <Box
                          p={8}
                          border="2px dashed"
                          borderColor={borderColor}
                          borderRadius="sm"
                          textAlign="center"
                          bg={useColorModeValue('gray.50', 'gray.700')}
                        >
                          <Icon as={ImageIcon} boxSize={8} color={secondaryTextColor} mb={2} />
                          <Text fontSize="sm" color={secondaryTextColor}>
                            No {backgroundType === 'watermark' ? 'corner mascots' : 'background fills'} available
                          </Text>
                          <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                            Click "Add Background" to add your first image
                          </Text>
                        </Box>
                      ) : (
                        <SimpleGrid 
                          columns={{ base: 2, md: 3, lg: 4 }} 
                          spacing={3}
                          justifyItems="start"
                        >
                          {backgroundImages.map((img) => {
                            const isSelected = selectedBackground === img.relativePath;
                            return (
                              <BackgroundThumbnail
                                key={img.relativePath}
                                img={img}
                                isSelected={isSelected}
                                borderColor={borderColor}
                                onSelect={() => handleSelectBackground(img.relativePath, img.path)}
                                onDelete={() => handleDeleteBackground(img.filename, img.relativePath)}
                              />
                            );
                          })}
                        </SimpleGrid>
                      )}
                    </Box>
                  </Box>
                </VStack>
              </VStack>
            </TabPanel>

            {/* File Grid Tab */}
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
              <VStack spacing={2.5} align="stretch">
                <Box pb={1.5}>
                  <Heading size="sm" mb={1.5} color={textColor}>File Grid Options</Heading>
                  <Text fontSize="sm" color={secondaryTextColor}>
                    Control how files are displayed in the file grid
                  </Text>
                </Box>

                <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} border="1px solid" borderColor={borderColor} borderRadius="sm">
                  <FormControl>
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Hide Temporary Files</FormLabel>
                        <Text fontSize="xs" color={secondaryTextColor}>
                          Hide files that start with ~$, typically created by Office when a document is open
                        </Text>
                      </VStack>
                      <Switch
                        isChecked={hideTemporaryFiles}
                        onChange={(e) => setHideTemporaryFiles(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                  </FormControl>
                </Box>

                <Box p={2.5} bg={useColorModeValue('gray.50', 'gray.700')} border="1px solid" borderColor={borderColor} borderRadius="sm">
                  <FormControl>
                    <HStack justify="space-between">
                      <VStack align="start" spacing={1}>
                        <FormLabel fontSize="xs" fontWeight="600" color={textColor} mb={0}>Hide Dot Files</FormLabel>
                        <Text fontSize="xs" color={secondaryTextColor}>
                          Hide files and folders that start with a dot (.), such as .git, .vscode, etc.
                        </Text>
                      </VStack>
                      <Switch
                        isChecked={hideDotFiles}
                        onChange={(e) => setHideDotFiles(e.target.checked)}
                        colorScheme="blue"
                        size="sm"
                      />
                    </HStack>
                  </FormControl>
                </Box>

              </VStack>
            </TabPanel>

            {/* AI Tab */}
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
              <VStack spacing={6} align="stretch">
                {/* AI Editor Section */}
                <Box>
                  <Heading size="md" mb={2} color={textColor}>
                    AI Editor
                  </Heading>
                  <Text fontSize="sm" color={secondaryTextColor} mb={4}>
                    Customize the instructions that guide the AI when rewriting emails
                  </Text>
                  
                  <VStack spacing={4} align="stretch">
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" color={textColor} mb={2}>
                        Custom Instructions
                      </Text>
                      <Text fontSize="sm" color={secondaryTextColor} mb={3}>
                        Instructions shown to users when they open the AI Email Editor dialog
                      </Text>
                      <Textarea
                        value={aiEditorInstructions}
                        onChange={(e) => setAiEditorInstructions(e.target.value)}
                        placeholder="Enter custom instructions for the AI editor..."
                        minH="120px"
                        maxH="240px"
                        resize="vertical"
                        bg={useColorModeValue('white', 'gray.700')}
                        borderColor={useColorModeValue('gray.300', 'gray.600')}
                        borderRadius="0"
                        _hover={{
                          borderColor: useColorModeValue('gray.400', 'gray.500')
                        }}
                        _focus={{
                          borderColor: 'blue.500',
                          boxShadow: '0 0 0 1px #3182ce'
                        }}
                        fontSize="sm"
                      />
                    </Box>
                  </VStack>
                </Box>
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