import React, { useMemo, useCallback, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Box, Flex, Text, Portal } from '@chakra-ui/react';
import { ChevronUp, ChevronDown, Filter, Check } from 'lucide-react'
import type { SortColumn } from './FileGridUtils'
import { useFileGridFiltersAndVisibility, useFileGridDirectoryState } from '../../context/AppContext'
import { getExtension, DATE_FILTER_LABELS, type DateFilterPreset } from '../../utils/fileFilters'
import { useMenuColors } from './menuPrimitives'

/**
 * Funnel dropdown in the Type/Modified column headers. Reads filter state from
 * context directly so the memoized header row props stay unchanged.
 */
const HeaderFilterButton: React.FC<{ column: 'type' | 'modified' }> = ({ column }) => {
  const { typeFilter, setTypeFilter, dateFilter, setDateFilter } = useFileGridFiltersAndVisibility()
  const { folderItems } = useFileGridDirectoryState()
  const { bg, border, hoverBg, subtext, shadow } = useMenuColors()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = column === 'type' ? typeFilter.length > 0 : dateFilter !== null

  const extensions = useMemo(() => {
    if (column !== 'type') return []
    const counts = new Map<string, number>()
    for (const f of folderItems) {
      if (f.type === 'folder') continue
      const ext = getExtension(f.name)
      if (!ext) continue
      counts.set(ext, (counts.get(ext) || 0) + 1)
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [column, folderItems])

  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  useLayoutEffect(() => {
    const el = menuRef.current
    const btn = buttonRef.current
    if (!isOpen || !el || !btn) return
    const rect = btn.getBoundingClientRect()
    const menuRect = el.getBoundingClientRect()
    let x = rect.left
    if (x + menuRect.width > window.innerWidth - 4) x = window.innerWidth - menuRect.width - 4
    let y = rect.bottom + 2
    if (y + menuRect.height > window.innerHeight - 4) y = rect.top - menuRect.height - 2
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.opacity = '1'
  })

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    if ('preventDefault' in e && (e as React.MouseEvent).type === 'mousedown') e.preventDefault()
  }

  return (
    <>
      <Box
        ref={buttonRef}
        display="inline-flex"
        ml={1}
        p="2px"
        borderRadius="2px"
        lineHeight={0}
        color={isActive ? '#4F46E5' : subtext}
        opacity={isActive ? 1 : undefined}
        _hover={{ color: '#4F46E5' }}
        css={isActive ? undefined : { opacity: 0, '[role=group]:hover &': { opacity: 1 } }}
        onClick={(e: React.MouseEvent) => {
          stop(e)
          setIsOpen((v) => !v)
        }}
        onMouseDown={stop}
        onDoubleClick={stop}
        title={column === 'type' ? 'Filter by type' : 'Filter by date'}
      >
        <Filter size={11} strokeWidth={2.5} fill={isActive ? 'currentColor' : 'none'} />
      </Box>
      {isOpen && (
        <Portal>
          <Box
            ref={menuRef}
            position="fixed"
            top={0}
            left={0}
            opacity={0}
            bg={bg}
            border="1px solid"
            borderColor={border}
            borderRadius="8px"
            boxShadow={shadow}
            zIndex={10000}
            minW="160px"
            maxW="240px"
            maxH="320px"
            overflowY="auto"
            py={0.5}
            onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {column === 'type' ? (
              <>
                {extensions.length === 0 && (
                  <Flex px={2.5} py="3px">
                    <Text fontSize="xs" color={subtext}>No files</Text>
                  </Flex>
                )}
                {extensions.map(([ext, count]) => {
                  const checked = typeFilter.includes(ext)
                  return (
                    <Flex
                      key={ext}
                      align="center"
                      px={2.5}
                      py="3px"
                      cursor="pointer"
                      _hover={{ bg: hoverBg }}
                      onClick={() => {
                        setTypeFilter((prev) =>
                          prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]
                        )
                      }}
                    >
                      <Box w="18px" display="inline-flex">
                        {checked && <Check size={13} />}
                      </Box>
                      <Text fontSize="xs">{ext.toUpperCase()}</Text>
                      <Text fontSize="10px" color={subtext} ml="auto" pl={3}>{count}</Text>
                    </Flex>
                  )
                })}
                {typeFilter.length > 0 && (
                  <Flex
                    align="center"
                    px={2.5}
                    py="3px"
                    cursor="pointer"
                    borderTop="1px solid"
                    borderColor={border}
                    mt={0.5}
                    _hover={{ bg: hoverBg }}
                    onClick={() => {
                      setTypeFilter([])
                      setIsOpen(false)
                    }}
                  >
                    <Box w="18px" />
                    <Text fontSize="xs">Clear filter</Text>
                  </Flex>
                )}
              </>
            ) : (
              <>
                {(Object.keys(DATE_FILTER_LABELS) as DateFilterPreset[]).map((preset) => (
                  <Flex
                    key={preset}
                    align="center"
                    px={2.5}
                    py="3px"
                    cursor="pointer"
                    _hover={{ bg: hoverBg }}
                    onClick={() => {
                      setDateFilter((prev) => (prev === preset ? null : preset))
                      setIsOpen(false)
                    }}
                  >
                    <Box w="18px" display="inline-flex">
                      {dateFilter === preset && <Check size={13} />}
                    </Box>
                    <Text fontSize="xs">{DATE_FILTER_LABELS[preset]}</Text>
                  </Flex>
                ))}
                {dateFilter !== null && (
                  <Flex
                    align="center"
                    px={2.5}
                    py="3px"
                    cursor="pointer"
                    borderTop="1px solid"
                    borderColor={border}
                    mt={0.5}
                    _hover={{ bg: hoverBg }}
                    onClick={() => {
                      setDateFilter(null)
                      setIsOpen(false)
                    }}
                  >
                    <Box w="18px" />
                    <Text fontSize="xs">Clear filter</Text>
                  </Flex>
                )}
              </>
            )}
          </Box>
        </Portal>
      )}
    </>
  )
}

export type FileListTheadProps = {
  columnOrder: string[]
  columnVisibility: { name: boolean; size: boolean; modified: boolean; type: boolean }
  sortColumn: SortColumn
  sortDirection: 'asc' | 'desc'
  tableHeadTextColor: string
  headerHoverBg: string
  headerStickyBg: string
  headerDividerBg: string
  dragGhostAccent: string
  draggingColumn: string | null
  dragTargetColumn: string | null
  hasDraggedColumn: boolean
  /** While true, thead ignores pointer events so file drops reach layer (group) rows under sticky headers. */
  suppressPointerEventsForFileDrag?: boolean
  setHeaderContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number } }) => void
  handleSort: (column: SortColumn) => void
  autoFitColumn: (column: string) => void
  handleColumnDragStart: (column: string, e: React.MouseEvent) => void
  handleResizeStart: (column: string, e: React.MouseEvent) => void
}

/** Memoized list header: stable Chakra pseudo-props and handlers so hover on rows does not re-serialize header styles. */
export const FileListTheadRow = React.memo(function FileListTheadRow({
  columnOrder,
  columnVisibility,
  sortColumn,
  sortDirection,
  tableHeadTextColor,
  headerHoverBg,
  headerStickyBg,
  headerDividerBg,
  dragGhostAccent,
  draggingColumn,
  dragTargetColumn,
  hasDraggedColumn,
  suppressPointerEventsForFileDrag = false,
  setHeaderContextMenu,
  handleSort,
  autoFitColumn,
  handleColumnDragStart,
  handleResizeStart,
}: FileListTheadProps) {
  const thHoverSx = useMemo(() => ({ bg: headerHoverBg }), [headerHoverBg])
  const thAfterSx = useMemo(
    () =>
      (({
        content: '""',
        position: 'absolute' as const,
        right: 0,
        top: '25%',
        bottom: '25%',
        width: '1px',
        bg: headerDividerBg
      }) as const),
    [headerDividerBg],
  )
  const resizeHoverSx = useMemo(() => ({ bg: dragGhostAccent }), [dragGhostAccent])
  const resizeHandleAfterSx = useMemo(
    () =>
      (({
        content: '""',
        position: 'absolute' as const,
        right: '2px',
        top: '25%',
        bottom: '25%',
        width: '1px',
        bg: 'transparent',
        _hover: { bg: 'white' }
      }) as const),
    [],
  )

  const onHeaderContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHeaderContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } })
    },
    [setHeaderContextMenu],
  )

  const onHeaderClick = useCallback(
    (column: SortColumn) => (e: React.MouseEvent) => {
      if (hasDraggedColumn) return
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const isInResizeArea = clickX > rect.width - 4
      if (!isInResizeArea) handleSort(column)
    },
    [hasDraggedColumn, handleSort],
  )

  const onHeaderDoubleClick = useCallback(
    (column: string) => (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const isInResizeArea = clickX > rect.width - 4
      if (!isInResizeArea) autoFitColumn(column)
    },
    [autoFitColumn],
  )

  const onResizeDoubleClick = useCallback(
    (column: string) => () => {
      autoFitColumn(column)
    },
    [autoFitColumn],
  )

  return (
    <Box as="thead" pointerEvents={suppressPointerEventsForFileDrag ? 'none' : undefined}>
      <Box as="tr">
        {columnOrder.map((column) => {
          const isName = column === 'name'
          const isSize = column === 'size'
          const isModified = column === 'modified'
          const isType = column === 'type'

          if (!columnVisibility[column as keyof typeof columnVisibility]) {
            return null
          }

          return (
            <Box
              as="th"
              key={column}
              px={2}
              py={2}
              fontWeight="medium"
              fontSize="xs"
              color={tableHeadTextColor}
              cursor="pointer"
              _hover={thHoverSx}
              role="group"
              verticalAlign="middle"
              onContextMenu={onHeaderContextMenu}
              onClick={onHeaderClick(column as SortColumn)}
              onDoubleClick={onHeaderDoubleClick(column)}
              position="sticky"
              top={0}
              zIndex={100}
              bg={headerStickyBg}
              _after={thAfterSx}
              data-column={column}
              onMouseDown={(e: React.MouseEvent) => handleColumnDragStart(column, e)}
              opacity={draggingColumn === column ? 0.5 : 1}
              borderLeft={draggingColumn && dragTargetColumn === column ? '2px solid #4F46E5' : undefined}
              transition="all 0.2s ease"
            >
              <Flex alignItems="center">
                {isName ? 'Name' : isSize ? 'Size' : isModified ? 'Modified' : isType ? 'Type' : ''}
                {sortColumn === column && (
                  <Box as="span" display="inline-flex" ml={1} lineHeight={0} color="#4F46E5">
                    {sortDirection === 'asc' ? (
                      <ChevronUp size={10} strokeWidth={2.5} />
                    ) : (
                      <ChevronDown size={10} strokeWidth={2.5} />
                    )}
                  </Box>
                )}
                {(isType || isModified) && (
                  <HeaderFilterButton column={isType ? 'type' : 'modified'} />
                )}
              </Flex>

              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                width="4px"
                cursor="grab"
                _hover={resizeHoverSx}
                _active={{ cursor: 'grabbing' }}
              />
              <Box
                position="absolute"
                right={0}
                top={0}
                bottom={0}
                width="4px"
                cursor="col-resize"
                _hover={resizeHoverSx}
                onMouseDown={(e: React.MouseEvent) => handleResizeStart(column, e)}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                onDoubleClick={onResizeDoubleClick(column)}
                zIndex={10}
                _after={resizeHandleAfterSx}
                title="Double-click to auto-fit column width"
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
})
