import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from './components/ui/provider';
import { PathPasteOverlay } from './components/PathPasteOverlay';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Provider defaultTheme="dark">
      <PathPasteOverlay />
    </Provider>
  </React.StrictMode>
);
