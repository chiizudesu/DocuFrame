// Version utility to read app version from package.json
export const getAppVersion = (): string => {
  // Use the version injected by Vite during build
  return (globalThis as any).__APP_VERSION__ || '1.0.0';
};

// Alternative approach using window object (if available)
export const getVersionFromWindow = (): string => {
  if (typeof window !== 'undefined' && (window as any).__APP_VERSION__) {
    return (window as any).__APP_VERSION__;
  }
  return '1.0.0';
}; 