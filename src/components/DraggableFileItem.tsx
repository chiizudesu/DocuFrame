import React, { useState, useRef, useEffect } from 'react';
import { Box, Image, useColorModeValue, Tr } from '@chakra-ui/react';
import { FileItem } from '../types';
import { useAppContext } from '../context/AppContext';

interface DraggableFileItemProps {
  file: FileItem;
  isSelected: boolean;
  children: React.ReactNode;
  onSelect: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, file: FileItem) => void;
  index: number;
  selectedFiles?: string[];
  sortedFiles?: FileItem[];
  as?: 'box' | 'tr';
  onDragStateReset?: () => void;
  isCut?: boolean;
  onFileMouseDown?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileClick?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileMouseUp?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileDragStart?: (file: FileItem, index: number, event: React.DragEvent) => void;
  onNativeIconLoaded?: (filePath: string, iconData: string) => void;
  'data-file-index'?: number;
  variant?: 'decorated' | 'plain';
}

export const DraggableFileItem: React.FC<DraggableFileItemProps> = ({
  file,
  isSelected,
  children,
  onSelect,
  onContextMenu,
  index,
  selectedFiles,
  sortedFiles,
  as = 'box',
  onDragStateReset,
  isCut,
  onFileMouseDown,
  onFileClick,
  onFileMouseUp,
  onFileDragStart,
  onNativeIconLoaded,
  'data-file-index': dataFileIndex,
  variant = 'decorated',
}) => {
  const { addLog, currentDirectory, setStatus, setFolderItems } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [dragImage, setDragImage] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLTableRowElement>(null);
  
  const itemBgHover = useColorModeValue('#f8fafc', 'gray.700');
  const selectedBg = useColorModeValue('#dbeafe', 'blue.800');
  const dragOverBg = useColorModeValue('#3b82f6', 'blue.600');
  const hoverBorderColor = useColorModeValue('gray.300', 'gray.600');

  // Load system icon for the file
  useEffect(() => {
    const loadIcon = async () => {
      if (file.type === 'file' && window.electronAPI?.getFileIcon) {
        try {
          const iconData = await window.electronAPI.getFileIcon(file.path);
          if (iconData) {
            setDragImage(iconData);
            if (onNativeIconLoaded) {
              onNativeIconLoaded(file.path, iconData);
            }
          }
        } catch (error) {
          console.error('Failed to get file icon:', error);
        }
      }
    };
    loadIcon();
  }, [file.path, file.type, onNativeIconLoaded]);

  const handleDragStart = (e: React.DragEvent) => {
    if (onFileDragStart) onFileDragStart(file, index, e);
    
    e.preventDefault();
    const filesToDrag: string[] = Array.isArray(selectedFiles) && selectedFiles.length > 0 && sortedFiles
      ? selectedFiles.map(name => {
          const selectedFile = sortedFiles.find(f => f.name === name);
          return selectedFile ? selectedFile.path : null;
        }).filter((path): path is string => path !== null)
      : [file.path];
    
    // Set data transfer type for internal drags
    e.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(filesToDrag));
    e.dataTransfer.effectAllowed = 'copyMove';
    
    if (window.electron && typeof window.electron.startDrag === 'function') {
      window.electron.startDrag(filesToDrag as any);
      addLog(`Started native drag for ${filesToDrag.length} file(s)`);
      setIsDragging(true);
      setTimeout(() => {
        setIsDragging(false);
      }, 100);
    } else {
      addLog('Native drag not available', 'error');
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setIsHovering(false);
    addLog('Drag operation ended');
  };

  // Handle escape key to reset drag state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDragging(false);
        setIsHovering(false);
        if (onDragStateReset) {
          onDragStateReset();
        }
      }
    };

    const handleEscapeEvent = () => {
      setIsDragging(false);
      setIsHovering(false);
      if (onDragStateReset) {
        onDragStateReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('escape-key-pressed', handleEscapeEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('escape-key-pressed', handleEscapeEvent);
    };
  }, [onDragStateReset]);

  // Global drag end cleanup
  useEffect(() => {
    let globalDragEndTimer: NodeJS.Timeout;
    
    const handleGlobalDragEnd = () => {
      globalDragEndTimer = setTimeout(() => {
        setIsHovering(false);
        setDragCounter(0);
      }, 50);
    };

    const handleGlobalDrop = (e: DragEvent) => {
      setIsHovering(false);
      setDragCounter(0);
    };
    
    const handleWindowBlur = () => {
      setIsHovering(false);
      setDragCounter(0);
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDrop);
    window.addEventListener('blur', handleWindowBlur);
    
    return () => {
      clearTimeout(globalDragEndTimer);
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDrop);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(prev => prev + 1);
      setIsHovering(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      
      const hasExternalFiles = e.dataTransfer.types.includes('Files');
      const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
      
      if (hasExternalFiles) {
        e.dataTransfer.dropEffect = 'copy';
      } else if (isInternalDrag) {
        // FIXED: Always use 'move' for internal drags by default
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(prev => Math.max(0, prev - 1));
      if (dragCounter <= 1) {
        setIsHovering(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsHovering(false);
    setDragCounter(0);

    if (file.type !== 'folder') return;

    try {
      const hasExternalFiles = e.dataTransfer.types.includes('Files');
      const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
      
      if (isInternalDrag) {
        // Get the dragged files from dataTransfer
        let draggedPaths: string[] = [];
        const draggedFilesData = e.dataTransfer.getData('application/x-docuframe-files');
        if (draggedFilesData) {
          draggedPaths = JSON.parse(draggedFilesData) as string[];
        } else if ((window as any).__docuframeInternalDrag?.files) {
          draggedPaths = (window as any).__docuframeInternalDrag.files as string[];
        } else {
          return;
        }
        
        // FIXED: Check if dragging to same folder
        const targetFolderPath = file.path.replace(/\\/g, '/');
        const isSameFolder = draggedPaths.some(path => {
          const sourceFolder = path.substring(0, path.lastIndexOf('/')).replace(/\\/g, '/');
          return sourceFolder === targetFolderPath;
        });
        
        if (isSameFolder) {
          addLog('Cannot move files within the same folder', 'info');
          setStatus('Files are already in this folder', 'info');
          return;
        }
        
        // FIXED: Determine operation based on Ctrl key
        const operation = e.ctrlKey ? 'copy' : 'move';
        
                 if (window.electronAPI) {
           if (operation === 'copy') {
             const results = await window.electronAPI.copyFilesWithConflictResolution(draggedPaths, file.path);
             const successful = results.filter((r: any) => r.status === 'success').length;
             const skipped = results.filter((r: any) => r.status === 'skipped').length;
             addLog(`Copied ${successful} file(s) to ${file.name}${skipped > 0 ? `, ${skipped} skipped` : ''}`);
             setStatus(`Copied ${successful} file(s)`, 'success');
           } else {
             // FIXED: Use moveFilesWithConflictResolution for proper move operation
             const results = await window.electronAPI.moveFilesWithConflictResolution(draggedPaths, file.path);
             const successful = results.filter((r: any) => r.status === 'success').length;
             const skipped = results.filter((r: any) => r.status === 'skipped').length;
             addLog(`Moved ${successful} file(s) to ${file.name}${skipped > 0 ? `, ${skipped} skipped` : ''}`);
             setStatus(`Moved ${successful} file(s)`, 'success');
           }
           
           // Refresh current directory
           const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
           setFolderItems(contents);
         }

         // Clear internal drag marker after handling
         try { delete (window as any).__docuframeInternalDrag; } catch {}
      } else if (hasExternalFiles && e.dataTransfer.files.length > 0) {
        // Handle external file drops
        const files = Array.from(e.dataTransfer.files).map(f => ({
          path: (f as any).path || f.name,
          name: f.name
        }));
        
        const validFiles = files.filter(f => f.path && f.path !== f.name);
        if (validFiles.length > 0) {
          const results = await window.electronAPI.copyFilesWithConflictResolution(
            validFiles.map(f => f.path), 
            file.path
          );
          const successful = results.filter((r: any) => r.status === 'success').length;
          addLog(`Uploaded ${successful} file(s) to ${file.name}`);
          setStatus(`Uploaded ${successful} file(s)`, 'success');
          
          // Refresh current directory
          const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
          setFolderItems(contents);
        }
      }
    } catch (error) {
      console.error('Drop operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Drop operation failed: ${errorMessage}`, 'error');
      setStatus('Drop operation failed', 'error');
    }

    if (onDragStateReset) {
      onDragStateReset();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onFileMouseDown) onFileMouseDown(file, index, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onFileClick) onFileClick(file, index, e);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (onFileMouseUp) onFileMouseUp(file, index, e);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const getBorderColor = () => {
    if (isSelected) return selectedBg;
    return 'transparent';
  };

  const getBackgroundColor = () => {
    if (isHovering && file.type === 'folder') return dragOverBg;
    if (isHovering) return itemBgHover;
    if (isSelected) return selectedBg;
    return isDragging ? itemBgHover : 'transparent';
  };

  const getContainerBackground = () => {
    return variant === 'decorated' ? getBackgroundColor() : 'transparent';
  };

  const getHoverStyles = () => {
    if (variant === 'plain') {
      return {} as any;
    }
    if (as === 'tr') {
      return {
        bg: isHovering ? itemBgHover : (isSelected ? selectedBg : undefined),
        borderLeft: '4px solid transparent',
        transition: 'all 0.2s ease',
        _focus: {
          outline: '2px solid',
          outlineColor: 'blue.400',
          outlineOffset: '2px'
        }
      };
    }
    return {
      bg: isHovering ? itemBgHover : (isSelected ? selectedBg : undefined),
      boxShadow: variant === 'decorated' ? (isHovering ? '0 2px 8px rgba(0, 0, 0, 0.1)' : undefined) : undefined,
      borderColor: variant === 'decorated' ? (isHovering ? hoverBorderColor : getBorderColor()) : undefined,
      transform: variant === 'decorated' ? (isHovering ? 'translateY(-1px)' : undefined) : undefined,
      _focus: {
        outline: '2px solid',
        outlineColor: 'blue.400',
        outlineOffset: '2px'
      }
    };
  };

  const commonProps = {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onContextMenu: (e: React.MouseEvent) => onContextMenu(e, file),
    onClick: handleClick,
    onMouseEnter: variant === 'decorated' ? handleMouseEnter : undefined,
    onMouseLeave: variant === 'decorated' ? handleMouseLeave : undefined,
    cursor: "default" as const,
    opacity: isDragging ? 0.5 : 1,
    transition: variant === 'decorated' ? "all 0.2s" : undefined,
    borderLeft: variant === 'decorated' && file.type === 'folder' ? '4px solid' : undefined,
    borderLeftColor: variant === 'decorated' ? getBorderColor() : undefined,
    bg: getContainerBackground(),
    _hover: getHoverStyles(),
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp
  };

  if (as === 'tr') {
    return (
      <Tr
        ref={trRef}
        {...commonProps}
        bg={getContainerBackground()}
        _hover={getHoverStyles()}
        style={{ userSelect: 'none', borderLeft: '4px solid transparent', opacity: isCut ? 0.5 : 1, fontStyle: isCut ? 'italic' : 'normal' }}
        data-file-index={dataFileIndex}
      >
        {children}
      </Tr>
    );
  }

  return (
    <Box
      ref={boxRef}
      {...commonProps}
      bg={getContainerBackground()}
      borderRadius={variant === 'decorated' ? 'md' : '0'}
      border={variant === 'decorated' ? '2px solid' : 'none'}
      borderColor={variant === 'decorated' ? getBorderColor() : 'transparent'}
      position="relative"
      _hover={getHoverStyles()}
      display={variant === 'plain' ? 'contents' : 'block'}
      style={{ 
        opacity: isCut ? 0.5 : 1, 
        fontStyle: isCut ? 'italic' : 'normal',
        ...(variant === 'plain' && {
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          outline: 'none'
        })
      }}
      data-file-index={dataFileIndex}
    >
      {children}
    </Box>
  );
};