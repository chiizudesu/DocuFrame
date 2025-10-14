import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Grid,
  Box,
  Text,
  Icon,
  Flex,
  Input,
  Image,
  Divider,
  useToast,
} from '@chakra-ui/react'
import {
  FolderOpen,
  FileText,
  Trash2,
  Edit2,
  ExternalLink,
  Copy,
  Scissors,
  FileSymlink,
  ChevronUp,
  ChevronDown,
  FilePlus2,
  Archive,
  Mail,
  Upload,
  Info,
  Image as ImageIcon,
  Star,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, isAbsolutePath, normalizePath } from '../utils/path'
import { MergePDFDialog } from './MergePDFDialog'
import { ExtractedTextDialog } from './ExtractedTextDialog'
import { DraggableFileItem } from './DraggableFileItem'
import { useColorModeValue } from '@chakra-ui/react'
import type { FileItem } from '../types'
import { CustomPropertiesDialog, FileProperties } from './CustomPropertiesDialog';
import { ImagePasteDialog } from './ImagePasteDialog';

// Sort types for list view
type SortColumn = 'name' | 'size' | 'modified'
type SortDirection = 'asc' | 'desc'

// Utility to format paths for logging (Windows vs others)
function formatPathForLog(path: string) {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  return isWindows ? path.replace(/\//g, '\\') : path;
}

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
  } = useAppContext()

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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('fileViewMode') as 'grid' | 'list') || 'grid',
  )
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

  // State to store native icons for files
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  
  // Smart selection states for handling drag vs click on multi-selected files
  const [pendingSelectionChange, setPendingSelectionChange] = useState<{ fileName: string; index: number } | null>(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<Set<string>>(new Set());

  // Track which row is hovered to highlight the entire row in list view
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  // Optimized hover handlers with debouncing to prevent excessive state updates
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleRowMouseEnter = useCallback((index: number) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Only update if different
    if (hoveredRowIndex !== index) {
      setHoveredRowIndex(index);
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
  const dragGhostBg = useColorModeValue('gray.50', 'gray.900')
  const dragGhostBorder = useColorModeValue('gray.300', 'gray.700')
  const dragGhostAccent = useColorModeValue('blue.400', 'blue.300')

  // Memoize sorted files computation for better performance
  const sortedFiles = useMemo(() => {
    if (!Array.isArray(folderItems) || folderItems.length === 0) return [];
    
    // Early return for single item or no sorting needed
    if (folderItems.length === 1) return folderItems;
    
    // Create a stable sort with optimized comparison functions
    const items = [...folderItems];
    
    // Pre-compute sort values to avoid repeated calculations
    const sortData = items.map((item, index) => ({
      item,
      index,
      nameValue: item.name.toLowerCase(), // Use lowercase for consistent sorting
      sizeValue: typeof item.size === 'string' ? parseFloat(item.size) || 0 : 0,
      modifiedValue: item.modified ? new Date(item.modified).getTime() : 0
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
      }
      return 0;
    });
    
    return sortData.map(data => data.item);
  }, [folderItems, sortColumn, sortDirection]);

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
        console.error('Failed to load directory:', error)
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
          console.error(msg);
          return;
        }
        (window.electronAPI as any).openFile(file.path);
        addLog(`Opened file: ${file.name}`);
        setStatus(`Opened file: ${file.name}`, 'success');
      } catch (error: any) {
        addLog(`Failed to open file: ${file.name} (${file.path})\n${error?.message || error}`,'error');
        setStatus(`Failed to open: ${file.name}`, 'error');
        console.error('Failed to open file:', file.path, error);
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
    if (!selectedFiles.includes(file.name)) {
      setSelectedFiles([file.name]);
      setSelectedFile(file.name);
    }
    
    const position = getSmartMenuPosition(e.clientX, e.clientY, 300);
    
    setContextMenu({
      isOpen: true,
      position,
      fileItem: file,
    })
  }, [selectedFiles]);

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
        console.error(msg);
        return;
      }
      
      const confirmed = await (window.electronAPI as any).confirmDelete(filesToDelete)
      if (!confirmed) return
      
      const files = Array.isArray(fileOrFiles) ? fileOrFiles : filesToDelete.map(name => sortedFiles.find(f => f.name === name)).filter(Boolean) as FileItem[]
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
          console.error('Failed to delete:', f.name, error);
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
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      {
        const files = Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : contents);
        const filtered = filterFiles(files);
        setFolderItems(filtered as any)
      }
      setSelectedFiles([])
      
    } catch (error: any) {
      const errorMessage = error?.message || error;
      addLog(`Delete operation failed: ${errorMessage}`, 'error');
      setStatus('Delete operation failed', 'error');
      console.error('Delete operation failed:', error);
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
          if (selectedFiles.length > 1 && selectedFiles.includes(contextMenu.fileItem.name)) {
            setStatus(`Deleting ${selectedFiles.length} files...`, 'info')
            await handleDeleteFile(sortedFiles.filter(f => selectedFiles.includes(f.name)))
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
        default:
          addLog(`Function: ${action} on ${contextMenu.fileItem.name}`)
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error)
      addLog(`Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }

    handleCloseContextMenu()
  }, [contextMenu.fileItem, selectedFiles, sortedFiles, currentDirectory, addLog, setStatus, addTabToCurrentWindow, setIsRenaming, setRenameValue, handleDeleteFile, setExtractedTextData, setExtractedTextOpen, setMergePDFOpen, hideTemporaryFiles, setFolderItems, handleOpenOrNavigate, handleCloseContextMenu, addQuickAccessPath, removeQuickAccessPath])

  const handleRenameSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isRenaming) return
    if (!renameValue || renameValue === isRenaming) {
      setIsRenaming(null)
      setRenameValue('')
      return
    }
    try {
      const oldPath = isAbsolutePath(isRenaming) ? isRenaming : joinPath(currentDirectory === '/' ? '' : currentDirectory, isRenaming)
      const newPath = isAbsolutePath(renameValue) ? renameValue : joinPath(currentDirectory === '/' ? '' : currentDirectory, renameValue)
      await (window.electronAPI as any).renameItem(oldPath, newPath)
      addLog(`Renamed ${isRenaming} to ${renameValue}`)
      
      // Show toast notification for successful rename operations
      
      
      setIsRenaming(null)
      setRenameValue('')
      // Use the existing folder refresh system
      // loadDirectory(currentDirectory) // Removed to fix dependency order
    } catch (error) {
      console.error('Error renaming:', error)
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
  }, [isRenaming, renameValue, currentDirectory, addLog, setStatus])

  useEffect(() => {
    const handleViewModeChange = (e: CustomEvent) => {
      setViewMode(e.detail as 'grid' | 'list')
    }
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
      console.log('[FileGrid] Folder contents changed event received:', data);
      if (data && data.directory === currentDirectory) {
        console.log('[FileGrid] Refreshing current directory:', currentDirectory);
        
        // Handle file watcher events (new files detected)
        if (data.event === 'add' && data.filePath) {
          addRecentlyTransferredFiles([data.filePath]);
          
          // Set timeout to remove the "new" indicator (15 seconds)
          setTimeout(() => {
            removeRecentlyTransferredFile(data.filePath!);
          }, 15000); // 15 seconds
        }
        
        // Handle transfer events (existing functionality)
        if (data.newFiles && data.newFiles.length > 0) {
          console.log('[FileGrid] Adding new files to recently transferred list:', data.newFiles);
          addRecentlyTransferredFiles(data.newFiles);
          
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

    window.addEventListener(
      'viewModeChanged',
      handleViewModeChange as EventListener,
    )
    
    // Listen for IPC events through the properly exposed API
    if ((window.electronAPI as any).onFolderContentsChanged) {
      (window.electronAPI as any).onFolderContentsChanged(handleFolderContentsChanged);
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener(
        'viewModeChanged',
        handleViewModeChange as EventListener,
      )
      
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
      console.error('Failed to load directory:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to load directory: ${errorMessage}`, 'error');
      setStatus(`Failed to load directory: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [setFolderItems, addLog, filterFiles, setStatus]);

  // Separate refresh function that doesn't show loading state (for background refreshes)
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
      console.error('Failed to refresh directory:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Failed to refresh directory: ${errorMessage}`, 'error');
    }
  }, [setFolderItems, addLog, filterFiles]);

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
      // Ctrl+click: Toggle selection
      if (selectedFiles.includes(file.name)) {
        // Remove from selection
        const newSelection = selectedFiles.filter(name => name !== file.name);
        setSelectedFiles(newSelection);
        setSelectedFile(newSelection.length > 0 ? newSelection[newSelection.length - 1] : null);
        if (newSelection.length === 0) {
          setLastSelectedIndex(null);
        }
      } else {
        // Add to selection
        const newSelection = [...selectedFiles, file.name];
        setSelectedFiles(newSelection);
        setSelectedFile(file.name);
        setLastSelectedIndex(index);
      }
    } else if (selectedFiles.includes(file.name) && selectedFiles.length > 1) {
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
    const filesToDrag: string[] = Array.isArray(selectedFiles) && selectedFiles.length > 0 && sortedFiles
      ? selectedFiles.map(name => {
          const selectedFile = sortedFiles.find(f => f.name === name);
          return selectedFile ? selectedFile.path : null;
        }).filter((path): path is string => path !== null)
      : [file.path];
    
    // Mark this as an internal drag globally and attach JSON payload
    try { (window as any).__docuframeInternalDrag = { files: filesToDrag }; } catch {}
    event.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(filesToDrag));
    event.dataTransfer.effectAllowed = 'copyMove';
    
    if (window.electron && typeof window.electron.startDrag === 'function') {
      // Pass all files for multi-file drag - startDrag accepts string | string[]
      window.electron.startDrag(filesToDrag as any);
      addLog(`Started native drag for ${filesToDrag.length} file(s)`);
    } else {
      addLog('Native drag not available', 'error');
    }
    
    // Immediately hide the dragged files for snappy UX
    const filesToHide = selectedFiles.length > 0 && selectedFiles.includes(file.name)
      ? selectedFiles
      : [file.name];
    
    setDraggedFiles(new Set(filesToHide));
  }, [selectedFiles, sortedFiles, addLog]);

  // Add this function for selection on click - OPTIMIZED with useCallback
  const handleFileItemClick = useCallback((file: FileItem, index: number, event?: React.MouseEvent) => {
    const now = Date.now();
    // Only handle double-click logic if already selected
    if (selectedFiles.includes(file.name)) {
      if (lastClickedFile === file.name && now - lastClickTime < 500) {
        (async () => {
          clearTimeout(clickTimer as NodeJS.Timeout);
          setLastClickTime(0);
          setClickTimer(null);
          setLastClickedFile(null);
          const selectedFileObjs = sortedFiles.filter(f => selectedFiles.includes(f.name));
          if (selectedFileObjs.every(f => f.type !== 'folder')) {
            for (const f of selectedFileObjs) await handleOpenOrNavigate(f);
          } else if (selectedFileObjs.length === 1 && selectedFileObjs[0].type === 'folder') {
            handleOpenOrNavigate(selectedFileObjs[0]);
          }
        })();
      } else {
        setLastClickTime(now);
        setLastClickedFile(file.name);
        if (clickTimer) clearTimeout(clickTimer);
      }
    }
  }, [selectedFiles, lastClickedFile, lastClickTime, clickTimer, sortedFiles]);

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
        const selectedFileObjs = sortedFiles.filter(f => selectedFiles.includes(f.name))
        if (selectedFileObjs.length === 1) {
          handleOpenOrNavigate(selectedFileObjs[0])
        } else if (selectedFileObjs.length > 1 && selectedFileObjs.every(f => f.type !== 'folder')) {
          for (const f of selectedFileObjs) handleOpenOrNavigate(f)
        }
      } else if (e.key === 'Enter' && selectedFiles.length === 0) {
        // Prevent Enter from doing anything when no files are selected
        // This prevents unwanted behavior after navigation
        console.log('[FileGrid] Enter pressed with no files selected, preventing default');
        e.preventDefault();
        return;
      } else if (e.key === 'Delete' && selectedFiles.length > 0) {
        const selectedFileObjs = sortedFiles.filter(f => selectedFiles.includes(f.name))
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
        console.error('[FileGrid] Error starting file watcher:', error);
      }
    };

    const stopWatching = async () => {
      try {
        if (currentDirectory && isWatching) {
          await (window.electronAPI as any).stopWatchingDirectory(currentDirectory);
          isWatching = false;
        }
      } catch (error) {
        console.error('[FileGrid] Error stopping file watcher:', error);
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
    
    // Debug drag enter
    console.log('=== DRAG ENTER DEBUG ===');
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer items.length:', e.dataTransfer.items.length);
    console.log('DataTransfer effectAllowed:', e.dataTransfer.effectAllowed);
    
    // Check for external files (from OS file explorer) - NOT internal drags
    const hasExternalFiles = e.dataTransfer.types.includes('Files');
    const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
    
    console.log('Has external Files type:', hasExternalFiles);
    console.log('Is internal drag:', isInternalDrag);
    
    // Only show upload overlay for external files, not internal drags
    if (hasExternalFiles && !isInternalDrag) {
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
    
    // Clear any pending drag leave timeout to keep the overlay visible
    if (dragLeaveTimeoutRef.current) {
      clearTimeout(dragLeaveTimeoutRef.current);
      dragLeaveTimeoutRef.current = null;
    }
    
    // Ensure drag overlay stays visible for external files
    const hasExternalFiles = e.dataTransfer.types.includes('Files');
    const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
    
    if (hasExternalFiles && !isInternalDrag && !isDragOver) {
      setIsDragOver(true);
    }
    
    // Set appropriate drop effect based on drag type
    if (hasExternalFiles) {
      e.dataTransfer.dropEffect = 'copy'; // External files are copied/uploaded
    } else if (isInternalDrag) {
      // For internal drags, respect the modifier keys
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
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

    // Debug: Log all available data transfer info
    console.log('=== DROP EVENT DEBUG ===');
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer files.length:', e.dataTransfer.files.length);
    console.log('DataTransfer items.length:', e.dataTransfer.items.length);
    console.log('DataTransfer effectAllowed:', e.dataTransfer.effectAllowed);
    console.log('Files array:', Array.from(e.dataTransfer.files));
    
    // Check what type of drag this is
    const hasExternalFiles = e.dataTransfer.types.includes('Files');
    const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
    
    console.log('Has external Files type:', hasExternalFiles);
    console.log('Is internal drag:', isInternalDrag);
    
    // Log each file's properties
    Array.from(e.dataTransfer.files).forEach((file, index) => {
      console.log(`File ${index}:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        path: (file as any).path, // Electron-specific path property
        webkitRelativePath: file.webkitRelativePath
      });
    });

    // Handle external files (from OS file explorer)
    if (hasExternalFiles && e.dataTransfer.files.length > 0) {
      try {
        const files = Array.from(e.dataTransfer.files).map((f, index) => {
          const filePath = (f as any).path || f.name; // Fallback to name if path not available
          console.log(`Processing file ${index}: ${f.name}, path: ${filePath}`);
          
          return {
            path: filePath,
            name: f.name
          };
        });
        
        // Validate that we have valid file paths
        const validFiles = files.filter(f => f.path && f.path !== f.name);
        if (validFiles.length === 0) {
          console.error('No valid file paths found. This might be a web browser drag, not OS drag.');
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
        
        // Folder refresh is now handled automatically by the backend folderContentsChanged event
        
      } catch (error) {
        console.error('Upload failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addLog(`Upload failed: ${errorMessage}`, 'error');
        setStatus('Upload failed', 'error');
      }
    } 
    // Handle internal drags (files dragged within the app)
    else if (isInternalDrag) {
      console.log('This is an internal drag operation - ignoring at grid level');
      // Internal drags are handled by individual DraggableFileItem components
      // We don't need to do anything here for internal drags
    }
    else {
      console.log('Unknown drag type or no valid data');
    }
  }, [currentDirectory, addLog, setStatus]);

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
        setClipboard({ files: sortedFiles.filter(f => selectedFiles.includes(f.name)), operation: 'cut' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedFiles.length > 0) {
        // Copy files
        e.preventDefault();
        setClipboard({ files: sortedFiles.filter(f => selectedFiles.includes(f.name)), operation: 'copy' });
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
        let headerOffset = 0;
        if (viewMode === 'list') {
          const headerCell = container.querySelector('[data-column]') as HTMLElement | null;
          const headerHeight = headerCell ? headerCell.getBoundingClientRect().height : 30;
          // Try to detect a typical row height in list view
          const anyRow = container.querySelector('[data-row-index]') as HTMLElement | null;
          const rowHeight = anyRow ? anyRow.getBoundingClientRect().height : 30;
          // Offset by header height + one full row so the selected item appears fully below the header
          headerOffset = headerHeight + rowHeight + 2; // +2 buffer
        }

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
  }, [viewMode]);

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

      const columns = viewMode === 'grid' ? Math.floor(window.innerWidth / 240) : 1; // Approximate grid columns

      // Calculate the next index immediately for visual feedback
      let nextIndex: number;
      if (e.key === 'ArrowDown') {
        if (viewMode === 'list') {
          nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, sortedFiles.length - 1);
        } else {
          // Grid view: move down by number of columns
          nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + columns, sortedFiles.length - 1);
        }
      } else if (e.key === 'ArrowUp') {
        if (viewMode === 'list') {
          nextIndex = currentIndex < 0 ? sortedFiles.length - 1 : Math.max(currentIndex - 1, 0);
        } else {
          // Grid view: move up by number of columns
          nextIndex = currentIndex < 0 ? sortedFiles.length - 1 : Math.max(currentIndex - columns, 0);
        }
      } else if (e.key === 'ArrowRight' && viewMode === 'grid') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, sortedFiles.length - 1);
      } else if (e.key === 'ArrowLeft' && viewMode === 'grid') {
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
  }, [isRenaming, sortedFiles, lastSelectedIndex, viewMode, selectFileAtIndex]);

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
    // First, check if there's an image in the clipboard
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
      // If clipboard read fails, continue with normal file paste logic
      console.log('Clipboard image check failed, continuing with file paste');
    }

    // If no image found or clipboard read failed, proceed with normal file paste
    if (!clipboard.files.length || !clipboard.operation) return;
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
      
      // Folder refresh is now handled automatically by the backend folderContentsChanged event
      
    } catch (err) {
      setStatus(`Failed to ${op === 'cut' ? 'move' : 'copy'} files: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      addLog(`Paste operation failed: ${err}`, 'error');
    }
  }, [clipboard.files, clipboard.operation, currentDirectory, setClipboard, setStatus, addLog]);

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

  // Grid view
  const renderGridView = () => (
    <Box
      ref={dropAreaRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      position="relative"
      minHeight="200px"
      onContextMenu={e => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          const position = getSmartMenuPosition(e.clientX, e.clientY, 150); // Blank menu is smaller
          setBlankContextMenu({ isOpen: true, position });
        }
      }}
      onClick={e => {
        // Clear selection when clicking on empty space within the grid
        if (e.target === e.currentTarget && selectedFiles.length > 0) {
          setSelectedFiles([]);
          setSelectedFile(null);
        }
      }}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blue.500"
          opacity={0.1}
          borderRadius="md"
          border="2px dashed"
          borderColor="blue.500"
          zIndex={1000}
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
        >
          <Flex direction="column" align="center" color="blue.600">
            <Icon as={Upload} boxSize={12} mb={2} />
            <Text fontSize="lg" fontWeight="bold">
              Drop files here to upload
            </Text>
          </Flex>
        </Box>
      )}
      
    <Grid templateColumns="repeat(auto-fit, minmax(220px, 1fr))" maxW="100%" gap={4} p={4}>
      {sortedFiles.map((file, index) => (
        isRenaming === file.name ? (
          <Box key={index} p={4}>
            <form onSubmit={handleRenameSubmit}>
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                size="sm"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsRenaming(null)
                    setRenameValue('')
                  }
                }}
              />
            </form>
          </Box>
        ) : (
            <DraggableFileItem
            key={index}
              file={file}
              isSelected={selectedFiles.includes(file.name)}
              onSelect={handleFileItemClick}
              onContextMenu={handleContextMenu}
              index={index}
                              selectedFiles={selectedFiles}
                sortedFiles={sortedFiles}
                onDragStateReset={resetDragState}
                isCut={isFileCut(file)}
                onFileMouseDown={handleFileItemMouseDown}
                onFileClick={handleFileItemClick}
                onFileMouseUp={handleFileItemMouseUp}
                onFileDragStart={handleFileItemDragStart}
                onNativeIconLoaded={handleNativeIconLoaded}
                data-file-index={index}
                ref={(el: HTMLElement | null) => {
                  if (file.type === 'file') {
                    if (el) {
                      observeFileElement(el, file.path);
                    } else {
                      // Element is unmounting, unobserve it
                      const existingEl = document.querySelector(`[data-file-path="${file.path}"]`) as HTMLElement;
                      if (existingEl) {
                        unobserveFileElement(existingEl);
                      }
                    }
                  }
                }}
            >
              <Flex
            p={4}
            alignItems="center"
            cursor="default"
            borderRadius="lg"
            borderWidth="1px"
            borderColor={selectedFiles.includes(file.name) ? 'blue.400' : borderColorDefault}
            bg={selectedFiles.includes(file.name) ? gridItemSelectedBg : gridItemDefaultBg}
            _hover={{
              bg: itemBgHover,
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              borderColor: hoverBorderColor,
            }}
            transition="border-color 0.2s, box-shadow 0.2s, background 0.2s"
            style={{ 
              userSelect: 'none', 
              opacity: isFileCut(file) ? 0.5 : 1, 
              fontStyle: isFileCut(file) ? 'italic' : 'normal'
            }}
            position="relative"
          >
            {/* Use native icon if available for files, otherwise use folder icon */}
            {file.type === 'file' && nativeIcons.has(file.path) ? (
              <Image
                src={nativeIcons.get(file.path)}
                boxSize={9.5}
                mr={4}
                alt={`${file.name} icon`}
              />
            ) : (
              <Icon
                as={FolderOpen}
                boxSize={9.5}
                mr={4}
                color="blue.400"
              />
            )}
            <Box flex="1">
              <Text fontSize="md" color={fileTextColor} fontWeight="medium" noOfLines={2} style={{ userSelect: 'none' }}>
                {file.name}
              </Text>
              <Text fontSize="xs" color={fileSubTextColor} mt={1} style={{ userSelect: 'none' }}>
                {file.size ? formatFileSize(file.size) : ''} {file.modified ? new Date(file.modified).toLocaleDateString() : ''}
              </Text>
            </Box>
            {/* NEW indicator for recently transferred files */}
            {isFileNew(file) && (
              <Box
                position="absolute"
                top={1}
                right={1}
                bg="green.500"
                color="white"
                fontSize="xs"
                fontWeight="bold"
                px={2}
                py={0.5}
                borderRadius="full"
                zIndex={2}
                boxShadow="0 1px 3px rgba(0,0,0,0.3)"
              >
                NEW
              </Box>
            )}
          </Flex>
            </DraggableFileItem>
        )
      ))}
    </Grid>
    </Box>
  )
// Complete renderListView function replacement for FileGrid.tsx
// This fixes the row highlighting and drag-drop issues
// Complete renderListView function replacement for FileGrid.tsx
// This fixes the row highlighting and drag-drop issues

const renderListView = () => (
  <Box 
    ref={dropAreaRef}
    onDragEnter={handleDragEnter}
    onDragLeave={handleDragLeave}
    onDragOver={handleDragOver}
    onDrop={handleDrop}
    position="relative"
    height="100%"
    width="100%"
    overflowY="auto"
    overflowX="auto"
    pl={3}
    onContextMenu={e => {
      if (e.target === e.currentTarget) {
        e.preventDefault();
        const position = getSmartMenuPosition(e.clientX, e.clientY, 150);
        setBlankContextMenu({ isOpen: true, position });
      }
    }}
    onClick={e => {
      if (e.target === e.currentTarget && selectedFiles.length > 0) {
        setSelectedFiles([]);
        setSelectedFile(null);
      }
    }}
  >
    {/* Drag overlay */}
    {isDragOver && (
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="blue.500"
        opacity={0.1}
        borderRadius="md"
        border="2px dashed"
        borderColor="blue.500"
        zIndex={1000}
        display="flex"
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
      >
        <Flex direction="column" align="center" color="blue.600">
          <Icon as={Upload} boxSize={12} mb={2} />
          <Text fontSize="lg" fontWeight="bold">
            Drop files here to upload
          </Text>
        </Flex>
      </Box>
    )}
    
    {/* CSS Grid container */}
    <Box
      ref={gridContainerRef}
      display="grid"
      gridTemplateColumns={columnOrder.map(col => `${columnWidths[col as keyof typeof columnWidths]}px`).join(' ')}
      gridAutoRows="30px"
      width="fit-content"
      fontSize="xs"
      userSelect="none"
      minWidth="690px"
      position="relative"
    >
      {/* Sticky header */}
      <Box 
        display="contents" 
        position="sticky" 
        top={0} 
        zIndex={100}
      >
        {columnOrder.map((column) => {
          const isName = column === 'name';
          const isSize = column === 'size';
          const isModified = column === 'modified';
          
          return (
            <Box
              key={column}
              px={2}
              py={0.85}
              fontWeight="medium"
              fontSize="xs"
              color={tableHeadTextColor}
              display="flex"
              alignItems="center"
              cursor="pointer"
              _hover={{ bg: headerHoverBg }}
              role="group"
              onClick={(e) => {
                // Prevent sorting if a drag operation just occurred
                if (hasDraggedColumn) {
                  return;
                }
                
                // Check if click is in the resize area (right edge)
                // This prevents sorting when clicking near the resize handle
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const isInResizeArea = clickX > rect.width - 8; // 8px from right edge
                
                // Only sort if not clicking in resize area
                if (!isInResizeArea) {
                  handleSort(column as SortColumn);
                }
              }}
              onDoubleClick={(e) => {
                // Double-click on header area (not resize area) auto-fits the column
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const isInResizeArea = clickX > rect.width - 8;
                
                if (!isInResizeArea) {
                  autoFitColumn(column);
                }
              }}
              position="sticky"
              top={0}
              zIndex={100}
              bg={headerStickyBg}
              _after={{ content: '""', position: 'absolute', right: 0, top: '25%', bottom: '25%', width: '1px', bg: headerDividerBg }}
              data-column={column}
              onMouseDown={(e) => handleColumnDragStart(column, e)}
              opacity={draggingColumn === column ? 0.5 : 1}
              borderLeft={draggingColumn && dragTargetColumn === column ? '4px solid #4F46E5' : undefined}
              transition="all 0.2s ease"
            >
              {isName ? 'Name' : isSize ? 'Size' : isModified ? 'Modified' : ''}
              {sortColumn === column && (
                <Icon
                  as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                  ml={1}
                  boxSize={2.5}
                  color="#4F46E5"
                />
              )}

              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                width="4px"
                cursor="grab"
                _hover={{ bg: dragGhostAccent }}
                _active={{ cursor: 'grabbing' }}
              />
              <Box
                position="absolute"
                right={0}
                top={0}
                bottom={0}
                width="8px"
                cursor="col-resize"
                _hover={{ bg: dragGhostAccent }}
                onMouseDown={(e) => handleResizeStart(column, e)}
                onDoubleClick={() => autoFitColumn(column)}
                zIndex={10}
                _after={{
                  content: '""',
                  position: 'absolute',
                  right: '2px',
                  top: '25%',
                  bottom: '25%',
                  width: '1px',
                  bg: 'transparent',
                  _hover: { bg: 'white' }
                }}
                title="Double-click to auto-fit column width"
              />
            </Box>
          );
        })}
      </Box>

      {/* Header spacer */}
            <Box 
        position="absolute"
        top={0}
        left="690px"
        right={0}
        height="30px"
        zIndex={99}
        bg={headerStickyBg}
      />


      {/* File rows - FIXED VERSION */}
      {sortedFiles.map((file, index) => {
        if (isRenaming === file.name) {
          return (
            <Box
              key={index}
              gridColumn="1 / -1"
              px={2}
              py={1}
            >
              <form onSubmit={handleRenameSubmit}>
                <Input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  autoFocus
                  size="xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsRenaming(null)
                      setRenameValue('')
                    }
                  }}
                />
              </form>
            </Box>
          )
        }

        const fileState = memoizedFileStates[index];
        const finalBg = memoizedRowBackgrounds[index];

        // Create cell handlers inline to avoid hook violations
        const cellHandlers = {
          onMouseEnter: () => handleRowMouseEnter(index),
          onMouseLeave: (e: React.MouseEvent) => handleRowMouseLeave(index, e),
          onContextMenu: (e: React.MouseEvent) => handleContextMenu(e, file),
          onClick: (e: React.MouseEvent) => handleFileItemClick(file, index, e),
          onMouseDown: (e: React.MouseEvent) => handleFileItemMouseDown?.(file, index, e),
          onMouseUp: (e: React.MouseEvent) => handleFileItemMouseUp?.(file, index, e),
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            // FIXED: Prevent dragging within same folder
            const filesToDrag: string[] = selectedFiles.length > 0 && selectedFiles.includes(file.name)
              ? selectedFiles.map(name => {
                  const selectedFile = sortedFiles.find(f => f.name === name);
                  return selectedFile ? selectedFile.path : null;
                }).filter((path): path is string => path !== null)
              : [file.path];
            
            // Set internal drag data
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
        };

        // Create folder drop handlers inline to avoid hook violations
        const folderDropHandlers = file.type === 'folder' ? {
          onDragEnterCapture: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            handleFolderDragEnter(file.path);
          },
          onDragOverCapture: (e: React.DragEvent) => {
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
          onDragLeaveCapture: (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const relatedTarget = e.relatedTarget as Element;
            
            // Only clear if truly leaving the row
            if (!relatedTarget || typeof (relatedTarget as any).closest !== 'function' || !relatedTarget.closest(`[data-row-index="${index}"]`)) {
              handleFolderDragLeave(file.path);
            }
          },
          onDropCapture: async (e: React.DragEvent) => {
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
                
                // FIXED: Check if dragging to same folder
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
                  // FIXED: Use proper API methods for move vs copy
                  if (operation === 'copy') {
                    const results = await window.electronAPI.copyFilesWithConflictResolution(filesToTransfer, file.path);
                    const successful = results.filter((r: any) => r.status === 'success').length;
                    addLog(`Copied ${successful} file(s) to ${file.name}`);
                    setStatus(`Copied ${successful} file(s)`, 'success');
                  } else {
                    // Use moveFilesWithConflictResolution for actual move operation
                    const results = await window.electronAPI.moveFilesWithConflictResolution(filesToTransfer, file.path);
                    const successful = results.filter((r: any) => r.status === 'success').length;
                    const failed = results.filter((r: any) => r.status === 'error').length;
                    
                    let message = `Moved ${successful} file(s) to ${file.name}`;
                    if (failed > 0) message += `, ${failed} failed`;
                    
                    addLog(message);
                    setStatus(message, failed > 0 ? 'error' : 'success');
                  }
                  
                  setDraggedFiles(new Set());
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
              // Handle external file drops
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
          }
        } : {};

        // FIXED: Common cell styles with proper row highlighting
        const cellStyles = {
          bg: finalBg,
          transition: "background 0.1s",
          cursor: "default",
          px: 2,
          py: 1.05,
          display: "flex",
          alignItems: "center",
          position: "relative" as const,
          // Ensure the cell itself is the drop target area
          pointerEvents: 'auto' as const,
        };

        return (
          <React.Fragment key={index}>
            {columnOrder.map((column) => {
              const isName = column === 'name';
              const isSize = column === 'size';
              const isModified = column === 'modified';
              
              if (isName) {
                return (
                  <Box 
                    key={column}
                    {...cellStyles} 
                    {...cellHandlers}
                    {...folderDropHandlers}
                    data-row-index={index}
                    data-file-index={index}
                    ref={(el: HTMLElement | null) => {
                      if (file.type === 'file') {
                        if (el) {
                          observeFileElement(el, file.path);
                        } else {
                          // Element is unmounting, unobserve it
                          const existingEl = document.querySelector(`[data-file-path="${file.path}"]`) as HTMLElement;
                          if (existingEl) {
                            unobserveFileElement(existingEl);
                          }
                        }
                      }
                    }}
                  >
                    {/* Icon */}
                    {file.type === 'file' && nativeIcons.has(file.path) ? (
                      <Image
                        src={nativeIcons.get(file.path)}
                        boxSize={4}
                        mr={1.5}
                        alt={`${file.name} icon`}
                        flexShrink={0}
                      />
                    ) : (
                      <Icon
                        as={FolderOpen}
                        boxSize={4}
                        mr={1.5}
                        color="blue.400"
                        flexShrink={0}
                      />
                    )}
                    
                    {/* File name */}
                    <Text 
                      fontSize="xs" 
                      color={fileTextColor} 
                      style={{ 
                        userSelect: 'none', 
                        opacity: fileState.isFileCut ? 0.5 : 1, 
                        fontStyle: fileState.isFileCut ? 'italic' : 'normal'
                      }}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      flex={1}
                    >
                      {file.name}
                    </Text>
                    
                    {/* NEW indicator */}
                    {fileState.isFileNew && (
                      <Box
                        position="absolute"
                        top={1}
                        right={1}
                        bg="green.500"
                        color="white"
                        fontSize="2xs"
                        fontWeight="bold"
                        px={1}
                        py={0.25}
                        borderRadius="full"
                        zIndex={2}
                        boxShadow="0 1px 3px rgba(0,0,0,0.3)"
                      >
                        NEW
                      </Box>
                    )}
                  </Box>
                );
              } else if (isSize) {
                return (
                  <Box 
                    key={column}
                    {...cellStyles}
                    {...cellHandlers}
                    {...folderDropHandlers}
                    data-row-index={index}
                  >
                    <Text 
                      fontSize="xs" 
                      color={fileSubTextColor}
                      style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
                    >
                      {file.type === 'folder' ? '-' : (file.size ? formatFileSize(file.size) : '-')}
                    </Text>
                  </Box>
                );
              } else if (isModified) {
                return (
                  <Box 
                    key={column}
                    {...cellStyles}
                    {...cellHandlers}
                    {...folderDropHandlers}
                    data-row-index={index}
                  >
                    <Text 
                      fontSize="xs" 
                      color={fileSubTextColor}
                      style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.1 : 1 }}
                    >
                      {file.modified ? formatDate(file.modified) : '-'}
                    </Text>
                  </Box>
                );
              }
              return null;
            })}
          </React.Fragment>
        )
      })}

      {/* Drag ghost preview */}
      {draggingColumn && dragMousePos && isDragThresholdMet && (
        <Box
          position="fixed"
          left={dragMousePos.x - dragOffset.x}
          top={dragMousePos.y - dragOffset.y}
          width={`${columnWidths[draggingColumn as keyof typeof columnWidths]}px`}
          height="30px"
          bg={dragGhostBg}
          border="1px solid"
          borderColor={dragGhostBorder}
          borderRadius="md"
          px={2}
          py={0.85}
          fontWeight="medium"
          fontSize="xs"
          color={tableHeadTextColor}
          display="flex"
          alignItems="center"
          opacity={0.8}
          zIndex={9999}
          pointerEvents="none"
          boxShadow="lg"
        >
          {draggingColumn === 'name' ? 'Name' : draggingColumn === 'size' ? 'Size' : draggingColumn === 'modified' ? 'Modified' : ''}
          <Box
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            width="4px"
            bg={dragGhostAccent}
            borderRadius="md 0 0 md"
          />
        </Box>
      )}
    </Box>
  </Box>
)
  // Convert renderContextMenu to a component
  const ContextMenu: React.FC<{
    contextMenu: typeof contextMenu;
    selectedFiles: string[];
    sortedFiles: FileItem[];
    clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
    setClipboard: typeof setClipboard;
    handleMenuAction: (action: string) => void;
    handlePaste: () => void;
    handleCloseContextMenu: () => void;
  }> = ({ contextMenu, selectedFiles, sortedFiles, clipboard, setClipboard, handleMenuAction, handlePaste, handleCloseContextMenu }) => {
    const boxBg = useColorModeValue('white', 'gray.800');
    const borderCol = useColorModeValue('gray.200', 'gray.700');
    const hoverBg = useColorModeValue('gray.100', 'gray.700');
    if (!contextMenu.isOpen || !contextMenu.fileItem) return null;

    const selectedPDFs = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.pdf'));
    const showMergePDFs = selectedPDFs.length > 1;
    const fileName = contextMenu.fileItem.name.toLowerCase();
    const isZipFile = fileName.endsWith('.zip');
    const isEmlFile = fileName.endsWith('.eml');
    const selectedZipFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.zip'));
    const selectedEmlFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.eml'));
    const showExtractZips = selectedZipFiles.length > 1 || (isZipFile && selectedZipFiles.length >= 1);
    const showExtractEmls = selectedEmlFiles.length > 1 || (isEmlFile && selectedEmlFiles.length >= 1);

    const getClipboardFiles = () => {
      if (
        selectedFiles.length > 1 &&
        contextMenu.fileItem &&
        typeof contextMenu.fileItem.name === 'string' &&
        selectedFiles.includes(contextMenu.fileItem.name)
      ) {
        return sortedFiles.filter((f): f is FileItem => !!f && typeof f.name === 'string' && selectedFiles.includes(f.name));
      } else if (contextMenu.fileItem) {
        return [contextMenu.fileItem];
      }
      return [];
    };

    return (
      <Box
        position="fixed"
        top={contextMenu.position.y}
        left={contextMenu.position.x}
        bg={boxBg}
        borderRadius="md"
        boxShadow="lg"
        zIndex="modal"
        minW="200px"
        border="1px solid"
        borderColor={borderCol}
      >
        <Box py={1}>
          {/* Basic Actions */}
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('open')}>
            <ExternalLink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Open</Text>
          </Flex>

          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('rename')}>
            <Edit2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Rename</Text>
          </Flex>
          {contextMenu.fileItem.type === 'folder' && (
            quickAccessPaths.includes(contextMenu.fileItem.path) ? (
              <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('unpin_quick_access')}>
                <Star size={16} style={{ marginRight: '8px' }} />
                <Text fontSize="sm">Unpin from Quick Access</Text>
              </Flex>
            ) : (
              <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('pin_quick_access')}>
                <Star size={16} style={{ marginRight: '8px' }} />
                <Text fontSize="sm">Pin to Quick Access</Text>
              </Flex>
            )
          )}
          {contextMenu.fileItem.type === 'folder' && (
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('open_new_tab')}>
              <ExternalLink size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Open folder in new tab</Text>
            </Flex>
          )}

          {/* File-Specific Actions */}
          {(contextMenu.fileItem.name.toLowerCase().endsWith('.pdf') || contextMenu.fileItem.name.toLowerCase().endsWith('.ahk') || showMergePDFs || showExtractZips || showExtractEmls) && (
            <>
              <Divider />
              {contextMenu.fileItem.name.toLowerCase().endsWith('.pdf') && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_text')}>
                  <FileText size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Extract Text</Text>
                </Flex>
              )}
              {contextMenu.fileItem.name.toLowerCase().endsWith('.ahk') && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('edit_in_notepad')}>
                  <Edit2 size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Edit in Notepad</Text>
                </Flex>
              )}
              {showMergePDFs && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('merge_pdfs')}>
                  <FilePlus2 size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Merge PDFs ({selectedPDFs.length})</Text>
                </Flex>
              )}
              {showExtractZips && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_zip')}>
                  <Archive size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Extract ZIP{selectedZipFiles.length > 1 ? `s (${selectedZipFiles.length})` : ''}</Text>
                </Flex>
              )}
              {showExtractEmls && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_eml')}>
                  <Mail size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Extract Attachments{selectedEmlFiles.length > 1 ? ` (${selectedEmlFiles.length})` : ''}</Text>
                </Flex>
              )}
            </>
          )}

          {/* Clipboard Actions */}
          <Divider />
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'cut' }); handleCloseContextMenu(); }}>
            <Scissors size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Cut</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'copy' }); handleCloseContextMenu(); }}>
            <Copy size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Copy</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { handlePaste(); handleCloseContextMenu(); }} opacity={clipboard.files.length > 0 ? 1 : 0.5} pointerEvents={clipboard.files.length > 0 ? 'auto' : 'none'}>
            <FileSymlink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Paste</Text>
          </Flex>

          {/* Destructive & Info Actions */}
          <Divider />
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('delete')}>
            <Trash2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Delete</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('properties')}>
            <Info size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Properties</Text>
          </Flex>
        </Box>
      </Box>
    );
  };

  // Convert renderBlankContextMenu to a component
  const BlankContextMenu: React.FC<{
    blankContextMenu: typeof blankContextMenu;
    clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
    handlePaste: () => void;
    setBlankContextMenu: typeof setBlankContextMenu;
    onPasteImage: () => void;
  }> = ({ blankContextMenu, clipboard, handlePaste, setBlankContextMenu, onPasteImage }) => {
    const boxBg = useColorModeValue('white', 'gray.800');
    const borderCol = useColorModeValue('gray.200', 'gray.700');
    const hoverBg = useColorModeValue('gray.100', 'gray.700');
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!blankContextMenu.isOpen) return;
      const handleClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setBlankContextMenu({ ...blankContextMenu, isOpen: false });
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [blankContextMenu, setBlankContextMenu]);
    if (!blankContextMenu.isOpen) return null;
    return (
      <Box ref={menuRef} position="fixed" top={blankContextMenu.position.y} left={blankContextMenu.position.x} bg={boxBg} borderRadius="md" boxShadow="lg" zIndex="modal" minW="200px" border="1px solid" borderColor={borderCol}>
        <Box py={1}>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { handlePaste(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }} opacity={clipboard.files.length > 0 ? 1 : 0.5} pointerEvents={clipboard.files.length > 0 ? 'auto' : 'none'}>
            <FileSymlink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Paste</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { onPasteImage(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}>
            <ImageIcon size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Paste Image</Text>
          </Flex>
        </Box>
      </Box>
    );
  };

  const [isPropertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesFile, setPropertiesFile] = useState<FileProperties | null>(null);
  const [isImagePasteOpen, setImagePasteOpen] = useState(false);

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

  // Column management state
  const [columnWidths, setColumnWidths] = useState({
    name: 400,
    size: 100,
    modified: 180
  });
  const [columnOrder, setColumnOrder] = useState(['name', 'size', 'modified']);
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

  // Add folder drop states - optimized with Set for better performance
  const [folderHoverState, setFolderHoverState] = useState<Set<string>>(new Set());
  const [folderDragCounter, setFolderDragCounter] = useState<Map<string, number>>(new Map());

  // Optimized folder hover handlers
  const handleFolderDragEnter = useCallback((filePath: string) => {
    setFolderHoverState(prev => {
      if (prev.has(filePath)) return prev;
      const newSet = new Set(prev);
      newSet.add(filePath);
      return newSet;
    });
    
    setFolderDragCounter(prev => {
      const newMap = new Map(prev);
      newMap.set(filePath, (newMap.get(filePath) || 0) + 1);
      return newMap;
    });
  }, []);

  const handleFolderDragLeave = useCallback((filePath: string) => {
    setFolderDragCounter(prev => {
      const newMap = new Map(prev);
      const count = newMap.get(filePath) || 0;
      if (count <= 1) {
        newMap.delete(filePath);
        // Only remove from hover state when counter reaches 0
        setFolderHoverState(prevState => {
          if (!prevState.has(filePath)) return prevState;
          const newSet = new Set(prevState);
          newSet.delete(filePath);
          return newSet;
        });
      } else {
        newMap.set(filePath, count - 1);
      }
      return newMap;
    });
  }, []);

  const clearFolderHoverStates = useCallback(() => {
    setFolderHoverState(new Set());
    setFolderDragCounter(new Map());
  }, []);

  // Column resize handlers - OPTIMIZED with useCallback
  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Mark that we're resizing to prevent sorting
    setResizingColumn(column);
    setDragStartX(e.clientX);
    
    // Add global mouse event listeners for resize
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn) return;
    
    const deltaX = e.clientX - dragStartX;
    const newWidth = Math.max(50, columnWidths[resizingColumn as keyof typeof columnWidths] + deltaX);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
    setDragStartX(e.clientX);
  }, [resizingColumn, dragStartX, columnWidths]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, []);

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
    ['name', 'size', 'modified'].forEach(col => autoFitColumn(col));
    addLog('Auto-fitted all columns');
  }, [autoFitColumn, addLog]);





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
      console.warn(`Failed to get icon for ${filePath}:`, error);
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

  // Clear icons when directory changes to prevent showing stale icons
  useEffect(() => {
    // Clear native icons when changing directories
    setNativeIcons(new Map());
    // Clear any pending loads
    loadingQueue.current.clear();
  }, [currentDirectory]);

  // Memoized expensive computations to prevent recalculation on every render
  const memoizedFileStates = useMemo(() => {
    return sortedFiles.map((file, index) => ({
      isFileSelected: selectedFiles.includes(file.name),
      isRowHovered: hoveredRowIndex === index,
      isFileCut: clipboard.operation === 'cut' && clipboard.files.some(f => f.path === file.path),
      isFileNew: recentlyTransferredFilesSet.set.has(file.path) || recentlyTransferredFilesSet.normalizedSet.has(file.path.replace(/\\/g, '/')),
      isFileDragged: draggedFiles.has(file.name)
    }));
  }, [sortedFiles, selectedFiles, hoveredRowIndex, clipboard, recentlyTransferredFilesSet, draggedFiles]);

  // Memoized row background calculations
  const memoizedRowBackgrounds = useMemo(() => {
    return memoizedFileStates.map((fileState, index) => {
      const file = sortedFiles[index];
      const rowBg = fileState.isFileSelected 
        ? rowSelectedBg
        : (fileState.isRowHovered ? rowHoverBg : 'transparent');
      
      const folderDropBg = file.type === 'folder' && folderHoverState.has(file.path) 
        ? folderDropBgColor
        : undefined;
      
      return folderDropBg || rowBg;
    });
  }, [memoizedFileStates, sortedFiles, rowSelectedBg, rowHoverBg, folderHoverState, folderDropBgColor]);

  
  return (
    <Box 
      p={viewMode === 'grid' ? 0 : 0} 
      m={0} 
      height="100%" 
      position="relative"
      style={{ 
        filter: isJumpModeActive ? 'blur(2px)' : 'none',
        transition: 'filter 0.2s ease-in-out'
      }}
    >
      {viewMode === 'grid' ? renderGridView() : renderListView()}
      <ContextMenu 
        contextMenu={contextMenu}
        selectedFiles={selectedFiles}
        sortedFiles={sortedFiles}
        clipboard={clipboard}
        setClipboard={setClipboard}
        handleMenuAction={handleMenuAction}
        handlePaste={handlePaste}
        handleCloseContextMenu={handleCloseContextMenu}
      />
      <BlankContextMenu 
        blankContextMenu={blankContextMenu}
        clipboard={clipboard}
        handlePaste={handlePaste}
        setBlankContextMenu={setBlankContextMenu}
        onPasteImage={() => setImagePasteOpen(true)}
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

      {/* JumpModeOverlay moved to main app level */}
    </Box>
  )
}