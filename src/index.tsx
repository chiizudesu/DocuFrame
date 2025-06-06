import React from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { render } from 'react-dom';
import { App } from './App';
import { AppProvider } from './context/AppContext';
render(<AppProvider>
    <ChakraProvider>
      <App />
    </ChakraProvider>
  </AppProvider>, document.getElementById('root'));