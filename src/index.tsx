import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './context/AppContext';
import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import './styles/scrollbar.css';

// Check if this is the floating timer window
const isFloatingTimer = window.location.hash === '#floating-timer';
if (isFloatingTimer) {
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.classList.add('floating-timer');
}

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
