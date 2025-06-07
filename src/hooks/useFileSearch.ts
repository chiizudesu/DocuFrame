import { useState, useEffect, useCallback, useRef } from 'react';
import { fileSearchService } from '../services/fileSearch';
import type { FileItem } from '../types';

interface UseFileSearchOptions {
  debounceMs?: number;
  maxResults?: number;
  includeFiles?: boolean;
  includeFolders?: boolean;
  currentDirectory?: string;
  recursive?: boolean;
}

interface FileSearchState {
  results: FileItem[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  searchTime: number;
}

export const useFileSearch = (options: UseFileSearchOptions = {}) => {
  const {
    debounceMs = 300,
    maxResults = 10,
    includeFiles = true,
    includeFolders = true,
    currentDirectory,
    recursive = true
  } = options;

  const [searchState, setSearchState] = useState<FileSearchState>({
    results: [],
    isLoading: false,
    error: null,
    hasMore: false,
    searchTime: 0
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const currentQueryRef = useRef<string>('');

  const search = useCallback(async (query: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Store current query
    currentQueryRef.current = query;

    // If query is empty, clear results immediately
    if (!query.trim()) {
      setSearchState({
        results: [],
        isLoading: false,
        error: null,
        hasMore: false,
        searchTime: 0
      });
      return;
    }

    // Set loading state
    setSearchState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Check if query is still current (user hasn't typed something else)
        if (currentQueryRef.current !== query) {
          return;
        }

        const result = await fileSearchService.search({
          query: query.trim(),
          maxResults,
          includeFiles,
          includeFolders,
          currentDirectory,
          recursive
        });

        // Final check before setting results
        if (currentQueryRef.current === query) {
          setSearchState({
            results: result.results,
            isLoading: false,
            error: null,
            hasMore: result.hasMore,
            searchTime: result.searchTime
          });
        }
      } catch (error) {
        console.error('[useFileSearch] Search failed:', error);
        
        // Only set error if this is still the current query
        if (currentQueryRef.current === query) {
          setSearchState({
            results: [],
            isLoading: false,
            error: error instanceof Error ? error.message : 'Search failed',
            hasMore: false,
            searchTime: 0
          });
        }
      }
    }, debounceMs);
  }, [debounceMs, maxResults, includeFiles, includeFolders, currentDirectory, recursive]);

  const searchCurrentDirectory = useCallback(async (query: string, directory: string) => {
    try {
      setSearchState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const results = await fileSearchService.searchCurrentDirectory(query, directory, maxResults);
      
      setSearchState({
        results,
        isLoading: false,
        error: null,
        hasMore: results.length >= maxResults,
        searchTime: 0
      });
    } catch (error) {
      console.error('[useFileSearch] Current directory search failed:', error);
      setSearchState({
        results: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed',
        hasMore: false,
        searchTime: 0
      });
    }
  }, [maxResults]);

  const searchRecent = useCallback(async (query: string) => {
    try {
      setSearchState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const results = await fileSearchService.searchRecent(query, maxResults);
      
      setSearchState({
        results,
        isLoading: false,
        error: null,
        hasMore: false,
        searchTime: 0
      });
    } catch (error) {
      console.error('[useFileSearch] Recent search failed:', error);
      setSearchState({
        results: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed',
        hasMore: false,
        searchTime: 0
      });
    }
  }, [maxResults]);

  const getSuggestions = useCallback(async (query: string) => {
    try {
      if (query.length < 2) {
        return [];
      }

      const results = await fileSearchService.getSuggestions(query, currentDirectory);
      return results;
    } catch (error) {
      console.error('[useFileSearch] Suggestions failed:', error);
      return [];
    }
  }, [currentDirectory]);

  const clearResults = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    currentQueryRef.current = '';
    setSearchState({
      results: [],
      isLoading: false,
      error: null,
      hasMore: false,
      searchTime: 0
    });
  }, []);

  const clearCache = useCallback(() => {
    fileSearchService.clearCache();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...searchState,
    search,
    searchCurrentDirectory,
    searchRecent,
    getSuggestions,
    clearResults,
    clearCache
  };
}; 