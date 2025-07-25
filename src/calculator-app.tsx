import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { StandaloneCalculator } from './components/StandaloneCalculator';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ColorModeScript initialColorMode="system" />
    <ChakraProvider>
      <StandaloneCalculator />
    </ChakraProvider>
  </React.StrictMode>
); 