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
} from '@chakra-ui/react'
import {
  Home,
  Grid as GridIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  ExternalLink,
  Monitor,
  FolderPlus,
  Minimize2,
  Maximize2,
  X,
  Square,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, getParentPath, isAbsolutePath } from '../utils/path'

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
  const { currentDirectory, setCurrentDirectory, addLog, rootDirectory, setStatus, setFolderItems } = useAppContext()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentDirectory)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('fileViewMode') as 'grid' | 'list') || 'grid',
  )
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [clickCount, setClickCount] = useState(0)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Optimized color values for consistent light mode appearance
  const bgColor = useColorModeValue('#f1f5f9', 'gray.800')
  const hoverBgColor = useColorModeValue('#e2e8f0', 'blue.700')
  const activeButtonBg = useColorModeValue('#3b82f6', 'gray.900')
  const activeButtonColor = useColorModeValue('white', 'blue.200')
  const textColor = useColorModeValue('#475569', 'gray.100')
  const iconColor = useColorModeValue('#64748b', 'gray.400')
  const inputBgColor = useColorModeValue('#ffffff', 'gray.700')
  const inputFocusBgColor = useColorModeValue('#f8fafc', 'gray.600')
  const separatorColor = useColorModeValue('#94a3b8', 'gray.400')

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

  const handleBlur = () => {
    setIsEditing(false)
    if (editValue !== currentDirectory) {
      setCurrentDirectory(editValue)
      addLog(`Changed directory to: ${editValue}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
      if (editValue !== currentDirectory) {
        setCurrentDirectory(editValue)
        addLog(`Changed directory to: ${editValue}`)
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(currentDirectory)
    }
  }

  const handleHomeClick = () => {
    setCurrentDirectory(rootDirectory)
    addLog('Navigated to root directory')
    setStatus('Navigated to home', 'info')
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
      
      setFolderItems(contents)
      setStatus('Folder refreshed', 'info')
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

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('fileViewMode', mode)
    window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: mode }))
    addLog(`Changed view mode to: ${mode}`)
    setStatus(`Switched to ${mode} view`, 'info')
  }

  const handleBackClick = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setCurrentDirectory(history[historyIndex - 1])
      addLog(`Navigated back to: ${history[historyIndex - 1]}`)
    } else {
      const parent = getParentPath(currentDirectory)
      if (parent && parent !== currentDirectory) {
        setCurrentDirectory(parent)
        addLog(`Navigated back to: ${parent}`)
      }
    }
  }

  const handleForwardClick = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setCurrentDirectory(history[historyIndex + 1])
      addLog(`Navigated forward to: ${history[historyIndex + 1]}`)
    } else {
      addLog('No forward history')
    }
  }

  // Breadcrumbs logic
  // Show Home icon as root, then each folder as a clickable segment
  const getBreadcrumbs = () => {
    // If at root, show only the root
    const normRoot = rootDirectory.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
    const normCurrent = currentDirectory.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '')
    if (normCurrent === normRoot) {
      return [{ label: rootDirectory.split(/[\\/]/).filter(Boolean).pop() || 'Root', path: rootDirectory }]
    }
    // Compute relative path from root
    let rel = normCurrent.replace(normRoot, '')
    rel = rel.replace(/^[/\\]+/, '') // Remove leading slashes
    const segments = rel.split(/[\\/]/).filter(Boolean)
    const breadcrumbs = []
    let path = rootDirectory
    breadcrumbs.push({ label: rootDirectory.split(/[\\/]/).filter(Boolean).pop() || 'Root', path })
    for (const seg of segments) {
      path = joinPath(path, seg)
      breadcrumbs.push({ label: seg, path })
    }
    return breadcrumbs
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

  return (
    <>
      <Flex align="center" width="100%" bg={bgColor} borderRadius="sm" h="32px" style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as any}>
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
        </Box>
        {/* Address bar as breadcrumbs, starting after Home icon */}
        <Flex flex={1} mx={2} align="center" h="32px" gap={1} onClick={handleClick} cursor="text" border="1px solid" borderColor={useColorModeValue('#d1d5db', 'gray.700')} borderRadius="md" bg={inputBgColor} px={2} position="relative" overflow="hidden" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering the parent's onClick
                      if (idx !== breadcrumbs.length - 1) {
                        setCurrentDirectory(crumb.path)
                        addLog(`Changed directory to: ${crumb.path}`)
                        setStatus(`Navigated to ${crumb.label}`, 'info')
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
        <HStack spacing={1} px={1} style={{ WebkitAppRegion: 'no-drag' } as any}>
          <IconButton
            icon={<RefreshCw size={16} />}
            aria-label="Refresh folder"
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            color={iconColor}
            _hover={{ bg: hoverBgColor }}
          />
          <IconButton
            icon={<FolderPlus size={16} />}
            aria-label="Create folder"
            variant="ghost"
            size="sm"
            onClick={() => setIsCreateFolderOpen(true)}
            color={iconColor}
            _hover={{ bg: hoverBgColor }}
          />
          <IconButton
            icon={<GridIcon size={16} />}
            aria-label="Grid view"
            variant={viewMode === 'grid' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
            bg={viewMode === 'grid' ? activeButtonBg : undefined}
            color={viewMode === 'grid' ? activeButtonColor : iconColor}
            _hover={{ bg: viewMode === 'grid' ? activeButtonBg : hoverBgColor }}
          />
          <IconButton
            icon={<ListIcon size={16} />}
            aria-label="List view"
            variant={viewMode === 'list' ? 'solid' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
            bg={viewMode === 'list' ? activeButtonBg : undefined}
            color={viewMode === 'list' ? activeButtonColor : iconColor}
            _hover={{ bg: viewMode === 'list' ? activeButtonBg : hoverBgColor }}
          />
          <IconButton
            icon={<ExternalLink size={16} />}
            aria-label="Open in explorer"
            variant="ghost"
            size="sm"
            onClick={handleOpenExplorer}
            color={iconColor}
            _hover={{ bg: hoverBgColor }}
          />
        </HStack>
      </Flex>

      <Modal isOpen={isCreateFolderOpen} onClose={() => setIsCreateFolderOpen(false)} isCentered>
        <ModalOverlay />
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
    </>
  )
}