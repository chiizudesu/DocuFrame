import React, { useEffect, useState, useRef } from 'react'
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
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Portal,
  IconButton,
  useColorModeValue,
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
  MoreHorizontal,
  Copy,
  Scissors,
  FileSymlink,
  Download,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { settingsService } from '../services/settings'
import type { FileItem } from '../types'
import { joinPath, isAbsolutePath } from '../utils/path'

interface ContextMenuPosition {
  x: number
  y: number
}

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
  const { addLog, currentDirectory, setCurrentDirectory, rootDirectory } = useAppContext()
  
  // All useState hooks next
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('fileViewMode') as 'grid' | 'list') || 'grid',
  )
  const [folderItems, setFolderItems] = useState<FileItem[]>([])
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

  // All useColorModeValue hooks next
  const itemBgHover = useColorModeValue('#e8ecf5', 'gray.700')
  const fileTextColor = useColorModeValue('gray.700', 'white')
  const fileSubTextColor = useColorModeValue('gray.600', 'gray.400')
  const tableBgColor = useColorModeValue('#f2f5fa', 'transparent')
  const tableHeadBgColor = useColorModeValue('#e8ecf5', 'gray.800')
  const tableHeadTextColor = useColorModeValue('gray.700', 'gray.300')
  const tableBorderColor = useColorModeValue('#e2e8f0', 'gray.700')

  useEffect(() => {
    const loadDirectory = async () => {
      if (!currentDirectory) return
      setIsLoading(true)
      try {
        // Use currentDirectory as the full path
        const fullPath = currentDirectory
        const isValid = await (window.electronAPI as any).validatePath(fullPath)
        if (!isValid) {
          addLog(`Invalid path: ${fullPath}`, 'error')
          return
        }
        const contents = await (window.electronAPI as any).getDirectoryContents(fullPath)
        setFolderItems(contents)
        addLog(`Loaded directory: ${formatPathForLog(currentDirectory)}`)
      } catch (error) {
        console.error('Failed to load directory:', error)
        addLog(`Failed to load directory: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      } finally {
        setIsLoading(false)
      }
    }
    loadDirectory()
  }, [currentDirectory, addLog, rootDirectory])

  // Sort files
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
    } else {
      // Open file externally
      try {
        if (!window.electronAPI || typeof (window.electronAPI as any).openFile !== 'function') {
          const msg = 'Electron API not available: openFile';
          addLog(msg, 'error');
          console.error(msg);
          return;
        }
        (window.electronAPI as any).openFile(file.path);
        addLog(`Opened file: ${file.name}`);
      } catch (error: any) {
        addLog(`Failed to open file: ${file.name} (${file.path})\n${error?.message || error}`,'error');
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
      for (const f of files) {
        await (window.electronAPI as any).deleteItem(f.path)
      }
      addLog(`Deleted: ${files.map(f => f.name).join(', ')}`)
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      setFolderItems(contents)
      setSelectedFiles([])
    } catch (error: any) {
      addLog(`Failed to delete: ${filesToDelete.join(', ')}\n${error?.message || error}`, 'error')
      console.error('Failed to delete:', filesToDelete, error)
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
          break
        case 'delete':
          if (selectedFiles.length > 1 && selectedFiles.includes(contextMenu.fileItem.name)) {
            await handleDeleteFile(sortedFiles.filter(f => selectedFiles.includes(f.name)))
          } else {
            await handleDeleteFile(contextMenu.fileItem)
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
    window.addEventListener(
      'viewModeChanged',
      handleViewModeChange as EventListener,
    )
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener(
        'viewModeChanged',
        handleViewModeChange as EventListener,
      )
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu.isOpen])

  // Multi-select click logic
  const handleFileItemClick = (file: FileItem, index: number, event?: React.MouseEvent) => {
    const now = Date.now()
    const isCtrl = event?.ctrlKey || event?.metaKey
    const isShift = event?.shiftKey
    if (isShift && lastSelectedIndex !== null) {
      // Range select
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const range = sortedFiles.slice(start, end + 1).map(f => f.name)
      setSelectedFiles(Array.from(new Set([...selectedFiles, ...range])))
    } else if (isCtrl) {
      // Toggle selection
      setSelectedFiles(selectedFiles.includes(file.name)
        ? selectedFiles.filter(f => f !== file.name)
        : [...selectedFiles, file.name])
      setLastSelectedIndex(index)
    } else {
      // Single select
      setSelectedFiles([file.name])
      setLastSelectedIndex(index)
      setSelectedFile(file.name)
      setLastClickTime(now)
      if (clickTimer) clearTimeout(clickTimer)
    }
    // Double click: open all selected files if all are files
    if (selectedFiles.includes(file.name) && now - lastClickTime < 500) {
      (async () => {
        clearTimeout(clickTimer as NodeJS.Timeout)
        setLastClickTime(0)
        setClickTimer(null)
        const selectedFileObjs = sortedFiles.filter(f => selectedFiles.includes(f.name))
        if (selectedFileObjs.every(f => f.type !== 'folder')) {
          for (const f of selectedFileObjs) await handleOpenOrNavigate(f)
        } else if (selectedFileObjs.length === 1 && selectedFileObjs[0].type === 'folder') {
          handleOpenOrNavigate(selectedFileObjs[0])
        }
      })();
    }
  }

  // Add F2 key support for rename
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (isRenaming) return;
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

  // Grid view
  const renderGridView = () => (
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
          <Flex
            key={index}
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
            onContextMenu={(e) => handleContextMenu(e, file)}
            onClick={(e) => handleFileItemClick(file, index, e)}
            style={{ userSelect: 'none' }}
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
        )
      ))}
    </Grid>
  )

  // List view
  const renderListView = () => (
    <Box overflowX="auto" p={0} m={0}>
      <Table
        size="sm"
        variant="simple"
        bg={tableBgColor}
        borderRadius={0}
        overflow="unset"
        mt={0}
        style={{ userSelect: 'none' }}
      >
        <Thead bg={tableHeadBgColor}>
          <Tr>
            <Th
              color={tableHeadTextColor}
              cursor="pointer"
              onClick={() => handleSort('name')}
              borderColor={tableBorderColor}
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
            console.log('Rendering row:', file.name, 'type:', file.type);
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
              <Tr
                key={index}
                cursor="pointer"
                _hover={{
                  bg: itemBgHover,
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
                onClick={(e) => handleFileItemClick(file, index, e)}
                bg={selectedFiles.includes(file.name) ? useColorModeValue('blue.50', 'blue.900') : undefined}
                style={{ userSelect: 'none' }}
              >
                <Td borderColor={tableBorderColor}>
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
                <Td borderColor={tableBorderColor} color={fileSubTextColor}>
                  {file.size ? formatFileSize(file.size) : '-'}
                </Td>
                <Td borderColor={tableBorderColor} color={fileSubTextColor}>
                  {file.modified ? new Date(file.modified).toLocaleString() : '-'}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Box>
  )

  // Context Menu
  const renderContextMenu = () => {
    if (!contextMenu.isOpen || !contextMenu.fileItem) return null

    return (
      <Box
        position="fixed"
        top={contextMenu.position.y}
        left={contextMenu.position.x}
        bg={useColorModeValue('white', 'gray.800')}
        borderRadius="md"
        boxShadow="lg"
        zIndex="modal"
        minW="200px"
        border="1px solid"
        borderColor={useColorModeValue('gray.200', 'gray.700')}
      >
        <Box py={1}>
          <Flex
            align="center"
            px={3}
            py={2}
            cursor="pointer"
            _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
            onClick={() => handleMenuAction('open')}
          >
            <ExternalLink size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Open</Text>
          </Flex>
          <Flex
            align="center"
            px={3}
            py={2}
            cursor="pointer"
            _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
            onClick={() => handleMenuAction('rename')}
          >
            <Edit2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Rename</Text>
          </Flex>
          <Flex
            align="center"
            px={3}
            py={2}
            cursor="pointer"
            _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
            onClick={() => handleMenuAction('delete')}
            color="red.500"
          >
            <Trash2 size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Delete</Text>
          </Flex>
        </Box>
      </Box>
    )
  }

  const renderFileItem = (file: FileItem) => {
    if (isRenaming === file.name) {
      return (
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
      )
    }

    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        p={2}
        cursor="pointer"
        borderRadius="md"
        _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
        onContextMenu={(e) => handleContextMenu(e, file)}
        onClick={() => handleOpenOrNavigate(file)}
      >
        <Icon as={getFileIcon(file.type, file.name)} boxSize={8} mb={2} />
        <Text fontSize="sm" textAlign="center" noOfLines={2}>
          {file.name}
        </Text>
        {file.modified && (
          <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
            {new Date(file.modified).toLocaleDateString()}
          </Text>
        )}
      </Flex>
    )
  }

  return (
    <Box p={viewMode === 'grid' ? 0 : 0} m={0}>
      {viewMode === 'grid' ? renderGridView() : renderListView()}
      {renderContextMenu()}
    </Box>
  )
}