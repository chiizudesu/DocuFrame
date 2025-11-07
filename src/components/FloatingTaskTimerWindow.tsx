import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Button,
  Icon,
  Text,
  useColorModeValue,
  CircularProgress,
  CircularProgressLabel,
  Tooltip,
} from '@chakra-ui/react';
import { Play, Pause, Square, BarChart, X, GripVertical, Minimize2 } from 'lucide-react';
import { taskTimerService, Task, TimerState } from '../services/taskTimer';

interface FloatingTaskTimerWindowProps {
  onClose: () => void;
  onOpenSummary: () => void;
}

export const FloatingTaskTimerWindow: React.FC<FloatingTaskTimerWindowProps> = ({
  onClose,
  onOpenSummary,
}) => {
  // Task Timer state
  const [timerState, setTimerState] = useState<TimerState>({ currentTask: null, isRunning: false, isPaused: false });
  const [taskName, setTaskName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<string | null>(null);
  const [screenInfo, setScreenInfo] = useState<{ width: number; height: number } | null>(null);
  const [isDraggingToPanel, setIsDraggingToPanel] = useState(false);
  const [panelHoverTimeout, setPanelHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Load screen info on mount
  useEffect(() => {
    const loadScreenInfo = async () => {
      try {
        const result = await (window.electronAPI as any).getScreenInfo();
        if (result.success && result.workArea) {
          setScreenInfo(result.workArea);
        }
      } catch (error) {
        console.error('[FloatingTimer] Error loading screen info:', error);
      }
    };
    loadScreenInfo();
  }, []);
  
  // Load timer state from localStorage on mount
  useEffect(() => {
    const savedState = taskTimerService.getTimerState();
    setTimerState(savedState);
    
    if (savedState.currentTask) {
      setTaskName(savedState.currentTask.name);
      
      // Calculate current time if timer is running
      if (savedState.isRunning && !savedState.isPaused) {
        const duration = taskTimerService.calculateDuration(savedState.currentTask, false);
        setCurrentTime(duration);
      } else if (savedState.isPaused) {
        const duration = taskTimerService.calculateDuration(savedState.currentTask, true);
        setCurrentTime(duration);
      }
    }
  }, []);
  
  // Listen for corner snap events from main process
  useEffect(() => {
    console.log('[FloatingTimer] Setting up corner-snapped listener');
    
    const handleCornerSnapped = (_event: any, corner: string | null) => {
      console.log('[FloatingTimer] Received corner-snapped event:', corner);
      setSnapIndicator(corner);
      
      // Clear any existing timeout
      if (panelHoverTimeout) {
        clearTimeout(panelHoverTimeout);
        setPanelHoverTimeout(null);
      }
      
      // If panel snap detected, also set the isDraggingToPanel state
      if (corner === 'panel') {
        setIsDraggingToPanel(true);
        
        // If minimized and near panel, automatically dock after a short delay
        if (isMinimized) {
          const timeout = setTimeout(() => {
            console.log('[FloatingTimer] Auto-docking to panel');
            handleClose();
          }, 1500); // 1.5 second hover time
          setPanelHoverTimeout(timeout);
        }
      } else if (!corner) {
        setIsDraggingToPanel(false);
      }
    };
    
    const handleDockToPanel = () => {
      console.log('[FloatingTimer] Received dock-to-panel signal, closing immediately');
      handleClose();
    };
    
    // Listen for snap notifications from main process
    if ((window.electronAPI as any).onMessage) {
      (window.electronAPI as any).onMessage('corner-snapped', handleCornerSnapped);
      (window.electronAPI as any).onMessage('dock-to-panel', handleDockToPanel);
    }
    
    return () => {
      if ((window.electronAPI as any).removeListener) {
        (window.electronAPI as any).removeListener('corner-snapped', handleCornerSnapped);
        (window.electronAPI as any).removeListener('dock-to-panel', handleDockToPanel);
      }
      // Clear timeout on cleanup
      if (panelHoverTimeout) {
        clearTimeout(panelHoverTimeout);
      }
    };
  }, [isMinimized, panelHoverTimeout]);
  
  // Timer tick effect - updates every second when running
  useEffect(() => {
    if (!timerState.isRunning || timerState.isPaused || !timerState.currentTask) {
      return;
    }
    
    const interval = setInterval(() => {
      const duration = taskTimerService.calculateDuration(timerState.currentTask!, false);
      setCurrentTime(duration);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.isPaused, timerState.currentTask]);
  
  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (timerState.currentTask) {
      taskTimerService.saveTimerState(timerState);
    }
  }, [timerState]);
  
  // Listen for storage changes from other windows (sync timer state)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'docuframe_timer_state' && e.newValue) {
        try {
          const newState: TimerState = JSON.parse(e.newValue);
          console.log('[FloatingTimer] Timer state changed from other window:', newState);
          setTimerState(newState);
          
          if (newState.currentTask) {
            setTaskName(newState.currentTask.name);
            const duration = taskTimerService.calculateDuration(newState.currentTask, newState.isPaused);
            setCurrentTime(duration);
          } else {
            setTaskName('');
            setCurrentTime(0);
          }
        } catch (error) {
          console.error('[FloatingTimer] Error parsing storage change:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Listen for file operation events
  useEffect(() => {
    const handleFileOperation = (event: CustomEvent) => {
      const { operation, filePath } = event.detail;
      
      if (timerState.isRunning && timerState.currentTask) {
        console.log('[FloatingTimer] File operation detected:', operation, filePath);
        const updatedTask = taskTimerService.logFileOperation(
          timerState.currentTask,
          operation,
          filePath
        );
        
        setTimerState({
          ...timerState,
          currentTask: updatedTask
        });
      }
    };
    
    window.addEventListener('fileOperation', handleFileOperation as EventListener);
    return () => window.removeEventListener('fileOperation', handleFileOperation as EventListener);
  }, [timerState]);
  
  // Notify main window when floating timer opens/closes
  useEffect(() => {
    // Notify main window that floating timer is open
    if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) {
      (window.electronAPI as any).sendToMainWindow('floating-timer-opened');
    }
    
    // Note: cleanup happens in handleClose function instead of here
    // to ensure event is sent before window closes
  }, []);
  
  // Handle close with proper event broadcasting
  const handleClose = () => {
    console.log('[FloatingTimer] Closing floating timer, broadcasting event...');
    // Send close event BEFORE actually closing
    if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) {
      (window.electronAPI as any).sendToMainWindow('floating-timer-closed');
    }
    // Small delay to ensure event is processed
    setTimeout(() => {
      onClose();
    }, 100);
  };
  
  // Resize window when minimized state changes
  useEffect(() => {
    if (window.electronAPI && (window.electronAPI as any).resizeFloatingTimer) {
      if (isMinimized) {
        // Taller when minimized to accommodate the "Click to Dock" label
        (window.electronAPI as any).resizeFloatingTimer(60, isDraggingToPanel ? 90 : 60);
      } else {
        (window.electronAPI as any).resizeFloatingTimer(210, 120);
      }
    }
  }, [isMinimized, isDraggingToPanel]);
  
  // Reset panel indicator when minimized state changes
  useEffect(() => {
    if (!isMinimized) {
      setIsDraggingToPanel(false);
    }
  }, [isMinimized]);
  
  // Task timer functions
  const handleStartTimer = () => {
    if (timerState.isRunning && timerState.isPaused) {
      // Resume from pause
      const pauseDuration = pauseStartTime ? Math.floor((Date.now() - pauseStartTime) / 1000) : 0;
      const updatedTask = {
        ...timerState.currentTask!,
        pausedDuration: timerState.currentTask!.pausedDuration + pauseDuration,
        isPaused: false
      };
      
      setTimerState({
        currentTask: updatedTask,
        isRunning: true,
        isPaused: false
      });
      setPauseStartTime(null);
    } else if (!timerState.isRunning) {
      // Start new task
      const newTask = taskTimerService.startTask(taskName || 'New Task');
      setTimerState({
        currentTask: newTask,
        isRunning: true,
        isPaused: false
      });
      setCurrentTime(0);
    }
  };
  
  const handlePauseTimer = () => {
    if (timerState.isRunning && !timerState.isPaused) {
      setPauseStartTime(Date.now());
      setTimerState({
        ...timerState,
        isPaused: true
      });
    }
  };
  
  const handleStopTimer = async () => {
    if (!timerState.currentTask) return;
    
    const pauseDuration = (timerState.isPaused && pauseStartTime) 
      ? Math.floor((Date.now() - pauseStartTime) / 1000)
      : 0;
    
    const finalTask: Task = {
      ...timerState.currentTask,
      endTime: new Date().toISOString(),
      duration: taskTimerService.calculateDuration(timerState.currentTask, false),
      pausedDuration: timerState.currentTask.pausedDuration + pauseDuration,
      isPaused: false
    };
    
    // Save task to daily log
    try {
      const today = taskTimerService.getTodayDateString();
      await (window.electronAPI as any).saveTaskLog(today, finalTask);
    } catch (error) {
      console.error('[TaskTimer] Error saving task log:', error);
    }
    
    // Reset timer state
    setTimerState({
      currentTask: null,
      isRunning: false,
      isPaused: false
    });
    setCurrentTime(0);
    setPauseStartTime(null);
    setTaskName('New Task');
    
    // Clear localStorage
    taskTimerService.saveTimerState({
      currentTask: null,
      isRunning: false,
      isPaused: false
    });
  };
  
  // Calculate progress percentage (max 60 minutes for circular progress)
  const maxSeconds = 60 * 60; // 1 hour max for visual progress
  const progressPercent = Math.min((currentTime / maxSeconds) * 100, 100);
  
  const bgColor = useColorModeValue('#1a1a1a', '#1a1a1a');
  
  // Minimized icon view
  if (isMinimized) {
    return (
      <Box
        w="100vw"
        h="100vh"
        bg="transparent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        gap={2}
      >
        <Box
          bg={bgColor}
          borderRadius="full"
          p={2}
          boxShadow={isDraggingToPanel 
            ? "0 0 0 3px rgba(96, 165, 250, 0.6), 0 4px 16px rgba(0,0,0,0.5)"
            : "0 2px 8px rgba(0,0,0,0.5)"
          }
          border="2px solid"
          borderColor={isDraggingToPanel
            ? 'blue.400'
            : timerState.isRunning 
              ? (timerState.isPaused ? 'yellow.400' : 'cyan.400')
              : 'gray.600'
          }
          cursor="move"
          transition="all 0.2s"
          animation={isDraggingToPanel ? 'pulse 1s infinite' : 'none'}
          sx={{
            '@keyframes pulse': {
              '0%, 100%': {
                transform: 'scale(1)',
              },
              '50%': {
                transform: 'scale(1.05)',
              },
            },
          }}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          position="relative"
          onClick={(e) => {
            // Single click = pause/play timer (only if not dragging to panel)
            if (!isDraggingToPanel) {
              e.stopPropagation();
              if (timerState.isRunning && !timerState.isPaused) {
                handlePauseTimer();
              } else if (timerState.isRunning && timerState.isPaused) {
                handleStartTimer();
              } else {
                handleStartTimer();
              }
            }
          }}
          onDoubleClick={(e) => {
            // Double click = expand (only if not dragging to panel)
            if (!isDraggingToPanel) {
              e.stopPropagation();
              setIsMinimized(false);
            }
          }}
        >
          <CircularProgress
            value={progressPercent}
            size="40px"
            thickness="4px"
            color={timerState.isRunning 
              ? (timerState.isPaused ? 'yellow.400' : 'cyan.400')
              : 'gray.600'
            }
            trackColor="whiteAlpha.200"
            capIsRound
            pointerEvents="none"
          >
            <CircularProgressLabel>
              <Text fontSize="8px" fontWeight="bold" color="white" fontFamily="mono" pointerEvents="none">
                {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{(currentTime % 60).toString().padStart(2, '0')}
              </Text>
            </CircularProgressLabel>
          </CircularProgress>
        </Box>
        {/* Corner Snap Indicators when minimized */}
        {snapIndicator && snapIndicator !== 'panel' && (
          <>
            <Box position="absolute" top="0" left="0" w="30px" h="30px" borderLeft="3px solid" borderTop="3px solid" borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopLeftRadius="6px" />
            <Box position="absolute" top="0" right="0" w="30px" h="30px" borderRight="3px solid" borderTop="3px solid" borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopRightRadius="6px" />
            <Box position="absolute" bottom="0" left="0" w="30px" h="30px" borderLeft="3px solid" borderBottom="3px solid" borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomLeftRadius="6px" />
            <Box position="absolute" bottom="0" right="0" w="30px" h="30px" borderRight="3px solid" borderBottom="3px solid" borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomRightRadius="6px" />
          </>
        )}
        {isDraggingToPanel && (
          <Box
            bg="rgba(59, 130, 246, 0.9)"
            px={2}
            py={1}
            borderRadius="md"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Text fontSize="10px" fontWeight="bold" color="white">
              Hover to Dock...
            </Text>
          </Box>
        )}
      </Box>
    );
  }
  
  // Full window view - Compact design
  return (
    <Box
      w="100vw"
      h="100vh"
      bg="transparent"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
    >
      <Box
        bg={bgColor}
        borderRadius="12px"
        boxShadow="0 4px 16px rgba(0,0,0,0.4)"
        overflow="hidden"
        w="202px"
      >
        {/* Compact Header */}
        <Flex
          px={2}
          py={1}
          align="center"
          justify="space-between"
          cursor="grab"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <Flex align="center" gap={1}>
            <Icon as={GripVertical} boxSize={3.5} color="gray.500" />
            <Text fontSize="10px" fontWeight="semibold" color="white">
              Timer
            </Text>
          </Flex>
          <Flex gap={1}>
            <Tooltip label="Minimize">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setIsMinimized(true)}
                p={0.5}
                minW="auto"
                h="auto"
                _hover={{ bg: 'whiteAlpha.200' }}
                color="gray.400"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Icon as={Minimize2} boxSize={3.5} />
              </Button>
            </Tooltip>
            <Tooltip label="Close">
              <Button
                size="xs"
                variant="ghost"
                onClick={handleClose}
                p={0.5}
                minW="auto"
                h="auto"
                _hover={{ bg: 'whiteAlpha.200' }}
                color="gray.400"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Icon as={X} boxSize={3.5} />
              </Button>
            </Tooltip>
          </Flex>
        </Flex>
        
        {/* Main Content - Side by Side */}
        <Flex px={2} pb={2} gap={2} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {/* Left side: Timer and Controls */}
          <Flex direction="column" flex={1} gap={1}>
            {/* Task Name Input */}
            <Box 
              as="input"
              type="text"
              value={taskName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTaskName(e.target.value);
                if (timerState.currentTask) {
                  setTimerState({
                    ...timerState,
                    currentTask: {
                      ...timerState.currentTask,
                      name: e.target.value
                    }
                  });
                }
              }}
              placeholder="Task..."
              fontSize="9px"
              fontWeight="medium"
              width="100%"
              bg="transparent"
              border="none"
              outline="none"
              color="gray.400"
              _placeholder={{ color: 'gray.600' }}
              _hover={{ color: 'gray.300' }}
              _focus={{ color: 'white' }}
              textAlign="center"
              px={1}
              py={0.5}
              cursor="text"
              transition="all 0.2s"
            />
            
            {/* Time Display */}
            <Text 
              fontSize="2xl" 
              fontWeight="bold" 
              fontFamily="mono"
              color="white"
              lineHeight="1"
              textAlign="center"
            >
              {taskTimerService.formatDuration(currentTime)}
            </Text>
            
            {/* Control Buttons */}
            <Flex gap={1} justify="center">
              <Tooltip label="Start">
                <Button
                  size="xs"
                  onClick={handleStartTimer}
                  isDisabled={timerState.isRunning && !timerState.isPaused}
                  bg="whiteAlpha.200"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  px={1.5}
                  h="20px"
                  minW="auto"
                  borderRadius="full"
                >
                  <Icon as={Play} boxSize={3} />
                </Button>
              </Tooltip>
              
              <Tooltip label="Pause">
                <Button
                  size="xs"
                  onClick={handlePauseTimer}
                  isDisabled={!timerState.isRunning || timerState.isPaused}
                  bg="whiteAlpha.200"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  px={1.5}
                  h="20px"
                  minW="auto"
                  borderRadius="full"
                >
                  <Icon as={Pause} boxSize={3} />
                </Button>
              </Tooltip>
              
              <Tooltip label="Stop">
                <Button
                  size="xs"
                  onClick={handleStopTimer}
                  isDisabled={!timerState.isRunning}
                  bg="whiteAlpha.200"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  px={1.5}
                  h="20px"
                  minW="auto"
                  borderRadius="full"
                >
                  <Icon as={Square} boxSize={3} />
                </Button>
              </Tooltip>
            </Flex>
            
            {/* Summary Button */}
            <Button
              size="xs"
              variant="ghost"
              onClick={onOpenSummary}
              color="gray.400"
              _hover={{ bg: 'whiteAlpha.100', color: 'gray.300' }}
              fontSize="8px"
              h="16px"
              w="100%"
            >
              <Icon as={BarChart} boxSize={2.5} mr={1} />
              Summary
            </Button>
          </Flex>
          
          {/* Right side: Circular Progress */}
          <Flex align="center" justify="center">
            <CircularProgress
              value={progressPercent}
              size="70px"
              thickness="5px"
              color={timerState.isRunning 
                ? (timerState.isPaused ? 'yellow.400' : 'cyan.400')
                : 'gray.600'
              }
              trackColor="whiteAlpha.200"
              capIsRound
            >
              <CircularProgressLabel>
                {timerState.isRunning && !timerState.isPaused && (
                  <Icon 
                    as={Pause} 
                    boxSize={5} 
                    color="cyan.400"
                    cursor="pointer"
                    onClick={handlePauseTimer}
                    _hover={{ transform: 'scale(1.1)' }}
                    transition="transform 0.2s"
                  />
                )}
                {timerState.isPaused && (
                  <Icon 
                    as={Play} 
                    boxSize={5} 
                    color="yellow.400"
                    cursor="pointer"
                    onClick={handleStartTimer}
                    _hover={{ transform: 'scale(1.1)' }}
                    transition="transform 0.2s"
                  />
                )}
                {!timerState.isRunning && (
                  <Icon 
                    as={Play} 
                    boxSize={5} 
                    color="gray.500"
                    cursor="pointer"
                    onClick={handleStartTimer}
                    _hover={{ transform: 'scale(1.1)', color: 'gray.400' }}
                    transition="all 0.2s"
                  />
                )}
              </CircularProgressLabel>
            </CircularProgress>
          </Flex>
        </Flex>
      </Box>
      
      {/* Corner Snap Indicators - Compact */}
      {snapIndicator && snapIndicator !== 'panel' && screenInfo && (
        <>
          {/* Top-Left Indicator */}
          <Box
            position="fixed"
            top="0"
            left="0"
            w="60px"
            h="60px"
            borderLeft="3px solid"
            borderTop="3px solid"
            borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'}
            opacity={snapIndicator === 'top-left' ? 1 : 0.3}
            pointerEvents="none"
            transition="all 0.2s"
            borderTopLeftRadius="6px"
          />
          
          {/* Top-Right Indicator */}
          <Box
            position="fixed"
            top="0"
            right="0"
            w="60px"
            h="60px"
            borderRight="3px solid"
            borderTop="3px solid"
            borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'}
            opacity={snapIndicator === 'top-right' ? 1 : 0.3}
            pointerEvents="none"
            transition="all 0.2s"
            borderTopRightRadius="6px"
          />
          
          {/* Bottom-Left Indicator */}
          <Box
            position="fixed"
            bottom="0"
            left="0"
            w="60px"
            h="60px"
            borderLeft="3px solid"
            borderBottom="3px solid"
            borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'}
            opacity={snapIndicator === 'bottom-left' ? 1 : 0.3}
            pointerEvents="none"
            transition="all 0.2s"
            borderBottomLeftRadius="6px"
          />
          
          {/* Bottom-Right Indicator */}
          <Box
            position="fixed"
            bottom="0"
            right="0"
            w="60px"
            h="60px"
            borderRight="3px solid"
            borderBottom="3px solid"
            borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'}
            opacity={snapIndicator === 'bottom-right' ? 1 : 0.3}
            pointerEvents="none"
            transition="all 0.2s"
            borderBottomRightRadius="6px"
          />
        </>
      )}
    </Box>
  );
};

