import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FileItem } from '../types';

const MAX_RESULTS = 20;

/** Ranking knobs for level-aware jump search (e.g. root → client finder). */
export interface DirectorySearchRankOptions {
  /** Full paths to boost + suggest on empty query (most recent first) */
  recentPaths?: string[];
  /** How many suggestions to show for an empty query (default 3) */
  emptyQuerySuggestions?: number;
  /** Result cap with a query (default 20) */
  maxResults?: number;
}

function pathKey(p: string): string {
  return p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

/**
 * Indices of `query` characters inside `name` (case-insensitive), for highlight.
 * Contiguous substring match wins; otherwise a left-to-right subsequence match.
 * Returns null when the name doesn't match at all.
 */
export function getFuzzyMatchIndices(name: string, query: string): number[] | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  const n = name.toLowerCase();
  const sub = n.indexOf(q);
  if (sub >= 0) return Array.from({ length: q.length }, (_, i) => sub + i);
  const indices: number[] = [];
  let from = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = n.indexOf(ch, from);
    if (at === -1) return null;
    indices.push(at);
    from = at + 1;
  }
  return indices;
}

/** 3 = prefix, 2 = substring, 1 = subsequence, 0 = no match */
function matchTier(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 3;
  if (n.includes(q)) return 2;
  return getFuzzyMatchIndices(name, q) ? 1 : 0;
}

/**
 * Filter and sort directory contents by search query.
 * Empty query: recent paths first (when provided), then folders A–Z.
 * With query: prefix > substring > fuzzy subsequence; folders first; recents boosted.
 */
export function filterAndSortDirectoryFiles(
  files: FileItem[],
  query: string,
  rankOptions?: DirectorySearchRankOptions
): FileItem[] {
  const recentKeys = (rankOptions?.recentPaths ?? []).map(pathKey);
  const recentRank = (f: FileItem) => {
    const idx = recentKeys.indexOf(pathKey(f.path));
    return idx === -1 ? Infinity : idx;
  };

  if (!query.trim()) {
    const limit = rankOptions?.emptyQuerySuggestions ?? 3;
    const folders = files
      .filter((f) => f.type === 'folder')
      .sort((a, b) => {
        const ra = recentRank(a);
        const rb = recentRank(b);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    return folders.slice(0, limit);
  }

  const q = query.toLowerCase().trim();
  return files
    .map((file) => ({ file, tier: matchTier(file.name, q) }))
    .filter((entry) => entry.tier > 0)
    .sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;
      const aIsFolder = a.file.type === 'folder';
      const bIsFolder = b.file.type === 'folder';
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      const ra = recentRank(a.file);
      const rb = recentRank(b.file);
      if (ra !== rb) return ra - rb;
      return a.file.name.localeCompare(b.file.name);
    })
    .map((entry) => entry.file)
    .slice(0, rankOptions?.maxResults ?? MAX_RESULTS);
}

export interface UseDirectorySearchOptions {
  /** Directory path to search in */
  directoryPath: string;
  /** Whether the search is active (loads files when true) */
  isActive: boolean;
  /** Initial search text (e.g. from first keystroke) */
  initialSearchText?: string;
  /** If set, only matching items are listed (e.g. hide dot folders like FileGrid) */
  itemPredicate?: (item: FileItem) => boolean;
  /** Level-aware ranking (recents boost, suggestion/result counts). Memoize at the call site. */
  rankOptions?: DirectorySearchRankOptions;
}

export interface UseDirectorySearchResult {
  searchText: string;
  setSearchText: React.Dispatch<React.SetStateAction<string>>;
  files: FileItem[];
  searchResults: FileItem[];
  selectedResultIndex: number;
  setSelectedResultIndex: React.Dispatch<React.SetStateAction<number>>;
  loadFiles: (path: string) => Promise<void>;
  isLoading: boolean;
}

export function useDirectorySearch({
  directoryPath,
  isActive,
  initialSearchText = '',
  itemPredicate,
  rankOptions,
}: UseDirectorySearchOptions): UseDirectorySearchResult {
  const [searchText, setSearchText] = useState(initialSearchText);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    if (!path || !(window.electronAPI as any)?.getDirectoryContents) return;
    setIsLoading(true);
    try {
      const contents = await (window.electronAPI as any).getDirectoryContents(path);
      const items = Array.isArray(contents)
        ? contents
        : contents?.files && Array.isArray(contents.files)
          ? contents.files
          : [];
      setFiles(items);
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && directoryPath) {
      loadFiles(directoryPath);
    } else if (!isActive) {
      setFiles([]);
      setSearchText('');
      setSelectedResultIndex(0);
    }
  }, [isActive, directoryPath, loadFiles]);

  useEffect(() => {
    setSearchText(initialSearchText);
  }, [initialSearchText]);

  const scopedFiles = useMemo(() => {
    if (!itemPredicate) return files;
    return files.filter(itemPredicate);
  }, [files, itemPredicate]);

  const searchResults = useMemo(() => {
    return filterAndSortDirectoryFiles(scopedFiles, searchText, rankOptions);
  }, [scopedFiles, searchText, rankOptions]);

  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchText]);

  return {
    searchText,
    setSearchText,
    files,
    searchResults,
    selectedResultIndex,
    setSelectedResultIndex,
    loadFiles,
    isLoading,
  };
}
