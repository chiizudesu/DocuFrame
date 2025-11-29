import * as fs from 'fs';
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

export async function getDirectoryContents(dirPath: string): Promise<{ name: string; type: 'folder' | 'file'; path: string; size: string; modified: string }[]> {
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
  // On Windows, case-only renames can fail if the filesystem deletes the original file first
  // To work around this, we use a temporary name for case-only renames
  const oldName = path.basename(oldPath);
  const newName = path.basename(newPath);
  const oldDir = path.dirname(oldPath);
  const newDir = path.dirname(newPath);
  
  // Check if this is a case-only rename (same name, different case, same directory)
  const isCaseOnlyRename = oldDir === newDir && 
                           oldName.toLowerCase() === newName.toLowerCase() && 
                           oldName !== newName;
  
  if (isCaseOnlyRename) {
    // Use a temporary name to avoid Windows filesystem issues
    const tempName = `__temp_rename_${Date.now()}_${oldName}`;
    const tempPath = path.join(oldDir, tempName);
    
    // First rename to temporary name
    fs.renameSync(oldPath, tempPath);
    // Then rename to final name
    fs.renameSync(tempPath, newPath);
  } else {
    // Normal rename
    fs.renameSync(oldPath, newPath);
  }
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