declare module 'js-yaml';

declare global {
  interface Window {
    electron: {
      startDrag: (files: string | string[]) => void;
    };
  }
} 