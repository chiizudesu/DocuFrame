import React from 'react';
import { Flex, Text, Box, useColorModeValue } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';

export const Footer: React.FC = () => {
  const {
    folderItems,
    selectedFiles
  } = useAppContext();
  
  // Light mode footer colors
  const bgColor = useColorModeValue('#f8fafc', '#181b20');
  const borderColor = useColorModeValue('#e2e8f0', '#181b20');
  const textColor = useColorModeValue('#64748b', 'gray.500');
  
  // Format file size function
  const formatFileSize = (size: string | undefined) => {
    if (!size) return '';
    const sizeNum = parseFloat(size);
    if (isNaN(sizeNum)) return size;
    if (sizeNum < 1024) return `${sizeNum} B`;
    if (sizeNum < 1024 * 1024) return `${(sizeNum / 1024).toFixed(1)} KB`;
    if (sizeNum < 1024 * 1024 * 1024) return `${(sizeNum / (1024 * 1024)).toFixed(1)} MB`;
    return `${(sizeNum / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Calculate folder information
  const getFolderInfo = () => {
    const totalFiles = folderItems?.length || 0;
    const selectedCount = selectedFiles?.length || 0;
    
    if (totalFiles === 0) {
      return 'No items';
    }
    
    if (selectedCount > 0) {
      // Calculate size of selected items
      const selectedItems = folderItems.filter(item => selectedFiles.includes(item.name));
      const selectedSize = selectedItems.reduce((total, item) => {
        return total + (item.size ? parseFloat(item.size) : 0);
      }, 0);
      
      return `${selectedCount} of ${totalFiles} items selected • ${formatFileSize(selectedSize.toString())}`;
    } else {
      // Calculate total size of all items
      const totalSize = folderItems.reduce((total, item) => {
        return total + (item.size ? parseFloat(item.size) : 0);
      }, 0);
      
      return `${totalFiles} items • ${formatFileSize(totalSize.toString())}`;
    }
  };

  return (
    <Flex 
      justify="space-between" 
      align="center" 
      p={1} 
      px={3}
      minH="28px"
      bg={bgColor} 
      borderTop="1px" 
      borderColor={borderColor} 
      h="100%"
    >
      <Text 
        fontSize="xs" 
        fontFamily="monospace" 
        color={textColor} 
        isTruncated 
        maxW="70%" 
        userSelect="none"
      >
        {getFolderInfo()}
      </Text>
      <Flex align="center">
        <Text fontSize="10px" color={textColor} userSelect="none">
          developed by Matty
        </Text>
      </Flex>
    </Flex>
  );
};