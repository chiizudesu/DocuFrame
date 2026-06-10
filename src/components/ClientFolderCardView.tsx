import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { Box, Flex, Text, Input } from '@chakra-ui/react';
import { Folder, FolderPlus, File as FileIcon, Check, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { GridBackdrop } from './GridBackdrop';
import { joinPath } from '../utils/path';
import { docuFramePalette } from '../docuFrameColors';
import type { FileItem } from '../types';

const ACCENT = '#3b82f6';

type FolderTheme = 'year' | 'gst' | 'neutral';

/** Subtle colour map for common client sub-folders. */
function getFolderTheme(name: string): FolderTheme {
  const trimmed = name.trim();
  if (/^(19|20)\d{2}$/.test(trimmed)) return 'year';
  if (/^gst\b/i.test(trimmed) || trimmed.toLowerCase() === 'gst') return 'gst';
  return 'neutral';
}

export const ClientFolderCardView: React.FC = () => {
  const {
    currentDirectory,
    setCurrentDirectory,
    setFolderItems,
    addLog,
    setStatus,
    hideDotFiles,
    hideTemporaryFiles,
  } = useAppContext();

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  // ── Colours ────────────────────────────────────────────────────────────────
  const bg = useColorModeValue(docuFramePalette.light.canvas, docuFramePalette.dark.canvas);
  const cardBg = useColorModeValue('#ffffff', '#1d2433');
  const cardBorder = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const cardHoverBorder = useColorModeValue('#94a3b8', '#64748b');
  const cardHoverBg = useColorModeValue('#f8fafc', '#232d3e');
  const nameColor = useColorModeValue('#1e293b', '#e2e8f0');
  const subColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);
  const neutralIcon = useColorModeValue('#64748b', '#94a3b8');
  // Year (blue)
  const yearBg = useColorModeValue('rgba(59,130,246,0.07)', 'rgba(59,130,246,0.12)');
  const yearBorder = useColorModeValue('rgba(59,130,246,0.35)', 'rgba(59,130,246,0.45)');
  const yearIcon = useColorModeValue('#2563eb', '#60a5fa');
  // GST (green)
  const gstBg = useColorModeValue('rgba(34,197,94,0.07)', 'rgba(34,197,94,0.12)');
  const gstBorder = useColorModeValue('rgba(34,197,94,0.35)', 'rgba(34,197,94,0.45)');
  const gstIcon = useColorModeValue('#16a34a', '#4ade80');
  // Add card
  const addBg = useColorModeValue('rgba(59,130,246,0.05)', 'rgba(59,130,246,0.08)');
  const addHoverBg = useColorModeValue('rgba(59,130,246,0.12)', 'rgba(59,130,246,0.16)');
  const inputBg = useColorModeValue('#ffffff', '#171923');

  const themeStyles = (theme: FolderTheme) => {
    if (theme === 'year') return { bg: yearBg, border: yearBorder, icon: yearIcon };
    if (theme === 'gst') return { bg: gstBg, border: gstBorder, icon: gstIcon };
    return { bg: cardBg, border: cardBorder, icon: neutralIcon };
  };

  // ── Load directory ───────────────────────────────────────────────────────────
  const loadContents = useCallback(async () => {
    if (!currentDirectory) return;
    setLoading(true);
    try {
      const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
      const raw: FileItem[] = Array.isArray(contents)
        ? contents
        : ((contents as any)?.files ?? []);
      const filtered = raw.filter((it) => {
        const n = it.name;
        if (!n) return false;
        if (hideDotFiles && n.startsWith('.')) return false;
        if (hideTemporaryFiles && (n.startsWith('~$') || n.endsWith('.tmp'))) return false;
        return true;
      });
      setItems(filtered);
      // Keep context in sync so the sidebar / job-context panes still see this folder's items
      setFolderItems(filtered);
    } catch (error) {
      addLog(`Failed to load folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentDirectory, hideDotFiles, hideTemporaryFiles, setFolderItems, addLog]);

  useEffect(() => {
    loadContents();
    const onRefresh = (e: Event) => {
      const dir = (e as CustomEvent)?.detail?.directory;
      if (!dir || dir === currentDirectory) loadContents();
    };
    window.addEventListener('directoryRefreshed', onRefresh as EventListener);
    window.addEventListener('forceDirectoryReload', onRefresh as EventListener);
    return () => {
      window.removeEventListener('directoryRefreshed', onRefresh as EventListener);
      window.removeEventListener('forceDirectoryReload', onRefresh as EventListener);
    };
  }, [loadContents, currentDirectory]);

  // Sort: folders first (years descending, then alphabetical), files last
  const sortedItems = useMemo(() => {
    const folders = items.filter((i) => i.type === 'folder');
    const files = items.filter((i) => i.type !== 'folder');
    folders.sort((a, b) => {
      const ay = /^(19|20)\d{2}$/.test(a.name.trim());
      const by = /^(19|20)\d{2}$/.test(b.name.trim());
      if (ay && by) return a.name.localeCompare(b.name); // years ascending (2025, 2026…)
      if (ay !== by) return ay ? -1 : 1; // year folders to the front
      return a.name.localeCompare(b.name);
    });
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  }, [items]);

  // ── Add folder ────────────────────────────────────────────────────────────────
  const startAdding = useCallback(() => {
    setAddingFolder(true);
    setNewFolderName('');
    setTimeout(() => addInputRef.current?.focus(), 30);
  }, []);

  const cancelAdding = useCallback(() => {
    setAddingFolder(false);
    setNewFolderName('');
  }, []);

  const confirmAdd = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || creating) return;
    if (/[\\/:*?"<>|]/.test(name)) {
      setStatus('Folder name contains invalid characters', 'error');
      return;
    }
    if (items.some((i) => i.type === 'folder' && i.name.toLowerCase() === name.toLowerCase())) {
      setStatus(`"${name}" already exists`, 'error');
      return;
    }
    setCreating(true);
    try {
      await window.electronAPI.createDirectory(joinPath(currentDirectory, name));
      addLog(`Created folder: ${name}`);
      setStatus(`Created folder "${name}"`, 'success');
      setAddingFolder(false);
      setNewFolderName('');
      await loadContents();
    } catch (error) {
      addLog(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create folder', 'error');
    } finally {
      setCreating(false);
    }
  }, [newFolderName, creating, items, currentDirectory, addLog, setStatus, loadContents]);

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelAdding();
    }
  };

  const CARD_H = '140px';

  return (
    <Box h="100%" bg={bg} position="relative" overflow="hidden">
      <GridBackdrop />
      <Box h="100%" overflow="auto" position="relative" zIndex={1} px={6} py={6}>
        {loading ? (
          <Flex justify="center" align="center" py={16} opacity={0.5}>
            <Text fontSize="sm" color={subColor}>Loading…</Text>
          </Flex>
        ) : (
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(170px, 1fr))"
            gap={4}
          >
            {sortedItems.map((item) => {
              const isFolder = item.type === 'folder';
              const theme = isFolder ? getFolderTheme(item.name) : 'neutral';
              const s = themeStyles(theme);
              return (
                <Flex
                  key={item.path}
                  direction="column"
                  align="center"
                  justify="center"
                  gap={3}
                  h={CARD_H}
                  px={3}
                  borderRadius="12px"
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor={s.border}
                  bg={s.bg}
                  cursor="pointer"
                  userSelect="none"
                  position="relative"
                  transition="all 0.14s ease"
                  _hover={{
                    borderColor: theme === 'neutral' ? cardHoverBorder : s.border,
                    bg: theme === 'neutral' ? cardHoverBg : s.bg,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                  }}
                  onClick={() => {
                    if (isFolder) setCurrentDirectory(item.path);
                    else window.electronAPI.openFile?.(item.path);
                  }}
                >
                  {/* subtle accent strip for themed folders */}
                  {theme !== 'neutral' && (
                    <Box
                      position="absolute"
                      top={0}
                      left="14px"
                      right="14px"
                      h="3px"
                      borderTopRadius="2px"
                      bg={theme === 'year' ? yearIcon : gstIcon}
                      opacity={0.85}
                    />
                  )}
                  {isFolder ? (
                    <Folder size={46} color={s.icon} strokeWidth={1.6} fill={theme !== 'neutral' ? s.icon : 'none'} fillOpacity={theme !== 'neutral' ? 0.12 : 0} />
                  ) : (
                    <FileIcon size={42} color={neutralIcon} strokeWidth={1.6} />
                  )}
                  <Text
                    fontSize="14px"
                    fontWeight="600"
                    color={nameColor}
                    textAlign="center"
                    lineClamp={2}
                    px={1}
                  >
                    {item.name}
                  </Text>
                </Flex>
              );
            })}

            {/* Add folder card */}
            {addingFolder ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap={2}
                h={CARD_H}
                px={3}
                borderRadius="12px"
                borderWidth="2px"
                borderStyle="solid"
                borderColor={ACCENT}
                bg={addBg}
                position="relative"
              >
                <FolderPlus size={38} color={ACCENT} strokeWidth={1.7} />
                <Flex align="center" gap={1} w="100%">
                  <Input
                    ref={addInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    onBlur={() => { if (!newFolderName.trim()) cancelAdding(); }}
                    placeholder="Folder name"
                    size="sm"
                    h="28px"
                    fontSize="13px"
                    textAlign="center"
                    bg={inputBg}
                    borderColor={ACCENT}
                    _focus={{ outline: 'none', boxShadow: `0 0 0 1px ${ACCENT}`, borderColor: ACCENT }}
                    _focusVisible={{ outline: 'none', boxShadow: `0 0 0 1px ${ACCENT}`, borderColor: ACCENT }}
                  />
                </Flex>
                <Flex gap={1} mt={0.5}>
                  <Flex
                    align="center" justify="center" w="24px" h="24px" borderRadius="5px"
                    bg={ACCENT} color="white" cursor="pointer" opacity={creating ? 0.5 : 1}
                    _hover={{ opacity: 0.85 }}
                    onMouseDown={(e) => { e.preventDefault(); confirmAdd(); }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </Flex>
                  <Flex
                    align="center" justify="center" w="24px" h="24px" borderRadius="5px"
                    bg="transparent" color={subColor} cursor="pointer" borderWidth="1px" borderStyle="solid" borderColor={cardBorder}
                    _hover={{ bg: cardHoverBg }}
                    onMouseDown={(e) => { e.preventDefault(); cancelAdding(); }}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </Flex>
                </Flex>
              </Flex>
            ) : (
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap={2.5}
                h={CARD_H}
                px={3}
                borderRadius="12px"
                borderWidth="2px"
                borderStyle="dashed"
                borderColor={ACCENT}
                bg={addBg}
                cursor="pointer"
                userSelect="none"
                color={ACCENT}
                transition="all 0.14s ease"
                _hover={{ bg: addHoverBg, transform: 'translateY(-2px)' }}
                onClick={startAdding}
              >
                <FolderPlus size={42} color={ACCENT} strokeWidth={1.7} />
                <Text fontSize="13px" fontWeight="600" color={ACCENT} textAlign="center">
                  New folder
                </Text>
              </Flex>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};
