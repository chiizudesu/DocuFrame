import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Box,
  useToast,
  useColorModeValue,
} from '@chakra-ui/react'
import { useAppContext } from '../context/AppContext'
import { joinPath, isAbsolutePath, normalizePath } from '../utils/path'
import { settingsService } from '../services/settings'
import { MergePDFDialog } from './MergePDFDialog'
import { ExtractedTextDialog } from './ExtractedTextDialog'
import type { FileItem } from '../types'
import { CustomPropertiesDialog, FileProperties } from './CustomPropertiesDialog';
import { ImagePasteDialog } from './ImagePasteDialog';
import { IndexPrefixDialog } from './IndexPrefixDialog';
import { RenameIndexDialog } from './RenameIndexDialog';
import { SmartRenameDialog } from './SmartRenameDialog';
import { extractIndexPrefix, setIndexPrefix, removeIndexPrefix, groupFilesByIndex, getIndexInfo, getAllIndexKeys, toProperCase, getMaxIndexPillWidth } from '../utils/indexPrefix';
import { SortColumn, SortDirection, formatPathForLog } from './FileGrid/FileGridUtils';
import { FileContextMenu, BlankContextMenu, TemplateSubmenu, MoveToDialogWrapper, HeaderContextMenu } from './FileGrid/FileGridUI';
import { FileListView } from './FileGrid/FileListView';

// Icon functions removed - using native Windows icons instead

// File size formatting function - REMOVED duplicate, using optimized version inside component

// formatDate function - will be optimized inside component

// JumpModeOverlay component moved to main app level


export const FileGrid: React.FC = () => {
  // All useContext hooks first
  const { 
    currentDirectory, 
    setCurrentDirectory, 
    addLog, 
    setStatus,
    rootDirectory,
    setSelectAllFiles,
    folderItems,
    setFolderItems, 
    selectedFiles, 
    setSelectedFiles, 
    clipboard, 
    setClipboard, 
    addRecentlyTransferredFiles, 
    clearRecentlyTransferredFiles, 
    recentlyTransferredFiles, 
    removeRecentlyTransferredFile,
    addTabToCurrentWindow,
    isQuickNavigating,
    isJumpModeActive,
    setIsJumpModeActive,
    hideTemporaryFiles, // NEW
    hideDotFiles, // NEW
    addQuickAccessPath,
    removeQuickAccessPath,
    quickAccessPaths,
    logFileOperation, // Task Timer integration
    fileSearchFilter, // File search filter for current directory
    contentSearchResults, // Content search results (files matching content search)
    isGroupedByIndex, // Group files by index prefix
  } = useAppContext()

  // Memoize selectedFiles as Set for O(1) lookup performance (moved early to avoid initialization errors)
  const selectedFilesSet = useMemo(() => {
    return new Set(selectedFiles);
  }, [selectedFiles]);

  // Icon functions removed - using native Windows icons instead

  // File filtering function
  const filterFiles = useCallback((files: any[]) => {
    if (!Array.isArray(files)) return files;
    
    return files.filter((f: any) => {
      // Filter temporary files (files starting with ~$)
      if (hideTemporaryFiles && f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$')) {
        return false;
      }
      
      // Filter dot files/folders (files/folders starting with .)
      if (hideDotFiles && typeof f?.name === 'string' && f.name.startsWith('.')) {
        return false;
      }
      
      return true;
    });
  }, [hideTemporaryFiles, hideDotFiles]);

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
  
  const toast = useToast()
  
  // All useState hooks next
  const [isLoading, setIsLoading] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
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
  const hasPositionedCursor = useRef<boolean>(false)
  const isLoadingRef = useRef<boolean>(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [isMergePDFOpen, setMergePDFOpen] = useState(false)
  const [isExtractedTextOpen, setExtractedTextOpen] = useState(false)
  const [extractedTextData, setExtractedTextData] = useState({ fileName: '', text: '' })
  const [isIndexPrefixDialogOpen, setIsIndexPrefixDialogOpen] = useState(false)
  const [isRenameIndexDialogOpen, setIsRenameIndexDialogOpen] = useState(false)
  const [isSmartRenameDialogOpen, setIsSmartRenameDialogOpen] = useState(false)
  const [smartRenameFile, setSmartRenameFile] = useState<FileItem | null>(null)
  const [prefixDialogFiles, setPrefixDialogFiles] = useState<FileItem[]>([])
  const [isMoveToDialogOpen, setIsMoveToDialogOpen] = useState(false)
  const [moveToFiles, setMoveToFiles] = useState<FileItem[]>([])
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([])
  const [templateSubmenuOpen, setTemplateSubmenuOpen] = useState(false)
  const [templateSubmenuPosition, setTemplateSubmenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [isImagePasteOpen, setImagePasteOpen] = useState(false)
  const [fileGridBackgroundPath, setFileGridBackgroundPath] = useState<string>('')
  const [fileGridBackgroundUrl, setFileGridBackgroundUrl] = useState<string>('')
  const [backgroundFillPath, setBackgroundFillPath] = useState<string>('')
  const [backgroundFillUrl, setBackgroundFillUrl] = useState<string>('')
  const [backgroundType, setBackgroundType] = useState<'watermark' | 'backgroundFill'>('watermark')
  
  // Drag selection state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const selectionModifiersRef = useRef<{ shiftKey: boolean; ctrlKey: boolean }>({ shiftKey: false, ctrlKey: false })
  const justFinishedSelectingRef = useRef(false)
  const containerPaddingLeftRef = useRef<number>(0)




  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)
  
  // Cleanup drag leave timeout on unmount
  useEffect(() => {
    return () => {
      if (dragLeaveTimeoutRef.current) {
        clearTimeout(dragLeaveTimeoutRef.current);
      }
    };
  }, []);

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

  // Track which row is hovered to highlight the entire row in list view
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  // Optimized hover handlers with throttling to prevent excessive state updates
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverTimeRef = useRef<number>(0);
  const HOVER_THROTTLE_MS = 16; // ~60fps
  
  const handleRowMouseEnter = useCallback((index: number) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    
    // Throttle hover updates to ~60fps
    const now = Date.now();
    if (now - lastHoverTimeRef.current >= HOVER_THROTTLE_MS) {
      if (hoveredRowIndex !== index) {
        setHoveredRowIndex(index);
      }
      lastHoverTimeRef.current = now;
    } else {
      // Schedule update if throttled
      hoverTimeoutRef.current = setTimeout(() => {
        if (hoveredRowIndex !== index) {
          setHoveredRowIndex(index);
        }
        lastHoverTimeRef.current = Date.now();
      }, HOVER_THROTTLE_MS - (now - lastHoverTimeRef.current));
    }
  }, [hoveredRowIndex]);
  
  const handleRowMouseLeave = useCallback((index: number, e: React.MouseEvent) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Debounce the hover clear to prevent flickering
    hoverTimeoutRef.current = setTimeout(() => {
      const related = e.relatedTarget;
      // Check if relatedTarget is an Element with closest method
      if (related && typeof (related as any).closest === 'function' && (related as Element).closest(`[data-row-index="${index}"]`)) return;
      setHoveredRowIndex(prev => (prev === index ? null : prev));
      lastHoverTimeRef.current = Date.now();
    }, 50); // 50ms debounce
  }, []);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Function to reset drag state - can be called by child components
  const resetDragState = useCallback(() => {
    setIsDragOver(false);
    setDragCounter(0);
    setDraggedFiles(new Set());
  }, []);

  // Callback to handle when native icons are loaded
  const handleNativeIconLoaded = useCallback((filePath: string, iconData: string) => {
    setNativeIcons(prev => new Map(prev.set(filePath, iconData)));
  }, []);

  // Utility function to get filename without extension for cursor positioning - OPTIMIZED with useCallback
  const getFilenameWithoutExtension = useCallback((filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No extension or hidden file (starts with .)
      return filename.length;
    }
    return lastDotIndex;
  }, []);

  // Position cursor at end of filename (before extension) when rename starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current && !hasPositionedCursor.current) {
      const input = renameInputRef.current;
      const cursorPosition = getFilenameWithoutExtension(renameValue);
      
      // Use setTimeout to ensure the input is fully rendered
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(cursorPosition, cursorPosition);
        hasPositionedCursor.current = true;
      }, 0);
    } else if (!isRenaming) {
      // Reset the flag when not renaming
      hasPositionedCursor.current = false;
    }
  }, [isRenaming]);

  // All useColorModeValue hooks next
  const itemBgHover = useColorModeValue('#f0f9ff', 'blue.700') // Lighter than selection
  const fileTextColor = useColorModeValue('#334155', 'white')
  const fileSubTextColor = useColorModeValue('#64748b', 'gray.400')
  const tableBgColor = useColorModeValue('#f8fafc', 'transparent')
  const tableHeadBgColor = useColorModeValue('#f1f5f9', 'gray.800')
  const tableHeadTextColor = useColorModeValue('#475569', 'gray.300')
  const tableBorderColor = useColorModeValue('#d1d5db', 'gray.700')

  // Additional color tokens (hoisted) to avoid calling hooks inside loops/conditionals
  const borderColorDefault = useColorModeValue('gray.200', 'gray.700')
  const gridItemSelectedBg = useColorModeValue('blue.50', 'blue.900')
  const gridItemDefaultBg = useColorModeValue('#f8f9fc', 'gray.800')
  const hoverBorderColor = useColorModeValue('blue.200', 'blue.700')
  const headerHoverBg = useColorModeValue('gray.200', 'gray.600')
  const headerStickyBg = useColorModeValue('gray.50', 'gray.900')
  const headerDividerBg = useColorModeValue('gray.300', 'gray.700')
  const rowSelectedBg = useColorModeValue('blue.200', 'blue.900')
  const rowHoverBg = useColorModeValue('gray.100', 'gray.700')
  const folderDropBgColor = useColorModeValue('blue.100', 'blue.700')
  const searchHighlightBg = useColorModeValue('blue.50', 'blue.900')
  const dragGhostBg = useColorModeValue('gray.50', 'gray.900')
  const dragGhostBorder = useColorModeValue('gray.300', 'gray.700')
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
      typeValue: getFileExtension(item.name, item.type).toLowerCase()
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
      } else if (sortColumn === 'modified') {
        return sortDirection === 'asc' 
          ? a.modifiedValue - b.modifiedValue
          : b.modifiedValue - a.modifiedValue;
      } else if (sortColumn === 'type') {
        return sortDirection === 'asc' 
          ? a.typeValue.localeCompare(b.typeValue)
          : b.typeValue.localeCompare(a.typeValue);
      }
      return 0;
    });
    
    return sortData.map(data => data.item);
  }, [folderItems, sortColumn, sortDirection, fileSearchFilter, contentSearchPathsSet]);

  // Group files by index prefix when grouping is enabled
  const groupedFiles = useMemo(() => {
    if (!isGroupedByIndex || sortedFiles.length === 0) return null;
    
    const grouped = groupFilesByIndex(sortedFiles);
    // Return null if no groups were created (shouldn't happen, but safety check)
    return Object.keys(grouped).length > 0 ? grouped : null;
  }, [sortedFiles, isGroupedByIndex]);

  // Pre-compute file name to path map for O(1) drag lookups (moved early to avoid initialization errors)
  const fileNameToPathMap = useMemo(() => {
    const map = new Map<string, string>();
    sortedFiles.forEach(file => {
      map.set(file.name, file.path);
    });
    return map;
  }, [sortedFiles]);

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
        isLoadingRef.current = false
      }
    },
    [addLog, setFolderItems, filterFiles, setStatus]
  );

  // Load directory contents when current directory changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedLoadDirectory(currentDirectory);
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [currentDirectory, debouncedLoadDirectory])

  // Listen for manual refresh events from FolderInfoBar
  useEffect(() => {
    const handleDirectoryRefreshed = (event: CustomEvent) => {
      const eventDirectory = event.detail?.directory;
      if (eventDirectory === currentDirectory) {
        // Force reload the current directory
        debouncedLoadDirectory(currentDirectory);
      }
    };

    window.addEventListener('directoryRefreshed', handleDirectoryRefreshed as EventListener);
    return () => {
      window.removeEventListener('directoryRefreshed', handleDirectoryRefreshed as EventListener);
    };
  }, [currentDirectory, debouncedLoadDirectory])

  // Handle column header click for sorting - OPTIMIZED with useCallback
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column is clicked
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
    addLog(
      `Sorting by ${column} (${sortDirection === 'asc' ? 'descending' : 'ascending'})`,
    )
  }, [sortColumn, sortDirection, addLog])

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
  const getSmartMenuPosition = useCallback((clientX: number, clientY: number, menuHeight = 300) => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    
    const menuWidth = 200; // minW="200px" from the menu
    
    let x = clientX;
    let y = clientY;
    
    // Adjust horizontal position if menu would be clipped on the right
    if (x + menuWidth > viewport.width) {
      x = viewport.width - menuWidth - 10; // 10px margin from edge
    }
    
    // Adjust vertical position if menu would be clipped on the bottom
    if (y + menuHeight > viewport.height) {
      y = clientY - menuHeight; // Position above cursor
      // If still clipped at top, position at top with margin
      if (y < 10) {
        y = 10;
      }
    }
    
    return { x, y };
  }, []);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    file: FileItem,
  ) => {
    e.preventDefault()
    
    // If the right-clicked file is not part of the current selection,
    // clear selection and select only this file
    if (!selectedFilesSet.has(file.name)) {
      setSelectedFiles([file.name]);
      setSelectedFile(file.name);
    }
    
    const position = getSmartMenuPosition(e.clientX, e.clientY, 300);
    
    setContextMenu({
      isOpen: true,
      position,
      fileItem: file,
    })
  }, [selectedFilesSet]);

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
      
      // Provide summary feedback
      if (deletedFiles.length > 0) {
        setStatus(`Successfully deleted ${deletedFiles.length} file(s)`, 'success');
        
        // Show toast notification for successful delete operations
        
      }
      
      if (failedFiles.length > 0) {
        setStatus(`Failed to delete ${failedFiles.length} file(s). Check console for details.`, 'error');
        
        // Show detailed error message for failed files
        const errorDetails = failedFiles.map(f => `• ${f.name}: ${f.error}`).join('\n');
        addLog(`Delete operation completed with errors:\n${errorDetails}`, 'error');
        
        // Show a more user-friendly error message
        const failedFileNames = failedFiles.map(f => f.name).join(', ');
        setStatus(`Failed to delete: ${failedFileNames}`, 'error');
        
        // Show toast notification for failed delete operations
        toast({
          title: 'Delete Failed',
          description: `Failed to delete ${failedFiles.length} file(s): ${failedFileNames}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      }
      
      // Refresh the current directory regardless of errors
      await refreshDirectory(currentDirectory);
      setSelectedFiles([])
      
    } catch (error: any) {
      const errorMessage = error?.message || error;
      addLog(`Delete operation failed: ${errorMessage}`, 'error');
      setStatus('Delete operation failed', 'error');
    }
  }, [selectedFiles, sortedFiles, currentDirectory, addLog, setStatus, setFolderItems, filterFiles, toast])

  // In context menu, pass array for multi-select delete - OPTIMIZED with useCallback
  const handleMenuAction = useCallback(async (action: string) => {
    if (!contextMenu.fileItem) return

    try {
      switch (action) {
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
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$'))) : files)
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
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$'))) : files)
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
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$'))) : files)
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
                // Refresh folder view
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                {
                  const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
                  const filtered = hideTemporaryFiles
                    ? (Array.isArray(files) ? files.filter((f: any) => !(f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$'))) : files)
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
            toast({
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
                return { file: file.name, success: true, newName };
              })
            );
            
            const successful = results.filter(r => r.status === 'fulfilled' && !r.value.skipped).length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (successful > 0) {
              setStatus(`Removed prefix from ${successful} file(s)`, 'success');
              await refreshDirectory(currentDirectory);
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
        case 'smart_rename':
          setSmartRenameFile(contextMenu.fileItem);
          setIsSmartRenameDialogOpen(true);
          break;
        case 'proper_case_rename':
          await handleProperCaseRename(contextMenu.fileItem);
          break;
        default:
          addLog(`Function: ${action} on ${contextMenu.fileItem.name}`)
      }
    } catch (error) {
      addLog(`Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }

    handleCloseContextMenu()
  }, [contextMenu.fileItem, selectedFiles, sortedFiles, currentDirectory, addLog, setStatus, addTabToCurrentWindow, setIsRenaming, setRenameValue, handleDeleteFile, setExtractedTextData, setExtractedTextOpen, setMergePDFOpen, hideTemporaryFiles, setFolderItems, handleOpenOrNavigate, handleCloseContextMenu, addQuickAccessPath, removeQuickAccessPath])

  // Separate refresh function that doesn't show loading state (for background refreshes)
  // Defined early so it can be used by other callbacks
  const refreshDirectory = useCallback(async (dirPath: string) => {
    if (!dirPath || dirPath.trim() === '') return;
    
    // Prevent concurrent refreshes but don't show loading
    if (isLoadingRef.current) return
    
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
        const filtered = filterFiles(files)
        setFolderItems(filtered as any);
        addLog(`Refreshed directory: ${formatPathForLog(normalizedPath)}`);
      } else {
        addLog(`Warning: Directory refresh returned invalid data`, 'info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to refresh directory: ${errorMessage}`, 'error');
    }
  }, [setFolderItems, addLog, filterFiles]);

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
      toast({
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
        
        toast({
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
      toast({
        title: isCopy ? 'Copy Failed' : 'Prefix Assignment Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [prefixDialogFiles, currentDirectory, addLog, setStatus, refreshDirectory, toast]);

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
      toast({
        title: 'Copy Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [selectedFiles, sortedFiles, contextMenu.fileItem, selectedFilesSet, currentDirectory, addLog, setStatus, refreshDirectory, toast]);

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to proper case filename: ${errorMessage}`, 'error');
      setStatus('Failed to proper case filename', 'error');
      toast({
        title: 'Rename Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
    }
  }, [currentDirectory, addLog, setStatus, refreshDirectory, toast]);

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
      setSmartRenameFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to rename: ${errorMessage}`, 'error');
      setStatus('Failed to rename file', 'error');
      toast({
        title: 'Rename Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'top',
      });
      throw error; // Re-throw so dialog can handle it
    }
  }, [smartRenameFile, currentDirectory, addLog, setStatus, refreshDirectory, toast]);

  const handleRenameSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isRenaming) return
    const trimmedName = renameValue?.trim();
    if (!trimmedName) {
      setIsRenaming(null)
      setRenameValue('')
      return
    }
    // If the name is exactly the same (including case), no change needed
    if (trimmedName === isRenaming) {
      setIsRenaming(null)
      setRenameValue('')
      return
    }
    try {
      // Find the actual file to get its full path
      const fileToRename = folderItems.find(f => f.name === isRenaming);
      if (!fileToRename) {
        toast({
          title: 'Rename Failed',
          description: `File "${isRenaming}" not found.`,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
        setIsRenaming(null);
        setRenameValue('');
        return;
      }
      
      const oldPath = fileToRename.path;
      const newPath = isAbsolutePath(trimmedName) ? trimmedName : joinPath(currentDirectory === '/' ? '' : currentDirectory, trimmedName)
      
      // Check if this is a case-only rename (same name, different case)
      const isCaseOnlyRename = fileToRename.name.toLowerCase() === trimmedName.toLowerCase() && 
                               fileToRename.name !== trimmedName;
      
      // Only check for conflicts if it's NOT a case-only rename
      // Case-only renames should always be allowed (Windows handles them specially)
      if (!isCaseOnlyRename) {
        // Check if target file already exists (case-insensitive, excluding current file)
        // Normalize paths for comparison to handle Windows path case differences
        const normalizedOldPath = oldPath.replace(/\\/g, '/').toLowerCase();
        const existingFile = folderItems.find(f => {
          const normalizedPath = f.path.replace(/\\/g, '/').toLowerCase();
          return normalizedPath !== normalizedOldPath &&
                 f.name.toLowerCase() === trimmedName.toLowerCase();
        });
        
        if (existingFile) {
          // File with same name exists - show error
          toast({
            title: 'Rename Failed',
            description: `A file named "${trimmedName}" already exists.`,
            status: 'error',
            duration: 5000,
            isClosable: true,
            position: 'top',
          });
          return;
        }
      }
      
      await (window.electronAPI as any).renameItem(oldPath, newPath)
      addLog(`Renamed ${isRenaming} to ${trimmedName}`)
      
      // Show toast notification for successful rename operations
      
      
      setIsRenaming(null)
      setRenameValue('')
      // Refresh directory to show renamed file
      await refreshDirectory(currentDirectory)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to rename: ${errorMessage}`, 'error')
      setStatus(`Failed to rename "${isRenaming}": ${errorMessage}`, 'error')
      
      // Show toast notification for failed rename operations
              toast({
          title: 'Rename Failed',
          description: `Failed to rename "${isRenaming}": ${errorMessage}`,
          status: 'error',
          duration: 5000,
          isClosable: true,
          position: 'top',
        });
      
      setIsRenaming(null)
      setRenameValue('')
    }
  }, [isRenaming, renameValue, currentDirectory, addLog, setStatus, refreshDirectory])

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
        
        // Handle file watcher events (new files detected)
        if (data.event === 'add' && data.filePath) {
          addRecentlyTransferredFiles([data.filePath]);
          
          // Log file operation for task timer
          const fileName = data.filePath.split('\\').pop() || data.filePath;
          const dirName = currentDirectory.split('\\').pop() || currentDirectory;
          logFileOperation(`${fileName} transferred to ${dirName}`);
          
          // Set timeout to remove the "new" indicator (15 seconds)
          setTimeout(() => {
            removeRecentlyTransferredFile(data.filePath!);
          }, 15000); // 15 seconds
        }
        
        // Handle transfer events (existing functionality)
        if (data.newFiles && data.newFiles.length > 0) {
          addRecentlyTransferredFiles(data.newFiles);
          
          // Log file operations for task timer - one entry per file
          const dirName = currentDirectory.split('\\').pop() || currentDirectory;
          data.newFiles.forEach(filePath => {
            const fileName = filePath.split('\\').pop() || filePath;
            logFileOperation(`${fileName} transferred to ${dirName}`);
          });
          
          // Set individual timeouts for each file (15 seconds each)
          data.newFiles.forEach(filePath => {
            setTimeout(() => {
              removeRecentlyTransferredFile(filePath);
            }, 15000); // 15 seconds
          });
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
    if (!event) {
      // Fallback for no event - simple selection
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
      return;
    }

    // Reset drag state
    setIsDragStarted(false);
    setPendingSelectionChange(null);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+click: Select range from last selected to current
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeSelection = sortedFiles.slice(start, end + 1).map(f => f.name);
      setSelectedFiles(rangeSelection);
      setSelectedFile(file.name);
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
  }, [lastSelectedIndex, selectedFiles, sortedFiles]);

  // Add this function for handling mouse up - completes smart selection logic - OPTIMIZED with useCallback
  const handleFileItemMouseUp = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    // If we have a pending selection change and no drag started, complete the selection
    if (pendingSelectionChange && !isDragStarted && pendingSelectionChange.fileName === file.name) {
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
    }
    // Clear pending state
    setPendingSelectionChange(null);
  }, [pendingSelectionChange, isDragStarted]);

  // Add this function for handling drag start - prevents selection change on drag - OPTIMIZED with useCallback
  const handleFileItemDragStart = useCallback((file: FileItem, index: number, event?: React.DragEvent) => {
    if (!event) return;
    
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
    try { (window as any).__docuframeInternalDrag = { files: filesToDrag }; } catch {}
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
  }, [selectedFiles, selectedFilesSet, fileNameToPathMap, addLog]);

  // Add this function for selection on click - OPTIMIZED with useCallback
  const handleFileItemClick = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    const now = Date.now();
    
    // Check if this is a double-click (same file clicked within 500ms) using refs for reliable comparison
    if (lastClickedFileRef.current === file.name && now - lastClickTimeRef.current < 500) {
      clearTimeout(clickTimer as NodeJS.Timeout);
      lastClickTimeRef.current = 0;
      lastClickedFileRef.current = null;
      setLastClickTime(0);
      setClickTimer(null);
      setLastClickedFile(null);
      
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
    }
  }, [selectedFiles, selectedFilesSet, clickTimer, sortedFiles, handleOpenOrNavigate, setLastClickTime, setClickTimer, setLastClickedFile]);

  // Add F2 key support for rename
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any input field is focused
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isInputFocused) return;
      
      if (e.key === 'F2' && selectedFile && !isRenaming) {
        setIsRenaming(selectedFile)
        setRenameValue(selectedFile)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFile, isRenaming])

  // Keyboard shortcuts: Enter to open, Delete to delete, Escape to cancel drag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if any input field is focused
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isRenaming || isInputFocused) return;
      
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
    
    // Check for external files (from OS file explorer) - NOT internal drags
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const isExternalDrag = hasFilesType && !hasCustomType;
    
    if (isExternalDrag && internalDragFlag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    }
    
    const isInternalDrag = hasCustomType || (!hasFilesType && internalDragFlag);
    
    // Only show upload overlay for external files, not internal drags
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
    if (targetElement && targetElement.closest('[data-group-drop-zone="true"]')) {
      // Let headers manage their own drag behavior
      return;
    }
    
    // Clear any pending drag leave timeout to keep the overlay visible
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    // Ensure drag overlay stays visible for external files
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const isExternalDrag = hasFilesType && !hasCustomType;
    
    if (isExternalDrag && internalDragFlag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    }
    
    const isInternalDrag = hasCustomType || (!hasFilesType && internalDragFlag);
    
    if (hasFilesType && !isInternalDrag && !isDragOver) {
      setIsDragOver(true);
    }
    
    // Set appropriate drop effect based on drag type
    // Block internal drags on the main directory (they should only work on headers)
    if (hasFilesType) {
      e.dataTransfer.dropEffect = 'copy'; // External files are copied/uploaded
    } else if (isInternalDrag) {
      // Block internal drags on main directory - they should only work on headers
      e.dataTransfer.dropEffect = 'none';
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
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const isExternalDrag = hasFilesType && !hasCustomType;
    
    if (isExternalDrag && internalDragFlag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    }
    
    const isInternalDrag = hasCustomType || (!hasFilesType && internalDragFlag);
    
    // Handle external files (from OS file explorer)
    if (hasFilesType && e.dataTransfer.files.length > 0) {
      try {
        const files = Array.from(e.dataTransfer.files).map((f) => {
          const filePath = (f as any).path || f.name; // Fallback to name if path not available
          
          return {
            path: filePath,
            name: f.name
          };
        });
        
        // Validate that we have valid file paths
        const validFiles = files.filter(f => f.path && f.path !== f.name);
        if (validFiles.length === 0) {
          addLog('Failed to upload: No valid file paths found. Please drag files from your file explorer, not from a web browser.', 'error');
          setStatus('Upload failed: Invalid file source', 'error');
          return;
        }
        
        addLog(`Uploading ${validFiles.length} file(s) to current directory`);
        setStatus('Uploading files...', 'info');
        
        const results = await window.electronAPI.moveFiles(validFiles.map(f => f.path), currentDirectory);
        
        // Process results
        const successful = results.filter((r: any) => r.status === 'success').length;
        const failed = results.filter((r: any) => r.status === 'error').length;
        const skipped = results.filter((r: any) => r.status === 'skipped').length;
        
        let message = `Upload complete: ${successful} successful`;
        if (failed > 0) message += `, ${failed} failed`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        
        addLog(message);
        setStatus(message, failed > 0 ? 'error' : 'success');
        
        // Explicitly refresh directory after external file upload to ensure UI updates
        if (successful > 0 || skipped > 0) {
          await refreshDirectory(currentDirectory);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Upload failed: ${errorMessage}`, 'error');
        setStatus('Upload failed', 'error');
      }
    } 
    // Handle internal drags (files dragged within the app)
    else if (isInternalDrag) {
      // Internal drags are handled by individual DraggableFileItem components
      // We don't need to do anything here for internal drags
    }
  }, [currentDirectory, addLog, setStatus, refreshDirectory]);

  // Keyboard shortcuts for cut/copy/paste - OPTIMIZED with useCallback
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
      const isInputFocused = (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
      
      // Check if user has selected text anywhere on the page
      const selection = window.getSelection();
      const hasTextSelection = selection && selection.toString().length > 0;
      
      // Don't interfere with copy/paste if user is in input fields, renaming, or has text selected
      if (isRenaming || isInputFocused || hasTextSelection) return;
      
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
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      // Auto-fit all columns
      e.preventDefault();
      // Note: autoFitColumn function is defined later in the component
      // This shortcut will be functional once the component is fully rendered
      setStatus('Auto-fit shortcut: Double-click column headers or edges to auto-fit', 'info');
    }
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
      if (isRenaming || isInputFocused) return;
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

  const handleGroupHeaderDrop = useCallback(async (e: React.DragEvent, targetIndexKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    clearFolderHoverStates();
    
    // Detect if Ctrl key is pressed for copy operation
    const isCopyOperation = e.ctrlKey;
    console.log('[FileGrid] handleGroupHeaderDrop', { targetIndexKey, isCopyOperation, ctrlKey: e.ctrlKey });
    
    let filePaths: string[] = [];
    
    // Check if this is an external file drag (from OS file explorer)
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const isExternalDrag = hasFilesType && !hasCustomType;
    const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
    
    if (isExternalDrag && internalDragFlag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    }
    
    const isInternalDrag = hasCustomType || (!hasFilesType && internalDragFlag);
    
    if (isExternalDrag && hasExternalFiles) {
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
      
      if (!draggedFiles) {
        return;
      }
      
      try {
        filePaths = JSON.parse(draggedFiles) as string[];
      } catch (error) {
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
        
        toast({
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
      toast({
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
  }, [sortedFiles, currentDirectory, addLog, setStatus, refreshDirectory, toast]);


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
    toast({
      title: 'Image Saved',
      description: `Successfully saved ${filename}`,
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top',
    });
  }, [refreshDirectory, currentDirectory, addLog, setStatus, toast]);

  // Column management state - load from localStorage if available
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('fileGrid_columnWidths');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all columns have widths, use defaults for missing ones
        return {
          name: parsed.name || 400,
          size: parsed.size || 100,
          modified: parsed.modified || 180,
          type: parsed.type || 100
        };
      }
    } catch (e) {
      console.error('Error loading column widths:', e);
    }
    return {
      name: 400,
      size: 100,
      modified: 180,
      type: 100
    };
  });
  
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('fileGrid_columnOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that it's an array with valid column names
        if (Array.isArray(parsed) && parsed.every((col: string) => ['name', 'size', 'modified', 'type'].includes(col))) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading column order:', e);
    }
    return ['name', 'type', 'modified', 'size'];
  });
  
  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('fileGrid_columnVisibility');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure all columns have visibility settings
        return {
          name: parsed.name !== undefined ? parsed.name : true,
          size: parsed.size !== undefined ? parsed.size : true,
          modified: parsed.modified !== undefined ? parsed.modified : true,
          type: parsed.type !== undefined ? parsed.type : true
        };
      }
    } catch (e) {
      console.error('Error loading column visibility:', e);
    }
    return {
      name: true,
      size: true,
      modified: true,
      type: true
    };
  });
  const [headerContextMenu, setHeaderContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });
  
  // Filter columnOrder based on visibility
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => columnVisibility[col as keyof typeof columnVisibility]);
  }, [columnOrder, columnVisibility]);
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
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

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
  
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const now = Date.now();
    if (now - lastResizeTimeRef.current >= RESIZE_THROTTLE_MS) {
      const deltaX = e.clientX - dragStartX;
      setColumnWidths(prev => {
        const newWidth = Math.max(50, prev[resizingColumn as keyof typeof prev] + deltaX);
        return {
          ...prev,
          [resizingColumn]: newWidth
        };
      });
      setDragStartX(e.clientX);
      lastResizeTimeRef.current = now;
    } else {
      // Throttle resize updates
      if (resizeThrottleRef.current) {
        clearTimeout(resizeThrottleRef.current);
      }
      resizeThrottleRef.current = setTimeout(() => {
        const deltaX = e.clientX - dragStartX;
        setColumnWidths(prev => {
          const newWidth = Math.max(50, prev[resizingColumn as keyof typeof prev] + deltaX);
          return {
            ...prev,
            [resizingColumn]: newWidth
          };
        });
        setDragStartX(e.clientX);
        lastResizeTimeRef.current = Date.now();
      }, RESIZE_THROTTLE_MS - (now - lastResizeTimeRef.current));
    }
  }, [resizingColumn, dragStartX]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
    
    // Clear any pending throttled resize
    if (resizeThrottleRef.current) {
      clearTimeout(resizeThrottleRef.current);
      resizeThrottleRef.current = null;
    }
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Mark that we're resizing to prevent sorting
    setResizingColumn(column);
    setDragStartX(e.clientX);
    
    // Add global mouse event listeners for resize
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
    ['name', 'size', 'modified', 'type'].forEach(col => autoFitColumn(col));
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
  
  // Save column widths to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('fileGrid_columnWidths', JSON.stringify(columnWidths));
    } catch (e) {
      console.error('Error saving column widths:', e);
    }
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

  // Column resize event listeners
  useEffect(() => {
    if (resizingColumn) {
      const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // Lazy icon loading with Intersection Observer
  const iconLoadingRef = useRef(false);
  const loadingQueue = useRef<Set<string>>(new Set());
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  
  // Create intersection observer for lazy loading icons
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon) return;
    
    // Create intersection observer with appropriate options
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const filePath = entry.target.getAttribute('data-file-path');
            if (filePath && !nativeIcons.has(filePath) && !loadingQueue.current.has(filePath)) {
              loadIconForFile(filePath);
            }
          }
        });
      },
      {
        root: dropAreaRef.current,
        rootMargin: '100px', // Start loading icons 100px before they come into view
        threshold: 0.1
      }
    );
    
    intersectionObserverRef.current = observer;
    
    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
        intersectionObserverRef.current = null;
      }
      // Clear loading queue on unmount
      loadingQueue.current.clear();
    };
  }, []);
  
  // Function to load icon for a specific file
  const loadIconForFile = useCallback(async (filePath: string) => {
    if (loadingQueue.current.has(filePath) || nativeIcons.has(filePath)) return;
    
    loadingQueue.current.add(filePath);
    
    try {
      const iconData = await window.electronAPI.getFileIcon(filePath);
      if (iconData) {
        setNativeIcons(prev => {
          // Double-check we don't already have this icon (avoid race conditions)
          if (prev.has(filePath)) return prev;
          const newMap = new Map(prev);
          newMap.set(filePath, iconData);
          return newMap;
        });
      }
    } catch (error) {
      // Don't retry failed icons immediately - they'll be retried on next view
    } finally {
      loadingQueue.current.delete(filePath);
    }
  }, [nativeIcons]);
  
  // Observe file elements when they mount/unmount
  const observeFileElement = useCallback((element: HTMLElement | null, filePath: string) => {
    if (!intersectionObserverRef.current) return;
    
    if (element) {
      element.setAttribute('data-file-path', filePath);
      intersectionObserverRef.current.observe(element);
    }
  }, []);
  
  const unobserveFileElement = useCallback((element: HTMLElement | null) => {
    if (!intersectionObserverRef.current || !element) return;
    intersectionObserverRef.current.unobserve(element);
  }, []);
  
  // Load icons for initially visible files (first batch)
  useEffect(() => {
    if (!window.electronAPI?.getFileIcon || iconLoadingRef.current) return;
    
    const loadInitialIcons = async () => {
      iconLoadingRef.current = true;
      
      try {
        // Load icons for the first visible files (approximately first screen)
        const initialFiles = sortedFiles
          .filter(file => file.type === 'file' && !nativeIcons.has(file.path))
          .slice(0, 20); // Load first 20 files immediately
        
        if (initialFiles.length === 0) return;
        
        // Process in smaller batches to avoid blocking
        const batchSize = 5;
        for (let i = 0; i < initialFiles.length; i += batchSize) {
          const batch = initialFiles.slice(i, i + batchSize);
          
          // Process batch in parallel
          await Promise.allSettled(
            batch.map(file => loadIconForFile(file.path))
          );
          
          // Small delay between batches
          if (i + batchSize < initialFiles.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
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
  }, [hideTemporaryFiles, hideDotFiles, currentDirectory, refreshDirectory]);

  // Load file grid background image settings
  useEffect(() => {
    const loadBackgroundSetting = async () => {
      try {
        console.log('FileGrid: Loading background settings...');
        const settings = await settingsService.getSettings();
        console.log('FileGrid: Loaded settings:', {
          backgroundType: settings.backgroundType,
          fileGridBackgroundPath: settings.fileGridBackgroundPath,
          backgroundFillPath: settings.backgroundFillPath
        });

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
          console.log('FileGrid: Loaded watermark URL:', watermarkUrl.substring(0, 50) + '...');
          setFileGridBackgroundUrl(watermarkUrl);
        } else {
          console.log('FileGrid: No watermark path, clearing URL');
          setFileGridBackgroundUrl('');
        }
        
        // Load background fill URL
        if (fillPath) {
          const fillUrl = await loadImageUrl(fillPath);
          console.log('FileGrid: Loaded background fill URL:', fillUrl.substring(0, 50) + '...');
          setBackgroundFillUrl(fillUrl);
        } else {
          console.log('FileGrid: No fill path, clearing URL');
          setBackgroundFillUrl('');
        }
      } catch (error) {
        console.error('Error loading file grid background setting:', error);
      }
    };
    loadBackgroundSetting();

    // Listen for settings updates
    const handleSettingsUpdate = (event?: any) => {
      console.log('FileGrid received settings-updated event', event?.detail);
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

  // Memoized expensive computations to prevent recalculation on every render
  const memoizedFileStates = useMemo(() => {
    // Pre-compute clipboard file paths Set for O(1) lookup
    const clipboardFilePathsSet = clipboard.operation === 'cut' 
      ? new Set(clipboard.files.map(f => f.path))
      : new Set();
    
    return sortedFiles.map((file, index) => ({
      isFileSelected: selectedFilesSet.has(file.name),
      isRowHovered: hoveredRowIndex === index,
      isFileCut: clipboardFilePathsSet.has(file.path),
      isFileNew: recentlyTransferredFilesSet.set.has(file.path) || recentlyTransferredFilesSet.normalizedSet.has(file.path.replace(/\\/g, '/')),
      isFileDragged: draggedFiles.has(file.name)
    }));
  }, [sortedFiles, selectedFilesSet, hoveredRowIndex, clipboard, recentlyTransferredFilesSet, draggedFiles]);

  // Memoized row background calculations
  const memoizedRowBackgrounds = useMemo(() => {
    const hasActiveSearch = fileSearchFilter && fileSearchFilter.trim();
    
    return memoizedFileStates.map((fileState, index) => {
      const file = sortedFiles[index];
      
      // Highlight first item when search filter is active
      const isSearchHighlight = hasActiveSearch && index === 0;
      
      const rowBg = fileState.isFileSelected 
        ? rowSelectedBg
        : (fileState.isRowHovered ? rowHoverBg : (isSearchHighlight ? searchHighlightBg : 'transparent'));
      
      const folderDropBg = file.type === 'folder' && folderHoverState.has(file.path) 
        ? folderDropBgColor
        : undefined;
      
      return folderDropBg || rowBg;
    });
  }, [memoizedFileStates, sortedFiles, rowSelectedBg, rowHoverBg, folderHoverState, folderDropBgColor, fileSearchFilter, searchHighlightBg]);

  // Optimized handler factories for row components
  const createRowHandlers = useCallback((file: FileItem, index: number) => ({
    onMouseEnter: () => handleRowMouseEnter(index),
    onMouseLeave: (e: React.MouseEvent) => handleRowMouseLeave(index, e),
    onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, file),
    onClick: (e: React.MouseEvent) => handleFileItemClick(file, index, e),
    onMouseDown: (e: React.MouseEvent) => handleFileItemMouseDown?.(file, index, e),
    onMouseUp: (e: React.MouseEvent) => handleFileItemMouseUp?.(file, index, e),
    draggable: file.type !== 'folder', // Only make files draggable, folders receive drops
    onDragStart: (e: React.DragEvent) => {
      // Optimized: Use Map for O(1) lookups instead of find()
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
      try { delete (window as any).__docuframeInternalDrag; } catch {}
      addLog('Drag operation ended');
    }
  }), [handleRowMouseEnter, handleRowMouseLeave, handleContextMenu, handleFileItemClick, handleFileItemMouseDown, handleFileItemMouseUp, selectedFiles, selectedFilesSet, fileNameToPathMap, handleFileItemDragStart, setIsDragStarted, setDraggedFiles, clearFolderHoverStates, addLog]);

  // Optimized folder drop handlers factory
  const createFolderDropHandlers = useCallback((file: FileItem, index: number) => {
    if (file.type !== 'folder') return {};
    
    return {
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
        
        if (hasExternalFiles) {
          e.dataTransfer.dropEffect = 'copy';
        } else if (isInternalDrag) {
          e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
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
        const isInternal = isInternalDrag || !!((window as any).__docuframeInternalDrag?.files?.length);
        
        if (isInternal) {
          try {
            let filesToTransfer: string[] = [];
            const draggedFilesData = e.dataTransfer.getData('application/x-docuframe-files');
            if (draggedFilesData) {
              filesToTransfer = JSON.parse(draggedFilesData) as string[];
            } else if ((window as any).__docuframeInternalDrag?.files) {
              filesToTransfer = (window as any).__docuframeInternalDrag.files as string[];
            } else {
              return;
            }
            
            const targetFolderPath = file.path.replace(/\\/g, '/');
            const isSameFolder = filesToTransfer.some(path => {
              const sourceFolder = path.substring(0, path.lastIndexOf('/')).replace(/\\/g, '/');
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
              // Clear folder hover state after successful drop
              clearFolderHoverStates();
              await refreshDirectory(currentDirectory);
              
              if (operation === 'move') {
                setSelectedFiles([]);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            addLog(`${e.ctrlKey ? 'Copy' : 'Move'} operation failed: ${errorMessage}`, 'error');
            setDraggedFiles(new Set());
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
  }, [handleFolderDragEnter, handleFolderDragLeave, addLog, setStatus, refreshDirectory, currentDirectory, setDraggedFiles, setSelectedFiles, clearFolderHoverStates]);

  // Memoized cell styles
  const cellStyles = useMemo(() => ({
    transition: "background 0.1s",
    cursor: "default",
    px: 2,
    py: 2,
    position: "relative" as const,
    verticalAlign: "middle" as const,
    pointerEvents: 'auto' as const,
  }), []);

  // Drag selection handlers
  const handleSelectionMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start selection if clicking on empty space (not on file rows, headers, or interactive elements)
    const target = e.target as HTMLElement;
    const isClickOnRow = target.closest('[data-row-index]');
    const isClickOnHeader = target.closest('[data-column]');
    const isClickOnInteractive = target.closest('button, input, a, [role="button"]');
    
    if (!isClickOnRow && !isClickOnHeader && !isClickOnInteractive && e.button === 0) {
      e.preventDefault();
      const container = gridContainerRef.current || dropAreaRef.current;
      if (!container) return;
      
      // Get container padding-left to account for offset
      if (containerPaddingLeftRef.current === 0) {
        const computedStyle = window.getComputedStyle(container);
        containerPaddingLeftRef.current = parseFloat(computedStyle.paddingLeft) || 0;
      }
      
      const rect = container.getBoundingClientRect();
      const startX = e.clientX - rect.left - containerPaddingLeftRef.current;
      const startY = e.clientY - rect.top + container.scrollTop;
      
      setIsSelecting(true);
      setSelectionRect({
        startX,
        startY,
        currentX: startX,
        currentY: startY,
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
  }, []);

  const handleSelectionMouseUp = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionRect(null);
    }
  }, [isSelecting]);

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
  useEffect(() => {
    if (isSelecting) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const container = gridContainerRef.current || dropAreaRef.current;
        if (!container || !selectionRect) return;
        
        // Get container padding-left if not cached
        if (containerPaddingLeftRef.current === 0) {
          const computedStyle = window.getComputedStyle(container);
          containerPaddingLeftRef.current = parseFloat(computedStyle.paddingLeft) || 0;
        }
        
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left - containerPaddingLeftRef.current;
        const currentY = e.clientY - rect.top + container.scrollTop;
        
        setSelectionRect({
          ...selectionRect,
          currentX,
          currentY,
        });
        
        // Detect intersecting files
        const selectionBox = {
          left: Math.min(selectionRect.startX, currentX),
          top: Math.min(selectionRect.startY, currentY),
          right: Math.max(selectionRect.startX, currentX),
          bottom: Math.max(selectionRect.startY, currentY),
        };
        
        const intersectingFiles: string[] = [];
        const rows = container.querySelectorAll('[data-row-index]');
        
        rows.forEach((row) => {
          const rowRect = row.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
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
        });
        
        // Update selection - preserve existing selection if Shift/Ctrl was held when starting
        if (selectionModifiersRef.current.shiftKey || selectionModifiersRef.current.ctrlKey) {
          // Add to existing selection
          setSelectedFiles(prev => {
            const newSet = new Set(prev);
            intersectingFiles.forEach(name => newSet.add(name));
            return Array.from(newSet);
          });
        } else {
          // Replace selection
          setSelectedFiles(intersectingFiles);
        }
      };
      
      const handleGlobalMouseUp = () => {
        if (selectionRect) {
          const hasMoved = Math.abs(selectionRect.currentX - selectionRect.startX) > 5 ||
                          Math.abs(selectionRect.currentY - selectionRect.startY) > 5;
          if (hasMoved) {
            justFinishedSelectingRef.current = true;
            setTimeout(() => {
              justFinishedSelectingRef.current = false;
            }, 100);
          }
        }
        setIsSelecting(false);
        setSelectionRect(null);
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isSelecting, selectionRect, sortedFiles]);

  
  return (
    <Box 
      p={0} 
      m={0} 
      height="100%" 
      position="relative"
      style={{ 
        filter: isJumpModeActive ? 'blur(2px)' : 'none',
        transition: 'filter 0.2s ease-in-out'
      }}
    >
      <FileListView
        dropAreaRef={dropAreaRef}
        gridContainerRef={gridContainerRef}
        renameInputRef={renameInputRef}
        isDragOver={isDragOver}
        isSelecting={isSelecting}
        selectionRect={selectionRect}
        isGroupedByIndex={isGroupedByIndex}
        groupedFiles={groupedFiles}
        sortedFiles={sortedFiles}
        columnOrder={columnOrder}
        columnVisibility={columnVisibility}
        columnWidths={columnWidths}
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
        nativeIcons={nativeIcons}
        memoizedFileStates={memoizedFileStates}
        memoizedRowBackgrounds={memoizedRowBackgrounds}
        tableHeadTextColor={tableHeadTextColor}
        headerHoverBg={headerHoverBg}
        headerStickyBg={headerStickyBg}
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
        createRowHandlers={createRowHandlers}
        createFolderDropHandlers={createFolderDropHandlers}
        observeFileElement={observeFileElement}
        unobserveFileElement={unobserveFileElement}
        formatFileSize={formatFileSize}
        formatDate={formatDate}
        handleRenameSubmit={handleRenameSubmit}
        setIsRenaming={setIsRenaming}
        setRenameValue={setRenameValue}
        setFileGridBackgroundUrl={setFileGridBackgroundUrl}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setSelectedFile={setSelectedFile}
        clearFolderHoverStates={clearFolderHoverStates}
        cellStyles={cellStyles}
      />
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
        setTemplates={setTemplates}
        setTemplateSubmenuPosition={setTemplateSubmenuPosition}
        setTemplateSubmenuOpen={setTemplateSubmenuOpen}
        setMoveToFiles={setMoveToFiles}
        setIsJumpModeActive={setIsJumpModeActive}
        setIsMoveToDialogOpen={setIsMoveToDialogOpen}
      />
      <BlankContextMenu 
        blankContextMenu={blankContextMenu}
        clipboard={clipboard}
        handlePaste={handlePaste}
        setBlankContextMenu={setBlankContextMenu}
        onPasteImage={() => setImagePasteOpen(true)}
      />
      {contextMenu.fileItem?.type === 'folder' && (
        <TemplateSubmenu
          isOpen={templateSubmenuOpen}
          position={templateSubmenuPosition}
          templates={templates}
          folderPath={contextMenu.fileItem.path}
          onClose={() => {
            setTemplateSubmenuOpen(false);
            setTemplateSubmenuPosition(null);
          }}
          onCreateFromTemplate={async (templatePath: string, templateName: string) => {
            try {
              const fileName = templateName.replace('.xlsx', '');
              const destPath = `${contextMenu.fileItem!.path}\\${fileName}.xlsx`;
              
              await (window.electronAPI as any).copyWorkpaperTemplate(templatePath, destPath);
              
              addLog(`Created ${fileName}.xlsx from template in ${contextMenu.fileItem!.name}`);
              setStatus(`Created ${fileName}.xlsx from template`, 'success');
              
              if (contextMenu.fileItem!.path === currentDirectory) {
                const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
                setFolderItems(contents);
              }
            } catch (error) {
              console.error('Error creating from template:', error);
              addLog(`Failed to create from template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('Failed to create from template', 'error');
            }
          }}
        />
      )}
      {/* Header Column Visibility Menu */}
      <HeaderContextMenu
        headerContextMenu={headerContextMenu}
        columnVisibility={columnVisibility}
        toggleColumnVisibility={toggleColumnVisibility}
        closeHeaderContextMenu={closeHeaderContextMenu}
      />
      <MergePDFDialog 
        isOpen={isMergePDFOpen} 
        onClose={() => setMergePDFOpen(false)} 
        currentDirectory={currentDirectory}
        preselectedFiles={selectedFiles.filter(filename => filename.toLowerCase().endsWith('.pdf'))}
      />
      <ExtractedTextDialog
        isOpen={isExtractedTextOpen}
        onClose={() => setExtractedTextOpen(false)}
        fileName={extractedTextData.fileName}
        extractedText={extractedTextData.text}
      />
      <CustomPropertiesDialog
        isOpen={isPropertiesOpen}
        onClose={() => setPropertiesOpen(false)}
        file={propertiesFile}
        onUnblock={handleUnblockFile}
      />
      <ImagePasteDialog
        isOpen={isImagePasteOpen}
        onClose={() => setImagePasteOpen(false)}
        currentDirectory={currentDirectory}
        onImageSaved={handleImageSaved}
      />
      
      {/* Index Prefix Dialogs */}
      <IndexPrefixDialog
        isOpen={isIndexPrefixDialogOpen}
        onClose={() => {
          setIsIndexPrefixDialogOpen(false);
          setPrefixDialogFiles([]);
        }}
        onSelect={handleAssignPrefix}
        currentPrefix={prefixDialogFiles.length > 0 ? extractIndexPrefix(prefixDialogFiles[0].name) : null}
        files={prefixDialogFiles}
        title="Manage Index Prefix"
        allowCopy={true}
      />
      {/* Move To Dialog with FolderNavigation */}
      {isMoveToDialogOpen && moveToFiles.length > 0 && (
        <MoveToDialogWrapper
          onClose={() => {
            setIsMoveToDialogOpen(false);
            setMoveToFiles([]);
          }}
          moveToFiles={moveToFiles}
          currentDirectory={currentDirectory}
          onSelectFolder={async (destPath: string) => {
            try {
              setStatus(`Moving ${moveToFiles.length} file(s)...`, 'info');
              const results = await window.electronAPI.moveFilesWithConflictResolution(
                moveToFiles.map(f => f.path),
                destPath
              );
              const successful = results.filter(r => r.status === 'success').length;
              if (successful > 0) {
                setStatus(`Moved ${successful} file(s)`, 'success');
                await refreshDirectory(currentDirectory);
              }
              setIsMoveToDialogOpen(false);
              setMoveToFiles([]);
            } catch (error) {
              addLog(`Failed to move files: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
              setStatus('Failed to move files', 'error');
            }
          }}
          refreshDirectory={refreshDirectory}
          setStatus={setStatus}
          addLog={addLog}
        />
      )}
      <RenameIndexDialog
        isOpen={isRenameIndexDialogOpen}
        onClose={() => setIsRenameIndexDialogOpen(false)}
        onConfirm={handleRenameIndex}
        files={selectedFiles.length > 1 && contextMenu.fileItem && selectedFilesSet.has(contextMenu.fileItem.name)
          ? sortedFiles.filter(f => selectedFilesSet.has(f.name) && f.type === 'file')
          : contextMenu.fileItem && contextMenu.fileItem.type === 'file'
            ? [contextMenu.fileItem]
            : []}
      />
      {smartRenameFile && (
        <SmartRenameDialog
          isOpen={isSmartRenameDialogOpen}
          onClose={() => {
            setIsSmartRenameDialogOpen(false);
            setSmartRenameFile(null);
          }}
          onConfirm={handleSmartRenameConfirm}
          file={smartRenameFile}
          existingFiles={sortedFiles}
        />
      )}

      {/* JumpModeOverlay moved to main app level */}
    </Box>
  )
}