import React, { useMemo } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { X } from 'lucide-react'
import { useColorModeValue } from '../ui/color-mode'
import { docuFramePalette } from '../../docuFrameColors'
import { TYPE_FILTER_GROUPS, getExtension, dateFilterStart, type DateFilterPreset } from '../../utils/fileFilters'
import type { FileItem } from '../../types'

interface QuickFilterChipsProps {
  folderItems: FileItem[]
  typeFilter: string[]
  setTypeFilter: React.Dispatch<React.SetStateAction<string[]>>
  dateFilter: DateFilterPreset | null
  setDateFilter: React.Dispatch<React.SetStateAction<DateFilterPreset | null>>
}

interface ChipProps {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}

const Chip: React.FC<ChipProps & { activeBg: string; activeColor: string; inactiveBg: string; inactiveColor: string; hoverBg: string }> = ({
  label,
  count,
  active,
  onClick,
  activeBg,
  activeColor,
  inactiveBg,
  inactiveColor,
  hoverBg,
}) => (
  <Flex
    as="button"
    align="center"
    gap={1}
    px={2}
    h="18px"
    borderRadius="full"
    fontSize="11px"
    cursor="pointer"
    bg={active ? activeBg : inactiveBg}
    color={active ? activeColor : inactiveColor}
    _hover={{ bg: active ? activeBg : hoverBg }}
    onClick={onClick}
    flexShrink={0}
    userSelect="none"
  >
    <Text fontSize="11px" lineHeight={1}>{label}</Text>
    {count !== undefined && (
      <Text fontSize="10px" lineHeight={1} opacity={0.75}>{count}</Text>
    )}
  </Flex>
)

/**
 * One-click extension/date filters above the file grid. Drives the same
 * typeFilter/dateFilter state as the column header filter menus.
 */
export const QuickFilterChips: React.FC<QuickFilterChipsProps> = ({
  folderItems,
  typeFilter,
  setTypeFilter,
  dateFilter,
  setDateFilter,
}) => {
  const barBg = useColorModeValue(docuFramePalette.light.canvas, docuFramePalette.dark.canvas)
  const inactiveBg = useColorModeValue('#e9edf3', '#2a3441')
  const inactiveColor = useColorModeValue('#475569', '#a8b3c2')
  const hoverBg = useColorModeValue('#dde3ec', '#36414f')
  const activeBg = useColorModeValue('#2563eb', '#2b6cb0')
  const activeColor = '#ffffff'

  const counts = useMemo(() => {
    const byGroup: Record<string, number> = {}
    let today = 0
    const todayStart = dateFilterStart('today').getTime()
    for (const f of folderItems) {
      if (f.type === 'folder') continue
      const ext = getExtension(f.name)
      for (const group of TYPE_FILTER_GROUPS) {
        if (group.extensions.includes(ext)) {
          byGroup[group.key] = (byGroup[group.key] || 0) + 1
        }
      }
      if (f.modified) {
        const t = new Date(f.modified).getTime()
        if (!Number.isNaN(t) && t >= todayStart) today++
      }
    }
    return { byGroup, today }
  }, [folderItems])

  const visibleGroups = TYPE_FILTER_GROUPS.filter((g) => (counts.byGroup[g.key] || 0) > 0)
  const hasAnyChips = visibleGroups.length > 0 || counts.today > 0
  const hasActiveFilter = typeFilter.length > 0 || dateFilter !== null
  if (!hasAnyChips && !hasActiveFilter) return null

  const isGroupActive = (extensions: string[]) => extensions.every((e) => typeFilter.includes(e))

  const toggleGroup = (extensions: string[]) => {
    setTypeFilter((prev) => {
      if (extensions.every((e) => prev.includes(e))) {
        return prev.filter((e) => !extensions.includes(e))
      }
      const next = new Set(prev)
      extensions.forEach((e) => next.add(e))
      return Array.from(next)
    })
  }

  return (
    <Flex align="center" gap={1.5} px={2} py="3px" bg={barBg} flexShrink={0} overflowX="hidden">
      {visibleGroups.map((group) => (
        <Chip
          key={group.key}
          label={group.label}
          count={counts.byGroup[group.key]}
          active={isGroupActive(group.extensions)}
          onClick={() => toggleGroup(group.extensions)}
          activeBg={activeBg}
          activeColor={activeColor}
          inactiveBg={inactiveBg}
          inactiveColor={inactiveColor}
          hoverBg={hoverBg}
        />
      ))}
      {counts.today > 0 && (
        <Chip
          label="Today"
          count={counts.today}
          active={dateFilter === 'today'}
          onClick={() => setDateFilter((prev) => (prev === 'today' ? null : 'today'))}
          activeBg={activeBg}
          activeColor={activeColor}
          inactiveBg={inactiveBg}
          inactiveColor={inactiveColor}
          hoverBg={hoverBg}
        />
      )}
      {hasActiveFilter && (
        <Flex
          as="button"
          align="center"
          gap={0.5}
          px={1.5}
          h="18px"
          borderRadius="full"
          cursor="pointer"
          color={inactiveColor}
          _hover={{ bg: hoverBg }}
          onClick={() => {
            setTypeFilter([])
            setDateFilter(null)
          }}
          flexShrink={0}
        >
          <X size={11} />
          <Text fontSize="11px" lineHeight={1}>Clear</Text>
        </Flex>
      )}
      <Box flex={1} />
    </Flex>
  )
}
