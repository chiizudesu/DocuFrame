import { shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config';

interface GSTTemplateResult {
  success: boolean;
  message: string;
}

export async function gstTemplate(directory: string): Promise<GSTTemplateResult> {
  console.log('[GSTTemplate] Starting GST template opening');
  
  try {
    // Get GST template path from config
    const gstTemplatePath = await getConfig('gstTemplatePath');
    
    if (!gstTemplatePath) {
      return {
        success: false,
        message: 'GST template path not configured. Please set the template path in Settings.'
      };
    }
    
    // Check if file exists
    if (!fs.existsSync(gstTemplatePath)) {
      return {
        success: false,
        message: `GST template file not found: ${gstTemplatePath}. Please check the file path in Settings.`
      };
    }
    
    console.log(`[GSTTemplate] Opening template: ${gstTemplatePath}`);
    
    // Open the file with the default application
    await shell.openPath(gstTemplatePath);
    
    return {
      success: true,
      message: `GST template opened: ${path.basename(gstTemplatePath)}`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GSTTemplate] Error:', errorMessage);
    
    return {
      success: false,
      message: `Failed to open GST template: ${errorMessage}`
    };
  }
} 