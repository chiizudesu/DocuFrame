import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createContext, useContextSelector } from 'use-context-selector'

/** Hovered data row index for list view; null when none. Fine-grained: only rows where `index === hovered` subscribe. */
export const listRowHoveredIndexContext = createContext<number | null>(null)

export function useListRowIsHovered(index: number): boolean {
  return useContextSelector(listRowHoveredIndexContext, (h) => h === index)
}

type BaseRowHandlers = {
  onMouseEnter: (index: number) => void
  onMouseLeave: (index: number, e: React.MouseEvent) => void
  onContextMenu: (file: import('../../types').FileItem, e: React.MouseEvent) => void
  onClick: (file: import('../../types').FileItem, index: number, e?: React.MouseEvent) => void
  onMouseDown: (file: import('../../types').FileItem, index: number, e: React.MouseEvent) => void
  onMouseUp: (file: import('../../types').FileItem, index: number, e: React.MouseEvent) => void
  draggable: boolean
  onDragStart: (file: import('../../types').FileItem, index: number, e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

/** Keeps hover state here so parent FileListViewBody (memo) does not re-render on every hover tick. */
export const ListRowHoverProvider: React.FC<{
  baseRowHandlers: BaseRowHandlers
  children: (mergedRowHandlers: BaseRowHandlers) => React.ReactNode
}> = ({ baseRowHandlers, children }) => {
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null)
  const hoveredRowIndexRef = useRef<number | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoverTimeRef = useRef<number>(0)
  const HOVER_THROTTLE_MS = 16

  useEffect(() => {
    hoveredRowIndexRef.current = hoveredRowIndex
  }, [hoveredRowIndex])

  const handleRowMouseEnter = useCallback((index: number) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    const now = Date.now()
    if (now - lastHoverTimeRef.current >= HOVER_THROTTLE_MS) {
      if (hoveredRowIndexRef.current !== index) {
        setHoveredRowIndex(index)
      }
      lastHoverTimeRef.current = now
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        if (hoveredRowIndexRef.current !== index) {
          setHoveredRowIndex(index)
        }
        lastHoverTimeRef.current = Date.now()
      }, HOVER_THROTTLE_MS - (now - lastHoverTimeRef.current))
    }
  }, [])

  const handleRowMouseLeave = useCallback((index: number, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      const related = e.relatedTarget
      if (related && typeof (related as Element).closest === 'function' && (related as Element).closest(`[data-row-index="${index}"]`)) return
      setHoveredRowIndex((prev) => (prev === index ? null : prev))
      lastHoverTimeRef.current = Date.now()
    }, 50)
  }, [])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  const mergedRowHandlers = useMemo(
    () => ({
      ...baseRowHandlers,
      onMouseEnter: handleRowMouseEnter,
      onMouseLeave: handleRowMouseLeave,
    }),
    [baseRowHandlers, handleRowMouseEnter, handleRowMouseLeave],
  )

  return (
    <listRowHoveredIndexContext.Provider value={hoveredRowIndex}>
      {children(mergedRowHandlers)}
    </listRowHoveredIndexContext.Provider>
  )
}
