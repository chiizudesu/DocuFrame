import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Box,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  useColorModeValue,
  Flex,
  Badge,
} from '@chakra-ui/react';
import { Calculator, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { FileItem } from '../types';

interface LateClaimsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
}

interface GSTData {
  totalSalesAndIncome: number;
  totalPurchasesAndExpenses: number;
  totalGSTCollected: number;
  totalGSTCredits: number;
  lateClaimsAmount: number;
  fileName: string;
  extractedText: string;
  gstAmountDue: number;
}

export const LateClaimsDialog: React.FC<LateClaimsDialogProps> = ({
  isOpen,
  onClose,
  currentDirectory,
}) => {
  const { addLog, setStatus } = useAppContext();

  const [isLoading, setIsLoading] = useState(false);
  const [gstData, setGstData] = useState<GSTData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const secondaryBgColor = useColorModeValue('gray.50', 'gray.700');
  const cardBgColor = useColorModeValue('gray.100', 'gray.800');

  // Auto-load GST data when dialog opens
  useEffect(() => {
    if (isOpen && currentDirectory) {
      handleReadGSTReturn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentDirectory]);

  const handleReadGSTReturn = async () => {
    setIsLoading(true);
    setError(null);
    setGstData(null);

    try {
      addLog('Searching for GST Return PDF in current directory...');
      setStatus('Reading GST Return PDF...', 'info');

      // Get directory contents and find GST Return PDF
      const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
      const gstFile = contents.find((file: FileItem) => 
        file.type === 'file' && 
        file.name.toLowerCase().includes('gst return') && 
        file.name.toLowerCase().endsWith('.pdf')
      );

      if (!gstFile) {
        throw new Error('No GST Return PDF found in current directory. Please ensure the file name contains "GST Return".');
      }

      addLog(`Found GST Return PDF: ${gstFile.name}`);

      // Read the PDF content
      const pdfText = await window.electronAPI.readPdfText(gstFile.path);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('Failed to extract text from PDF or PDF is empty.');
      }

      // Extract GST values from the text
      const extractedData = extractGSTValues(pdfText, gstFile.name);
      setGstData(extractedData);

      addLog(`Successfully extracted GST data from ${gstFile.name}`);
      setStatus('GST Return PDF read successfully', 'success');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      addLog(`Error reading GST Return: ${errorMessage}`, 'error');
      setStatus('Failed to read GST Return', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const extractGSTValues = (text: string, fileName: string): GSTData => {
    // Extract numbers from GST return patterns with their positions
    const salesPattern = /(?:box 5|total sales and income)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;
    const purchasesPattern = /(?:box 11|total purchases and expenses)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;
    const gstCollectedPattern = /(?:box 8|total gst collected on sales and income)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;
    const gstCreditsPattern = /(?:box 12|total gst credits on purchases and expenses)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;
    
    // Look for late claims as a standalone line item (not associated with a box number)
    // It typically appears after Box 8 in the sales section
    const lateClaimsPattern = /(?:late claims)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;

    const salesMatch = text.match(salesPattern);
    const purchasesMatch = text.match(purchasesPattern);
    const gstCollectedMatch = text.match(gstCollectedPattern);
    const gstCreditsMatch = text.match(gstCreditsPattern);
    
    // Find late claims (should appear only once)
    const lateClaimsMatch = text.match(lateClaimsPattern);

    const totalSalesAndIncome = salesMatch ? parseFloat(salesMatch[1].replace(/,/g, '')) : 0;
    const totalPurchasesAndExpenses = purchasesMatch ? parseFloat(purchasesMatch[1].replace(/,/g, '')) : 0;
    const totalGSTCollected = gstCollectedMatch ? parseFloat(gstCollectedMatch[1].replace(/,/g, '')) : 0;
    const totalGSTCredits = gstCreditsMatch ? parseFloat(gstCreditsMatch[1].replace(/,/g, '')) : 0;
    
    // Extract late claims amount (should be the only late claims entry in the document)
    const lateClaimsAmount = lateClaimsMatch ? parseFloat(lateClaimsMatch[1].replace(/,/g, '')) : 0;

    // Calculate GST amount due
    const gstAmountDue = totalGSTCollected - totalGSTCredits;

    return {
      totalSalesAndIncome,
      totalPurchasesAndExpenses,
      totalGSTCollected,
      totalGSTCredits,
      lateClaimsAmount,
      fileName,
      extractedText: text, // Keep full text for position analysis
      gstAmountDue,
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleClose = () => {
    setGstData(null);
    setError(null);
    onClose();
  };

  // Calculate grossed up late claims amount
  const calculateGrossedUpLateClaimsAmount = (lateClaimsAmount: number): number => {
    if (lateClaimsAmount <= 0) return 0;
    // Gross up calculation: (late claims amount / 0.15) * 1.15
    return (lateClaimsAmount / 0.15) * 1.15;
  };

  // Determine if late claims should be added to sales or purchases based on position
  function determineLateClaimsTarget(text: string): 'sales' | 'purchases' | 'none' {
    if (!text) return 'none';
    
    // Check if late claims exists at all
    if (!text.toLowerCase().includes('late claims')) {
      return 'none';
    }
    
    const textLower = text.toLowerCase();
    
    // Find the position of late claims
    const lateClaimsPos = textLower.search(/late claims/);
    if (lateClaimsPos === -1) return 'none';
    
    // Late claims can appear in either sales or purchases section, but not both
    // It's a standalone line item, not associated with a specific box number
    
    // Find section boundaries
    const salesSectionStart = textLower.search(/(?:box 5|total sales and income)/);
    const salesSectionEnd = textLower.search(/(?:box 10|total gst collected for the period)/);
    const purchasesSectionStart = textLower.search(/(?:box 11|total purchases and expenses)/);
    const purchasesSectionEnd = textLower.search(/(?:box 15|gst to pay)/);
    
    // Determine which section late claims appears in
    let inSalesSection = false;
    let inPurchasesSection = false;
    
    if (salesSectionStart !== -1 && salesSectionEnd !== -1) {
      inSalesSection = lateClaimsPos >= salesSectionStart && lateClaimsPos <= salesSectionEnd;
    } else if (salesSectionStart !== -1) {
      // If we can't find the end, assume it's in sales if it appears after sales start
      inSalesSection = lateClaimsPos >= salesSectionStart;
    }
    
    if (purchasesSectionStart !== -1 && purchasesSectionEnd !== -1) {
      inPurchasesSection = lateClaimsPos >= purchasesSectionStart && lateClaimsPos <= purchasesSectionEnd;
    } else if (purchasesSectionStart !== -1) {
      // If we can't find the end, assume it's in purchases if it appears after purchases start
      inPurchasesSection = lateClaimsPos >= purchasesSectionStart;
    }
    
    // If late claims appears in both sections (shouldn't happen), prioritize sales
    if (inSalesSection && inPurchasesSection) {
      return 'sales';
    }
    
    // Return the section where late claims appears
    if (inSalesSection) {
      return 'sales';
    } else if (inPurchasesSection) {
      return 'purchases';
    }
    
    // Fallback: if we can't determine the section, use proximity analysis
    if (salesSectionStart !== -1 && purchasesSectionStart !== -1) {
      const distanceToSales = Math.abs(lateClaimsPos - salesSectionStart);
      const distanceToPurchases = Math.abs(lateClaimsPos - purchasesSectionStart);
      
      if (distanceToSales < distanceToPurchases) {
        return 'sales';
      } else {
        return 'purchases';
      }
    }
    
    // Final fallback: assume sales (more common)
    return 'sales';
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} color={textColor} borderRadius="lg" boxShadow="lg" maxW="400px" border="1px solid" borderColor={borderColor}>
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={0}>
          GST Return Summary
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          {isLoading ? (
            <Flex justify="center" align="center" minH="120px"><Spinner /></Flex>
          ) : error ? (
            <Alert status="error">
              <AlertIcon />
              <Box>
                <AlertTitle>Error!</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Box>
            </Alert>
          ) : gstData ? (
            (() => {
              const { lateClaimsAmount, totalSalesAndIncome, totalPurchasesAndExpenses, extractedText, gstAmountDue } = gstData;
              const lateClaimsTarget = determineLateClaimsTarget(extractedText);
              const grossedUpAmount = calculateGrossedUpLateClaimsAmount(lateClaimsAmount);
              
              // Primary focus: GST Amount Due
              const isGSTDue = gstAmountDue > 0;
              const hasLateClaims = lateClaimsTarget !== 'none' && lateClaimsAmount > 0;
              
              return (
                <VStack align="stretch" spacing={4}>
                  {/* Main GST Amount Due Display */}
                  <Box 
                    bg={isGSTDue ? useColorModeValue('red.50', 'red.800') : useColorModeValue('green.50', 'green.800')} 
                    color="white"
                    borderRadius="lg" 
                    p={4} 
                    boxShadow="lg" 
                    textAlign="left"
                    border="2px solid"
                    borderColor={isGSTDue ? useColorModeValue('red.200', 'red.600') : useColorModeValue('green.200', 'green.600')}
                  >
                    <Flex align="center" gap={3}>
                      {isGSTDue ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                      <Box flex="1">
                        <Text fontWeight="bold" fontSize="md" letterSpacing="wide" mb={1}>
                          {isGSTDue ? 'GST Amount Due' : 'GST Refund'}
                        </Text>
                        <Text fontSize="2xl" fontWeight="extrabold">
                          {formatCurrency(Math.abs(gstAmountDue))}
                        </Text>
                        <Badge 
                          colorScheme={isGSTDue ? 'red' : 'green'} 
                          variant="subtle" 
                          mt={1}
                          fontSize="xs"
                        >
                          {isGSTDue ? 'Payment Required' : 'Refund Due'}
                        </Badge>
                      </Box>
                    </Flex>
                  </Box>
                  
                  {/* GST Breakdown */}
                  <Box bg={cardBgColor} borderRadius="md" p={4} border="1px solid" borderColor={borderColor}>
                    <Text fontSize="sm" fontWeight="semibold" mb={3} color={textColor}>
                      GST Breakdown
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      <Flex justify="space-between" fontSize="sm">
                        <Text color={useColorModeValue('gray.600', 'gray.400')}>GST Collected:</Text>
                        <Text fontWeight="medium">{formatCurrency(gstData.totalGSTCollected)}</Text>
                      </Flex>
                      <Flex justify="space-between" fontSize="sm">
                        <Text color={useColorModeValue('gray.600', 'gray.400')}>GST Credits:</Text>
                        <Text fontWeight="medium">{formatCurrency(gstData.totalGSTCredits)}</Text>
                      </Flex>
                      <Divider />
                      <Flex justify="space-between" fontSize="sm" fontWeight="semibold">
                        <Text>Net GST:</Text>
                        <Text color={isGSTDue ? 'red.500' : 'green.500'}>{formatCurrency(gstAmountDue)}</Text>
                      </Flex>
                    </VStack>
                  </Box>
                  
                  {/* Late Claims Section - Only show if present */}
                  {hasLateClaims && (
                    <Box bg={useColorModeValue('orange.50', 'orange.900')} borderRadius="md" p={4} border="1px solid" borderColor={useColorModeValue('orange.200', 'orange.700')}>
                      <Text fontSize="sm" fontWeight="semibold" mb={3} color={useColorModeValue('orange.800', 'orange.100')}>
                        Late Claims Adjustment
                      </Text>
                      <VStack align="stretch" spacing={2}>
                        <Flex justify="space-between" fontSize="sm">
                          <Text color={useColorModeValue('orange.700', 'orange.200')}>Late Claims Amount:</Text>
                          <Text fontWeight="medium">{formatCurrency(lateClaimsAmount)}</Text>
                        </Flex>
                        <Flex justify="space-between" fontSize="sm">
                          <Text color={useColorModeValue('orange.700', 'orange.200')}>Grossed Up Amount:</Text>
                          <Text fontWeight="medium">{formatCurrency(grossedUpAmount)}</Text>
                        </Flex>
                        <Divider borderColor={useColorModeValue('orange.300', 'orange.600')} />
                        <Flex justify="space-between" fontSize="sm" fontWeight="semibold">
                          <Text color={useColorModeValue('orange.700', 'orange.200')}>
                            Added to {lateClaimsTarget === 'purchases' ? 'Total Purchases' : 'Total Sales'}:
                          </Text>
                          <Text fontWeight="bold" color={useColorModeValue('orange.800', 'orange.100')}>
                            {formatCurrency(lateClaimsTarget === 'purchases' ? totalPurchasesAndExpenses + grossedUpAmount : totalSalesAndIncome + grossedUpAmount)}
                          </Text>
                        </Flex>
                        <Text fontSize="xs" color={useColorModeValue('orange.600', 'orange.300')} mt={1}>
                          Original: {formatCurrency(lateClaimsTarget === 'purchases' ? totalPurchasesAndExpenses : totalSalesAndIncome)} + {formatCurrency(grossedUpAmount)}
                        </Text>
                      </VStack>
                    </Box>
                  )}
                  
                  {/* File Information */}
                  <Box bg={secondaryBgColor} borderRadius="md" p={3} border="1px solid" borderColor={borderColor}>
                    <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} fontWeight="medium">
                      Source: {gstData.fileName}
                    </Text>
                  </Box>
                </VStack>
              );
            }) ()
          ) : (
            <Text>No GST data found.</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 