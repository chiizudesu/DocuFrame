import React, { useState, useMemo, useEffect } from 'react'
import {
  Box,
  Text,
  Icon,
  Flex,
  Input,
  Image,
  useColorModeValue,
} from '@chakra-ui/react'
import {
  FolderOpen,
  ChevronUp,
  ChevronDown,
  Upload,
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
  return (
    <Box
      as="tr"
      {...rowHandlers}
      {...folderDropHandlers}
      data-row-index={index}
      data-file-index={index}
    >
      {columnOrder.map((column, colIndex) => {
        const isName = column === 'name';
        const isSize = column === 'size';
        const isModified = column === 'modified';
        const isType = column === 'type';
        
        if (!columnVisibility[column as keyof typeof columnVisibility]) {
          return null;
        }
        
        if (isName) {
          return (
            <Box
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
              ref={(el: HTMLElement | null) => {
                if (file.type === 'file') {
                  if (el) {
                    observeFileElement(el, file.path);
                  } else {
                    const existingEl = document.querySelector(`[data-file-path="${file.path}"]`) as HTMLElement;
                    if (existingEl) {
                      unobserveFileElement(existingEl);
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
              as="td"
              key={`${file.path}-${column}-${colIndex}`}
              {...cellStyles}
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
  pillBg: string;
  pillText: string;
  dividerColor: string;
  dropZoneBg: string;
  maxPillWidth: string;
  mt: number;
  clearFolderHoverStates: () => void;
}

const GroupHeaderDropZone: React.FC<GroupHeaderDropZoneProps> = ({
  groupKey,
  indexInfo,
  fileCount,
  onDrop,
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
  
  const checkAndSetDropEffect = (e: React.DragEvent): 'internal' | 'external' | 'none' => {
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
    const effectAllowed = e.dataTransfer.effectAllowed;
    
    if (hasFilesType && !hasCustomType && internalDragFlag) {
      try { delete (window as any).__docuframeInternalDrag; } catch {}
    }
    
    const isInternal = hasCustomType || (!hasFilesType && internalDragFlag);
    
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
        const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
        
        const isInternal = hasCustomType || (!hasFilesType && internalDragFlag);
        const isExternal = hasFilesType && !hasCustomType;
        
        if (isExternal && internalDragFlag) {
          try { delete (window as any).__docuframeInternalDrag; } catch {}
        }
        
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
  memoizedFileStates: Array<{
    isFileSelected: boolean;
    isRowHovered: boolean;
    isFileCut: boolean;
    isFileNew: boolean;
    isFileDragged: boolean;
  }>;
  memoizedRowBackgrounds: string[];
  
  // Color values
  tableHeadTextColor: string;
  headerHoverBg: string;
  headerStickyBg: string;
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
  createRowHandlers: (file: FileItem, index: number) => any;
  createFolderDropHandlers: (file: FileItem, index: number) => any;
  observeFileElement: (element: HTMLElement | null, filePath: string) => void;
  unobserveFileElement: (element: HTMLElement | null) => void;
  formatFileSize: (size: string | undefined) => string;
  formatDate: (dateString: string) => string;
  handleRenameSubmit: (e?: React.FormEvent) => void;
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

export const FileListView: React.FC<FileListViewProps> = ({
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
  memoizedFileStates,
  memoizedRowBackgrounds,
  tableHeadTextColor,
  headerHoverBg,
  headerStickyBg,
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
  createRowHandlers,
  createFolderDropHandlers,
  observeFileElement,
  unobserveFileElement,
  formatFileSize,
  formatDate,
  handleRenameSubmit,
  setIsRenaming,
  setRenameValue,
  setFileGridBackgroundUrl,
  selectedFiles,
  setSelectedFiles,
  setSelectedFile,
  clearFolderHoverStates,
  cellStyles,
}) => {
  const pillBg = useColorModeValue('blue.50', 'blue.900');
  const pillText = useColorModeValue('blue.700', 'blue.200');
  const dividerColor = useColorModeValue('gray.200', 'gray.600');
  const dropZoneBg = useColorModeValue('blue.100', 'blue.800');
  const maxPillWidth = useMemo(() => {
    const maxLength = getMaxIndexPillWidth();
    return `${Math.max(maxLength * 7, 140)}px`;
  }, []);
  
  // Debug: Log when background props change
  useEffect(() => {
    console.log('FileListView: Background props changed:', {
      backgroundType,
      fileGridBackgroundUrl: fileGridBackgroundUrl.substring(0, 50) + '...',
      backgroundFillUrl: backgroundFillUrl.substring(0, 50) + '...',
    });
  }, [backgroundType, fileGridBackgroundUrl, backgroundFillUrl]);
  
  return (
    <Box 
      position="relative"
      height="100%"
      width="100%"
      overflow="hidden"
    >
      {/* Background Fill - Full filegrid coverage, 10% opacity - Fixed to container, doesn't scroll */}
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
            opacity: 0.10,
          }}
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
              borderSpacing: 0
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
                        const isInResizeArea = clickX > rect.width - 8;
                        if (!isInResizeArea) {
                          handleSort(column as SortColumn);
                        }
                      }}
                      onDoubleClick={(e) => {
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
            </Box>

            <Box as="tbody">
              {groupedFiles.folders && groupedFiles.folders.length > 0 && (
                <>
                  {groupedFiles.folders.map((file, fileIndex) => {
                    const globalIndex = sortedFiles.findIndex(f => f.path === file.path);
                    const index = globalIndex >= 0 ? globalIndex : fileIndex;
                    const fileState = memoizedFileStates[index];
                    const finalBg = memoizedRowBackgrounds[index];
                    const rowHandlers = createRowHandlers(file, index);
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
                        cellStyles={{ ...cellStyles, bg: finalBg }}
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
                            </Box>
                          )
                        }

                        const fileState = memoizedFileStates[index];
                        const finalBg = memoizedRowBackgrounds[index];
                        const rowHandlers = createRowHandlers(file, index);
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
                            cellStyles={{ ...cellStyles, bg: finalBg }}
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
              borderSpacing: 0
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
                        const isInResizeArea = clickX > rect.width - 8;
                        
                        if (!isInResizeArea) {
                          handleSort(column as SortColumn);
                        }
                      }}
                      onDoubleClick={(e) => {
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
            </Box>

            <Box as="tbody">
              {sortedFiles.map((file, index) => {
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
                    </Box>
                  )
                }

                const fileState = memoizedFileStates[index];
                const finalBg = memoizedRowBackgrounds[index];
                const rowHandlers = createRowHandlers(file, index);
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
                    cellStyles={{ ...cellStyles, bg: finalBg }}
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




