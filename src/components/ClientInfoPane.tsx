import React from 'react';
import { Box, Text, Flex, Heading, Divider, Button, useColorModeValue, VStack, HStack } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
export const ClientInfoPane: React.FC = () => {
  const {
    currentDirectory,
    addLog
  } = useAppContext();
  const bgColor = useColorModeValue('#f8f9fc', 'gray.800');
  const borderColor = useColorModeValue('#e2e8f0', 'gray.700');
  const accentColor = useColorModeValue('#4F46E5', 'blue.400');
  const labelColor = useColorModeValue('gray.600', 'gray.400');
  const panelBgColor = useColorModeValue('#f2f5fa', 'gray.750');
  // Extract client name from path if available
  const pathSegments = currentDirectory.split('/').filter(segment => segment);
  const clientName = pathSegments.length > 0 ? pathSegments[0] : 'No Client Selected';
  // Mock client data - in a real app, this would be fetched based on the client name
  const clientData = {
    name: clientName,
    companyNumber: '1234567',
    irdNumber: '123-456-789'
  };
  const handleExternalLink = (destination: string) => {
    addLog(`Opening external link: ${destination}`);
  };
  return <Box p={3} h="100%" overflowY="auto" bg={bgColor}>
      <Flex gap={2} mb={4}>
        <Button leftIcon={<ExternalLink size={14} />} variant="outline" size="sm" flex="1" onClick={() => handleExternalLink('Xero')} borderColor={accentColor} color={accentColor} _hover={{
        bg: useColorModeValue('#f0f2f8', 'gray.700')
      }}>
          Xero
        </Button>
        <Button leftIcon={<ExternalLink size={14} />} variant="outline" size="sm" flex="1" onClick={() => handleExternalLink('XPM Job Page')} borderColor="green.500" color="green.600" _hover={{
        bg: useColorModeValue('#f0f9f0', 'gray.700')
      }}>
          XPM
        </Button>
      </Flex>
      <Divider mb={4} borderColor={useColorModeValue('gray.300', 'gray.700')} />
      <Box p={3} borderRadius="md" border="1px solid" borderColor={borderColor} mb={4} bg={panelBgColor} boxShadow="0 1px 3px rgba(0,0,0,0.05)">
        <Heading as="h3" size="sm" mb={3} color={accentColor}>
          Client Information
        </Heading>
        <VStack align="stretch" spacing={3}>
          <Box>
            <Text fontSize="xs" fontWeight="medium" color={labelColor}>
              CLIENT NAME
            </Text>
            <Text fontSize="sm" fontWeight="medium" color={useColorModeValue('gray.700', 'white')}>
              {clientData.name}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" fontWeight="medium" color={labelColor}>
              COMPANY NUMBER
            </Text>
            <Text fontSize="sm" color={useColorModeValue('gray.700', 'white')}>
              {clientData.companyNumber}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" fontWeight="medium" color={labelColor}>
              IRD NUMBER
            </Text>
            <Text fontSize="sm" color={useColorModeValue('gray.700', 'white')}>
              {clientData.irdNumber}
            </Text>
          </Box>
        </VStack>
      </Box>
      <Divider mb={4} borderColor={useColorModeValue('gray.300', 'gray.700')} />
      <Box p={3} borderRadius="md" border="1px solid" borderColor={borderColor} bg={panelBgColor} boxShadow="0 1px 3px rgba(0,0,0,0.05)">
        <Text fontSize="xs" fontWeight="medium" mb={2} color={accentColor}>
          Recent Activity
        </Text>
        <VStack align="stretch" spacing={2} pl={1}>
          <Text fontSize="xs" color={labelColor}>
            Files updated: 2024-04-15
          </Text>
          <Text fontSize="xs" color={labelColor}>
            Last accessed: 2024-04-10
          </Text>
          <Text fontSize="xs" color={labelColor}>
            Files merged: 2024-04-05
          </Text>
        </VStack>
      </Box>
    </Box>;
};