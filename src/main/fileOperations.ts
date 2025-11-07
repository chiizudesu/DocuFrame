import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { dialog } from 'electron';

export async function selectDirectory(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
}

export async function selectFile(options?: { title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: options?.title || 'Select File',
    filters: options?.filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
}

// Directory cache for lazy enumeration
// Key: dirPath, Value: { entries, timestamp }
const directoryCacheMap = new Map<string, { 
  entries: fs.Dirent[]; 
  timestamp: number;
  allItems: { name: string; type: 'folder' | 'file'; path: string; size: string; modified: string }[] | null;
}>();

const CACHE_DURATION = 5000; // 5 seconds cache

/**
 * TRUE lazy enumeration with progressive loading
 * Implements Windows Explorer-style performance:
 * - Lazy I/O: Only stat files that are requested
 * - Chunked loading: Frontend requests pages as needed
 * - Parallel stat calls for better performance
 * - Smart caching: Reuses directory listings for pagination
 */
export async function getDirectoryContents(
  dirPath: string,
  options?: {
    offset?: number;
    limit?: number;
    sortBy?: 'name' | 'size' | 'modified';
    sortDirection?: 'asc' | 'desc';
  }
): Promise<{ 
  items: { name: string; type: 'folder' | 'file'; path: string; size: string; modified: string }[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const offset = options?.offset || 0;
    const limit = options?.limit; // undefined means load all
    
    // Check cache first - if we have recent data, use it
    const cached = directoryCacheMap.get(dirPath);
    const now = Date.now();
    
    let allEntries: fs.Dirent[];
    let allItemsCached: typeof cached extends undefined ? never : typeof cached.allItems = null;
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      // Use cached directory listing
      allEntries = cached.entries;
      allItemsCached = cached.allItems;
    } else {
      // Read directory entries (only names, fast operation)
      allEntries = await fsp.readdir(dirPath, { withFileTypes: true });
      
      // Cache the raw entries
      directoryCacheMap.set(dirPath, {
        entries: allEntries,
        timestamp: now,
        allItems: null
      });
      
      // Clear old cache entries periodically
      if (directoryCacheMap.size > 50) {
        const oldestAllowed = now - CACHE_DURATION;
        for (const [key, value] of directoryCacheMap.entries()) {
          if (value.timestamp < oldestAllowed) {
            directoryCacheMap.delete(key);
          }
        }
      }
    }
    
    const total = allEntries.length;
    
    // If limit is undefined, load everything at once (small directories)
    if (limit === undefined) {
      // Check if we have fully processed items cached
      if (allItemsCached && allItemsCached.length === total) {
        return {
          items: allItemsCached,
          total,
          hasMore: false
        };
      }
      
      // Process all items in parallel
      const itemPromises = allEntries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          const stats = await fsp.stat(fullPath);
          
          return {
            name: entry.name,
            type: stats.isDirectory() ? 'folder' as const : 'file' as const,
            path: fullPath,
            size: stats.size.toString(),
            modified: stats.mtime.toISOString()
          };
        } catch (error) {
          console.warn(`Could not stat ${fullPath}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(itemPromises);
      const items = results.filter((item): item is NonNullable<typeof item> => item !== null);
      
      // Apply sorting if requested
      if (options?.sortBy) {
        items.sort((a, b) => {
          let comparison = 0;
          
          switch (options.sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'size':
              comparison = parseInt(a.size) - parseInt(b.size);
              break;
            case 'modified':
              comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
              break;
          }
          
          return options.sortDirection === 'desc' ? -comparison : comparison;
        });
      }
      
      // Cache the processed items
      const cache = directoryCacheMap.get(dirPath);
      if (cache) {
        cache.allItems = items;
      }
      
      return {
        items,
        total,
        hasMore: false
      };
    }
    
    // LAZY ENUMERATION: Only stat the files we need for this page
    const paginatedEntries = allEntries.slice(offset, offset + limit);
    
    // Process ONLY the requested page in parallel
    const itemPromises = paginatedEntries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        // Async stat call - non-blocking, can run in parallel
        // CRITICAL: We only stat files that are actually requested!
        const stats = await fsp.stat(fullPath);
        
        return {
          name: entry.name,
          type: stats.isDirectory() ? 'folder' as const : 'file' as const,
          path: fullPath,
          size: stats.size.toString(),
          modified: stats.mtime.toISOString()
        };
      } catch (error) {
        console.warn(`Could not stat ${fullPath}:`, error);
        return null;
      }
    });
    
    // Wait for all stat calls to complete in parallel
    const results = await Promise.all(itemPromises);
    
    // Filter out any failed stats
    const items = results.filter((item): item is NonNullable<typeof item> => item !== null);
    
    // Apply sorting if requested (only to this page)
    if (options?.sortBy) {
      items.sort((a, b) => {
        let comparison = 0;
        
        switch (options.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'size':
            comparison = parseInt(a.size) - parseInt(b.size);
            break;
          case 'modified':
            comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
            break;
        }
        
        return options.sortDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return {
      items,
      total,
      hasMore: offset + limit < total
    };
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
}

/**
 * Clear directory cache for a specific path or all paths
 */
export function clearDirectoryCache(dirPath?: string) {
  if (dirPath) {
    directoryCacheMap.delete(dirPath);
  } else {
    directoryCacheMap.clear();
  }
}

/**
 * Legacy sync version for backwards compatibility
 * Only use when you specifically need synchronous behavior
 */
export function getDirectoryContentsSync(dirPath: string): { name: string; type: 'folder' | 'file'; path: string; size: string; modified: string }[] {
  const items = fs.readdirSync(dirPath);
  
  return items.map(item => {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    
    return {
      name: item,
      type: stats.isDirectory() ? 'folder' : 'file' as 'folder' | 'file',
      path: fullPath,
      size: stats.size.toString(),
      modified: stats.mtime.toISOString()
    };
  });
}

export async function renameItem(oldPath: string, newPath: string): Promise<void> {
  fs.renameSync(oldPath, newPath);
}

export async function deleteItem(itemPath: string): Promise<void> {
  const stats = fs.statSync(itemPath);
  
  if (stats.isDirectory()) {
    fs.rmdirSync(itemPath, { recursive: true });
  } else {
    fs.unlinkSync(itemPath);
  }
}

export async function createDirectory(dirPath: string): Promise<void> {
  fs.mkdirSync(dirPath, { recursive: true });
} 