import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './context/AppContext';
import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import './styles/scrollbar.css';
/** Keyframes for address-bar refresh, AI File Manager progress, etc. (was only imported by calculator/path-overlay entries). */
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider defaultTheme="dark">
      <Toaster />
      <AppProvider>
        <App />
      </AppProvider>
    </Provider>
  </React.StrictMode>
);
