import React, { useState } from 'react';
import { Flex, Text, IconButton, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Input, InputGroup, InputLeftElement, Tooltip, Box, useColorModeValue, HStack } from '@chakra-ui/react';
import { FolderOpen, ExternalLink, RefreshCw, LayoutGrid, List, ChevronRight, Home } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
export const FolderInfoBar: React.FC = () => {
  const {
    currentDirectory,
    setCurrentDirectory,
    addLog
  } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(currentDirectory);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const pathSegments = currentDirectory.split('/').filter(segment => segment);
  const handleBreadcrumbClick = (index: number) => {
    const newPath = '/' + pathSegments.slice(0, index + 1).join('/');
    setCurrentDirectory(newPath);
    addLog(`Changed directory to: ${newPath}`);
  };
  const handleHomeClick = () => {
    setCurrentDirectory('/');
    addLog(`Changed directory to root: /`);
  };
  const handleRefresh = () => {
    addLog(`Refreshing directory: ${currentDirectory}`);
  };
  const handleOpenExplorer = () => {
    addLog(`Opening in file explorer: ${currentDirectory}`);
  };
  const handleViewModeChange = (mode: 'grid' | 'list') => () => {
    setViewMode(mode);
    addLog(`Changed view mode to: ${mode}`);
    // Store view mode in localStorage so FileGrid component can access it
    localStorage.setItem('fileViewMode', mode);
    // Dispatch custom event to notify FileGrid of view mode change
    window.dispatchEvent(new CustomEvent('viewModeChanged', {
      detail: mode
    }));
  };
  const handlePathClick = () => {
    setIsEditing(true);
  };
  const handleEditButtonClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setIsEditing(true);
  };
  const handleSubmit = () => {
    setCurrentDirectory(editPath);
    addLog(`Changed directory to: ${editPath}`);
    setIsEditing(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditPath(currentDirectory);
    }
  };
  // Colors for Windows Explorer style
  const bgColor = useColorModeValue('gray.100', 'gray.800');
  const hoverBgColor = useColorModeValue('blue.100', 'blue.700');
  const activeBgColor = useColorModeValue('blue.200', 'blue.600');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const separatorColor = useColorModeValue('gray.400', 'gray.500');
  return <Flex align="center" width="100%" bg={useColorModeValue('gray.100', 'gray.800')} borderRadius="sm" h="32px">
      <IconButton icon={<Home size={16} />} aria-label="Home folder" variant="ghost" size="sm" mr={1} color="blue.400" onClick={handleHomeClick} />
      <Box flex="1" onClick={handlePathClick} borderRadius="sm" overflow="hidden">
        {isEditing ? <InputGroup>
            <InputLeftElement pointerEvents="none" color="gray.500">
              /
            </InputLeftElement>
            <Input value={editPath} onChange={e => setEditPath(e.target.value)} onBlur={handleSubmit} onKeyDown={handleKeyDown} autoFocus pl={6} bg={useColorModeValue('white', 'gray.700')} border="none" _focus={{
          boxShadow: 'none',
          bg: useColorModeValue('gray.50', 'gray.600')
        }} h="32px" />
          </InputGroup> : <Flex align="center" h="32px">
            {pathSegments.map((segment, index) => <Flex key={index} align="center" onMouseEnter={() => setHoveredSegment(index)} onMouseLeave={() => setHoveredSegment(null)}>
                <Flex align="center" px={2} py="2px" cursor="pointer" bg={hoveredSegment === index ? hoverBgColor : 'transparent'} borderRadius="md" onClick={e => {
            e.stopPropagation();
            handleBreadcrumbClick(index);
          }}>
                  <Text fontSize="sm" fontWeight={index === pathSegments.length - 1 ? 'medium' : 'normal'} color={textColor} userSelect="none">
                    {segment}
                  </Text>
                </Flex>
                {index < pathSegments.length - 1 && <Flex align="center" justify="center" px={1}>
                    <Text fontSize="sm" color={separatorColor} userSelect="none">
                      &gt;
                    </Text>
                  </Flex>}
              </Flex>)}
          </Flex>}
      </Box>
      <HStack spacing={1} px={1}>
        <IconButton icon={<RefreshCw size={16} />} aria-label="Refresh folder" variant="ghost" size="sm" onClick={handleRefresh} />
        <IconButton icon={<LayoutGrid size={16} />} aria-label="Grid view" variant={viewMode === 'grid' ? 'solid' : 'ghost'} size="sm" onClick={handleViewModeChange('grid')} />
        <IconButton icon={<List size={16} />} aria-label="List view" variant={viewMode === 'list' ? 'solid' : 'ghost'} size="sm" onClick={handleViewModeChange('list')} />
        <IconButton icon={<ExternalLink size={16} />} aria-label="Open in explorer" variant="ghost" size="sm" onClick={handleOpenExplorer} />
      </HStack>
    </Flex>;
};