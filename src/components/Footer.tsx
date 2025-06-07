import React from 'react';
import { Flex, Text, Box, useColorModeValue } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';

export const Footer: React.FC = () => {
  const {
    statusMessage,
    statusType
  } = useAppContext();
  
  // Light mode footer colors
  const bgColor = useColorModeValue('#f8fafc', '#181b20');
  const borderColor = useColorModeValue('#e2e8f0', '#181b20');
  const textColor = useColorModeValue('#64748b', 'gray.500');
  
  const getStatusColor = (type: string) => {
    switch (type) {
      case 'error':
        return useColorModeValue('#dc2626', 'red.300');
      case 'success':
        return useColorModeValue('#059669', 'green.300');
      case 'info':
        return useColorModeValue('#3730a3', 'blue.300');
      default:
        return useColorModeValue('#64748b', 'gray.400');
    }
  };

  return (
    <Flex 
      justify="space-between" 
      align="center" 
      p={1} 
      minH="28px"
      bg={bgColor} 
      borderTop="1px" 
      borderColor={borderColor} 
      h="100%"
    >
      <Text 
        fontSize="xs" 
        fontFamily="monospace" 
        color={getStatusColor(statusType)} 
        isTruncated 
        maxW="70%" 
        userSelect="none"
      >
        {statusMessage}
      </Text>
      <Flex align="center">
        <Text fontSize="10px" color={textColor} userSelect="none">
          developed by Matty
        </Text>
      </Flex>
    </Flex>
  );
};