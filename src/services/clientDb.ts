/**
 * Shared, cached access to the clientbase CSV.
 *
 * Three useClientInfo mounts (ClientInfoBar, ClientHeaderStrip, FolderInfoBar) plus the
 * client search overlay each used to read + parse the entire CSV from disk on every client
 * navigation / keystroke. This collapses that into one cached, de-duplicated read.
 */
import type { ClientDbRow } from './clientDatabaseCsv';

/** CSV is a reference DB edited infrequently; revalidate at most this often. */
const TTL_MS = 60_000;

let cache: { rows: ClientDbRow[]; at: number } | null = null;
let inflight: Promise<ClientDbRow[]> | null = null;

export async function getClientRows(): Promise<ClientDbRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (inflight) return inflight; // de-dupe concurrent callers (the 3 hooks fire together)
  inflight = (async () => {
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath as string | undefined;
      if (!csvPath) {
        cache = { rows: [], at: Date.now() };
        return [];
      }
      const rows = ((await window.electronAPI.readCsv(csvPath)) as ClientDbRow[]) || [];
      cache = { rows, at: Date.now() };
      return rows;
    } catch {
      return []; // don't cache failures — retry on the next call
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Force the next getClientRows() to re-read (e.g. after the clientbase path changes). */
export function invalidateClientRows(): void {
  cache = null;
}
