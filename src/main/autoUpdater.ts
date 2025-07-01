import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

class AutoUpdaterService {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    // Configure logging
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // Configure auto-updater for GitHub releases
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'chiizudesu',
      repo: 'DocuFrame',
      private: true,
      token: process.env.GH_TOKEN
    });

    // Configure auto-updater
    this.setupAutoUpdater();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private setupAutoUpdater() {
    // Check for updates on app start (optional, can be disabled)
    // autoUpdater.checkForUpdatesAndNotify();

    // Update downloaded
    autoUpdater.on('update-downloaded', () => {
      if (this.mainWindow) {
        // Notify renderer process
        this.mainWindow.webContents.send('update-downloaded');
      }
      
      // Show dialog to user
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully. Restart the application to apply the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      if (this.mainWindow) {
        // Notify renderer process
        this.mainWindow.webContents.send('update-available');
      }
      
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. It will be downloaded in the background.`,
        buttons: ['OK']
      });
    });

    // No update available
    autoUpdater.on('update-not-available', (info) => {
      console.log('No update available:', info);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-not-available');
      }
    });

    // Error occurred
    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-error', error.message);
      }
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      console.log('Download progress:', progressObj);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-progress', progressObj);
      }
    });

    // Checking for updates
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
    });
  }

  // Method to manually check for updates
  checkForUpdates() {
    console.log('Manual update check initiated');
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Method to quit and install update
  quitAndInstall() {
    console.log('Quitting and installing update');
    autoUpdater.quitAndInstall();
  }
}

export const autoUpdaterService = new AutoUpdaterService(); 