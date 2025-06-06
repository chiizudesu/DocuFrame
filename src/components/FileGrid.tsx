import React, { useEffect, useState, useRef } from 'react';
import { Grid, Box, Text, Icon, Flex, Table, Thead, Tbody, Tr, Th, Td, Menu, MenuButton, MenuList, MenuItem, MenuDivider, Portal, IconButton } from '@chakra-ui/react';
import { File, FileText, FolderOpen, Image as ImageIcon, Trash2, Edit2, ExternalLink, MoreHorizontal, Copy, Scissors, FileSymlink, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { useColorModeValue } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';
interface FileItem {
  name: string;
  type: 'folder' | 'pdf' | 'image' | 'document';
  size?: string;
  modified?: string;
}
interface ContextMenuPosition {
  x: number;
  y: number;
}
// Sort types for list view
type SortColumn = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';
const mockFiles: FileItem[] = [{
  name: 'Documents',
  type: 'folder',
  modified: '2024-01-15 14:30'
}, {
  name: 'Images',
  type: 'folder',
  modified: '2024-01-14 09:15'
}, {
  name: 'report.pdf',
  type: 'pdf',
  size: '2.4 MB',
  modified: '2024-01-13 16:45'
}, {
  name: 'screenshot.png',
  type: 'image',
  size: '856 KB',
  modified: '2024-01-13 11:20'
}, {
  name: 'notes.docx',
  type: 'document',
  size: '45 KB',
  modified: '2024-01-12 13:10'
}];
const getFileIcon = (type: string) => {
  switch (type) {
    case 'folder':
      return FolderOpen;
    case 'pdf':
      return FileText;
    case 'image':
      return ImageIcon;
    default:
      return File;
  }
};
const getIconColor = (type: string) => {
  switch (type) {
    case 'folder':
      return 'blue.400';
    case 'pdf':
      return 'red.400';
    case 'image':
      return 'green.400';
    default:
      return 'gray.400';
  }
};
export const FileGrid: React.FC = () => {
  const {
    addLog,
    currentDirectory,
    setCurrentDirectory
  } = useAppContext();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(localStorage.getItem('fileViewMode') as 'grid' | 'list' || 'grid');
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortedFiles, setSortedFiles] = useState<FileItem[]>(mockFiles);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: ContextMenuPosition;
    fileItem: FileItem | null;
  }>({
    isOpen: false,
    position: {
      x: 0,
      y: 0
    },
    fileItem: null
  });
  // Sort files when sort parameters change
  useEffect(() => {
    const sorted = [...mockFiles].sort((a, b) => {
      // Always sort folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      // Then sort by the selected column
      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'size':
          // Handle undefined sizes
          if (!a.size && !b.size) return 0;
          if (!a.size) return sortDirection === 'asc' ? -1 : 1;
          if (!b.size) return sortDirection === 'asc' ? 1 : -1;
          // Extract numeric value and unit for proper comparison
          const extractSize = (sizeStr: string) => {
            const match = sizeStr.match(/^([\d.]+)\s*(\w+)$/);
            if (!match) return 0;
            const value = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            // Convert to bytes for comparison
            switch (unit) {
              case 'kb':
                return value * 1024;
              case 'mb':
                return value * 1024 * 1024;
              case 'gb':
                return value * 1024 * 1024 * 1024;
              default:
                return value;
            }
          };
          const sizeA = extractSize(a.size);
          const sizeB = extractSize(b.size);
          return sortDirection === 'asc' ? sizeA - sizeB : sizeB - sizeA;
        case 'modified':
          // Handle undefined modified dates
          if (!a.modified && !b.modified) return 0;
          if (!a.modified) return sortDirection === 'asc' ? -1 : 1;
          if (!b.modified) return sortDirection === 'asc' ? 1 : -1;
          // Compare dates
          const dateA = new Date(a.modified).getTime();
          const dateB = new Date(b.modified).getTime();
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        default:
          return 0;
      }
    });
    setSortedFiles(sorted);
  }, [sortColumn, sortDirection]);
  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column is clicked
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    addLog(`Sorting by ${column} (${sortDirection === 'asc' ? 'descending' : 'ascending'})`);
  };
  // Handle file/folder click
  const handleItemClick = (file: FileItem) => {
    if (file.type === 'folder') {
      // Navigate to the folder
      const newPath = `${currentDirectory === '/' ? '' : currentDirectory}/${file.name}`;
      setCurrentDirectory(newPath);
      addLog(`Changed directory to: ${newPath}`);
    } else {
      // Handle file click
      addLog(`Opening file: ${file.name}`);
    }
  };
  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: {
        x: e.clientX,
        y: e.clientY
      },
      fileItem: file
    });
  };
  const handleCloseContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: {
        x: 0,
        y: 0
      },
      fileItem: null
    });
  };
  const handleMenuAction = (action: string) => {
    if (!contextMenu.fileItem) return;
    switch (action) {
      case 'open':
        if (contextMenu.fileItem.type === 'folder') {
          const newPath = `${currentDirectory === '/' ? '' : currentDirectory}/${contextMenu.fileItem.name}`;
          setCurrentDirectory(newPath);
          addLog(`Changed directory to: ${newPath}`);
        } else {
          addLog(`Opening ${contextMenu.fileItem.name}`);
        }
        break;
      case 'rename':
        addLog(`Renaming ${contextMenu.fileItem.name}`);
        break;
      case 'delete':
        addLog(`Deleting ${contextMenu.fileItem.name}`);
        break;
      case 'copy':
        addLog(`Copying ${contextMenu.fileItem.name}`);
        break;
      case 'cut':
        addLog(`Cutting ${contextMenu.fileItem.name}`);
        break;
      case 'createLink':
        addLog(`Creating link for ${contextMenu.fileItem.name}`);
        break;
      case 'download':
        addLog(`Downloading ${contextMenu.fileItem.name}`);
        break;
      default:
        addLog(`Function: ${action} on ${contextMenu.fileItem.name}`);
    }
    handleCloseContextMenu();
  };
  useEffect(() => {
    const handleViewModeChange = (e: CustomEvent) => {
      setViewMode(e.detail as 'grid' | 'list');
    };
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        handleCloseContextMenu();
      }
    };
    window.addEventListener('viewModeChanged', handleViewModeChange as EventListener);
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('viewModeChanged', handleViewModeChange as EventListener);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);
  // Grid view
  const renderGridView = () => <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
      {sortedFiles.map((file, index) => <Flex key={index} p={2} alignItems="center" cursor="pointer" borderRadius="md" _hover={{
      bg: useColorModeValue('gray.100', 'gray.700')
    }} onContextMenu={e => handleContextMenu(e, file)} onClick={() => handleItemClick(file)}>
          <Icon as={getFileIcon(file.type)} boxSize={5} mr={3} color={getIconColor(file.type)} />
          <Box>
            <Text fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
              {file.name}
            </Text>
            <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')}>
              {file.size || ''} {file.modified}
            </Text>
          </Box>
        </Flex>)}
    </Grid>;
  // List view
  const renderListView = () => <Box overflowX="auto">
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th color={useColorModeValue('gray.600', 'gray.400')} cursor="pointer" onClick={() => handleSort('name')}>
              <Flex align="center">
                Name
                {sortColumn === 'name' && <Icon as={sortDirection === 'asc' ? ChevronUp : ChevronDown} ml={1} boxSize={3} color="blue.400" />}
              </Flex>
            </Th>
            <Th color={useColorModeValue('gray.600', 'gray.400')} cursor="pointer" onClick={() => handleSort('size')}>
              <Flex align="center">
                Size
                {sortColumn === 'size' && <Icon as={sortDirection === 'asc' ? ChevronUp : ChevronDown} ml={1} boxSize={3} color="blue.400" />}
              </Flex>
            </Th>
            <Th color={useColorModeValue('gray.600', 'gray.400')} cursor="pointer" onClick={() => handleSort('modified')}>
              <Flex align="center">
                Modified
                {sortColumn === 'modified' && <Icon as={sortDirection === 'asc' ? ChevronUp : ChevronDown} ml={1} boxSize={3} color="blue.400" />}
              </Flex>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {sortedFiles.map((file, index) => <Tr key={index} cursor="pointer" _hover={{
          bg: useColorModeValue('gray.100', 'gray.700')
        }} onContextMenu={e => handleContextMenu(e, file)} onClick={() => handleItemClick(file)}>
              <Td>
                <Flex align="center">
                  <Icon as={getFileIcon(file.type)} boxSize={4} mr={2} color={getIconColor(file.type)} />
                  <Text fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
                    {file.name}
                  </Text>
                </Flex>
              </Td>
              <Td color={useColorModeValue('gray.600', 'gray.400')}>
                {file.size || '-'}
              </Td>
              <Td color={useColorModeValue('gray.600', 'gray.400')}>
                {file.modified}
              </Td>
            </Tr>)}
        </Tbody>
      </Table>
    </Box>;
  // Context Menu
  const renderContextMenu = () => {
    if (!contextMenu.isOpen || !contextMenu.fileItem) return null;
    return <Box position="fixed" top={contextMenu.position.y} left={contextMenu.position.x} zIndex={1000} onClick={e => e.stopPropagation()} bg={useColorModeValue('white', 'gray.800')} boxShadow="md" borderRadius="md" border="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')} width="200px">
        <Box py={1}>
          <MenuItem icon={<ExternalLink size={16} />} onClick={() => handleMenuAction('open')} fontSize="sm">
            Open
          </MenuItem>
          <MenuItem icon={<Edit2 size={16} />} onClick={() => handleMenuAction('rename')} fontSize="sm">
            Rename
          </MenuItem>
          <MenuItem icon={<Trash2 size={16} />} onClick={() => handleMenuAction('delete')} fontSize="sm" color={useColorModeValue('red.600', 'red.300')}>
            Delete
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<Copy size={16} />} onClick={() => handleMenuAction('copy')} fontSize="sm">
            Copy
          </MenuItem>
          <MenuItem icon={<Scissors size={16} />} onClick={() => handleMenuAction('cut')} fontSize="sm">
            Cut
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<FileSymlink size={16} />} onClick={() => handleMenuAction('createLink')} fontSize="sm">
            Create link
          </MenuItem>
          <MenuItem icon={<Download size={16} />} onClick={() => handleMenuAction('download')} fontSize="sm">
            Download
          </MenuItem>
          <MenuDivider />
          <Box px={3} py={1}>
            <Menu>
              <MenuButton as={Flex} alignItems="center" width="100%" px={2} py={1} borderRadius="md" cursor="pointer" fontSize="sm" _hover={{
              bg: useColorModeValue('gray.100', 'gray.700')
            }}>
                <Text flex="1">Functions</Text>
                <Icon as={MoreHorizontal} boxSize={4} />
              </MenuButton>
              <Portal>
                <MenuList fontSize="sm">
                  <MenuItem onClick={() => handleMenuAction('archive')}>
                    Archive
                  </MenuItem>
                  <MenuItem onClick={() => handleMenuAction('extract')}>
                    Extract
                  </MenuItem>
                  <MenuItem onClick={() => handleMenuAction('analyze')}>
                    Analyze
                  </MenuItem>
                  <MenuItem onClick={() => handleMenuAction('convert')}>
                    Convert
                  </MenuItem>
                </MenuList>
              </Portal>
            </Menu>
          </Box>
        </Box>
      </Box>;
  };
  return <Box p={4}>
      {viewMode === 'grid' ? renderGridView() : renderListView()}
      {renderContextMenu()}
    </Box>;
};