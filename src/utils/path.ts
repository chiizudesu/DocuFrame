// Utility to join paths in a cross-platform way for the frontend (browser context)
export function joinPath(...parts: (string | undefined | null)[]): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  let path = parts.filter(Boolean).join(isWindows ? '\\' : '/');
  // Remove duplicate slashes/backslashes
  path = path.replace(isWindows ? /\\+/g : /\/+/g, isWindows ? '\\' : '/');
  // Remove leading slash on Windows
  if (isWindows && path.startsWith('\\')) path = path.slice(1);
  return path;
}

// Returns the parent directory of a given path, handling Windows and POSIX
export function getParentPath(path: string): string {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (!path) return '';
  // Remove trailing separator
  let normalized = path.replace(isWindows ? /\\+$/ : /\/+$/, '');
  // If it's a Windows drive root, return as is
  if (isWindows && /^[a-zA-Z]:\\?$/.test(normalized)) return normalized;
  // Remove last segment
  const parts = normalized.split(isWindows ? '\\' : '/');
  parts.pop();
  let parent = parts.join(isWindows ? '\\' : '/');
  // If result is empty on Windows, return drive root
  if (isWindows && parent.match(/^[a-zA-Z]:$/)) parent += '\\';
  return parent || (isWindows ? '' : '/');
}

// Checks if a path is absolute (Windows or POSIX)
export function isAbsolutePath(path: string): boolean {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  if (!path) return false;
  if (isWindows) return /^[a-zA-Z]:\\/.test(path);
  return path.startsWith('/');
} 