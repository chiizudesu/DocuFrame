import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Box,
  Text,
  Icon,
  Flex,
  Input,
  Image,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuDivider,
  IconButton,
} from '@chakra-ui/react'
import {
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Upload,
  Plus,
} from 'lucide-react'
import type { FileItem } from '../../types'
import { FileTableRowProps } from './FileGridUtils'
import { SortColumn } from './FileGridUtils'
import { getIndexInfo, getMaxIndexPillWidth } from '../../utils/indexPrefix'

// FileTableRow Component (extracted from FileGrid.tsx)
const FileTableRow = React.memo<FileTableRowProps>(({
  file,
  index,
  fileState,
  finalBg,
  columnOrder,
  columnVisibility,
  cellStyles,
  nativeIcons,
  fileTextColor,
  fileSubTextColor,
  formatFileSize,
  formatDate,
  observeFileElement,
  unobserveFileElement,
  rowHandlers,
  folderDropHandlers,
}) => {
  // Store observed element ref for proper unobserve when virtualized row unmounts
  const observedElRef = useRef<HTMLElement | null>(null);
  // Windows 11-style: thin blue outline - box-shadow per cell, only outer edges (no vertical lines between columns)
  const visibleColumns = columnOrder.filter(c => columnVisibility[c as keyof typeof columnVisibility]);
  const getSelectionBoxShadow = (col: string) => {
    if (!fileState.isFileSelected) return undefined;
    const idx = visibleColumns.indexOf(col);
    if (idx === -1) return undefined;
    const isFirst = idx === 0;
    const isLast = idx === visibleColumns.length - 1;
    const c = 'var(--chakra-colors-blue-600)';
    const parts: string[] = [
      `inset 0 1px 0 0 ${c}`,
      `inset 0 -1px 0 0 ${c}`,
    ];
    if (isFirst) parts.push(`inset 1px 0 0 0 ${c}`);
    if (isLast) parts.push(`inset -1px 0 0 0 ${c}`);
    return parts.join(', ');
  };

  return (
    <Box
      as="tr"
      onMouseEnter={() => rowHandlers.onMouseEnter(index)}
      onMouseLeave={(e) => rowHandlers.onMouseLeave(index, e)}
      onContextMenu={(e) => rowHandlers.onContextMenu(file, e)}
      onClick={(e) => rowHandlers.onClick(file, index, e)}
      onMouseDown={(e) => rowHandlers.onMouseDown(file, index, e)}
      onMouseUp={(e) => rowHandlers.onMouseUp(file, index, e)}
      draggable={rowHandlers.draggable}
      onDragStart={(e) => rowHandlers.onDragStart(file, index, e)}
      onDragEnd={rowHandlers.onDragEnd}
      {...folderDropHandlers}
      data-row-index={index}
      data-file-index={index}
      data-new-file-row={fileState.isFileNew ? 'true' : undefined}
    >
      {columnOrder.map((column, colIndex) => {
        const isName = column === 'name';
        const isSize = column === 'size';
        const isModified = column === 'modified';
        const isType = column === 'type';
        
        if (!columnVisibility[column as keyof typeof columnVisibility]) {
          return null;
        }
        
        const selectionShadow = getSelectionBoxShadow(column);
        
        if (isName) {
          return (
            <Box
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
              boxShadow={selectionShadow}
              ref={(el: HTMLElement | null) => {
                if (file.type === 'file') {
                  if (el) {
                    observedElRef.current = el;
                    observeFileElement(el, file.path);
                  } else {
                    const toUnobserve = observedElRef.current;
                    observedElRef.current = null;
                    if (toUnobserve) {
                      unobserveFileElement(toUnobserve);
                    }
                  }
                }
              }}
            >
              <Flex alignItems="center">
                {file.type === 'file' && nativeIcons.has(file.path) ? (
                  <Image
                    src={nativeIcons.get(file.path)!}
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
              </Flex>
              
            </Box>
          );
        } else if (isSize) {
          return (
            <Box
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
              boxShadow={selectionShadow}
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
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
              boxShadow={selectionShadow}
            >
              <Text 
                fontSize="xs" 
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {file.modified ? formatDate(file.modified) : '-'}
              </Text>
            </Box>
          );
        } else if (isType) {
          const getFileExtension = (filename: string): string => {
            if (file.type === 'folder') return 'Folder';
            const lastDot = filename.lastIndexOf('.');
            if (lastDot === -1 || lastDot === filename.length - 1) return 'File';
            return filename.substring(lastDot + 1).toUpperCase();
          };
          
          return (
            <Box
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
              boxShadow={selectionShadow}
            >
              <Text 
                fontSize="xs" 
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {getFileExtension(file.name)}
              </Text>
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
}, (prevProps, nextProps) => {
  const columnOrderChanged = prevProps.columnOrder.length !== nextProps.columnOrder.length ||
    prevProps.columnOrder.some((col, idx) => col !== nextProps.columnOrder[idx]);
  
  return (
    prevProps.file.path === nextProps.file.path &&
    prevProps.file.name === nextProps.file.name &&
    prevProps.file.size === nextProps.file.size &&
    prevProps.file.modified === nextProps.file.modified &&
    prevProps.index === nextProps.index &&
    prevProps.fileState.isFileSelected === nextProps.fileState.isFileSelected &&
    prevProps.fileState.isRowHovered === nextProps.fileState.isRowHovered &&
    prevProps.fileState.isFileCut === nextProps.fileState.isFileCut &&
    prevProps.fileState.isFileNew === nextProps.fileState.isFileNew &&
    prevProps.fileState.isFileDragged === nextProps.fileState.isFileDragged &&
    prevProps.finalBg === nextProps.finalBg &&
    prevProps.cellStyles === nextProps.cellStyles &&
    prevProps.rowHandlers === nextProps.rowHandlers &&
    prevProps.folderDropHandlers === nextProps.folderDropHandlers &&
    prevProps.nativeIcons.has(prevProps.file.path) === nextProps.nativeIcons.has(nextProps.file.path) &&
    prevProps.columnVisibility.name === nextProps.columnVisibility.name &&
    prevProps.columnVisibility.size === nextProps.columnVisibility.size &&
    prevProps.columnVisibility.modified === nextProps.columnVisibility.modified &&
    prevProps.columnVisibility.type === nextProps.columnVisibility.type &&
    !columnOrderChanged
  );
});

FileTableRow.displayName = 'FileTableRow';

// GroupHeaderDropZone Component (extracted from FileGrid.tsx)
interface GroupHeaderDropZoneProps {
  groupKey: string;
  indexInfo: ReturnType<typeof getIndexInfo>;
  fileCount: number;
  onDrop: (e: React.DragEvent) => void;
  transferTemplates: Array<{ command: string; filename: string }>;
  onTransfer: (opts: { command?: string; newName?: string }) => Promise<void>;
  pillBg: string;
  pillText: string;
  dividerColor: string;
  dropZoneBg: string;
  maxPillWidth: string;
  mt: number;
  clearFolderHoverStates: () => void;
}

const GroupHeaderDropZoneInner: React.FC<GroupHeaderDropZoneProps> = ({
  groupKey,
  indexInfo,
  fileCount,
  onDrop,
  transferTemplates,
  onTransfer,
  pillBg,
  pillText,
  dividerColor,
  dropZoneBg,
  maxPillWidth,
  mt,
  clearFolderHoverStates,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [manualFilename, setManualFilename] = useState('');
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const menuListBg = useColorModeValue('white', 'gray.800');
  const menuListBorder = useColorModeValue('gray.200', 'gray.700');
  const menuItemBg = useColorModeValue('gray.50', 'gray.700');
  const menuHoverBg = useColorModeValue('gray.100', 'gray.600');
  const menuPlaceholderColor = useColorModeValue('gray.400', 'gray.500');
  const inputBg = useColorModeValue('gray.50', 'gray.700');

  const handleTransferTemplate = (command: string) => {
    onTransfer({ command });
    setIsTransferMenuOpen(false);
  };

  const handleTransferManual = () => {
    const trimmed = manualFilename.trim();
    if (trimmed) {
      const hasIndexPrefix = /^[A-Z]+\d*\s+-\s+/.test(trimmed);
      const fullName = hasIndexPrefix ? trimmed : `${groupKey} - ${trimmed}`;
      onTransfer({ newName: fullName });
      setManualFilename('');
      setIsTransferMenuOpen(false);
    }
  };

  const checkAndSetDropEffect = (e: React.DragEvent): 'internal' | 'external' | 'none' => {
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
    const effectAllowed = e.dataTransfer.effectAllowed;
    
    const isInternal = hasCustomType || internalDragFlag;
    
    if (isInternal) {
      if (effectAllowed === 'copy' || (e.ctrlKey && effectAllowed !== 'move')) {
        e.dataTransfer.dropEffect = 'copy';
      } else if (effectAllowed === 'move' || (!e.ctrlKey && effectAllowed !== 'copy')) {
        e.dataTransfer.dropEffect = 'move';
      } else {
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      }
      return 'internal';
    } else if (hasFilesType || hasExternalFiles) {
      e.dataTransfer.dropEffect = 'copy';
      return 'external';
    } else {
      e.dataTransfer.dropEffect = 'none';
      return 'none';
    }
  };
  
  return (
    <Box
      mb={0.75}
      mt={mt}
      position="relative"
      data-group-drop-zone="true"
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        const dragType = checkAndSetDropEffect(e);
        if (dragType !== 'none') {
          setIsDraggingOver(true);
          setIsCopyMode(e.ctrlKey);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const dragType = checkAndSetDropEffect(e);
        if (dragType === 'none') {
          setIsDraggingOver(false);
          setIsCopyMode(false);
        } else {
          setIsCopyMode(e.ctrlKey);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
          setIsCopyMode(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const internalDragFlag = !!(window as any).__docuframeInternalDrag;
        const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
        const hasFilesType = e.dataTransfer.types.includes('Files');
        
        // Detect internal drags arriving as OS drops (Electron native startDrag)
        const isInternal = hasCustomType || internalDragFlag;
        const isExternal = hasFilesType && !isInternal;
        
        if (isInternal || isExternal) {
          onDrop(e);
        }
        
        setIsDraggingOver(false);
        setIsCopyMode(false);
        clearFolderHoverStates();
      }}
    >
      <Flex
        align="center"
        px={0}
        py={isDraggingOver ? 1.6 : 1.12}
        gap={2}
        minHeight="27px"
        bg={isDraggingOver ? dropZoneBg : 'transparent'}
        transition="background 0.15s ease"
        borderRadius={0}
        cursor={isDraggingOver ? 'copy' : 'default'}
      >
        <Box
          as="span"
          px={4}
          py={1.5}
          bg={pillBg}
          color={pillText}
          borderRadius={0}
          fontSize="xs"
          fontWeight="semibold"
          display="inline-flex"
          alignItems="center"
          width={maxPillWidth}
          minWidth={maxPillWidth}
          textAlign="left"
        >
          {isDraggingOver && isCopyMode && '📋 Copy to '}
          {groupKey}
          {indexInfo.description && ` - ${indexInfo.description}`}
        </Box>
        <Box flex="1" />
        <Flex align="center" gap={1}>
          <Box
            as="span"
            px={3}
            py={1.5}
            bg={pillBg}
            color={pillText}
            borderRadius={0}
            fontSize="xs"
            fontWeight="semibold"
            width="56px"
            textAlign="center"
          >
            {fileCount}
          </Box>
          <Menu closeOnSelect={false} isOpen={isTransferMenuOpen} onClose={() => { setManualFilename(''); setIsTransferMenuOpen(false); }} onOpen={() => setIsTransferMenuOpen(true)} placement="bottom-end" strategy="fixed">
            <MenuButton
              as={IconButton}
              aria-label="Transfer to this group"
              icon={<Plus size={12} />}
              size="xs"
              variant="ghost"
              minW={6}
              h={6}
              color={pillText}
              bg={pillBg}
              borderRadius={0}
              _hover={{ bg: dropZoneBg }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
            <MenuList
              bg={menuListBg}
              borderColor={menuListBorder}
              minW="200px"
              maxW="50ch"
              p={3}
              zIndex={10000}
            >
              {transferTemplates.length === 0 ? (
                <Box py={2.5} px={4} my={0.5} borderRadius="md" bg={menuItemBg}>
                  <Text fontSize="sm" color={menuPlaceholderColor}>No templates</Text>
                </Box>
              ) : (
                transferTemplates.map((t) => {
                  const displayText = t.filename.length > 50 ? t.filename.slice(0, 47) + '...' : t.filename;
                  return (
                    <Box
                      key={t.command}
                      as="button"
                      type="button"
                      w="100%"
                      textAlign="left"
                      py={2.5}
                      px={4}
                      my={0.5}
                      fontSize="sm"
                      borderRadius="md"
                      bg={menuItemBg}
                      cursor="pointer"
                      border="none"
                      onClick={() => handleTransferTemplate(t.command)}
                      _hover={{ bg: menuHoverBg }}
                      _focus={{ bg: menuHoverBg }}
                      _focusVisible={{ outline: '2px solid', outlineColor: 'blue.400', outlineOffset: '1px' }}
                      title={t.filename}
                    >
                      {displayText}
                    </Box>
                  );
                })
              )}
              <MenuDivider borderColor={menuListBorder} my={2} />
              <Box w="100%" my={0.5} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Input
                  ref={manualInputRef}
                  w="100%"
                  py={2.5}
                  px={4}
                  h="auto"
                  minH="40px"
                  fontSize="sm"
                  borderRadius="md"
                  bg={inputBg}
                  border="1px solid"
                  borderColor={menuListBorder}
                  placeholder="New filename to transfer..."
                  value={manualFilename}
                  onChange={(e) => setManualFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTransferManual();
                    }
                  }}
                  _placeholder={{ color: menuPlaceholderColor }}
                  _hover={{ borderColor: menuHoverBg }}
                  _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
                />
              </Box>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>
      <Box 
        height="1px" 
        bg={dividerColor} 
        width="100%" 
        position="absolute"
        bottom={0}
        left={0}
      />
      {isDraggingOver && (
        <Flex
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
          align="center"
          justify="center"
          bg="rgba(59,130,246,0.08)"
          border="1px dashed"
          borderColor="blue.400"
        >
          <Icon as={Upload} boxSize={3.5} color="blue.400" mr={2} />
          <Text fontSize="xs" fontWeight="semibold" color="blue.400">
            Drop to assign
          </Text>
        </Flex>
      )}
    </Box>
  );
};

const GroupHeaderDropZone = React.memo(GroupHeaderDropZoneInner);

// FileListView Component (replaces renderListView function)
export interface FileListViewProps {
  // Refs
  dropAreaRef: React.RefObject<HTMLDivElement>;
  gridContainerRef: React.RefObject<HTMLDivElement>;
  renameInputRef: React.RefObject<HTMLInputElement>;
  
  // State
  isDragOver: boolean;
  isSelecting: boolean;
  selectionRect: { startX: number; startY: number; currentX: number; currentY: number } | null;
  isGroupedByIndex: boolean;
  groupedFiles: Record<string, FileItem[]> | null;
  sortedFiles: FileItem[];
  columnOrder: string[];
  columnVisibility: { name: boolean; size: boolean; modified: boolean; type: boolean };
  columnWidths: { name: number; size: number; modified: number; type: number };
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  draggingColumn: string | null;
  dragTargetColumn: string | null;
  dragMousePos: { x: number; y: number } | null;
  dragOffset: { x: number; y: number };
  isDragThresholdMet: boolean;
  hasDraggedColumn: boolean;
  isRenaming: string | null;
  renameValue: string;
  fileGridBackgroundUrl: string;
  fileGridBackgroundPath: string;
  backgroundFillUrl: string;
  backgroundFillPath: string;
  backgroundType: 'watermark' | 'backgroundFill';
  enableBackgrounds: boolean;
  nativeIcons: Map<string, string>;
  getFileStateForIndex: (file: FileItem, index: number) => {
    isFileSelected: boolean;
    isRowHovered: boolean;
    isFileCut: boolean;
    isFileNew: boolean;
    isFileDragged: boolean;
  };
  memoizedArraySignature: string;
  rowSelectedBg: string;
  rowDefaultBg: string;
  newFileHighlightBg: string;
  searchHighlightBg: string;
  folderDropBgColor: string;
  fileSearchFilter: string | undefined;
  
  // Color values
  tableHeadTextColor: string;
  headerHoverBg: string;
  headerStickyBg: string;
  rowHoverBg: string;
  hoveredRowIndex: number | null;
  folderHoverState: Set<string>;
  headerDividerBg: string;
  dragGhostBg: string;
  dragGhostBorder: string;
  dragGhostAccent: string;
  fileTextColor: string;
  fileSubTextColor: string;
  
  // Handlers
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleSelectionMouseDown: (e: React.MouseEvent) => void;
  handleBackgroundClick: (e: React.MouseEvent) => void;
  getSmartMenuPosition: (clientX: number, clientY: number, menuHeight?: number) => { x: number; y: number };
  setBlankContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number } }) => void;
  setHeaderContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number } }) => void;
  handleSort: (column: SortColumn) => void;
  autoFitColumn: (column: string) => void;
  handleColumnDragStart: (column: string, e: React.MouseEvent) => void;
  handleResizeStart: (column: string, e: React.MouseEvent) => void;
  handleGroupHeaderDrop: (e: React.DragEvent, groupKey: string) => Promise<void>;
  groupedTransferTemplates: Record<string, Array<{ command: string; filename: string }>>;
  onTransferFromGroupHeader: (opts: { command?: string; newName?: string }) => Promise<void>;
  rowHandlers: {
    onMouseEnter: (index: number) => void;
    onMouseLeave: (index: number, e: React.MouseEvent) => void;
    onContextMenu: (file: FileItem, e: React.MouseEvent) => void;
    onClick: (file: FileItem, index: number, e?: React.MouseEvent) => void;
    onMouseDown: (file: FileItem, index: number, e: React.MouseEvent) => void;
    onMouseUp: (file: FileItem, index: number, e: React.MouseEvent) => void;
    draggable: boolean;
    onDragStart: (file: FileItem, index: number, e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
  createFolderDropHandlers: (file: FileItem, index: number) => any;
  observeFileElement: (element: HTMLElement | null, filePath: string) => void;
  unobserveFileElement: (element: HTMLElement | null) => void;
  formatFileSize: (size: string | undefined) => string;
  formatDate: (dateString: string) => string;
  handleRenameSubmit: (e?: React.FormEvent) => void;
  handleRenameCancel?: () => void;
  setIsRenaming: (name: string | null) => void;
  setRenameValue: (value: string) => void;
  setFileGridBackgroundUrl: (url: string) => void;
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  setSelectedFile: (file: string | null) => void;
  clearFolderHoverStates: () => void;
  
  // Cell styles
  cellStyles: {
    bg: string;
    transition: string;
    cursor: string;
    px: number;
    py: number;
    position: 'relative';
    verticalAlign: 'middle';
    pointerEvents: 'auto';
  };
}

const FileListViewInner: React.FC<FileListViewProps> = ({
  dropAreaRef,
  gridContainerRef,
  renameInputRef,
  isDragOver,
  isSelecting,
  selectionRect,
  isGroupedByIndex,
  groupedFiles,
  sortedFiles,
  columnOrder,
  columnVisibility,
  columnWidths,
  sortColumn,
  sortDirection,
  draggingColumn,
  dragTargetColumn,
  dragMousePos,
  dragOffset,
  isDragThresholdMet,
  hasDraggedColumn,
  isRenaming,
  renameValue,
  fileGridBackgroundUrl,
  fileGridBackgroundPath,
  backgroundFillUrl,
  backgroundFillPath,
  backgroundType,
  enableBackgrounds,
  nativeIcons,
  getFileStateForIndex,
  memoizedArraySignature,
  rowSelectedBg,
  rowDefaultBg,
  newFileHighlightBg,
  searchHighlightBg,
  folderDropBgColor,
  fileSearchFilter,
  tableHeadTextColor,
  headerHoverBg,
  headerStickyBg,
  rowHoverBg,
  hoveredRowIndex,
  folderHoverState,
  headerDividerBg,
  dragGhostBg,
  dragGhostBorder,
  dragGhostAccent,
  fileTextColor,
  fileSubTextColor,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleSelectionMouseDown,
  handleBackgroundClick,
  getSmartMenuPosition,
  setBlankContextMenu,
  setHeaderContextMenu,
  handleSort,
  autoFitColumn,
  handleColumnDragStart,
  handleResizeStart,
  handleGroupHeaderDrop,
  groupedTransferTemplates,
  onTransferFromGroupHeader,
  rowHandlers,
  createFolderDropHandlers,
  observeFileElement,
  unobserveFileElement,
  formatFileSize,
  formatDate,
  handleRenameSubmit,
  handleRenameCancel,
  setIsRenaming,
  setRenameValue,
  setFileGridBackgroundUrl,
  selectedFiles,
  setSelectedFiles,
  setSelectedFile,
  clearFolderHoverStates,
  cellStyles,
}) => {
  const onRenameCancel = typeof handleRenameCancel === 'function' ? handleRenameCancel : () => { setIsRenaming(null); setRenameValue(''); };
  const pillBg = useColorModeValue('blue.100', 'blue.900'); // Light: more visible; dark: unchanged
  const pillText = useColorModeValue('blue.700', 'blue.200');
  const dividerColor = useColorModeValue('gray.200', 'gray.600');
  const dropZoneBg = useColorModeValue('blue.100', 'blue.800');
  const bgFillOpacity = useColorModeValue(0.05, 0.10); // Light: subtler; dark: unchanged
  const maxPillWidth = useMemo(() => {
    const maxLength = getMaxIndexPillWidth();
    return `${Math.max(maxLength * 7, 140)}px`;
  }, []);

  // Virtualizer for ungrouped list (flat sortedFiles). Disabled when grouped to avoid wasted work.
  const ROW_HEIGHT_ESTIMATE = 30;
  const virtualizerCount = isGroupedByIndex ? 0 : sortedFiles.length;
  const rowVirtualizer = useVirtualizer({
    count: virtualizerCount,
    getScrollElement: () => dropAreaRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 5,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;

  // Per-row caches for referential stability - only ~visible rows touched, so selection change re-renders only 2 rows
  const fileStateCacheRef = useRef<Map<string, { isFileSelected: boolean; isRowHovered: boolean; isFileCut: boolean; isFileNew: boolean; isFileDragged: boolean }>>(new Map());
  const cellStylesCacheRef = useRef<Map<string, typeof cellStyles & { bg: string }>>(new Map());
  const hasActiveSearch = Boolean(fileSearchFilter && fileSearchFilter.trim());

  useEffect(() => {
    const paths = new Set(sortedFiles.map(f => f.path));
    fileStateCacheRef.current.forEach((_, path) => { if (!paths.has(path)) fileStateCacheRef.current.delete(path); });
    cellStylesCacheRef.current.forEach((_, key) => {
      if (typeof key !== 'string') {
        cellStylesCacheRef.current.delete(key as any);
        return;
      }
      const path = key.split('\x01')[0];
      if (!paths.has(path)) cellStylesCacheRef.current.delete(key);
    });
  }, [sortedFiles]);

  const getRowProps = useCallback((file: FileItem, index: number) => {
    const baseState = getFileStateForIndex(file, index);
    const fileState = { ...baseState, isRowHovered: hoveredRowIndex === index };
    const cachedState = fileStateCacheRef.current.get(file.path);
    const stableFileState = (cachedState && cachedState.isFileSelected === fileState.isFileSelected && cachedState.isRowHovered === fileState.isRowHovered &&
        cachedState.isFileCut === fileState.isFileCut && cachedState.isFileNew === fileState.isFileNew && cachedState.isFileDragged === fileState.isFileDragged)
      ? cachedState
      : (fileStateCacheRef.current.set(file.path, fileState), fileState);

    const isSearchHighlight = hasActiveSearch && index === 0;
    const rowBg = stableFileState.isFileNew ? newFileHighlightBg : (stableFileState.isFileSelected ? rowSelectedBg : (isSearchHighlight ? searchHighlightBg : rowDefaultBg));
    const baseBg = (file.type === 'folder' && folderHoverState.has(file.path)) ? folderDropBgColor : rowBg;
    const finalBg = (hoveredRowIndex === index && !folderHoverState.has(file.path)) ? rowHoverBg : baseBg;

    const cacheKey = `${file.path}\x01${finalBg}`;
    let finalCellStyles = cellStylesCacheRef.current.get(cacheKey);
    if (!finalCellStyles) {
      finalCellStyles = { ...cellStyles, bg: finalBg };
      cellStylesCacheRef.current.set(cacheKey, finalCellStyles);
    }
    return { fileState: stableFileState, finalBg, finalCellStyles };
  }, [getFileStateForIndex, hoveredRowIndex, folderHoverState, hasActiveSearch, rowSelectedBg, rowDefaultBg, newFileHighlightBg, searchHighlightBg, rowHoverBg, folderDropBgColor, cellStyles]);

  // Scroll rename row into view when isRenaming is set (ungrouped only)
  useEffect(() => {
    if (isRenaming && sortedFiles.length > 0 && !isGroupedByIndex) {
      const idx = sortedFiles.findIndex(f => f.name === isRenaming);
      if (idx >= 0) {
        rowVirtualizerRef.current.scrollToIndex(idx, { align: 'start' });
      }
    }
  }, [isRenaming, sortedFiles, isGroupedByIndex]);

  // Detect when new files are outside visible rows for glowing line indicator
  const [newFileAboveVisible, setNewFileAboveVisible] = useState(false);
  const [newFileBelowVisible, setNewFileBelowVisible] = useState(false);

  useEffect(() => {
    const container = dropAreaRef.current;
    if (!container) return;

    const checkVisibility = () => {
      if (isGroupedByIndex) {
        // Grouped: all rows in DOM, check via getBoundingClientRect
        const containerRect = container.getBoundingClientRect();
        const rows = container.querySelectorAll('[data-new-file-row="true"]');
        let above = false;
        let below = false;
        rows.forEach((row) => {
          const r = row.getBoundingClientRect();
          if (r.bottom < containerRect.top) above = true;
          if (r.top > containerRect.bottom) below = true;
        });
        setNewFileAboveVisible(above);
        setNewFileBelowVisible(below);
      } else {
        // Virtualized: use virtualItems to know visible range
        const newFileIndices = sortedFiles
          .map((f, i) => (getFileStateForIndex(f, i).isFileNew ? i : -1))
          .filter((i) => i >= 0);
        if (newFileIndices.length === 0) {
          setNewFileAboveVisible(false);
          setNewFileBelowVisible(false);
          return;
        }
        const firstVisible = virtualItems[0]?.index ?? -1;
        const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? -1;
        const above = newFileIndices.some((i) => i < firstVisible);
        const below = newFileIndices.some((i) => i > lastVisible);
        setNewFileAboveVisible(above);
        setNewFileBelowVisible(below);
      }
    };

    checkVisibility();
    container.addEventListener('scroll', checkVisibility);
    const ro = new ResizeObserver(checkVisibility);
    ro.observe(container);
    return () => {
      container.removeEventListener('scroll', checkVisibility);
      ro.disconnect();
    };
  }, [isGroupedByIndex, sortedFiles, virtualItems, getFileStateForIndex]);
  
  return (
    <Box 
      position="relative"
      height="100%"
      width="100%"
      overflow="hidden"
    >
      {/* Background Fill - Full filegrid coverage, theme-aware opacity - Fixed to container, doesn't scroll */}
      {enableBackgrounds && backgroundType === 'backgroundFill' && backgroundFillUrl && (
        <Box
          position="absolute"
          top="35px"
          left={0}
          right={0}
          bottom={0}
          zIndex={0}
          pointerEvents="none"
          style={{
            backgroundImage: `url(${backgroundFillUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: bgFillOpacity,
          }}
        />
      )}
      
      {/* Glowing green line when new file is above visible rows */}
      {newFileAboveVisible && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          height="4px"
          bg="green.400"
          opacity={0.9}
          zIndex={998}
          pointerEvents="none"
          boxShadow="0 0 12px 4px rgba(72, 187, 120, 0.6)"
        />
      )}
      {/* Glowing green line when new file is below visible rows */}
      {newFileBelowVisible && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          height="4px"
          bg="green.400"
          opacity={0.9}
          zIndex={998}
          pointerEvents="none"
          boxShadow="0 0 12px 4px rgba(72, 187, 120, 0.6)"
        />
      )}
      {/* Watermark - Bottom-right corner, 100% opacity - Fixed to container, doesn't scroll */}
      {enableBackgrounds && backgroundType === 'watermark' && fileGridBackgroundUrl && (
        <Box
          position="absolute"
          bottom="150px"
          right={0}
          zIndex={0}
          pointerEvents="none"
          maxW="320px"
          maxH="320px"
        >
          <Image
            src={fileGridBackgroundUrl}
            alt="File grid corner mascot"
            maxW="100%"
            maxH="100%"
            objectFit="contain"
            opacity={1}
            userSelect="none"
            draggable={false}
            style={{ WebkitUserSelect: 'none', userSelect: 'none', display: 'block' }}
            onError={(e) => {
              console.error('Failed to load watermark image:', fileGridBackgroundPath);
              setFileGridBackgroundUrl('');
            }}
          />
        </Box>
      )}
      
      {/* Legacy support: if backgroundType is not set but fileGridBackgroundUrl exists, show as corner mascot */}
      {enableBackgrounds && !backgroundType && fileGridBackgroundUrl && (
        <Box
          position="absolute"
          bottom="150px"
          right={0}
          zIndex={0}
          pointerEvents="none"
          maxW="320px"
          maxH="320px"
        >
          <Image
            src={fileGridBackgroundUrl}
            alt="File grid background"
            maxW="100%"
            maxH="100%"
            objectFit="contain"
            opacity={1}
            userSelect="none"
            draggable={false}
            style={{ WebkitUserSelect: 'none', userSelect: 'none', display: 'block' }}
            onError={(e) => {
              console.error('Failed to load background image:', fileGridBackgroundPath);
              setFileGridBackgroundUrl('');
            }}
          />
        </Box>
      )}
      
      {/* Scrollable content container */}
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
        onMouseDown={handleSelectionMouseDown}
        style={{ userSelect: isSelecting ? 'none' : 'auto' }}
        onContextMenu={e => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            const position = getSmartMenuPosition(e.clientX, e.clientY, 150);
            setBlankContextMenu({ isOpen: true, position });
          }
        }}
        onClick={handleBackgroundClick}
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
      
      {/* Drag selection rectangle overlay */}
      {isSelecting && selectionRect && (
        <Box
          position="absolute"
          border="1.5px solid"
          borderColor="rgba(96, 165, 250, 0.9)"
          bg="rgba(59, 130, 246, 0.15)"
          pointerEvents="none"
          zIndex={999}
          transition="all 0.05s ease-out"
          style={{
            left: Math.min(selectionRect.startX, selectionRect.currentX),
            top: Math.min(selectionRect.startY, selectionRect.currentY),
            width: Math.abs(selectionRect.currentX - selectionRect.startX),
            height: Math.abs(selectionRect.currentY - selectionRect.startY),
          }}
        />
      )}
      
      {isGroupedByIndex && groupedFiles && Object.keys(groupedFiles).length > 0 ? (
        <>
          <Box
            as="table"
            ref={gridContainerRef}
            width="fit-content"
            fontSize="xs"
            userSelect="none"
            minWidth="690px"
            position="relative"
            style={{
              borderCollapse: 'separate',
              borderSpacing: '0 3px',
              tableLayout: 'fixed'
            }}
          >
            <colgroup>
              {columnOrder.map((column) => {
                if (!columnVisibility[column as keyof typeof columnVisibility]) return null;
                return (
                  <col
                    key={column}
                    style={{ width: `${columnWidths[column as keyof typeof columnWidths]}px` }}
                  />
                );
              })}
            </colgroup>

            <Box as="thead">
              <Box as="tr">
                {columnOrder.map((column) => {
                  const isName = column === 'name';
                  const isSize = column === 'size';
                  const isModified = column === 'modified';
                  const isType = column === 'type';
                  
                  if (!columnVisibility[column as keyof typeof columnVisibility]) {
                    return null;
                  }
                  
                  return (
                    <Box
                      as="th"
                      key={column}
                      px={2}
                      py={2}
                      fontWeight="medium"
                      fontSize="xs"
                      color={tableHeadTextColor}
                      cursor="pointer"
                      _hover={{ bg: headerHoverBg }}
                      role="group"
                      verticalAlign="middle"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHeaderContextMenu({
                          isOpen: true,
                          position: { x: e.clientX, y: e.clientY }
                        });
                      }}
                      onClick={(e) => {
                        if (hasDraggedColumn) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const isInResizeArea = clickX > rect.width - 4;
                        if (!isInResizeArea) {
                          handleSort(column as SortColumn);
                        }
                      }}
                      onDoubleClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const isInResizeArea = clickX > rect.width - 4;
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
                      borderLeft={draggingColumn && dragTargetColumn === column ? '2px solid #4F46E5' : undefined}
                      transition="all 0.2s ease"
                    >
                      <Flex alignItems="center">
                        {isName ? 'Name' : isSize ? 'Size' : isModified ? 'Modified' : isType ? 'Type' : ''}
                        {sortColumn === column && (
                          <Icon
                            as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                            ml={1}
                            boxSize={2.5}
                            color="#4F46E5"
                          />
                        )}
                      </Flex>

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
                        width="4px"
                        cursor="col-resize"
                        _hover={{ bg: dragGhostAccent }}
                        onMouseDown={(e) => handleResizeStart(column, e)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
            </Box>

            <Box as="tbody">
              {groupedFiles.folders && groupedFiles.folders.length > 0 && (
                <>
                  {groupedFiles.folders.map((file, fileIndex) => {
                    const globalIndex = sortedFiles.findIndex(f => f.path === file.path);
                    const index = globalIndex >= 0 ? globalIndex : fileIndex;

                    if (isRenaming === file.name) {
                      return (
                        <Box as="tr" key={index}>
                          <Box as="td" colSpan={columnOrder.length} px={2} py={1}>
                            <form onSubmit={handleRenameSubmit}>
                              <Input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={onRenameCancel}
                                autoFocus
                                size="xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') onRenameCancel()
                                }}
                              />
                            </form>
                          </Box>
                        </Box>
                      )
                    }

                    const { fileState, finalBg, finalCellStyles } = getRowProps(file, index);
                    const folderDropHandlers = createFolderDropHandlers(file, index);

                    return (
                      <FileTableRow
                        key={file.path}
                        file={file}
                        index={index}
                        fileState={fileState}
                        finalBg={finalBg}
                        columnOrder={columnOrder}
                        columnVisibility={columnVisibility}
                        cellStyles={finalCellStyles}
                        nativeIcons={nativeIcons}
                        fileTextColor={fileTextColor}
                        fileSubTextColor={fileSubTextColor}
                        formatFileSize={formatFileSize}
                        formatDate={formatDate}
                        observeFileElement={observeFileElement}
                        unobserveFileElement={unobserveFileElement}
                        rowHandlers={rowHandlers}
                        folderDropHandlers={folderDropHandlers}
                      />
                    );
                  })}
                </>
              )}
              {Object.entries(groupedFiles)
                .filter(([key]) => key !== 'folders')
                .sort(([a], [b]) => {
                  // AA always comes first
                  if (a === 'AA') return -1;
                  if (b === 'AA') return 1;
                  // Other always comes last
                  if (a === 'Other') return 1;
                  if (b === 'Other') return -1;
                  // Everything else sorted alphabetically
                  return a.localeCompare(b);
                })
                .map(([groupKey, groupFiles], groupIndex) => {
                  const indexInfo = getIndexInfo(groupKey);
                  const hasFolderSection = Boolean(groupedFiles.folders && groupedFiles.folders.length);
                  const mtValue = groupIndex === 0 ? (hasFolderSection ? 0.5 : 0) : 1.5;
                  
                  return (
                    <React.Fragment key={groupKey}>
                      <Box as="tr">
                        <Box
                          as="td"
                          colSpan={columnOrder.length}
                          px={0}
                          py={2}
                          bg="transparent"
                        >
                          <GroupHeaderDropZone
                            groupKey={groupKey}
                            indexInfo={indexInfo}
                            fileCount={groupFiles.length}
                            onDrop={(e) => handleGroupHeaderDrop(e, groupKey)}
                            transferTemplates={groupedTransferTemplates[groupKey] ?? []}
                            onTransfer={onTransferFromGroupHeader}
                            pillBg={pillBg}
                            pillText={pillText}
                            dividerColor={dividerColor}
                            dropZoneBg={dropZoneBg}
                            maxPillWidth={maxPillWidth}
                            mt={mtValue}
                            clearFolderHoverStates={clearFolderHoverStates}
                          />
                        </Box>
                      </Box>
                      
                      {groupFiles.map((file, fileIndex) => {
                        const globalIndex = sortedFiles.findIndex(f => f.path === file.path);
                        const index = globalIndex >= 0 ? globalIndex : fileIndex;
                        
                        if (isRenaming === file.name) {
                          return (
                            <Box as="tr" key={index}>
                              <Box
                                as="td"
                                colSpan={columnOrder.length}
                                px={2}
                                py={1}
                              >
                                <form onSubmit={handleRenameSubmit}>
                                  <Input
                                    ref={renameInputRef}
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={onRenameCancel}
                                    autoFocus
                                    size="xs"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') onRenameCancel()
                                    }}
                                  />
                                </form>
                              </Box>
                            </Box>
                          )
                        }

                        const { fileState, finalBg, finalCellStyles } = getRowProps(file, index);
                        const folderDropHandlers = createFolderDropHandlers(file, index);

                        return (
                          <FileTableRow
                            key={file.path}
                            file={file}
                            index={index}
                            fileState={fileState}
                            finalBg={finalBg}
                            columnOrder={columnOrder}
                            columnVisibility={columnVisibility}
                            cellStyles={finalCellStyles}
                            nativeIcons={nativeIcons}
                            fileTextColor={fileTextColor}
                            fileSubTextColor={fileSubTextColor}
                            formatFileSize={formatFileSize}
                            formatDate={formatDate}
                            observeFileElement={observeFileElement}
                            unobserveFileElement={unobserveFileElement}
                            rowHandlers={rowHandlers}
                            folderDropHandlers={folderDropHandlers}
                          />
                        )
                      })}
                    </React.Fragment>
                  );
                })}
            </Box>
          </Box>
        </>
      ) : (
        <>
          <Box
            as="table"
            ref={gridContainerRef}
            width="fit-content"
            fontSize="xs"
            userSelect="none"
            minWidth="690px"
            position="relative"
            style={{
              borderCollapse: 'separate',
              borderSpacing: '0 3px',
              tableLayout: 'fixed'
            }}
          >
            <colgroup>
              {columnOrder.map((column) => {
                if (!columnVisibility[column as keyof typeof columnVisibility]) return null;
                return (
                  <col
                    key={column}
                    style={{ width: `${columnWidths[column as keyof typeof columnWidths]}px` }}
                  />
                );
              })}
            </colgroup>

            <Box as="thead">
              <Box as="tr">
                {columnOrder.map((column) => {
                  const isName = column === 'name';
                  const isSize = column === 'size';
                  const isModified = column === 'modified';
                  const isType = column === 'type';
                  
                  if (!columnVisibility[column as keyof typeof columnVisibility]) {
                    return null;
                  }
                  
                  return (
                    <Box
                      as="th"
                      key={column}
                      px={2}
                      py={2}
                      fontWeight="medium"
                      fontSize="xs"
                      color={tableHeadTextColor}
                      cursor="pointer"
                      _hover={{ bg: headerHoverBg }}
                      role="group"
                      verticalAlign="middle"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHeaderContextMenu({
                          isOpen: true,
                          position: { x: e.clientX, y: e.clientY }
                        });
                      }}
                      onClick={(e) => {
                        if (hasDraggedColumn) {
                          return;
                        }
                        
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const isInResizeArea = clickX > rect.width - 4;
                        
                        if (!isInResizeArea) {
                          handleSort(column as SortColumn);
                        }
                      }}
                      onDoubleClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const isInResizeArea = clickX > rect.width - 4;
                        
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
                      borderLeft={draggingColumn && dragTargetColumn === column ? '2px solid #4F46E5' : undefined}
                      transition="all 0.2s ease"
                    >
                      <Flex alignItems="center">
                        {isName ? 'Name' : isSize ? 'Size' : isModified ? 'Modified' : isType ? 'Type' : ''}
                        {sortColumn === column && (
                          <Icon
                            as={sortDirection === 'asc' ? ChevronUp : ChevronDown}
                            ml={1}
                            boxSize={2.5}
                            color="#4F46E5"
                          />
                        )}
                      </Flex>

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
                        width="4px"
                        cursor="col-resize"
                        _hover={{ bg: dragGhostAccent }}
                        onMouseDown={(e) => handleResizeStart(column, e)}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
            </Box>

            <Box as="tbody">
              {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                <Box as="tr">
                  <Box
                    as="td"
                    colSpan={columnOrder.length}
                    style={{ height: virtualItems[0].start, padding: 0, border: 'none', lineHeight: 0 }}
                  />
                </Box>
              )}
              {virtualItems.map((virtualRow) => {
                const index = virtualRow.index;
                const file = sortedFiles[index];
                if (!file) return null;

                if (isRenaming === file.name) {
                  return (
                    <Box as="tr" key={file.path}>
                      <Box
                        as="td"
                        colSpan={columnOrder.length}
                        px={2}
                        py={1}
                      >
                        <form onSubmit={handleRenameSubmit}>
                          <Input
                            ref={renameInputRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={onRenameCancel}
                            autoFocus
                            size="xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') onRenameCancel()
                            }}
                          />
                        </form>
                      </Box>
                    </Box>
                  );
                }

                const { fileState, finalBg, finalCellStyles } = getRowProps(file, index);
                const folderDropHandlers = createFolderDropHandlers(file, index);

                return (
                  <FileTableRow
                    key={file.path}
                    file={file}
                    index={index}
                    fileState={fileState}
                    finalBg={finalBg}
                    columnOrder={columnOrder}
                    columnVisibility={columnVisibility}
                    cellStyles={finalCellStyles}
                    nativeIcons={nativeIcons}
                    fileTextColor={fileTextColor}
                    fileSubTextColor={fileSubTextColor}
                    formatFileSize={formatFileSize}
                    formatDate={formatDate}
                    observeFileElement={observeFileElement}
                    unobserveFileElement={unobserveFileElement}
                    rowHandlers={rowHandlers}
                    folderDropHandlers={folderDropHandlers}
                  />
                );
              })}
              {virtualItems.length > 0 && (() => {
                const lastItem = virtualItems[virtualItems.length - 1];
                const offsetBottom = totalSize - lastItem.end;
                return offsetBottom > 0 ? (
                  <Box as="tr">
                    <Box
                      as="td"
                      colSpan={columnOrder.length}
                      style={{ height: offsetBottom, padding: 0, border: 'none', lineHeight: 0 }}
                    />
                  </Box>
                ) : null;
              })()}
            </Box>
          </Box>

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
        </>
      )}
      </Box>
    </Box>
  );
};

function fileListViewPropsEqual(prev: FileListViewProps, next: FileListViewProps): boolean {
  if (prev.sortedFiles !== next.sortedFiles) return false;
  if (prev.isGroupedByIndex !== next.isGroupedByIndex) return false;
  if (prev.groupedFiles !== next.groupedFiles) return false;
  if (prev.newFileHighlightBg !== next.newFileHighlightBg) return false;
  // O(1) skip: when signature equal, arrays are semantically equal
  if (prev.memoizedArraySignature !== next.memoizedArraySignature) return false;
  if (prev.isDragOver !== next.isDragOver || prev.isSelecting !== next.isSelecting) return false;
  if (prev.selectionRect !== next.selectionRect) return false;
  if (prev.isRenaming !== next.isRenaming || prev.renameValue !== next.renameValue) return false;
  if (prev.nativeIcons !== next.nativeIcons) return false;
  if (prev.columnOrder !== next.columnOrder || prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.columnWidths !== next.columnWidths) return false;
  if (prev.draggingColumn !== next.draggingColumn || prev.dragTargetColumn !== next.dragTargetColumn) return false;
  if (prev.dragMousePos !== next.dragMousePos || prev.dragOffset !== next.dragOffset) return false;
  if (prev.rowHandlers !== next.rowHandlers) return false;
  if (prev.getFileStateForIndex !== next.getFileStateForIndex) return false;
  return true;
}

export const FileListView = React.memo(FileListViewInner, fileListViewPropsEqual);


