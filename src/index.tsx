import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { AppProvider } from './context/AppContext';
import { theme } from './theme';
import './styles/scrollbar.css';

// Check if this is the floating timer window and make it transparent
const isFloatingTimer = window.location.hash === '#floating-timer';
if (isFloatingTimer) {
  document.body.style.backgroundColor = 'transparent';
  document.documentElement.style.backgroundColor = 'transparent';
  document.body.classList.add('floating-timer');
}

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AppProvider>
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <App />
      </ChakraProvider>
    </AppProvider>
  </React.StrictMode>
);