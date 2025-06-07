import type { FileItem } from '../types';

interface SearchOptions {
  query: string;
  maxResults?: number;
  includeFiles?: boolean;
  includeFolders?: boolean;
  currentDirectory?: string;
  recursive?: boolean;
}

interface SearchResult {
  results: FileItem[];
  hasMore: boolean;
  searchTime: number;
}

class FileSearchService {
  private static instance: FileSearchService;
  private searchCache = new Map<string, { results: FileItem[], timestamp: number }>();
  private readonly CACHE_DURATION = 90000; // Increase to 90 seconds for faster repeated searches
  private readonly DEFAULT_MAX_RESULTS = 20;

  private constructor() {}

  static getInstance(): FileSearchService {
    if (!FileSearchService.instance) {
      FileSearchService.instance = new FileSearchService();
    }
    return FileSearchService.instance;
  }

  /**
   * Search for files and folders matching the query
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    const {
      query,
      maxResults = this.DEFAULT_MAX_RESULTS,
      includeFiles = true,
      includeFolders = true,
      currentDirectory,
      recursive = true
    } = options;

    // Generate cache key
    const cacheKey = JSON.stringify({
      query: query.toLowerCase(),
      maxResults,
      includeFiles,
      includeFolders,
      currentDirectory,
      recursive
    });

    // Check cache first
    const cached = this.searchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return {
        results: cached.results,
        hasMore: cached.results.length >= maxResults,
        searchTime: Date.now() - startTime
      };
    }

    try {
      // Start with current directory if provided, otherwise use root
      const searchPath = currentDirectory || '';
      const results = await this.performSearch(query, searchPath, {
        maxResults,
        includeFiles,
        includeFolders,
        recursive
      });

      // Cache the results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();

      return {
        results,
        hasMore: results.length >= maxResults,
        searchTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[FileSearch] Search failed:', error);
      return {
        results: [],
        hasMore: false,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search within the current directory only (non-recursive)
   */
  async searchCurrentDirectory(query: string, currentDirectory: string, maxResults = 10): Promise<FileItem[]> {
    const result = await this.search({
      query,
      maxResults,
      currentDirectory,
      recursive: false
    });
    return result.results;
  }

  /**
   * Search for recent files globally
   */
  async searchRecent(query: string, maxResults = 10): Promise<FileItem[]> {
    try {
      // Get recent files from the file system
      const allResults = await this.performGlobalSearch(query, { maxResults: maxResults * 2 });
      
      // Sort by modification time (most recent first) if available
      return allResults
        .sort((a, b) => {
          if (a.modified && b.modified) {
            return new Date(b.modified).getTime() - new Date(a.modified).getTime();
          }
          return 0;
        })
        .slice(0, maxResults);
    } catch (error) {
      console.error('[FileSearch] Recent search failed:', error);
      return [];
    }
  }

  /**
   * Get suggestions based on partial input
   */
  async getSuggestions(query: string, currentDirectory?: string): Promise<FileItem[]> {
    if (query.length < 2) {
      return [];
    }

    const result = await this.search({
      query,
      maxResults: 8,
      currentDirectory,
      recursive: true
    });

    return result.results;
  }

  /**
   * Perform the actual search using Electron API
   */
  private async performSearch(
    query: string, 
    searchPath: string, 
    options: {
      maxResults: number;
      includeFiles: boolean;
      includeFolders: boolean;
      recursive: boolean;
    }
  ): Promise<FileItem[]> {
    try {
      // Use electron API to search files
      if (window.electronAPI && (window.electronAPI as any).searchFiles) {
        return await (window.electronAPI as any).searchFiles({
          query,
          searchPath,
          ...options
        });
      }

      // Fallback: search current directory contents
      const contents = await window.electronAPI.getDirectoryContents(searchPath || '.');
      return this.filterLocalResults(contents, query, options);
    } catch (error) {
      console.error('[FileSearch] Search API failed, using fallback:', error);
      
      // Final fallback: try to get current directory contents
      try {
        const contents = await window.electronAPI.getDirectoryContents(searchPath || '.');
        return this.filterLocalResults(contents, query, options);
      } catch (fallbackError) {
        console.error('[FileSearch] Fallback search failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Perform global search across file system
   */
  private async performGlobalSearch(query: string, options: { maxResults: number }): Promise<FileItem[]> {
    try {
      if (window.electronAPI && (window.electronAPI as any).globalSearch) {
        return await (window.electronAPI as any).globalSearch({
          query,
          maxResults: options.maxResults
        });
      }

      // Fallback to local search in root directory
      const rootContents = await window.electronAPI.getDirectoryContents('');
      return this.filterLocalResults(rootContents, query, {
        maxResults: options.maxResults,
        includeFiles: true,
        includeFolders: true,
        recursive: false
      });
    } catch (error) {
      console.error('[FileSearch] Global search failed:', error);
      return [];
    }
  }

  /**
   * Filter local directory contents based on query
   */
  private filterLocalResults(
    items: FileItem[], 
    query: string, 
    options: {
      maxResults: number;
      includeFiles: boolean;
      includeFolders: boolean;
      recursive: boolean;
    }
  ): FileItem[] {
    const normalizedQuery = query.toLowerCase();
    
    return items
      .filter(item => {
        // Filter by type
        if (!options.includeFiles && item.type !== 'folder') return false;
        if (!options.includeFolders && item.type === 'folder') return false;
        
        // Filter by name match
        return item.name.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        // PRIORITY 1: Folders always come first
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        
        // PRIORITY 2: Exact matches within same type
        const aExact = a.name.toLowerCase() === normalizedQuery;
        const bExact = b.name.toLowerCase() === normalizedQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // PRIORITY 3: Starts with query within same type
        const aStarts = a.name.toLowerCase().startsWith(normalizedQuery);
        const bStarts = b.name.toLowerCase().startsWith(normalizedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // PRIORITY 4: Alphabetical within same match type
        return a.name.localeCompare(b.name);
      })
      .slice(0, options.maxResults);
  }

  /**
   * Clear expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.searchCache.size,
      keys: Array.from(this.searchCache.keys())
    };
  }
}

export const fileSearchService = FileSearchService.getInstance(); 