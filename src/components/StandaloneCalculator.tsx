import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Button,
  Text,
  VStack,
  HStack,
  IconButton,
  useColorModeValue,
  Flex,
} from '@chakra-ui/react';
import { Delete, X } from 'lucide-react';

interface HistoryEntry {
  expression: string;
  result: string;
}

export const StandaloneCalculator: React.FC = () => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [equation, setEquation] = useState('');

  // Windows calculator-like colors
  const bgColor = useColorModeValue('#f3f3f3', '#202020');
  const displayBg = useColorModeValue('white', '#323130');
  const numberBtnBg = useColorModeValue('#fafafa', '#323130');
  const numberBtnHover = useColorModeValue('#e5e5e5', '#404040');
  const operatorBtnBg = useColorModeValue('#f1f1f1', '#605e5c');
  const operatorBtnHover = useColorModeValue('#e1e1e1', '#797775');
  const equalsColor = useColorModeValue('#0078d4', '#0078d4');
  const equalsHover = useColorModeValue('#106ebe', '#106ebe');
  const textColor = useColorModeValue('#000', '#fff');
  const historyBg = useColorModeValue('#f9f9f9', '#2d2d30');
  const borderColor = useColorModeValue('#e1e1e1', '#484644');

  const inputNumber = useCallback((num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  }, [display, waitingForNewValue]);

  const inputDecimal = useCallback(() => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  }, [display, waitingForNewValue]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setEquation('');
  }, []);

  const backspace = useCallback(() => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }, [display]);

  const performOperation = useCallback((nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(display);
      setEquation(`${display} ${nextOperation} `);
    } else if (operation) {
      const currentValue = parseFloat(previousValue);
      let result = 0;

      switch (operation) {
        case '+':
          result = currentValue + inputValue;
          break;
        case '-':
          result = currentValue - inputValue;
          break;
        case '×':
          result = currentValue * inputValue;
          break;
        case '÷':
          result = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        default:
          return;
      }

      const resultString = result.toString();
      const expression = `${previousValue} ${operation} ${display} =`;
      
      // Add to history
      setHistory(prev => [...prev, { expression, result: resultString }]);
      
      setDisplay(resultString);
      setPreviousValue(resultString);
      setEquation(`${resultString} ${nextOperation} `);
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
  }, [display, previousValue, operation]);

  const calculate = useCallback(() => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const currentValue = parseFloat(previousValue);
      let result = 0;

      switch (operation) {
        case '+':
          result = currentValue + inputValue;
          break;
        case '-':
          result = currentValue - inputValue;
          break;
        case '×':
          result = currentValue * inputValue;
          break;
        case '÷':
          result = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        default:
          return;
      }

      const resultString = result.toString();
      const expression = `${previousValue} ${operation} ${display} =`;
      
      // Add to history
      setHistory(prev => [...prev, { expression, result: resultString }]);
      
      setDisplay(resultString);
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
      setEquation('');
    }
  }, [display, previousValue, operation]);

  // Keyboard support
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      e.preventDefault();
      
      if (e.key >= '0' && e.key <= '9') {
        inputNumber(e.key);
      } else if (e.key === '.') {
        inputDecimal();
      } else if (e.key === '+') {
        performOperation('+');
      } else if (e.key === '-') {
        performOperation('-');
      } else if (e.key === '*') {
        performOperation('×');
      } else if (e.key === '/') {
        performOperation('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        calculate();
      } else if (e.key === 'Escape') {
        clear(); // Escape clears the calculator
      } else if (e.key === 'c' || e.key === 'C') {
        clear();
      } else if (e.key === 'Backspace') {
        backspace();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [inputNumber, inputDecimal, performOperation, calculate, clear, backspace]);

  const clearHistory = () => {
    setHistory([]);
  };

  const closeCalculator = () => {
    // Close the calculator window
    if (window.electronAPI?.closeCalculator) {
      window.electronAPI.closeCalculator();
    } else {
      // Fallback for development
      window.close();
    }
  };

  const CalcButton: React.FC<{
    children: React.ReactNode;
    onClick: () => void;
    variant?: 'number' | 'operator' | 'equals';
    span?: number;
  }> = ({ children, onClick, variant = 'number', span = 1 }) => {
    let bg = numberBtnBg;
    let hoverBg = numberBtnHover;
    let color = textColor;

    if (variant === 'operator') {
      bg = operatorBtnBg;
      hoverBg = operatorBtnHover;
    } else if (variant === 'equals') {
      bg = equalsColor;
      hoverBg = equalsHover;
      color = 'white';
    }

    return (
      <Button
        h="44px"
        bg={bg}
        color={color}
        border="none"
        borderRadius="6px"
        fontSize="17px"
        fontWeight="500"
        _hover={{ bg: hoverBg }}
        _active={{ transform: 'scale(0.96)' }}
        onClick={onClick}
        gridColumn={span > 1 ? `span ${span}` : undefined}
        transition="all 0.15s ease"
      >
        {children}
      </Button>
    );
  };

  return (
    <Flex
      bg={bgColor}
      w="480px" // More compact, refined width
      h="420px" // Better height proportion
      overflow="hidden"
      border="1px solid"
      borderColor={borderColor}
      borderRadius="8px"
      boxShadow="lg"
      direction="column"
    >
      {/* Custom Title Bar */}
      <Box
        p={2}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        borderBottom="1px solid"
        borderColor={borderColor}
        bg={bgColor}
        borderTopRadius="8px"
        style={{ WebkitAppRegion: 'drag' } as any}
        cursor="move"
        flexShrink={0}
        h="36px" // Slightly smaller title bar
      >
        <Text fontSize="13px" fontWeight="400" color={textColor} userSelect="none">
          Calculator
        </Text>
        <HStack spacing={1} style={{ WebkitAppRegion: 'no-drag' } as any}>
          <IconButton
            aria-label="Close"
            icon={<X size={14} />}
            size="sm"
            variant="ghost"
            color={textColor}
            onClick={closeCalculator}
          />
        </HStack>
      </Box>

      {/* Main Content - History Panel + Calculator */}
      <Flex flex={1} overflow="hidden">
        {/* History Panel - Always visible on the left */}
        <Box
          w="160px" // Refined history panel width
          bg={historyBg}
          borderRight="1px solid"
          borderColor={borderColor}
          p={2}
          display="flex"
          flexDirection="column"
          flexShrink={0}
        >
          <HStack justify="space-between" mb={2}>
            <Text fontSize="11px" color={textColor} fontWeight="500">
              History
            </Text>
            <IconButton
              aria-label="Clear history"
              icon={<Delete size={10} />}
              size="xs"
              variant="ghost"
              color={textColor}
              onClick={clearHistory}
            />
          </HStack>
          
          {/* Scrollable History Content */}
          <Box flex={1} overflowY="auto" overflowX="hidden">
            {history.length === 0 ? (
              <Text fontSize="10px" color="gray.500" textAlign="center" mt={3}>
                No history yet
              </Text>
            ) : (
              <VStack spacing={1} align="stretch">
                {history.map((entry, index) => (
                  <Box
                    key={index}
                    cursor="pointer"
                    onClick={() => setDisplay(entry.result)}
                    _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                    p={1}
                    borderRadius="3px"
                    transition="background-color 0.2s"
                  >
                    <Text 
                      fontSize="9px" 
                      color="gray.500"
                      wordBreak="break-all"
                      mb={0.5}
                    >
                      {entry.expression}
                    </Text>
                    <Text 
                      fontSize="10px" 
                      color={textColor} 
                      fontWeight="500"
                      wordBreak="break-all"
                    >
                      {entry.result}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Box>

        {/* Calculator Panel */}
        <VStack spacing={0} flex={1} minW={0}> {/* Calculator panel - fills remaining space */}
          {/* Display */}
          <Box
            w="100%"
            bg={displayBg}
            border="none"
            borderColor={borderColor}
            px={4}
            py={3}
            h="120px" // Fixed display height for better proportion
            display="flex"
            flexDirection="column"
            justifyContent="flex-end"
            flexShrink={0}
          >
            {/* Equation Display */}
            <Box h="18px" textAlign="right" mb={2}>
              <Text
                fontSize="12px"
                color={useColorModeValue('gray.600', 'gray.400')}
                fontFamily="Segoe UI, system-ui, sans-serif"
                wordBreak="break-all"
              >
                {equation}
              </Text>
            </Box>
            
            {/* Main Display */}
            <Text
              fontSize="36px"
              fontWeight="300"
              color={textColor}
              fontFamily="Segoe UI, system-ui, sans-serif"
              wordBreak="break-all"
              lineHeight="1"
              textAlign="right"
            >
              {display}
            </Text>
          </Box>

          {/* Button Grid */}
          <Box p="6px" w="100%">
            <Grid templateColumns="repeat(4, 1fr)" gap="2px"> {/* Slightly larger gap for cleaner look */}
              {/* Row 1 */}
              <CalcButton onClick={clear} variant="operator">C</CalcButton>
              <CalcButton onClick={backspace} variant="operator">⌫</CalcButton>
              <CalcButton onClick={() => {}} variant="operator">%</CalcButton>
              <CalcButton onClick={() => performOperation('÷')} variant="operator">÷</CalcButton>

              {/* Row 2 */}
              <CalcButton onClick={() => inputNumber('7')}>7</CalcButton>
              <CalcButton onClick={() => inputNumber('8')}>8</CalcButton>
              <CalcButton onClick={() => inputNumber('9')}>9</CalcButton>
              <CalcButton onClick={() => performOperation('×')} variant="operator">×</CalcButton>

              {/* Row 3 */}
              <CalcButton onClick={() => inputNumber('4')}>4</CalcButton>
              <CalcButton onClick={() => inputNumber('5')}>5</CalcButton>
              <CalcButton onClick={() => inputNumber('6')}>6</CalcButton>
              <CalcButton onClick={() => performOperation('-')} variant="operator">−</CalcButton>

              {/* Row 4 */}
              <CalcButton onClick={() => inputNumber('1')}>1</CalcButton>
              <CalcButton onClick={() => inputNumber('2')}>2</CalcButton>
              <CalcButton onClick={() => inputNumber('3')}>3</CalcButton>
              <CalcButton onClick={() => performOperation('+')} variant="operator">+</CalcButton>

              {/* Row 5 */}
              <CalcButton onClick={() => inputNumber('0')} span={2}>0</CalcButton>
              <CalcButton onClick={inputDecimal}>.</CalcButton>
              <CalcButton onClick={calculate} variant="equals">=</CalcButton>
            </Grid>
          </Box>
        </VStack>
      </Flex>
    </Flex>
  );
}; 