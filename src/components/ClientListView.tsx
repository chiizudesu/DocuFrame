import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Flex, Text, Icon, Input } from '@chakra-ui/react';
import { Search, Folder, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { GridBackdrop } from './GridBackdrop';
import {
  findClientRow,
  getIrdNumber,
  type ClientDbRow,
} from '../services/clientDatabaseCsv';

interface ClientEntry {
  name: string;
  path: string;
  folderCount: number;
  fileCount: number;
  modified: string;
  irdNumber: string | null;
}

// Deterministic avatar color from name
const AVATAR_COLORS = [
  '#2C5282', '#2B6CB0', '#2C7A7B', '#276749', '#744210',
  '#9B2C2C', '#702459', '#553C9A', '#2D3748', '#1A365D',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

export const ClientListView: React.FC = () => {
  const { currentDirectory, setCurrentDirectory } = useAppContext();
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [csvRows, setCsvRows] = useState<ClientDbRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Load CSV client database for IR# lookup
  useEffect(() => {
    let mounted = true;
    const loadCsv = async () => {
      try {
        const config = await window.electronAPI.getConfig();
        const csvPath = (config as any).clientbasePath;
        if (!csvPath) return;
        const rows = await window.electronAPI.readCsv(csvPath);
        if (mounted && rows) setCsvRows(rows as ClientDbRow[]);
      } catch {}
    };
    loadCsv();
    return () => { mounted = false; };
  }, []);

  // Load directory contents
  useEffect(() => {
    if (!currentDirectory) return;
    let mounted = true;
    setLoading(true);
    const load = async () => {
      try {
        const entries = await window.electronAPI.getDirectoryContents(currentDirectory);
        const items = Array.isArray(entries) ? entries : [];
        const folders = items.filter((item: any) => item?.type === 'folder' && typeof item?.name === 'string' && !item.name.startsWith('.'));
        folders.sort((a: any, b: any) => a.name.localeCompare(b.name));

        // For each client folder, get subfolder info
        const clientEntries: ClientEntry[] = await Promise.all(
          folders.map(async (folder: any) => {
            let folderCount = 0;
            let fileCount = 0;
            let modified = folder.modified || '';
            try {
              const subEntries = await window.electronAPI.getDirectoryContents(folder.path);
              if (Array.isArray(subEntries)) {
                folderCount = subEntries.filter((s: any) => s?.type === 'folder').length;
                fileCount = subEntries.filter((s: any) => s?.type !== 'folder').length;
              }
            } catch {}

            // Look up IR# from CSV
            let irdNumber: string | null = null;
            if (csvRows) {
              const match = findClientRow(csvRows, folder.name);
              if (match) irdNumber = getIrdNumber(match) || null;
            }

            return { name: folder.name, path: folder.path, folderCount, fileCount, modified, irdNumber };
          })
        );

        if (mounted) {
          setClients(clientEntries);
          setLoading(false);
        }
      } catch {
        if (mounted) { setClients([]); setLoading(false); }
      }
    };
    load();
    return () => { mounted = false; };
  }, [currentDirectory, csvRows]);

  const filtered = useMemo(() => {
    if (!searchFilter.trim()) return clients;
    const q = searchFilter.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q) || c.irdNumber?.includes(q));
  }, [clients, searchFilter]);

  // Group by first letter
  const grouped = useMemo(() => {
    const groups: Record<string, ClientEntry[]> = {};
    for (const client of filtered) {
      const letter = client.name[0]?.toUpperCase() || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(client);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const bg = useColorModeValue('#f8fafc', '#171923');
  const cardBg = useColorModeValue('#ffffff', '#1c2233');
  const cardHoverBg = useColorModeValue('#f1f5f9', '#242d42');
  const cardBorder = useColorModeValue('#e2e8f0', '#2a3347');
  const textColor = useColorModeValue('#1a202c', '#e2e8f0');
  const subtextColor = useColorModeValue('#64748b', '#7a8699');
  const sectionColor = useColorModeValue('#94a3b8', '#566478');
  const searchBg = useColorModeValue('#ffffff', '#1c2233');
  const searchBorder = useColorModeValue('#e2e8f0', '#2a3347');
  const irdColor = useColorModeValue('#64748b', '#566478');

  return (
    <Box h="100%" bg={bg} position="relative" overflow="hidden">
      <GridBackdrop />
      <Box h="100%" overflow="auto" position="relative" zIndex={1} px={5} py={4}>
      {/* Search */}
      <Flex align="center" mb={4} gap={2}>
        <Flex
          align="center"
          flex={1}
          maxW="400px"
          bg={searchBg}
          border="1px solid"
          borderColor={searchBorder}
          borderRadius="4px"
          px={3}
          h="34px"
        >
          <Icon boxSize="14px" color={subtextColor} mr={2} asChild>
            <Search />
          </Icon>
          <Input
            placeholder="Search clients..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            border="none"
            bg="transparent"
            h="32px"
            px={0}
            fontSize="13px"
            color={textColor}
            _placeholder={{ color: subtextColor }}
            _focus={{ outline: 'none', boxShadow: 'none' }}
            _focusVisible={{ outline: 'none', boxShadow: 'none' }}
          />
        </Flex>
        <Text fontSize="12px" color={subtextColor}>
          {clients.length} client{clients.length !== 1 ? 's' : ''}
        </Text>
      </Flex>

      {/* Client list */}
      {loading ? (
        <Flex justify="center" align="center" py={12} opacity={0.5}>
          <Text fontSize="sm" color={subtextColor}>Loading clients...</Text>
        </Flex>
      ) : filtered.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={12} gap={3} opacity={0.45}>
          <Icon boxSize="32px" color={subtextColor} asChild>
            <Users />
          </Icon>
          <Text fontSize="sm" color={subtextColor} fontWeight="medium">
            {searchFilter.trim() ? `No clients match "${searchFilter}"` : 'No clients found'}
          </Text>
          <Text fontSize="xs" color={subtextColor}>
            {searchFilter.trim() ? 'Try a different search term' : 'Add client folders to get started'}
          </Text>
        </Flex>
      ) : (
        <Box>
          {grouped.map(([letter, groupClients]) => (
            <Box key={letter} mb={1}>
              {/* Section letter */}
              <Text
                fontSize="11px"
                fontWeight="700"
                color={sectionColor}
                letterSpacing="0.06em"
                textTransform="uppercase"
                pl="6px"
                pb="4px"
                pt="8px"
                userSelect="none"
              >
                {letter}
              </Text>
              {/* Client rows */}
              {groupClients.map((client) => (
                <Flex
                  key={client.path}
                  align="center"
                  gap={3}
                  px={3}
                  py={2}
                  mx={0}
                  borderRadius="4px"
                  cursor="pointer"
                  bg="transparent"
                  _hover={{ bg: cardHoverBg }}
                  transition="background 0.15s ease"
                  onClick={() => setCurrentDirectory(client.path)}
                  userSelect="none"
                >
                  {/* Avatar */}
                  <Flex
                    flexShrink={0}
                    w="32px"
                    h="32px"
                    borderRadius="5px"
                    bg={getAvatarColor(client.name)}
                    color="white"
                    fontSize="12px"
                    fontWeight="700"
                    align="center"
                    justify="center"
                    letterSpacing="0.02em"
                    style={{ fontFamily: "'Rajdhani', sans-serif" }}
                  >
                    {getInitials(client.name)}
                  </Flex>

                  {/* Name + meta */}
                  <Flex direction="column" flex={1} minW={0} gap={0}>
                    <Text
                      fontSize="13px"
                      fontWeight="500"
                      color={textColor}
                      lineClamp={1}
                      minW={0}
                    >
                      {client.name}
                    </Text>
                    <Text fontSize="11px" color={subtextColor} lineClamp={1}>
                      {client.folderCount} folder{client.folderCount !== 1 ? 's' : ''}
                      {client.fileCount > 0 && ` · ${client.fileCount} file${client.fileCount !== 1 ? 's' : ''}`}
                      {client.modified && ` · ${formatDate(client.modified)}`}
                    </Text>
                  </Flex>

                  {/* IR# */}
                  {client.irdNumber && (
                    <Text fontSize="11px" color={irdColor} fontWeight="500" flexShrink={0} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                      {client.irdNumber}
                    </Text>
                  )}
                </Flex>
              ))}
            </Box>
          ))}
        </Box>
      )}
      </Box>
    </Box>
  );
};
