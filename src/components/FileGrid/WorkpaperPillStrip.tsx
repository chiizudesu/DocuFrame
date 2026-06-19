import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useColorModeValue } from '../ui/color-mode'
import { Flex } from '@chakra-ui/react'
import { Tooltip } from '@/components/ui/tooltip'
import { getIndexInfo } from '../../utils/indexPrefix'
import { setDropEffectCompatibleWithEffectAllowed } from './FileGridUtils'

// ── Global keyframe animations ────────────────────────────────────────────────
// CSS transitions are suppressed by Chromium during native OS drag operations.
// @keyframes animations run on the compositor thread and are NOT suppressed.

let styleInjected = false
function injectPillAnimations() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes wp-pill-expand {
      from { padding-left: 6px; padding-right: 6px; }
      to   { padding-left: 10px; padding-right: 10px; }
    }
    @keyframes wp-pill-collapse {
      from { padding-left: 10px; padding-right: 10px; }
      to   { padding-left: 6px; padding-right: 6px; }
    }
    @keyframes wp-pill-text-reveal {
      from { max-width: 0px; opacity: 0; }
      to   { max-width: 60px; opacity: 1; }
    }
    @keyframes wp-pill-text-hide {
      from { max-width: 60px; opacity: 1; }
      to   { max-width: 0px; opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

export interface WorkpaperPillStripProps {
  groupKeys: string[]
  visibleGroupKeys: Set<string> | null
  onPillClick: (groupKey: string) => void
  onPillDrop: (e: React.DragEvent, groupKey: string, copyModifierActive?: boolean) => Promise<void>
  clearFolderHoverStates: () => void
}

// ── Individual pill with its own drag state ───────────────────────────────────

interface WorkpaperPillProps {
  groupKey: string
  isVisible: boolean
  onDrop: (e: React.DragEvent, groupKey: string, copyModifierActive?: boolean) => Promise<void>
  onClick: () => void
  clearFolderHoverStates: () => void
}

const ANIM = '0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'

const WorkpaperPill: React.FC<WorkpaperPillProps> = ({
  groupKey,
  isVisible,
  onDrop,
  onClick,
  clearFolderHoverStates,
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isCopyMode, setIsCopyMode] = useState(false)
  const copyModRef = useRef(false)
  const hasBeenDraggedRef = useRef(false)

  useEffect(() => { injectPillAnimations() }, [])

  const indexInfo = getIndexInfo(groupKey)
  const label = groupKey === 'Other' ? 'Other' : groupKey
  const tooltipBase = groupKey === 'Other'
    ? 'Other — non-indexed files'
    : indexInfo.description
      ? `${groupKey} — ${indexInfo.description}`
      : groupKey

  // Colors
  const visibleBg = useColorModeValue('#2b6cb0', 'rgba(114,205,244,0.22)')
  const visibleColor = useColorModeValue('#ffffff', '#72cdf4')
  const inactiveBg = useColorModeValue('rgba(43,108,176,0.06)', 'rgba(114,205,244,0.06)')
  const inactiveColor = useColorModeValue('#64748b', '#718096')
  const dragOverBg = useColorModeValue('rgba(59,130,246,0.10)', 'rgba(114,205,244,0.12)')
  const dragOverBorder = useColorModeValue('#60a5fa', '#72cdf4')
  const dragOverTextColor = useColorModeValue('#3b82f6', '#72cdf4')

  const isDragAccepted = (e: React.DragEvent) => {
    const types = e.dataTransfer.types
    return (
      types.includes('application/x-docuframe-files') ||
      types.includes('Files') ||
      !!(window as any).__docuframeInternalDrag
    )
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isDragAccepted(e)) {
      setDropEffectCompatibleWithEffectAllowed(e, e.ctrlKey ? 'copy' : 'move')
      copyModRef.current = e.ctrlKey
      hasBeenDraggedRef.current = true
      setIsDragOver(true)
      setIsCopyMode(e.ctrlKey)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isDragAccepted(e)) {
      setDropEffectCompatibleWithEffectAllowed(e, e.ctrlKey ? 'copy' : 'move')
      copyModRef.current = e.ctrlKey
      setIsCopyMode(e.ctrlKey)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only reset when cursor truly leaves the button (not moving between children)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
      setIsCopyMode(false)
      copyModRef.current = false
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const copyModifierActive = e.ctrlKey || copyModRef.current
    void onDrop(e, groupKey, copyModifierActive)
    setIsDragOver(false)
    setIsCopyMode(false)
    copyModRef.current = false
    clearFolderHoverStates()
  }, [onDrop, groupKey, clearFolderHoverStates])

  const pillAnim = isDragOver
    ? `wp-pill-expand ${ANIM}`
    : hasBeenDraggedRef.current
      ? `wp-pill-collapse ${ANIM}`
      : undefined

  const textAnim = isDragOver
    ? `wp-pill-text-reveal ${ANIM}`
    : hasBeenDraggedRef.current
      ? `wp-pill-text-hide ${ANIM}`
      : undefined

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    minWidth: '24px',
    paddingLeft: '6px',
    paddingRight: '6px',
    paddingTop: '2px',
    paddingBottom: '2px',
    borderRadius: '3px',
    borderWidth: '1.5px',
    borderStyle: isDragOver ? 'dashed' : 'solid',
    borderColor: isDragOver ? dragOverBorder : 'transparent',
    background: isDragOver ? dragOverBg : isVisible ? visibleBg : inactiveBg,
    color: isDragOver ? dragOverTextColor : isVisible ? visibleColor : inactiveColor,
    fontSize: '11px',
    cursor: isDragOver ? 'copy' : 'pointer',
    userSelect: 'none',
    flexShrink: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    outline: 'none',
    animation: pillAnim,
  }

  const expandStyle: React.CSSProperties = {
    display: 'inline-flex',
    overflow: 'hidden',
    maxWidth: '0px',
    opacity: 0,
    animation: textAnim,
  }

  return (
    <Tooltip content={tooltipBase} openDelay={400} positioning={{ placement: 'bottom' }} disabled={isDragOver}>
      <button
        style={pillStyle}
        onClick={onClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span
          style={{
            fontSize: '11px',
            lineHeight: 1,
            flexShrink: 0,
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <span style={expandStyle}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              lineHeight: 1,
              flexShrink: 0,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {isCopyMode ? 'copy' : 'assign'}
          </span>
        </span>
      </button>
    </Tooltip>
  )
}

// ── Strip container ───────────────────────────────────────────────────────────

export const WorkpaperPillStrip: React.FC<WorkpaperPillStripProps> = ({
  groupKeys,
  visibleGroupKeys,
  onPillClick,
  onPillDrop,
  clearFolderHoverStates,
}) => {
  if (groupKeys.length === 0) return null

  return (
    <Flex
      align="center"
      gap="4px"
      px="10px"
      py="3px"
      flexShrink={0}
      overflowX="auto"
      overflowY="hidden"
      css={{
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
      }}
    >
      {groupKeys.map((key) => (
        <WorkpaperPill
          key={key}
          groupKey={key}
          isVisible={visibleGroupKeys?.has(key) ?? false}
          onDrop={onPillDrop}
          onClick={() => onPillClick(key)}
          clearFolderHoverStates={clearFolderHoverStates}
        />
      ))}
    </Flex>
  )
}
