import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';
import type { TransferOptions, FileItem } from '../../../src/types';

interface FileInfo {
  name: string;
  type: 'folder' | 'pdf' | 'image' | 'document';
  path: string;
  size?: string;
  modified?: string;
  originalName?: string;
}

export async function transferFiles(options: TransferOptions): Promise<{ success: boolean; message: string; files?: FileItem[] }> {
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

    // Get all files in downloads folder, sorted by mtime desc
    const files = fs.readdirSync(downloadsPath)
      .map(file => {
        const filePath = path.join(downloadsPath, file);
        const stats = fs.statSync(filePath);
        return { file, mtime: stats.mtime, stats };
      })
      .filter(f => f.stats.isFile())
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      return { success: false, message: 'No files found in Downloads folder' };
    }

    // Get number of files to transfer/preview
    const numFiles = options.numFiles || 1;
    const filesToPreview = files.slice(0, numFiles);

    // Map to FileItem[]
    let previewFiles: FileItem[] = filesToPreview.map(({ file, stats }, i) => {
      let previewName = file;
      let originalName = file;
      if (options.command === 'preview' && i === 0 && options.newName) {
        const ext = path.extname(file);
        const newNameWithoutExt = options.newName.replace(/\.[^/.]+$/, '');
        previewName = newNameWithoutExt + ext;
      }
      return {
        name: previewName,
        originalName,
        type: getFileType(file),
        path: path.join(downloadsPath, file),
        size: stats.size ? stats.size.toString() : undefined,
        modified: stats.mtime.toISOString(),
      };
    });
    if (options.command === 'preview') {
      console.log('Returning preview:', previewFiles);
      return {
        success: true,
        message: `Preview of ${previewFiles.length} file(s) to transfer`,
        files: previewFiles
      };
    }

    // Use provided current directory or fallback to cwd
    const targetDirectory = options.currentDirectory || process.cwd();
    console.log('Target directory:', targetDirectory);

    // Get filename template if command is provided
    let filenameTemplate: string | undefined;
    if (options.command && options.command !== 'preview') {
      const transferCommandMappings = await getConfig('transferCommandMappings');
      console.log('[Transfer] transferCommandMappings:', transferCommandMappings);
      if (transferCommandMappings && options.command) {
        const mappingKey = Object.keys(transferCommandMappings)
          .find(key => key.toLowerCase() === options.command!.toLowerCase());
        filenameTemplate = mappingKey ? transferCommandMappings[mappingKey] : undefined;
      }
      console.log('Filename template:', filenameTemplate);
    }

    // Process each file
    console.log('Starting file transfer...');
    const results = filesToPreview.map(({ file, stats }, i) => {
      const srcPath = path.join(downloadsPath, file);
      let destName: string;

      if (i === 0 && options.newName) {
        // Use newName for the first file, preserving extension
        const ext = path.extname(file);
        // Remove any extension from newName if present
        const newNameWithoutExt = options.newName.replace(/\.[^/.]+$/, '');
        destName = newNameWithoutExt + ext;
      } else if (filenameTemplate) {
        // Use mapping template for the first file if present
        const template = filenameTemplate;
        const ext = path.extname(file);
        const templateWithoutExt = template.replace(/\.[^/.]+$/, '');
        destName = templateWithoutExt + ext;
      } else {
        // Use original name for additional files
        destName = file;
      }

      const destPath = path.join(targetDirectory, destName);
      console.log(`Transferring ${file} to ${destPath}`);

      try {
        // First check if destination directory exists
        if (!fs.existsSync(targetDirectory)) {
          throw new Error(`Target directory does not exist: ${targetDirectory}`);
        }

        // Check if destination file already exists
        if (fs.existsSync(destPath)) {
          throw new Error(`File already exists at destination: ${destPath}`);
        }

        // Copy the file first
        fs.copyFileSync(srcPath, destPath);
        
        // Verify the copy was successful
        if (!fs.existsSync(destPath)) {
          throw new Error('File copy failed - destination file not found after copy');
        }

        // Delete the original file
        fs.unlinkSync(srcPath);
        
        console.log(`Successfully transferred ${file} to ${destPath}`);
        return { success: true, file: destName };
      } catch (error) {
        console.error(`Failed to transfer ${file}:`, error);
        // If copy succeeded but delete failed, try to clean up
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch (cleanupError) {
            console.error('Failed to clean up destination file after error:', cleanupError);
          }
        }
        return { 
          success: false, 
          file, 
          error: (error as Error).message,
          details: {
            sourcePath: srcPath,
            destinationPath: destPath,
            targetDirectory
          }
        };
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

    // Emit a custom event to refresh the folder view
    if (successful.length > 0) {
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('folderContentsChanged', { directory: targetDirectory });
      }
    }

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