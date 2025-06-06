import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const CONFIG_FILE = 'config.json';

interface Settings {
  rootPath: string;
  apiKey?: string;
  transferCommandMappings: {
    [key: string]: string;  // command -> filename template
  };
}

let configCache: { [key: string]: any } = {};

export async function getConfig(key: string): Promise<any> {
  try {
    // Return from cache if available
    if (configCache[key] !== undefined) {
      return configCache[key];
    }

    // Load config file
    const configPath = path.join(app.getPath('userData'), CONFIG_FILE);
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    configCache = config;
    return config[key];
  } catch (error) {
    console.error('Error reading config:', error);
    return null;
  }
}

export async function setConfig(key: string, value: any): Promise<void> {
  try {
    // Update cache
    configCache[key] = value;

    // Load existing config
    const configPath = path.join(app.getPath('userData'), CONFIG_FILE);
    let config: { [key: string]: any } = {};
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    // Update config
    config[key] = value;

    // Save to file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
} 