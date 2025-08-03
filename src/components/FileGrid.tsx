import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Grid,
  Box,
  Text,
  Icon,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Image,
  Divider,
  useToast,
} from '@chakra-ui/react'
import {
  File,
  FileText,
  FolderOpen,
  Image as ImageIcon,
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
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, isAbsolutePath } from '../utils/path'
import { MergePDFDialog } from './MergePDFDialog'
import { ExtractedTextDialog } from './ExtractedTextDialog'
import { DraggableFileItem } from './DraggableFileItem'
import { useColorModeValue } from '@chakra-ui/react'
import type { FileItem } from '../types'
import { CustomPropertiesDialog, FileProperties } from './CustomPropertiesDialog';

// Sort types for list view
type SortColumn = 'name' | 'size' | 'modified'
type SortDirection = 'asc' | 'desc'

// Utility to format paths for logging (Windows vs others)
function formatPathForLog(path: string) {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  return isWindows ? path.replace(/\//g, '\\') : path;
}

const getFileIcon = (type: string, name: string) => {
  if (type === 'folder') {
    return FolderOpen;
  }
  
  const extension = name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return FileText
    case 'doc':
    case 'docx':
      return FileText
    case 'xls':
    case 'xlsx':
    case 'csv':
      return FileText
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
      return ImageIcon
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return FileText
    case 'txt':
    case 'md':
    case 'json':
    case 'xml':
    case 'html':
    case 'css':
    case 'js':
    case 'ts':
      return FileText
    default:
      return File
  }
}

const getIconColor = (type: string, name: string) => {
  if (type === 'folder') return 'blue.400'
  
  const extension = name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'red.400'
    case 'doc':
    case 'docx':
      return 'blue.400'
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'green.400'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
      return 'purple.400'
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'orange.400'
    case 'txt':
    case 'md':
    case 'json':
    case 'xml':
    case 'html':
    case 'css':
    case 'js':
    case 'ts':
      return 'yellow.400'
    default:
      return 'gray.400'
  }
}

// Format file size
const formatFileSize = (size: string | undefined) => {
  if (!size) return '';
  const sizeNum = parseFloat(size);
  if (isNaN(sizeNum)) return size;
  return `${(sizeNum / 1024).toFixed(1)} KB`;
};

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
    isQuickNavigating
  } = useAppContext()
  const toast = useToast()
  
  // All useState hooks next
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('fileViewMode') as 'grid' | 'list') || 'grid',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [sortedFiles, setSortedFiles] = useState<FileItem[]>([])
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
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [isMergePDFOpen, setMergePDFOpen] = useState(false)
  const [isExtractedTextOpen, setExtractedTextOpen] = useState(false)
  const [extractedTextData, setExtractedTextData] = useState({ fileName: '', text: '' })

  // Jump mode state
  const [jumpBuffer, setJumpBuffer] = useState('');
  const [jumpTimeout, setJumpTimeout] = useState<NodeJS.Timeout | null>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const dropAreaRef = useRef<HTMLDivElement>(null)

  const [blankContextMenu, setBlankContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Add state for lastClickedFile
  const [lastClickedFile, setLastClickedFile] = useState<string | null>(null);

  // State to store native icons for files
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  
  // Smart selection states for handling drag vs click on multi-selected files
  const [pendingSelectionChange, setPendingSelectionChange] = useState<{ fileName: string; index: number } | null>(null);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<Set<string>>(new Set());

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

  // Utility function to get filename without extension for cursor positioning
  const getFilenameWithoutExtension = (filename: string) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No extension or hidden file (starts with .)
      return filename.length;
    }
    return lastDotIndex;
  };

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

  // Update sorted files when folder items change
  useEffect(() => {
    const sorted = [...folderItems].sort((a, b) => {
      // Always sort folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      
      // Then sort by the selected column
      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'size':
          const sizeA = typeof a.size === 'string' ? parseFloat(a.size) : 0;
          const sizeB = typeof b.size === 'string' ? parseFloat(b.size) : 0;
          return sortDirection === 'asc' ? sizeA - sizeB : sizeB - sizeA;
        case 'modified':
          const dateA = a.modified ? new Date(a.modified).getTime() : 0;
          const dateB = b.modified ? new Date(b.modified).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        default:
          return 0;
      }
    });
    setSortedFiles(sorted);
  }, [folderItems, sortColumn, sortDirection]);

  // Load directory contents when current directory changes
  useEffect(() => {
    const loadDirectory = async () => {
      if (!currentDirectory) return
      setIsLoading(true)
      // Start timer at the beginning
      const navStart = performance.now();
      try {
        const fullPath = currentDirectory
        const isValid = await (window.electronAPI as any).validatePath(fullPath)
        if (!isValid) {
          addLog(`Invalid path: ${fullPath}`, 'error')
          return
        }
        const contents = await (window.electronAPI as any).getDirectoryContents(fullPath)
        setFolderItems(contents)
        // Log folder load time after contents are set
        const navEnd = performance.now();
        addLog(`⏱ Folder load time: ${((navEnd - navStart) / 1000).toFixed(3)}s`);
        addLog(`Loaded directory: ${formatPathForLog(currentDirectory)}`)
      } catch (error) {
        console.error('Failed to load directory:', error)
        addLog(`Failed to load directory: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      } finally {
        setIsLoading(false)
      }
    }
    loadDirectory()
  }, [currentDirectory, addLog, rootDirectory, setFolderItems])

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
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
  }

  // Open file or navigate folder
  const handleOpenOrNavigate = (file: FileItem) => {
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
  };

  // Helper function for smart context menu positioning
  const getSmartMenuPosition = (clientX: number, clientY: number, menuHeight = 300) => {
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
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    file: FileItem,
  ) => {
    e.preventDefault()
    
    const position = getSmartMenuPosition(e.clientX, e.clientY, 300);
    
    setContextMenu({
      isOpen: true,
      position,
      fileItem: file,
    })
  }

  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: {
        x: 0,
        y: 0,
      },
      fileItem: null,
    })
  }

  // Delete file(s) with confirmation
  const handleDeleteFile = async (fileOrFiles: FileItem | FileItem[]) => {
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
      setFolderItems(contents)
      setSelectedFiles([])
      
    } catch (error: any) {
      const errorMessage = error?.message || error;
      addLog(`Delete operation failed: ${errorMessage}`, 'error');
      setStatus('Delete operation failed', 'error');
      console.error('Delete operation failed:', error);
    }
  }

  // In context menu, pass array for multi-select delete
  const handleMenuAction = async (action: string) => {
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
                setFolderItems(contents);
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
                setFolderItems(contents);
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
                setFolderItems(contents);
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
                setFolderItems(contents);
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
  }

  const handleRenameSubmit = async (e: React.FormEvent) => {
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
      loadDirectory(currentDirectory)
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
  }

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
        
        // Force a re-render to show the "NEW" indicator
        setTimeout(() => {
          loadDirectory(currentDirectory);
        }, 100);
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

  const loadDirectory = async (dirPath: string) => {
    if (!dirPath) return;
    setIsLoading(true);
    try {
      const contents = await (window.electronAPI as any).getDirectoryContents(dirPath);
      setFolderItems(contents);
      addLog(`Loaded directory: ${formatPathForLog(dirPath)}`);
    } catch (error) {
      console.error('Failed to load directory:', error);
      addLog(`Failed to load directory: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function for selection on mouse down  
  const handleFileItemMouseDown = (file: FileItem, index: number, event?: React.MouseEvent) => {
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
  };

  // Add this function for handling mouse up - completes smart selection logic
  const handleFileItemMouseUp = (file: FileItem, index: number, event?: React.MouseEvent) => {
    // If we have a pending selection change and no drag started, complete the selection
    if (pendingSelectionChange && !isDragStarted && pendingSelectionChange.fileName === file.name) {
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
    }
    // Clear pending state
    setPendingSelectionChange(null);
  };

  // Add this function for handling drag start - prevents selection change on drag
  const handleFileItemDragStart = (file: FileItem, index: number, event?: React.DragEvent) => {
    setIsDragStarted(true);
    setPendingSelectionChange(null);
    
    // Immediately hide the dragged files for snappy UX
    const filesToHide = selectedFiles.length > 0 && selectedFiles.includes(file.name)
      ? selectedFiles
      : [file.name];
    
    setDraggedFiles(new Set(filesToHide));
  };

  // Add this function for selection on click
  const handleFileItemClick = (file: FileItem, index: number, event?: React.MouseEvent) => {
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
  };

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
    setSelectAllFiles(() => () => {
      const allFileNames = sortedFiles.map(f => f.name);
      setSelectedFiles(allFileNames);
      setStatus(`Selected all files in ${currentDirectory.split(/[\\/]/).pop() || currentDirectory}`, 'info');
      addLog(`Selected all files in ${currentDirectory}`);
    });
    return () => setSelectAllFiles(() => () => {});
  }, [sortedFiles, currentDirectory, setSelectAllFiles, setStatus, addLog]);

  // Drag and drop handlers for the main container
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    
    // Only hide drag overlay when counter reaches 0
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Set appropriate drop effect based on drag type
    const hasExternalFiles = e.dataTransfer.types.includes('Files');
    const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
    
    if (hasExternalFiles) {
      e.dataTransfer.dropEffect = 'copy'; // External files are copied/uploaded
    } else if (isInternalDrag) {
      // For internal drags, respect the modifier keys
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  };

  // Keyboard shortcuts for cut/copy/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard.files.length > 0) {
        // Paste files
        e.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles, sortedFiles, clipboard, isRenaming]);

  // Add arrow key navigation for file selection
  useEffect(() => {
    let lastArrowTime = 0;
    const arrowThrottle = 100; // 0.1 seconds throttle
    let pendingSelection: number | null = null;

    const handleArrowNavigation = (e: KeyboardEvent) => {
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

      // Always provide immediate visual feedback
      const element = document.querySelector(`[data-file-index="${nextIndex}"]`);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'instant', 
          block: 'nearest',
          inline: 'nearest'
        });
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
    };

    // Helper function to select file and ensure it's visible
    const selectFileAtIndex = (index: number) => {
      if (index >= 0 && index < sortedFiles.length) {
        const file = sortedFiles[index];
        setSelectedFiles([file.name]);
        setSelectedFile(file.name);
        setLastSelectedIndex(index);
      }
    };

    window.addEventListener('keydown', handleArrowNavigation);
    return () => window.removeEventListener('keydown', handleArrowNavigation);
  }, [selectedFiles, sortedFiles, lastSelectedIndex, isRenaming, viewMode]);

  // Jump mode navigation
  useEffect(() => {
    const handleJumpMode = (e: KeyboardEvent) => {
      // Don't interfere if renaming, in input fields, or if QuickNavigate is open
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isRenaming || isInputFocused || isQuickNavigating) return;
      
      // Only handle single letter/number keys
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
      
      // Clear existing timeout
      if (jumpTimeout) clearTimeout(jumpTimeout);
      
      // Add to jump buffer
      const newBuffer = jumpBuffer + e.key.toLowerCase();
      setJumpBuffer(newBuffer);
      
      // Find first matching item
      const matchIndex = sortedFiles.findIndex(item =>
        item.name.toLowerCase().startsWith(newBuffer)
      );
      
      if (matchIndex !== -1) {
        // Select the matching file
        const matchingFile = sortedFiles[matchIndex];
        setSelectedFiles([matchingFile.name]);
        setSelectedFile(matchingFile.name);
        setLastSelectedIndex(matchIndex);
        
        // Instantly scroll to the item without delay
        const element = document.querySelector(`[data-file-index="${matchIndex}"]`);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'instant', 
            block: 'nearest',
            inline: 'nearest'
          });
        }
        
        addLog(`Jumped to: ${matchingFile.name}`);
      }
      
      // Reset buffer after 1 second
      const timeout = setTimeout(() => {
        setJumpBuffer('');
      }, 1000);
      setJumpTimeout(timeout);
    };
    
    window.addEventListener('keydown', handleJumpMode);
    return () => {
      window.removeEventListener('keydown', handleJumpMode);
      if (jumpTimeout) clearTimeout(jumpTimeout);
    };
  }, [jumpBuffer, jumpTimeout, sortedFiles, isRenaming, isQuickNavigating, viewMode]);

  // Enhanced paste handler with conflict resolution
  const handlePaste = async () => {
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
  };

  // Add this helper function before renderGridView and renderListView
  const isFileCut = (file: FileItem) => clipboard.operation === 'cut' && clipboard.files.some(f => f.path === file.path);

  // Helper function to check if a file is being dragged (for immediate visual feedback)
  const isFileDragged = (file: FileItem) => draggedFiles.has(file.name);

  // Helper function to check if a file is newly transferred
  const isFileNew = (file: FileItem) => {
    const isNew = recentlyTransferredFiles.includes(file.path);
    if (isNew) {
      return true;
    } else {
      // Check if the file path might be in a different format (normalize slashes)
      const normalizedPath = file.path.replace(/\\/g, '/');
      const isNewNormalized = recentlyTransferredFiles.some(path => path.replace(/\\/g, '/') === normalizedPath);
      return isNewNormalized;
    }
  };

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
            >
              <Flex
            p={4}
            alignItems="center"
            cursor="default"
            borderRadius="lg"
            borderWidth="1px"
            borderColor={selectedFiles.includes(file.name) ? 'blue.400' : useColorModeValue('gray.200', 'gray.700')}
            bg={selectedFiles.includes(file.name) ? useColorModeValue('blue.50', 'blue.900') : useColorModeValue('#f8f9fc', 'gray.800')}
            _hover={{
              bg: itemBgHover,
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              borderColor: useColorModeValue('blue.200', 'blue.700'),
            }}
            transition="border-color 0.2s, box-shadow 0.2s, background 0.2s"
            style={{ userSelect: 'none', opacity: isFileCut(file) ? 0.5 : 1, fontStyle: isFileCut(file) ? 'italic' : 'normal' }}
            position="relative"
          >
            {/* Use native icon if available for files, otherwise use Lucide icons */}
            {file.type === 'file' && nativeIcons.has(file.path) ? (
              <Image
                src={nativeIcons.get(file.path)}
                boxSize={7}
                mr={4}
                alt={`${file.name} icon`}
              />
            ) : (
              <Icon
                as={getFileIcon(file.type, file.name)}
                boxSize={7}
                mr={4}
                color={getIconColor(file.type, file.name)}
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

  // List view
  const renderListView = () => (
    <Box 
      ref={dropAreaRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      position="relative"
      overflowY="auto"
      overflowX="auto" 
      p={0} 
      m={0}
      height="100%"
      width="100%"
      onContextMenu={e => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          const position = getSmartMenuPosition(e.clientX, e.clientY, 150); // Blank menu is smaller
          setBlankContextMenu({ isOpen: true, position });
        }
      }}
      onClick={e => {
        // Clear selection when clicking on empty space within the list
        if (e.target === e.currentTarget && selectedFiles.length > 0) {
          setSelectedFiles([]);
          setSelectedFile(null);
        }
      }}
    >
      {/* Drag overlay - now covers the entire file list area */}
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
      
      <Table
        size="sm"
        variant="simple"
        bg={tableBgColor}
        borderRadius={0}
        overflow="unset"
        mt={0}
        style={{ 
          userSelect: 'none',
          tableLayout: 'fixed', // Prevent column width changes
          width: '100%'
        }}
      >
        <Thead bg={tableHeadBgColor}>
          <Tr>
            <Th
              color={tableHeadTextColor}
              cursor="pointer"
              onClick={() => handleSort('name')}
              borderColor={tableBorderColor}
              width="50%"
            >
              <Flex align="center">
                Name
                {sortColumn === 'name' && (
                  <Icon
                    as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                    ml={1}
                    boxSize={3}
                    color="#4F46E5"
                  />
                )}
              </Flex>
            </Th>
            <Th
              color={tableHeadTextColor}
              cursor="pointer"
              onClick={() => handleSort('size')}
              borderColor={tableBorderColor}
              width="25%"
            >
              <Flex align="center">
                Size
                {sortColumn === 'size' && (
                  <Icon
                    as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                    ml={1}
                    boxSize={3}
                    color="#4F46E5"
                  />
                )}
              </Flex>
            </Th>
            <Th
              color={tableHeadTextColor}
              cursor="pointer"
              onClick={() => handleSort('modified')}
              borderColor={tableBorderColor}
              width="25%"
            >
              <Flex align="center">
                Modified
                {sortColumn === 'modified' && (
                  <Icon
                    as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                    ml={1}
                    boxSize={3}
                    color="#4F46E5"
                  />
                )}
              </Flex>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {sortedFiles.map((file, index) => {
            // console.log('Rendering row:', file.name, 'type:', file.type);
            return isRenaming === file.name ? (
              <Tr key={index}>
                <Td colSpan={3} borderColor={tableBorderColor}>
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
                </Td>
              </Tr>
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
                as="tr"
                data-file-index={index}
              >
                <Td borderColor={tableBorderColor} width="50%" position="relative">
                  <Flex align="center">
                    {/* Use native icon if available for files, otherwise use Lucide icons */}
                    {file.type === 'file' && nativeIcons.has(file.path) ? (
                      <Image
                        src={nativeIcons.get(file.path)}
                        boxSize={4}
                        mr={2}
                        alt={`${file.name} icon`}
                      />
                    ) : (
                      <Icon
                        as={getFileIcon(file.type, file.name)}
                        boxSize={4}
                        mr={2}
                        color={getIconColor(file.type, file.name)}
                      />
                    )}
                    <Text fontSize="sm" color={fileTextColor} style={{ userSelect: 'none' }}>
                      {file.name}
                    </Text>
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
                </Td>
                <Td borderColor={tableBorderColor} color={fileSubTextColor} width="25%">
                  {file.type === 'folder' ? '-' : (file.size ? formatFileSize(file.size) : '-')}
                </Td>
                <Td borderColor={tableBorderColor} color={fileSubTextColor} width="25%">
                  {file.modified ? new Date(file.modified).toLocaleString() : '-'}
                </Td>
              </DraggableFileItem>
            );
          })}
        </Tbody>
      </Table>
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
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('open_new_tab')}>
              <ExternalLink size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Open folder in new tab</Text>
            </Flex>
          )}

          {/* File-Specific Actions */}
          {(contextMenu.fileItem.name.toLowerCase().endsWith('.pdf') || showMergePDFs || showExtractZips || showExtractEmls) && (
            <>
              <Divider />
              {contextMenu.fileItem.name.toLowerCase().endsWith('.pdf') && (
                <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_text')}>
                  <FileText size={16} style={{ marginRight: '8px' }} />
                  <Text fontSize="sm">Extract Text</Text>
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
  }> = ({ blankContextMenu, clipboard, handlePaste, setBlankContextMenu }) => {
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
        </Box>
      </Box>
    );
  };

  const [isPropertiesOpen, setPropertiesOpen] = useState(false);
  const [propertiesFile, setPropertiesFile] = useState<FileProperties | null>(null);

  const handleUnblockFile = async () => {
    if (!propertiesFile) return;
    await (window.electronAPI as any).unblockFile(propertiesFile.path);
    setPropertiesFile({ ...propertiesFile, isBlocked: false });
  };

  return (
    <Box p={viewMode === 'grid' ? 0 : 0} m={0} height="100%">
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
    </Box>
  )
}