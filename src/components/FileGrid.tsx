import React, { useEffect, useState, useRef, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useColorModeValue } from "./ui/color-mode";
import { Box } from '@chakra-ui/react';
import { showToast, getErrorMessageFromUnknown } from "@/components/ui/toaster"
import {
  useFileGridDirectoryState,
  useFileGridSelectionState,
  useFileGridClipboardAndTransfers,
  useFileGridFiltersAndVisibility,
  useFileGridQuickAccessPaths,
  useFileGridActions,
} from '../context/AppContext'
import { joinPath, isAbsolutePath, normalizePath } from '../utils/path'
import { matchesTypeFilter, matchesDateFilter, typeGroupKey, dateGroupKey, DATE_GROUP_ORDER } from '../utils/fileFilters'
import { QuickFilterChips } from './FileGrid/QuickFilterChips'
import { undoLastOperation, pushUndoableOperation } from '../services/undoStack'
import { settingsService } from '../services/settings'
import type { FileItem } from '../types'
import { FileProperties } from './CustomPropertiesDialog';
import { extractIndexPrefix, setIndexPrefix, removeIndexPrefix, groupFilesByIndex, getIndexInfo, getAllIndexKeys, toProperCase, getMaxIndexPillWidth } from '../utils/indexPrefix';
import { SortColumn, SortDirection, formatPathForLog, setDropEffectCompatibleWithEffectAllowed, ALL_COLUMN_IDS, DEFAULT_COLUMN_WIDTHS, DEFAULT_COLUMN_VISIBILITY } from './FileGrid/FileGridUtils';
import { isGstDirectory, parsePeriodFromName } from '../utils/period';
import { versionStore } from '../services/versionStore';
import { FileContextMenu, BlankContextMenu, MoveToDialogWrapper, HeaderContextMenu } from './FileGrid/FileGridUI';
import { FileGridDialogs } from './FileGrid/FileGridDialogs';
import { FileOperationFailedDialog } from './FileGrid/FileOperationFailedDialog';
import { SplitPdfDialog } from './FileGrid/SplitPdfDialog';
import { EditPdfDialog } from './FileGrid/EditPdfDialog';
import { FileListView } from './FileGrid/FileListView';
import { docuFramePalette as P } from '../docuFrameColors';

/** True when rename failed because the path is open, locked, or busy (EBUSY / EPERM / main-process message). */
function isRenameResourceBusyError(error: unknown): boolean {
  if (error == null) return false;
  const err = error as NodeJS.ErrnoException;
  if (err.code === 'EBUSY' || err.code === 'EPERM') return true;
  const msg = getErrorMessageFromUnknown(error);
  return (
    msg.includes('Cannot rename: File is currently open') ||
    /resource busy|EBUSY|in use by another application/i.test(msg)
  );
}

function renameFailedToastContent(error: unknown, originalName: string): { title: string; description: string } {
  if (isRenameResourceBusyError(error)) {
    return {
      title: 'Rename Failed',
      description:
        'This file is open in another program or locked by the system. Close the file and try again.',
    };
  }
  const errorMessage = getErrorMessageFromUnknown(error);
  return {
    title: 'Rename Failed',
    description: `Failed to rename "${originalName}": ${errorMessage}`,
  };
}

// Icon functions removed - using native Windows icons instead

// File size formatting function - REMOVED duplicate, using optimized version inside component

// formatDate function - will be optimized inside component


// Stable empty object for non-folder rows - avoids new {} every render, enables FileTableRow memo
const EMPTY_FOLDER_HANDLERS = Object.freeze({});

export const FileGrid: React.FC = () => {
  // Selective context: avoid re-rendering FileGrid on unrelated app updates (status, settings, etc.)
  const {
    currentDirectory,
    setCurrentDirectory,
    rootDirectory,
    folderItems,
    setFolderItems,
    setDisplayedDirectory,
  } = useFileGridDirectoryState()
  const { selectedFiles, setSelectedFiles, setSelectAllFiles } = useFileGridSelectionState()
  const {
    clipboard,
    setClipboard,
    recentlyTransferredFiles,
    addRecentlyTransferredFiles,
    clearRecentlyTransferredFiles,
    removeRecentlyTransferredFile,
  } = useFileGridClipboardAndTransfers()
  const {
    fileSearchFilter,
    setFileSearchFilter,
    typeFilter,
    setTypeFilter,
    dateFilter,
    setDateFilter,
    contentSearchResults,
    hideTemporaryFiles,
    hideDotFiles,
    hideClaudeMd,
    isGroupedByIndex,
    currentManualActiveSections,
    currentDeactivatedSections,
  } = useFileGridFiltersAndVisibility()
  const { quickAccessPaths, recentClientPaths } = useFileGridQuickAccessPaths()
  const {
    addLog,
    setStatus,
    addTabToCurrentWindow,
    addQuickAccessPath,
    removeQuickAccessPath,
    logFileOperation,
    isCreateFolderOpen,
    setIsCreateFolderOpen,
    setIsPreviewPaneOpen,
  } = useFileGridActions()

  // Memoize selectedFiles as Set for O(1) lookup performance (moved early to avoid initialization errors)
  const selectedFilesSet = useMemo(() => {
    return new Set(selectedFiles);
  }, [selectedFiles]);

  // Icon functions removed - using native Windows icons instead

  // Helper: check if a file is a temporary file (Office ~$ lock files, Word ~*.tmp files)
  const isTemporaryFile = useCallback((name: string): boolean => {
    if (typeof name !== 'string') return false;
    return name.startsWith('~$') || (name.startsWith('~') && name.endsWith('.tmp'));
  }, []);

  // File filtering function
  const filterFiles = useCallback((files: any[]) => {
    if (!Array.isArray(files)) return files;
    
    return files.filter((f: any) => {
      // Filter temporary files (Office ~$ lock files, Word ~*.tmp like ~WRL2535.tmp)
      if (hideTemporaryFiles && f?.type !== 'folder' && typeof f?.name === 'string' && isTemporaryFile(f.name)) {
        return false;
      }
      
      // Filter dot files/folders (files/folders starting with .)
      if (hideDotFiles && typeof f?.name === 'string' && f.name.startsWith('.')) {
        return false;
      }

      // Filter CLAUDE.md files
      if (hideClaudeMd && typeof f?.name === 'string' && f.name.toLowerCase() === 'claude.md') {
        return false;
      }

      return true;
    });
  }, [hideTemporaryFiles, hideDotFiles, hideClaudeMd, isTemporaryFile]);

  // Memoized file size formatting for better performance
  const formatFileSize = useCallback((size: string | undefined) => {
    if (!size) return '';
    const sizeNum = parseFloat(size);
    if (isNaN(sizeNum)) return size;
    return `${(sizeNum / 1024).toFixed(1)} KB`;
  }, []);
  
  // Memoized date formatting for better performance
  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return dateString; // Fallback to original string if parsing fails
    }
  }, []);
  // File version registry (Version column); epoch changes whenever a replace bumps a version
  const fileVersionsEpoch = useSyncExternalStore(versionStore.subscribe, versionStore.getEpoch);
  useEffect(() => {
    void versionStore.init();
  }, []);

  // Per-directory sort preferences (remembered when navigating, persisted across restarts)
  const sortPrefsRef = useRef<Map<string, { sortColumn: SortColumn; sortDirection: SortDirection }>>(new Map())
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Load persisted sort prefs on mount
  useEffect(() => {
    const load = async () => {
      try {
        const config = await (window.electronAPI as any).getConfig()
        const prefs = config?.fileGridSortPreferences || {}
        Object.entries(prefs).forEach(([path, val]: [string, any]) => {
          if (val?.sortColumn && val?.sortDirection) {
            sortPrefsRef.current.set(path, { sortColumn: val.sortColumn as SortColumn, sortDirection: val.sortDirection as SortDirection })
          }
        })
        const key = normalizePath(currentDirectory || '')
        const saved = sortPrefsRef.current.get(key)
        if (saved) {
          setSortColumn(saved.sortColumn)
          setSortDirection(saved.sortDirection)
        }
      } catch {
        // Ignore
      }
    }
    load()
  }, [])
  
  // Restore sort when directory changes
  useEffect(() => {
    const key = normalizePath(currentDirectory || '')
    const prefs = sortPrefsRef.current.get(key)
    if (prefs) {
      setSortColumn(prefs.sortColumn)
      setSortDirection(prefs.sortDirection)
    } else {
      setSortColumn('name')
      setSortDirection('asc')
    }
  }, [currentDirectory])
  
  // All useState hooks next
  const [isLoading, setIsLoading] = useState(false)
  /** False from the moment we navigate until the new directory's contents have loaded.
   *  Gates manual empty-section headers so they don't flash before the files arrive. */
  const [contentReady, setContentReady] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    position: {
      x: number
      y: number
    }
    fileItem: FileItem | null
  }>({
    isOpen: false,
    position: {
      x: 0,
      y: 0,
    },
    fileItem: null,
  })
  const [isRenaming, setIsRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [isInlineCreatingFolder, setIsInlineCreatingFolder] = useState(false)
  const [newFolderDraftName, setNewFolderDraftName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const isInlineCreatingFolderRef = useRef(false)
  const showFileOperationFailureRef = useRef<
    | ((opts: {
        title: string
        description: string
        operationLabel: string
        retry: () => Promise<boolean>
        onCancel?: () => void
      }) => void)
    | null
  >(null)
  const fileOpRetryRef = useRef<(() => Promise<boolean>) | null>(null)
  const fileOpCancelRef = useRef<(() => void) | null>(null)
  const handleRenameSubmitRef = useRef<((e?: React.FormEvent) => Promise<boolean>) | null>(null)
  const isRenamingRef = useRef<string | null>(null)
  const hasPositionedCursor = useRef<boolean>(false)
  const isLoadingRef = useRef<boolean>(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [isMergePDFOpen, setMergePDFOpen] = useState(false)
  const [isUploadToVaultsOpen, setUploadToVaultsOpen] = useState(false)
  const [vaultUploadSourcePaths, setVaultUploadSourcePaths] = useState<string[]>([])
  const [vaultUploadTargetDir, setVaultUploadTargetDir] = useState('')
  const [isExtractedTextOpen, setExtractedTextOpen] = useState(false)
  const [extractedTextData, setExtractedTextData] = useState({ fileName: '', text: '' })
  const [isIndexPrefixDialogOpen, setIsIndexPrefixDialogOpen] = useState(false)
  const [isRenameIndexDialogOpen, setIsRenameIndexDialogOpen] = useState(false)
  const [isSmartRenameDialogOpen, setIsSmartRenameDialogOpen] = useState(false)
  const [smartRenameFile, setSmartRenameFile] = useState<FileItem | null>(null)
  const [prefixDialogFiles, setPrefixDialogFiles] = useState<FileItem[]>([])
  const closeIndexPrefixDialog = useCallback(() => {
    setIsIndexPrefixDialogOpen(false)
    setPrefixDialogFiles([])
  }, [])
  const closeRenameIndexDialog = useCallback(() => setIsRenameIndexDialogOpen(false), [])
  const [isMoveToDialogOpen, setIsMoveToDialogOpen] = useState(false)
  const [moveToFiles, setMoveToFiles] = useState<FileItem[]>([])
  const [isSplitPdfOpen, setIsSplitPdfOpen] = useState(false)
  const [splitPdfFile, setSplitPdfFile] = useState<FileItem | null>(null)
  const [isEditPdfOpen, setIsEditPdfOpen] = useState(false)
  const [editPdfFile, setEditPdfFile] = useState<FileItem | null>(null)
  /** Session grouping mode: 'auto' = workpaper index (layer view), or group by file type / modified date */
  const [groupByMode, setGroupByMode] = useState<'auto' | 'type' | 'date'>('auto')
  /** Row density preset, persisted in config as listDensity */
  const [rowDensity, setRowDensity] = useState<'compact' | 'default' | 'comfortable'>('default')
  const [fileOpFailureDialog, setFileOpFailureDialog] = useState<{
    open: boolean
    title: string
    description: string
    operationLabel: string
  }>({ open: false, title: '', description: '', operationLabel: '' })
  const [fileOpRetrying, setFileOpRetrying] = useState(false)
  const [isImagePasteOpen, setImagePasteOpen] = useState(false)
  const [fileGridBackgroundPath, setFileGridBackgroundPath] = useState<string>('')
  const [fileGridBackgroundUrl, setFileGridBackgroundUrl] = useState<string>('')
  const [backgroundFillPath, setBackgroundFillPath] = useState<string>('')
  const [backgroundFillUrl, setBackgroundFillUrl] = useState<string>('')
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark')
  const [enableBackgrounds, setEnableBackgrounds] = useState(true)
  const [transferCommandMappings, setTransferCommandMappings] = useState<{ [key: string]: string }>({})
  
  // Drag selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const selectionModifiersRef = useRef<{ shiftKey: boolean; ctrlKey: boolean }>({ shiftKey: false, ctrlKey: false })
  const justFinishedSelectingRef = useRef(false)
  const containerPaddingLeftRef = useRef<number>(0)
  const selectionRectRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const rafIdRef = useRef<number | null>(null)




  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  /** Rubber-band rectangle inside FileListView; geometry set imperatively (see syncMarqueeSelectionBox). */
  const marqueeOverlayRef = useRef<HTMLDivElement | null>(null)

  // Cleanup drag leave timeout on unmount
  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, []);

  // Load transfer mappings on mount and when updated (same source as TransferMappingDialog)
  const loadTransferMappings = useCallback(async () => {
    try {
      const config = await (window.electronAPI as any).getConfig();
      const mappings = config?.transferCommandMappings || {};
      setTransferCommandMappings(mappings);
    } catch (error) {
      console.error('[FileGrid] Error loading transfer mappings:', error);
      setTransferCommandMappings({});
    }
  }, []);

  useEffect(() => {
    loadTransferMappings();
    const handleMappingsUpdate = () => loadTransferMappings();
    window.addEventListener('transferMappingsUpdated', handleMappingsUpdate);
    return () => window.removeEventListener('transferMappingsUpdated', handleMappingsUpdate);
  }, [loadTransferMappings]);

  // Group transfer templates by index key
  const groupedTransferTemplates = useMemo(() => {
    const groups: Record<string, Array<{ command: string; filename: string }>> = {};
    Object.entries(transferCommandMappings).forEach(([command, filename]) => {
      const match = (filename as string).match(/^([A-Z]+\d*)\s*-/);
      const groupKey = match ? match[1] : 'Other';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push({ command, filename: filename as string });
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.command.localeCompare(b.command));
    });
    return groups;
  }, [transferCommandMappings]);

  const [blankContextMenu, setBlankContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Add state for lastClickedFile
  const [lastClickedFile, setLastClickedFile] = useState<string | null>(null);
  // Use refs for double-click detection to avoid stale closure issues
  const lastClickTimeRef = useRef<number>(0);
  const lastClickedFileRef = useRef<string | null>(null);

  // State to store native icons for files
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  
  // Smart selection states for handling drag vs click on multi-selected files
  const [pendingSelectionChange, setPendingSelectionChange] = useState<{ fileName: string; index: number } | null>(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<Set<string>>(new Set());

  // Refs for stable row handlers - handlers read from these to avoid closure churn
  const selectedFilesRef = useRef<string[]>([]);
  const selectedFilesSetRef = useRef<Set<string>>(new Set());
  const sortedFilesRef = useRef<FileItem[]>([]);
  const fileNameToPathMapRef = useRef<Map<string, string>>(new Map());
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  type GroupedFilesShape = ReturnType<typeof groupFilesByIndex<FileItem>>;
  const groupedFilesRef = useRef<GroupedFilesShape | null>(null);
  const isGroupedByIndexRef = useRef(false);
  const pendingSelectionChangeRef = useRef<{ fileName: string; index: number } | null>(null);
  const isDragStartedRef = useRef(false);

  // Function to reset drag state - can be called by child components
  const resetDragState = useCallback(() => {
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    setIsDragOver(false);
    setDragCounter(0);
    setDraggedFiles(new Set());
    setIsDragStarted(false);
  }, []);

  // Callback to handle when native icons are loaded
  const handleNativeIconLoaded = useCallback((filePath: string, iconData: string) => {
    setNativeIcons(prev => new Map(prev.set(filePath, iconData)));
  }, []);

  // Utility function to get filename without extension for cursor positioning - OPTIMIZED with useCallback
  const getFilenameWithoutExtension = useCallback((filename: string) => {
    // When value is extension-only (e.g. ".txt" for new file), put cursor at start (left)
    if (/^\.[a-z0-9]+$/i.test(filename)) return 0;
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No extension or hidden file (starts with .)
      return filename.length;
    }
    return lastDotIndex;
  }, []);

  // Keep ref in sync so stale closures can check rename mode
  useEffect(() => {
    isRenamingRef.current = isRenaming;
  }, [isRenaming]);

  useEffect(() => {
    isInlineCreatingFolderRef.current = isInlineCreatingFolder;
  }, [isInlineCreatingFolder]);

  // Collapsed caret when rename starts: before extension for files; end of name for folders / no extension (no full-name selection).
  useEffect(() => {
    if (isRenaming && !hasPositionedCursor.current) {
      const targetName = isRenaming;
      const tryFocus = (attempt: number) => {
        // Stop retrying if rename was cancelled or directory changed
        if (!isRenamingRef.current || isRenamingRef.current !== targetName) return;
        if (renameInputRef.current) {
          const input = renameInputRef.current;
          const extStart = getFilenameWithoutExtension(renameValue);
          const len = renameValue.length;
          const entry = sortedFilesRef.current.find((f) => f.name === targetName);
          input.focus({ preventScroll: true });
          if (entry?.type === 'file' && extStart > 0 && extStart < len) {
            // Collapsed caret immediately before '.' — not selecting the whole filename.
            input.setSelectionRange(extStart, extStart);
          } else {
            input.setSelectionRange(len, len);
          }
          hasPositionedCursor.current = true;
          console.log('[Rename] Rename mode active - input focused and in edit mode:', { name: targetName, value: renameValue, attempt });
        } else if (attempt < 8) {
          console.log('[Rename] Rename input ref not ready, retrying...', { name: targetName, attempt });
          setTimeout(() => tryFocus(attempt + 1), 50);
        } else {
          console.log('[Rename] Rename input ref never became available, cancelling rename:', { name: targetName });
          setIsRenaming(null);
          setRenameValue('');
        }
      };
      setTimeout(() => tryFocus(0), 0);
    } else if (!isRenaming) {
      // Reset the flag when not renaming
      hasPositionedCursor.current = false;
    }
  }, [isRenaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // All useColorModeValue hooks next
  const itemBgHover = useColorModeValue('#f0f9ff', '#2B6CB0') // v2 blue.700 hover accent
  const fileTextColor = useColorModeValue('#334155', 'white')
  const fileSubTextColor = useColorModeValue('#64748b', P.dark.subtext)
  const tableBgColor = useColorModeValue(P.light.canvas, P.dark.canvas)
  const tableHeadTextColor = useColorModeValue('#334155', P.dark.subtext)

  // Additional color tokens (hoisted) to avoid calling hooks inside loops/conditionals
  const borderColorDefault = useColorModeValue('gray.200', P.dark.border)
  const gridItemSelectedBg = useColorModeValue('blue.50', P.dark.rowSelected)
  const gridItemDefaultBg = useColorModeValue('#f8f9fc', P.dark.canvas)
  const hoverBorderColor = useColorModeValue('blue.200', 'blue.500')
  const headerHoverBg = useColorModeValue('gray.200', P.dark.rowHover)
  const headerStickyBg = useColorModeValue(P.light.listRow, P.dark.canvas)
  const headerDividerBg = useColorModeValue(P.light.headerDivider, P.dark.headerDivider)
  const rowSelectedBg = useColorModeValue(P.light.rowSelected, P.dark.rowSelected)
  const rowHoverBg = useColorModeValue(P.light.rowHover, P.dark.rowHover)
  const rowDefaultBg = useColorModeValue(P.light.listRow, P.dark.canvas)
  const folderDropBgColor = useColorModeValue('blue.100', 'blue.700')
  const searchHighlightBg = useColorModeValue('blue.50', 'blue.900')
  const dragGhostBg = useColorModeValue('gray.50', '#171923')
  const dragGhostBorder = useColorModeValue('gray.300', P.dark.border)
  const dragGhostAccent = useColorModeValue('blue.400', 'blue.300')

  // Memoize content search result paths for O(1) lookup
  const contentSearchPathsSet = useMemo(() => {
    if (!Array.isArray(contentSearchResults) || contentSearchResults.length === 0) {
      return new Set<string>();
    }
    return new Set(contentSearchResults.map(file => file.path));
  }, [contentSearchResults]);

  // Memoize sorted files computation for better performance
  const sortedFiles = useMemo(() => {
    if (!Array.isArray(folderItems) || folderItems.length === 0) return [];
    
    // Apply search filter if active
    let items = [...folderItems];
    
    // If content search has results, filter to only show those files
    if (contentSearchPathsSet.size > 0) {
      items = items.filter(item => contentSearchPathsSet.has(item.path));
    } else if (fileSearchFilter && fileSearchFilter.trim()) {
      // Otherwise, use filename filtering
      const normalizedFilter = fileSearchFilter.toLowerCase().trim();
      items = items.filter(item =>
        item.name.toLowerCase().includes(normalizedFilter)
      );
    }

    // Extension / modified-date filters (quick filter chips + column header menus)
    if (typeFilter.length > 0 || dateFilter) {
      items = items.filter(item =>
        matchesTypeFilter(item.name, item.type, typeFilter) &&
        matchesDateFilter(item.modified, item.type, dateFilter)
      );
    }

    if (items.length === 0) return [];
    
    // Early return for single item or no sorting needed
    if (items.length === 1) return items;
    
    // Pre-compute sort values to avoid repeated calculations
    // Helper function to get file extension
    const getFileExtension = (filename: string, fileType: string): string => {
      if (fileType === 'folder') return 'Folder';
      const lastDot = filename.lastIndexOf('.');
      if (lastDot === -1 || lastDot === filename.length - 1) return 'File';
      return filename.substring(lastDot + 1).toUpperCase();
    };
    
    const sortData = items.map((item, index) => ({
      item,
      index,
      nameValue: item.name.toLowerCase(), // Use lowercase for consistent sorting
      sizeValue: typeof item.size === 'string' ? parseFloat(item.size) || 0 : 0,
      modifiedValue: item.modified ? new Date(item.modified).getTime() : 0,
      typeValue: getFileExtension(item.name, item.type).toLowerCase(),
      // Period: parsed from "01 - March 2025"-style names; unparsed items sort last
      periodValue: sortColumn === 'period' ? (parsePeriodFromName(item.name)?.sortKey ?? null) : null,
      versionValue: sortColumn === 'version' ? versionStore.getVersion(item.path) : 1,
    }));

    // Sort with optimized comparison
    sortData.sort((a, b) => {
      // Always sort folders first
      if (a.item.type === 'folder' && b.item.type !== 'folder') return -1;
      if (a.item.type !== 'folder' && b.item.type === 'folder') return 1;

      // Then sort by the selected column
      if (sortColumn === 'name') {
        return sortDirection === 'asc'
          ? a.nameValue.localeCompare(b.nameValue)
          : b.nameValue.localeCompare(a.nameValue);
      } else if (sortColumn === 'size') {
        return sortDirection === 'asc'
          ? a.sizeValue - b.sizeValue
          : b.sizeValue - a.sizeValue;
      } else if (sortColumn === 'modified' || sortColumn === 'age') {
        // Age is the inverse presentation of modified; same underlying order
        return sortDirection === 'asc'
          ? a.modifiedValue - b.modifiedValue
          : b.modifiedValue - a.modifiedValue;
      } else if (sortColumn === 'type') {
        return sortDirection === 'asc'
          ? a.typeValue.localeCompare(b.typeValue)
          : b.typeValue.localeCompare(a.typeValue);
      } else if (sortColumn === 'period') {
        // Items without a parsable period always sink to the bottom
        if (a.periodValue === null && b.periodValue === null) return a.nameValue.localeCompare(b.nameValue);
        if (a.periodValue === null) return 1;
        if (b.periodValue === null) return -1;
        return sortDirection === 'asc'
          ? a.periodValue - b.periodValue
          : b.periodValue - a.periodValue;
      } else if (sortColumn === 'version') {
        return sortDirection === 'asc'
          ? a.versionValue - b.versionValue
          : b.versionValue - a.versionValue;
      }
      return 0;
    });

    return sortData.map(data => data.item);
  }, [folderItems, sortColumn, sortDirection, fileSearchFilter, typeFilter, dateFilter, contentSearchPathsSet, fileVersionsEpoch]);

  // Type/date filters are per-folder intent — clear them when navigating away
  useEffect(() => {
    setTypeFilter(prev => (prev.length > 0 ? [] : prev));
    setDateFilter(prev => (prev !== null ? null : prev));
  }, [currentDirectory, setTypeFilter, setDateFilter]);

  // Load persisted row density once
  useEffect(() => {
    let cancelled = false;
    settingsService.getSettings().then((s) => {
      const d = (s as any).listDensity;
      if (!cancelled && (d === 'compact' || d === 'comfortable' || d === 'default')) {
        setRowDensity(d);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSetRowDensity = useCallback(async (d: 'compact' | 'default' | 'comfortable') => {
    setRowDensity(d);
    try {
      const current = await settingsService.getSettings();
      await settingsService.setSettings({ ...current, listDensity: d } as any);
    } catch (e) {
      console.error('Failed to persist list density:', e);
    }
  }, []);

  const hasActiveFilters = Boolean((fileSearchFilter && fileSearchFilter.trim()) || typeFilter.length > 0 || dateFilter);
  const handleClearAllFilters = useCallback(() => {
    setFileSearchFilter('');
    setTypeFilter([]);
    setDateFilter(null);
  }, [setFileSearchFilter, setTypeFilter, setDateFilter]);

  // Group files by index prefix when grouping is enabled; type/date modes override
  const groupedFiles = useMemo(() => {
    if (groupByMode === 'type' || groupByMode === 'date') {
      if (sortedFiles.length === 0) return null;
      const grouped: { folders: FileItem[]; [key: string]: FileItem[] } = { folders: [] };
      for (const f of sortedFiles) {
        if (f.type === 'folder') {
          grouped.folders.push(f);
          continue;
        }
        const key = groupByMode === 'type' ? typeGroupKey(f.name) : dateGroupKey(f.modified);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(f);
      }
      const hasFiles = Object.keys(grouped).some(k => k !== 'folders' && grouped[k].length > 0);
      return hasFiles ? grouped : null;
    }

    if (!isGroupedByIndex) {
      return null;
    }

    const grouped = groupFilesByIndex(sortedFiles);

    // Deactivated sections: demote their files to "Other" and drop the header (visual only).
    if (currentDeactivatedSections.length > 0) {
      for (const key of currentDeactivatedSections) {
        if (key === 'folders' || key === 'Other') continue;
        const files = grouped[key];
        if (files && files.length > 0) {
          grouped.Other = [...(grouped.Other ?? []), ...files];
        }
        delete grouped[key];
      }
    }

    // Manually activated sections: show an empty header even when no file exists yet.
    // Only once the directory has finished loading — otherwise these phantom headers
    // would flash on screen before the folder's real files arrive.
    if (contentReady) {
      for (const key of currentManualActiveSections) {
        if (key === 'folders' || key === 'Other') continue;
        if (currentDeactivatedSections.includes(key)) continue;
        if (!grouped[key]) grouped[key] = [];
      }
    }

    // Return grouped whenever there is anything to render: real items (files/folders)
    // OR a manually-activated empty section header. Only a truly empty folder yields null.
    const meaningfulKeys = Object.keys(grouped).filter((k) => k !== 'folders');
    const hasContent = sortedFiles.length > 0 || meaningfulKeys.length > 0;
    return hasContent ? grouped : null;
  }, [sortedFiles, isGroupedByIndex, groupByMode, currentManualActiveSections, currentDeactivatedSections, contentReady]);

  // Explicit group ordering for plain (type/date) grouping; index mode sorts in FileListView
  const groupOrder = useMemo(() => {
    if (!groupedFiles) return undefined;
    if (groupByMode === 'date') return DATE_GROUP_ORDER.filter(k => groupedFiles[k]);
    if (groupByMode === 'type') {
      return Object.keys(groupedFiles)
        .filter(k => k !== 'folders')
        .sort((a, b) => (a === 'No extension' ? 1 : b === 'No extension' ? -1 : a.localeCompare(b)));
    }
    return undefined;
  }, [groupedFiles, groupByMode]);

  const listIsGrouped = groupByMode === 'auto' ? isGroupedByIndex : true;
  const groupHeaderVariant: 'index' | 'plain' = groupByMode === 'auto' ? 'index' : 'plain';

  // Index keys offered by the context menu's Apply prefix ▸ submenu: sections present
  // in this folder plus manually activated ones; all known keys when the folder has none.
  const activeSectionKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of sortedFiles) {
      if (f.type === 'folder') continue;
      const k = extractIndexPrefix(f.name);
      if (k) keys.add(k);
    }
    for (const k of currentManualActiveSections) {
      if (k !== 'folders' && k !== 'Other') keys.add(k);
    }
    const sorted = Array.from(keys).sort();
    return sorted.length > 0 ? sorted : getAllIndexKeys();
  }, [sortedFiles, currentManualActiveSections]);

  // Pre-compute file name to path map for O(1) drag lookups (moved early to avoid initialization errors)
  const fileNameToPathMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedFiles.forEach(file => {
      map.set(file.name, file.path);
    });
    return map;
  }, [sortedFiles]);

  // Sync refs for stable row handlers (must be after sortedFiles, fileNameToPathMap)
  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
    selectedFilesSetRef.current = selectedFilesSet;
    sortedFilesRef.current = sortedFiles;
    fileNameToPathMapRef.current = fileNameToPathMap;
    clickTimerRef.current = clickTimer;
    lastSelectedIndexRef.current = lastSelectedIndex;
    groupedFilesRef.current = groupedFiles;
    isGroupedByIndexRef.current = isGroupedByIndex;
    pendingSelectionChangeRef.current = pendingSelectionChange;
    isDragStartedRef.current = isDragStarted;
  }, [
    selectedFiles,
    selectedFilesSet,
    sortedFiles,
    fileNameToPathMap,
    clickTimer,
    lastSelectedIndex,
    groupedFiles,
    isGroupedByIndex,
    pendingSelectionChange,
    isDragStarted,
  ]);

  // Debounced directory loading to prevent rapid reloads
  const debouncedLoadDirectory = useCallback(
    async (dirPath: string) => {
      if (!dirPath || dirPath.trim() === '') return
      
      // Prevent concurrent loads
      if (isLoadingRef.current) return
      isLoadingRef.current = true
      setIsLoading(true)
      
      const navStart = performance.now();
      try {
        // Normalize the path before validation
        const normalizedPath = normalizePath(dirPath);
        if (!normalizedPath) {
          addLog(`Invalid path: ${dirPath}`, 'error')
          setStatus('Invalid directory path', 'error')
          return
        }
        
        // Validate path exists and is accessible
        const isValid = await (window.electronAPI as any).validatePath(normalizedPath)
        if (!isValid) {
          addLog(`Invalid or inaccessible path: ${normalizedPath}`, 'error')
          setStatus(`Cannot access: ${formatPathForLog(normalizedPath)}`, 'error')
          return
        }
        
        const contents = await (window.electronAPI as any).getDirectoryContents(normalizedPath)
        // Normalize shape and apply filters
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : [])
        const filtered = filterFiles(files)
        setFolderItems(filtered)
        setDisplayedDirectory(normalizedPath)
        setFileSearchFilter('') // Clear filter when new directory loads - avoids momentary unfiltered flash
        const navEnd = performance.now();
        addLog(`⏱ Folder load time: ${((navEnd - navStart) / 1000).toFixed(3)}s`);
        addLog(`Loaded directory: ${formatPathForLog(normalizedPath)}`)
        setStatus(`Loaded ${filtered.length} items`, 'info')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        addLog(`Failed to load directory: ${errorMessage}`, 'error')
        setStatus(`Failed to load directory: ${errorMessage}`, 'error')
      } finally {
        setIsLoading(false)
        setContentReady(true)
        isLoadingRef.current = false
      }
    },
    [addLog, setFolderItems, setDisplayedDirectory, setFileSearchFilter, filterFiles, setStatus]
  );

  // Load directory contents when current directory changes with debouncing
  useEffect(() => {
    if (!currentDirectory) return;

    // Clear immediately to prevent showing OLD folder's items with NEW folder's sort/group
    setFolderItems([]);
    // Suppress manual empty-section headers until the new folder's files have arrived
    setContentReady(false);

    const timeoutId = setTimeout(() => {
      debouncedLoadDirectory(currentDirectory);
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [currentDirectory, debouncedLoadDirectory, setFolderItems]);

  // Listen for manual refresh events from FolderInfoBar
  useEffect(() => {
    const handleDirectoryRefreshed = (event: CustomEvent) => {
      const eventDirectory = event.detail?.directory;
      if (eventDirectory === currentDirectory) {
        // Force reload the current directory
        debouncedLoadDirectory(currentDirectory);
      }
    };

    // Listen for force reload events (cold reload - bypasses debounce)
    const handleForceReload = (event: CustomEvent) => {
      const eventDirectory = event.detail?.directory;
      if (eventDirectory === currentDirectory) {
        // Clear any loading flags to allow immediate reload
        isLoadingRef.current = false;
        // Force immediate reload without debounce
        debouncedLoadDirectory(currentDirectory);
      }
    };

    window.addEventListener('directoryRefreshed', handleDirectoryRefreshed as EventListener);
    window.addEventListener('forceDirectoryReload', handleForceReload as EventListener);
    return () => {
      window.removeEventListener('directoryRefreshed', handleDirectoryRefreshed as EventListener);
      window.removeEventListener('forceDirectoryReload', handleForceReload as EventListener);
    };
  }, [currentDirectory, debouncedLoadDirectory])

  // Handle column header click for sorting - OPTIMIZED with useCallback
  const handleSort = useCallback((column: SortColumn) => {
    if (justFinishedResizingRef.current) return;
    const newDirection = sortColumn === column
      ? (sortDirection === 'asc' ? 'desc' : 'asc')
      : 'asc'
    const newColumn = sortColumn === column ? sortColumn : column
    
    setSortColumn(newColumn)
    setSortDirection(newDirection)
    
    const key = normalizePath(currentDirectory || '')
    sortPrefsRef.current.set(key, { sortColumn: newColumn, sortDirection: newDirection })
    
    // Persist to config (survives app restart)
    ;(async () => {
      try {
        const config = await (window.electronAPI as any).getConfig()
        const prefs = { ...(config?.fileGridSortPreferences || {}) }
        prefs[key] = { sortColumn: newColumn, sortDirection: newDirection }
        await (window.electronAPI as any).setConfig({ ...config, fileGridSortPreferences: prefs })
      } catch (e) {
        console.warn('[FileGrid] Failed to persist sort preferences:', e)
      }
    })()
    
    addLog(
      `Sorting by ${newColumn} (${newDirection === 'asc' ? 'ascending' : 'descending'})`,
    )
  }, [sortColumn, sortDirection, currentDirectory, addLog])

  // Open file or navigate folder - OPTIMIZED with useCallback
  const handleOpenOrNavigate = useCallback((file: FileItem) => {
    if (file.type === 'folder') {
      setCurrentDirectory(file.path);
      addLog(`Changed directory to: ${file.path}`);
      setStatus(`Opened folder: ${file.name}`, 'info');
    } else {
      // Open file externally
      try {
        if (!window.electronAPI || typeof (window.electronAPI as any).openFile !== 'function') {
          const msg = 'Electron API not available: openFile';
          addLog(msg, 'error');
          setStatus('File API not available', 'error');
          return;
        }
        (window.electronAPI as any).openFile(file.path);
        addLog(`Opened file: ${file.name}`);
        setStatus(`Opened file: ${file.name}`, 'success');
      } catch (error: any) {
        addLog(`Failed to open file: ${file.name} (${file.path})\n${error?.message || error}`,'error');
        setStatus(`Failed to open: ${file.name}`, 'error');
      }
    }
  }, [setCurrentDirectory, addLog, setStatus]);

  // Helper function for smart context menu positioning - OPTIMIZED with useCallback
  const getSmartMenuPosition = useCallback((clientX: number, clientY: number, _menuHeight = 300) => {
    return { x: clientX, y: clientY };
  }, []);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    file: FileItem,
  ) => {
    e.preventDefault()
    
    // If the right-clicked file is not part of the current selection,
    // clear selection and select only this file
    if (!selectedFilesSetRef.current.has(file.name)) {
      setSelectedFiles([file.name]);
      setSelectedFile(file.name);
    }
    
    const position = getSmartMenuPosition(e.clientX, e.clientY, 300);
    
    setContextMenu({
      isOpen: true,
      position,
      fileItem: file,
    })
  }, [getSmartMenuPosition]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      position: {
        x: 0,
        y: 0,
      },
      fileItem: null,
    })
  }, []);

  // Separate refresh function that doesn't show loading state (for background refreshes)
  const refreshDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath || dirPath.trim() === '') return;

    // Prevent concurrent refreshes but don't show loading
    if (isLoadingRef.current) return;

    try {
      // Normalize the path before refreshing
      const normalizedPath = normalizePath(dirPath);
      if (!normalizedPath) {
        addLog(`Invalid path: ${dirPath}`, 'error');
        return;
      }

      // Validate path exists and is accessible
      const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
      if (!isValid) {
        addLog(`Invalid or inaccessible path: ${normalizedPath}`, 'error');
        return;
      }

      const contents = await (window.electronAPI as any).getDirectoryContents(normalizedPath);
      // Accept both array and { files: [] } shapes
      const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : null);
      if (files) {
        const filtered = filterFiles(files);
        setFolderItems(filtered as any);
        setDisplayedDirectory(normalizedPath);
        addLog(`Refreshed directory: ${formatPathForLog(normalizedPath)}`);
      } else {
        addLog(`Warning: Directory refresh returned invalid data`, 'info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to refresh directory: ${errorMessage}`, 'error');
    }
  }, [setFolderItems, setDisplayedDirectory, addLog, filterFiles]);

  useEffect(() => {
    if (!isCreateFolderOpen) return;
    setIsInlineCreatingFolder(true);
    setNewFolderDraftName('');
    setIsRenaming(null);
    setRenameValue('');
    setIsCreateFolderOpen(false);
  }, [isCreateFolderOpen, setIsCreateFolderOpen]);

  const cancelInlineNewFolder = useCallback(() => {
    setIsInlineCreatingFolder(false);
    setNewFolderDraftName('');
  }, []);

  const submitInlineNewFolder = useCallback(
    async (navigateInto: boolean) => {
      const trimmedName = newFolderDraftName.trim();
      if (!trimmedName) {
        showToast({
          title: 'Name required',
          description: 'Enter a folder name before pressing Enter.',
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
        return;
      }
      const existingFile = folderItems.find((f) => f.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingFile) {
        showToast({
          title: 'Cannot create folder',
          description: `A file or folder named "${trimmedName}" already exists.`,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
        return;
      }
      const fullPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, trimmedName);
      try {
        await (window.electronAPI as any).createDirectory(fullPath);
        if (navigateInto) {
          addLog(`Created and entered folder: ${trimmedName}`);
          setStatus(`Created and entered folder: ${trimmedName}`, 'success');
          setIsInlineCreatingFolder(false);
          setNewFolderDraftName('');
          setCurrentDirectory(fullPath);
        } else {
          addLog(`Created folder: ${trimmedName}`);
          setStatus(`Created folder: ${trimmedName}`, 'success');
          setIsInlineCreatingFolder(false);
          setNewFolderDraftName('');
          await refreshDirectory(currentDirectory);
          requestAnimationFrame(() => {
            setSelectedFiles([trimmedName]);
            setSelectedFile(trimmedName);
          });
        }
      } catch (error) {
        const errorMessage = getErrorMessageFromUnknown(error);
        addLog(`Failed to create folder: ${errorMessage}`, 'error');
        setStatus(`Failed to create folder: ${trimmedName}`, 'error');
        showToast({
          title: 'Create folder failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      }
    },
    [
      newFolderDraftName,
      folderItems,
      currentDirectory,
      addLog,
      setStatus,
      refreshDirectory,
      setCurrentDirectory,
      setSelectedFiles,
      setSelectedFile,
    ]
  );

  // Delete file(s) with confirmation - OPTIMIZED with useCallback
  const handleDeleteFile = useCallback(async (fileOrFiles: FileItem | FileItem[]) => {
    const filesToDelete = Array.isArray(fileOrFiles)
      ? fileOrFiles.map(f => f.name)
      : (selectedFiles.length > 1 ? selectedFiles : [fileOrFiles.name])
    
    try {
      if (!window.electronAPI || typeof (window.electronAPI as any).confirmDelete !== 'function') {
        const msg = 'Electron API not available: confirmDelete';
        addLog(msg, 'error');
        return;
      }
      
      const confirmed = await (window.electronAPI as any).confirmDelete(filesToDelete)
      if (!confirmed) return
      
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : filesToDelete.map(name => {
        const file = sortedFiles.find(f => f.name === name);
        return file || null;
      }).filter((f): f is FileItem => f !== null)
      const deletedFiles: string[] = [];
      const failedFiles: { name: string; error: string }[] = [];
      
      // Delete files one by one to handle individual errors
      for (const f of files) {
        try {
          setStatus(`Deleting: ${f.name}...`, 'info');
          await (window.electronAPI as any).deleteItem(f.path);
          deletedFiles.push(f.name);
          addLog(`Deleted: ${f.name}`, 'response');
        } catch (error: any) {
          const errorMessage = error?.message || error;
          failedFiles.push({ name: f.name, error: errorMessage });
          addLog(`Failed to delete: ${f.name} - ${errorMessage}`, 'error');
        }
      }
      
      if (deletedFiles.length > 0) {
        setStatus(`Successfully deleted ${deletedFiles.length} file(s)`, 'success');
        setSelectedFiles((prev) => prev.filter((n) => !deletedFiles.includes(n)));
      }
      
      if (failedFiles.length > 0) {
        const failedFileNames = failedFiles.map((f) => f.name).join(', ');
        setStatus(`Failed to delete: ${failedFileNames}`, 'error');
        const errorDetails = failedFiles.map((f) => `• ${f.name}: ${f.error}`).join('\n');
        addLog(`Delete operation completed with errors:\n${errorDetails}`, 'error');
        const failedItems = files.filter((f) => failedFiles.some((ff) => ff.name === f.name));
        showFileOperationFailureRef.current?.({
          title: 'Delete Failed',
          description: errorDetails,
          operationLabel: 'Delete',
          retry: async () => {
            let anyFailed = false;
            for (const f of failedItems) {
              try {
                setStatus(`Deleting: ${f.name}...`, 'info');
                await (window.electronAPI as any).deleteItem(f.path);
                addLog(`Deleted: ${f.name}`, 'response');
                setSelectedFiles((prev) => prev.filter((n) => n !== f.name));
              } catch (err: any) {
                anyFailed = true;
                const em = err?.message || err;
                addLog(`Failed to delete: ${f.name} - ${em}`, 'error');
              }
            }
            await refreshDirectory(currentDirectory);
            return !anyFailed;
          },
        });
      }

      await refreshDirectory(currentDirectory);
      if (failedFiles.length === 0) {
        setSelectedFiles([]);
      }
      
    } catch (error: any) {
      const errorMessage = error?.message || error;
      addLog(`Delete operation failed: ${errorMessage}`, 'error');
      setStatus('Delete operation failed', 'error');
    }
  }, [selectedFiles, sortedFiles, currentDirectory, addLog, setStatus, refreshDirectory])

  // In context menu, pass array for multi-select delete - OPTIMIZED with useCallback
  const handleMenuAction = useCallback(async (action: string, payload?: string) => {
    if (!contextMenu.fileItem) return

    try {
      switch (action) {
        case 'copy_path':
          await navigator.clipboard.writeText(contextMenu.fileItem.path)
          setStatus(`Copied path: ${contextMenu.fileItem.path}`, 'info')
          break
        case 'open':
          await handleOpenOrNavigate(contextMenu.fileItem)
          break
        case 'open_new_tab':
          if (contextMenu.fileItem.type === 'folder') {
            addTabToCurrentWindow(contextMenu.fileItem.path);
            addLog(`Opened new tab for folder: ${contextMenu.fileItem.name}`);
            setStatus(`Opened new tab for ${contextMenu.fileItem.name}`, 'info');
          }
          handleCloseContextMenu();
          break
        case 'rename':
          console.log('[Rename] Context menu rename triggered:', { name: contextMenu.fileItem.name, path: contextMenu.fileItem.path });
          setIsRenaming(contextMenu.fileItem.name)
          setRenameValue(contextMenu.fileItem.name)
          setStatus(`Renaming: ${contextMenu.fileItem.name}`, 'info')
          break
        case 'pin_quick_access':
          if (contextMenu.fileItem.type === 'folder') {
            await addQuickAccessPath(contextMenu.fileItem.path);
          }
          handleCloseContextMenu();
          break
        case 'unpin_quick_access':
          if (contextMenu.fileItem.type === 'folder') {
            await removeQuickAccessPath(contextMenu.fileItem.path);
          }
          handleCloseContextMenu();
          break
        case 'delete':
          if (selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)) {
            setStatus(`Deleting ${selectedFiles.length} files...`, 'info')
            await handleDeleteFile(sortedFiles.filter(f => selectedFilesSet.has(f.name)))
          } else {
            setStatus(`Deleting: ${contextMenu.fileItem.name}`, 'info')
            await handleDeleteFile(contextMenu.fileItem)
          }
          break
        case 'extract_text':
          if (contextMenu.fileItem.name.toLowerCase().endsWith('.pdf')) {
            setStatus(`Extracting text from: ${contextMenu.fileItem.name}`, 'info')
            addLog(`Extracting text from PDF: ${contextMenu.fileItem.name}`)
            try {
              const text = await window.electronAPI.readPdfText(contextMenu.fileItem.path)
              setExtractedTextData({ 
                fileName: contextMenu.fileItem.name, 
                text: text || 'No text could be extracted from this PDF.' 
              })
              setExtractedTextOpen(true)
              addLog(`Text extracted from ${contextMenu.fileItem.name} (${text.length} characters)`, 'response')
              setStatus('Text extraction completed', 'success')
            } catch (error) {
              addLog(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
              setStatus('Text extraction failed', 'error')
            }
          }
          break
        case 'merge_pdfs':
          // Get selected PDF files
          const selectedPDFs = selectedFiles.length > 1 
            ? selectedFiles.filter(filename => filename.toLowerCase().endsWith('.pdf'))
            : [];
          setMergePDFOpen(true)
          setStatus('Opening Merge PDF dialog', 'info')
          break
        case 'upload_to_vaults': {
          const appSettings = await settingsService.getSettings()
          const vaultDir = appSettings.vaultsClientPdfsDirectory?.trim()
          if (!vaultDir) {
            addLog('Set Vaults Client PDFs folder in Settings → Paths before uploading.', 'error')
            setStatus('Configure Client PDFs folder in Settings → Paths', 'error')
            break
          }
          const pdfsForVault = sortedFiles.filter(
            (f) =>
              f.type === 'file' &&
              selectedFilesSet.has(f.name) &&
              f.name.toLowerCase().endsWith('.pdf')
          )
          if (pdfsForVault.length === 0) {
            addLog('No PDF files in selection to upload.', 'error')
            setStatus('No PDFs selected', 'error')
            break
          }
          setVaultUploadSourcePaths(pdfsForVault.map((f) => f.path))
          setVaultUploadTargetDir(vaultDir)
          setUploadToVaultsOpen(true)
          setStatus('Upload to Vaults', 'info')
          break
        }
        case 'extract_zip':
          const selectedZipFiles = selectedFiles.filter(filename => 
            filename.toLowerCase().endsWith('.zip')
          );
          const zipFilesToExtract = selectedZipFiles.length > 1 ? selectedZipFiles : [contextMenu.fileItem.name];
          
          if (zipFilesToExtract.length === 1) {
            setStatus(`Extracting: ${zipFilesToExtract[0]}`, 'info')
            addLog(`Extracting ZIP file: ${zipFilesToExtract[0]}`)
            try {
              const result = await (window.electronAPI as any).executeCommand('extract_single_zip', currentDirectory, {
                filename: zipFilesToExtract[0]
              });
              if (result.success) {
                addLog(result.message, 'response');
                setStatus('ZIP extraction completed', 'success');
                // Green highlight for extracted files
                const extracted = result.extractedFiles ?? [];
                if (extracted.length > 0) {
                  const fullPaths = extracted.map((name: string) => joinPath(currentDirectory, name));
                  addRecentlyTransferredFiles(fullPaths);
                }
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp'))))) : files)
                    : files;
                  setFolderItems(filtered as any);
                }
              } else {
                addLog(result.message, 'error');
                setStatus('ZIP extraction failed', 'error');
              }
            } catch (error) {
              addLog(`Failed to extract ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('ZIP extraction failed', 'error');
            }
          } else {
            setStatus(`Extracting ${zipFilesToExtract.length} ZIP files...`, 'info')
            addLog(`Extracting ${zipFilesToExtract.length} ZIP files`)
            try {
              const result = await (window.electronAPI as any).executeCommand('extract_zips', currentDirectory);
              if (result.success) {
                addLog(result.message, 'response');
                setStatus(`${zipFilesToExtract.length} ZIP files extracted successfully`, 'success');
                // Green highlight for extracted files
                const extracted = result.extractedFiles ?? [];
                if (extracted.length > 0) {
                  const fullPaths = extracted.map((name: string) => joinPath(currentDirectory, name));
                  addRecentlyTransferredFiles(fullPaths);
                }
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp'))))) : files)
                    : files;
                  setFolderItems(filtered as any);
                }
              } else {
                addLog(result.message, 'error');
                setStatus('ZIP extraction failed', 'error');
              }
            } catch (error) {
              addLog(`Failed to extract ZIPs: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('ZIP extraction failed', 'error');
            }
          }
          break
        case 'extract_eml':
          const selectedEmlFiles = selectedFiles.filter(filename => 
            filename.toLowerCase().endsWith('.eml')
          );
          const emlFilesToExtract = selectedEmlFiles.length > 1 ? selectedEmlFiles : [contextMenu.fileItem.name];
          
          if (emlFilesToExtract.length === 1) {
            setStatus(`Extracting attachments: ${emlFilesToExtract[0]}`, 'info')
            addLog(`Extracting EML attachments: ${emlFilesToExtract[0]}`)
            try {
              const result = await (window.electronAPI as any).executeCommand('extract_single_eml', currentDirectory, {
                filename: emlFilesToExtract[0]
              });
              if (result.success) {
                addLog(result.message, 'response');
                setStatus('EML extraction completed', 'success');
                // Green highlight for extracted files
                const extracted = result.extractedFiles ?? [];
                if (extracted.length > 0) {
                  const fullPaths = extracted.map((name: string) => joinPath(currentDirectory, name));
                  addRecentlyTransferredFiles(fullPaths);
                }
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp'))))) : files)
                    : files;
                  setFolderItems(filtered as any);
                }
              } else {
                addLog(result.message, 'error');
                setStatus('EML extraction failed', 'error');
              }
            } catch (error) {
              addLog(`Failed to extract EML: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('EML extraction failed', 'error');
            }
          } else {
            setStatus(`Extracting attachments from ${emlFilesToExtract.length} EML files...`, 'info')
            addLog(`Extracting attachments from ${emlFilesToExtract.length} EML files`)
            try {
              const result = await (window.electronAPI as any).executeCommand('extract_eml', currentDirectory);
              if (result.success) {
                addLog(result.message, 'response');
                setStatus(`${emlFilesToExtract.length} EML files processed successfully`, 'success');
                // Green highlight for extracted files
                const extracted = result.extractedFiles ?? [];
                if (extracted.length > 0) {
                  const fullPaths = extracted.map((name: string) => joinPath(currentDirectory, name));
                  addRecentlyTransferredFiles(fullPaths);
                }
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp'))))) : files)
                    : files;
                  setFolderItems(filtered as any);
                }
              } else {
                addLog(result.message, 'error');
                setStatus('EML extraction failed', 'error');
              }
            } catch (error) {
              addLog(`Failed to extract EML: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('EML extraction failed', 'error');
            }
          }
          break
        case 'open_with_notepad':
          if (contextMenu.fileItem.type === 'file') {
            setStatus(`Opening ${contextMenu.fileItem.name} in Notepad`, 'info')
            addLog(`Opening in Notepad: ${contextMenu.fileItem.name}`)
            try {
              const result = await window.electronAPI.openFileInNotepad(contextMenu.fileItem.path)
              if (result?.success) {
                addLog(`Successfully opened ${contextMenu.fileItem.name} in Notepad`, 'response')
                setStatus('File opened in Notepad', 'success')
              } else {
                const msg = result?.error || 'Unknown error'
                addLog(`Failed to open file in Notepad: ${msg}`, 'error')
                setStatus('Failed to open file in Notepad', 'error')
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              addLog(`Failed to open file in Notepad: ${errorMessage}`, 'error')
              setStatus('Failed to open file in Notepad', 'error')
            }
          }
          break
        case 'edit_in_notepad':
          if (contextMenu.fileItem.name.toLowerCase().endsWith('.ahk')) {
            setStatus(`Opening ${contextMenu.fileItem.name} in Notepad`, 'info')
            addLog(`Opening AHK file in Notepad: ${contextMenu.fileItem.name}`)
            try {
              await (window.electronAPI as any).openFileInNotepad(contextMenu.fileItem.path);
              addLog(`Successfully opened ${contextMenu.fileItem.name} in Notepad`, 'response')
              setStatus('File opened in Notepad', 'success')
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              addLog(`Failed to open file in Notepad: ${errorMessage}`, 'error')
              setStatus('Failed to open file in Notepad', 'error')
            }
          }
          break
        case 'properties': {
          // Gather file info
          const file = contextMenu.fileItem;
          const stats = await (window.electronAPI as any).getFileStats(file.path);
          const isBlocked = await (window.electronAPI as any).isFileBlocked(file.path);
          setPropertiesFile({
            name: file.name,
            extension: file.name.split('.').pop() || '',
            size: stats.size,
            modified: stats.mtime ? new Date(stats.mtime).toLocaleString() : '',
            path: file.path,
            isBlocked,
          });
          setPropertiesOpen(true);
          break;
        }
        case 'assign_prefix': {
          // Store files to update before opening dialog
          const filesToUpdate = selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
            : contextMenu.fileItem && contextMenu.fileItem.type === 'file'
              ? [contextMenu.fileItem]
              : [];
          setPrefixDialogFiles(filesToUpdate);
          setIsIndexPrefixDialogOpen(true);
          break;
        }
        case 'remove_prefix': {
          // Remove prefix from selected files directly
          const filesToUpdate = selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
            : contextMenu.fileItem && contextMenu.fileItem.type === 'file'
              ? [contextMenu.fileItem]
              : [];
          
          if (filesToUpdate.length === 0) {
            handleCloseContextMenu();
            return;
          }
          
          // Filter only files that have a prefix to remove
          const filesWithPrefix = filesToUpdate.filter(f => extractIndexPrefix(f.name) !== null);
          
          if (filesWithPrefix.length === 0) {
            showToast({
              title: 'No Prefix to Remove',
              description: 'Selected file(s) do not have an index prefix.',
              status: 'info',
              duration: 3000,
              isClosable: true,
              position: 'top',
            });
            handleCloseContextMenu();
            return;
          }
          
          // Remove prefix directly without opening dialog
          handleCloseContextMenu();
          try {
            setStatus(`Removing prefix from ${filesWithPrefix.length} file(s)...`, 'info');
            const results = await Promise.allSettled(
              filesWithPrefix.map(async (file) => {
                const newName = removeIndexPrefix(file.name);
                if (newName === file.name) {
                  return { file: file.name, skipped: true, reason: 'No prefix found' };
                }
                const sourcePath = normalizePath(file.path);
                const parentDir = normalizePath(file.path.slice(0, file.path.length - file.name.length).replace(/[\\/]+$/, ''));
                const baseDir = normalizePath(parentDir || currentDirectory);
                const destPath = normalizePath(joinPath(baseDir, newName));
                
                await (window.electronAPI as any).moveFile(sourcePath, destPath);
                return { file: file.name, success: true, newName, sourcePath, destPath };
              })
            );

            const successful = results.filter(r => r.status === 'fulfilled' && !r.value.skipped).length;
            const failed = results.filter(r => r.status === 'rejected').length;

            if (successful > 0) {
              setStatus(`Removed prefix from ${successful} file(s)`, 'success');
              await refreshDirectory(currentDirectory);
              const prefixUndoMoves: Array<{ sourcePath: string; destPath: string }> = [];
              for (const r of results) {
                if (r.status !== 'fulfilled') continue;
                const v = r.value as { skipped?: boolean; sourcePath?: string; destPath?: string };
                if (!v.skipped && v.sourcePath && v.destPath) {
                  prefixUndoMoves.push({ sourcePath: v.sourcePath, destPath: v.destPath });
                }
              }
              const undoDir = currentDirectory;
              pushUndoableOperation({
                description: `Removed prefix from ${successful} file(s)`,
                undo: async () => {
                  for (const m of prefixUndoMoves) {
                    await (window.electronAPI as any).moveFile(m.destPath, m.sourcePath);
                  }
                  await refreshDirectory(undoDir);
                },
              });
            }
            if (failed > 0) {
              setStatus(`Failed to remove prefix from ${failed} file(s)`, 'error');
            }
          } catch (error) {
            addLog(`Failed to remove prefix: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setStatus('Failed to remove prefix', 'error');
          }
          break;
        }
        case 'preview':
          if (contextMenu.fileItem.type === 'file') {
            setSelectedFiles([contextMenu.fileItem.name]);
            setSelectedFile(contextMenu.fileItem.name);
            setIsPreviewPaneOpen(true);
            setStatus(`Previewing ${contextMenu.fileItem.name}`, 'info');
          }
          handleCloseContextMenu();
          break;
        case 'apply_prefix_quick': {
          const prefixKey = payload;
          const filesForPrefix = selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
            : contextMenu.fileItem.type === 'file'
              ? [contextMenu.fileItem]
              : [];
          handleCloseContextMenu();
          if (!prefixKey || filesForPrefix.length === 0) break;
          const prefixDir = currentDirectory;
          const prefixMoves: Array<{ from: string; to: string }> = [];
          try {
            setStatus(`Applying ${prefixKey} prefix to ${filesForPrefix.length} file(s)...`, 'info');
            for (const file of filesForPrefix) {
              const newName = setIndexPrefix(file.name, prefixKey);
              if (newName === file.name) continue;
              const newPath = joinPath(prefixDir === '/' ? '' : prefixDir, newName);
              await (window.electronAPI as any).renameItem(file.path, newPath);
              prefixMoves.push({ from: newPath, to: file.path });
            }
            await refreshDirectory(prefixDir);
            if (prefixMoves.length > 0) {
              addLog(`Applied ${prefixKey} prefix to ${prefixMoves.length} file(s)`);
              setStatus(`Applied ${prefixKey} prefix to ${prefixMoves.length} file(s)`, 'success');
              pushUndoableOperation({
                description: `Applied ${prefixKey} prefix to ${prefixMoves.length} file(s)`,
                undo: async () => {
                  for (const m of prefixMoves) {
                    await (window.electronAPI as any).renameItem(m.from, m.to);
                  }
                  await refreshDirectory(prefixDir);
                },
              });
            } else {
              setStatus(`File(s) already have the ${prefixKey} prefix`, 'info');
            }
          } catch (error) {
            if (prefixMoves.length > 0) await refreshDirectory(prefixDir);
            addLog(`Failed to apply prefix: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Failed to apply prefix', 'error');
          }
          break;
        }
        case 'duplicate': {
          const fileToDuplicate = contextMenu.fileItem;
          handleCloseContextMenu();
          if (fileToDuplicate.type !== 'file') break;
          const existingNames = new Set(folderItems.map(f => f.name.toLowerCase()));
          const dotIdx = fileToDuplicate.name.lastIndexOf('.');
          const stem = dotIdx > 0 ? fileToDuplicate.name.slice(0, dotIdx) : fileToDuplicate.name;
          const ext = dotIdx > 0 ? fileToDuplicate.name.slice(dotIdx) : '';
          let duplicateName = `${stem} - Copy${ext}`;
          let copyN = 2;
          while (existingNames.has(duplicateName.toLowerCase())) {
            duplicateName = `${stem} - Copy (${copyN})${ext}`;
            copyN++;
          }
          const duplicateDir = currentDirectory;
          const duplicatePath = joinPath(duplicateDir === '/' ? '' : duplicateDir, duplicateName);
          try {
            setStatus(`Duplicating ${fileToDuplicate.name}...`, 'info');
            const result = await (window.electronAPI as any).copyFileSilent(fileToDuplicate.path, duplicatePath);
            if (result && result.success === false) {
              throw new Error(result.error || 'Copy failed');
            }
            addLog(`Duplicated ${fileToDuplicate.name} as ${duplicateName}`);
            await refreshDirectory(duplicateDir);
            addRecentlyTransferredFiles([duplicatePath]);
            setStatus(`Duplicated as ${duplicateName}`, 'success');
            pushUndoableOperation({
              description: `Duplicated "${fileToDuplicate.name}"`,
              undo: async () => {
                await (window.electronAPI as any).deleteItem(duplicatePath);
                await refreshDirectory(duplicateDir);
              },
            });
          } catch (error) {
            addLog(`Failed to duplicate: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Failed to duplicate file', 'error');
          }
          break;
        }
        case 'roll_forward': {
          const fileToRoll = contextMenu.fileItem;
          handleCloseContextMenu();
          if (fileToRoll.type !== 'file' || !/20\d{2}/.test(fileToRoll.name)) break;
          const rolledName = fileToRoll.name.replace(/20\d{2}/g, (m) => String(Number(m) + 1));
          if (rolledName === fileToRoll.name) break;
          if (folderItems.some(f => f.name.toLowerCase() === rolledName.toLowerCase())) {
            showToast({
              title: 'Roll Forward Failed',
              description: `"${rolledName}" already exists in this folder.`,
              status: 'error',
              duration: 5000,
              isClosable: true,
              position: 'top',
            });
            break;
          }
          const rollDir = currentDirectory;
          const rolledPath = joinPath(rollDir === '/' ? '' : rollDir, rolledName);
          try {
            setStatus(`Rolling forward ${fileToRoll.name}...`, 'info');
            const result = await (window.electronAPI as any).copyFileSilent(fileToRoll.path, rolledPath);
            if (result && result.success === false) {
              throw new Error(result.error || 'Copy failed');
            }
            addLog(`Rolled forward ${fileToRoll.name} → ${rolledName}`);
            await refreshDirectory(rollDir);
            addRecentlyTransferredFiles([rolledPath]);
            setStatus(`Created ${rolledName}`, 'success');
            pushUndoableOperation({
              description: `Rolled forward to "${rolledName}"`,
              undo: async () => {
                await (window.electronAPI as any).deleteItem(rolledPath);
                await refreshDirectory(rollDir);
              },
            });
          } catch (error) {
            addLog(`Roll forward failed: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Roll forward failed', 'error');
          }
          break;
        }
        case 'move_to_recent': {
          const destDir = payload;
          const filesToMoveQuick = selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
            : contextMenu.fileItem.type === 'file'
              ? [contextMenu.fileItem]
              : [];
          handleCloseContextMenu();
          if (!destDir || filesToMoveQuick.length === 0) break;
          const sourceDir = currentDirectory;
          const destLabel = destDir.split(/[\\/]/).filter(Boolean).pop() || destDir;
          try {
            setStatus(`Moving ${filesToMoveQuick.length} file(s) to ${destLabel}...`, 'info');
            const results = await window.electronAPI.moveFilesWithConflictResolution(
              filesToMoveQuick.map(f => f.path),
              destDir
            );
            const moved = results.filter(r => r.status === 'success' && r.path);
            const failed = results.filter(r => r.status === 'error');
            await refreshDirectory(sourceDir);
            if (moved.length > 0) {
              addLog(`Moved ${moved.length} file(s) to ${destDir}`);
              setStatus(`Moved ${moved.length} file(s) to ${destLabel}`, 'success');
              setSelectedFiles([]);
              const movedPaths = moved.map(r => r.path as string);
              pushUndoableOperation({
                description: `Moved ${moved.length} file(s) to ${destLabel}`,
                undo: async () => {
                  await (window.electronAPI as any).moveFilesSilent(movedPaths, sourceDir);
                  await refreshDirectory(sourceDir);
                },
              });
            }
            if (failed.length > 0) {
              setStatus(`Failed to move ${failed.length} file(s)`, 'error');
              addLog(`Failed to move ${failed.length} file(s): ${failed.map(f => f.error).join('; ')}`, 'error');
            }
          } catch (error) {
            addLog(`Move failed: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Move failed', 'error');
          }
          break;
        }
        case 'open_with': {
          const targetFile = contextMenu.fileItem;
          handleCloseContextMenu();
          if (targetFile.type !== 'file' || !payload) break;
          try {
            setStatus(`Opening ${targetFile.name}...`, 'info');
            const result = await (window.electronAPI as any).openFileWith(targetFile.path, payload);
            if (result && result.success === false) {
              throw new Error(result.error || 'Failed to open');
            }
          } catch (error) {
            addLog(`Failed to open with ${payload}: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus(`Failed to open ${targetFile.name}`, 'error');
          }
          break;
        }
        case 'copy_files_clipboard': {
          const filesForClipboard = selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name))
            : [contextMenu.fileItem];
          handleCloseContextMenu();
          if (filesForClipboard.length === 0) break;
          try {
            const result = await (window.electronAPI as any).copyFilesToClipboard(filesForClipboard.map(f => f.path));
            if (result && result.success === false) {
              throw new Error(result.error || 'Clipboard copy failed');
            }
            setStatus(`Copied ${filesForClipboard.length} file(s) to clipboard — paste into Outlook or Explorer`, 'success');
            addLog(`Copied ${filesForClipboard.length} file(s) to the Windows clipboard`);
          } catch (error) {
            addLog(`Failed to copy files to clipboard: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Failed to copy files to clipboard', 'error');
          }
          break;
        }
        case 'zip_selection': {
          const filesForZip = selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)
            ? sortedFiles.filter(f => selectedFilesSet.has(f.name))
            : [contextMenu.fileItem];
          handleCloseContextMenu();
          if (filesForZip.length === 0) break;
          const zipDir = currentDirectory;
          const zipBase = filesForZip.length === 1
            ? filesForZip[0].name.replace(/\.[^.]+$/, '')
            : (zipDir.split(/[\\/]/).filter(Boolean).pop() || 'Archive');
          const existingZipNames = new Set(folderItems.map(f => f.name.toLowerCase()));
          let zipName = `${zipBase}.zip`;
          let zipN = 2;
          while (existingZipNames.has(zipName.toLowerCase())) {
            zipName = `${zipBase} (${zipN}).zip`;
            zipN++;
          }
          const zipPath = joinPath(zipDir === '/' ? '' : zipDir, zipName);
          try {
            setStatus(`Zipping ${filesForZip.length} item(s)...`, 'info');
            const result = await (window.electronAPI as any).zipSelection(filesForZip.map(f => f.path), zipPath);
            if (!result?.success) {
              throw new Error(result?.error || 'Zip failed');
            }
            await refreshDirectory(zipDir);
            addRecentlyTransferredFiles([zipPath]);
            addLog(`Created ${zipName} from ${filesForZip.length} item(s)`);
            setStatus(`Created ${zipName}`, 'success');
            pushUndoableOperation({
              description: `Created "${zipName}"`,
              undo: async () => {
                await (window.electronAPI as any).deleteItem(zipPath);
                await refreshDirectory(zipDir);
              },
            });
          } catch (error) {
            addLog(`Failed to zip selection: ${getErrorMessageFromUnknown(error)}`, 'error');
            setStatus('Failed to create ZIP', 'error');
          }
          break;
        }
        case 'convert_to_pdf': {
          const docFile = contextMenu.fileItem;
          handleCloseContextMenu();
          if (docFile.type !== 'file') break;
          const convertDir = currentDirectory;
          try {
            setStatus(`Converting ${docFile.name} to PDF... (this can take a few seconds)`, 'info');
            const result = await (window.electronAPI as any).convertFileToPdf(docFile.path);
            if (!result?.success) {
              throw new Error(result?.error || 'Conversion failed');
            }
            const pdfPath = joinPath(convertDir === '/' ? '' : convertDir, result.outputName);
            await refreshDirectory(convertDir);
            addRecentlyTransferredFiles([pdfPath]);
            addLog(`Converted ${docFile.name} → ${result.outputName}`);
            setStatus(`Created ${result.outputName}`, 'success');
            pushUndoableOperation({
              description: `Converted "${docFile.name}" to PDF`,
              undo: async () => {
                await (window.electronAPI as any).deleteItem(pdfPath);
                await refreshDirectory(convertDir);
              },
            });
          } catch (error) {
            const message = getErrorMessageFromUnknown(error);
            addLog(`Convert to PDF failed: ${message}`, 'error');
            setStatus('Convert to PDF failed', 'error');
            showToast({
              title: 'Convert to PDF Failed',
              description: message,
              status: 'error',
              duration: 6000,
              isClosable: true,
              position: 'top',
            });
          }
          break;
        }
        case 'split_pdf':
          if (contextMenu.fileItem.name.toLowerCase().endsWith('.pdf')) {
            setSplitPdfFile(contextMenu.fileItem);
            setIsSplitPdfOpen(true);
          }
          break;
        case 'edit_pdf':
          if (contextMenu.fileItem.name.toLowerCase().endsWith('.pdf')) {
            setEditPdfFile(contextMenu.fileItem);
            setIsEditPdfOpen(true);
          }
          break;
        case 'smart_rename':
          setSmartRenameFile(contextMenu.fileItem);
          setIsSmartRenameDialogOpen(true);
          break;
        case 'proper_case_rename':
          await handleProperCaseRename(contextMenu.fileItem);
          break;
        case 'replace_with_latest':
          if (contextMenu.fileItem.type === 'file') {
            setStatus(`Replacing ${contextMenu.fileItem.name} with latest file from Downloads...`, 'info');
            addLog(`Replacing ${contextMenu.fileItem.name} with latest file from Downloads`, 'command');
            try {
              const result = await (window.electronAPI as any).replaceWithLatestFile(contextMenu.fileItem.path);
              if (result && result.success) {
                const newVersion = versionStore.bump(contextMenu.fileItem.path);
                addLog(result.message || `Replaced ${contextMenu.fileItem.name} with latest file from Downloads`, 'response');
                setStatus(`File replaced with latest download (now v${newVersion})`, 'success');
                await refreshDirectory(currentDirectory);
              } else {
                const message = result?.message || 'Replace with latest file failed';
                addLog(message, 'error');
                setStatus('Replace with latest file failed', 'error');
                showToast({
                  title: 'Replace Failed',
                  description: message,
                  status: 'error',
                  duration: 5000,
                  isClosable: true,
                  position: 'top',
                });
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              addLog(`Replace with latest file failed: ${errorMessage}`, 'error');
              setStatus('Replace with latest file failed', 'error');
              showToast({
                title: 'Replace Failed',
                description: errorMessage,
                status: 'error',
                duration: 5000,
                isClosable: true,
                position: 'top',
              });
            }
          }
          break;
        case 'replace_via_transfer':
          if (contextMenu.fileItem.type === 'file') {
            // TransferPanel listens for this and opens pre-armed in Replace mode
            window.dispatchEvent(new CustomEvent('openTransferReplace', {
              detail: { targetPath: contextMenu.fileItem.path, targetName: contextMenu.fileItem.name },
            }));
          }
          break;
        default:
          addLog(`Function: ${action} on ${contextMenu.fileItem.name}`)
      }
    } catch (error) {
      addLog(`Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }

  handleCloseContextMenu()
  }, [contextMenu.fileItem, selectedFiles, selectedFilesSet, sortedFiles, folderItems, currentDirectory, addLog, setStatus, addTabToCurrentWindow, setIsRenaming, setRenameValue, handleDeleteFile, setExtractedTextData, setExtractedTextOpen, setMergePDFOpen, setUploadToVaultsOpen, hideTemporaryFiles, setFolderItems, handleOpenOrNavigate, handleCloseContextMenu, addQuickAccessPath, removeQuickAccessPath, refreshDirectory, setSelectedFiles, setIsPreviewPaneOpen, addRecentlyTransferredFiles])

  const closeFileOpFailure = useCallback(() => {
    setFileOpFailureDialog((d) => ({ ...d, open: false }))
    fileOpRetryRef.current = null
    fileOpCancelRef.current = null
  }, [])

  const handleFileOpFailureRetry = useCallback(async () => {
    const fn = fileOpRetryRef.current
    if (!fn) return
    setFileOpRetrying(true)
    try {
      const ok = await fn()
      if (ok) closeFileOpFailure()
    } finally {
      setFileOpRetrying(false)
    }
  }, [closeFileOpFailure])

  const handleFileOpFailureCancel = useCallback(() => {
    fileOpCancelRef.current?.()
    closeFileOpFailure()
  }, [closeFileOpFailure])

  const showFileOperationFailure = useCallback(
    (opts: {
      title: string
      description: string
      operationLabel: string
      retry: () => Promise<boolean>
      onCancel?: () => void
    }) => {
      const toastDesc =
        opts.description.length > 220 ? `${opts.description.slice(0, 220)}…` : opts.description
      showToast({
        title: opts.title,
        description: toastDesc,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      })
      fileOpRetryRef.current = opts.retry
      fileOpCancelRef.current = opts.onCancel ?? null
      setFileOpFailureDialog({
        open: true,
        title: opts.title,
        description: opts.description,
        operationLabel: opts.operationLabel,
      })
    },
    []
  )

  useEffect(() => {
    showFileOperationFailureRef.current = showFileOperationFailure
  }, [showFileOperationFailure])

  // Handler for transfer from group header (plus button dropdown)
  const handleTransferFromGroupHeader = useCallback(async (opts: { command?: string; newName?: string }) => {
    try {
      setStatus('Transferring...', 'info');
      const transferOptions: { numFiles: number; command?: string; newName?: string; currentDirectory: string } = {
        numFiles: 1,
        currentDirectory,
      };
      if (opts.command) {
        transferOptions.command = opts.command;
      } else if (opts.newName?.trim()) {
        transferOptions.newName = opts.newName.trim();
        transferOptions.command = 'transfer';
      } else {
        setStatus('No template or filename provided', 'error');
        return;
      }
      const result = await (window.electronAPI as any).transfer(transferOptions);
      if (result.success) {
        // Template transfers overwrite silently — record those as new versions
        for (const p of (result.overwrites ?? []) as string[]) {
          const v = versionStore.bump(p);
          addLog(`Overwrote existing file — now v${v}: ${p}`, 'response');
        }
        addLog(result.message, 'response');
        setStatus('Transfer completed', 'success');
        window.dispatchEvent(new CustomEvent('folderRefresh'));
        await refreshDirectory(currentDirectory);
      } else {
        const conflictFailure = Array.isArray(result.failures)
          ? result.failures.find((f: { conflict?: boolean }) => f.conflict)
          : null;
        addLog(result.message, 'error');
        setStatus('Transfer failed', 'error');
        showToast({
          title: conflictFailure ? 'File Already Exists' : 'Transfer Failed',
          description: conflictFailure
            ? `${result.message}\nUse the Transfer Panel (Ctrl+Space) → REPLACE to replace it as a new version.`
            : result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Transfer failed: ${errorMessage}`, 'error');
      setStatus('Transfer failed', 'error');
      showToast({
        title: 'Transfer Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [currentDirectory, addLog, setStatus, refreshDirectory]);

  // Handler for assigning/changing index prefix (or copying if isCopy is true)
  const handleAssignPrefix = useCallback(async (indexKey: string | null, isCopy?: boolean) => {
    const filesToUpdate = prefixDialogFiles;
    
    console.log('[FileGrid] handleAssignPrefix called', { indexKey, isCopy, filesCount: filesToUpdate.length });
    
    if (filesToUpdate.length === 0) {
      console.warn('[FileGrid] No files to update');
      return;
    }
    
    // Validate: if copying, indexKey must be provided (but allow removing prefix without copy)
    if (isCopy && !indexKey) {
      console.error('[FileGrid] Copy operation requires an index key');
      showToast({
        title: 'Invalid Operation',
        description: 'Cannot copy file without selecting an index prefix.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      return;
    }
    
    // Allow removing prefix when not copying
    if (!indexKey && !isCopy) {
      // Removing prefix - this is valid for rename operations
      console.log('[FileGrid] Removing prefix from files');
    }
    
    try {
      const action = isCopy ? 'Copying' : 'Updating prefix for';
      setStatus(`${action} ${filesToUpdate.length} file(s)...`, 'info');
      
      const results = await Promise.allSettled(
        filesToUpdate.map(async (file) => {
          const sourcePath = normalizePath(file.path);
          const parentDir = normalizePath(file.path.slice(0, file.path.length - file.name.length).replace(/[\\/]+$/, ''));
          const baseDir = normalizePath(parentDir || currentDirectory);
          
          console.log('[FileGrid] Processing file:', { 
            fileName: file.name, 
            sourcePath, 
            parentDir, 
            baseDir, 
            currentDirectory,
            isCopy 
          });
          
          if (isCopy) {
            // Copy file - always copy, even if prefix is the same
            // First, determine the new name with the selected prefix
            if (!indexKey) {
              // If no index key selected, we can't copy (shouldn't happen, but handle it)
              throw new Error('Cannot copy file without selecting an index prefix');
            }
            
            const newName = setIndexPrefix(file.name, indexKey);
            const destPath = normalizePath(joinPath(baseDir, newName));
            
            console.log('[FileGrid] Copy operation details:', {
              sourcePath,
              baseDir,
              newName,
              destPath,
              sourceEqualsDest: sourcePath === destPath
            });
            
            // Safety check: don't copy file to itself
            if (sourcePath === destPath) {
              console.warn('[FileGrid] Source and destination are the same, skipping copy');
              return { file: file.name, skipped: true, reason: 'Source and destination are the same' };
            }
            
            // Strategy: Temporarily rename existing target file (if it exists) to avoid conflict dialog
            // Then copy source file, rename copy to target, and restore original with conflict resolution
            let existingFileMoved = false;
            let existingFileTempPath: string | null = null;
            
            try {
              // Check if target file already exists (and is different from source)
              let targetExists = false;
              if (destPath !== sourcePath) {
                try {
                  const stats = await (window.electronAPI as any).getFileStats(destPath);
                  targetExists = stats && stats.isFile;
                } catch (err) {
                  // File doesn't exist, targetExists remains false
                  targetExists = false;
                }
              }
              
              if (targetExists) {
                // Temporarily move the existing target file to avoid conflict dialog
                existingFileTempPath = joinPath(baseDir, `~temp_existing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newName}`);
                try {
                  await (window.electronAPI as any).renameItem(destPath, existingFileTempPath);
                  existingFileMoved = true;
                } catch (moveError) {
                  // If move fails, the file might have been deleted - continue anyway
                  existingFileMoved = false;
                }
              }
              
              // Copy the source file silently with a temporary unique name first to avoid conflict dialog
              const tempFileName = `~temp_copy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.tmp`;
              const tempFilePath = normalizePath(joinPath(baseDir, tempFileName));
              
              console.log('[FileGrid] Silently copying file to temp name first:', { sourcePath, baseDir, tempFileName, tempFilePath });
              
              // Use the new silent copy method to avoid any dialogs
              try {
                const copyResult = await (window.electronAPI as any).copyFileSilent(sourcePath, tempFilePath);
                console.log('[FileGrid] Silent copy result:', copyResult);
                
                if (!copyResult || !copyResult.success) {
                  throw new Error(copyResult?.error || 'Silent copy failed');
                }
                
                // Now rename the temp file to the final destination
                console.log('[FileGrid] Renaming temp file to final destination:', { tempFilePath, destPath });
                await (window.electronAPI as any).renameItem(tempFilePath, destPath);
                console.log('[FileGrid] Rename completed successfully');
                
                // If we moved an existing file, restore it with conflict resolution
                if (existingFileMoved && existingFileTempPath) {
                  // Find an available name for the existing file
                  let restored = false;
                  for (let i = 1; i <= 100 && !restored; i++) {
                    const conflictName = i === 1 
                      ? newName.replace(/(\.[^.]+)$/, ' (1)$1')
                      : newName.replace(/(\.[^.]+)$/, ` (${i})$1`);
                    const conflictPath = joinPath(baseDir, conflictName);
                    
                    // Check if conflict path exists
                    let conflictExists = false;
                    try {
                      const stats = await (window.electronAPI as any).getFileStats(conflictPath);
                      conflictExists = stats && (stats.isFile || stats.isDirectory);
                    } catch (err) {
                      conflictExists = false;
                    }
                    
                    if (!conflictExists) {
                      await (window.electronAPI as any).renameItem(existingFileTempPath, conflictPath);
                      restored = true;
                    }
                  }
                  
                  if (!restored) {
                    // Couldn't find available name - try to restore to original (might fail)
                    try {
                      await (window.electronAPI as any).renameItem(existingFileTempPath, destPath);
                    } catch (e) {
                      // If that fails, keep it with temp name
                    }
                  }
                }
                
                console.log('[FileGrid] Copy operation successful for:', file.name);
                return { file: file.name, success: true };
              } catch (copyError) {
                // Clean up temp file if it exists
                try {
                  const tempStats = await (window.electronAPI as any).getFileStats(tempFilePath);
                  if (tempStats && tempStats.isFile) {
                    await (window.electronAPI as any).deleteFile(tempFilePath);
                  }
                } catch (cleanupError) {
                  // Ignore cleanup errors
                }
                
                // Restore existing file if we moved it
                if (existingFileMoved && existingFileTempPath) {
                  try {
                    await (window.electronAPI as any).renameItem(existingFileTempPath, destPath);
                  } catch (restoreError) {
                    // If restore fails, try conflict resolution
                    for (let i = 1; i <= 100; i++) {
                      const conflictName = i === 1 
                        ? newName.replace(/(\.[^.]+)$/, ' (1)$1')
                        : newName.replace(/(\.[^.]+)$/, ` (${i})$1`);
                      const conflictPath = joinPath(baseDir, conflictName);
                      try {
                        await (window.electronAPI as any).renameItem(existingFileTempPath, conflictPath);
                        break;
                      } catch (e) {
                        // Continue to next
                      }
                    }
                  }
                }
                
                const errorMsg = `Failed to copy file: ${file.name}. ${copyError instanceof Error ? copyError.message : String(copyError)}`;
                console.error('[FileGrid] Copy failed:', { file: file.name, error: copyError, errorMsg });
                throw new Error(errorMsg);
              }
            } catch (error) {
              // If anything fails and we moved an existing file, try to restore it
              if (existingFileMoved && existingFileTempPath) {
                try {
                  await (window.electronAPI as any).renameItem(existingFileTempPath, destPath);
                } catch (restoreError) {
                  // If restore fails, try conflict resolution
                  for (let i = 1; i <= 100; i++) {
                    const conflictName = i === 1 
                      ? newName.replace(/(\.[^.]+)$/, ' (1)$1')
                      : newName.replace(/(\.[^.]+)$/, ` (${i})$1`);
                    const conflictPath = joinPath(baseDir, conflictName);
                    try {
                      await (window.electronAPI as any).renameItem(existingFileTempPath, conflictPath);
                      break;
                    } catch (e) {
                      // Continue to next
                    }
                  }
                }
              }
              throw error;
            }
          } else {
            // Rename file (not copy)
            const newName = indexKey === null ? removeIndexPrefix(file.name) : setIndexPrefix(file.name, indexKey);
            
            if (newName === file.name) {
              return { file: file.name, skipped: true };
            }
            
            const destPath = joinPath(baseDir, newName);
            
            await (window.electronAPI as any).renameItem(sourcePath, destPath);
            
            return { file: file.name, success: true };
          }
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
      const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as any).skipped).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Log detailed results including errors
      const failedResults = results.filter(r => r.status === 'rejected');
      if (failedResults.length > 0) {
        console.error('[FileGrid] Failed operations:', failedResults.map(r => ({
          reason: r.reason,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          stack: r.reason instanceof Error ? r.reason.stack : undefined
        })));
      }
      
      console.log('[FileGrid] Operation results:', { successful, skipped, failed, isCopy, totalFiles: filesToUpdate.length });
      
      const actionText = isCopy ? 'Copied' : 'Updated';
      
      // Show error toast if any operations failed
      if (failed > 0) {
        const errorMessages = failedResults.map(r => {
          if (r.reason instanceof Error) {
            return r.reason.message;
          }
          return String(r.reason);
        }).join('; ');
        
        showToast({
          title: isCopy ? 'Copy Failed' : 'Prefix Assignment Failed',
          description: `${failed} file(s) failed: ${errorMessages}`,
          status: 'error',
          duration: 8000,
          isClosable: true,
          position: 'top',
        });
        
        setStatus(`Failed to ${actionText.toLowerCase()} ${failed} file(s)`, 'error');
        addLog(`Failed to ${actionText.toLowerCase()} ${failed} file(s): ${errorMessages}`, 'error');
      } else {
        setStatus(successful > 0 ? `${actionText} ${successful} file(s)` : 'No changes needed', successful > 0 ? 'success' : 'info');
      }
      
      // Always refresh directory after copy/rename operations
      console.log('[FileGrid] Refreshing directory:', currentDirectory);
      await refreshDirectory(currentDirectory);
      console.log('[FileGrid] Directory refresh completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const actionText = isCopy ? 'copy' : 'assign prefix';
      console.error('[FileGrid] Unexpected error in handleAssignPrefix:', error);
      addLog(`Failed to ${actionText}: ${errorMessage}`, 'error');
      setStatus(`Failed to ${actionText}`, 'error');
      showToast({
        title: isCopy ? 'Copy Failed' : 'Prefix Assignment Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [prefixDialogFiles, currentDirectory, addLog, setStatus, refreshDirectory]);

  // Handler for copying files to another index
  const handleCopyToIndex = useCallback(async (targetIndex: string) => {
    // Get files to copy - use selected files if multiple selected, otherwise use context menu file
    const filesToCopy = selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
      ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
      : contextMenu.fileItem && contextMenu.fileItem.type === 'file'
        ? [contextMenu.fileItem]
        : [];
    
    if (filesToCopy.length === 0) return;
    
    try {
      setStatus(`Copying ${filesToCopy.length} file(s) to index ${targetIndex}...`, 'info');
      
      const results = await Promise.allSettled(
        filesToCopy.map(async (file) => {
          const newName = setIndexPrefix(file.name, targetIndex);
          const sourcePath = file.path;
          const destPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newName);
          
          // Copy file with conflict resolution
          const copyResults = await (window.electronAPI as any).copyFilesWithConflictResolution([sourcePath], currentDirectory);
          
          if (copyResults && copyResults.length > 0 && copyResults[0].status === 'success') {
            // If the copied file has a different name (due to conflict resolution), use that
            const copiedFileName = copyResults[0].path ? copyResults[0].path.split(/[\\/]/).pop() : file.name;
            const copiedPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, copiedFileName);
            
            // Only rename if the copied file name doesn't already match the target name
            if (copiedFileName !== newName) {
              await (window.electronAPI as any).renameItem(copiedPath, destPath);
            }
          }
          
          return { file: file.name, success: true };
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        addLog(`Copied ${successful} file(s) to index ${targetIndex}`, 'response');
        setStatus(`Copied ${successful} file(s)`, 'success');
        await refreshDirectory(currentDirectory);
      }
      
      if (failed > 0) {
        addLog(`Failed to copy ${failed} file(s)`, 'error');
        setStatus(`Failed to copy ${failed} file(s)`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Copy to index failed: ${errorMessage}`, 'error');
      setStatus('Copy to index failed', 'error');
      showToast({
        title: 'Copy Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [selectedFiles, sortedFiles, contextMenu.fileItem, selectedFilesSet, currentDirectory, addLog, setStatus, refreshDirectory]);

  // Handler for renaming files between indexes
  const handleRenameIndex = useCallback(async (sourceIndex: string, targetIndex: string) => {
    const filesToRename = selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
      ? sortedFiles.filter(f => {
          const prefix = extractIndexPrefix(f.name);
          return selectedFilesSet.has(f.name) && prefix === sourceIndex;
        })
      : contextMenu.fileItem && extractIndexPrefix(contextMenu.fileItem.name) === sourceIndex
        ? [contextMenu.fileItem]
        : [];
    
    if (filesToRename.length === 0) return;
    
    try {
      setStatus(`Renaming ${filesToRename.length} file(s) from ${sourceIndex} to ${targetIndex}...`, 'info');
      
      const results = await Promise.allSettled(
        filesToRename.map(async (file) => {
          const newName = setIndexPrefix(file.name, targetIndex);
          const oldPath = file.path;
          const newPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newName);
          
          await (window.electronAPI as any).renameItem(oldPath, newPath);
          return { file: file.name, success: true };
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (successful > 0) {
        addLog(`Renamed ${successful} file(s) from ${sourceIndex} to ${targetIndex}`, 'response');
        setStatus(`Renamed ${successful} file(s)`, 'success');
        await refreshDirectory(currentDirectory);
      }
      
      if (failed > 0) {
        addLog(`Failed to rename ${failed} file(s)`, 'error');
        setStatus(`Failed to rename ${failed} file(s)`, 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Rename index failed: ${errorMessage}`, 'error');
      setStatus('Rename index failed', 'error');
    }
  }, [selectedFiles, sortedFiles, contextMenu.fileItem, selectedFilesSet, currentDirectory, addLog, setStatus, refreshDirectory]);

  // Handler for proper case rename
  const handleProperCaseRename = useCallback(async (file: FileItem) => {
    try {
      const currentPrefix = extractIndexPrefix(file.name);
      const nameWithoutPrefix = removeIndexPrefix(file.name);
      const extension = nameWithoutPrefix.includes('.') ? nameWithoutPrefix.substring(nameWithoutPrefix.lastIndexOf('.')) : '';
      const nameWithoutExt = extension ? nameWithoutPrefix.substring(0, nameWithoutPrefix.lastIndexOf('.')) : nameWithoutPrefix;
      
      const properCasedName = toProperCase(nameWithoutExt) + extension;
      const newName = currentPrefix ? `${currentPrefix} - ${properCasedName}` : properCasedName;
      
      if (newName === file.name) {
        setStatus('Filename already in proper case', 'info');
        return;
      }
      
      const oldPath = file.path;
      const newPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newName);
      
      await (window.electronAPI as any).renameItem(oldPath, newPath);
      addLog(`Proper cased: ${file.name} → ${newName}`);
      setStatus('Filename proper cased', 'success');
      await refreshDirectory(currentDirectory);
      {
        const undoDir = currentDirectory;
        pushUndoableOperation({
          description: `Proper cased "${file.name}"`,
          undo: async () => {
            await (window.electronAPI as any).renameItem(newPath, oldPath);
            await refreshDirectory(undoDir);
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to proper case filename: ${errorMessage}`, 'error');
      setStatus('Failed to proper case filename', 'error');
      const { title, description } = renameFailedToastContent(error, file.name);
      showToast({
        title,
        description,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [currentDirectory, addLog, setStatus, refreshDirectory]);

  // Handler for smart rename confirmation
  const handleSmartRenameConfirm = useCallback(async (newName: string) => {
    if (!smartRenameFile) return;
    
    try {
      const oldPath = smartRenameFile.path;
      const newPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newName);
      
      await (window.electronAPI as any).renameItem(oldPath, newPath);
      addLog(`Smart renamed: ${smartRenameFile.name} → ${newName}`);
      setStatus('File renamed', 'success');
      await refreshDirectory(currentDirectory);
      {
        const undoDir = currentDirectory;
        const oldName = smartRenameFile.name;
        pushUndoableOperation({
          description: `Smart renamed "${oldName}" to "${newName}"`,
          undo: async () => {
            await (window.electronAPI as any).renameItem(newPath, oldPath);
            await refreshDirectory(undoDir);
          },
        });
      }
      setSmartRenameFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to rename: ${errorMessage}`, 'error');
      setStatus('Failed to rename file', 'error');
      const { title, description } = renameFailedToastContent(error, smartRenameFile.name);
      showToast({
        title,
        description,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      throw error; // Re-throw so dialog can handle it
    }
  }, [smartRenameFile, currentDirectory, addLog, setStatus, refreshDirectory]);

  // Split PDF dialog confirm: write the new files, highlight them, allow undo
  const handleSplitPdfConfirm = useCallback(async (file: FileItem, options: { segments: Array<{ pages: number[]; name: string }> }) => {
    const splitDir = currentDirectory;
    const result = await (window.electronAPI as any).splitPdf(file.path, options);
    if (!result?.success) {
      throw new Error(result?.error || 'Split failed');
    }
    const outputNames: string[] = result.outputFiles || [];
    const fullPaths = outputNames.map((name) => joinPath(splitDir === '/' ? '' : splitDir, name));
    await refreshDirectory(splitDir);
    addRecentlyTransferredFiles(fullPaths);
    addLog(`Split ${file.name} into ${outputNames.length} file(s)`);
    setStatus(`Created ${outputNames.length} PDF(s)`, 'success');
    pushUndoableOperation({
      description: `Split "${file.name}" into ${outputNames.length} file(s)`,
      undo: async () => {
        for (const p of fullPaths) {
          await (window.electronAPI as any).deleteItem(p);
        }
        await refreshDirectory(splitDir);
      },
    });
  }, [currentDirectory, refreshDirectory, addRecentlyTransferredFiles, addLog, setStatus]);

  // Edit PDF dialog confirm: reorder/delete pages, overwrite (with backup undo) or save as new
  const handleEditPdfConfirm = useCallback(async (file: FileItem, options: { pages: number[]; outputName: string }) => {
    const editDir = currentDirectory;
    const result = await (window.electronAPI as any).editPdf(file.path, options);
    if (!result?.success) {
      throw new Error(result?.error || 'Edit failed');
    }
    const outputName: string = result.outputFile || file.name;
    const outputPath = joinPath(editDir === '/' ? '' : editDir, outputName);
    await refreshDirectory(editDir);
    addRecentlyTransferredFiles([outputPath]);
    if (result.overwritten) {
      const newVersion = versionStore.bump(file.path);
      addLog(`Edited ${file.name} (${options.pages.length} pages, now v${newVersion})`);
      setStatus(`Saved ${file.name}`, 'success');
      const backupPath: string | undefined = result.backupPath;
      if (backupPath) {
        pushUndoableOperation({
          description: `Edit "${file.name}" (reorder/delete pages)`,
          undo: async () => {
            await (window.electronAPI as any).restoreFileBackup(backupPath, file.path);
            await refreshDirectory(editDir);
          },
        });
      }
    } else {
      addLog(`Saved edited copy of ${file.name} as ${outputName}`);
      setStatus(`Created ${outputName}`, 'success');
      pushUndoableOperation({
        description: `Save edited copy "${outputName}"`,
        undo: async () => {
          await (window.electronAPI as any).deleteItem(outputPath);
          await refreshDirectory(editDir);
        },
      });
    }
  }, [currentDirectory, refreshDirectory, addRecentlyTransferredFiles, addLog, setStatus]);

  const handleRenameSubmit = useCallback(
    async (e?: React.FormEvent): Promise<boolean> => {
      e?.preventDefault();
      if (!isRenaming) return true;
      const trimmedName = renameValue?.trim();
      if (!trimmedName) {
        setIsRenaming(null);
        setRenameValue('');
        return true;
      }
      if (trimmedName === isRenaming) {
        setIsRenaming(null);
        setRenameValue('');
        return true;
      }
      console.log('[Rename] handleRenameSubmit started:', { oldName: isRenaming, newName: trimmedName, currentDirectory });
      try {
        let fileToRename = folderItems.find((f) => f.name === isRenaming);
        if (!fileToRename) {
          const fallbackPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, isRenaming);
          fileToRename = { name: isRenaming, path: fallbackPath, type: 'file' };
        }

        const oldPath = fileToRename.path;
        const newPath = isAbsolutePath(trimmedName)
          ? trimmedName
          : joinPath(currentDirectory === '/' ? '' : currentDirectory, trimmedName);

        const isCaseOnlyRename =
          fileToRename.name.toLowerCase() === trimmedName.toLowerCase() && fileToRename.name !== trimmedName;

        if (!isCaseOnlyRename) {
          const normalizedOldPath = oldPath.replace(/\\/g, '/').toLowerCase();
          const existingFile = folderItems.find((f) => {
            const normalizedPath = f.path.replace(/\\/g, '/').toLowerCase();
            return normalizedPath !== normalizedOldPath && f.name.toLowerCase() === trimmedName.toLowerCase();
          });

          if (existingFile) {
            showToast({
              title: 'Rename Failed',
              description: `A file named "${trimmedName}" already exists.`,
              status: 'error',
              duration: 5000,
              isClosable: true,
              position: 'top',
            });
            return false;
          }
        }

        await (window.electronAPI as any).renameItem(oldPath, newPath);
        console.log('[Rename] Success:', { oldPath, newPath });
        addLog(`Renamed ${isRenaming} to ${trimmedName}`);

        setIsRenaming(null);
        setRenameValue('');
        await refreshDirectory(currentDirectory);
        {
          const undoDir = currentDirectory;
          pushUndoableOperation({
            description: `Renamed "${isRenaming}" to "${trimmedName}"`,
            undo: async () => {
              await (window.electronAPI as any).renameItem(newPath, oldPath);
              await refreshDirectory(undoDir);
            },
          });
        }
        return true;
      } catch (error) {
        const errorMessage = getErrorMessageFromUnknown(error);
        console.log('[Rename] Failed:', { oldName: isRenaming, newName: trimmedName, error: errorMessage });
        addLog(`Failed to rename: ${errorMessage}`, 'error');
        const statusMsg = isRenameResourceBusyError(error)
          ? `Cannot rename "${isRenaming}": file is open or in use`
          : `Failed to rename "${isRenaming}": ${errorMessage}`;
        setStatus(statusMsg, 'error');
        const { title, description } = renameFailedToastContent(error, isRenaming);
        showFileOperationFailure({
          title,
          description,
          operationLabel: 'Rename',
          retry: async () => (await handleRenameSubmitRef.current?.()) ?? false,
          onCancel: () => {
            setIsRenaming(null);
            setRenameValue('');
          },
        });
        return false;
      }
    },
    [isRenaming, renameValue, currentDirectory, folderItems, addLog, setStatus, refreshDirectory, showFileOperationFailure]
  );

  useEffect(() => {
    handleRenameSubmitRef.current = handleRenameSubmit;
  }, [handleRenameSubmit]);

  const handleRenameCancel = useCallback(() => {
    setIsRenaming(null);
    setRenameValue('');
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu.isOpen) {
        handleCloseContextMenu()
      }
      
      // Clear multi-selection when clicking outside any file
      if (selectedFiles.length > 1) {
        const target = e.target as HTMLElement;
        // Check if the click was outside the file grid
        const fileGridElement = dropAreaRef.current;
        if (fileGridElement && !fileGridElement.contains(target)) {
          // Clear all selections
          setSelectedFiles([]);
          setSelectedFile(null);
        }
      }
    }
    const handleFolderContentsChanged = (_event: any, data: { directory: string; newFiles?: string[]; event?: string; filePath?: string }) => {
      if (data && data.directory === currentDirectory) {
        
        // Handle file watcher events and transfer events (new files detected)
        if (data.newFiles && data.newFiles.length > 0) {
          addRecentlyTransferredFiles(data.newFiles);
          
          // Log file operations for task timer - one entry per file
          const dirName = currentDirectory.split('\\').pop() || currentDirectory;
          data.newFiles.forEach(filePath => {
            const fileName = filePath.split('\\').pop() || filePath;
            logFileOperation(`${fileName} transferred to ${dirName}`);
          });
        } else if (data.event === 'add' && data.filePath) {
          addRecentlyTransferredFiles([data.filePath]);
          const fileName = data.filePath.split('\\').pop() || data.filePath;
          const dirName = currentDirectory.split('\\').pop() || currentDirectory;
          logFileOperation(`${fileName} transferred to ${dirName}`);
        }
        
        // Force a re-render to show the "NEW" indicator (reduced timeout)
        setTimeout(() => {
          refreshDirectory(currentDirectory);
        }, 50);
      }
    }

    // Listen for IPC events through the properly exposed API
    if ((window.electronAPI as any).onFolderContentsChanged) {
      (window.electronAPI as any).onFolderContentsChanged(handleFolderContentsChanged);
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => {
      // Clean up IPC listeners
      if ((window.electronAPI as any).removeAllListeners) {
        (window.electronAPI as any).removeAllListeners('folderContentsChanged');
      }
      
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.isOpen, currentDirectory])

  const loadDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath || dirPath.trim() === '') return;
    
    // Prevent concurrent loads
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    setIsLoading(true);
    
    try {
      // Normalize the path before loading
      const normalizedPath = normalizePath(dirPath);
      if (!normalizedPath) {
        addLog(`Invalid path: ${dirPath}`, 'error');
        setStatus('Invalid directory path', 'error');
        return;
      }
      
      // Validate path exists and is accessible
      const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
      if (!isValid) {
        addLog(`Invalid or inaccessible path: ${normalizedPath}`, 'error');
        setStatus(`Cannot access: ${formatPathForLog(normalizedPath)}`, 'error');
        return;
      }
      
      const contents = await (window.electronAPI as any).getDirectoryContents(normalizedPath);
      // Accept both array and { files: [] } shapes
      const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : null);
      if (files) {
        const filtered = filterFiles(files)
        setFolderItems(filtered as any);
        addLog(`Loaded directory: ${formatPathForLog(normalizedPath)}`);
        setStatus(`Loaded ${filtered.length} items`, 'info');
      } else {
        addLog(`Warning: Directory refresh returned invalid data`, 'info');
        setStatus('Invalid directory data received', 'error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to load directory: ${errorMessage}`, 'error');
      setStatus(`Failed to load directory: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [setFolderItems, addLog, filterFiles, setStatus]);

  // Add this function for selection on mouse down - OPTIMIZED with useCallback
  const handleFileItemMouseDown = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    const sortedFiles = sortedFilesRef.current;
    const selectedFiles = selectedFilesRef.current;
    const selectedFilesSet = selectedFilesSetRef.current;
    const lastSelectedIndex = lastSelectedIndexRef.current;
    const isGroupedByIndex = isGroupedByIndexRef.current;
    const groupedFiles = groupedFilesRef.current;

    if (!event) {
      // Fallback for no event - simple selection
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
      return;
    }

    // Ignore right-click (button 2) - selection is handled by handleContextMenu
    if (event.button !== 0) return;

    // Reset drag state
    setIsDragStarted(false);
    setPendingSelectionChange(null);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+click: Select range from last selected to current
      // In grouped mode, use the visual display order so the range stays within
      // the displayed sequence (files from the same group may have non-consecutive
      // indices in sortedFiles when sorted by date/size/type).
      if (isGroupedByIndex && groupedFiles) {
        const visualOrder: FileItem[] = [];
        if (groupedFiles.folders) visualOrder.push(...groupedFiles.folders);
        Object.entries(groupedFiles)
          .filter(([key]) => key !== 'folders')
          .sort(([a], [b]) => {
            if (a === 'AA') return -1;
            if (b === 'AA') return 1;
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
          })
          .forEach(([, files]) => visualOrder.push(...files));

        const anchorFile = sortedFiles[lastSelectedIndex];
        const anchorVisualIndex = anchorFile ? visualOrder.findIndex(f => f.path === anchorFile.path) : -1;
        const currentVisualIndex = visualOrder.findIndex(f => f.path === file.path);

        if (anchorVisualIndex >= 0 && currentVisualIndex >= 0) {
          const start = Math.min(anchorVisualIndex, currentVisualIndex);
          const end = Math.max(anchorVisualIndex, currentVisualIndex);
          const rangeSelection = visualOrder.slice(start, end + 1).map(f => f.name);
          setSelectedFiles(rangeSelection);
          setSelectedFile(file.name);
        } else {
          // Fallback: flat sort order
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          setSelectedFiles(sortedFiles.slice(start, end + 1).map(f => f.name));
          setSelectedFile(file.name);
        }
      } else {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const rangeSelection = sortedFiles.slice(start, end + 1).map(f => f.name);
        setSelectedFiles(rangeSelection);
        setSelectedFile(file.name);
      }
      // Don't update lastSelectedIndex for shift-click to maintain range anchor
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: Toggle selection - use functional updates
      setSelectedFiles(prev => {
        const hasFile = prev.includes(file.name);
        if (hasFile) {
          const newSelection = prev.filter(name => name !== file.name);
          setSelectedFile(newSelection.length > 0 ? newSelection[newSelection.length - 1] : null);
          if (newSelection.length === 0) {
            setLastSelectedIndex(null);
          }
          return newSelection;
        } else {
          const newSelection = [...prev, file.name];
          setSelectedFile(file.name);
          setLastSelectedIndex(index);
          return newSelection;
        }
      });
    } else if (selectedFilesSet.has(file.name) && selectedFiles.length > 1) {
      // Smart behavior: File is already selected in a multi-selection
      // Don't change selection yet - wait to see if this is a drag or a click
      setSelectedFile(file.name);
      setLastSelectedIndex(index);
      setPendingSelectionChange({ fileName: file.name, index });
    } else {
      // Regular click: Select only this file (clear others)
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
    }
  }, []);

  // Add this function for handling mouse up - completes smart selection logic - OPTIMIZED with useCallback
  const handleFileItemMouseUp = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    // Ignore right-click (button 2) - prevents clearing multi-selection when releasing right button after context menu
    if (event && event.button !== 0) return;

    const pendingSelectionChange = pendingSelectionChangeRef.current;
    const isDragStarted = isDragStartedRef.current;

    // If we have a pending selection change and no drag started, complete the selection
    if (pendingSelectionChange && !isDragStarted && pendingSelectionChange.fileName === file.name) {
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
    }
    // Clear pending state
    setPendingSelectionChange(null);
  }, []);

  // Add this function for handling drag start - prevents selection change on drag - OPTIMIZED with useCallback
  const handleFileItemDragStart = useCallback((file: FileItem, index: number, event?: React.DragEvent) => {
    if (!event) return;

    const selectedFiles = selectedFilesRef.current;
    const selectedFilesSet = selectedFilesSetRef.current;
    const fileNameToPathMap = fileNameToPathMapRef.current;
    
    setIsDragStarted(true);
    setPendingSelectionChange(null);
    
    // Clear any existing folder hover states from previous drag operations
    clearFolderHoverStates();
    
    // Use Electron's native file drag and drop exactly as documented
    event.preventDefault();
    const filesToDrag: string[] = Array.isArray(selectedFiles) && selectedFiles.length > 0 && fileNameToPathMap.size > 0
      ? selectedFiles.map(name => fileNameToPathMap.get(name)).filter((path): path is string => path !== null && path !== undefined)
      : [file.path];
    
    // Mark this as an internal drag globally and attach JSON payload
    // Clear any stale marker first, then set fresh one with timestamp
    try { (window as any).__docuframeInternalDrag = { files: filesToDrag, timestamp: Date.now() }; } catch {}
    // Set both custom type and text/plain as fallback (for Electron native drag compatibility)
    event.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(filesToDrag));
    event.dataTransfer.setData('text/plain', JSON.stringify(filesToDrag)); // Fallback for Electron native drag
    event.dataTransfer.effectAllowed = 'copyMove';
    
    if (window.electron && typeof window.electron.startDrag === 'function') {
      // Pass all files for multi-file drag - startDrag accepts string | string[]
      window.electron.startDrag(filesToDrag as any);
      addLog(`Started native drag for ${filesToDrag.length} file(s)`);
    } else {
      addLog('Native drag not available', 'error');
    }
    
    // Immediately hide the dragged files for snappy UX
    const filesToHide = selectedFiles.length > 0 && selectedFilesSet.has(file.name)
      ? selectedFiles
      : [file.name];
    
    setDraggedFiles(new Set(filesToHide));
  }, [addLog]);

  // Add this function for selection on click - OPTIMIZED with useCallback
  const handleFileItemClick = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    const now = Date.now();
    const selectedFiles = selectedFilesRef.current;
    const selectedFilesSet = selectedFilesSetRef.current;
    const sortedFiles = sortedFilesRef.current;
    const clickTimer = clickTimerRef.current;
    
    // Check if this is a double-click (same file clicked within 500ms) using refs for reliable comparison
    if (lastClickedFileRef.current === file.name && now - lastClickTimeRef.current < 500) {
      clearTimeout(clickTimer as NodeJS.Timeout);
      lastClickTimeRef.current = 0;
      lastClickedFileRef.current = null;
      setLastClickTime(0);
      setClickTimer(null);
      setLastClickedFile(null);
      
      // Don't navigate/open if rename mode is active for this file (or any file)
      if (isRenamingRef.current || isInlineCreatingFolderRef.current) {
        return;
      }

      // Handle double-click: open file or navigate to folder
      (async () => {
        if (file.type === 'folder') {
          handleOpenOrNavigate(file);
        } else {
          // If multiple files selected, open all selected files (including the one being double-clicked)
          // Check selectedFiles array directly to get accurate count
          if (selectedFiles.length > 1) {
          const selectedFileObjs = sortedFiles.filter(f => selectedFilesSet.has(f.name));
            // Only open multiple files if they're all files (not folders)
            const selectedFilesOnly = selectedFileObjs.filter(f => f.type !== 'folder');
            if (selectedFilesOnly.length > 1) {
              for (const f of selectedFilesOnly) {
                await handleOpenOrNavigate(f);
              }
          } else {
              // Fallback: open the double-clicked file
              await handleOpenOrNavigate(file);
            }
          } else {
            await handleOpenOrNavigate(file);
          }
        }
      })();
    } else {
      // First click - record for potential double-click
      lastClickTimeRef.current = now;
      lastClickedFileRef.current = file.name;
      setLastClickTime(now);
      setLastClickedFile(file.name);
      if (clickTimer) clearTimeout(clickTimer);

      // UX: When multiple files are selected and user clicks (no ctrl/shift) on a file within that selection,
      // deselect the group and select only the clicked file
      if (event && selectedFiles.length > 1 && selectedFilesSet.has(file.name) && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        setSelectedFiles([file.name]);
        setLastSelectedIndex(index);
        setSelectedFile(file.name);
      }
    }
  }, [handleOpenOrNavigate, setLastClickTime, setClickTimer, setLastClickedFile, setSelectedFiles, setLastSelectedIndex, setSelectedFile]);

  // Add F2 key support for rename
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return;

      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const isInModal = target.closest?.('[role="dialog"]') != null;

      if (isInputFocused || isInModal) {
        console.log('[Rename] F2 pressed but rename NOT triggered:', { reason: isInputFocused ? 'input_focused' : 'in_modal', target: target.tagName, selectedFile, isRenaming });
        return;
      }

      if (isInlineCreatingFolderRef.current) {
        return;
      }

      if (selectedFile && !isRenaming) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[Rename] F2 rename triggered:', { selectedFile, currentDirectory });
        setIsRenaming(selectedFile);
        setRenameValue(selectedFile);
      } else {
        console.log('[Rename] F2 pressed but rename NOT triggered:', { reason: !selectedFile ? 'no_selection' : 'already_renaming', selectedFile, isRenaming, currentDirectory });
      }
    }
    window.addEventListener('keydown', handleKeyDown, true); // capture phase so we get it before other handlers
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedFile, isRenaming, currentDirectory])

  // Keyboard shortcuts: Enter to open, Delete to delete, Escape to cancel drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any input field is focused
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isRenaming || isInlineCreatingFolderRef.current || isInputFocused) return;

      if (e.key === 'Enter' && selectedFiles.length > 0) {
        const selectedFileObjs = sortedFiles.filter(f => selectedFilesSet.has(f.name))
        if (selectedFileObjs.length === 1) {
          handleOpenOrNavigate(selectedFileObjs[0])
        } else if (selectedFileObjs.length > 1 && selectedFileObjs.every(f => f.type !== 'folder')) {
          for (const f of selectedFileObjs) handleOpenOrNavigate(f)
        }
      } else if (e.key === 'Enter' && selectedFiles.length === 0) {
        // Prevent Enter from doing anything when no files are selected
        // This prevents unwanted behavior after navigation
        e.preventDefault();
        return;
      } else if (e.key === 'Delete' && selectedFiles.length > 0) {
        const selectedFileObjs = sortedFiles.filter(f => selectedFilesSet.has(f.name))
        handleDeleteFile(selectedFileObjs)
      } else if (e.key === 'Escape') {
        // Cancel any ongoing drag operations
        resetDragState();
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFiles, sortedFiles, isRenaming, resetDragState])

  // Listen for global escape events to reset drag state
  useEffect(() => {
    const handleGlobalEscape = () => {
      resetDragState();
    };

    window.addEventListener('escape-key-pressed', handleGlobalEscape);
    return () => {
      window.removeEventListener('escape-key-pressed', handleGlobalEscape);
    };
  }, [resetDragState]);

  // Lightweight file system watcher - only watches when user is idle
  useEffect(() => {
    let isWatching = false;
    let watchTimeout: NodeJS.Timeout | undefined;
    let idleTimeout: NodeJS.Timeout | undefined;

    const startWatching = async () => {
      try {
        if (currentDirectory && !isWatching) {
          // Check if file watching is enabled in settings
          const config = await (window.electronAPI as any).getConfig();
          if (config.enableFileWatching === false) {
            return;
          }

          const result = await (window.electronAPI as any).startWatchingDirectory(currentDirectory);
          if (result.success) {
            isWatching = true;
          }
        }
      } catch (error) {
        // Error starting file watcher - silently fail
      }
    };

    const stopWatching = async () => {
      try {
        if (currentDirectory && isWatching) {
          await (window.electronAPI as any).stopWatchingDirectory(currentDirectory);
          isWatching = false;
        }
      } catch (error) {
        // Error stopping file watcher - silently fail
      }
    };

    // Stop watching immediately when directory changes (user is navigating)
    stopWatching();
    if (idleTimeout) clearTimeout(idleTimeout);

    // Only start watching if user has been idle for 3 seconds
    idleTimeout = setTimeout(() => {
      startWatching();
    }, 3000); // 3 second idle delay

    // Cleanup when component unmounts or directory changes
    return () => {
      if (watchTimeout) clearTimeout(watchTimeout);
      if (idleTimeout) clearTimeout(idleTimeout);
      stopWatching();
    };
  }, [currentDirectory]);

  useEffect(() => {
    // Register selectAllFiles callback
    const selectAllCallback = () => {
      const allFileNames = sortedFiles.map(f => f.name);
      setSelectedFiles(allFileNames);
      setStatus(`Selected all files in ${currentDirectory.split(/[\\/]/).pop() || currentDirectory}`, 'info');
      addLog(`Selected all files in ${currentDirectory}`);
    };
    
    setSelectAllFiles(() => selectAllCallback);
    return () => setSelectAllFiles(() => () => {});
  }, [sortedFiles, currentDirectory, setSelectAllFiles, setStatus, addLog, setSelectedFiles]);



  // Jump mode matching removed - now handled by overlay

  // Jump mode handler removed - now handled by overlay

   // Jump mode backspace handler removed - now handled by overlay

     // Global keyboard handler for jump mode overlay - moved to main app level

  // Drag and drop handlers for the main container - OPTIMIZED with useCallback
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any pending drag leave timeout
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    setDragCounter(prev => prev + 1);
    
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    
    const isInternalDrag = hasCustomType || internalDragFlag;
    
    if (hasFilesType && !isInternalDrag) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing timeout
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
    }
    
    setDragCounter(prev => prev - 1);
    
    // Use a timeout to debounce drag leave events
    // This prevents the overlay from flickering when moving between child elements
    dragLeaveTimeoutRef.current = setTimeout(() => {
      // Double-check if we're actually still dragging by checking if counter is 0
      setDragCounter(current => {
        if (current <= 0) {
          setIsDragOver(false);
          // Clear all folder hover states when leaving the entire file grid area
          clearFolderHoverStates();
          return 0;
        }
        return current;
      });
    }, 50); // Small delay to debounce rapid enter/leave events
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const targetElement = e.target as HTMLElement;
    const inGroupDropZone = !!(targetElement && targetElement.closest('[data-group-drop-zone="true"]'));
    if (inGroupDropZone) {
      // Target may be the <td> (padding): inner Box never sees dragOver — set a valid dropEffect here.
      const hasFilesType = e.dataTransfer.types.includes('Files');
      const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
      const internalDragFlag = !!(window as any).__docuframeInternalDrag;
      const isInternal = hasCustomType || internalDragFlag;
      if (isInternal) {
        const effectAllowed = e.dataTransfer.effectAllowed as string;
        let prefer: 'copy' | 'move' = 'move';
        if (effectAllowed === 'copy' || effectAllowed === 'copyMove' || effectAllowed === 'all' || (e.ctrlKey && effectAllowed !== 'move' && effectAllowed !== 'linkMove')) {
          prefer = 'copy';
        } else if (effectAllowed === 'move' || effectAllowed === 'linkMove' || (!e.ctrlKey && effectAllowed !== 'copy' && effectAllowed !== 'copyMove' && effectAllowed !== 'all')) {
          prefer = 'move';
        } else {
          prefer = e.ctrlKey ? 'copy' : 'move';
        }
        setDropEffectCompatibleWithEffectAllowed(e, prefer);
      } else if (hasFilesType) {
        setDropEffectCompatibleWithEffectAllowed(e, 'copy');
      }
      return;
    }
    
    // Clear any pending drag leave timeout to keep the overlay visible
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    
    const isInternalDrag = hasCustomType || internalDragFlag;
    
    if (hasFilesType && !isInternalDrag && !isDragOver) {
      setIsDragOver(true);
    }
    
    if (isInternalDrag) {
      e.dataTransfer.dropEffect = 'none';
    } else if (hasFilesType) {
      setDropEffectCompatibleWithEffectAllowed(e, 'copy');
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  }, [isDragOver]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any pending drag leave timeout
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    setIsDragOver(false);
    setDragCounter(0);

    const targetElement = e.target as HTMLElement;
    if (targetElement && targetElement.closest('[data-group-drop-zone="true"]')) {
      return;
    }

    // Check what type of drag this is
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFiles = (window as any).__docuframeInternalDrag?.files as string[] | undefined;
    
    // Detect internal drags that arrive as OS drops (Electron native startDrag)
    const droppedPathsFromOs = hasFilesType && e.dataTransfer.files.length > 0
      ? Array.from(e.dataTransfer.files).map((f: File) => (f as any).path).filter(Boolean)
      : [];
    const isInternalViaOsDrop = internalDragFiles && droppedPathsFromOs.length > 0
      && droppedPathsFromOs.length === internalDragFiles.length
      && droppedPathsFromOs.every((p: string) => internalDragFiles.some((ip: string) =>
        ip.replace(/\\/g, '/').toLowerCase() === p.replace(/\\/g, '/').toLowerCase()
      ));

    const isInternalDrag = hasCustomType || !!internalDragFiles?.length || isInternalViaOsDrop;

    // Internal drags onto the background area are no-ops (they're handled by folder drop handlers)
    if (isInternalDrag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
      return;
    }
    
    // Handle external files (from OS file explorer)
    if (hasFilesType && e.dataTransfer.files.length > 0) {
      try {
        const files = Array.from(e.dataTransfer.files).map((f) => {
          const filePath = (f as any).path || f.name;
          return { path: filePath, name: f.name };
        });
        
        const validFiles = files.filter(f => f.path && f.path !== f.name);
        if (validFiles.length === 0) {
          addLog('Failed to upload: No valid file paths found. Please drag files from your file explorer, not from a web browser.', 'error');
          setStatus('Upload failed: Invalid file source', 'error');
          return;
        }
        
        addLog(`Uploading ${validFiles.length} file(s) to current directory`);
        setStatus('Uploading files...', 'info');
        
        const results = await window.electronAPI.copyFiles(validFiles.map(f => f.path), currentDirectory);
        
        const successful = results.filter((r: any) => r.status === 'success').length;
        const failed = results.filter((r: any) => r.status === 'error').length;
        const skipped = results.filter((r: any) => r.status === 'skipped').length;
        
        let message = `Upload complete: ${successful} successful`;
        if (failed > 0) message += `, ${failed} failed`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        
        addLog(message);
        setStatus(message, failed > 0 ? 'error' : 'success');
        
        if (successful > 0 || skipped > 0) {
          await refreshDirectory(currentDirectory);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Upload failed: ${errorMessage}`, 'error');
        setStatus('Upload failed', 'error');
      }
    }
  }, [currentDirectory, addLog, setStatus, refreshDirectory]);

  // Keyboard shortcuts for cut/copy/paste - OPTIMIZED with useCallback
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      const isInputFocused = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
      
      // Check if user has selected text anywhere on the page
      const selection = window.getSelection();
      const hasTextSelection = selection && selection.toString().length > 0;
      
      // Don't interfere with copy/paste if user is in input fields, renaming, or has text selected
      if (isRenaming || isInlineCreatingFolderRef.current || isInputFocused || hasTextSelection) return;
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        // Select all files
        e.preventDefault();
        const allFileNames = sortedFiles.map(f => f.name);
        setSelectedFiles(allFileNames);
        setStatus(`Selected all files in ${currentDirectory.split(/[\\/]/).pop() || currentDirectory}`, 'info');
        addLog(`Selected all files in ${currentDirectory}`);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedFiles.length > 0) {
        // Cut files
        e.preventDefault();
        setClipboard({ files: sortedFiles.filter(f => selectedFilesSet.has(f.name)), operation: 'cut' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedFiles.length > 0) {
        // Copy files
        e.preventDefault();
        setClipboard({ files: sortedFiles.filter(f => selectedFilesSet.has(f.name)), operation: 'copy' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Paste files or images
        e.preventDefault();
        handlePaste();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      // Undo last file operation (rename/move/duplicate/prefix)
      e.preventDefault();
      void undoLastOperation();
    }
    // Ctrl+F is handled by GridSearchBox in FunctionPanels (capture phase)
  }, [selectedFiles, sortedFiles, clipboard, isRenaming, currentDirectory, setSelectedFiles, setStatus, addLog, setClipboard]);

  // Arrow navigation helper functions and variables
  const scrollItemToTopWithHeaderOffset = useCallback((targetEl: Element) => {
      // Always use the main scroll container
      const container = dropAreaRef.current as HTMLElement | null;

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = (targetEl as HTMLElement).getBoundingClientRect();

        // Compute element's top relative to the container's scroll origin
        const elementTopInContainer = elementRect.top - containerRect.top + container.scrollTop;

        // Dynamically measure sticky header height for list view
        const headerCell = container.querySelector('[data-column]') as HTMLElement | null;
        const headerHeight = headerCell ? headerCell.getBoundingClientRect().height : 30;
        // Try to detect a typical row height in list view
        const anyRow = container.querySelector('[data-row-index]') as HTMLElement | null;
        const rowHeight = anyRow ? anyRow.getBoundingClientRect().height : 30;
        // Offset by header height + one full row so the selected item appears fully below the header
        const headerOffset = headerHeight + rowHeight + 2; // +2 buffer

        const containerHeight = container.clientHeight;
        const maxScrollTop = container.scrollHeight - containerHeight;
        let targetScrollTop = elementTopInContainer - headerOffset;
        if (targetScrollTop < 0) targetScrollTop = 0;
        if (targetScrollTop > maxScrollTop) targetScrollTop = maxScrollTop;

        if (Math.abs(container.scrollTop - targetScrollTop) > 2) {
          container.scrollTo({ top: targetScrollTop, behavior: 'instant' as any });
        }
      } else {
        // Fallback
        (targetEl as HTMLElement).scrollIntoView({
          behavior: 'instant' as any,
          block: 'start',
          inline: 'nearest'
        });
      }
  }, []);

  // Arrow navigation variables and helper function
  let lastArrowTime = 0;
  const arrowThrottle = 100; // 0.1 seconds throttle
  let pendingSelection: number | null = null;

  // Helper function to select file and ensure it's visible - OPTIMIZED with useCallback
  const selectFileAtIndex = useCallback((index: number) => {
    if (index >= 0 && index < sortedFiles.length) {
      const file = sortedFiles[index];
      setSelectedFiles([file.name]);
      setSelectedFile(file.name);
      setLastSelectedIndex(index);
      
      // Ensure the element is visible after selection with precise positioning
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-file-index="${index}"]`);
        if (element) {
          scrollItemToTopWithHeaderOffset(element);
        }
      });
    }
  }, [sortedFiles, setSelectedFiles, setSelectedFile, setLastSelectedIndex, scrollItemToTopWithHeaderOffset]);

  // Arrow key navigation handler - OPTIMIZED with useCallback
  const handleArrowNavigation = useCallback((e: KeyboardEvent) => {
      // Don't interfere if renaming or in input fields
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isRenaming || isInlineCreatingFolderRef.current || isInputFocused) return;
      if (!sortedFiles.length) return;

      // Only handle arrow keys
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      // Prevent default scrolling behavior
      e.preventDefault();
      e.stopPropagation();

      let currentIndex = lastSelectedIndex;
      if (selectedFiles.length === 0 || currentIndex === null || currentIndex < 0) {
        currentIndex = -1;
      }

      // Calculate the next index immediately for visual feedback
      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, sortedFiles.length - 1);
      } else if (e.key === 'ArrowUp') {
        nextIndex = currentIndex < 0 ? sortedFiles.length - 1 : Math.max(currentIndex - 1, 0);
      } else {
        return;
      }

      // Always provide immediate visual feedback with precise top positioning
      const element = document.querySelector(`[data-file-index="${nextIndex}"]`);
      if (element) {
        scrollItemToTopWithHeaderOffset(element);
      }

      // Throttle the actual selection change
      const now = Date.now();
      if (now - lastArrowTime >= arrowThrottle) {
        // Update selection immediately
        selectFileAtIndex(nextIndex);
        lastArrowTime = now;
        pendingSelection = null;
      } else {
        // Store pending selection for later
        pendingSelection = nextIndex;
        // Schedule the selection update
        setTimeout(() => {
          if (pendingSelection === nextIndex) {
            selectFileAtIndex(nextIndex);
            lastArrowTime = Date.now();
            pendingSelection = null;
          }
        }, arrowThrottle - (now - lastArrowTime));
      }
  }, [isRenaming, sortedFiles, lastSelectedIndex, selectFileAtIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Add arrow key navigation for file selection
  useEffect(() => {
    window.addEventListener('keydown', handleArrowNavigation);
    return () => window.removeEventListener('keydown', handleArrowNavigation);
  }, [handleArrowNavigation]);



  // Enhanced paste handler with conflict resolution
  const handlePaste = useCallback(async () => {
    // First, check if there are files in the clipboard (from copy/cut operations)
    // Files take precedence over images
    if (clipboard.files.length && clipboard.operation) {
      // Proceed with normal file paste
      const op = clipboard.operation;
      
      try {
        let results: Array<{ file: string; status: string; path?: string; error?: string; reason?: string }> = [];
        
        if (op === 'cut') {
          results = await window.electronAPI.moveFilesWithConflictResolution(clipboard.files.map(f => f.path), currentDirectory);
        } else if (op === 'copy') {
          results = await window.electronAPI.copyFilesWithConflictResolution(clipboard.files.map(f => f.path), currentDirectory);
        }
        
        // Process results
        const successful = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'error').length;
        const skipped = results.filter(r => r.status === 'skipped').length;
        
        // Clear clipboard only for cut operations or successful operations
        if (op === 'cut' || successful > 0) {
          setClipboard({ files: [], operation: null });
        }
        
        // Show status message
        let message = '';
        if (successful > 0) {
          message += `${op === 'cut' ? 'Moved' : 'Copied'} ${successful} item(s)`;
        }
        if (skipped > 0) {
          message += `${successful > 0 ? ', ' : ''}${skipped} skipped`;
        }
        if (failed > 0) {
          message += `${(successful > 0 || skipped > 0) ? ', ' : ''}${failed} failed`;
        }
        
        setStatus(message || `${op === 'cut' ? 'Move' : 'Copy'} completed`, successful > 0 ? 'success' : failed > 0 ? 'error' : 'info');
        
        // Explicitly refresh directory after paste operations to ensure UI updates
        if (successful > 0 || skipped > 0) {
          await refreshDirectory(currentDirectory);
        }
        
      } catch (err) {
        setStatus(`Failed to ${op === 'cut' ? 'move' : 'copy'} files: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
        addLog(`Paste operation failed: ${err}`, 'error');
      }
      return;
    }

    // If no files in clipboard, check for images
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
          // Found an image in clipboard, open the image paste dialog
          setImagePasteOpen(true);
          return;
        }
      }
    } catch (err) {
      // If clipboard read fails, do nothing
    }
    
    return;
  }, [clipboard.files, clipboard.operation, currentDirectory, setClipboard, setStatus, addLog, refreshDirectory]);

  // Memoized helper function to check if file is cut
  const isFileCut = useCallback((file: FileItem) => 
    clipboard.operation === 'cut' && clipboard.files.some(f => f.path === file.path),
    [clipboard.operation, clipboard.files]
  );

  // Memoized helper function to check if a file is being dragged

  // Memoize recently transferred files Set for O(1) lookup performance
  const recentlyTransferredFilesSet = useMemo(() => {
    if (recentlyTransferredFiles.length === 0) {
      return { set: new Set(), normalizedSet: new Set() };
    }
    const set = new Set(recentlyTransferredFiles);
    const normalizedSet = new Set(recentlyTransferredFiles.map(path => path.replace(/\\/g, '/')));
    return { set, normalizedSet };
  }, [recentlyTransferredFiles]);

  // Helper function to check if a file is newly transferred (optimized with Set)
  const isFileNew = useCallback((file: FileItem) => {
    if (recentlyTransferredFilesSet.set.has(file.path)) {
      return true;
    }
    // Check if the file path might be in a different format (normalize slashes)
    const normalizedPath = file.path.replace(/\\/g, '/');
    return recentlyTransferredFilesSet.normalizedSet.has(normalizedPath);
  }, [recentlyTransferredFilesSet]);

  // Helper function to check if a file is the first jump result - removed

  // Handler for dropping files on group headers to assign prefix
  const [folderHoverState, setFolderHoverState] = useState<Set<string>>(new Set());

  const clearFolderHoverStates = useCallback(() => {
    setFolderHoverState(new Set());
  }, []);

  // Electron native startDrag + preventDefault on dragstart skips React row onDragEnd, so draggedFiles
  // stayed set and thead kept pointer-events:none. Clear grid drag UI when any HTML5 drag ends.
  useEffect(() => {
    const onWindowDragEnd = () => {
      resetDragState();
      clearFolderHoverStates();
      // Clear the internal drag flag so cancelled/external-dropped internal drags don't
      // poison subsequent external drops from Windows Explorer.
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    };
    window.addEventListener('dragend', onWindowDragEnd);
    return () => window.removeEventListener('dragend', onWindowDragEnd);
  }, [resetDragState, clearFolderHoverStates]);

  const handleFolderDragEnter = useCallback((filePath: string) => {
    setFolderHoverState(new Set([filePath]));
  }, []);

  const handleFolderDragLeave = useCallback((filePath: string) => {
    setFolderHoverState(prev => {
      if (!prev.has(filePath)) return prev;
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  }, []);

  const handleGroupHeaderDrop = useCallback(async (e: React.DragEvent, targetIndexKey: string, copyModifierActive = false) => {
    e.preventDefault();
    e.stopPropagation();
    clearFolderHoverStates();
    
    // Copy: use modifier captured during drag-over; drop often fires with ctrlKey false after key release.
    const isCopyOperation = e.ctrlKey || copyModifierActive;
    console.log('[FileGrid] handleGroupHeaderDrop', { targetIndexKey, isCopyOperation, ctrlKey: e.ctrlKey, copyModifierActive });
    
    let filePaths: string[] = [];
    
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
    
    const isInternalDrag = hasCustomType || internalDragFlag;
    
    if (!isInternalDrag && hasExternalFiles) {
      // External files - get paths from FileList
      filePaths = Array.from(e.dataTransfer.files).map(file => {
        // For external files, we need to get the full path
        // In Electron, file.path should be available
        return (file as any).path || file.name;
      });
    } else if (isInternalDrag) {
      // Internal drag - get paths from dataTransfer or window flag
      
      // Try multiple ways to get the dragged file data
      // 1. Custom type (for web drag)
      let draggedFiles = e.dataTransfer.getData('application/x-docuframe-files');
      
      // 2. text/plain fallback (for Electron native drag)
      if (!draggedFiles) {
        draggedFiles = e.dataTransfer.getData('text/plain');
      }
      
      // 3. Window flag (for Electron native drag that doesn't preserve dataTransfer)
      if (!draggedFiles && (window as any).__docuframeInternalDrag?.files) {
        draggedFiles = JSON.stringify((window as any).__docuframeInternalDrag.files);
      }
      
      // 4. Legacy fallback
      if (!draggedFiles) {
        draggedFiles = e.dataTransfer.getData('application/x-file-list');
      }
      
      // 5. Electron native startDrag: OS provides files in dataTransfer.files when getData is empty
      if (!draggedFiles && hasExternalFiles && e.dataTransfer.files?.length) {
        filePaths = Array.from(e.dataTransfer.files)
          .map((f: File) => (f as any).path || f.name)
          .filter(Boolean);
      }
      
      if (filePaths.length === 0 && draggedFiles) {
        try {
          filePaths = JSON.parse(draggedFiles) as string[];
        } catch (error) {
          return;
        }
      }
      
      if (filePaths.length === 0) {
        return;
      }
    } else {
      return;
    }
    
    if (filePaths.length === 0) {
      return;
    }
    
    try {
      // For external files, we need to find them in the current directory
      // For internal files, we already have the paths
      const normalizedDragPaths = new Set(
        filePaths.map(path => path.replace(/\\/g, '/'))
      );
      
      let filesToRename: FileItem[];
      
      if (hasExternalFiles && !isInternalDrag) {
        // External files - match by filename in current directory
        const fileNames = filePaths.map(path => {
          const parts = path.split(/[\\/]/);
          return parts[parts.length - 1];
        });
        filesToRename = sortedFiles.filter(f => {
          if (f.type !== 'file') return false;
          return fileNames.includes(f.name);
        });
      } else {
        // Internal files - match by full path
        filesToRename = sortedFiles.filter(f => {
          if (f.type !== 'file') return false;
          const normalizedFilePath = f.path.replace(/\\/g, '/');
          return normalizedDragPaths.has(normalizedFilePath);
        });
      }
      
      if (filesToRename.length === 0) {
        return;
      }
      
      const action = isCopyOperation ? 'Copying' : 'Assigning prefix to';
      setStatus(`${action} ${filesToRename.length} file(s)...`, 'info');
      
      const results = await Promise.allSettled(
        filesToRename.map(async (file) => {
          // Check if file already has an index prefix
          const currentIndex = extractIndexPrefix(file.name);
          
          let newName: string;
          if (currentIndex) {
            // Replace existing index with target index
            newName = setIndexPrefix(file.name, targetIndexKey);
          } else {
            // Add prefix to unassigned filename
            newName = setIndexPrefix(file.name, targetIndexKey);
          }
          
          if (!isCopyOperation && newName === file.name) {
            return { file: file.name, success: true, skipped: true };
          }
          
          // Use the file's actual path instead of constructing it
          const sourcePath = normalizePath(file.path);
          const parentDir = normalizePath(file.path.slice(0, file.path.length - file.name.length).replace(/[\\/]+$/, ''));
          const baseDir = normalizePath(parentDir || currentDirectory);
          const destPath = normalizePath(joinPath(baseDir, newName));
          
          if (isCopyOperation) {
            // Copy operation - use silent copy to avoid dialogs
            console.log('[FileGrid] Copying file via drag:', { sourcePath, destPath, newName });
            
            // Check if destination already exists
            let targetExists = false;
            if (destPath !== sourcePath) {
              try {
                const stats = await (window.electronAPI as any).getFileStats(destPath);
                targetExists = stats && stats.isFile;
              } catch (err) {
                targetExists = false;
              }
            }
            
            let existingFileMoved = false;
            let existingFileTempPath: string | null = null;
            
            try {
              // If target exists, move it temporarily
              if (targetExists) {
                existingFileTempPath = joinPath(baseDir, `~temp_existing_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newName}`);
                try {
                  await (window.electronAPI as any).renameItem(destPath, existingFileTempPath);
                  existingFileMoved = true;
                } catch (moveError) {
                  existingFileMoved = false;
                }
              }
              
              // Copy to temp name first
              const tempFileName = `~temp_copy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.tmp`;
              const tempFilePath = normalizePath(joinPath(baseDir, tempFileName));
              
              const copyResult = await (window.electronAPI as any).copyFileSilent(sourcePath, tempFilePath);
              
              if (!copyResult || !copyResult.success) {
                throw new Error(copyResult?.error || 'Silent copy failed');
              }
              
              // Rename temp file to final destination
              await (window.electronAPI as any).renameItem(tempFilePath, destPath);
              
              // If we moved an existing file, restore it with a numbered suffix
              if (existingFileMoved && existingFileTempPath) {
                let restored = false;
                for (let i = 1; i <= 100 && !restored; i++) {
                  const conflictName = i === 1 
                    ? newName.replace(/(\.[^.]+)$/, ' (1)$1')
                    : newName.replace(/(\.[^.]+)$/, ` (${i})$1`);
                  const conflictPath = joinPath(baseDir, conflictName);
                  
                  let conflictExists = false;
                  try {
                    const stats = await (window.electronAPI as any).getFileStats(conflictPath);
                    conflictExists = stats && (stats.isFile || stats.isDirectory);
                  } catch (err) {
                    conflictExists = false;
                  }
                  
                  if (!conflictExists) {
                    await (window.electronAPI as any).renameItem(existingFileTempPath, conflictPath);
                    restored = true;
                  }
                }
                
                if (!restored) {
                  try {
                    await (window.electronAPI as any).renameItem(existingFileTempPath, destPath);
                  } catch (e) {
                    // Keep temp name if restore fails
                  }
                }
              }
              
              return { file: file.name, success: true };
            } catch (error) {
              // Restore existing file if copy failed
              if (existingFileMoved && existingFileTempPath) {
                try {
                  await (window.electronAPI as any).renameItem(existingFileTempPath, destPath);
                } catch (restoreError) {
                  // Ignore restore errors
                }
              }
              throw error;
            }
          } else {
            // Rename operation (existing behavior)
            await (window.electronAPI as any).renameItem(sourcePath, destPath);
            return { file: file.name, success: true };
          }
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success && !(r.value as any).skipped).length;
      const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as any).skipped).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (isCopyOperation) {
        addLog(`Copied ${successful} file(s) with prefix "${targetIndexKey}"`);
        setStatus(`Copied ${successful} file(s)`, 'success');
      } else {
        addLog(`Assigned prefix "${targetIndexKey}" to ${successful} file(s)`);
        setStatus(`Prefix assigned to ${successful} file(s)`, 'success');
      }
      
      if (failed > 0) {
        const failedResults = results.filter(r => r.status === 'rejected');
        const errorMessages = failedResults.map(r => {
          if (r.reason instanceof Error) {
            return r.reason.message;
          }
          return String(r.reason);
        }).join('; ');
        
        showToast({
          title: isCopyOperation ? 'Copy Failed' : 'Prefix Assignment Failed',
          description: `${failed} file(s) failed: ${errorMessages}`,
          status: 'error',
          duration: 8000,
          isClosable: true,
          position: 'top',
        });
      }
      
      await refreshDirectory(currentDirectory);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to assign prefix: ${errorMessage}`, 'error');
      setStatus('Failed to assign prefix', 'error');
      showToast({
        title: 'Prefix Assignment Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    } finally {
      try { (window as any).__docuframeInternalDrag = null; } catch {}
    }
  }, [sortedFiles, currentDirectory, addLog, setStatus, refreshDirectory]);


  const [isPropertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesFile, setPropertiesFile] = useState<FileProperties | null>(null);

  const handleUnblockFile = useCallback(async () => {
    if (!propertiesFile) return;
    await (window.electronAPI as any).unblockFile(propertiesFile.path);
    setPropertiesFile({ ...propertiesFile, isBlocked: false });
  }, [propertiesFile]);

  const handleImageSaved = useCallback(async (filename: string) => {
    // Refresh the directory to show the new image
    await refreshDirectory(currentDirectory);
    addLog(`Image saved: ${filename}`, 'response');
    setStatus(`Image saved: ${filename}`, 'success');
    
    // Show toast notification on the main app
    showToast({
      title: 'Image Saved',
      description: `Successfully saved ${filename}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top',
    });
  }, [refreshDirectory, currentDirectory, addLog, setStatus]);

  // Column management state - load from config (persisted) or localStorage fallback
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const columnWidthsLoadedRef = useRef(false);

  useEffect(() => {
    if (columnWidthsLoadedRef.current) return;
    (async () => {
      try {
        const config = await (window.electronAPI as any).getConfig();
        const saved = config?.fileGridColumnWidths;
        if (saved && typeof saved.name === 'number' && typeof saved.size === 'number') {
          // Merge over defaults so newly-added columns (age/period/version) get widths
          setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...saved });
        } else {
          const local = localStorage.getItem('fileGrid_columnWidths');
          if (local) {
            const parsed = JSON.parse(local);
            const widths = { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
            setColumnWidths(widths);
            await (window.electronAPI as any).setConfig({ ...config, fileGridColumnWidths: widths });
          }
        }
        columnWidthsLoadedRef.current = true;
      } catch (e) {
        console.error('Error loading column widths:', e);
        columnWidthsLoadedRef.current = true;
      }
    })();
  }, []);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fileGrid_columnOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that it's an array with valid column names
        if (Array.isArray(parsed) && parsed.every((col: string) => (ALL_COLUMN_IDS as readonly string[]).includes(col))) {
          // Append any columns introduced after the order was saved
          const missing = ALL_COLUMN_IDS.filter((col) => !parsed.includes(col));
          return [...parsed, ...missing];
        }
      }
    } catch (e) {
      console.error('Error loading column order:', e);
    }
    return [...ALL_COLUMN_IDS];
  });

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('fileGrid_columnVisibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Defaults fill in newly-added columns (age/period/version start hidden)
        return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return { ...DEFAULT_COLUMN_VISIBILITY };
  });
  const [headerContextMenu, setHeaderContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Period column only applies inside GST folders (Root\Client\GST with "01 - March 2025" period subfolders)
  const isGstFolder = useMemo(() => isGstDirectory(currentDirectory), [currentDirectory]);

  // Effective visibility: user preference, with Period force-hidden outside GST folders
  const effectiveColumnVisibility = useMemo(() => {
    if (isGstFolder || !columnVisibility.period) return columnVisibility;
    return { ...columnVisibility, period: false };
  }, [columnVisibility, isGstFolder]);

  // Filter columnOrder based on visibility
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => effectiveColumnVisibility[col]);
  }, [columnOrder, effectiveColumnVisibility]);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [originalColumnOrder, setOriginalColumnOrder] = useState<string[]>([]);
  const [dragTargetColumn, setDragTargetColumn] = useState<string | null>(null);
  // Drag ghost preview and indicator state
  const [dragMousePos, setDragMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragInitialPos, setDragInitialPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragThresholdMet, setIsDragThresholdMet] = useState(false);
  const [hasDraggedColumn, setHasDraggedColumn] = useState(false);
  const gridContainerRef = useRef<HTMLTableElement | null>(null);

  // Clear folder hover state when selection changes
  useEffect(() => {
    clearFolderHoverStates();
  }, [selectedFiles, clearFolderHoverStates]);

  // Column resize handlers - OPTIMIZED with useCallback
  // Note: These must be defined in order (handleResizeMove first, then handleResizeEnd, then handleResizeStart)
  // to avoid initialization errors
  
  // Throttled resize handler for better performance
  const resizeThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastResizeTimeRef = useRef<number>(0);
  const RESIZE_THROTTLE_MS = 16; // ~60fps
  const resizingColumnRef = useRef<string | null>(null);
  const dragStartXRef = useRef<number>(0);
  const justFinishedResizingRef = useRef(false);
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    const col = resizingColumnRef.current;
    if (!col) return;
    
    const now = Date.now();
    if (now - lastResizeTimeRef.current >= RESIZE_THROTTLE_MS) {
      const deltaX = e.clientX - dragStartXRef.current;
      setColumnWidths(prev => {
        const newWidth = Math.max(50, prev[col as keyof typeof prev] + deltaX);
        return { ...prev, [col]: newWidth };
      });
      dragStartXRef.current = e.clientX;
      lastResizeTimeRef.current = now;
    } else {
      if (resizeThrottleRef.current) clearTimeout(resizeThrottleRef.current);
      resizeThrottleRef.current = setTimeout(() => {
        const deltaX = e.clientX - dragStartXRef.current;
        setColumnWidths(prev => {
          const newWidth = Math.max(50, prev[col as keyof typeof prev] + deltaX);
          return { ...prev, [col]: newWidth };
        });
        dragStartXRef.current = e.clientX;
        lastResizeTimeRef.current = Date.now();
      }, RESIZE_THROTTLE_MS - (now - lastResizeTimeRef.current));
    }
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingColumnRef.current = null;
    setResizingColumn(null);
    justFinishedResizingRef.current = true;
    setTimeout(() => { justFinishedResizingRef.current = false; }, 150);
    if (resizeThrottleRef.current) {
      clearTimeout(resizeThrottleRef.current);
      resizeThrottleRef.current = null;
    }
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColumnRef.current = column;
    dragStartXRef.current = e.clientX;
    setResizingColumn(column);
    setDragStartX(e.clientX);
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  // Auto-fit column widths based on content - OPTIMIZED with useCallback
  const autoFitColumn = useCallback((column: string) => {
    // Get all file items to calculate optimal width
    const maxNameLength = Math.max(
      ...sortedFiles.map(file => file.name.length),
      4 // Minimum width for "Name" header
    );
    
    // Calculate optimal width based on content
    let optimalWidth = 0;
    if (column === 'name') {
      // For name column, use the longest filename + padding
      optimalWidth = Math.max(maxNameLength * 8 + 40, 120); // 8px per character + 40px padding, min 120px
    } else if (column === 'size') {
      // For size column, use fixed width for "Size" header + padding
      optimalWidth = 80; // Fixed width for size column
    } else if (column === 'modified') {
      // For modified column, use fixed width for "Modified" header + padding
      optimalWidth = 140; // Fixed width for modified column
    } else if (column === 'type') {
      // For type column, use fixed width
      optimalWidth = 80; // Fixed width for type column
    } else if (column === 'age' || column === 'period' || column === 'version') {
      optimalWidth = DEFAULT_COLUMN_WIDTHS[column];
    }

    // Apply the optimal width
    setColumnWidths(prev => ({
      ...prev,
      [column]: optimalWidth
    }));
    
    addLog(`Auto-fitted column: ${column} to ${optimalWidth}px`);
  }, [sortedFiles, addLog]);

  // Auto-fit all columns at once - OPTIMIZED with useCallback
  const autoFitAllColumns = useCallback(() => {
    ALL_COLUMN_IDS.forEach(col => autoFitColumn(col));
    addLog('Auto-fitted all columns');
  }, [autoFitColumn, addLog]);
  
  // Handle column visibility toggle
  const toggleColumnVisibility = useCallback((column: string) => {
    setColumnVisibility(prev => {
      const newVisibility = {
        ...prev,
        [column]: !prev[column as keyof typeof prev]
      };
      // Save to localStorage
      try {
        localStorage.setItem('fileGrid_columnVisibility', JSON.stringify(newVisibility));
      } catch (e) {
        console.error('Error saving column visibility:', e);
      }
      return newVisibility;
    });
  }, []);
  
  // Save column widths to config (persisted, consistent across directories) - debounced to avoid overwriting other settings during resize
  useEffect(() => {
    if (!columnWidthsLoadedRef.current) return;
    const timeoutId = setTimeout(async () => {
      try {
        const config = await (window.electronAPI as any).getConfig();
        await (window.electronAPI as any).setConfig({ ...config, fileGridColumnWidths: columnWidths });
        localStorage.setItem('fileGrid_columnWidths', JSON.stringify(columnWidths));
      } catch (e) {
        console.error('Error saving column widths:', e);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [columnWidths]);
  
  // Save column order to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('fileGrid_columnOrder', JSON.stringify(columnOrder));
    } catch (e) {
      console.error('Error saving column order:', e);
    }
  }, [columnOrder]);
  
  // Close header context menu
  const closeHeaderContextMenu = useCallback(() => {
    setHeaderContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
  }, []);
  
  // Header menu color values (must be at top level, not conditional) - match ContextMenu style
  const menuBg = useColorModeValue('white', 'gray.800');
  const menuBorderColor = useColorModeValue('gray.200', 'gray.700');
  const menuTextColor = useColorModeValue('gray.700', 'gray.200');
  const menuHoverBg = useColorModeValue('gray.100', 'gray.700');
  
  // Close header context menu when clicking outside
  useEffect(() => {
    if (!headerContextMenu.isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the menu
      if (target.closest('[data-column-menu]')) return;
      closeHeaderContextMenu();
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headerContextMenu.isOpen, closeHeaderContextMenu]);





  // Column reorder handlers - OPTIMIZED with useCallback
  const handleColumnDragStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get the header element's position
    const headerElement = e.currentTarget as HTMLElement;
    const headerRect = headerElement.getBoundingClientRect();
    
    // Calculate the offset from the click position to the header's top-left corner
    const clickOffset = {
      x: e.clientX - headerRect.left,
      y: e.clientY - headerRect.top
    };
    
    setDraggingColumn(column);
    setOriginalColumnOrder([...columnOrder]);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDragOffset(clickOffset);
    setIsDragThresholdMet(false);
    setHasDraggedColumn(false);
    
    // Store the header's initial position adjusted for where user clicked
    const initialPos = { 
      x: headerRect.left + clickOffset.x, 
      y: headerRect.top + clickOffset.y 
    };
    setDragInitialPos(initialPos);
    setDragMousePos(initialPos);
  }, [columnOrder]);

  const handleColumnDragMove = useCallback((e: MouseEvent) => {
    if (!draggingColumn || !dragInitialPos) return;
    
    // Calculate movement from initial click position
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    
    // Check if we've moved enough to start showing the drag preview
    const dragThreshold = 5; // pixels
    if (!isDragThresholdMet && (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold)) {
      setIsDragThresholdMet(true);
      setHasDraggedColumn(true); // Mark that a drag operation has occurred
    }
    
    // Update position relative to initial header position + delta (X-axis only)
    setDragMousePos({ 
      x: dragInitialPos.x + deltaX, 
      y: dragInitialPos.y // Keep Y position fixed
    });
    
    // Track the target column for position indicator only (no visual reordering)
    const target = e.target as HTMLElement;
    const headerCell = target.closest('[data-column]') as HTMLElement;
    
    if (headerCell) {
      const targetColumn = headerCell.getAttribute('data-column');
      if (targetColumn && targetColumn !== dragTargetColumn) {
        setDragTargetColumn(targetColumn);
      }
    } else {
      // Clear target when not over a valid header
      setDragTargetColumn(null);
    }
  }, [draggingColumn, dragInitialPos, dragStartX, dragStartY, isDragThresholdMet, dragTargetColumn]);

  const handleColumnDragEnd = useCallback(() => {
    if (draggingColumn && dragTargetColumn && draggingColumn !== dragTargetColumn) {
      // Now perform the reorder
      const newOrder = [...columnOrder];
      const dragIndex = newOrder.indexOf(draggingColumn);
      const targetIndex = newOrder.indexOf(dragTargetColumn);
      
      newOrder.splice(dragIndex, 1);
      newOrder.splice(targetIndex, 0, draggingColumn);
      
      setColumnOrder(newOrder);
    }
    
    // Mark that a drag attempt was made (even if it didn't result in reordering)
    // This prevents sorting when headers are dragged and released in the same place
    if (draggingColumn && isDragThresholdMet) {
      setHasDraggedColumn(true);
    }
    
    setDraggingColumn(null);
    setDragTargetColumn(null);
    setDragMousePos(null);
    setDragInitialPos(null);
    setIsDragThresholdMet(false);
    setDragStartX(0);
    setDragStartY(0);
    
    // Reset the drag flag after a short delay to allow click event to check it
    setTimeout(() => setHasDraggedColumn(false), 10);
  }, [draggingColumn, dragTargetColumn, columnOrder, isDragThresholdMet]);

  // Column drag event listeners
  useEffect(() => {
    if (draggingColumn) {
      const handleMouseMove = (e: MouseEvent) => handleColumnDragMove(e);
      const handleMouseUp = () => handleColumnDragEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingColumn, handleColumnDragMove, handleColumnDragEnd]);

  // Lazy icon loading with Intersection Observer
  const iconLoadingRef = useRef(false);
  const loadingQueue = useRef<Set<string>>(new Set());
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const observedElementsRef = useRef<Map<HTMLElement, string>>(new Map());
  const nativeIconsRef = useRef(nativeIcons);
  nativeIconsRef.current = nativeIcons;
  const pendingIconsRef = useRef<Map<string, string>>(new Map());
  const flushScheduledRef = useRef(false);
  
  // Batched flush: merge pending icons into state (reduces re-renders from N to 1 per batch)
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
  
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleFlushIcons = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    flushTimeoutRef.current = setTimeout(flushPendingIcons, 100);
  }, [flushPendingIcons]);
  
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
    };
  }, []);
  
  // Create intersection observer for lazy loading icons - recreate when content/root is ready
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon) return;

    const root = dropAreaRef.current;
    if (!root) return; // Root not ready yet - will retry when sortedFiles changes

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const filePath = entry.target.getAttribute('data-file-path');
            if (filePath && !nativeIconsRef.current.has(filePath) && !loadingQueue.current.has(filePath)) {
              loadIconForFileRef.current(filePath);
            }
          }
        });
      },
      {
        root,
        rootMargin: '200px', // Load icons before they come into view
        threshold: 0 // Fire on any intersection (handles layout timing)
      }
    );

    const prevObserver = intersectionObserverRef.current;
    if (prevObserver) {
      prevObserver.disconnect();
    }
    intersectionObserverRef.current = observer;

    // Re-observe all tracked elements (e.g. after scroll or when recreating observer)
    observedElementsRef.current.forEach((filePath, element) => {
      if (element.isConnected) {
        element.setAttribute('data-file-path', filePath);
        observer.observe(element);
      } else {
        observedElementsRef.current.delete(element);
      }
    });

    return () => {
      if (intersectionObserverRef.current === observer) {
        observer.disconnect();
        intersectionObserverRef.current = null;
      }
    };
  }, [sortedFiles]);

  // Scroll fallback: load icons for visible elements when user scrolls (catches any observer misses)
  const scrollLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const container = dropAreaRef.current;
    if (!container || !window.electronAPI?.getFileIcon) return;

    const checkVisibleAndLoad = () => {
      if (scrollLoadTimeoutRef.current) clearTimeout(scrollLoadTimeoutRef.current);
      scrollLoadTimeoutRef.current = setTimeout(() => {
        scrollLoadTimeoutRef.current = null;
        const rootRect = container.getBoundingClientRect();
        container.querySelectorAll('[data-file-path]').forEach((el) => {
          const filePath = el.getAttribute('data-file-path');
          if (!filePath || nativeIconsRef.current.has(filePath) || loadingQueue.current.has(filePath)) return;
          const rect = el.getBoundingClientRect();
          const visible = rect.top < rootRect.bottom + 200 && rect.bottom > rootRect.top - 200;
          if (visible) loadIconForFileRef.current(filePath);
        });
      }, 80);
    };

    container.addEventListener('scroll', checkVisibleAndLoad, { passive: true });
    checkVisibleAndLoad(); // Run once on mount for initially visible
    return () => {
      container.removeEventListener('scroll', checkVisibleAndLoad);
      if (scrollLoadTimeoutRef.current) clearTimeout(scrollLoadTimeoutRef.current);
    };
  }, [sortedFiles]);

  // Function to load icon for a specific file (batched updates to reduce re-renders)
  const loadIconForFile = useCallback(async (filePath: string) => {
    if (loadingQueue.current.has(filePath) || nativeIconsRef.current.has(filePath)) return;
    
    loadingQueue.current.add(filePath);
    
    try {
      const iconData = await window.electronAPI.getFileIcon(filePath);
      if (iconData) {
        if (nativeIconsRef.current.has(filePath)) return;
        pendingIconsRef.current.set(filePath, iconData);
        scheduleFlushIcons();
      }
    } catch (error) {
      // Don't retry failed icons immediately - they'll be retried on next view
    } finally {
      loadingQueue.current.delete(filePath);
    }
  }, [scheduleFlushIcons]);
  
  const loadIconForFileRef = useRef(loadIconForFile);
  loadIconForFileRef.current = loadIconForFile;

  // Observe file elements when they mount - track for re-observe, load immediately if visible
  const observeFileElement = useCallback((element: HTMLElement | null, filePath: string) => {
    if (!element) return;

    element.setAttribute('data-file-path', filePath);
    observedElementsRef.current.set(element, filePath);

    const observer = intersectionObserverRef.current;
    if (observer) {
      observer.observe(element);
      // Immediate load if already visible (handles timing when observer hasn't fired yet)
      if (!nativeIconsRef.current.has(filePath) && !loadingQueue.current.has(filePath)) {
        const root = dropAreaRef.current;
        if (root) {
          const elRect = element.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          const visible = elRect.top < rootRect.bottom && elRect.bottom > rootRect.top;
          if (visible) loadIconForFileRef.current(filePath);
        }
      }
    }
  }, []);

  const unobserveFileElement = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    observedElementsRef.current.delete(element);
    const observer = intersectionObserverRef.current;
    if (observer) observer.unobserve(element);
  }, []);
  
  // Load icons for initially visible files (first batch)
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon || iconLoadingRef.current) return;
    
    const loadInitialIcons = async () => {
      iconLoadingRef.current = true;
      
      try {
        // Load icons for the first visible files (approximately first screen)
        const initialFiles = sortedFiles
          .filter(file => file.type === 'file' && !nativeIconsRef.current.has(file.path))
          .slice(0, 25); // Load first 25 files to cover typical initial viewport
        
        if (initialFiles.length === 0) return;
        
        // Process in smaller batches to avoid blocking
        const batchSize = 5;
        for (let i = 0; i < initialFiles.length; i += batchSize) {
          const batch = initialFiles.slice(i, i + batchSize);
          
          // Process batch in parallel (icons batched via pendingIconsRef + flush)
          await Promise.allSettled(
            batch.map(file => loadIconForFile(file.path))
          );
          
          // Delay between batches increased to 100ms to reduce main-thread pressure
          if (i + batchSize < initialFiles.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } finally {
        iconLoadingRef.current = false;
      }
    };
    
    // Debounce to avoid excessive calls
    const timeoutId = setTimeout(loadInitialIcons, 100);
    return () => clearTimeout(timeoutId);
  }, [sortedFiles, loadIconForFile]);

  // Reapply filters when the file filtering settings change
  useEffect(() => {
    if (currentDirectory) {
      refreshDirectory(currentDirectory);
    }
  }, [hideTemporaryFiles, hideDotFiles, hideClaudeMd, currentDirectory, refreshDirectory]);

  // Load file grid background image settings
  useEffect(() => {
    const loadBackgroundSetting = async () => {
      try {
        const settings = await settingsService.getSettings();

        // Load enableBackgrounds setting (default to true)
        setEnableBackgrounds(settings.enableBackgrounds !== false);

        // Migration: if fileGridBackgroundPath exists but backgroundType is not set, default to corner mascot (watermark)
        const bgType = settings.backgroundType || (settings.fileGridBackgroundPath ? 'watermark' : 'watermark');
        setBackgroundType(bgType);

        // Load corner mascot (watermark) path
        const watermarkPath = settings.fileGridBackgroundPath || '';
        setFileGridBackgroundPath(watermarkPath);
        
        // Load background fill path
        let fillPath = settings.backgroundFillPath || '';
        
        // If backgroundFillPath is a relative path, resolve it
        if (fillPath && !isAbsolutePath(fillPath) && window.electronAPI && (window.electronAPI as any).resolveBackgroundPath) {
          try {
            const resolveResult = await (window.electronAPI as any).resolveBackgroundPath(fillPath);
            if (resolveResult.success && resolveResult.path) {
              fillPath = resolveResult.path;
            }
          } catch (error) {
            console.error('Error resolving background fill path:', error);
          }
        }
        setBackgroundFillPath(fillPath);
        
        // Helper function to load image URL
        const loadImageUrl = async (imagePath: string): Promise<string> => {
          if (!imagePath) return '';
          
          if (window.electronAPI?.readImageAsDataUrl) {
            try {
              const result = await window.electronAPI.readImageAsDataUrl(imagePath);
              if (result.success && result.dataUrl) {
                return result.dataUrl;
              }
            } catch (error) {
              console.error('Error reading image as data URL:', error);
            }
          }
          
          // Fallback: try HTTP URL first, then file:// protocol
          if (window.electronAPI?.convertFilePathToHttpUrl) {
            try {
              const httpResult = await window.electronAPI.convertFilePathToHttpUrl(imagePath);
              if (httpResult.success && httpResult.url) {
                return httpResult.url;
              }
            } catch (error) {
              // Fall through to file:// protocol
            }
          }
          
          return `file://${imagePath.replace(/\\/g, '/')}`;
        };
        
        // Load corner mascot (watermark) URL
        if (watermarkPath) {
          const watermarkUrl = await loadImageUrl(watermarkPath);
          setFileGridBackgroundUrl(watermarkUrl);
        } else {
          setFileGridBackgroundUrl('');
        }
        
        // Load background fill URL
        if (fillPath) {
          const fillUrl = await loadImageUrl(fillPath);
          setBackgroundFillUrl(fillUrl);
        } else {
          setBackgroundFillUrl('');
        }
      } catch (error) {
        console.error('Error loading file grid background setting:', error);
      }
    };
    loadBackgroundSetting();

    // Listen for settings updates
    const handleSettingsUpdate = (_event?: unknown) => {
      loadBackgroundSetting();
    };
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate);
    };
  }, []);

  // Clear icons when directory changes to prevent showing stale icons
  useEffect(() => {
    // Clear native icons when changing directories
    setNativeIcons(new Map());
    // Clear any pending loads
    loadingQueue.current.clear();
  }, [currentDirectory]);

  // Clear rename state when directory changes to avoid stale isRenaming blocking future F2 presses
  useEffect(() => {
    if (isRenaming) {
      console.log('[Rename] Directory changed while renaming, cancelling rename:', { wasRenaming: isRenaming, newDirectory: currentDirectory });
    }
    setIsRenaming(null);
    setRenameValue('');
    setIsInlineCreatingFolder(false);
    setNewFolderDraftName('');
    hasPositionedCursor.current = false;
  }, [currentDirectory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isInlineCreatingFolder) return;
    const id = requestAnimationFrame(() => {
      newFolderInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isInlineCreatingFolder]);

  // O(1) lookup for clipboard cut paths - avoids creating Set on every getFileState call
  const clipboardFilePathsSet = useMemo(() =>
    clipboard.operation === 'cut' ? new Set(clipboard.files.map(f => f.path)) : new Set(),
    [clipboard]
  );

  // Lazy per-row lookup: only called for visible rows (~30), not full list (1241). Selection change = O(visible) not O(n).
  const getFileStateForIndex = useCallback((file: FileItem, _index: number) => ({
    isFileSelected: selectedFilesSet.has(file.name),
    isFileCut: clipboardFilePathsSet.has(file.path),
    isFileNew: recentlyTransferredFilesSet.set.has(file.path) || recentlyTransferredFilesSet.normalizedSet.has(file.path.replace(/\\/g, '/')),
    isFileDragged: draggedFiles.has(file.name)
  }), [selectedFilesSet, clipboardFilePathsSet, recentlyTransferredFilesSet, draggedFiles]);

  // Stable row handlers object - same reference for all rows, handlers take (file, index, e) as args
  const rowHandlers = useMemo(() => ({
    onMouseEnter: (_index: number) => {},
    onMouseLeave: (_index: number, _e: React.MouseEvent) => {},
    onContextMenu: (file: FileItem, e: React.MouseEvent) => handleContextMenu(e, file),
    onClick: (file: FileItem, index: number, e?: React.MouseEvent) => handleFileItemClick(file, index, e),
    onMouseDown: (file: FileItem, index: number, e: React.MouseEvent) => handleFileItemMouseDown?.(file, index, e),
    onMouseUp: (file: FileItem, index: number, e: React.MouseEvent) => handleFileItemMouseUp?.(file, index, e),
    draggable: true as const,
    onDragStart: (file: FileItem, index: number, e: React.DragEvent) => {
      const selectedFiles = selectedFilesRef.current;
      const selectedFilesSet = selectedFilesSetRef.current;
      const fileNameToPathMap = fileNameToPathMapRef.current;
      const filesToDrag: string[] = selectedFiles.length > 0 && selectedFilesSet.has(file.name)
        ? selectedFiles.map(name => fileNameToPathMap.get(name)).filter((path): path is string => path !== null && path !== undefined)
        : [file.path];
      e.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(filesToDrag));
      e.dataTransfer.effectAllowed = 'copyMove';
      handleFileItemDragStart(file, index, e);
    },
    onDragEnd: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragStarted(false);
      setDraggedFiles(new Set());
      clearFolderHoverStates();
      addLog('Drag operation ended');
    },
    onQuickAction: (action: string, file: FileItem, _index: number) => {
      if (action === 'preview') {
        setSelectedFiles([file.name]);
        setSelectedFile(file.name);
        setIsPreviewPaneOpen(true);
      } else if (action === 'rename') {
        setIsRenaming(file.name);
        setRenameValue(file.name);
      } else if (action === 'prefix') {
        setPrefixDialogFiles([file]);
        setIsIndexPrefixDialogOpen(true);
      }
    }
  }), [handleContextMenu, handleFileItemClick, handleFileItemMouseDown, handleFileItemMouseUp, handleFileItemDragStart, setIsDragStarted, setDraggedFiles, clearFolderHoverStates, addLog, setSelectedFiles, setIsPreviewPaneOpen]);

  // Cache for folder drop handlers - stable refs enable FileTableRow memo on selection change
  const folderDropHandlersCacheRef = useRef<Map<string, Record<string, any>>>(new Map());

  // Optimized folder drop handlers factory
  const createFolderDropHandlers = useCallback((file: FileItem, index: number) => {
    if (file.type !== 'folder') return EMPTY_FOLDER_HANDLERS;

    const key = `${file.path}\x01${index}`;
    const cached = folderDropHandlersCacheRef.current.get(key);
    if (cached) return cached;

    const handlers = {
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleFolderDragEnter(file.path);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const hasExternalFiles = e.dataTransfer.types.includes('Files');
        const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
        
        if (isInternalDrag) {
          e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
        } else if (hasExternalFiles) {
          // Covers both Electron native drags and truly external drops.
          // Must use 'copy' because the OS effectAllowed may only permit 'copy';
          // the actual move happens in the onDrop handler.
          e.dataTransfer.dropEffect = 'copy';
        } else {
          e.dataTransfer.dropEffect = 'none';
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const relatedTarget = e.relatedTarget as Element;
        
        if (!relatedTarget || typeof (relatedTarget as any).closest !== 'function' || !relatedTarget.closest(`[data-row-index="${index}"]`)) {
          handleFolderDragLeave(file.path);
        }
      },
      onDrop: async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleFolderDragLeave(file.path);
        
        const hasExternalFiles = e.dataTransfer.types.includes('Files');
        const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
        // When using Electron's native startDrag, drop comes from OS with Files type only;
        // getData is empty. Match dropped paths to __docuframeInternalDrag to treat as internal move.
        const internalDragFiles = (window as any).__docuframeInternalDrag?.files as string[] | undefined;
        const droppedPathsFromOs = hasExternalFiles && e.dataTransfer.files.length > 0
          ? Array.from(e.dataTransfer.files).map((f: File) => (f as any).path).filter(Boolean)
          : [];
        const isInternalViaOsDrop = internalDragFiles && droppedPathsFromOs.length > 0 && droppedPathsFromOs.length === internalDragFiles.length
          && droppedPathsFromOs.every((p: string) => internalDragFiles.some((ip: string) =>
            ip.replace(/\\/g, '/').toLowerCase() === p.replace(/\\/g, '/').toLowerCase()
          ));
        const isInternal = isInternalDrag || !!internalDragFiles?.length || isInternalViaOsDrop;

        if (isInternal) {
          try {
            let filesToTransfer: string[] = [];
            const draggedFilesData = e.dataTransfer.getData('application/x-docuframe-files');
            if (draggedFilesData) {
              filesToTransfer = JSON.parse(draggedFilesData) as string[];
            } else if (internalDragFiles?.length) {
              filesToTransfer = internalDragFiles;
            } else if (isInternalViaOsDrop && droppedPathsFromOs.length > 0) {
              filesToTransfer = droppedPathsFromOs;
            } else {
              return;
            }
            
            const targetFolderPath = file.path.replace(/\\/g, '/');
            const isSameFolder = filesToTransfer.some(p => {
              const norm = p.replace(/\\/g, '/');
              const lastSep = norm.lastIndexOf('/');
              const sourceFolder = lastSep >= 0 ? norm.substring(0, lastSep) : '';
              return sourceFolder === targetFolderPath;
            });
            
            if (isSameFolder) {
              addLog('Cannot move files to the same folder', 'info');
              setStatus('Files are already in this folder', 'info');
              return;
            }
            
            const operation = e.ctrlKey ? 'copy' : 'move';
            
            if (window.electronAPI) {
              if (operation === 'copy') {
                const results = await window.electronAPI.copyFilesWithConflictResolution(filesToTransfer, file.path);
                const successful = results.filter((r: any) => r.status === 'success').length;
                addLog(`Copied ${successful} file(s) to ${file.name}`);
                setStatus(`Copied ${successful} file(s)`, 'success');
              } else {
                const results = await window.electronAPI.moveFilesWithConflictResolution(filesToTransfer, file.path);
                const successful = results.filter((r: any) => r.status === 'success').length;
                const failed = results.filter((r: any) => r.status === 'error').length;
                
                let message = `Moved ${successful} file(s) to ${file.name}`;
                if (failed > 0) message += `, ${failed} failed`;
                
                addLog(message);
                setStatus(message, failed > 0 ? 'error' : 'success');
              }
              
              setDraggedFiles(new Set());
              clearFolderHoverStates();
              try { delete (window as any).__docuframeInternalDrag; } catch {}
              await refreshDirectory(currentDirectory);
              
              if (operation === 'move') {
                setSelectedFiles([]);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`${e.ctrlKey ? 'Copy' : 'Move'} operation failed: ${errorMessage}`, 'error');
            setDraggedFiles(new Set());
            try { delete (window as any).__docuframeInternalDrag; } catch {}
          }
        } else if (hasExternalFiles && e.dataTransfer.files.length > 0) {
          try {
            const files = Array.from(e.dataTransfer.files).map(f => (f as any).path || f.name);
            const validFiles = files.filter(f => f && f !== f.name);
            
            if (validFiles.length > 0 && window.electronAPI) {
              const results = await window.electronAPI.copyFilesWithConflictResolution(validFiles, file.path);
              const successful = results.filter((r: any) => r.status === 'success').length;
              addLog(`Uploaded ${successful} file(s) to ${file.name}`);
              await refreshDirectory(currentDirectory);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Upload operation failed: ${errorMessage}`, 'error');
          }
        }
        
        // Always clear folder hover state after drop (success or failure)
        clearFolderHoverStates();
      }
    };
    folderDropHandlersCacheRef.current.set(key, handlers);
    return handlers;
  }, [handleFolderDragEnter, handleFolderDragLeave, addLog, setStatus, refreshDirectory, currentDirectory, setDraggedFiles, setSelectedFiles, clearFolderHoverStates]);

  // Prune folder drop handlers cache when sortedFiles changes (remove entries for files no longer in list)
  useEffect(() => {
    const paths = new Set(sortedFiles.map(f => f.path));
    const cache = folderDropHandlersCacheRef.current;
    for (const key of cache.keys()) {
      if (typeof key !== 'string') {
        cache.delete(key as any);
        continue;
      }
      const path = key.split('\x01')[0];
      if (!paths.has(path)) cache.delete(key);
    }
  }, [sortedFiles]);

  // Memoized cell styles (bg overridden per row); vertical padding follows the density preset
  const cellStyles = useMemo(
    () => ({
      bg: 'transparent',
      transition: 'background 0.1s',
      cursor: 'default',
      px: 2,
      py: rowDensity === 'compact' ? 0.5 : rowDensity === 'comfortable' ? 2 : 1,
      position: 'relative' as const,
      verticalAlign: 'middle' as const,
      pointerEvents: 'auto' as const,
      boxSizing: 'border-box' as const,
    }),
    [rowDensity],
  );

  // Signature for O(1) fileListViewPropsEqual when selection/hover/cut unchanged
  const memoizedArraySignature = useMemo(() => {
    const cutPaths = clipboard.operation === 'cut' ? clipboard.files.map(f => f.path).join(',') : '';
    const folderPaths = [...folderHoverState].sort().join(',');
    return `${selectedFiles.join(',')}|${cutPaths}|${folderPaths}|${fileSearchFilter ?? ''}`;
  }, [selectedFiles, clipboard, folderHoverState, fileSearchFilter]);

  const syncMarqueeSelectionBox = useCallback(
    (selectionBox: { left: number; top: number; right: number; bottom: number }) => {
      const overlay = marqueeOverlayRef.current;
      const root = dropAreaRef.current;
      const container = gridContainerRef.current || root;
      if (!overlay || !root || !container) return;
      let { left, top, right, bottom } = selectionBox;
      if (container !== root) {
        const dx = container.offsetLeft;
        const dy = container.offsetTop;
        left += dx;
        right += dx;
        top += dy;
        bottom += dy;
      }
      const w = Math.max(0, right - left);
      const h = Math.max(0, bottom - top);
      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      overlay.style.width = `${w}px`;
      overlay.style.height = `${h}px`;
    },
    [],
  );

  const resetMarqueeOverlay = useCallback(() => {
    const el = marqueeOverlayRef.current;
    if (!el) return;
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '0px';
    el.style.height = '0px';
  }, []);

  // Drag selection handlers
  const handleSelectionMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection if clicking on empty space (not on file rows, headers, or interactive elements)
    const target = e.target as HTMLElement;
    const isClickOnRow = target.closest('[data-row-index]');
    const isClickOnHeader = target.closest('[data-column]');
    const isClickOnInteractive = target.closest('button, input, a, [role="button"]');
    
    if (!isClickOnRow && !isClickOnHeader && !isClickOnInteractive && e.button === 0) {
      // If rename mode is active, blur the input first so the onBlur handler fires
      // (e.preventDefault below would otherwise block the browser's focus change)
      if (isRenamingRef.current && renameInputRef.current) {
        renameInputRef.current.blur();
      }
      if (isInlineCreatingFolderRef.current && newFolderInputRef.current) {
        newFolderInputRef.current.blur();
      }
      e.preventDefault();
      const container = gridContainerRef.current || dropAreaRef.current;
      if (!container) return;
      
      // Get container padding-left to account for offset
      if (containerPaddingLeftRef.current === 0) {
        const computedStyle = window.getComputedStyle(container);
        containerPaddingLeftRef.current = parseFloat(computedStyle.paddingLeft) || 0;
      }
      
      const containerRect = container.getBoundingClientRect();
      const startX = e.clientX - containerRect.left - containerPaddingLeftRef.current;
      const startY = e.clientY - containerRect.top + container.scrollTop;

      const selectionRectData = { startX, startY, currentX: startX, currentY: startY };
      setIsSelecting(true);
      selectionRectRef.current = selectionRectData;
      syncMarqueeSelectionBox({
        left: startX,
        top: startY,
        right: startX,
        bottom: startY,
      });

      // Track modifier keys for global handler
      selectionModifiersRef.current = {
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey,
      };
      
      // Clear selection unless Shift/Ctrl is held
      if (!e.shiftKey && !e.ctrlKey) {
        setSelectedFiles([]);
        setSelectedFile(null);
      }
    }
  }, [syncMarqueeSelectionBox]);

  const handleSelectionMouseUp = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
      selectionRectRef.current = null;
      resetMarqueeOverlay();
    }
  }, [isSelecting, resetMarqueeOverlay]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && selectedFiles.length > 0 && !isSelecting) {
      // Don't clear selection if we just finished a drag selection
      if (justFinishedSelectingRef.current) {
        return;
      }
      setSelectedFiles([]);
      setSelectedFile(null);
    }
  }, [selectedFiles, isSelecting]);

  // Add global mouse move and up handlers for drag selection
  // Throttled via requestAnimationFrame to avoid layout thrashing (getBoundingClientRect) and excessive re-renders
  useEffect(() => {
    if (isSelecting) {
      let pendingEvent: MouseEvent | null = null;

      const processMove = () => {
        rafIdRef.current = null;
        const e = pendingEvent;
        pendingEvent = null;
        if (!e) return;

        const container = gridContainerRef.current || dropAreaRef.current;
        const rectRef = selectionRectRef.current;
        if (!container || !rectRef) return;

        if (containerPaddingLeftRef.current === 0) {
          const computedStyle = window.getComputedStyle(container);
          containerPaddingLeftRef.current = parseFloat(computedStyle.paddingLeft) || 0;
        }

        const containerRect = container.getBoundingClientRect();
        const currentX = e.clientX - containerRect.left - containerPaddingLeftRef.current;
        const currentY = e.clientY - containerRect.top + container.scrollTop;

        const newRect = { ...rectRef, currentX, currentY };
        selectionRectRef.current = newRect;

        const selectionBox = {
          left: Math.min(rectRef.startX, currentX),
          top: Math.min(rectRef.startY, currentY),
          right: Math.max(rectRef.startX, currentX),
          bottom: Math.max(rectRef.startY, currentY),
        };
        syncMarqueeSelectionBox(selectionBox);

        const intersectingFiles: string[] = [];
        const rows = container.querySelectorAll('[data-row-index]');
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowRect = row.getBoundingClientRect();
          const rowTop = rowRect.top - containerRect.top + container.scrollTop;
          const rowBottom = rowTop + rowRect.height;
          const rowLeft = rowRect.left - containerRect.left;
          const rowRight = rowLeft + rowRect.width;

          if (
            rowTop < selectionBox.bottom &&
            rowBottom > selectionBox.top &&
            rowLeft < selectionBox.right &&
            rowRight > selectionBox.left
          ) {
            const rowIndex = parseInt(row.getAttribute('data-row-index') || '-1');
            if (rowIndex >= 0 && rowIndex < sortedFiles.length) {
              intersectingFiles.push(sortedFiles[rowIndex].name);
            }
          }
        }

        if (selectionModifiersRef.current.shiftKey || selectionModifiersRef.current.ctrlKey) {
          setSelectedFiles(prev => {
            const newSet = new Set(prev);
            intersectingFiles.forEach(name => newSet.add(name));
            const next = Array.from(newSet);
            if (next.length === prev.length && next.every((f, i) => f === prev[i])) return prev;
            return next;
          });
        } else {
          setSelectedFiles(prev => {
            if (prev.length === intersectingFiles.length && intersectingFiles.every((f, i) => f === prev[i])) return prev;
            return intersectingFiles;
          });
        }
      };

      const handleGlobalMouseMove = (e: MouseEvent) => {
        pendingEvent = e;
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(processMove);
        }
      };

      const handleGlobalMouseUp = () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        const rectRef = selectionRectRef.current;
        if (rectRef) {
          const hasMoved = Math.abs(rectRef.currentX - rectRef.startX) > 5 ||
                          Math.abs(rectRef.currentY - rectRef.startY) > 5;
          if (hasMoved) {
            justFinishedSelectingRef.current = true;
            setTimeout(() => {
              justFinishedSelectingRef.current = false;
            }, 100);
          }
        }
        setIsSelecting(false);
        selectionRectRef.current = null;
        resetMarqueeOverlay();
      };

      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }
  }, [isSelecting, sortedFiles, syncMarqueeSelectionBox, resetMarqueeOverlay]);

  
  const shouldSkipGridFocusClear = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return true;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
  }, []);

  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if (shouldSkipGridFocusClear(e.target)) return;
      (document.activeElement as HTMLElement)?.blur?.();
    },
    [shouldSkipGridFocusClear],
  );

  /** Capture so dead zones (e.g. past the table, below short lists) still dismiss focus-driven UI before inner stopPropagation. */
  const handleGridPointerDownCapture = useCallback(
    (e: React.PointerEvent) => {
      if (shouldSkipGridFocusClear(e.target)) return;
      (document.activeElement as HTMLElement)?.blur?.();
    },
    [shouldSkipGridFocusClear],
  );

  return (
    <Box
      p={0}
      m={0}
      height="100%"
      position="relative"
      display="flex"
      flexDirection="column"
      onClick={handleGridClick}
      onPointerDownCapture={handleGridPointerDownCapture}
    >
      <QuickFilterChips
        folderItems={folderItems}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />
      <Box flex="1" minH={0} position="relative">
      <FileListView
        dropAreaRef={dropAreaRef}
        gridContainerRef={gridContainerRef}
        renameInputRef={renameInputRef}
        marqueeOverlayRef={marqueeOverlayRef}
        isDragOver={isDragOver}
        isSelecting={isSelecting}
        isGroupedByIndex={listIsGrouped}
        groupedFiles={groupedFiles}
        sortedFiles={sortedFiles}
        columnOrder={columnOrder}
        columnVisibility={effectiveColumnVisibility}
        columnWidths={columnWidths}
        getFileVersion={versionStore.getVersion}
        fileVersionsEpoch={fileVersionsEpoch}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        draggingColumn={draggingColumn}
        dragTargetColumn={dragTargetColumn}
        dragMousePos={dragMousePos}
        dragOffset={dragOffset}
        isDragThresholdMet={isDragThresholdMet}
        hasDraggedColumn={hasDraggedColumn}
        isRenaming={isRenaming}
        renameValue={renameValue}
        fileGridBackgroundUrl={fileGridBackgroundUrl}
        fileGridBackgroundPath={fileGridBackgroundPath}
        backgroundFillUrl={backgroundFillUrl}
        backgroundFillPath={backgroundFillPath}
        backgroundType={backgroundType}
        enableBackgrounds={enableBackgrounds}
        nativeIcons={nativeIcons}
        getFileStateForIndex={getFileStateForIndex}
        memoizedArraySignature={memoizedArraySignature}
        rowSelectedBg={rowSelectedBg}
        rowDefaultBg={rowDefaultBg}
        searchHighlightBg={searchHighlightBg}
        folderDropBgColor={folderDropBgColor}
        fileSearchFilter={fileSearchFilter}
        recentlyTransferredFiles={recentlyTransferredFiles}
        tableHeadTextColor={tableHeadTextColor}
        headerHoverBg={headerHoverBg}
        headerStickyBg={headerStickyBg}
        tableSurfaceBg={tableBgColor}
        rowHoverBg={rowHoverBg}
        folderHoverState={folderHoverState}
        headerDividerBg={headerDividerBg}
        dragGhostBg={dragGhostBg}
        dragGhostBorder={dragGhostBorder}
        dragGhostAccent={dragGhostAccent}
        fileTextColor={fileTextColor}
        fileSubTextColor={fileSubTextColor}
        handleDragEnter={handleDragEnter}
        handleDragLeave={handleDragLeave}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleSelectionMouseDown={handleSelectionMouseDown}
        handleBackgroundClick={handleBackgroundClick}
        getSmartMenuPosition={getSmartMenuPosition}
        setBlankContextMenu={setBlankContextMenu}
        setHeaderContextMenu={setHeaderContextMenu}
        handleSort={handleSort}
        autoFitColumn={autoFitColumn}
        handleColumnDragStart={handleColumnDragStart}
        handleResizeStart={handleResizeStart}
        handleGroupHeaderDrop={handleGroupHeaderDrop}
        suppressHeaderPointerEventsForFileDrag={
          !draggingColumn && (isDragOver || dragCounter > 0)
        }
        groupedTransferTemplates={groupedTransferTemplates}
        onTransferFromGroupHeader={handleTransferFromGroupHeader}
        rowHandlers={rowHandlers}
        createFolderDropHandlers={createFolderDropHandlers}
        observeFileElement={observeFileElement}
        unobserveFileElement={unobserveFileElement}
        formatFileSize={formatFileSize}
        formatDate={formatDate}
        handleRenameSubmit={handleRenameSubmit}
        handleRenameCancel={handleRenameCancel}
        isInlineCreatingFolder={isInlineCreatingFolder}
        newFolderDraftName={newFolderDraftName}
        setNewFolderDraftName={setNewFolderDraftName}
        newFolderInputRef={newFolderInputRef}
        submitInlineNewFolder={submitInlineNewFolder}
        cancelInlineNewFolder={cancelInlineNewFolder}
        setIsRenaming={setIsRenaming}
        setRenameValue={setRenameValue}
        setFileGridBackgroundUrl={setFileGridBackgroundUrl}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setSelectedFile={setSelectedFile}
        clearFolderHoverStates={clearFolderHoverStates}
        cellStyles={cellStyles}
        groupHeaderVariant={groupHeaderVariant}
        groupOrder={groupOrder}
        rowDensity={rowDensity}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearAllFilters}
        onCreateFolderRequest={() => setIsCreateFolderOpen(true)}
      />
      </Box>
      <FileContextMenu
        contextMenu={contextMenu}
        selectedFiles={selectedFiles}
        selectedFilesSet={selectedFilesSet}
        sortedFiles={sortedFiles}
        clipboard={clipboard}
        setClipboard={setClipboard}
        handleMenuAction={handleMenuAction}
        handlePaste={handlePaste}
        handleCloseContextMenu={handleCloseContextMenu}
        quickAccessPaths={quickAccessPaths}
        recentClientPaths={recentClientPaths}
        activeSectionKeys={activeSectionKeys}
        currentDirectory={currentDirectory}
        onCreateFromTemplate={async (templatePath: string, templateName: string) => {
          const targetFolder = contextMenu.fileItem?.type === 'folder' ? contextMenu.fileItem.path : currentDirectory;
          try {
            const destPath = joinPath(targetFolder, templateName);
            await (window.electronAPI as any).copyWorkpaperTemplate(templatePath, destPath);
            addLog(`Created ${templateName} from template`);
            setStatus(`Created ${templateName} from template`, 'success');
            if (targetFolder === currentDirectory) {
              await refreshDirectory(currentDirectory);
            }
          } catch (error) {
            console.error('Error creating from template:', error);
            addLog(`Failed to create from template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setStatus('Failed to create from template', 'error');
          }
        }}
        setMoveToFiles={setMoveToFiles}
        setIsMoveToDialogOpen={setIsMoveToDialogOpen}
      />
      <BlankContextMenu
        blankContextMenu={blankContextMenu}
        clipboard={clipboard}
        handlePaste={handlePaste}
        setBlankContextMenu={setBlankContextMenu}
        onPasteImage={() => setImagePasteOpen(true)}
        currentDirectory={currentDirectory}
        onCreateFolder={() => {
          setIsCreateFolderOpen(true);
        }}
        onCreateTextFile={async () => {
          const fileName = 'Untitled.txt';
          try {
            const filePath = joinPath(currentDirectory, fileName);
            await (window.electronAPI as any).createTextFile(filePath);
            addLog('Created Untitled.txt');
            setStatus('Created Untitled.txt', 'success');
            await refreshDirectory(currentDirectory);
            setSelectedFiles([fileName]);
            setSelectedFile(fileName);
            setIsRenaming(fileName);
            setRenameValue('.txt');
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Failed to create text file: ${msg}`, 'error');
            setStatus('Failed to create text file', 'error');
          }
        }}
        onCreateSpreadsheet={async () => {
          const fileName = 'Untitled.xlsx';
          try {
            const filePath = joinPath(currentDirectory, fileName);
            await (window.electronAPI as any).createBlankSpreadsheet(filePath);
            addLog('Created Untitled.xlsx');
            setStatus('Created Untitled.xlsx', 'success');
            await refreshDirectory(currentDirectory);
            setSelectedFiles([fileName]);
            setSelectedFile(fileName);
            setIsRenaming(fileName);
            setRenameValue('.xlsx');
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Failed to create spreadsheet: ${msg}`, 'error');
            setStatus('Failed to create spreadsheet', 'error');
          }
        }}
        onCreateWordDoc={async () => {
          const fileName = 'Untitled.docx';
          try {
            const filePath = joinPath(currentDirectory, fileName);
            await (window.electronAPI as any).createWordDocument(filePath);
            addLog('Created Untitled.docx');
            setStatus('Created Untitled.docx', 'success');
            await refreshDirectory(currentDirectory);
            setSelectedFiles([fileName]);
            setSelectedFile(fileName);
            setIsRenaming(fileName);
            setRenameValue('.docx');
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Failed to create Word document: ${msg}`, 'error');
            setStatus('Failed to create Word document', 'error');
          }
        }}
        onCreateShortcut={async () => {
          try {
            const result = await window.electronAPI.openWindowsCreateShortcutWizard(currentDirectory);
            if (result.success) {
              addLog('Opened Windows Create Shortcut wizard', 'info');
              setStatus('Create Shortcut wizard opened', 'info');
            } else {
              const msg = result.error || 'Could not open Create Shortcut wizard';
              addLog(msg, 'error');
              setStatus(msg, 'error');
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            addLog(`Create Shortcut wizard failed: ${msg}`, 'error');
            setStatus('Create Shortcut wizard failed', 'error');
          }
        }}
        onCreateFromTemplate={async (templatePath: string, templateName: string) => {
          try {
            const destPath = joinPath(currentDirectory, templateName);
            await (window.electronAPI as any).copyWorkpaperTemplate(templatePath, destPath);
            addLog(`Created ${templateName} from template`);
            setStatus(`Created ${templateName} from template`, 'success');
            await refreshDirectory(currentDirectory);
            setSelectedFiles([templateName]);
            setSelectedFile(templateName);
            setIsRenaming(templateName);
            setRenameValue(templateName);
          } catch (error) {
            console.error('Error creating from template:', error);
            addLog(`Failed to create from template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            setStatus('Failed to create from template', 'error');
          }
        }}
        onCopyPath={() => {
          navigator.clipboard.writeText(currentDirectory);
          setStatus(`Copied path: ${currentDirectory}`, 'info');
        }}
        onOpenPowerShell={async () => {
          try {
            await (window.electronAPI as any).openCmdAtDirectory(currentDirectory);
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            setStatus(`Failed to open PowerShell: ${msg}`, 'error');
          }
        }}
        groupByMode={groupByMode}
        onSetGroupByMode={setGroupByMode}
        rowDensity={rowDensity}
        onSetRowDensity={(d) => void handleSetRowDensity(d)}
      />
      {/* Header Column Visibility Menu */}
      <HeaderContextMenu
        headerContextMenu={headerContextMenu}
        columnVisibility={columnVisibility}
        toggleColumnVisibility={toggleColumnVisibility}
        closeHeaderContextMenu={closeHeaderContextMenu}
        periodAvailable={isGstFolder}
      />
      <FileGridDialogs
        currentDirectory={currentDirectory}
        selectedFiles={selectedFiles}
        selectedFilesSet={selectedFilesSet}
        sortedFiles={sortedFiles}
        contextMenu={contextMenu}
        addLog={addLog}
        setStatus={setStatus}
        refreshDirectory={refreshDirectory}
        setMergePDFOpen={setMergePDFOpen}
        setUploadToVaultsOpen={setUploadToVaultsOpen}
        setVaultUploadSourcePaths={setVaultUploadSourcePaths}
        setVaultUploadTargetDir={setVaultUploadTargetDir}
        setExtractedTextOpen={setExtractedTextOpen}
        setPropertiesOpen={setPropertiesOpen}
        setImagePasteOpen={setImagePasteOpen}
        setIsMoveToDialogOpen={setIsMoveToDialogOpen}
        setMoveToFiles={setMoveToFiles}
        setIsIndexPrefixDialogOpen={setIsIndexPrefixDialogOpen}
        setIsRenameIndexDialogOpen={setIsRenameIndexDialogOpen}
        setIsSmartRenameDialogOpen={setIsSmartRenameDialogOpen}
        setSmartRenameFile={setSmartRenameFile}
        isMergePDFOpen={isMergePDFOpen}
        isUploadToVaultsOpen={isUploadToVaultsOpen}
        vaultUploadSourcePaths={vaultUploadSourcePaths}
        vaultUploadTargetDir={vaultUploadTargetDir}
        isExtractedTextOpen={isExtractedTextOpen}
        extractedTextData={extractedTextData}
        isPropertiesOpen={isPropertiesOpen}
        propertiesFile={propertiesFile}
        isImagePasteOpen={isImagePasteOpen}
        isIndexPrefixDialogOpen={isIndexPrefixDialogOpen}
        prefixDialogFiles={prefixDialogFiles}
        isMoveToDialogOpen={isMoveToDialogOpen}
        moveToFiles={moveToFiles}
        isRenameIndexDialogOpen={isRenameIndexDialogOpen}
        smartRenameFile={smartRenameFile}
        isSmartRenameDialogOpen={isSmartRenameDialogOpen}
        closeIndexPrefixDialog={closeIndexPrefixDialog}
        closeRenameIndexDialog={closeRenameIndexDialog}
        handleAssignPrefix={handleAssignPrefix}
        handleRenameIndex={handleRenameIndex}
        handleSmartRenameConfirm={handleSmartRenameConfirm}
        handleUnblockFile={handleUnblockFile}
        handleImageSaved={handleImageSaved}
        showFileOperationFailure={showFileOperationFailure}
      />
      <SplitPdfDialog
        open={isSplitPdfOpen}
        file={splitPdfFile}
        onClose={() => {
          setIsSplitPdfOpen(false)
          setSplitPdfFile(null)
        }}
        onSplit={handleSplitPdfConfirm}
      />
      <EditPdfDialog
        open={isEditPdfOpen}
        file={editPdfFile}
        onClose={() => {
          setIsEditPdfOpen(false)
          setEditPdfFile(null)
        }}
        onSave={handleEditPdfConfirm}
      />
      <FileOperationFailedDialog
        open={fileOpFailureDialog.open}
        title={fileOpFailureDialog.title}
        description={fileOpFailureDialog.description}
        operationLabel={fileOpFailureDialog.operationLabel}
        isRetrying={fileOpRetrying}
        onRetry={handleFileOpFailureRetry}
        onCancel={handleFileOpFailureCancel}
      />
    </Box>
  );
}