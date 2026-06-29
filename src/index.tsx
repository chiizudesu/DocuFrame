import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './context/AppContext';
import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import './styles/scrollbar.css';
/** Keyframes for address-bar refresh, AI File Manager progress, etc. (was only imported by calculator/path-overlay entries). */
import './index.css';
import { installModalInertObserver } from './utils/modalInert';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

// Toggle #root[data-modal-open] while any dialog is open (replaces a costly
// body:has(...) #root * rule — see utils/modalInert.ts).
installModalInertObserver();

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
