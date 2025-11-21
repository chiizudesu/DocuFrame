// Define the settings interface
export interface AppSettings {
  rootPath: string;
  apiKey?: string;
  claudeApiKey?: string;
  gstTemplatePath?: string;
  clientbasePath?: string;
  templateFolderPath?: string;
  workpaperTemplateFolderPath?: string;
  showOutputLog?: boolean;
  activationShortcut?: string;
  enableActivationShortcut?: boolean;
  calculatorShortcut?: string;
  enableCalculatorShortcut?: boolean;
  newTabShortcut?: string;
  enableNewTabShortcut?: boolean;
  closeTabShortcut?: string;
  enableCloseTabShortcut?: boolean;
  enableFileWatching?: boolean;
  clientSearchShortcut?: string;
  enableClientSearchShortcut?: boolean;
  sidebarCollapsedByDefault?: boolean;
  hideTemporaryFiles?: boolean;
  hideDotFiles?: boolean;
  aiEditorInstructions?: string;
  aiEditorAgent?: 'openai' | 'claude';
  quickAccessPaths?: string[];
  workShiftStart?: string; // Format: "HH:MM" (24-hour)
  workShiftEnd?: string; // Format: "HH:MM" (24-hour)
  productivityTargetHours?: number; // Target hours per day (e.g., 7.5 for 7:30)

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
        const config = await (window.electronAPI as any).getConfig();
        this.settings = config || { rootPath: '' };
      }
      return this.settings || { rootPath: '' };
    } catch (error) {
      console.error('Error getting settings:', error);
      // Return default settings if there's an error
      return { rootPath: '' };
    }
  }

  async setSettings(settings: AppSettings): Promise<void> {
    try {
      // Always merge with existing config to avoid overwriting unrelated fields
      const currentConfig = await (window.electronAPI as any).getConfig();
      const mergedConfig = { ...currentConfig, ...settings };
      await (window.electronAPI as any).setConfig(mergedConfig);
      this.settings = mergedConfig;
    } catch (error) {
      console.error('Error setting settings:', error);
      throw error;
    }
  }

  // Clear cached settings to force reload
  clearCache(): void {
    this.settings = null;
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

  async getTemplateFolderPath(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.templateFolderPath;
  }

  async setTemplateFolderPath(path: string): Promise<void> {
    const settings = await this.getSettings();
    await this.setSettings({ ...settings, templateFolderPath: path });
  }

  async getWorkpaperTemplateFolderPath(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings.workpaperTemplateFolderPath;
  }

  async setWorkpaperTemplateFolderPath(path: string): Promise<void> {
    const settings = await this.getSettings();
    await this.setSettings({ ...settings, workpaperTemplateFolderPath: path });
  }
}

export const settingsService = SettingsService.getInstance(); 