import React, { useState, useEffect } from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Divider, IconButton, useColorModeValue, useColorMode, Menu, MenuButton, MenuList, MenuItem, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Settings, Mail, Star, RotateCcw, Calculator, Sparkles, Brain, Clock, Download, Layers, FolderPlus, PanelRightClose, ExternalLink, Plus, FileSpreadsheet, X, FileType, Wand2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { TransferMappingDialog } from './TransferMappingDialog';
import { OrgCodesDialog } from './OrgCodesDialog';
import { MergePDFDialog } from './MergePDFDialog';
import { ExtractionResultDialog } from './ExtractionResultDialog';
import { LateClaimsDialog } from './LateClaimsDialog';
import { AIEditorDialog } from './AIEditorDialog';
import { AITemplaterDialog } from './AITemplaterDialog';
import { DocumentAnalysisDialog } from './DocumentAnalysisDialog';
import { PdfToCsvDialog } from './PdfToCsvDialog';
import { ManageTemplatesDialog } from './ManageTemplatesDialog';
import { UpdateDialog } from './UpdateDialog';
import { Calculator as CalculatorDialog } from './Calculator';
import { ClientSearchOverlay } from './ClientSearchOverlay';
import { TaskTimerSummaryDialog } from './TaskTimerSummaryDialog';
import { type DialogType, type MinimizedDialog } from './MinimizedDialogsBar';
import { getAppVersion } from '../utils/version';
import { taskTimerService, TimerState } from '../services/taskTimer';

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

const GSTPreviewTooltip: React.FC<{ currentDirectory: string }> = ({ currentDirectory }) => {
  const [preview, setPreview] = useState<{ original: string; preview: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setError(null);
    setLoading(true);
    window.electronAPI.executeCommand('gst_rename_preview', currentDirectory)
      .then((result: any) => {
        setLoading(false);
        if (result && result.success && Array.isArray(result.files) && result.files.length > 0) {
          setPreview(result.files);
        } else {
          setPreview([]);
        }
      })
      .catch((_err: any) => {
        setLoading(false);
        setError('Failed to load preview');
      });
  }, [currentDirectory]);
  
  void error;

  if (loading) return <Box p={2} fontSize="sm">Loading preview...</Box>;
  if (error) return <Box p={2} color="red.400" fontSize="sm">{error}</Box>;
  if (!preview || preview.length === 0) return <Box p={2} fontSize="sm">Rename files according to GST standards</Box>;

  return (
    <Box p={2} w="fit-content" overflowX="auto">
      <Box maxH="320px" overflowY="auto" display="flex" flexDirection="column" gap={2}>
        {preview.map((item, idx) => (
          <Box
            key={idx}
            fontSize="sm"
            borderRadius="lg"
            bg={useColorModeValue('gray.100', 'gray.700')}
            px={3}
            py={2}
            boxShadow="sm"
            borderWidth="1px"
            borderColor={useColorModeValue('gray.200', 'gray.600')}
            w="fit-content"
            overflow="visible"
            display="flex"
            flexDirection="column"
            gap={1}
          >
            <Text whiteSpace="normal" wordBreak="break-all" title={item.original} fontWeight="medium" overflow="visible">
              {item.original}
            </Text>
            <Text whiteSpace="normal" wordBreak="break-all" color="green.400" title={item.preview} fontWeight="medium" overflow="visible">
              {item.preview}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
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
    folderItems,
    selectedFiles,
    setLogFileOperation,
    setIsSettingsOpen,
    isGroupedByIndex,
    setIsGroupedByIndex,
    isPreviewPaneOpen,
    setIsPreviewPaneOpen
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const [isOrgCodesOpen, setOrgCodesOpen] = useState(false);
  const [isMergePDFOpen, setMergePDFOpen] = useState(false);
  const [isExtractionResultOpen, setExtractionResultOpen] = useState(false);
  const [isLateClaimsOpen, setLateClaimsOpen] = useState(false);
  const [isAIEditorOpen, setAIEditorOpen] = useState(false);
  const [isAITemplaterOpen, setAITemplaterOpen] = useState(false);
  const [isDocumentAnalysisOpen, setDocumentAnalysisOpen] = useState(false);
  const [isPdfToCsvOpen, setPdfToCsvOpen] = useState(false);
  const [isManageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  
  // Keys to force remount and reset dialog state when closing minimized dialogs
  const [dialogKeys, setDialogKeys] = useState({
    aiEditor: 0,
    aiTemplater: 0,
    documentAnalysis: 0,
    pdfToCsv: 0,
    manageTemplates: 0,
  });
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isClientSearchOpen, setClientSearchOpen] = useState(false);
  const [isTaskTimerSummaryOpen, setTaskTimerSummaryOpen] = useState(false);
  
  // Input dialog state
  const [inputDialog, setInputDialog] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    onSubmit: (value: string) => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    placeholder: '',
    onSubmit: async () => {}
  });
  const [inputValue, setInputValue] = useState('');
  
  // Templates state
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  // Task Timer state (kept for logFileOperation functionality)
  const [timerState, setTimerState] = useState<TimerState>({ currentTask: null, isRunning: false, isPaused: false });
  
  // Use client search shortcut hook
  useClientSearchShortcut(setClientSearchOpen);
  
  // Load timer state from localStorage on mount (for logFileOperation functionality)
  useEffect(() => {
    const savedState = taskTimerService.getTimerState();
    setTimerState(savedState);
  }, []);
  
  // Function to log file operations (exported via context)
  const logFileOperation = React.useCallback((operation: string, details?: string) => {
    if (timerState.isRunning && timerState.currentTask && !timerState.isPaused) {
      const updatedTask = taskTimerService.logFileOperation(timerState.currentTask, operation, details);
      setTimerState({
        ...timerState,
        currentTask: updatedTask
      });
    }
  }, [timerState]);
  
  // Register logFileOperation with context so other components can use it
  React.useEffect(() => {
    setLogFileOperation(() => logFileOperation);
  }, [logFileOperation, setLogFileOperation]);

  // Handle opening floating timer window
  const handleOpenFloatingTimer = async () => {
    try {
      await (window.electronAPI as any).openFloatingTimer();
      addLog('Opened floating timer window', 'info');
      setStatus('Floating timer opened', 'success');
    } catch (error) {
      console.error('[TaskTimer] Error opening floating timer:', error);
      addLog(`Error opening floating timer: ${error}`, 'error');
      setStatus('Failed to open floating timer', 'error');
    }
  };

  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    availableVersion?: string;
    releaseNotes?: string;
    downloadSize?: string;
    isDownloading: boolean;
    downloadProgress?: number;
    isDownloaded: boolean;
    error?: string;
  }>({
    currentVersion: getAppVersion(),
    availableVersion: undefined,
    releaseNotes: undefined,
    downloadSize: undefined,
    isDownloading: false,
    downloadProgress: undefined,
    isDownloaded: false,
    error: undefined
  });
  const [extractionResult, setExtractionResult] = useState<{
    type: 'zip' | 'eml';
    extractedFiles: string[];
    sourceFiles: string[];
  } | null>(null);
  const buttonHoverBg = useColorModeValue('#e2e8f0', 'gray.700');
  const dividerColor = useColorModeValue('#e2e8f0', 'gray.600');

  const handleAction = async (action: string) => {
    if (action === 'transfer_mapping') {
      setTransferMappingOpen(true);
      setStatus('Opened transfer mapping', 'info');
      return;
    }
    if (action === 'org_codes') {
      setOrgCodesOpen(true);
      setStatus('Opened Org Codes manager', 'info');
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

    if (action === 'late_claims') {
      setLateClaimsOpen(true);
      setStatus('Opened Late Claims Calculator', 'info');
      return;
    }

    if (action === 'ai_editor') {
      setAIEditorOpen(true);
      setStatus('Opened AI Email Editor', 'info');
      return;
    }

    if (action === 'ai_templater') {
      setAITemplaterOpen(true);
      setStatus('Opened AI Templater', 'info');
      return;
    }

    if (action === 'analyze_docs') {
      setDocumentAnalysisOpen(true);
      setStatus('Opened Document Analysis', 'info');
      return;
    }

    if (action === 'pdf_to_csv') {
      setPdfToCsvOpen(true);
      setStatus('Opened PDF to CSV', 'info');
      return;
    }

    if (action === 'manage_templates') {
      setManageTemplatesOpen(true);
      setStatus('Opened Template Manager', 'info');
      return;
    }

    if (action === 'calculator') {
      setCalculatorOpen(true);
      setStatus('Opened Calculator', 'info');
      return;
    }

    if (action === 'client_search') {
      console.log('[ClientSearch] Button clicked - opening client search');
      setClientSearchOpen(true);
      setStatus('Opened Client Search', 'info');
      return;
    }

    if (action === 'task_timer') {
      await handleOpenFloatingTimer();
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
          
          // Log file operation
          logFileOperation('Extract ZIPs', `Extracted ${result.extractedFiles?.length || 0} files from ZIP archives`);
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'zip',
              extractedFiles: result.extractedFiles,
              sourceFiles: []
            });
            setExtractionResultOpen(true);
          }
          
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
          
          // Log file operation
          logFileOperation('Extract EML', `Extracted ${result.extractedFiles?.length || 0} attachments from EML files`);
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'eml',
              extractedFiles: result.extractedFiles,
              sourceFiles: []
            });
            setExtractionResultOpen(true);
          }
          
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
          
          // Refresh folder view
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('Transfer Latest failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Transfer Latest: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('Transfer Latest failed', 'error');
        console.error('[FunctionPanels] Transfer Latest error:', error);
      }
      return;
    }

    // Handle update action
    if (action === 'update') {
      setIsUpdateDialogOpen(true);
      setStatus('Opened update dialog', 'info');
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
      org_codes: 'Org Codes'
    };
    const friendlyName = functionNames[action] || action;
    setStatus(`Executing ${friendlyName}...`, 'info');
  };

  const handleCheckForUpdates = async () => {
    addLog('Checking for updates...', 'info');
    setUpdateInfo(prev => ({ ...prev, error: undefined }));
    
    try {
      const result = await window.electronAPI.executeCommand('update', currentDirectory);
      
      if (result.success) {
        addLog('Update check completed', 'response');
        setUpdateInfo(prev => ({
          ...prev,
          availableVersion: undefined,
          error: undefined
        }));
      } else {
        addLog(result.message, 'error');
        setUpdateInfo(prev => ({
          ...prev,
          error: result.message
        }));
      }
    } catch (error) {
      const errorMsg = `Error checking for updates: ${error}`;
      addLog(errorMsg, 'error');
      setUpdateInfo(prev => ({
        ...prev,
        error: errorMsg
      }));
    }
  };

  const handleDownloadUpdate = async () => {
    addLog('Downloading update...', 'info');
    setUpdateInfo(prev => ({ 
      ...prev, 
      isDownloading: true, 
      downloadProgress: 0,
      error: undefined 
    }));
    
    // Simulate download progress
    const progressInterval = setInterval(() => {
      setUpdateInfo(prev => {
        if (prev.downloadProgress! >= 100) {
          clearInterval(progressInterval);
          return {
            ...prev,
            isDownloading: false,
            isDownloaded: true
          };
        }
        return {
          ...prev,
          downloadProgress: (prev.downloadProgress || 0) + 10
        };
      });
    }, 500);
  };

  const handleInstallUpdate = async () => {
    addLog('Installing update...', 'info');
    try {
      await window.electronAPI.quitAndInstall();
    } catch (error) {
      const errorMsg = `Error installing update: ${error}`;
      addLog(errorMsg, 'error');
      setUpdateInfo(prev => ({
        ...prev,
        error: errorMsg
      }));
    }
  };

  // Minimized dialogs handlers
  const handleMinimizeDialog = (type: DialogType) => {
    switch (type) {
      case 'documentAnalysis':
        setDocumentAnalysisOpen(false);
        break;
      case 'aiEditor':
        setAIEditorOpen(false);
        break;
      case 'aiTemplater':
        setAITemplaterOpen(false);
        break;
      case 'pdfToCsv':
        setPdfToCsvOpen(false);
        break;
      case 'manageTemplates':
        setManageTemplatesOpen(false);
        break;
    }
    
    setMinimizedDialogs(prev => {
      if (prev.some(d => d.type === type)) return prev;
      
      const labels: Record<DialogType, string> = {
        documentAnalysis: 'Analyze Documents',
        aiEditor: 'AI Editor',
        aiTemplater: 'AI Templater',
        pdfToCsv: 'PDF to CSV',
        manageTemplates: 'Templates'
      };
      
      return [...prev, { type, label: labels[type] }];
    });
  };

  const handleRestoreDialog = (type: DialogType) => {
    setMinimizedDialogs(prev => prev.filter(d => d.type !== type));
    
    switch (type) {
      case 'documentAnalysis':
        setDocumentAnalysisOpen(true);
        break;
      case 'aiEditor':
        setAIEditorOpen(true);
        break;
      case 'aiTemplater':
        setAITemplaterOpen(true);
        break;
      case 'pdfToCsv':
        setPdfToCsvOpen(true);
        break;
      case 'manageTemplates':
        setManageTemplatesOpen(true);
        break;
    }
  };

  const handleCloseMinimizedDialog = (type: DialogType) => {
    setMinimizedDialogs(prev => prev.filter(d => d.type !== type));
    
    // Reset dialog state by incrementing key to force remount
    setDialogKeys(prev => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] + 1,
    }));
    
    // Ensure dialog is closed
    switch (type) {
      case 'documentAnalysis':
        setDocumentAnalysisOpen(false);
        break;
      case 'aiEditor':
        setAIEditorOpen(false);
        break;
      case 'aiTemplater':
        setAITemplaterOpen(false);
        break;
      case 'pdfToCsv':
        setPdfToCsvOpen(false);
        break;
      case 'manageTemplates':
        setManageTemplatesOpen(false);
        break;
    }
  };

  // Register handlers with Layout
  useEffect(() => {
    setOnRestoreDialog(() => handleRestoreDialog);
    setOnCloseMinimizedDialog(() => handleCloseMinimizedDialog);
  }, [setOnRestoreDialog, setOnCloseMinimizedDialog]);

  // Load templates function
  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const result = await (window.electronAPI as any).getWorkpaperTemplates();
      if (result.success) {
        setTemplates(result.templates || []);
      } else {
        console.warn('Failed to load workpaper templates:', result.message);
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading workpaper templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Handle creating file from template
  const handleCreateFromTemplate = async (templatePath: string, templateName: string) => {
    try {
      const fileName = templateName.replace('.xlsx', '');
      const destPath = `${currentDirectory}\\${fileName}.xlsx`;
      
      await (window.electronAPI as any).copyWorkpaperTemplate(templatePath, destPath);
      
      addLog(`Created ${fileName}.xlsx from template`);
      setStatus(`Created ${fileName}.xlsx from template`, 'success');
      
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      setFolderItems(contents);
    } catch (error) {
      console.error('Error creating from template:', error);
      addLog(`Failed to create from template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create from template', 'error');
    }
  };

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
    const { currentDirectory } = useAppContext();
    
    if (action === 'gst_rename') {
      const [showPreview, setShowPreview] = useState(false);
      return (
        <Box onMouseEnter={() => setShowPreview(true)} onMouseLeave={() => setShowPreview(false)}>
          <Tooltip
            isOpen={showPreview}
            placement="bottom"
            hasArrow
            label={<GSTPreviewTooltip currentDirectory={currentDirectory} />}
            bg={useColorModeValue('white', 'gray.800')}
            color={useColorModeValue('gray.800', 'white')}
            p={0}
            minW="340px"
            borderRadius="md"
            boxShadow="lg"
          >
            <IconButton
              aria-label={description}
              icon={<Icon as={icon} boxSize={5} />}
              size="sm"
              variant="ghost"
              color={isDisabled ? 'gray.400' : color}
              onClick={() => !isDisabled && handleAction(action)}
              isDisabled={isDisabled}
              opacity={isDisabled ? 0.5 : 1}
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
              _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
              h="40px"
              w="40px"
            />
          </Tooltip>
        </Box>
      );
    }
    
    return (
      <Tooltip label={description} placement="bottom" hasArrow>
        <IconButton
          aria-label={description}
          icon={<Icon as={icon} boxSize={5} />}
          size="sm"
          variant="ghost"
          color={isDisabled ? 'gray.400' : color}
          onClick={() => !isDisabled && handleAction(action)}
          isDisabled={isDisabled}
          opacity={isDisabled ? 0.5 : 1}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
          _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
          h="40px"
          w="40px"
        />
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

  return <>
    <Flex 
      direction="row" 
      align="center" 
      h="50px" 
      px={2} 
      gap={1}
      bg={useColorModeValue('#f8fafc', 'gray.900')}
    >
      {/* GST Functions */}
      <Flex gap={1}>
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
          icon={Calculator} 
          action="late_claims" 
          description="Calculate GST late claims adjustments" 
          color="orange.400" 
        />
      </Flex>
      
      <Divider orientation="vertical" borderColor={dividerColor} h="30px" />
      
      {/* File Management Functions */}
      <Flex gap={1}>
        <FunctionButton 
          icon={FilePlus2} 
          action="merge_pdfs" 
          description="Combine multiple PDF files into one document" 
          color="red.400" 
        />
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
        <FunctionButton 
          icon={Settings} 
          action="transfer_mapping" 
          description="Edit transfer command mappings" 
          color="gray.600" 
        />
      </Flex>
      
      <Divider orientation="vertical" borderColor={dividerColor} h="30px" />
      
      {/* Utilities Functions */}
      <Flex gap={1}>
        <FunctionButton 
          icon={Wand2} 
          action="ai_editor" 
          description="Email AI editor for content generation" 
          color="yellow.400" 
        />
        <FunctionButton 
          icon={Sparkles} 
          action="ai_templater" 
          description="Create AI templates for content generation" 
          color="purple.400" 
        />
        <FunctionButton 
          icon={Brain} 
          action="analyze_docs" 
          description="AI-powered document analysis and insights" 
          color="blue.400" 
        />
        <FunctionButton 
          icon={FileSpreadsheet} 
          action="pdf_to_csv" 
          description="Convert PDF tables to CSV format" 
          color="green.400" 
        />
        <FunctionButton 
          icon={FileEdit} 
          action="manage_templates" 
          description="Create, edit, and manage template YAMLs" 
          color="indigo.400" 
        />
        <FunctionButton 
          icon={Clock} 
          action="task_timer" 
          description="Open floating task timer window" 
          color="green.400" 
        />
        <FunctionButton 
          icon={RotateCcw} 
          action="update" 
          description="Update application and components" 
          color="pink.400" 
        />
      </Flex>
      
      {/* Minimized Dialogs - if any */}
      {minimizedDialogs.length > 0 && (
        <>
          <Divider orientation="vertical" borderColor={dividerColor} h="30px" />
          <Flex gap={0.5} align="center">
            {minimizedDialogs.map((dialog) => {
              const getDialogIcon = (type: DialogType) => {
                switch (type) {
                  case 'documentAnalysis':
                    return Brain;
                  case 'aiEditor':
                    return Mail;
                  case 'aiTemplater':
                    return FileType;
                  case 'pdfToCsv':
                    return FileSpreadsheet;
                  case 'manageTemplates':
                    return FileText;
                  default:
                    return FileText;
                }
              };
              const DialogIcon = getDialogIcon(dialog.type);
              const iconActiveBg = useColorModeValue('#64748b', 'blue.800');
              return (
                <Box
                  key={dialog.type}
                  position="relative"
                  _hover={{
                    '& .close-button': {
                      opacity: 1,
                    },
                  }}
                >
                  <Tooltip label={dialog.label} placement="bottom" hasArrow>
                    <IconButton
                      aria-label={dialog.label}
                      icon={<Icon as={DialogIcon} boxSize={5} />}
                      size="sm"
                      variant="solid"
                      bg={iconActiveBg}
                      color={useColorModeValue('#e2e8f0', 'gray.300')}
                      onClick={() => handleRestoreDialog(dialog.type)}
                      _hover={{ bg: useColorModeValue('#5a6c7d', 'blue.700') }}
                      h="40px"
                      w="40px"
                    />
                  </Tooltip>
                  <IconButton
                    aria-label={`Close ${dialog.label}`}
                    icon={<X size={10} />}
                    size="xs"
                    position="absolute"
                    top={-1}
                    right={-1}
                    variant="solid"
                    colorScheme="red"
                    borderRadius="full"
                    minW="16px"
                    h="16px"
                    opacity={0}
                    className="close-button"
                    transition="opacity 0.2s"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseMinimizedDialog(dialog.type);
                    }}
                  />
                </Box>
              );
            })}
          </Flex>
        </>
      )}
      
      {/* Spacer */}
      <Box flex="1" />
      
      {/* Folder Management Buttons - Same style as Settings */}
      <Flex gap={0.5} align="center">
        <Tooltip label={isGroupedByIndex ? 'Ungroup by index' : 'Group by index'} placement="bottom" hasArrow>
          <IconButton
            aria-label={isGroupedByIndex ? 'Ungroup by index' : 'Group by index'}
            icon={<Icon as={Layers} boxSize={5} />}
            size="sm"
            variant={isGroupedByIndex ? "solid" : "ghost"}
            bg={isGroupedByIndex ? useColorModeValue('blue.600', 'blue.700') : undefined}
            color={isGroupedByIndex ? "white" : buttonColor}
            onClick={() => setIsGroupedByIndex(!isGroupedByIndex)}
            _hover={{ bg: isGroupedByIndex ? useColorModeValue('blue.700', 'blue.600') : buttonHoverBg }}
            h="40px"
            w="40px"
          />
        </Tooltip>
        
        <Tooltip label={isPreviewPaneOpen ? 'Hide preview pane' : 'Show preview pane'} placement="bottom" hasArrow>
          <IconButton
            aria-label="Preview pane"
            icon={<Icon as={PanelRightClose} boxSize={5} />}
            size="sm"
            variant={isPreviewPaneOpen ? "solid" : "ghost"}
            bg={isPreviewPaneOpen ? useColorModeValue('blue.600', 'blue.700') : undefined}
            color={isPreviewPaneOpen ? "white" : buttonColor}
            onClick={() => {
              setIsPreviewPaneOpen(!isPreviewPaneOpen);
              addLog(`Preview pane ${!isPreviewPaneOpen ? 'opened' : 'closed'}`);
              setStatus(`Preview pane ${!isPreviewPaneOpen ? 'opened' : 'closed'}`, 'info');
            }}
            _hover={{ bg: isPreviewPaneOpen ? useColorModeValue('blue.700', 'blue.600') : buttonHoverBg }}
            h="40px"
            w="40px"
          />
        </Tooltip>
        
        <Menu onOpen={loadTemplates}>
          <MenuButton
            as={IconButton}
            icon={<Icon as={Plus} boxSize={5} />}
            aria-label="Create new document"
            variant="ghost"
            size="sm"
            color={buttonColor}
            _hover={{ bg: buttonHoverBg }}
            h="40px"
            w="40px"
          />
          <MenuList minW="200px" borderRadius="md" py={0}>
            {/* Templates from workpaperTemplateFolderPath */}
            {templates.length > 0 && (
              <>
                {templates.map((template) => (
                  <MenuItem
                    key={template.path}
                    icon={<FileSpreadsheet size={14} />}
                    onClick={() => handleCreateFromTemplate(template.path, template.name)}
                    py={1.5}
                    px={3}
                    bg={useColorModeValue('#3b82f6', 'blue.700')}
                    _hover={{ bg: useColorModeValue('#2563eb', 'blue.600') }}
                    color="white"
                    borderBottom="1px solid"
                    borderColor={useColorModeValue('#e5e7eb', 'gray.600')}
                  >
                    {template.name.replace('.xlsx', '')}
                  </MenuItem>
                ))}
                <Divider borderColor={useColorModeValue('#e5e7eb', 'gray.600')} />
              </>
            )}
            {isLoadingTemplates && (
              <MenuItem isDisabled py={1.5} px={3}>
                Loading templates...
              </MenuItem>
            )}
            <MenuItem 
              icon={<FileSpreadsheet size={14} />} 
              onClick={() => {
                setInputValue('');
                setInputDialog({
                  isOpen: true,
                  title: 'New Spreadsheet',
                  placeholder: 'Enter spreadsheet name',
                  onSubmit: async (newSpreadsheetName: string) => {
                    if (!newSpreadsheetName?.trim()) return;
                    
                    try {
                      const fileName = `${newSpreadsheetName}.xlsx`;
                      const filePath = `${currentDirectory}\\${fileName}`;
                      
                      await (window.electronAPI as any).createBlankSpreadsheet(filePath);
                      
                      addLog(`Created blank spreadsheet: ${fileName}`);
                      setStatus(`Created ${fileName}`, 'success');
                      
                      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                      setFolderItems(contents);
                    } catch (error) {
                      console.error('Error creating spreadsheet:', error);
                      addLog(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                      setStatus('Failed to create spreadsheet', 'error');
                    }
                  }
                });
              }}
              py={1.5}
              px={3}
              bg={useColorModeValue('#dcfce7', 'green.900')}
              _hover={{ bg: useColorModeValue('#bbf7d0', 'green.800') }}
              borderBottom="1px solid"
              borderColor={useColorModeValue('#e5e7eb', 'gray.600')}
            >
              New Spreadsheet
            </MenuItem>
            <MenuItem 
              icon={<FileText size={14} />} 
              onClick={async () => {
                try {
                  const fileName = `New Document.docx`;
                  const filePath = `${currentDirectory}\\${fileName}`;
                  
                  await (window.electronAPI as any).createWordDocument(filePath);
                  
                  addLog(`Created Word document: ${fileName}`);
                  setStatus(`Created ${fileName}`, 'success');
                  
                  const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                  setFolderItems(contents);
                } catch (error) {
                  console.error('Error creating Word document:', error);
                  addLog(`Failed to create Word document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                  setStatus('Failed to create Word document', 'error');
                }
              }}
              py={1.5}
              px={3}
              bg={useColorModeValue('#dbeafe', 'blue.900')}
              _hover={{ bg: useColorModeValue('#bfdbfe', 'blue.800') }}
              borderBottom="1px solid"
              borderColor={useColorModeValue('#e5e7eb', 'gray.600')}
            >
              New Word Document
            </MenuItem>
          </MenuList>
        </Menu>
        
        <Tooltip label="Create folder" placement="bottom" hasArrow>
          <IconButton
            aria-label="Create folder"
            icon={<Icon as={FolderPlus} boxSize={5} />}
            size="sm"
            variant="ghost"
            color={buttonColor}
            onClick={async () => {
              const newFolderName = prompt('Enter folder name:');
              if (!newFolderName?.trim()) return;
              
              try {
                const fullPath = `${currentDirectory}\\${newFolderName}`;
                await (window.electronAPI as any).createDirectory(fullPath);
                addLog(`Created folder: ${newFolderName}`);
                setStatus(`Created folder: ${newFolderName}`, 'success');
                
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                setFolderItems(contents);
              } catch (error) {
                console.error('Error creating folder:', error);
                addLog(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                setStatus(`Failed to create folder: ${newFolderName}`, 'error');
              }
            }}
            _hover={{ bg: buttonHoverBg }}
            h="40px"
            w="40px"
          />
        </Tooltip>
        
        <Tooltip label="Open in file explorer" placement="bottom" hasArrow>
          <IconButton
            aria-label="Open in explorer"
            icon={<Icon as={ExternalLink} boxSize={5} />}
            size="sm"
            variant="ghost"
            color={buttonColor}
            onClick={async () => {
              try {
                await (window.electronAPI as any).openDirectory(currentDirectory);
                addLog(`Opened in file explorer: ${currentDirectory}`);
                setStatus('Opened in file explorer', 'success');
              } catch (error) {
                addLog(`Failed to open in file explorer: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                setStatus('Failed to open in file explorer', 'error');
              }
            }}
            _hover={{ bg: buttonHoverBg }}
            h="40px"
            w="40px"
          />
        </Tooltip>
      </Flex>
      
      {/* Right side: Settings */}
      <Flex gap={0.5} align="center">
        <IconButton 
          icon={<Settings size={16} />} 
          aria-label="Settings" 
          variant="ghost" 
          size="sm" 
          onClick={handleSettingsClick} 
          color={buttonColor}
          h="40px"
          w="40px"
        />
      </Flex>
    </Flex>
    
    {/* Dialogs */}
    <TransferMappingDialog isOpen={isTransferMappingOpen} onClose={() => setTransferMappingOpen(false)} />
    <OrgCodesDialog isOpen={isOrgCodesOpen} onClose={() => setOrgCodesOpen(false)} />
    <MergePDFDialog 
      isOpen={isMergePDFOpen} 
      onClose={() => setMergePDFOpen(false)} 
      currentDirectory={currentDirectory}
      onFileOperation={logFileOperation}
    />
    <ExtractionResultDialog 
      isOpen={isExtractionResultOpen} 
      onClose={() => setExtractionResultOpen(false)} 
      type={extractionResult?.type || 'zip'}
      extractedFiles={extractionResult?.extractedFiles || []}
      sourceFiles={extractionResult?.sourceFiles || []}
    />
    <LateClaimsDialog isOpen={isLateClaimsOpen} onClose={() => setLateClaimsOpen(false)} currentDirectory={currentDirectory} />
    <AIEditorDialog 
      key={`aiEditor-${dialogKeys.aiEditor}`}
      isOpen={isAIEditorOpen} 
      onClose={() => setAIEditorOpen(false)}
      onMinimize={() => handleMinimizeDialog('aiEditor')}
    />
    <AITemplaterDialog 
      key={`aiTemplater-${dialogKeys.aiTemplater}`}
      isOpen={isAITemplaterOpen} 
      onClose={() => setAITemplaterOpen(false)} 
      currentDirectory={currentDirectory}
      onMinimize={() => handleMinimizeDialog('aiTemplater')}
    />
    <DocumentAnalysisDialog 
      key={`documentAnalysis-${dialogKeys.documentAnalysis}`}
      isOpen={isDocumentAnalysisOpen} 
      onClose={() => setDocumentAnalysisOpen(false)} 
      currentDirectory={currentDirectory}
      selectedFiles={selectedFiles}
      folderItems={folderItems}
      onMinimize={() => handleMinimizeDialog('documentAnalysis')}
    />
    <PdfToCsvDialog 
      key={`pdfToCsv-${dialogKeys.pdfToCsv}`}
      isOpen={isPdfToCsvOpen} 
      onClose={() => setPdfToCsvOpen(false)} 
      currentDirectory={currentDirectory}
      selectedFiles={selectedFiles}
      folderItems={folderItems}
      onMinimize={() => handleMinimizeDialog('pdfToCsv')}
    />
    <ManageTemplatesDialog 
      key={`manageTemplates-${dialogKeys.manageTemplates}`}
      isOpen={isManageTemplatesOpen} 
      onClose={() => setManageTemplatesOpen(false)} 
      currentDirectory={currentDirectory}
      onMinimize={() => handleMinimizeDialog('manageTemplates')}
    />
    <CalculatorDialog isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <UpdateDialog 
      isOpen={isUpdateDialogOpen} 
      onClose={() => setIsUpdateDialogOpen(false)}
      onCheckForUpdates={handleCheckForUpdates}
      onDownloadUpdate={handleDownloadUpdate}
      onInstallUpdate={handleInstallUpdate}
      updateInfo={updateInfo}
    />
    <ClientSearchOverlay 
      isOpen={isClientSearchOpen} 
      onClose={() => setClientSearchOpen(false)} 
    />
    <TaskTimerSummaryDialog
      isOpen={isTaskTimerSummaryOpen}
      onClose={() => setTaskTimerSummaryOpen(false)}
    />
    
    {/* Input Dialog */}
    <Modal 
      isOpen={inputDialog.isOpen} 
      onClose={() => setInputDialog({ ...inputDialog, isOpen: false })}
      size="md"
      isCentered
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={useColorModeValue('white', 'gray.800')}>
        <ModalHeader>{inputDialog.title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Input
            placeholder={inputDialog.placeholder}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                inputDialog.onSubmit(inputValue.trim()).then(() => {
                  setInputDialog({ ...inputDialog, isOpen: false });
                  setInputValue('');
                });
              }
            }}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button 
            variant="ghost" 
            mr={3} 
            onClick={() => {
              setInputDialog({ ...inputDialog, isOpen: false });
              setInputValue('');
            }}
          >
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={async () => {
              if (inputValue.trim()) {
                await inputDialog.onSubmit(inputValue.trim());
                setInputDialog({ ...inputDialog, isOpen: false });
                setInputValue('');
              }
            }}
            isDisabled={!inputValue.trim()}
          >
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </>;
};
