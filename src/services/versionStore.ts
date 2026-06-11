// File version registry — every file is implicitly v1; replacing its content
// (Replace with Latest File, and later the transfer-pane replace flow) bumps it.
// Persisted in the electron config under `fileVersionRegistry`, keyed by
// normalized absolute path. Renames/moves intentionally reset to v1 for now.

import { normalizePath } from '../utils/path';

export interface FileVersionEntry {
  v: number;
  replacedAt: string; // ISO timestamp of the last replacement
}

type Registry = Record<string, FileVersionEntry>;

let registry: Registry = {};
let epoch = 0;
let loaded = false;
let loadPromise: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function keyFor(path: string): string {
  return normalizePath(path).toLowerCase();
}

function notify() {
  epoch++;
  listeners.forEach((cb) => cb());
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const config = await (window.electronAPI as any).getConfig();
      await (window.electronAPI as any).setConfig({ ...config, fileVersionRegistry: registry });
    } catch (e) {
      console.error('[versionStore] Failed to persist version registry:', e);
    }
  }, 500);
}

export const versionStore = {
  /** Load the persisted registry once; safe to call repeatedly. */
  init(): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const config = await (window.electronAPI as any).getConfig();
        const saved = config?.fileVersionRegistry;
        if (saved && typeof saved === 'object') {
          registry = saved as Registry;
        }
      } catch (e) {
        console.error('[versionStore] Failed to load version registry:', e);
      } finally {
        loaded = true;
        notify();
      }
    })();
    return loadPromise;
  },

  isLoaded(): boolean {
    return loaded;
  },

  getVersion(path: string): number {
    return registry[keyFor(path)]?.v ?? 1;
  },

  getEntry(path: string): FileVersionEntry | undefined {
    return registry[keyFor(path)];
  },

  /** Record a replacement: v1 -> v2 -> v3... */
  bump(path: string): number {
    const key = keyFor(path);
    const next = (registry[key]?.v ?? 1) + 1;
    registry = { ...registry, [key]: { v: next, replacedAt: new Date().toISOString() } };
    notify();
    schedulePersist();
    return next;
  },

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** Snapshot for useSyncExternalStore — changes whenever any version changes. */
  getEpoch(): number {
    return epoch;
  },
};
