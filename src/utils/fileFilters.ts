/**
 * Shared filtering predicates for the FileGrid quick filter chips and the
 * column header filter menus. Both drive the same typeFilter/dateFilter state
 * in AppContext, so chips and column filters always agree.
 */

export type DateFilterPreset = 'today' | 'last7' | 'thisMonth' | 'thisFY'

export const DATE_FILTER_LABELS: Record<DateFilterPreset, string> = {
  today: 'Today',
  last7: 'Last 7 days',
  thisMonth: 'This month',
  thisFY: 'This FY',
}

/** Quick filter chips: each chip toggles its whole extension set atomically. */
export const TYPE_FILTER_GROUPS: Array<{ key: string; label: string; extensions: string[] }> = [
  { key: 'pdf', label: 'PDF', extensions: ['pdf'] },
  { key: 'excel', label: 'Excel', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] },
  { key: 'word', label: 'Word', extensions: ['docx', 'doc'] },
  { key: 'image', label: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff'] },
]

export function getExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i === -1 || i === name.length - 1) return ''
  return name.slice(i + 1).toLowerCase()
}

/** Start of the period a date preset covers. NZ financial year starts 1 April. */
export function dateFilterStart(preset: DateFilterPreset, now: Date = new Date()): Date {
  switch (preset) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'last7': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      d.setDate(d.getDate() - 7)
      return d
    }
    case 'thisMonth':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'thisFY': {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
      return new Date(fyStartYear, 3, 1)
    }
  }
}

/** Group key for "group by type" mode: extension uppercase, e.g. PDF, XLSX. */
export function typeGroupKey(name: string): string {
  const ext = getExtension(name)
  return ext ? ext.toUpperCase() : 'No extension'
}

export const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Older']

/** Group key for "group by date" mode, based on the modified timestamp. */
export function dateGroupKey(modified: string | undefined, now: Date = new Date()): string {
  if (!modified) return 'Older'
  const t = new Date(modified).getTime()
  if (Number.isNaN(t)) return 'Older'
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (t >= todayStart.getTime()) return 'Today'
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  if (t >= yesterdayStart.getTime()) return 'Yesterday'
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)
  if (t >= weekStart.getTime()) return 'This week'
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  if (t >= monthStart.getTime()) return 'This month'
  return 'Older'
}

/** Folders always pass so type filtering never blocks navigation. */
export function matchesTypeFilter(name: string, type: string, typeFilter: string[]): boolean {
  if (typeFilter.length === 0) return true
  if (type === 'folder') return true
  return typeFilter.includes(getExtension(name))
}

/** Folders always pass; files with no/invalid modified date are hidden while a preset is active. */
export function matchesDateFilter(
  modified: string | undefined,
  type: string,
  preset: DateFilterPreset | null,
  now?: Date,
): boolean {
  if (!preset) return true
  if (type === 'folder') return true
  if (!modified) return false
  const t = new Date(modified).getTime()
  return !Number.isNaN(t) && t >= dateFilterStart(preset, now).getTime()
}
