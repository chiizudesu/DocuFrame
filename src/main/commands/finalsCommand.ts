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

    let files: string[] = [];
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

    // Re-read directory contents after first pass for accurate file processing
    if (!preview) {
      files = [];
      const updatedDirContents = fs.readdirSync(currentDirectory);
      for (const item of updatedDirContents) {
        const filePath = path.join(currentDirectory, item);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          files.push(filePath);
        }
      }
    }

    // Second pass: identify financial statements and minutes
    for (const filePath of files) {
      const filename = path.basename(filePath);
      if (!filename.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      // Skip files that contain IR codes (already processed in first pass)
      if (filename.includes("IR3") || filename.includes("IR4") || filename.includes("IR6") || filename.includes("IR7") || filename.includes("IR526")) {
        continue;
      }

      const base = path.parse(filename).name;
      // Remove duplicate indicators like (1), (2), etc.
      let baseClean = base.replace(/\s*\(\d+\)/g, '');

      // Handle underscore format: "Entity_-_Document" or "Entity_Document"
      let entityMatch = baseClean.match(/^(.*?)_-_(.*)$/);
      if (!entityMatch) {
        // Try alternative pattern: "Entity_Document"
        entityMatch = baseClean.match(/^(.*?)_(.*)$/);
      }

      if (entityMatch) {
        let rawEntityName = entityMatch[1].trim();
        let documentType = entityMatch[2].trim();

        // Normalize entity name: replace underscores with spaces and fix apostrophes
        let normalizedEntityName = rawEntityName
          .replace(/_s_/g, "'s ")  // Convert _s_ to 's 
          .replace(/_/g, ' ')      // Convert remaining underscores to spaces
          .replace(/\s+/g, ' ')    // Clean up multiple spaces
          .trim();

        // Find matching entity from first pass
        let matchedEntityKey = null;
        let matchedEntityData = null;

        // Try exact match first
        if (entities[normalizedEntityName]) {
          matchedEntityKey = normalizedEntityName;
          matchedEntityData = entities[normalizedEntityName];
        } else {
          // Try fuzzy matching - look for entities that contain similar words
          for (const [entityKey, entityData] of Object.entries(entities)) {
            // Simple fuzzy matching: check if key words match
            const normalizedWords = normalizedEntityName.toLowerCase().split(' ').filter(w => w.length > 2);
            const entityWords = entityKey.toLowerCase().split(' ').filter(w => w.length > 2);
            
            const matchCount = normalizedWords.filter(word => 
              entityWords.some(entityWord => entityWord.includes(word) || word.includes(entityWord))
            ).length;

            // If most words match, consider it a match
            if (matchCount >= Math.min(normalizedWords.length, entityWords.length) * 0.7) {
              matchedEntityKey = entityKey;
              matchedEntityData = entityData;
              break;
            }
          }
        }

        if (matchedEntityData) {
          const year = matchedEntityData.Year;
          let suffix: string;

          if (documentType.toLowerCase().includes("financial") && documentType.toLowerCase().includes("statements")) {
            suffix = "Financial Statements";
          } else if (documentType.toLowerCase().includes("minutes")) {
            suffix = "Annual Minutes";
          } else if (documentType.toLowerCase().includes("profit") && documentType.toLowerCase().includes("loss")) {
            suffix = "Statement of Profit and Loss";
          } else {
            continue;
          }

          const newName = `${matchedEntityKey} - ${year} ${suffix}.pdf`;
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