import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

interface MergePDFOptions {
  files: string[];
  outputFilename: string;
}

export async function mergePdfs(currentDirectory: string, options: MergePDFOptions): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[MergePDFs] Starting merge operation:', options);
    
    if (!options.files || options.files.length < 2) {
      return { success: false, message: 'At least 2 PDF files are required for merging' };
    }

    if (!options.outputFilename) {
      return { success: false, message: 'Output filename is required' };
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();

    // Process each PDF file
    for (let i = 0; i < options.files.length; i++) {
      const filename = options.files[i];
      const filePath = path.join(currentDirectory, filename);

      console.log(`[MergePDFs] Processing file ${i + 1}/${options.files.length}: ${filename}`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`[MergePDFs] File not found, skipping: ${filePath}`);
        continue;
      }

      try {
        // Read the PDF file
        const pdfBytes = fs.readFileSync(filePath);
        
        // Load the PDF document
        const pdf = await PDFDocument.load(pdfBytes);
        
        // Copy all pages from this PDF to the merged PDF
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        // Add each page to the merged document
        pages.forEach((page) => mergedPdf.addPage(page));
        
        console.log(`[MergePDFs] Successfully added ${pages.length} pages from ${filename}`);
      } catch (error) {
        console.error(`[MergePDFs] Error processing ${filename}:`, error);
        return { 
          success: false, 
          message: `Failed to process ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    }

    // Check if we have any pages
    if (mergedPdf.getPageCount() === 0) {
      return { success: false, message: 'No valid PDF pages found to merge' };
    }

    // Generate the output file path
    const outputPath = path.join(currentDirectory, options.outputFilename);
    
    // Check if output file already exists
    if (fs.existsSync(outputPath)) {
      return { success: false, message: `Output file already exists: ${options.outputFilename}` };
    }

    try {
      // Save the merged PDF
      const pdfBytes = await mergedPdf.save();
      fs.writeFileSync(outputPath, pdfBytes);
      
      console.log(`[MergePDFs] Successfully created merged PDF: ${outputPath}`);
      
      return { 
        success: true, 
        message: `Successfully merged ${options.files.length} PDFs into ${options.outputFilename} (${mergedPdf.getPageCount()} pages total)` 
      };
    } catch (error) {
      console.error('[MergePDFs] Error saving merged PDF:', error);
      return { 
        success: false, 
        message: `Failed to save merged PDF: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }

  } catch (error) {
    console.error('[MergePDFs] Unexpected error:', error);
    return { 
      success: false, 
      message: `Merge operation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
} 