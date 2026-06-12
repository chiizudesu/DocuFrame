declare module 'js-yaml';

/** Vite `?url` asset imports (e.g. the pdf.js worker) */
declare module '*?url' {
  const src: string;
  export default src;
}

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