import React, { useEffect, useState, useRef } from 'react';
import { Flex, Input, IconButton, Text, useColorModeValue } from '@chakra-ui/react';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
export const CommandLine: React.FC = () => {
  const {
    addLog,
    commandHistory,
    addCommand
  } = useAppContext();
  const [command, setCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bgColor = useColorModeValue('white', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const handleSubmit = () => {
    if (!command.trim()) return;
    addLog(`> ${command}`, 'command');
    addCommand(command);
    // Mock response based on command
    const lcCommand = command.toLowerCase();
    if (lcCommand.includes('help')) {
      addLog('Available commands: help, list, merge, rename, extract', 'response');
    } else if (lcCommand.includes('list')) {
      addLog('Listing files in current directory...', 'response');
    } else if (lcCommand.includes('merge')) {
      addLog('Merging PDF files...', 'response');
    } else if (lcCommand.includes('rename')) {
      addLog('Renaming files with pattern...', 'response');
    } else if (lcCommand.includes('extract')) {
      addLog('Extracting archives...', 'response');
    } else {
      addLog(`Unknown command: ${command}`, 'error');
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
  return <Flex align="center" bg={bgColor} border="1px" borderColor={borderColor} borderRadius="md" overflow="hidden" h="32px">
      <Text px={3} color="blue.500" fontSize="sm" fontFamily="monospace">
        $
      </Text>
      <Input ref={inputRef} placeholder="command" value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleKeyDown} variant="unstyled" px={2} h="100%" fontSize="sm" fontFamily="monospace" flex="1" color={useColorModeValue('gray.800', 'white')} />
      <IconButton icon={<ArrowUp size={14} />} aria-label="Previous command" variant="ghost" size="sm" onClick={() => navigateHistory(-1)} />
      <IconButton icon={<ArrowDown size={14} />} aria-label="Next command" variant="ghost" size="sm" onClick={() => navigateHistory(1)} />
      <IconButton icon={<Send size={14} />} aria-label="Execute command" variant="ghost" size="sm" onClick={handleSubmit} />
    </Flex>;
};