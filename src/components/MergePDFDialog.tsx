import React, { useState, useEffect, useMemo } from 'react';
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  Checkbox,
  VStack,
  Input,
  Text,
  Box,
  Alert,
  Flex,
  Icon,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { FileText } from 'lucide-react';
import type { FileItem } from '../types';
import { useAppContext } from '../context/AppContext';

interface MergePDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  preselectedFiles?: string[];
  onFileOperation?: (operation: string, details?: string) => void;
}

export const MergePDFDialog: React.FC<MergePDFDialogProps> = ({
  isOpen,
  onClose,
  currentDirectory,
  preselectedFiles = [],
  onFileOperation
}) => {
  // Memoize preselectedFiles to prevent infinite re-renders
  const memoizedPreselectedFiles = useMemo(() => preselectedFiles, [preselectedFiles?.join(',')]);
  
  const [pdfFiles, setPdfFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addLog, setStatus } = useAppContext();
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    inputBg,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();

  // Load PDF files from current directory
  useEffect(() => {
    if (isOpen && currentDirectory) {
      loadPDFFiles();
    }
  }, [isOpen, currentDirectory]);

  // Set preselected files when dialog opens and preselected files exist
  useEffect(() => {
    if (isOpen && memoizedPreselectedFiles.length > 0) {
      setSelectedFiles(memoizedPreselectedFiles);
    }
  }, [isOpen, memoizedPreselectedFiles]);

  const loadPDFFiles = async () => {
    try {
      setError(null);
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      const pdfs = contents.filter((file: FileItem) => 
        file.type === 'file' && file.name.toLowerCase().endsWith('.pdf')
      );
      setPdfFiles(pdfs);
      
      if (pdfs.length === 0) {
        setError('No PDF files found in current directory');
      }
    } catch (err) {
      setError('Failed to load PDF files');
      console.error('Error loading PDF files:', err);
    }
  };

  const handleFileToggle = (filename: string) => {
    setSelectedFiles(prev => 
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === pdfFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(pdfFiles.map(f => f.name));
    }
  };

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      setError('Please select at least 2 PDF files to merge');
      return;
    }

    if (!outputFilename.trim()) {
      setError('Please enter an output filename');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add .pdf extension if not present
      const filename = outputFilename.endsWith('.pdf') 
        ? outputFilename 
        : `${outputFilename}.pdf`;

      const result = await (window.electronAPI as any).executeCommand('merge_pdfs', currentDirectory, {
        files: selectedFiles,
        outputFilename: filename
      });

      if (result.success) {
        addLog(result.message, 'response');
        setStatus('PDFs merged successfully', 'success');
        
        // Log file operation for task timer
        if (onFileOperation) {
          onFileOperation('Merge PDFs', `Merged ${selectedFiles.length} PDFs into ${filename}`);
        }
        
        onClose();
        // Reset state for next use
        setSelectedFiles([]);
        setOutputFilename('');
      } else {
        addLog(result.message || 'Failed to merge PDFs', 'error');
        setStatus('PDF merge failed', 'error');
        setError(result.message || 'Failed to merge PDFs');
      }
    } catch (err) {
      setError('Error during PDF merge operation');
      console.error('Merge PDF error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setOutputFilename('');
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} placement='center' onOpenChange={e => {
      if (!e.open) {
        handleClose();
      }
    }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            borderRadius={0}
            boxShadow="xl"
            display="flex"
            flexDirection="column"
            overflow="hidden"
            w="400px"
            maxW="400px"
          >
            <Dialog.Header
              bg={titleBarBg}
              borderBottomWidth="1px"
              borderColor={borderColor}
              borderRadius={0}
              py={1.5}
              px={3}
              minH="31px"
            >
              <Flex align="center" gap={2}>
                <Icon color="red.400" asChild><FileText /></Icon>
                <Text fontSize="sm" fontWeight="600" color={textColor}>
                  Merge PDF Files
                </Text>
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body overflow="hidden" px={3} py={3}>
              {error && (
                <Alert.Root status="error" mb={2}>
                  <Alert.Indicator />
                  {error}
                </Alert.Root>
              )}
              {pdfFiles.length > 0 && (
                <VStack align="stretch" gap={2}>
                  <Box>
                    <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                      Select PDF files to merge:
                    </Text>
                    <Box
                      h="260px"
                      overflowY="auto"
                      overflowX="hidden"
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius={0}
                      w="100%"
                    >
                      <Flex
                        position="sticky"
                        top={0}
                        bg={bgColor}
                        zIndex={1}
                        justify="space-between"
                        align="center"
                        px={2}
                        py={1}
                        borderBottomWidth="1px"
                        borderColor={borderColor}
                      >
                        <Text fontSize="xs" color={secondaryTextColor}>
                          {selectedFiles.length} of {pdfFiles.length} files selected
                        </Text>
                        <Button size="2xs" variant="ghost" onClick={handleSelectAll} flexShrink={0}>
                          {selectedFiles.length === pdfFiles.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      </Flex>
                      <VStack align="stretch" gap={0} px={2} py={1}>
                        {pdfFiles.map((file) => (
                          <Checkbox.Root
                            key={file.name}
                            checked={selectedFiles.includes(file.name)}
                            onCheckedChange={() => handleFileToggle(file.name)}
                            py={0.5}
                          >
                            <Checkbox.HiddenInput />
                            <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                            <Checkbox.Label>
                              <Flex align="center" gap={1}>
                                <Icon color="red.400" boxSize={3} asChild><FileText /></Icon>
                                <Text fontSize="xs">{file.name}</Text>
                              </Flex>
                            </Checkbox.Label>
                          </Checkbox.Root>
                        ))}
                      </VStack>
                    </Box>
                  </Box>

                  <Box>
                    <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                      Output filename:
                    </Text>
                    <Input
                      size="xs"
                      value={outputFilename}
                      onChange={(e) => setOutputFilename(e.target.value)}
                      placeholder="Enter filename (e.g., merged-document)"
                      autoFocus
                      bg={inputBg}
                      borderColor={borderColor}
                      borderRadius="md"
                    />
                    <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                      .pdf extension will be added automatically if not present
                    </Text>
                  </Box>
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer px={3} py={2} borderTopWidth="1px" borderColor={borderColor}>
              <Button size="xs" variant="outline" borderRadius="md" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="xs"
                borderRadius="md"
                colorPalette="blue"
                onClick={handleMerge}
                disabled={isLoading || selectedFiles.length < 2 || !outputFilename.trim()}
              >
                Merge PDFs
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}; 