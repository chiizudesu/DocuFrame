import React from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Badge, Tooltip, IconButton } from '@chakra-ui/react';
import { ExternalLink, Building, Hash, FileText, Info, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse, isCollapsed }) => {
  const {
    currentDirectory,
    addLog
  } = useAppContext();

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const accentColor = useColorModeValue('#3b82f6', 'blue.400');
  const labelColor = useColorModeValue('#64748b', 'gray.400');
  const panelBgColor = useColorModeValue('#ffffff', 'gray.750');
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');

  // Extract client name from path if available
  const pathSegments = currentDirectory.split(/[/\\]/).filter(segment => segment && segment !== '');
  const clientName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : 'No Client Selected';

  // Mock client data - in a real app, this would be fetched based on the client name
  const clientData = {
    name: clientName,
    companyNumber: '1234567',
    irdNumber: '123-456-789',
    status: 'Active'
  };

  const handleExternalLink = (destination: string) => {
    addLog(`Opening external link: ${destination}`);
  };

  if (collapsed) {
    return (
      <Box p={2} h="100%" bg={bgColor} display="flex" flexDirection="column" alignItems="center" justifyContent="flex-start">
        {/* Collapse/Expand button at the very top, centered */}
        <Box w="100%" display="flex" justifyContent="center" mb={3}>
          <IconButton aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} icon={<ChevronRight size={20} strokeWidth={2.5} />} size="sm" variant="ghost" onClick={onToggleCollapse} />
        </Box>
        {/* Stacked icons below (no collapse icon here) */}
        <Tooltip label="Xero" placement="right">
          <IconButton aria-label="Xero" icon={<ExternalLink size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#1976d2" color="#e3f0fa" borderRadius="lg" _hover={{ bg: '#1976d2', color: '#cbe3f7' }} mb={2} />
        </Tooltip>
        <Tooltip label="XPM" placement="right">
          <IconButton aria-label="XPM" icon={<ExternalLink size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#388e3c" color="#e3fae3" borderRadius="lg" _hover={{ bg: '#388e3c', color: '#c8f7cb' }} mb={2} />
        </Tooltip>
        <Tooltip label={<Box minW="180px"><Text fontWeight="bold">Client Information</Text><Divider my={1} /><Text fontSize="sm"><b>Name:</b> {clientData.name}<br/><b>Company #:</b> {clientData.companyNumber}<br/><b>IRD #:</b> {clientData.irdNumber}</Text></Box>} placement="right" hasArrow>
          <IconButton aria-label="Client Info" icon={<Info size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#6d28d9" color="#ede9fe" borderRadius="lg" _hover={{ bg: '#6d28d9', color: '#ddd6fe' }} mb={2} />
        </Tooltip>
        <Tooltip label={<Box minW="180px"><Text fontWeight="bold">Recent Activity</Text><Divider my={1} /><Text fontSize="sm">Files updated: 2024-04-15<br/>Last accessed: 2024-04-10<br/>Files merged: 2024-04-05</Text></Box>} placement="right" hasArrow>
          <IconButton aria-label="Recent Activity" icon={<Clock size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#b45309" color="#fef9c3" borderRadius="lg" _hover={{ bg: '#b45309', color: '#fef08a' }} />
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box p={4} h="100%" overflowY="auto" bg={bgColor}>
      {/* Quick Actions (no label) with collapse button at top right */}
      <Flex mb={6} alignItems="center">
        <Flex gap={3} flex="1">
          <Button 
            leftIcon={<ExternalLink size={16} />} 
            variant="outline" 
            size="sm" 
            flex="1" 
            onClick={() => handleExternalLink('Xero')} 
            borderColor={accentColor} 
            color={accentColor}
            fontWeight="medium"
            _hover={{
              bg: useColorModeValue('#f1f5f9', 'gray.700'),
              borderColor: accentColor
            }}
          >
            Xero
          </Button>
          <Button 
            leftIcon={<ExternalLink size={16} />} 
            variant="outline" 
            size="sm" 
            flex="1" 
            onClick={() => handleExternalLink('XPM Job Page')} 
            borderColor="green.500" 
            color="green.600"
            fontWeight="medium"
            _hover={{
              bg: useColorModeValue('#f0fdf4', 'gray.700'),
              borderColor: "green.500"
            }}
          >
            XPM
          </Button>
        </Flex>
        <IconButton aria-label="Collapse sidebar" icon={<ChevronLeft size={20} strokeWidth={2.5} />} size="sm" variant="ghost" ml={2} onClick={onToggleCollapse} />
      </Flex>

      <Divider mb={6} borderColor={useColorModeValue('#e2e8f0', 'gray.700')} />

      {/* Client Information */}
      <Box mb={6}>
        <Flex align="center" mb={4}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Client Information
          </Text>
        </Flex>
        
        <Box 
          p={4} 
          borderRadius="lg" 
          border="1px solid" 
          borderColor={borderColor} 
          bg={panelBgColor} 
          boxShadow="0 2px 4px rgba(0,0,0,0.05)"
        >
          <VStack align="stretch" spacing={4}>
            <Box>
              <Flex align="center" mb={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase" letterSpacing="0.5px">
                  Client Name
                </Text>
              </Flex>
              <Text fontSize="sm" fontWeight="medium" color={textColor}>
                {clientData.name}
              </Text>
            </Box>
            
            <Box>
              <Flex align="center" mb={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase" letterSpacing="0.5px">
                  Company Number
                </Text>
              </Flex>
              <Text fontSize="sm" color={secondaryTextColor} fontFamily="mono">
                {clientData.companyNumber}
              </Text>
            </Box>
            
            <Box>
              <Flex align="center" mb={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase" letterSpacing="0.5px">
                  IRD Number
                </Text>
              </Flex>
              <Text fontSize="sm" color={secondaryTextColor} fontFamily="mono">
                {clientData.irdNumber}
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>

      <Divider mb={6} borderColor={useColorModeValue('#e2e8f0', 'gray.700')} />

      {/* Recent Activity */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" mb={3} color={textColor}>
          Recent Activity
        </Text>
        <Box 
          p={4} 
          borderRadius="lg" 
          border="1px solid" 
          borderColor={borderColor} 
          bg={panelBgColor} 
          boxShadow="0 2px 4px rgba(0,0,0,0.05)"
        >
          <VStack align="stretch" spacing={3}>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color={textColor}>Files updated</Text>
              <Text fontSize="xs" color={labelColor} fontFamily="mono">2024-04-15</Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color={textColor}>Last accessed</Text>
              <Text fontSize="xs" color={labelColor} fontFamily="mono">2024-04-10</Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="sm" color={textColor}>Files merged</Text>
              <Text fontSize="xs" color={labelColor} fontFamily="mono">2024-04-05</Text>
            </Flex>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};