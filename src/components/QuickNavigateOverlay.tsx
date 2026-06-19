import { useEffect, useState, useRef, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Input, Text, Flex, IconButton, Switch, Separator } from '@chakra-ui/react';
import { docuFramePalette, dfHomeIconColor } from '../docuFrameColors';
import { keyframes } from '@emotion/react';
import { ChevronRight, Search, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { FileItem, TransferOptions } from '../types';

// Simple debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

// Simple pulsing border animation for content search loading - pulses outward only
const pulseBorder = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.8);
  }
  50% {
    box-shadow: 0 0 0 15px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
`;

const pulseBorderDark = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.8);
  }
  50% {
    box-shadow: 0 0 0 15px rgba(96, 165, 250, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(96, 165, 250, 0);
  }
`;


export const QuickNavigateOverlay: React.FC = () => {
  // All useContext hooks first
  const {
    currentDirectory,
    setCurrentDirectory: setCurrentPath,
    setPreviewFiles,
    previewFiles,
    addLog,
    addCommand,

    initialCommandMode,
    isQuickNavigating,
    setIsQuickNavigating,
    isSearchMode,
    setIsSearchMode,
    commandHistory,
    setStatus,
    setFolderItems,
    folderItems,
    logFileOperation,
    fileSearchFilter,
    setFileSearchFilter,
    setContentSearchResults
  } = useAppContext();

  // All useState hooks next
  const [inputValue, setInputValue] = useState('');
  const [commandInfo, setCommandInfo] = useState<{
    title: string;
    description: string;
    usage: string;
    preview?: {
      title: string;
      items: {
        name: string;
        size?: string;
      }[];
    };
  } | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [transferMappings, setTransferMappings] = useState<{ [key: string]: string }>({});
  const transferMappingsRef = useRef<{ [key: string]: string }>({});
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInDocuments, setSearchInDocuments] = useState(false);
  const [localSearchResults, setLocalSearchResults] = useState<FileItem[]>([]);
  const [isContentSearching, setIsContentSearching] = useState(false);

  // All useRef hooks next
  const inputRef = useRef<HTMLInputElement>(null);

  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');
  const highlightColor = useColorModeValue('blue.400', 'blue.500');
  const fileTextIconColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);
  const fileTextLabelColor = fileTextIconColor;
  const commandInfoChevronColor = useColorModeValue(dfHomeIconColor.light, dfHomeIconColor.dark);
  const commandInfoUsageTextColor = commandInfoChevronColor;
  const previewChevronColor = fileTextIconColor;
  
  // Pulsing border animation for content search loading
  const pulseBorderAnimation = useColorModeValue(
    `${pulseBorder} 1.5s ease-in-out infinite`,
    `${pulseBorderDark} 1.5s ease-in-out infinite`
  );

  // All useCallback hooks for functions used in useEffect
  const handleTransferMappingPreview = useCallback(async (command: string) => {
    try {
      const previewOptions: TransferOptions = { 
        numFiles: 1,
        command: command, // Pass the actual command for mapping lookup
        preview: true, // Enable preview mode - doesn't actually transfer files
        currentDirectory: currentDirectory
      };
      const previewResult = await window.electronAPI.transfer(previewOptions);
      
      if (previewResult.success && previewResult.files) {
        setPreviewFiles(previewResult.files);
      } else {
        setPreviewFiles([]);
      }
    } catch (error) {
      setPreviewFiles([]);
    }
  }, [currentDirectory, setPreviewFiles]);

  // Load transfer mappings function
  const loadTransferMappings = useCallback(async () => {
    try {
      const config = await (window.electronAPI as any).getConfig();
      // Extract just the transferCommandMappings part
      const mappings = config?.transferCommandMappings || {};
      setTransferMappings(mappings);
      transferMappingsRef.current = mappings; // Update ref immediately
    } catch (error) {
      setTransferMappings({});
      transferMappingsRef.current = {}; // Update ref even on error
    }
  }, []);

  // Fetch transfer mappings on mount and when updated
  useEffect(() => {
    loadTransferMappings();
    
    // Listen for transfer mappings updates
    const handleMappingsUpdate = () => {
      loadTransferMappings();
    };
    
    window.addEventListener('transferMappingsUpdated', handleMappingsUpdate);
    
    return () => {
      window.removeEventListener('transferMappingsUpdated', handleMappingsUpdate);
    };
  }, [loadTransferMappings]);

  // Re-trigger preview when mappings are loaded/updated (command info updates immediately via main effect)
  useEffect(() => {
    if (Object.keys(transferMappings).length > 0 && inputValue && !isSearchMode) {
      const commandText = inputValue.trim().toLowerCase();
      
      // Only re-trigger preview if the current command is a mapping command
      const commandParts = commandText.split(' ');
      const command = commandParts[0];
      const mappingKey = Object.keys(transferMappings).find(key => key.toLowerCase() === command.toLowerCase());
      
      if (mappingKey) {
        // Use a small delay to ensure state is updated
        setTimeout(() => {
          handleTransferMappingPreview(command);
        }, 100);
      }
    }
  }, [transferMappings, inputValue, isSearchMode, handleTransferMappingPreview]);

  // Focus input when overlay opens and set initial mode
  useEffect(() => {
    if (isQuickNavigating && inputRef.current) {
      inputRef.current.focus();
      setInputValue('');
      setSearchQuery('');
      setLocalSearchResults([]);
    } else if (!isQuickNavigating) {
      // Clear everything when overlay closes
      setInputValue('');
      setSearchQuery('');
      setCommandInfo(null);
      setPreviewFiles([]);
      setLocalSearchResults([]);
      setIsSearchMode(false);
      setFileSearchFilter(''); // Clear search filter when overlay closes
      setContentSearchResults([]); // Clear content search results when overlay closes
      setIsContentSearching(false); // Clear content search loading state when overlay closes
    }
  }, [isQuickNavigating, initialCommandMode, isSearchMode, setFileSearchFilter, setContentSearchResults]);

  // Global Ctrl+F shortcut for file search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchMode(true);
        setIsQuickNavigating(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced command processing to prevent API calls on every keystroke
  // Note: We use a ref to access the latest transferMappings to avoid stale closures
  useEffect(() => {
    transferMappingsRef.current = transferMappings;
  }, [transferMappings]);

  // Command info update handler - memoized and called immediately (no debounce)
  const handleCommandInfoUpdate = useCallback((commandText: string) => {
    if (!commandText) {
      setCommandInfo({
        title: 'Command Info',
        description: 'Type a command to execute',
        usage: '[command] [arguments]'
      });
      return;
    }
    // Parse command and show relevant info
    const commandParts = commandText.split(' ');
    const command = commandParts[0];
    
    // Check for transfer mapping commands - use ref to avoid stale closure
    const currentMappings = transferMappingsRef.current;
    const mappingKey = Object.keys(currentMappings).find(key => {
      const matches = key.toLowerCase() === command.toLowerCase();
      return matches;
    });
    
    if (mappingKey) {
      setCommandInfo({
        title: `Transfer Mapping: ${mappingKey}`,
        description: `Transfer file(s) using mapping: ${currentMappings[mappingKey]}`,
        usage: `$ ${mappingKey.toLowerCase()}`
      });
      return;
    }
    if (command === 'merge') {
      setCommandInfo({
        title: 'Merge PDFs',
        description: 'Combine multiple PDF files into one document',
        usage: '$ merge [output_filename]',
        preview: {
          title: 'Files to be merged:',
          items: [{
            name: 'document1.pdf',
            size: '2.1 MB'
          }, {
            name: 'document2.pdf',
            size: '1.5 MB'
          }]
        }
      });
    } else if (command === 'transfer') {
      setCommandInfo({
        title: 'Transfer Files',
        description: 'Transfer file(s) from Downloads folder',
        usage: '$ transfer [number_of_files | new_filename]'
      });
    } else if (command === 'finals') {
      setCommandInfo({
        title: 'Finals Processing',
        description: 'Rename tax return files and financial statements to standard format',
        usage: '$ finals'
      });
    } else if (command === 'rename') {
      setCommandInfo({
        title: 'Rename Files',
        description: 'Batch rename files with pattern matching',
        usage: '$ rename [pattern] [replacement]',
        preview: {
          title: 'Files to be renamed:',
          items: [{
            name: 'IMG_20240101.jpg → 2024-01-01.jpg'
          }, {
            name: 'IMG_20240102.jpg → 2024-01-02.jpg'
          }]
        }
      });
    } else if (command === 'extract') {
      setCommandInfo({
        title: 'Extract Archives',
        description: 'Extract all ZIP files in current directory',
        usage: '$ extract [destination_folder]',
        preview: {
          title: 'Archives to extract:',
          items: [{
            name: 'archive1.zip',
            size: '5.2 MB'
          }, {
            name: 'archive2.zip',
            size: '3.7 MB'
          }]
        }
      });
    } else if (command === 'help') {
      setCommandInfo({
        title: 'Available Commands',
        description: 'List of available commands',
        usage: '$ help [command]',
        preview: {
          title: 'Commands:',
          items: [{
            name: 'merge - Combine PDF files'
          }, {
            name: 'transfer - Transfer files from Downloads'
          }, {
            name: 'finals - Rename tax return files'
          }, {
            name: 'rename - Batch rename files'
          }, {
            name: 'extract - Extract archives'
          }, {
            name: 'help - Show this help'
          }]
        }
      });
    } else {
      setCommandInfo({
        title: 'Unknown Command',
        description: `"${command}" is not recognized as a command`,
        usage: 'Type $ help for a list of available commands'
      });
    }
  }, []);

  /** Latest preview deps for debounced IPC — avoids recreating debounce + effect churn on directory change */
  const overlayPreviewDepsRef = useRef({ currentDirectory, setPreviewFiles });
  overlayPreviewDepsRef.current = { currentDirectory, setPreviewFiles };

  const handleTransferMappingPreviewRef = useRef(handleTransferMappingPreview);
  handleTransferMappingPreviewRef.current = handleTransferMappingPreview;

  const debouncedCommandProcessingRef = useRef(
    debounce((commandText: string, inputValue: string) => {
      const { currentDirectory: dir, setPreviewFiles: setPrev } = overlayPreviewDepsRef.current;
      const runMappingPreview = handleTransferMappingPreviewRef.current;

      if (!commandText) {
        setPrev([]);
        return;
      }

      const currentMappings = transferMappingsRef.current;
      const commandParts = commandText.split(' ');
      const command = commandParts[0];
      const mappingKey = Object.keys(currentMappings).find(
        (key) => key.toLowerCase() === command.toLowerCase(),
      );

      if (commandText.startsWith('transfer ')) {
        const match = inputValue.trim().match(/^transfer\s+(?:"([^"]+)"|'([^']+)'|(\S+))?/i);
        const arg = match && (match[1] || match[2] || match[3]);
        let numFiles: number | undefined = 1;
        let newName: string | undefined = undefined;
        if (arg) {
          if (!isNaN(Number(arg))) {
            numFiles = Number(arg);
          } else {
            newName = arg;
          }
        }
        window.electronAPI
          .transfer({
            numFiles,
            newName,
            command: 'preview',
            currentDirectory: dir,
          })
          .then((previewResult: any) => {
            if (previewResult.success && previewResult.files) {
              setPrev(previewResult.files);
            } else {
              setPrev([]);
            }
          })
          .catch(() => setPrev([]));
      } else if (mappingKey) {
        void runMappingPreview(command);
      } else if (command === 'finals') {
        window.electronAPI
          .executeCommand('finals_preview', dir)
          .then((previewResult: any) => {
            if (previewResult.success && previewResult.files) {
              setPrev(previewResult.files);
            } else {
              setPrev([]);
            }
          })
          .catch(() => setPrev([]));
      } else if (command === 'edsby') {
        let period = commandParts.slice(1).join(' ').trim();
        if ((period.startsWith('"') && period.endsWith('"')) || (period.startsWith("'") && period.endsWith("'"))) {
          period = period.slice(1, -1);
        }
        window.electronAPI
          .executeCommand('edsby_preview', dir, { period })
          .then((previewResult: any) => {
            if (previewResult.success && previewResult.files) {
              setPrev(previewResult.files);
            } else {
              setPrev([]);
            }
          })
          .catch(() => setPrev([]));
      } else if (command === 'pdfinc') {
        window.electronAPI
          .executeCommand('pdfinc_preview', dir)
          .then((previewResult: any) => {
            if (previewResult.success && previewResult.files) {
              setPrev(previewResult.files);
            } else {
              setPrev([]);
            }
          })
          .catch(() => setPrev([]));
      } else if (command === 'sc') {
        let newName: string | undefined;
        if (commandParts.length > 1) {
          newName = commandParts.slice(1).join(' ').trim();
          if ((newName.startsWith('"') && newName.endsWith('"')) || (newName.startsWith("'") && newName.endsWith("'"))) {
            newName = newName.slice(1, -1);
          }
        }
        window.electronAPI
          .executeCommand('sc_preview', dir, { newName })
          .then((previewResult: any) => {
            if (previewResult.success && previewResult.files) {
              setPrev(previewResult.files);
            } else {
              setPrev([]);
            }
          })
          .catch(() => setPrev([]));
      } else {
        setPrev([]);
      }
    }, 100),
  );

  // Process input changes with debouncing
  useEffect(() => {
    if (isSearchMode) {
      // Search mode - filter current directory instead of showing dropdown
      // Set the filter directly (no debounce needed for live filtering)
      setFileSearchFilter(searchQuery);
      
      // Clear local search results since we're not showing dropdown anymore
      setLocalSearchResults([]);
      
      // Perform content search if enabled
      if (searchInDocuments && searchQuery.trim()) {
        setIsContentSearching(true);
        (async () => {
          try {
            const results = await window.electronAPI.searchInDocuments({
              query: searchQuery,
              currentDirectory,
              maxResults: 100 // Get more results for filtering
            });
            setContentSearchResults(results || []);
          } catch (error) {
            setContentSearchResults([]);
          } finally {
            setIsContentSearching(false);
          }
        })();
      } else {
        setContentSearchResults((prev) => (prev.length > 0 ? [] : prev));
        setIsContentSearching(false);
      }
    } else {
      // Command mode - handle command input
      if (!inputValue) {
        setCommandInfo(null);
        setPreviewFiles([]); // Clear preview when input is empty
        return;
      }

      const commandText = inputValue.trim().toLowerCase();

      handleCommandInfoUpdate(commandText);

      debouncedCommandProcessingRef.current(commandText, inputValue);

      setContentSearchResults((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [
    inputValue,
    searchQuery,
    isSearchMode,
    searchInDocuments,
    currentDirectory,
    handleCommandInfoUpdate,
    setContentSearchResults,
    setFileSearchFilter,
    setPreviewFiles,
  ]);

  // Sync search results to filtered results for display
  useEffect(() => {
    // This useEffect is no longer needed as search functionality is removed
  }, []);

  // Global Escape to close overlay when in search mode (works even when input is blurred after clicking a file)
  useEffect(() => {
    if (!isQuickNavigating || !isSearchMode) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsQuickNavigating(false);
        setInputValue('');
        setSearchQuery('');
        setCommandInfo(null);
        setPreviewFiles([]);
        setLocalSearchResults([]);
        setFileSearchFilter('');
        setContentSearchResults([]);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isQuickNavigating, isSearchMode]);

  const navigateHistory = (direction: number) => {
    const newIndex = historyIndex + direction;
    if (newIndex >= -1 && newIndex < commandHistory.length) {
      setHistoryIndex(newIndex);
      setInputValue(newIndex === -1 ? '' : commandHistory[newIndex]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsQuickNavigating(false);
      setInputValue('');
      setSearchQuery('');
      setCommandInfo(null); // Clear command info on escape
      setPreviewFiles([]); // Clear preview on escape
      setLocalSearchResults([]); // Clear search results on escape
      setFileSearchFilter(''); // Clear search filter on escape
      setContentSearchResults([]); // Clear content search results on escape
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      if (isSearchMode) {
        // In search mode, open/navigate to the first filtered file/folder
        if (searchQuery && searchQuery.trim() && Array.isArray(folderItems) && folderItems.length > 0) {
          // Filter folderItems the same way FileGrid does
          const normalizedFilter = searchQuery.toLowerCase().trim();
          const filteredItems = folderItems.filter(item => 
            item.name.toLowerCase().includes(normalizedFilter)
          );
          
          if (filteredItems.length > 0) {
            const firstItem = filteredItems[0];
            setIsQuickNavigating(false);
            setFileSearchFilter('');
            setSearchQuery('');
            
            if (firstItem.type === 'folder') {
              setCurrentPath(firstItem.path);
              addLog(`Navigated to: ${firstItem.path}`);
            } else {
              // Open the file
              window.electronAPI.openFile(firstItem.path);
              addLog(`Opened file: ${firstItem.name}`);
            }
          }
        }
      } else {
        // Execute command in command mode
        executeCommand();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchMode) navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchMode) navigateHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };
  const executeCommand = async () => {
    const command = inputValue.trim();
    if (!command) return;
    
    addLog(`$ ${command}`, 'command');
    addCommand(command);
    setStatus(`Executing: ${command}`, 'info');

    try {
      // For transfer commands, get preview first
      if (command.toLowerCase().startsWith('transfer')) {
        // Parse arguments, supporting quoted strings
        const match = command.match(/^transfer\s+(?:"([^"]+)"|'([^']+)'|(\S+))?/i);
        let arg = match && (match[1] || match[2] || match[3]);
        let numFiles: number | undefined = 1;
        let newName: string | undefined = undefined;
        if (arg) {
          if (!isNaN(Number(arg))) {
            numFiles = Number(arg);
          } else {
            newName = arg;
          }
        }
        try {
          // Get preview first
          const previewOptions: TransferOptions = { 
            numFiles,
            newName,
            command: 'preview',
            currentDirectory: currentDirectory
          };
          const previewResult = await window.electronAPI.transfer(previewOptions);
          
          if (previewResult.success && previewResult.files) {
            // Update preview pane
            setPreviewFiles(previewResult.files);
            
            // Now execute the actual transfer
            const transferOptions: TransferOptions = { 
              numFiles,
              newName,
              command: 'transfer',
              currentDirectory: currentDirectory
            };
            const transferResult = await window.electronAPI.transfer(transferOptions);
            
            if (transferResult.success) {
              addLog(transferResult.message, 'response');
              setStatus('Transfer completed', 'success');
              
              // Log file operation for task timer with renamed filenames
              if (transferResult.files && transferResult.files.length > 0) {
                const dirName = currentDirectory.split('\\').pop() || currentDirectory;
                transferResult.files.forEach((file: any) => {
                  logFileOperation(`${file.name} transferred to ${dirName}`);
                });
              }
              
              // Refresh folder view
              setStatus('Refreshing folder...', 'info');
              if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
                const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
                if (typeof setFolderItems === 'function') setFolderItems(contents);
                setStatus('Folder refreshed', 'success');
              }
            } else {
              addLog(transferResult.message, 'error');
              setStatus('Transfer failed', 'error');
            }
          } else {
            addLog(previewResult.message, 'error');
          }
        } catch (error) {
          addLog(`Error during transfer: ${error}`, 'error');
        }
      } else if (command === 'finals') {
        // Handle finals command with folder refresh
        const result = await window.electronAPI.executeCommand(command, currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('Finals completed', 'success');
          // Refresh folder view to show renamed files
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('Finals failed', 'error');
        }
      } else if (command.startsWith('edsby')) {
        // Handle edsby command with folder refresh
        let period = command.split(' ').slice(1).join(' ').trim();
        if ((period.startsWith('"') && period.endsWith('"')) || (period.startsWith("'") && period.endsWith("'"))) {
          period = period.slice(1, -1);
        }
        const result = await window.electronAPI.executeCommand('edsby', currentDirectory, { period });
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('Edsby batch rename completed', 'success');
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('Edsby batch rename failed', 'error');
        }
      } else if (command.toLowerCase() === 'pdfinc') {
        // Handle pdfinc command with folder refresh
        const result = await window.electronAPI.executeCommand(command, currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('PDF merge completed', 'success');
          // Refresh folder view to show merged files
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('PDF merge failed', 'error');
        }
      } else {
        // Check if this is a transfer mapping command
        const commandParts = command.split(' ');
        const commandName = commandParts[0].toLowerCase();
        const mappingKey = Object.keys(transferMappings).find(key => key.toLowerCase() === commandName);
        
        if (mappingKey) {
          // This is a transfer mapping command - use transfer API
          try {
            const transferOptions: TransferOptions = { 
              numFiles: 1,
              command: commandName,
              currentDirectory: currentDirectory
            };
            const transferResult = await window.electronAPI.transfer(transferOptions);
            
            if (transferResult.success) {
              addLog(transferResult.message, 'response');
              setStatus('Transfer completed', 'success');
              
              // Log file operation for task timer with renamed filenames
              if (transferResult.files && transferResult.files.length > 0) {
                const dirName = currentDirectory.split('\\').pop() || currentDirectory;
                transferResult.files.forEach((file: any) => {
                  logFileOperation(`${file.name} transferred to ${dirName}`);
                });
              }
              
              // Refresh folder view
              setStatus('Refreshing folder...', 'info');
              if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
                const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
                if (typeof setFolderItems === 'function') setFolderItems(contents);
                setStatus('Folder refreshed', 'success');
              }
            } else {
              addLog(transferResult.message, 'error');
              setStatus('Transfer failed', 'error');
            }
          } catch (error) {
            addLog(`Error during transfer: ${error}`, 'error');
          }
        } else {
          // Handle other commands
          const result = await window.electronAPI.executeCommand(command, currentDirectory);
          
          if (result.success) {
            addLog(result.message, 'response');
            setStatus('Command completed', 'success');
          } else {
            addLog(result.message, 'error');
            setStatus('Command failed', 'error');
          }
        }
      }
    } catch (error) {
      addLog(`Error executing command: ${error}`, 'error');
    }

    setIsQuickNavigating(false);
    setInputValue('');
  };

  if (!isQuickNavigating) return null;
  
  // In search mode, show input centered - pointer-events: none on backdrop so clicks pass through to FileGrid
  if (isSearchMode) {
    return (
      <Box 
        position="fixed" 
        top="0" 
        left="0" 
        right="0" 
        bottom="0"
        zIndex={1999} 
        display="flex"
        alignItems="center"
        justifyContent="center"
        pointerEvents="none"
      >
        <Box 
          width="600px" 
          maxWidth="90vw" 
          borderRadius="lg" 
          border="5px solid"
          borderColor={highlightColor}
          bg="df.dialogSurface"
          position="relative"
          overflow="hidden"
          animation={isContentSearching ? pulseBorderAnimation : undefined}
          pointerEvents="auto"
        >
          <Box 
            borderRadius="lg" 
            bg="df.dialogSurface"
            width="100%"
            height="100%"
            position="relative"
            zIndex={1}
          >
            <Box borderRadius="md" overflow="hidden" position="relative" bg="df.canvas">
            <Flex align="center" p={3} minH="47px">
              <IconButton
                aria-label="Search mode"
                variant="ghost"
                size="sm"
                color="blue.400"
                onClick={() => {
                  setIsQuickNavigating(false);
                  setFileSearchFilter('');
                }}><Search size={25} strokeWidth={2} /></IconButton>
              <Input 
                ref={inputRef} 
                placeholder="Search files in current directory..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                onKeyDown={handleKeyDown} 
                variant="outline"
                borderWidth={0}
                borderColor="transparent"
                boxShadow="none"
                outline="none"
                _focus={{ outline: 'none', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' }}
                _focusVisible={{ outline: 'none', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' }}
                fontSize="md" 
                ml={2} 
                autoFocus 
                pr={isSearchMode ? "120px" : "60px"} 
                height="41px"
                bg="transparent"
                _placeholder={{ color: 'df.subtext' }}
              />
              {/* Document search toggle - inline in search mode */}
              {isSearchMode && (
                <Flex align="center" position="absolute" right={3} gap={2}>
                  <Flex align="center" gap={1}>
                    <FileText size={14} color={fileTextIconColor} />
                    <Text fontSize="sm" color={fileTextLabelColor}>
                      Contents
                    </Text>
                  </Flex>
                  <Switch.Root
                    id="document-search"
                    checked={searchInDocuments}
                    onCheckedChange={(d) => {
                      const on = d.checked === true;
                      setSearchInDocuments(on);
                      if (!on) {
                        setContentSearchResults([]);
                        setIsContentSearching(false);
                      }
                    }}
                    size="sm"
                    colorPalette="blue"
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </Flex>
              )}
            </Flex>
          </Box>
          </Box>
        </Box>
      </Box>
    );
  }
  
  /**
   * Stack around viewport center: input bar stays at 50%/50%.
   * ~half row (minH 47 + p3×2) + small gap — tune if bar height changes.
   */
  const commandInputHalf = '2.25rem';
  const commandStackGap = '0.35rem';
  /** Bottom edge of guide: 50vh + half input + gap from viewport bottom */
  const commandGuideBottom = `calc(50vh + ${commandInputHalf} + ${commandStackGap})`;
  /** Top edge of live preview: below input bottom */
  const commandPreviewTop = `calc(50% + ${commandInputHalf} + ${commandStackGap})`;

  /** Optional subtle shadow on guide + live preview only (command input bar is flat) */
  const commandPanelShadow = `0 4px 14px -2px rgba(0, 0, 0, 0.2), 0 2px 6px ${shadowColor}`;

  /** Chakra outline Input: kill default ring/border that reads as a white line in dark mode */
  const commandInputFocusProps = {
    variant: 'outline' as const,
    borderWidth: 0,
    borderColor: 'transparent',
    boxShadow: 'none',
    outline: 'none',
    _focus: { outline: 'none', boxShadow: 'none', borderWidth: 0, borderColor: 'transparent' },
    _focusVisible: {
      outline: 'none',
      boxShadow: 'none',
      borderWidth: 0,
      borderColor: 'transparent',
    },
  };

  const commandStackW = { width: '600px', maxWidth: '90vw' as const };

  /** Outer frame for guide / input / preview — thicker than inner 1px dividers */
  const commandSectionBorderWidth = '3px';

  // Command mode — 1) Command guide above center  2) Input dead-center  3) Live preview below
  return (
    <Box position="fixed" top="0" left="0" right="0" bottom="0" bg="blackAlpha.600" backdropFilter="blur(4px)" zIndex={1999} onClick={() => setIsQuickNavigating(false)}>
      {/* 1 — Command guide (title, description, usage, static help preview) */}
      {commandInfo && (
        <Box
          position="absolute"
          left="50%"
          bottom={commandGuideBottom}
          transform="translateX(-50%)"
          {...commandStackW}
          zIndex={2000}
          maxH="32vh"
          overflowY="auto"
          className="thin-scrollbar"
          borderRadius="lg"
          borderWidth={commandSectionBorderWidth}
          borderStyle="solid"
          borderColor="df.border"
          boxShadow={commandPanelShadow}
          bg="df.dialogSurface"
          onClick={e => e.stopPropagation()}
          css={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
        >
          <Box p={4} bg="df.dialogCard">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              {commandInfo.title}
            </Text>
            <Text fontSize="xs" color="df.subtext" mb={1}>
              {commandInfo.description}
            </Text>
            <Flex
              align="center"
              bg="df.tableHeader"
              p={2}
              borderRadius="md"
              mt={2}
              border="1px solid"
              borderColor="df.border"
            >
              <Flex align="center">
                <ChevronRight size={12} color={commandInfoChevronColor} strokeWidth={2} />
                <Text fontSize="xs" fontFamily="monospace" color={commandInfoUsageTextColor} ml={1}>
                  {commandInfo.usage.replace('> ', '')}
                </Text>
              </Flex>
            </Flex>
          </Box>
          {commandInfo.preview && (
            <Box p={4} pt={0} bg="df.dialogCard">
              <Separator my={3} />
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {commandInfo.preview.title}
              </Text>
              <Box>
                {commandInfo.preview.items.map((item, index) => (
                  <Flex key={index} align="center" py={1}>
                    <ChevronRight size={10} color={previewChevronColor} strokeWidth={2} />
                    <Text fontSize="xs" ml={2}>
                      {item.name} {item.size && `(${item.size})`}
                    </Text>
                  </Flex>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* 2 — Input bar: viewport center (50%, 50%) */}
      <Box
        position="absolute"
        left="50%"
        top="50%"
        transform="translate(-50%, -50%)"
        {...commandStackW}
        zIndex={2001}
        borderRadius="lg"
        borderWidth={commandSectionBorderWidth}
        borderStyle="solid"
        borderColor="df.border"
        boxShadow="none"
        bg="df.dialogSurface"
        overflow="hidden"
        onClick={e => e.stopPropagation()}
        css={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        <Box bg="df.canvas" css={{ outline: 'none' }}>
          <Flex align="center" p={3} minH="47px" position="relative">
            <IconButton
              aria-label="Command mode"
              variant="ghost"
              size="sm"
              color="blue.400"
              outline="none"
              _focusVisible={{ outline: 'none', boxShadow: 'none' }}
              onClick={() => setIsQuickNavigating(false)}><ChevronRight size={25} strokeWidth={2} /></IconButton>
            <Input 
              ref={inputRef} 
              placeholder="Enter command... (Enter=Execute, Backspace=Up)" 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              onKeyDown={handleKeyDown} 
              {...commandInputFocusProps}
              fontSize="md" 
              ml={2} 
              autoFocus 
              pr="60px" 
              height="41px"
              bg="transparent"
              _placeholder={{ color: 'df.subtext' }}
            />
          </Flex>
        </Box>
      </Box>

      {/* 3 — Live preview (IPC result only) */}
      {previewFiles.length > 0 && (
        <Box
          position="absolute"
          left="50%"
          top={commandPreviewTop}
          transform="translateX(-50%)"
          {...commandStackW}
          zIndex={2000}
          maxH="38vh"
          overflowY="auto"
          className="thin-scrollbar"
          borderRadius="lg"
          borderWidth={commandSectionBorderWidth}
          borderStyle="solid"
          borderColor="df.border"
          boxShadow={commandPanelShadow}
          bg="df.dialogSurface"
          onClick={e => e.stopPropagation()}
          css={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
        >
          <Box p={4} bg="df.dialogCard">
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              {(() => {
                const cmdText = inputValue.trim().toLowerCase();
                if (cmdText.startsWith('sc')) return `Screenshot to transfer:`;
                if (cmdText === 'pdfinc') return `PDF merge operations:`;
                if (cmdText.startsWith('finals')) return `Files to rename:`;
                if (cmdText.startsWith('edsby')) return `Files to rename:`;
                return `Preview of ${previewFiles.length} file${previewFiles.length > 1 ? 's' : ''} to transfer:`;
              })()}
            </Text>
            <Box display="flex" flexDirection="column" gap={2}>
              {previewFiles.map((file, index) => (
                <Box
                  key={index}
                  fontSize="sm"
                  borderRadius="md"
                  bg="df.canvas"
                  px={3}
                  py={2}
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor="df.border"
                  w="100%"
                  overflow="visible"
                  display="flex"
                  flexDirection="column"
                  gap={1}
                >
                  <Text whiteSpace="normal" wordBreak="break-all" title={file.originalName || file.name} fontWeight="medium" overflow="visible">
                    {file.originalName && file.originalName !== file.name ? file.originalName : file.name}
                  </Text>
                  <Text whiteSpace="normal" wordBreak="break-all" color="green.400" title={file.name} fontWeight="medium" overflow="visible">
                    {file.originalName && file.originalName !== file.name ? file.name : ''}
                  </Text>
                  {file.type === 'image' && (file as any).imageDataUrl && (
                    <Box mt={2} display="flex" justifyContent="center">
                      <Box
                        asChild
                        borderWidth="1px"
                        borderStyle="solid"
                        borderColor="df.border"
                        borderRadius="sm"
                        overflow="hidden"
                        display="inline-block"
                        lineHeight={0}
                      >
                        <img
                          src={(file as any).imageDataUrl}
                          alt="Screenshot preview"
                          style={{
                            maxWidth: '200px',
                            maxHeight: '150px',
                            objectFit: 'contain',
                            display: 'block',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};