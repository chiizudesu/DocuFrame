import React from 'react';
import { IconButton, useColorMode, Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { Sun, Moon, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { SettingsDialog } from './SettingsDialog';
export const ThemeToggle: React.FC = () => {
  const {
    colorMode,
    toggleColorMode
  } = useColorMode();
  const {
    addLog,
    setIsSettingsOpen,
    isSettingsOpen,
    setStatus
  } = useAppContext();
  
  // Color for buttons that adapts to theme
  const buttonColor = useColorModeValue('#64748b', 'white');
  
  const handleToggle = () => {
    const newMode = colorMode === 'light' ? 'dark' : 'light';
    toggleColorMode();
    localStorage.setItem('chakra-ui-color-mode', newMode);
    addLog(`Switched to ${newMode} mode`);
    setStatus(`Switched to ${newMode} mode`, 'info');
  };
  const handleSettings = () => {
    setIsSettingsOpen(true);
    addLog('Opening settings panel');
    setStatus('Opened settings', 'info');
  };
  return <Flex gap={1} align="center">
      <Text fontSize="10px" color={colorMode === 'light' ? 'gray.400' : 'gray.600'} mr={2} userSelect="none">
        v1.1.0
      </Text>
      <IconButton icon={colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />} aria-label="Toggle theme" variant="ghost" size="sm" onClick={handleToggle} color={buttonColor} />
      <IconButton icon={<Settings size={16} />} aria-label="Settings" variant="ghost" size="sm" onClick={handleSettings} color={buttonColor} />
      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </Flex>;
};