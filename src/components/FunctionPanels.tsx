import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { showToast } from "@/components/ui/toaster"
import {
  Box,
  Flex,
  Text,
  IconButton,
  Input,
  Popover,
  Separator,
  Portal,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { FilePlus2, FileEdit, Archive, Settings, Mail, Download, Columns2, ChevronDown, Layers } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { TransferMappingDialog } from './TransferMappingDialog';
import { MergePDFDialog } from './MergePDFDialog';
import { ClientSearchOverlay } from './ClientSearchOverlay';
import { type DialogType, type MinimizedDialog } from './MinimizedDialogsBar';
import { extractIndexPrefix, getAllIndexKeys } from '../utils/indexPrefix';
import { joinPath } from '../utils/path';
import {
  DF_SESSION_RAIL_BG,
  DF_TOOLBAR_TOGGLE_ACTIVE_HOVER_BG,
  docuFramePalette,
} from '../docuFrameColors';

/** No blue Chakra/Ark focus ring — toolbar + transfer popovers use flat chrome */
const suppressFocusRing = {
  outline: 'none',
  boxShadow: 'none',
} as const;

/** Function row: compact strip + matching icon hit targets */
const FN_TOOLBAR_ROW_H = '32px';
const FN_TOOLBAR_BTN = '28px';
const FN_TOOLBAR_ICON = 16;
const FN_TOOLBAR_SEP_H = '18px';

// Add client search shortcut functionality
const useClientSearchShortcut = (setClientSearchOpen: (open: boolean) => void) => {
  const [enableClientSearchShortcut, setEnableClientSearchShortcut] = useState(true);

  useEffect(() => {
    const loadShortcutSettings = async () => {
      try {
        const settings = await (window.electronAPI as any).getConfig();
        setEnableClientSearchShortcut(settings.enableClientSearchShortcut !== false);
      } catch (error) {
        // Error loading settings - use defaults
      }
    };
    loadShortcutSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableClientSearchShortcut) {
        return;
      }
      
      const key = event.key.toLowerCase();
      const isAltF = event.altKey && key === 'f';
      
      if (isAltF) {
        event.preventDefault();
        setClientSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableClientSearchShortcut, setClientSearchOpen]);
};

// Transfer dropdown (single row: 25% index | 75% template/filename)
const TransferDropdownMenu: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  buttonColor: string;
  buttonHoverBg: string;
  indexesNotInDir: string[];
  groupedTransferTemplates: Record<string, Array<{ command: string; filename: string }>>;
  transferSelectedIndex: string | null;
  transferCustomIndex: string;
  transferManualFilename: string;
  setTransferSelectedIndex: (s: string | null) => void;
  setTransferCustomIndex: (s: string) => void;
  setTransferManualFilename: (s: string) => void;
  onTransfer: (opts: { command?: string; newName?: string }) => Promise<void>;
  onClose: () => void;
}> = ({
  isOpen,
  onOpenChange,
  buttonColor,
  buttonHoverBg,
  indexesNotInDir,
  groupedTransferTemplates,
  transferSelectedIndex,
  transferCustomIndex,
  transferManualFilename,
  setTransferSelectedIndex,
  setTransferCustomIndex,
  setTransferManualFilename,
  onTransfer,
  onClose,
}) => {
  const [indexMode, setIndexMode] = useState<'dropdown' | 'custom'>('dropdown');
  const [templateMode, setTemplateMode] = useState<'dropdown' | 'custom'>('dropdown');
  const [indexPopoverOpen, setIndexPopoverOpen] = useState(false);
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const indexColRef = useRef<HTMLDivElement>(null);
  const templateColRef = useRef<HTMLDivElement>(null);
  const [indexColPx, setIndexColPx] = useState<number | null>(null);
  const [templateColPx, setTemplateColPx] = useState<number | null>(null);

  // Default index to "AA" when panel opens; close nested popovers when panel closes
  useEffect(() => {
    if (isOpen && transferSelectedIndex === null) {
      setTransferSelectedIndex('AA');
    }
    if (!isOpen) {
      setIndexPopoverOpen(false);
      setTemplatePopoverOpen(false);
      setIndexMode('dropdown');
      setTemplateMode('dropdown');
    }
  }, [isOpen, transferSelectedIndex, setTransferSelectedIndex]);

  // Match inner list width to the trigger column (sameWidth is unreliable nested in portalled popovers)
  useLayoutEffect(() => {
    if (!isOpen) {
      setIndexColPx(null);
      setTemplateColPx(null);
      return;
    }
    const measure = () => {
      if (indexColRef.current) {
        setIndexColPx(Math.round(indexColRef.current.getBoundingClientRect().width));
      }
      if (templateColRef.current) {
        setTemplateColPx(Math.round(templateColRef.current.getBoundingClientRect().width));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (indexColRef.current) ro.observe(indexColRef.current);
    if (templateColRef.current) ro.observe(templateColRef.current);
    return () => ro.disconnect();
  }, [isOpen, indexMode, templateMode]);

  const p = docuFramePalette;
  const panelBg = useColorModeValue(p.light.toolbar, p.dark.tabStrip);
  const triggerBg = useColorModeValue(p.light.tableHeader, p.dark.tabInactive);
  const menuListBg = useColorModeValue(p.light.listRow, p.dark.tabStrip);
  const menuListBorder = useColorModeValue(p.light.border, p.dark.border);
  const menuHoverBg = useColorModeValue(p.light.rowHover, p.dark.chromeHover);
  const menuPlaceholderColor = useColorModeValue(p.light.subtext, p.dark.subtext);
  const inputBg = useColorModeValue(p.light.listRow, p.dark.listRow);
  const labelColor = useColorModeValue('gray.800', 'gray.100');

  const indexKeys = useMemo(() => {
    const keys = getAllIndexKeys().filter(k => k !== 'Other');
    // Put AA first
    const aa = keys.indexOf('AA');
    if (aa > 0) {
      const arr = [...keys];
      arr.splice(aa, 1);
      return ['AA', ...arr];
    }
    return keys;
  }, []);
  const templates = transferSelectedIndex ? (groupedTransferTemplates[transferSelectedIndex] ?? []) : [];
  const effectiveIndex = indexMode === 'custom' && transferCustomIndex.trim() ? transferCustomIndex.trim() : transferSelectedIndex;

  const handleSelectIndex = (index: string) => {
    setTransferSelectedIndex(index);
    setTransferCustomIndex('');
    setIndexMode('dropdown');
    setIndexPopoverOpen(false);
  };

  const handleTransferTemplate = (command: string) => {
    onTransfer({ command });
    onOpenChange(false);
    onClose();
  };

  const handleTransferManual = () => {
    const trimmed = transferManualFilename.trim();
    if (trimmed && effectiveIndex) {
      const hasIndexPrefix = /^[A-Z]+\d*\s+-\s+/.test(trimmed);
      const fullName = hasIndexPrefix ? trimmed : `${effectiveIndex} - ${trimmed}`;
      onTransfer({ newName: fullName });
      setTransferManualFilename('');
      onOpenChange(false);
      onClose();
    }
  };

  const handleMenuClose = () => {
    onOpenChange(false);
    onClose();
  };

  const indexDisplay = indexMode === 'custom'
    ? (transferCustomIndex || 'Custom...')
    : (transferSelectedIndex || 'Index');

  const templateDisplay = templateMode === 'custom'
    ? (transferManualFilename || 'Custom...')
    : 'Template';

  return (
    <Popover.Root
      open={isOpen}
      closeOnInteractOutside
      onOpenChange={({ open }) => {
        if (open) onOpenChange(true);
        else handleMenuClose();
      }}
      positioning={{
        placement: 'bottom-end',
        strategy: 'fixed',
      }}
    >
      <Tooltip
        content="Transfer file from Downloads"
        showArrow
        openDelay={0}
        closeDelay={0}
        positioning={{
          placement: "bottom",
          gutter: 8,
        }}
      >
        <Box display="inline-flex">
          <Popover.Trigger asChild>
            <IconButton
              aria-label="Transfer file from Downloads"
              variant="ghost"
              size="sm"
              borderRadius={0}
              color={buttonColor}
              _hover={{ bg: buttonHoverBg }}
              _focus={suppressFocusRing}
              _focusVisible={suppressFocusRing}
              h={FN_TOOLBAR_BTN}
              w={FN_TOOLBAR_BTN}
            >
              <Download size={FN_TOOLBAR_ICON} strokeWidth={2} />
            </IconButton>
          </Popover.Trigger>
        </Box>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            minW="320px"
            maxW="min(90vw, 520px)"
            borderWidth="1px"
            borderStyle="solid"
            borderColor={menuListBorder}
            bg={panelBg}
            zIndex={10000}
            _focus={suppressFocusRing}
            _focusVisible={suppressFocusRing}
            p={2}
          >
            <Flex gap={2} align="stretch" w="100%">
              {/* Left column: 25% - Index selector */}
              <Box ref={indexColRef} w="25%" minW="0" onClick={(e) => e.stopPropagation()}>
                {indexMode === 'dropdown' ? (
                  <Popover.Root
                    open={indexPopoverOpen}
                    closeOnInteractOutside={true}
                    onOpenChange={e => {
                      if (e.open) {
                        setIndexPopoverOpen(true);
                      } else {
                        setIndexPopoverOpen(false);
                      }
                    }}
                    positioning={{
                      placement: 'bottom-start',
                      gutter: 0,
                    }}>
                    <Popover.Trigger asChild>
                      <Flex
                        w="100%"
                        h="40px"
                        minH="40px"
                        align="center"
                        justify="space-between"
                        gap={1}
                        py={2}
                        px={3}
                        fontSize="sm"
                        borderRadius={0}
                        bg={triggerBg}
                        border="1px solid"
                        borderColor={menuListBorder}
                        cursor="pointer"
                        _hover={{ bg: menuHoverBg }}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                        title="Double-click to edit manually"
                        asChild><button
                          type="button"
                          onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndexPopoverOpen(false); setIndexMode('custom'); setTransferCustomIndex(transferSelectedIndex || ''); }}>
                          <Text lineClamp={1} fontSize="sm" fontWeight="medium" color={labelColor}>
                            {indexDisplay}
                          </Text>
                          <ChevronDown size={14} style={{ flexShrink: 0 }} />
                        </button></Flex>
                    </Popover.Trigger>
                    <Popover.Positioner>
                      <Popover.Content
                        w={indexColPx != null ? `${indexColPx}px` : undefined}
                        minW={indexColPx != null ? `${indexColPx}px` : undefined}
                        maxW={indexColPx != null ? `${indexColPx}px` : undefined}
                        maxH="240px"
                        overflowY="auto"
                        borderWidth="1px"
                        borderStyle="solid"
                        borderColor={menuListBorder}
                        bg={menuListBg}
                        zIndex={10001}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                      >
                        <Popover.Body p={0}>
                          <Box display="flex" flexDirection="column" py={1}>
                            {indexKeys.map((index) => (
                              <Box
                                key={index}
                                w="100%"
                                textAlign="left"
                                py={2}
                                px={3}
                                fontSize="sm"
                                color={labelColor}
                                bg="transparent"
                                cursor="pointer"
                                border="none"
                                _hover={{ bg: menuHoverBg }}
                                _focus={suppressFocusRing}
                                _focusVisible={{ ...suppressFocusRing, bg: menuHoverBg }}
                                asChild
                              >
                                <button type="button" onClick={() => handleSelectIndex(index)}>
                                  {index}
                                </button>
                              </Box>
                            ))}
                          </Box>
                        </Popover.Body>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover.Root>
                ) : (
                  <Box w="100%" h="40px" minH="40px">
                    <Input
                      size="sm"
                      w="100%"
                      h="100%"
                      minH="40px"
                      py={2}
                      px={3}
                      fontSize="sm"
                      borderRadius={0}
                      bg={inputBg}
                      border="1px solid"
                      borderColor={menuListBorder}
                      placeholder="Custom index"
                      value={transferCustomIndex}
                      onChange={(e) => setTransferCustomIndex(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const t = transferCustomIndex.trim();
                          if (t) setTransferSelectedIndex(t);
                          setIndexMode('dropdown');
                          setTransferCustomIndex('');
                        }
                      }}
                      onBlur={() => {
                        const t = transferCustomIndex.trim();
                        if (t) setTransferSelectedIndex(t);
                        setIndexMode('dropdown');
                        setTransferCustomIndex('');
                      }}
                      _placeholder={{ color: menuPlaceholderColor }}
                      _focus={suppressFocusRing}
                      _focusVisible={suppressFocusRing}
                    />
                  </Box>
                )}
              </Box>

              {/* Right column: 75% - Template/filename selector */}
              <Box ref={templateColRef} w="75%" minW="0" onClick={(e) => e.stopPropagation()}>
                {templateMode === 'dropdown' ? (
                  <Popover.Root
                    open={templatePopoverOpen}
                    closeOnInteractOutside={true}
                    onOpenChange={e => {
                      if (e.open) {
                        setTemplatePopoverOpen(true);
                      } else {
                        setTemplatePopoverOpen(false);
                      }
                    }}
                    positioning={{
                      placement: 'bottom-start',
                      gutter: 0,
                    }}>
                    <Popover.Trigger asChild>
                      <Flex
                        w="100%"
                        h="40px"
                        minH="40px"
                        align="center"
                        justify="space-between"
                        gap={1}
                        py={2}
                        px={3}
                        fontSize="sm"
                        borderRadius={0}
                        bg={triggerBg}
                        border="1px solid"
                        borderColor={menuListBorder}
                        cursor="pointer"
                        _hover={{ bg: menuHoverBg }}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                        opacity={!effectiveIndex ? 0.5 : 1}
                        title="Double-click to edit manually"
                        asChild><button
                          type="button"
                          disabled={!effectiveIndex}
                          onDoubleClick={(e) => { if (effectiveIndex) { e.preventDefault(); e.stopPropagation(); setTemplatePopoverOpen(false); setTemplateMode('custom'); } }}>
                          <Text lineClamp={1} fontSize="sm" fontWeight="medium" color={labelColor}>
                            {!effectiveIndex ? 'Select index first' : templateDisplay}
                          </Text>
                          <ChevronDown size={14} style={{ flexShrink: 0 }} />
                        </button></Flex>
                    </Popover.Trigger>
                    <Popover.Positioner>
                      <Popover.Content
                        w={templateColPx != null ? `${templateColPx}px` : undefined}
                        minW={templateColPx != null ? `${templateColPx}px` : undefined}
                        maxW={templateColPx != null ? `${templateColPx}px` : undefined}
                        maxH="240px"
                        overflowY="auto"
                        borderWidth="1px"
                        borderStyle="solid"
                        borderColor={menuListBorder}
                        bg={menuListBg}
                        zIndex={10001}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                      >
                        <Popover.Body p={0}>
                          <Box display="flex" flexDirection="column" py={1}>
                            {templates.length === 0 ? (
                              <Box py={2} px={3} fontSize="sm" color={menuPlaceholderColor}>
                                No templates
                              </Box>
                            ) : (
                              templates.map((t) => {
                                const displayText = t.filename.length > 50 ? t.filename.slice(0, 47) + '...' : t.filename;
                                return (
                                  <Box
                                    key={t.command}
                                    w="100%"
                                    textAlign="left"
                                    py={2}
                                    px={3}
                                    fontSize="sm"
                                    color={labelColor}
                                    bg="transparent"
                                    cursor="pointer"
                                    border="none"
                                    _hover={{ bg: menuHoverBg }}
                                    _focus={suppressFocusRing}
                                    _focusVisible={{ ...suppressFocusRing, bg: menuHoverBg }}
                                    title={t.filename}
                                    asChild
                                  >
                                    <button type="button" onClick={() => handleTransferTemplate(t.command)}>
                                      <Text as="span" lineClamp={2} fontSize="sm" textAlign="left" color={labelColor}>
                                        {displayText}
                                      </Text>
                                    </button>
                                  </Box>
                                );
                              })
                            )}
                          </Box>
                        </Popover.Body>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover.Root>
                ) : (
                  <Box w="100%" h="40px" minH="40px">
                    <Input
                      size="sm"
                      w="100%"
                      h="100%"
                      minH="40px"
                      py={2}
                      px={3}
                      fontSize="sm"
                      borderRadius={0}
                      bg={inputBg}
                      border="1px solid"
                      borderColor={menuListBorder}
                      placeholder="Custom filename"
                      value={transferManualFilename}
                      onChange={(e) => setTransferManualFilename(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = transferManualFilename.trim();
                          if (trimmed && effectiveIndex) {
                            handleTransferManual();
                          } else {
                            setTemplateMode('dropdown');
                            setTransferManualFilename('');
                          }
                        }
                      }}
                      onBlur={() => {
                        setTemplateMode('dropdown');
                        setTransferManualFilename('');
                      }}
                      _placeholder={{ color: menuPlaceholderColor }}
                      _focus={suppressFocusRing}
                      _focusVisible={suppressFocusRing}
                    />
                  </Box>
                )}
              </Box>
            </Flex>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

interface FunctionPanelsProps {
  minimizedDialogs: MinimizedDialog[];
  setMinimizedDialogs: React.Dispatch<React.SetStateAction<MinimizedDialog[]>>;
  setOnRestoreDialog: React.Dispatch<React.SetStateAction<((type: DialogType) => void) | undefined>>;
  setOnCloseMinimizedDialog: React.Dispatch<React.SetStateAction<((type: DialogType) => void) | undefined>>;
}

export const FunctionPanels: React.FC<FunctionPanelsProps> = ({ 
  minimizedDialogs, 
  setMinimizedDialogs,
  setOnRestoreDialog,
  setOnCloseMinimizedDialog
}) => {
  const {
    addLog,
    setStatus,
    currentDirectory,
    setFolderItems,
    selectedFiles,
    setSelectedFiles,
    logFileOperation,
    setIsSettingsOpen,
    isPreviewPaneOpen,
    setIsPreviewPaneOpen,
    sessionLayerViewEnabled,
    setSessionLayerViewEnabled,
    addRecentlyTransferredFiles,
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const [isMergePDFOpen, setMergePDFOpen] = useState(false);
  const [isClientSearchOpen, setClientSearchOpen] = useState(false);


  // Use client search shortcut hook
  useClientSearchShortcut(setClientSearchOpen);

  const buttonHoverBg = useColorModeValue('gray.300', 'rgba(255,255,255,0.08)');
  const dividerColor = useColorModeValue('#e2e8f0', 'gray.600');
  const toggleActiveBg = DF_SESSION_RAIL_BG;
  const toggleActiveHoverBg = DF_TOOLBAR_TOGGLE_ACTIVE_HOVER_BG;

  const handleAction = async (action: string) => {
    if (action === 'transfer_mapping') {
      setTransferMappingOpen(true);
      setStatus('Opened transfer mapping', 'info');
      return;
    }

    if (action === 'merge_pdfs') {
      setMergePDFOpen(true);
      setStatus('Opened Merge PDF dialog', 'info');
      return;
    }
    if (action === 'gst_template') {
      addLog('Opening GST Template');
      setStatus('Opening GST Template...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('gst_template', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('GST Template opened', 'success');
        } else {
          addLog(result.message, 'error');
          setStatus('Failed to open GST Template', 'error');
        }
      } catch (error) {
        const errorMsg = `Error opening GST Template: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('Failed to open GST Template', 'error');
        console.error('[FunctionPanels] GST Template error:', error);
      }
      return;
    }

    // Handle GST Rename button action
    if (action === 'gst_rename') {
      addLog('Executing GST Rename command');
      setStatus('Executing GST Rename...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('gst_rename', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('GST Rename completed', 'success');
          
          // Log file operation
          logFileOperation('GST Rename', `Renamed files in ${currentDirectory}`);
          
          // Refresh folder view to show renamed files
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show renamed files', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('GST Rename failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing GST Rename: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('GST Rename failed', 'error');
        console.error('[FunctionPanels] GST Rename error:', error);
      }
      return;
    }

    if (action === 'client_search') {
      console.log('[ClientSearch] Button clicked - opening client search');
      setClientSearchOpen(true);
      setStatus('Opened Client Search', 'info');
      return;
    }

    // Handle extract_zips action
    if (action === 'extract_zips') {
      addLog('Executing Extract ZIPs command');
      setStatus('Extracting ZIP files...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('extract_zips', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('ZIP extraction completed', 'success');
          
          // Green highlight for extracted files
          const extracted = result.extractedFiles ?? [];
          if (extracted.length > 0) {
            addRecentlyTransferredFiles(extracted.map((name: string) => joinPath(currentDirectory, name)));
          }
          
          // Log file operation
          logFileOperation('Extract ZIPs', `Extracted ${result.extractedFiles?.length || 0} files from ZIP archives`);
          
          // Refresh folder view to show extracted files
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show extracted files', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('ZIP extraction failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Extract ZIPs: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('ZIP extraction failed', 'error');
        console.error('[FunctionPanels] Extract ZIPs error:', error);
      }
      return;
    }

    // Handle extract_eml action
    if (action === 'extract_eml') {
      addLog('Executing Extract EML command');
      setStatus('Extracting EML attachments...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('extract_eml', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('EML extraction completed', 'success');
          
          // Green highlight for extracted files
          const extracted = result.extractedFiles ?? [];
          if (extracted.length > 0) {
            addRecentlyTransferredFiles(extracted.map((name: string) => joinPath(currentDirectory, name)));
          }
          
          // Log file operation
          logFileOperation('Extract EML', `Extracted ${result.extractedFiles?.length || 0} attachments from EML files`);
          
          // Refresh folder view to show extracted attachments
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show extracted attachments', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('EML extraction failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Extract EML: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('EML extraction failed', 'error');
        console.error('[FunctionPanels] Extract EML error:', error);
      }
      return;
    }

    if (action === 'gst_transfer') {
      addLog('Executing Transfer Latest (transfer 1)');
      setStatus('Transferring latest file from DL...', 'info');
      try {
        const result = await window.electronAPI.transfer({ numFiles: 1, command: 'transfer', currentDirectory });
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('Transfer Latest completed', 'success');
          
          // Log file operation with renamed filename
          if (result.files && result.files.length > 0) {
            const fileName = result.files[0].name;
            const dirName = currentDirectory.split('\\').pop() || currentDirectory;
            logFileOperation(`${fileName} transferred to ${dirName}`);
          }
          
          // Refresh folder view via FileGrid's filtered reload path
          window.dispatchEvent(new CustomEvent('directoryRefreshed', { detail: { directory: currentDirectory } }));
          setStatus('Transfer Latest completed', 'success');
        } else {
          addLog(result.message, 'error');
          setStatus('Transfer Latest failed', 'error');
          showToast({
            title: 'Transfer Failed',
            description: result.message,
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top',
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : `Error executing Transfer Latest: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('Transfer Latest failed', 'error');
        console.error('[FunctionPanels] Transfer Latest error:', error);
        showToast({
          title: 'Transfer Failed',
          description: errorMsg,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      }
      return;
    }

    addLog(`Executing action: ${action}`);
    const functionNames: { [key: string]: string } = {
      gst_template: 'GST Template',
      gst_rename: 'GST Rename',
      gst_transfer: 'Transfer Latest',
      merge_pdfs: 'Merge PDFs',
      extract_zips: 'Extract Zips',
      extract_eml: 'Extract EML',
      transfer_mapping: 'Transfer Map',
      ai_editor: 'AI Editor',
      update: 'Update',
    };
    const friendlyName = functionNames[action] || action;
    setStatus(`Executing ${friendlyName}...`, 'info');
  };

  // Minimized dialogs handlers (kept for Layout/FolderTabSystem compatibility)
  const handleRestoreDialog = (type: DialogType) => {
    setMinimizedDialogs(prev => prev.filter(d => d.type !== type));
  };

  const handleCloseMinimizedDialog = (type: DialogType) => {
    setMinimizedDialogs(prev => prev.filter(d => d.type !== type));
  };

  // Register handlers with Layout
  useEffect(() => {
    setOnRestoreDialog(() => handleRestoreDialog);
    setOnCloseMinimizedDialog(() => handleCloseMinimizedDialog);
  }, [setOnRestoreDialog, setOnCloseMinimizedDialog]);

  // Icon-only function button component
  const FunctionButton: React.FC<{
    icon: React.ElementType;
    action: string;
    description: string;
    color?: string;
    isDisabled?: boolean;
  }> = ({
    icon,
    action,
    description,
    color = 'blue.400',
    isDisabled = false
  }) => {
    return (
      <Tooltip
        content={description}
        showArrow
        openDelay={0}
        closeDelay={0}
        positioning={{
          placement: "bottom",
          gutter: 8,
        }}
      >
        <IconButton
          aria-label={description}
          size="sm"
          variant="ghost"
          borderRadius={0}
          color={isDisabled ? 'gray.400' : color}
          onClick={() => !isDisabled && handleAction(action)}
          disabled={isDisabled}
          opacity={isDisabled ? 0.5 : 1}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
          _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
          h={FN_TOOLBAR_BTN}
          w={FN_TOOLBAR_BTN}>{React.createElement(icon, { size: FN_TOOLBAR_ICON, strokeWidth: 2 })}</IconButton>
      </Tooltip>
    );
  };

  // Settings component for right side - darker color for right section buttons
  const buttonColor = useColorModeValue('#475569', 'gray.400');

  const handleSettingsClick = async () => {
    try {
      await (window.electronAPI as any).openSettingsWindow();
      addLog('Opening settings window');
      setStatus('Opened settings window', 'info');
    } catch (error) {
      console.error('Error opening settings window:', error);
      setIsSettingsOpen(true);
      addLog('Opening settings panel (fallback)');
      setStatus('Opened settings', 'info');
    }
  };

  return (
    <>
      <Flex 
        direction="row" 
        align="center" 
        h={FN_TOOLBAR_ROW_H} 
        px={2} 
        gap={1}
        borderRadius={0}
        bg="df.toolbar"
      >
        {/* Action buttons — grouped with separators */}
        <Flex gap={0} align="center">
          {/* File operations */}
          <FunctionButton
            icon={Download}
            action="gst_transfer"
            description="Transfer latest file from DL to current path"
            color="blue.600"
          />
          <FunctionButton
            icon={FileEdit}
            action="gst_rename"
            description="Rename files according to GST standards"
            color="green.400"
          />
          <FunctionButton
            icon={FilePlus2}
            action="merge_pdfs"
            description="Combine multiple PDF files into one document"
            color="red.400"
          />
          {/* Separator */}
          <Box w="1px" h={FN_TOOLBAR_SEP_H} bg={dividerColor} mx="4px" opacity={0.5} flexShrink={0} />
          {/* Extract operations */}
          <FunctionButton
            icon={Archive}
            action="extract_zips"
            description="Extract all ZIP files in current directory"
            color="orange.400"
          />
          <FunctionButton
            icon={Mail}
            action="extract_eml"
            description="Extract attachments from EML files"
            color="cyan.400"
          />
          {/* Separator */}
          <Box w="1px" h={FN_TOOLBAR_SEP_H} bg={dividerColor} mx="4px" opacity={0.5} flexShrink={0} />
          {/* Config */}
          <FunctionButton
            icon={Settings}
            action="transfer_mapping"
            description="Edit transfer command mappings"
            color="gray.600"
          />
        </Flex>
        
        {/* Spacer */}
        <Box flex="1" />
        
        {/* Folder Management Buttons - Same style as Settings */}
        <Flex gap={0.5} align="center">
          <Tooltip
            content="Toggle Layer View"
            showArrow
            openDelay={0}
            closeDelay={0}
            positioning={{ placement: "bottom", gutter: 8 }}
          >
            <IconButton
              aria-label="Toggle layer view"
              size="sm"
              variant={sessionLayerViewEnabled ? 'solid' : 'ghost'}
              borderRadius={0}
              bg={sessionLayerViewEnabled ? toggleActiveBg : undefined}
              color={sessionLayerViewEnabled ? 'white' : buttonColor}
              onClick={() => {
                const next = !sessionLayerViewEnabled;
                setSessionLayerViewEnabled(next);
                addLog(`Layer view ${next ? 'on' : 'off'} (session)`);
                setStatus(`Layer view ${next ? 'on' : 'off'} for this session`, 'info');
              }}
              _hover={{ bg: sessionLayerViewEnabled ? toggleActiveHoverBg : buttonHoverBg }}
              _focus={suppressFocusRing}
              _focusVisible={suppressFocusRing}
              h={FN_TOOLBAR_BTN}
              w={FN_TOOLBAR_BTN}><Layers size={FN_TOOLBAR_ICON} strokeWidth={2} /></IconButton>
          </Tooltip>

          <Tooltip
            content={isPreviewPaneOpen ? 'Hide preview pane' : 'Show preview pane'}
            showArrow
            openDelay={0}
            closeDelay={0}
            positioning={{ placement: 'bottom', gutter: 8 }}
          >
            <IconButton
              aria-label="Preview pane"
              size="sm"
              variant={isPreviewPaneOpen ? "solid" : "ghost"}
              borderRadius={0}
              bg={isPreviewPaneOpen ? toggleActiveBg : undefined}
              color={isPreviewPaneOpen ? "white" : buttonColor}
              onClick={() => {
                setIsPreviewPaneOpen(!isPreviewPaneOpen);
                addLog(`Preview pane ${!isPreviewPaneOpen ? 'opened' : 'closed'}`);
                setStatus(`Preview pane ${!isPreviewPaneOpen ? 'opened' : 'closed'}`, 'info');
              }}
              _hover={{ bg: isPreviewPaneOpen ? toggleActiveHoverBg : buttonHoverBg }}
              _focus={suppressFocusRing}
              _focusVisible={suppressFocusRing}
              h={FN_TOOLBAR_BTN}
              w={FN_TOOLBAR_BTN}><Columns2 size={FN_TOOLBAR_ICON} strokeWidth={2} /></IconButton>
          </Tooltip>

        </Flex>
        
        {/* Right side: Settings */}
        <Flex gap={0.5} align="center">
          <IconButton
            aria-label="Settings"
            variant="ghost"
            size="sm"
            borderRadius={0}
            onClick={handleSettingsClick}
            color={buttonColor}
            h={FN_TOOLBAR_BTN}
            w={FN_TOOLBAR_BTN}><Settings size={FN_TOOLBAR_ICON} /></IconButton>
        </Flex>
      </Flex>
      {/* Dialogs: mount only when open (or minimized for stateful AI dialogs) so navigation does not reconcile closed modal trees */}
      {isTransferMappingOpen && (
        <TransferMappingDialog isOpen onClose={() => setTransferMappingOpen(false)} />
      )}
      {isMergePDFOpen && (
        <MergePDFDialog
          isOpen
          onClose={() => setMergePDFOpen(false)}
          currentDirectory={currentDirectory}
          onFileOperation={logFileOperation}
        />
      )}
      {isClientSearchOpen && <ClientSearchOverlay isOpen onClose={() => setClientSearchOpen(false)} />}
    </>
  );
};
