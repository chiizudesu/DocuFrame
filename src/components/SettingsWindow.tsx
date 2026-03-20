import React, { useEffect, useState } from 'react';
import { useColorModeValue, useColorMode } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from "@/components/ui/toaster"
import {
  Button,
  Input,
  Switch,
  Box,
  Text,
  Tabs,
  VStack,
  HStack,
  Icon,
  Alert,
  NativeSelect,
  Kbd,
  Flex,
  Spacer,
  IconButton,
  Textarea,
  SimpleGrid,
  Image,
  Field,
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
  Trash2,
  Download,
} from 'lucide-react';
import { settingsService } from '../services/settings';
import {
  DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  LEGACY_JUMP_MODE_ON_PARENT_SHORTCUT,
} from '../constants/shortcutDefaults';
import { useAppContext } from '../context/AppContext';
import { normalizePath } from '../utils/path';
import {
  AffixedInputRow,
  PathInputRow,
  SettingsGroup,
  SettingsScrollPanel,
  SettingsSection,
  SettingsToggleRow,
  SETTINGS_CONTROL_H,
} from './settings-window/SettingsWindowPrimitives';

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
  const thumbSurface = useColorModeValue('white', '#4A5568');
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
      borderRadius={0}
      overflow="hidden"
      cursor="pointer"
      bg={thumbSurface}
      _hover={{
        borderColor: 'blue.400',
        '& .delete-button': {
          opacity: 1,
        },
      }}
      onClick={onSelect}
      width="150px"
      css={{
        aspectRatio: '16 / 9'
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
          borderRadius={0}
          w={5}
          h={5}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon boxSize={3} asChild><Save /></Icon>
        </Box>
      )}
      <IconButton
        aria-label="Delete background"
        size="xs"
        colorPalette="red"
        position="absolute"
        top={1}
        left={1}
        opacity={0}
        className="delete-button"
        transition="opacity 0.2s"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}><Icon boxSize={3.5} asChild><Trash2 /></Icon></IconButton>
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
          truncate
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
  claudeApiKey?: string;
  gstTemplatePath?: string;
  clientbasePath?: string;
  showClientInfoBar?: boolean;
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
  jumpModeOnParentShortcut?: string;
  enableJumpModeOnParentShortcut?: boolean;
  jumpModeQuickFolderPaths?: string[];
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
  enableBackgrounds?: boolean;
  groupViewAlwaysEnabled?: boolean;
  groupViewBlacklist?: string[];

}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const { colorMode, toggleColorMode, setColorMode } = useColorMode();
  const [rootPath, setRootPath] = useState('');
  const [originalRootPath, setOriginalRootPath] = useState('');
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
  const [jumpModeOnParentShortcut, setJumpModeOnParentShortcut] = useState(
    DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  );
  const [enableJumpModeOnParentShortcut, setEnableJumpModeOnParentShortcut] = useState(true);
  const [jumpModeQuickFolderPaths, setJumpModeQuickFolderPaths] = useState<string[]>(['', '', '']);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [sidebarCollapsedByDefault, setSidebarCollapsedByDefault] = useState(false);
  const [hideTemporaryFiles, setHideTemporaryFiles] = useState(true);
  const [hideDotFiles, setHideDotFiles] = useState(true);
  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [productivityTargetHours, setProductivityTargetHours] = useState(7.5);
  const [enableActivityTracking, setEnableActivityTracking] = useState(true);
  const [fileGridBackgroundPath, setFileGridBackgroundPath] = useState('');
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark');
  const [backgroundFillPath, setBackgroundFillPath] = useState('');
  const [backgroundImages, setBackgroundImages] = useState<Array<{ filename: string; path: string; relativePath: string }>>([]);
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [enableBackgrounds, setEnableBackgrounds] = useState(true);
  const [groupViewAlwaysEnabled, setGroupViewAlwaysEnabled] = useState(true);
  const [groupViewBlacklist, setGroupViewBlacklist] = useState<string[]>([]);
  const [groupViewBlacklistInput, setGroupViewBlacklistInput] = useState('');

  // Keyboard recorder state
  const [isKeyRecorderOpen, setIsKeyRecorderOpen] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [currentEditingShortcut, setCurrentEditingShortcut] = useState<string>('');
  const { setRootDirectory, showClientInfoBar, setShowClientInfoBar, reloadSettings } = useAppContext();

  const {
    surfaceBg: bgColor,
    titleBarBg,
    cardBg,
    inputBg,
    borderColor,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();
  const tabBarBg = cardBg;
  const tabInactiveColor = useColorModeValue('gray.600', 'gray.400');
  const tabHoverBg = useColorModeValue('gray.300', 'df.chromeHover');
  const tabSelectedBg = bgColor;
  const tabSelectedColor = useColorModeValue('gray.800', 'white');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.getSettings() as Settings;
        setRootPath(loadedSettings.rootPath);
        setOriginalRootPath(loadedSettings.rootPath);
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
        setJumpModeOnParentShortcut(
          loadedSettings.jumpModeOnParentShortcut === LEGACY_JUMP_MODE_ON_PARENT_SHORTCUT
            ? DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT
            : loadedSettings.jumpModeOnParentShortcut || DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
        );
        setEnableJumpModeOnParentShortcut(loadedSettings.enableJumpModeOnParentShortcut !== false);
        {
          const next = ['', '', ''];
          const q = loadedSettings.jumpModeQuickFolderPaths;
          if (Array.isArray(q)) {
            for (let i = 0; i < 3; i++) {
              next[i] = typeof q[i] === 'string' ? q[i].trim() : '';
            }
          }
          setJumpModeQuickFolderPaths(next);
        }
        setSidebarCollapsedByDefault(loadedSettings.sidebarCollapsedByDefault || false);
        settingsService.getTemplateFolderPath().then(path => setTemplateFolderPath(path || ''));
        settingsService.getWorkpaperTemplateFolderPath().then(path => setWorkpaperTemplateFolderPath(path || ''));
        // NEW: file grid setting (default true when unset)
        setHideTemporaryFiles(loadedSettings.hideTemporaryFiles !== false);
        setHideDotFiles(loadedSettings.hideDotFiles !== false);
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
        setEnableBackgrounds(loadedSettings.enableBackgrounds !== false);
        setGroupViewAlwaysEnabled(loadedSettings.groupViewAlwaysEnabled !== false);
        setGroupViewBlacklist(Array.isArray(loadedSettings.groupViewBlacklist) ? loadedSettings.groupViewBlacklist.map((p: string) => normalizePath(p)).filter(Boolean) : []);

      } catch (error) {
        console.error('Error loading settings:', error);
        showToast({
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
  }, [isOpen]);

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
        claudeApiKey: claudeApiKey || undefined,
        gstTemplatePath: gstTemplatePath || undefined,
        clientbasePath: clientbasePath || undefined,
        showClientInfoBar,
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
        jumpModeOnParentShortcut,
        enableJumpModeOnParentShortcut,
        jumpModeQuickFolderPaths: jumpModeQuickFolderPaths.map((s) => (typeof s === 'string' ? s.trim() : '')),
        sidebarCollapsedByDefault,
        hideTemporaryFiles,
        hideDotFiles,
        workShiftStart,
        workShiftEnd,
        productivityTargetHours,
        enableActivityTracking,
        fileGridBackgroundPath,
        backgroundType,
        backgroundFillPath,
        enableBackgrounds,
        groupViewAlwaysEnabled,
        groupViewBlacklist,

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
      
      // Force a re-render to show updated shortcuts immediately
      setActivationShortcut(activationShortcut);
      setCalculatorShortcut(calculatorShortcut);
      setNewTabShortcut(newTabShortcut);
      setCloseTabShortcut(closeTabShortcut);
      setClientSearchShortcut(clientSearchShortcut);
      
      // Dispatch event to notify other components of settings change
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: newSettings }));
      
      showToast({
        title: 'Settings saved',
        description: 'All settings have been updated and applied immediately.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast({
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
      showToast({
        title: 'Error',
        description: 'Failed to select directory',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleExportSettings = async () => {
    try {
      const dir = await window.electronAPI.selectDirectory();
      if (!dir) return;
      const config = await window.electronAPI.getConfig();
      const date = new Date();
      const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const sep = dir.includes('\\') ? '\\' : '/';
      const base = dir.replace(/[/\\]+$/, '');
      const filePath = `${base}${sep}docuframe-settings-${stamp}.json`;
      const content = JSON.stringify(config, null, 2);
      await window.electronAPI.writeTextFile(filePath, content);
      showToast({
        title: 'Settings exported',
        description: filePath,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting settings:', error);
      showToast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Could not write settings file',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const pickJumpQuickFolder = async (slot: number) => {
    try {
      const result = await (window.electronAPI as any).selectDirectory();
      if (result) {
        setJumpModeQuickFolderPaths((prev) => {
          const n = [...prev];
          while (n.length < 3) n.push('');
          n[slot] = result;
          return n;
        });
      }
    } catch (error) {
      console.error('Error selecting jump folder:', error);
      showToast({
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
      showToast({
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
      showToast({
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
      showToast({
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
      showToast({
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
      showToast({
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
          showToast({
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
      showToast({
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
      
      showToast({
        title: 'Background applied',
        description: `${backgroundType === 'watermark' ? 'Corner mascot' : 'Background fill'} has been set successfully.`,
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to save background selection:', error);
      showToast({
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
          showToast({
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
      showToast({
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
      case 'jumpModeOnParentShortcut':
        setJumpModeOnParentShortcut(newShortcut);
        break;

    }
    
    closeKeyRecorder();
    showToast({
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
        bg={titleBarBg}
        h="31px"
        style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
        px={0}
        borderBottom="1px solid"
        borderColor={borderColor}
        flexShrink={0}
      >
        <Box display="flex" alignItems="center" gap={2} pl={3}>
          <Icon boxSize={3.5} color="blue.500" asChild><SettingsIcon /></Icon>
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
            <Icon boxSize={3.5} asChild><X /></Icon>
          </Button>
        </Flex>
      </Flex>
      {/* Main Content */}
      <Box flex="1" display="flex" overflow="hidden">
        <Tabs.Root defaultValue="paths" variant='line' colorPalette="blue" orientation="vertical" h="full" display="flex" w="full">
          <Box w="160px" minH="100%" bg={tabBarBg} borderRight="1px solid" borderColor={borderColor} flexShrink={0}>
          <Tabs.List 
            w="full"
            p={3}
            gap={0.5}
            bg="transparent"
            flexDirection="column"
            alignItems="stretch"
          >
            <Tabs.Trigger value="paths"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>Paths</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="api"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>API & Data</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="shortcuts"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>Shortcuts</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="interface"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>Interface</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="display"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>Display</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="filegrid"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>File Grid</Text>
            </Tabs.Trigger>
            <Tabs.Trigger value="groupview"
              justifyContent="flex-start" 
              px={2} 
              py={1.5}
              borderRadius={0}
              fontSize="sm"
              fontWeight="500"
              color={tabInactiveColor}
              _selected={{ 
                bg: tabSelectedBg, 
                color: tabSelectedColor, 
                borderLeft: '3px solid',
                borderLeftColor: 'blue.500',
              }}
              _hover={{ bg: tabHoverBg }}
              transition="all 0.2s"
            >
              <Text>Group View</Text>
            </Tabs.Trigger>
          </Tabs.List>
          </Box>

          <Box flex="1" p={0} overflow="hidden">
            {/* Paths Tab */}
            <Tabs.Content value="paths" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack align="stretch" gap={8}>
                  <SettingsSection
                    title="Root directory"
                    description="Default directory for file operations"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  >
                    <PathInputRow
                      value={rootPath}
                      onChange={(e) => setRootPath(e.target.value)}
                      placeholder="Enter root path"
                      onBrowse={handleBrowseFolder}
                      inputBg={inputBg}
                      borderColor={borderColor}
                      browseAriaLabel="Browse root folder"
                    />
                  </SettingsSection>

                  <SettingsSection
                    title="Template files"
                    description="GST template and AI / workpaper template folders"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  >
                    <VStack gap={2.5} align="stretch">
                      <Field.Root>
                        <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                          GST template path
                        </Field.Label>
                        <PathInputRow
                          value={gstTemplatePath}
                          onChange={(e) => setGstTemplatePath(e.target.value)}
                          placeholder="Enter GST template file path"
                          onBrowse={handleBrowseGstTemplate}
                          inputBg={inputBg}
                          borderColor={borderColor}
                          browseAriaLabel="Browse GST template file"
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                          AI email template folder
                        </Field.Label>
                        <Text fontSize="xs" color={secondaryTextColor} mb={1} lineHeight="short">
                          YAML templates for AI Templater
                        </Text>
                        <PathInputRow
                          value={templateFolderPath}
                          readOnly
                          placeholder="Select AI email template folder…"
                          onBrowse={handleTemplateFolderChange}
                          inputBg={inputBg}
                          borderColor={borderColor}
                        />
                      </Field.Root>
                      <Field.Root>
                        <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                          Workpaper template folder
                        </Field.Label>
                        <Text fontSize="xs" color={secondaryTextColor} mb={1} lineHeight="short">
                          Excel templates for workpaper creation
                        </Text>
                        <PathInputRow
                          value={workpaperTemplateFolderPath}
                          readOnly
                          placeholder="Select workpaper template folder…"
                          onBrowse={handleWorkpaperTemplateFolderChange}
                          inputBg={inputBg}
                          borderColor={borderColor}
                        />
                      </Field.Root>
                    </VStack>
                  </SettingsSection>

                  <Flex align="center" justify="space-between" gap={3} wrap="wrap" pt={1}>
                    <Text fontSize="xs" fontWeight="semibold" color={textColor}>
                      Export settings
                    </Text>
                    <Button size="xs" h={SETTINGS_CONTROL_H} px={2} fontSize="xs" onClick={handleExportSettings} borderRadius="md" flexShrink={0}>
                      <Icon boxSize={3.5} asChild>
                        <Download />
                      </Icon>
                      Export…
                    </Button>
                  </Flex>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>

            {/* API & Data Tab */}
            <Tabs.Content value="api" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack align="stretch" gap={8}>
                  <SettingsSection
                    title="API keys"
                    description="Anthropic API key for AI features in DocuFrame"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  >
                    <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                      <Box px={2.5} py={1.5}>
                        <Field.Root>
                          <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                            Claude (Anthropic)
                          </Field.Label>
                          <AffixedInputRow
                            borderColor={borderColor}
                            inputProps={{
                              value: claudeApiKey,
                              onChange: (e) => setClaudeApiKey(e.target.value),
                              type: showClaudeKey ? 'text' : 'password',
                              placeholder: 'Anthropic API key',
                              bg: 'white',
                              _dark: { bg: inputBg },
                            }}
                            suffix={
                              <IconButton
                                variant="ghost"
                                borderRadius={0}
                                h="full"
                                minW="28px"
                                w="28px"
                                size="xs"
                                onClick={() => setShowClaudeKey(!showClaudeKey)}
                                aria-label={showClaudeKey ? 'Hide API key' : 'Show API key'}
                              >
                                {showClaudeKey ? (
                                  <Icon boxSize={3.5} asChild>
                                    <EyeOff />
                                  </Icon>
                                ) : (
                                  <Icon boxSize={3.5} asChild>
                                    <Eye />
                                  </Icon>
                                )}
                              </IconButton>
                            }
                          />
                        </Field.Root>
                      </Box>
                    </SettingsGroup>
                  </SettingsSection>

                  <SettingsSection
                    title="Data sources"
                    description="Client database CSV"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  >
                    <Field.Root>
                      <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                        Clientbase CSV path
                      </Field.Label>
                      <PathInputRow
                        value={clientbasePath}
                        onChange={(e) => setClientbasePath(e.target.value)}
                        placeholder="Enter clientbase CSV file path"
                        onBrowse={handleBrowseClientbase}
                        inputBg={inputBg}
                        borderColor={borderColor}
                        browseAriaLabel="Browse clientbase CSV"
                      />
                    </Field.Root>
                  </SettingsSection>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>

            {/* Shortcuts Tab */}
            <Tabs.Content value="shortcuts" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack gap={8} align="stretch">
                  <SettingsSection
                    title="Keyboard shortcuts"
                    description="Click edit to record a new binding"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />

                {/* Shortcuts table — full gridlines */}
                <Box
                  border={`1px solid ${borderColor}`}
                  borderRadius="md"
                  overflow="hidden"
                  bg={bgColor}
                  css={{
                    '& table': {
                      width: '100%',
                      borderCollapse: 'collapse',
                      borderSpacing: 0,
                      tableLayout: 'fixed',
                    },

                    '& table th, & table td': {
                      border: `1px solid ${borderColor}`,
                      padding: '2px 6px',
                      fontSize: '11px',
                      textAlign: 'left',
                      verticalAlign: 'middle',
                    },

                    '& table thead th': {
                      backgroundColor: useColorModeValue('gray.100', '#2d3748'),
                      fontWeight: '600',
                      color: textColor,
                    },

                    '& table tbody tr:hover td': {
                      backgroundColor: useColorModeValue('gray.50', '#2a3142'),
                    },
                  }}
                >
                  <table>
                    {/* Table Header */}
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <Icon boxSize={3} color={useColorModeValue('gray.400', 'gray.500')} asChild><Edit /></Icon>
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
                            onClick={() => openKeyRecorder('activationShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
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
                            onClick={() => openKeyRecorder('calculatorShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
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
                            onClick={() => openKeyRecorder('newTabShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
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
                            onClick={() => openKeyRecorder('closeTabShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
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
                            onClick={() => openKeyRecorder('clientSearchShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
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

                      {/* Address bar filter at parent (same behavior as in-bar backspace when filter is open) */}
                      <tr>
                        <td style={{ textAlign: 'center' }}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            onClick={() => openKeyRecorder('jumpModeOnParentShortcut')}
                            aria-label="Change shortcut"
                            color={useColorModeValue('gray.500', 'gray.400')}
                            _hover={{ color: 'blue.500', bg: useColorModeValue('blue.50', 'blue.900') }}><Icon boxSize={2.5} asChild><Edit /></Icon></IconButton>
                        </td>
                        <td style={{ fontWeight: '500', color: textColor }}>
                          Address bar at parent
                        </td>
                        <td>
                          <Text fontSize="10px" color={textColor}>
                            {jumpModeOnParentShortcut}
                          </Text>
                        </td>
                        <td style={{ color: secondaryTextColor }}>
                          Opens the address-bar filter on the parent folder; when the filter is already open, the same shortcut moves up one folder at a time (see address bar preview)
                        </td>
                      </tr>


                    </tbody>
                  </table>
                </Box>

                <SettingsSection
                  title="Jump mode quick folders"
                  description="F1 uses workspace root. F2–F4 use paths below when under your breadcrumb trail. F5 stays free for refresh. Save to apply."
                  textColor={textColor}
                  secondaryTextColor={secondaryTextColor}
                  mb={0}
                >
                  <VStack align="stretch" gap={1.5}>
                    <HStack align="center" gap={2}>
                      <Text fontSize="xs" fontWeight="semibold" w="32px" flexShrink={0} color={textColor}>
                        F1
                      </Text>
                      <Input
                        h={SETTINGS_CONTROL_H}
                        fontSize="xs"
                        readOnly
                        value={rootPath ? normalizePath(rootPath) : ''}
                        placeholder="Set workspace root in Paths"
                        flex={1}
                        bg="white"
                        _dark={{ bg: inputBg }}
                        borderRadius="md"
                      />
                    </HStack>
                    {([0, 1, 2] as const).map((slot) => (
                      <HStack key={slot} align="center" gap={2}>
                        <Text fontSize="xs" fontWeight="semibold" w="32px" flexShrink={0} color={textColor}>
                          F{slot + 2}
                        </Text>
                        <Input
                          h={SETTINGS_CONTROL_H}
                          fontSize="xs"
                          value={jumpModeQuickFolderPaths[slot] ?? ''}
                          onChange={(e) => {
                            setJumpModeQuickFolderPaths((prev) => {
                              const n = [...prev];
                              while (n.length < 3) n.push('');
                              n[slot] = e.target.value;
                              return n;
                            });
                          }}
                          placeholder="Browse or paste folder path…"
                          flex={1}
                          bg="white"
                          _dark={{ bg: inputBg }}
                          borderRadius="md"
                        />
                        <Button h={SETTINGS_CONTROL_H} size="xs" px={2} fontSize="xs" borderRadius="md" onClick={() => pickJumpQuickFolder(slot)}>
                          Browse
                        </Button>
                        <Button
                          h={SETTINGS_CONTROL_H}
                          size="xs"
                          px={2}
                          fontSize="xs"
                          variant="ghost"
                          borderRadius="md"
                          onClick={() => {
                            setJumpModeQuickFolderPaths((prev) => {
                              const n = [...prev];
                              while (n.length < 3) n.push('');
                              n[slot] = '';
                              return n;
                            });
                          }}
                        >
                          Clear
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                </SettingsSection>

                <Alert.Root status="info" size="sm" mt={0} borderRadius="md">
                  <Alert.Indicator />
                  <Box>
                    <Alert.Title fontSize="xs">Shortcut information</Alert.Title>
                    <Alert.Description fontSize="xs">
                      Global shortcuts work anywhere. Tab shortcuts apply when the app is focused.
                    </Alert.Description>
                  </Box>
                </Alert.Root>
              </VStack>
              </SettingsScrollPanel>

              {/* Keyboard Shortcut Recorder Modal */}
              {isKeyRecorderOpen && (
                <Box
                  position="fixed"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  bg={bgColor}
                  border="1px solid"
                  borderColor={borderColor}
                  borderRadius={0}
                  p={6}
                  boxShadow="xl"
                  zIndex={9999}
                  minW="400px"
                  maxW="500px"
                >
                  <VStack gap={4} align="stretch">
                    <Text fontSize="lg" fontWeight="600" color={textColor} textAlign="center">
                      Press desired key combination and then press ENTER
                    </Text>
                    
                    <Box
                      border="1px solid"
                      borderColor={borderColor}
                      borderRadius={0}
                      p={4}
                      bg={cardBg}
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
                      <HStack gap={2} justify="center">
                        {recordingKeys.map((key, index) => (
                          <React.Fragment key={index}>
                            <Box
                              px={3}
                              py={1.5}
                              bg={useColorModeValue('gray.200', inputBg)}
                              borderRadius={0}
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

                    <HStack gap={2} justify="center">
                      <Button
                        size="xs"
                        h={SETTINGS_CONTROL_H}
                        px={2}
                        fontSize="xs"
                        variant="outline"
                        onClick={clearRecording}
                        colorPalette="gray"
                      >
                        Clear
                      </Button>
                      <Button
                        size="xs"
                        h={SETTINGS_CONTROL_H}
                        px={2}
                        fontSize="xs"
                        variant="outline"
                        onClick={closeKeyRecorder}
                        colorPalette="gray"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="xs"
                        h={SETTINGS_CONTROL_H}
                        px={2}
                        fontSize="xs"
                        colorPalette="blue"
                        onClick={saveRecording}
                        disabled={recordingKeys.length === 0}
                      >
                        Save
                      </Button>
                    </HStack>
                  </VStack>
                </Box>
              )}
            </Tabs.Content>

            {/* Interface Tab */}
            <Tabs.Content value="interface" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack gap={8} align="stretch">
                  <SettingsSection
                    title="Behavior"
                    description="Filesystem and productivity timer"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />
                  <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                    <SettingsToggleRow
                      title="File system watching"
                      description="Auto-refresh when files change outside the app"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={enableFileWatching}
                          onCheckedChange={(d) => setEnableFileWatching(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <SettingsToggleRow
                      title="Activity tracking"
                      description="Record active window titles while the timer runs"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      control={
                        <Switch.Root
                          checked={enableActivityTracking}
                          onCheckedChange={(d) => setEnableActivityTracking(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                  </SettingsGroup>

                  <SettingsSection
                    title="Work shift"
                    description="Hours used for the timer infographic (e.g. 7.5 = 7h 30m target)"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  >
                    <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                      <Box px={2.5} py={1.5} borderBottomWidth="1px" borderColor={borderColor}>
                        <Field.Root>
                          <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                            Shift start
                          </Field.Label>
                          <Input
                            type="time"
                            value={workShiftStart}
                            onChange={(e) => setWorkShiftStart(e.target.value)}
                            bg="white"
                            _dark={{ bg: inputBg }}
                            borderRadius="md"
                            fontSize="xs"
                            h={SETTINGS_CONTROL_H}
                          />
                        </Field.Root>
                      </Box>
                      <Box px={2.5} py={1.5} borderBottomWidth="1px" borderColor={borderColor}>
                        <Field.Root>
                          <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                            Shift end
                          </Field.Label>
                          <Input
                            type="time"
                            value={workShiftEnd}
                            onChange={(e) => setWorkShiftEnd(e.target.value)}
                            bg="white"
                            _dark={{ bg: inputBg }}
                            borderRadius="md"
                            fontSize="xs"
                            h={SETTINGS_CONTROL_H}
                          />
                        </Field.Root>
                      </Box>
                      <Box px={2.5} py={1.5}>
                        <Field.Root>
                          <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                            Productivity target (hours)
                          </Field.Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={productivityTargetHours}
                            onChange={(e) => setProductivityTargetHours(parseFloat(e.target.value) || 0)}
                            bg="white"
                            _dark={{ bg: inputBg }}
                            borderRadius="md"
                            fontSize="xs"
                            h={SETTINGS_CONTROL_H}
                          />
                        </Field.Root>
                      </Box>
                    </SettingsGroup>
                  </SettingsSection>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>

            {/* Display Tab */}
            <Tabs.Content value="display" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack gap={8} align="stretch">
                  <SettingsSection
                    title="Layout & theme"
                    description="Client bar, sidebar, and color mode"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />
                  <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                    <SettingsToggleRow
                      title="Client info bar"
                      description="Name, IRD, and job links below the file grid"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={showClientInfoBar}
                          onCheckedChange={(d) => setShowClientInfoBar(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <SettingsToggleRow
                      title="Sidebar collapsed by default"
                      description="Start with the sidebar collapsed"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={sidebarCollapsedByDefault}
                          onCheckedChange={(d) => setSidebarCollapsedByDefault(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <SettingsToggleRow
                      title="Theme"
                      description="Light or dark UI"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      control={
                        <HStack gap={1} flexShrink={0}>
                          <IconButton
                            aria-label="Light mode"
                            size="xs"
                            h={SETTINGS_CONTROL_H}
                            minW={SETTINGS_CONTROL_H}
                            variant={colorMode === 'light' ? 'solid' : 'ghost'}
                            colorPalette={colorMode === 'light' ? 'blue' : 'gray'}
                            borderRadius="md"
                            onClick={() => {
                              setColorMode('light');
                              localStorage.setItem('chakra-ui-color-mode', 'light');
                              if (window.electronAPI && (window.electronAPI as any).broadcastThemeChange) {
                                (window.electronAPI as any).broadcastThemeChange('light');
                              }
                              window.dispatchEvent(
                                new StorageEvent('storage', {
                                  key: 'chakra-ui-color-mode',
                                  newValue: 'light',
                                  storageArea: localStorage,
                                }),
                              );
                            }}
                          >
                            <Sun size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Dark mode"
                            size="xs"
                            h={SETTINGS_CONTROL_H}
                            minW={SETTINGS_CONTROL_H}
                            variant={colorMode === 'dark' ? 'solid' : 'ghost'}
                            colorPalette={colorMode === 'dark' ? 'blue' : 'gray'}
                            borderRadius="md"
                            onClick={() => {
                              setColorMode('dark');
                              localStorage.setItem('chakra-ui-color-mode', 'dark');
                              if (window.electronAPI && (window.electronAPI as any).broadcastThemeChange) {
                                (window.electronAPI as any).broadcastThemeChange('dark');
                              }
                              window.dispatchEvent(
                                new StorageEvent('storage', {
                                  key: 'chakra-ui-color-mode',
                                  newValue: 'dark',
                                  storageArea: localStorage,
                                }),
                              );
                            }}
                          >
                            <Moon size={14} />
                          </IconButton>
                        </HStack>
                      }
                    />
                  </SettingsGroup>

                  <SettingsSection
                    title="File grid backgrounds"
                    description="Corner mascot or full-grid fill (10% opacity)"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />
                  <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                    <SettingsToggleRow
                      title="Enable backgrounds"
                      description="Show images behind the file grid"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={enableBackgrounds}
                          onCheckedChange={async (d) => {
                            const newValue = d.checked === true;
                            setEnableBackgrounds(newValue);
                            try {
                              const currentSettings = await settingsService.getSettings();
                              const updatedSettings = {
                                ...currentSettings,
                                enableBackgrounds: newValue,
                              };
                              await settingsService.setSettings(updatedSettings as any);
                              (settingsService as any).clearCache();
                              window.dispatchEvent(new CustomEvent('settings-updated', { detail: updatedSettings }));
                            } catch (error) {
                              console.error('Failed to save enableBackgrounds:', error);
                            }
                          }}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <Box px={2.5} py={1.5} borderBottomWidth="1px" borderColor={borderColor} opacity={enableBackgrounds ? 1 : 0.5}>
                      <Field.Root disabled={!enableBackgrounds}>
                        <Field.Label fontSize="xs" fontWeight="500" color={textColor} mb={1}>
                          Background type
                        </Field.Label>
                        <NativeSelect.Root size="sm">
                          <NativeSelect.Field
                            value={backgroundType}
                            onChange={(e) => setBackgroundType(e.target.value as 'watermark' | 'backgroundFill')}
                            bg="white"
                            color="black"
                            _dark={{ bg: inputBg, color: 'white' }}
                            borderRadius="md"
                            fontSize="xs"
                            h={SETTINGS_CONTROL_H}
                          >
                            <option value="watermark" style={{ background: 'inherit', color: 'inherit' }}>
                              Corner mascot (bottom-right, 100%)
                            </option>
                            <option value="backgroundFill" style={{ background: 'inherit', color: 'inherit' }}>
                              Background fill (grid, 10% opacity)
                            </option>
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                      </Field.Root>
                    </Box>
                    <Box px={2.5} py={1.5} opacity={enableBackgrounds ? 1 : 0.5} pointerEvents={enableBackgrounds ? 'auto' : 'none'}>
                      <Flex w="100%" minW={0} justify="space-between" align="center" gap={3} mb={2}>
                        <Text fontSize="xs" fontWeight="500" color={textColor} flex="1" minW={0}>
                          {backgroundType === 'watermark' ? 'Corner mascots' : 'Background fills'}
                        </Text>
                        <Button
                          h={SETTINGS_CONTROL_H}
                          size="xs"
                          px={2}
                          fontSize="xs"
                          borderRadius="md"
                          onClick={handleAddBackground}
                          colorPalette="blue"
                          disabled={!enableBackgrounds}
                        >
                          <Icon boxSize={3} asChild>
                            <Plus />
                          </Icon>
                          Add
                        </Button>
                      </Flex>

                      {backgroundImages.length === 0 ? (
                        <Box
                          p={5}
                          border="1px dashed"
                          borderColor={borderColor}
                          borderRadius="md"
                          textAlign="center"
                          bg={cardBg}
                        >
                          <Icon boxSize={6} color={secondaryTextColor} mb={2} asChild>
                            <ImageIcon />
                          </Icon>
                          <Text fontSize="xs" color={secondaryTextColor}>
                            No images yet — add one to get started
                          </Text>
                        </Box>
                      ) : (
                        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={2} justifyItems="start">
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
                  </SettingsGroup>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>

            {/* File Grid Tab */}
            <Tabs.Content value="filegrid" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack gap={8} align="stretch">
                  <SettingsSection
                    title="File grid"
                    description="Visibility of temp and hidden files"
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />
                  <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                    <SettingsToggleRow
                      title="Hide temporary files"
                      description="Office lock files (~$*) and Word ~*.tmp while documents are open"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={hideTemporaryFiles}
                          onCheckedChange={(d) => setHideTemporaryFiles(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <SettingsToggleRow
                      title="Hide dot files"
                      description=".git, .vscode, and other names starting with “.”"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      control={
                        <Switch.Root
                          checked={hideDotFiles}
                          onCheckedChange={(d) => setHideDotFiles(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                  </SettingsGroup>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>

            {/* Group View Tab */}
            <Tabs.Content value="groupview" h="full" overflow="hidden" display="flex" flexDirection="column" p={0}>
              <SettingsScrollPanel>
                <VStack gap={8} align="stretch">
                  <SettingsSection
                    title="Group view"
                    description='Index-prefix grouping in the file grid. Blacklist matches only that folder; subfolders still group.'
                    textColor={textColor}
                    secondaryTextColor={secondaryTextColor}
                    mb={0}
                  />

                  <SettingsGroup borderColor={borderColor} cardBg={cardBg}>
                    <SettingsToggleRow
                      title="Always enable group view"
                      borderColor={borderColor}
                      textColor={textColor}
                      secondaryTextColor={secondaryTextColor}
                      showDivider
                      control={
                        <Switch.Root
                          checked={groupViewAlwaysEnabled}
                          onCheckedChange={(d) => setGroupViewAlwaysEnabled(d.checked === true)}
                          colorPalette="blue"
                          size="sm"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      }
                    />
                    <Box px={2.5} py={1.5}>
                      <Field.Root>
                        <Field.Label fontSize="xs" fontWeight="600" color={textColor} mb={1.5}>
                          Blacklisted directories
                        </Field.Label>
                        <HStack gap={2} align="stretch" mb={2}>
                          <Box flex={1} minW={0}>
                            <PathInputRow
                              value={groupViewBlacklistInput}
                              onChange={(e) => setGroupViewBlacklistInput(e.target.value)}
                              placeholder="Path or browse…"
                              inputBg={inputBg}
                              borderColor={borderColor}
                              browseAriaLabel="Browse folder to blacklist"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const path = normalizePath(groupViewBlacklistInput.trim());
                                  if (path && !groupViewBlacklist.includes(path)) {
                                    setGroupViewBlacklist([...groupViewBlacklist, path]);
                                    setGroupViewBlacklistInput('');
                                  }
                                }
                              }}
                              onBrowse={async () => {
                                try {
                                  const result = await (window.electronAPI as any).selectDirectory();
                                  if (result) {
                                    const path = normalizePath(result);
                                    if (path && !groupViewBlacklist.includes(path)) {
                                      setGroupViewBlacklist([...groupViewBlacklist, path]);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Error selecting directory:', error);
                                }
                              }}
                            />
                          </Box>
                          <IconButton
                            aria-label="Add to blacklist"
                            colorPalette="blue"
                            size="xs"
                            h={SETTINGS_CONTROL_H}
                            minW={SETTINGS_CONTROL_H}
                            w={SETTINGS_CONTROL_H}
                            borderRadius="md"
                            onClick={() => {
                              const path = normalizePath(groupViewBlacklistInput.trim());
                              if (path && !groupViewBlacklist.includes(path)) {
                                setGroupViewBlacklist([...groupViewBlacklist, path]);
                                setGroupViewBlacklistInput('');
                              }
                            }}
                            disabled={!groupViewBlacklistInput.trim()}
                          >
                            <Icon boxSize={3.5} asChild>
                              <Plus />
                            </Icon>
                          </IconButton>
                        </HStack>
                        {groupViewBlacklist.length > 0 && (
                          <VStack align="stretch" gap={1}>
                            {groupViewBlacklist.map((path) => (
                              <Flex
                                key={path}
                                w="100%"
                                minW={0}
                                align="center"
                                justify="space-between"
                                gap={3}
                                px={2}
                                py={1.5}
                                bg={cardBg}
                                borderRadius="md"
                                borderWidth="1px"
                                borderColor={borderColor}
                              >
                                <Text fontSize="xs" color={textColor} truncate flex={1} title={path}>
                                  {path}
                                </Text>
                                <IconButton
                                  aria-label="Remove from blacklist"
                                  size="xs"
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() =>
                                    setGroupViewBlacklist(groupViewBlacklist.filter((p) => p !== path))
                                  }
                                >
                                  <Icon boxSize={3} asChild>
                                    <Trash2 />
                                  </Icon>
                                </IconButton>
                              </Flex>
                            ))}
                          </VStack>
                        )}
                      </Field.Root>
                    </Box>
                  </SettingsGroup>
                </VStack>
              </SettingsScrollPanel>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>
      {/* Footer */}
      <Box
        borderTop="1px solid"
        borderColor={borderColor}
        px={6}
        py={3}
        bg={bgColor}
        flexShrink={0}
      >
        <Flex gap={2.5} justify="flex-end">
          <Button
            variant="ghost"
            onClick={onClose}
            color={secondaryTextColor}
            _hover={{ bg: useColorModeValue('gray.200', 'df.rowHover') }}
            borderRadius="md"
            size="xs"
            h={SETTINGS_CONTROL_H}
            px={3}
            fontSize="xs"
          >
            <Icon boxSize={3} asChild>
              <X />
            </Icon>
            Cancel
          </Button>
          <Button
            colorPalette="blue"
            onClick={handleSave}
            borderRadius="md"
            fontWeight="500"
            size="xs"
            h={SETTINGS_CONTROL_H}
            px={3}
            fontSize="xs"
          >
            <Icon boxSize={3} asChild>
              <Save />
            </Icon>
            Save
          </Button>
        </Flex>
      </Box>
    </Box>
  );
}; 