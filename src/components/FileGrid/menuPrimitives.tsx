import React, { useLayoutEffect, useRef, useState } from 'react'
import { createContext, useContext } from 'react'
import { Box, Flex, Text, Separator } from '@chakra-ui/react'
import { ChevronRight } from 'lucide-react'
import { useColorModeValue } from '../ui/color-mode'
import { docuFramePalette } from '../../docuFrameColors'

/** Shared palette for all custom context menus (main, blank, header, submenus). */
export function useMenuColors() {
  const bg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip)
  const border = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border)
  const hoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover)
  const separator = useColorModeValue(docuFramePalette.light.tableBorder, docuFramePalette.dark.tableBorder)
  const subtext = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext)
  const dangerColor = useColorModeValue('#dc2626', '#fca5a5')
  const dangerHoverBg = useColorModeValue('#fee2e2', '#5b1a1a')
  const shadow = useColorModeValue('0 10px 32px rgba(15, 23, 42, 0.18)', '0 10px 32px rgba(0, 0, 0, 0.45)')
  return { bg, border, hoverBg, separator, subtext, dangerColor, dangerHoverBg, shadow }
}

/** Shared chrome for menu surfaces — rounded, soft shadow, matches the widget mockup. */
export const MENU_SURFACE_PROPS = {
  borderRadius: '8px',
  border: '1px solid',
  overflow: 'hidden',
} as const

/**
 * Position a fixed-position menu at an anchor point, sliding (not mirror-flipping)
 * to fit the viewport: prefer below/right of the anchor; flip above only when the
 * whole menu fits there; otherwise slide up/left just enough. Never goes negative,
 * so menus can't spill past the top of the window.
 */
export function placeMenuElement(el: HTMLElement, anchor: { x: number; y: number }): void {
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 6

  let x = anchor.x
  if (x + rect.width > vw - margin) {
    const flippedX = anchor.x - rect.width
    x = flippedX >= margin ? flippedX : Math.max(margin, vw - rect.width - margin)
  }

  let y = anchor.y
  if (y + rect.height > vh - margin) {
    const flippedY = anchor.y - rect.height
    y = flippedY >= margin ? flippedY : Math.max(margin, vh - rect.height - margin)
  }

  el.style.left = `${Math.max(margin, x)}px`
  el.style.top = `${Math.max(margin, y)}px`
  el.style.opacity = '1'
}

interface SubmenuGroupState {
  openId: string | null
  setOpenId: (id: string | null) => void
}

const SubmenuGroupContext = createContext<SubmenuGroupState | null>(null)

/**
 * Wrap a menu's content so its ContextSubmenu children coordinate: hovering one
 * trigger closes any sibling flyout, and hovering a plain MenuRow closes them all.
 */
export const SubmenuGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openId, setOpenId] = useState<string | null>(null)
  return (
    <SubmenuGroupContext.Provider value={{ openId, setOpenId }}>
      {children}
    </SubmenuGroupContext.Provider>
  )
}

export interface MenuRowProps {
  icon?: React.ReactNode
  label: string
  /** Right-aligned keyboard hint, e.g. "F2" or "Ctrl+C" */
  hint?: string
  danger?: boolean
  /** Bold primary action (the type-aware default at the top of the menu) */
  emphasized?: boolean
  disabled?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  title?: string
}

export const MenuRow: React.FC<MenuRowProps> = ({
  icon,
  label,
  hint,
  danger,
  emphasized,
  disabled,
  onClick,
  onMouseEnter,
  title,
}) => {
  const { hoverBg, subtext, dangerColor, dangerHoverBg } = useMenuColors()
  const group = useContext(SubmenuGroupContext)
  return (
    <Flex
      align="center"
      mx="4px"
      px={2}
      py="3.5px"
      borderRadius="5px"
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.5 : 1}
      pointerEvents={disabled ? 'none' : 'auto'}
      color={danger ? dangerColor : undefined}
      _hover={{ bg: danger ? dangerHoverBg : hoverBg }}
      onClick={onClick}
      onMouseEnter={() => {
        group?.setOpenId(null)
        onMouseEnter?.()
      }}
      title={title}
    >
      {icon && (
        <Box as="span" mr="6px" flexShrink={0} display="inline-flex" alignItems="center">
          {icon}
        </Box>
      )}
      <Text fontSize="xs" fontWeight={emphasized ? 'semibold' : 'normal'} whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
        {label}
      </Text>
      {hint && (
        <Text fontSize="10px" color={subtext} ml="auto" pl={4} flexShrink={0}>
          {hint}
        </Text>
      )}
    </Flex>
  )
}

export const MenuSeparator: React.FC = () => {
  const { separator } = useMenuColors()
  return <Separator borderColor={separator} my="4px" mx="8px" />
}

/** Small-caps section caption, e.g. WORKPAPERS / SEND — matches the widget mockup. */
export const MenuSectionLabel: React.FC<{ label: string }> = ({ label }) => {
  const { subtext } = useMenuColors()
  return (
    <Text
      fontSize="9px"
      fontWeight="semibold"
      letterSpacing="0.1em"
      textTransform="uppercase"
      color={subtext}
      px="12px"
      pt="7px"
      pb="3px"
      userSelect="none"
    >
      {label}
    </Text>
  )
}

export interface ContextSubmenuProps {
  /** Unique id within the surrounding SubmenuGroup */
  id: string
  icon?: React.ReactNode
  label: string
  disabled?: boolean
  flyoutMinW?: string
  flyoutMaxH?: string
  children: React.ReactNode
}

/**
 * Hover-opening submenu for the custom fixed-position context menus.
 * Must be rendered inside a SubmenuGroup. The flyout edge-flips horizontally
 * and clamps vertically, mirroring the positioning of the parent menus.
 */
export const ContextSubmenu: React.FC<ContextSubmenuProps> = ({
  id,
  icon,
  label,
  disabled,
  flyoutMinW = '170px',
  flyoutMaxH,
  children,
}) => {
  const { bg, border, hoverBg, shadow } = useMenuColors()
  const group = useContext(SubmenuGroupContext)
  const triggerRef = useRef<HTMLDivElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const isOpen = group?.openId === id

  useLayoutEffect(() => {
    const el = flyoutRef.current
    const trigger = triggerRef.current
    if (!isOpen || !el || !trigger) return
    const triggerRect = trigger.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 6
    let x = triggerRect.right + 2
    if (x + rect.width > vw - margin) {
      const flippedX = triggerRect.left - rect.width - 2
      x = flippedX >= margin ? flippedX : Math.max(margin, vw - rect.width - margin)
    }
    let y = triggerRect.top - 5
    if (y + rect.height > vh - margin) y = Math.max(margin, vh - rect.height - margin)
    el.style.left = `${Math.max(margin, x)}px`
    el.style.top = `${Math.max(margin, y)}px`
    el.style.opacity = '1'
  })

  return (
    <>
      <Flex
        ref={triggerRef}
        align="center"
        mx="4px"
        px={2}
        py="3.5px"
        borderRadius="5px"
        cursor={disabled ? 'default' : 'pointer'}
        opacity={disabled ? 0.5 : 1}
        pointerEvents={disabled ? 'none' : 'auto'}
        bg={isOpen ? hoverBg : undefined}
        _hover={{ bg: hoverBg }}
        onMouseEnter={() => group?.setOpenId(id)}
      >
        {icon && (
          <Box as="span" mr="6px" flexShrink={0} display="inline-flex" alignItems="center">
            {icon}
          </Box>
        )}
        <Text fontSize="xs" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
          {label}
        </Text>
        <ChevronRight size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </Flex>
      {isOpen && (
        <Box
          ref={flyoutRef}
          position="fixed"
          top={0}
          left={0}
          opacity={0}
          bg={bg}
          borderRadius="8px"
          boxShadow={shadow}
          zIndex="modal"
          minW={flyoutMinW}
          maxW="280px"
          maxH={flyoutMaxH ?? 'calc(100vh - 12px)'}
          overflowY="auto"
          overflowX="hidden"
          className="enhanced-scrollbar"
          border="1px solid"
          borderColor={border}
        >
          {/* Fresh group so rows inside the flyout don't close their own flyout */}
          <SubmenuGroup>
            <Box py="4px">{children}</Box>
          </SubmenuGroup>
        </Box>
      )}
    </>
  )
}

export interface FloatingMenuProps {
  isOpen: boolean
  position: { x: number; y: number }
  onClose: () => void
  minW?: string
  children: React.ReactNode
}

/**
 * Self-contained fixed-position context menu surface: edge-clamps to the
 * viewport, closes on outside mousedown, and wraps content in a SubmenuGroup.
 * Use for one-off menus outside the FileGrid (card views, client list, ...).
 */
export const FloatingMenu: React.FC<FloatingMenuProps> = ({ isOpen, position, onClose, minW = '190px', children }) => {
  const { bg, border, shadow } = useMenuColors()
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!isOpen || !el) return
    placeMenuElement(el, position)
  })

  React.useEffect(() => {
    if (!isOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <Box
      ref={menuRef}
      position="fixed"
      top={position.y}
      left={position.x}
      opacity={0}
      bg={bg}
      borderRadius="8px"
      boxShadow={shadow}
      zIndex="modal"
      minW={minW}
      maxW="280px"
      maxH="calc(100vh - 12px)"
      overflowY="auto"
      overflowX="hidden"
      className="enhanced-scrollbar"
      border="1px solid"
      borderColor={border}
    >
      <SubmenuGroup>
        <Box py="4px">{children}</Box>
      </SubmenuGroup>
    </Box>
  )
}
