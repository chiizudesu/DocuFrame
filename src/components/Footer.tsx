import React from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Flex, Text, Box } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';
import { docuFramePalette as P } from '../docuFrameColors';

export const Footer: React.FC = () => {
  const {
    folderItems,
    selectedFiles
  } = useAppContext();
  
  // Match file grid row styling
  const bgColor = useColorModeValue(P.light.footer, P.dark.footer);
  const textColor = useColorModeValue('#64748b', P.dark.subtext);
  
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
      h="100%"
    >
      <Text 
        fontSize="xs" 
        color={textColor} 
        truncate 
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