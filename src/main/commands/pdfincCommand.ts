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

interface PdfincResult {
  success: boolean;
  message: string;
  renamedCount: number;
  files: FileItem[];
}

export async function pdfincCommand(currentDirectory: string, preview: boolean = false): Promise<PdfincResult> {
  console.log(`[Pdfinc] ${preview ? 'Previewing' : 'Processing'} files in directory:`, currentDirectory);
  
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

    // Process each file according to the patterns
    for (const filePath of files) {
      const filename = path.basename(filePath);
      const fileExt = path.extname(filename);
      
      // Skip non-PDF files
      if (fileExt.toLowerCase() !== '.pdf') {
        continue;
      }

      let newName: string | null = null;

      // Pattern: Numbered PDFs for income tax
      // 1.pdf, 2.pdf, 3.pdf → L - INC Transactions.pdf
      // 4.pdf, 5.pdf → A5 - PIR Rates.pdf
      const numberedPattern = /^(\d+)\.pdf$/i;
      const numberedMatch = filename.match(numberedPattern);
      
      if (numberedMatch) {
        const number = parseInt(numberedMatch[1]);
        if (number >= 1 && number <= 3) {
          newName = 'L - INC Transactions.pdf';
        } else if (number >= 4 && number <= 5) {
          newName = 'A5 - PIR Rates.pdf';
        }
      }

      if (newName) {
        const newPath = path.join(currentDirectory, newName);
        
        if (preview) {
          // Add to preview files
          resultFiles.push({
            name: newName,
            originalName: filename,
            type: 'file',
            path: newPath,
            size: 'Will be created',
            modified: new Date().toISOString()
          });
        } else {
          // Actually rename the file
          try {
            fs.renameSync(filePath, newPath);
            renamedCount++;
            resultFiles.push({
              name: newName,
              originalName: filename,
              type: 'file',
              path: newPath,
              size: 'Renamed',
              modified: new Date().toISOString()
            });
          } catch (error) {
            console.error(`Error renaming ${filename}:`, error);
          }
        }
      }
    }

    // Handle case where no files match in preview mode
    if (preview && renamedCount === 0) {
      // Add a placeholder item to show in preview pane
      resultFiles.push({
        name: "No numbered PDFs found to merge",
        originalName: "Looking for files: 1.pdf, 2.pdf, 3.pdf → L - INC Transactions.pdf and 4.pdf, 5.pdf → A5 - PIR Rates.pdf",
        type: "info",
        path: currentDirectory,
        size: "-",
        modified: new Date().toISOString()
      });
    }

    return {
      success: true,
      message: preview 
        ? `Preview: ${resultFiles.length} files would be processed` 
        : `Successfully processed ${renamedCount} files`,
      renamedCount,
      files: resultFiles
    };

  } catch (error) {
    console.error('[Pdfinc] Error:', error);
    return {
      success: false,
      message: `Error processing files: ${error}`,
      renamedCount: 0,
      files: []
    };
  }
} 