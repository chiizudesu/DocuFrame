import React, { useEffect } from 'react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ isOpen, onClose }) => {
  // Open calculator window when requested
  useEffect(() => {
    if (isOpen) {
      // Open the standalone calculator window
      if (window.electronAPI?.openCalculator) {
        window.electronAPI.openCalculator().then(() => {
          // Call onClose to reset the modal state in the parent component
          onClose();
        }).catch((error: any) => {
          console.error('Failed to open calculator:', error);
          onClose();
        });
      } else {
        console.error('Calculator API not available');
        onClose();
      }
    }
  }, [isOpen, onClose]);

  // This component doesn't render anything since the calculator is now standalone
  return null;
}; 