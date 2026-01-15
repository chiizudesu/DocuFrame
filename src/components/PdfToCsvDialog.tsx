import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  Text,
  Box,
  Flex,
  Spinner,
  useColorModeValue,
  IconButton,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Badge,
  useToast,
  Grid,
  GridItem,
  Heading,
  ScaleFade,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Select,
  Tag,
  TagLabel,
  TagCloseButton
} from '@chakra-ui/react';
import { FileText, Upload, FileSpreadsheet, Minus, X, CheckCircle, ArrowRight, Brain, RotateCcw } from 'lucide-react';
import { DOCUMENT_AI_AGENTS, type DocumentAIAgent, detectPdfHeaders, extractPdfTableDataStream } from '../services/aiService';

interface FileItem { 
  name: string; 
  path: string; 
  type: string; 
}

interface PdfToCsvDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  selectedFiles: string[];
  folderItems: FileItem[];
  onMinimize?: () => void;
}

const FIXED_CSV_COLUMNS = ['Date', 'Amount', 'Payee', 'Description', 'Reference', 'Cheque Number'];

export const PdfToCsvDialog: React.FC<PdfToCsvDialogProps> = ({ 
  isOpen, 
  onClose, 
  currentDirectory, 
  selectedFiles, 
  folderItems,
  onMinimize
}) => {
  const [selectedAgent, setSelectedAgent] = useState<DocumentAIAgent>('claude');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [availableFiles, setAvailableFiles] = useState<FileItem[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<{ [fixedColumn: string]: string[] }>({});
  const [csvData, setCsvData] = useState<Array<{ [key: string]: string }>>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [headerDetectionStatus, setHeaderDetectionStatus] = useState<string>('');
  const [loadingData, setLoadingData] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ currentPage: number; totalPages: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedHeader, setDraggedHeader] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [showAgentSelect, setShowAgentSelect] = useState(false);
  const previewTableRef = React.useRef<HTMLDivElement>(null);
  const showPreview = isProcessing || conversionComplete;

  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');
  const fileBg = useColorModeValue('gray.100', 'gray.700');
  const selectedFileBg = useColorModeValue('blue.100', 'blue.700');
  const hoverBg = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    if (isOpen) {
      // Only reset state if no file is currently selected (fresh open, not restore from minimized)
      if (!selectedFile) {
        setDetectedHeaders([]);
        setColumnMappings(prev => {
          const reset: { [key: string]: string[] } = {};
          FIXED_CSV_COLUMNS.forEach(col => {
            reset[col] = [];
          });
          return reset;
        });
        setCsvData([]);
        setCsvFileName('');
        setError(null);
        setConversionComplete(false);
      }
      setLoadingHeaders(false);
      setLoadingData(false);
      setShowAgentSelect(false);
      
      // Filter PDF files
      const pdfFiles = folderItems.filter(file => 
        file.name.toLowerCase().endsWith('.pdf')
      );
      setAvailableFiles(pdfFiles);
    }
  }, [isOpen, folderItems, selectedFile]);

  // Initialize column mappings structure only if not already initialized
  useEffect(() => {
    if (isOpen && Object.keys(columnMappings).length === 0) {
      const initialMappings: { [key: string]: string[] } = {};
      FIXED_CSV_COLUMNS.forEach(col => {
        initialMappings[col] = [];
      });
      setColumnMappings(initialMappings);
    }
  }, [isOpen, columnMappings]);

  const handleDetectHeaders = useCallback(async (file: FileItem) => {
    if (!file) return;

    setLoadingHeaders(true);
    setHeaderDetectionStatus('Initializing...');
    setError(null);

    try {
      // First try scanning first page only
      const headers = await detectPdfHeaders(
        file.path, 
        file.name, 
        selectedAgent, 
        true,
        (status) => {
          setHeaderDetectionStatus(status);
        }
      );
      
      // Only scan all pages if no headers found on first page
      if (headers.length === 0) {
        setHeaderDetectionStatus('No headers on first page, scanning all pages...');
        const allPageHeaders = await detectPdfHeaders(
          file.path, 
          file.name, 
          selectedAgent, 
          false,
          (status) => {
            setHeaderDetectionStatus(status);
          }
        );
        
        if (allPageHeaders.length === 0) {
          setError('File invalid - no table headers detected');
          setDetectedHeaders([]);
          setHeaderDetectionStatus('');
        } else {
          setDetectedHeaders(allPageHeaders);
          setHeaderDetectionStatus('');
          toast({
            title: 'Headers Detected',
            description: `Found ${allPageHeaders.length} header(s)`,
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        }
      } else {
        // Headers found on first page - use them and stop
        setDetectedHeaders(headers);
        setHeaderDetectionStatus('');
        toast({
          title: 'Headers Detected',
          description: `Found ${headers.length} header(s)`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Header detection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to detect headers: ${errorMessage}`);
      setDetectedHeaders([]);
      setHeaderDetectionStatus('');
    } finally {
      setLoadingHeaders(false);
    }
  }, [selectedAgent, toast]);

  const handleFileSelect = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setDetectedHeaders([]);
    setColumnMappings(prev => {
      const reset: { [key: string]: string[] } = {};
      FIXED_CSV_COLUMNS.forEach(col => {
        reset[col] = [];
      });
      return reset;
    });
    setCsvData([]);
    setError(null);
    
    // Auto-detect headers when file is selected
    handleDetectHeaders(file);
  }, [handleDetectHeaders]);

  const handleDragStart = (e: React.DragEvent, header: string) => {
    setDraggedHeader(header);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, fixedColumn: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedHeader) return;

    setColumnMappings(prev => {
      const newMappings = { ...prev };
      
      // Remove header from any existing mapping
      Object.keys(newMappings).forEach(col => {
        newMappings[col] = newMappings[col].filter(h => h !== draggedHeader);
      });

      // Add to target column if not already there
      if (!newMappings[fixedColumn].includes(draggedHeader)) {
        newMappings[fixedColumn] = [...newMappings[fixedColumn], draggedHeader];
      }

      return newMappings;
    });

    setDraggedHeader(null);
  };

  const handleRemoveMapping = (fixedColumn: string, header: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [fixedColumn]: prev[fixedColumn].filter(h => h !== header)
    }));
  };

  const handleConvertToCsv = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file');
      return;
    }

    // Check if at least one column has mappings
    const hasMappings = Object.values(columnMappings).some(mappings => mappings.length > 0);
    if (!hasMappings) {
      setError('Please map at least one document header to a CSV column');
      return;
    }

    if (!csvFileName.trim()) {
      setError('Please enter a file name for the CSV');
      return;
    }

    // Prevent starting a new conversion while one is in progress
    if (isProcessing) {
      console.log('[PDF to CSV] Conversion already in progress, ignoring new request');
      return;
    }

    console.log('[PDF to CSV] Starting conversion');
    setIsProcessing(true);
    setError(null);
    setCsvData([]);
    setProgress(null);
    setConversionComplete(false);

    try {
      const data = await extractPdfTableDataStream(
        selectedFile.path,
        selectedFile.name,
        columnMappings,
        selectedAgent,
        (newRows) => {
          // Accumulate rows as pages complete
          console.log('[PDF to CSV] Page complete, rows:', newRows.length);
          setCsvData(prev => [...prev, ...newRows]);
        },
        (progressUpdate) => {
          // Update progress bar
          console.log('[PDF to CSV] Progress:', progressUpdate);
          setProgress(progressUpdate);
        }
      );

      setCsvData(data);
      setConversionComplete(true);
      setIsProcessing(false);
      setProgress(null);
      console.log('[PDF to CSV] Complete. Total rows:', data.length);
      
      toast({
        title: 'Conversion Complete',
        description: `Successfully extracted ${data.length} row(s)`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Data extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to extract data: ${errorMessage}`);
      setIsProcessing(false);
      setProgress(null);
      setLoadingData(false);
    }
  };

  const handleSaveCsv = async () => {
    if (csvData.length === 0) {
      setError('No data to save. Please convert to CSV first.');
      return;
    }

    if (!csvFileName.trim()) {
      setError('Please enter a file name for the CSV');
      return;
    }

    try {
      // Generate CSV content
      const headers = FIXED_CSV_COLUMNS;
      const csvRows = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];

      const csvContent = csvRows.join('\n');
      const fileName = csvFileName.endsWith('.csv') ? csvFileName : `${csvFileName}.csv`;
      const filePath = `${currentDirectory}\\${fileName}`;

      await (window.electronAPI as any).writeTextFile(filePath, csvContent);

      toast({
        title: 'CSV Saved',
        description: `Saved to ${fileName}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh folder view
      try {
        const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
        // Note: We'd need to pass setFolderItems callback, but for now just show success
      } catch (refreshError) {
        console.error('Failed to refresh folder view:', refreshError);
      }

      // Don't close dialog - ask if they want to convert another
      // User can click "Convert Another" or close manually
    } catch (error) {
      console.error('Save CSV error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to save CSV: ${errorMessage}`);
      toast({
        title: 'Save Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDragOverFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeaveFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDropFile = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFile) {
      const fileItem: FileItem = {
        name: pdfFile.name,
        path: (pdfFile as any).path || '',
        type: 'file'
      };
      handleFileSelect(fileItem);
    } else {
      setError('Please drop a PDF file');
    }
  }, [handleFileSelect]);

  const handleClose = () => {
    setSelectedFile(null);
    setDetectedHeaders([]);
    setColumnMappings({});
    setCsvData([]);
    setCsvFileName('');
    setError(null);
    setLoadingHeaders(false);
    setLoadingData(false);
    setConversionComplete(false);
    setShowAgentSelect(false);
    onClose();
  };

  const handleStartOver = () => {
    setSelectedFile(null);
    setDetectedHeaders([]);
    setColumnMappings(prev => {
      const reset: { [key: string]: string[] } = {};
      FIXED_CSV_COLUMNS.forEach(col => {
        reset[col] = [];
      });
      return reset;
    });
    setCsvData([]);
    setCsvFileName('');
    setError(null);
    setConversionComplete(false);
    setIsProcessing(false);
    setProgress(null);
  };

  const handleOverlayClick = () => {
    if (onMinimize) {
      onMinimize();
    } else {
      handleClose();
    }
  };

  // Get unmapped headers
  const mappedHeaders = new Set(Object.values(columnMappings).flat());
  const unmappedHeaders = detectedHeaders.filter(h => !mappedHeaders.has(h));

  return (
    <Modal isOpen={isOpen} onClose={handleOverlayClick} size="6xl">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        maxW={selectedFile ? "1100px" : "500px"}
        w={selectedFile ? "1100px" : "500px"}
        maxH="85vh" 
        h="650px"
        overflow="hidden"
        my="auto"
        borderRadius={0}
        transition="width 0.3s ease"
      >
        <ModalHeader 
          borderBottom="1px solid" 
          borderColor={borderColor}
          pb={3}
          bg={useColorModeValue('gray.100', 'gray.700')}
        >
          <Flex align="center" justify="space-between" pr={16}>
            <Flex align="center" gap={2}>
              <FileSpreadsheet size={20} />
              <Text fontWeight="semibold" color={useColorModeValue('gray.800', 'gray.100')}>
                PDF to CSV Converter
              </Text>
            </Flex>
            {/* AI Agent Pill */}
            <Box position="relative">
              <Badge 
                colorScheme="blue" 
                fontSize="xs" 
                px={2} 
                py={1}
                cursor="pointer"
                onClick={() => setShowAgentSelect(!showAgentSelect)}
                display="flex"
                alignItems="center"
                gap={1}
              >
                <Brain size={12} />
                <Text>{DOCUMENT_AI_AGENTS.find(a => a.value === selectedAgent)?.label}</Text>
              </Badge>
              {showAgentSelect && (
                <Box position="absolute" top="100%" right={0} mt={2} bg={bgColor} border="1px" borderColor={borderColor} borderRadius={0} boxShadow="lg" zIndex={1000}>
                  <VStack align="stretch" p={2} spacing={1}>
                    {DOCUMENT_AI_AGENTS.map(agent => (
                      <Button
                        key={agent.value}
                        size="sm"
                        variant={selectedAgent === agent.value ? 'solid' : 'ghost'}
                        colorScheme={selectedAgent === agent.value ? 'blue' : 'gray'}
                        onClick={() => {
                          setSelectedAgent(agent.value);
                          setShowAgentSelect(false);
                        }}
                        justifyContent="flex-start"
                      >
                        {agent.label}
                      </Button>
                    ))}
                  </VStack>
                </Box>
              )}
            </Box>
          </Flex>
        </ModalHeader>
        {onMinimize && (
          <IconButton
            aria-label="Minimize"
            icon={<Minus size={16} />}
            size="sm"
            variant="ghost"
            position="absolute"
            top={4}
            right={12}
            onClick={onMinimize}
            zIndex={10}
          />
        )}
        <ModalCloseButton />
        
        <ModalBody p={0} overflow="hidden">
          {!showPreview ? (
            selectedFile ? (
              <Grid templateColumns="1fr 1.5fr" h="550px" overflow="hidden" gap={0}>
              {/* Left Panel - File Selection */}
              <GridItem bg={cardBg} borderRight="1px" borderColor={borderColor} overflow="hidden" display="flex" flexDirection="column">
                <VStack p={4} spacing={3} h="100%" overflow="hidden">
                  <Box w="100%" flex="1" display="flex" flexDirection="column" overflow="hidden">
                    <Heading size="sm" mb={3}>Select PDF File</Heading>
                  
                  {/* Drag & Drop Zone */}
                  <Box
                    border="2px dashed"
                    borderColor={isDragOver ? 'blue.400' : borderColor}
                    borderRadius="md"
                    p={4}
                    textAlign="center"
                    mb={3}
                    bg={isDragOver ? 'blue.50' : 'transparent'}
                    onDragOver={handleDragOverFile}
                    onDragLeave={handleDragLeaveFile}
                    onDrop={handleDropFile}
                    cursor="pointer"
                    transition="all 0.2s"
                    flexShrink={0}
                  >
                    <Upload size={24} style={{ margin: '0 auto 8px' }} />
                    <Text fontSize="sm" fontWeight="medium" mb={1}>
                      Drop PDF here
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      or select from list below
                    </Text>
                  </Box>
                  
                  {/* File List */}
                  <Box flex="1" overflowY="auto" minH="0">
                    {availableFiles.length === 0 ? (
                      <Center h="100px">
                        <Text fontSize="sm" color="gray.500" textAlign="center">
                          No PDF files found in current directory
                        </Text>
                      </Center>
                    ) : (
                      <VStack spacing={1} align="stretch">
                        {availableFiles.map((file, index) => {
                          const isSelected = selectedFile?.name === file.name;
                          return (
                            <Box
                              key={index}
                              p={3}
                              bg={isSelected ? selectedFileBg : useColorModeValue('white', 'gray.900')}
                              borderRadius="md"
                              cursor="pointer"
                              border="1px solid"
                              borderColor={isSelected ? useColorModeValue('blue.400', 'blue.300') : 'transparent'}
                              _hover={{
                                bg: isSelected ? selectedFileBg : hoverBg,
                                borderColor: useColorModeValue('blue.200', 'blue.400'),
                              }}
                              onClick={() => handleFileSelect(file)}
                              transition="all 0.15s"
                              display="flex"
                              alignItems="center"
                              gap={2}
                            >
                              <FileText size={18} />
                              <Text fontSize="sm" flex="1" noOfLines={1} title={file.name}>
                                {file.name}
                              </Text>
                              {isSelected && <CheckCircle size={16} color={useColorModeValue('#2563eb', '#60a5fa')} />}
                            </Box>
                          );
                        })}
                      </VStack>
                    )}
                  </Box>
                </Box>
              </VStack>
            </GridItem>

            {/* Right Panel - Column Mapping */}
            <GridItem overflow="hidden" display="flex" flexDirection="column">
              <VStack p={4} spacing={3} h="100%" overflow="hidden">
                <Box w="100%" flex="1" display="flex" flexDirection="column" overflow="hidden" minH="0">
                  <Heading size="sm" mb={3}>Map Columns to CSV Headers</Heading>
                  
                  {loadingHeaders && (
                    <Center py={4}>
                      <VStack spacing={3}>
                        <Spinner size="lg" />
                        <VStack spacing={1}>
                          <Text fontSize="sm" fontWeight="medium" color="gray.700">
                            {headerDetectionStatus || 'Detecting headers...'}
                          </Text>
                          {headerDetectionStatus && (
                            <Text fontSize="xs" color="gray.500">
                              Please wait, this may take a moment
                            </Text>
                          )}
                        </VStack>
                      </VStack>
                    </Center>
                  )}

                  {!loadingHeaders && selectedFile && detectedHeaders.length === 0 && !error && (
                    <Center py={4}>
                      <Text fontSize="sm" color="gray.500">No headers detected</Text>
                    </Center>
                  )}

                  {selectedFile && !loadingHeaders && detectedHeaders.length > 0 && (
                    <Grid templateColumns="1fr 1fr" gap={4} flex="1" overflow="hidden" minH="0">
                      {/* Fixed CSV Columns (Drop Zones) */}
                      <Box display="flex" flexDirection="column" overflow="hidden" minH="0">
                        <Text fontSize="xs" fontWeight="medium" mb={2} color="gray.600">
                          CSV Columns (Drop zones)
                        </Text>
                        <Box flex="1" overflowY="auto" minH="0">
                          <VStack spacing={2} align="stretch">
                            {FIXED_CSV_COLUMNS.map(column => {
                              const isDragOver = dragOverColumn === column;
                              const mappedHeadersForColumn = columnMappings[column] || [];
                              return (
                                <Box
                                  key={column}
                                  p={2}
                                  bg={isDragOver ? useColorModeValue('blue.50', 'blue.900') : bgColor}
                                  border="2px dashed"
                                  borderColor={isDragOver ? 'blue.400' : borderColor}
                                  borderRadius="md"
                                  minH="50px"
                                  onDragOver={(e) => handleDragOver(e, column)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, column)}
                                  transition="all 0.2s"
                                >
                                  <Text fontSize="xs" fontWeight="medium" mb={1}>
                                    {column}
                                  </Text>
                                  {mappedHeadersForColumn.length > 0 && (
                                    <Flex wrap="wrap" gap={1} mt={1}>
                                      {mappedHeadersForColumn.map(header => (
                                        <Tag key={header} size="sm" colorScheme="blue" fontSize="xs">
                                          <TagLabel>{header}</TagLabel>
                                          <TagCloseButton onClick={() => handleRemoveMapping(column, header)} />
                                        </Tag>
                                      ))}
                                    </Flex>
                                  )}
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      </Box>

                      {/* Document Headers (Draggable) */}
                      <Box display="flex" flexDirection="column" overflow="hidden" minH="0">
                        <Text fontSize="xs" fontWeight="medium" mb={2} color="gray.600">
                          Document Headers (Drag to map)
                        </Text>
                        <Box flex="1" overflowY="auto" minH="0">
                          <VStack spacing={1} align="stretch">
                            {unmappedHeaders.map(header => (
                              <Box
                                key={header}
                                p={2}
                                bg={bgColor}
                                borderRadius="md"
                                border="1px solid"
                                borderColor={borderColor}
                                cursor="move"
                                draggable
                                onDragStart={(e) => handleDragStart(e, header)}
                                _hover={{
                                  bg: hoverBg,
                                  transform: 'translateX(4px)',
                                }}
                                transition="all 0.15s"
                              >
                                <Text fontSize="sm">{header}</Text>
                              </Box>
                            ))}
                            {unmappedHeaders.length === 0 && (
                              <Center h="100px">
                                <Text fontSize="xs" color="gray.500" textAlign="center">
                                  All headers mapped
                                </Text>
                              </Center>
                            )}
                          </VStack>
                        </Box>
                      </Box>
                    </Grid>
                  )}

                  {selectedFile && !loadingHeaders && detectedHeaders.length === 0 && !error && (
                    <Center flex="1">
                      <Text fontSize="sm" color="gray.500">No headers detected</Text>
                    </Center>
                  )}

                  {!selectedFile && (
                    <Center flex="1">
                      <Text fontSize="sm" color="gray.500">Select a PDF file to begin mapping</Text>
                    </Center>
                  )}
                </Box>

                {/* File Name Input and Convert Button - Bottom of right panel */}
                <Box w="100%" pt={3} borderTop="1px" borderColor={borderColor}>
                  <HStack spacing={3} align="flex-end">
                    <FormControl flex="0 0 auto" w="200px">
                      <FormLabel fontSize="sm" fontWeight="medium">CSV File Name</FormLabel>
                      <Input
                        placeholder="output.csv"
                        value={csvFileName}
                        onChange={(e) => setCsvFileName(e.target.value)}
                        size="sm"
                      />
                    </FormControl>

                    <Button
                      leftIcon={<ArrowRight size={16} />}
                      colorScheme="blue"
                      size="md"
                      isDisabled={!selectedFile || loadingHeaders || isProcessing || Object.values(columnMappings).every(m => m.length === 0) || !csvFileName.trim()}
                      isLoading={isProcessing}
                      loadingText="Converting..."
                      onClick={handleConvertToCsv}
                      flexShrink={0}
                    >
                      Convert to CSV
                    </Button>
                  </HStack>
                </Box>
              </VStack>
            </GridItem>
          </Grid>
            ) : (
              /* No file selected - show only file selection */
              <Box bg={cardBg} h="550px" overflow="hidden" display="flex" flexDirection="column">
                <VStack p={4} spacing={3} h="100%" overflow="hidden">
                  <Box w="100%" flex="1" display="flex" flexDirection="column" overflow="hidden">
                    <Heading size="sm" mb={3}>Select PDF File</Heading>
                    
                    {/* Drag & Drop Zone */}
                    <Box
                      border="2px dashed"
                      borderColor={isDragOver ? 'blue.400' : borderColor}
                      borderRadius="md"
                      p={4}
                      textAlign="center"
                      mb={3}
                      bg={isDragOver ? 'blue.50' : 'transparent'}
                      onDragOver={handleDragOverFile}
                      onDragLeave={handleDragLeaveFile}
                      onDrop={handleDropFile}
                      cursor="pointer"
                      transition="all 0.2s"
                      flexShrink={0}
                    >
                      <Upload size={24} style={{ margin: '0 auto 8px' }} />
                      <Text fontSize="sm" fontWeight="medium" mb={1}>
                        Drop PDF here
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        or select from list below
                      </Text>
                    </Box>
                    
                    {/* File List */}
                    <Box flex="1" overflowY="auto" minH="0">
                      {availableFiles.length === 0 ? (
                        <Center h="100px">
                          <Text fontSize="sm" color="gray.500" textAlign="center">
                            No PDF files found in current directory
                          </Text>
                        </Center>
                      ) : (
                        <VStack spacing={1} align="stretch">
                          {availableFiles.map((file, index) => {
                            const isSelected = selectedFile?.name === file.name;
                            return (
                              <Box
                                key={index}
                                p={3}
                                bg={isSelected ? selectedFileBg : useColorModeValue('white', 'gray.900')}
                                borderRadius="md"
                                cursor="pointer"
                                border="1px solid"
                                borderColor={isSelected ? useColorModeValue('blue.400', 'blue.300') : 'transparent'}
                                _hover={{
                                  bg: isSelected ? selectedFileBg : hoverBg,
                                  borderColor: useColorModeValue('blue.200', 'blue.400'),
                                }}
                                onClick={() => handleFileSelect(file)}
                                transition="all 0.15s"
                                display="flex"
                                alignItems="center"
                                gap={2}
                              >
                                <FileText size={18} />
                                <Text fontSize="sm" flex="1" noOfLines={1} title={file.name}>
                                  {file.name}
                                </Text>
                                {isSelected && <CheckCircle size={16} color={useColorModeValue('#2563eb', '#60a5fa')} />}
                              </Box>
                            );
                          })}
                        </VStack>
                      )}
                    </Box>
                  </Box>
                </VStack>
              </Box>
            )
          ) : (
            /* Processing or Complete - Show Progress Bar or Preview */
            <VStack h="550px" spacing={0} overflow="hidden" p={4}>
              <Box w="100%" mb={4}>
                <Flex align="center" justify="space-between" mb={3}>
                  <Heading size="sm">
                    {conversionComplete 
                      ? `Conversion Complete - ${csvData.length} rows extracted`
                      : isProcessing 
                        ? 'Converting PDF to CSV...'
                        : 'Preview'}
                  </Heading>
                  {conversionComplete && (
                    <HStack>
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<RotateCcw size={14} />}
                        onClick={handleStartOver}
                      >
                        Convert Another
                      </Button>
                      <Button
                        size="sm"
                        colorScheme="green"
                        leftIcon={<FileSpreadsheet size={14} />}
                        onClick={handleSaveCsv}
                        isDisabled={!csvFileName.trim()}
                      >
                        Save CSV
                      </Button>
                    </HStack>
                  )}
                </Flex>
              </Box>

              {/* Progress Bar or Preview Table */}
              {isProcessing && !conversionComplete ? (
                <Center flex="1" w="100%">
                  <VStack spacing={6} w="80%" maxW="400px">
                    <Spinner size="xl" thickness="4px" color="blue.500" />
                    <VStack spacing={2} w="100%">
                      <Text fontSize="md" fontWeight="medium" color="gray.600">
                        {progress?.status || 'Initializing...'}
                      </Text>
                      {progress && progress.totalPages > 0 && (
                        <>
                          <Box w="100%" bg={useColorModeValue('gray.200', 'gray.600')} borderRadius="full" h="8px" overflow="hidden">
                            <Box 
                              bg="blue.500" 
                              h="100%" 
                              borderRadius="full"
                              w={`${Math.round((progress.currentPage / progress.totalPages) * 100)}%`}
                              transition="width 0.3s ease"
                            />
                          </Box>
                          <Text fontSize="sm" color="gray.500">
                            Page {progress.currentPage} of {progress.totalPages}
                          </Text>
                        </>
                      )}
                      {csvData.length > 0 && (
                        <Text fontSize="sm" color="green.500" fontWeight="medium">
                          {csvData.length} rows extracted so far
                        </Text>
                      )}
                    </VStack>
                  </VStack>
                </Center>
              ) : (
                <Box 
                  flex="1" 
                  w="100%" 
                  overflowY="auto" 
                  border="1px" 
                  borderColor={borderColor} 
                  borderRadius="md"
                  ref={previewTableRef}
                >
                  <TableContainer>
                    <Table size="sm" variant="simple">
                      <Thead position="sticky" top={0} bg={bgColor} zIndex={1}>
                        <Tr>
                          {FIXED_CSV_COLUMNS.map(col => (
                            <Th key={col} fontSize="xs">{col}</Th>
                          ))}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {csvData.map((row, idx) => (
                          <Tr key={idx}>
                            {FIXED_CSV_COLUMNS.map(col => (
                              <Td key={col} fontSize="xs" maxW="200px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap" title={row[col] || ''}>
                                {row[col] || ''}
                              </Td>
                            ))}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </VStack>
          )}

          {error && (
            <Alert status="error" size="sm" mx={4} mb={4} position="absolute" bottom={0} left={0} right={0}>
              <AlertIcon />
              <Text fontSize="sm">{error}</Text>
            </Alert>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
