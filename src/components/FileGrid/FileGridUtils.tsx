import type { FileItem } from '../../types'

// Sort types for list view
export type SortColumn = 'name' | 'size' | 'modified'
export type SortDirection = 'asc' | 'desc'

// Utility to format paths for logging (Windows vs others)
export function formatPathForLog(path: string) {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  return isWindows ? path.replace(/\//g, '\\') : path;
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
  };
  folderDropHandlers: Record<string, any> | {};
}




