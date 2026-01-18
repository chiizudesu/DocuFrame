import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider, ColorModeScript, extendTheme } from '@chakra-ui/react';
import { PathPasteOverlay } from './components/PathPasteOverlay';
import './index.css';

// Define theme configuration
const theme = extendTheme({
  config: {
    initialColorMode: 'system',
    useSystemColorMode: true,
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <PathPasteOverlay />
    </ChakraProvider>
  </React.StrictMode>
);
