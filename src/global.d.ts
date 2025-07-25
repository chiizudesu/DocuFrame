declare module 'js-yaml';

declare global {
  interface Window {
    electron: {
      startDrag: (files: string | string[]) => void;
    };
    electronAPI: {
      openCalculator: () => Promise<{ success: boolean }>;
      closeCalculator: () => Promise<{ success: boolean }>;
      [key: string]: any; // For other existing methods
    };
  }
} 