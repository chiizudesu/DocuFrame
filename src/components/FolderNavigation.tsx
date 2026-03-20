import React, { useState, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Text, Icon, Flex, Spinner, Alert } from '@chakra-ui/react';
import { FolderOpen, File, Home, HardDrive } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { joinPath } from '../utils/path';
import type { FileItem } from '../types';

/** Directory listing row (preload may include extra fields). */
type NavFileItem = FileItem & { isHidden?: boolean; size?: string | number; modified?: string | Date };

// Utility to format paths for logging (Windows vs others)
function formatPathForLog(path: string) {
  const isWindows = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win');
  return isWindows ? path.replace(/\//g, '\\') : path;
}

export const FolderNavigation: React.FC = () => {
  const { setCurrentDirectory, addLog } = useAppContext();
  const borderColor = useColorModeValue('gray.600', 'gray.700');
  
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<NavFileItem[]>([]);
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
      setItems(roots as NavFileItem[]);
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
        : directoryItems.filter((item) => !item.isHidden);

      setItems(filteredItems as NavFileItem[]);
      setCurrentPath(dirPath);
      setCurrentDirectory(dirPath);
      addLog(`Loaded directory: ${formatPathForLog(dirPath)} (${filteredItems.length} items)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load directory: ${errorMessage}`);
      addLog(`Error loading ${dirPath}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: NavFileItem) => {
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
    const parentPath = joinPath(...currentPath.split(/[\\/]/).filter(Boolean).slice(0, -1))
    if (!parentPath) {
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

  const getFileIcon = (item: NavFileItem) => {
    if (item.type === 'folder') {
      return FolderOpen;
    }
    
    // You can add more specific file type icons based on extension
    return File;
  };

  const renderItem = (item: NavFileItem) => {
    const IconComponent = getFileIcon(item);
    
    return (
      <Flex
        key={item.path}
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
          color={item.type === 'folder' ? 'blue.500' : useColorModeValue('gray.600', 'gray.400')}
          boxSize={4}
          mr={3}
          asChild><IconComponent /></Icon>
        <Box flex="1" minW="0">
          <Text
            fontSize="sm"
            lineClamp={1}
            color={useColorModeValue('gray.800', 'white')}
          >
            {item.name}
          </Text>
          {item.type === 'file' && item.size !== undefined && (
            <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
              {typeof item.size === 'number' ? formatFileSize(item.size) : String(item.size)}
            </Text>
          )}
          {item.modified && (
            <Text fontSize="xs" color={useColorModeValue('gray.400', 'gray.500')}> 
              {new Date(item.modified).toLocaleString()}
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
          boxSize={4}
          cursor="pointer"
          color="blue.500"
          _hover={{ color: 'blue.600' }}
          asChild><Home onClick={goHome} /></Icon>
        <Icon
          boxSize={4}
          cursor="pointer"
          color="blue.500"
          _hover={{ color: 'blue.600' }}
          asChild><HardDrive onClick={loadRootDirectories} /></Icon>
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
        <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} flex="1" lineClamp={1}>
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
          <Alert.Root status="error" mb={3}>
            <Alert.Indicator />
            {error}
          </Alert.Root>
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