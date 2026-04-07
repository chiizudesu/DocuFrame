/**
 * DocuFrame clientbase CSV — fixed export shape (see client_database CSV).
 * Column names must match the file header row exactly.
 */

export const CLIENT_DB = {
  CLIENT_NAME: 'Client Name',
  ADDRESS: 'Address',
  IRD_NUMBER: 'IRD Number',
  CLIENT_LINK: 'Client Link',
} as const;

/** Fiscal years with job link columns in the CSV */
export const CLIENT_DB_FY_YEARS = ['2025', '2026', '2027'] as const;
export type ClientDbFyYear = (typeof CLIENT_DB_FY_YEARS)[number];

export function fyJobLinkColumn(year: string): string {
  return `FY${year} Job Link`;
}

export type ClientDbRow = Record<string, string | undefined>;

function nonEmptyString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' || s === '-' ? null : s;
}

export function getClientName(row: ClientDbRow | null | undefined): string | null {
  if (!row) return null;
  return nonEmptyString(row[CLIENT_DB.CLIENT_NAME]);
}

export function getAddress(row: ClientDbRow | null | undefined): string | null {
  if (!row) return null;
  return nonEmptyString(row[CLIENT_DB.ADDRESS]);
}

export function getIrdNumber(row: ClientDbRow | null | undefined): string | null {
  if (!row) return null;
  return nonEmptyString(row[CLIENT_DB.IRD_NUMBER]);
}

export function getClientLink(row: ClientDbRow | null | undefined): string | null {
  if (!row) return null;
  return nonEmptyString(row[CLIENT_DB.CLIENT_LINK]);
}

export function getJobLink(row: ClientDbRow | null | undefined, year: string): string | null {
  if (!row) return null;
  return nonEmptyString(row[fyJobLinkColumn(year)]);
}

export function yearsWithJobLinks(row: ClientDbRow | null | undefined): string[] {
  if (!row) return [];
  return CLIENT_DB_FY_YEARS.filter((y) => getJobLink(row, y) != null);
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

export function findClientRow(rows: ClientDbRow[], folderClientName: string): ClientDbRow | null {
  if (!folderClientName.trim() || !rows?.length) return null;
  const normFolder = normalizeForMatch(folderClientName);
  const exact = rows.find((row) => {
    const name = getClientName(row);
    if (!name) return false;
    return normalizeForMatch(name) === normFolder;
  });
  if (exact) return exact;
  const loose = rows.find((row) => {
    const name = getClientName(row);
    if (!name) return false;
    return name.toLowerCase().includes(folderClientName.toLowerCase());
  });
  return loose ?? null;
}

const VALID_PATH_TAX_YEARS = new Set<string>(CLIENT_DB_FY_YEARS);

/** Prefer path tax year if it maps to an FY column; else newest FY with a link (2027 → 2025). */
export function resolveJobLinkFallback(row: ClientDbRow | null | undefined, taxYearFromPath: string): string | null {
  if (!row) return null;
  if (taxYearFromPath && VALID_PATH_TAX_YEARS.has(taxYearFromPath)) {
    const direct = getJobLink(row, taxYearFromPath);
    if (direct) return direct;
  }
  for (let i = CLIENT_DB_FY_YEARS.length - 1; i >= 0; i--) {
    const y = CLIENT_DB_FY_YEARS[i];
    const link = getJobLink(row, y);
    if (link) return link;
  }
  return null;
}
