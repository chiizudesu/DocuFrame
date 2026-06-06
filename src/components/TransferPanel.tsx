import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useColorModeValue } from './ui/color-mode';
import { Box, Flex, Text, Input, IconButton } from '@chakra-ui/react';
import {
  ArrowDownToLine,
  X,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  getAllIndexKeys,
  extractIndexPrefix,
  WORKPAPER_DESCRIPTIONS,
} from '../utils/indexPrefix';
import { docuFramePalette as P } from '../docuFrameColors';

const noRing = { outline: 'none', boxShadow: 'none' } as const;

interface DownloadFile {
  name: string;
  size: number;
  modified?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAge(modified: string | undefined): string {
  if (!modified) return '';
  const diff = Date.now() - new Date(modified).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function getExtBadge(name: string) {
  const ext = name.split('.').pop()?.toUpperCase() ?? '';
  const short = ext.slice(0, 4);
  const map: Record<string, { bg: string; color: string }> = {
    PDF:  { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
    XLSX: { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
    XLS:  { bg: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
    CSV:  { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
    DOCX: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    DOC:  { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
    ZIP:  { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
  };
  return { short, ...(map[short] ?? { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }) };
}

// ── Main component ────────────────────────────────────────────────────────────
export const TransferPanel: React.FC = () => {
  const {
    currentDirectory,
    folderItems,
    addLog,
    setStatus,
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);

  // Downloads
  const [downloads, setDownloads] = useState<DownloadFile[]>([]);
  const [selectedDlIdx, setSelectedDlIdx] = useState(0);
  const [loadingDownloads, setLoadingDownloads] = useState(false);

  // Index field (keyboard-first)
  const [indexQuery, setIndexQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [indexHighlight, setIndexHighlight] = useState(0);
  const [showIndexSuggs, setShowIndexSuggs] = useState(false);

  // Filename field
  const [filename, setFilename] = useState('');
  const [filenameHighlight, setFilenameHighlight] = useState(-1);
  const [showFilenameSuggs, setShowFilenameSuggs] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);

  // Transfer mappings
  const [transferMappings, setTransferMappings] = useState<Record<string, string>>({});

  // Transfer state
  const [xferStatus, setXferStatus] = useState<'idle' | 'transferring' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // "/" command shortcut mode
  const [cmdMode, setCmdMode] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdHighlight, setCmdHighlight] = useState(0);
  const [cmdDropRect, setCmdDropRect] = useState<DOMRect | null>(null);

  const panelRef        = useRef<HTMLDivElement>(null);
  const indexInputRef   = useRef<HTMLInputElement>(null);
  const fnInputRef      = useRef<HTMLInputElement>(null);
  const cmdInputRef     = useRef<HTMLInputElement>(null);
  const indexDropRef    = useRef<HTMLDivElement>(null);
  const fnDropRef       = useRef<HTMLDivElement>(null);
  const cmdDropRef      = useRef<HTMLDivElement>(null);
  const isOpenRef       = useRef(false);
  isOpenRef.current     = isOpen;

  // ── Colors ──────────────────────────────────────────────────────────────────
  const overlayBg       = 'rgba(0,0,0,0.5)';
  const panelBg         = useColorModeValue('#ffffff', P.dark.tabStrip);
  const headerBg        = useColorModeValue('#f8fafc', P.dark.tabInactive);
  const borderColor     = useColorModeValue('#e2e8f0', P.dark.border);
  const labelColor      = useColorModeValue('#1e293b', '#e2e8f0');
  const subColor        = useColorModeValue('#94a3b8', '#64748b');
  const hoverBg         = useColorModeValue('#f1f5f9', '#1f2637');
  const inputBg         = useColorModeValue('#f8fafc', '#1a1f2e');
  const selBg           = useColorModeValue('#dbeafe', '#1d3a5f');
  const selBorder       = useColorModeValue('#93c5fd', '#3b82f6');
  const suggActiveBg    = useColorModeValue('#eff6ff', '#162032');
  const suggBg          = useColorModeValue('#ffffff', '#1e2536');
  const previewBg       = useColorModeValue('#f0fdf4', '#0f2419');
  const previewBorder   = useColorModeValue('#86efac', '#166534');
  const errorBg         = useColorModeValue('#fef2f2', '#2d0a0a');
  const errorBorder     = useColorModeValue('#fca5a5', '#7f1d1d');
  const previewTextColor = useColorModeValue('#166534', '#4ade80');
  const errorTextColor   = useColorModeValue('#991b1b', '#f87171');
  const focusBorder      = useColorModeValue('#3b82f6', '#3b82f6');

  // ── Load transfer mappings ───────────────────────────────────────────────────
  const loadMappings = useCallback(async () => {
    try {
      const config = await (window.electronAPI as any).getConfig();
      setTransferMappings(config?.transferCommandMappings || {});
    } catch {
      setTransferMappings({});
    }
  }, []);

  useEffect(() => {
    loadMappings();
    window.addEventListener('transferMappingsUpdated', loadMappings);
    return () => window.removeEventListener('transferMappingsUpdated', loadMappings);
  }, [loadMappings]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, Array<{ command: string; filename: string }>> = {};
    Object.entries(transferMappings).forEach(([cmd, fn]) => {
      const m = (fn as string).match(/^([A-Z]+\d*)\s*-/);
      const key = m ? m[1] : 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push({ command: cmd, filename: fn as string });
    });
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.command.localeCompare(b.command)));
    return groups;
  }, [transferMappings]);

  const indexesNotInDir = useMemo(() => {
    const present = new Set<string>();
    (folderItems || []).forEach((item: { name: string; type?: string }) => {
      if (item.type === 'folder') return;
      const k = extractIndexPrefix(item.name);
      if (k) present.add(k);
    });
    return getAllIndexKeys().filter(k => !present.has(k));
  }, [folderItems]);

  // All index items for suggestion list
  const allIndexItems = useMemo(() => {
    const keys = getAllIndexKeys();
    return ['AA', ...keys.filter(k => k !== 'AA')].map(k => ({
      value: k,
      label: k,
      sub: WORKPAPER_DESCRIPTIONS[k] ?? '',
    }));
  }, []);

  // Rects for portal-positioned dropdowns (to escape panel overflow:hidden)
  const [indexDropRect, setIndexDropRect] = useState<DOMRect | null>(null);
  const [fnDropRect, setFnDropRect]       = useState<DOMRect | null>(null);

  // Filtered index suggestions — letter/code only; empty query → no suggestions
  const indexSuggestions = useMemo(() => {
    const q = indexQuery.trim().toUpperCase();
    if (!q) return [];
    return allIndexItems.filter(item => item.value.startsWith(q)).slice(0, 3);
  }, [indexQuery, allIndexItems]);

  // Template suggestions for selected index; empty query → no suggestions
  const filenameSuggestions = useMemo(() => {
    const q = filename.trim().toLowerCase();
    if (!q) return [];
    const templates = selectedIndex ? (groupedTemplates[selectedIndex] ?? []) : [];
    return templates.filter(t =>
      t.command.toLowerCase().includes(q) ||
      t.filename.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [selectedIndex, groupedTemplates, filename]);

  // "/" command shortcut suggestions
  const cmdSuggestions = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(transferMappings)
      .filter(([cmd, fn]) =>
        cmd.toLowerCase().includes(q) ||
        (fn as string).toLowerCase().includes(q)
      )
      .map(([cmd, fn]) => ({ command: cmd, filename: fn as string }))
      .slice(0, 3);
  }, [cmdQuery, transferMappings]);

  // Destination preview
  const sourceFile = downloads[selectedDlIdx] ?? null;
  const sourceExt  = sourceFile?.name.split('.').pop() ?? null;

  const destinationName = useMemo((): string | null => {
    if (selectedCommand) {
      const fn = transferMappings[selectedCommand];
      return fn || null;
    }
    if (filename.trim() && selectedIndex) {
      const raw = filename.trim();
      const hasPrefix = /^[A-Z]+\d*\s+-\s+/.test(raw);
      return hasPrefix ? raw : `${selectedIndex} - ${raw}`;
    }
    if (filename.trim()) return filename.trim();
    return null;
  }, [selectedCommand, transferMappings, filename, selectedIndex]);

  const destinationWithExt = destinationName && sourceExt
    ? (destinationName.includes('.') ? destinationName : `${destinationName}.${sourceExt}`)
    : destinationName;

  // ── Panel open ───────────────────────────────────────────────────────────────
  const openPanel = useCallback(async () => {
    // Block main app keyboard shortcuts
    document.body.dataset.transferPanelOpen = 'true';
    setIsOpen(true);
    setXferStatus('idle');
    setStatusMsg('');
    setSelectedDlIdx(0);
    setSelectedCommand(null);
    setFilename('');
    setIndexQuery('');
    setFilenameHighlight(-1);
    setShowFilenameSuggs(false);
    setShowIndexSuggs(false);
    setCmdMode(false);
    setCmdQuery('');
    setCmdHighlight(0);

    // Start with no index selected (NIL)
    setSelectedIndex(null);
    setIndexHighlight(0);

    // Load downloads
    setLoadingDownloads(true);
    try {
      const result = await (window.electronAPI as any).transfer({ numFiles: 5, command: 'preview' });
      setDownloads(result?.success && Array.isArray(result.files) ? result.files : []);
    } catch {
      setDownloads([]);
    } finally {
      setLoadingDownloads(false);
    }

    // Focus index input and measure rect for portal dropdown
    setTimeout(() => {
      indexInputRef.current?.focus();
      if (indexInputRef.current) setIndexDropRect(indexInputRef.current.getBoundingClientRect());
    }, 50);
  }, []);

  const closePanel = useCallback(() => {
    document.body.dataset.transferPanelOpen = 'false';
    setIsOpen(false);
    setXferStatus('idle');
    setStatusMsg('');
    setShowIndexSuggs(false);
    setShowFilenameSuggs(false);
    setCmdMode(false);
    setCmdQuery('');
  }, []);

  // ── Global Ctrl+Space ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (!isOpenRef.current) openPanel();
        else closePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPanel, closePanel]);

  // Click outside to close — exclude portal dropdowns from check
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insidePanel      = panelRef.current?.contains(target) ?? false;
      const insideIndexDrop  = indexDropRef.current?.contains(target) ?? false;
      const insideFnDrop     = fnDropRef.current?.contains(target) ?? false;
      const insideCmdDrop    = cmdDropRef.current?.contains(target) ?? false;
      if (!insidePanel && !insideIndexDrop && !insideFnDrop && !insideCmdDrop) closePanel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closePanel]);

  // ── Index field helpers ───────────────────────────────────────────────────────
  const acceptIndex = useCallback((idx: string | null, currentFilename: string, currentCommand: string | null) => {
    setSelectedIndex(idx);
    setIndexQuery(idx ?? '');
    setShowIndexSuggs(false);
    // If filename already has content, don't clear it
    if (!currentFilename && !currentCommand) {
      setFilenameHighlight(-1);
      setTimeout(() => {
        fnInputRef.current?.focus();
        if (fnInputRef.current) setFnDropRect(fnInputRef.current.getBoundingClientRect());
        setShowFilenameSuggs(true);
      }, 30);
    } else {
      setShowFilenameSuggs(false);
    }
  }, []);

  const handleIndexKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      acceptIndex(null, filename, selectedCommand);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndexHighlight(h => Math.min(h + 1, indexSuggestions.length - 1));
      setShowIndexSuggs(true);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndexHighlight(h => Math.max(h - 1, 0));
      setShowIndexSuggs(true);
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const picked = indexSuggestions[indexHighlight] ?? indexSuggestions[0] ?? null;
      acceptIndex(picked?.value ?? null, filename, selectedCommand);
      return;
    }
  }, [indexSuggestions, indexHighlight, acceptIndex, filename, selectedCommand]);

  const handleIndexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setIndexQuery(v);
    setSelectedIndex(null);
    setSelectedCommand(null);
    setIndexHighlight(0);
    setShowIndexSuggs(v.trim().length > 0);
  };

  // ── Core transfer executor — accepts explicit opts to avoid stale state ──────
  const executeTransfer = useCallback(async (opts: { numFiles: number; command?: string; newName?: string; currentDirectory: string }) => {
    // Close immediately — don't wait for result
    closePanel();
    try {
      const result = await (window.electronAPI as any).transfer(opts);
      if (result?.success) {
        addLog(result.message, 'response');
        setStatus('Transfer completed', 'success');
        // Trigger FileGrid's filtered reload rather than setting raw contents directly
        window.dispatchEvent(new CustomEvent('directoryRefreshed', { detail: { directory: opts.currentDirectory } }));
      } else {
        addLog(result.message, 'error');
        setStatus('Transfer failed', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Transfer failed: ${msg}`, 'error');
      setStatus('Transfer failed', 'error');
    }
  }, [addLog, setStatus, closePanel]);

  // ── Execute transfer (declared before handleFilenameKeyDown) ────────────────
  const handleTransfer = useCallback(async () => {
    const opts: { numFiles: number; command?: string; newName?: string; currentDirectory: string } = {
      numFiles: 1,
      currentDirectory,
    };
    if (selectedCommand) {
      opts.command = selectedCommand;
    } else if (filename.trim()) {
      opts.newName = destinationWithExt || filename.trim();
      opts.command = 'transfer';
    } else {
      opts.command = 'transfer';
    }
    await executeTransfer(opts);
  }, [selectedCommand, filename, destinationWithExt, currentDirectory, executeTransfer]);

  // ── Filename field helpers ────────────────────────────────────────────────────
  const acceptFilenameSugg = useCallback((t: { command: string; filename: string }) => {
    setSelectedCommand(t.command);
    setFilename(t.filename);
    setShowFilenameSuggs(false);
    setFilenameHighlight(-1);
  }, []);

  const handleFilenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showFilenameSuggs) { setShowFilenameSuggs(false); return; }
      closePanel();
      return;
    }
    if (e.key === 'ArrowDown' && filenameSuggestions.length > 0) {
      e.preventDefault();
      setFilenameHighlight(h => Math.min(h + 1, filenameSuggestions.length - 1));
      setShowFilenameSuggs(true);
      return;
    }
    if (e.key === 'ArrowUp' && filenameSuggestions.length > 0) {
      e.preventDefault();
      setFilenameHighlight(h => Math.max(h - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Accept highlighted suggestion first, then transfer on next Enter
      if (showFilenameSuggs && filenameHighlight >= 0) {
        acceptFilenameSugg(filenameSuggestions[filenameHighlight]);
        setShowFilenameSuggs(false);
        return;
      }
      // Both fields filled → transfer immediately
      handleTransfer();
      return;
    }
    if (e.key === 'Tab' && showFilenameSuggs && filenameSuggestions.length > 0) {
      e.preventDefault();
      const idx = filenameHighlight >= 0 ? filenameHighlight : 0;
      acceptFilenameSugg(filenameSuggestions[idx]);
    }
  }, [showFilenameSuggs, filenameSuggestions, filenameHighlight, acceptFilenameSugg, closePanel, handleTransfer]);

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setFilename(v);
    setSelectedCommand(null);
    setFilenameHighlight(-1);
    setShowFilenameSuggs(v.trim().length > 0);
  };

  // ── "/" command mode helpers ──────────────────────────────────────────────────
  const enterCmdMode = useCallback(() => {
    setCmdMode(true);
    setCmdQuery('');
    setCmdHighlight(0);
    setShowIndexSuggs(false);
    setShowFilenameSuggs(false);
    setTimeout(() => {
      cmdInputRef.current?.focus();
      if (cmdInputRef.current) setCmdDropRect(cmdInputRef.current.getBoundingClientRect());
    }, 30);
  }, []);

  const exitCmdMode = useCallback(() => {
    setCmdMode(false);
    setCmdQuery('');
    setCmdHighlight(0);
    setTimeout(() => indexInputRef.current?.focus(), 30);
  }, []);

  const acceptCmdSugg = useCallback((cmd: string) => {
    setCmdMode(false);
    setCmdQuery('');
    setSelectedCommand(cmd);
    const fn = transferMappings[cmd] ?? '';
    setFilename(fn);
    setSelectedIndex(null);
    setIndexQuery('');
    setShowFilenameSuggs(false);
    // Execute immediately with the command directly (bypasses stale state)
    void executeTransfer({ numFiles: 1, command: cmd, currentDirectory });
  }, [transferMappings, executeTransfer, currentDirectory]);

  const handleCmdKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); exitCmdMode(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCmdHighlight(h => Math.min(h + 1, cmdSuggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCmdHighlight(h => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const picked = cmdSuggestions[cmdHighlight] ?? cmdSuggestions[0];
      if (picked) { acceptCmdSugg(picked.command); return; }
    }
  }, [cmdSuggestions, cmdHighlight, exitCmdMode, acceptCmdSugg]);

  const handleCmdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setCmdQuery(v);
    setCmdHighlight(0);
  };

  // Panel-level "/" key detection — activate cmd mode
  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (cmdMode) return;
    if (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      // Only activate if not typing in an input that already has content
      if (!isInput || (target as HTMLInputElement).value === '') {
        e.preventDefault();
        enterCmdMode();
      }
    }
  }, [cmdMode, enterCmdMode]);

  if (!isOpen) return null;

  const indexDisplayValue = selectedIndex !== null ? selectedIndex : indexQuery;

  return createPortal(
    <Box
      position="fixed"
      inset={0}
      bg={overlayBg}
      zIndex={15000}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        ref={panelRef}
        bg={panelBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="0"
        w="min(560px, 94vw)"
        boxShadow="0 24px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)"
        onKeyDown={handlePanelKeyDown}
      >
        {/* ── Header ── */}
        <Flex
          align="center"
          px="18px"
          h="46px"
          bg={headerBg}
          borderBottom="1px solid"
          borderColor={borderColor}
          gap={2.5}
        >
          <Flex align="center" justify="center" w="26px" h="26px" borderRadius="6px" bg="rgba(59,130,246,0.15)" flexShrink={0}>
            <ArrowDownToLine size={14} color="#60a5fa" strokeWidth={2.5} />
          </Flex>
          <Text fontSize="13px" fontWeight="600" color={labelColor} flex={1} letterSpacing="-0.01em">
            Transfer from Downloads
          </Text>
          <IconButton
            aria-label="Close"
            variant="ghost"
            size="xs"
            onClick={closePanel}
            color={subColor}
            _hover={{ bg: hoverBg, color: labelColor }}
            style={noRing}
            borderRadius="4px"
          >
            <X size={13} />
          </IconButton>
        </Flex>

        <Box px="18px" pt="14px" pb="16px">

          {/* ── Downloads ── */}
          <Flex align="center" gap={2} mb="8px">
            <Text fontSize="10px" fontWeight="700" color={subColor} letterSpacing="0.08em" userSelect="none">DOWNLOADS</Text>
            <Box flex={1} h="1px" bg={borderColor} />
          </Flex>
          <Box border="1px solid" borderColor={borderColor} borderRadius="6px" overflow="hidden" mb="14px">
            {loadingDownloads ? (
              <Flex align="center" justify="center" py="14px" gap={2}>
                <Loader2 size={13} color={subColor} style={{ animation: 'spin 1s linear infinite' }} />
                <Text fontSize="12px" color={subColor}>Loading downloads…</Text>
              </Flex>
            ) : downloads.length === 0 ? (
              <Flex align="center" justify="center" py="14px">
                <Text fontSize="12px" color={subColor}>No files in Downloads folder</Text>
              </Flex>
            ) : (
              downloads.map((file, idx) => {
                const badge = getExtBadge(file.name);
                const isSel = idx === selectedDlIdx;
                const stem = file.name.replace(/\.[^.]+$/, '');
                const ext  = file.name.split('.').pop() ?? '';
                return (
                  <Flex
                    key={idx}
                    as="button"
                    w="100%"
                    align="center"
                    px="12px"
                    py="8px"
                    gap="10px"
                    bg={isSel ? selBg : 'transparent'}
                    borderBottom={idx < downloads.length - 1 ? '1px solid' : 'none'}
                    borderColor={borderColor}
                    borderLeft={isSel ? '2px solid #3b82f6' : '2px solid transparent'}
                    _hover={{ bg: isSel ? selBg : hoverBg }}
                    cursor="pointer"
                    onClick={() => setSelectedDlIdx(idx)}
                    textAlign="left"
                    transition="background 0.1s"
                  >
                    <Box px="5px" py="1px" borderRadius="3px" bg={badge.bg} flexShrink={0} minW="32px" textAlign="center">
                      <Text fontSize="9.5px" fontWeight="700" color={badge.color} letterSpacing="0.04em">{badge.short || '—'}</Text>
                    </Box>
                    <Text
                      fontSize="12.5px"
                      color={isSel ? '#60a5fa' : labelColor}
                      fontWeight={isSel ? '500' : '400'}
                      flex={1}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      title={file.name}
                    >
                      {stem}
                      {ext && <Box as="span" color={subColor}>.{ext}</Box>}
                    </Text>
                    <Flex align="center" gap="8px" flexShrink={0}>
                      <Text fontSize="11px" color={subColor}>{formatFileSize(file.size)}</Text>
                      {file.modified && (
                        <>
                          <Box w="2px" h="2px" borderRadius="50%" bg={borderColor} flexShrink={0} />
                          <Text fontSize="11px" color={subColor}>{formatAge(file.modified)}</Text>
                        </>
                      )}
                    </Flex>
                  </Flex>
                );
              })
            )}
          </Box>

          {/* ── Rename As / Command Mode ── */}
          <Flex align="center" gap={2} mb="8px">
            <Text fontSize="10px" fontWeight="700" color={subColor} letterSpacing="0.08em" userSelect="none">
              {cmdMode ? 'SHORTCUT' : 'RENAME AS'}
            </Text>
            <Box flex={1} h="1px" bg={borderColor} />
            {!cmdMode && (
              <Text fontSize="9.5px" color={subColor} userSelect="none" opacity={0.6}>/ for commands</Text>
            )}
          </Flex>

          {/* Cmd mode — full-width command input */}
          {cmdMode && (
            <Box mb={xferStatus === 'success' || xferStatus === 'error' ? '10px' : '14px'}>
              <Flex align="center" gap="0" border="1px solid" borderColor={focusBorder} borderRadius="6px" overflow="hidden" bg={inputBg} h="36px">
                <Flex align="center" justify="center" px="10px" h="100%" bg="rgba(59,130,246,0.1)" flexShrink={0}>
                  <Text fontSize="14px" fontWeight="700" color="#60a5fa" lineHeight="1" style={{ fontFamily: 'monospace' }}>/</Text>
                </Flex>
                <Input
                  ref={cmdInputRef}
                  value={cmdQuery}
                  onChange={handleCmdChange}
                  onKeyDown={handleCmdKeyDown}
                  onFocus={() => { if (cmdInputRef.current) setCmdDropRect(cmdInputRef.current.getBoundingClientRect()); }}
                  onBlur={() => setTimeout(() => setCmdMode(false), 150)}
                  placeholder="type command… (e.g. gstr)"
                  h="34px"
                  border="none"
                  bg="transparent"
                  fontSize="13px"
                  color={labelColor}
                  _placeholder={{ color: subColor, fontSize: '12px' }}
                  style={noRing}
                  flex={1}
                />
              </Flex>
            </Box>
          )}

          {/* Normal rename fields — hidden in cmd mode */}
          {!cmdMode && <Flex gap="8px" mb={xferStatus === 'success' || xferStatus === 'error' ? '10px' : '14px'}>

            {/* Index field — 26% */}
            <Box w="26%" flexShrink={0}>
              <Input
                ref={indexInputRef}
                value={indexDisplayValue}
                onChange={handleIndexChange}
                onKeyDown={handleIndexKeyDown}
                onFocus={() => {
                  if (indexInputRef.current) setIndexDropRect(indexInputRef.current.getBoundingClientRect());
                  setShowIndexSuggs(indexQuery.trim().length > 0);
                  setShowFilenameSuggs(false);
                }}
                onBlur={() => setTimeout(() => setShowIndexSuggs(false), 150)}
                placeholder="Index…"
                size="sm"
                h="36px"
                bg={inputBg}
                border="1px solid"
                borderColor={showIndexSuggs ? focusBorder : borderColor}
                borderRadius="6px"
                fontSize="13px"
                fontWeight="600"
                letterSpacing="0.02em"
                color={selectedIndex ? '#60a5fa' : labelColor}
                _placeholder={{ color: subColor, fontWeight: '400' }}
                style={noRing}
                transition="border-color 0.15s"
              />
            </Box>

            {/* Filename field — 74% */}
            <Box flex={1} minW={0}>
              <Input
                ref={fnInputRef}
                value={filename}
                onChange={handleFilenameChange}
                onKeyDown={handleFilenameKeyDown}
                onFocus={() => {
                  if (fnInputRef.current) setFnDropRect(fnInputRef.current.getBoundingClientRect());
                  setShowFilenameSuggs(filename.trim().length > 0);
                  setShowIndexSuggs(false);
                }}
                onBlur={() => setTimeout(() => setShowFilenameSuggs(false), 150)}
                placeholder={selectedIndex
                  ? (filenameSuggestions.length > 0 ? `${filenameSuggestions[0].filename}` : 'Custom filename…')
                  : 'Select an index first…'}
                size="sm"
                h="36px"
                bg={inputBg}
                border="1px solid"
                borderColor={showFilenameSuggs ? focusBorder : borderColor}
                borderRadius="6px"
                fontSize="12.5px"
                color={selectedCommand ? '#60a5fa' : labelColor}
                _placeholder={{ color: subColor, fontSize: '11.5px' }}
                style={noRing}
                transition="border-color 0.15s"
              />
            </Box>
          </Flex>}

          {/* ── Status ── */}
          {(xferStatus === 'success' || xferStatus === 'error') && statusMsg && (
            <Flex align="center" gap="8px" px="12px" py="8px" mb="10px"
              bg={xferStatus === 'success' ? previewBg : errorBg}
              border="1px solid"
              borderColor={xferStatus === 'success' ? previewBorder : errorBorder}
              borderRadius="6px"
            >
              {xferStatus === 'success' ? <CheckCircle2 size={14} color="#4ade80" /> : <AlertCircle size={14} color="#f87171" />}
              <Text fontSize="12px" color={xferStatus === 'success' ? previewTextColor : errorTextColor}>{statusMsg}</Text>
            </Flex>
          )}

          {/* ── Footer ── */}
          <Flex align="center" justify="flex-end" gap="8px" pt="2px">
            <Text fontSize="10.5px" color={subColor} mr="auto" userSelect="none" letterSpacing="0.01em">
              {cmdMode ? '↑↓ navigate · ↵ select · Esc cancel' : '/ shortcut · Tab index→name · ↵ transfer · Esc close'}
            </Text>
            <Box
              as="button"
              px="14px"
              h="32px"
              bg="transparent"
              border="1px solid"
              borderColor={borderColor}
              borderRadius="5px"
              fontSize="12.5px"
              color={subColor}
              cursor="pointer"
              display="flex"
              alignItems="center"
              style={{ transition: 'background 0.1s, color 0.1s' }}
              onClick={closePanel}
            >
              Cancel
            </Box>
            <Box
              as="button"
              px="16px"
              h="32px"
              bg={xferStatus === 'transferring' ? '#1d4ed8' : '#2563eb'}
              borderRadius="5px"
              fontSize="12.5px"
              fontWeight="600"
              color="white"
              cursor={xferStatus === 'transferring' ? 'not-allowed' : 'pointer'}
              display="flex"
              alignItems="center"
              gap="6px"
              onClick={handleTransfer}
              opacity={xferStatus === 'transferring' ? 0.85 : 1}
              style={{ ...noRing, transition: 'background 0.1s, opacity 0.1s', letterSpacing: '-0.01em' }}
            >
              {xferStatus === 'transferring' ? (
                <>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  Transferring…
                </>
              ) : 'Transfer'}
            </Box>
          </Flex>
        </Box>
      </Box>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Index suggestion portal (fixed, escapes panel bounds) ── */}
      {showIndexSuggs && indexSuggestions.length > 0 && indexDropRect && createPortal(
        <Box
          ref={indexDropRef}
          onMouseDown={(e) => e.stopPropagation()}
          position="fixed"
          top={`${indexDropRect.bottom + 3}px`}
          left={`${indexDropRect.left}px`}
          w={`${indexDropRect.width}px`}
          maxH="200px"
          overflowY="auto"
          bg={suggBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="6px"
          zIndex={20000}
          py="3px"
          boxShadow="0 8px 24px rgba(0,0,0,0.3)"
        >
          {indexSuggestions.map((item, i) => (
            <Flex
              key={item.value}
              as="button"
              w="100%"
              align="center"
              px="10px"
              py="6px"
              gap="8px"
              cursor="pointer"
              bg={i === indexHighlight ? suggActiveBg : 'transparent'}
              _hover={{ bg: suggActiveBg }}
              textAlign="left"
              onMouseDown={() => acceptIndex(item.value, filename, selectedCommand)}
              onMouseEnter={() => setIndexHighlight(i)}
            >
              <Text fontSize="12px" fontWeight="700" color={i === indexHighlight ? '#60a5fa' : labelColor} flexShrink={0} w="28px">
                {item.label}
              </Text>
              <Text fontSize="11px" color={subColor} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {item.sub}
              </Text>
            </Flex>
          ))}
        </Box>,
        document.body
      )}

      {/* ── Filename suggestion portal ── */}
      {showFilenameSuggs && filenameSuggestions.length > 0 && fnDropRect && createPortal(
        <Box
          ref={fnDropRef}
          onMouseDown={(e) => e.stopPropagation()}
          position="fixed"
          top={`${fnDropRect.bottom + 3}px`}
          left={`${fnDropRect.left}px`}
          w={`${fnDropRect.width}px`}
          maxH="180px"
          overflowY="auto"
          bg={suggBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="6px"
          zIndex={20000}
          py="3px"
          boxShadow="0 8px 24px rgba(0,0,0,0.3)"
        >
          {filenameSuggestions.map((t, i) => (
            <Flex
              key={t.command}
              as="button"
              w="100%"
              align="center"
              px="10px"
              py="6px"
              gap="8px"
              cursor="pointer"
              bg={i === filenameHighlight ? suggActiveBg : 'transparent'}
              _hover={{ bg: suggActiveBg }}
              textAlign="left"
              onMouseDown={() => acceptFilenameSugg(t)}
              onMouseEnter={() => setFilenameHighlight(i)}
            >
              <Text fontSize="10.5px" fontWeight="600" color={subColor} flexShrink={0} minW="60px">
                {t.command}
              </Text>
              <Text fontSize="11.5px" color={i === filenameHighlight ? labelColor : subColor} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {t.filename}
              </Text>
            </Flex>
          ))}
        </Box>,
        document.body
      )}
      {/* ── Command shortcut suggestion portal ── */}
      {cmdMode && cmdSuggestions.length > 0 && cmdDropRect && createPortal(
        <Box
          ref={cmdDropRef}
          onMouseDown={(e) => e.stopPropagation()}
          position="fixed"
          top={`${cmdDropRect.bottom + 3}px`}
          left={`${cmdDropRect.left}px`}
          w={`${cmdDropRect.width}px`}
          maxH="120px"
          overflowY="auto"
          bg={suggBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="6px"
          zIndex={20000}
          py="3px"
          boxShadow="0 8px 24px rgba(0,0,0,0.3)"
        >
          {cmdSuggestions.map((t, i) => (
            <Flex
              key={t.command}
              as="button"
              w="100%"
              align="center"
              px="10px"
              py="6px"
              gap="8px"
              cursor="pointer"
              bg={i === cmdHighlight ? suggActiveBg : 'transparent'}
              _hover={{ bg: suggActiveBg }}
              textAlign="left"
              onMouseDown={() => acceptCmdSugg(t.command)}
              onMouseEnter={() => setCmdHighlight(i)}
            >
              <Text fontSize="11px" fontWeight="700" color={i === cmdHighlight ? '#60a5fa' : labelColor} flexShrink={0} minW="50px" style={{ fontFamily: 'monospace' }}>
                {t.command}
              </Text>
              <Text fontSize="11px" color={subColor} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {t.filename}
              </Text>
            </Flex>
          ))}
        </Box>,
        document.body
      )}
    </Box>,
    document.body
  );
};
