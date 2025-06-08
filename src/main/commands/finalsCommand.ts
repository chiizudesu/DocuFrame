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

interface FinalsResult {
  success: boolean;
  message: string;
  renamedCount: number;
  files: FileItem[];
}

export async function finalsCommand(currentDirectory: string, preview: boolean = false): Promise<FinalsResult> {
  console.log(`[Finals] ${preview ? 'Previewing' : 'Processing'} files in directory:`, currentDirectory);
  
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

    // Tax type mappings
    const taxTypeMap: { [key: string]: string } = {
      "IR3": "Individual Tax Return",
      "IR4": "Company Tax Return", 
      "IR6": "Trust Tax Return",
      "IR526": "Donation Tax Rebate",
      "IR7": "LTC Tax Return"
    };

    const files: string[] = [];
    const entities: { [key: string]: { Year: string; Type: string; Desc: string } } = {};
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

    // First pass: identify entities and tax types, process tax returns
    for (const filePath of files) {
      const filename = path.basename(filePath);
      if (!filename.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      // Remove duplicate indicators like (1), (2), etc.
      const cleanName = filename.replace(/\s*\(\d+\)/g, '');

      // Try different patterns to match tax returns
      const pattern1 = /^(.*?)-\s*(\d{4})\s*-\s*(IR\d{1,4})\.pdf$/;
      const pattern2 = /^(.*?)-\s*(\d{4})\s*(IR\d{1,4})\s/;

      let match = cleanName.match(pattern1) || cleanName.match(pattern2);
      
      if (!match) continue;

      const [, name, year, formCode] = match;

      if (!taxTypeMap[formCode]) continue;

      const desc = taxTypeMap[formCode];
      entities[name.trim()] = { Year: year, Type: formCode, Desc: desc };

      // Process tax returns if not already in standard format
      if (filename.includes(formCode) && !filename.includes(`${formCode} ${desc}`)) {
        const newName = `${name.trim()} - ${year} ${formCode} ${desc}.pdf`;
        const newPath = path.join(currentDirectory, newName);

        if (filename !== newName) {
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
            console.log(`[Finals] Preview: ${filename} → ${newName}`);
          } else {
            // Actual rename mode
            try {
              fs.renameSync(filePath, newPath);
              console.log(`[Finals] Renamed: ${filename} → ${newName}`);
              renamedCount++;
            } catch (error) {
              console.error(`[Finals] Error renaming '${filename}':`, error);
            }
          }
        }
      }
    }

    // Second pass: identify financial statements and minutes
    for (const filePath of files) {
      // Skip files that were renamed in the first pass (only in non-preview mode)
      if (!preview && !fs.existsSync(filePath)) {
        continue;
      }

      const filename = path.basename(filePath);
      if (!filename.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      const base = path.parse(filename).name;
      let baseClean = base.replace(/\s*\(\d+\)/g, '').replace(/_/g, ' ');
      baseClean = baseClean.replace(/\s+/g, ' ');

      const entityMatch = baseClean.match(/^(.*?) - /);
      if (entityMatch && !filename.includes("IR")) {
        const key = entityMatch[1].trim();

        if (entities[key]) {
          const year = entities[key].Year;
          let suffix: string;

          if (baseClean.includes("Financial Statements")) {
            suffix = "Financial Statements";
          } else if (baseClean.includes("Minutes")) {
            suffix = "Annual Minutes";
          } else if (baseClean.includes("Profit and Loss")) {
            suffix = "Statement of Profit and Loss";
          } else {
            continue;
          }

          const newName = `${key} - ${year} ${suffix}.pdf`;
          const newPath = path.join(currentDirectory, newName);

          if (filename !== newName) {
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
              console.log(`[Finals] Preview: ${filename} → ${newName}`);
            } else {
              // Actual rename mode
              try {
                fs.renameSync(filePath, newPath);
                console.log(`[Finals] Renamed: ${filename} → ${newName}`);
                renamedCount++;
              } catch (error) {
                console.error(`[Finals] Error renaming '${filename}':`, error);
              }
            }
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
        name: "No tax return files found to rename",
        originalName: "Looking for files matching patterns like: Entity-YYYY-IR3.pdf, Entity-Financial Statements.pdf",
        type: "info",
        path: currentDirectory,
        size: "-",
        modified: new Date().toISOString()
      });
    }

    let message: string;
    if (preview) {
      message = renamedCount > 0 
        ? `Preview: ${renamedCount} files will be renamed.`
        : "No files match the tax return renaming patterns.";
    } else {
      message = renamedCount > 0 
        ? `Renamed ${renamedCount} files successfully.`
        : "No files matched the renaming patterns.";
    }

    return {
      success: true,
      message,
      renamedCount,
      files: resultFiles
    };

  } catch (error) {
    console.error('[Finals] Error processing files:', error);
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