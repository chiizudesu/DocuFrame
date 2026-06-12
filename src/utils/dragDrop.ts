/**
 * Shared drag-and-drop helpers for the custom folder views (client list, card view).
 *
 * DocuFrame drags use Electron's native startDrag, so a drop re-enters the window
 * as an OS drag carrying only the `Files` type. The `__docuframeInternalDrag`
 * global (set at drag start) is how drop targets recognise an internal move —
 * the same convention FileGrid uses.
 */

import type { DragEvent as ReactDragEvent } from 'react';

export interface DragPayload {
  paths: string[];
  isInternal: boolean;
}

function normalizePathForMatch(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** True when the dragged content is something a folder target can accept. */
export function isDragAccepted(e: ReactDragEvent): boolean {
  const types = e.dataTransfer.types;
  return (
    types.includes('application/x-docuframe-files') ||
    types.includes('Files') ||
    !!(window as any).__docuframeInternalDrag
  );
}

/**
 * Resolve the dragged paths on drop and whether the drag originated inside
 * DocuFrame (internal → move semantics, external → copy semantics).
 */
export function readDragPayload(e: ReactDragEvent): DragPayload {
  const dt = e.dataTransfer;

  const custom = dt.getData('application/x-docuframe-files');
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length > 0) return { paths: parsed, isInternal: true };
    } catch {}
  }

  const marker = (window as any).__docuframeInternalDrag?.files as string[] | undefined;
  const osPaths: string[] = dt.files?.length
    ? Array.from(dt.files).map((f: File) => (f as any).path).filter(Boolean)
    : [];

  if (marker?.length) {
    if (osPaths.length === 0) return { paths: marker, isInternal: true };
    const matchesMarker =
      osPaths.length === marker.length &&
      osPaths.every((p) => marker.some((m) => normalizePathForMatch(m) === normalizePathForMatch(p)));
    if (matchesMarker) return { paths: marker, isInternal: true };
  }

  return { paths: osPaths, isInternal: false };
}

/** Start an internal drag for the given paths (mirrors FileGrid's drag start). */
export function beginInternalDrag(e: ReactDragEvent, paths: string[]): void {
  e.preventDefault();
  try {
    (window as any).__docuframeInternalDrag = { files: paths, timestamp: Date.now() };
  } catch {}
  e.dataTransfer.setData('application/x-docuframe-files', JSON.stringify(paths));
  e.dataTransfer.setData('text/plain', JSON.stringify(paths));
  e.dataTransfer.effectAllowed = 'copyMove';
  const electron = (window as any).electron;
  if (electron && typeof electron.startDrag === 'function') {
    electron.startDrag(paths as any);
  }
}

export function clearInternalDrag(): void {
  try {
    delete (window as any).__docuframeInternalDrag;
  } catch {}
}

/**
 * Filter dragged paths against a target folder: drop self/ancestor moves and
 * report whether everything is already inside the target.
 */
export function partitionDropPaths(paths: string[], targetDir: string): {
  movable: string[];
  droppedSelf: boolean;
  allAlreadyInTarget: boolean;
} {
  const target = normalizePathForMatch(targetDir);
  let droppedSelf = false;
  const movable = paths.filter((p) => {
    const n = normalizePathForMatch(p);
    if (n === target || target.startsWith(n + '/')) {
      droppedSelf = true;
      return false;
    }
    return true;
  });
  const allAlreadyInTarget =
    movable.length > 0 &&
    movable.every((p) => {
      const n = normalizePathForMatch(p);
      return n.substring(0, n.lastIndexOf('/')) === target;
    });
  return { movable, droppedSelf, allAlreadyInTarget };
}
