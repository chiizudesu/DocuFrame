// Utility to join paths in a cross-platform way for the frontend (browser context)
export function joinPath(...parts: (string | undefined | null)[]): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  const separator = isWindows ? '\\' : '/';
  
  // Filter out null/undefined/empty parts
  const validParts = parts.filter(part => part && part.trim() !== '');
  if (validParts.length === 0) return '';
  
  let path = validParts.join(separator);
  
  // Remove duplicate separators
  path = path.replace(isWindows ? /\\+/g : /\/+/g, separator);
  
  // Normalize path separators - convert all to the correct platform separator
  path = path.replace(isWindows ? /\//g : /\\/g, separator);
  
  return path;
}

// Returns the parent directory of a given path, handling Windows and POSIX
export function getParentPath(path: string): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (!path || path.trim() === '') return '';
  
  // Normalize path separators first
  const separator = isWindows ? '\\' : '/';
  let normalized = path.replace(/[\/\\]+/g, separator);
  
  // Remove trailing separator
  normalized = normalized.replace(isWindows ? /\\+$/ : /\/+$/, '');
  
  // If it's a Windows drive root (like "C:" or "C:\\"), return as is
  if (isWindows && /^[a-zA-Z]:\\?$/.test(normalized)) {
    return normalized.endsWith('\\') ? normalized : normalized + '\\';
  }
  
  // If it's Unix root, return empty (can't go above root)
  if (!isWindows && normalized === '') return '/';
  if (!isWindows && normalized === '/') return '';
  
  // Split and remove last segment
  const parts = normalized.split(separator).filter(Boolean);
  if (parts.length === 0) return isWindows ? '' : '/';
  
  parts.pop();
  
  if (parts.length === 0) {
    return isWindows ? '' : '/';
  }
  
  let parent = parts.join(separator);
  
  // Handle Windows drive root case
  if (isWindows && parts.length === 1 && /^[a-zA-Z]:$/.test(parts[0])) {
    parent += '\\';
  } else if (isWindows && parent && !parent.startsWith(parts[0])) {
    // Ensure proper Windows path format
    parent = parts.join('\\');
  } else if (!isWindows) {
    // Ensure Unix paths start with /
    parent = '/' + parent;
  }
  
  return parent;
}

// Checks if a path is absolute (Windows or POSIX)
export function isAbsolutePath(path: string): boolean {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (!path || path.trim() === '') return false;
  
  if (isWindows) {
    // Windows: Check for drive letter (C:\, C:/, etc.)
    return /^[a-zA-Z]:[/\\]/.test(path);
  }
  
  // Unix: Check for leading slash
  return path.startsWith('/');
}

// Normalize a path to use consistent separators and format
export function normalizePath(path: string): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (!path || path.trim() === '') return '';
  
  const separator = isWindows ? '\\' : '/';
  
  // Convert all separators to the correct platform separator
  let normalized = path.replace(/[\/\\]+/g, separator);
  
  // Remove trailing separator except for root paths
  if (isWindows) {
    // Keep trailing backslash for drive roots like "C:\\"
    if (!/^[a-zA-Z]:\\$/.test(normalized)) {
      normalized = normalized.replace(/\\+$/, '');
    }
  } else {
    // Keep single leading slash for Unix root
    if (normalized !== '/') {
      normalized = normalized.replace(/\/+$/, '');
    }
  }
  
  return normalized;
}

/**
 * Canonical path key for jump UI (typing pill “at anchor”, backspace).
 * Windows drive root: `C:` and `C:\` after {@link normalizePath} may differ; treat as the same folder.
 */
export function normalizePathJumpKey(path: string): string {
  const n = normalizePath(path);
  if (!n) return '';
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (isWindows && /^[a-zA-Z]:$/.test(n)) {
    return `${n}\\`;
  }
  return n;
}

export function pathsEqualForJump(pathA: string, pathB: string): boolean {
  return normalizePathJumpKey(pathA) === normalizePathJumpKey(pathB);
}

// Get the relative path from a base directory to a target path
export function getRelativePath(basePath: string, targetPath: string): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  const separator = isWindows ? '\\' : '/';
  
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);
  
  // If target is not under base, return the full target path
  if (!normalizedTarget.startsWith(normalizedBase)) {
    return normalizedTarget;
  }
  
  // Remove base path from target
  let relative = normalizedTarget.substring(normalizedBase.length);
  
  // Remove leading separator
  relative = relative.replace(isWindows ? /^\\+/ : /^\/+/, '');
  
  return relative;
}

/** Returns path segments of targetPath relative to basePath. E.g. basePath/a, targetPath a/b/c -> ['b','c']. */
export function getRelativePathSegments(basePath: string, targetPath: string): string[] {
  const relative = getRelativePath(basePath, targetPath);
  if (!relative || relative === normalizePath(targetPath)) return [];
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  const separator = isWindows ? '\\' : '/';
  return relative.split(separator).filter(Boolean);
}

/** Client folders live at Root/annual accounts/clientname */
const ANNUAL_ACCOUNTS_SEGMENT = 'annual accounts';

/**
 * Get the client folder path for a given path.
 * Structure: Root/annual accounts/clientname (client folder is under "annual accounts").
 * E.g. root="C:\\Work", path="C:\\Work\\annual accounts\\Acme Corp\\2025" -> "C:\\Work\\annual accounts\\Acme Corp"
 * Returns null if path is not under root/annual accounts/, or empty.
 */
export function getClientFolderPath(path: string, rootPath: string): string | null {
  const normalized = normalizePath(path);
  const root = normalizePath(rootPath);
  if (!normalized || !root || normalized === root) return null;
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  const sep = isWindows ? '\\' : '/';
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (!normalized.startsWith(rootWithSep)) return null;
  const relative = normalized.slice(rootWithSep.length);
  const parts = relative.split(sep).filter(Boolean);
  // Need at least: "annual accounts" + clientname
  if (parts.length < 2) return null;
  if (parts[0].toLowerCase() !== ANNUAL_ACCOUNTS_SEGMENT.toLowerCase()) return null;
  return rootWithSep + parts[0] + sep + parts[1];
}

// Check if a path is a child of another path
export function isChildPath(parentPath: string, childPath: string): boolean {
  const normalizedParent = normalizePath(parentPath);
  const normalizedChild = normalizePath(childPath);
  
  if (normalizedParent === normalizedChild) return false;
  
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  const separator = isWindows ? '\\' : '/';
  
  // Ensure parent path ends with separator for accurate comparison
  const parentWithSeparator = normalizedParent.endsWith(separator) 
    ? normalizedParent 
    : normalizedParent + separator;
  
  return normalizedChild.startsWith(parentWithSeparator);
}