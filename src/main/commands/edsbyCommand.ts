import * as fs from 'fs';
import * as path from 'path';

interface FileItem {
  name: string;
  originalName: string;
  type: string;
  path: string;
  size?: string;
  modified: string;
}

interface EdsbyResult {
  success: boolean;
  message: string;
  renamedCount: number;
  files: FileItem[];
}

export async function edsbyCommand(currentDirectory: string, period: string, preview: boolean = false): Promise<EdsbyResult> {
  console.log(`[Edsby] ${preview ? 'Previewing' : 'Processing'} files in directory:`, currentDirectory, 'for period:', period);
  
  try {
    // Check if current directory exists and contains files
    if (!fs.existsSync(currentDirectory)) {
      return {
        success: false,
        message: "Directory does not exist",
        renamedCount: 0,
        files: []
      };
    }

    if (!period || period.trim() === '') {
      return {
        success: false,
        message: "Period parameter is required (e.g., 'June 2025')",
        renamedCount: 0,
        files: []
      };
    }

    let files: string[] = [];
    const resultFiles: FileItem[] = [];
    let renamedCount = 0;

    // Get all files in the directory
    const dirContents = fs.readdirSync(currentDirectory);
    for (const item of dirContents) {
      const filePath = path.join(currentDirectory, item);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        files.push(filePath);
      }
    }

    // Convert period to Title Case for consistent naming
    function toTitleCase(str: string) {
      return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    const periodTitleCase = toTitleCase(period);

    // Process each file according to the patterns
    for (const filePath of files) {
      const filename = path.basename(filePath);
      const fileExt = path.extname(filename);
      
      // Skip non-PDF and non-Excel files
      if (!['.pdf', '.xlsx', '.xls'].includes(fileExt.toLowerCase())) {
        continue;
      }

      let newName: string | null = null;

      // Pattern 1: Edsby New Zealand Limited files
      // Edsby_New_Zealand_Limited_-_Profit_and_Loss (2).xlsx → Edsby NZ Limited - Service Fee Analysis - June 2025.xlsx
      // Edsby_New_Zealand_Limited_-_Profit_and_Loss (3).pdf → Edsby NZ Limited - Profit and Loss - June 2025.pdf
      const edsbyPattern = /^Edsby_New_Zealand_Limited_-_Profit_and_Loss\s*(\(\d+\))?\.(xlsx?|pdf)$/i;
      const edsbyMatch = filename.match(edsbyPattern);
      
      if (edsbyMatch) {
        const extension = edsbyMatch[2];
        if (extension.toLowerCase() === 'xlsx' || extension.toLowerCase() === 'xls') {
          newName = `Edsby NZ Limited - Service Fee Analysis - ${periodTitleCase}.xlsx`;
        } else if (extension.toLowerCase() === 'pdf') {
          newName = `Edsby NZ Limited - Profit and Loss - ${periodTitleCase}.pdf`;
        }
      }

      // Pattern 2: Invoice files
      // Invoice INV-0053.pdf → June 2025 Invoice - INV-0053.pdf
      const invoicePattern = /^Invoice\s+(INV-\d+)\.pdf$/i;
      const invoiceMatch = filename.match(invoicePattern);
      
      if (invoiceMatch) {
        const invoiceNumber = invoiceMatch[1];
        newName = `${periodTitleCase} Invoice - ${invoiceNumber}.pdf`;
      }

      // Pattern 3: Generic Edsby files with underscores (fallback)
      // Handle other Edsby files that might follow similar underscore patterns
      const genericEdsbyPattern = /^Edsby_New_Zealand_Limited_-_(.+?)\s*(\(\d+\))?\.(xlsx?|pdf)$/i;
      const genericMatch = filename.match(genericEdsbyPattern);
      
      if (genericMatch && !edsbyMatch) { // Only if not already matched above
        const documentType = genericMatch[1].replace(/_/g, ' ');
        const extension = genericMatch[3];
        newName = `Edsby NZ Limited - ${documentType} - ${periodTitleCase}.${extension}`;
      }

      // Process the renaming if a new name was determined
      if (newName && filename !== newName) {
        const newPath = path.join(currentDirectory, newName);

        if (preview) {
          // Preview mode: show what would be renamed
          const stats = fs.statSync(filePath);
          resultFiles.push({
            name: newName,
            originalName: filename,
            type: getFileType(newName),
            path: newPath,
            size: (stats.size / 1024).toFixed(1) + ' KB',
            modified: stats.mtime.toISOString()
          });
          renamedCount++;
          console.log(`[Edsby] Preview: ${filename} → ${newName}`);
        } else {
          // Actual rename mode
          try {
            // Check if target file already exists
            if (fs.existsSync(newPath)) {
              console.warn(`[Edsby] Target file already exists, skipping: ${newName}`);
              continue;
            }
            
            fs.renameSync(filePath, newPath);
            console.log(`[Edsby] Renamed: ${filename} → ${newName}`);
            renamedCount++;
          } catch (error) {
            console.error(`[Edsby] Error renaming '${filename}':`, error);
          }
        }
      }
    }

    // For non-preview mode, get final directory contents after renaming
    if (!preview) {
      const finalContents = fs.readdirSync(currentDirectory);
      
      for (const item of finalContents.sort()) {
        const filePath = path.join(currentDirectory, item);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          resultFiles.push({
            name: item,
            originalName: item,
            type: getFileType(item),
            path: filePath,
            size: (stats.size / 1024).toFixed(1) + ' KB',
            modified: stats.mtime.toISOString()
          });
        }
      }
    }

    // Handle case where no files match in preview mode
    if (preview && renamedCount === 0) {
      // Add a placeholder item to show in preview pane
      resultFiles.push({
        name: "No Edsby files found to rename",
        originalName: "Looking for files matching patterns like: Edsby_New_Zealand_Limited_-_Profit_and_Loss.pdf, Invoice INV-XXXX.pdf, Edsby_New_Zealand_Limited_-_*.pdf/xlsx",
        type: "info",
        path: currentDirectory,
        size: "-",
        modified: new Date().toISOString()
      });
    }

    let message: string;
    if (preview) {
      message = renamedCount > 0 
        ? `Preview: ${renamedCount} files will be renamed for ${period}.`
        : `No files match the Edsby renaming patterns for ${period}.`;
    } else {
      message = renamedCount > 0 
        ? `Renamed ${renamedCount} files successfully for ${period}.`
        : `No files matched the renaming patterns for ${period}.`;
    }

    return {
      success: true,
      message,
      renamedCount,
      files: resultFiles
    };

  } catch (error) {
    console.error('[Edsby] Error processing files:', error);
    return {
      success: false,
      message: `Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      renamedCount: 0,
      files: []
    };
  }
}

function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'PDF Document';
    case '.doc':
    case '.docx':
      return 'Word Document';
    case '.xls':
    case '.xlsx':
      return 'Excel Spreadsheet';
    case '.txt':
      return 'Text File';
    default:
      return 'File';
  }
} 