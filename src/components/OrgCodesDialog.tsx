import React, { useState, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import {
  Button,
  Text,
  VStack,
  HStack,
  Table,
  Spinner,
  Alert,
  IconButton,
  Box,
  Flex,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Building2, Download, ExternalLink } from 'lucide-react';

interface OrgCode {
  xeroName: string;
  orgCode: string;
  tenantId?: string;
  organisationId?: string;
  countryCode?: string;
  baseCurrency?: string;
}

interface OrgCodesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrgCodesDialog: React.FC<OrgCodesDialogProps> = ({ isOpen, onClose }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [orgCodes, setOrgCodes] = useState<OrgCode[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log when component mounts
  React.useEffect(() => {
    console.log('OrgCodesDialog mounted, isOpen:', isOpen);
  }, [isOpen]);

  // Check for OAuth callback parameters on mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (code) {
      setIsConnecting(false);
      fetchOrganizations(code);
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setIsConnecting(false);
      setError(decodeURIComponent(error));
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const tableBorderColor = useColorModeValue('gray.200', 'gray.600');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');

  // OAuth 2.0 flow
  const handleConnect = useCallback(async () => {
    console.log('🔗 handleConnect called - user clicked Connect to Xero button');
    setIsConnecting(true);
    setError(null);

    try {
      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15);
      
      // Try to initiate OAuth flow through backend
      let authUrl;
      try {
        const response = await fetch('/api/xero/auth/initiate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state }),
        });

        if (response.ok) {
          const data = await response.json();
          authUrl = data.authUrl;
        } else {
          let errorMessage = 'Failed to initiate OAuth flow';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.warn('Could not parse error response as JSON:', e);
          }
          throw new Error(errorMessage);
        }
      } catch (backendError) {
        console.error('Backend error:', backendError);
        setIsConnecting(false);
        setError(backendError instanceof Error ? backendError.message : 'Failed to connect to Xero');
        return;
      }

      // Open auth URL in a new tab
      window.open(authUrl, '_blank');

      // Handle OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'XERO_OAUTH_SUCCESS') {
          setIsConnecting(false);
          // Fetch organizations from backend
          fetchOrganizations(event.data.code);
        } else if (event.data.type === 'XERO_OAUTH_ERROR') {
          setIsConnecting(false);
          setError(event.data.error || 'OAuth authentication failed');
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup function
      return () => {
        window.removeEventListener('message', handleMessage);
      };

    } catch (err) {
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : 'Failed to initiate OAuth connection');
      console.error('OAuth error:', err);
    }
  }, []);

  // Fetch organizations from Xero API
  const fetchOrganizations = async (authCode: string) => {
    try {
      // Exchange auth code for token and fetch organizations
      const response = await fetch('/api/xero/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: authCode }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrgCodes(data.organizations || []);
        setIsConnected(true);
      } else {
        let errorMessage = `Server error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.warn('Could not parse error response as JSON:', e);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organization codes');
      console.error('Fetch error:', err);
    }
  };

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (orgCodes.length === 0) return;

    const csvContent = [
      ['Organization Name', 'Tenant ID', 'Country Code', 'Base Currency', 'Organisation ID'], // Header
      ...orgCodes.map(org => [
        org.xeroName, 
        org.tenantId || org.orgCode, 
        org.countryCode || 'N/A',
        org.baseCurrency || 'N/A',
        org.organisationId || 'N/A'
      ])
    ]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `xero-org-codes-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [orgCodes]);

  const handleClose = () => {
    setIsConnected(false);
    setOrgCodes([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} size='xl' scrollBehavior="inside" placement='center' onOpenChange={e => {
      if (!e.open) {
        handleClose();
      }
    }}>
      <Portal>

        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header py={3}>
              <HStack>
                <Building2 size={18} />
                <Text fontSize="lg" fontWeight="semibold">Xero Organization Codes</Text>
              </HStack>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body pb={6} pt={2}>
              <VStack gap={3} align="stretch" justify="center" minHeight="300px">
                {error && (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Box>
                      <Alert.Title>Connection Error</Alert.Title>
                      <Alert.Description>{error}</Alert.Description>
                    </Box>
                  </Alert.Root>
                )}

                {!isConnected && !isConnecting && (
                  <VStack gap={4} align="center" justify="center" flex="1">
                    <Text textAlign="center" color="gray.600" fontSize="sm" maxWidth="300px">
                      Connect to Xero to retrieve your organization codes
                    </Text>
                    <Button colorPalette="blue" onClick={handleConnect} size="md"><ExternalLink size={16} />Connect to Xero
                                      </Button>
                  </VStack>
                )}

                {isConnecting && (
                  <VStack gap={4} align="center" justify="center" flex="1">
                    <Spinner size="lg" color="blue.500" />
                    <Text textAlign="center" fontSize="sm" maxWidth="300px">
                      Connecting to Xero... Please complete authentication in the popup window.
                    </Text>
                  </VStack>
                )}

                {isConnected && (
                  <VStack gap={3} align="stretch">
                    <Flex justify="space-between" align="center">
                      <Text fontWeight="medium" color="green.600" fontSize="sm">
                        Connected to Xero ✓
                      </Text>
                      <IconButton
                        aria-label="Export to CSV"
                        onClick={handleExportCSV}
                        colorPalette="green"
                        size="sm"
                        disabled={orgCodes.length === 0}><Download size={14} /></IconButton>
                    </Flex>

                    {orgCodes.length > 0 ? (
                      <Table.ScrollArea maxHeight="400px" overflowY="auto">
                        <Table.Root variant="line" size="sm">
                          <Table.Header bg={headerBg} position="sticky" top={0} zIndex={1}>
                            <Table.Row>
                              <Table.ColumnHeader 
                                borderColor={tableBorderColor} 
                                borderWidth="1px"
                                borderStyle="solid"
                              >
                                Organization Name
                              </Table.ColumnHeader>
                              <Table.ColumnHeader 
                                borderColor={tableBorderColor} 
                                borderWidth="1px"
                                borderStyle="solid"
                              >
                                Tenant ID
                              </Table.ColumnHeader>
                              <Table.ColumnHeader 
                                borderColor={tableBorderColor} 
                                borderWidth="1px"
                                borderStyle="solid"
                              >
                                Country
                              </Table.ColumnHeader>
                              <Table.ColumnHeader 
                                borderColor={tableBorderColor} 
                                borderWidth="1px"
                                borderStyle="solid"
                              >
                                Currency
                              </Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {orgCodes.map((org, index) => (
                              <Table.Row key={index} _hover={{ bg: rowHoverBg }}>
                                <Table.Cell 
                                  borderColor={tableBorderColor} 
                                  borderWidth="1px"
                                  borderStyle="solid"
                                >
                                  {org.xeroName}
                                </Table.Cell>
                                <Table.Cell 
                                  borderColor={tableBorderColor} 
                                  borderWidth="1px"
                                  borderStyle="solid"
                                  fontFamily="mono"
                                  fontSize="xs"
                                >
                                  {org.tenantId || org.orgCode}
                                </Table.Cell>
                                <Table.Cell 
                                  borderColor={tableBorderColor} 
                                  borderWidth="1px"
                                  borderStyle="solid"
                                  textAlign="center"
                                >
                                  {org.countryCode || 'N/A'}
                                </Table.Cell>
                                <Table.Cell 
                                  borderColor={tableBorderColor} 
                                  borderWidth="1px"
                                  borderStyle="solid"
                                  textAlign="center"
                                >
                                  {org.baseCurrency || 'N/A'}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </Table.ScrollArea>
                    ) : (
                      <Text textAlign="center" color="gray.500" fontSize="sm">
                        No organization codes found
                      </Text>
                    )}
                  </VStack>
                )}
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>

      </Portal>
    </Dialog.Root>
  );
}; 