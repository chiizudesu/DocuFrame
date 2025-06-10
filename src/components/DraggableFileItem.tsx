import React, { useState, useRef, useEffect } from 'react';
import { Box, Image, useColorModeValue, Tr } from '@chakra-ui/react';
import { FileItem } from '../types';
import { useAppContext } from '../context/AppContext';

interface DraggableFileItemProps {
  file: FileItem;
  isSelected: boolean;
  children: React.ReactNode;
  onSelect: (file: FileItem, index: number, event?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  index: number;
  selectedFiles: string[];
  as?: 'box' | 'tr'; // Add prop to specify rendering element
}

export const DraggableFileItem: React.FC<DraggableFileItemProps> = ({
  file,
  isSelected,
  children,
  onSelect,
  onContextMenu,
  index,
  selectedFiles,
  as = 'box' // Default to box
}) => {
  const { addLog, currentDirectory, setStatus, setFolderItems } = useAppContext();
  const [isDragging, setIsDragging] = useState(false);
  const [dragImage, setDragImage] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLTableRowElement>(null);
  
  const itemBgHover = useColorModeValue('#f1f5f9', 'gray.700');
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
          }
        } catch (error) {
          console.error('Failed to get file icon:', error);
        }
      }
    };
    loadIcon();
  }, [file.path, file.type]);

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
          if (window.electronAPI && typeof window.electronAPI.startDrag === 'function') {
        window.electronAPI.startDrag(file.path);
    }
    // Internal drag (multi-select, modifier keys, or folders)
    setIsDragging(true);
    
    // Get the files to drag (selected files or just this file)
    const filesToDrag = selectedFiles.includes(file.path) 
      ? selectedFiles 
      : [file.path];
    
    // Set drag data for internal drag
    e.dataTransfer.effectAllowed = 'all';
    e.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(filesToDrag));
    e.dataTransfer.setData('text/plain', filesToDrag.join('\n'));
    // Do NOT set DownloadURL or text/uri-list for drag-out

    // Create consistent drag image for both grid and list views
    const createDragImage = () => {
      const dragImageElement = document.createElement('div');
      dragImageElement.style.position = 'absolute';
      dragImageElement.style.top = '-1000px';
      dragImageElement.style.left = '-1000px';
      dragImageElement.style.padding = '6px 12px';
      dragImageElement.style.backgroundColor = '#1e40af';
      dragImageElement.style.color = 'white';
      dragImageElement.style.borderRadius = '6px';
      dragImageElement.style.fontSize = '13px';
      dragImageElement.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      dragImageElement.style.fontWeight = '500';
      dragImageElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      dragImageElement.style.whiteSpace = 'nowrap';
      dragImageElement.style.zIndex = '10000';
      dragImageElement.style.border = '1px solid rgba(255,255,255,0.2)';
      
      // Create content based on selection count
      if (filesToDrag.length === 1) {
        dragImageElement.textContent = file.name;
      } else {
        dragImageElement.textContent = `${filesToDrag.length} items`;
      }
      
      document.body.appendChild(dragImageElement);
      
      try {
        // For list view, position the drag image closer to cursor
        // For grid view, use standard offset
        const offsetX = as === 'tr' ? 10 : 16;
        const offsetY = as === 'tr' ? 10 : 16;
        e.dataTransfer.setDragImage(dragImageElement, offsetX, offsetY);
      } catch (error) {
        console.warn('Failed to set custom drag image:', error);
      }
      
      // Clean up after drag starts
      setTimeout(() => {
        if (document.body.contains(dragImageElement)) {
          document.body.removeChild(dragImageElement);
        }
      }, 100);
    };
    createDragImage();
    addLog(`Started dragging: ${filesToDrag.length} file(s)`);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    addLog('Drag operation ended');
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.preventDefault();
      e.stopPropagation();
      setIsHovering(true);
      
      // Determine drop effect based on modifier keys
      if (e.ctrlKey) {
        e.dataTransfer.dropEffect = 'copy';
      } else {
        e.dataTransfer.dropEffect = 'move';
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (file.type === 'folder') {
      e.stopPropagation();
      setIsHovering(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (file.type !== 'folder') return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(false);
    
    // Debug: Log all available data transfer info
    console.log('=== DraggableFileItem DROP EVENT DEBUG ===');
    console.log('Target folder:', file.name);
    console.log('DataTransfer types:', e.dataTransfer.types);
    console.log('DataTransfer files.length:', e.dataTransfer.files.length);
    console.log('DataTransfer items.length:', e.dataTransfer.items.length);
    console.log('Files array:', Array.from(e.dataTransfer.files));
    
    try {
      // Check if this is external files from file explorer
      if (e.dataTransfer.files.length > 0) {
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
        
        const results = await window.electronAPI.uploadFiles(validFiles, file.path);
        
        // Process results
        const successful = results.filter((r: any) => r.status === 'success').length;
        const failed = results.filter((r: any) => r.status === 'error').length;
        const skipped = results.filter((r: any) => r.status === 'skipped').length;
        
        let message = `Upload complete: ${successful} successful`;
        if (failed > 0) message += `, ${failed} failed`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        
        addLog(message);
        setStatus(message, failed > 0 ? 'error' : 'success');
        
        // Refresh current directory if needed
        if (file.path === currentDirectory) {
          const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
          setFolderItems(contents);
        }
        
      } else {
        console.log('No external files, checking for internal drag data...');
        // Handle internal file move/copy
        const filesData = e.dataTransfer.getData('application/x-docuframe-files');
        if (filesData) {
          console.log('Found internal drag data:', filesData);
          const filesToMove = JSON.parse(filesData) as string[];
          
          // Filter out the target folder itself to prevent moving into itself
          const validFiles = filesToMove.filter(f => f !== file.path);
          if (validFiles.length === 0) {
            addLog('Cannot move folder into itself');
            return;
          }
          
          const isCtrlPressed = e.ctrlKey;
          const operation = isCtrlPressed ? 'copy' : 'move';
          
          addLog(`${operation === 'copy' ? 'Copying' : 'Moving'} ${validFiles.length} file(s) to ${file.name}`);
          setStatus(`${operation === 'copy' ? 'Copying' : 'Moving'} files...`, 'info');
          
          const results = isCtrlPressed 
            ? await window.electronAPI.copyFiles(validFiles, file.path)
            : await window.electronAPI.moveFiles(validFiles, file.path);
          
          // Process results
          const successful = results.filter((r: any) => r.status === 'success').length;
          const failed = results.filter((r: any) => r.status === 'error').length;
          const skipped = results.filter((r: any) => r.status === 'skipped').length;
          
          let message = `${operation === 'copy' ? 'Copy' : 'Move'} complete: ${successful} successful`;
          if (failed > 0) message += `, ${failed} failed`;
          if (skipped > 0) message += `, ${skipped} skipped`;
          
          addLog(message);
          setStatus(message, failed > 0 ? 'error' : 'success');
          
          // Refresh current directory
          const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
          setFolderItems(contents);
        } else {
          console.log('No internal drag data found either');
        }
      }
    } catch (error) {
      console.error('Drop operation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog(`Drop operation failed: ${errorMessage}`, 'error');
      setStatus('Drop operation failed', 'error');
    }
  };

  const getBorderColor = () => {
    if (isHovering && file.type === 'folder') return '#3b82f6';
    if (isSelected) return selectedBg;
    return 'transparent';
  };

  const getBackgroundColor = () => {
    if (isHovering && file.type === 'folder') return '#dbeafe';
    if (isSelected) return selectedBg;
    return isDragging ? itemBgHover : 'transparent';
  };

  const getHoverStyles = () => {
    if (as === 'tr') {
      return {
        // Remove bg highlight for hovered folders; only use left border
        bg: isSelected ? selectedBg : undefined,
        borderLeft: isHovering && file.type === 'folder'
          ? '4px solid #3b82f6'
          : '4px solid transparent',
        transition: 'all 0.2s ease'
      };
    }
    return {
      bg: isSelected ? selectedBg : itemBgHover
    };
  };

  const commonProps = {
    draggable: true,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onContextMenu: (e: React.MouseEvent) => onContextMenu(e, file),
    onClick: (e: React.MouseEvent) => onSelect(file, index, e),
    cursor: "pointer" as const,
    opacity: isDragging ? 0.5 : 1,
    transition: "all 0.2s"
  };

  // For table rows, we need different styling approach
  if (as === 'tr') {
    return (
      <Tr
        ref={trRef}
        {...commonProps}
        bg={getBackgroundColor()}
        _hover={getHoverStyles()}
        style={{ userSelect: 'none', borderLeft: '4px solid transparent' }}
      >
        {/* Display system icon if available */}
        {dragImage && file.type === 'file' && (
          <Image
            src={dragImage}
            alt=""
            position="absolute"
            top="8px"
            left="8px"
            width="16px"
            height="16px"
            pointerEvents="none"
            zIndex={1}
          />
        )}
        {/* Removed overlay for folders in table rows to prevent light screen effect */}
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
    >
      {/* Display system icon if available */}
      {dragImage && file.type === 'file' && (
        <Image
          src={dragImage}
          alt=""
          position="absolute"
          top="8px"
          left="8px"
          width="16px"
          height="16px"
          pointerEvents="none"
          zIndex={1}
        />
      )}
      
      {/* Drag overlay for folders */}
      {isHovering && file.type === 'folder' && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg={dragOverBg}
          opacity={0.3}
          borderRadius="md"
          zIndex={2}
          pointerEvents="none"
        />
      )}
      
      {children}
    </Box>
  );
}; 