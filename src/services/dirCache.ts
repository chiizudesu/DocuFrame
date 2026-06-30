/**
 * In-memory LRU cache of RAW directory contents (the array from getDirectoryContents,
 * before hide-filters are applied — so filter-setting changes don't need invalidation).
 *
 * Lets tab switches and revisits paint instantly while a background revalidate keeps
 * them fresh (stale-while-revalidate). Caches DATA, not component trees, so memory stays
 * bounded no matter how many tabs are open.
 */
import { normalizePath } from '../utils/path';

// ponytail: insertion-ordered Map is a good-enough LRU; swap for a real LRU only if 30 dirs isn't enough.
const MAX_ENTRIES = 30;
const cache = new Map<string, any[]>();

function key(path: string): string {
  return normalizePath(path || '');
}

export function dirCacheGet(path: string): any[] | undefined {
  const k = key(path);
  const v = cache.get(k);
  if (v !== undefined) {
    // Touch for LRU recency.
    cache.delete(k);
    cache.set(k, v);
  }
  return v;
}

export function dirCacheSet(path: string, items: any[]): void {
  const k = key(path);
  if (cache.has(k)) cache.delete(k);
  cache.set(k, items);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function dirCacheInvalidate(path: string): void {
  cache.delete(key(path));
}

export function dirCacheClear(): void {
  cache.clear();
}
