import React, { useState, useEffect } from 'react';
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

  // Xero OAuth state
  const [loadedClient, setLoadedClient] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Handle Xero connect with silent auth fallback
  const handleXeroConnect = async () => {
    setIsConnecting(true);
    
    const tryAuth = async (prompt?: string) => {
      const response = await fetch('/api/xero/auth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate OAuth flow');
      }
      
      const data = await response.json();
      return data.authUrl;
    };

    try {
      // Check if we're in Electron - if so, skip silent auth since it won't work
      const isElectron = window.navigator.userAgent.includes('Electron');
      
      // First try silent auth (no login prompt if already logged in) - but skip in Electron
      let authUrl = await tryAuth(isElectron ? 'login' : 'none');
      
      // Open popup window
      const popup = window.open(
        authUrl,
        'xero-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );
      
      if (!popup) {
        setIsConnecting(false);
        return;
      }

      // Poll to detect if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

      // Listen for postMessage from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'XERO_OAUTH_SUCCESS') {
          clearInterval(checkClosed);
          setIsConnecting(false);
          // Exchange code and state for org info
          fetch('/api/xero/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: event.data.code, state: event.data.state }),
          })
            .then(res => res.json())
            .then(data => {
              if (data.organizations && data.organizations.length > 0) {
                setLoadedClient(data.organizations[0].xeroName);
              }
            });
          window.removeEventListener('message', handleMessage);
          popup.close();
        } else if (event.data.type === 'XERO_OAUTH_ERROR') {
          clearInterval(checkClosed);
          // If silent auth failed (user not logged in), try with login prompt
          // Only retry if we originally tried silent auth (not in Electron)
          const isElectron = window.navigator.userAgent.includes('Electron');
          if (!isElectron && event.data.error === 'login_required') {
            window.removeEventListener('message', handleMessage);
            popup.close();
            
            // Retry with login prompt
            tryAuth('login').then(retryAuthUrl => {
              const retryPopup = window.open(
                retryAuthUrl,
                'xero-oauth',
                'width=600,height=700,scrollbars=yes,resizable=yes'
              );
              
              if (retryPopup) {
                // Poll to detect if retry popup is closed manually
                const checkRetryClosed = setInterval(() => {
                  if (retryPopup.closed) {
                    clearInterval(checkRetryClosed);
                    setIsConnecting(false);
                    window.removeEventListener('message', handleRetryMessage);
                  }
                }, 1000);

                // Set up message handler for retry popup
                const handleRetryMessage = (event: MessageEvent) => {
                  if (event.origin !== window.location.origin) return;
                  
                  if (event.data.type === 'XERO_OAUTH_SUCCESS') {
                    clearInterval(checkRetryClosed);
                    setIsConnecting(false);
                    fetch('/api/xero/organizations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ code: event.data.code, state: event.data.state }),
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.organizations && data.organizations.length > 0) {
                          setLoadedClient(data.organizations[0].xeroName);
                        }
                      });
                    window.removeEventListener('message', handleRetryMessage);
                    retryPopup.close();
                  } else if (event.data.type === 'XERO_OAUTH_ERROR') {
                    clearInterval(checkRetryClosed);
                    setIsConnecting(false);
                    alert(event.data.error || 'OAuth authentication failed');
                    window.removeEventListener('message', handleRetryMessage);
                    retryPopup.close();
                  }
                };
                window.addEventListener('message', handleRetryMessage);
              } else {
                setIsConnecting(false);
              }
            }).catch(() => {
              setIsConnecting(false);
              alert('Failed to retry OAuth flow');
            });
          } else {
            clearInterval(checkClosed);
            setIsConnecting(false);
            alert(event.data.error || 'OAuth authentication failed');
            window.removeEventListener('message', handleMessage);
            popup.close();
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
    } catch (err) {
      setIsConnecting(false);
      alert('Failed to connect to Xero');
    }
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
            onClick={handleXeroConnect} 
            borderColor={accentColor} 
            color={accentColor}
            fontWeight="medium"
            isLoading={isConnecting}
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

      {/* Xero loaded client indicator row */}
      <Box mt={2} mb={4} px={2} py={1} borderRadius="md" bg={useColorModeValue('#e0e7ef', 'gray.700')}>
        <Text fontSize="xs" color={loadedClient ? 'green.600' : 'gray.500'} fontWeight="medium" textAlign="center">
          {loadedClient ? `Loaded client: ${loadedClient}` : 'No client is loaded'}
        </Text>
      </Box>

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