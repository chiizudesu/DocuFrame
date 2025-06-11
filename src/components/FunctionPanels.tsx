import React, { useState, useEffect } from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Tabs, TabList, TabPanels, TabPanel, Tab, Heading, Divider } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Receipt, Move, FileSymlink, Clipboard, FileCode, AlertCircle, Settings, Mail, Star, RotateCcw, Copy, Download, BarChart3, CheckCircle2, Eye, Building2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { useColorModeValue } from '@chakra-ui/react';
import { TransferMappingDialog } from './TransferMappingDialog';
import { OrgCodesDialog } from './OrgCodesDialog';
import { MergePDFDialog } from './MergePDFDialog';
import { ExtractionResultDialog } from './ExtractionResultDialog';

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
    setFolderItems
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const [isOrgCodesOpen, setOrgCodesOpen] = useState(false);
  const [isMergePDFOpen, setMergePDFOpen] = useState(false);
  const [isExtractionResultOpen, setExtractionResultOpen] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{
    type: 'zip' | 'eml';
    extractedFiles: string[];
    sourceFiles: string[];
  } | null>(null);
  const bgColor = useColorModeValue('#f1f5f9', 'gray.900');
  const headerBgColor = useColorModeValue('#ffffff', 'gray.900');
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
      addLog('Executing GST Transfer (transfer 3)');
      setStatus('Transferring 3 files from DL...', 'info');
      try {
        const result = await window.electronAPI.transfer({ numFiles: 3, command: 'transfer', currentDirectory });
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('GST Transfer completed', 'success');
          // Refresh folder view
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('GST Transfer failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing GST Transfer: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('GST Transfer failed', 'error');
        console.error('[FunctionPanels] GST Transfer error:', error);
      }
      return;
    }

    addLog(`Executing action: ${action}`);
    // Get user-friendly function names
    const functionNames: { [key: string]: string } = {
      gst_template: 'GST Template',
      gst_rename: 'GST Rename',
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
  const FunctionButton: React.FC<{
    icon: React.ElementType;
    label: string;
    action: string;
    description?: string;
    color?: string;
  }> = ({
    icon,
    label,
    action,
    description,
    color = 'blue.400'
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
              _hover={{ bg: buttonHoverBg }}
              onClick={() => handleAction(action)}
            >
              <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
                <Icon as={icon} boxSize={7} color={color} />
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
          _hover={{ bg: buttonHoverBg }}
          onClick={() => handleAction(action)}
        >
          <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
            <Icon as={icon} boxSize={7} color={color} />
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
              Xero
            </Tab>
          </TabList>
          <ThemeToggle />
        </Flex>
        <TabPanels>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={0} align="stretch">
              <Box 
                p={2} 
                bg={useColorModeValue('#ffffff', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Download} label="GST Transfer" action="gst_transfer" description="Transfer 3 files from DL to current path" color="blue.600" />
                  <FunctionButton icon={FileText} label="GST Template" action="gst_template" description="Open GST template for processing" color="blue.400" />
                  <FunctionButton icon={FileEdit} label="GST Rename" action="gst_rename" description="Rename files according to GST standards" color="green.400" />
                  <FunctionButton icon={Copy} label="Copy Notes" action="copy_notes" description="Copy asset notes to clipboard" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  GST Functions
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#ffffff', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={FilePlus2} label="Merge PDFs" action="merge_pdfs" description="Combine multiple PDF files into one document" color="red.400" />
                  <FunctionButton icon={Archive} label="Extract Zips" action="extract_zips" description="Extract all ZIP files in current directory" color="orange.400" />
                  <FunctionButton icon={Mail} label="Extract EML" action="extract_eml" description="Extract attachments from EML files" color="cyan.400" />
                  <FunctionButton icon={Settings} label="Transfer Map" action="transfer_mapping" description="Edit transfer command mappings" color="gray.600" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  File Management
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#ffffff', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Star} label="AI Editor" action="ai_editor" description="Email AI editor for content generation" color="yellow.400" />
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
                bg={useColorModeValue('#ffffff', 'rgba(255,255,255,0.03)')} 
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
    {extractionResult && (
      <ExtractionResultDialog
        isOpen={isExtractionResultOpen}
        onClose={() => {
          setExtractionResultOpen(false);
          setExtractionResult(null);
        }}
        type={extractionResult.type}
        extractedFiles={extractionResult.extractedFiles}
        sourceFiles={extractionResult.sourceFiles}
      />
    )}
  </>;
};