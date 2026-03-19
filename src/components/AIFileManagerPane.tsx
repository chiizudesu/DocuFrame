import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Text,
  Flex,
  VStack,
  Input,
  Spinner,
  useColorModeValue,
  Icon,
  IconButton,
  Checkbox,
  Image,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { X, Check, AlertCircle, Loader2, Send, FolderOpen, FileText, Undo2, Merge, FileStack, Trash2, FolderInput, FolderOutput, Eraser } from 'lucide-react';
import { useAIFileManagerContextSelection } from '../context/AppContext';
import {
  parseFileManagerCommand,
  expandOperationsToPlannedItems,
  expandExtractOperations,
  expandContentBasedRenameOperations,
  expandContentBasedMergeOperations,
  executePlannedItems,
  revertUndoEntry,
  getSmartRenameSuggestions,
  getMatchingItemsForCondition,
  type PlannedItem,
  type UndoEntry,
} from '../services/aiFileManagerService';
import { extractIndexPrefix } from '../utils/indexPrefix';
import { getParentPath } from '../utils/path';

const pulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  50% { opacity: 0.9; box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.4); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const readingProgress = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(250%); }
`;

export const AIFileManagerPane: React.FC = () => {
  const {
    currentDirectory,
    folderItems,
    isAIFileManagerOpen,
    setIsAIFileManagerOpen,
    fileManagerInitialSelection,
    setFileManagerInitialSelection,
    addLog,
    setStatus,
    logFileOperation,
  } = useAIFileManagerContextSelection();

  const [command, setCommand] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  const [recentlyChangedNames, setRecentlyChangedNames] = useState<Set<string>>(new Set());
  const [recentlyRevertedNames, setRecentlyRevertedNames] = useState<Set<string>>(new Set());
  const [recentlyTransferredFolder, setRecentlyTransferredFolder] = useState<string | null>(null);
  const [contentReadingState, setContentReadingState] = useState<{ fileName: string; index: number; total: number } | null>(null);
  const [contentAnalyzingState, setContentAnalyzingState] = useState(false);
  const [undoEntriesByDirectory, setUndoEntriesByDirectory] = useState<Record<string, UndoEntry>>({});
  const listContainerRef = useRef<HTMLDivElement>(null);
  const loadingQueue = useRef<Set<string>>(new Set());
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const elementsToObserveRef = useRef<Map<HTMLElement, string>>(new Map());
  const nativeIconsRef = useRef(nativeIcons);
  nativeIconsRef.current = nativeIcons;
  const pendingIconsRef = useRef<Map<string, string>>(new Map());
  const flushScheduledRef = useRef(false);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickedIndexRef = useRef<number | undefined>(undefined);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const commandAreaRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue('#f8fafc', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const panelBg = useColorModeValue('gray.50', 'gray.700');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const textColorMuted = useColorModeValue('gray.600', 'gray.300');
  const textColorSubtle = useColorModeValue('gray.500', 'gray.400');
  const resultBg = useColorModeValue('#f8fafc', 'gray.900');
  const successColor = useColorModeValue('green.600', 'green.400');
  const errorColor = useColorModeValue('red.600', 'red.400');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const iconColor = useColorModeValue('gray.500', 'gray.400');
  const separatorColor = useColorModeValue('gray.300', 'gray.500');
  const headerStickyBg = useColorModeValue('gray.50', 'gray.900');
  const processingRowBg = useColorModeValue('gray.200', 'gray.600');
  const transferTargetBg = useColorModeValue('gray.200', 'gray.600');
  const deletePendingBg = useColorModeValue('red.50', 'red.900');
  const mergeSourceBg = useColorModeValue('gray.200', 'gray.600');
  const mergeGhostBg = useColorModeValue('green.50', 'green.900');
  const contentReadingBg = useColorModeValue('blue.50', 'blue.900');
  const commandAreaBg = useColorModeValue('gray.100', 'gray.600');

  const items = [...folderItems].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    if (a.type === 'folder' && b.type === 'folder') return a.name.localeCompare(b.name);
    const aIdx = extractIndexPrefix(a.name);
    const bIdx = extractIndexPrefix(b.name);
    if (aIdx && !bIdx) return -1;
    if (!aIdx && bIdx) return 1;
    return a.name.localeCompare(b.name);
  });

  const folders = items.filter(f => f.type === 'folder');
  const existingFolderNames = new Set(folders.map(f => f.name));
  const ghostFolders = React.useMemo(() => {
    const targets = new Set<string>();
    for (const p of plannedItems) {
      if (p.operation === 'move' && p.newName && !p.extractFrom) {
        const idx = p.newName.indexOf('/');
        if (idx >= 0) {
          const folder = p.newName.slice(0, idx);
          if (folder && !existingFolderNames.has(folder)) targets.add(folder);
        }
      }
    }
    return Array.from(targets).sort((a, b) => a.localeCompare(b));
  }, [plannedItems, existingFolderNames]);
  const allFoldersForDisplay = React.useMemo(() => {
    const combined = [
      ...folders.map(f => ({ name: f.name, path: f.path, type: 'folder' as const, isGhost: false })),
      ...ghostFolders.map(name => ({ name, path: '', type: 'folder' as const, isGhost: true })),
    ];
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [folders, ghostFolders]);
  const indexedFiles = items.filter(f => f.type !== 'folder' && extractIndexPrefix(f.name));
  const nonIndexedFiles = items.filter(f => f.type !== 'folder' && !extractIndexPrefix(f.name));
  const extractGhostFiles = React.useMemo(() => {
    const extractItems = plannedItems.filter(p => (p.operation === 'move' || p.operation === 'copy') && p.extractFrom);
    const existingNames = new Set(items.filter(f => f.type !== 'folder').map(f => f.name));
    return extractItems
      .filter(p => !existingNames.has(p.fileName))
      .map(p => ({ name: p.fileName, path: p.filePath, type: 'file' as const, isExtractGhost: true as const, extractFrom: p.extractFrom! }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedItems, items]);
  const mergeGhostItem = React.useMemo(() => {
    const m = plannedItems.find(p => p.operation === 'merge');
    return m ? { fileName: m.newName, outputPath: m.outputPath } : null;
  }, [plannedItems]);
  const targetFolderFromMove = React.useMemo(() => {
    const moveItems = plannedItems.filter(p => p.operation === 'move');
    if (moveItems.length === 0) return null;
    const idx = moveItems[0].newName.indexOf('/');
    return idx >= 0 ? moveItems[0].newName.slice(0, idx) : null;
  }, [plannedItems]);
  const createCopiesGhostFiles = React.useMemo(() => {
    const bySource = new Map<string, PlannedItem[]>();
    for (const p of plannedItems) {
      if (p.operation === 'copy') {
        const list = bySource.get(p.fileName) || [];
        list.push(p);
        bySource.set(p.fileName, list);
      }
    }
    const result: Array<{ name: string; path: string; type: 'file'; isCreateGhost: true }> = [];
    for (const [, list] of bySource) {
      if (list.length > 1) {
        for (const p of list) {
          result.push({ name: p.newName, path: '', type: 'file', isCreateGhost: true });
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [plannedItems]);
  const groups = [
    { items: allFoldersForDisplay, key: 'folders', isFolderGroup: true },
    ...(extractGhostFiles.length > 0 ? [{ items: extractGhostFiles, key: 'extract', isFolderGroup: false }] : []),
    ...(createCopiesGhostFiles.length > 0 ? [{ items: createCopiesGhostFiles, key: 'createCopies', isFolderGroup: false }] : []),
    { items: indexedFiles, key: 'indexed', isFolderGroup: false },
    { items: nonIndexedFiles, key: 'nonIndexed', isFolderGroup: false },
  ].filter(g => g.items.length > 0);

  const isPreviewMode = plannedItems.length > 0;

  // Find undo entry for current directory or any ancestor (e.g. after "group into folders" you may be viewing a child folder)
  const effectiveUndoEntry = React.useMemo(() => {
    if (!currentDirectory) return null;
    let dir: string | undefined = currentDirectory;
    while (dir) {
      const entry = undoEntriesByDirectory[dir];
      if (entry) return { entry, directory: dir };
      const parent = getParentPath(dir);
      dir = parent && parent !== dir ? parent : undefined;
    }
    return null;
  }, [currentDirectory, undoEntriesByDirectory]);

  const plannedByFileName = React.useMemo(() => {
    const m = new Map<string, PlannedItem>();
    for (const p of plannedItems) {
      if (p.operation === 'merge' && p.sourcePaths) {
        for (const fp of p.sourcePaths) {
          const name = fp.split(/[/\\]/).pop();
          if (name) m.set(name, p);
        }
      } else {
        m.set(p.fileName, p);
      }
    }
    return m;
  }, [plannedItems]);

  const plannedItemsBySource = React.useMemo(() => {
    const m = new Map<string, PlannedItem[]>();
    for (const p of plannedItems) {
      if (p.operation === 'merge' && p.sourcePaths) {
        for (const fp of p.sourcePaths) {
          const name = fp.split(/[/\\]/).pop();
          if (name) {
            const list = m.get(name) || [];
            list.push(p);
            m.set(name, list);
          }
        }
      } else {
        const list = m.get(p.fileName) || [];
        list.push(p);
        m.set(p.fileName, list);
      }
    }
    return m;
  }, [plannedItems]);

  const Separator = () => (
    <Box h="1px" bg={separatorColor} mx={2} my={1.5} flexShrink={0} opacity={0.9} />
  );

  // Clear cached icons, planned items, and selection when directory changes (keep undo history per directory)
  useEffect(() => {
    setNativeIcons(new Map());
    setPlannedItems([]);
    setSelectedFileNames(new Set());
    lastClickedIndexRef.current = undefined;
    elementsToObserveRef.current.clear();
    setRecentlyRevertedNames(new Set());
    setRecentlyTransferredFolder(null);
  }, [currentDirectory]);

  // Apply initial selection when opened from context menu "Add selection to file manager"
  useEffect(() => {
    if (isAIFileManagerOpen && fileManagerInitialSelection && fileManagerInitialSelection.length > 0) {
      setSelectedFileNames(new Set(fileManagerInitialSelection));
      setFileManagerInitialSelection(null);
    }
  }, [isAIFileManagerOpen, fileManagerInitialSelection, setFileManagerInitialSelection]);

  // Batched flush for native icons (reduces re-renders from N to 1 per batch)
  const flushPendingIcons = useCallback(() => {
    flushScheduledRef.current = false;
    if (pendingIconsRef.current.size === 0) return;
    const toMerge = new Map(pendingIconsRef.current);
    pendingIconsRef.current.clear();
    setNativeIcons(prev => {
      let changed = false;
      const next = new Map(prev);
      toMerge.forEach((data, path) => {
        if (!next.has(path)) {
          next.set(path, data);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const scheduleFlushIcons = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    flushTimeoutRef.current = setTimeout(flushPendingIcons, 100);
  }, [flushPendingIcons]);

  // Load icon for a file (called when visible via IntersectionObserver, batched)
  const loadIconForFile = useCallback(async (filePath: string) => {
    if (loadingQueue.current.has(filePath) || nativeIconsRef.current.has(filePath)) return;
    loadingQueue.current.add(filePath);
    try {
      const iconData = await window.electronAPI?.getFileIcon(filePath);
      if (iconData) {
        if (nativeIconsRef.current.has(filePath)) return;
        pendingIconsRef.current.set(filePath, iconData);
        scheduleFlushIcons();
      }
    } catch {
      /* ignore */
    } finally {
      loadingQueue.current.delete(filePath);
    }
  }, [scheduleFlushIcons]);

  const observeFileElement = useCallback((el: HTMLElement | null, filePath: string) => {
    if (!filePath) return;
    if (el) {
      el.setAttribute('data-file-path', filePath);
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.observe(el);
      } else {
        elementsToObserveRef.current.set(el, filePath);
      }
    }
  }, []);

  // IntersectionObserver for lazy icon loading on scroll
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon || !listContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const filePath = entry.target.getAttribute('data-file-path');
            if (filePath && !loadingQueue.current.has(filePath)) {
              loadIconForFile(filePath);
            }
          }
        });
      },
      { root: listContainerRef.current, rootMargin: '100px', threshold: 0.1 }
    );
    intersectionObserverRef.current = observer;
    elementsToObserveRef.current.forEach((_path, el) => {
      observer.observe(el);
    });
    elementsToObserveRef.current.clear();
    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
      loadingQueue.current.clear();
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, [loadIconForFile]);

  // Load initial batch of visible icons
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon) return;
    const files = folderItems.filter(f => f.type !== 'folder');
    const toLoad = files.filter(f => !loadingQueue.current.has(f.path) && !nativeIconsRef.current.has(f.path)).slice(0, 10);
    toLoad.forEach(f => loadIconForFile(f.path));
  }, [folderItems, currentDirectory, loadIconForFile]);

  const toggleFileSelection = useCallback((name: string) => {
    setSelectedFileNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedFileNames.size > 0) {
      setSelectedFileNames(new Set());
    } else {
      setSelectedFileNames(new Set(items.map(f => f.name)));
    }
  }, [items, selectedFileNames.size]);

  const flatListForSelection = React.useMemo(
    () => groups.flatMap(g => g.items),
    [groups]
  );

  const handleRowClick = useCallback(
    (name: string, index: number, e: React.MouseEvent) => {
      if (e.shiftKey) {
        const last = lastClickedIndexRef.current;
        if (last !== undefined) {
          const start = Math.min(last, index);
          const end = Math.max(last, index);
          const rangeNames = flatListForSelection.slice(start, end + 1).map(item => item.name);
          setSelectedFileNames(prev => {
            const next = new Set(prev);
            for (const n of rangeNames) next.add(n);
            return next;
          });
          return;
        }
      }
      toggleFileSelection(name);
      lastClickedIndexRef.current = index;
    },
    [flatListForSelection, toggleFileSelection]
  );

  const handleSubmit = useCallback(async (overrideCommand?: string) => {
    const trimmed = (overrideCommand ?? command).trim();
    if (!trimmed) return;
    if (!currentDirectory) {
      setParseError('No directory selected');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setPlannedItems([]);

    try {
      const selected = selectedFileNames.size > 0 ? Array.from(selectedFileNames) : undefined;
      const operations = await parseFileManagerCommand(
        trimmed,
        currentDirectory,
        folderItems,
        'sonnet',
        selected
      );

      if (operations.length === 0) {
        setParseError('No operations understood. Try rephrasing (e.g. "add prefix A1 to selection").');
        setPlannedItems([]);
        return;
      }

      const smartRenameOps = operations.filter((op): op is typeof op & { action: 'smartRename' } => op.action === 'smartRename');
      const contentBasedRenameOps = operations.filter((op): op is typeof op & { action: 'contentBasedRename' } => op.action === 'contentBasedRename');
      const contentBasedMergeOps = operations.filter((op): op is typeof op & { action: 'contentBasedMerge' } => op.action === 'contentBasedMerge');
      const extractOps = operations.filter((op): op is typeof op & { action: 'extract' } => op.action === 'extract');
      const otherOps = operations.filter(op => op.action !== 'smartRename' && op.action !== 'contentBasedRename' && op.action !== 'contentBasedMerge' && op.action !== 'extract');

      let items: PlannedItem[] = [];

      if (otherOps.length > 0) {
        items = expandOperationsToPlannedItems(otherOps, folderItems, currentDirectory, selected);
      }

      if (extractOps.length > 0) {
        const extractItems = await expandExtractOperations(extractOps, currentDirectory, folderItems, selected);
        items = [...items, ...extractItems];
      }

      if (contentBasedRenameOps.length > 0) {
        const contentItems = await expandContentBasedRenameOperations(
          contentBasedRenameOps,
          folderItems,
          currentDirectory,
          trimmed,
          selected,
          'sonnet',
          (fileName, index, total) => {
            setContentReadingState(fileName ? { fileName, index, total } : null);
          },
          (analyzing) => setContentAnalyzingState(analyzing)
        );
        items = [...items, ...contentItems];
      }

      if (contentBasedMergeOps.length > 0) {
        const mergeItems = await expandContentBasedMergeOperations(
          contentBasedMergeOps,
          folderItems,
          currentDirectory,
          selected,
          'sonnet',
          (fileName, index, total) => {
            setContentReadingState(fileName ? { fileName, index, total } : null);
          },
          (analyzing) => setContentAnalyzingState(analyzing)
        );
        items = [...items, ...mergeItems];
      }

      for (const op of smartRenameOps) {
        const matching = getMatchingItemsForCondition(op.condition, folderItems, selected);
        if (matching.length === 0) continue;
        const suggestions = await getSmartRenameSuggestions(matching, trimmed, 'sonnet');
        for (const s of suggestions) {
          const file = matching.find(f => f.name === s.fileName);
          if (!file || s.newName === s.fileName) continue;
          items.push({
            fileName: file.name,
            filePath: file.path,
            operation: 'rename',
            newName: s.newName,
            status: 'pending',
            isFolder: file.type === 'folder',
          });
        }
      }

      if (items.length === 0) {
        setParseError('No matching files found for the requested operations.');
        setPlannedItems([]);
        return;
      }

      setPlannedItems(items);
      addLog(`AI parsed: ${items.length} file(s) to process`, 'info');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg);
      addLog(`AI parse failed: ${msg}`, 'error');
    } finally {
      setIsParsing(false);
      setContentReadingState(null);
      setContentAnalyzingState(false);
    }
  }, [command, currentDirectory, folderItems, selectedFileNames, addLog]);

  const handleApply = useCallback(async () => {
    if (plannedItems.length === 0) return;

    setIsExecuting(true);
    setStatus(`Processing ${plannedItems.length} file(s)...`, 'info');

    const successfulNewNames = new Set<string>();
    const namesToRemoveFromSelection = new Set<string>();
    const updateItem = (index: number, updates: Partial<PlannedItem>) => {
      if (updates.status === 'done') {
        const item = plannedItems[index];
        if (item) {
          successfulNewNames.add(item.newName || item.fileName);
          if (item.operation === 'delete') namesToRemoveFromSelection.add(item.fileName);
          else if (item.operation === 'move') namesToRemoveFromSelection.add(item.fileName);
          else if (item.operation === 'rename') namesToRemoveFromSelection.add(item.fileName);
          else if (item.operation === 'merge' && item.sourcePaths) {
            for (const p of item.sourcePaths) {
              const name = p.split(/[/\\]/).pop();
              if (name) namesToRemoveFromSelection.add(name);
            }
          }
        }
      }
      setPlannedItems(prev => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], ...updates };
        return next;
      });
    };

    try {
      const { result, undoEntry: newUndoEntry } = await executePlannedItems(
        plannedItems,
        currentDirectory,
        (index, _item, status, error) => {
          updateItem(index, { status, error });
        }
      );

      setStatus(
        `Done. ${result.successful} succeeded${result.failed > 0 ? `, ${result.failed} failed` : ''}${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`,
        result.failed > 0 ? 'error' : 'success'
      );
      addLog(
        `AI file manager: ${result.successful} succeeded, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'info'
      );

      if (result.successful > 0) {
        logFileOperation('AI file manager', `${result.successful} files processed`);
        setRecentlyChangedNames(new Set(successfulNewNames));
        setTimeout(() => setRecentlyChangedNames(new Set()), 5000);
        if (namesToRemoveFromSelection.size > 0) {
          setSelectedFileNames(prev => {
            const next = new Set(prev);
            for (const n of namesToRemoveFromSelection) next.delete(n);
            return next;
          });
        }
        const hadMoves = plannedItems.some(p => p.operation === 'move');
        const moveFolder = hadMoves && plannedItems.find(p => p.operation === 'move');
        if (moveFolder && moveFolder.newName) {
          const idx = moveFolder.newName.indexOf('/');
          const folderName = idx >= 0 ? moveFolder.newName.slice(0, idx) : moveFolder.newName;
          setRecentlyTransferredFolder(folderName);
          setTimeout(() => setRecentlyTransferredFolder(null), 3000);
        }
        setPlannedItems([]);

        if (newUndoEntry) {
          setUndoEntriesByDirectory(prev => ({ ...prev, [currentDirectory]: newUndoEntry }));
        }

        window.dispatchEvent(
          new CustomEvent('forceDirectoryReload', { detail: { directory: currentDirectory } })
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Execution failed: ${msg}`, 'error');
      addLog(`AI execution failed: ${msg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [plannedItems, currentDirectory, setStatus, addLog, logFileOperation]);

  const handleRevert = useCallback(async () => {
    const effective = effectiveUndoEntry;
    if (!effective) return;
    const { entry: undoEntry, directory: undoDir } = effective;
    setIsExecuting(true);
    setStatus('Reverting last changes...', 'info');
    try {
      const result = await revertUndoEntry(undoEntry);
      setStatus(
        `Reverted. ${result.successful} succeeded${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        result.failed > 0 ? 'error' : 'success'
      );
      addLog(`AI file manager: reverted ${result.successful} file(s)`, result.failed > 0 ? 'error' : 'info');
      if (result.successful > 0) {
        setUndoEntriesByDirectory(prev => {
          const next = { ...prev };
          delete next[undoDir];
          return next;
        });
        const revertedNames = new Set<string>();
        for (const item of undoEntry.items) {
          if (item.operation === 'rename') {
            const name = item.sourcePath.split(/[/\\]/).pop();
            if (name) revertedNames.add(name);
          } else if (item.operation === 'merge' && item.originalsWereDeleted && item.originalPaths) {
            for (const p of item.originalPaths) {
              const name = p.split(/[/\\]/).pop();
              if (name) revertedNames.add(name);
            }
          } else if (item.operation === 'move') {
            const name = item.fromPath.split(/[/\\]/).pop();
            if (name) revertedNames.add(name);
          } else if (item.operation === 'delete') {
            const name = item.originalPath.split(/[/\\]/).pop();
            if (name) revertedNames.add(name);
          }
        }
        setRecentlyRevertedNames(revertedNames);
        setTimeout(() => setRecentlyRevertedNames(new Set()), 5000);
        window.dispatchEvent(
          new CustomEvent('forceDirectoryReload', { detail: { directory: undoDir } })
        );
        if (currentDirectory !== undoDir) {
          window.dispatchEvent(
            new CustomEvent('forceDirectoryReload', { detail: { directory: currentDirectory } })
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Revert failed: ${msg}`, 'error');
      addLog(`AI revert failed: ${msg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [effectiveUndoEntry, currentDirectory, setStatus, addLog]);

  const handleClear = useCallback(() => {
    setCommand('');
    setParseError(null);
    setPlannedItems([]);
  }, []);

  const handlePaneClick = useCallback((e: React.MouseEvent) => {
    if (commandAreaRef.current && !commandAreaRef.current.contains(e.target as Node)) {
      commandInputRef.current?.blur();
    }
  }, []);

  return (
    <Box flex={1} bg={bgColor} display="flex" flexDirection="column" overflow="hidden" onClick={handlePaneClick}>
      {/* Header */}
      <Flex
        py={3}
        px={4}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        justify="space-between"
        bg={itemBgColor}
      >
        <Text fontSize="lg" fontWeight="semibold" color={textColor}>
          File Manager
        </Text>
        <Flex align="center" gap={2}>
          {effectiveUndoEntry && (
            <IconButton
              aria-label="Revert last changes"
              title="Revert last applied changes"
              icon={<Undo2 size={16} />}
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={handleRevert}
              isDisabled={isExecuting}
            />
          )}
          <IconButton
            aria-label="Close"
            icon={<X size={16} />}
            size="sm"
            variant="ghost"
            onClick={() => setIsAIFileManagerOpen(false)}
          />
        </Flex>
      </Flex>

      {/* File grid above */}
      <Box
        flex="1"
        minH="120px"
        display="flex"
        flexDirection="column"
        p={4}
        overflow="hidden"
        borderBottom="1px solid"
        borderColor={borderColor}
      >
        <Box
          ref={listContainerRef}
          bg={resultBg}
          borderRadius="md"
          borderWidth="1px"
          borderColor={borderColor}
          flex="1"
          minH={0}
          overflow="auto"
          pt={0}
          px={2}
          pb={2}
          onClick={() => commandInputRef.current?.blur()}
        >
          {!currentDirectory && (
            <Flex justify="center" align="center" flex="1" minH="80px">
              <Text fontSize="sm" color={textColorSubtle} textAlign="center">
                Open a folder to use AI file manager.
              </Text>
            </Flex>
          )}
          {currentDirectory && !isPreviewMode && items.length === 0 && (
            <Flex justify="center" align="center" flex="1" minH="80px">
              <Text fontSize="sm" color={textColorSubtle} textAlign="center">
                No files or folders in this directory.
              </Text>
            </Flex>
          )}
          {currentDirectory && items.length > 0 && (
            <VStack align="stretch" spacing={0} userSelect={!isPreviewMode ? 'none' : undefined}>
              <Flex
                position="sticky"
                top={0}
                zIndex={100}
                bg={contentReadingState || contentAnalyzingState ? contentReadingBg : headerStickyBg}
                borderBottomWidth="1px"
                borderBottomStyle="solid"
                borderBottomColor={separatorColor}
                boxShadow="0 1px 3px 0 rgba(0,0,0,0.1)"
                px={2}
                py={1.5}
                align="center"
                justify="space-between"
                minH="28px"
                minW={0}
                overflow="hidden"
                mx={-2}
                mb={1}
                pl={4}
                pr={4}
              >
                <Flex
                  align="center"
                  gap={2}
                  flex={1}
                  minW={0}
                  _hover={!isPreviewMode ? { bg: hoverBg } : undefined}
                  borderRadius="md"
                  cursor={!isPreviewMode ? 'pointer' : undefined}
                  onClick={!isPreviewMode ? toggleSelectAll : undefined}
                >
                  <Checkbox
                    isChecked={isPreviewMode ? false : selectedFileNames.size === items.length && items.length > 0}
                    isIndeterminate={!isPreviewMode && selectedFileNames.size > 0 && selectedFileNames.size < items.length}
                    onChange={() => {}}
                    size="sm"
                    isDisabled={isPreviewMode}
                    opacity={isPreviewMode ? 0.5 : 1}
                  />
                  <Box flex={1} minW={0} overflow="hidden" title={contentReadingState ? `Reading ${contentReadingState.index} of ${contentReadingState.total}: ${contentReadingState.fileName}` : undefined}>
                    <Text
                      fontSize="xs"
                      color={textColorMuted}
                      as="span"
                      display="block"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {contentReadingState
                      ? `Reading ${contentReadingState.index} of ${contentReadingState.total}: ${contentReadingState.fileName}`
                      : contentAnalyzingState
                      ? 'Analyzing content...'
                      : isPreviewMode
                      ? (isExecuting
                        ? `Processing ${plannedItems.filter(i => i.status === 'done' || i.status === 'failed').length} of ${plannedItems.length}`
                        : (() => {
                            const hasMove = plannedItems.some(i => i.operation === 'move');
                            const hasDelete = plannedItems.some(i => i.operation === 'delete');
                            const hasMerge = plannedItems.some(i => i.operation === 'merge');
                            const hasCopy = plannedItems.some(i => i.operation === 'copy');
                            const hasRename = plannedItems.some(i => i.operation === 'rename');
                            const hasExtract = plannedItems.some(i => i.extractFrom);
                            const actions: string[] = [];
                            if (hasMove) actions.push('moved');
                            if (hasExtract) actions.push('extracted');
                            if (hasDelete) actions.push('deleted');
                            if (hasMerge) actions.push('merged');
                            if (hasCopy) actions.push('copied');
                            if (hasRename) actions.push('renamed');
                            return `${plannedItems.length} file(s) will be ${actions.join(', ') || 'processed'}`;
                          })())
                      : `${selectedFileNames.size} of ${items.length} selected`}
                    </Text>
                  </Box>
                </Flex>
                <Flex align="center" gap={1} flexShrink={0} onClick={e => e.stopPropagation()}>
                {isPreviewMode ? (
                  <Flex align="center" gap={1} flexShrink={0}>
                    <IconButton
                      aria-label="Apply changes"
                      icon={<Check size={14} />}
                      size="xs"
                      colorScheme="green"
                      onClick={handleApply}
                      isDisabled={isExecuting}
                    />
                    <IconButton
                      aria-label="Cancel pending action"
                      icon={<X size={12} />}
                      size="xs"
                      variant="ghost"
                      onClick={handleClear}
                      isDisabled={isExecuting}
                    />
                  </Flex>
                ) : (
                  <Box w="52px" flexShrink={0} />
                )}
                </Flex>
                {(contentReadingState || contentAnalyzingState) && (
                  <Box
                    position="absolute"
                    bottom={0}
                    left={0}
                    right={0}
                    h="2px"
                    bg="blue.200"
                    overflow="hidden"
                  >
                    <Box
                      h="100%"
                      w="40%"
                      bg="blue.500"
                      animation={`${readingProgress} 1.2s ease-in-out infinite`}
                    />
                  </Box>
                )}
              </Flex>
              {(() => {
                let globalIndex = 0;
                return groups.map((group, gi) => (
                <React.Fragment key={group.key}>
                  {gi > 0 && <Separator />}
                  {group.items.map((f, fi) => {
                    const currentIndex = globalIndex++;
                    const planned = plannedByFileName.get(f.name);
                    const isRecentlyChanged = recentlyChangedNames.has(f.name);
                    const isRecentlyReverted = recentlyRevertedNames.has(f.name);
                    const prevItem = fi > 0 ? group.items[fi - 1] : null;
                    const nextItem = fi < group.items.length - 1 ? group.items[fi + 1] : null;
                    const prevPlanned = prevItem ? plannedByFileName.get(prevItem.name) : null;
                    const nextPlanned = nextItem ? plannedByFileName.get(nextItem.name) : null;
                    const prevIsChanged = prevItem && recentlyChangedNames.has(prevItem.name);
                    const nextIsChanged = nextItem && recentlyChangedNames.has(nextItem.name);
                    const prevIsReverted = prevItem && recentlyRevertedNames.has(prevItem.name);
                    const nextIsReverted = nextItem && recentlyRevertedNames.has(nextItem.name);
                    const showSectionSeparator = planned && prevPlanned;
                    const rowPy = 1.5;
                    const isGhostFolder = (f as { isGhost?: boolean }).isGhost === true;
                    const isExtractGhost = (f as { isExtractGhost?: boolean }).isExtractGhost === true;
                    const isCreateGhost = (f as { isCreateGhost?: boolean }).isCreateGhost === true;
                    const isTargetFolder = f.type === 'folder' && f.name === targetFolderFromMove;
                    const isRecentlyTransferred = f.type === 'folder' && f.name === recentlyTransferredFolder;
                    const isContentReading = contentReadingState?.fileName === f.name;
                    const isDeletePending = planned?.operation === 'delete';
                    const isMergeSource = planned?.operation === 'merge';
                    const isLastMergeSource = planned?.operation === 'merge' && nextPlanned?.operation !== 'merge';
                    const fileRowBg =
                      isContentReading ? contentReadingBg
                      : isDeletePending ? deletePendingBg
                      : isMergeSource ? mergeSourceBg
                      : isTargetFolder ? transferTargetBg
                      : undefined;
                    const copyItemsForFile = (plannedItemsBySource.get(f.name) || []).filter(p => p.operation === 'copy');
                    const proposalText =
                      planned?.extractFrom
                        ? (planned?.operation === 'copy'
                          ? `To copy from ${planned.extractFrom}`
                          : `To extract from ${planned.extractFrom}`)
                        : planned?.operation === 'move'
                        ? `To move to ${planned.newName}`
                        : planned?.operation === 'delete'
                        ? 'To delete'
                        : planned?.operation === 'merge'
                        ? `→ merge into ${planned.newName}`
                        : copyItemsForFile.length > 1
                        ? `→ ${copyItemsForFile.length} copies to ${copyItemsForFile.map(p => p.newName).join(', ')}`
                        : planned?.operation === 'copy'
                        ? `→ copy to ${planned.newName}`
                        : `→ ${planned?.newName || ''}`;
                    const fileRow = (
                      <Box position="relative" overflow="hidden">
                      <Flex
                        ref={(el) => f.type !== 'folder' && observeFileElement(el, f.path)}
                        px={2}
                        py={rowPy}
                        align="center"
                        gap={2}
                        bg={fileRowBg}
                        opacity={isGhostFolder || isExtractGhost || isCreateGhost ? 0.65 : 1}
                        fontStyle={isGhostFolder || isExtractGhost || isCreateGhost ? 'italic' : undefined}
                        _hover={!isPreviewMode ? { bg: hoverBg } : undefined}
                        borderRadius={0}
                        cursor={!isPreviewMode ? 'pointer' : undefined}
                        onClick={!isPreviewMode ? (e) => handleRowClick(f.name, currentIndex, e) : undefined}
                        borderWidth={(isRecentlyChanged || isRecentlyReverted || isRecentlyTransferred) ? '2px' : 0}
                        borderTopWidth={
                          (isRecentlyChanged && prevIsChanged) || (isRecentlyReverted && prevIsReverted) ? 0 : undefined
                        }
                        borderBottomWidth={
                          (isRecentlyChanged && nextIsChanged) || (isRecentlyReverted && nextIsReverted) ? 0 : undefined
                        }
                        borderColor={isRecentlyReverted ? 'blue.400' : isRecentlyTransferred ? 'green.400' : 'green.400'}
                        transition="border-color 0.2s, border-width 0.2s, background 0.2s"
                      >
                        <Checkbox
                          isChecked={selectedFileNames.has(f.name)}
                          onChange={() => {}}
                          size="sm"
                          isDisabled={isPreviewMode}
                          opacity={isPreviewMode ? 0.5 : 1}
                        />
                        {f.type === 'folder' ? (
                          <Icon as={FolderOpen} boxSize={4} color="blue.400" flexShrink={0} />
                        ) : nativeIcons.has(f.path) ? (
                          <Image
                            src={nativeIcons.get(f.path)!}
                            boxSize={4}
                            alt=""
                            flexShrink={0}
                            mr={0}
                          />
                        ) : (
                          <Icon as={FileText} boxSize={4} color={iconColor} flexShrink={0} />
                        )}
                        <Text fontSize="xs" noOfLines={1} color={textColor} title={f.name} flex={1}>
                          {f.name}
                        </Text>
                      </Flex>
                      {isContentReading && contentReadingState && (
                        <Box
                          position="absolute"
                          bottom={0}
                          left={0}
                          right={0}
                          h="2px"
                          bg="blue.200"
                          overflow="hidden"
                        >
                          <Box
                            h="100%"
                            w="40%"
                            bg="blue.500"
                            animation={`${readingProgress} 1.2s ease-in-out infinite`}
                          />
                        </Box>
                      )}
                      </Box>
                    );
                    const proposalRow = planned && (
                      <Flex
                        px={2}
                        pl={6}
                        py={1.5}
                        align="center"
                        gap={2}
                        borderRadius={0}
                        animation={planned.status === 'processing' ? `${pulse} 1.2s ease-in-out infinite` : undefined}
                        borderWidth={planned.status === 'processing' ? '1px' : 0}
                        borderColor="blue.400"
                      >
                        <Box flexShrink={0} w="16px">
                          {planned.status === 'pending' && <Box w={4} h={4} />}
                          {planned.status === 'processing' && (
                            <Icon as={Loader2} boxSize={3} animation={`${spin} 1s linear infinite`} color="blue.500" />
                          )}
                          {planned.status === 'done' && (
                            <Icon as={Check} boxSize={3} color={successColor} />
                          )}
                          {planned.status === 'failed' && (
                            <Box title={planned.error}>
                              <Icon as={AlertCircle} boxSize={3} color={errorColor} />
                            </Box>
                          )}
                        </Box>
                        <Text fontSize="xs" color={textColorMuted} noOfLines={1} flex={1}>
                          {proposalText}
                        </Text>
                      </Flex>
                    );
                    const mergeGhostRow = isLastMergeSource && mergeGhostItem && (
                      <>
                        <Separator />
                        <Flex
                          px={2}
                          pl={6}
                          py={1.5}
                          align="center"
                          gap={2}
                          borderRadius={0}
                          bg={mergeGhostBg}
                          opacity={0.8}
                          fontStyle="italic"
                        >
                          <Icon as={FileText} boxSize={4} color={iconColor} flexShrink={0} />
                          <Text fontSize="xs" color={textColorMuted} noOfLines={1} flex={1}>
                            {mergeGhostItem.fileName} (new merged file)
                          </Text>
                        </Flex>
                      </>
                    );
                    if (planned && planned.status === 'pending') {
                      return (
                        <React.Fragment key={f.name}>
                          {showSectionSeparator && <Separator />}
                          <Box bg={processingRowBg} borderRadius={0}>
                            {fileRow}
                            {proposalRow}
                            {mergeGhostRow}
                          </Box>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={f.name}>
                        {showSectionSeparator && <Separator />}
                        {fileRow}
                        {proposalRow}
                        {mergeGhostRow}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ));
            })()}
            </VStack>
          )}
        </Box>
      </Box>

      {/* Command input - below */}
      <Box ref={commandAreaRef} borderTop="1px solid" borderColor={borderColor} bg={itemBgColor}>
        <Flex px={4} py={4}>
          <Box
            flex={1}
            minW={0}
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="md"
            overflow="hidden"
            transition="border-color 0.2s, box-shadow 0.2s"
            _focusWithin={{
              borderColor: 'blue.400',
              boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)',
            }}
          >
            <Flex
              gap={1}
              px={2}
              py={2}
              align="center"
              justify="space-between"
              minH="28px"
              borderBottomWidth="1px"
              borderBottomStyle="solid"
              borderBottomColor={separatorColor}
            >
              <Flex gap={1} align="center">
                <IconButton
                  aria-label="Merge by file content"
                  icon={<Merge size={14} />}
                  size="xs"
                  variant="solid"
                  colorScheme="blue"
                  h="24px"
                  minW="24px"
                  onClick={() => handleSubmit('rename and group according to file content')}
                  isDisabled={!currentDirectory || isParsing || isExecuting}
                  title="Rename and group PDFs by their content"
                />
                <IconButton
                  aria-label="Smart Merge by content"
                  icon={<FileStack size={14} />}
                  size="xs"
                  variant="solid"
                  colorScheme="purple"
                  h="24px"
                  minW="24px"
                  onClick={() => handleSubmit('smart merge documents by content - group documents that relate to the same thing (e.g. property purchase docs for same property) and merge each group into one PDF')}
                  isDisabled={!currentDirectory || isParsing || isExecuting}
                  title="Smart Merge: group related docs (e.g. same property) and merge each group into one PDF"
                />
                <IconButton
                  aria-label="Delete selected"
                  icon={<Trash2 size={14} />}
                  size="xs"
                  variant="solid"
                  colorScheme="red"
                  h="24px"
                  minW="24px"
                  onClick={() => handleSubmit('delete selected')}
                  isDisabled={!currentDirectory || isParsing || isExecuting}
                  title="Delete selected files"
                />
                <IconButton
                  aria-label="Extract folder content"
                  icon={<FolderInput size={14} />}
                  size="xs"
                  variant="solid"
                  colorScheme="teal"
                  h="24px"
                  minW="24px"
                  onClick={() => {
                    setCommand('extract from ');
                    setParseError(null);
                    commandInputRef.current?.focus();
                  }}
                  isDisabled={!currentDirectory || isParsing || isExecuting}
                  title="Extract contents from a folder (type folder name after clicking)"
                />
                <IconButton
                  aria-label="Extract to current directory and delete folder"
                  icon={<FolderOutput size={14} />}
                  size="xs"
                  variant="solid"
                  colorScheme="orange"
                  h="24px"
                  minW="24px"
                  onClick={() => handleSubmit('extract from selected folders to current directory and delete folder')}
                  isDisabled={!currentDirectory || isParsing || isExecuting}
                  title="Extract files from selected folders to current directory and delete the folders"
                />
              </Flex>
              <IconButton
                aria-label="Clear text"
                icon={<Eraser size={14} />}
                size="xs"
                variant="ghost"
                colorScheme="gray"
                h="24px"
                minW="24px"
                onClick={handleClear}
                isDisabled={!command.trim() || isParsing || isExecuting}
                title="Clear command text"
              />
            </Flex>
            <Flex align="center" minH="36px">
              <Input
                ref={commandInputRef}
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                size="sm"
                isDisabled={isParsing || isExecuting}
                border="none"
                borderRadius={0}
                bg={bgColor}
                _focus={{ boxShadow: 'none' }}
                focusBorderColor="transparent"
                flex={1}
                minW={0}
              />
              <IconButton
                aria-label="Send"
                icon={isParsing ? <Spinner size="sm" /> : <Send size={16} />}
                size="sm"
                colorScheme="blue"
                variant="ghost"
                flexShrink={0}
                mx={1}
                onClick={() => handleSubmit()}
                isDisabled={!command.trim() || !currentDirectory || isParsing || isExecuting}
              />
            </Flex>
          </Box>
        </Flex>
        {parseError && (
          <Flex mt={2} mx={4} mb={4} p={2} borderRadius="md" bg={useColorModeValue('red.50', 'red.900')} align="center" gap={2}>
            <Icon as={AlertCircle} boxSize={4} color={errorColor} />
            <Text fontSize="xs" color={errorColor}>
              {parseError}
            </Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};
