import React, { useState, useEffect } from 'react';
import { Box, Text, Flex, Divider, Button, useColorModeValue, VStack, Badge, Tooltip, IconButton, Spacer } from '@chakra-ui/react';
import { ExternalLink, Building, Hash, FileText, Info, Clock, ChevronLeft, ChevronRight, RefreshCw, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const ClientInfoPane: React.FC<{ collapsed?: boolean, onToggleCollapse?: () => void, isCollapsed?: boolean }> = ({ collapsed = false, onToggleCollapse, isCollapsed }) => {
  const {
    currentDirectory,
    addLog,
    rootDirectory
  } = useAppContext();

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const borderColor = useColorModeValue('#d1d5db', 'gray.700');
  const accentColor = useColorModeValue('#3b82f6', 'blue.400');
  const labelColor = useColorModeValue('#64748b', 'gray.400');
  const panelBgColor = useColorModeValue('#ffffff', 'gray.750');
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue('#64748b', 'gray.300');

  // State for loaded client info
  const [clientInfo, setClientInfo] = useState<any | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Extract client name and tax year from path
  const pathSegments = currentDirectory.split(/[/\\]/).filter(segment => segment && segment !== '');
  // Find the index of the root (Client) folder
  const rootIdx = pathSegments.findIndex(seg => seg.toLowerCase() === rootDirectory.split(/[/\\]/).filter(Boolean).pop()?.toLowerCase());
  // Client Name is the third segment after root, Tax Year is the second segment after root
  const taxYear = rootIdx !== -1 && pathSegments.length > rootIdx + 1 ? pathSegments[rootIdx + 1] : '';
  const clientName = rootIdx !== -1 && pathSegments.length > rootIdx + 2 ? pathSegments[rootIdx + 2] : '';

  // Handler for loading client info
  const handleLoadClientInfo = async () => {
    // Log path info for debugging only when loading client info
    addLog(`[ClientInfoPane] pathSegments: ${JSON.stringify(pathSegments)}, rootIdx: ${rootIdx}, rootDirectory: ${rootDirectory}`);
    setLoadingClient(true);
    setClientError(null);
    // Log the extracted clientName for debugging
    console.log('[ClientInfoPane] Extracted clientName:', clientName);
    addLog(`[ClientInfoPane] Extracted clientName: ${clientName}`);
    if (!clientName) {
      setClientError('Could not extract client name from path.');
      setClientInfo(null);
      setLoadingClient(false);
      return;
    }
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = config.clientbasePath;
      if (!csvPath) {
        setClientError('Clientbase CSV path not configured');
        setLoadingClient(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setClientError('No client data found');
        setLoadingClient(false);
        return;
      }
      // Fuzzy/case-insensitive match
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const match = rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().replace(/\s+/g, '') === clientName.toLowerCase().replace(/\s+/g, '');
      }) || rows.find((row: any) => {
        const field = clientNameFields.find(f => row[f] !== undefined);
        if (!field) return false;
        return String(row[field]).toLowerCase().includes(clientName.toLowerCase());
      });
      if (!match) {
        setClientError('No matching client found');
        setClientInfo(null);
        setLoadingClient(false);
        return;
      }
      setClientInfo(match);
    } catch (err: any) {
      setClientError('Failed to load client info');
      setClientInfo(null);
    }
    setLoadingClient(false);
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
        {/* Only 3 icons: Client Info, Client Link, Job Link */}
        <Tooltip label={<Box minW="180px"><Text fontWeight="bold">Client Information</Text><Divider my={1} />
          <Text fontSize="sm"><b>Name:</b> {clientInfo ? (clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']) : 'No client loaded'}<br/>
          <b>IRD #:</b> {clientInfo ? (clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || '-') : '-'}<br/>
          <b>Address:</b> {clientInfo && clientInfo['Address'] ? clientInfo['Address'] : '-'}</Text></Box>} placement="right" hasArrow>
          <IconButton aria-label="Client Info" icon={<Info size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#6d28d9" color="#ede9fe" borderRadius="lg" _hover={{ bg: '#6d28d9', color: '#ddd6fe' }} mb={2} />
        </Tooltip>
        {clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']) && (
          <Tooltip label="Open Client Page" placement="right" hasArrow>
            <IconButton aria-label="Client Link" icon={<ExternalLink size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#1976d2" color="#e3f0fa" borderRadius="lg" _hover={{ bg: '#1976d2', color: '#cbe3f7' }} mb={2} as="a" href={clientInfo['Client Link'] || clientInfo['ClientLink']} target="_blank" />
          </Tooltip>
        )}
        {clientInfo && taxYear && clientInfo[`${taxYear} Job Link`] && (
          <Tooltip label={`Open ${taxYear} Job`} placement="right" hasArrow>
            <IconButton aria-label="Job Link" icon={<FileText size={20} strokeWidth={2.5} />} size="md" variant="solid" bg="#388e3c" color="#e3fae3" borderRadius="lg" _hover={{ bg: '#388e3c', color: '#c8f7cb' }} as="a" href={clientInfo[`${taxYear} Job Link`]} target="_blank" />
          </Tooltip>
        )}
      </Box>
    );
  }

  // Expanded sidebar: replace Xero/XPM with Client/Job buttons
  const handleOpenClientLink = () => {
    if (clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink'])) {
      window.open(clientInfo['Client Link'] || clientInfo['ClientLink'], '_blank');
    }
  };
  const handleOpenJobLink = () => {
    if (clientInfo && taxYear && clientInfo[`${taxYear} Job Link`]) {
      window.open(clientInfo[`${taxYear} Job Link`], '_blank');
    }
  };

  return (
    <Box p={4} h="100%" overflowY="auto" bg={bgColor}>
      {/* Quick Actions (no label) with collapse button at top right */}
      <Flex mb={6} alignItems="center">
        <Flex gap={3} flex="1">
          <Button 
            leftIcon={<Info size={16} />} 
            variant="outline" 
            size="sm" 
            flex="1" 
            onClick={handleOpenClientLink} 
            borderColor={accentColor} 
            color={accentColor}
            fontWeight="medium"
            isDisabled={!(clientInfo && (clientInfo['Client Link'] || clientInfo['ClientLink']))}
            _hover={{
              bg: useColorModeValue('#f1f5f9', 'gray.700'),
              borderColor: accentColor
            }}
          >
            Client
          </Button>
          <Button 
            leftIcon={<FileText size={16} />} 
            variant="outline" 
            size="sm" 
            flex="1" 
            onClick={handleOpenJobLink} 
            borderColor="green.500" 
            color="green.600"
            fontWeight="medium"
            isDisabled={!(clientInfo && taxYear && clientInfo[`${taxYear} Job Link`])}
            _hover={{
              bg: useColorModeValue('#f0fdf4', 'gray.700'),
              borderColor: "green.500"
            }}
          >
            Job
          </Button>
        </Flex>
        <IconButton aria-label="Collapse sidebar" icon={<ChevronLeft size={20} strokeWidth={2.5} />} size="sm" variant="ghost" ml={2} onClick={onToggleCollapse} />
      </Flex>

      {/* Client Information */}
      <Box mb={2}>
        <Flex align="center" mb={2}>
          <Text fontSize="sm" fontWeight="semibold" color={textColor}>
            Client Information
          </Text>
          <Spacer />
          <IconButton
            aria-label="Load client info"
            icon={<RefreshCw size={16} />}
            size="sm"
            ml={2}
            isLoading={loadingClient}
            onClick={handleLoadClientInfo}
            variant="ghost"
            color={accentColor}
            _hover={{ bg: useColorModeValue('#f1f5f9', 'gray.700') }}
          />
        </Flex>
        {/* Client name indicator below header, revert to previous box style */}
        <Box mb={2} px={2} py={1} borderRadius="md" bg={useColorModeValue('#e0e7ef', 'gray.700')}>
          <Text fontSize="md" fontWeight="bold" color={clientInfo ? textColor : 'gray.500'} textAlign="left">
            {clientInfo ? (clientInfo['Client Name'] || clientInfo['ClientName'] || clientInfo['client name'] || clientInfo['client_name']) : 'No client is loaded'}
          </Text>
        </Box>
        <Box 
          p={3} 
          borderRadius="md" 
          border="1px solid" 
          borderColor={borderColor} 
          bg={useColorModeValue('gray.800', 'gray.700')} 
          boxShadow="none"
        >
          <VStack align="stretch" spacing={3}>
            {/* IRD Number */}
            <Box>
              <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={0.5}>IRD Number</Text>
              <Text fontSize="sm" color={secondaryTextColor} fontFamily="mono">
                {clientInfo ? (clientInfo['IRD No.'] || clientInfo['IRD Number'] || clientInfo['ird number'] || clientInfo['ird_number'] || '-') : '-'}
              </Text>
            </Box>
            {/* Address */}
            {clientInfo && clientInfo['Address'] && (
              <Box>
                <Text fontSize="10px" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="0.5px" mb={0.5}>Address</Text>
                <Text fontSize="sm" color={secondaryTextColor}>{clientInfo['Address']}</Text>
              </Box>
            )}
            {clientError && <Text color="red.500" fontSize="sm">{clientError}</Text>}
          </VStack>
        </Box>
      </Box>

      <Divider mb={6} borderColor={useColorModeValue('#e2e8f0', 'gray.700')} />

      {/* Recent Activity */}
      {/* Removed as per user request */}
    </Box>
  );
};






