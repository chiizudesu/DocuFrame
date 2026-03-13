import React, { useState, useRef, useEffect } from 'react'
import {
  Flex,
  Text,
  IconButton,
  Input,
  InputGroup,
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
  Star,
  Download,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { useClientInfo } from '../hooks/useClientInfo'
import { joinPath, getParentPath, normalizePath, isChildPath } from '../utils/path'

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
  const { currentDirectory, setCurrentDirectory, addLog, rootDirectory, setStatus, setFolderItems, addTabToCurrentWindow, setIsQuickNavigating, setIsSearchMode, isPreviewPaneOpen, setIsPreviewPaneOpen, setSelectedFiles, setClipboard, quickAccessPaths, addQuickAccessPath, hideTemporaryFiles, hideDotFiles, setFileSearchFilter, isCreateFolderOpen, setIsCreateFolderOpen } = useAppContext()
  const { clientFolderPath, getClientName, openClientLink, hasClientLink } = useClientInfo(currentDirectory, rootDirectory)
  
  // Helper function to get directory name from path
  const getDirectoryName = (path: string): string => {
    if (!path) return 'Current Folder';
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Current Folder';
  }
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentDirectory)
  const [newFolderName, setNewFolderName] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCreateSpreadsheetOpen, setIsCreateSpreadsheetOpen] = useState(false)
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const addressBarRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputContainerRef = useRef<HTMLDivElement>(null)
  const [searchValue, setSearchValue] = useState('')
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

  // Light theme: light header; dark theme: dark header (unchanged)
  const bgColor = useColorModeValue('white', 'gray.700')
  const hoverBgColor = useColorModeValue('gray.200', 'blue.700')
  const activeButtonBg = bgColor // Use title bar background color for current path pill
  const activeButtonColor = useColorModeValue('#334155', 'blue.200')
  const breadcrumbHoverBg = useColorModeValue('gray.200', '#6b7280') // Hover color for parent paths
  const textColor = useColorModeValue('#334155', 'gray.100')
  const iconColor = useColorModeValue('#64748b', 'gray.400')
  const inputBgColor = useColorModeValue('white', 'gray.600')
  const inputFocusBgColor = useColorModeValue('gray.200', 'gray.500')
  const inputBorderColor = useColorModeValue('gray.300', 'transparent') // Light: thin border to separate inputs from white header
  const separatorColor = useColorModeValue('gray.300', 'gray.400')

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

  // Handle click outside search input to blur and clear
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchInputContainerRef.current && !searchInputContainerRef.current.contains(e.target as Node)) {
        // Clicked outside the search input container
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
          searchInputRef.current.blur();
          setSearchValue('');
          setFileSearchFilter('');
          setStatus('', 'info');
        }
      }
    };

    // Use mousedown instead of click to catch the event before focus changes
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setFileSearchFilter, setStatus]);

  // Exit edit mode when clicking outside the address bar
  useEffect(() => {
    if (!isEditing) return;
    
    const handleDocumentClick = async (e: MouseEvent) => {
      if (addressBarRef.current && !addressBarRef.current.contains(e.target as Node)) {
        setIsEditing(false);
        // If value changed, save changes (same logic as handleBlur)
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
        } else {
          // Reset to current directory if no changes
          setEditValue(currentDirectory);
        }
      }
    };
    
    // Use mousedown instead of click to catch the event before blur
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isEditing, editValue, currentDirectory, setCurrentDirectory, addLog, setStatus]);

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
    addLog(`Cold reloading directory: ${currentDirectory}`)
    setIsRefreshing(true)
    
    try {
      // Clear all state first for a true cold reload
      setSelectedFiles([])
      setSelectedFile(null)
      setClipboard({ files: [], operation: null })
      setFileSearchFilter('') // Clear search filter
      
      // Dispatch a force reload event that FileGrid will listen to for immediate reload
      // This bypasses debouncing and forces a fresh load
      window.dispatchEvent(new CustomEvent('forceDirectoryReload', { 
        detail: { 
          directory: currentDirectory,
          timestamp: Date.now() // Add timestamp to force reload even if directory hasn't changed
        } 
      }));
      
      // Also dispatch for other components
      window.dispatchEvent(new CustomEvent('folderRefresh'));
      
      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 600))
      setStatus('Directory reloaded', 'success')
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
  // Shows the full path as breadcrumbs. When a client is detected, the client folder crumb
  // is tagged as `isClientPill` so it renders as a compact pill rather than a full breadcrumb,
  // reducing visual redundancy while preserving hierarchy context.
  const getBreadcrumbs = (): { label: string; path: string; isClientPill?: boolean }[] => {
    const normalizedRoot = normalizePath(rootDirectory);
    const normalizedCurrent = normalizePath(currentDirectory);
    const normalizedClientFolder = clientFolderPath ? normalizePath(clientFolderPath) : null;

    if (!normalizedCurrent) {
      return [{ label: normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root', path: normalizedRoot }];
    }

    if (normalizedCurrent === normalizedRoot) {
      return [{ label: normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root', path: normalizedRoot }];
    }

    const buildCrumbs = (parts: string[], pathPrefix: string): { label: string; path: string; isClientPill?: boolean }[] => {
      const crumbs: { label: string; path: string; isClientPill?: boolean }[] = [];
      let path = pathPrefix;
      for (const part of parts) {
        path = joinPath(path, part);
        const normalizedPath = normalizePath(path);
        crumbs.push({
          label: part,
          path: normalizedPath,
          isClientPill: !!(normalizedClientFolder && normalizedPath === normalizedClientFolder),
        });
      }
      return crumbs;
    };

    if (isChildPath(normalizedRoot, normalizedCurrent)) {
      const relativePath = normalizedCurrent.substring(normalizedRoot.length);
      const segments = relativePath.split(/[\\/]/).filter(Boolean);
      const rootLabel = normalizedRoot.split(/[\\/]/).filter(Boolean).pop() || 'Root';
      return [
        { label: rootLabel, path: normalizedRoot },
        ...buildCrumbs(segments, normalizedRoot),
      ];
    } else {
      const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
      const parts = normalizedCurrent.split(/[\\/]/).filter(Boolean);

      if (isWindows && parts.length > 0 && /^[a-zA-Z]:$/.test(parts[0])) {
        const driveRoot = parts[0] + '\\';
        return [
          { label: parts[0], path: driveRoot },
          ...buildCrumbs(parts.slice(1), driveRoot),
        ];
      } else if (!isWindows) {
        return [
          { label: 'Root', path: '/' },
          ...buildCrumbs(parts, '/'),
        ];
      } else {
        return [{ label: normalizedCurrent, path: normalizedCurrent }];
      }
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
      const createdName = newFolderName
      setNewFolderName('')
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      setFolderItems(contents)
      // Select the newly created folder so F2 rename works immediately
      requestAnimationFrame(() => {
        setSelectedFiles([createdName])
      })
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
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          />
          <IconButton
            icon={<ChevronRight size={16} />}
            aria-label="Forward"
            variant="ghost"
            size="sm"
            mr={1}
            color={iconColor}
            onClick={handleForwardClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          />
          <IconButton
            icon={<Home size={16} />}
            aria-label="Home folder"
            variant="ghost"
            size="sm"
            mr={1}
            color={useColorModeValue('#3b82f6', 'blue.200')}
            onClick={handleHomeClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          />
          <IconButton
            icon={<Download size={16} />}
            aria-label="Downloads folder"
            variant="ghost"
            size="sm"
            mr={1}
            color={useColorModeValue('#10b981', 'green.200')}
            onClick={handleDownloadsClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
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
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
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
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          />
        </Box>
        {/* Address bar as breadcrumbs, starting after Home icon */}
        <Flex ref={addressBarRef} flex={1} mx={2} align="center" h="33px" gap={1} onClick={handleClick} cursor="text" borderRadius="md" bg={inputBgColor} px={2} position="relative" overflow="hidden" style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any} border="1px solid" borderColor={inputBorderColor}>
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
                <Flex key={crumb.path} align="center" flexShrink={crumb.isClientPill ? 1 : 0}>
                  {crumb.isClientPill ? (
                    <Tooltip label={hasClientLink ? `${getClientName() || crumb.label} — Ctrl+click to open client page` : getClientName() || crumb.label} placement="bottom" hasArrow openDelay={400}>
                      <Box
                        as="span"
                        px={3}
                        py={0.9}
                        borderRadius="full"
                        bg="green.600"
                        color="white"
                        fontSize="sm"
                        fontWeight="medium"
                        cursor="pointer"
                        _hover={{ bg: 'green.500' }}
                        transition="background 0.15s"
                        userSelect="none"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if ((e.ctrlKey || e.metaKey) && hasClientLink) {
                            openClientLink();
                            return;
                          }
                          const normalizedPath = normalizePath(crumb.path);
                          try {
                            const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
                            if (isValid) {
                              setCurrentDirectory(normalizedPath);
                              addLog(`Changed directory to: ${normalizedPath}`);
                              setStatus(`Navigated to ${crumb.label}`, 'info');
                            }
                          } catch {}
                        }}
                      >
                        {crumb.label}
                      </Box>
                    </Tooltip>
                  ) : (
                    <Flex
                      align="center"
                      px={2}
                      py="2px"
                      cursor={idx === breadcrumbs.length - 1 ? 'default' : 'pointer'}
                      bg={idx === breadcrumbs.length - 1 ? activeButtonBg : 'transparent'}
                      borderRadius="md"
                      _hover={idx !== breadcrumbs.length - 1 ? { bg: breadcrumbHoverBg } : undefined}
                      transition="background 0.2s ease"
                      position="relative"
                      zIndex={1}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (idx !== breadcrumbs.length - 1) {
                          const normalizedPath = normalizePath(crumb.path);
                          try {
                            const isValid = await (window.electronAPI as any).validatePath(normalizedPath);
                            if (isValid) {
                              setCurrentDirectory(normalizedPath);
                              addLog(`Changed directory to: ${normalizedPath}`);
                              setStatus(`Navigated to ${crumb.label}`, 'info');
                            } else {
                              addLog(`Cannot access path: ${crumb.path}`, 'error');
                              setStatus(`Cannot access ${crumb.label}`, 'error');
                            }
                          } catch (error) {
                            addLog(`Failed to navigate to ${crumb.path}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
                            setStatus(`Navigation failed`, 'error');
                          }
                        }
                      }}
                    >
                      <Text
                        fontSize="sm"
                        fontWeight={idx === breadcrumbs.length - 1 ? 'medium' : 'normal'}
                        color={idx === breadcrumbs.length - 1 ? activeButtonColor : textColor}
                        userSelect="none"
                      >
                        {crumb.label}
                      </Text>
                    </Flex>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <Box as="span" display="inline-flex" alignItems="center" mx={1} opacity={0.8} color={textColor}>
                      <ChevronRight size={14} />
                    </Box>
                  )}
                </Flex>
              ))
            )}
          </Box>
        </Flex>
        {/* Search Input Field - Same style as address bar, no border */}
        <InputGroup ref={searchInputContainerRef} maxW="300px" ml="auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Input
            ref={searchInputRef}
            value={searchValue}
            placeholder="Search Clients"
            size="sm"
            h="33px"
            borderRadius="md"
            bg={inputBgColor}
            border="1px solid"
            borderColor={inputBorderColor}
            color={textColor}
            fontSize="sm"
            pl={3}
            tabIndex={-1}
            _placeholder={{ color: useColorModeValue('gray.500', 'gray.400') }}
            _focus={{
              bg: inputFocusBgColor,
              boxShadow: 'none',
              outline: 'none'
            }}
            onClick={(e) => {
              // Only focus when clicking directly on the input
              e.currentTarget.focus();
            }}
            onBlur={(e) => {
              // Clear text when input loses focus
              setSearchValue('');
              setFileSearchFilter('');
              setStatus('', 'info');
            }}
            onChange={(e) => {
              const query = e.target.value;
              setSearchValue(query);
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