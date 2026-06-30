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
  NativeSelect,
  Kbd,
  Flex,
  Spacer,
  IconButton,
  SimpleGrid,
  Image,
} from '@chakra-ui/react';
import {
  Folder,
  Settings as SettingsIcon,
  Keyboard,
  Save,
  X,
  Edit3,
  Sun,
  Moon,
  Image as ImageIcon,
  Plus,
  Trash2,
  Download,
  Plug,
  Palette,
  LayoutGrid,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { settingsService } from '../services/settings';
import {
  DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  DEFAULT_BACKSPACE_NAVIGATION_SHORTCUT,
} from '../constants/shortcutDefaults';
import { useAppContext } from '../context/AppContext';
import { normalizePath } from '../utils/path';
import { isPlainBackspaceOnlyShortcut } from '../utils/shortcuts';
import {
  PathInputRow,
  SettingsBlock,
  SettingsList,
  SettingsPage,
  SettingsRow,
  SETTINGS_CONTROL_H,
  SETTINGS_FS,
} from './settings-window/SettingsWindowPrimitives';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Vertical tab rail definition — icon + label. */
const SETTINGS_TABS = [
  { value: 'workspace', label: 'Workspace', icon: Folder },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'files', label: 'File grid', icon: LayoutGrid },
  { value: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { value: 'integrations', label: 'Integrations', icon: Plug },
] as const;

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
      borderRadius="md"
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
      width="138px"
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
          borderRadius="sm"
          w={4.5}
          h={4.5}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Icon boxSize={2.5} asChild><Save /></Icon>
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
        }}><Icon boxSize={3} asChild><Trash2 /></Icon></IconButton>
      <Box
        p={1}
        bg={overlayBg}
        position="absolute"
        bottom={0}
        left={0}
        right={0}
      >
        <Text
          fontSize="10px"
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
  gstTemplatePath?: string;
  clientbasePath?: string;
  showClientInfoBar?: boolean;
  showGitStatus?: boolean;
  activationShortcut?: string;
  enableActivationShortcut?: boolean;
  newTabShortcut?: string;
  enableNewTabShortcut?: boolean;
  closeTabShortcut?: string;
  enableCloseTabShortcut?: boolean;
  enableFileWatching?: boolean;
  clientSearchShortcut?: string;
  enableClientSearchShortcut?: boolean;
  jumpModeOnParentShortcut?: string;
  enableJumpModeOnParentShortcut?: boolean;
  backspaceNavigationShortcut?: string;
  enableBackspaceNavigationShortcut?: boolean;
  jumpModeQuickFolderPaths?: string[];
  sidebarCollapsedByDefault?: boolean;
  hideTemporaryFiles?: boolean;
  hideDotFiles?: boolean;
  hideClaudeMd?: boolean;
  fileGridBackgroundPath?: string;
  backgroundType?: 'watermark' | 'backgroundFill';
  backgroundFillPath?: string;
  enableBackgrounds?: boolean;
  groupViewAlwaysEnabled?: boolean;
  groupViewBlacklist?: string[];
  chromeExtensionBridgeEnabled?: boolean;
  chromeExtensionBridgePort?: number;
  chromeExtensionBridgeSecret?: string;

}

function generateChromeBridgeSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A small Chakra Switch wired to a boolean setter. */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={(d) => onChange(d.checked === true)}
      colorPalette="blue"
      size="sm"
    >
      <Switch.HiddenInput />
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch.Root>
  );
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const { colorMode, setColorMode } = useColorMode();
  const [rootPath, setRootPath] = useState('');
  const [originalRootPath, setOriginalRootPath] = useState('');
  const [gstTemplatePath, setGstTemplatePath] = useState('');
  const [clientbasePath, setClientbasePath] = useState('');
  const [workpaperTemplateFolderPath, setWorkpaperTemplateFolderPath] = useState<string>('');
  const [activationShortcut, setActivationShortcut] = useState('`');
  const [enableActivationShortcut, setEnableActivationShortcut] = useState(true);
  const [newTabShortcut, setNewTabShortcut] = useState('Ctrl+T');
  const [enableNewTabShortcut, setEnableNewTabShortcut] = useState(true);
  const [closeTabShortcut, setCloseTabShortcut] = useState('Ctrl+W');
  const [enableCloseTabShortcut, setEnableCloseTabShortcut] = useState(true);
  const [clientSearchShortcut, setClientSearchShortcut] = useState('Alt+F');
  const [enableClientSearchShortcut, setEnableClientSearchShortcut] = useState(true);
  const [jumpModeOnParentShortcut, setJumpModeOnParentShortcut] = useState(
    DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT,
  );
  const [enableJumpModeOnParentShortcut, setEnableJumpModeOnParentShortcut] = useState(true);
  const [backspaceNavigationShortcut, setBackspaceNavigationShortcut] = useState(
    DEFAULT_BACKSPACE_NAVIGATION_SHORTCUT,
  );
  const [enableBackspaceNavigationShortcut, setEnableBackspaceNavigationShortcut] = useState(true);
  const [jumpModeQuickFolderPaths, setJumpModeQuickFolderPaths] = useState<string[]>(['', '', '']);
  const [sidebarCollapsedByDefault, setSidebarCollapsedByDefault] = useState(false);
  const [hideTemporaryFiles, setHideTemporaryFiles] = useState(true);
  const [hideDotFiles, setHideDotFiles] = useState(true);
  const [hideClaudeMd, setHideClaudeMd] = useState(true);
  const [fileGridBackgroundPath, setFileGridBackgroundPath] = useState('');
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark');
  const [backgroundFillPath, setBackgroundFillPath] = useState('');
  const [backgroundImages, setBackgroundImages] = useState<Array<{ filename: string; path: string; relativePath: string }>>([]);
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [enableBackgrounds, setEnableBackgrounds] = useState(true);
  const [groupViewAlwaysEnabled, setGroupViewAlwaysEnabled] = useState(true);
  const [groupViewBlacklist, setGroupViewBlacklist] = useState<string[]>([]);
  const [groupViewBlacklistInput, setGroupViewBlacklistInput] = useState('');
  const [chromeExtensionBridgeEnabled, setChromeExtensionBridgeEnabled] = useState(false);
  const [chromeExtensionBridgePort, setChromeExtensionBridgePort] = useState('48721');
  const [chromeExtensionBridgeSecret, setChromeExtensionBridgeSecret] = useState('');

  // Keyboard recorder state
  const [isKeyRecorderOpen, setIsKeyRecorderOpen] = useState(false);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [currentEditingShortcut, setCurrentEditingShortcut] = useState<string>('');
  const { setRootDirectory, showClientInfoBar, setShowClientInfoBar, showGitStatus, setShowGitStatus, reloadSettings } = useAppContext();

  const {
    surfaceBg: bgColor,
    titleBarBg,
    cardBg,
    inputBg,
    borderColor,
    textColor,
    secondaryTextColor,
    selectedBg,
    accentText,
  } = useDialogChrome();
  const tabBarBg = cardBg;
  const tabInactiveColor = useColorModeValue('gray.600', 'gray.400');
  const tabHoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');
  const mutedIcon = useColorModeValue('gray.400', 'gray.500');
  const kbdBg = useColorModeValue('gray.100', '#2a3142');

  // Shared button presets — one vocabulary across every pane.
  const tertiaryBtn = {
    size: 'xs' as const,
    variant: 'outline' as const,
    h: '26px',
    px: 2.5,
    fontSize: SETTINGS_FS.button,
    fontWeight: '500' as const,
    borderRadius: 'md' as const,
    borderColor,
  };
  const ghostBtn = {
    size: 'xs' as const,
    variant: 'ghost' as const,
    h: '26px',
    px: 2.5,
    fontSize: SETTINGS_FS.button,
    fontWeight: '500' as const,
    borderRadius: 'md' as const,
  };
  const primaryBtn = {
    size: 'xs' as const,
    colorPalette: 'blue' as const,
    h: '26px',
    px: 3,
    fontSize: SETTINGS_FS.button,
    fontWeight: '500' as const,
    borderRadius: 'md' as const,
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.getSettings() as Settings;
        setRootPath(loadedSettings.rootPath);
        setOriginalRootPath(loadedSettings.rootPath);
        setGstTemplatePath(loadedSettings.gstTemplatePath || '');
        setClientbasePath(loadedSettings.clientbasePath || '');
        setActivationShortcut(loadedSettings.activationShortcut || '`');
        setEnableActivationShortcut(loadedSettings.enableActivationShortcut !== false);
        setNewTabShortcut(loadedSettings.newTabShortcut || 'Ctrl+T');
        setEnableNewTabShortcut(loadedSettings.enableNewTabShortcut !== false);
        setCloseTabShortcut(loadedSettings.closeTabShortcut || 'Ctrl+W');
        setEnableCloseTabShortcut(loadedSettings.enableCloseTabShortcut !== false);
        setClientSearchShortcut(loadedSettings.clientSearchShortcut || 'Alt+F');
        setEnableClientSearchShortcut(loadedSettings.enableClientSearchShortcut !== false);
        {
          const jp = loadedSettings.jumpModeOnParentShortcut?.trim();
          const bs = loadedSettings.backspaceNavigationShortcut;
          const bsTrim = typeof bs === 'string' ? bs.trim() : '';
          const directUnset =
            loadedSettings.backspaceNavigationShortcut === undefined || bsTrim === '';
          const sameKeyAsJump =
            !!jp &&
            bsTrim !== '' &&
            jp.replace(/\s+/g, '').toLowerCase() === bsTrim.replace(/\s+/g, '').toLowerCase();
          const upgradePlainBackspaceJump =
            isPlainBackspaceOnlyShortcut(jp) && (directUnset || sameKeyAsJump);
          setJumpModeOnParentShortcut(
            !jp
              ? DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT
              : upgradePlainBackspaceJump
                ? DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT
                : jp,
          );
          setBackspaceNavigationShortcut(
            bsTrim !== '' ? bsTrim : DEFAULT_BACKSPACE_NAVIGATION_SHORTCUT,
          );
        }
        setEnableJumpModeOnParentShortcut(loadedSettings.enableJumpModeOnParentShortcut !== false);
        setEnableBackspaceNavigationShortcut(loadedSettings.enableBackspaceNavigationShortcut !== false);
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
        settingsService.getWorkpaperTemplateFolderPath().then(path => setWorkpaperTemplateFolderPath(path || ''));
        // File grid visibility (default true when unset)
        setHideTemporaryFiles(loadedSettings.hideTemporaryFiles !== false);
        setHideDotFiles(loadedSettings.hideDotFiles !== false);
        setHideClaudeMd(loadedSettings.hideClaudeMd !== false);
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
        setChromeExtensionBridgeEnabled(loadedSettings.chromeExtensionBridgeEnabled === true);
        setChromeExtensionBridgePort(
          String(loadedSettings.chromeExtensionBridgePort ?? 48721),
        );
        setChromeExtensionBridgeSecret(loadedSettings.chromeExtensionBridgeSecret || '');

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
      let bridgeSecret = chromeExtensionBridgeSecret.trim();
      if (chromeExtensionBridgeEnabled && !bridgeSecret) {
        bridgeSecret = generateChromeBridgeSecret();
        setChromeExtensionBridgeSecret(bridgeSecret);
      }
      const bridgePortParsed = parseInt(chromeExtensionBridgePort, 10);
      const bridgePortNum =
        Number.isFinite(bridgePortParsed) && bridgePortParsed > 0 && bridgePortParsed < 65536
          ? bridgePortParsed
          : 48721;

      const newSettings: Settings = {
        rootPath,
        gstTemplatePath: gstTemplatePath || undefined,
        clientbasePath: clientbasePath || undefined,
        showClientInfoBar,
        showGitStatus,
        activationShortcut,
        enableActivationShortcut,
        newTabShortcut,
        enableNewTabShortcut,
        closeTabShortcut,
        enableCloseTabShortcut,
        // File system watching is always on.
        enableFileWatching: true,
        clientSearchShortcut,
        enableClientSearchShortcut,
        jumpModeOnParentShortcut,
        enableJumpModeOnParentShortcut,
        backspaceNavigationShortcut,
        enableBackspaceNavigationShortcut,
        jumpModeQuickFolderPaths: jumpModeQuickFolderPaths.map((s) => (typeof s === 'string' ? s.trim() : '')),
        sidebarCollapsedByDefault,
        hideTemporaryFiles,
        hideDotFiles,
        hideClaudeMd,
        fileGridBackgroundPath,
        backgroundType,
        backgroundFillPath,
        enableBackgrounds,
        groupViewAlwaysEnabled,
        groupViewBlacklist,
        chromeExtensionBridgeEnabled,
        chromeExtensionBridgePort: bridgePortNum,
        chromeExtensionBridgeSecret: bridgeSecret || undefined,

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
        newTabShortcut,
        closeTabShortcut,
        clientSearchShortcut
      });

      // Immediately reload settings to update the UI
      await reloadSettings();

      // Force a re-render to show updated shortcuts immediately
      setActivationShortcut(activationShortcut);
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

    // Store in canonical form: no spaces, single letters upper-cased. Both the
    // shared matcher (eventMatchesShortcut) and the Electron accelerator converter
    // split on a bare "+" and match "Ctrl"/"Alt" exactly, so a spaced string like
    // "Ctrl + Y" would silently never fire.
    const newShortcut = recordingKeys
      .map((k, i) => (i === recordingKeys.length - 1 && /^[a-z]$/.test(k) ? k.toUpperCase() : k))
      .join('+');

    // Update the appropriate shortcut based on currentEditingShortcut
    switch (currentEditingShortcut) {
      case 'activationShortcut':
        setActivationShortcut(newShortcut);
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
      case 'backspaceNavigationShortcut':
        setBackspaceNavigationShortcut(newShortcut);
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

  /** One keybinding row: command + description on the left, Kbd chips + edit on the right. */
  const ShortcutRow = ({
    shortcutType,
    command,
    keybinding,
    description,
  }: {
    shortcutType: string;
    command: string;
    keybinding: string;
    description: string;
  }) => {
    const keys = keybinding.split(/\s*\+\s*/).filter(Boolean);
    return (
      <Flex align="center" justify="space-between" gap={4} py={2.5} minH="40px">
        <Box flex="1" minW={0}>
          <Text fontSize={SETTINGS_FS.rowTitle} fontWeight="500" color={textColor} lineHeight="short">
            {command}
          </Text>
          <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} lineHeight="short" mt={0.5}>
            {description}
          </Text>
        </Box>
        <HStack gap={1.5} flexShrink={0} align="center">
          <HStack gap={1}>
            {keys.map((k, i) => (
              <Kbd key={i} bg={kbdBg} borderColor={borderColor} color={textColor} fontSize="10px" px={1.5} py={0.5} borderRadius="sm">
                {k}
              </Kbd>
            ))}
          </HStack>
          <IconButton
            size="xs"
            variant="ghost"
            h="24px"
            minW="24px"
            borderRadius="md"
            onClick={() => openKeyRecorder(shortcutType)}
            aria-label={`Change ${command} shortcut`}
            color={mutedIcon}
            _hover={{ color: 'blue.500', bg: tabHoverBg }}
          >
            <Icon boxSize={3.5} asChild><Edit3 /></Icon>
          </IconButton>
        </HStack>
      </Flex>
    );
  };

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
        <Tabs.Root defaultValue="workspace" variant="line" colorPalette="blue" orientation="vertical" h="full" display="flex" w="full">
          {/* Vertical rail */}
          <Box w="200px" minH="100%" bg={tabBarBg} borderRight="1px solid" borderColor={borderColor} flexShrink={0}>
            <Tabs.List
              w="full"
              px={2.5}
              py={3}
              gap={0.5}
              bg="transparent"
              flexDirection="column"
              alignItems="stretch"
            >
              {SETTINGS_TABS.map((t) => (
                <Tabs.Trigger
                  key={t.value}
                  value={t.value}
                  justifyContent="flex-start"
                  gap={2.5}
                  px={2.5}
                  h="32px"
                  borderRadius={0}
                  borderLeftWidth="2px"
                  borderLeftStyle="solid"
                  borderLeftColor="transparent"
                  fontSize="12.5px"
                  fontWeight="500"
                  color={tabInactiveColor}
                  _selected={{
                    bg: selectedBg,
                    color: accentText,
                    borderLeftColor: accentText,
                    fontWeight: '600',
                  }}
                  _hover={{ bg: tabHoverBg }}
                  transition="background-color 0.12s, color 0.12s"
                >
                  <Icon boxSize={3.5} asChild><t.icon /></Icon>
                  <Text>{t.label}</Text>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Box>

          <Box flex="1" minW={0} overflow="hidden">
            {/* ---------------------------------------------------------- */}
            {/* Workspace                                                  */}
            {/* ---------------------------------------------------------- */}
            <Tabs.Content value="workspace" h="full" overflow="hidden" p={0}>
              <SettingsPage
                title="Workspace"
                subtitle="Where DocuFrame reads your files, templates, and client data."
              >
                <SettingsBlock label="Root">
                  <SettingsList>
                    <SettingsRow stacked title="Root directory" hint="The default folder for all file operations.">
                      <PathInputRow
                        value={rootPath}
                        onChange={(e) => setRootPath(e.target.value)}
                        placeholder="Enter root path"
                        onBrowse={handleBrowseFolder}
                        browseAriaLabel="Browse root folder"
                      />
                    </SettingsRow>
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Templates">
                  <SettingsList>
                    <SettingsRow stacked title="GST template" hint="Spreadsheet used by the GST workflow.">
                      <PathInputRow
                        value={gstTemplatePath}
                        onChange={(e) => setGstTemplatePath(e.target.value)}
                        placeholder="Enter GST template file path"
                        onBrowse={handleBrowseGstTemplate}
                        browseAriaLabel="Browse GST template file"
                      />
                    </SettingsRow>
                    <SettingsRow stacked title="Workpaper template folder" hint="Excel templates for workpaper creation.">
                      <PathInputRow
                        value={workpaperTemplateFolderPath}
                        readOnly
                        placeholder="Select workpaper template folder…"
                        onBrowse={handleWorkpaperTemplateFolderChange}
                      />
                    </SettingsRow>
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Data sources">
                  <SettingsList>
                    <SettingsRow stacked title="Clientbase CSV" hint="Client database used for search and the info bar.">
                      <PathInputRow
                        value={clientbasePath}
                        onChange={(e) => setClientbasePath(e.target.value)}
                        placeholder="Enter clientbase CSV file path"
                        onBrowse={handleBrowseClientbase}
                        browseAriaLabel="Browse clientbase CSV"
                      />
                    </SettingsRow>
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Backup">
                  <SettingsList>
                    <SettingsRow
                      title="Export settings"
                      hint="Save a timestamped JSON snapshot of your full configuration."
                      control={
                        <Button {...tertiaryBtn} onClick={handleExportSettings}>
                          <Icon boxSize={3.5} asChild><Download /></Icon>
                          Export…
                        </Button>
                      }
                    />
                  </SettingsList>
                </SettingsBlock>
              </SettingsPage>
            </Tabs.Content>

            {/* ---------------------------------------------------------- */}
            {/* Appearance                                                 */}
            {/* ---------------------------------------------------------- */}
            <Tabs.Content value="appearance" h="full" overflow="hidden" p={0}>
              <SettingsPage title="Appearance" subtitle="Theme, layout, and file-grid backgrounds.">
                <SettingsBlock label="Theme">
                  <SettingsList>
                    <SettingsRow
                      title="Color mode"
                      hint="Locked to dark for now."
                      control={
                        <Flex
                          borderWidth="1px"
                          borderColor={borderColor}
                          borderRadius="md"
                          h="26px"
                          align="center"
                          gap={1.5}
                          px={2.5}
                          bg={selectedBg}
                          color={accentText}
                          opacity={0.85}
                          cursor="not-allowed"
                          fontSize={SETTINGS_FS.button}
                          fontWeight="500"
                        >
                          <Icon boxSize={3.5} asChild><Moon /></Icon>
                          Dark
                        </Flex>
                      }
                    />
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Layout">
                  <SettingsList>
                    <SettingsRow
                      title="Client info bar"
                      hint="Name, IRD, and job links below the file grid."
                      control={<ToggleSwitch checked={showClientInfoBar} onChange={setShowClientInfoBar} />}
                    />
                    <SettingsRow
                      title="Git status in footer"
                      hint="Show the current repo's git branch/status indicator. Off by default for copies without a repo."
                      control={<ToggleSwitch checked={showGitStatus} onChange={setShowGitStatus} />}
                    />
                    <SettingsRow
                      title="Collapse sidebar on launch"
                      hint="Start each session with the sidebar collapsed."
                      control={<ToggleSwitch checked={sidebarCollapsedByDefault} onChange={setSidebarCollapsedByDefault} />}
                    />
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Backgrounds">
                  <SettingsList>
                    <SettingsRow
                      title="Enable backgrounds"
                      hint="Show an image behind the file grid."
                      control={
                        <ToggleSwitch
                          checked={enableBackgrounds}
                          onChange={async (newValue) => {
                            setEnableBackgrounds(newValue);
                            try {
                              const currentSettings = await settingsService.getSettings();
                              const updatedSettings = { ...currentSettings, enableBackgrounds: newValue };
                              await settingsService.setSettings(updatedSettings as any);
                              (settingsService as any).clearCache();
                              window.dispatchEvent(new CustomEvent('settings-updated', { detail: updatedSettings }));
                            } catch (error) {
                              console.error('Failed to save enableBackgrounds:', error);
                            }
                          }}
                        />
                      }
                    />
                    <Box opacity={enableBackgrounds ? 1 : 0.5} pointerEvents={enableBackgrounds ? 'auto' : 'none'}>
                      <SettingsRow stacked title="Style" hint="How the image is placed in the grid.">
                        <NativeSelect.Root size="sm">
                          <NativeSelect.Field
                            value={backgroundType}
                            onChange={(e) => setBackgroundType(e.target.value as 'watermark' | 'backgroundFill')}
                            bg="white"
                            color="black"
                            _dark={{ bg: inputBg, color: 'white' }}
                            borderColor={borderColor}
                            borderRadius="md"
                            fontSize={SETTINGS_FS.body}
                            h={SETTINGS_CONTROL_H}
                          >
                            <option value="watermark">Corner mascot — bottom-right, full opacity</option>
                            <option value="backgroundFill">Background fill — whole grid, 10% opacity</option>
                          </NativeSelect.Field>
                          <NativeSelect.Indicator />
                        </NativeSelect.Root>
                      </SettingsRow>
                    </Box>
                    <Box py={3} opacity={enableBackgrounds ? 1 : 0.5} pointerEvents={enableBackgrounds ? 'auto' : 'none'}>
                      <Flex w="100%" minW={0} justify="space-between" align="center" gap={3} mb={2.5}>
                        <Text fontSize={SETTINGS_FS.rowTitle} fontWeight="500" color={textColor}>
                          {backgroundType === 'watermark' ? 'Corner mascots' : 'Background fills'}
                        </Text>
                        <Button {...primaryBtn} onClick={handleAddBackground} disabled={!enableBackgrounds}>
                          <Icon boxSize={3} asChild><Plus /></Icon>
                          Add image
                        </Button>
                      </Flex>

                      {backgroundImages.length === 0 ? (
                        <Flex
                          direction="column"
                          align="center"
                          gap={1.5}
                          py={6}
                          border="1px dashed"
                          borderColor={borderColor}
                          borderRadius="md"
                        >
                          <Icon boxSize={5} color={secondaryTextColor} asChild><ImageIcon /></Icon>
                          <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor}>
                            No images yet — add one to get started
                          </Text>
                        </Flex>
                      ) : (
                        <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={2} justifyItems="start">
                          {backgroundImages.map((img) => (
                            <BackgroundThumbnail
                              key={img.relativePath}
                              img={img}
                              isSelected={selectedBackground === img.relativePath}
                              borderColor={borderColor}
                              onSelect={() => handleSelectBackground(img.relativePath, img.path)}
                              onDelete={() => handleDeleteBackground(img.filename, img.relativePath)}
                            />
                          ))}
                        </SimpleGrid>
                      )}
                    </Box>
                  </SettingsList>
                </SettingsBlock>
              </SettingsPage>
            </Tabs.Content>

            {/* ---------------------------------------------------------- */}
            {/* File grid                                                  */}
            {/* ---------------------------------------------------------- */}
            <Tabs.Content value="files" h="full" overflow="hidden" p={0}>
              <SettingsPage title="File grid" subtitle="What appears in the grid and how folders are grouped.">
                <SettingsBlock label="Hidden files">
                  <SettingsList>
                    <SettingsRow
                      title="Hide temporary files"
                      hint="Office lock files (~$*) and Word ~*.tmp while documents are open."
                      control={<ToggleSwitch checked={hideTemporaryFiles} onChange={setHideTemporaryFiles} />}
                    />
                    <SettingsRow
                      title="Hide dot files"
                      hint=".git, .vscode, and other names starting with a dot."
                      control={<ToggleSwitch checked={hideDotFiles} onChange={setHideDotFiles} />}
                    />
                    <SettingsRow
                      title="Hide CLAUDE.md"
                      hint="Instruction files used by Claude Code."
                      control={<ToggleSwitch checked={hideClaudeMd} onChange={setHideClaudeMd} />}
                    />
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Group view">
                  <SettingsList>
                    <SettingsRow
                      title="Always group by index prefix"
                      hint="Group folders by their NN- prefix everywhere except the folders below."
                      control={<ToggleSwitch checked={groupViewAlwaysEnabled} onChange={setGroupViewAlwaysEnabled} />}
                    />
                    <SettingsRow
                      stacked
                      title="Excluded folders"
                      hint="Group view stays off in these folders. Subfolders still group."
                    >
                      <HStack gap={2} align="stretch" mb={groupViewBlacklist.length > 0 ? 2 : 0}>
                        <Box flex={1} minW={0}>
                          <PathInputRow
                            value={groupViewBlacklistInput}
                            onChange={(e) => setGroupViewBlacklistInput(e.target.value)}
                            placeholder="Path or browse…"
                            browseAriaLabel="Browse folder to exclude"
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
                        <Button
                          {...primaryBtn}
                          h={SETTINGS_CONTROL_H}
                          onClick={() => {
                            const path = normalizePath(groupViewBlacklistInput.trim());
                            if (path && !groupViewBlacklist.includes(path)) {
                              setGroupViewBlacklist([...groupViewBlacklist, path]);
                              setGroupViewBlacklistInput('');
                            }
                          }}
                          disabled={!groupViewBlacklistInput.trim()}
                        >
                          <Icon boxSize={3} asChild><Plus /></Icon>
                          Add
                        </Button>
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
                              px={2.5}
                              py={1.5}
                              bg={cardBg}
                              borderRadius="md"
                              borderWidth="1px"
                              borderColor={borderColor}
                            >
                              <Text fontSize={SETTINGS_FS.body} color={textColor} truncate flex={1} title={path}>
                                {path}
                              </Text>
                              <IconButton
                                aria-label="Remove folder"
                                size="xs"
                                variant="ghost"
                                colorPalette="red"
                                h="22px"
                                minW="22px"
                                onClick={() => setGroupViewBlacklist(groupViewBlacklist.filter((p) => p !== path))}
                              >
                                <Icon boxSize={3} asChild><Trash2 /></Icon>
                              </IconButton>
                            </Flex>
                          ))}
                        </VStack>
                      )}
                    </SettingsRow>
                  </SettingsList>
                </SettingsBlock>
              </SettingsPage>
            </Tabs.Content>

            {/* ---------------------------------------------------------- */}
            {/* Shortcuts                                                  */}
            {/* ---------------------------------------------------------- */}
            <Tabs.Content value="shortcuts" h="full" overflow="hidden" p={0}>
              <SettingsPage
                title="Shortcuts"
                subtitle="Global and in-app keybindings. Click the pencil on a row to record a new one."
              >
                <SettingsBlock label="Keyboard">
                  <SettingsList>
                    <ShortcutRow shortcutType="activationShortcut" command="Global activation" keybinding={activationShortcut} description="Bring the app to front from anywhere." />
                    <ShortcutRow shortcutType="newTabShortcut" command="New tab" keybinding={newTabShortcut} description="Create a new folder tab." />
                    <ShortcutRow shortcutType="closeTabShortcut" command="Close tab" keybinding={closeTabShortcut} description="Close the current tab." />
                    <ShortcutRow shortcutType="clientSearchShortcut" command="Search clients" keybinding={clientSearchShortcut} description="Open the client search overlay." />
                    <ShortcutRow shortcutType="jumpModeOnParentShortcut" command="Jump mode at parent" keybinding={jumpModeOnParentShortcut} description="Open the address-bar jump filter on the parent folder; repeat to climb one level at a time." />
                    <ShortcutRow shortcutType="backspaceNavigationShortcut" command="Back / parent folder" keybinding={backspaceNavigationShortcut} description="In jump mode, step back up the quick-nav trail one level; otherwise move the grid up to the parent folder." />
                  </SettingsList>
                </SettingsBlock>

                <SettingsBlock label="Jump-mode quick folders">
                  <SettingsList>
                    <Flex align="center" gap={3} py={2.5} minH="40px">
                      <Kbd bg={kbdBg} borderColor={borderColor} color={textColor} fontSize="10px" px={1.5} py={0.5} borderRadius="sm" flexShrink={0}>F1</Kbd>
                      <Input
                        h={SETTINGS_CONTROL_H}
                        fontSize={SETTINGS_FS.body}
                        readOnly
                        value={rootPath ? normalizePath(rootPath) : ''}
                        placeholder="Set the workspace root under Workspace"
                        flex={1}
                        bg="white"
                        _dark={{ bg: inputBg }}
                        borderColor={borderColor}
                        borderRadius="md"
                      />
                    </Flex>
                    {([0, 1, 2] as const).map((slot) => (
                      <Flex key={slot} align="center" gap={3} py={2.5} minH="40px">
                        <Kbd bg={kbdBg} borderColor={borderColor} color={textColor} fontSize="10px" px={1.5} py={0.5} borderRadius="sm" flexShrink={0}>
                          F{slot + 2}
                        </Kbd>
                        <Input
                          h={SETTINGS_CONTROL_H}
                          fontSize={SETTINGS_FS.body}
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
                          borderColor={borderColor}
                          borderRadius="md"
                        />
                        <Button {...tertiaryBtn} onClick={() => pickJumpQuickFolder(slot)}>
                          Browse
                        </Button>
                        <Button
                          {...ghostBtn}
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
                      </Flex>
                    ))}
                  </SettingsList>
                  <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} mt={2.5} lineHeight="short">
                    F1 is always your workspace root. F2–F4 apply when you're under your breadcrumb trail. F5 stays free for refresh. Save to apply.
                  </Text>
                </SettingsBlock>
              </SettingsPage>

              {/* Keyboard Shortcut Recorder Modal */}
              {isKeyRecorderOpen && (
                <>
                  <Box position="fixed" inset={0} bg="blackAlpha.500" zIndex={9998} onClick={closeKeyRecorder} />
                  <Box
                    position="fixed"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg={bgColor}
                    border="1px solid"
                    borderColor={borderColor}
                    borderRadius="lg"
                    p={6}
                    boxShadow="xl"
                    zIndex={9999}
                    minW="380px"
                    maxW="460px"
                  >
                    <VStack gap={4} align="stretch">
                      <Box>
                        <Text fontSize="13px" fontWeight="600" color={textColor} textAlign="center">
                          Record a shortcut
                        </Text>
                        <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} textAlign="center" mt={1}>
                          Press your key combination, then Enter to save · Esc to cancel
                        </Text>
                      </Box>

                      <Flex
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="md"
                        py={5}
                        bg={cardBg}
                        minH="64px"
                        align="center"
                        justify="center"
                        gap={2}
                      >
                        {recordingKeys.length > 0 ? (
                          recordingKeys.map((key, index) => (
                            <React.Fragment key={index}>
                              <Kbd bg={kbdBg} borderColor={borderColor} color={textColor} fontSize="13px" px={2.5} py={1} borderRadius="sm">
                                {key}
                              </Kbd>
                              {index < recordingKeys.length - 1 && (
                                <Text fontSize="md" color={secondaryTextColor}>+</Text>
                              )}
                            </React.Fragment>
                          ))
                        ) : (
                          <Text fontSize="13px" color={secondaryTextColor}>Waiting for keys…</Text>
                        )}
                      </Flex>

                      <HStack gap={2} justify="flex-end">
                        <Button {...ghostBtn} onClick={clearRecording}>Clear</Button>
                        <Button {...tertiaryBtn} onClick={closeKeyRecorder}>Cancel</Button>
                        <Button {...primaryBtn} onClick={saveRecording} disabled={recordingKeys.length === 0}>Save</Button>
                      </HStack>
                    </VStack>
                  </Box>
                </>
              )}
            </Tabs.Content>

            {/* ---------------------------------------------------------- */}
            {/* Integrations                                               */}
            {/* ---------------------------------------------------------- */}
            <Tabs.Content value="integrations" h="full" overflow="hidden" p={0}>
              <SettingsPage title="Integrations" subtitle="The Chrome capture bridge.">
                <SettingsBlock label="Chrome extension bridge">
                  <SettingsList>
                    <SettingsRow
                      title="Enable bridge"
                      hint="Opens a local 127.0.0.1 port so the Chrome Functions extension can save page PDFs into your open folder."
                      control={
                        <ToggleSwitch
                          checked={chromeExtensionBridgeEnabled}
                          onChange={(on) => {
                            setChromeExtensionBridgeEnabled(on);
                            if (on && !chromeExtensionBridgeSecret.trim()) {
                              setChromeExtensionBridgeSecret(generateChromeBridgeSecret());
                            }
                          }}
                        />
                      }
                    />
                    <Box opacity={chromeExtensionBridgeEnabled ? 1 : 0.5} pointerEvents={chromeExtensionBridgeEnabled ? 'auto' : 'none'}>
                      <SettingsRow stacked title="Port">
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          value={chromeExtensionBridgePort}
                          onChange={(e) => setChromeExtensionBridgePort(e.target.value)}
                          bg="white"
                          _dark={{ bg: inputBg }}
                          borderColor={borderColor}
                          borderRadius="md"
                          h={SETTINGS_CONTROL_H}
                          maxW="120px"
                          fontSize={SETTINGS_FS.body}
                          disabled={!chromeExtensionBridgeEnabled}
                        />
                      </SettingsRow>
                      <SettingsRow
                        stacked
                        title="Shared secret"
                        hint="Paste this port and secret into the Chrome Functions sidebar. Regenerating invalidates the old secret."
                      >
                        <HStack gap={2} align="center" flexWrap="wrap">
                          <Input
                            readOnly
                            value={chromeExtensionBridgeSecret}
                            placeholder={chromeExtensionBridgeEnabled ? 'Generated on enable' : 'Enable the bridge first'}
                            bg="white"
                            _dark={{ bg: inputBg }}
                            borderColor={borderColor}
                            borderRadius="md"
                            h={SETTINGS_CONTROL_H}
                            fontSize={SETTINGS_FS.hint}
                            fontFamily="mono"
                            flex={1}
                            minW="180px"
                          />
                          <Button
                            {...tertiaryBtn}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(chromeExtensionBridgeSecret);
                                showToast({ title: 'Copied', description: 'Secret copied to clipboard', status: 'success', duration: 2000, isClosable: true });
                              } catch {
                                showToast({ title: 'Copy failed', status: 'error', duration: 2000, isClosable: true });
                              }
                            }}
                            disabled={!chromeExtensionBridgeSecret.trim()}
                          >
                            <Icon boxSize={3} asChild><Copy /></Icon>
                            Copy
                          </Button>
                          <Button
                            {...tertiaryBtn}
                            onClick={() => {
                              setChromeExtensionBridgeSecret(generateChromeBridgeSecret());
                              showToast({ title: 'Secret regenerated', description: 'Update the Chrome extension with the new secret.', status: 'info', duration: 4000, isClosable: true });
                            }}
                            disabled={!chromeExtensionBridgeEnabled}
                          >
                            <Icon boxSize={3} asChild><RefreshCw /></Icon>
                            Regenerate
                          </Button>
                        </HStack>
                      </SettingsRow>
                    </Box>
                  </SettingsList>
                  <HStack gap={2} align="center" color={secondaryTextColor} mt={2.5}>
                    <Icon boxSize={3.5} asChild><Plug /></Icon>
                    <Text fontSize={SETTINGS_FS.hint} lineHeight="short">
                      DocuFrame must be running with a folder open. PDFs save to that folder.
                    </Text>
                  </HStack>
                </SettingsBlock>
              </SettingsPage>
            </Tabs.Content>
          </Box>
        </Tabs.Root>
      </Box>

      {/* Footer */}
      <Box borderTop="1px solid" borderColor={borderColor} px={6} py={3} bg={bgColor} flexShrink={0}>
        <Flex gap={2.5} justify="flex-end" align="center">
          <Button {...ghostBtn} h="30px" px={3.5} onClick={onClose} color={secondaryTextColor} _hover={{ bg: tabHoverBg }}>
            Cancel
          </Button>
          <Button colorPalette="blue" onClick={handleSave} h="30px" px={4} fontSize={SETTINGS_FS.button} fontWeight="600" borderRadius="md" size="xs">
            <Icon boxSize={3} asChild><Save /></Icon>
            Save changes
          </Button>
        </Flex>
      </Box>
    </Box>
  );
};
