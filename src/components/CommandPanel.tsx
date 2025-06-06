import React from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';
import { CommandLine } from './CommandLine';
import { useAppContext } from '../context/AppContext';
export const CommandPanel: React.FC = () => {
  const {
    commandHistory
  } = useAppContext();
  const showInfo = commandHistory.length > 0;
  return <>
      <Box p={2}>
        <CommandLine />
      </Box>
      {showInfo && <Box p={4} pt={0}>
          <Box mt={4} p={3} bg="gray.700" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Command Info
            </Text>
            <Text fontSize="xs" color="gray.400">
              Usage: transfer [number_of_files | new_filename]
            </Text>
          </Box>
          <Box mt={4} p={3} bg="gray.700" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Preview
            </Text>
            <Text fontSize="xs" color="gray.400">
              Files to be transferred:
            </Text>
            <Box mt={2}>
              <Text fontSize="xs">• document1.pdf (2.1 MB)</Text>
              <Text fontSize="xs">• document2.pdf (1.5 MB)</Text>
            </Box>
          </Box>
        </Box>}
    </>;
};