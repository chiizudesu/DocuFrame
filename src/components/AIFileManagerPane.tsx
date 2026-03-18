import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Text,
  Flex,
  VStack,
  Input,
  Button,
  Spinner,
  useColorModeValue,
  Icon,
  IconButton,
  Checkbox,
  Select,
  Image,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { Sparkles, X, Check, AlertCircle, Loader2, Send, FolderOpen, FileText, Undo2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  parseFileManagerCommand,
  expandOperationsToPlannedItems,
  executePlannedItems,
  revertUndoEntry,
  getSmartRenameSuggestions,
  getMatchingItemsForCondition,
  type PlannedItem,
  type UndoEntry,
} from '../services/aiFileManagerService';
import { extractIndexPrefix } from '../utils/indexPrefix';
import { joinPath } from '../utils/path';

const pulse = keyframes`
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  50% { opacity: 0.9; box-shadow: 0 0 12px 4px rgba(59, 130, 246, 0.4); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const AIFileManagerPane: React.FC = () => {
  const {
    currentDirectory,
    folderItems,
    setIsAIFileManagerOpen,
    addLog,
    setStatus,
    logFileOperation,
  } = useAppContext();

  const [command, setCommand] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [model, setModel] = useState<'sonnet' | 'haiku'>('sonnet');
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  const [recentlyChangedNames, setRecentlyChangedNames] = useState<Set<string>>(new Set());
  const [recentlyRevertedNames, setRecentlyRevertedNames] = useState<Set<string>>(new Set());
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const loadingQueue = useRef<Set<string>>(new Set());
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const elementsToObserveRef = useRef<Map<HTMLElement, string>>(new Map());
  const nativeIconsRef = useRef(nativeIcons);
  nativeIconsRef.current = nativeIcons;

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const panelBg = useColorModeValue('gray.50', 'gray.700');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const textColorMuted = useColorModeValue('gray.600', 'gray.300');
  const textColorSubtle = useColorModeValue('gray.500', 'gray.400');
  const resultBg = useColorModeValue('yellow.50', 'gray.900');
  const successColor = useColorModeValue('green.600', 'green.400');
  const errorColor = useColorModeValue('red.600', 'red.400');
  const processingBg = useColorModeValue('blue.50', 'blue.900');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');
  const iconColor = useColorModeValue('gray.500', 'gray.400');
  const separatorColor = useColorModeValue('gray.300', 'gray.500');
  const processingRowBg = useColorModeValue('gray.200', 'gray.600');

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
  const indexedFiles = items.filter(f => f.type !== 'folder' && extractIndexPrefix(f.name));
  const nonIndexedFiles = items.filter(f => f.type !== 'folder' && !extractIndexPrefix(f.name));
  const groups = [
    { items: folders, key: 'folders' },
    { items: indexedFiles, key: 'indexed' },
    { items: nonIndexedFiles, key: 'nonIndexed' },
  ].filter(g => g.items.length > 0);

  const isPreviewMode = plannedItems.length > 0;
  const plannedByFileName = React.useMemo(() => {
    const m = new Map<string, PlannedItem>();
    for (const p of plannedItems) m.set(p.fileName, p);
    return m;
  }, [plannedItems]);

  const Separator = () => (
    <Box h="1px" bg={separatorColor} mx={2} my={1.5} flexShrink={0} opacity={0.9} />
  );

  // Clear cached icons and planned items when directory changes
  useEffect(() => {
    setNativeIcons(new Map());
    setPlannedItems([]);
    elementsToObserveRef.current.clear();
    setUndoEntry(null);
    setRecentlyRevertedNames(new Set());
  }, [currentDirectory]);

  // Load icon for a file (called when visible via IntersectionObserver)
  const loadIconForFile = useCallback(async (filePath: string) => {
    if (loadingQueue.current.has(filePath) || nativeIconsRef.current.has(filePath)) return;
    loadingQueue.current.add(filePath);
    try {
      const iconData = await window.electronAPI?.getFileIcon(filePath);
      if (iconData) {
        setNativeIcons(prev => {
          if (prev.has(filePath)) return prev;
          const next = new Map(prev);
          next.set(filePath, iconData);
          return next;
        });
      }
    } catch {
      /* ignore */
    } finally {
      loadingQueue.current.delete(filePath);
    }
  }, []);

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
    elementsToObserveRef.current.forEach((path, el) => {
      observer.observe(el);
    });
    elementsToObserveRef.current.clear();
    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
      loadingQueue.current.clear();
    };
  }, [loadIconForFile]);

  // Load initial batch of visible icons
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon) return;
    const files = folderItems.filter(f => f.type !== 'folder');
    const toLoad = files.filter(f => !loadingQueue.current.has(f.path)).slice(0, 15);
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
    if (selectedFileNames.size === items.length) {
      setSelectedFileNames(new Set());
    } else {
      setSelectedFileNames(new Set(items.map(f => f.name)));
    }
  }, [items, selectedFileNames.size]);

  const handleSubmit = useCallback(async () => {
    const trimmed = command.trim();
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
        model,
        selected
      );

      if (operations.length === 0) {
        setParseError('No operations understood. Try rephrasing (e.g. "add prefix A1 to selection").');
        setPlannedItems([]);
        return;
      }

      const smartRenameOps = operations.filter((op): op is typeof op & { action: 'smartRename' } => op.action === 'smartRename');
      const otherOps = operations.filter(op => op.action !== 'smartRename');

      let items: PlannedItem[] = [];

      if (otherOps.length > 0) {
        items = expandOperationsToPlannedItems(otherOps, folderItems, currentDirectory, selected);
      }

      for (const op of smartRenameOps) {
        const matching = getMatchingItemsForCondition(op.condition, folderItems, selected);
        if (matching.length === 0) continue;
        const suggestions = await getSmartRenameSuggestions(matching, trimmed, model);
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
    }
  }, [command, currentDirectory, folderItems, model, selectedFileNames, addLog]);

  const handleApply = useCallback(async () => {
    if (plannedItems.length === 0) return;

    setIsExecuting(true);
    setStatus(`Processing ${plannedItems.length} file(s)...`, 'info');

    const successfulNewNames = new Set<string>();
    const updateItem = (index: number, updates: Partial<PlannedItem>) => {
      if (updates.status === 'done') {
        const item = plannedItems[index];
        if (item) successfulNewNames.add(item.newName);
      }
      setPlannedItems(prev => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], ...updates };
        return next;
      });
    };

    try {
      const result = await executePlannedItems(
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
        setPlannedItems([]);

        const successfulItems = plannedItems.filter(p => successfulNewNames.has(p.newName));
        const undoItems = successfulItems.map(item => {
          const parentDir = item.filePath.slice(0, item.filePath.length - item.fileName.length).replace(/[\\/]+$/, '') || currentDirectory;
          const destPath = joinPath(parentDir, item.newName);
          return {
            operation: item.operation as 'rename' | 'copy',
            sourcePath: item.filePath,
            destPath,
          };
        });
        if (undoItems.length > 0) {
          setUndoEntry({ directory: currentDirectory, items: undoItems });
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
    if (!undoEntry || undoEntry.directory !== currentDirectory) return;
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
        const revertedNames = new Set<string>();
        for (const item of undoEntry.items) {
          if (item.operation === 'rename') {
            const name = item.sourcePath.split(/[/\\]/).pop();
            if (name) revertedNames.add(name);
          }
        }
        setRecentlyRevertedNames(revertedNames);
        setTimeout(() => setRecentlyRevertedNames(new Set()), 5000);
        setUndoEntry(null);
        window.dispatchEvent(
          new CustomEvent('forceDirectoryReload', { detail: { directory: currentDirectory } })
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Revert failed: ${msg}`, 'error');
      addLog(`AI revert failed: ${msg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [undoEntry, currentDirectory, setStatus, addLog]);

  const handleClear = useCallback(() => {
    setCommand('');
    setParseError(null);
    setPlannedItems([]);
  }, []);

  return (
    <Box flex={1} bg={bgColor} display="flex" flexDirection="column" overflow="hidden">
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
        <Flex align="center" gap={2}>
          <Sparkles size={20} />
          <Text fontSize="lg" fontWeight="semibold" color={textColor}>
            AI File Manager
          </Text>
        </Flex>
        <Flex align="center" gap={2}>
          <Select
            value={model}
            onChange={e => setModel(e.target.value as 'sonnet' | 'haiku')}
            isDisabled={isParsing || isExecuting}
            size="sm"
            w="140px"
            bg={bgColor}
          >
            <option value="sonnet">Claude Sonnet</option>
            <option value="haiku">Claude Haiku</option>
          </Select>
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
          p={2}
          borderWidth="1px"
          borderColor={borderColor}
          flex="1"
          minH="0"
          overflow="auto"
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
            <VStack align="stretch" spacing={0}>
              <Flex
                px={2}
                py={1.5}
                align="center"
                justify="space-between"
                minH="28px"
                borderRadius={0}
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
                    onChange={() => toggleSelectAll()}
                    onClick={e => e.stopPropagation()}
                    size="sm"
                    isDisabled={isPreviewMode}
                    opacity={isPreviewMode ? 0.5 : 1}
                  />
                  <Text fontSize="xs" color={textColorMuted}>
                    {isPreviewMode
                      ? (isExecuting
                        ? `Processing ${plannedItems.filter(i => i.status === 'done' || i.status === 'failed').length} of ${plannedItems.length}`
                        : `${plannedItems.length} file(s) will be ${plannedItems.some(i => i.operation === 'copy') ? 'copied' : 'renamed'}`)
                      : `${selectedFileNames.size} of ${items.length} selected`}
                  </Text>
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
                ) : undoEntry && undoEntry.directory === currentDirectory ? (
                  <IconButton
                    aria-label="Revert last changes"
                    title="Revert last applied changes"
                    icon={<Undo2 size={14} />}
                    size="xs"
                    variant="ghost"
                    onClick={handleRevert}
                    isDisabled={isExecuting}
                    flexShrink={0}
                  />
                ) : (
                  <Box w="52px" flexShrink={0} />
                )}
                </Flex>
              </Flex>
              {groups.map((group, gi) => (
                <React.Fragment key={group.key}>
                  {gi > 0 && <Separator />}
                  {group.items.map((f, fi) => {
                    const planned = plannedByFileName.get(f.name);
                    const isRecentlyChanged = recentlyChangedNames.has(f.name);
                    const isRecentlyReverted = recentlyRevertedNames.has(f.name);
                    const prevItem = fi > 0 ? group.items[fi - 1] : null;
                    const nextItem = fi < group.items.length - 1 ? group.items[fi + 1] : null;
                    const prevPlanned = prevItem ? plannedByFileName.get(prevItem.name) : null;
                    const prevIsChanged = prevItem && recentlyChangedNames.has(prevItem.name);
                    const nextIsChanged = nextItem && recentlyChangedNames.has(nextItem.name);
                    const prevIsReverted = prevItem && recentlyRevertedNames.has(prevItem.name);
                    const nextIsReverted = nextItem && recentlyRevertedNames.has(nextItem.name);
                    const showSectionSeparator = planned && prevPlanned;
                    const rowPy = 1.5;
                    const fileRow = (
                      <Flex
                        ref={(el) => f.type !== 'folder' && observeFileElement(el, f.path)}
                        px={2}
                        py={rowPy}
                        align="center"
                        gap={2}
                        _hover={!isPreviewMode ? { bg: hoverBg } : undefined}
                        borderRadius={0}
                        cursor={!isPreviewMode ? 'pointer' : undefined}
                        onClick={!isPreviewMode ? () => toggleFileSelection(f.name) : undefined}
                        borderWidth={(isRecentlyChanged || isRecentlyReverted) ? '2px' : 0}
                        borderTopWidth={
                          (isRecentlyChanged && prevIsChanged) || (isRecentlyReverted && prevIsReverted) ? 0 : undefined
                        }
                        borderBottomWidth={
                          (isRecentlyChanged && nextIsChanged) || (isRecentlyReverted && nextIsReverted) ? 0 : undefined
                        }
                        borderColor={isRecentlyReverted ? 'blue.400' : 'green.400'}
                        transition="border-color 0.2s, border-width 0.2s"
                      >
                        <Checkbox
                          isChecked={selectedFileNames.has(f.name)}
                          onChange={() => toggleFileSelection(f.name)}
                          size="sm"
                          onClick={e => e.stopPropagation()}
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
                            <Icon as={AlertCircle} boxSize={3} color={errorColor} title={planned.error} />
                          )}
                        </Box>
                        <Text fontSize="xs" color={textColorMuted} noOfLines={1} flex={1}>
                          {planned.operation === 'copy' ? '→ copy to ' : '→ '}
                          {planned.newName}
                        </Text>
                      </Flex>
                    );
                    if (planned && planned.status === 'pending') {
                      return (
                        <React.Fragment key={f.name}>
                          {showSectionSeparator && <Separator />}
                          <Box bg={processingRowBg} borderRadius={0}>
                            {fileRow}
                            {proposalRow}
                          </Box>
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={f.name}>
                        {showSectionSeparator && <Separator />}
                        {fileRow}
                        {proposalRow}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </VStack>
          )}
        </Box>
      </Box>

      {/* Command input - below */}
      <Box p={4} bg={panelBg} borderTop="1px solid" borderColor={borderColor}>
        <Flex gap={2} align="center">
          <Input
            placeholder="e.g. improve naming of selection, make all caps my selection"
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
            flex={1}
          />
          <IconButton
            aria-label="Send"
            icon={isParsing ? <Spinner size="sm" /> : <Send size={16} />}
            size="sm"
            colorScheme="blue"
            onClick={handleSubmit}
            isDisabled={!command.trim() || !currentDirectory || isParsing || isExecuting}
          />
        </Flex>
        {parseError && (
          <Flex mt={2} p={2} borderRadius="md" bg={useColorModeValue('red.50', 'red.900')} align="center" gap={2}>
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
