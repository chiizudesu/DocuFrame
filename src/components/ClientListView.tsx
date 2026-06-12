import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Flex, Text, Icon, Input } from '@chakra-ui/react';
import { Search, Folder, Users, ExternalLink, Star, Link2, Terminal, RefreshCw, Info, UserPlus, Trash2, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { GridBackdrop } from './GridBackdrop';
import { FloatingMenu, MenuRow, MenuSeparator } from './FileGrid/menuPrimitives';
import { joinPath } from '../utils/path';
import { isDragAccepted, readDragPayload, clearInternalDrag, partitionDropPaths } from '../utils/dragDrop';
import {
  findClientRow,
  getClientName,
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

const ACCENT = '#3b82f6';
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

/**
 * Self-contained alphabet rail: owns the active-letter tracking so scroll
 * events never re-render the client list itself. The scroll listener is
 * passive and rAF-throttled (one offset sweep per frame at most).
 */
const AlphabetRail = React.memo(function AlphabetRail({
  letters,
  presentLetters,
  orderedPresent,
  scrollRef,
  sectionRefs,
}: {
  letters: string[];
  presentLetters: Set<string>;
  /** Present letters in document order (same order as the rendered sections) */
  orderedPresent: string[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  sectionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const railBg = useColorModeValue('rgba(248,250,252,0.92)', 'rgba(23,25,35,0.9)');
  const railBorder = useColorModeValue('#e2e8f0', '#2a3347');
  const railLetterColor = useColorModeValue('#64748b', '#8b97ab');

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const probe = container.scrollTop + 80;
      let current: string | null = null;
      // Sections appear in document order, so offsetTop is ascending — bail early
      for (const letter of orderedPresent) {
        const el = sectionRefs.current[letter];
        if (!el) continue;
        if (el.offsetTop <= probe) current = letter;
        else break;
      }
      setActiveLetter(current ?? orderedPresent[0] ?? null);
    };
    compute();
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [orderedPresent, scrollRef, sectionRefs]);

  const scrollToLetter = useCallback((letter: string) => {
    const el = sectionRefs.current[letter];
    const container = scrollRef.current;
    if (el && container) {
      container.scrollTo({ top: Math.max(0, el.offsetTop - 8), behavior: 'smooth' });
    }
  }, [scrollRef, sectionRefs]);

  return (
    <Flex
      position="absolute"
      right="5px"
      top="50%"
      transform="translateY(-50%)"
      direction="column"
      align="center"
      zIndex={5}
      gap="0px"
      py="6px"
      px="2px"
      borderRadius="full"
      bg={railBg}
      border="1px solid"
      borderColor={railBorder}
      userSelect="none"
    >
      {letters.map((letter) => {
        const present = presentLetters.has(letter);
        const isActive = activeLetter === letter;
        return (
          <Flex
            key={letter}
            w="18px"
            h="15.5px"
            align="center"
            justify="center"
            borderRadius="4px"
            cursor={present ? 'pointer' : 'default'}
            bg={isActive ? ACCENT : 'transparent'}
            color={isActive ? 'white' : present ? railLetterColor : undefined}
            opacity={present || isActive ? 1 : 0.22}
            fontSize="9px"
            fontWeight="700"
            lineHeight="1"
            transition="color 0.12s ease, background 0.12s ease, transform 0.12s ease"
            _hover={present && !isActive ? { color: ACCENT, transform: 'scale(1.25)' } : undefined}
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
            onClick={() => { if (present) scrollToLetter(letter); }}
          >
            {letter}
          </Flex>
        );
      })}
    </Flex>
  );
});

/**
 * "New client" button + typeahead panel. Memoized and self-contained: typing
 * and hover-highlighting are local state here, so they re-render only this
 * panel's handful of rows — never the client list behind it.
 */
const NewClientPanel = React.memo(function NewClientPanel({
  isOpen,
  setOpen,
  csvRows,
  existingNameKeys,
  creating,
  onCreate,
}: {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  csvRows: ClientDbRow[] | null;
  existingNameKeys: Set<string>;
  creating: boolean;
  onCreate: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cardBg = useColorModeValue('#ffffff', '#1c2233');
  const cardBorder = useColorModeValue('#e2e8f0', '#2a3347');
  const cardHoverBg = useColorModeValue('#f1f5f9', '#242d42');
  const textColor = useColorModeValue('#1a202c', '#e2e8f0');
  const subtextColor = useColorModeValue('#64748b', '#7a8699');
  const sectionColor = useColorModeValue('#94a3b8', '#566478');
  const irdColor = useColorModeValue('#64748b', '#566478');
  const panelShadow = useColorModeValue('0 14px 40px rgba(15, 23, 42, 0.16)', '0 14px 40px rgba(0, 0, 0, 0.5)');

  // Reset + focus whenever the panel opens
  useEffect(() => {
    if (!isOpen) return;
    setValue('');
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, setOpen]);

  const suggestions = useMemo(() => {
    if (!isOpen || !csvRows) return [];
    const q = value.trim().toLowerCase();
    const seen = new Set<string>();
    const out: { name: string; ird: string | null }[] = [];
    for (const row of csvRows) {
      const name = getClientName(row);
      if (!name) continue;
      const key = normalizeName(name);
      if (seen.has(key) || existingNameKeys.has(key)) continue;
      if (q && !name.toLowerCase().includes(q)) continue;
      seen.add(key);
      out.push({ name, ird: getIrdNumber(row) });
      if (out.length >= 8) break;
    }
    return out;
  }, [isOpen, csvRows, value, existingNameKeys]);

  const customName = value.trim();
  const showCustomOption =
    customName.length > 0 &&
    !existingNameKeys.has(normalizeName(customName)) &&
    !suggestions.some(s => normalizeName(s.name) === normalizeName(customName));
  const options = useMemo(
    () => [
      ...suggestions.map(s => ({ kind: 'db' as const, name: s.name, ird: s.ird })),
      ...(showCustomOption ? [{ kind: 'custom' as const, name: customName, ird: null }] : []),
    ],
    [suggestions, showCustomOption, customName]
  );

  useEffect(() => { setHighlight(0); }, [value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, Math.max(0, options.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = options[highlight] ?? options[0];
      if (option) onCreate(option.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }, [options, highlight, onCreate, setOpen]);

  return (
    <Box position="relative" ml="auto" ref={wrapRef}>
      <Flex
        as="button"
        align="center"
        gap={2}
        h="34px"
        px="14px"
        borderRadius="6px"
        bg={ACCENT}
        color="white"
        fontSize="13px"
        fontWeight="600"
        cursor="pointer"
        userSelect="none"
        transition="background 0.15s ease, transform 0.15s ease"
        _hover={{ bg: '#2f6fd8' }}
        _active={{ transform: 'scale(0.97)' }}
        onClick={() => setOpen(!isOpen)}
      >
        <UserPlus size={15} />
        New client
      </Flex>

      {isOpen && (
        <Box
          position="absolute"
          top="40px"
          right={0}
          w="340px"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="10px"
          boxShadow={panelShadow}
          zIndex={20}
          overflow="hidden"
        >
          <Box px={3} pt={3} pb={2}>
            <Text
              fontSize="10px"
              fontWeight="700"
              letterSpacing="0.08em"
              textTransform="uppercase"
              color={sectionColor}
              mb={2}
              userSelect="none"
            >
              Add new client
            </Text>
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Client name…"
              h="32px"
              fontSize="13px"
              color={textColor}
              bg={cardBg}
              borderColor={cardBorder}
              _placeholder={{ color: subtextColor }}
              _focus={{ outline: 'none', boxShadow: `0 0 0 1px ${ACCENT}`, borderColor: ACCENT }}
              _focusVisible={{ outline: 'none', boxShadow: `0 0 0 1px ${ACCENT}`, borderColor: ACCENT }}
            />
          </Box>
          <Box maxH="264px" overflowY="auto" pb={2} className="enhanced-scrollbar">
            {options.length === 0 && (
              <Text px={3} py={2} fontSize="12px" color={subtextColor}>
                {csvRows ? 'Type a client name…' : 'Type a name to create a client folder'}
              </Text>
            )}
            {options.map((option, i) => (
              <Flex
                key={`${option.kind}:${option.name}`}
                position="relative"
                align="center"
                gap={2.5}
                mx={2}
                px="10px"
                py="6px"
                borderRadius="6px"
                cursor="pointer"
                bg={i === highlight ? cardHoverBg : 'transparent'}
                opacity={creating ? 0.6 : 1}
                transition="background 0.12s ease"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => onCreate(option.name)}
              >
                {/* Active-item indicator: centered pill, springs in on highlight */}
                <Box
                  position="absolute"
                  left="2px"
                  top="50%"
                  w="3px"
                  h="16px"
                  borderRadius="full"
                  bg={ACCENT}
                  boxShadow={`0 0 6px ${ACCENT}80`}
                  opacity={i === highlight ? 1 : 0}
                  transform={i === highlight ? 'translateY(-50%) scaleY(1)' : 'translateY(-50%) scaleY(0.25)'}
                  transition="opacity 0.1s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)"
                  pointerEvents="none"
                />
                {option.kind === 'db' ? (
                  <Flex
                    flexShrink={0}
                    w="22px"
                    h="22px"
                    borderRadius="4px"
                    bg={getAvatarColor(option.name)}
                    color="white"
                    fontSize="9px"
                    fontWeight="700"
                    align="center"
                    justify="center"
                    style={{ fontFamily: "'Rajdhani', sans-serif" }}
                  >
                    {getInitials(option.name)}
                  </Flex>
                ) : (
                  <Flex
                    flexShrink={0}
                    w="22px"
                    h="22px"
                    borderRadius="4px"
                    border="1.5px dashed"
                    borderColor={ACCENT}
                    color={ACCENT}
                    align="center"
                    justify="center"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                  </Flex>
                )}
                <Flex direction="column" flex={1} minW={0}>
                  <Text fontSize="12.5px" fontWeight="500" color={option.kind === 'custom' ? ACCENT : textColor} lineClamp={1}>
                    {option.kind === 'custom' ? `Create "${option.name}"` : option.name}
                  </Text>
                  {option.kind === 'custom' && (
                    <Text fontSize="10.5px" color={subtextColor}>Not in client database</Text>
                  )}
                </Flex>
                {option.ird && (
                  <Text fontSize="10.5px" color={irdColor} flexShrink={0} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                    {option.ird}
                  </Text>
                )}
              </Flex>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
});

export const ClientListView: React.FC = () => {
  const {
    currentDirectory,
    setCurrentDirectory,
    setStatus,
    addLog,
    addTabToCurrentWindow,
    quickAccessPaths,
    addQuickAccessPath,
    removeQuickAccessPath,
  } = useAppContext();
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [csvRows, setCsvRows] = useState<ClientDbRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [rowMenu, setRowMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; client: ClientEntry | null }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    client: null,
  });
  const [blankMenu, setBlankMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  const closeRowMenu = useCallback(() => setRowMenu((m) => ({ ...m, isOpen: false })), []);
  const closeBlankMenu = useCallback(() => setBlankMenu((m) => ({ ...m, isOpen: false })), []);

  // Drag-and-drop onto client rows
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // "New client" typeahead panel
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Alphabet rail + flash-highlight of a freshly created client
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashPath, setFlashPath] = useState<string | null>(null);
  const pendingFlashName = useRef<string | null>(null);

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
  }, [currentDirectory, csvRows, reloadKey]);

  // After a new client is created, scroll to it and flash the row
  useEffect(() => {
    const name = pendingFlashName.current;
    if (!name) return;
    const target = clients.find(c => c.name === name);
    if (!target) return;
    pendingFlashName.current = null;
    setFlashPath(target.path);
    requestAnimationFrame(() => {
      rowRefs.current[target.path]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    const t = setTimeout(() => setFlashPath(null), 2400);
    return () => clearTimeout(t);
  }, [clients]);

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

  // ── Alphabet rail ───────────────────────────────────────────────────────────
  const presentLetters = useMemo(() => new Set(grouped.map(([l]) => l)), [grouped]);
  const orderedPresent = useMemo(() => grouped.map(([l]) => l), [grouped]);
  const railLetters = useMemo(() => {
    const extras = orderedPresent.filter(l => !AZ.includes(l));
    return [...extras, ...AZ];
  }, [orderedPresent]);

  // ── New client creation ─────────────────────────────────────────────────────
  const existingNameKeys = useMemo(() => new Set(clients.map(c => normalizeName(c.name))), [clients]);

  const openAddPanel = useCallback(() => setAddOpen(true), []);

  const createClient = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setStatus('Client name contains invalid characters', 'error');
      return;
    }
    if (clients.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setStatus(`"${trimmed}" already exists`, 'error');
      return;
    }
    setCreating(true);
    try {
      await window.electronAPI.createDirectory(joinPath(currentDirectory, trimmed));
      addLog(`Created client folder: ${trimmed}`);
      setStatus(`Created client "${trimmed}"`, 'success');
      pendingFlashName.current = trimmed;
      setAddOpen(false);
      setSearchFilter('');
      setReloadKey(k => k + 1);
    } catch (error) {
      addLog(`Failed to create client folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create client folder', 'error');
    } finally {
      setCreating(false);
    }
  }, [creating, clients, currentDirectory, addLog, setStatus]);

  // ── Delete client folder ────────────────────────────────────────────────────
  const deleteClient = useCallback(async (client: ClientEntry) => {
    try {
      const confirmed = await (window.electronAPI as any).confirmDelete([client.name]);
      if (!confirmed) return;
      await window.electronAPI.deleteItem(client.path);
      addLog(`Deleted client folder: ${client.name}`);
      setStatus(`Deleted "${client.name}"`, 'success');
      setReloadKey(k => k + 1);
    } catch (error) {
      addLog(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus(`Failed to delete ${client.name}`, 'error');
    }
  }, [addLog, setStatus]);

  // ── Drop onto a client row ──────────────────────────────────────────────────
  const handleDropOnClient = useCallback(async (e: React.DragEvent, client: ClientEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetPath(null);
    const { paths, isInternal } = readDragPayload(e);
    clearInternalDrag();
    if (paths.length === 0) return;

    const { movable, droppedSelf, allAlreadyInTarget } = partitionDropPaths(paths, client.path);
    if (movable.length === 0) {
      if (droppedSelf) setStatus("Can't move a folder into itself", 'error');
      return;
    }
    if (allAlreadyInTarget) {
      setStatus(`Items are already in ${client.name}`, 'info');
      return;
    }

    const copy = !isInternal || e.ctrlKey;
    try {
      const results = copy
        ? await window.electronAPI.copyFilesWithConflictResolution(movable, client.path)
        : await window.electronAPI.moveFilesWithConflictResolution(movable, client.path);
      const ok = results.filter((r: any) => r.status === 'success').length;
      const failed = results.filter((r: any) => r.status === 'error').length;
      let message = `${copy ? 'Copied' : 'Moved'} ${ok} item${ok !== 1 ? 's' : ''} to ${client.name}`;
      if (failed > 0) message += `, ${failed} failed`;
      addLog(message, failed > 0 ? 'error' : undefined);
      setStatus(message, failed > 0 ? 'error' : 'success');
      setReloadKey(k => k + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`${copy ? 'Copy' : 'Move'} to ${client.name} failed: ${msg}`, 'error');
      setStatus(`${copy ? 'Copy' : 'Move'} failed`, 'error');
    }
  }, [addLog, setStatus]);

  const bg = useColorModeValue('#f8fafc', '#171923');
  const cardHoverBg = useColorModeValue('#f1f5f9', '#242d42');
  const textColor = useColorModeValue('#1a202c', '#e2e8f0');
  const subtextColor = useColorModeValue('#64748b', '#7a8699');
  const sectionColor = useColorModeValue('#94a3b8', '#566478');
  const searchBg = useColorModeValue('#ffffff', '#1c2233');
  const searchBorder = useColorModeValue('#e2e8f0', '#2a3347');
  const irdColor = useColorModeValue('#64748b', '#566478');
  const dropBg = useColorModeValue('rgba(59,130,246,0.08)', 'rgba(59,130,246,0.16)');
  const flashBg = useColorModeValue('rgba(59,130,246,0.12)', 'rgba(59,130,246,0.22)');

  return (
    <Box h="100%" bg={bg} position="relative" overflow="hidden">
      <GridBackdrop />
      <Box
        ref={scrollRef}
        h="100%"
        overflow="auto"
        position="relative"
        zIndex={1}
        pl={5}
        pr="44px"
        py={4}
        onContextMenu={(e) => {
          e.preventDefault();
          setRowMenu((m) => ({ ...m, isOpen: false }));
          setBlankMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } });
        }}
      >
      {/* Search + New client */}
      <Flex align="center" mb={4} gap={3}>
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

        {/* New client button + typeahead panel */}
        <NewClientPanel
          isOpen={addOpen}
          setOpen={setAddOpen}
          csvRows={csvRows}
          existingNameKeys={existingNameKeys}
          creating={creating}
          onCreate={createClient}
        />
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
            {searchFilter.trim() ? 'Try a different search term' : 'Use "New client" to add your first client folder'}
          </Text>
        </Flex>
      ) : (
        <Box>
          {grouped.map(([letter, groupClients]) => (
            <Box key={letter} mb={1} ref={(el: HTMLDivElement | null) => { sectionRefs.current[letter] = el; }}>
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
              {groupClients.map((client) => {
                const isDropTarget = dropTargetPath === client.path;
                const isFlashing = flashPath === client.path;
                return (
                <Flex
                  key={client.path}
                  ref={(el: HTMLDivElement | null) => { rowRefs.current[client.path] = el; }}
                  align="center"
                  gap={3}
                  px={3}
                  py={2}
                  mx={0}
                  borderRadius="4px"
                  cursor="pointer"
                  bg={isDropTarget ? dropBg : isFlashing ? flashBg : 'transparent'}
                  boxShadow={isDropTarget ? `inset 0 0 0 1.5px ${ACCENT}` : undefined}
                  _hover={{ bg: isDropTarget ? dropBg : cardHoverBg }}
                  transition="background 0.15s ease, box-shadow 0.15s ease"
                  onClick={() => setCurrentDirectory(client.path)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBlankMenu((m) => ({ ...m, isOpen: false }));
                    setRowMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, client });
                  }}
                  onDragOver={(e) => {
                    if (!isDragAccepted(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const internal = e.dataTransfer.types.includes('application/x-docuframe-files') || !!(window as any).__docuframeInternalDrag;
                    e.dataTransfer.dropEffect = internal ? (e.ctrlKey ? 'copy' : 'move') : 'copy';
                    setDropTargetPath(client.path);
                  }}
                  onDragLeave={() => setDropTargetPath(p => (p === client.path ? null : p))}
                  onDrop={(e) => void handleDropOnClient(e, client)}
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
                );
              })}
            </Box>
          ))}
        </Box>
      )}
      </Box>

      {/* Alphabet rail */}
      {!loading && grouped.length > 0 && (
        <AlphabetRail
          letters={railLetters}
          presentLetters={presentLetters}
          orderedPresent={orderedPresent}
          scrollRef={scrollRef}
          sectionRefs={sectionRefs}
        />
      )}

      {/* Client row context menu */}
      <FloatingMenu isOpen={rowMenu.isOpen && !!rowMenu.client} position={rowMenu.position} onClose={closeRowMenu}>
        {rowMenu.client && (
          <>
            <MenuRow
              icon={<Folder size={14} />}
              label="Open"
              emphasized
              onClick={() => {
                const client = rowMenu.client!;
                closeRowMenu();
                setCurrentDirectory(client.path);
              }}
            />
            <MenuRow
              icon={<ExternalLink size={14} />}
              label="Open in new tab"
              onClick={() => {
                const client = rowMenu.client!;
                closeRowMenu();
                addTabToCurrentWindow(client.path);
                setStatus(`Opened new tab for ${client.name}`, 'info');
              }}
            />
            {quickAccessPaths.includes(rowMenu.client.path) ? (
              <MenuRow
                icon={<Star size={14} />}
                label="Unpin from Quick Access"
                onClick={() => {
                  const client = rowMenu.client!;
                  closeRowMenu();
                  void removeQuickAccessPath(client.path);
                }}
              />
            ) : (
              <MenuRow
                icon={<Star size={14} />}
                label="Pin to Quick Access"
                onClick={() => {
                  const client = rowMenu.client!;
                  closeRowMenu();
                  void addQuickAccessPath(client.path);
                }}
              />
            )}
            <MenuSeparator />
            <MenuRow
              icon={<Link2 size={14} />}
              label="Copy Path"
              onClick={() => {
                const client = rowMenu.client!;
                closeRowMenu();
                void navigator.clipboard.writeText(client.path);
                setStatus(`Copied path: ${client.path}`, 'info');
              }}
            />
            {rowMenu.client.irdNumber && (
              <MenuRow
                icon={<Info size={14} />}
                label={`Copy IRD ${rowMenu.client.irdNumber}`}
                onClick={() => {
                  const client = rowMenu.client!;
                  closeRowMenu();
                  void navigator.clipboard.writeText(client.irdNumber || '');
                  setStatus(`Copied IRD number for ${client.name}`, 'info');
                }}
              />
            )}
            <MenuRow
              icon={<Terminal size={14} />}
              label="Open PowerShell here"
              onClick={() => {
                const client = rowMenu.client!;
                closeRowMenu();
                void (window.electronAPI as any).openCmdAtDirectory(client.path);
              }}
            />
            <MenuSeparator />
            <MenuRow
              icon={<Trash2 size={14} />}
              label="Delete client folder"
              danger
              onClick={() => {
                const client = rowMenu.client!;
                closeRowMenu();
                void deleteClient(client);
              }}
            />
          </>
        )}
      </FloatingMenu>

      {/* Blank-space context menu */}
      <FloatingMenu isOpen={blankMenu.isOpen} position={blankMenu.position} onClose={closeBlankMenu}>
        <MenuRow
          icon={<UserPlus size={14} />}
          label="New client"
          onClick={() => {
            closeBlankMenu();
            openAddPanel();
          }}
        />
        <MenuRow
          icon={<RefreshCw size={14} />}
          label="Refresh"
          onClick={() => {
            closeBlankMenu();
            setReloadKey((k) => k + 1);
          }}
        />
        <MenuSeparator />
        <MenuRow
          icon={<Link2 size={14} />}
          label="Copy Path"
          onClick={() => {
            closeBlankMenu();
            void navigator.clipboard.writeText(currentDirectory);
            setStatus(`Copied path: ${currentDirectory}`, 'info');
          }}
        />
        <MenuRow
          icon={<ExternalLink size={14} />}
          label="Open in Explorer"
          onClick={() => {
            closeBlankMenu();
            void window.electronAPI.openDirectory(currentDirectory);
          }}
        />
        <MenuRow
          icon={<Terminal size={14} />}
          label="Open PowerShell"
          onClick={() => {
            closeBlankMenu();
            void (window.electronAPI as any).openCmdAtDirectory(currentDirectory);
          }}
        />
      </FloatingMenu>
    </Box>
  );
};
