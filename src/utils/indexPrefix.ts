// Utility functions for managing file index prefixes (workpaper sections)

export interface IndexInfo {
  key: string;
  name: string;
  description: string;
}

// Workpaper section descriptions mapping
export const WORKPAPER_DESCRIPTIONS: { [key: string]: string } = {
  'AA': 'Prior Year Files',
  'A1': 'Permanent',
  'A2': 'Job Notes', 
  'A3': 'Other Checks',
  'A4': 'Financial Statements, Tax Returns & Minutes',
  'A5': 'Individuals',
  'C': 'Bank Reconciliation',
  'D': 'Accounts Receivable',
  'E': 'Other Current Assets',
  'E1': 'Inventory',
  'E2': 'Prepayments',
  'F': 'Fixed Assets',
  'F1': 'Non-Current Assets',
  'G': 'Accounts Payable',
  'H': 'Other Current Liabilities',
  'H1': 'Non-Current Liabilities',
  'I': 'Loans',
  'I2': 'Finance Lease',
  'I3': 'Operating Lease Commitments',
  'J': 'Investments',
  'K': 'GST',
  'L': 'Income Tax',
  'M': 'Imputation Credits',
  'M2': 'Imputation Credits to RE',
  'N': 'Shareholder/Beneficiary Current Accounts',
  'O': 'Equity, Capital, Accumulations',
  'P': 'Intangibles',
  'Q': 'Profit & Loss',
  'R': 'Entertainment',
  'S': 'Home Office',
  'W': 'Wages',
};

/**
 * Extract index prefix from filename (e.g., "A5 - File.xlsx" -> "A5", "AA - File.xlsx" -> "AA")
 */
export function extractIndexPrefix(filename: string): string | null {
  const match = filename.match(/^([A-Z]+(?:\d+)?)\s*-/);
  return match ? match[1] : null;
}

/**
 * Get index info including name and description
 */
export function getIndexInfo(indexKey: string): IndexInfo {
  return {
    key: indexKey,
    name: indexKey,
    description: WORKPAPER_DESCRIPTIONS[indexKey] || '',
  };
}

/**
 * Get all available index keys sorted
 */
export function getAllIndexKeys(): string[] {
  return Object.keys(WORKPAPER_DESCRIPTIONS).sort((a, b) => {
    // Sort alphabetically, but handle numeric suffixes
    const aMatch = a.match(/^([A-Z])(\d+)?/);
    const bMatch = b.match(/^([A-Z])(\d+)?/);
    
    if (!aMatch || !bMatch) return a.localeCompare(b);
    
    const aLetter = aMatch[1];
    const bLetter = bMatch[1];
    const aNum = aMatch[2] ? parseInt(aMatch[2]) : 0;
    const bNum = bMatch[2] ? parseInt(bMatch[2]) : 0;
    
    if (aLetter !== bLetter) {
      return aLetter.localeCompare(bLetter);
    }
    
    return aNum - bNum;
  });
}

/**
 * Remove index prefix from filename
 */
export function removeIndexPrefix(filename: string): string {
  const match = filename.match(/^[A-Z]+(?:\d+)?\s*-\s*(.+)$/);
  const result = match ? match[1].trim() : filename;
  console.log('[indexPrefix] removeIndexPrefix', { filename, result, matched: !!match });
  return result;
}

/**
 * Add or replace index prefix in filename
 */
export function setIndexPrefix(filename: string, indexKey: string): string {
  console.log('[indexPrefix] setIndexPrefix called', { filename, indexKey });
  const withoutPrefix = removeIndexPrefix(filename);
  const result = `${indexKey} - ${withoutPrefix}`;
  console.log('[indexPrefix] setIndexPrefix result', { filename, indexKey, withoutPrefix, result });
  return result;
}

/**
 * Group files by their index prefix
 * Separates folders (type === 'folder') from files - folders are returned separately
 */
export function groupFilesByIndex<T extends { name: string; type?: string }>(
  files: T[]
): { folders: T[]; [key: string]: T[] } {
  const groups: { folders: T[]; [key: string]: T[] } = { folders: [] };
  
  files.forEach((file) => {
    // Separate folders - they go in a special "folders" group
    if (file.type === 'folder') {
      groups.folders.push(file);
      return;
    }
    
    // Group files by index prefix
    const indexKey = extractIndexPrefix(file.name) || 'Other';
    if (!groups[indexKey]) {
      groups[indexKey] = [];
    }
    groups[indexKey].push(file);
  });
  
  return groups;
}

/**
 * Calculate the maximum width needed for index pills based on all index keys and descriptions
 */
export function getMaxIndexPillWidth(): number {
  const keys = Object.keys(WORKPAPER_DESCRIPTIONS);
  let maxLength = 0;
  
  keys.forEach(key => {
    const description = WORKPAPER_DESCRIPTIONS[key];
    const fullText = description ? `${key} - ${description}` : key;
    maxLength = Math.max(maxLength, fullText.length);
  });
  
  // Add some padding and account for "Other" group
  return Math.max(maxLength, 5) + 2; // +2 for padding
}

/**
 * Convert filename to proper case
 */
export function toProperCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

