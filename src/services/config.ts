export interface Config {
  rootPath: string;
  gstTemplatePath?: string;
  clientbasePath?: string;
  workpaperTemplateFolderPath?: string;
  activationShortcut?: string;
  enableActivationShortcut?: boolean;
  calculatorShortcut?: string;
  enableCalculatorShortcut?: boolean;
  newTabShortcut?: string;
  enableNewTabShortcut?: boolean;
  closeTabShortcut?: string;
  enableCloseTabShortcut?: boolean;
  clientSearchShortcut?: string;
  enableClientSearchShortcut?: boolean;
  jumpModeShortcut?: string;
  enableJumpModeShortcut?: boolean;
  jumpModeOnParentShortcut?: string;
  enableJumpModeOnParentShortcut?: boolean;
  backspaceNavigationShortcut?: string;
  enableBackspaceNavigationShortcut?: boolean;
  sidebarCollapsedByDefault?: boolean;
  hideTemporaryFiles?: boolean;
  /** Show the git status indicator in the footer. Default on for existing configs; off for fresh installs. */
  showGitStatus?: boolean;
  quickAccessPaths?: string[];
  /** Localhost HTTP bridge for Chrome extension PDF capture (127.0.0.1 only). */
  chromeExtensionBridgeEnabled?: boolean;
  chromeExtensionBridgePort?: number;
  chromeExtensionBridgeSecret?: string;

}

class ConfigService {
  private config: Config = {
    rootPath: ''
  };

  constructor() {
    // Initialize config by getting it from main process
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await (window.electronAPI as any).getConfig();
      this.config = config;
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  getConfig(): Config {
    return this.config;
  }

  async setConfig(config: Config): Promise<void> {
    try {
      await (window.electronAPI as any).setConfig(config);
      this.config = config;
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  getRootPath(): string {
    return this.config.rootPath;
  }

  async setRootPath(rootPath: string): Promise<void> {
    try {
      await (window.electronAPI as any).setConfig({ ...this.config, rootPath });
      this.config.rootPath = rootPath;
    } catch (error) {
      console.error('Error setting root path:', error);
      throw error;
    }
  }
}

export const configService = new ConfigService(); 