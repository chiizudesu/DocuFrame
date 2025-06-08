import * as fs from 'fs';
import * as path from 'path';

interface GSTRenameResult {
  success: boolean;
  message: string;
  processedFiles: string[];
  errors: string[];
  previewFiles?: { original: string; preview: string }[];
}

function extractPeriodFromFilename(filename: string): string | null {
  // Match patterns like 31_05_2025, 31-05-2025, 31.05.2025, 31 05 2025
  const match = filename.match(/(\d{1,2})[\s._-]?(\d{1,2})[\s._-]?(20\d{2})/);
  if (match) {
    const monthNum = parseInt(match[2], 10);
    const year = match[3];
    if (monthNum >= 1 && monthNum <= 12) {
      const monthName = [
        '', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ][monthNum];
      return `${monthName} ${year}`;
    }
  }
  return null;
}

function cleanName(name: string): string {
  // Replace underscores and multiple spaces with single space, trim
  return name.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').replace(/\s+-/g, ' -').replace(/-\s+/g, '- ').trim();
}

function removeParenthesisNumber(name: string): string {
  return name.replace(/\s*\(\d+\)/g, '').trim();
}

export async function gstRenameCommand(currentDirectory: string, preview: boolean = false): Promise<GSTRenameResult> {
  try {
    const processedFiles: string[] = [];
    const errors: string[] = [];
    const previewFiles: { original: string; preview: string }[] = [];
    const dirContents = fs.readdirSync(currentDirectory);
    let renamedCount = 0;

    // 1. Find GST Return file (with period)
    let period: string | null = null;
    let gstReturnFile: string | null = null;
    for (const file of dirContents) {
      if (extractPeriodFromFilename(file)) {
        period = extractPeriodFromFilename(file);
        gstReturnFile = file;
        break;
      }
    }
    if (!period) {
      return {
        success: true,
        message: 'No GST Return file with period found. No files renamed.',
        processedFiles: [],
        errors: [],
        previewFiles: preview ? [] : undefined
      };
    }

    // 2. Build new names for all files
    for (const item of dirContents) {
      const filePath = path.join(currentDirectory, item);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;

      let base = item.replace(/\.[^/.]+$/, '');
      let ext = item.match(/\.[^/.]+$/) ? item.match(/\.[^/.]+$/)[0] : '';
      ext = ext || '';
      base = cleanName(base);
      base = removeParenthesisNumber(base);

      let newName: string;
      if (item === gstReturnFile) {
        // GST Return file
        base = base.replace(/(\d{1,2})[\s._-]?(\d{1,2})[\s._-]?(20\d{2})/, '').trim();
        newName = `${base} - GST Return - ${period ?? ''}${ext}`.replace(/\s{2,}/g, ' ').trim();
      } else {
        // Supplementary file
        newName = `${base}${period ? ' - ' + period : ''}${ext}`.replace(/\s{2,}/g, ' ').trim();
      }

      if (newName !== item) {
        if (preview) {
          previewFiles.push({ original: item, preview: newName });
        } else {
          const newPath = path.join(currentDirectory, newName);
          try {
            fs.renameSync(filePath, newPath);
            processedFiles.push(`${item} → ${newName}`);
            renamedCount++;
          } catch (err) {
            errors.push(`Failed to rename ${item}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    let message = '';
    if (preview) {
      if (previewFiles.length > 0) {
        message = `Preview: ${previewFiles.length} file(s) would be renamed.`;
      } else {
        message = 'No files would be renamed.';
      }
    } else {
      if (renamedCount > 0) {
        message = `Renamed ${renamedCount} file(s) successfully.`;
      } else {
        message = 'No files needed renaming.';
      }
    }

    return {
      success: errors.length === 0,
      message,
      processedFiles,
      errors,
      previewFiles: preview ? previewFiles : undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Error processing GST files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      processedFiles: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

// Additional function to create standard GST folder structure if needed
export async function createStandardGSTStructure(gstRootDir: string, clientName: string): Promise<void> {
  const standardFolders = [
    'FY24',
    'FY25', 
    'Draft',
    'Final',
    'Working Papers',
    'Returns'
  ];

  const clientPath = path.join(gstRootDir, clientName);
  
  if (!fs.existsSync(clientPath)) {
    fs.mkdirSync(clientPath, { recursive: true });
  }

  for (const folder of standardFolders) {
    const folderPath = path.join(clientPath, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      console.log(`[GST Rename] Created standard folder: ${folder}`);
    }
  }
} 