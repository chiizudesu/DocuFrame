import type { FileItem } from '../../types'
import type { DragEvent } from 'react'

// Sort types for list view
export type SortColumn = 'name' | 'size' | 'modified' | 'type' | 'age' | 'period' | 'version'
export type SortDirection = 'asc' | 'desc'

// ── Column registry ───────────────────────────────────────────────────────────
// Single source of truth for grid columns. Age/Period/Version are optional
// columns, hidden by default; Period only surfaces inside GST folders.
export const ALL_COLUMN_IDS = ['name', 'type', 'modified', 'size', 'age', 'period', 'version'] as const
export type ColumnId = (typeof ALL_COLUMN_IDS)[number]

export const COLUMN_LABELS: Record<string, string> = {
  name: 'Name',
  type: 'Type',
  modified: 'Modified',
  size: 'Size',
  age: 'Age',
  period: 'Period',
  version: 'Version',
}

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  name: 400,
  size: 100,
  modified: 180,
  type: 100,
  age: 110,
  period: 120,
  version: 90,
}

export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  name: true,
  type: true,
  modified: true,
  size: true,
  age: false,
  period: false,
  version: false,
}

export type ColumnVisibility = Record<string, boolean>
export type ColumnWidths = Record<string, number>

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

/** Classify a drag event as internal (within DocuFrame), external (OS files), or none. Also sets dropEffect. */
export function classifyDragSource(e: DragEvent): { type: 'internal' | 'external' | 'none'; prefer: 'copy' | 'move' } {
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
    return { type: 'internal', prefer };
  } else if (hasFilesType || hasExternalFiles) {
    setDropEffectCompatibleWithEffectAllowed(e, 'copy');
    return { type: 'external', prefer: 'copy' };
  } else {
    e.dataTransfer.dropEffect = 'none';
    return { type: 'none', prefer: 'move' };
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
    isFileBusy: boolean;
  };
  finalBg: string;
  rowHoverBg: string;
  isFolderDropHovered: boolean;
  columnOrder: string[];
  columnVisibility: ColumnVisibility;
  /** Current version of the file (1 unless replaced); shown in the optional Version column */
  fileVersion?: number;
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




