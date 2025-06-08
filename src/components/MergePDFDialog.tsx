import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Checkbox,
  VStack,
  Input,
  Text,
  Box,
  FormControl,
  FormLabel,
  useColorModeValue,
  Alert,
  AlertIcon,
  Flex,
  Icon
} from '@chakra-ui/react';
import { FileText } from 'lucide-react';
import type { FileItem } from '../types';
import { useAppContext } from '../context/AppContext';

interface MergePDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  preselectedFiles?: string[];
}

export const MergePDFDialog: React.FC<MergePDFDialogProps> = ({
  isOpen,
  onClose,
  currentDirectory,
  preselectedFiles = []
}) => {
  // Memoize preselectedFiles to prevent infinite re-renders
  const memoizedPreselectedFiles = useMemo(() => preselectedFiles, [preselectedFiles?.join(',')]);
  
  const [pdfFiles, setPdfFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addLog, setStatus } = useAppContext();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader>Merge PDF Files</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}
          
          {pdfFiles.length > 0 && (
            <>
              <FormControl mb={4}>
                <FormLabel>Select PDF files to merge:</FormLabel>
                <Box
                  maxH="200px"
                  overflowY="auto"
                  border="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                  p={3}
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontSize="sm" color="gray.500">
                      {selectedFiles.length} of {pdfFiles.length} files selected
                    </Text>
                    <Button size="xs" variant="ghost" onClick={handleSelectAll}>
                      {selectedFiles.length === pdfFiles.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </Flex>
                  <VStack align="stretch" spacing={2}>
                    {pdfFiles.map((file) => (
                      <Checkbox
                        key={file.name}
                        isChecked={selectedFiles.includes(file.name)}
                        onChange={() => handleFileToggle(file.name)}
                      >
                        <Flex align="center">
                          <Icon as={FileText} mr={2} color="red.400" />
                          <Text fontSize="sm">{file.name}</Text>
                        </Flex>
                      </Checkbox>
                    ))}
                  </VStack>
                </Box>
              </FormControl>

              <FormControl>
                <FormLabel>Output filename:</FormLabel>
                <Input
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="Enter filename (e.g., merged-document)"
                  autoFocus
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  .pdf extension will be added automatically if not present
                </Text>
              </FormControl>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleMerge}
            isLoading={isLoading}
            loadingText="Merging..."
            isDisabled={selectedFiles.length < 2 || !outputFilename.trim()}
          >
            Merge PDFs
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 