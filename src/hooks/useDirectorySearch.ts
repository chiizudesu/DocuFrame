import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FileItem } from '../types';

const MAX_RESULTS = 20;

/**
 * Filter and sort directory contents by search query.
 * Empty query: first 3 folders A–Z (jump bar suggestions). With query: match, folders first, starts-with prioritized.
 */
export function filterAndSortDirectoryFiles(
  files: FileItem[],
  query: string
): FileItem[] {
  if (!query.trim()) {
    return files
      .filter((f) => f.type === 'folder')
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .slice(0, 3);
  }
  const q = query.toLowerCase();
  return files
    .filter((file) => file.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(q);
      const bStartsWith = b.name.toLowerCase().startsWith(q);
      const aIsFolder = a.type === 'folder';
      const bIsFolder = b.type === 'folder';

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;

      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_RESULTS);
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
    return filterAndSortDirectoryFiles(scopedFiles, searchText);
  }, [scopedFiles, searchText]);

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
