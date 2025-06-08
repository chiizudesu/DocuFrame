import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

export async function extractZips(currentDirectory: string, singleFile?: string): Promise<{ success: boolean; message: string; extractedFiles: string[] }> {
  try {
    console.log('[ExtractZips] Starting extraction in:', currentDirectory);
    
    // Determine which ZIP files to process
    let zipFiles: string[];
    if (singleFile) {
      // Single file extraction
      if (!singleFile.toLowerCase().endsWith('.zip')) {
        return {
          success: false,
          message: 'Selected file is not a ZIP file',
          extractedFiles: []
        };
      }
      if (!fs.existsSync(path.join(currentDirectory, singleFile))) {
        return {
          success: false,
          message: `ZIP file not found: ${singleFile}`,
          extractedFiles: []
        };
      }
      zipFiles = [singleFile];
    } else {
      // Extract all ZIP files in the directory
      const files = fs.readdirSync(currentDirectory);
      zipFiles = files.filter(file => file.toLowerCase().endsWith('.zip'));
      
      if (zipFiles.length === 0) {
        return {
          success: false,
          message: 'No ZIP files found in current directory',
          extractedFiles: []
        };
      }
    }
    
    console.log(`[ExtractZips] Found ${zipFiles.length} ZIP file(s):`, zipFiles);
    
    const extractedFiles: string[] = [];
    const errors: string[] = [];
    
    for (const zipFile of zipFiles) {
      try {
        const zipPath = path.join(currentDirectory, zipFile);
        console.log(`[ExtractZips] Processing: ${zipFile}`);
        
        // Create AdmZip instance
        const zip = new AdmZip(zipPath);
        
        // Get all entries
        const entries = zip.getEntries();
        
        if (entries.length === 0) {
          console.warn(`[ExtractZips] Empty ZIP file: ${zipFile}`);
          continue;
        }
        
        // Extract all files to current directory
        let filesExtracted = 0;
        entries.forEach((entry: any) => {
          if (!entry.isDirectory) {
            try {
              // Get the output path
              const outputPath = path.join(currentDirectory, path.basename(entry.entryName));
              
              // Delete existing file if it exists to avoid permission issues
              if (fs.existsSync(outputPath)) {
                console.log(`[ExtractZips] Overwriting existing file: ${path.basename(entry.entryName)}`);
                try {
                  fs.unlinkSync(outputPath);
                } catch (deleteError) {
                  console.warn(`[ExtractZips] Could not delete existing file, trying to overwrite: ${deleteError}`);
                }
              }
              
              // Extract file content and write it directly
              const fileContent = zip.readFile(entry);
              if (fileContent) {
                fs.writeFileSync(outputPath, fileContent);
                extractedFiles.push(path.basename(entry.entryName));
                filesExtracted++;
                console.log(`[ExtractZips] Extracted: ${path.basename(entry.entryName)}`);
              } else {
                console.error(`[ExtractZips] Failed to read content for ${entry.entryName}`);
                errors.push(`Failed to read content for ${entry.entryName} from ${zipFile}`);
              }
            } catch (error) {
              console.error(`[ExtractZips] Failed to extract ${entry.entryName}:`, error);
              errors.push(`Failed to extract ${entry.entryName} from ${zipFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        });
        
        console.log(`[ExtractZips] Successfully extracted ${filesExtracted} files from ${zipFile}`);
        
      } catch (error) {
        console.error(`[ExtractZips] Error processing ${zipFile}:`, error);
        errors.push(`Failed to process ${zipFile}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Prepare result message
    let message = `Processed ${zipFiles.length} ZIP file(s). `;
    if (extractedFiles.length > 0) {
      message += `Successfully extracted ${extractedFiles.length} file(s).`;
    }
    if (errors.length > 0) {
      message += `\n\nErrors encountered:\n${errors.join('\n')}`;
    }
    
    return {
      success: extractedFiles.length > 0,
      message,
      extractedFiles
    };
    
  } catch (error) {
    console.error('[ExtractZips] Unexpected error:', error);
    return {
      success: false,
      message: `ZIP extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      extractedFiles: []
    };
  }
} 