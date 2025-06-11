import React, { useEffect, useState, useRef } from 'react';
import { Box, Input, InputGroup, InputRightElement, IconButton, VStack, Button, HStack, Text, Badge, Flex, useColorModeValue, Icon } from '@chakra-ui/react';
import { ChevronDown, Search, User, Briefcase } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const ClientSearchOverlay: React.FC = () => {
  const { setStatus } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bgColor = useColorModeValue('#ffffff', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const overlayBg = useColorModeValue('rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)');
  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchValue('');
        setResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSearch = async (value: string) => {
    setSearchValue(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = config.clientbasePath;
      if (!csvPath) {
        setStatus('Clientbase CSV path not configured', 'error');
        setResults([]);
        setIsLoading(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const filtered = rows.filter((row: any) => {
        const clientNameField = clientNameFields.find(field => row[field] !== undefined);
        if (clientNameField && row[clientNameField]) {
          const clientValue = String(row[clientNameField]).toLowerCase();
          return clientValue.includes(value.toLowerCase());
        }
        return false;
      }).slice(0, 3);
      setResults(filtered);
    } catch (error) {
      setStatus('Client search failed', 'error');
      setResults([]);
    }
    setIsLoading(false);
  };

  const handleClientAction = (row: any) => {
    const clientLink = row['Client Link'];
    if (clientLink) window.open(clientLink, '_blank');
    else setStatus('No client link available', 'error');
  };

  const handleJobAction = (row: any) => {
    const jobLinkField = `${selectedYear} Job Link`;
    const jobLink = row[jobLinkField];
    if (jobLink) window.open(jobLink, '_blank');
    else setStatus(`No ${selectedYear} job link available`, 'error');
  };

  const toggleYear = () => setSelectedYear(selectedYear === '2025' ? '2026' : '2025');
  const closeOverlay = () => { setIsOpen(false); setSearchValue(''); setResults([]); };

  if (!isOpen) return null;

  return (
    <Box 
      position="fixed" 
      top="0" 
      left="0" 
      right="0" 
      bottom="0" 
      bg="rgba(0,0,0,0.3)" 
      zIndex={1999} 
      display="flex" 
      alignItems="center" 
      justifyContent="center" 
      onClick={closeOverlay}
    >
      {/* Absolute centered input container */}
      <Box 
        position="absolute"
        top="44%"
        left="50%"
        transform="translate(-50%, -50%)"
        width="600px" 
        maxWidth="90vw" 
        borderRadius="lg" 
        boxShadow="0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" 
        bg={bgColor} 
        onClick={e => e.stopPropagation()}
      >
        {/* Input container */}
        <Box borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" position="relative">
          <Flex align="center" p={3} minH="47px">
            <Icon as={Search} size={18} color="blue.400" mr={3} />
            <InputGroup flex="1">
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type client name..."
                variant="unstyled"
                fontSize="md"
                autoFocus
                pr="60px"
                height="41px"
              />
              <InputRightElement width="60px" height="100%" display="flex" alignItems="center" justifyContent="center">
                <IconButton
                  aria-label="Toggle year"
                  icon={<Flex align="center">{selectedYear} <ChevronDown size={14} style={{ marginLeft: 4 }} /></Flex>}
                  onClick={toggleYear}
                  size="sm"
                  variant="ghost"
                  colorScheme="blue"
                  fontWeight="bold"
                  fontSize="sm"
                  borderRadius="md"
                />
              </InputRightElement>
            </InputGroup>
          </Flex>
        </Box>
      </Box>
      {/* Dropdown container, positioned below input */}
      {(isLoading || results.length > 0 || searchValue) && (
        <Box 
          position="absolute"
          top="calc(44% + 35px)"
          left="50%"
          transform="translate(-50%, 0)"
          width="600px"
          maxWidth="90vw"
          bg={bgColor} 
          borderRadius="md" 
          boxShadow={`0 4px 12px ${shadowColor}`} 
          overflow="hidden" 
          mt={1} 
          maxH="300px" 
          overflowY="auto"
          onClick={e => e.stopPropagation()}
        >
          {isLoading ? (
            <Flex justify="center" align="center" py={6}>
              <Text color="gray.500" fontSize="sm">Searching...</Text>
            </Flex>
          ) : results.length > 0 ? (
            <VStack spacing={0} align="stretch" p={2}>
              {results.map((row, idx) => {
                const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
                const clientNameField = clientNameFields.find(field => row[field] !== undefined);
                const clientName = clientNameField ? row[clientNameField] : `Client ${idx + 1}`;
                const group = row['Group'] || 'No Group';
                return (
                  <Box
                    key={idx}
                    bg={cardBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={borderColor}
                    p={3}
                    _hover={{ borderColor: 'blue.300', transform: 'translateY(-1px)', boxShadow: 'sm' }}
                    transition="all 0.15s ease"
                  >
                    <Flex justify="space-between" align="center" gap={3}>
                      <VStack align="start" spacing={1} flex="1" minW="0">
                        <Flex align="center" gap={2} flexWrap="wrap">
                          <Text fontWeight="medium" fontSize="sm" color={useColorModeValue('gray.800', 'white')} noOfLines={1}>{clientName}</Text>
                          <Badge colorScheme="purple" borderRadius="sm" px={2} py={0} fontSize="10px" textTransform="none">{group}</Badge>
                        </Flex>
                        {row['Address'] && (<Text fontSize="xs" color="gray.500" noOfLines={1}>{row['Address']}</Text>)}
                        {row['IRD No.'] && (<Text fontSize="10px" color="gray.400">IRD: {row['IRD No.']}</Text>)}
                      </VStack>
                      <HStack spacing={2}>
                        <Button 
                          leftIcon={<Icon as={User} boxSize="3" />} 
                          colorScheme="gray" 
                          variant="outline" 
                          size="xs" 
                          fontSize="11px" 
                          px={2} 
                          onClick={() => handleClientAction(row)} 
                          _hover={{ bg: useColorModeValue('gray.50', 'gray.600'), transform: 'translateY(-1px)' }} 
                          transition="all 0.15s" 
                          isDisabled={!row['Client Link']}
                        >
                          Client
                        </Button>
                        <Button 
                          leftIcon={<Icon as={Briefcase} boxSize="3" />} 
                          colorScheme="blue" 
                          size="xs" 
                          fontSize="11px" 
                          px={2} 
                          onClick={() => handleJobAction(row)} 
                          _hover={{ transform: 'translateY(-1px)', boxShadow: 'sm' }} 
                          transition="all 0.15s" 
                          isDisabled={!row[`${selectedYear} Job Link`]}
                        >
                          {selectedYear}
                        </Button>
                      </HStack>
                    </Flex>
                  </Box>
                );
              })}
            </VStack>
          ) : searchValue ? (
            <Box textAlign="center" py={6}>
              <Text color="gray.500" fontSize="sm">No clients found</Text>
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}; 