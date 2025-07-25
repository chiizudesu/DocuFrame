import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  Box,
  Grid,
  Button,
  Text,
  VStack,
  HStack,
  IconButton,
  useColorModeValue,
  Divider,
} from '@chakra-ui/react';
import { History, X, Delete } from 'lucide-react';

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  expression: string;
  result: string;
}

export const Calculator: React.FC<CalculatorProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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
    if (!isOpen) return;

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
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        clear();
      } else if (e.key === 'Backspace') {
        backspace();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, inputNumber, inputDecimal, performOperation, calculate, clear, backspace]);

  const clearHistory = () => {
    setHistory([]);
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
        h="48px"
        bg={bg}
        color={color}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="2px"
        fontSize="16px"
        fontWeight="400"
        _hover={{ bg: hoverBg }}
        _active={{ transform: 'scale(0.98)' }}
        onClick={onClick}
        gridColumn={span > 1 ? `span ${span}` : undefined}
      >
        {children}
      </Button>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
      <ModalOverlay bg="blackAlpha.300" />
      <ModalContent
        bg={bgColor}
        borderRadius="8px"
        border="1px solid"
        borderColor={borderColor}
        maxW="320px"
        p={0}
      >
        <ModalHeader
          p={3}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          borderBottom="1px solid"
          borderColor={borderColor}
        >
          <Text fontSize="14px" fontWeight="400" color={textColor}>
            Calculator
          </Text>
          <HStack spacing={1}>
            <IconButton
              aria-label="History"
              icon={<History size={16} />}
              size="sm"
              variant="ghost"
              color={textColor}
              onClick={() => setShowHistory(!showHistory)}
            />
            <IconButton
              aria-label="Close"
              icon={<X size={16} />}
              size="sm"
              variant="ghost"
              color={textColor}
              onClick={onClose}
            />
          </HStack>
        </ModalHeader>

        <ModalBody p={0}>
          <VStack spacing={0}>
            {/* History Panel */}
            {showHistory && (
              <Box
                w="100%"
                h="120px"
                bg={historyBg}
                borderBottom="1px solid"
                borderColor={borderColor}
                p={2}
              >
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="12px" color={textColor} fontWeight="500">
                    History
                  </Text>
                  <IconButton
                    aria-label="Clear history"
                    icon={<Delete size={12} />}
                    size="xs"
                    variant="ghost"
                    color={textColor}
                    onClick={clearHistory}
                  />
                </HStack>
                <Box h="88px" overflowY="auto">
                  {history.length === 0 ? (
                    <Text fontSize="11px" color="gray.500" textAlign="center" mt={4}>
                      No history yet
                    </Text>
                  ) : (
                    <VStack spacing={1} align="stretch">
                      {history.slice(-5).map((entry, index) => (
                        <Box
                          key={index}
                          cursor="pointer"
                          onClick={() => setDisplay(entry.result)}
                          _hover={{ bg: useColorModeValue('gray.100', 'gray.600') }}
                          p={1}
                          borderRadius="2px"
                        >
                          <Text fontSize="10px" color="gray.500">
                            {entry.expression}
                          </Text>
                          <Text fontSize="11px" color={textColor} fontWeight="500">
                            {entry.result}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </Box>
              </Box>
            )}

            {/* Display */}
            <Box
              w="100%"
              bg={displayBg}
              border="1px solid"
              borderColor={borderColor}
              px={4}
              py={2}
            >
              {/* Equation Display */}
              <Box h="20px" textAlign="right" mb={1}>
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
                fontSize="28px"
                fontWeight="300"
                color={textColor}
                fontFamily="Segoe UI, system-ui, sans-serif"
                wordBreak="break-all"
                minH="36px"
                textAlign="right"
              >
                {display}
              </Text>
            </Box>

            {/* Button Grid */}
            <Box p={3} w="100%">
              <Grid templateColumns="repeat(4, 1fr)" gap={1}>
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
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 