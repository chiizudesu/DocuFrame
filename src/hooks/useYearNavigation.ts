import { useState, useEffect, useCallback } from 'react';
import { getParentPath, joinPath } from '../utils/path';

const YEAR_PATTERN = /^20\d{2}$/; // 2000-2099

export interface YearNavigationState {
  currentYear: string;
  hasPrevYear: boolean;
  hasNextYear: boolean;
  prevYearPath: string | null;
  nextYearPath: string | null;
}

export function useYearNavigation(currentDirectory: string): YearNavigationState | null {
  const [state, setState] = useState<YearNavigationState | null>(null);

  const loadYearNavigation = useCallback(async () => {
    if (!currentDirectory || !window.electronAPI?.getDirectoryContents) {
      setState(null);
      return;
    }

    const segments = currentDirectory.replace(/\\/g, '/').split('/').filter(Boolean);
    if (segments.length < 3) {
      setState(null);
      return;
    }

    // Check if path contains "annual accounts" (case insensitive)
    const hasAnnualAccounts = segments.some(
      (s) => s.toLowerCase().replace(/\s+/g, '') === 'annualaccounts'
    );
    if (!hasAnnualAccounts) {
      setState(null);
      return;
    }

    const lastSegment = segments[segments.length - 1];
    if (!YEAR_PATTERN.test(lastSegment)) {
      setState(null);
      return;
    }

    const currentYear = lastSegment;
    const parentPath = getParentPath(currentDirectory);
    if (!parentPath) {
      setState(null);
      return;
    }

    try {
      const contents = await (window.electronAPI as any).getDirectoryContents(parentPath);
      if (!Array.isArray(contents)) {
        setState(null);
        return;
      }

      const yearFolders = contents
        .filter((f: { type?: string; name?: string }) => f?.type === 'folder' && f?.name && YEAR_PATTERN.test(f.name))
        .map((f: { name: string }) => f.name)
        .sort();

      const prevYear = String(parseInt(currentYear, 10) - 1);
      const nextYear = String(parseInt(currentYear, 10) + 1);

      const hasPrevYear = yearFolders.includes(prevYear);
      const hasNextYear = yearFolders.includes(nextYear);

      setState({
        currentYear,
        hasPrevYear,
        hasNextYear,
        prevYearPath: hasPrevYear ? joinPath(parentPath, prevYear) : null,
        nextYearPath: hasNextYear ? joinPath(parentPath, nextYear) : null,
      });
    } catch {
      setState(null);
    }
  }, [currentDirectory]);

  useEffect(() => {
    loadYearNavigation();
  }, [loadYearNavigation]);

  return state;
}
