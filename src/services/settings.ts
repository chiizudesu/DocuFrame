import { configService } from './config';

// Define the settings interface
export interface AppSettings {
  rootPath: string;
  apiKey?: string;
}

class SettingsService {
  private static instance: SettingsService;
  private settings: AppSettings | null = null;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async getSettings(): Promise<AppSettings> {
    try {
      if (!this.settings) {
        this.settings = await (window.electronAPI as any).getConfig();
      }
      return this.settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  async setSettings(settings: AppSettings): Promise<void> {
    try {
      await (window.electronAPI as any).setConfig(settings);
      this.settings = settings;
    } catch (error) {
      console.error('Error setting settings:', error);
      throw error;
    }
  }

  async getRootPath(): Promise<string> {
    try {
      const settings = await this.getSettings();
      return settings.rootPath;
    } catch (error) {
      console.error('Error getting root path:', error);
      throw error;
    }
  }

  async setRootPath(path: string): Promise<void> {
    try {
      const settings = await this.getSettings();
      await this.setSettings({ ...settings, rootPath: path });
    } catch (error) {
      console.error('Error setting root path:', error);
      throw error;
    }
  }
}

export const settingsService = SettingsService.getInstance(); 