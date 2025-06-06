// 1. Main Process (main.js or main.ts) - Add IPC handlers
import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// IPC handler to read directory contents
ipcMain.handle('read-directory', async (event, dirPath: string) => {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const folderItems = items.map(item => {
      const fullPath = path.join(dirPath, item.name);
      let stats;
      
      try {
        stats = fs.statSync(fullPath);
      } catch (error) {
        // Handle permission errors or other issues
        return null;
      }
      
      return {
        id: fullPath, // Use full path as unique ID
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        path: fullPath,
        size: stats?.size || 0,
        modified: stats?.mtime || new Date(),
        isHidden: item.name.startsWith('.'), // Unix/Linux hidden files
        extension: item.isFile() ? path.extname(item.name) : null
      };
    }).filter(item => item !== null);
    
    // Sort: folders first, then files, both alphabetically
    folderItems.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    
    return folderItems;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read directory: ${errorMessage}`);
  }
});

// IPC handler to check if path exists and is accessible
ipcMain.handle('check-path', async (event, dirPath: string) => {
  try {
    const stats = fs.statSync(dirPath);
    return {
      exists: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      readable: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      exists: false,
      isDirectory: false,
      isFile: false,
      readable: false,
      error: errorMessage
    };
  }
});

// Get user's home directory
ipcMain.handle('get-home-directory', async () => {
  return require('os').homedir();
});

// Get system root directories (drives on Windows)
ipcMain.handle('get-root-directories', async () => {
  const os = require('os');
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows: Get all drives
    const drives = [];
    for (let i = 65; i <= 90; i++) { // A-Z
      const drive = String.fromCharCode(i) + ':\\';
      try {
        fs.accessSync(drive);
        drives.push({
          id: drive,
          name: `${String.fromCharCode(i)}: Drive`,
          type: 'folder',
          path: drive
        });
      } catch (error) {
        // Drive doesn't exist or isn't accessible
      }
    }
    return drives;
  } else {
    // Unix/Linux/Mac: Start from root
    return [{
      id: '/',
      name: 'Root',
      type: 'folder',
      path: '/'
    }];
  }
});

// 2. Renderer Process (Your React Component) - Updated FolderNavigation
import React, { useState, useEffect } from 'react';
import { Box, Text, Icon, Flex, useColorModeValue, Spinner, Alert, AlertIcon } from '@chakra-ui/react';
import { FolderOpen, File, ChevronRight, ChevronDown, Home, HardDrive } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  size?: number;
  modified?: Date;
  isHidden?: boolean;
  extension?: string | null;
}

export const FolderNavigation: React.FC = () => {
  const { setCurrentDirectory, addLog } = useAppContext();
  const borderColor = useColorModeValue('gray.600', 'gray.700');
  
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Initialize with home directory
  useEffect(() => {
    const initializeHome = async () => {
      try {
        const homeDir = await window.electronAPI.getHomeDirectory();
        await loadDirectory(homeDir);
      } catch (error) {
        console.error('Failed to load home directory:', error);
        // Fallback to root directories
        await loadRootDirectories();
      }
    };
    
    initializeHome();
  }, []);

  const loadRootDirectories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const roots = await window.electronAPI.getRootDirectories();
      setItems(roots);
      setCurrentPath('');
      setCurrentDirectory('Computer');
      addLog('Showing root directories');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load root directories: ${errorMessage}`);
      addLog(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if path is accessible
      const pathInfo = await window.electronAPI.checkPath(dirPath);
      if (!pathInfo.exists || !pathInfo.isDirectory) {
        throw new Error(`Path is not a valid directory: ${dirPath}`);
      }

      const directoryItems = await window.electronAPI.readDirectory(dirPath);
      
      // Filter hidden files if needed
      const filteredItems = showHidden 
        ? directoryItems 
        : directoryItems.filter(item => !item.isHidden);
      
      setItems(filteredItems);
      setCurrentPath(dirPath);
      setCurrentDirectory(dirPath);
      addLog(`Loaded directory: ${dirPath} (${filteredItems.length} items)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load directory: ${errorMessage}`);
      addLog(`Error loading ${dirPath}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: FileItem) => {
    if (item.type === 'folder') {
      await loadDirectory(item.path);
    } else {
      addLog(`Selected file: ${item.path}`);
      // You can add file opening logic here
      // await window.electronAPI.openFile(item.path);
    }
  };

  const goToParentDirectory = async () => {
    if (!currentPath) {
      return;
    }
    
    const parentPath = require('path').dirname(currentPath);
    if (parentPath === currentPath) {
      // We're at root, show root directories
      await loadRootDirectories();
    } else {
      await loadDirectory(parentPath);
    }
  };

  const goHome = async () => {
    try {
      const homeDir = await window.electronAPI.getHomeDirectory();
      await loadDirectory(homeDir);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to go home: ${errorMessage}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') {
      return FolderOpen;
    }
    
    // You can add more specific file type icons based on extension
    return File;
  };

  const renderItem = (item: FileItem) => {
    const IconComponent = getFileIcon(item);
    
    return (
      <Flex
        key={item.id}
        align="center"
        py={2}
        px={3}
        cursor="pointer"
        _hover={{
          bg: useColorModeValue('gray.100', 'gray.700')
        }}
        borderRadius="md"
        onClick={() => handleItemClick(item)}
      >
        <Icon
          as={IconComponent}
          color={item.type === 'folder' ? 'blue.500' : useColorModeValue('gray.600', 'gray.400')}
          boxSize={4}
          mr={3}
        />
        <Box flex="1" minW="0">
          <Text
            fontSize="sm"
            noOfLines={1}
            color={useColorModeValue('gray.800', 'white')}
          >
            {item.name}
          </Text>
          {item.type === 'file' && item.size !== undefined && (
            <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
              {formatFileSize(item.size)}
            </Text>
          )}
        </Box>
      </Flex>
    );
  };

  return (
    <Box h="100%" display="flex" flexDirection="column">
      {/* Navigation Bar */}
      <Flex
        p={2}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        gap={2}
      >
        <Icon
          as={Home}
          boxSize={4}
          cursor="pointer"
          onClick={goHome}
          color="blue.500"
          _hover={{ color: 'blue.600' }}
        />
        <Icon
          as={HardDrive}
          boxSize={4}
          cursor="pointer"
          onClick={loadRootDirectories}
          color="blue.500"
          _hover={{ color: 'blue.600' }}
        />
        {currentPath && (
          <Text
            fontSize="xs"
            cursor="pointer"
            onClick={goToParentDirectory}
            color="blue.500"
            _hover={{ textDecoration: 'underline' }}
          >
            ← Parent
          </Text>
        )}
        <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} flex="1" noOfLines={1}>
          {currentPath || 'Computer'}
        </Text>
      </Flex>

      {/* Content Area */}
      <Box flex="1" overflowY="auto" p={2}>
        {loading && (
          <Flex justify="center" align="center" h="100px">
            <Spinner size="md" />
          </Flex>
        )}
        
        {error && (
          <Alert status="error" mb={3}>
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        {!loading && !error && items.length === 0 && (
          <Text color={useColorModeValue('gray.500', 'gray.400')} textAlign="center" mt={8}>
            This folder is empty
          </Text>
        )}
        
        {!loading && items.map(renderItem)}
      </Box>
    </Box>
  );
};

// 3. Preload Script (preload.js) - Expose APIs to renderer
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  checkPath: (dirPath: string) => ipcRenderer.invoke('check-path', dirPath),
  getHomeDirectory: () => ipcRenderer.invoke('get-home-directory'),
  getRootDirectories: () => ipcRenderer.invoke('get-root-directories'),
  // Add more file operations as needed
  // openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
});

// 4. TypeScript declarations (if using TypeScript)
// Create a file: src/types/electron.d.ts
declare global {
  interface Window {
    electronAPI: {
      readDirectory: (dirPath: string) => Promise<FileItem[]>;
      checkPath: (dirPath: string) => Promise<{
        exists: boolean;
        isDirectory: boolean;
        isFile: boolean;
        readable: boolean;
        error?: string;
      }>;
      getHomeDirectory: () => Promise<string>;
      getRootDirectories: () => Promise<FileItem[]>;
    };
  }
}