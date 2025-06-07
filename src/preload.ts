import { contextBridge } from 'electron';
import { transferFiles } from './main/commands/transfer';
import { getConfig, setConfig } from './main/config';
import { 
  selectDirectory,
  getDirectoryContents,
  renameItem,
  deleteItem,
  createDirectory
} from './main/fileOperations';
import { handleCommand } from './main/commandHandler';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Command handling
  executeCommand: async (command: string, currentDirectory?: string) => {
    return await handleCommand(command, [], currentDirectory);
  },
  
  // Transfer command
  transfer: async (options: { numFiles?: number; newName?: string; command?: string; currentDirectory?: string }) => {
    return await transferFiles(options);
  },
  
  // Config management
  getConfig: async (key: string) => {
    return await getConfig(key);
  },
  setConfig: async (key: string, value: any) => {
    return await setConfig(key, value);
  },
  
  // Directory operations
  selectDirectory: async () => {
    return await selectDirectory();
  },
  getDirectoryContents: async (dirPath: string) => {
    return await getDirectoryContents(dirPath);
  },
  
  // File operations
  renameItem: async (oldPath: string, newPath: string) => {
    return await renameItem(oldPath, newPath);
  },
  deleteItem: async (path: string) => {
    return await deleteItem(path);
  },
  createDirectory: async (path: string) => {
    return await createDirectory(path);
  }
}); 