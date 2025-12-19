import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Input, Text, Flex, Icon, useColorModeValue, Divider, IconButton, Switch, FormControl, FormLabel } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { ChevronRight, Search, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { FileItem, TransferOptions } from '../types';
import { joinPath, isAbsolutePath } from '../utils/path'
import { fileSearchService } from '../services/fileSearch';

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
    searchResults,
    setSearchResults,
    logFileOperation,
    fileSearchFilter,
    setFileSearchFilter,
    contentSearchResults,
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchInDocuments, setSearchInDocuments] = useState(false);
  const [localSearchResults, setLocalSearchResults] = useState<FileItem[]>([]);
  const [isContentSearching, setIsContentSearching] = useState(false);

  // All useRef hooks next
  const inputRef = useRef<HTMLInputElement>(null);

  // All useColorModeValue hooks next
  const bgColor = useColorModeValue('#ffffff', 'gray.800');
  const inputBgColor = useColorModeValue('#ffffff', 'gray.900');
  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');
  const commandBgColor = useColorModeValue('#f8fafc', 'gray.700');
  const highlightColor = useColorModeValue('blue.400', 'blue.500');
  const fileTextIconColor = useColorModeValue('gray.500', 'gray.400');
  const fileTextLabelColor = useColorModeValue('gray.600', 'gray.300');
  
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

  // Search functionality
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setLocalSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (searchInDocuments) {
        // Document search - search inside PDF files
        const result = await window.electronAPI.searchInDocuments({
          query,
          currentDirectory,
          maxResults: 20
        });
        setLocalSearchResults(result || []);
      } else {
        // File search - search file names
        const result = await fileSearchService.search({
          query,
          currentDirectory,
          maxResults: 20,
          recursive: true
        });
        setLocalSearchResults(result.results);
      }
    } catch (error) {
      setLocalSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentDirectory, searchInDocuments]);

  const handleTransferPreview = useCallback(async (numFiles: number) => {
    try {
      const previewOptions: TransferOptions = { 
        numFiles,
        command: 'preview',
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

  // Re-trigger command info update and preview when mappings are loaded/updated
  useEffect(() => {
    if (Object.keys(transferMappings).length > 0 && inputValue) {
      const commandText = inputValue.trim().toLowerCase();
      handleCommandInfoUpdate(commandText);
      
      // Also re-trigger preview if the current command is a mapping command
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
  }, [transferMappings, inputValue, handleTransferMappingPreview]);

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
      console.log('[QuickNavigateOverlay] Key pressed:', e.key, {
        ctrlKey: e.ctrlKey,
        target: (e.target as HTMLElement)?.tagName,
        isQuickNavigating,
      });
      
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        console.log('[QuickNavigateOverlay] Ctrl+F detected - opening quick navigate');
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

  const debouncedCommandProcessing = useCallback(
    debounce((commandText: string, inputValue: string) => {
      if (!commandText) {
        setCommandInfo(null);
        setPreviewFiles([]);
        return;
      }
      
      // Get the latest mappings from ref to avoid stale closure
      const currentMappings = transferMappingsRef.current;
      
      handleCommandInfoUpdate(commandText);
      
      // Auto-preview for transfer commands (including mapping commands)
      const commandParts = commandText.split(' ');
      const command = commandParts[0];
      const mappingKey = Object.keys(currentMappings).find(key => key.toLowerCase() === command.toLowerCase());
      
      if (commandText.startsWith('transfer ')) {
        // Parse argument, supporting quoted strings
        const match = inputValue.trim().match(/^transfer\s+(?:"([^"]+)"|'([^']+)'|(\S+))?/i);
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
        // Always call preview API for transfer command
        window.electronAPI.transfer({
          numFiles,
          newName,
          command: 'preview',
          currentDirectory
        }).then((previewResult: any) => {
          if (previewResult.success && previewResult.files) {
            setPreviewFiles(previewResult.files);
          } else {
            setPreviewFiles([]);
          }
        }).catch(() => setPreviewFiles([]));
      } else if (mappingKey) {
        // Auto-preview for mapping commands
        handleTransferMappingPreview(command);
      } else if (command === 'finals') {
        // Auto-preview for finals command
        window.electronAPI.executeCommand('finals_preview', currentDirectory).then((previewResult: any) => {
          if (previewResult.success && previewResult.files) {
            setPreviewFiles(previewResult.files);
          } else {
            setPreviewFiles([]);
          }
        }).catch(() => setPreviewFiles([]));
      } else if (command === 'edsby') {
        // Auto-preview for edsby command
        let period = commandParts.slice(1).join(' ').trim();
        if ((period.startsWith('"') && period.endsWith('"')) || (period.startsWith("'") && period.endsWith("'"))) {
          period = period.slice(1, -1);
        }
        window.electronAPI.executeCommand('edsby_preview', currentDirectory, { period }).then((previewResult: any) => {
          if (previewResult.success && previewResult.files) {
            setPreviewFiles(previewResult.files);
          } else {
            setPreviewFiles([]);
          }
        }).catch(() => setPreviewFiles([]));
      } else if (command === 'pdfinc') {
        // Auto-preview for pdfinc command
        window.electronAPI.executeCommand('pdfinc_preview', currentDirectory).then((previewResult: any) => {
          if (previewResult.success && previewResult.files) {
            setPreviewFiles(previewResult.files);
          } else {
            setPreviewFiles([]);
          }
        }).catch(() => setPreviewFiles([]));
      } else if (command === 'sc') {
        // Auto-preview for sc (screenshot) command
        let newName: string | undefined;
        if (commandParts.length > 1) {
          newName = commandParts.slice(1).join(' ').trim();
          // Remove quotes if present
          if ((newName.startsWith('"') && newName.endsWith('"')) || (newName.startsWith("'") && newName.endsWith("'"))) {
            newName = newName.slice(1, -1);
          }
        }
        
        window.electronAPI.executeCommand('sc_preview', currentDirectory, { newName }).then((previewResult: any) => {
          if (previewResult.success && previewResult.files) {
            setPreviewFiles(previewResult.files);
          } else {
            setPreviewFiles([]);
          }
        }).catch(() => setPreviewFiles([]));
      } else {
        setPreviewFiles([]); // Clear preview for non-transfer commands
      }
    }, 300), // 300ms debounce delay
    [handleTransferMappingPreview, currentDirectory, setPreviewFiles]
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
        // Clear content search results when content search is disabled or query is empty
        setContentSearchResults([]);
        setIsContentSearching(false);
      }
    } else {
      // Command mode - handle command input with debouncing
      if (!inputValue) {
        setCommandInfo(null);
        setPreviewFiles([]); // Clear preview when input is empty
        return;
      }
      
      const commandText = inputValue.trim().toLowerCase();
      debouncedCommandProcessing(commandText, inputValue);
      
      // Clear content search results in command mode
      setContentSearchResults([]);
    }
  }, [inputValue, searchQuery, isSearchMode, searchInDocuments, currentDirectory, debouncedCommandProcessing, performSearch, setContentSearchResults]);

  // Sync search results to filtered results for display
  useEffect(() => {
    // This useEffect is no longer needed as search functionality is removed
  }, []);

  const handleCommandInfoUpdate = (commandText: string) => {
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
    
    // Check for transfer mapping commands
    const mappingKey = Object.keys(transferMappings).find(key => {
      const matches = key.toLowerCase() === command.toLowerCase();
      return matches;
    });
    
    if (mappingKey) {
      setCommandInfo({
        title: `Transfer Mapping: ${mappingKey}`,
        description: `Transfer file(s) using mapping: ${transferMappings[mappingKey]}`,
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
  };
  const navigateHistory = (direction: number) => {
    const newIndex = historyIndex + direction;
    if (newIndex >= -1 && newIndex < commandHistory.length) {
      setHistoryIndex(newIndex);
      setInputValue(newIndex === -1 ? '' : commandHistory[newIndex]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('[QuickNavigateOverlay] Input keyDown:', e.key, {
      isQuickNavigating,
      isSearchMode,
      target: (e.target as HTMLElement)?.tagName,
    });
    
    if (e.key === 'Escape') {
      console.log('[QuickNavigateOverlay] Escape pressed - closing');
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
      if (isSearchMode) {
        // Navigate search results
        // TODO: Implement search result navigation
      } else {
        navigateHistory(-1);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isSearchMode) {
        // Navigate search results
        // TODO: Implement search result navigation
      } else {
        navigateHistory(1);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (isSearchMode) {
        // TODO: Implement search result selection
      }
      // No results to navigate in command mode
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
  
  // In search mode, show input centered without overlay/blur
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
        onClick={() => {
          setIsQuickNavigating(false);
          setFileSearchFilter('');
        }}
      >
        <Box 
          width="600px" 
          maxWidth="90vw" 
          borderRadius="lg" 
          border="5px solid"
          borderColor={highlightColor}
          bg={bgColor}
          onClick={e => e.stopPropagation()}
          position="relative"
          overflow="hidden"
          animation={isContentSearching ? pulseBorderAnimation : undefined}
        >
          <Box 
            borderRadius="lg" 
            bg={bgColor}
            width="100%"
            height="100%"
            position="relative"
            zIndex={1}
          >
            <Box borderRadius="md" overflow="hidden" position="relative" bg={inputBgColor}>
            <Flex align="center" p={3} minH="47px">
              <IconButton 
                icon={<Search size={25} strokeWidth={2} />} 
                aria-label="Search mode" 
                variant="ghost" 
                size="sm" 
                color="blue.400" 
                onClick={() => {
                  setIsQuickNavigating(false);
                  setFileSearchFilter('');
                }} 
              />
              <Input 
                ref={inputRef} 
                placeholder="Search files in current directory..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                onKeyDown={handleKeyDown} 
                variant="unstyled" 
                fontSize="md" 
                ml={2} 
                autoFocus 
                pr={isSearchMode ? "120px" : "60px"} 
                height="41px"
                bg={inputBgColor}
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
                  <Switch 
                    id="document-search" 
                    isChecked={searchInDocuments}
                    onChange={(e) => {
                      setSearchInDocuments(e.target.checked);
                      // Clear content search results when disabled
                      if (!e.target.checked) {
                        setContentSearchResults([]);
                        setIsContentSearching(false);
                      }
                    }}
                    size="sm"
                    colorScheme="blue"
                  />
                </Flex>
              )}
            </Flex>
          </Box>
          </Box>
        </Box>
      </Box>
    );
  }
  
  // Command mode - show centered overlay with blur
  return <Box position="fixed" top="0" left="0" right="0" bottom="0" bg="blackAlpha.600" backdropFilter="blur(4px)" zIndex={1999} display="flex" alignItems="center" justifyContent="center" onClick={() => setIsQuickNavigating(false)}>
      {/* Absolute centered input container */}
      <Box position="absolute" top="44%" left="50%" transform="translate(-50%, -50%)" width="600px" maxWidth="90vw" borderRadius="lg" boxShadow="0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" bg={bgColor} onClick={e => e.stopPropagation()}>
        {/* Input container */}
        <Box borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" position="relative">
          <Flex align="center" p={3} minH="47px">
            <IconButton 
              icon={isSearchMode ? <Search size={25} strokeWidth={2} /> : <ChevronRight size={25} strokeWidth={2} />} 
              aria-label={isSearchMode ? "Search mode" : "Command mode"} 
              variant="ghost" 
              size="sm" 
              color="blue.400" 
              onClick={() => setIsQuickNavigating(false)} 
            />
            <Input 
              ref={inputRef} 
              placeholder={isSearchMode ? "Search files..." : "Enter command... (Enter=Execute, Backspace=Up)"} 
              value={isSearchMode ? searchQuery : inputValue} 
              onChange={e => {
                if (isSearchMode) {
                  setSearchQuery(e.target.value);
                } else {
                  setInputValue(e.target.value);
                }
              }} 
              onKeyDown={handleKeyDown} 

              variant="unstyled" 
              fontSize="md" 
              ml={2} 
              autoFocus 
              pr={isSearchMode ? "120px" : "60px"} 
              height="41px" 
            />
            {/* Document search toggle - inline in search mode */}
            {isSearchMode && (
              <Flex align="center" position="absolute" right={3} gap={2}>
                <Flex align="center" gap={1}>
                  <FileText size={14} color={useColorModeValue('gray.500', 'gray.400')} />
                  <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                    Contents
                  </Text>
                </Flex>
                <Switch 
                  id="document-search" 
                  isChecked={searchInDocuments}
                  onChange={(e) => {
                    setSearchInDocuments(e.target.checked);
                    // Clear content search results when disabled
                    if (!e.target.checked) {
                      setContentSearchResults([]);
                      setIsContentSearching(false);
                    }
                  }}
                  size="sm"
                  colorScheme="blue"
                />
              </Flex>
            )}
          </Flex>
        </Box>
        {/* Search error indicator */}
        {/* Removed as search functionality is removed */}
        {/* Command info panel - separate from input container */}
        {commandInfo && (
          <Box position="absolute" top="calc(50% + 32px)" left="50%" transform="translate(-50%, 0)" width="600px" maxWidth="90vw" bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={1} className="thin-scrollbar" maxH="300px" overflowY="auto" onClick={e => e.stopPropagation()}>
            <Box p={4} bg={commandBgColor}>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {commandInfo.title}
              </Text>
              <Text fontSize="xs" color="gray.500" mb={1}>
                {commandInfo.description}
              </Text>
                              <Flex align="center" bg={useColorModeValue('#f1f5f9', 'gray.900')} p={2} borderRadius="md" mt={2} border="1px solid" borderColor={useColorModeValue('#d1d5db', 'gray.700')}>
                  <Flex align="center">
                    <ChevronRight size={12} color={useColorModeValue('#3b82f6', '#63B3ED')} strokeWidth={2} />
                    <Text fontSize="xs" fontFamily="monospace" color={useColorModeValue('#3b82f6', 'blue.300')} ml={1}>
                    {commandInfo.usage.replace('> ', '')}
                  </Text>
                </Flex>
              </Flex>
            </Box>
            {commandInfo.preview && (
              <Box p={4} pt={0}>
                <Divider my={3} />
                <Text fontSize="sm" fontWeight="medium" mb={2}>
                  {commandInfo.preview.title}
                </Text>
                <Box>
                  {commandInfo.preview.items.map((item, index) => (
                    <Flex key={index} align="center" py={1}>
                      <ChevronRight size={10} color={useColorModeValue('#64748b', '#718096')} strokeWidth={2} />
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
        {/* Search results panel removed - filtering is now done in FileGrid */}
        {/* Preview files panel - shows actual files to be transferred */}
        {previewFiles.length > 0 && (
          <Box position="absolute" top="calc(50% + 32px)" left="50%" transform="translate(-50%, 0)" width="600px" maxWidth="90vw" bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={1} onClick={e => e.stopPropagation()}>
            <Box p={4} bg={commandBgColor}>
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
              <Box maxH="320px" overflowY="auto" display="flex" flexDirection="column" gap={2}>
                {previewFiles.map((file, index) => (
                  <Box
                    key={index}
                    fontSize="sm"
                    borderRadius="lg"
                    bg={useColorModeValue('gray.100', 'gray.700')}
                    px={3}
                    py={2}
                    boxShadow="sm"
                    borderWidth="1px"
                    borderColor={useColorModeValue('gray.200', 'gray.600')}
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
                    {/* Show image preview for image files */}
                    {file.type === 'image' && (file as any).imageDataUrl && (
                      <Box mt={2} display="flex" justifyContent="center">
                        <img 
                          src={(file as any).imageDataUrl}
                          alt="Screenshot preview"
                          style={{
                            maxWidth: '200px',
                            maxHeight: '150px',
                            borderRadius: '4px',
                            border: '1px solid #e2e8f0',
                            objectFit: 'contain'
                          }}
                          onError={(e) => {
                            // Hide image if it fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
        {/* Search results - now always inside modal, below input */}
        {/* Removed as search functionality is removed */}
        {/* No results message */}
        {/* Removed as search functionality is removed */}
      </Box>
    </Box>;
};