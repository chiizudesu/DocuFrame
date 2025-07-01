// Version utility to read app version from package.json
export const getAppVersion = (): string => {
  // Try multiple sources for version
  if (typeof globalThis !== 'undefined' && (globalThis as any).__APP_VERSION__) {
    return (globalThis as any).__APP_VERSION__;
  }
  
  if (typeof window !== 'undefined' && (window as any).__APP_VERSION__) {
    return (window as any).__APP_VERSION__;
  }
  
  // Try to get from preload script
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getVersion) {
    try {
      return (window as any).electronAPI.getVersion();
    } catch (error) {
      console.log('Could not get version from electronAPI');
    }
  }
  
  // Fallback to package.json version (updated to current version)
  return '1.0.7';
};

// Alternative approach using window object (if available)
export const getVersionFromWindow = (): string => {
  if (typeof window !== 'undefined' && (window as any).__APP_VERSION__) {
    return (window as any).__APP_VERSION__;
  }
  return '1.0.7';
}; 