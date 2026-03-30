import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { useColorModeValue } from "./ui/color-mode";
import {
  Flex,
  Text,
  IconButton,
  Input,
  Box,
  HStack,
  Button,
  Menu,
  Portal,
  Field,
  Dialog,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  Home,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Star,
  SquareTerminal,
  ExternalLink,
  File,
  Folder,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { useClientInfo } from '../hooks/useClientInfo'
import { useYearNavigation } from '../hooks/useYearNavigation'
import { useDirectorySearch } from '../hooks/useDirectorySearch'
import { joinPath, getParentPath, normalizePath, isChildPath, getRelativePathSegments, pathsEqualForJump, resolveJumpTargetInBreadcrumbs } from '../utils/path'
import { eventMatchesShortcut } from '../utils/shortcuts'
import type { FileItem } from '../types'
import {
  docuFramePalette as P,
  dfHomeIconColor,
  DF_SESSION_RAIL_BG,
  DF_TOOLBAR_TOGGLE_ACTIVE_HOVER_BG,
} from '../docuFrameColors'

/** Matches jump UI `fontSize="sm"` + `fontWeight="medium"` for width measurement */
const MINI_JUMP_UI_FONT =
  '500 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function measureJumpUiTextWidthPx(text: string): number {
  if (!text) return 0
  if (typeof document === 'undefined') return Math.ceil(text.length * 8)
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (!ctx) return Math.ceil(text.length * 8)
  ctx.font = MINI_JUMP_UI_FONT
  return Math.ceil(ctx.measureText(text).width)
}

/** Dropdown row: Chakra `px={3}` + icon 14 + `gap={2}` */
const MINI_DROPDOWN_ROW_EXTRAS_PX = 24 + 14 + 8
/** Typing pill outer `px={2}` horizontal + small cushion */
const MINI_PILL_BOX_HPAD_PX = 16 + 8
/** Minimum visible width in “character units” (measured at jump UI font) */
const MINI_JUMP_MIN_WIDTH_CHAR_COUNT = 30

function computeMiniJumpLongestLabel(
  filterText: string,
  results: Pick<FileItem, 'name'>[],
  anchorPillLabel: string | null
): string {
  let s = filterText
  if (anchorPillLabel && anchorPillLabel.length > s.length) s = anchorPillLabel
  for (const r of results) {
    if (r.name.length > s.length) s = r.name
  }
  return s
}

function computeMiniJumpUiMinWidthPx(
  filterText: string,
  results: Pick<FileItem, 'name'>[],
  anchorPillLabel: string | null
): number {
  const longest = computeMiniJumpLongestLabel(filterText, results, anchorPillLabel)
  const minChBarPx = measureJumpUiTextWidthPx('0'.repeat(MINI_JUMP_MIN_WIDTH_CHAR_COUNT))
  const textW = Math.max(measureJumpUiTextWidthPx(longest), minChBarPx)
  const pillMin = MINI_PILL_BOX_HPAD_PX + textW
  const dropdownMin = results.length > 0 ? MINI_DROPDOWN_ROW_EXTRAS_PX + textW : pillMin
  return Math.max(pillMin, dropdownMin, 80)
}

const MiniSearchDropdown: React.FC<{
  pillRef: React.RefObject<HTMLElement | null>
  /** Bumps when address bar layout may shift (e.g. trailing chevron hides) — RO does not fire on position-only moves */
  layoutSyncKey: string | number
  /** At least wide enough for longest filter / result label (measured) */
  contentMinWidthPx: number
  results: FileItem[]
  selectedIndex: number
  dropdownBg: string
  dropdownHighlightBg: string
  dropdownHoverBg: string
  folderIconColor: string
  fileIconColor: string
  dropdownBorderColor: string
  onSelect: (item: FileItem) => void
}> = ({
  pillRef,
  layoutSyncKey,
  contentMinWidthPx,
  results,
  selectedIndex,
  dropdownBg,
  dropdownHighlightBg,
  dropdownHoverBg,
  folderIconColor,
  fileIconColor,
  dropdownBorderColor,
  onSelect,
}) => {
  const [pillRect, setPillRect] = React.useState<DOMRect | null>(null)

  /** Pill can move without resizing (e.g. Tab into folder adds segments); sync before paint */
  React.useLayoutEffect(() => {
    const el = pillRef.current
    if (!el) {
      setPillRect(null)
      return
    }
    setPillRect(el.getBoundingClientRect())
  }, [pillRef, layoutSyncKey])

  React.useEffect(() => {
    const el = pillRef.current
    if (!el) {
      setPillRect(null)
      return
    }
    const update = () => setPillRect(el.getBoundingClientRect())
    const scheduleAnchoredRead = () => {
      update()
      requestAnimationFrame(() => {
        update()
        requestAnimationFrame(update)
      })
      const t = window.setTimeout(update, 80)
      return () => window.clearTimeout(t)
    }
    let clearTimer: (() => void) | undefined
    const run = () => {
      clearTimer?.()
      clearTimer = scheduleAnchoredRead()
    }
    run()
    const ro = new ResizeObserver(run)
    ro.observe(el)
    const onScroll = () => update()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', run)
    return () => {
      clearTimer?.()
      ro.disconnect()
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', run)
    }
  }, [pillRef, layoutSyncKey])
  if (!pillRect || results.length === 0) return null
  const naturalW = Math.max(pillRect.width, contentMinWidthPx, 1)
  const maxAllowed =
    typeof window !== 'undefined' ? Math.max(120, window.innerWidth - pillRect.left - 16) : naturalW
  const wPx = Math.min(naturalW, maxAllowed)
  const needsScrollX = naturalW > maxAllowed
  return (
    <Portal>
      <Box
        data-mini-search-dropdown
        position="fixed"
        bg={dropdownBg}
        border="1px solid"
        borderColor={dropdownBorderColor}
        borderRadius="md"
        boxShadow="lg"
        maxH="200px"
        overflowY="auto"
        overflowX={needsScrollX ? 'auto' : 'hidden'}
        zIndex={9999}
        left={`${pillRect.left}px`}
        top={`${pillRect.bottom + 4}px`}
        w={`${wPx}px`}
        minW={`${wPx}px`}
        maxW={`${wPx}px`}
      >
        <Box minW={`${naturalW}px`} w="max-content">
          {results.map((item, i) => (
            <Flex
              key={item.path}
              align="center"
              gap={2}
              px={3}
              py={2}
              cursor="pointer"
              border="none"
              bg={i === selectedIndex ? dropdownHighlightBg : 'transparent'}
              _hover={{ bg: dropdownHoverBg }}
              onClick={() => onSelect(item)}
              whiteSpace="nowrap"
            >
              {item.type === 'folder' ? (
                <Folder size={14} color={folderIconColor} />
              ) : (
                <File size={14} color={fileIconColor} />
              )}
              <Text fontSize="sm" fontWeight="medium">
                {item.name}
              </Text>
            </Flex>
          ))}
        </Box>
      </Box>
    </Portal>
  )
}

export const FolderInfoBar: React.FC = () => {
  const { currentDirectory, setCurrentDirectory, addLog, rootDirectory, setStatus, setFolderItems, addTabToCurrentWindow, setIsQuickNavigating, setIsSearchMode, isPreviewPaneOpen, setIsPreviewPaneOpen, setSelectedFiles, setClipboard, quickAccessPaths, addQuickAccessPath, hideTemporaryFiles, hideDotFiles, fileSearchFilter, setFileSearchFilter, setIsCreateFolderOpen, addressBarJumpRef, jumpModeOnParentShortcut, backspaceNavigationShortcut, enableBackspaceNavigationShortcut } = useAppContext()
  const { clientFolderPath, getClientName, openClientLink, hasClientLink } = useClientInfo(currentDirectory, rootDirectory)
  const yearNav = useYearNavigation(currentDirectory)
  
  // Helper function to get directory name from path
  const getDirectoryName = (path: string): string => {
    if (!path) return 'Current Folder'
    if (normalizePath(path) === '/') return 'Root'
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
    return parts[parts.length - 1] || 'Current Folder'
  }
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(currentDirectory)
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
  const [activeChevronIndex, setActiveChevronIndex] = useState<number | null>(null)
  const [miniSearchPath, setMiniSearchPath] = useState<string>('')
  const [miniAnchorPath, setMiniAnchorPath] = useState<string>('')
  /** First parent-shortcut shows pill ring; second applies (search path up, or lift jump anchor on main crumbs) */
  const [miniJumpParentNavPreview, setMiniJumpParentNavPreview] = useState(false)
  const miniSearchInputRef = useRef<HTMLInputElement>(null)
  const miniSearchContainerRef = useRef<HTMLDivElement>(null)
  const miniPathFlexRef = useRef<HTMLDivElement>(null)
  const miniTypingPillRef = useRef<HTMLElement | null>(null)
  const applyEnterNavigationRef = useRef<() => void>(() => {})
  const miniSearchTextRef = useRef('')
  const handleMiniSearchBackspaceRef = useRef<() => void>(() => {})


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
      // Filter temporary files (Office ~$ lock files, Word ~*.tmp like ~WRL2535.tmp)
      if (hideTemporaryFiles && f?.type !== 'folder' && typeof f?.name === 'string' && (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp')))) {
        return false;
      }
      
      // Filter dot files/folders (files/folders starting with .)
      if (hideDotFiles && typeof f?.name === 'string' && f.name.startsWith('.')) {
        return false;
      }
      
      return true;
    });
  }

  const jumpSearchItemInclude = useCallback(
    (f: FileItem) => {
      if (
        hideTemporaryFiles &&
        f?.type !== 'folder' &&
        typeof f?.name === 'string' &&
        (f.name.startsWith('~$') || (f.name.startsWith('~') && f.name.endsWith('.tmp')))
      ) {
        return false
      }
      if (hideDotFiles && typeof f?.name === 'string' && f.name.startsWith('.')) {
        return false
      }
      return true
    },
    [hideTemporaryFiles, hideDotFiles]
  )

  // Address row: v2 FolderInfoBar — gray.700 strip, gray.600 address well
  const bgColor = useColorModeValue('#f8fafc', P.dark.tabStrip)
  const homeIconColor = useColorModeValue(dfHomeIconColor.light, dfHomeIconColor.dark)
  /** Ghost icons on folder bar strip — same cool-gray hue as strip, lighter/darker for contrast */
  const folderBarStripHoverBg = useColorModeValue(P.light.chromeHover, P.dark.chromeHover)
  /** Pinned star: same active blue as function-row toggles (solid variant was defaulting to white). */
  const pinActiveBg = useColorModeValue(P.light.rowSelected, DF_SESSION_RAIL_BG)
  const pinActiveHoverBg = useColorModeValue('#b8d4f0', DF_TOOLBAR_TOGGLE_ACTIVE_HOVER_BG)
  const inputBgColor = useColorModeValue('white', '#4A5568')
  // Dark: gray.700 pill on gray.600 well; light: strip tint for current crumb
  const activeButtonBg = useColorModeValue(bgColor, '#2D3748')
  const activeButtonColor = useColorModeValue('#334155', '#69c3f4')
  /** Breadcrumbs / chevrons inside address well — light: slate on white; dark: lighter than well (#4A5568) */
  const addressBarItemHoverBg = useColorModeValue(P.light.chromeHover, P.dark.addressWellHover)
  const textColor = useColorModeValue('#334155', 'gray.100')
  const iconColor = useColorModeValue('#64748b', P.dark.subtext)
  const inputFocusBgColor = useColorModeValue('gray.200', '#4A5568')
  const inputBorderColor = useColorModeValue('gray.300', 'transparent') // Light: thin border to separate inputs from white header
  const separatorColor = useColorModeValue('gray.300', P.dark.border)
  const yearNavDisabledColor = useColorModeValue('gray.300', 'gray.600')
  const dropdownBg = useColorModeValue('white', P.dark.toolbar)
  const dropdownHighlightBg = useColorModeValue('blue.50', P.dark.rowSelected)
  const dropdownHoverBg = useColorModeValue('gray.100', P.dark.rowHover)
  const folderIconColor = useColorModeValue('#3b82f6', '#63B3ED')
  const fileIconColor = useColorModeValue('#64748b', '#718096')
  const placeholderColor = useColorModeValue('gray.500', 'gray.400')
  const miniCurrentFolderBg = useColorModeValue('gray.600', 'gray.400')
  const miniCurrentFolderColor = useColorModeValue('white', 'gray.900')
  const miniSeparatorColor = useColorModeValue('gray.500', 'gray.400')
  const miniDividerColor = useColorModeValue('gray.200', 'whiteAlpha.200')
  const miniTypePillBg = useColorModeValue('blue.50', 'blue.900')
  const miniTypePillBorder = useColorModeValue('blue.400', 'blue.400')
  const miniTypePillFg = useColorModeValue('blue.800', 'white')
  const miniTypePillPlaceholder = useColorModeValue('blue.400', 'blue.300')
  const miniDropdownBorderColor = useColorModeValue('gray.300', 'whiteAlpha.300')
  const miniJumpPreviewRing = useColorModeValue('0 0 0 2px #3b82f6', '0 0 0 2px #90cdf4')
  const addressBarJumpGlow = useColorModeValue(
    '0 0 0 1px rgba(59, 130, 246, 0.45), 0 0 16px rgba(59, 130, 246, 0.22)',
    '0 0 0 1px rgba(147, 197, 253, 0.5), 0 0 22px rgba(59, 130, 246, 0.32)',
  )
  const addressBarJumpBorderColor = useColorModeValue('blue.400', 'blue.300')
  /** Bright blue sweep — clean 6-stop gradient, leading edge slightly sharper */
  const addressRefreshSweepGradient = useColorModeValue(
    'linear-gradient(90deg, rgba(37,99,235,0) 0%, rgba(29,78,216,0.45) 20%, rgba(29,78,216,0.9) 42%, #2563eb 52%, rgba(59,130,246,0.55) 72%, rgba(96,165,250,0) 100%)',
    'linear-gradient(90deg, rgba(59,130,246,0) 0%, rgba(59,130,246,0.4) 18%, rgba(37,99,235,0.85) 40%, #3b82f6 52%, rgba(96,165,250,0.5) 70%, rgba(147,197,253,0) 100%)',
  )

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
    if (isEditing || activeChevronIndex !== null) {
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

  // Sync search input when filter is cleared externally (e.g. when FileGrid loads new directory)
  useEffect(() => {
    if (fileSearchFilter === '') {
      setSearchValue('');
      setStatus('', 'info');
    }
  }, [fileSearchFilter, setStatus]);

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

  const handleOpenCmdClick = async () => {
    try {
      const result = await (window.electronAPI as any).openCmdAtDirectory(currentDirectory);
      if (result?.success) {
        addLog(`Opened CMD at: ${currentDirectory}`);
        setStatus('Opened CMD at current directory', 'success');
      } else {
        addLog(`Failed to open CMD: ${result?.error || 'Unknown error'}`, 'error');
        setStatus('Failed to open CMD', 'error');
      }
    } catch (error) {
      addLog(`Failed to open CMD: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
      setStatus('Failed to open CMD', 'error');
    }
  }

  const handleRefresh = async () => {
    addLog(`Cold reloading directory: ${currentDirectory}`)
    setIsRefreshing(true)
    
    try {
      // Clear all state first for a true cold reload
      setSelectedFiles([])
      setClipboard({ files: [], operation: null })
      setSearchValue('')
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
      
      // Hold overlay through at least one full sweep (matches CSS animation duration)
      await new Promise(resolve => setTimeout(resolve, 580))
      setStatus('Directory reloaded', 'success')
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 580))
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

  const directorySearch = useDirectorySearch({
    directoryPath: miniSearchPath,
    isActive: activeChevronIndex !== null && !!miniSearchPath,
    itemPredicate: jumpSearchItemInclude,
  })
  const {
    searchText: miniSearchText,
    setSearchText: setMiniSearchText,
    searchResults: miniSearchResults,
    selectedResultIndex: miniSelectedIndex,
    setSelectedResultIndex: setMiniSelectedIndex,
  } = directorySearch

  const handleOpenFile = async (file: FileItem) => {
    try {
      if (window.electronAPI && typeof (window.electronAPI as any).openFile === 'function') {
        await (window.electronAPI as any).openFile(file.path)
      }
    } catch (error) {
      addLog(`Failed to open file: ${file.path}`, 'error')
      setStatus(`Failed to open file`, 'error')
    }
  }

  const closeMiniSearch = () => {
    setActiveChevronIndex(null)
    setMiniSearchPath('')
    setMiniAnchorPath('')
    setMiniJumpParentNavPreview(false)
    setMiniSearchText('')
  }

  const openMiniSearch = (idx: number, initialText = '') => {
    if (breadcrumbs[idx]) {
      const anchorPath = breadcrumbs[idx].path
      setActiveChevronIndex(idx)
      setMiniSearchPath(anchorPath)
      setMiniAnchorPath(anchorPath)
      setMiniJumpParentNavPreview(false)
      setMiniSearchText(initialText)
    }
  }

  const liftMiniAnchorLeft = () => {
    if (activeChevronIndex === null || activeChevronIndex <= 0) return
    const newIdx = activeChevronIndex - 1
    const crumb = breadcrumbs[newIdx]
    if (!crumb) return
    setActiveChevronIndex(newIdx)
    setMiniAnchorPath(crumb.path)
    setMiniSearchPath(crumb.path)
    setMiniSearchText('')
    setMiniJumpParentNavPreview(false)
  }

  const handleMiniSearchBackspace = () => {
    if (miniSearchText.length > 0) return

    if (!pathsEqualForJump(miniSearchPath, miniAnchorPath)) {
      const parentPath = getParentPath(miniSearchPath)
      if (parentPath) {
        if (pathsEqualForJump(parentPath, miniAnchorPath) || isChildPath(miniAnchorPath, parentPath)) {
          if (miniJumpParentNavPreview) {
            setMiniSearchPath(parentPath)
            setMiniSearchText('')
            setMiniJumpParentNavPreview(false)
            return
          }
          setMiniJumpParentNavPreview(true)
          return
        }
      }
    }

    if (activeChevronIndex !== null && activeChevronIndex > 0) {
      if (miniJumpParentNavPreview) {
        setMiniJumpParentNavPreview(false)
        liftMiniAnchorLeft()
        return
      }
      setMiniJumpParentNavPreview(true)
      return
    }

    setMiniJumpParentNavPreview(false)
  }

  miniSearchTextRef.current = miniSearchText
  handleMiniSearchBackspaceRef.current = handleMiniSearchBackspace

  const commitMiniJumpEnter = () => {
    if (activeChevronIndex === null) return
    if (miniSearchText.trim() && miniSearchResults.length > 0) {
      const idx = Math.min(miniSelectedIndex, miniSearchResults.length - 1)
      const item = miniSearchResults[idx]
      if (item.type === 'folder') {
        setCurrentDirectory(item.path)
        addLog(`Navigated to: ${item.path}`)
        setStatus(`Navigated to ${item.name}`, 'info')
      } else {
        void handleOpenFile(item)
      }
      closeMiniSearch()
      return
    }
    const normalizedPath = normalizePath(miniSearchPath)
    if (!normalizedPath) {
      closeMiniSearch()
      return
    }
    void (async () => {
      try {
        const isValid = await (window.electronAPI as any).validatePath(normalizedPath)
        if (isValid) {
          setCurrentDirectory(normalizedPath)
          addLog(`Navigated to: ${normalizedPath}`)
          setStatus(`Navigated to folder`, 'info')
        } else {
          setStatus(`Cannot access folder`, 'error')
        }
      } catch {
        setStatus(`Navigation failed`, 'error')
      }
    })()
    closeMiniSearch()
  }

  applyEnterNavigationRef.current = commitMiniJumpEnter

  useLayoutEffect(() => {
    const norm = (p: string) => normalizePath(p)
    addressBarJumpRef.current = {
      isActive: () => activeChevronIndex !== null,
      openAtCurrentDirectory: ({ initialText = '' } = {}) => {
        const cd = norm(currentDirectory)
        let idx = breadcrumbs.findIndex((c) => norm(c.path) === cd)
        if (idx < 0) idx = Math.max(0, breadcrumbs.length - 1)
        const c = breadcrumbs[idx]
        if (!c) return
        setActiveChevronIndex(idx)
        setMiniSearchPath(c.path)
        setMiniAnchorPath(c.path)
        setMiniJumpParentNavPreview(false)
        setMiniSearchText(initialText)
        requestAnimationFrame(() => miniSearchInputRef.current?.focus())
      },
      openAtParentDirectory: ({ initialText = '' } = {}) => {
        const parentPath = getParentPath(currentDirectory) || rootDirectory
        const np = norm(parentPath)
        let idx = breadcrumbs.findIndex((c) => norm(c.path) === np)
        if (idx < 0) idx = 0
        const c = breadcrumbs[idx]
        if (!c) return
        setActiveChevronIndex(idx)
        setMiniSearchPath(c.path)
        setMiniAnchorPath(c.path)
        setMiniJumpParentNavPreview(false)
        setMiniSearchText(initialText)
        requestAnimationFrame(() => miniSearchInputRef.current?.focus())
      },
      openAtPath: (path: string, { initialText = '' } = {}) => {
        const resolved = resolveJumpTargetInBreadcrumbs(breadcrumbs, path)
        if (!resolved) return false
        setActiveChevronIndex(resolved.anchorIndex)
        setMiniAnchorPath(resolved.anchorPath)
        setMiniSearchPath(resolved.targetNormalized)
        setMiniJumpParentNavPreview(false)
        setMiniSearchText(initialText)
        requestAnimationFrame(() => miniSearchInputRef.current?.focus())
        return true
      },
      appendFilterText: (text: string) => {
        if (activeChevronIndex === null) return
        setMiniSearchText((prev) => prev + text)
        requestAnimationFrame(() => miniSearchInputRef.current?.focus())
      },
      globalBackspace: () => {
        if (activeChevronIndex === null) return
        if (miniSearchTextRef.current.length > 0) {
          setMiniSearchText((t) => t.slice(0, -1))
        } else {
          handleMiniSearchBackspaceRef.current()
        }
      },
      close: () => closeMiniSearch(),
      applyEnterNavigation: () => applyEnterNavigationRef.current(),
    }
    return () => {
      addressBarJumpRef.current = null
    }
  }, [addressBarJumpRef, activeChevronIndex, breadcrumbs, currentDirectory, rootDirectory])

  const MINI_SEARCH_MAX_RESULTS = 3

  const handleMiniSearchKeyDown = (e: React.KeyboardEvent) => {
    const maxIdx = Math.min(miniSearchResults.length, MINI_SEARCH_MAX_RESULTS) - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMiniSelectedIndex(Math.min(miniSelectedIndex + 1, maxIdx))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMiniSelectedIndex(Math.max(0, miniSelectedIndex - 1))
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (miniSearchResults.length > 0) {
        const idx = Math.min(miniSelectedIndex, miniSearchResults.length - 1)
        const item = miniSearchResults[idx]
        if (item.type === 'folder') {
          setMiniSearchPath(item.path)
          setMiniSearchText('')
          setMiniSelectedIndex(0)
          setMiniJumpParentNavPreview(false)
        } else {
          handleOpenFile(item)
          closeMiniSearch()
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commitMiniJumpEnter()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMiniSearch()
    } else if (eventMatchesShortcut(e.nativeEvent, jumpModeOnParentShortcut)) {
      if (miniSearchText.length === 0) {
        e.preventDefault()
        handleMiniSearchBackspace()
      }
    } else if (
      enableBackspaceNavigationShortcut &&
      eventMatchesShortcut(e.nativeEvent, backspaceNavigationShortcut) &&
      miniSearchText.length === 0
    ) {
      e.preventDefault()
      const parent = getParentPath(currentDirectory)
      if (!parent || normalizePath(parent) === normalizePath(currentDirectory)) {
        setStatus('Already at root level', 'info')
        return
      }
      const normalizedParent = normalizePath(parent)
      closeMiniSearch()
      void (async () => {
        try {
          const isValid = await (window.electronAPI as any).validatePath(normalizedParent)
          if (isValid) {
            setCurrentDirectory(normalizedParent)
            addLog(`Navigated to parent: ${normalizedParent}`)
            setStatus('Navigated to parent directory', 'info')
          } else {
            setStatus('Cannot access parent directory', 'error')
          }
        } catch {
          setStatus('Navigation failed', 'error')
        }
      })()
    }
  }

  const miniCommittedSegs = React.useMemo(
    () => (miniAnchorPath ? getRelativePathSegments(miniAnchorPath, miniSearchPath) : []),
    [miniAnchorPath, miniSearchPath]
  )

  /** Jump row “current” is the typing pill when search path has not left the anchor crumb */
  const miniTypingPillIsCurrentSegment = React.useMemo(
    () =>
      !!miniAnchorPath &&
      !!miniSearchPath &&
      pathsEqualForJump(miniSearchPath, miniAnchorPath),
    [miniAnchorPath, miniSearchPath]
  )

  const jumpUiMinWidthPx = React.useMemo(() => {
    const anchorLabel = miniTypingPillIsCurrentSegment ? getDirectoryName(miniSearchPath) : null
    return computeMiniJumpUiMinWidthPx(miniSearchText, miniSearchResults.slice(0, 3), anchorLabel)
  }, [miniSearchText, miniSearchResults, miniTypingPillIsCurrentSegment, miniSearchPath])

  const jumpUiDisplayWidthPx = React.useMemo(() => {
    if (typeof window === 'undefined') return jumpUiMinWidthPx
    const cap = Math.min(Math.floor(window.innerWidth * 0.96), 1200)
    return Math.min(jumpUiMinWidthPx, cap)
  }, [jumpUiMinWidthPx])

  const miniCommittedSegmentsDisplay = React.useMemo(() => {
    if (!miniAnchorPath || miniCommittedSegs.length === 0) return null
    const segments = miniCommittedSegs
    const lastIdx = segments.length - 1
    return (
      <>
        {segments.map((segment, index) => {
          const isCurrentFolder = index === lastIdx
          return (
            <React.Fragment key={`${index}-${segment}`}>
              {isCurrentFolder ? (
                <Box
                  as="span"
                  bg={miniCurrentFolderBg}
                  color={miniCurrentFolderColor}
                  px={2}
                  py="2px"
                  minH="26px"
                  fontSize="sm"
                  fontWeight="medium"
                  borderRadius="lg"
                  display="inline-flex"
                  alignItems="center"
                  mr={1}
                  whiteSpace="nowrap"
                  flexShrink={0}
                >
                  {segment}
                </Box>
              ) : (
                <Text as="span" display="inline-block" fontSize="sm" mr={1} whiteSpace="nowrap" flexShrink={0}>
                  {segment}
                </Text>
              )}
              {index < segments.length - 1 && <Text as="span" mx={0.5} color={miniSeparatorColor} fontSize="xs">&gt;</Text>}
            </React.Fragment>
          )
        })}
      </>
    )
  }, [miniAnchorPath, miniCommittedSegs, miniCurrentFolderBg, miniCurrentFolderColor, miniSeparatorColor])

  /** Keep jump path + typing pill on one row; scroll so the right side (filter) stays visible */
  useLayoutEffect(() => {
    if (activeChevronIndex === null) return
    const el = miniPathFlexRef.current
    const scrollToEnd = () => {
      if (!el) return
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    }
    scrollToEnd()
    window.addEventListener('resize', scrollToEnd)
    return () => window.removeEventListener('resize', scrollToEnd)
  }, [
    activeChevronIndex,
    miniCommittedSegs,
    miniSearchText,
    jumpUiDisplayWidthPx,
    miniTypingPillIsCurrentSegment,
    miniSearchPath,
  ])

  useEffect(() => {
    if (miniSearchText.trim()) setMiniJumpParentNavPreview(false)
  }, [miniSearchText])

  useEffect(() => {
    if (activeChevronIndex !== null && miniSearchInputRef.current) {
      miniSearchInputRef.current.focus()
    }
  }, [activeChevronIndex])

  useEffect(() => {
    if (activeChevronIndex === null) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (!miniSearchContainerRef.current?.contains(target)) {
        const dropdown = document.querySelector('[data-mini-search-dropdown]')
        if (!dropdown?.contains(target)) {
          closeMiniSearch()
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeChevronIndex])

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
      // Ctrl+Shift+N: Start inline new folder row in file grid
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
      <Flex align="center" width="100%" bg={bgColor} borderRadius="sm" h="33px" pl="8px" pr="15px" style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as any}>
        {/* Back/Forward to the left of Home */}
        <Box display="flex" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <IconButton
            aria-label="Back"
            variant="ghost"
            size="sm"
            minW="44px"
            h="33px"
            borderRadius={0}
            color={iconColor}
            _hover={{ bg: folderBarStripHoverBg }}
            onClick={handleBackClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}><ArrowLeft size={18} /></IconButton>
          <IconButton
            aria-label="Forward"
            variant="ghost"
            size="sm"
            minW="44px"
            h="33px"
            borderRadius={0}
            color={iconColor}
            _hover={{ bg: folderBarStripHoverBg }}
            onClick={handleForwardClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}><ArrowRight size={18} /></IconButton>
          <IconButton
            aria-label="Home folder"
            variant="ghost"
            size="sm"
            minW="44px"
            h="33px"
            borderRadius={0}
            color={homeIconColor}
            _hover={{ bg: folderBarStripHoverBg }}
            onClick={handleHomeClick}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}><Home size={18} /></IconButton>
          <Tooltip content={quickAccessPaths.includes(currentDirectory) ? 'Pinned' : 'Pin to Quick Access'}>
            <IconButton
              aria-label="Pin to quick access"
              variant="ghost"
              size="sm"
              minW="44px"
              h="33px"
              borderRadius={0}
              color={useColorModeValue('#f59e0b', 'yellow.300')}
              bg={quickAccessPaths.includes(currentDirectory) ? pinActiveBg : undefined}
              _hover={{
                bg: quickAccessPaths.includes(currentDirectory) ? pinActiveHoverBg : folderBarStripHoverBg,
              }}
              onClick={() => addQuickAccessPath(currentDirectory)}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}>{quickAccessPaths.includes(currentDirectory)
                ? <Star size={18} fill="currentColor" strokeWidth={0} />
                : <Star size={18} />}</IconButton>
          </Tooltip>
        </Box>
        {/* Address bar as breadcrumbs, starting after Home icon */}
        <Flex
          ref={addressBarRef}
          flex={1}
          ml={2}
          mr={1}
          align="center"
          h="33px"
          minH="33px"
          maxH="33px"
          gap={1}
          onClick={handleClick}
          cursor="text"
          borderRadius="md"
          bg={inputBgColor}
          px={2}
          position="relative"
          overflow="hidden"
          minW={0}
          style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as any}
          border="1px solid"
          borderColor={activeChevronIndex !== null ? addressBarJumpBorderColor : inputBorderColor}
          boxShadow={activeChevronIndex !== null ? addressBarJumpGlow : undefined}
          transition="box-shadow 0.2s ease, border-color 0.2s ease"
          {...(activeChevronIndex !== null && { borderBottom: 'none' })}
        >
          {isRefreshing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                overflow: 'hidden',
                pointerEvents: 'none',
                borderRadius: 'var(--chakra-radii-md, 0.375rem)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '50%',
                  background: addressRefreshSweepGradient,
                  willChange: 'transform',
                  animation: 'docuframe-address-refresh-blue-sweep 0.55s linear 1 forwards',
                }}
              />
            </div>
          )}
          <Box
            position="relative"
            zIndex={2}
            flex={isEditing ? 1 : undefined}
            minW={isEditing ? 0 : undefined}
            flexShrink={isEditing ? undefined : 0}
            display="flex"
            alignItems="center"
            gap={1}
            flexWrap="nowrap"
            overflow="hidden"
          >
            {isEditing ? (
              <Input
                ref={inputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                size="sm"
                variant="flushed"
                borderBottomWidth={0}
                bg={inputBgColor}
                color={textColor}
                px={0}
                autoFocus
                flex={1}
                minW={0}
                width="100%"
                height="28px"
                borderRadius="md"
                style={{ fontFamily: 'monospace', fontSize: '14px' }}
              />
            ) : (
              (activeChevronIndex !== null
                ? breadcrumbs.slice(0, activeChevronIndex + 1)
                : breadcrumbs
              ).map((crumb, idx) => (
                <Flex key={crumb.path} align="center" flexShrink={crumb.isClientPill ? 1 : 0}>
                  {crumb.isClientPill ? (
                    <Tooltip content={hasClientLink ? `${getClientName() || crumb.label} — Ctrl+click to open client page` : getClientName() || crumb.label} showArrow openDelay={400} positioning={{
                      placement: "bottom"
                    }}>
                      <Box
                        as="span"
                        px={3}
                        py={0.9}
                        borderRadius="md"
                        bg="blue.600"
                        color="white"
                        fontSize="sm"
                        fontWeight="medium"
                        cursor="pointer"
                        _hover={{ bg: 'blue.500' }}
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
                      cursor={idx === breadcrumbs.length - 1 && activeChevronIndex === null ? 'default' : 'pointer'}
                      bg={idx === breadcrumbs.length - 1 && activeChevronIndex === null ? activeButtonBg : 'transparent'}
                      borderRadius="lg"
                      _hover={idx !== breadcrumbs.length - 1 || activeChevronIndex !== null ? { bg: addressBarItemHoverBg } : undefined}
                      transition="background 0.2s ease"
                      position="relative"
                      zIndex={1}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (idx !== breadcrumbs.length - 1 || activeChevronIndex !== null) {
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
                        fontWeight={idx === breadcrumbs.length - 1 && activeChevronIndex === null ? 'medium' : 'normal'}
                        color={idx === breadcrumbs.length - 1 && activeChevronIndex === null ? activeButtonColor : textColor}
                        userSelect="none"
                      >
                        {crumb.label}
                      </Text>
                    </Flex>
                  )}
                  {(activeChevronIndex !== null || idx < breadcrumbs.length - 1) && (
                    activeChevronIndex === null ? (
                      <Tooltip content="Click to search at this level" showArrow positioning={{
                        placement: "bottom"
                      }}>
                        <Box
                          as="span"
                          display="inline-flex"
                          alignItems="center"
                          mx={1}
                          opacity={0.8}
                          color={textColor}
                          cursor="pointer"
                          borderRadius="md"
                          p={0.5}
                          _hover={{ bg: addressBarItemHoverBg }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openMiniSearch(idx)
                          }}
                        >
                          <ChevronRight size={16} />
                        </Box>
                      </Tooltip>
                    ) : (
                      <Box as="span" mx={1} display="inline-flex" alignItems="center" flexShrink={0} opacity={0.8} color={textColor}>
                        <ChevronRight size={16} />
                      </Box>
                    )
                  )}
                </Flex>
              ))
            )}
          </Box>
          {activeChevronIndex !== null && (
            <Box
              ref={miniSearchContainerRef}
              ml={1}
              flex={1}
              minW={0}
              display="flex"
              alignItems="center"
              alignSelf="stretch"
              position="relative"
              h="100%"
              py={0}
              px={1}
              overflow="hidden"
              borderLeft="1px solid"
              borderLeftColor={miniDividerColor}
            >
              <Flex
                ref={miniPathFlexRef}
                align="center"
                flexWrap="nowrap"
                gap={1}
                flex={1}
                minW={0}
                maxH="28px"
                overflowX="auto"
                overflowY="hidden"
                css={{
                  scrollbarWidth: 'none',
                  '& &::-webkit-scrollbar': { display: 'none' }
                }}
              >
                {miniCommittedSegmentsDisplay}
                {miniCommittedSegs.length > 0 && (
                  <Text as="span" mx={0.5} color={miniSeparatorColor} fontSize="xs">
                    &gt;
                  </Text>
                )}
                <Box
                  ref={miniTypingPillRef}
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  border={miniTypingPillIsCurrentSegment ? 'none' : '1px solid'}
                  borderColor={miniTypingPillIsCurrentSegment ? undefined : miniTypePillBorder}
                  bg={miniTypingPillIsCurrentSegment ? activeButtonBg : miniTypePillBg}
                  borderRadius={miniTypingPillIsCurrentSegment ? 'lg' : 'md'}
                  px={2}
                  py="2px"
                  minH="26px"
                  w={`${jumpUiDisplayWidthPx}px`}
                  minW={`${jumpUiDisplayWidthPx}px`}
                  flexShrink={0}
                  boxShadow={miniJumpParentNavPreview ? miniJumpPreviewRing : undefined}
                >
                  <Input
                    ref={miniSearchInputRef}
                    value={miniSearchText}
                    onChange={(e) => setMiniSearchText(e.target.value)}
                    onKeyDown={handleMiniSearchKeyDown}
                    variant="flushed"
                    borderBottomWidth={0}
                    fontSize="sm"
                    fontWeight="medium"
                    fontFamily="inherit"
                    color={miniTypingPillIsCurrentSegment ? activeButtonColor : miniTypePillFg}
                    placeholder={miniTypingPillIsCurrentSegment ? getDirectoryName(miniSearchPath) : '…'}
                    _placeholder={{
                      color: miniTypingPillIsCurrentSegment ? activeButtonColor : miniTypePillPlaceholder,
                      opacity: miniTypingPillIsCurrentSegment ? 0.72 : 0.85,
                    }}
                    flex={1}
                    minW={0}
                    w="100%"
                    h="auto"
                    minH="22px"
                    lineHeight="1.4"
                    py={0}
                    px={0}
                    m={0}
                    cursor="text"
                    autoFocus
                    border="none"
                    outline="none"
                    boxShadow="none"
                    whiteSpace="nowrap"
                    css={{
                      overflow: 'hidden',
                      minWidth: 0
                    }}
                    _focusVisible={{ boxShadow: 'none', outline: 'none' }}
                  />
                </Box>
              </Flex>
              <MiniSearchDropdown
                pillRef={miniTypingPillRef}
                contentMinWidthPx={jumpUiDisplayWidthPx}
                layoutSyncKey={`${activeChevronIndex ?? ''}-${normalizePath(miniSearchPath)}-${miniCommittedSegs.join('|')}-${miniSearchResults.length}-${miniSearchText}-${jumpUiDisplayWidthPx}`}
                results={miniSearchResults.slice(0, 3)}
                selectedIndex={Math.min(miniSelectedIndex, 2)}
                dropdownBg={dropdownBg}
                dropdownHighlightBg={dropdownHighlightBg}
                dropdownHoverBg={dropdownHoverBg}
                folderIconColor={folderIconColor}
                fileIconColor={fileIconColor}
                dropdownBorderColor={miniDropdownBorderColor}
                onSelect={(item) => {
                  if (item.type === 'folder') {
                    setCurrentDirectory(item.path)
                    addLog(`Navigated to: ${item.path}`)
                    setStatus(`Navigated to ${item.name}`, 'info')
                  } else {
                    handleOpenFile(item)
                  }
                  closeMiniSearch()
                }}
              />
            </Box>
          )}
          {!isEditing && breadcrumbs.length > 0 && activeChevronIndex === null && (
            <Tooltip content="Search files and folders in this folder" showArrow openDelay={400} positioning={{
              placement: "bottom"
            }}>
              <IconButton
                aria-label="Search in current folder"
                variant="ghost"
                size="sm"
                flexShrink={0}
                minW="32px"
                h="28px"
                borderRadius="md"
                color={iconColor}
                zIndex={2}
                _hover={{ bg: addressBarItemHoverBg, color: textColor }}
                onClick={(e) => {
                  e.stopPropagation()
                  openMiniSearch(breadcrumbs.length - 1)
                }}
                tabIndex={-1}
                onMouseDown={(ev) => ev.preventDefault()}><ChevronRight size={18} /></IconButton>
            </Tooltip>
          )}
        </Flex>
        {/* Year navigation - when inside annual accounts\XX\202X folders */}
        {yearNav && (
          <HStack ml={1} mr={1} gap={0} style={{ WebkitAppRegion: 'no-drag' } as any}>
            <IconButton
              aria-label="Previous year"
              variant="ghost"
              size="sm"
              minW="28px"
              h="28px"
              borderRadius="md"
              color={yearNav.hasPrevYear ? iconColor : yearNavDisabledColor}
              cursor={yearNav.hasPrevYear ? 'pointer' : 'default'}
              opacity={yearNav.hasPrevYear ? 1 : 0.5}
              _hover={yearNav.hasPrevYear ? { bg: folderBarStripHoverBg } : undefined}
              onClick={() => yearNav.hasPrevYear && yearNav.prevYearPath && setCurrentDirectory(yearNav.prevYearPath)}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}><ChevronLeft size={18} /></IconButton>
            <Text fontSize="sm" fontWeight="medium" color={textColor} px={1} userSelect="none">
              {yearNav.currentYear}
            </Text>
            <IconButton
              aria-label="Next year"
              variant="ghost"
              size="sm"
              minW="28px"
              h="28px"
              borderRadius="md"
              color={yearNav.hasNextYear ? iconColor : yearNavDisabledColor}
              cursor={yearNav.hasNextYear ? 'pointer' : 'default'}
              opacity={yearNav.hasNextYear ? 1 : 0.5}
              _hover={yearNav.hasNextYear ? { bg: folderBarStripHoverBg } : undefined}
              onClick={() => yearNav.hasNextYear && yearNav.nextYearPath && setCurrentDirectory(yearNav.nextYearPath)}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}><ChevronRight size={18} /></IconButton>
          </HStack>
        )}
        {/* Refresh - between address bar and search */}
        <Box ml={1} mr={1} style={{ WebkitAppRegion: 'no-drag' } as any}>
          <IconButton
            aria-label="Refresh folder"
            variant="ghost"
            size="sm"
            borderRadius={0}
            onClick={handleRefresh}
            color={iconColor}
            _hover={{ bg: folderBarStripHoverBg }}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}><RefreshCw size={18} /></IconButton>
        </Box>
        {/* Open CMD at current directory - between refresh and open in explorer */}
        <Tooltip content="Open CMD at current directory" showArrow positioning={{
          placement: "bottom"
        }}>
          <Box mr={1} style={{ WebkitAppRegion: 'no-drag' } as any}>
            <IconButton
              aria-label="Open CMD at current directory"
              variant="ghost"
              size="sm"
              borderRadius={0}
              onClick={handleOpenCmdClick}
              color={iconColor}
              _hover={{ bg: folderBarStripHoverBg }}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}><SquareTerminal size={18} /></IconButton>
          </Box>
        </Tooltip>
        {/* Open in file explorer - right of CMD */}
        <Tooltip content="Open in file explorer" showArrow positioning={{
          placement: "bottom"
        }}>
          <Box mr={2} style={{ WebkitAppRegion: 'no-drag' } as any}>
            <IconButton
              aria-label="Open in explorer"
              variant="ghost"
              size="sm"
              borderRadius={0}
              onClick={handleOpenExplorer}
              color={iconColor}
              _hover={{ bg: folderBarStripHoverBg }}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}><ExternalLink size={18} /></IconButton>
          </Box>
        </Tooltip>
        {/* Search Input Field - Same style as address bar, no border */}
        <Box ref={searchInputContainerRef} maxW="300px" ml="auto" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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
        </Box>
      </Flex>
      <Dialog.Root open={isCreateSpreadsheetOpen} placement='center' onOpenChange={e => {
        if (!e.open) {
          setIsCreateSpreadsheetOpen(false);
        }
      }}>
        <Portal>

          <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>Create New Spreadsheet</Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>File Name</Field.Label>
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
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer>
                <Button 
                  colorPalette="blue" 
                  mr={3} 
                  onClick={handleCreateBlankSpreadsheet}
                  disabled={!newSpreadsheetName.trim()}
                >
                  Create
                </Button>
                <Button variant="ghost" onClick={() => setIsCreateSpreadsheetOpen(false)}>
                  Cancel
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>

        </Portal>
      </Dialog.Root>
    </>
  );
}