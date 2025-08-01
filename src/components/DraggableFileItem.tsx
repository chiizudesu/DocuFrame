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
  as?: 'box' | 'tr'; // Add prop to specify rendering element
  onDragStateReset?: () => void; // Add callback to reset parent drag state
  isCut?: boolean; // Add isCut prop for cut indicator
  onFileMouseDown?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileClick?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileMouseUp?: (file: FileItem, index: number, event: React.MouseEvent) => void;
  onFileDragStart?: (file: FileItem, index: number, event: React.DragEvent) => void;
  onNativeIconLoaded?: (filePath: string, iconData: string) => void; // Callback to share native icon with parent
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
  as = 'box', // Default to box
  onDragStateReset,
  isCut,
  onFileMouseDown,
  onFileClick,
  onFileMouseUp,
  onFileDragStart,
  onNativeIconLoaded,
}) => {
  const { addLog, currentDirectory, setStatus, setFolderItems } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [dragImage, setDragImage] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLTableRowElement>(null);
  
  const itemBgHover = useColorModeValue('#f0f9ff', 'blue.700'); // Lighter than selection
  const selectedBg = useColorModeValue('#dbeafe', 'blue.800');
  const dragOverBg = useColorModeValue('#3b82f6', 'blue.600');

  // Load system icon for the file
  useEffect(() => {
    const loadIcon = async () => {
      if (file.type === 'file' && window.electronAPI?.getFileIcon) {
        try {
          const iconData = await window.electronAPI.getFileIcon(file.path);
          if (iconData) {
            setDragImage(iconData);
            // Notify parent component about the loaded icon
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
    // Notify parent that drag has started
    if (onFileDragStart) onFileDragStart(file, index, e);
    
    // Use Electron's native file drag and drop exactly as documented
    e.preventDefault();
    const filesToDrag: string[] = Array.isArray(selectedFiles) && selectedFiles.length > 0 && sortedFiles
      ? selectedFiles.map(name => {
          const selectedFile = sortedFiles.find(f => f.name === name);
          return selectedFile ? selectedFile.path : null;
        }).filter((path): path is string => path !== null)
      : [file.path];
    // Set data transfer type for internal drags
    e.dataTransfer.setData('application/x-docuframe-files', '');
    if (window.electron && typeof window.electron.startDrag === 'function') {
      // Pass all files for multi-file drag - startDrag accepts string | string[]
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
        // Notify parent to reset drag state
        if (onDragStateReset) {
          onDragStateReset();
        }
      }
    };

    const handleEscapeEvent = () => {
      setIsDragging(false);
      setIsHovering(false);
      // Notify parent to reset drag state
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

  // Add global listeners to handle edge cases
  useEffect(() => {
    let globalDragEndTimer: NodeJS.Timeout;
    
    const handleGlobalDragEnd = () => {
      // Use a small delay to ensure all drag events have completed
      globalDragEndTimer = setTimeout(() => {
        setIsHovering(false);
        setDragCounter(0);
      }, 50);
    };

    const handleGlobalDrop = (e: DragEvent) => {
      // If drop happened anywhere, reset states
      setIsHovering(false);
      setDragCounter(0);
    };
    
    const handleWindowBlur = () => {
      // If window loses focus during drag, reset states
      setIsHovering(false);
      setDragCounter(0);
    };

    // Listen for various events that should clear the hover state
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
      
      // Set appropriate drop effect based on drag type
      const hasExternalFiles = e.dataTransfer.types.includes('Files');
      const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
      
      if (hasExternalFiles) {
        e.dataTransfer.dropEffect = 'copy'; // External files are copied/uploaded
      } else if (isInternalDrag) {
        // For internal drags, respect the modifier keys
        e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      }
      
      // Ensure hover state is active
      if (!isHovering) {
        setIsHovering(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      
      setDragCounter(prev => {
        const newCount = prev - 1;
        if (newCount === 0) {
          setIsHovering(false);
        }
        return newCount;
      });
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (file.type !== 'folder') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Reset all drag states
    setIsHovering(false);
    setDragCounter(0);
    
    // Debug: Log all available data transfer info
    console.log('=== DraggableFileItem DROP EVENT DEBUG ===');
    console.log('Target folder:', file.name);
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer files.length:', e.dataTransfer.files.length);
    console.log('DataTransfer items.length:', e.dataTransfer.items.length);
    console.log('Files array:', Array.from(e.dataTransfer.files));
    
    try {
      // Check what type of drag this is
      const hasExternalFiles = e.dataTransfer.types.includes('Files');
      const isInternalDrag = e.dataTransfer.types.includes('application/x-docuframe-files');
      
      // Handle external files (from OS file explorer)
      if (hasExternalFiles && e.dataTransfer.files.length > 0) {
        console.log('Processing external files drop into folder:', file.name);
        
        // Handle external file drop (upload)
        const files = Array.from(e.dataTransfer.files).map((f, index) => {
          const filePath = (f as any).path || f.name; // Fallback to name if path not available
          console.log(`Processing file ${index}: ${f.name}, path: ${filePath}`);
          
          return {
            path: filePath,
            name: f.name
          };
        });
        
        // Validate that we have valid file paths
        const validFiles = files.filter(f => f.path && f.path !== f.name);
        if (validFiles.length === 0) {
          console.error('No valid file paths found. This might be a web browser drag, not OS drag.');
          addLog('Failed to upload: No valid file paths found. Please drag files from your file explorer, not from a web browser.', 'error');
          setStatus('Upload failed: Invalid file source', 'error');
          return;
        }
        
        addLog(`Uploading ${validFiles.length} file(s) to ${file.name}`);
        setStatus('Uploading files...', 'info');
        
        // Use moveFiles instead of uploadFiles
        const results = await window.electronAPI.moveFiles(validFiles.map(f => f.path), file.path);
        
        // Process results
        const successful = results.filter((r: any) => r.status === 'success').length;
        const failed = results.filter((r: any) => r.status === 'error').length;
        const skipped = results.filter((r: any) => r.status === 'skipped').length;
        
        let message = `Upload complete: ${successful} successful`;
        if (failed > 0) message += `, ${failed} failed`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        
        addLog(message);
        setStatus(message, failed > 0 ? 'error' : 'success');
        // Refresh current directory after successful upload
        if (successful > 0 && typeof window.electronAPI.getDirectoryContents === 'function' && typeof setFolderItems === 'function') {
          const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
          setFolderItems(contents);
        }
      } 
      // Handle internal drags (files dragged within the app)
      else if (isInternalDrag && selectedFiles && selectedFiles.length > 0 && sortedFiles) {
        console.log('Processing internal files drop into folder:', file.name);
        
        // Get the full paths of selected files
        const filesToMove = selectedFiles
          .map(name => {
            const selectedFile = sortedFiles.find(f => f.name === name);
            return selectedFile ? selectedFile.path : null;
          })
          .filter((path): path is string => path !== null);
        
        if (filesToMove.length === 0) {
          addLog('No valid files to move', 'error');
          setStatus('Move failed: No valid files', 'error');
          return;
        }
        
        // Determine if this is a copy (Ctrl key) or move operation
        const isCopy = e.ctrlKey || e.metaKey;
        const operation = isCopy ? 'copy' : 'move';
        
        addLog(`${operation === 'copy' ? 'Copying' : 'Moving'} ${filesToMove.length} file(s) to ${file.name}`);
        setStatus(`${operation === 'copy' ? 'Copying' : 'Moving'} files...`, 'info');
        
        try {
          const results = await window.electronAPI[operation === 'copy' ? 'copyFiles' : 'moveFiles'](filesToMove, file.path);
          
          // Process results
          const successful = results.filter((r: any) => r.status === 'success').length;
          const failed = results.filter((r: any) => r.status === 'error').length;
          const skipped = results.filter((r: any) => r.status === 'skipped').length;
          
          let message = `${operation === 'copy' ? 'Copy' : 'Move'} complete: ${successful} successful`;
          if (failed > 0) message += `, ${failed} failed`;
          if (skipped > 0) message += `, ${skipped} skipped`;
          
          addLog(message);
          setStatus(message, failed > 0 ? 'error' : 'success');
          // Refresh current directory after successful move/copy
          if (successful > 0 && typeof window.electronAPI.getDirectoryContents === 'function' && typeof setFolderItems === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            setFolderItems(contents);
          }
        } catch (error) {
          console.error(`${operation} operation failed:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addLog(`${operation} operation failed: ${errorMessage}`, 'error');
          setStatus(`${operation} operation failed`, 'error');
        }
      } else {
        console.log('No valid files detected for drop operation');
        addLog('No valid files to process', 'info');
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

  const getBorderColor = () => {
    if (isSelected) return selectedBg;
    return 'transparent';
  };

  const getBackgroundColor = () => {
    if (isHovering) return itemBgHover; // Same light hover for both files and folders
    if (isSelected) return selectedBg;
    return isDragging ? itemBgHover : 'transparent';
  };

  const getHoverStyles = () => {
    if (as === 'tr') {
      return {
        bg: isHovering ? itemBgHover : (isSelected ? selectedBg : undefined),
        borderLeft: '4px solid transparent',
        transition: 'all 0.2s ease'
      };
    }
    return {
      bg: isHovering ? itemBgHover : (isSelected ? selectedBg : itemBgHover)
    };
  };

  const commonProps = {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragEnter: handleDragEnter, // Add this
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onContextMenu: (e: React.MouseEvent) => onContextMenu(e, file),
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    cursor: "default" as const,
    opacity: isDragging ? 0.5 : 1,
    transition: "all 0.2s",
    borderLeft: file.type === 'folder' ? '4px solid' : undefined,
    borderLeftColor: getBorderColor(),
    bg: getBackgroundColor(),
    _hover: getHoverStyles(),
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp
  };

  // For table rows, we need different styling approach
  if (as === 'tr') {
    return (
      <Tr
        ref={trRef}
        {...commonProps}
        bg={getBackgroundColor()}
        _hover={getHoverStyles()}
        style={{ userSelect: 'none', borderLeft: '4px solid transparent', opacity: isCut ? 0.5 : 1, fontStyle: isCut ? 'italic' : 'normal' }}
      >
        {/* Removed system icon rendering for files to avoid overlap */}
        {children}
      </Tr>
    );
  }

  // Default box rendering for grid view
  return (
    <Box
      ref={boxRef}
      {...commonProps}
      bg={getBackgroundColor()}
      borderRadius="md"
      border="2px solid"
      borderColor={getBorderColor()}
      position="relative"
      _hover={getHoverStyles()}
      style={{ opacity: isCut ? 0.5 : 1, fontStyle: isCut ? 'italic' : 'normal' }}
    >
      {/* Removed system icon rendering for files to avoid overlap */}
      {children}
    </Box>
  );
}; 