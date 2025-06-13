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
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, isAbsolutePath } from '../utils/path'
import { MergePDFDialog } from './MergePDFDialog'
import { DraggableFileItem } from './DraggableFileItem'
import { useColorModeValue } from '@chakra-ui/react'
import type { FileItem } from '../types'

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
    console.log('getFileIcon: FOLDER', name);
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
  const { addLog, currentDirectory, setCurrentDirectory, rootDirectory, setStatus, setSelectAllFiles, folderItems, setFolderItems } = useAppContext()
  
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
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null)
  const [isMergePDFOpen, setMergePDFOpen] = useState(false)

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const dropAreaRef = useRef<HTMLDivElement>(null)

  // Clipboard state for cut/copy
  const [clipboard, setClipboard] = useState<{ files: FileItem[]; operation: 'cut' | 'copy' | null }>({ files: [], operation: null });
  const [blankContextMenu, setBlankContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Add state for lastClickedFile
  const [lastClickedFile, setLastClickedFile] = useState<string | null>(null);

  // Function to reset drag state - can be called by child components
  const resetDragState = useCallback(() => {
    setIsDragOver(false);
    setDragCounter(0);
  }, []);

  // All useColorModeValue hooks next
  const itemBgHover = useColorModeValue('#f1f5f9', 'gray.700')
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

  const handleContextMenu = (
    e: React.MouseEvent,
    file: FileItem,
  ) => {
    e.preventDefault()
    setContextMenu({
      isOpen: true,
      position: {
        x: e.clientX,
        y: e.clientY,
      },
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
      }
      
      if (failedFiles.length > 0) {
        setStatus(`Failed to delete ${failedFiles.length} file(s). Check console for details.`, 'error');
        
        // Show detailed error message for failed files
        const errorDetails = failedFiles.map(f => `• ${f.name}: ${f.error}`).join('\n');
        addLog(`Delete operation completed with errors:\n${errorDetails}`, 'error');
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
              addLog(`Extracted text from ${contextMenu.fileItem.name}:\n${text}`, 'response')
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
      return
    }
    try {
      const oldPath = isAbsolutePath(isRenaming) ? isRenaming : joinPath(currentDirectory === '/' ? '' : currentDirectory, isRenaming)
      const newPath = isAbsolutePath(renameValue) ? renameValue : joinPath(currentDirectory === '/' ? '' : currentDirectory, renameValue)
      await (window.electronAPI as any).renameItem(oldPath, newPath)
      addLog(`Renamed ${isRenaming} to ${renameValue}`)
      setIsRenaming(null)
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      setFolderItems(contents)
    } catch (error) {
      console.error('Error renaming:', error)
      addLog(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  useEffect(() => {
    const handleViewModeChange = (e: CustomEvent) => {
      setViewMode(e.detail as 'grid' | 'list')
    }
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        handleCloseContextMenu()
      }
    }
    const handleFolderContentsChanged = (event: any, data: { directory: string }) => {
      console.log('[FileGrid] Folder contents changed event received:', data);
      if (data && data.directory === currentDirectory) {
        console.log('[FileGrid] Refreshing current directory:', currentDirectory);
        loadDirectory(currentDirectory);
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
      // File is already selected and we have multiple selections
      // Don't change selection - this could be the start of a drag operation
      // Just update the primary selected file
      setSelectedFile(file.name);
      setLastSelectedIndex(index);
    } else {
      // Regular click: Select only this file (clear others)
      setSelectedFiles([file.name]);
      setLastSelectedIndex(index);
      setSelectedFile(file.name);
    }
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

  // Keyboard shortcuts: Enter to open, Delete to delete
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
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFiles, sortedFiles, isRenaming])

  useEffect(() => {
    // Register selectAllFiles callback
    setSelectAllFiles(() => () => {
      setSelectedFiles(sortedFiles.map(f => f.name));
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
        
        // Refresh current directory
        const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
        setFolderItems(contents);
        
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
      if (isRenaming || isInputFocused) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedFiles.length > 0) {
        // Cut
        setClipboard({ files: sortedFiles.filter(f => selectedFiles.includes(f.name)), operation: 'cut' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedFiles.length > 0) {
        // Copy
        setClipboard({ files: sortedFiles.filter(f => selectedFiles.includes(f.name)), operation: 'copy' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard.files.length > 0) {
        // Paste
        handlePaste();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles, sortedFiles, clipboard, isRenaming]);

  // Paste handler
  const handlePaste = async () => {
    if (!clipboard.files.length || !clipboard.operation) return;
    const op = clipboard.operation;
    try {
      if (op === 'cut') {
        await window.electronAPI.moveFiles(clipboard.files.map(f => f.path), currentDirectory);
      } else if (op === 'copy') {
        await window.electronAPI.copyFiles(clipboard.files.map(f => f.path), currentDirectory);
      }
      setClipboard({ files: [], operation: null });
      setStatus(`${op === 'cut' ? 'Moved' : 'Copied'} ${clipboard.files.length} item(s)`, 'success');
      const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
      setFolderItems(contents);
    } catch (err) {
      setStatus(`Failed to ${op === 'cut' ? 'move' : 'copy'} files`, 'error');
    }
  };

  // Add this helper function before renderGridView and renderListView
  const isFileCut = (file: FileItem) => clipboard.operation === 'cut' && clipboard.files.some(f => f.path === file.path);

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
          setBlankContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } });
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
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                size="sm"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsRenaming(null)
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
            >
              <Flex
            p={4}
            alignItems="center"
            cursor="pointer"
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
          >
            <Icon
              as={getFileIcon(file.type, file.name)}
              boxSize={7}
              mr={4}
              color={getIconColor(file.type, file.name)}
            />
            <Box flex="1">
              <Text fontSize="md" color={fileTextColor} fontWeight="medium" noOfLines={2} style={{ userSelect: 'none' }}>
                {file.name}
              </Text>
              <Text fontSize="xs" color={fileSubTextColor} mt={1} style={{ userSelect: 'none' }}>
                {file.size ? formatFileSize(file.size) : ''} {file.modified ? new Date(file.modified).toLocaleDateString() : ''}
              </Text>
            </Box>
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
      overflowX="auto" 
      p={0} 
      m={0}
      minHeight="300px"
      width="100%"
      onContextMenu={e => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          setBlankContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } });
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
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      autoFocus
                      size="sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsRenaming(null)
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
                as="tr"
              >
                <Td borderColor={tableBorderColor} width="50%">
                  <Flex align="center">
                    <Icon
                      as={getFileIcon(file.type, file.name)}
                      boxSize={4}
                      mr={2}
                      color={getIconColor(file.type, file.name)}
                    />
                    <Text fontSize="sm" color={fileTextColor} style={{ userSelect: 'none' }}>
                      {file.name}
                    </Text>
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
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('open')}>
            <ExternalLink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Open</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('rename')}>
            <Edit2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Rename</Text>
          </Flex>
          {contextMenu.fileItem.name.toLowerCase().endsWith('.pdf') && (
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_text')} color="blue.400">
              <FileText size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Extract Text</Text>
            </Flex>
          )}
          {showMergePDFs && (
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('merge_pdfs')} color="red.400">
              <FilePlus2 size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Merge PDFs ({selectedPDFs.length})</Text>
            </Flex>
          )}
          {showExtractZips && (
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_zip')} color="orange.400">
              <Archive size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Extract ZIP{selectedZipFiles.length > 1 ? `s (${selectedZipFiles.length})` : ''}</Text>
            </Flex>
          )}
          {showExtractEmls && (
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('extract_eml')} color="cyan.400">
              <Mail size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Extract Attachments{selectedEmlFiles.length > 1 ? ` (${selectedEmlFiles.length})` : ''}</Text>
            </Flex>
          )}
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'cut' }); handleCloseContextMenu(); }} color="red.500">
            <Scissors size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Cut</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'copy' }); handleCloseContextMenu(); }} color="blue.500">
            <Copy size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Copy</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => { handlePaste(); handleCloseContextMenu(); }} opacity={clipboard.files.length > 0 ? 1 : 0.5} pointerEvents={clipboard.files.length > 0 ? 'auto' : 'none'}>
            <FileSymlink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Paste</Text>
          </Flex>
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('delete')} color="red.500">
            <Trash2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Delete</Text>
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

  return (
    <Box p={viewMode === 'grid' ? 0 : 0} m={0}>
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
    </Box>
  )
}