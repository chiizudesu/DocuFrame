import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  Flex,
  Icon,
  useColorModeValue,
  Image,
  Spinner,
  Button,
  VStack,
} from '@chakra-ui/react';
import { FileText, ExternalLink, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { FileItem } from '../types';

export const PreviewPane: React.FC = () => {
  // All hooks must be called in the same order every render
  const { selectedFiles, folderItems, isPreviewPaneOpen } = useAppContext();
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfHttpUrl, setPdfHttpUrl] = useState<string>('');

  // Theme-aware colors - all useColorModeValue calls must be consistent
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const secondaryTextColor = useColorModeValue('gray.600', 'gray.300');
  const iconColor = useColorModeValue('gray.500', 'gray.400');
  const controlBg = useColorModeValue('gray.100', 'gray.700');

  // Auto-preview selected files
  useEffect(() => {
    if (!isPreviewPaneOpen || selectedFiles.length !== 1) {
      setPreviewFile(null);
      setPdfHttpUrl('');
      return;
    }

    const selectedFile = folderItems.find(f => f.name === selectedFiles[0]);
    if (selectedFile && selectedFile.type === 'file') {
      setPreviewFile(selectedFile);
      setIsLoading(false);
      
      // Convert file path to HTTP URL for PDFs and images
      if (/\.(pdf|jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(selectedFile.name)) {
        convertFilePathToHttpUrl(selectedFile.path);
      }
    } else {
      setPreviewFile(null);
    }
  }, [selectedFiles, folderItems, isPreviewPaneOpen]);

  const convertFilePathToHttpUrl = async (filePath: string) => {
    try {
      if (window.electronAPI?.convertFilePathToHttpUrl) {
        const result = await window.electronAPI.convertFilePathToHttpUrl(filePath);
        if (result.success && result.url) {
          setPdfHttpUrl(result.url);
          console.log('PDF HTTP URL:', result.url);
        } else {
          console.error('Failed to convert file path to HTTP URL:', result.error);
          setPdfHttpUrl('');
        }
      }
    } catch (error) {
      console.error('Error converting file path to HTTP URL:', error);
      setPdfHttpUrl('');
    }
  };

  const openWithSystemDefault = async () => {
    if (!previewFile) return;

    try {
      if (window.electronAPI?.openFile) {
        await window.electronAPI.openFile(previewFile.path);
      }
    } catch (error) {
      console.error('Error opening file with system default:', error);
    }
  };

  if (!previewFile) {
    return (
      <Box
        flex={1}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap={3}
        p={6}
        bg={bgColor}
      >
        <Icon as={FileText} boxSize={12} color={iconColor} />
        <Text color={textColor} textAlign="center" fontSize="lg" fontWeight="medium">
          No File Selected
        </Text>
        <Text color={secondaryTextColor} textAlign="center" fontSize="sm">
          Select a file to preview
        </Text>
      </Box>
    );
  }

  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(previewFile.name);
  const isPDF = /\.pdf$/i.test(previewFile.name);

  return (
    <Box flex={1} bg={bgColor} display="flex" flexDirection="column">
      {/* Preview Pane Header */}
      <Flex
        p={3}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        justify="center"
        bg={headerBg}
      >
        <Text fontWeight="bold" fontSize="sm" color={textColor} noOfLines={1}>
          {previewFile.name}
        </Text>
      </Flex>
      
      {/* Preview Content */}
      <Box flex={1} overflow="auto" p={0} bg={bgColor}>
        {isLoading ? (
          <Flex
            width="100%"
            height="100%"
            alignItems="center"
            justifyContent="center"
            flexDirection="column"
            gap={3}
          >
            <Spinner size="lg" color={iconColor} />
            <Text color={secondaryTextColor} fontSize="sm">
              Loading preview...
            </Text>
          </Flex>
        ) : (
          <>
            {isImage ? (
              <VStack spacing={4} align="stretch">
                <Image
                  src={pdfHttpUrl || `file://${previewFile.path}`}
                  alt={previewFile.name}
                  maxW="100%"
                  maxH="100%"
                  objectFit="contain"
                  borderRadius="md"
                  shadow="md"
                  fallback={
                    <Flex
                      width="100%"
                      height="200px"
                      alignItems="center"
                      justifyContent="center"
                      flexDirection="column"
                      gap={3}
                    >
                      <Icon as={FileText} boxSize={8} color={iconColor} />
                      <Text color={secondaryTextColor} fontSize="sm">
                        Image loading...
                      </Text>
                    </Flex>
                  }
                />
                <Button
                  leftIcon={<ExternalLink size={16} />}
                  onClick={openWithSystemDefault}
                  variant="outline"
                  size="sm"
                >
                  Open with System Default
                </Button>
              </VStack>
            ) : isPDF ? (
              <VStack spacing={0} align="stretch" height="100%">
                {/* Embedded PDF Viewer - Scrollable, full container */}
                <Box
                  bg={controlBg}
                  borderRadius="md"
                  border="1px solid"
                  borderColor={borderColor}
                  overflow="hidden"
                  position="relative"
                  height="100%"
                  minHeight="800px"
                  p={0}
                  m={0}
                >
                  {pdfHttpUrl ? (
                    <webview
                      src={pdfHttpUrl}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        margin: '0',
                        padding: '0'
                      }}
                      title={`PDF Preview - ${previewFile.name}`}
                      allowpopups={true}
                      webpreferences="contextIsolation=yes"
                      // Hide left navigation pane and fit to screen by default
                      data-zoom="page-fit"
                      data-sidebar="hidden"
                      onLoad={(e) => {
                        // When webview loads, inject CSS to hide navigation and set zoom
                        const webview = e.target as any;
                        if (webview && webview.getWebContents) {
                          webview.getWebContents().executeJavaScript(`
                            // Hide the left navigation pane
                            const sidebar = document.querySelector('[data-l10n-id="sidebar"]') || 
                                           document.querySelector('.sidebar') ||
                                           document.querySelector('[aria-label*="sidebar"]');
                            if (sidebar) {
                              sidebar.style.display = 'none';
                            }
                            
                            // Hide any filename headers within the PDF viewer - more aggressive approach
                            function hideHeaders() {
                              // Target specific header text patterns
                              const headerSelectors = [
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                '.header', '[class*="header"]', '[class*="title"]',
                                '[class*="heading"]', '[class*="document-title"]',
                                'div[style*="font-size"]', 'span[style*="font-size"]',
                                'p[style*="font-size"]'
                              ];
                              
                              headerSelectors.forEach(selector => {
                                const elements = document.querySelectorAll(selector);
                                elements.forEach(element => {
                                  const text = element.textContent || '';
                                  // Check for various header patterns
                                  if (text.includes('Bank Confirm') || 
                                      text.includes('Bank Confirm - ANZ') ||
                                      text.includes('C - Bank Confirm') ||
                                      text.includes('${previewFile.name.replace(/'/g, "\\'")}') ||
                                      text.includes('${previewFile.name.split('.')[0].replace(/'/g, "\\'")}')) {
                                    element.style.display = 'none';
                                    console.log('Hidden header:', text);
                                  }
                                });
                              });
                              
                              // Also hide elements with large fonts that might be headers
                              const allElements = document.querySelectorAll('*');
                              allElements.forEach(element => {
                                const style = window.getComputedStyle(element);
                                const fontSize = parseInt(style.fontSize);
                                const text = element.textContent || '';
                                
                                if (fontSize >= 16 && (text.includes('Bank Confirm') || 
                                    text.includes('Bank Confirm - ANZ') ||
                                    text.includes('C - Bank Confirm'))) {
                                  element.style.display = 'none';
                                  console.log('Hidden large font header:', text);
                                }
                              });
                            }
                            
                            // Run immediately and also after a delay to catch dynamic content
                            hideHeaders();
                            setTimeout(hideHeaders, 500);
                            setTimeout(hideHeaders, 1000);
                            setTimeout(hideHeaders, 2000);
                            
                            // Set zoom to fit page
                            setTimeout(() => {
                              const zoomFitButton = document.querySelector('[data-l10n-id="zoom-page-fit"]') ||
                                                   document.querySelector('[title*="fit"]') ||
                                                   document.querySelector('[aria-label*="fit"]');
                              if (zoomFitButton) {
                                zoomFitButton.click();
                              }
                            }, 1000);
                          `);
                        }
                      }}
                    />
                  ) : (
                    <Flex
                      width="100%"
                      height="100%"
                      alignItems="center"
                      justifyContent="center"
                      flexDirection="column"
                      gap={3}
                      p={0}
                      m={0}
                    >
                      <Spinner size="lg" color={iconColor} />
                      <Text color={secondaryTextColor} fontSize="sm">
                        Loading PDF...
                      </Text>
                    </Flex>
                  )}
                </Box>

                {/* PDF Controls */}
                <Flex gap={2} justify="center">
                  <Button
                    leftIcon={<ExternalLink size={16} />}
                    onClick={openWithSystemDefault}
                    variant="outline"
                    size="sm"
                  >
                    Open with System Default
                  </Button>
                  <Button
                    leftIcon={<Download size={16} />}
                    onClick={() => {
                      // Create a temporary link to download the PDF
                      const link = document.createElement('a');
                      link.href = `file://${previewFile.path}`;
                      link.download = previewFile.name;
                      link.click();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Download
                  </Button>
                </Flex>

                {/* PDF Information */}
                <Box bg={controlBg} borderRadius="md" p={3}>
                  <Text color={textColor} fontSize="xs" fontWeight="medium" mb={2}>
                    File Information:
                  </Text>
                  <VStack spacing={1} align="start" fontSize="xs" color={secondaryTextColor}>
                    <Text>• Name: {previewFile.name}</Text>
                    <Text>• Type: PDF Document</Text>
                    <Text>• Path: {previewFile.path}</Text>
                    <Text>• Status: Loaded in Preview Pane</Text>
                    {pdfHttpUrl && (
                      <Text>• HTTP URL: {pdfHttpUrl}</Text>
                    )}
                  </VStack>
                </Box>
              </VStack>
            ) : (
              <Box
                width="100%"
                bg={controlBg}
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexDirection="column"
                gap={3}
                p={6}
              >
                <Icon as={FileText} boxSize={16} color={iconColor} />
                <Text color={textColor} textAlign="center" fontSize="lg" fontWeight="medium">
                  Preview Not Available
                </Text>
                <Text fontSize="sm" color={secondaryTextColor} textAlign="center" mb={3}>
                  {previewFile.name}
                </Text>
                <Button
                  leftIcon={<ExternalLink size={16} />}
                  onClick={openWithSystemDefault}
                  variant="outline"
                  size="sm"
                >
                  Open with System Default
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
