export interface Config {
  rootPath: string;
  apiKey?: string;
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
      const config = await window.electron.getConfig();
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
      await window.electron.setConfig(config);
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
      await window.electron.setConfig({ ...this.config, rootPath });
      this.config.rootPath = rootPath;
    } catch (error) {
      console.error('Error setting root path:', error);
      throw error;
    }
  }
}

export const configService = new ConfigService(); 