import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from './components/ui/provider';
import { StandaloneCalculator } from './components/StandaloneCalculator';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider defaultTheme="dark">
      <StandaloneCalculator />
    </Provider>
  </React.StrictMode>
);
