import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { CommandLine } from './CommandLine';
import { useAppContext } from '../context/AppContext';

interface CommandPanelProps {
  onFileOperation?: (operation: string, details?: string) => void;
}

export const CommandPanel: React.FC<CommandPanelProps> = ({ onFileOperation }) => {
  const {
    commandHistory,
    previewFiles
  } = useAppContext();
  
  const showInfo = commandHistory.length > 0;
  
  return (
    <>
      <Box p={2}>
        <CommandLine onFileOperation={onFileOperation} />
      </Box>
      {showInfo && (
        <Box p={4} pt={0}>
          <Box mt={4} p={3} bg="gray.700" borderRadius="md">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Command Info
            </Text>
            <Text fontSize="xs" color="gray.400">
              Usage: transfer [number_of_files | new_filename]
            </Text>
          </Box>
          {previewFiles.length > 0 && (
            <Box mt={4} p={3} bg="gray.700" borderRadius="md">
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Preview
              </Text>
              <Text fontSize="xs" color="gray.400">
                Files to be transferred:
              </Text>
              <Box mt={2}>
                {previewFiles.map((file, index) => (
                  <Text key={index} fontSize="xs">
                    • {file.name}
                  </Text>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </>
  );
};