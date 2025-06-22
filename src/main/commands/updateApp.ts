// Update command - uses electron-updater for manual update checks
import { autoUpdaterService } from '../autoUpdater';

interface UpdateResult {
  success: boolean;
  message: string;
}

export async function updateApp(_directory: string): Promise<UpdateResult> {
  console.log('[UpdateApp] Manual update check requested');
  
  try {
    // Use the autoUpdater service to check for updates
    autoUpdaterService.checkForUpdates();
    
    return {
      success: true,
      message: 'Update check initiated. You will be notified if an update is available.'
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[UpdateApp] Error:', errorMessage);
    
    return {
      success: false,
      message: `Update check failed: ${errorMessage}`
    };
  }
} 