import React, { useState, useRef, useEffect } from 'react'
import {
  Flex,
  Text,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Tooltip,
  Box,
  useColorModeValue,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
} from '@chakra-ui/react'
import {
  Home,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Star,
  Download,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, getParentPath, isAbsolutePath, normalizePath, isChildPath } from '../utils/path'

declare global {
  interface Window {
    electronAPI: {
      minimize?: () => void;
      maximize?: () => void;
      unmaximize?: () => void;
      close?: () => void;
      isMaximized?: () => Promise<boolean>;
      onWindowMaximize?: (cb: () => void) => void;
      onWindowUnmaximize?: (cb: () => void) => void;
      [key: string]: any;
    };
  }
}

export const FolderInfoBar: React.FC = () => {
  const { currentDirectory, setCurrentDirectory, addLog, rootDirectory, setStatus, setFolderItems, addTabToCurrentWindow, setIsQuickNavigating, setIsSearchMode, isPreviewPaneOpen, setIsPreviewPaneOpen, setSelectedFiles, setSelectedFile, setClipboard, quickAccessPaths, addQuickAccessPath, hideTemporaryFiles, hideDotFiles, setFileSearchFilter } = useAppContext()
  
  // Helper function to get directory name from path
  const getDirectoryName = (path: string): string => {
    if (!path) return 'Current Folder';
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Current Folder';
  }
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentDirectory)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreateSpreadsheetOpen, setIsCreateSpreadsheetOpen] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [clickCount, setClickCount] = useState(0)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)


  // Helper function to format template name for display
  const formatTemplateName = (templateName: string): string => {
    // Remove file extension and format as "New [filename]"
    const nameWithoutExtension = templateName.replace(/\.[^/.]+$/, '')
    return `New ${nameWithoutExtension}`
  }

  // File filtering function to match FileGrid behavior
  const filterFiles = (files: any[]) => {
    if (!Array.isArray(files)) return files;
    
    return files.filter((f: any) => {
      // Filter temporary files (files starting with ~$)
      if (hideTemporaryFiles && f?.type !== 'folder' && typeof f?.name === 'string' && f.name.startsWith('~$')) {
        return false;
      }
      
      // Filter dot files/folders (files/folders starting with .)
      if (hideDotFiles && typeof f?.name === 'string' && f.name.startsWith('.')) {
        return false;
      }
      
      return true;
    });
  }

  // Match the active tab color from FolderTabSystem
  const bgColor = useColorModeValue('#4a5a68', 'gray.700')
  const hoverBgColor = useColorModeValue('#64748b', 'blue.700')
  const activeButtonBg = bgColor // Use title bar background color for current path pill
  const activeButtonColor = useColorModeValue('white', 'blue.200')
  const breadcrumbHoverBg = useColorModeValue('#64748b', '#6b7280') // Hover color for parent paths - lighter gray for better visibility in dark mode
  const textColor = useColorModeValue('#e2e8f0', 'gray.100')
  const iconColor = useColorModeValue('#cbd5e1', 'gray.400')
  const inputBgColor = useColorModeValue('#475569', 'gray.600')
  const inputFocusBgColor = useColorModeValue('#64748b', 'gray.500')
  const separatorColor = useColorModeValue('#64748b', 'gray.400')

  // Window controls
  const handleMinimize = () => {
    if (window.electronAPI && window.electronAPI.minimize) {
      window.electronAPI.minimize();
    }
  };
  const handleMaximize = () => {
    if (window.electronAPI && window.electronAPI.maximize) {
      window.electronAPI.maximize();
    }
  };
  const handleUnmaximize = () => {
    if (window.electronAPI && window.electronAPI.unmaximize) {
      window.electronAPI.unmaximize();
    }
  };
  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.close) {
      window.electronAPI.close();
    }
  };
  const [isMaximized, setIsMaximized] = useState(false);
  useEffect(() => {
    if (!window.electronAPI) return;
    if (window.electronAPI.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized);
    }
    if (window.electronAPI.onWindowMaximize) {
      window.electronAPI.onWindowMaximize(() => setIsMaximized(true));
    }
    if (window.electronAPI.onWindowUnmaximize) {
      window.electronAPI.onWindowUnmaximize(() => setIsMaximized(false));
    }
  }, []);

  useEffect(() => {
    setEditValue(currentDirectory)
  }, [currentDirectory])

  // Update history on directory change
  useEffect(() => {
    if (history[historyIndex] !== currentDirectory) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(currentDirectory)
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDirectory])

  const handleClick = () => {
    if (isEditing) {
      // If already editing, don't select all text on additional clicks
      return;
    }

    setClickCount(prev => prev + 1);
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
    }, 300);

    if (clickCount === 0) {
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        // Don't select all text, just focus to allow editing at any position
      }, 0);
    }
  }

  const handleBlur = async () => {
    setIsEditing(false)
    if (editValue !== currentDirectory) {
      const normalizedPath = normalizePath(editValue);
      if (normalizedPath) {
        try {
          // Validate path before setting it
          const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
          if (isValid) {
            setCurrentDirectory(normalizedPath)
            addLog(`Changed directory to: ${normalizedPath}`)
            setStatus(`Navigated to ${normalizedPath}`, 'info')
          } else {
            addLog(`Invalid path: ${editValue}`, 'error')
            setStatus(`Invalid path: ${editValue}`, 'error')
            setEditValue(currentDirectory) // Reset to current directory
          }
        } catch (error) {
          addLog(`Failed to access path: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
          setStatus(`Cannot access path: ${editValue}`, 'error')
          setEditValue(currentDirectory) // Reset to current directory
        }
      } else {
        addLog(`Invalid path format: ${editValue}`, 'error')
        setStatus(`Invalid path format`, 'error')
        setEditValue(currentDirectory) // Reset to current directory
      }
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
      if (editValue !== currentDirectory) {
        const normalizedPath = normalizePath(editValue);
        if (normalizedPath) {
          try {
            // Validate path before setting it
            const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
            if (isValid) {
              setCurrentDirectory(normalizedPath)
              addLog(`Changed directory to: ${normalizedPath}`)
              setStatus(`Navigated to ${normalizedPath}`, 'info')
            } else {
              addLog(`Invalid path: ${editValue}`, 'error')
              setStatus(`Invalid path: ${editValue}`, 'error')
              setEditValue(currentDirectory) // Reset to current directory
            }
          } catch (error) {
            addLog(`Failed to access path: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
            setStatus(`Cannot access path: ${editValue}`, 'error')
            setEditValue(currentDirectory) // Reset to current directory
          }
        } else {
          addLog(`Invalid path format: ${editValue}`, 'error')
          setStatus(`Invalid path format`, 'error')
          setEditValue(currentDirectory) // Reset to current directory
        }
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(currentDirectory)
    }
  }

  const handleHomeClick = async (e: React.MouseEvent) => {
    if (e.ctrlKey) {
      // Ctrl+click opens new tab
      addTabToCurrentWindow(rootDirectory);
      addLog(`Opened new tab for root directory: ${rootDirectory}`);
      setStatus('Opened new tab for home', 'info');
    } else {
      setCurrentDirectory(rootDirectory)
      addLog('Navigated to root directory')
      setStatus('Navigated to home', 'info')
    }
  }

  const handleDownloadsClick = async (e: React.MouseEvent) => {
    try {
      const downloadsPath = await window.electronAPI.getDownloadsPath();
      
      if (e.ctrlKey) {
        // Ctrl+click opens new tab
        addTabToCurrentWindow(downloadsPath);
        addLog(`Opened new tab for downloads: ${downloadsPath}`);
        setStatus('Opened new tab for downloads', 'info');
      } else {
        setCurrentDirectory(downloadsPath);
        addLog(`Navigated to downloads: ${downloadsPath}`);
        setStatus('Navigated to downloads', 'info');
      }
    } catch (error) {
      addLog(`Failed to access downloads folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to access downloads folder', 'error');
    }
  }

  const handleRefresh = async () => {
    addLog(`Refreshing directory: ${currentDirectory}`)
    setIsRefreshing(true)
    
    try {
      // Start both the refresh operation and a minimum delay
      const [contents] = await Promise.all([
        (window.electronAPI as any).getDirectoryContents(currentDirectory),
        new Promise(resolve => setTimeout(resolve, 600)) // Match animation duration
      ])
      
      // Reset states on refresh
      setSelectedFiles([])
      setSelectedFile(null)
      setClipboard({ files: [], operation: null })
      
      // Apply filtering to match FileGrid behavior
      const filtered = filterFiles(Array.isArray(contents) ? contents : (contents && Array.isArray(contents.files) ? contents.files : []))
      setFolderItems(filtered)
      setStatus('Folder refreshed', 'info')
      
      // Dispatch custom event to notify other components (like downloads panel) to refresh
      window.dispatchEvent(new CustomEvent('folderRefresh'));
      
      // Also dispatch a directory refresh event that FileGrid can listen to
      window.dispatchEvent(new CustomEvent('directoryRefreshed', { detail: { directory: currentDirectory } }));
    } catch (error) {
      // Even on error, wait for the animation to complete
      await new Promise(resolve => setTimeout(resolve, 600))
      addLog(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      setStatus('Failed to refresh folder', 'error')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleOpenExplorer = async () => {
    try {
      await (window.electronAPI as any).openDirectory(currentDirectory)
      addLog(`Opened in file explorer: ${currentDirectory}`)
      setStatus('Opened in file explorer', 'success')
    } catch (error) {
      addLog(`Failed to open in file explorer: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      setStatus('Failed to open in file explorer', 'error')
    }
  }


  const handlePreviewPaneToggle = () => {
    const newState = !isPreviewPaneOpen
    setIsPreviewPaneOpen(newState)
    addLog(`Preview pane ${newState ? 'opened' : 'closed'}`)
    setStatus(`Preview pane ${newState ? 'opened' : 'closed'}`, 'info')
  }

  const handleBackClick = async () => {
    if (historyIndex > 0) {
      const targetPath = history[historyIndex - 1];
      const normalizedPath = normalizePath(targetPath);
      
      try {
        const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
        if (isValid) {
          setHistoryIndex(historyIndex - 1)
          setCurrentDirectory(normalizedPath)
          addLog(`Navigated back to: ${normalizedPath}`)
          setStatus(`Navigated back`, 'info')
        } else {
          addLog(`Cannot access history path: ${targetPath}`, 'error')
          setStatus(`Cannot access previous location`, 'error')
        }
      } catch (error) {
        addLog(`Failed to navigate back: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        setStatus(`Navigation failed`, 'error')
      }
    } else {
      const parent = getParentPath(currentDirectory)
      if (parent && parent !== currentDirectory) {
        const normalizedParent = normalizePath(parent);
        try {
          const isValid = await (window.electronAPI as any).validatePath(normalizedParent);
          if (isValid) {
            setCurrentDirectory(normalizedParent)
            addLog(`Navigated back to: ${normalizedParent}`)
            setStatus(`Navigated to parent directory`, 'info')
          } else {
            addLog(`Cannot access parent directory: ${parent}`, 'error')
            setStatus(`Cannot access parent directory`, 'error')
          }
        } catch (error) {
          addLog(`Failed to navigate to parent: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
          setStatus(`Navigation failed`, 'error')
        }
      } else {
        setStatus(`Already at root level`, 'info')
      }
    }
  }

  const handleForwardClick = async () => {
    if (historyIndex < history.length - 1) {
      const targetPath = history[historyIndex + 1];
      const normalizedPath = normalizePath(targetPath);
      
      try {
        const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
        if (isValid) {
          setHistoryIndex(historyIndex + 1)
          setCurrentDirectory(normalizedPath)
          addLog(`Navigated forward to: ${normalizedPath}`)
          setStatus(`Navigated forward`, 'info')
        } else {
          addLog(`Cannot access history path: ${targetPath}`, 'error')
          setStatus(`Cannot access next location`, 'error')
        }
      } catch (error) {
        addLog(`Failed to navigate forward: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
        setStatus(`Navigation failed`, 'error')
      }
    } else {
      addLog('No forward history')
      setStatus('No forward history', 'info')
    }
  }

  // Breadcrumbs logic
  // Show appropriate breadcrumbs based on whether current path is within root or outside
  const getBreadcrumbs = () => {
    const normalizedRoot = normalizePath(rootDirectory);
    const normalizedCurrent = normalizePath(currentDirectory);
    
    // If current directory is empty or invalid, show root
    if (!normalizedCurrent) {
      return [{ label: normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root', path: normalizedRoot }];
    }
    
    // If at root directory, show only the root
    if (normalizedCurrent === normalizedRoot) {
      return [{ label: normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root', path: normalizedRoot }];
    }
    
    // Check if current directory is within the root directory
    if (isChildPath(normalizedRoot, normalizedCurrent)) {
      // Current is within root - show root + relative path
      const relativePath = normalizedCurrent.substring(normalizedRoot.length);
      const segments = relativePath.split(/[\\/]/).filter(Boolean);
      const breadcrumbs = [];
      
      let path = normalizedRoot;
      breadcrumbs.push({ label: normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root', path });
      
      for (const seg of segments) {
        path = joinPath(path, seg);
        breadcrumbs.push({ label: seg, path });
      }
      
      return breadcrumbs;
    } else {
      // Current is outside root - show full absolute path
      const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
      const parts = normalizedCurrent.split(/[\\/]/).filter(Boolean);
      const breadcrumbs = [];
      
      if (isWindows && parts.length > 0 && /^[a-zA-Z]:$/.test(parts[0])) {
        // Windows: Start with drive root
        let path = parts[0] + '\\';
        breadcrumbs.push({ label: parts[0], path });
        
        for (let i = 1; i < parts.length; i++) {
          path = joinPath(path, parts[i]);
          breadcrumbs.push({ label: parts[i], path });
        }
      } else if (!isWindows) {
        // Unix: Start with root /
        breadcrumbs.push({ label: 'Root', path: '/' });
        
        let path = '/';
        for (const part of parts) {
          path = joinPath(path, part);
          breadcrumbs.push({ label: part, path });
        }
      } else {
        // Fallback: treat as single segment
        breadcrumbs.push({ label: normalizedCurrent, path: normalizedCurrent });
      }
      
      return breadcrumbs;
    }
  }

  const breadcrumbs = getBreadcrumbs()

  const handleCreateFolder = async () => {
    try {
      const fullPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newFolderName)
      await (window.electronAPI as any).createDirectory(fullPath)
      addLog(`Created folder: ${newFolderName}`)
      setStatus(`Created folder: ${newFolderName}`, 'success')
      setIsCreateFolderOpen(false)
      setNewFolderName('')
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      setFolderItems(contents)
    } catch (error) {
      console.error('Error creating folder:', error)
      addLog(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      setStatus(`Failed to create folder: ${newFolderName}`, 'error')
    }
  }

  const handleCreateAndEnterFolder = async () => {
    try {
      const fullPath = joinPath(currentDirectory === '/' ? '' : currentDirectory, newFolderName)
      await (window.electronAPI as any).createDirectory(fullPath)
      addLog(`Created and entered folder: ${newFolderName}`)
      setStatus(`Created and entered folder: ${newFolderName}`, 'success')
      setIsCreateFolderOpen(false)
      setNewFolderName('')
      // Navigate into the newly created folder
      setCurrentDirectory(fullPath)
    } catch (error) {
      console.error('Error creating folder:', error)
      addLog(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      setStatus(`Failed to create folder: ${newFolderName}`, 'error')
    }
  }

  const handleCreateBlankSpreadsheet = async () => {
    if (!newSpreadsheetName.trim()) return;
    
    try {
      const fileName = `${newSpreadsheetName}.xlsx`;
      const filePath = joinPath(currentDirectory, fileName);
      
      await (window.electronAPI as any).createBlankSpreadsheet(filePath);
      
      addLog(`Created blank spreadsheet: ${fileName}`);
      setStatus(`Created ${fileName}`, 'success');
      
      setIsCreateSpreadsheetOpen(false);
      setNewSpreadsheetName('');
      
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      setFolderItems(contents);
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      addLog(`Failed to create spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create spreadsheet', 'error');
    }
  };

  const handleCreateWordDocument = async () => {
    try {
      const fileName = `New Document.docx`;
      const filePath = joinPath(currentDirectory, fileName);
      
      // Create a basic Word document (this would need to be implemented in the main process)
      await (window.electronAPI as any).createWordDocument(filePath);
      
      addLog(`Created Word document: ${fileName}`);
      setStatus(`Created ${fileName}`, 'success');
      
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      setFolderItems(contents);
    } catch (error) {
      console.error('Error creating Word document:', error);
      addLog(`Failed to create Word document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create Word document', 'error');
    }
  };

  const handleCreateFromTemplate = async (templatePath: string, templateName: string) => {
    try {
      const fileName = `${templateName.replace('.xlsx', '')}.xlsx`;
      const destPath = joinPath(currentDirectory, fileName);
      
      await (window.electronAPI as any).copyWorkpaperTemplate(templatePath, destPath);
      
      addLog(`Created ${fileName} from template`);
      setStatus(`Created ${fileName} from template`, 'success');
      
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      setFolderItems(contents);
    } catch (error) {
      console.error('Error creating from template:', error);
      addLog(`Failed to create from template: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to create from template', 'error');
    }
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Ctrl+Shift+N: Open create folder dialog
      if (e.ctrlKey && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        setIsCreateFolderOpen(true);
      }
      // F5: Refresh folder view
      if (e.key === 'F5') {
        e.preventDefault();
        handleRefresh();
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleRefresh]);

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const result = await (window.electronAPI as any).getWorkpaperTemplates();
        if (result.success) {
          setTemplates(result.templates);
        } else {
          console.warn('Failed to load workpaper templates:', result.message);
        }
      } catch (error) {
        console.error('Error loading workpaper templates:', error);
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    
    loadTemplates();
  }, []);

  return (
    <>
      <Flex align="center" width="100%" bg={bgColor} borderRadius="sm" h="33px" style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as any}>
        {/* Back/Forward to the left of Home */}
        <Box style={{ WebkitAppRegion: 'no-drag' } as any}>
          <IconButton
            icon={<ChevronLeft size={16} />}
            aria-label="Back"
            variant="ghost"
            size="sm"
            mr={1}
            color={iconColor}
            onClick={handleBackClick}
          />
          <IconButton
            icon={<ChevronRight size={16} />}
            aria-label="Forward"
            variant="ghost"
            size="sm"
            mr={1}
            color={iconColor}
            onClick={handleForwardClick}
          />
          <IconButton
            icon={<Home size={16} />}
            aria-label="Home folder"
            variant="ghost"
            size="sm"
            mr={1}
            color={useColorModeValue('#3b82f6', 'blue.200')}
            onClick={handleHomeClick}
          />
          <IconButton
            icon={<Download size={16} />}
            aria-label="Downloads folder"
            variant="ghost"
            size="sm"
            mr={1}
            color={useColorModeValue('#10b981', 'green.200')}
            onClick={handleDownloadsClick}
          />
          <Tooltip label={quickAccessPaths.includes(currentDirectory) ? 'Pinned' : 'Pin to Quick Access'}>
            <IconButton
              icon={<Star size={16} />}
              aria-label="Pin to quick access"
              variant={quickAccessPaths.includes(currentDirectory) ? 'solid' : 'ghost'}
              size="sm"
              mr={1}
              color={useColorModeValue('#f59e0b', 'yellow.300')}
              onClick={() => addQuickAccessPath(currentDirectory)}
            />
          </Tooltip>
          <IconButton
            icon={<RefreshCw size={16} />}
            aria-label="Refresh folder"
            variant="ghost"
            size="sm"
            mr={1}
            onClick={handleRefresh}
            color={iconColor}
            _hover={{ bg: hoverBgColor }}
          />
        </Box>
        {/* Address bar as breadcrumbs, starting after Home icon */}
        <Flex flex={1} mx={2} align="center" h="33px" gap={1} onClick={handleClick} cursor="text" borderRadius="md" bg={inputBgColor} px={2} position="relative" overflow="hidden" style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any} border="none">
          {isRefreshing && (
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              borderRadius="md"
              pointerEvents="none"
              zIndex={1}
              bg="rgba(59, 130, 246, 0.15)"
              sx={{
                transform: 'translateX(-100%)',
                animation: 'slideRight 0.6s ease-out forwards',
                '@keyframes slideRight': {
                  '0%': {
                    transform: 'translateX(-100%)',
                  },
                  '100%': {
                    transform: 'translateX(100%)',
                  },
                },
              }}
            />
          )}
          <Box position="relative" zIndex={2} width="100%" display="flex" alignItems="center" gap={1}>
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                size="sm"
                variant="unstyled"
                bg={inputBgColor}
                color={textColor}
                px={0}
                autoFocus
                width="100%"
                height="28px"
                borderRadius="md"
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
            ) : (
              breadcrumbs.map((crumb, idx) => (
                <Flex key={crumb.path} align="center">
                  <Flex
                    align="center"
                    px={2}
                    py="2px"
                    cursor={idx === breadcrumbs.length - 1 ? 'default' : 'pointer'}
                    bg={idx === breadcrumbs.length - 1 ? activeButtonBg : 'transparent'}
                    borderRadius="md"
                    _hover={idx !== breadcrumbs.length - 1 ? { 
                      bg: breadcrumbHoverBg
                    } : undefined}
                    transition="background 0.2s ease"
                    position="relative"
                    zIndex={1}
                    onClick={async (e) => {
                      e.stopPropagation(); // Prevent triggering the parent's onClick
                      if (idx !== breadcrumbs.length - 1) {
                        const normalizedPath = normalizePath(crumb.path);
                        try {
                          const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
                          if (isValid) {
                            setCurrentDirectory(normalizedPath)
                            addLog(`Changed directory to: ${normalizedPath}`)
                            setStatus(`Navigated to ${crumb.label}`, 'info')
                          } else {
                            addLog(`Cannot access path: ${crumb.path}`, 'error')
                            setStatus(`Cannot access ${crumb.label}`, 'error')
                          }
                        } catch (error) {
                          addLog(`Failed to navigate to ${crumb.path}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
                          setStatus(`Navigation failed`, 'error')
                        }
                      }
                    }}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight={idx === breadcrumbs.length - 1 ? 'medium' : 'normal'}
                      color={idx === breadcrumbs.length - 1 ? 'white' : textColor}
                      userSelect="none"
                    >
                      {crumb.label}
                    </Text>
                  </Flex>
                  {idx < breadcrumbs.length - 1 && (
                    <Text
                      color={textColor}
                      style={{ margin: '0 2px', opacity: 0.8 }}
                    >
                      \
                    </Text>
                  )}
                </Flex>
              ))
            )}
          </Box>
        </Flex>
        {/* Search Input Field - Same style as address bar, no border */}
        <InputGroup maxW="300px" ml="auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <InputLeftElement pointerEvents="none" h="33px" pl={2}>
            <Search size={16} color={useColorModeValue('#94a3b8', 'gray.400')} />
          </InputLeftElement>
          <Input
            placeholder={`Search ${getDirectoryName(currentDirectory)}`}
            size="sm"
            h="33px"
            borderRadius="md"
            bg={inputBgColor}
            border="none"
            color={textColor}
            fontSize="sm"
            pl={7}
            _placeholder={{ color: useColorModeValue('#94a3b8', 'gray.400') }}
            _focus={{
              bg: inputFocusBgColor,
              boxShadow: 'none',
              outline: 'none'
            }}
            onChange={(e) => {
              const query = e.target.value;
              // Filter files directly using fileSearchFilter (FileGrid handles the filtering)
              setFileSearchFilter(query);
              if (query.trim()) {
                setStatus(`Filtering files...`, 'info');
              } else {
                setStatus('', 'info');
              }
            }}
          />
        </InputGroup>
      </Flex>

      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader>Create New Folder</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Folder Name</FormLabel>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    e.preventDefault();
                    // Ctrl+Enter for regular create, Enter for create & enter
                    if (e.ctrlKey) {
                      handleCreateFolder();
                    } else {
                      handleCreateAndEnterFolder();
                    }
                  }
                }}
                placeholder="Enter folder name"
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleCreateFolder}>
              Create
            </Button>
            <Button colorScheme="green" mr={3} onClick={handleCreateAndEnterFolder}>
              Create & Enter
            </Button>
            <Button variant="ghost" onClick={() => setIsCreateFolderOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isCreateSpreadsheetOpen} onClose={() => setIsCreateSpreadsheetOpen(false)} isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent>
          <ModalHeader>Create New Spreadsheet</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>File Name</FormLabel>
              <Input
                value={newSpreadsheetName}
                onChange={(e) => setNewSpreadsheetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSpreadsheetName.trim()) {
                    e.preventDefault();
                    handleCreateBlankSpreadsheet();
                  }
                }}
                placeholder="Enter file name (without .xlsx)"
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button 
              colorScheme="blue" 
              mr={3} 
              onClick={handleCreateBlankSpreadsheet}
              isDisabled={!newSpreadsheetName.trim()}
            >
              Create
            </Button>
            <Button variant="ghost" onClick={() => setIsCreateSpreadsheetOpen(false)}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}