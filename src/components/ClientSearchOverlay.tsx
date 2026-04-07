import React, { useEffect, useState, useRef } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import {
  Box,
  Input,
  IconButton,
  VStack,
  Button,
  HStack,
  Text,
  Flex,
  Icon,
} from '@chakra-ui/react';
import { ChevronDown, Search, User, Briefcase } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  CLIENT_DB_FY_YEARS,
  getAddress,
  getClientLink,
  getClientName,
  getIrdNumber,
  getJobLink,
  type ClientDbRow,
} from '../services/clientDatabaseCsv';
import { docuFramePalette } from '../docuFrameColors';

interface ClientSearchOverlayProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const ClientSearchOverlay: React.FC<ClientSearchOverlayProps> = ({ isOpen: externalIsOpen, onClose: externalOnClose }) => {
  const { setStatus } = useAppContext();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnClose ? (value: boolean) => {
    if (value === false && externalOnClose) {
      externalOnClose();
    }
    setInternalIsOpen(value);
  } : setInternalIsOpen;
  const [searchValue, setSearchValue] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(CLIENT_DB_FY_YEARS[CLIENT_DB_FY_YEARS.length - 1]);
  const [results, setResults] = useState<ClientDbRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bgColor = useColorModeValue(docuFramePalette.light.toolbar, docuFramePalette.dark.canvas);
  const cardBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderColor = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');
  const clientNameColor = useColorModeValue('gray.800', 'white');
  const rowHoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const cardHoverBorder = useColorModeValue(docuFramePalette.light.rowSelected, docuFramePalette.dark.border);
  const buttonHoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.chromeHover);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchValue('');
        setResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Clear search when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setSearchValue('');
      setResults([]);
    }
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
      const filtered = (rows as ClientDbRow[])
        .filter((row) => {
          const name = getClientName(row);
          if (!name) return false;
          return name.toLowerCase().includes(value.toLowerCase());
        })
        .slice(0, 3);
      setResults(filtered);
    } catch (error) {
      setStatus('Client search failed', 'error');
      setResults([]);
    }
    setIsLoading(false);
  };

  const handleClientAction = (row: ClientDbRow) => {
    const clientLink = getClientLink(row);
    if (clientLink) window.open(clientLink, '_blank');
    else setStatus('No client link available', 'error');
  };

  const handleJobAction = (row: ClientDbRow) => {
    const jobLink = getJobLink(row, selectedYear);
    if (jobLink) window.open(jobLink, '_blank');
    else setStatus(`No FY${selectedYear} job link available`, 'error');
  };

  const toggleYear = () => {
    const idx = CLIENT_DB_FY_YEARS.indexOf(selectedYear as (typeof CLIENT_DB_FY_YEARS)[number]);
    const i = idx >= 0 ? idx : 0;
    const next = (i + 1) % CLIENT_DB_FY_YEARS.length;
    setSelectedYear(CLIENT_DB_FY_YEARS[next]);
  };
  const closeOverlay = () => { setIsOpen(false); setSearchValue(''); setResults([]); };

  if (!isOpen) return null;

  return (
    <Box 
      position="fixed" 
      top="0" 
      left="0" 
      right="0" 
      bottom="0" 
      bg="blackAlpha.600" 
      backdropFilter="blur(4px)"
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
            <Icon fontSize="lg" color="blue.400" mr={3} asChild><Search /></Icon>
            <Box position="relative" flex="1">
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type client name..."
                variant="flushed"
                border="none"
                _focus={{ border: "none", boxShadow: "none" }}
                fontSize="md"
                autoFocus
                pr="60px"
                h="41px"
              />
              <Flex
                position="absolute"
                right={0}
                top="50%"
                transform="translateY(-50%)"
                w="60px"
                h="100%"
                align="center"
                justify="center"
              >
                <IconButton
                  aria-label="Toggle year"
                  onClick={toggleYear}
                  size="sm"
                  variant="ghost"
                  colorPalette="blue"
                  fontWeight="bold"
                  fontSize="sm"
                  borderRadius="md"><Flex align="center">{selectedYear} <ChevronDown size={14} style={{ marginLeft: 4 }} /></Flex></IconButton>
              </Flex>
            </Box>
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
            <VStack gap={0} align="stretch" p={2}>
              {results.map((row, idx) => {
                const displayName = getClientName(row) || `Client ${idx + 1}`;
                const address = getAddress(row);
                const ird = getIrdNumber(row);
                return (
                  <Box
                    key={idx}
                    bg={cardBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={borderColor}
                    p={3}
                    _hover={{ borderColor: cardHoverBorder, bg: rowHoverBg, transform: 'translateY(-1px)', boxShadow: 'sm' }}
                    transition="all 0.15s ease"
                  >
                    <Flex justify="space-between" align="center" gap={3}>
                      <VStack align="start" gap={1} flex="1" minW="0">
                        <Text fontWeight="medium" fontSize="sm" color={clientNameColor} lineClamp={1}>{displayName}</Text>
                        {address ? <Text fontSize="xs" color="gray.500" lineClamp={1}>{address}</Text> : null}
                        {ird ? <Text fontSize="10px" color="gray.400">IRD: {ird}</Text> : null}
                      </VStack>
                      <HStack gap={2}>
                        <Button
                          colorPalette="gray"
                          variant="outline"
                          size="xs"
                          fontSize="11px"
                          px={2}
                          onClick={() => handleClientAction(row)}
                          _hover={{ bg: buttonHoverBg, transform: 'translateY(-1px)' }}
                          transition="all 0.15s"
                          disabled={!getClientLink(row)}><Icon boxSize="3" asChild><User /></Icon>Client
                                                  </Button>
                        <Button
                          colorPalette="blue"
                          size="xs"
                          fontSize="11px"
                          px={2}
                          onClick={() => handleJobAction(row)}
                          _hover={{ transform: 'translateY(-1px)', boxShadow: 'sm' }}
                          transition="all 0.15s"
                          disabled={!getJobLink(row, selectedYear)}><Icon boxSize="3" asChild><Briefcase /></Icon>{selectedYear}</Button>
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