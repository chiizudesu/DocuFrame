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