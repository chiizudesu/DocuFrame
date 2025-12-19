import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  Box,
  Text,
  Flex,
  Divider,
  Portal,
  Button,
  IconButton,
  Spinner,
  Badge,
  Checkbox,
  useColorModeValue,
  Icon,
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
  ChevronRight,
  FilePlus2,
  Archive,
  Mail,
  Info,
  Image as ImageIcon,
  Star,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Type,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import type { FileItem } from '../../types'
import { useAppContext } from '../../context/AppContext'
import { joinPath, normalizePath } from '../../utils/path'

// FileContextMenu Component
export interface FileContextMenuProps {
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    fileItem: FileItem | null;
  };
  selectedFiles: string[];
  selectedFilesSet: Set<string>;
  sortedFiles: FileItem[];
  clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
  setClipboard: (clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null }) => void;
  handleMenuAction: (action: string) => void;
  handlePaste: () => void;
  handleCloseContextMenu: () => void;
  quickAccessPaths: string[];
  setTemplates: (templates: Array<{ name: string; path: string }>) => void;
  setTemplateSubmenuPosition: (position: { x: number; y: number } | null) => void;
  setTemplateSubmenuOpen: (open: boolean) => void;
  setMoveToFiles: (files: FileItem[]) => void;
  setIsJumpModeActive: (active: boolean) => void;
  setIsMoveToDialogOpen: (open: boolean) => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  contextMenu,
  selectedFiles,
  selectedFilesSet,
  sortedFiles,
  clipboard,
  setClipboard,
  handleMenuAction,
  handlePaste,
  handleCloseContextMenu,
  quickAccessPaths,
  setTemplates,
  setTemplateSubmenuPosition,
  setTemplateSubmenuOpen,
  setMoveToFiles,
  setIsJumpModeActive,
  setIsMoveToDialogOpen,
}) => {
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
      selectedFilesSet.has(contextMenu.fileItem.name)
    ) {
      return sortedFiles.filter((f): f is FileItem => !!f && typeof f.name === 'string' && selectedFilesSet.has(f.name));
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
      borderRadius="0"
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

        {/* Rename Group */}
        <Divider />
        {selectedFiles.length === 1 && (
        <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('rename')}>
          <Edit2 size={16} style={{ marginRight: '8px' }} />
          <Text fontSize="sm">Rename</Text>
        </Flex>
        )}
        {contextMenu.fileItem.type === 'file' && selectedFiles.length === 1 && (
          <>
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('smart_rename')}>
              <Sparkles size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Smart Rename</Text>
            </Flex>
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('proper_case_rename')}>
              <Type size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Proper Case</Text>
            </Flex>
          </>
        )}
        
        {/* Index Prefix Group */}
        {contextMenu.fileItem.type === 'file' && (
          <>
            <Divider />
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('assign_prefix')}>
              <Layers size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Manage Index Prefix</Text>
            </Flex>
            <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => handleMenuAction('remove_prefix')}>
              <X size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Remove Prefix</Text>
            </Flex>
          </>
        )}
        <Divider />
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
          <>
            <Flex 
              align="center" 
              px={3} 
              py={2} 
              cursor="pointer" 
              _hover={{ bg: hoverBg }} 
              onClick={() => handleMenuAction('open_new_tab')}
            >
              <ExternalLink size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">Open folder in new tab</Text>
            </Flex>
            <Flex 
              align="center" 
              px={3} 
              py={2} 
              cursor="pointer" 
              _hover={{ bg: hoverBg }}
              position="relative"
              onMouseEnter={async () => {
                // Load templates when hovering
                try {
                  const result = await (window.electronAPI as any).getWorkpaperTemplates();
                  if (result.success) {
                    setTemplates(result.templates || []);
                    setTemplateSubmenuPosition({ x: contextMenu.position.x + 200, y: contextMenu.position.y });
                    setTemplateSubmenuOpen(true);
                  }
                } catch (error) {
                  console.error('Error loading templates:', error);
                }
              }}
              onMouseLeave={() => {
                // Don't close immediately, let submenu handle it
              }}
            >
              <FileSpreadsheet size={16} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">New Template</Text>
              <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </Flex>
          </>
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
        {contextMenu.fileItem.type === 'file' && (
          <Flex align="center" px={3} py={2} cursor="pointer" _hover={{ bg: hoverBg }} onClick={() => {
            const filesToMove = getClipboardFiles();
            setMoveToFiles(filesToMove);
            setIsJumpModeActive(false); // Deactivate jump mode
            setIsMoveToDialogOpen(true);
            handleCloseContextMenu();
          }}>
            <ArrowRightLeft size={16} style={{ marginRight: '8px' }} />
            <Text fontSize="sm">Move to...</Text>
          </Flex>
        )}
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

// BlankContextMenu Component
export interface BlankContextMenuProps {
  blankContextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
  };
  clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
  handlePaste: () => void;
  setBlankContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number } }) => void;
  onPasteImage: () => void;
}

export const BlankContextMenu: React.FC<BlankContextMenuProps> = ({
  blankContextMenu,
  clipboard,
  handlePaste,
  setBlankContextMenu,
  onPasteImage,
}) => {
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
    <Box ref={menuRef} position="fixed" top={blankContextMenu.position.y} left={blankContextMenu.position.x} bg={boxBg} borderRadius="0" boxShadow="lg" zIndex="modal" minW="200px" border="1px solid" borderColor={borderCol}>
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

// TemplateSubmenu Component
export interface TemplateSubmenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  templates: Array<{ name: string; path: string }>;
  folderPath: string;
  onClose: () => void;
  onCreateFromTemplate: (templatePath: string, templateName: string) => void;
}

export const TemplateSubmenu: React.FC<TemplateSubmenuProps> = ({
  isOpen,
  position,
  templates,
  folderPath,
  onCreateFromTemplate,
  onClose,
}) => {
  const boxBg = useColorModeValue('white', 'gray.800');
  const borderCol = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  if (!isOpen || !position) return null;
  
  return (
    <Box
      position="fixed"
      top={position.y}
      left={position.x}
      bg={boxBg}
      borderRadius="0"
      boxShadow="lg"
      zIndex="modal"
      minW="200px"
      border="1px solid"
      borderColor={borderCol}
      onMouseLeave={onClose}
    >
      <Box py={1}>
        {templates.length === 0 ? (
          <Flex align="center" px={3} py={2}>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')}>No templates</Text>
          </Flex>
        ) : (
          templates.map((template) => (
            <Flex
              key={template.path}
              align="center"
              px={3}
              py={2}
              cursor="pointer"
              _hover={{ bg: hoverBg }}
              onClick={() => {
                onCreateFromTemplate(template.path, template.name);
                onClose();
              }}
            >
              <FileSpreadsheet size={14} style={{ marginRight: '8px' }} />
              <Text fontSize="sm">{template.name.replace('.xlsx', '')}</Text>
            </Flex>
          ))
        )}
      </Box>
    </Box>
  );
};

// MoveToNavigation Component (used by MoveToDialogWrapper)
interface MoveToNavigationProps {
  currentDirectory: string;
  onSelectFolder: (path: string) => Promise<void>;
  onCancel: () => void;
  dialogRef?: React.RefObject<HTMLDivElement>;
}

const MoveToNavigation: React.FC<MoveToNavigationProps> = ({ currentDirectory, onSelectFolder, onCancel, dialogRef }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<Array<{ id: string; name: string; type: 'folder' | 'file'; path: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const pillBg = useColorModeValue('blue.100', 'blue.800');
  const pillColor = useColorModeValue('blue.800', 'blue.100');
  const { isQuickNavigating, isJumpModeActive } = useAppContext();
  const initializedRef = useRef(false);

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const isValid = await window.electronAPI.validatePath(dirPath);
      if (!isValid) {
        throw new Error(`Path is not valid: ${dirPath}`);
      }
      const directoryItems = await window.electronAPI.getDirectoryContents(dirPath);
      const foldersOnly = directoryItems.filter((item: any) => item.type === 'folder' && !item.isHidden);
      setItems(foldersOnly);
      const normalizedPath = normalizePath(dirPath);
      setCurrentPath(normalizedPath);
      setSelectedPath(normalizedPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load directory: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    
    const initializePath = async () => {
      try {
        const parentPath = normalizePath(joinPath(...currentDirectory.split(/[\\/]/).filter(Boolean).slice(0, -1))) || currentDirectory;
        await loadDirectory(parentPath);
        setSelectedPath(parentPath);
        initializedRef.current = true;
      } catch (error) {
        console.error('Failed to load parent directory:', error);
        await loadDirectory(currentDirectory);
        setSelectedPath(currentDirectory);
        initializedRef.current = true;
      }
    };
    initializePath();
  }, [currentDirectory, loadDirectory]);

  const handleItemClick = useCallback(async (item: { path: string; type: string }) => {
    if (item.type === 'folder') {
      await loadDirectory(item.path);
    }
  }, [loadDirectory]);

  const goToParentDirectory = useCallback(async () => {
    if (!currentPath) {
      const parentPath = normalizePath(joinPath(...currentDirectory.split(/[\\/]/).filter(Boolean).slice(0, -1))) || currentDirectory;
      await loadDirectory(parentPath);
      return;
    }
    const parentPath = normalizePath(joinPath(...currentPath.split(/[\\/]/).filter(Boolean).slice(0, -1)));
    if (!parentPath || parentPath === currentPath) {
      return;
    } else {
      await loadDirectory(parentPath);
    }
  }, [currentPath, currentDirectory, loadDirectory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInDialog = dialogRef?.current?.contains(target) ?? false;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isQuickNavigating) return;
      if (isJumpModeActive) return;
      
      const quickNavigateInput = document.querySelector('input[placeholder*="Search files"], input[placeholder*="Navigate"]');
      if (quickNavigateInput && quickNavigateInput instanceof HTMLElement) {
        const overlay = quickNavigateInput.closest('[style*="display"], [style*="opacity"]');
        if (overlay && overlay instanceof HTMLElement) {
          const style = window.getComputedStyle(overlay);
          if (style.display !== 'none' && style.opacity !== '0' && style.visibility !== 'hidden') {
            return;
          }
        }
      }

      if (!dialogRef?.current || !isInDialog) return;
      if (isInputField) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const firstItem = items.filter(item => {
          if (!filterKeyword.trim()) return true;
          return item.name.toLowerCase().includes(filterKeyword.toLowerCase().trim());
        })[0];
        
        if (firstItem) {
          onSelectFolder(firstItem.path);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword('');
        return;
      }

      if (e.key === 'Backspace' && filterKeyword.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword(prev => prev.slice(0, -1));
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword(prev => prev + e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [filterKeyword, isQuickNavigating, dialogRef, items, onSelectFolder, isJumpModeActive]);

  const filteredItems = useMemo(() => {
    if (!filterKeyword.trim()) {
      return items;
    }
    const keyword = filterKeyword.toLowerCase().trim();
    return items.filter(item => 
      item.name.toLowerCase().includes(keyword)
    );
  }, [items, filterKeyword]);

  return (
    <Box ref={dialogRef} h="400px" display="flex" flexDirection="column" border="1px solid" borderColor={borderColor} borderRadius="md">
      <Flex
        p={2}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        gap={2}
        bg={useColorModeValue('gray.50', 'gray.700')}
      >
        <IconButton
          aria-label="Parent directory"
          icon={<ChevronUp size={16} />}
          size="xs"
          onClick={goToParentDirectory}
          variant="ghost"
        />
        <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} flex="1" noOfLines={1}>
          {currentPath || 'Computer'}
        </Text>
      </Flex>

      <Box flex="1" overflowY="auto" p={2}>
        {loading && (
          <Flex justify="center" align="center" h="100px">
            <Spinner size="md" />
          </Flex>
        )}
        
        {error && (
          <Text color="red.500" fontSize="sm" mb={2}>{error}</Text>
        )}
        
        {!loading && !error && filteredItems.length === 0 && (
          <Text color={useColorModeValue('gray.500', 'gray.400')} textAlign="center" mt={8}>
            {filterKeyword.trim() ? `No folders match "${filterKeyword}"` : 'This folder is empty'}
          </Text>
        )}
        
        {!loading && filteredItems.map((item, index) => (
          <Flex
            key={item.id || `${item.path}-${index}`}
            align="center"
            py={2}
            px={3}
            cursor="pointer"
            bg={selectedPath === item.path ? selectedBg : 'transparent'}
            _hover={{ bg: hoverBg }}
            borderRadius="md"
            onClick={() => handleItemClick(item)}
          >
            <Icon as={FolderOpen} boxSize={4} color="blue.500" mr={3} />
            <Text fontSize="sm" flex="1" noOfLines={1}>
              {item.name}
            </Text>
          </Flex>
        ))}
      </Box>

      <Flex p={3} borderTop="1px solid" borderColor={borderColor} gap={2} align="center" justify="space-between">
        {filterKeyword.trim() && (
          <Badge
            colorScheme="blue"
            bg={pillBg}
            color={pillColor}
            px={3}
            py={1.5}
            borderRadius="full"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            h="32px"
          >
            {filterKeyword}
            <IconButton
              aria-label="Clear filter"
              icon={<X size={12} />}
              size="xs"
              variant="ghost"
              h="auto"
              minW="auto"
              p={0}
              onClick={() => setFilterKeyword('')}
              _hover={{ bg: 'transparent', opacity: 0.7 }}
            />
          </Badge>
        )}
        {!filterKeyword.trim() && <Box />}
        
        <Flex gap={2}>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorScheme="blue"
            onClick={async () => {
              if (selectedPath) {
                await onSelectFolder(selectedPath);
              }
            }}
            isDisabled={!selectedPath}
          >
            Move Here
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};

// MoveToDialogWrapper Component
export interface MoveToDialogWrapperProps {
  onClose: () => void;
  moveToFiles: FileItem[];
  currentDirectory: string;
  onSelectFolder: (destPath: string) => Promise<void>;
  refreshDirectory: (path: string) => Promise<void>;
  setStatus: (message: string, type: 'info' | 'success' | 'error') => void;
  addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const MoveToDialogWrapper: React.FC<MoveToDialogWrapperProps> = ({
  onClose,
  moveToFiles,
  currentDirectory,
  onSelectFolder,
  refreshDirectory,
  setStatus,
  addLog,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayBg = useColorModeValue('blackAlpha.600', 'blackAlpha.800');
  const { isJumpModeActive, setIsJumpModeActive } = useAppContext();

  useEffect(() => {
    if (isJumpModeActive) {
      setIsJumpModeActive(false);
    }
    
    const timer = setTimeout(() => {
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [isJumpModeActive, setIsJumpModeActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInDialog = dialogRef.current?.contains(target) ?? false;
      
      if (e.key === 'Escape' && isInDialog) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey || e.altKey) && isInDialog) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
      return;
    }
    
    const target = e.target as HTMLElement;
    if (dialogRef.current && !dialogRef.current.contains(target)) {
      onClose();
    }
  };

  return (
    <Portal>
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg={overlayBg}
        backdropFilter="blur(4px)"
        zIndex={9999}
        onClick={handleOverlayClick}
        cursor="pointer"
      />
      <Box
        ref={dialogRef}
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg={useColorModeValue('white', 'gray.800')}
        border="1px solid"
        borderColor={useColorModeValue('gray.200', 'gray.600')}
        borderRadius="md"
        boxShadow="xl"
        zIndex={10000}
        w="600px"
        display="flex"
        flexDirection="column"
        maxH="90vh"
        tabIndex={-1}
        outline="none"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Flex
          align="center"
          justify="space-between"
          p={4}
          borderBottom="1px solid"
          borderColor={useColorModeValue('gray.200', 'gray.600')}
        >
          <Text fontSize="lg" fontWeight="semibold">
            Move {moveToFiles.length} file{moveToFiles.length > 1 ? 's' : ''} to...
          </Text>
          <IconButton
            aria-label="Close"
            icon={<X size={16} />}
            size="sm"
            variant="ghost"
            onClick={onClose}
          />
        </Flex>
        <Box p={4} flex="1" minH="0">
          <MoveToNavigation
            currentDirectory={currentDirectory}
            onSelectFolder={onSelectFolder}
            onCancel={onClose}
            dialogRef={dialogRef}
          />
        </Box>
      </Box>
    </Portal>
  );
};

// HeaderContextMenu Component
export interface HeaderContextMenuProps {
  headerContextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
  };
  columnVisibility: {
    name: boolean;
    size: boolean;
    modified: boolean;
    type: boolean;
  };
  toggleColumnVisibility: (column: string) => void;
  closeHeaderContextMenu: () => void;
}

export const HeaderContextMenu: React.FC<HeaderContextMenuProps> = ({
  headerContextMenu,
  columnVisibility,
  toggleColumnVisibility,
  closeHeaderContextMenu,
}) => {
  const menuBg = useColorModeValue('white', 'gray.800');
  const menuBorderColor = useColorModeValue('gray.200', 'gray.700');
  const menuHoverBg = useColorModeValue('gray.100', 'gray.700');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerContextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeHeaderContextMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [headerContextMenu.isOpen, closeHeaderContextMenu]);

  if (!headerContextMenu.isOpen) return null;

  return (
    <Portal>
      <Box
        ref={menuRef}
        data-column-menu
        position="fixed"
        left={headerContextMenu.position.x}
        top={headerContextMenu.position.y}
        zIndex={10000}
        bg={menuBg}
        border="1px solid"
        borderColor={menuBorderColor}
        borderRadius="0"
        boxShadow="lg"
        minW="200px"
        py={1}
      >
        {['name', 'size', 'modified', 'type'].map((column) => {
          const columnLabels: Record<string, string> = {
            name: 'Name',
            size: 'Size',
            modified: 'Modified',
            type: 'Type'
          };
          const isChecked = columnVisibility[column as keyof typeof columnVisibility];
          return (
            <Flex
              key={column}
              align="center"
              px={3}
              py={2}
              cursor="pointer"
              _hover={{ bg: menuHoverBg }}
              onClick={(e) => {
                e.stopPropagation();
                toggleColumnVisibility(column);
              }}
            >
              <Checkbox
                isChecked={isChecked}
                onChange={() => toggleColumnVisibility(column)}
                mr={2}
                pointerEvents="none"
                size="sm"
              >
                <Text fontSize="sm">{columnLabels[column]}</Text>
              </Checkbox>
            </Flex>
          );
        })}
      </Box>
    </Portal>
  );
};


