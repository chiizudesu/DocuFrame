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
} from '@chakra-ui/react';
import { Calculator } from 'lucide-react';
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
    const lateClaimsPattern = /(?:late claims)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i;

    const salesMatch = text.match(salesPattern);
    const purchasesMatch = text.match(purchasesPattern);
    const gstCollectedMatch = text.match(gstCollectedPattern);
    const gstCreditsMatch = text.match(gstCreditsPattern);
    const lateClaimsMatch = text.match(lateClaimsPattern);

    const totalSalesAndIncome = salesMatch ? parseFloat(salesMatch[1].replace(/,/g, '')) : 0;
    const totalPurchasesAndExpenses = purchasesMatch ? parseFloat(purchasesMatch[1].replace(/,/g, '')) : 0;
    const totalGSTCollected = gstCollectedMatch ? parseFloat(gstCollectedMatch[1].replace(/,/g, '')) : 0;
    const totalGSTCredits = gstCreditsMatch ? parseFloat(gstCreditsMatch[1].replace(/,/g, '')) : 0;
    const lateClaimsAmount = lateClaimsMatch ? parseFloat(lateClaimsMatch[1].replace(/,/g, '')) : 0;

    return {
      totalSalesAndIncome,
      totalPurchasesAndExpenses,
      totalGSTCollected,
      totalGSTCredits,
      lateClaimsAmount,
      fileName,
      extractedText: text, // Keep full text for position analysis
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
    
    // Find positions of key sections in the text
    const salesPattern = /(?:box 5|total sales and income)/i;
    const purchasesPattern = /(?:box 11|total purchases and expenses)/i;
    const lateClaimsPattern = /(?:late claims)/i;
    
    const salesMatch = text.search(salesPattern);
    const purchasesMatch = text.search(purchasesPattern);
    const lateClaimsMatch = text.search(lateClaimsPattern);
    
    // If no late claims found, return none
    if (lateClaimsMatch === -1) return 'none';
    
    // If sales or purchases sections not found, fall back to text analysis
    if (salesMatch === -1 || purchasesMatch === -1) {
      // Check explicit text mentions
      if (/late claims.*on.*sales/i.test(text)) return 'sales';
      if (/late claims.*on.*purchases|late claims.*on.*expenses/i.test(text)) return 'purchases';
      // Default to sales if unclear
      return 'sales';
    }
    
    // Determine position logic:
    // If late claims appears after both sales and purchases sections, add to purchases
    // If late claims appears between sales and purchases, add to sales
    if (lateClaimsMatch > Math.max(salesMatch, purchasesMatch)) {
      return 'purchases';
    } else if (lateClaimsMatch > salesMatch && lateClaimsMatch < purchasesMatch) {
      return 'sales';
    } else {
      // Default case: if late claims appears before both or in unclear position, add to sales
      return 'sales';
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
      <ModalOverlay />
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
              const { lateClaimsAmount, totalSalesAndIncome, totalPurchasesAndExpenses, extractedText } = gstData;
              const lateClaimsTarget = determineLateClaimsTarget(extractedText);
              const grossedUpAmount = calculateGrossedUpLateClaimsAmount(lateClaimsAmount);
              
              if (lateClaimsTarget === 'none' || lateClaimsAmount <= 0) {
                // No late claims scenario
                return (
                  <VStack align="stretch" spacing={4}>
                    <Box 
                      bg={useColorModeValue('gray.100', 'gray.700')} 
                      color={textColor} 
                      borderRadius="md" 
                      p={4} 
                      boxShadow="md" 
                      textAlign="center"
                      border="1px solid"
                      borderColor={borderColor}
                    >
                      <Text fontWeight="bold" fontSize="md" letterSpacing="wide" mb={1}>No Late Claims</Text>
                      <Text fontSize="lg" fontWeight="bold">No adjustments required</Text>
                    </Box>
                    <Box bg={cardBgColor} borderRadius="md" p={4} border="1px solid" borderColor={borderColor}>
                      <VStack align="stretch" spacing={1}>
                        <Text fontSize="sm"><strong>File:</strong> {gstData.fileName}</Text>
                        <Text fontSize="sm"><strong>Total Sales and Income (Box 5):</strong> {formatCurrency(gstData.totalSalesAndIncome)}</Text>
                        <Text fontSize="sm"><strong>Total Purchases and Expenses (Box 11):</strong> {formatCurrency(gstData.totalPurchasesAndExpenses)}</Text>
                        <Text fontSize="sm"><strong>Total GST Collected (Box 8):</strong> {formatCurrency(gstData.totalGSTCollected)}</Text>
                        <Text fontSize="sm"><strong>Total GST Credits (Box 12):</strong> {formatCurrency(gstData.totalGSTCredits)}</Text>
                        <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')}><strong>Late Claims Amount:</strong> {formatCurrency(0)}</Text>
                      </VStack>
                    </Box>
                  </VStack>
                );
              }
              
              // Late claims exist - calculate adjusted amount
              const adjustedAmount = lateClaimsTarget === 'purchases' 
                ? totalPurchasesAndExpenses + grossedUpAmount
                : totalSalesAndIncome + grossedUpAmount;
              
              const targetSection = lateClaimsTarget === 'purchases' ? 'Total Purchases and Expenses' : 'Total Sales and Income';
              
              return (
                <VStack align="stretch" spacing={4}>
                  <Box 
                    bg={useColorModeValue('blue.50', 'blue.900')} 
                    color={useColorModeValue('blue.800', 'blue.100')} 
                    borderRadius="md" 
                    p={4} 
                    boxShadow="md" 
                    textAlign="center"
                    border="1px solid"
                    borderColor={useColorModeValue('blue.200', 'blue.700')}
                  >
                    <Text fontWeight="bold" fontSize="md" letterSpacing="wide" mb={1}>
                      {targetSection} after Late Claims
                    </Text>
                    <Text fontSize="2xl" fontWeight="extrabold">
                      {formatCurrency(adjustedAmount)}
                    </Text>
                    <Text fontSize="xs" mt={1} opacity={0.8}>
                      Added to {lateClaimsTarget === 'purchases' ? 'Purchases' : 'Sales'}
                    </Text>
                  </Box>
                  <Box bg={cardBgColor} borderRadius="md" p={4} border="1px solid" borderColor={borderColor}>
                    <VStack align="stretch" spacing={1}>
                      <Text fontSize="sm"><strong>File:</strong> {gstData.fileName}</Text>
                      <Text fontSize="sm"><strong>Total Sales and Income (Box 5):</strong> {formatCurrency(gstData.totalSalesAndIncome)}</Text>
                      <Text fontSize="sm"><strong>Total Purchases and Expenses (Box 11):</strong> {formatCurrency(gstData.totalPurchasesAndExpenses)}</Text>
                      <Text fontSize="sm"><strong>Total GST Collected (Box 8):</strong> {formatCurrency(gstData.totalGSTCollected)}</Text>
                      <Text fontSize="sm"><strong>Total GST Credits (Box 12):</strong> {formatCurrency(gstData.totalGSTCredits)}</Text>
                      <Text fontSize="sm" color={useColorModeValue('orange.600', 'orange.400')}><strong>Late Claims Amount:</strong> {formatCurrency(gstData.lateClaimsAmount)}</Text>
                      <Text fontSize="sm" color={useColorModeValue('green.600', 'green.400')}><strong>Grossed Up Amount:</strong> {formatCurrency(grossedUpAmount)}</Text>
                    </VStack>
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