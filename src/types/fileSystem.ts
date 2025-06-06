export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
} 