import * as fs from 'fs';
import * as path from 'path';
import { app, BrowserWindow } from 'electron';

interface ScreenshotResult {
  success: boolean;
  message: string;
  files: Array<{
    name: string;
    originalName: string;
    type: string;
    path: string;
    size?: string;
    modified: string;
  }>;
}

export async function screenshotCommand(currentDirectory: string, preview: boolean = false, newName?: string): Promise<ScreenshotResult> {
  console.log(`[Screenshot] ${preview ? 'Previewing' : 'Processing'} screenshot command in directory:`, currentDirectory, 'newName:', newName);
  
  try {
    // Get screenshots folder path (typically Pictures/Screenshots on Windows)
    const userDataPath = app.getPath('userData');
    const picturesPath = app.getPath('pictures');
    const possibleScreenshotPaths = [
      path.join(picturesPath, 'Screenshots'),
      path.join(app.getPath('home'), 'Desktop'),
      path.join(app.getPath('home'), 'Pictures', 'Screenshots'),
      path.join(app.getPath('downloads'))
    ];

    let screenshotPath = '';
    let screenshotFiles: string[] = [];

    // Find the screenshot directory with the most recent screenshots
    for (const screenshotDir of possibleScreenshotPaths) {
      if (fs.existsSync(screenshotDir)) {
        try {
          const files = fs.readdirSync(screenshotDir)
            .filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext);
            })
            .map(file => ({
              name: file,
              path: path.join(screenshotDir, file),
              mtime: fs.statSync(path.join(screenshotDir, file)).mtime
            }))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

          if (files.length > 0) {
            screenshotPath = screenshotDir;
            // Always transfer only the most recent screenshot
            screenshotFiles = files.slice(0, 1).map(f => f.name);
            break;
          }
        } catch (error) {
          console.warn(`[Screenshot] Could not read directory ${screenshotDir}:`, error);
          continue;
        }
      }
    }

    if (!screenshotPath || screenshotFiles.length === 0) {
      return {
        success: false,
        message: 'No recent screenshots found. Please take a screenshot first.',
        files: []
      };
    }

    const resultFiles: Array<{
      name: string;
      originalName: string;
      type: string;
      path: string;
      size?: string;
      modified: string;
      sourcePath?: string; // Add source path for image previews
      imageDataUrl?: string; // Add imageDataUrl for preview
    }> = [];

    if (preview) {
      // Preview mode: show what would be transferred
      for (const filename of screenshotFiles) {
        const sourcePath = path.join(screenshotPath, filename);
        let targetFilename = filename;
        
        // If newName is provided, use it with the original extension
        if (newName && screenshotFiles.length === 1) {
          const originalExt = path.extname(filename);
          targetFilename = newName.endsWith(originalExt) ? newName : `${newName}${originalExt}`;
        }
        
        const targetPath = path.join(currentDirectory, targetFilename);
        
        try {
          const stats = fs.statSync(sourcePath);
          
          // Convert image to base64 for preview (only in preview mode)
          let imageDataUrl: string | undefined;
          try {
            const imageBuffer = fs.readFileSync(sourcePath);
            const ext = path.extname(filename).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 
                           ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                           ext === '.gif' ? 'image/gif' :
                           ext === '.bmp' ? 'image/bmp' : 'image/png';
            imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
          } catch (imageError) {
            console.warn(`[Screenshot] Could not read image file ${sourcePath}:`, imageError);
          }
          
          resultFiles.push({
            name: targetFilename,
            originalName: filename,
            type: 'image',
            path: targetPath,
            sourcePath: sourcePath, // Keep for reference
            imageDataUrl: imageDataUrl, // Add base64 data URL for preview
            size: (stats.size / 1024).toFixed(1) + ' KB',
            modified: stats.mtime.toISOString()
          });
        } catch (error) {
          console.warn(`[Screenshot] Could not stat file ${sourcePath}:`, error);
        }
      }

      const previewMessage = newName 
        ? `Preview: Screenshot will be transferred and renamed to "${resultFiles[0]?.name}" from ${screenshotPath}`
        : `Preview: Most recent screenshot will be transferred from ${screenshotPath}`;

      return {
        success: true,
        message: previewMessage,
        files: resultFiles
      };
    } else {
      // Actual transfer mode
      let transferred = 0;
      const errors: string[] = [];

      for (const filename of screenshotFiles) {
        const sourcePath = path.join(screenshotPath, filename);
        let targetFilename = filename;
        
        // If newName is provided, use it with the original extension
        if (newName && screenshotFiles.length === 1) {
          const originalExt = path.extname(filename);
          targetFilename = newName.endsWith(originalExt) ? newName : `${newName}${originalExt}`;
        }
        
        const targetPath = path.join(currentDirectory, targetFilename);

        try {
          // Copy the file (overwrite if exists)
          fs.copyFileSync(sourcePath, targetPath);
          
          const stats = fs.statSync(targetPath);
          resultFiles.push({
            name: targetFilename,
            originalName: filename,
            type: 'image',
            path: targetPath,
            size: (stats.size / 1024).toFixed(1) + ' KB',
            modified: stats.mtime.toISOString()
          });

          transferred++;
          console.log(`[Screenshot] Transferred: ${filename} -> ${targetFilename}`);
        } catch (error) {
          const errorMsg = `Failed to transfer ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`[Screenshot] ${errorMsg}`);
        }
      }

      let message = newName 
        ? `Successfully transferred screenshot as "${resultFiles[0]?.name}" from ${screenshotPath}`
        : `Successfully transferred most recent screenshot from ${screenshotPath}`;
        
      if (errors.length > 0) {
        message += `\n\nErrors:\n${errors.join('\n')}`;
      }

      // Emit folder refresh event if any files were transferred successfully
      if (transferred > 0) {
        const mainWindow = BrowserWindow.getFocusedWindow();
        if (mainWindow) {
          const transferredFilePaths = resultFiles.map(file => file.path);
          mainWindow.webContents.send('folderContentsChanged', { 
            directory: currentDirectory,
            newFiles: transferredFilePaths // Include info about new files
          });
          console.log(`[Screenshot] Triggered folder refresh for directory: ${currentDirectory}`);
          console.log(`[Screenshot] New files transferred: ${transferredFilePaths.join(', ')}`);
        }
      }

      return {
        success: transferred > 0,
        message,
        files: resultFiles
      };
    }

  } catch (error) {
    console.error('[Screenshot] Error processing screenshots:', error);
    return {
      success: false,
      message: `Error processing screenshots: ${error instanceof Error ? error.message : 'Unknown error'}`,
      files: []
    };
  }
} 