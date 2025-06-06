import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';

interface TransferOptions {
  numFiles?: number;
  newName?: string;
  command?: string;
}

export async function transferFiles(options: TransferOptions): Promise<{ success: boolean; message: string }> {
  try {
    // Get downloads folder path
    const downloadsPath = path.join(app.getPath('downloads'));
    
    // Check if downloads directory exists
    if (!fs.existsSync(downloadsPath)) {
      return { success: false, message: `Downloads directory not found: ${downloadsPath}` };
    }

    // Get all files in downloads folder
    const files = fs.readdirSync(downloadsPath)
      .filter(file => fs.statSync(path.join(downloadsPath, file)).isFile())
      .sort((a, b) => {
        const statA = fs.statSync(path.join(downloadsPath, a));
        const statB = fs.statSync(path.join(downloadsPath, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    if (files.length === 0) {
      return { success: false, message: 'No files found in Downloads folder' };
    }

    // Get current working directory
    const cwd = process.cwd();

    // Get number of files to transfer
    const numFiles = options.numFiles || 1;
    const filesToTransfer = files.slice(0, numFiles);

    // Get filename template if command is provided
    let filenameTemplate: string | undefined;
    if (options.command) {
      const settings = await getConfig('settings');
      filenameTemplate = settings?.transferCommandMappings?.[options.command];
    }

    // Process each file
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

      try {
        fs.renameSync(srcPath, destPath);
        return { success: true, file: destName };
      } catch (error) {
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

    return {
      success: failed.length === 0,
      message
    };
  } catch (error) {
    return {
      success: false,
      message: `Error during transfer: ${(error as Error).message}`
    };
  }
} 