import React, { useEffect } from 'react';
import { Box, useColorMode } from '@chakra-ui/react';
import { Layout } from './components/Layout';
import { QuickNavigateOverlay } from './components/QuickNavigateOverlay';
import { useAppContext } from './context/AppContext';
// Separate component to use context
const AppContent: React.FC = () => {
  const {
    colorMode
  } = useColorMode();
  const {
    isQuickNavigating,
    setIsQuickNavigating,
    setInitialCommandMode
  } = useAppContext();
  // Handle keyboard events for quick navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input/textarea is focused
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      // If Ctrl + Space is pressed, open in command mode
      if (!isInputFocused && !isQuickNavigating && e.ctrlKey && e.code === 'Space') {
        setIsQuickNavigating(true);
        setInitialCommandMode(true);
        e.preventDefault();
        return;
      }
      // If a letter key is pressed and no input is focused
      if (!isInputFocused && !isQuickNavigating && e.key.length === 1 && e.key.match(/[a-z0-9]/i) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        setIsQuickNavigating(true);
        setInitialCommandMode(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isQuickNavigating, setIsQuickNavigating, setInitialCommandMode]);
  return <Box w="100%" h="100vh" bg={colorMode === 'dark' ? 'gray.900' : 'gray.50'} color={colorMode === 'dark' ? 'white' : 'gray.800'} overflow="hidden" position="relative">
      <Layout />
      <QuickNavigateOverlay />
    </Box>;
};
export function App() {
  const {
    colorMode,
    toggleColorMode
  } = useColorMode();
  // Force dark mode on initial render only if no theme preference is set
  useEffect(() => {
    const savedTheme = localStorage.getItem('chakra-ui-color-mode');
    if (!savedTheme && colorMode !== 'dark') {
      toggleColorMode();
    }
  }, []);
  return <AppContent />;
}