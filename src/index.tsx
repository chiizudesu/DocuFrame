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

// ponytail: StrictMode temporarily disabled for profiling — it double-invokes renders in
// dev, inflating perceived lag and doubling React Profiler render counts. Re-enable when done.
root.render(
  <Provider defaultTheme="dark">
    <Toaster />
    <AppProvider>
      <App />
    </AppProvider>
  </Provider>
);
