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
  const [lateClaimsAmount, setLateClaimsAmount] = useState<number>(0);
  const [claimsSection, setClaimsSection] = useState<'sales' | 'purchases'>('sales');
  const [isLoading, setIsLoading] = useState(false);
  const [gstData, setGstData] = useState<GSTData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

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
    // Extract numbers from GST return patterns
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
      extractedText: text.substring(0, 500) + '...', // Preview of extracted text
    };
  };

  const calculateLateClaimsAdjustment = () => {
    if (lateClaimsAmount <= 0) return 0;
    
    // Late claims calculation: (late claims amount / 0.15) * 1.15
    return (lateClaimsAmount / 0.15) * 1.15;
  };

  const getAdjustedTotal = () => {
    if (!gstData) return 0;
    
    const adjustment = calculateLateClaimsAdjustment();
    
    if (claimsSection === 'sales') {
      return gstData.totalSalesAndIncome + adjustment;
    } else {
      return gstData.totalPurchasesAndExpenses + adjustment;
    }
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
    setLateClaimsAmount(0);
    setClaimsSection('sales');
    onClose();
  };

  // Helper to determine if late claims is for sales or purchases
  function isLateClaimOnSales(text: string) {
    // Heuristic: look for 'late claims on sales' or similar in the extracted text
    return /late claims.*sales/i.test(text);
  }

  function isLateClaimOnPurchases(text: string) {
    return /late claims.*purchases|expenses/i.test(text);
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.900" color="white" borderRadius="lg" boxShadow="lg" maxW="400px">
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={0}>
          GST Return Summary
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          {isLoading ? (
            <Flex justify="center" align="center" minH="120px"><Spinner /></Flex>
          ) : gstData ? (
            <VStack align="stretch" spacing={4}>
              {/* Emphasized result box */}
              <Box bgGradient="linear(to-r, teal.400, blue.400)" color="white" borderRadius="md" p={4} boxShadow="md" textAlign="center">
                <Text fontWeight="bold" fontSize="md" letterSpacing="wide" mb={1}>Amount after late claims</Text>
                <Text fontSize="2xl" fontWeight="extrabold">
                  {(() => {
                    const { lateClaimsAmount, totalSalesAndIncome, totalPurchasesAndExpenses, extractedText } = gstData;
                    const lateClaimValue = (lateClaimsAmount / 0.15) * 1.15;
                    let result = totalSalesAndIncome;
                    if (isLateClaimOnPurchases(extractedText)) {
                      result = totalPurchasesAndExpenses + lateClaimValue;
                    } else {
                      result = totalSalesAndIncome + lateClaimValue;
                    }
                    return formatCurrency(result);
                  })()}
                </Text>
              </Box>
              {/* Info summary */}
              <Box bg="gray.800" borderRadius="md" p={4}>
                <VStack align="stretch" spacing={1}>
                  <Text fontSize="sm"><strong>File:</strong> {gstData.fileName}</Text>
                  <Text fontSize="sm"><strong>Total Sales and Income (Box 5):</strong> {formatCurrency(gstData.totalSalesAndIncome)}</Text>
                  <Text fontSize="sm"><strong>Total Purchases and Expenses (Box 11):</strong> {formatCurrency(gstData.totalPurchasesAndExpenses)}</Text>
                  <Text fontSize="sm"><strong>Total GST Collected (Box 8):</strong> {formatCurrency(gstData.totalGSTCollected)}</Text>
                  <Text fontSize="sm"><strong>Total GST Credits (Box 12):</strong> {formatCurrency(gstData.totalGSTCredits)}</Text>
                  <Text fontSize="sm"><strong>Late Claims Amount:</strong> {formatCurrency(gstData.lateClaimsAmount)}</Text>
                </VStack>
              </Box>
            </VStack>
          ) : (
            <Text>No GST data found.</Text>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 