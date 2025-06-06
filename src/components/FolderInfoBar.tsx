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
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { joinPath, getParentPath, isAbsolutePath } from '../utils/path'

export const FolderInfoBar: React.FC = () => {
  const { currentDirectory, setCurrentDirectory, addLog, rootDirectory } = useAppContext()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentDirectory)
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    (localStorage.getItem('fileViewMode') as 'grid' | 'list') || 'grid',
  )
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  // Precompute all color values
  const bgColor = useColorModeValue('#eef1f8', 'gray.800')
  const hoverBgColor = useColorModeValue('#e6e9ff', 'blue.700')
  const activeButtonBg = useColorModeValue('blue.50', 'blue.900')
  const activeButtonColor = useColorModeValue('blue.600', 'blue.200')
  const textColor = useColorModeValue('gray.700', 'gray.100')
  const iconColor = useColorModeValue('gray.600', 'gray.400')
  const inputBgColor = useColorModeValue('#f8f9fc', 'gray.700')
  const inputFocusBgColor = useColorModeValue('#f0f2f8', 'gray.600')
  const separatorColor = useColorModeValue('gray.500', 'gray.400')

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
    setIsEditing(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
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
  }

  const handleRefresh = () => {
    addLog(`Refreshing directory: ${currentDirectory}`)
  }

  const handleOpenExplorer = () => {
    addLog(`Opening in file explorer: ${currentDirectory}`)
  }

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('fileViewMode', mode)
    window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: mode }))
    addLog(`Changed view mode to: ${mode}`)
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
      await window.electron.createDirectory(fullPath)
      addLog(`Created folder: ${newFolderName}`)
      setIsCreateFolderOpen(false)
      setNewFolderName('')
      // Refresh the current directory
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory)
      // You'll need to implement a way to refresh the file list in your app
    } catch (error) {
      console.error('Error creating folder:', error)
      addLog(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  return (
    <>
      <Flex align="center" width="100%" bg={bgColor} borderRadius="sm" h="32px">
        {/* Back/Forward to the left of Home */}
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
          color={activeButtonColor}
          onClick={handleHomeClick}
        />
        {/* Address bar as breadcrumbs, starting after Home icon */}
        <Box flex="1" borderRadius="sm" overflow="hidden" px={2}>
          {isEditing ? (
            <InputGroup>
              <InputLeftElement pointerEvents="none" color="gray.500">
                \
              </InputLeftElement>
              <Input
                ref={inputRef}
                value={editValue.replace(/\//g, '\\')}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                pl={6}
                bg={inputBgColor}
                border="none"
                _focus={{
                  boxShadow: 'none',
                  bg: inputFocusBgColor,
                }}
                h="32px"
              />
            </InputGroup>
          ) : (
            <Flex align="center" h="32px" gap={1} onClick={handleClick} cursor="text">
              {breadcrumbs.map((crumb, idx) => (
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
                      }
                    }}
                  >
                    <Text
                      fontSize="sm"
                      fontWeight={idx === breadcrumbs.length - 1 ? 'medium' : 'normal'}
                      color={textColor}
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
              ))}
            </Flex>
          )}
        </Box>
        <HStack spacing={1} px={1}>
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
                placeholder="Enter folder name"
                autoFocus
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={handleCreateFolder}>
              Create
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