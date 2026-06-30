import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useColorModeValue } from "../ui/color-mode";
import { ListRowHoverProvider, useListRowIsHovered } from './ListRowHoverContext'
import { HoverPdfPreview, openPdfPreviewPopup, POPUP_PREVIEWABLE_RE } from './HoverPdfPreview'
import { FileListTheadRow } from './FileListThead'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Text, Icon, Flex, Input, Image, Popover, IconButton, Portal, chakra } from '@chakra-ui/react';
import {
  Folder,
  File,
  Upload,
  Plus,
  Eye,
  Edit2,
  Layers,
  FolderPlus,
  FilterX,
  Inbox,
  ArrowRight,
  CornerDownLeft,
  FileInput,
} from 'lucide-react'
import type { FileItem } from '../../types'
import { FileTableRowProps, SortColumn, setDropEffectCompatibleWithEffectAllowed, COLUMN_LABELS, type ColumnVisibility, type ColumnWidths } from './FileGridUtils'
import { getIndexInfo } from '../../utils/indexPrefix'
import { parsePeriodFromName } from '../../utils/period'
import { getAgeInfo } from '../../utils/fileAge'
import { docuFramePalette } from '../../docuFrameColors'

/** Match function-row transfer popovers — flat chrome, no blue ring */
const suppressFocusRing = {
  outline: 'none',
  boxShadow: 'none',
} as const

const fileGridTableStyles = {
  width: 'fit-content',
  fontSize: 'xs',
  userSelect: 'none',
  minWidth: '690px',
  position: 'relative' as const,
  borderCollapse: 'separate' as const,
  /** v2: ~3px vertical rhythm between rows (same bg as grid — no row “cards”) */
  borderSpacing: '0 3px',
  tableLayout: 'fixed' as const,
}

/** List row index for inline “new folder” ghost row; must not overlap real file indices (0..n-1). */
const NEW_FOLDER_GHOST_ROW_INDEX = -1

/** Flat list for grouped-mode virtualization: folder rows + group headers + file rows + empty-section hints. */
type GroupedVirtualRowItem =
  | { type: 'groupHeader'; groupKey: string; groupIndex: number }
  | { type: 'fileRow'; file: FileItem; globalIndex: number }
  | { type: 'emptyHint'; groupKey: string }

/** Estimated height for a group header row (tinted band + section spacing above). */
const GROUP_HEADER_HEIGHT_ESTIMATE = 40
/** Estimated height for the empty-section hint row under a fileless custom header. */
const EMPTY_HINT_HEIGHT_ESTIMATE = 34

// FileTableRow Component (extracted from FileGrid.tsx)
const FileTableRow = React.memo<FileTableRowProps>(({
  file,
  index,
  fileState,
  finalBg,
  rowHoverBg,
  isFolderDropHovered,
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
  fileVersion,
}) => {
  const isListRowHovered = useListRowIsHovered(index);
  const displayBg = isListRowHovered && !isFolderDropHovered ? rowHoverBg : finalBg;
  const cellStylesDisplay = useMemo(
    () => ({ ...cellStyles, bg: displayBg }),
    [cellStyles, displayBg],
  );
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
    <chakra.tr
      draggable={rowHandlers.draggable}
      {...folderDropHandlers}
      data-row-index={index}
      data-file-index={index}
      data-new-file-row={fileState.isFileNew ? 'true' : undefined}
      data-move-failed={fileState.isFileMoveFailed ? 'true' : undefined}
      onMouseEnter={() => rowHandlers.onMouseEnter(index)}
      onMouseLeave={(e: React.MouseEvent) => rowHandlers.onMouseLeave(index, e)}
      onContextMenu={(e: React.MouseEvent) => rowHandlers.onContextMenu(file, e)}
      onClick={(e: React.MouseEvent) => rowHandlers.onClick(file, index, e)}
      onMouseDown={(e: React.MouseEvent) => rowHandlers.onMouseDown(file, index, e)}
      onMouseUp={(e: React.MouseEvent) => rowHandlers.onMouseUp(file, index, e)}
      onDragStart={(e: React.DragEvent) => rowHandlers.onDragStart(file, index, e)}
      onDragEnd={rowHandlers.onDragEnd}
    >
      {columnOrder.map((column, colIndex) => {
        const isName = column === 'name';
        const isSize = column === 'size';
        const isModified = column === 'modified';
        const isType = column === 'type';

        if (!columnVisibility[column]) {
          return null;
        }

        const selectionShadow = getSelectionBoxShadow(column);
        const cellKey = `${file.path}-${column}-${colIndex}`;

        if (isName) {
          const nameShadow = [
            selectionShadow,
            fileState.isFileNew ? 'inset 3px 0 0 0 #22c55e' : null,
          ].filter(Boolean).join(', ') || undefined;
          return (
            <chakra.td
              key={cellKey}
              {...cellStylesDisplay}
              boxShadow={nameShadow}
              ref={(el: HTMLTableCellElement | null) => {
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
                ) : file.type === 'folder' ? (
                  <Box as="span" display="inline-flex" mr={1.5} lineHeight={0} color="blue.400" flexShrink={0}>
                    <Folder size={16} strokeWidth={1.5} fill="currentColor" />
                  </Box>
                ) : (
                  // Neutral file placeholder until the native icon loads — never a folder icon.
                  <Box as="span" display="inline-flex" mr={1.5} lineHeight={0} color="gray.400" flexShrink={0}>
                    <File size={16} strokeWidth={1.5} />
                  </Box>
                )}

                <Text
                  fontSize="xs"
                  color={fileTextColor}
                  style={{
                    userSelect: 'none',
                    opacity: fileState.isFileCut ? 0.5 : 1,
                    fontStyle: fileState.isFileCut ? 'italic' : 'normal',
                  }}
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  flex={1}
                >
                  {file.name}
                </Text>
                {isListRowHovered && file.type === 'file' && (
                  <Flex
                    gap={0}
                    position="absolute"
                    right="2px"
                    top="50%"
                    transform="translateY(-50%)"
                    bg={displayBg}
                    pl={1}
                    align="center"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
                    onMouseUp={(e: React.MouseEvent) => e.stopPropagation()}
                    onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {POPUP_PREVIEWABLE_RE.test(file.name) && (
                      <IconButton
                        aria-label="Preview"
                        title="Preview"
                        size="2xs"
                        variant="ghost"
                        minW="20px"
                        h="20px"
                        color={fileSubTextColor}
                        onClick={(e: React.MouseEvent) => {
                          // Floating interactive popup; fall back to the preview pane if unmounted
                          if (!openPdfPreviewPopup(file, (e.currentTarget as Element).closest('tr'))) {
                            rowHandlers.onQuickAction('preview', file, index);
                          }
                        }}
                      ><Eye size={13} /></IconButton>
                    )}
                    <IconButton
                      aria-label="Rename"
                      title="Rename (F2)"
                      size="2xs"
                      variant="ghost"
                      minW="20px"
                      h="20px"
                      color={fileSubTextColor}
                      onClick={() => rowHandlers.onQuickAction('rename', file, index)}
                    ><Edit2 size={13} /></IconButton>
                    <IconButton
                      aria-label="Apply index prefix"
                      title="Apply index prefix"
                      size="2xs"
                      variant="ghost"
                      minW="20px"
                      h="20px"
                      color={fileSubTextColor}
                      onClick={() => rowHandlers.onQuickAction('prefix', file, index)}
                    ><Layers size={13} /></IconButton>
                  </Flex>
                )}
              </Flex>
            </chakra.td>
          );
        }
        if (isSize) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {file.type === 'folder' ? '-' : file.size ? formatFileSize(file.size) : '-'}
              </Text>
            </chakra.td>
          );
        }
        if (isModified) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {file.modified ? formatDate(file.modified) : '-'}
              </Text>
            </chakra.td>
          );
        }
        if (isType) {
          const getFileExtension = (filename: string): string => {
            if (file.type === 'folder') return 'Folder';
            const lastDot = filename.lastIndexOf('.');
            if (lastDot === -1 || lastDot === filename.length - 1) return 'File';
            return filename.substring(lastDot + 1).toUpperCase();
          };

          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {getFileExtension(file.name)}
              </Text>
            </chakra.td>
          );
        }
        if (column === 'age') {
          const age = file.type === 'folder' ? null : getAgeInfo(file.modified);
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              {age ? (
                <Flex align="center" gap={1.5} style={{ opacity: fileState.isFileCut ? 0.5 : 1 }}>
                  <Box
                    w="36px"
                    h="5px"
                    borderRadius="full"
                    bg="rgba(127,127,127,0.18)"
                    overflow="hidden"
                    flexShrink={0}
                    title={`Modified ${age.label} ago`}
                  >
                    <Box
                      h="100%"
                      borderRadius="full"
                      style={{
                        width: `${Math.max(8, Math.round(age.heat * 100))}%`,
                        background: age.color,
                        boxShadow: age.glow,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                  <Text fontSize="10px" color={fileSubTextColor} style={{ userSelect: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: '0.03em' }}>
                    {age.label}
                  </Text>
                </Flex>
              ) : (
                <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>-</Text>
              )}
            </chakra.td>
          );
        }
        if (column === 'period') {
          const period = parsePeriodFromName(file.name);
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              {period ? (
                <Box
                  as="span"
                  display="inline-block"
                  px={1.5}
                  py="1px"
                  borderRadius="3px"
                  border="1px solid rgba(114,205,244,0.35)"
                  fontSize="10px"
                  color={fileTextColor}
                  title={period.fullLabel}
                  style={{ userSelect: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: '0.04em', opacity: fileState.isFileCut ? 0.5 : 1 }}
                >
                  {period.label}
                </Box>
              ) : (
                <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>-</Text>
              )}
            </chakra.td>
          );
        }
        if (column === 'version') {
          const v = file.type === 'folder' ? null : (fileVersion ?? 1);
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              {v === null ? (
                <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>-</Text>
              ) : v > 1 ? (
                <Box
                  as="span"
                  display="inline-block"
                  px={1.5}
                  py="1px"
                  borderRadius="3px"
                  bg="rgba(234,179,8,0.12)"
                  border="1px solid rgba(234,179,8,0.45)"
                  fontSize="10px"
                  color="#eab308"
                  title={`Replaced ${v - 1} time${v - 1 === 1 ? '' : 's'}`}
                  style={{ userSelect: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: '0.05em', opacity: fileState.isFileCut ? 0.5 : 1 }}
                >
                  v{v}
                </Box>
              ) : (
                <Box
                  as="span"
                  display="inline-block"
                  px={1.5}
                  py="1px"
                  borderRadius="3px"
                  bg="rgba(148,163,184,0.10)"
                  border="1px solid rgba(148,163,184,0.35)"
                  fontSize="10px"
                  color={fileSubTextColor}
                  style={{ userSelect: 'none', fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: '0.05em', opacity: fileState.isFileCut ? 0.5 : 0.85 }}
                >
                  v1
                </Box>
              )}
            </chakra.td>
          );
        }
        return <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow} />;
      })}
    </chakra.tr>
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
    prevProps.fileState.isFileCut === nextProps.fileState.isFileCut &&
    prevProps.fileState.isFileNew === nextProps.fileState.isFileNew &&
    prevProps.fileState.isFileDragged === nextProps.fileState.isFileDragged &&
    prevProps.fileState.isFileBusy === nextProps.fileState.isFileBusy &&
    prevProps.fileState.isFileMoveFailed === nextProps.fileState.isFileMoveFailed &&
    prevProps.finalBg === nextProps.finalBg &&
    prevProps.rowHoverBg === nextProps.rowHoverBg &&
    prevProps.isFolderDropHovered === nextProps.isFolderDropHovered &&
    prevProps.cellStyles === nextProps.cellStyles &&
    prevProps.rowHandlers === nextProps.rowHandlers &&
    prevProps.folderDropHandlers === nextProps.folderDropHandlers &&
    prevProps.nativeIcons.has(prevProps.file.path) === nextProps.nativeIcons.has(nextProps.file.path) &&
    prevProps.fileVersion === nextProps.fileVersion &&
    Object.keys(nextProps.columnVisibility).every(
      (k) => prevProps.columnVisibility[k] === nextProps.columnVisibility[k]
    ) &&
    !columnOrderChanged
  );
});

FileTableRow.displayName = 'FileTableRow';

type FileRenameTableRowProps = FileTableRowProps & {
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  renameValue: string;
  setRenameValue: (value: string) => void;
  handleRenameSubmit: (e?: React.FormEvent) => void | Promise<void> | Promise<boolean>;
  onRenameCancel: () => void;
};

/** Windows Explorer–style rename: same columns as a normal row; blue outline via per-cell selection shadow; name column = icon + inset-bordered dark (light mode: light) edit box. */
function FileRenameTableRow({
  file,
  index,
  fileState,
  finalBg,
  rowHoverBg,
  isFolderDropHovered,
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
  renameInputRef,
  renameValue,
  setRenameValue,
  handleRenameSubmit,
  onRenameCancel,
}: FileRenameTableRowProps) {
  const isListRowHovered = useListRowIsHovered(index);
  const displayBg = isListRowHovered && !isFolderDropHovered ? rowHoverBg : finalBg;
  const cellStylesDisplay = useMemo(
    () => ({ ...cellStyles, bg: displayBg }),
    [cellStyles, displayBg],
  );
  const observedElRef = useRef<HTMLElement | null>(null);

  const innerFieldBg = useColorModeValue('#ffffff', '#000000');
  const innerInsetRing = useColorModeValue(
    'inset 0 0 0 1px rgba(0, 0, 0, 0.45)',
    'inset 0 0 0 1px rgba(255, 255, 255, 0.88)',
  );

  const visibleColumns = columnOrder.filter((c) => columnVisibility[c as keyof typeof columnVisibility]);
  const getSelectionBoxShadow = (col: string) => {
    if (!fileState.isFileSelected) return undefined;
    const idx = visibleColumns.indexOf(col);
    if (idx === -1) return undefined;
    const isFirst = idx === 0;
    const isLast = idx === visibleColumns.length - 1;
    const c = 'var(--chakra-colors-blue-600)';
    const parts: string[] = [`inset 0 1px 0 0 ${c}`, `inset 0 -1px 0 0 ${c}`];
    if (isFirst) parts.push(`inset 1px 0 0 0 ${c}`);
    if (isLast) parts.push(`inset -1px 0 0 0 ${c}`);
    return parts.join(', ');
  };

  return (
    <chakra.tr
      draggable={false}
      {...folderDropHandlers}
      data-row-index={index}
      data-file-index={index}
      data-new-file-row={fileState.isFileNew ? 'true' : undefined}
      onMouseEnter={() => rowHandlers.onMouseEnter(index)}
      onMouseLeave={(e: React.MouseEvent) => rowHandlers.onMouseLeave(index, e)}
      onContextMenu={(e: React.MouseEvent) => rowHandlers.onContextMenu(file, e)}
      onClick={(e: React.MouseEvent) => rowHandlers.onClick(file, index, e)}
      onMouseDown={(e: React.MouseEvent) => rowHandlers.onMouseDown(file, index, e)}
      onMouseUp={(e: React.MouseEvent) => rowHandlers.onMouseUp(file, index, e)}
      onDragStart={(e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnd={rowHandlers.onDragEnd}
    >
      {columnOrder.map((column, colIndex) => {
        const isName = column === 'name';
        const isSize = column === 'size';
        const isModified = column === 'modified';
        const isType = column === 'type';

        if (!columnVisibility[column]) {
          return null;
        }

        const selectionShadow = getSelectionBoxShadow(column);
        const cellKey = `${file.path}-rename-${column}-${colIndex}`;

        if (isName) {
          const nameShadow = [
            selectionShadow,
            fileState.isFileNew ? 'inset 3px 0 0 0 #22c55e' : null,
          ].filter(Boolean).join(', ') || undefined;
          return (
            <chakra.td
              key={cellKey}
              {...cellStylesDisplay}
              boxShadow={nameShadow}
              ref={(el: HTMLTableCellElement | null) => {
                if (file.type === 'file') {
                  if (el) {
                    observedElRef.current = el;
                    observeFileElement(el, file.path);
                  } else {
                    const toUnobserve = observedElRef.current;
                    observedElRef.current = null;
                    if (toUnobserve) unobserveFileElement(toUnobserve);
                  }
                }
              }}
            >
              <Flex
                as="form"
                align="center"
                w="100%"
                minW={0}
                m={0}
                onMouseDown={(e) => e.stopPropagation()}
                onSubmit={(ev) => {
                  void handleRenameSubmit(ev);
                }}
              >
                {file.type === 'file' && nativeIcons.has(file.path) ? (
                  <Image
                    src={nativeIcons.get(file.path)!}
                    boxSize={4}
                    mr={1.5}
                    alt={`${file.name} icon`}
                    flexShrink={0}
                  />
                ) : file.type === 'folder' ? (
                  <Box as="span" display="inline-flex" mr={1.5} lineHeight={0} color="blue.400" flexShrink={0}>
                    <Folder size={16} strokeWidth={1.5} fill="currentColor" />
                  </Box>
                ) : (
                  // Neutral file placeholder until the native icon loads — never a folder icon.
                  <Box as="span" display="inline-flex" mr={1.5} lineHeight={0} color="gray.400" flexShrink={0}>
                    <File size={16} strokeWidth={1.5} />
                  </Box>
                )}
                <Box
                  flex={1}
                  minW={0}
                  display="flex"
                  alignItems="center"
                  maxH="20px"
                  borderRadius="2px"
                  bg={innerFieldBg}
                  boxSizing="border-box"
                  px={1}
                  py={0}
                  overflow="hidden"
                  position="relative"
                  style={{ clipPath: 'inset(0 round 2px)' }}
                  _after={{
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '2px',
                    boxShadow: innerInsetRing,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  <chakra.input
                    ref={renameInputRef}
                    type="text"
                    aria-label="Rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => { void handleRenameSubmit(); }}
                    autoFocus
                    w="100%"
                    minW={0}
                    flex={1}
                    fontSize="xs"
                    lineHeight="18px"
                    h="18px"
                    minH="18px"
                    maxH="18px"
                    py={0}
                    px={0}
                    m={0}
                    border="none"
                    outline="none"
                    bg="transparent"
                    color={fileTextColor}
                    boxSizing="border-box"
                    borderRadius="2px"
                    overflow="hidden"
                    _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') onRenameCancel();
                    }}
                  />
                </Box>
              </Flex>
            </chakra.td>
          );
        }
        if (isSize) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {file.type === 'folder' ? '-' : file.size ? formatFileSize(file.size) : '-'}
              </Text>
            </chakra.td>
          );
        }
        if (isModified) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {file.modified ? formatDate(file.modified) : '-'}
              </Text>
            </chakra.td>
          );
        }
        if (isType) {
          const getFileExtension = (filename: string): string => {
            if (file.type === 'folder') return 'Folder';
            const lastDot = filename.lastIndexOf('.');
            if (lastDot === -1 || lastDot === filename.length - 1) return 'File';
            return filename.substring(lastDot + 1).toUpperCase();
          };
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow}>
              <Text
                fontSize="xs"
                color={fileSubTextColor}
                style={{ userSelect: 'none', opacity: fileState.isFileCut ? 0.5 : 1 }}
              >
                {getFileExtension(file.name)}
              </Text>
            </chakra.td>
          );
        }
        return <chakra.td key={cellKey} {...cellStylesDisplay} boxShadow={selectionShadow} />;
      })}
    </chakra.tr>
  );
}

type NewFolderGhostTableRowProps = {
  columnOrder: string[];
  columnVisibility: ColumnVisibility;
  cellStyles: FileRenameTableRowProps['cellStyles'];
  rowDefaultBg: string;
  rowHoverBg: string;
  fileTextColor: string;
  fileSubTextColor: string;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  newFolderDraftName: string;
  setNewFolderDraftName: (v: string) => void;
  submitInlineNewFolder: (navigateInto: boolean) => void | Promise<void>;
  cancelInlineNewFolder: () => void;
  rowHandlers: FileTableRowProps['rowHandlers'];
};

function NewFolderGhostTableRow({
  columnOrder,
  columnVisibility,
  cellStyles,
  rowDefaultBg,
  rowHoverBg,
  fileTextColor,
  fileSubTextColor,
  newFolderInputRef,
  newFolderDraftName,
  setNewFolderDraftName,
  submitInlineNewFolder,
  cancelInlineNewFolder,
  rowHandlers,
}: NewFolderGhostTableRowProps) {
  const isListRowHovered = useListRowIsHovered(NEW_FOLDER_GHOST_ROW_INDEX);
  const displayBg = isListRowHovered ? rowHoverBg : rowDefaultBg;
  const cellStylesDisplay = useMemo(() => ({ ...cellStyles, bg: displayBg }), [cellStyles, displayBg]);

  const innerFieldBg = useColorModeValue('#ffffff', '#000000');
  const innerInsetRing = useColorModeValue(
    'inset 0 0 0 1px rgba(0, 0, 0, 0.45)',
    'inset 0 0 0 1px rgba(255, 255, 255, 0.88)',
  );

  return (
    <chakra.tr
      draggable={false}
      data-row-index={NEW_FOLDER_GHOST_ROW_INDEX}
      data-file-index={NEW_FOLDER_GHOST_ROW_INDEX}
      data-new-folder-ghost="true"
      opacity={0.92}
      onMouseEnter={() => rowHandlers.onMouseEnter(NEW_FOLDER_GHOST_ROW_INDEX)}
      onMouseLeave={(e: React.MouseEvent) => rowHandlers.onMouseLeave(NEW_FOLDER_GHOST_ROW_INDEX, e)}
      onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onDragStart={(e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {columnOrder.map((column, colIndex) => {
        const isName = column === 'name';
        const isSize = column === 'size';
        const isModified = column === 'modified';
        const isType = column === 'type';

        if (!columnVisibility[column]) {
          return null;
        }

        const cellKey = `new-folder-ghost-${column}-${colIndex}`;

        if (isName) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay}>
              <Flex
                align="center"
                w="100%"
                minW={0}
                m={0}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Box as="span" display="inline-flex" mr={1.5} lineHeight={0} color="blue.400" flexShrink={0}>
                  <Folder size={16} strokeWidth={1.5} fill="currentColor" />
                </Box>
                <Box
                  flex={1}
                  minW={0}
                  display="flex"
                  alignItems="center"
                  maxH="20px"
                  borderRadius="2px"
                  bg={innerFieldBg}
                  boxSizing="border-box"
                  px={1}
                  py={0}
                  overflow="hidden"
                  position="relative"
                  style={{ clipPath: 'inset(0 round 2px)' }}
                  _after={{
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '2px',
                    boxShadow: innerInsetRing,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                >
                  <chakra.input
                    ref={newFolderInputRef}
                    type="text"
                    aria-label="New folder name"
                    value={newFolderDraftName}
                    onChange={(e) => setNewFolderDraftName(e.target.value)}
                    onBlur={cancelInlineNewFolder}
                    autoFocus
                    w="100%"
                    minW={0}
                    flex={1}
                    fontSize="xs"
                    lineHeight="18px"
                    h="18px"
                    minH="18px"
                    maxH="18px"
                    py={0}
                    px={0}
                    m={0}
                    border="none"
                    outline="none"
                    bg="transparent"
                    color={fileTextColor}
                    boxSizing="border-box"
                    borderRadius="2px"
                    overflow="hidden"
                    _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                    draggable={false}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelInlineNewFolder();
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void submitInlineNewFolder(e.ctrlKey || e.metaKey);
                      }
                    }}
                  />
                </Box>
              </Flex>
            </chakra.td>
          );
        }
        if (isSize) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay}>
              <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>
                —
              </Text>
            </chakra.td>
          );
        }
        if (isModified) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay}>
              <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>
                —
              </Text>
            </chakra.td>
          );
        }
        if (isType) {
          return (
            <chakra.td key={cellKey} {...cellStylesDisplay}>
              <Text fontSize="xs" color={fileSubTextColor} style={{ userSelect: 'none' }}>
                Folder
              </Text>
            </chakra.td>
          );
        }
        return <chakra.td key={cellKey} {...cellStylesDisplay} />;
      })}
    </chakra.tr>
  );
}

// GroupHeaderDropZone Component (extracted from FileGrid.tsx)
// PERF: every prop must stay referentially stable across scroll renders — the
// virtualizer re-renders the body each frame, and a broken memo here re-renders
// each visible header's Popover machine, which makes grouped scrolling sluggish.
interface GroupHeaderDropZoneProps {
  groupKey: string;
  fileCount: number;
  /** Rich header metadata: newest file's modified date, e.g. "11 March" (year appended when not current) */
  latestFileLabel?: string | null;
  /** Last arg is true when Ctrl was held during drag-over or at drop (drop often loses ctrlKey after key-up). */
  onDrop: (e: React.DragEvent, groupKey: string, copyModifierActive?: boolean) => void | Promise<void>;
  transferTemplates: Array<{ command: string; filename: string }>;
  onTransfer: (opts: { command?: string; newName?: string }) => Promise<void>;
  headerTextColor: string;
  headerSubTextColor: string;
  mt: number;
  clearFolderHoverStates: () => void;
  /** When true (email drag in progress), the header ignores drags so the grid's save/extract split handles them. */
  suppressDrop?: boolean;
}

const GroupHeaderDropZoneInner: React.FC<GroupHeaderDropZoneProps> = ({
  groupKey,
  fileCount,
  latestFileLabel,
  onDrop,
  transferTemplates,
  onTransfer,
  headerTextColor,
  headerSubTextColor,
  mt,
  clearFolderHoverStates,
  suppressDrop = false,
}) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const copyModifierDuringOverRef = useRef(false);
  const [manualFilename, setManualFilename] = useState('');
  const [isTransferMenuOpen, setIsTransferMenuOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // Derived locally from the stable groupKey string so the parent never has to pass a fresh object
  const indexInfo = getIndexInfo(groupKey);
  const p = docuFramePalette;
  /** Index key accent — the one visual cue that distinguishes layered headers from plain ones */
  const keyColor = useColorModeValue('#2b6cb0', '#72cdf4');
  /** Whisper of the old #1A365D header bar — enough tint to read as a section lid, not a file row */
  const bandBg = useColorModeValue('rgba(43,108,176,0.08)', 'rgba(26,54,93,0.5)');
  const bandAccent = useColorModeValue('rgba(43,108,176,0.5)', 'rgba(114,205,244,0.55)');
  /** Soft key-tinted fill — count badge + popover header chip */
  const keyTintBg = useColorModeValue('rgba(43,108,176,0.10)', 'rgba(114,205,244,0.12)');
  const keyTintBorder = useColorModeValue('rgba(43,108,176,0.28)', 'rgba(114,205,244,0.30)');
  const panelBg = useColorModeValue(p.light.toolbar, p.dark.tabStrip);
  const menuListBorder = useColorModeValue(p.light.border, p.dark.border);
  const menuHoverBg = useColorModeValue(p.light.rowHover, p.dark.chromeHover);
  const menuPlaceholderColor = useColorModeValue(p.light.subtext, p.dark.subtext);
  const inputBg = useColorModeValue(p.light.listRow, p.dark.listRow);
  const labelColor = useColorModeValue('gray.800', 'gray.100');
  /** Popover depth — lifts the dialog off the band without a hard border line */
  const popoverShadow = useColorModeValue(
    '0 10px 30px -8px rgba(15,23,42,0.35), 0 2px 8px -2px rgba(15,23,42,0.20)',
    '0 14px 40px -10px rgba(0,0,0,0.70), 0 2px 10px -2px rgba(0,0,0,0.55)',
  );

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

  const indexKeyLabel = groupKey === 'Other' ? 'Other' : groupKey;
  const indexKeyTitle =
    groupKey === 'Other'
      ? 'Other — non-indexed files'
      : indexInfo.description
        ? `${groupKey} — ${indexInfo.description}`
        : groupKey;

  const checkAndSetDropEffect = (e: React.DragEvent): 'internal' | 'external' | 'none' => {
    const internalDragFlag = !!(window as any).__docuframeInternalDrag;
    const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
    const hasFilesType = e.dataTransfer.types.includes('Files');
    const hasExternalFiles = hasFilesType || (e.dataTransfer.files && e.dataTransfer.files.length > 0);
    const effectAllowed = e.dataTransfer.effectAllowed as string;
    
    const isInternal = hasCustomType || internalDragFlag;
    
    if (isInternal) {
      let prefer: 'copy' | 'move' = 'move';
      if (effectAllowed === 'copy' || effectAllowed === 'copyMove' || effectAllowed === 'all' || (e.ctrlKey && effectAllowed !== 'move' && effectAllowed !== 'linkMove')) {
        prefer = 'copy';
      } else if (effectAllowed === 'move' || effectAllowed === 'linkMove' || (!e.ctrlKey && effectAllowed !== 'copy' && effectAllowed !== 'copyMove' && effectAllowed !== 'all')) {
        prefer = 'move';
      } else {
        prefer = e.ctrlKey ? 'copy' : 'move';
      }
      setDropEffectCompatibleWithEffectAllowed(e, prefer);
      return 'internal';
    } else if (hasFilesType || hasExternalFiles) {
      setDropEffectCompatibleWithEffectAllowed(e, 'copy');
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
      pb={0.5}
      position="relative"
      data-group-drop-zone="true"
      // During an email drag, become transparent to the drag so the grid's save/extract
      // split owns the whole area (the header's own drop hint would otherwise interfere).
      pointerEvents={suppressDrop ? 'none' : undefined}
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        const dragType = checkAndSetDropEffect(e);
        if (dragType !== 'none') {
          copyModifierDuringOverRef.current = e.ctrlKey;
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
          copyModifierDuringOverRef.current = false;
        } else {
          copyModifierDuringOverRef.current = e.ctrlKey;
          setIsCopyMode(e.ctrlKey);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
          setIsCopyMode(false);
          copyModifierDuringOverRef.current = false;
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
        
        const copyModifierActive = e.ctrlKey || copyModifierDuringOverRef.current;
        if (isInternal || isExternal) {
          void onDrop(e, groupKey, copyModifierActive);
        }
        
        setIsDraggingOver(false);
        setIsCopyMode(false);
        copyModifierDuringOverRef.current = false;
        clearFolderHoverStates();
      }}
    >
      <Box position="relative">
      <Flex
        align="center"
        gap={2}
        px={2}
        py="3px"
        minHeight="25px"
        role="group"
        bg={bandBg}
        borderLeft="2px solid"
        borderLeftColor={bandAccent}
        borderRadius="0 4px 4px 0"
        cursor={isDraggingOver ? 'copy' : 'default'}
      >
        <Text
          fontSize="xs"
          color={keyColor}
          flexShrink={0}
          whiteSpace="nowrap"
          title={indexKeyTitle}
          style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: '0.05em' }}
        >
          {indexKeyLabel}
        </Text>
        {indexInfo.description && (
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color={headerTextColor}
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            minW={0}
            flexShrink={1}
          >
            {indexInfo.description}
          </Text>
        )}
        <Box
          as="span"
          flexShrink={0}
          display="inline-flex"
          alignItems="center"
          h="15px"
          minW="15px"
          px="5px"
          borderRadius="full"
          bg="rgba(127,127,127,0.14)"
          color={headerSubTextColor}
          title={`${fileCount} file${fileCount === 1 ? '' : 's'}`}
          style={{ fontSize: '10px', fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {fileCount}
        </Box>
        <Box flex={1} minW="12px" />
        {latestFileLabel && (
          <Flex
            align="center"
            gap="5px"
            flexShrink={0}
            color={headerSubTextColor}
            title={`Newest file in ${groupKey} was modified ${latestFileLabel}`}
          >
            <Box
              as="span"
              w="5px"
              h="5px"
              borderRadius="full"
              bg={bandAccent}
              flexShrink={0}
            />
            <Text fontSize="10px" whiteSpace="nowrap" style={{ letterSpacing: '0.01em' }}>
              Latest file <Box as="span" color={headerTextColor} style={{ fontWeight: 600 }}>{latestFileLabel}</Box>
            </Text>
          </Flex>
        )}
        <Box flexShrink={0} lineHeight={0}>
          <Popover.Root
            open={isTransferMenuOpen}
            lazyMount
            unmountOnExit
            closeOnInteractOutside
            onOpenChange={({ open }) => {
              if (!open) setManualFilename('');
              setIsTransferMenuOpen(open);
            }}
            positioning={{
              placement: 'bottom-end',
              strategy: 'fixed',
            }}
          >
            <Popover.Trigger asChild>
              <IconButton
                aria-label="Transfer to this group"
                title={`Transfer a download into ${groupKey}`}
                size="2xs"
                variant="ghost"
                minW="20px"
                minH="20px"
                w="20px"
                h="20px"
                color={isTransferMenuOpen ? keyColor : headerSubTextColor}
                bg={isTransferMenuOpen ? keyTintBg : 'transparent'}
                borderWidth="1px"
                borderStyle="solid"
                borderColor={isTransferMenuOpen ? keyTintBorder : 'transparent'}
                borderRadius="5px"
                opacity={isTransferMenuOpen ? 1 : 0.5}
                transition="opacity 0.12s ease, background 0.12s ease, color 0.12s ease, transform 0.12s ease"
                css={{ '[role=group]:hover &': { opacity: 1 } }}
                _hover={{ bg: keyTintBg, color: keyColor, borderColor: keyTintBorder }}
                _focus={suppressFocusRing}
                _focusVisible={suppressFocusRing}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <Plus size={13} strokeWidth={2.5} />
              </IconButton>
            </Popover.Trigger>
            <Portal>
              <Popover.Positioner>
                <Popover.Content
                  minW="272px"
                  maxW="min(90vw, 420px)"
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor={menuListBorder}
                  bg={panelBg}
                  borderRadius="8px"
                  overflow="hidden"
                  boxShadow={popoverShadow}
                  zIndex={10000}
                  _focus={suppressFocusRing}
                  _focusVisible={suppressFocusRing}
                  p={0}
                >
                  {/* Header — names the destination layer so the dialog has context */}
                  <Flex
                    align="center"
                    gap={2}
                    px="10px"
                    py="8px"
                    borderBottomWidth="1px"
                    borderBottomStyle="solid"
                    borderBottomColor={menuListBorder}
                  >
                    <Box
                      as="span"
                      flexShrink={0}
                      display="inline-flex"
                      alignItems="center"
                      h="18px"
                      px="7px"
                      borderRadius="3px"
                      bg={keyTintBg}
                      border="1px solid"
                      borderColor={keyTintBorder}
                      color={keyColor}
                      style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', lineHeight: 1 }}
                    >
                      {indexKeyLabel}
                    </Box>
                    <Box minW={0} flex={1}>
                      <Text fontSize="11px" color={menuPlaceholderColor} lineHeight={1.1} style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Transfer into
                      </Text>
                      {indexInfo.description && (
                        <Text fontSize="xs" fontWeight="semibold" color={labelColor} lineClamp={1} title={indexInfo.description}>
                          {indexInfo.description}
                        </Text>
                      )}
                    </Box>
                  </Flex>

                  {/* Template list */}
                  {transferTemplates.length === 0 ? (
                    <Flex direction="column" align="center" justify="center" py={5} px={4} gap={1.5}>
                      <Box color={menuPlaceholderColor} opacity={0.6} lineHeight={0}>
                        <FileInput size={18} />
                      </Box>
                      <Text fontSize="xs" color={menuPlaceholderColor} textAlign="center">
                        No saved templates — name a new file below
                      </Text>
                    </Flex>
                  ) : (
                    <Box maxH="240px" overflowY="auto" py="4px">
                      {transferTemplates.map((t) => {
                        const displayText =
                          t.filename.length > 50 ? t.filename.slice(0, 47) + '...' : t.filename;
                        return (
                          <Box
                            key={t.command}
                            w="100%"
                            textAlign="left"
                            position="relative"
                            py="7px"
                            pl="12px"
                            pr="10px"
                            fontSize="sm"
                            color={labelColor}
                            bg="transparent"
                            cursor="pointer"
                            border="none"
                            display="flex"
                            alignItems="center"
                            gap={2}
                            transition="background 0.1s ease"
                            _hover={{ bg: menuHoverBg }}
                            _focus={suppressFocusRing}
                            _focusVisible={{ ...suppressFocusRing, bg: menuHoverBg }}
                            css={{
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: 0,
                                top: '4px',
                                bottom: '4px',
                                width: '2px',
                                borderRadius: '0 2px 2px 0',
                                background: keyColor,
                                opacity: 0,
                                transition: 'opacity 0.1s ease',
                              },
                              '&:hover::before, &:focus-visible::before': { opacity: 1 },
                              '&:hover .df-transfer-arrow, &:focus-visible .df-transfer-arrow': { opacity: 1, transform: 'translateX(0)' },
                            }}
                            title={t.filename}
                            asChild
                          >
                            <button type="button" onClick={() => handleTransferTemplate(t.command)}>
                              <Text
                                as="span"
                                lineClamp={1}
                                fontSize="sm"
                                textAlign="left"
                                color={labelColor}
                                overflow="hidden"
                                textOverflow="ellipsis"
                                flex={1}
                                minW={0}
                              >
                                {displayText}
                              </Text>
                              <Box
                                as="span"
                                className="df-transfer-arrow"
                                flexShrink={0}
                                lineHeight={0}
                                color={keyColor}
                                opacity={0}
                                style={{ transform: 'translateX(-3px)', transition: 'opacity 0.1s ease, transform 0.1s ease' }}
                              >
                                <ArrowRight size={14} />
                              </Box>
                            </button>
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {/* New-filename footer */}
                  <Box
                    px="10px"
                    py="10px"
                    borderTopWidth="1px"
                    borderTopStyle="solid"
                    borderTopColor={menuListBorder}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Flex
                      align="center"
                      gap={2}
                      h="38px"
                      px="10px"
                      borderRadius="6px"
                      bg={inputBg}
                      borderWidth="1px"
                      borderStyle="solid"
                      borderColor={isInputFocused ? keyColor : menuListBorder}
                      transition="border-color 0.12s ease"
                      boxShadow="none"
                    >
                      <Box as="span" flexShrink={0} lineHeight={0} color={isInputFocused ? keyColor : menuPlaceholderColor} transition="color 0.12s ease">
                        <FileInput size={15} />
                      </Box>
                      <Input
                        size="sm"
                        flex={1}
                        minW={0}
                        h="100%"
                        py={0}
                        px={0}
                        fontSize="sm"
                        border="none"
                        borderRadius={0}
                        bg="transparent"
                        color={labelColor}
                        placeholder="New filename to transfer…"
                        value={manualFilename}
                        onChange={(e) => setManualFilename(e.target.value)}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleTransferManual();
                          }
                        }}
                        _placeholder={{ color: menuPlaceholderColor }}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                      />
                      <IconButton
                        aria-label="Transfer new filename"
                        title="Transfer (Enter)"
                        size="2xs"
                        variant="ghost"
                        flexShrink={0}
                        minW="22px"
                        h="22px"
                        borderRadius="4px"
                        color={manualFilename.trim() ? keyColor : menuPlaceholderColor}
                        opacity={manualFilename.trim() ? 1 : 0.45}
                        bg={manualFilename.trim() ? keyTintBg : 'transparent'}
                        transition="opacity 0.12s ease, background 0.12s ease, color 0.12s ease"
                        _hover={{ bg: keyTintBg, color: keyColor }}
                        _focus={suppressFocusRing}
                        _focusVisible={suppressFocusRing}
                        disabled={!manualFilename.trim()}
                        onClick={handleTransferManual}
                      >
                        <CornerDownLeft size={13} />
                      </IconButton>
                    </Flex>
                  </Box>
                </Popover.Content>
              </Popover.Positioner>
            </Portal>
          </Popover.Root>
        </Box>
      </Flex>
      {isDraggingOver && (
        <Flex
          position="absolute"
          inset={0}
          pointerEvents="none"
          align="center"
          justify="center"
          bg="rgba(59,130,246,0.08)"
          borderRadius="4px"
          style={{
            outline: '1px dashed var(--chakra-colors-blue-400, #60a5fa)',
            outlineOffset: '-1px',
          }}
        >
          <Icon boxSize={3.5} color="blue.400" mr={2} asChild><Upload /></Icon>
          <Text fontSize="xs" fontWeight="semibold" color="blue.400">
            {isCopyMode ? `Copy to ${groupKey}` : `Drop to assign to ${groupKey}`}
          </Text>
        </Flex>
      )}
      </Box>
    </Box>
  );
};

const GroupHeaderDropZone = React.memo(GroupHeaderDropZoneInner);

/** Stable empty array so groups without templates don't break the header memo each render. */
const EMPTY_TRANSFER_TEMPLATES: Array<{ command: string; filename: string }> = [];

/** "11 March" (year appended when not the current year) for the newest file in a section. */
function formatLatestFileLabel(files: FileItem[]): string | null {
  let max = -Infinity;
  for (const f of files) {
    if (!f.modified) continue;
    const t = new Date(f.modified).getTime();
    if (!isNaN(t) && t > max) max = t;
  }
  if (max === -Infinity) return null;
  const d = new Date(max);
  const label = `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'long' })}`;
  return d.getFullYear() === new Date().getFullYear() ? label : `${label} ${d.getFullYear()}`;
}


// FileListView Component (replaces renderListView function)
export interface FileListViewProps {
  // Refs
  dropAreaRef: React.RefObject<HTMLDivElement | null>;
  gridContainerRef: React.Ref<HTMLTableElement | null>;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  /** Rubber-band rectangle: positioned imperatively during drag so React state does not re-render the grid each frame */
  marqueeOverlayRef: React.RefObject<HTMLDivElement | null>;
  
  // State
  isDragOver: boolean;
  isSelecting: boolean;
  isGroupedByIndex: boolean;
  groupedFiles: Record<string, FileItem[]> | null;
  /** 'index' = workpaper drop-zone headers (default); 'plain' = simple label headers (type/date grouping) */
  groupHeaderVariant?: 'index' | 'plain';
  /** Explicit group key order for plain grouping modes (date buckets etc.) */
  groupOrder?: string[];
  /** Row height preset; cell padding is driven by cellStyles from FileGrid */
  rowDensity?: 'compact' | 'default' | 'comfortable';
  /** Search/type/date filters active — switches the empty state copy */
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onCreateFolderRequest?: () => void;
  sortedFiles: FileItem[];
  columnOrder: string[];
  columnVisibility: ColumnVisibility;
  columnWidths: ColumnWidths;
  /** Lookup for the optional Version column; files default to v1 */
  getFileVersion?: (path: string) => number;
  /** Bumps whenever any file version changes so memoized rows refresh */
  fileVersionsEpoch?: number;
  sortColumn: SortColumn;
  sortDirection: 'asc' | 'desc';
  draggingColumn: string | null;
  dragTargetColumn: string | null;
  /** Sticky list header sits above group rows; disable its hit-testing during file drag so layer drop zones receive the drop. */
  suppressHeaderPointerEventsForFileDrag?: boolean;
  /** When true (email drag in progress), group-header drop zones ignore the drag. */
  suppressGroupDrop?: boolean;
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
    isFileCut: boolean;
    isFileNew: boolean;
    isFileDragged: boolean;
    isFileBusy: boolean;
    isFileMoveFailed: boolean;
  };
  memoizedArraySignature: string;
  rowSelectedBg: string;
  rowDefaultBg: string;
  searchHighlightBg: string;
  folderDropBgColor: string;
  fileSearchFilter: string | undefined;
  /** Paths highlighted as “new” after transfer; used for glow lines without scanning full list on scroll */
  recentlyTransferredFiles?: string[];

  // Color values
  tableHeadTextColor: string;
  headerHoverBg: string;
  headerStickyBg: string;
  rowHoverBg: string;
  folderHoverState: Set<string>;
  headerDividerBg: string;
  /** Table + scroll gutter — shows in row spacing (border-spacing) */
  tableSurfaceBg: string;
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
  handleGroupHeaderDrop: (e: React.DragEvent, groupKey: string, copyModifierActive?: boolean) => Promise<void>;
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
    onQuickAction: (action: string, file: FileItem, index: number) => void;
  };
  createFolderDropHandlers: (file: FileItem, index: number) => any;
  observeFileElement: (element: HTMLElement | null, filePath: string) => void;
  unobserveFileElement: (element: HTMLElement | null) => void;
  formatFileSize: (size: string | undefined) => string;
  formatDate: (dateString: string) => string;
  handleRenameSubmit: (e?: React.FormEvent) => void | Promise<void> | Promise<boolean>;
  handleRenameCancel?: () => void;
  /** Inline new-folder row (replaces modal); Enter creates, Ctrl/Cmd+Enter creates and opens folder */
  isInlineCreatingFolder: boolean;
  newFolderDraftName: string;
  setNewFolderDraftName: (v: string) => void;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  submitInlineNewFolder: (navigateInto: boolean) => void | Promise<void>;
  cancelInlineNewFolder: () => void;
  setIsRenaming: (name: string | null) => void;
  setRenameValue: (value: string) => void;
  setFileGridBackgroundUrl: (url: string) => void;
  selectedFiles: string[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<string[]>>;
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
    boxSizing: 'border-box';
  };

  /** Callback fired when the set of visible group headers changes during scroll */
  onVisibleGroupsChange?: (groupKeys: Set<string>) => void;
  /** Ref populated with a function to scroll the virtualizer to a given group key */
  scrollToGroupRef?: React.MutableRefObject<((groupKey: string) => void) | null>;
}

function fileListViewPropsEqual(prev: FileListViewProps, next: FileListViewProps): boolean {
  if (prev.sortedFiles !== next.sortedFiles) return false;
  if (prev.isGroupedByIndex !== next.isGroupedByIndex) return false;
  if (prev.groupedFiles !== next.groupedFiles) return false;
  if (prev.memoizedArraySignature !== next.memoizedArraySignature) return false;
  if (prev.isDragOver !== next.isDragOver || prev.isSelecting !== next.isSelecting) return false;
  if (prev.isRenaming !== next.isRenaming || prev.renameValue !== next.renameValue) return false;
  if (prev.isInlineCreatingFolder !== next.isInlineCreatingFolder) return false;
  if (prev.newFolderDraftName !== next.newFolderDraftName) return false;
  if (prev.recentlyTransferredFiles !== next.recentlyTransferredFiles) return false;
  if (prev.nativeIcons !== next.nativeIcons) return false;
  if (prev.columnOrder !== next.columnOrder || prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.columnWidths !== next.columnWidths) return false;
  if (prev.draggingColumn !== next.draggingColumn || prev.dragTargetColumn !== next.dragTargetColumn) return false;
  if (prev.suppressHeaderPointerEventsForFileDrag !== next.suppressHeaderPointerEventsForFileDrag) return false;
  if (prev.suppressGroupDrop !== next.suppressGroupDrop) return false;
  if (prev.dragMousePos !== next.dragMousePos || prev.dragOffset !== next.dragOffset) return false;
  if (prev.rowHandlers !== next.rowHandlers) return false;
  if (prev.getFileStateForIndex !== next.getFileStateForIndex) return false;
  if (prev.tableSurfaceBg !== next.tableSurfaceBg) return false;
  if (prev.enableBackgrounds !== next.enableBackgrounds) return false;
  if (prev.backgroundType !== next.backgroundType) return false;
  if (prev.backgroundFillUrl !== next.backgroundFillUrl) return false;
  if (prev.fileGridBackgroundUrl !== next.fileGridBackgroundUrl) return false;
  if (prev.groupedTransferTemplates !== next.groupedTransferTemplates) return false;
  if (prev.handleGroupHeaderDrop !== next.handleGroupHeaderDrop) return false;
  if (prev.onTransferFromGroupHeader !== next.onTransferFromGroupHeader) return false;
  if (prev.cellStyles !== next.cellStyles) return false;
  if (prev.rowDensity !== next.rowDensity) return false;
  if (prev.groupHeaderVariant !== next.groupHeaderVariant) return false;
  if (prev.groupOrder !== next.groupOrder) return false;
  if (prev.hasActiveFilters !== next.hasActiveFilters) return false;
  if (prev.getFileVersion !== next.getFileVersion) return false;
  if (prev.fileVersionsEpoch !== next.fileVersionsEpoch) return false;
  // onVisibleGroupChange and scrollToGroupRef are stable refs — always equal
  return true;
}

const FileListViewBody = React.memo(function FileListViewBody({
  dropAreaRef,
  gridContainerRef,
  renameInputRef,
  marqueeOverlayRef,
  isDragOver,
  isSelecting,
  isGroupedByIndex,
  groupedFiles,
  sortedFiles = [],
  columnOrder,
  columnVisibility,
  columnWidths,
  sortColumn,
  sortDirection,
  draggingColumn,
  dragTargetColumn,
  suppressHeaderPointerEventsForFileDrag = false,
  suppressGroupDrop = false,
  dragMousePos,
  dragOffset,
  isDragThresholdMet,
  hasDraggedColumn,
  isRenaming,
  renameValue,
  fileGridBackgroundUrl,
  fileGridBackgroundPath,
  backgroundFillUrl,
  backgroundFillPath: _backgroundFillPath,
  backgroundType,
  enableBackgrounds,
  nativeIcons,
  getFileStateForIndex,
  memoizedArraySignature: _memoizedArraySignature,
  rowSelectedBg,
  rowDefaultBg,
  searchHighlightBg,
  folderDropBgColor,
  fileSearchFilter,
  recentlyTransferredFiles: recentlyTransferredFilesProp,
  tableHeadTextColor,
  headerHoverBg,
  headerStickyBg,
  rowHoverBg,
  folderHoverState,
  headerDividerBg,
  tableSurfaceBg,
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
  isInlineCreatingFolder,
  newFolderDraftName,
  setNewFolderDraftName,
  newFolderInputRef,
  submitInlineNewFolder,
  cancelInlineNewFolder,
  setIsRenaming,
  setRenameValue,
  setFileGridBackgroundUrl,
  selectedFiles: _selectedFiles,
  setSelectedFiles: _setSelectedFiles,
  setSelectedFile: _setSelectedFile,
  clearFolderHoverStates,
  cellStyles,
  groupHeaderVariant = 'index',
  groupOrder,
  rowDensity = 'default',
  hasActiveFilters = false,
  onClearFilters,
  onCreateFolderRequest,
  getFileVersion,
  fileVersionsEpoch: _fileVersionsEpoch,
  onVisibleGroupsChange,
  scrollToGroupRef,
}: FileListViewProps) {
  const onRenameCancel = typeof handleRenameCancel === 'function' ? handleRenameCancel : () => { setIsRenaming(null); setRenameValue(''); };
  const bgFillOpacity = useColorModeValue(0.05, 0.10); // Light: subtler; dark: unchanged
  /** Scroll + table must not paint opaque over the absolute background layer (v3 forwards `bg` reliably). */
  const showBackgroundFill =
    enableBackgrounds && backgroundType === 'backgroundFill' && Boolean(backgroundFillUrl);
  const tableChromeBg = showBackgroundFill ? 'transparent' : tableSurfaceBg;
  /** Match file rows: don’t paint opaque list color over background fill */
  const rowDefaultBgForFill = showBackgroundFill ? 'transparent' : rowDefaultBg;
  const ROW_HEIGHT_ESTIMATE = rowDensity === 'compact' ? 29 : rowDensity === 'comfortable' ? 41 : 33;
  const PLAIN_GROUP_HEADER_HEIGHT_ESTIMATE = 30;
  const recentlyTransferredFiles = recentlyTransferredFilesProp ?? [];

  const pathToGlobalIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < sortedFiles.length; i++) {
      map.set(sortedFiles[i].path, i);
    }
    return map;
  }, [sortedFiles]);

  const flatGroupedItems = useMemo((): GroupedVirtualRowItem[] => {
    if (!isGroupedByIndex || !groupedFiles) return [];
    const items: GroupedVirtualRowItem[] = [];
    const folders = groupedFiles.folders;
    if (folders?.length) {
      for (const f of folders) {
        const gi = pathToGlobalIndex.get(f.path);
        items.push({ type: 'fileRow', file: f, globalIndex: gi !== undefined ? gi : 0 });
      }
    }
    const entries = Object.entries(groupedFiles)
      .filter(([k]) => k !== 'folders')
      .sort(([a], [b]) => {
        if (groupOrder) {
          return groupOrder.indexOf(a) - groupOrder.indexOf(b);
        }
        if (a === 'AA') return -1;
        if (b === 'AA') return 1;
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      });
    entries.forEach(([groupKey, groupFiles], groupIndex) => {
      items.push({ type: 'groupHeader', groupKey, groupIndex });
      if (!groupFiles || groupFiles.length === 0) {
        // Manually-activated section with no files yet: show an empty-state hint under the header
        items.push({ type: 'emptyHint', groupKey });
        return;
      }
      for (const f of groupFiles) {
        const gi = pathToGlobalIndex.get(f.path);
        items.push({ type: 'fileRow', file: f, globalIndex: gi !== undefined ? gi : 0 });
      }
    });
    return items;
  }, [isGroupedByIndex, groupedFiles, groupOrder, pathToGlobalIndex]);

  const newFileIndices = useMemo(() => {
    if (recentlyTransferredFiles.length === 0) return [] as number[];
    const indices: number[] = [];
    const seen = new Set<number>();
    for (const path of recentlyTransferredFiles) {
      let idx = pathToGlobalIndex.get(path);
      if (idx === undefined) idx = pathToGlobalIndex.get(path.replace(/\\/g, '/'));
      if (idx !== undefined && !seen.has(idx)) {
        seen.add(idx);
        indices.push(idx);
      }
    }
    return indices;
  }, [recentlyTransferredFiles, pathToGlobalIndex]);

  const newFileGroupedVirtualIndices = useMemo(() => {
    if (!isGroupedByIndex || recentlyTransferredFiles.length === 0 || flatGroupedItems.length === 0) {
      return [] as number[];
    }
    const paths = new Set(recentlyTransferredFiles);
    const norms = new Set(recentlyTransferredFiles.map((p) => p.replace(/\\/g, '/')));
    const out: number[] = [];
    for (let i = 0; i < flatGroupedItems.length; i++) {
      const it = flatGroupedItems[i];
      if (it.type !== 'fileRow') continue;
      const p = it.file.path;
      if (paths.has(p) || norms.has(p.replace(/\\/g, '/'))) out.push(i);
    }
    return out;
  }, [isGroupedByIndex, flatGroupedItems, recentlyTransferredFiles]);

  // Virtualizer for ungrouped list (flat sortedFiles). Disabled when grouped.
  const virtualizerCount = isGroupedByIndex ? 0 : sortedFiles.length;
  const rowVirtualizer = useVirtualizer({
    count: virtualizerCount,
    getScrollElement: () => dropAreaRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 5,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const groupedVirtualizerCount = isGroupedByIndex ? flatGroupedItems.length : 0;
  const groupedRowVirtualizer = useVirtualizer({
    count: groupedVirtualizerCount,
    getScrollElement: () => dropAreaRef.current,
    estimateSize: (index) => {
      const item = flatGroupedItems[index];
      if (!item) return ROW_HEIGHT_ESTIMATE;
      if (item.type === 'emptyHint') return EMPTY_HINT_HEIGHT_ESTIMATE;
      if (item.type !== 'groupHeader') return ROW_HEIGHT_ESTIMATE;
      return groupHeaderVariant === 'plain' ? PLAIN_GROUP_HEADER_HEIGHT_ESTIMATE : GROUP_HEADER_HEIGHT_ESTIMATE;
    },
    overscan: 8,
  });
  const groupedVirtualItems = groupedVirtualizerCount ? groupedRowVirtualizer.getVirtualItems() : [];
  const groupedTotalSize = groupedVirtualizerCount ? groupedRowVirtualizer.getTotalSize() : 0;

  const rowVirtualizerRef = useRef(rowVirtualizer);
  rowVirtualizerRef.current = rowVirtualizer;
  const groupedVirtualizerRef = useRef(groupedRowVirtualizer);
  groupedVirtualizerRef.current = groupedRowVirtualizer;

  // ── Scroll-tracking: report ALL visible group headers to the parent ──
  // Account for the sticky thead height and overscan — only items whose pixels
  // actually fall inside the visible window count.
  const prevVisibleGroupsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isGroupedByIndex || !onVisibleGroupsChange || groupedVirtualItems.length === 0) {
      if (prevVisibleGroupsRef.current.size > 0) {
        prevVisibleGroupsRef.current = new Set();
        onVisibleGroupsChange?.(prevVisibleGroupsRef.current);
      }
      return;
    }
    const container = dropAreaRef.current;
    if (!container) return;

    // Visible range in scroll-content coordinates (vi.start lives in this space)
    const thead = container.querySelector('thead');
    const theadHeight = thead ? thead.getBoundingClientRect().height : 0;
    const scrollTop = container.scrollTop;
    const visibleTop = scrollTop + theadHeight; // below sticky header
    const visibleBottom = scrollTop + container.clientHeight;

    const visibleKeys = new Set<string>();

    // Track which group each item belongs to as we iterate
    let currentGroupKey: string | null = null;
    for (const vi of groupedVirtualItems) {
      const item = flatGroupedItems[vi.index];
      if (!item) continue;

      if (item.type === 'groupHeader') {
        currentGroupKey = item.groupKey;
      }

      // Check if this item's pixels are inside the visible window
      const itemTop = vi.start;
      const itemBottom = itemTop + vi.size;
      const isPixelVisible = itemBottom > visibleTop && itemTop < visibleBottom;

      if (isPixelVisible && currentGroupKey) {
        visibleKeys.add(currentGroupKey);
      }
    }

    // Edge case: first visible item is a file row whose group header is above
    // the overscan window — walk backwards through flatGroupedItems to find it.
    if (groupedVirtualItems.length > 0) {
      const firstViIdx = groupedVirtualItems[0].index;
      const firstItem = flatGroupedItems[firstViIdx];
      if (firstItem && firstItem.type !== 'groupHeader') {
        // Check if any pixel of this first item is actually visible
        const firstVi = groupedVirtualItems[0];
        const isFirstVisible = (firstVi.start + firstVi.size) > visibleTop && firstVi.start < visibleBottom;
        if (isFirstVisible) {
          for (let i = firstViIdx - 1; i >= 0; i--) {
            const item = flatGroupedItems[i];
            if (item?.type === 'groupHeader') {
              visibleKeys.add(item.groupKey);
              break;
            }
          }
        }
      }
    }

    // Only update if the set changed
    const prev = prevVisibleGroupsRef.current;
    if (visibleKeys.size !== prev.size || ![...visibleKeys].every(k => prev.has(k))) {
      prevVisibleGroupsRef.current = visibleKeys;
      onVisibleGroupsChange(visibleKeys);
    }
  }, [isGroupedByIndex, groupedVirtualItems, flatGroupedItems, onVisibleGroupsChange, dropAreaRef]);

  // ── Scroll-to-group: expose via ref for parent to call ──
  useEffect(() => {
    if (!scrollToGroupRef) return;
    scrollToGroupRef.current = (groupKey: string) => {
      const idx = flatGroupedItems.findIndex(
        (item) => item.type === 'groupHeader' && item.groupKey === groupKey,
      );
      if (idx >= 0) {
        groupedVirtualizerRef.current.scrollToIndex(idx, { align: 'start' });
      }
    };
    return () => { if (scrollToGroupRef) scrollToGroupRef.current = null; };
  }, [flatGroupedItems, scrollToGroupRef]);

  // Latest-file label per group, computed once per data change — NOT per scroll
  // frame (date-parsing every file in every visible group each frame is what
  // made grouped scrolling feel sluggish).
  const latestLabelByGroup = useMemo(() => {
    const out: Record<string, string | null> = {};
    if (!isGroupedByIndex || !groupedFiles) return out;
    for (const [key, files] of Object.entries(groupedFiles)) {
      if (key === 'folders') continue;
      out[key] = formatLatestFileLabel(files ?? []);
    }
    return out;
  }, [isGroupedByIndex, groupedFiles]);

  // Per-row caches for referential stability - only ~visible rows touched, so selection change re-renders only 2 rows
  const fileStateCacheRef = useRef<Map<string, { isFileSelected: boolean; isFileCut: boolean; isFileNew: boolean; isFileDragged: boolean; isFileBusy: boolean; isFileMoveFailed: boolean }>>(new Map());
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

  // Density change: cached cell styles bake in the old padding (keyed by path+bg
  // only), so drop them in the same render pass that received the new cellStyles…
  const prevCellStylesRef = useRef(cellStyles);
  if (prevCellStylesRef.current !== cellStyles) {
    prevCellStylesRef.current = cellStyles;
    cellStylesCacheRef.current.clear();
  }
  // …and re-measure both virtualizers so row offsets update immediately instead
  // of only after navigating out of the folder.
  useEffect(() => {
    rowVirtualizerRef.current?.measure();
    groupedVirtualizerRef.current?.measure();
  }, [rowDensity]);

  const getRowProps = useCallback((file: FileItem, index: number) => {
    const baseState = getFileStateForIndex(file, index);
    const cachedState = fileStateCacheRef.current.get(file.path);
    const stableFileState =
      cachedState &&
      cachedState.isFileSelected === baseState.isFileSelected &&
      cachedState.isFileCut === baseState.isFileCut &&
      cachedState.isFileNew === baseState.isFileNew &&
      cachedState.isFileDragged === baseState.isFileDragged &&
      cachedState.isFileBusy === baseState.isFileBusy &&
      cachedState.isFileMoveFailed === baseState.isFileMoveFailed
        ? cachedState
        : (fileStateCacheRef.current.set(file.path, baseState), baseState);

    const isSearchHighlight = hasActiveSearch && index === 0;
    const defaultRowBg = rowDefaultBgForFill;
    const rowBg = stableFileState.isFileSelected
      ? rowSelectedBg
      : isSearchHighlight
        ? searchHighlightBg
        : defaultRowBg;
    const isFolderDropHovered = file.type === 'folder' && folderHoverState.has(file.path);
    const finalBg = isFolderDropHovered ? folderDropBgColor : rowBg;

    const cacheKey = `${file.path}\x01${finalBg}`;
    let finalCellStyles = cellStylesCacheRef.current.get(cacheKey);
    if (!finalCellStyles) {
      finalCellStyles = { ...cellStyles, bg: finalBg };
      cellStylesCacheRef.current.set(cacheKey, finalCellStyles);
    }
    return { fileState: stableFileState, finalBg, finalCellStyles, isFolderDropHovered };
  }, [
    getFileStateForIndex,
    folderHoverState,
    hasActiveSearch,
    rowSelectedBg,
    rowDefaultBgForFill,
    searchHighlightBg,
    folderDropBgColor,
    cellStyles,
  ]);


  useEffect(() => {
    if (!isInlineCreatingFolder) return;
    const el = dropAreaRef.current;
    if (el && el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [isInlineCreatingFolder, dropAreaRef]);

  // Detect when new files are outside visible rows for glowing line indicator
  const [newFileAboveVisible, setNewFileAboveVisible] = useState(false);
  const [newFileBelowVisible, setNewFileBelowVisible] = useState(false);

  useEffect(() => {
    const container = dropAreaRef.current;
    if (!container) return;

    const checkVisibility = () => {
      if (isGroupedByIndex) {
        if (newFileGroupedVirtualIndices.length === 0) {
          setNewFileAboveVisible(false);
          setNewFileBelowVisible(false);
          return;
        }
        const firstVisible = groupedVirtualItems[0]?.index ?? -1;
        const lastVisible = groupedVirtualItems[groupedVirtualItems.length - 1]?.index ?? -1;
        setNewFileAboveVisible(newFileGroupedVirtualIndices.some((i) => i < firstVisible));
        setNewFileBelowVisible(newFileGroupedVirtualIndices.some((i) => i > lastVisible));
      } else {
        if (newFileIndices.length === 0) {
          setNewFileAboveVisible(false);
          setNewFileBelowVisible(false);
          return;
        }
        const firstVisible = virtualItems[0]?.index ?? -1;
        const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? -1;
        setNewFileAboveVisible(newFileIndices.some((i) => i < firstVisible));
        setNewFileBelowVisible(newFileIndices.some((i) => i > lastVisible));
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
  }, [
    isGroupedByIndex,
    newFileIndices,
    newFileGroupedVirtualIndices,
    virtualItems,
    groupedVirtualItems,
  ]);
  
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
          bg="#4ADE80"
          opacity={0.9}
          zIndex={998}
          pointerEvents="none"
          boxShadow="0 0 12px 4px rgba(74, 222, 128, 0.6)"
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
          bg="#4ADE80"
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
            onError={() => {
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
            onError={() => {
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
        bg={tableChromeBg}
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
            <Icon boxSize={12} mb={2} asChild><Upload /></Icon>
            <Text fontSize="lg" fontWeight="bold">
              Drop files here to upload
            </Text>
          </Flex>
        </Box>
      )}
      
      {/* Drag selection rectangle — geometry updated from FileGrid via marqueeOverlayRef (no per-frame React state) */}
      <Box
        ref={marqueeOverlayRef}
        position="absolute"
        border="1.5px solid"
        borderColor="rgba(96, 165, 250, 0.9)"
        bg="rgba(59, 130, 246, 0.15)"
        pointerEvents="none"
        zIndex={999}
        visibility={isSelecting ? 'visible' : 'hidden'}
        style={{ left: 0, top: 0, width: 0, height: 0 }}
        aria-hidden
      />
      
      {isGroupedByIndex && groupedFiles && Object.keys(groupedFiles).length > 0 ? (
        <>
          <chakra.table ref={gridContainerRef} {...fileGridTableStyles} bg={tableChromeBg}>
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
              <FileListTheadRow
                columnOrder={columnOrder}
                columnVisibility={columnVisibility}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                tableHeadTextColor={tableHeadTextColor}
                headerHoverBg={headerHoverBg}
                headerStickyBg={headerStickyBg}
                headerDividerBg={headerDividerBg}
                dragGhostAccent={dragGhostAccent}
                draggingColumn={draggingColumn}
                dragTargetColumn={dragTargetColumn}
                hasDraggedColumn={hasDraggedColumn}
                suppressPointerEventsForFileDrag={suppressHeaderPointerEventsForFileDrag}
                setHeaderContextMenu={setHeaderContextMenu}
                handleSort={handleSort}
                autoFitColumn={autoFitColumn}
                handleColumnDragStart={handleColumnDragStart}
                handleResizeStart={handleResizeStart}
              />
              <tbody>
                  {isInlineCreatingFolder && (
                    <NewFolderGhostTableRow
                      columnOrder={columnOrder}
                      columnVisibility={columnVisibility}
                      cellStyles={cellStyles}
                      rowDefaultBg={rowDefaultBgForFill}
                      rowHoverBg={rowHoverBg}
                      fileTextColor={fileTextColor}
                      fileSubTextColor={fileSubTextColor}
                      newFolderInputRef={newFolderInputRef}
                      newFolderDraftName={newFolderDraftName}
                      setNewFolderDraftName={setNewFolderDraftName}
                      submitInlineNewFolder={submitInlineNewFolder}
                      cancelInlineNewFolder={cancelInlineNewFolder}
                      rowHandlers={rowHandlers}
                    />
                  )}
                  {groupedVirtualItems.length > 0 && groupedVirtualItems[0].start > 0 && (
                    <tr>
                      <td
                        colSpan={columnOrder.length}
                        style={{ height: groupedVirtualItems[0].start, padding: 0, border: 'none', lineHeight: 0 }}
                      />
                    </tr>
                  )}
                  {groupedVirtualItems.map((virtualRow) => {
                    const item = flatGroupedItems[virtualRow.index];
                    if (!item) return null;
                    if (item.type === 'groupHeader') {
                      const hasFolderSection = Boolean(groupedFiles.folders && groupedFiles.folders.length);
                      const groupFiles =
                        groupedFiles[item.groupKey] ?? [];
                      const mtValue =
                        item.groupIndex === 0 ? (hasFolderSection ? 0.5 : 0) : 2.5;
                      if (groupHeaderVariant === 'plain') {
                        return (
                          <tr key={`gh-${item.groupKey}-${virtualRow.index}`}>
                            <td
                              colSpan={columnOrder.length}
                              style={{ padding: 0, background: 'transparent', verticalAlign: 'bottom' }}
                            >
                              <Flex align="center" gap={2} px={2} pt={item.groupIndex === 0 && !hasFolderSection ? 0.5 : 2.5} pb="2px">
                                <Text fontSize="xs" fontWeight="semibold" color={fileTextColor} whiteSpace="nowrap">
                                  {item.groupKey}
                                </Text>
                                <Text fontSize="10px" color={fileSubTextColor} whiteSpace="nowrap">
                                  {groupFiles.length}
                                </Text>
                                <Box flex={1} h="1px" bg={headerDividerBg} />
                              </Flex>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`gh-${item.groupKey}-${virtualRow.index}`}>
                          <td
                            colSpan={columnOrder.length}
                            data-group-drop-zone="true"
                            style={{ padding: 0, background: 'transparent', verticalAlign: 'top' }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              clearFolderHoverStates();
                              const internalDragFlag = !!(window as any).__docuframeInternalDrag;
                              const hasCustomType = e.dataTransfer.types.includes('application/x-docuframe-files');
                              const hasFilesType = e.dataTransfer.types.includes('Files');
                              const isInternal = hasCustomType || internalDragFlag;
                              const isExternal = hasFilesType && !isInternal;
                              if (isInternal || isExternal) {
                                await handleGroupHeaderDrop(e, item.groupKey, e.ctrlKey);
                              }
                            }}
                          >
                            <GroupHeaderDropZone
                              groupKey={item.groupKey}
                              fileCount={groupFiles.length}
                              latestFileLabel={latestLabelByGroup[item.groupKey] ?? null}
                              onDrop={handleGroupHeaderDrop}
                              transferTemplates={groupedTransferTemplates[item.groupKey] ?? EMPTY_TRANSFER_TEMPLATES}
                              onTransfer={onTransferFromGroupHeader}
                              headerTextColor={fileTextColor}
                              headerSubTextColor={fileSubTextColor}
                              mt={mtValue}
                              clearFolderHoverStates={clearFolderHoverStates}
                              suppressDrop={suppressGroupDrop}
                            />
                          </td>
                        </tr>
                      );
                    }
                    if (item.type === 'emptyHint') {
                      return (
                        <tr key={`empty-${item.groupKey}-${virtualRow.index}`}>
                          <td colSpan={columnOrder.length} style={{ padding: 0, background: 'transparent' }}>
                            <Flex
                              align="center"
                              gap={2}
                              mx={2}
                              mt="2px"
                              px={2.5}
                              py={1.5}
                              border="1px dashed"
                              borderColor={headerDividerBg}
                              borderRadius="4px"
                              userSelect="none"
                              pointerEvents="none"
                            >
                              <Box color={fileSubTextColor} opacity={0.55} lineHeight={0}>
                                <Inbox size={13} strokeWidth={1.75} />
                              </Box>
                              <Text fontSize="11px" color={fileSubTextColor} opacity={0.75} fontStyle="italic">
                                No files yet — drop a file on the header above, or use ＋ to transfer one in
                              </Text>
                            </Flex>
                          </td>
                        </tr>
                      );
                    }
                    const file = item.file;
                    const index = item.globalIndex;
                    const { fileState, finalBg, finalCellStyles, isFolderDropHovered } = getRowProps(
                      file,
                      index,
                    );
                    const folderDropHandlers = createFolderDropHandlers(file, index);
                    if (isRenaming === file.name) {
                      return (
                        <FileRenameTableRow
                          key={file.path}
                          file={file}
                          index={index}
                          fileState={fileState}
                          finalBg={finalBg}
                          rowHoverBg={rowHoverBg}
                          isFolderDropHovered={isFolderDropHovered}
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
                          renameInputRef={renameInputRef}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                          handleRenameSubmit={handleRenameSubmit}
                          onRenameCancel={onRenameCancel}
                        />
                      );
                    }
                    return (
                      <FileTableRow
                        key={file.path}
                        file={file}
                        index={index}
                        fileState={fileState}
                        finalBg={finalBg}
                        rowHoverBg={rowHoverBg}
                        isFolderDropHovered={isFolderDropHovered}
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
                        fileVersion={getFileVersion ? getFileVersion(file.path) : undefined}
                      />
                    );
                  })}
                  {groupedVirtualItems.length > 0 &&
                    (() => {
                      const last = groupedVirtualItems[groupedVirtualItems.length - 1];
                      const offsetBottom = groupedTotalSize - last.end;
                      return offsetBottom > 0 ? (
                        <tr>
                          <td
                            colSpan={columnOrder.length}
                            style={{ height: offsetBottom, padding: 0, border: 'none', lineHeight: 0 }}
                          />
                        </tr>
                      ) : null;
                    })()}
                </tbody>
          </chakra.table>
        </>
      ) : (
        <>
          <chakra.table ref={gridContainerRef} {...fileGridTableStyles} bg={tableChromeBg}>
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
              <FileListTheadRow
                columnOrder={columnOrder}
                columnVisibility={columnVisibility}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                tableHeadTextColor={tableHeadTextColor}
                headerHoverBg={headerHoverBg}
                headerStickyBg={headerStickyBg}
                headerDividerBg={headerDividerBg}
                dragGhostAccent={dragGhostAccent}
                draggingColumn={draggingColumn}
                dragTargetColumn={dragTargetColumn}
                hasDraggedColumn={hasDraggedColumn}
                suppressPointerEventsForFileDrag={suppressHeaderPointerEventsForFileDrag}
                setHeaderContextMenu={setHeaderContextMenu}
                handleSort={handleSort}
                autoFitColumn={autoFitColumn}
                handleColumnDragStart={handleColumnDragStart}
                handleResizeStart={handleResizeStart}
              />
              <tbody>
                  {isInlineCreatingFolder && (
                    <NewFolderGhostTableRow
                      columnOrder={columnOrder}
                      columnVisibility={columnVisibility}
                      cellStyles={cellStyles}
                      rowDefaultBg={rowDefaultBgForFill}
                      rowHoverBg={rowHoverBg}
                      fileTextColor={fileTextColor}
                      fileSubTextColor={fileSubTextColor}
                      newFolderInputRef={newFolderInputRef}
                      newFolderDraftName={newFolderDraftName}
                      setNewFolderDraftName={setNewFolderDraftName}
                      submitInlineNewFolder={submitInlineNewFolder}
                      cancelInlineNewFolder={cancelInlineNewFolder}
                      rowHandlers={rowHandlers}
                    />
                  )}
                  {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                    <tr>
                        <td
                          colSpan={columnOrder.length}
                          style={{ height: virtualItems[0].start, padding: 0, border: 'none', lineHeight: 0 }}
                        />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const index = virtualRow.index;
                    const file = sortedFiles[index];
                    if (!file) return null;
                    const { fileState, finalBg, finalCellStyles, isFolderDropHovered } = getRowProps(file, index);
                    const folderDropHandlers = createFolderDropHandlers(file, index);

                    if (isRenaming === file.name) {
                      return (
                        <FileRenameTableRow
                          key={file.path}
                          file={file}
                          index={index}
                          fileState={fileState}
                          finalBg={finalBg}
                          rowHoverBg={rowHoverBg}
                          isFolderDropHovered={isFolderDropHovered}
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
                          renameInputRef={renameInputRef}
                          renameValue={renameValue}
                          setRenameValue={setRenameValue}
                          handleRenameSubmit={handleRenameSubmit}
                          onRenameCancel={onRenameCancel}
                        />
                      );
                    }

                    return (
                      <FileTableRow
                        key={file.path}
                        file={file}
                        index={index}
                        fileState={fileState}
                        finalBg={finalBg}
                        rowHoverBg={rowHoverBg}
                        isFolderDropHovered={isFolderDropHovered}
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
                        fileVersion={getFileVersion ? getFileVersion(file.path) : undefined}
                      />
                    );
                  })}
                  {virtualItems.length > 0 && (() => {
                    const lastItem = virtualItems[virtualItems.length - 1];
                    const offsetBottom = totalSize - lastItem.end;
                    return offsetBottom > 0 ? (
                      <tr>
                          <td
                            colSpan={columnOrder.length}
                            style={{ height: offsetBottom, padding: 0, border: 'none', lineHeight: 0 }}
                          />
                        </tr>
                    ) : null;
                  })()}
                </tbody>
          </chakra.table>

          {sortedFiles.length === 0 && !isInlineCreatingFolder && (
            <Flex direction="column" align="center" justify="center" pt={20} pb={10} gap={2.5} userSelect="none" pointerEvents="none">
              <Box color={fileSubTextColor} opacity={0.6}>
                {hasActiveFilters ? <FilterX size={30} strokeWidth={1.5} /> : <FolderPlus size={30} strokeWidth={1.5} />}
              </Box>
              <Text fontSize="sm" color={fileSubTextColor} fontWeight="medium">
                {hasActiveFilters ? 'No files match the current filters' : 'This folder is empty'}
              </Text>
              <Text fontSize="xs" color={fileSubTextColor} opacity={0.7}>
                {hasActiveFilters ? 'Try removing a filter or clearing the search' : 'Drop files here, paste, or create something new'}
              </Text>
              <Flex gap={2} mt={1} pointerEvents="auto">
                {hasActiveFilters && onClearFilters && (
                  <Flex
                    as="button"
                    align="center"
                    gap={1.5}
                    px={3}
                    py={1}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={headerDividerBg}
                    color={fileTextColor}
                    fontSize="xs"
                    cursor="pointer"
                    _hover={{ bg: rowHoverBg }}
                    onClick={onClearFilters}
                  >
                    <FilterX size={13} />
                    Clear filters
                  </Flex>
                )}
                {!hasActiveFilters && onCreateFolderRequest && (
                  <Flex
                    as="button"
                    align="center"
                    gap={1.5}
                    px={3}
                    py={1}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={headerDividerBg}
                    color={fileTextColor}
                    fontSize="xs"
                    cursor="pointer"
                    _hover={{ bg: rowHoverBg }}
                    onClick={onCreateFolderRequest}
                  >
                    <FolderPlus size={13} />
                    New folder
                  </Flex>
                )}
              </Flex>
            </Flex>
          )}

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
              {COLUMN_LABELS[draggingColumn] ?? ''}
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
}, fileListViewPropsEqual);

function FileListViewInner(props: FileListViewProps) {
  const { rowHandlers: baseRowHandlers } = props;
  return (
    <ListRowHoverProvider baseRowHandlers={baseRowHandlers}>
      {(merged) => (
        <>
          <FileListViewBody {...props} rowHandlers={merged} />
          <HoverPdfPreview files={props.sortedFiles ?? []} />
        </>
      )}
    </ListRowHoverProvider>
  );
}

export const FileListView = React.memo(FileListViewInner, fileListViewPropsEqual);


