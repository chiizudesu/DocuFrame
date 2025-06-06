import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';

interface TransferOptions {
  numFiles?: number;
  newName?: string;
  command?: string;
}

interface FileInfo {
  name: string;
  type: 'folder' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
}

export async function transferFiles(options: TransferOptions): Promise<{ success: boolean; message: string; files?: FileInfo[] }> {
  try {
    console.log('Transfer options:', options);
    
    // Get downloads folder path
    const downloadsPath = path.join(app.getPath('downloads'));
    console.log('Downloads path:', downloadsPath);
    
    // Check if downloads directory exists
    if (!fs.existsSync(downloadsPath)) {
      console.error('Downloads directory not found:', downloadsPath);
      return { success: false, message: `Downloads directory not found: ${downloadsPath}` };
    }

    // Get all files in downloads folder
    const files = fs.readdirSync(downloadsPath)
      .filter(file => {
        const filePath = path.join(downloadsPath, file);
        try {
          return fs.statSync(filePath).isFile();
        } catch (error) {
          console.error(`Error checking file ${file}:`, error);
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const statA = fs.statSync(path.join(downloadsPath, a));
          const statB = fs.statSync(path.join(downloadsPath, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        } catch (error) {
          console.error('Error sorting files:', error);
          return 0;
        }
      });

    console.log('Found files in downloads:', files);

    if (files.length === 0) {
      return { success: false, message: 'No files found in Downloads folder' };
    }

    // Get current working directory
    const cwd = process.cwd();
    console.log('Current working directory:', cwd);

    // Get number of files to transfer
    const numFiles = options.numFiles || 1;
    const filesToTransfer = files.slice(0, numFiles);
    console.log('Files to transfer:', filesToTransfer);

    // Get filename template if command is provided
    let filenameTemplate: string | undefined;
    if (options.command && options.command !== 'preview') {
      const settings = await getConfig('settings');
      filenameTemplate = settings?.transferCommandMappings?.[options.command];
      console.log('Filename template:', filenameTemplate);
    }

    // Create preview files info
    const previewFiles: FileInfo[] = filesToTransfer.map((file, index) => {
      const srcPath = path.join(downloadsPath, file);
      const stats = fs.statSync(srcPath);
      let destName: string;

      if (index === 0 && (options.newName || filenameTemplate)) {
        // For first file, use provided name or template
        const template = options.newName || filenameTemplate;
        const ext = path.extname(file);
        destName = template + ext;
      } else {
        // For additional files, use original name
        destName = file;
      }

      return {
        name: destName,
        type: getFileType(file),
        path: path.join(cwd, destName),
        size: formatFileSize(stats.size),
        modified: stats.mtime.toLocaleString()
      };
    });

    // If this is just a preview request, return the files info
    if (options.command === 'preview') {
      console.log('Returning preview:', previewFiles);
      return {
        success: true,
        message: `Preview of ${previewFiles.length} file(s) to transfer`,
        files: previewFiles
      };
    }

    // Process each file
    console.log('Starting file transfer...');
    const results = filesToTransfer.map((file, index) => {
      const srcPath = path.join(downloadsPath, file);
      let destName: string;

      if (index === 0 && (options.newName || filenameTemplate)) {
        // For first file, use provided name or template
        const template = options.newName || filenameTemplate;
        const ext = path.extname(file);
        destName = template + ext;
      } else {
        // For additional files, use original name
        destName = file;
      }

      const destPath = path.join(cwd, destName);
      console.log(`Transferring ${file} to ${destPath}`);

      try {
        fs.renameSync(srcPath, destPath);
        console.log(`Successfully transferred ${file} to ${destPath}`);
        return { success: true, file: destName };
      } catch (error) {
        console.error(`Failed to transfer ${file}:`, error);
        return { success: false, file, error: (error as Error).message };
      }
    });

    // Generate result message
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let message = '';
    if (successful.length > 0) {
      message += `Successfully transferred ${successful.length} file(s): ${successful.map(r => r.file).join(', ')}`;
    }
    if (failed.length > 0) {
      message += `\nFailed to transfer ${failed.length} file(s): ${failed.map(r => r.file).join(', ')}`;
    }

    console.log('Transfer complete:', message);
    return {
      success: failed.length === 0,
      message,
      files: previewFiles
    };
  } catch (error) {
    console.error('Error during transfer:', error);
    return {
      success: false,
      message: `Error during transfer: ${(error as Error).message}`
    };
  }
}

function getFileType(filename: string): FileInfo['type'] {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) return 'image';
  if (['.doc', '.docx', '.txt', '.rtf'].includes(ext)) return 'document';
  return 'document';
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
} 