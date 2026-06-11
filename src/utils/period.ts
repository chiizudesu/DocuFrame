// GST period parsing — folders like "01 - March 2025" (sequence prefix optional,
// may be removed later) map to a sortable month/year period.

export interface PeriodInfo {
  /** Display label, e.g. "Mar 2025" */
  label: string;
  /** Full label, e.g. "March 2025" */
  fullLabel: string;
  /** Sortable key: ms timestamp of the first day of the period month */
  sortKey: number;
  /** Optional numeric sequence prefix ("01 - ..." -> 1) */
  sequence: number | null;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "January|Jan ... 2025" anywhere in the name, prefix-agnostic */
const PERIOD_RE = new RegExp(
  `\\b(${MONTHS.map((m) => `${m.slice(0, 3)}(?:${m.slice(3)})?`).join('|')})\\b[\\s,/-]*?(20\\d{2})`,
  'i'
);

const SEQUENCE_RE = /^(\d{1,3})\s*-\s*/;

/**
 * Parse a GST period from a folder/file name. Handles "01 - March 2025",
 * "March 2025", "3 - Mar 2025" etc. Returns null when no month+year is found.
 */
export function parsePeriodFromName(name: string): PeriodInfo | null {
  const match = name.match(PERIOD_RE);
  if (!match) return null;
  const monthIdx = MONTHS.findIndex((m) => m.startsWith(match[1].slice(0, 3).toLowerCase()));
  if (monthIdx === -1) return null;
  const year = parseInt(match[2], 10);
  const seqMatch = name.match(SEQUENCE_RE);
  return {
    label: `${MONTH_SHORT[monthIdx]} ${year}`,
    fullLabel: `${MONTHS[monthIdx][0].toUpperCase()}${MONTHS[monthIdx].slice(1)} ${year}`,
    sortKey: new Date(year, monthIdx, 1).getTime(),
    sequence: seqMatch ? parseInt(seqMatch[1], 10) : null,
  };
}

/**
 * A directory is a GST folder when its leaf segment is exactly "GST"
 * (paths look like Root\Client Name\GST with period subfolders inside).
 */
export function isGstDirectory(path: string | undefined | null): boolean {
  if (!path) return false;
  const leaf = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  return leaf.trim().toUpperCase() === 'GST';
}
