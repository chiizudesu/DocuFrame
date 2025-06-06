import React, { useState } from 'react';
import { Box, Text, Icon, Flex, useColorModeValue } from '@chakra-ui/react';
import { FolderOpen, File, ChevronRight, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
interface FolderItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: FolderItem[];
  isOpen?: boolean;
}
export const FolderNavigation: React.FC = () => {
  const {
    setCurrentDirectory,
    addLog
  } = useAppContext();
  const borderColor = useColorModeValue('gray.600', 'gray.700');
  // Mock folder structure
  const [folders, setFolders] = useState<FolderItem[]>([{
    id: '1',
    name: 'Clients',
    type: 'folder',
    isOpen: true,
    children: [{
      id: '2',
      name: 'ABC Corp',
      type: 'folder',
      children: [{
        id: '3',
        name: 'Financial Reports',
        type: 'folder',
        children: []
      }, {
        id: '4',
        name: 'Tax Documents',
        type: 'folder',
        children: []
      }, {
        id: '5',
        name: 'invoice.pdf',
        type: 'file'
      }]
    }, {
      id: '6',
      name: 'XYZ Ltd',
      type: 'folder',
      children: [{
        id: '7',
        name: 'Contracts',
        type: 'folder',
        children: []
      }, {
        id: '8',
        name: 'statement.pdf',
        type: 'file'
      }]
    }, {
      id: '9',
      name: 'Smith & Co',
      type: 'folder',
      children: []
    }]
  }, {
    id: '10',
    name: 'Templates',
    type: 'folder',
    children: [{
      id: '11',
      name: 'Invoice Templates',
      type: 'folder',
      children: []
    }, {
      id: '12',
      name: 'Report Templates',
      type: 'folder',
      children: []
    }]
  }, {
    id: '13',
    name: 'Scripts',
    type: 'folder',
    children: [{
      id: '14',
      name: 'pdf_merge.js',
      type: 'file'
    }, {
      id: '15',
      name: 'gst_rename.js',
      type: 'file'
    }]
  }]);
  const toggleFolder = (id: string) => {
    const updateFolders = (items: FolderItem[]): FolderItem[] => {
      return items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            isOpen: !item.isOpen
          };
        }
        if (item.children) {
          return {
            ...item,
            children: updateFolders(item.children)
          };
        }
        return item;
      });
    };
    setFolders(updateFolders(folders));
  };
  const handleFolderClick = (item: FolderItem, path: string) => {
    if (item.type === 'folder') {
      toggleFolder(item.id);
      setCurrentDirectory(path);
      addLog(`Changed directory to: ${path}`);
    } else {
      addLog(`Selected file: ${path}`);
    }
  };
  const renderTreeItem = (item: FolderItem, path: string, level: number = 0) => {
    const fullPath = `${path}/${item.name}`;
    return <Box key={item.id} ml={level * 4}>
        <Flex align="center" py={1} px={2} cursor="pointer" _hover={{
        bg: useColorModeValue('gray.100', 'gray.700')
      }} borderRadius="md" onClick={() => handleFolderClick(item, fullPath)}>
          {item.type === 'folder' && <Icon as={item.isOpen ? ChevronDown : ChevronRight} boxSize={4} mr={1} color={useColorModeValue('gray.500', 'gray.400')} />}
          <Icon as={item.type === 'folder' ? FolderOpen : File} color={item.type === 'folder' ? 'blue.500' : useColorModeValue('gray.600', 'gray.400')} boxSize={4} mr={2} />
          <Text fontSize="sm" flex="1" noOfLines={1} color={useColorModeValue('gray.800', 'white')}>
            {item.name}
          </Text>
        </Flex>
        {item.type === 'folder' && item.isOpen && item.children && <Box>
            {item.children.map(child => renderTreeItem(child, fullPath, level + 1))}
          </Box>}
      </Box>;
  };
  return <Box p={3} overflowY="auto" h="100%">
      {folders.map(item => renderTreeItem(item, ''))}
    </Box>;
};