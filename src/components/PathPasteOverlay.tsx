import React, { useEffect, useState } from 'react';
import { Box, Text, Flex, Button } from '@chakra-ui/react';
import { FolderOpen, Hash } from 'lucide-react';

export const PathPasteOverlay: React.FC = () => {
  const [path, setPath] = useState<string>('');
  const [irdNumber, setIrdNumber] = useState<string | null>(null);

  useEffect(() => {
    // Listen for path and IRD updates from main process via IPC
    const handlePathDataUpdate = (_event: any, data: { path: string; irdNumber: string | null }) => {
      if (data.path) {
        setPath(data.path);
      }
      setIrdNumber(data.irdNumber || null);
    };

    // Register IPC listener for 'update-path-data' messages using electronAPI
    if ((window as any).electronAPI?.onMessage) {
      (window as any).electronAPI.onMessage('update-path-data', handlePathDataUpdate);
    }

    return () => {
      if ((window as any).electronAPI?.removeListener) {
        (window as any).electronAPI.removeListener('update-path-data', handlePathDataUpdate);
      }
    };
  }, []);

  const handleSelectValue = async (value: string) => {
    try {
      if ((window as any).electronAPI?.selectPasteValue) {
        await (window as any).electronAPI.selectPasteValue(value);
      }
    } catch (error) {
      console.error('Error selecting paste value:', error);
    }
  };

  if (!path) {
    return null;
  }

  return (
    <Box
      w="100%"
      h="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(15, 23, 42, 0.95)"
      backdropFilter="blur(12px)"
      border="4px solid"
      borderColor="rgba(99, 179, 237, 0.4)"
      boxShadow="0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(99, 179, 237, 0.1)"
      px={5}
      py={3}
    >
      <Flex direction="column" gap={3} w="100%" maxW="95%">
        <Flex align="center" gap={3}>
          <Box
            p={2}
            borderRadius="8px"
            bg="rgba(99, 179, 237, 0.15)"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <FolderOpen size={18} color="#63B3ED" />
          </Box>
          <Flex direction="column" gap={0} overflow="hidden" flex={1}>
            <Text
              fontSize="xs"
              fontWeight="500"
              color="gray.400"
              textTransform="uppercase"
              letterSpacing="0.5px"
            >
              Select to Paste
            </Text>
            <Text
              fontSize="sm"
              color="gray.100"
              fontFamily="'Consolas', 'Monaco', monospace"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              title={path}
            >
              {path}
            </Text>
          </Flex>
        </Flex>
        <Flex gap={2} w="100%">
          <Button
            flex={1}
            size="sm"
            bg="rgba(99, 179, 237, 0.2)"
            color="gray.100"
            border="1px solid"
            borderColor="rgba(99, 179, 237, 0.4)"
            _hover={{
              bg: 'rgba(99, 179, 237, 0.3)',
              borderColor: 'rgba(99, 179, 237, 0.6)',
            }}
            _active={{
              bg: 'rgba(99, 179, 237, 0.4)',
            }}
            onClick={() => handleSelectValue(path)}
            leftIcon={<FolderOpen size={14} />}
          >
            Path
          </Button>
          {irdNumber && (
            <Button
              flex={1}
              size="sm"
              bg="rgba(99, 179, 237, 0.2)"
              color="gray.100"
              border="1px solid"
              borderColor="rgba(99, 179, 237, 0.4)"
              _hover={{
                bg: 'rgba(99, 179, 237, 0.3)',
                borderColor: 'rgba(99, 179, 237, 0.6)',
              }}
              _active={{
                bg: 'rgba(99, 179, 237, 0.4)',
              }}
              onClick={() => handleSelectValue(irdNumber)}
              leftIcon={<Hash size={14} />}
            >
              IRD: {irdNumber}
            </Button>
          )}
        </Flex>
      </Flex>
    </Box>
  );
};
