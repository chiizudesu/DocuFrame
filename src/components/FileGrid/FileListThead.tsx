import React, { useMemo, useCallback } from 'react'
import { Box, Flex } from '@chakra-ui/react';
import { ChevronUp, ChevronDown } from 'lucide-react'
import type { SortColumn } from './FileGridUtils'

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
    <Box as="thead">
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
