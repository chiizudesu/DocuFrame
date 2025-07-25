import * as fs from 'fs';
import * as path from 'path';
import { mergePdfs } from './mergePdfs';

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
  renamedCount: number; // Keep this for compatibility, but now represents files processed
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

    // Find numbered PDFs and group them for merging
    const incTransactionFiles: string[] = []; // 1.pdf, 2.pdf, 3.pdf
    const pirRateFiles: string[] = []; // 4.pdf, 5.pdf
    
    for (const filePath of files) {
      const filename = path.basename(filePath);
      const fileExt = path.extname(filename);
      
      // Skip non-PDF files
      if (fileExt.toLowerCase() !== '.pdf') {
        continue;
      }

      // Pattern: Numbered PDFs for income tax
      const numberedPattern = /^(\d+)\.pdf$/i;
      const numberedMatch = filename.match(numberedPattern);
      
      if (numberedMatch) {
        const number = parseInt(numberedMatch[1]);
        if (number >= 1 && number <= 3) {
          incTransactionFiles.push(filename);
        } else if (number >= 4 && number <= 5) {
          pirRateFiles.push(filename);
        }
      }
    }

    // Sort files to ensure proper order (1.pdf, 2.pdf, 3.pdf)
    incTransactionFiles.sort();
    pirRateFiles.sort();

    // Process INC Transaction files (1.pdf, 2.pdf, 3.pdf → L - INC Transactions.pdf)
    if (incTransactionFiles.length > 0) {
      const outputFilename = 'L - INC Transactions.pdf';
      
      if (preview) {
        resultFiles.push({
          name: outputFilename,
          originalName: `Will merge: ${incTransactionFiles.join(', ')}`,
          type: 'merge',
          path: path.join(currentDirectory, outputFilename),
          size: `${incTransactionFiles.length} files`,
          modified: new Date().toISOString()
        });
      } else {
        try {
          console.log(`[Pdfinc] Merging INC transaction files: ${incTransactionFiles.join(', ')}`);
          const mergeResult = await mergePdfs(currentDirectory, {
            files: incTransactionFiles,
            outputFilename: outputFilename
          });
          
          if (mergeResult.success) {
            // Delete original files after successful merge
            for (const filename of incTransactionFiles) {
              try {
                fs.unlinkSync(path.join(currentDirectory, filename));
                console.log(`[Pdfinc] Deleted original file: ${filename}`);
              } catch (error) {
                console.warn(`[Pdfinc] Could not delete original file ${filename}:`, error);
              }
            }
            
            renamedCount += incTransactionFiles.length;
            resultFiles.push({
              name: outputFilename,
              originalName: `Merged from: ${incTransactionFiles.join(', ')}`,
              type: 'merged',
              path: path.join(currentDirectory, outputFilename),
              size: `${incTransactionFiles.length} files merged`,
              modified: new Date().toISOString()
            });
          } else {
            console.error(`[Pdfinc] Failed to merge INC transaction files: ${mergeResult.message}`);
          }
        } catch (error) {
          console.error(`[Pdfinc] Error merging INC transaction files:`, error);
        }
      }
    }

    // Process PIR Rate files (4.pdf, 5.pdf → A5 - PIR Rates.pdf)
    if (pirRateFiles.length > 0) {
      const outputFilename = 'A5 - PIR Rates.pdf';
      
      if (preview) {
        resultFiles.push({
          name: outputFilename,
          originalName: `Will merge: ${pirRateFiles.join(', ')}`,
          type: 'merge',
          path: path.join(currentDirectory, outputFilename),
          size: `${pirRateFiles.length} files`,
          modified: new Date().toISOString()
        });
      } else {
        try {
          console.log(`[Pdfinc] Merging PIR rate files: ${pirRateFiles.join(', ')}`);
          const mergeResult = await mergePdfs(currentDirectory, {
            files: pirRateFiles,
            outputFilename: outputFilename
          });
          
          if (mergeResult.success) {
            // Delete original files after successful merge
            for (const filename of pirRateFiles) {
              try {
                fs.unlinkSync(path.join(currentDirectory, filename));
                console.log(`[Pdfinc] Deleted original file: ${filename}`);
              } catch (error) {
                console.warn(`[Pdfinc] Could not delete original file ${filename}:`, error);
              }
            }
            
            renamedCount += pirRateFiles.length;
            resultFiles.push({
              name: outputFilename,
              originalName: `Merged from: ${pirRateFiles.join(', ')}`,
              type: 'merged',
              path: path.join(currentDirectory, outputFilename),
              size: `${pirRateFiles.length} files merged`,
              modified: new Date().toISOString()
            });
          } else {
            console.error(`[Pdfinc] Failed to merge PIR rate files: ${mergeResult.message}`);
          }
        } catch (error) {
          console.error(`[Pdfinc] Error merging PIR rate files:`, error);
        }
      }
    }

    // Handle case where no files match
    if (incTransactionFiles.length === 0 && pirRateFiles.length === 0) {
      if (preview) {
        resultFiles.push({
          name: "No numbered PDFs found to merge",
          originalName: "Looking for files: 1.pdf, 2.pdf, 3.pdf → L - INC Transactions.pdf and 4.pdf, 5.pdf → A5 - PIR Rates.pdf",
          type: "info",
          path: currentDirectory,
          size: "-",
          modified: new Date().toISOString()
        });
      }
    }

    const totalFilesProcessed = incTransactionFiles.length + pirRateFiles.length;
    const mergeOperations = resultFiles.filter(f => f.type === 'merged' || f.type === 'merge').length;

    return {
      success: true,
      message: preview 
        ? `Preview: ${totalFilesProcessed} files would be merged into ${mergeOperations} output files` 
        : `Successfully merged ${totalFilesProcessed} files into ${mergeOperations} output files`,
      renamedCount: totalFilesProcessed,
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