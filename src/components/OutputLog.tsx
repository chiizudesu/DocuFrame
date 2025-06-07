import React, { useEffect, useRef } from 'react';
import { Box, Flex, Text, IconButton, useColorModeValue } from '@chakra-ui/react';
import { Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { configService } from '../services/config';

type LogType = 'error' | 'response' | 'command' | 'info';

interface OutputLogProps {
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

export const OutputLog: React.FC<OutputLogProps> = ({ minimized, setMinimized }) => {
  const { outputLogs, addLog, clearLogs, setStatus } = useAppContext();
  const logContainerRef = useRef<HTMLDivElement>(null);
  const hasLoggedRootPath = useRef(false);

  // Optimized color values for consistent appearance
  const logColorMap: Record<LogType, string> = {
    error: useColorModeValue('#dc2626', 'red.300'),
    response: useColorModeValue('#059669', 'green.300'),
    command: useColorModeValue('#3730a3', 'indigo.300'),
    info: useColorModeValue('#334155', 'white')
  };

  const logHoverBg = useColorModeValue('#f8fafc', 'gray.700');
  const timestampColor = useColorModeValue('#64748b', 'gray.400');

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [outputLogs]);

  // Log root path only once when component mounts
  useEffect(() => {
    if (!hasLoggedRootPath.current) {
      const rootPath = configService.getRootPath();
      addLog(`Root path: ${rootPath}`, 'info');
      hasLoggedRootPath.current = true;
    }
  }, []); // Empty dependency array means this runs once on mount

  const handleCopy = () => {
    const logText = outputLogs.map(log => `${log.timestamp} ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    setStatus('Copied logs to clipboard', 'success');
  };

  const getLogColor = (type: LogType): string => {
    return logColorMap[type] || logColorMap.info;
  };

  return (
    <Box
      h="100%"
      bg={useColorModeValue('white', 'gray.800')}
      display="flex"
      flexDirection="column"
    >
      <Flex
        p={2}
        borderBottomWidth="1px"
        borderColor={useColorModeValue('#e2e8f0', 'gray.700')}
        justify="space-between"
        align="center"
        flexShrink={0}
        h="40px"
      >
        <Text fontSize="sm" fontWeight="medium">
          Output Log
        </Text>
        <Flex gap={2} align="center">
          <IconButton
            aria-label={minimized ? 'Expand log' : 'Minimize log'}
            icon={minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            size="sm"
            variant="ghost"
            onClick={() => setMinimized(!minimized)}
          />
          <IconButton
            aria-label="Copy logs"
            icon={<Copy size={16} />}
            size="sm"
            variant="ghost"
            onClick={handleCopy}
          />
          <IconButton
            aria-label="Clear logs"
            icon={<Trash2 size={16} />}
            size="sm"
            variant="ghost"
            onClick={clearLogs}
          />
        </Flex>
      </Flex>
      {!minimized && (
        <Box
          ref={logContainerRef}
          p={2}
          overflowY="auto"
          flex="1"
          fontFamily="monospace"
          fontSize="xs"
        >
          {outputLogs.map((log, index) => (
            <Flex
              key={index}
              mb={1.5}
              align="flex-start"
              p={1}
              borderRadius="sm"
              _hover={{ bg: logHoverBg }}
            >
              <Box flex="1">
                <Text as="span" color={timestampColor} userSelect="none" mr={2}>
                  {log.timestamp}
                </Text>
                <Text as="span" color={getLogColor(log.type as LogType)}>
                  {log.message}
                </Text>
              </Box>
            </Flex>
          ))}
        </Box>
      )}
    </Box>
  );
};