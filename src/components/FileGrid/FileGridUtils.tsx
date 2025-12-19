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
    isRowHovered: boolean;
    isFileCut: boolean;
    isFileNew: boolean;
    isFileDragged: boolean;
  };
  finalBg: string;
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
  };
  nativeIcons: Map<string, string>;
  fileTextColor: string;
  fileSubTextColor: string;
  formatFileSize: (size: string | undefined) => string;
  formatDate: (dateString: string) => string;
  observeFileElement: (element: HTMLElement | null, filePath: string) => void;
  unobserveFileElement: (element: HTMLElement | null) => void;
  rowHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
  };
  folderDropHandlers: Record<string, any> | {};
}



