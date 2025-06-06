import React from 'react';
import { IconButton, useColorMode, Flex } from '@chakra-ui/react';
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
    setIsSettingsOpen
  } = useAppContext();
  const handleToggle = () => {
    const newMode = colorMode === 'light' ? 'dark' : 'light';
    toggleColorMode();
    localStorage.setItem('chakra-ui-color-mode', newMode);
    addLog(`Switched to ${newMode} mode`);
  };
  const handleSettings = () => {
    setIsSettingsOpen(true);
    addLog('Opening settings panel');
  };
  return <Flex gap={1}>
      <IconButton icon={colorMode === 'light' ? <Moon size={16} /> : <Sun size={16} />} aria-label="Toggle theme" variant="ghost" size="sm" onClick={handleToggle} color={colorMode === 'light' ? 'gray.600' : 'gray.400'} />
      <IconButton icon={<Settings size={16} />} aria-label="Settings" variant="ghost" size="sm" onClick={handleSettings} color={colorMode === 'light' ? 'gray.600' : 'gray.400'} />
      <SettingsDialog />
    </Flex>;
};