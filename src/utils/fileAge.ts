// File age helpers for the Age column — compact label + "heat" for the hot bar.

export interface AgeInfo {
  /** Compact label: "now", "5m", "3h", "2d", "3w", "4mo", "1y" */
  label: string;
  /** 1 = modified just now (hot), 0 = a year or older (cold); log-scaled */
  heat: number;
  /** Bar fill color bucket derived from heat */
  color: string;
  /** Soft glow for hot files */
  glow: string | undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getAgeInfo(modified: string | undefined, now: number = Date.now()): AgeInfo | null {
  if (!modified) return null;
  const t = new Date(modified).getTime();
  if (isNaN(t)) return null;
  const ageMs = Math.max(0, now - t);

  const minutes = ageMs / 60000;
  const hours = minutes / 60;
  const days = ageMs / DAY_MS;

  let label: string;
  if (minutes < 1) label = 'now';
  else if (minutes < 60) label = `${Math.floor(minutes)}m`;
  else if (hours < 24) label = `${Math.floor(hours)}h`;
  else if (days < 7) label = `${Math.floor(days)}d`;
  else if (days < 30) label = `${Math.floor(days / 7)}w`;
  else if (days < 365) label = `${Math.floor(days / 30)}mo`;
  else label = `${Math.floor(days / 365)}y`;

  // Log scale: today ~1.0, a week ~0.65, a month ~0.42, a year+ ~0
  const heat = Math.max(0, Math.min(1, 1 - Math.log(days + 1) / Math.log(366)));

  let color: string;
  let glow: string | undefined;
  if (heat >= 0.66) {
    color = '#f97316'; // hot — touched in the last few days
    glow = '0 0 6px rgba(249,115,22,0.55)';
  } else if (heat >= 0.4) {
    color = '#eab308'; // warm — within the month
  } else if (heat >= 0.15) {
    color = '#60a5fa'; // cooling — a few months
  } else {
    color = '#64748b'; // cold — about a year or more
  }

  return { label, heat, color, glow };
}
