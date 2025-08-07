import React, { useState, useEffect } from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Tabs, TabList, TabPanels, TabPanel, Tab, Heading, Divider } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Receipt, Move, FileSymlink, Clipboard, FileCode, AlertCircle, Settings, Mail, Star, RotateCcw, Copy, Download, BarChart3, CheckCircle2, Eye, Building2, Calculator, Sparkles, FileSearch, Brain, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { useColorModeValue } from '@chakra-ui/react';
import { TransferMappingDialog } from './TransferMappingDialog';
import { OrgCodesDialog } from './OrgCodesDialog';
import { MergePDFDialog } from './MergePDFDialog';
import { ExtractionResultDialog } from './ExtractionResultDialog';
import { LateClaimsDialog } from './LateClaimsDialog';
import { AIEditorDialog } from './AIEditorDialog';
import { AITemplaterDialog } from './AITemplaterDialog';
import { DocumentAnalysisDialog } from './DocumentAnalysisDialog';
import { ManageTemplatesDialog } from './ManageTemplatesDialog';
import { UpdateDialog } from './UpdateDialog';
import { Calculator as CalculatorDialog } from './Calculator';
import { ClientSearchOverlay } from './ClientSearchOverlay';

import { getAppVersion } from '../utils/version';

// Add client search shortcut functionality
const useClientSearchShortcut = (setClientSearchOpen: (open: boolean) => void) => {
  const [clientSearchShortcut, setClientSearchShortcut] = useState('Alt+F');
  const [enableClientSearchShortcut, setEnableClientSearchShortcut] = useState(true);

  useEffect(() => {
    const loadShortcutSettings = async () => {
      try {
        const settings = await (window.electronAPI as any).getConfig();
        console.log('[ClientSearch] Loading settings:', settings);
        setClientSearchShortcut(settings.clientSearchShortcut || 'Alt+F');
        setEnableClientSearchShortcut(settings.enableClientSearchShortcut !== false);
        console.log('[ClientSearch] Shortcut enabled:', settings.enableClientSearchShortcut !== false);
      } catch (error) {
        console.error('Error loading client search shortcut settings:', error);
      }
    };
    loadShortcutSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableClientSearchShortcut) {
        console.log('[ClientSearch] Shortcut disabled');
        return;
      }
      
      // Check for both uppercase and lowercase F, and also handle different key formats
      const key = event.key.toLowerCase();
      const isAltF = event.altKey && key === 'f';
      
      console.log('[ClientSearch] Key pressed:', {
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        isAltF,
        enableClientSearchShortcut
      });
      
      if (isAltF) {
        event.preventDefault();
        console.log('[ClientSearch] Alt+F shortcut triggered');
        // Trigger client search
        setClientSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableClientSearchShortcut, setClientSearchOpen]);

  return { clientSearchShortcut, setClientSearchShortcut, enableClientSearchShortcut, setEnableClientSearchShortcut };
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
      .catch((err: any) => {
        setLoading(false);
        setError('Failed to load preview');
      });
  }, [currentDirectory]);

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

export const FunctionPanels: React.FC = () => {
  const {
    addLog,
    setStatus,
    currentDirectory,
    setFolderItems,
    folderItems,
    selectedFiles
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const [isOrgCodesOpen, setOrgCodesOpen] = useState(false);
  const [isMergePDFOpen, setMergePDFOpen] = useState(false);
  const [isExtractionResultOpen, setExtractionResultOpen] = useState(false);
  const [isLateClaimsOpen, setLateClaimsOpen] = useState(false);
  const [isAIEditorOpen, setAIEditorOpen] = useState(false);
  const [isAITemplaterOpen, setAITemplaterOpen] = useState(false);
  const [isDocumentAnalysisOpen, setDocumentAnalysisOpen] = useState(false);
  const [isManageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isClientSearchOpen, setClientSearchOpen] = useState(false);

  // Use client search shortcut hook
  useClientSearchShortcut(setClientSearchOpen);

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
  const bgColor = useColorModeValue('#f8fafc', 'gray.900');
  const headerBgColor = useColorModeValue('#f1f5f9', 'gray.900');
  const headerTextColor = useColorModeValue('#334155', 'white');
  const buttonHoverBg = useColorModeValue('#e2e8f0', 'gray.700');
  const borderColor = useColorModeValue('#cbd5e1', 'gray.700');

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

    if (action === 'copy_notes') {
      const notes = `- Depreciation run for the period.\n- Fixed Asset Register reconciles to the Balance Sheet\n- No additions or disposals during the period.`;
      try {
        await navigator.clipboard.writeText(notes);
        setStatus('Notes copied to clipboard', 'success');
        addLog('Copied notes to clipboard', 'response');
      } catch (err) {
        setStatus('Failed to copy notes', 'error');
        addLog('Failed to copy notes to clipboard', 'error');
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



    // Handle extract_zips action
    if (action === 'extract_zips') {
      addLog('Executing Extract ZIPs command');
      setStatus('Extracting ZIP files...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('extract_zips', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('ZIP extraction completed', 'success');
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'zip',
              extractedFiles: result.extractedFiles,
              sourceFiles: [] // We'll get this info from the result if needed
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
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'eml',
              extractedFiles: result.extractedFiles,
              sourceFiles: [] // We'll get this info from the result if needed
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
    // Get user-friendly function names
    const functionNames: { [key: string]: string } = {
      gst_template: 'GST Template',
      gst_rename: 'GST Rename',
      gst_transfer: 'Transfer Latest',
      copy_notes: 'Copy Notes',
      merge_pdfs: 'Merge PDFs',
      extract_zips: 'Extract Zips',
      extract_eml: 'Extract EML',
      transfer_mapping: 'Transfer Map',
      ai_editor: 'AI Editor',
      update: 'Update',
      download_reports: 'Download Reports',
      check_unreconciled: 'Bank Lines',
      view_report: 'View Report',
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
        // For now, simulate no update available
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

  const FunctionButton: React.FC<{
    icon: React.ElementType;
    label: string;
    action: string;
    description?: string;
    color?: string;
    isDisabled?: boolean;
  }> = ({
    icon,
    label,
    action,
    description,
    color = 'blue.400',
    isDisabled = false
  }) => {
    const isLong = label.length > 18;
    const { currentDirectory } = useAppContext();
    if (action === 'gst_rename') {
      // Custom tooltip for GST Rename
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
            <Button
              variant="ghost"
              display="flex"
              flexDirection="column"
              height="80px"
              minWidth={isLong ? '90px' : '62px'}
              maxWidth="120px"
              width="fit-content"
              py={2}
              px={1}
              _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
              onClick={() => !isDisabled && handleAction(action)}
              isDisabled={isDisabled}
              opacity={isDisabled ? 0.5 : 1}
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
            >
              <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
                <Icon as={icon} boxSize={7} color={isDisabled ? 'gray.400' : color} />
              </Flex>
              <Text
                as="span"
                fontSize="11px"
                textAlign="center"
                lineHeight="1.1"
                fontWeight="medium"
                width="100%"
                whiteSpace="normal"
                wordBreak="break-word"
                minHeight="24px"
                maxHeight="24px"
                display="inline-block"
                overflow="hidden"
              >
                {(() => {
                  const words = label.split(' ');
                  if (words.length === 1) {
                    return <>{label}<br /></>;
                  } else if (words.length === 2) {
                    return <>{words[0]}<br />{words[1]}</>;
                  } else {
                    const mid = Math.ceil(words.length / 2);
                    return <>{words.slice(0, mid).join(' ')}<br />{words.slice(mid).join(' ')}</>;
                  }
                })()}
              </Text>
            </Button>
          </Tooltip>
        </Box>
      );
    }
    return (
      <Tooltip label={description || action} placement="bottom" hasArrow>
        <Button
          variant="ghost"
          display="flex"
          flexDirection="column"
          height="80px"
          minWidth={isLong ? '90px' : '62px'}
          maxWidth="120px"
          width="fit-content"
          py={2}
          px={1}
          _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
          onClick={() => !isDisabled && handleAction(action)}
          isDisabled={isDisabled}
          opacity={isDisabled ? 0.5 : 1}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
        >
          <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
            <Icon as={icon} boxSize={7} color={isDisabled ? 'gray.400' : color} />
          </Flex>
          <Text
            as="span"
            fontSize="11px"
            textAlign="center"
            lineHeight="1.1"
            fontWeight="medium"
            width="100%"
            whiteSpace="normal"
            wordBreak="break-word"
            minHeight="24px"
            maxHeight="24px"
            display="inline-block"
            overflow="hidden"
          >
            {(() => {
              const words = label.split(' ');
              if (words.length === 1) {
                return <>{label}<br /></>;
              } else if (words.length === 2) {
                return <>{words[0]}<br />{words[1]}</>;
              } else {
                const mid = Math.ceil(words.length / 2);
                return <>{words.slice(0, mid).join(' ')}<br />{words.slice(mid).join(' ')}</>;
              }
            })()}
          </Text>
        </Button>
      </Tooltip>
    );
  };
  return <>
    <Flex direction="column">
      <Tabs variant="line" colorScheme="indigo" size="sm">
        <Flex align="center" justify="space-between" px={2} bg={headerBgColor} borderBottom="2px" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.1)">
          <TabList borderBottom="none">
            <Tab py={1} px={3} fontSize="sm" color={useColorModeValue('#3b82f6', 'white')} _selected={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontWeight: 'semibold'
          }}>
              Functions
            </Tab>
            <Tab py={1} px={3} fontSize="sm" color={useColorModeValue('#3b82f6', 'white')} _selected={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontWeight: 'semibold'
          }}>
              Deprecated
            </Tab>
          </TabList>
          <ThemeToggle />
        </Flex>
        <TabPanels>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={0} align="stretch">
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Download} label="Transfer Latest" action="gst_transfer" description="Transfer latest file from DL to current path" color="blue.600" />
                  <FunctionButton icon={FileEdit} label="GST Rename" action="gst_rename" description="Rename files according to GST standards" color="green.400" />
                  <FunctionButton icon={Calculator} label="Late Claims" action="late_claims" description="Calculate GST late claims adjustments" color="orange.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  GST
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={FilePlus2} label="Merge PDFs" action="merge_pdfs" description="Combine multiple PDF files into one document" color="red.400" />
                  <FunctionButton icon={Archive} label="Extract Zips" action="extract_zips" description="Extract all ZIP files in current directory" color="orange.400" />
                  <FunctionButton icon={Mail} label="Extract EML" action="extract_eml" description="Extract attachments from EML files" color="cyan.400" />
                  <FunctionButton icon={Settings} label="Transfer Map" action="transfer_mapping" description="Edit transfer command mappings" color="gray.600" />
                  <FunctionButton icon={Users} label="Search Clients" action="client_search" description="Search client database for contacts" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  File Management
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Star} label="AI Editor" action="ai_editor" description="Email AI editor for content generation" color="yellow.400" />
                  <FunctionButton icon={Sparkles} label="AI Templater" action="ai_templater" description="Create AI templates for content generation" color="purple.400" />
                  <FunctionButton icon={Brain} label="Analyze Docs" action="analyze_docs" description="AI-powered document analysis and insights" color="blue.400" />
                  <FunctionButton icon={FileEdit} label="Manage Templates" action="manage_templates" description="Create, edit, and manage template YAMLs" color="indigo.400" />
                  <FunctionButton icon={Calculator} label="Calculator" action="calculator" description="Windows-style calculator with history" color="green.400" />
                  <FunctionButton icon={RotateCcw} label="Update" action="update" description="Update application and components" color="pink.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  Utilities
                </Text>
              </Box>
            </Flex>
          </TabPanel>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={0} align="stretch">
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={FileText} label="GST Template" action="gst_template" description="Open GST template for processing" color="blue.400" />
                  <FunctionButton icon={Copy} label="Copy Notes" action="copy_notes" description="Copy asset notes to clipboard" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  GST Functions
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Download} label="Download Reports" action="download_reports" description="Download Xero reports for processing" color="blue.400" />
                  <FunctionButton icon={CheckCircle2} label="Bank Lines" action="check_unreconciled" description="Process bank transaction lines" color="orange.400" />
                  <FunctionButton icon={Eye} label="View Report" action="view_report" description="View generated Xero reports" color="green.400" />
                  <FunctionButton icon={Building2} label="Org Codes" action="org_codes" description="Manage Xero organization codes via OAuth" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  Xero
                </Text>
              </Box>
            </Flex>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
    <TransferMappingDialog isOpen={isTransferMappingOpen} onClose={() => setTransferMappingOpen(false)} />
    <OrgCodesDialog isOpen={isOrgCodesOpen} onClose={() => setOrgCodesOpen(false)} />
    <MergePDFDialog isOpen={isMergePDFOpen} onClose={() => setMergePDFOpen(false)} currentDirectory={currentDirectory} />
    <ExtractionResultDialog 
      isOpen={isExtractionResultOpen} 
      onClose={() => setExtractionResultOpen(false)} 
      type={extractionResult?.type || 'zip'}
      extractedFiles={extractionResult?.extractedFiles || []}
      sourceFiles={extractionResult?.sourceFiles || []}
    />
    <LateClaimsDialog isOpen={isLateClaimsOpen} onClose={() => setLateClaimsOpen(false)} currentDirectory={currentDirectory} />
    <AIEditorDialog isOpen={isAIEditorOpen} onClose={() => setAIEditorOpen(false)} />
    <AITemplaterDialog isOpen={isAITemplaterOpen} onClose={() => setAITemplaterOpen(false)} currentDirectory={currentDirectory} />
    <DocumentAnalysisDialog 
      isOpen={isDocumentAnalysisOpen} 
      onClose={() => setDocumentAnalysisOpen(false)} 
      currentDirectory={currentDirectory}
      selectedFiles={selectedFiles}
      folderItems={folderItems}
    />
    <ManageTemplatesDialog isOpen={isManageTemplatesOpen} onClose={() => setManageTemplatesOpen(false)} currentDirectory={currentDirectory} />
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

  </>;
};