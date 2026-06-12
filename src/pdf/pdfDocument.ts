import { useEffect, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Shared renderer-side PDF document cache (hover preview + split dialog).
 * Documents load over the existing Express file server, so no new IPC. */
// Sized for the merge dialog, which holds one document per selected source file
const MAX_CACHED_DOCS = 12;

interface CacheEntry {
  promise: Promise<PDFDocumentProxy>;
  lastUsed: number;
}

const docCache = new Map<string, CacheEntry>();
/** Paths that failed to load this session — don't retry on every hover. */
const failedKeys = new Set<string>();

function cacheKey(filePath: string, versionTag?: string): string {
  return `${filePath.replace(/\//g, '\\').toLowerCase()}|${versionTag ?? ''}`;
}

function evictLeastRecentlyUsed() {
  while (docCache.size > MAX_CACHED_DOCS) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of docCache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (!oldestKey) return;
    const evicted = docCache.get(oldestKey)!;
    docCache.delete(oldestKey);
    evicted.promise.then((doc) => doc.destroy()).catch(() => {});
  }
}

/** Load (or reuse) a pdf.js document for an absolute file path.
 * `versionTag` (e.g. file mtime) busts the cache when the file changes on disk. */
export function getPdfDocument(filePath: string, versionTag?: string): Promise<PDFDocumentProxy> {
  const key = cacheKey(filePath, versionTag);
  if (failedKeys.has(key)) {
    return Promise.reject(new Error('PDF previously failed to load'));
  }
  const existing = docCache.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.promise;
  }
  const promise = (async () => {
    // Read through IPC rather than the Express server — that route only serves
    // files under a fixed Documents\Clients path; this works for any path.
    const buffer: ArrayBuffer = await window.electronAPI.readFileAsBuffer(filePath);
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('File is empty or could not be read');
    }
    return await getDocument({ data: new Uint8Array(buffer) }).promise;
  })();
  docCache.set(key, { promise, lastUsed: Date.now() });
  evictLeastRecentlyUsed();
  promise.catch(() => {
    failedKeys.add(key);
    docCache.delete(key);
  });
  return promise;
}

export interface UsePdfDocumentResult {
  doc: PDFDocumentProxy | null;
  error: string | null;
  isLoading: boolean;
}

/** React hook over the shared cache. Pass null/false to stay idle. */
export function usePdfDocument(
  filePath: string | null,
  options?: { versionTag?: string; enabled?: boolean },
): UsePdfDocumentResult {
  const enabled = options?.enabled !== false && !!filePath;
  const versionTag = options?.versionTag;
  const [state, setState] = useState<UsePdfDocumentResult>({ doc: null, error: null, isLoading: false });

  useEffect(() => {
    if (!enabled || !filePath) {
      setState({ doc: null, error: null, isLoading: false });
      return;
    }
    let cancelled = false;
    setState({ doc: null, error: null, isLoading: true });
    getPdfDocument(filePath, versionTag)
      .then((doc) => {
        if (!cancelled) setState({ doc, error: null, isLoading: false });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ doc: null, error: err instanceof Error ? err.message : String(err), isLoading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, filePath, versionTag]);

  return state;
}
