export interface Config {
  rootPath: string;
  apiKey?: string;
  gstTemplatePath?: string;
  clientbasePath?: string;
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
      console.log('Config loaded:', config);
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