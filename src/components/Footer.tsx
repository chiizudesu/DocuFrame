import React from 'react';
import { Flex, Text, Box, useColorModeValue } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';
export const Footer: React.FC = () => {
  const {
    outputLogs
  } = useAppContext();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.600', 'gray.400');
  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return useColorModeValue('red.500', 'red.300');
      case 'response':
        return useColorModeValue('green.500', 'green.300');
      default:
        return useColorModeValue('gray.800', 'white');
    }
  };
  // Get the latest log message if available
  const latestLog = outputLogs.length > 0 ? outputLogs[outputLogs.length - 1] : null;
  return <Flex justify="space-between" align="center" p={2} bg={bgColor} borderTop="1px" borderColor={borderColor} h="100%">
      {latestLog && <Text fontSize="xs" fontFamily="monospace" color={getLogColor(latestLog.type)} isTruncated maxW="70%" userSelect="none">
          {latestLog.message}
        </Text>}
      <Flex align="center">
        <Text fontSize="xs" color={textColor} mr={2} userSelect="none">
          v1.0.0
        </Text>
        <Text fontSize="xs" color={textColor} userSelect="none">
          developed by Matty
        </Text>
      </Flex>
    </Flex>;
};