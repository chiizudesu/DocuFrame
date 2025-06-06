import React, { useEffect, useState, useRef } from 'react';
import { Flex, Input, IconButton, Text, useColorModeValue } from '@chakra-ui/react';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const CommandLine: React.FC = () => {
  const {
    addLog,
    commandHistory,
    addCommand,
    setPreviewFiles
  } = useAppContext();
  const [command, setCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bgColor = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleSubmit = async () => {
    if (!command.trim()) return;
    
    console.log('[CommandLine] Starting command execution:', command);
    addLog(`> ${command}`, 'command');
    addCommand(command);

    try {
      // For transfer commands, get preview first
      if (command.toLowerCase().startsWith('transfer')) {
        console.log('[CommandLine] Detected transfer command');
        const parts = command.split(' ');
        const numFiles = parts.length > 1 && !isNaN(Number(parts[1])) ? Number(parts[1]) : 1;
        console.log('[CommandLine] Number of files to transfer:', numFiles);
        
        try {
          // Get preview first
          console.log('[CommandLine] Requesting transfer preview...');
          const previewResult = await window.electronAPI.transfer({ 
            numFiles,
            command: 'preview'
          });
          console.log('[CommandLine] Preview result:', previewResult);
          
          if (previewResult.success && previewResult.files) {
            console.log('[CommandLine] Preview successful, updating preview pane');
            // Update preview pane
            setPreviewFiles(previewResult.files);
            
            // Now execute the actual transfer
            console.log('[CommandLine] Executing transfer...');
            const transferResult = await window.electronAPI.transfer({ 
              numFiles,
              command: 'transfer'
            });
            console.log('[CommandLine] Transfer result:', transferResult);
            
            if (transferResult.success) {
              console.log('[CommandLine] Transfer successful');
              addLog(transferResult.message, 'response');
            } else {
              console.log('[CommandLine] Transfer failed:', transferResult.message);
              addLog(transferResult.message, 'error');
            }
          } else {
            console.log('[CommandLine] Preview failed:', previewResult.message);
            addLog(previewResult.message, 'error');
          }
        } catch (error) {
          console.error('[CommandLine] Error during transfer:', error);
          addLog(`Error during transfer: ${error}`, 'error');
        }
      } else {
        // Handle other commands
        console.log('[CommandLine] Executing non-transfer command');
        const result = await window.electronAPI.executeCommand(command);
        console.log('[CommandLine] Command execution result:', result);
        
        if (result.success) {
          addLog(result.message, 'response');
        } else {
          addLog(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('[CommandLine] Error executing command:', error);
      addLog(`Error executing command: ${error}`, 'error');
    }

    setCommand('');
    setHistoryIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateHistory(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateHistory(1);
    }
  };

  const navigateHistory = (direction: number) => {
    if (commandHistory.length === 0) return;
    let newIndex = historyIndex + direction;
    if (newIndex >= commandHistory.length) {
      newIndex = -1;
      setCommand('');
    } else if (newIndex < -1) {
      newIndex = commandHistory.length - 1;
    }
    setHistoryIndex(newIndex);
    if (newIndex >= 0) {
      setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Flex align="center" bg={bgColor} border="1px" borderColor={borderColor} borderRadius="md" overflow="hidden" h="32px">
      <Text px={3} color="blue.500" fontSize="sm" fontFamily="monospace">
        $
      </Text>
      <Input 
        ref={inputRef} 
        placeholder="command" 
        value={command} 
        onChange={e => setCommand(e.target.value)} 
        onKeyDown={handleKeyDown} 
        variant="unstyled" 
        px={2} 
        h="100%" 
        fontSize="sm" 
        fontFamily="monospace" 
        flex="1" 
        color={useColorModeValue('gray.800', 'white')} 
      />
      <IconButton 
        icon={<ArrowUp size={14} />} 
        aria-label="Previous command" 
        variant="ghost" 
        size="sm" 
        onClick={() => navigateHistory(-1)} 
      />
      <IconButton 
        icon={<ArrowDown size={14} />} 
        aria-label="Next command" 
        variant="ghost" 
        size="sm" 
        onClick={() => navigateHistory(1)} 
      />
      <IconButton 
        icon={<Send size={14} />} 
        aria-label="Execute command" 
        variant="ghost" 
        size="sm" 
        onClick={handleSubmit} 
      />
    </Flex>
  );
};