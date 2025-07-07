import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Input, Text, Flex, Icon, useColorModeValue, List, ListItem, Divider, IconButton } from '@chakra-ui/react';
import { File, FolderOpen, Search, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useFileSearch } from '../hooks/useFileSearch';
import type { FileItem, TransferOptions } from '../types';
import { joinPath, isAbsolutePath } from '../utils/path'


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
    commandHistory,
    setStatus,
    setFolderItems
  } = useAppContext();

  // File search hook
  const {
    results: searchResultsList,
    isLoading: isSearching,
    error: searchError,
    search: performSearch,
    clearResults
  } = useFileSearch({
    currentDirectory,
    maxResults: 12, // Increase results for better coverage
    debounceMs: 75  // Faster response - reduce from 200ms to 75ms
  });

  // All useState hooks next
  const [inputValue, setInputValue] = useState('');
  const [filteredResults, setFilteredResults] = useState<FileItem[]>([]);
  const [isCommandMode, setIsCommandMode] = useState(false);
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

  // All useRef hooks next
  const inputRef = useRef<HTMLInputElement>(null);

  // All useColorModeValue hooks next
  const bgColor = useColorModeValue('#ffffff', 'gray.800');

  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');
  const commandBgColor = useColorModeValue('#f8fafc', 'gray.700');

  // All useCallback hooks for functions used in useEffect
  const handleTransferMappingPreview = useCallback(async (command: string) => {
    try {
      console.log('[QuickNavigate] Auto-requesting mapping preview for command:', command);
      const previewOptions: TransferOptions = { 
        numFiles: 1,
        command: command, // Pass the actual command for mapping lookup
        preview: true, // Enable preview mode - doesn't actually transfer files
        currentDirectory: currentDirectory
      };
      const previewResult = await window.electronAPI.transfer(previewOptions);
      console.log('[QuickNavigate] Mapping preview result:', previewResult);
      
      if (previewResult.success && previewResult.files) {
        console.log('[QuickNavigate] Mapping preview successful, updating preview pane');
        setPreviewFiles(previewResult.files);
      } else {
        console.log('[QuickNavigate] Mapping preview failed:', previewResult.message);
        setPreviewFiles([]);
      }
    } catch (error) {
      console.error('[QuickNavigate] Error during mapping preview:', error);
      setPreviewFiles([]);
    }
  }, [currentDirectory, setPreviewFiles]);

  const handleTransferPreview = useCallback(async (numFiles: number) => {
    try {
      console.log('[QuickNavigate] Auto-requesting transfer preview for', numFiles, 'files');
      const previewOptions: TransferOptions = { 
        numFiles,
        command: 'preview',
        currentDirectory: currentDirectory
      };
      const previewResult = await window.electronAPI.transfer(previewOptions);
      console.log('[QuickNavigate] Auto-preview result:', previewResult);
      
      if (previewResult.success && previewResult.files) {
        console.log('[QuickNavigate] Auto-preview successful, updating preview pane');
        setPreviewFiles(previewResult.files);
      } else {
        console.log('[QuickNavigate] Auto-preview failed:', previewResult.message);
        setPreviewFiles([]);
      }
    } catch (error) {
      console.error('[QuickNavigate] Error during auto-preview:', error);
      setPreviewFiles([]);
    }
  }, [currentDirectory, setPreviewFiles]);

  // Fetch transfer mappings on mount
  useEffect(() => {
    (async () => {
      try {
        const config = await (window.electronAPI as any).getConfig();
        console.log('[QuickNavigate] Raw config result:', config);
        // Extract just the transferCommandMappings part
        const mappings = config?.transferCommandMappings || {};
        console.log('[QuickNavigate] Extracted transfer mappings:', mappings);
        setTransferMappings(mappings);
      } catch (error) {
        console.error('[QuickNavigate] Error loading transfer mappings:', error);
        setTransferMappings({});
      }
    })();
  }, []);

  // Re-trigger command info update when mappings are loaded
  useEffect(() => {
    if (Object.keys(transferMappings).length > 0 && inputValue && isCommandMode) {
      const commandText = inputValue.trim().toLowerCase();
      handleCommandInfoUpdate(commandText);
    }
  }, [transferMappings]);

  // Focus input when overlay opens and set initial mode
  useEffect(() => {
    if (isQuickNavigating && inputRef.current) {
      inputRef.current.focus();
      // Set command mode only if explicitly triggered with Ctrl+Space
      console.log('[QuickNavigate] Setting mode - initialCommandMode:', initialCommandMode);
      setIsCommandMode(initialCommandMode);
      setInputValue('');
    } else if (!isQuickNavigating) {
      // Clear everything when overlay closes
      setInputValue('');
      setFilteredResults([]);
      clearResults();
      setCommandInfo(null);
      setPreviewFiles([]);
    }
  }, [isQuickNavigating, initialCommandMode, clearResults, setPreviewFiles]);

  // Process input changes
  useEffect(() => {
    if (!inputValue) {
      setFilteredResults([]);
      setCommandInfo(null);
      setPreviewFiles([]); // Clear preview when input is empty
      if (isCommandMode) {
        setCommandInfo({
          title: 'Command Info',
          description: 'Type a command to execute',
          usage: '[command] [arguments]'
        });
      } else {
        setCommandInfo(null);
      }
      return;
    }
    if (isCommandMode) {
      const commandText = inputValue.trim().toLowerCase();
      handleCommandInfoUpdate(commandText);
      setFilteredResults([]);
      
      // Auto-preview for transfer commands (including mapping commands)
      const commandParts = commandText.split(' ');
      const command = commandParts[0];
      const mappingKey = Object.keys(transferMappings).find(key => key.toLowerCase() === command.toLowerCase());
      
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
      } else {
        setPreviewFiles([]); // Clear preview for non-transfer commands
      }
    } else {
      // Regular search mode - use real file search
      if (inputValue.trim()) {
        performSearch(inputValue);
      } else {
        setFilteredResults([]);
        clearResults();
      }
      setCommandInfo(null);
      setPreviewFiles([]); // Clear preview in search mode
    }
  }, [inputValue, isCommandMode, transferMappings, handleTransferPreview, handleTransferMappingPreview, performSearch, clearResults]);

  // Sync search results to filtered results for display
  useEffect(() => {
    if (!isCommandMode && searchResultsList.length > 0) {
      setFilteredResults(searchResultsList.slice(0, 10)); // Show more results
    }
  }, [searchResultsList, isCommandMode]);

  const handleCommandInfoUpdate = (commandText: string) => {
    console.log('[QuickNavigate] handleCommandInfoUpdate called with commandText:', commandText);
    console.log('[QuickNavigate] transferMappings object:', transferMappings);
    console.log('[QuickNavigate] transferMappings keys:', Object.keys(transferMappings));
    
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
    console.log('[QuickNavigate] Parsed command:', command);
    
    // Check for transfer mapping commands
    const mappingKey = Object.keys(transferMappings).find(key => {
      console.log('[QuickNavigate] Checking key:', key, 'against command:', command);
      console.log('[QuickNavigate] key.toLowerCase():', key.toLowerCase(), 'command.toLowerCase():', command.toLowerCase());
      const matches = key.toLowerCase() === command.toLowerCase();
      console.log('[QuickNavigate] Match result:', matches);
      return matches;
    });
    console.log('[QuickNavigate] Final mappingKey found:', mappingKey);
    
    if (mappingKey) {
      console.log('[QuickNavigate] Setting transfer mapping command info');
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
  const toggleCommandMode = () => {
    setIsCommandMode(!isCommandMode);
    setInputValue('');
    if (!isCommandMode) {
      setCommandInfo({
        title: 'Command Info',
        description: 'Type a command to execute',
        usage: '[command] [arguments]'
      });
    } else {
      setCommandInfo(null);
    }
    inputRef.current?.focus();
  };
  const navigateHistory = (direction: number) => {
    const newIndex = historyIndex + direction;
    if (newIndex >= -1 && newIndex < commandHistory.length) {
      setHistoryIndex(newIndex);
      setInputValue(newIndex === -1 ? '' : commandHistory[newIndex]);
    }
  };

  const handleResultSelection = async (result: FileItem) => {
    if (result.type === 'folder') {
      setCurrentPath(isAbsolutePath(result.path) ? result.path : joinPath(result.path));
      addLog(`Changed directory to: ${result.path}`);
      setStatus(`Navigated to: ${result.name}`, 'info');
    } else {
      try {
        if (window.electronAPI && (window.electronAPI as any).openFile) {
          await (window.electronAPI as any).openFile(result.path);
          addLog(`Opened file: ${result.path}`);
          setStatus(`Opened: ${result.name}`, 'success');
        } else {
          addLog(`Cannot open file: ${result.path} - API not available`, 'error');
          setStatus(`Failed to open: ${result.name}`, 'error');
        }
      } catch (error) {
        addLog(`Failed to open file: ${result.path} - ${error}`, 'error');
        setStatus(`Failed to open: ${result.name}`, 'error');
      }
    }
    // Always close overlay after selection
    setIsQuickNavigating(false);
    setInputValue('');
    clearResults();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsQuickNavigating(false);
      setInputValue('');
      clearResults();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If in search mode and we have results, navigate to first result
      if (!isCommandMode && filteredResults.length > 0) {
        const firstResult = filteredResults[0];
        handleResultSelection(firstResult);
      } else if (isCommandMode) {
        // Execute command in command mode
        executeCommand();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        const firstResult = filteredResults[0];
        handleResultSelection(firstResult);
      }
    }
  };
  const executeCommand = async () => {
    const command = inputValue.trim();
    if (!command) return;
    
    console.log('[QuickNavigate] Executing command:', command);
    addLog(`$ ${command}`, 'command');
    addCommand(command);
    setStatus(`Executing: ${command}`, 'info');

    try {
      // For transfer commands, get preview first
      if (command.toLowerCase().startsWith('transfer')) {
        console.log('[QuickNavigate] Detected transfer command');
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
        console.log('[QuickNavigate] Parsed transfer args:', { numFiles, newName });
        try {
          // Get preview first
          console.log('[QuickNavigate] Requesting transfer preview...');
          const previewOptions: TransferOptions = { 
            numFiles,
            newName,
            command: 'preview',
            currentDirectory: currentDirectory
          };
          const previewResult = await window.electronAPI.transfer(previewOptions);
          console.log('[QuickNavigate] Preview result:', previewResult);
          
          if (previewResult.success && previewResult.files) {
            console.log('[QuickNavigate] Preview successful, updating preview pane');
            // Update preview pane
            setPreviewFiles(previewResult.files);
            
            // Now execute the actual transfer
            console.log('[QuickNavigate] Executing transfer...');
            const transferOptions: TransferOptions = { 
              numFiles,
              newName,
              command: 'transfer',
              currentDirectory: currentDirectory
            };
            const transferResult = await window.electronAPI.transfer(transferOptions);
            console.log('[QuickNavigate] Transfer result:', transferResult);
            
            if (transferResult.success) {
              console.log('[QuickNavigate] Transfer successful');
              addLog(transferResult.message, 'response');
              setStatus('Transfer completed', 'success');
              // Refresh folder view
              setStatus('Refreshing folder...', 'info');
              if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
                const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
                if (typeof setFolderItems === 'function') setFolderItems(contents);
                setStatus('Folder refreshed', 'success');
              }
            } else {
              console.log('[QuickNavigate] Transfer failed:', transferResult.message);
              addLog(transferResult.message, 'error');
              setStatus('Transfer failed', 'error');
            }
          } else {
            console.log('[QuickNavigate] Preview failed:', previewResult.message);
            addLog(previewResult.message, 'error');
          }
        } catch (error) {
          console.error('[QuickNavigate] Error during transfer:', error);
          addLog(`Error during transfer: ${error}`, 'error');
        }
      } else if (command === 'finals') {
        // Handle finals command with folder refresh
        console.log('[QuickNavigate] Executing finals command');
        console.log('[QuickNavigate] Current directory:', currentDirectory);
        
        const result = await window.electronAPI.executeCommand(command, currentDirectory);
        console.log('[QuickNavigate] Finals command execution result:', result);
        
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
        console.log('[QuickNavigate] Executing edsby command');
        let period = command.split(' ').slice(1).join(' ').trim();
        if ((period.startsWith('"') && period.endsWith('"')) || (period.startsWith("'") && period.endsWith("'"))) {
          period = period.slice(1, -1);
        }
        const result = await window.electronAPI.executeCommand('edsby', currentDirectory, { period });
        console.log('[QuickNavigate] Edsby command execution result:', result);
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
        console.log('[QuickNavigate] Executing pdfinc command');
        const result = await window.electronAPI.executeCommand(command, currentDirectory);
        console.log('[QuickNavigate] PDFInc command execution result:', result);
        
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
        // Handle other commands
        console.log('[QuickNavigate] Executing non-transfer command');
        const result = await window.electronAPI.executeCommand(command, currentDirectory);
        console.log('[QuickNavigate] Command execution result:', result);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('Command completed', 'success');
        } else {
          addLog(result.message, 'error');
          setStatus('Command failed', 'error');
        }
      }
    } catch (error) {
      console.error('[QuickNavigate] Error executing command:', error);
      addLog(`Error executing command: ${error}`, 'error');
    }

    setIsQuickNavigating(false);
    setInputValue('');
  };

  if (!isQuickNavigating) return null;
  return <Box position="fixed" top="0" left="0" right="0" bottom="0" bg="rgba(0,0,0,0.3)" zIndex={1999} display="flex" alignItems="center" justifyContent="center" onClick={() => setIsQuickNavigating(false)}>
      {/* Absolute centered input container */}
      <Box position="absolute" top="44%" left="50%" transform="translate(-50%, -50%)" width="600px" maxWidth="90vw" borderRadius="lg" boxShadow="0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)" bg={bgColor} onClick={e => e.stopPropagation()}>
        {/* Input container */}
        <Box borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" position="relative">
          <Flex align="center" p={3} minH="47px">
            <IconButton icon={isCommandMode ? <ChevronRight size={25} strokeWidth={2} /> : <Search size={18} />} aria-label={isCommandMode ? 'Command mode' : 'Search mode'} variant="ghost" size="sm" color="blue.400" onClick={toggleCommandMode} />
            <Input 
              ref={inputRef} 
              placeholder={isCommandMode ? 'Enter command...' : 'Type to search files and folders... (Enter=Navigate, Backspace=Up)'} 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              onKeyDown={handleKeyDown} 

              variant="unstyled" 
              fontSize="md" 
              ml={2} 
              autoFocus 
              pr="60px" 
              height="41px" 
            />
          </Flex>
        </Box>
        {/* Search error indicator */}
        {!isCommandMode && searchError && (
          <Box position="absolute" top="calc(50% + 32px)" left="50%" transform="translate(-50%, 0)" width="600px" maxWidth="90vw" bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={1} p={4} onClick={e => e.stopPropagation()}>
            <Text fontSize="sm" color="red.500">Search failed: {searchError}</Text>
          </Box>
        )}
        {/* Command info panel - separate from input container */}
        {isCommandMode && commandInfo && (
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
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
        {/* Search results - now always inside modal, below input */}
        {!isCommandMode && filteredResults.length > 0 && <Box position="absolute" top="calc(50% + 32px)" left="50%" transform="translate(-50%, 0)" width="600px" maxWidth="90vw" bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} zIndex="1" overflow="hidden" mt={2} className="enhanced-scrollbar" maxH="300px" overflowY="auto" onClick={e => e.stopPropagation()}>
            <List spacing={0}>
              {filteredResults.map((result, index) => <ListItem key={index} p={2} bg={index === 0 ? useColorModeValue('#eff6ff', 'blue.900') : 'transparent'} cursor="pointer" _hover={{
            bg: useColorModeValue('#f8fafc', 'gray.700')
          }} onClick={() => handleResultSelection(result)}>
                  <Flex align="center">
                    <Icon as={result.type === 'folder' ? FolderOpen : File} color={result.type === 'folder' ? 'blue.400' : 'gray.400'} boxSize={4} mr={3} />
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight={index === 0 ? 'medium' : 'normal'}>
                        {result.name}
                      </Text>
                      <Flex align="center" gap={2}>
                        <Text fontSize="xs" color="gray.500" flex="1" isTruncated>
                          {result.path}
                        </Text>
                        {result.type !== 'folder' && result.size && String(result.size) !== '0' && String(result.size).trim() !== '' && (
                          <Text fontSize="xs" color="gray.400">
                            {result.size}
                          </Text>
                        )}
                      </Flex>
                    </Box>
                    {index === 0 && <Text fontSize="xs" color="gray.500" ml={2}>
                        Press Enter to open
                      </Text>}
                  </Flex>
                </ListItem>)}
            </List>
          </Box>}
        {/* No results message */}
        {!isCommandMode && inputValue.trim() && !isSearching && filteredResults.length === 0 && (
          <Box position="absolute" top="calc(50% + 32px)" left="50%" transform="translate(-50%, 0)" width="600px" maxWidth="90vw" bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={2} p={4} onClick={e => e.stopPropagation()}>
            <Text fontSize="sm" color="gray.500" textAlign="center">
              No files or folders found for "{inputValue}"
            </Text>
          </Box>
        )}
      </Box>
    </Box>;
};