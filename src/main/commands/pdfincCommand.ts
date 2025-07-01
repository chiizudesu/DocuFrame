import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

export async function pdfincCommand(currentDirectory: string, preview = false): Promise<{ success: boolean; message: string; files?: any[] }> {
  try {
    console.log('[PDFInc] Processing PDFs in directory:', currentDirectory);

    // Check if current directory exists
    if (!fs.existsSync(currentDirectory)) {
      return { 
        success: false, 
        message: `Directory does not exist: ${currentDirectory}` 
      };
    }

    // Define the expected PDF files
    const expectedFiles = ['1.pdf', '2.pdf', '3.pdf', '4.pdf', '5.pdf'];
    const foundFiles: string[] = [];
    const missingFiles: string[] = [];

    // Check which files exist
    for (const filename of expectedFiles) {
      const filePath = path.join(currentDirectory, filename);
      if (fs.existsSync(filePath)) {
        foundFiles.push(filename);
      } else {
        missingFiles.push(filename);
      }
    }

    if (foundFiles.length === 0) {
      return {
        success: false,
        message: 'No numbered PDF files (1.pdf through 5.pdf) found in current directory'
      };
    }

    console.log('[PDFInc] Found files:', foundFiles);
    console.log('[PDFInc] Missing files:', missingFiles);

    // Define merge operations
    const incFiles = ['1.pdf', '2.pdf', '3.pdf'].filter(f => foundFiles.includes(f));
    const pirFiles = ['4.pdf', '5.pdf'].filter(f => foundFiles.includes(f));

    // If preview mode, return merge plan for preview pane
    if (preview) {
      const previewFiles: any[] = [];
      
      if (incFiles.length > 0) {
        previewFiles.push({
          name: 'L - INC Transactions.pdf',
          type: 'pdf' as const,
          size: 'Will be created',
          preview: true,
          mergeInfo: {
            inputFiles: incFiles,
            operation: 'merge'
          }
        });
      }
      
      if (pirFiles.length > 0) {
        previewFiles.push({
          name: 'A5 - PIR Rates.pdf',
          type: 'pdf' as const,
          size: 'Will be created',
          preview: true,
          mergeInfo: {
            inputFiles: pirFiles,
            operation: 'merge'
          }
        });
      }

      return {
        success: true,
        message: `Preview: ${previewFiles.length} PDF merge operation(s) planned`,
        files: previewFiles
      };
    }

    const results: string[] = [];

    // Merge 1.pdf, 2.pdf, 3.pdf into "L - INC Transactions"
    if (incFiles.length > 0) {
      const incResult = await mergePDFs(currentDirectory, incFiles, 'L - INC Transactions.pdf');
      if (incResult.success) {
        results.push(`✓ Merged ${incFiles.join(', ')} → L - INC Transactions.pdf`);
      } else {
        results.push(`✗ Failed to merge INC files: ${incResult.error}`);
      }
    }

    // Merge 4.pdf, 5.pdf into "A5 - PIR Rates"
    if (pirFiles.length > 0) {
      const pirResult = await mergePDFs(currentDirectory, pirFiles, 'A5 - PIR Rates.pdf');
      if (pirResult.success) {
        results.push(`✓ Merged ${pirFiles.join(', ')} → A5 - PIR Rates.pdf`);
      } else {
        results.push(`✗ Failed to merge PIR files: ${pirResult.error}`);
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        message: 'No PDF merging operations were performed'
      };
    }

    return {
      success: true,
      message: `PDFInc processing completed:\n${results.join('\n')}`
    };

  } catch (error) {
    console.error('[PDFInc] Error:', error);
    return {
      success: false,
      message: `PDFInc processing failed: ${(error as Error).message}`
    };
  }
}

async function mergePDFs(directory: string, inputFiles: string[], outputFilename: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process each input file
    for (const filename of inputFiles) {
      const filePath = path.join(directory, filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[PDFInc] Skipping missing file: ${filename}`);
        continue;
      }

      // Read the PDF file
      const pdfBytes = fs.readFileSync(filePath);
      const pdf = await PDFDocument.load(pdfBytes);

      // Copy all pages from this PDF
      const pageIndices = Array.from({ length: pdf.getPageCount() }, (_, i) => i);
      const copiedPages = await mergedPdf.copyPages(pdf, pageIndices);

      // Add the copied pages to the merged PDF
      copiedPages.forEach((page) => mergedPdf.addPage(page));

      console.log(`[PDFInc] Added ${pdf.getPageCount()} pages from ${filename}`);
    }

    // Check if we have any pages
    if (mergedPdf.getPageCount() === 0) {
      return { success: false, error: 'No pages were added to the merged PDF' };
    }

    // Save the merged PDF
    const pdfBytes = await mergedPdf.save();
    const outputPath = path.join(directory, outputFilename);
    
    fs.writeFileSync(outputPath, pdfBytes);

    console.log(`[PDFInc] Merged PDF saved: ${outputPath}`);
    
    return { success: true };

  } catch (error) {
    console.error('[PDFInc] Merge error:', error);
    return { 
      success: false, 
      error: (error as Error).message 
    };
  }
} 