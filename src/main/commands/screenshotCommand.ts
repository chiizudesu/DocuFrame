import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export async function screenshotCommand(currentDirectory: string, newFilename?: string, preview = false): Promise<{ success: boolean; message: string; files?: any[] }> {
  try {
    // Get the Screenshots directory - make it dynamic based on user
    const screenshotsPath = path.join(app.getPath('pictures'), 'Screenshots');
    
    console.log('[Screenshot] Screenshots path:', screenshotsPath);
    
    // Check if screenshots directory exists
    if (!fs.existsSync(screenshotsPath)) {
      return { 
        success: false, 
        message: `Screenshots directory not found: ${screenshotsPath}` 
      };
    }

    // Get all files in screenshots folder, sorted by mtime desc (most recent first)
    const files = fs.readdirSync(screenshotsPath)
      .map(file => {
        const filePath = path.join(screenshotsPath, file);
        const stats = fs.statSync(filePath);
        return { file, mtime: stats.mtime, stats };
      })
      .filter(f => f.stats.isFile())
      .filter(f => {
        // Filter for common image extensions
        const ext = path.extname(f.file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext);
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      return { 
        success: false, 
        message: 'No screenshot files found in Screenshots folder' 
      };
    }

    // Get the most recent screenshot
    const mostRecentFile = files[0];
    const srcPath = path.join(screenshotsPath, mostRecentFile.file);
    
    // Determine destination filename
    let destFilename: string;
    if (newFilename) {
      // Use provided filename, preserving original extension if not provided
      const originalExt = path.extname(mostRecentFile.file);
      const newExt = path.extname(newFilename);
      destFilename = newExt ? newFilename : newFilename + originalExt;
    } else {
      // Use original filename
      destFilename = mostRecentFile.file;
    }
    
    const destPath = path.join(currentDirectory, destFilename);
    
    // If preview mode, return file information for preview pane with image data
    if (preview) {
      let imageDataUrl = '';
      try {
        // Read the image file and convert to base64 data URL
        const fileBuffer = fs.readFileSync(srcPath);
        const ext = path.extname(mostRecentFile.file).toLowerCase();
        
        // Determine MIME type based on file extension
        let mimeType = 'image/png'; // default
        switch (ext) {
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.png':
            mimeType = 'image/png';
            break;
          case '.gif':
            mimeType = 'image/gif';
            break;
          case '.bmp':
            mimeType = 'image/bmp';
            break;
          case '.webp':
            mimeType = 'image/webp';
            break;
        }
        
        const base64Data = fileBuffer.toString('base64');
        imageDataUrl = `data:${mimeType};base64,${base64Data}`;
      } catch (error) {
        console.error('[Screenshot] Error reading image for preview:', error);
        // Continue without image data
      }
      
      return {
        success: true,
        message: `Preview: Screenshot to transfer`,
        files: [{
          name: destFilename,
          originalName: mostRecentFile.file,
          type: 'image' as const,
          path: srcPath,
          size: mostRecentFile.stats.size.toString(),
          modified: mostRecentFile.mtime.toISOString(),
          preview: true,
          imageData: imageDataUrl
        }]
      };
    }
    
    console.log(`[Screenshot] Transferring ${mostRecentFile.file} to ${destPath}`);

    // Check if destination directory exists
    if (!fs.existsSync(currentDirectory)) {
      return { 
        success: false, 
        message: `Target directory does not exist: ${currentDirectory}` 
      };
    }

    // Check if destination file already exists
    if (fs.existsSync(destPath)) {
      return { 
        success: false, 
        message: `File already exists at destination: ${destPath}` 
      };
    }

    // Copy the file
    fs.copyFileSync(srcPath, destPath);
    
    // Verify the copy was successful
    if (!fs.existsSync(destPath)) {
      return { 
        success: false, 
        message: 'File copy failed - destination file not found after copy' 
      };
    }

    return {
      success: true,
      message: `Successfully transferred screenshot: ${mostRecentFile.file} → ${destFilename}`
    };

  } catch (error) {
    console.error('[Screenshot] Error:', error);
    return {
      success: false,
      message: `Screenshot transfer failed: ${(error as Error).message}`
    };
  }
} 