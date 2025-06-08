import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ChakraProvider, ColorModeScript, extendTheme } from '@chakra-ui/react';
import { AppProvider } from './context/AppContext';
import './styles/scrollbar.css';

// Define theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: true,
  },
});

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