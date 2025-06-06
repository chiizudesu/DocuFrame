import React, { useEffect, useRef } from 'react';
import { Box, Flex, Text, IconButton, useColorModeValue } from '@chakra-ui/react';
import { Trash2, Copy } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
export const OutputLog: React.FC = () => {
  const {
    outputLogs,
    clearLogs,
    addLog
  } = useAppContext();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBgColor = useColorModeValue('gray.50', 'gray.900');
  const headerTextColor = useColorModeValue('gray.800', 'white');
  const timestampColor = useColorModeValue('gray.500', 'gray.400');
  // Auto-scroll to the bottom when logs update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [outputLogs]);
  const handleCopy = () => {
    const logText = outputLogs.map(log => `[${log.timestamp}] ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText).then(() => addLog('Logs copied to clipboard', 'info')).catch(err => addLog('Failed to copy logs: ' + err, 'error'));
  };
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
  return <Box h="100%" position="relative" bg={bgColor}>
      <Flex justify="space-between" align="center" p={2} borderBottom="1px" borderColor={borderColor} bg={headerBgColor}>
        <Text fontSize="sm" fontWeight="medium" color={headerTextColor}>
          Output Log
        </Text>
        <Flex>
          <IconButton icon={<Copy size={14} />} aria-label="Copy logs" size="xs" variant="ghost" onClick={handleCopy} mr={1} />
          <IconButton icon={<Trash2 size={14} />} aria-label="Clear logs" size="xs" variant="ghost" onClick={clearLogs} />
        </Flex>
      </Flex>
      <Box ref={logContainerRef} p={2} overflowY="auto" h="calc(100% - 36px)" fontFamily="monospace" fontSize="xs">
        {outputLogs.map((log, index) => <Flex key={index} mb={1.5} align="flex-start" p={1} borderRadius="sm" _hover={{
        bg: useColorModeValue('gray.50', 'gray.700')
      }}>
            <Box flex="1">
              <Text as="span" color={timestampColor} userSelect="none" mr={2}>
                {log.timestamp}
              </Text>
              <Text as="span" color={getLogColor(log.type)}>
                {log.message}
              </Text>
            </Box>
          </Flex>)}
      </Box>
    </Box>;
};