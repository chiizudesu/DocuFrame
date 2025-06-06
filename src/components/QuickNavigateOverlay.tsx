import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Input, Text, Flex, Icon, useColorModeValue, List, ListItem, Divider, IconButton } from '@chakra-ui/react';
import { File, FolderOpen, Search, DollarSign } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import type { FileItem, TransferOptions } from '../types';
import { joinPath, isAbsolutePath } from '../utils/path'

export const QuickNavigateOverlay: React.FC = () => {
  // All useContext hooks first
  const {
    rootDirectory: rootPath,
    setRootDirectory: setRootPath,
    setCurrentDirectory: setCurrentPath,
    setPreviewFiles,
    previewFiles,
    addLog,
    addCommand,
    allFiles,
    initialCommandMode,
    isQuickNavigating,
    setIsQuickNavigating,
    commandHistory
  } = useAppContext();

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

  // All useRef hooks next
  const inputRef = useRef<HTMLInputElement>(null);

  // All useColorModeValue hooks next
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const shadowColor = useColorModeValue('rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)');
  const commandBgColor = useColorModeValue('gray.50', 'gray.700');

  // Focus input when overlay opens and set initial mode
  useEffect(() => {
    if (isQuickNavigating && inputRef.current) {
      inputRef.current.focus();
      // Set command mode only if explicitly triggered with $
      setIsCommandMode(initialCommandMode);
      setInputValue('');
    }
  }, [isQuickNavigating, initialCommandMode]);
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
          usage: '$ [command] [arguments]'
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
      
      // Auto-preview for transfer commands
      if (commandText.startsWith('transfer ')) {
        const parts = commandText.split(' ');
        if (parts.length > 1 && !isNaN(Number(parts[1]))) {
          const numFiles = Number(parts[1]);
          handleTransferPreview(numFiles);
        } else {
          setPreviewFiles([]); // Clear preview if invalid number
        }
      } else {
        setPreviewFiles([]); // Clear preview for non-transfer commands
      }
    } else {
      // Regular search mode
      const filtered = allFiles.filter(file => file.name.toLowerCase().includes(inputValue.toLowerCase()));
      setFilteredResults(filtered.slice(0, 3)); // Limit to 3 results
      setCommandInfo(null);
      setPreviewFiles([]); // Clear preview in search mode
    }
  }, [inputValue, isCommandMode, allFiles]);
  const handleCommandInfoUpdate = (commandText: string) => {
    if (!commandText) {
      setCommandInfo({
        title: 'Command Info',
        description: 'Type a command to execute',
        usage: '$ [command] [arguments]'
      });
      return;
    }
    // Parse command and show relevant info
    const commandParts = commandText.split(' ');
    const command = commandParts[0];
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
        usage: '$ [command] [arguments]'
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsQuickNavigating(false);
      setInputValue('');
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
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
        if (firstResult.type === 'folder') {
          setCurrentPath(isAbsolutePath(firstResult.path) ? firstResult.path : joinPath(firstResult.path));
          addLog(`Changed directory to: ${firstResult.path}`);
        } else {
          setInputValue(firstResult.path);
        }
      }
    }
  };
  const executeCommand = async () => {
    const command = inputValue.trim();
    if (!command) return;
    
    console.log('[QuickNavigate] Executing command:', command);
    addLog(`$ ${command}`, 'command');
    addCommand(command);

    try {
      // For transfer commands, get preview first
      if (command.toLowerCase().startsWith('transfer')) {
        console.log('[QuickNavigate] Detected transfer command');
        const parts = command.split(' ');
        const numFiles = parts.length > 1 && !isNaN(Number(parts[1])) ? Number(parts[1]) : 1;
        console.log('[QuickNavigate] Number of files to transfer:', numFiles);
        
        try {
          // Get preview first
          console.log('[QuickNavigate] Requesting transfer preview...');
          const previewOptions: TransferOptions = { 
            numFiles,
            command: 'preview',
            currentDirectory: rootPath
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
              command: 'transfer',
              currentDirectory: rootPath
            };
            const transferResult = await window.electronAPI.transfer(transferOptions);
            console.log('[QuickNavigate] Transfer result:', transferResult);
            
            if (transferResult.success) {
              console.log('[QuickNavigate] Transfer successful');
              addLog(transferResult.message, 'response');
            } else {
              console.log('[QuickNavigate] Transfer failed:', transferResult.message);
              addLog(transferResult.message, 'error');
            }
          } else {
            console.log('[QuickNavigate] Preview failed:', previewResult.message);
            addLog(previewResult.message, 'error');
          }
        } catch (error) {
          console.error('[QuickNavigate] Error during transfer:', error);
          addLog(`Error during transfer: ${error}`, 'error');
        }
      } else {
        // Handle other commands
        console.log('[QuickNavigate] Executing non-transfer command');
        const result = await window.electronAPI.executeCommand(command);
        console.log('[QuickNavigate] Command execution result:', result);
        
        if (result.success) {
          addLog(result.message, 'response');
        } else {
          addLog(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('[QuickNavigate] Error executing command:', error);
      addLog(`Error executing command: ${error}`, 'error');
    }

    setIsQuickNavigating(false);
    setInputValue('');
  };
  const handleTransferPreview = async (numFiles: number) => {
    try {
      console.log('[QuickNavigate] Auto-requesting transfer preview for', numFiles, 'files');
      const previewOptions: TransferOptions = { 
        numFiles,
        command: 'preview',
        currentDirectory: rootPath
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
  };
  if (!isQuickNavigating) return null;
  return <Box position="fixed" top="0" left="0" right="0" bottom="0" bg="rgba(0,0,0,0.3)" zIndex="modal" display="flex" alignItems="flex-start" justifyContent="center" paddingTop="30vh" onClick={() => setIsQuickNavigating(false)}>
      <Box width="600px" maxWidth="90%" onClick={e => e.stopPropagation()}>
        {/* Fixed position input container - always visible */}
        <Box bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" position="relative">
          <Flex align="center" p={3}>
            <IconButton icon={isCommandMode ? <DollarSign size={16} strokeWidth={2} /> : <Search size={16} />} aria-label={isCommandMode ? 'Command mode' : 'Search mode'} variant="ghost" size="sm" color="blue.400" onClick={toggleCommandMode} />
            <Input ref={inputRef} placeholder={isCommandMode ? 'Enter command...' : 'Type to search files and folders...'} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown} variant="unstyled" fontSize="md" ml={2} autoFocus />
          </Flex>
        </Box>
        {/* Command info panel - separate from input container */}
        {isCommandMode && commandInfo && (
          <Box bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={1}>
            <Box p={4} bg={commandBgColor}>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                {commandInfo.title}
              </Text>
              <Text fontSize="xs" color="gray.500" mb={1}>
                {commandInfo.description}
              </Text>
              <Flex align="center" bg={useColorModeValue('gray.100', 'gray.900')} p={2} borderRadius="md" mt={2} border="1px solid" borderColor={useColorModeValue('gray.200', 'gray.700')}>
                <Flex align="center">
                  <DollarSign size={12} color={useColorModeValue('#3182CE', '#63B3ED')} strokeWidth={2} />
                  <Text fontSize="xs" fontFamily="monospace" color={useColorModeValue('blue.600', 'blue.300')} ml={1}>
                    {commandInfo.usage.replace('$ ', '')}
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
                      <DollarSign size={10} color={useColorModeValue('#4A5568', '#718096')} strokeWidth={2} />
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
          <Box bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} overflow="hidden" mt={1}>
            <Box p={4} bg={commandBgColor}>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Preview of {previewFiles.length} file{previewFiles.length > 1 ? 's' : ''} to transfer:
              </Text>
              <Box>
                {previewFiles.map((file, index) => (
                  <Flex key={index} align="center" py={1}>
                    <Icon as={File} size={10} color={useColorModeValue('#4A5568', '#718096')} />
                    <Text fontSize="xs" ml={2}>
                      {file.name} {file.size && `(${Math.round(parseFloat(file.size) / 1024)} KB)`}
                    </Text>
                  </Flex>
                ))}
              </Box>
            </Box>
          </Box>
        )}
        
        {/* Search results - separate from input container */}
        {!isCommandMode && filteredResults.length > 0 && <Box bg={bgColor} borderRadius="md" boxShadow={`0 4px 12px ${shadowColor}`} zIndex="1" overflow="hidden" mt={1}>
            <List spacing={0}>
              {filteredResults.map((result, index) => <ListItem key={index} p={2} bg={index === 0 ? useColorModeValue('blue.50', 'blue.900') : 'transparent'} _hover={{
            bg: useColorModeValue('gray.100', 'gray.700')
          }} onClick={() => {
            if (result.type === 'folder') {
              setCurrentPath(isAbsolutePath(result.path) ? result.path : joinPath(result.path));
              addLog(`Changed directory to: ${result.path}`);
            } else {
              addLog(`Opening file: ${result.path}`);
            }
            setIsQuickNavigating(false);
            setInputValue('');
          }}>
                  <Flex align="center">
                    <Icon as={result.type === 'folder' ? FolderOpen : File} color={result.type === 'folder' ? 'blue.400' : 'gray.400'} boxSize={4} mr={3} />
                    <Box flex="1">
                      <Text fontSize="sm" fontWeight={index === 0 ? 'medium' : 'normal'}>
                        {result.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {result.path}
                      </Text>
                    </Box>
                    {index === 0 && <Text fontSize="xs" color="gray.500" ml={2}>
                        Press Enter to open
                      </Text>}
                  </Flex>
                </ListItem>)}
            </List>
          </Box>}
      </Box>
    </Box>;
};