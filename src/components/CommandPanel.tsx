import React from 'react';
import { Box, Text, Flex, Image } from '@chakra-ui/react';
import { CommandLine } from './CommandLine';
import { useAppContext } from '../context/AppContext';

export const CommandPanel: React.FC = () => {
  const {
    commandHistory,
    previewFiles
  } = useAppContext();
  
  const showInfo = commandHistory.length > 0;
  
  return (
    <>
      <Box p={2}>
        <CommandLine />
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
                  <Box key={index} mb={3}>
                    <Text fontSize="xs" mb={1}>
                      • {file.name}
                    </Text>
                    {file.imageData && (
                      <Box mt={2} p={2} bg="gray.600" borderRadius="md" maxW="200px">
                        <Image
                          src={file.imageData}
                          alt={file.name}
                          maxH="120px"
                          maxW="100%"
                          objectFit="contain"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.500"
                        />
                        {file.size && (
                          <Text fontSize="xs" color="gray.400" mt={1}>
                            Size: {(parseInt(file.size) / 1024).toFixed(1)} KB
                          </Text>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </>
  );
};