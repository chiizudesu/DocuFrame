import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  extension?: string;
  size?: number;
  lastModified?: Date;
}

class FileSystemService {
  private rootPath: string;

  constructor() {
    this.rootPath = app.getPath('userData');
  }

  async validatePath(dirPath: string): Promise<boolean> {
    try {
      // Normalize the path to handle Windows backslashes
      const normalizedPath = path.normalize(dirPath);
      
      // Check if path exists
      const stats = await fs.stat(normalizedPath);
      
      // Check if it's a directory
      return stats.isDirectory();
    } catch (error) {
      console.error('Path validation error:', error);
      return false;
    }
  }

  async getDirectoryContents(dirPath: string): Promise<FileSystemItem[]> {
    try {
      const normalizedPath = path.normalize(dirPath);
      const isValid = await this.validatePath(normalizedPath);
      
      if (!isValid) {
        throw new Error(`Path is not a valid directory: ${normalizedPath}`);
      }

      const items = await fs.readdir(normalizedPath);
      const fileSystemItems: FileSystemItem[] = [];

      for (const item of items) {
        try {
          const itemPath = path.join(normalizedPath, item);
          const stats = await fs.stat(itemPath);
          
          const fileSystemItem: FileSystemItem = {
            name: item,
            path: itemPath,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            lastModified: stats.mtime
          };

          if (!stats.isDirectory()) {
            fileSystemItem.extension = path.extname(item).toLowerCase().slice(1);
          }

          fileSystemItems.push(fileSystemItem);
        } catch (error) {
          console.error(`Error processing item ${item}:`, error);
          // Continue with next item instead of failing the entire operation
          continue;
        }
      }

      return fileSystemItems;
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<FileSystemItem> {
    try {
      const normalizedPath = path.normalize(dirPath);
      await fs.mkdir(normalizedPath, { recursive: true });
      
      const stats = await fs.stat(normalizedPath);
      return {
        name: path.basename(normalizedPath),
        path: normalizedPath,
        type: 'directory',
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  }

  async deleteItem(itemPath: string): Promise<void> {
    try {
      const normalizedPath = path.normalize(itemPath);
      const stats = await fs.stat(normalizedPath);
      
      if (stats.isDirectory()) {
        await fs.rmdir(normalizedPath, { recursive: true });
      } else {
        await fs.unlink(normalizedPath);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  async moveItem(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const normalizedSource = path.normalize(sourcePath);
      const normalizedDest = path.normalize(destinationPath);
      await fs.rename(normalizedSource, normalizedDest);
    } catch (error) {
      console.error('Error moving item:', error);
      throw error;
    }
  }
}

export const fileSystemService = new FileSystemService(); 