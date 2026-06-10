import type { FileItem } from '../../types'
import type { DragEvent } from 'react'

// Sort types for list view
export type SortColumn = 'name' | 'size' | 'modified'
export type SortDirection = 'asc' | 'desc'

// Utility to format paths for logging (Windows vs others)
export function formatPathForLog(path: string) {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  return isWindows ? path.replace(/\//g, '\\') : path;
}

/** Electron/native drags often set effectAllowed to copyLink; dropEffect must match or the OS shows “not allowed”. */
export function setDropEffectCompatibleWithEffectAllowed(e: DragEvent, prefer: 'copy' | 'move') {
  const raw = String(e.dataTransfer.effectAllowed || 'uninitialized')
  if (raw === 'none') {
    e.dataTransfer.dropEffect = 'none'
    return
  }
  if (raw === 'all' || raw === 'uninitialized') {
    e.dataTransfer.dropEffect = prefer
    return
  }
  const canCopy = raw.includes('copy')
  const canMove = raw.includes('move')
  if (prefer === 'copy') {
    e.dataTransfer.dropEffect = canCopy ? 'copy' : canMove ? 'move' : 'none'
  } else {
    e.dataTransfer.dropEffect = canMove ? 'move' : canCopy ? 'copy' : 'none'
  }
}

// FileTableRow props interface
export interface FileTableRowProps {
  file: FileItem;
  index: number;
  fileState: {
    isFileSelected: boolean;
    isFileCut: boolean;
    isFileNew: boolean;
    isFileDragged: boolean;
  };
  finalBg: string;
  rowHoverBg: string;
  isFolderDropHovered: boolean;
  columnOrder: string[];
  columnVisibility: {
    name: boolean;
    size: boolean;
    modified: boolean;
    type: boolean;
  };
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
  nativeIcons: Map<string, string>;
  fileTextColor: string;
  fileSubTextColor: string;
  formatFileSize: (size: string | undefined) => string;
  formatDate: (dateString: string) => string;
  observeFileElement: (element: HTMLElement | null, filePath: string) => void;
  unobserveFileElement: (element: HTMLElement | null) => void;
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
    /** Hover quick-action buttons in the name cell: 'preview' | 'rename' | 'prefix' */
    onQuickAction: (action: string, file: FileItem, index: number) => void;
  };
  folderDropHandlers: Record<string, any> | {};
}




