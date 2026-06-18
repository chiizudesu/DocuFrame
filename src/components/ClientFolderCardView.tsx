import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { Box, Flex, Text, Input } from '@chakra-ui/react';
import { Folder, FolderPlus, FolderInput, File as FileIcon, Check, X, ExternalLink, Star, Link2, Trash2, Info, Terminal, RefreshCw } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { GridBackdrop } from './GridBackdrop';
import { FloatingMenu, MenuRow, MenuSeparator, ContextSubmenu } from './FileGrid/menuPrimitives';
import { joinPath } from '../utils/path';
import { beginInternalDrag, clearInternalDrag, isDragAccepted, readDragPayload, partitionDropPaths } from '../utils/dragDrop';
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
    addTabToCurrentWindow,
    quickAccessPaths,
    addQuickAccessPath,
    removeQuickAccessPath,
  } = useAppContext();

  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [cardMenu, setCardMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; item: FileItem | null }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    item: null,
  });
  const [blankMenu, setBlankMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  const closeCardMenu = useCallback(() => setCardMenu((m) => ({ ...m, isOpen: false })), []);
  const closeBlankMenu = useCallback(() => setBlankMenu((m) => ({ ...m, isOpen: false })), []);

  // Path of the folder card currently hovered by a drag, if any
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
  // Stray files (amber) — files don't belong at this level, nudge towards a folder
  const strayBg = useColorModeValue('rgba(245,158,11,0.06)', 'rgba(245,158,11,0.10)');
  const strayBorder = useColorModeValue('rgba(245,158,11,0.45)', 'rgba(245,158,11,0.50)');
  const strayIcon = useColorModeValue('#d97706', '#fbbf24');
  // Drop target highlight
  const dropBg = useColorModeValue('rgba(59,130,246,0.10)', 'rgba(59,130,246,0.18)');

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

  // The internal-drag marker is cleared by the folder drop handler once it has read it.
  // For drags that end elsewhere (cancelled, dropped outside, or onto a non-folder), clear it
  // on a short delay so it can't go stale — mirrors the FileGrid cleanup. We deliberately do
  // NOT clear on the card's own onDragEnd: with Electron's native startDrag the drop fires
  // during the OS drag loop, and an eager onDragEnd could wipe the marker before the drop reads
  // it, demoting an intended move to a copy.
  useEffect(() => {
    const cleanup = () => { window.setTimeout(() => clearInternalDrag(), 80); };
    window.addEventListener('dragend', cleanup);
    window.addEventListener('drop', cleanup);
    return () => {
      window.removeEventListener('dragend', cleanup);
      window.removeEventListener('drop', cleanup);
    };
  }, []);

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

  // ── Move items into a sub-folder (drag-and-drop or "Move to" menu) ──────────
  const moveItemsTo = useCallback(async (paths: string[], targetFolder: FileItem, copy = false) => {
    try {
      const results = copy
        ? await window.electronAPI.copyFilesWithConflictResolution(paths, targetFolder.path)
        : await window.electronAPI.moveFilesWithConflictResolution(paths, targetFolder.path);
      const ok = results.filter((r: any) => r.status === 'success').length;
      const failed = results.filter((r: any) => r.status === 'error').length;
      let message = `${copy ? 'Copied' : 'Moved'} ${ok} item${ok !== 1 ? 's' : ''} to ${targetFolder.name}`;
      if (failed > 0) message += `, ${failed} failed`;
      addLog(message, failed > 0 ? 'error' : undefined);
      setStatus(message, failed > 0 ? 'error' : 'success');
      await loadContents();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`${copy ? 'Copy' : 'Move'} to ${targetFolder.name} failed: ${msg}`, 'error');
      setStatus(`${copy ? 'Copy' : 'Move'} failed`, 'error');
    }
  }, [addLog, setStatus, loadContents]);

  const handleDropOnFolder = useCallback(async (e: React.DragEvent, folder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const { paths, isInternal } = readDragPayload(e);
    clearInternalDrag();
    console.log('[CardView] drop on folder', { folder: folder.path, paths, isInternal });
    if (paths.length === 0) return;

    const { movable, droppedSelf, allAlreadyInTarget } = partitionDropPaths(paths, folder.path);
    if (movable.length === 0) {
      if (droppedSelf) setStatus("Can't move a folder into itself", 'error');
      return;
    }
    if (allAlreadyInTarget) {
      setStatus(`Items are already in ${folder.name}`, 'info');
      return;
    }

    // Internal drags move (Ctrl to copy); drops from outside DocuFrame copy
    await moveItemsTo(movable, folder, !isInternal || e.ctrlKey);
  }, [moveItemsTo, setStatus]);

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
      <Box
        h="100%"
        overflow="auto"
        position="relative"
        zIndex={1}
        px={6}
        py={6}
        onContextMenu={(e) => {
          e.preventDefault();
          setCardMenu((m) => ({ ...m, isOpen: false }));
          setBlankMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } });
        }}
      >
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
              const isDropTarget = isFolder && dropTarget === item.path;
              return (
                <Flex
                  key={item.path}
                  direction="column"
                  align="center"
                  justify="center"
                  gap={isFolder ? 3 : 2}
                  h={CARD_H}
                  px={3}
                  borderRadius="12px"
                  borderWidth="1px"
                  borderStyle={isFolder ? 'solid' : 'dashed'}
                  borderColor={isDropTarget ? ACCENT : isFolder ? s.border : strayBorder}
                  bg={isDropTarget ? dropBg : isFolder ? s.bg : strayBg}
                  cursor="pointer"
                  userSelect="none"
                  position="relative"
                  transition="all 0.14s ease"
                  boxShadow={isDropTarget ? `0 0 0 2px rgba(59,130,246,0.25), 0 6px 18px rgba(0,0,0,0.18)` : undefined}
                  transform={isDropTarget ? 'translateY(-2px) scale(1.02)' : undefined}
                  _hover={{
                    borderColor: isDropTarget ? ACCENT : !isFolder ? strayBorder : theme === 'neutral' ? cardHoverBorder : s.border,
                    bg: isDropTarget ? dropBg : !isFolder ? strayBg : theme === 'neutral' ? cardHoverBg : s.bg,
                    transform: isDropTarget ? 'translateY(-2px) scale(1.02)' : 'translateY(-2px)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                  }}
                  title={isFolder ? undefined : 'Files don\'t usually live at this level — drag onto a folder to move it, or right-click for options'}
                  draggable
                  onDragStart={(e) => {
                    console.log('[CardView] dragstart', item.path, 'nativeDrag?', typeof (window as any).electron?.startDrag === 'function');
                    beginInternalDrag(e, [item.path]);
                  }}
                  onClick={() => {
                    if (isFolder) setCurrentDirectory(item.path);
                    else window.electronAPI.openFile?.(item.path);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBlankMenu((m) => ({ ...m, isOpen: false }));
                    setCardMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, item });
                  }}
                  {...(isFolder
                    ? {
                        onDragOver: (e: React.DragEvent) => {
                          if (!isDragAccepted(e)) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const internal = e.dataTransfer.types.includes('application/x-docuframe-files') || !!(window as any).__docuframeInternalDrag;
                          e.dataTransfer.dropEffect = internal ? (e.ctrlKey ? 'copy' : 'move') : 'copy';
                          setDropTarget(item.path);
                        },
                        onDragLeave: () => setDropTarget((t) => (t === item.path ? null : t)),
                        onDrop: (e: React.DragEvent) => void handleDropOnFolder(e, item),
                      }
                    : {})}
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
                      pointerEvents="none"
                    />
                  )}
                  {isFolder ? (
                    <Folder size={46} color={isDropTarget ? ACCENT : s.icon} strokeWidth={1.6} fill={theme !== 'neutral' ? s.icon : 'none'} fillOpacity={theme !== 'neutral' ? 0.12 : 0} style={{ pointerEvents: 'none' }} />
                  ) : (
                    <FileIcon size={38} color={strayIcon} strokeWidth={1.6} style={{ pointerEvents: 'none' }} />
                  )}
                  <Text
                    fontSize="14px"
                    fontWeight="600"
                    color={nameColor}
                    textAlign="center"
                    lineClamp={2}
                    px={1}
                    pointerEvents="none"
                  >
                    {item.name}
                  </Text>
                  {!isFolder && (
                    <Text fontSize="10px" fontWeight="600" color={strayIcon} textAlign="center" pointerEvents="none" letterSpacing="0.04em">
                      loose file — drag into a folder
                    </Text>
                  )}
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

      {/* Card context menu */}
      <FloatingMenu isOpen={cardMenu.isOpen && !!cardMenu.item} position={cardMenu.position} onClose={closeCardMenu}>
        {cardMenu.item && (
          <>
            <MenuRow
              icon={cardMenu.item.type === 'folder' ? <Folder size={14} /> : <ExternalLink size={14} />}
              label="Open"
              emphasized
              onClick={() => {
                const item = cardMenu.item!;
                closeCardMenu();
                if (item.type === 'folder') setCurrentDirectory(item.path);
                else window.electronAPI.openFile?.(item.path);
              }}
            />
            {cardMenu.item.type === 'folder' && (
              <>
                <MenuRow
                  icon={<ExternalLink size={14} />}
                  label="Open folder in new tab"
                  onClick={() => {
                    const item = cardMenu.item!;
                    closeCardMenu();
                    addTabToCurrentWindow(item.path);
                    setStatus(`Opened new tab for ${item.name}`, 'info');
                  }}
                />
                {quickAccessPaths.includes(cardMenu.item.path) ? (
                  <MenuRow
                    icon={<Star size={14} />}
                    label="Unpin from Quick Access"
                    onClick={() => {
                      const item = cardMenu.item!;
                      closeCardMenu();
                      void removeQuickAccessPath(item.path);
                    }}
                  />
                ) : (
                  <MenuRow
                    icon={<Star size={14} />}
                    label="Pin to Quick Access"
                    onClick={() => {
                      const item = cardMenu.item!;
                      closeCardMenu();
                      void addQuickAccessPath(item.path);
                    }}
                  />
                )}
                <MenuRow
                  icon={<Terminal size={14} />}
                  label="Open PowerShell here"
                  onClick={() => {
                    const item = cardMenu.item!;
                    closeCardMenu();
                    void (window.electronAPI as any).openCmdAtDirectory(item.path);
                  }}
                />
              </>
            )}
            {(() => {
              const moveTargets = sortedItems.filter(
                (f) => f.type === 'folder' && f.path !== cardMenu.item!.path
              );
              if (moveTargets.length === 0) return null;
              return (
                <>
                  <MenuSeparator />
                  <ContextSubmenu id="move-to" icon={<FolderInput size={14} />} label="Move to" flyoutMaxH="280px">
                    {moveTargets.map((folder) => (
                      <MenuRow
                        key={folder.path}
                        icon={<Folder size={13} />}
                        label={folder.name}
                        onClick={() => {
                          const item = cardMenu.item!;
                          closeCardMenu();
                          void moveItemsTo([item.path], folder);
                        }}
                      />
                    ))}
                  </ContextSubmenu>
                </>
              );
            })()}
            <MenuSeparator />
            <MenuRow
              icon={<Link2 size={14} />}
              label="Copy Path"
              onClick={() => {
                const item = cardMenu.item!;
                closeCardMenu();
                void navigator.clipboard.writeText(item.path);
                setStatus(`Copied path: ${item.path}`, 'info');
              }}
            />
            <MenuSeparator />
            <MenuRow
              icon={<Trash2 size={14} />}
              label="Delete"
              danger
              onClick={async () => {
                const item = cardMenu.item!;
                closeCardMenu();
                try {
                  const confirmed = await (window.electronAPI as any).confirmDelete([item.name]);
                  if (!confirmed) return;
                  await window.electronAPI.deleteItem(item.path);
                  addLog(`Deleted ${item.name}`);
                  setStatus(`Deleted ${item.name}`, 'success');
                  await loadContents();
                } catch (error) {
                  addLog(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                  setStatus(`Failed to delete ${item.name}`, 'error');
                }
              }}
            />
            <MenuRow
              icon={<Info size={14} />}
              label="Properties"
              onClick={() => {
                const item = cardMenu.item!;
                closeCardMenu();
                void window.electronAPI.showProperties(item.path);
              }}
            />
          </>
        )}
      </FloatingMenu>

      {/* Blank-space context menu */}
      <FloatingMenu isOpen={blankMenu.isOpen} position={blankMenu.position} onClose={closeBlankMenu}>
        <MenuRow
          icon={<FolderPlus size={14} />}
          label="New Folder"
          onClick={() => {
            closeBlankMenu();
            startAdding();
          }}
        />
        <MenuRow
          icon={<RefreshCw size={14} />}
          label="Refresh"
          onClick={() => {
            closeBlankMenu();
            void loadContents();
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
