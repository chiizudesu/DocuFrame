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
  Badge,
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
  const [isDraggingToPanel, setIsDraggingToPanel] = useState(false);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [currentWindowTitle, setCurrentWindowTitle] = useState<string>('');
  
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
    const handleCornerSnapped = (_event: any, corner: string | null) => {
      setSnapIndicator(corner);
      
      // If panel snap detected, show panel indicator
      if (corner === 'panel') {
        setIsDraggingToPanel(true);
      } else if (corner && corner !== 'panel') {
        // If corner snap detected (top-left, top-right, etc), hide panel indicator
        setIsDraggingToPanel(false);
      } else if (!corner) {
        // If no indicator, clear panel indicator
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
    };
  }, [isMinimized]);
  
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
  
  // Track active window titles
  useEffect(() => {
    console.log('[FloatingTimer] 🔄 Window tracking effect triggered - isRunning:', timerState.isRunning, 'isPaused:', timerState.isPaused, 'hasTask:', !!timerState.currentTask);
    
    if (!timerState.isRunning || timerState.isPaused || !timerState.currentTask) {
      console.log('[FloatingTimer] ⏸️ Window tracking INACTIVE (not running or paused or no task)');
      return;
    }
    
    console.log('[FloatingTimer] 📊 Window tracking ACTIVE - Starting tracking...');
    console.log('[FloatingTimer] Current task:', timerState.currentTask?.name);
    console.log('[FloatingTimer] Task started at:', timerState.currentTask?.startTime);
    console.log('[FloatingTimer] Resuming window tracking after app restart:', timerState.currentTask?.startTime ? 'Yes' : 'No');
    
    const trackWindowTitle = async () => {
      try {
        console.log('[FloatingTimer] 🔍 Fetching active window title...');
        const result = await (window.electronAPI as any).getActiveWindowTitle();
        console.log('[FloatingTimer] Window title result:', result);
        
        if (!result.success) {
          console.error('[FloatingTimer] ❌ Failed to get window title. Check MAIN TERMINAL for error details!');
          console.error('[FloatingTimer] Error:', result.error || 'Unknown error');
        }
        
        if (result.success && result.title) {
          console.log('[FloatingTimer] ✅ Active window detected:', result.title);
          setCurrentWindowTitle(result.title);
          
          // Get fresh timer state to avoid stale closures
          const currentState = taskTimerService.getTimerState();
          if (currentState.currentTask && currentState.isRunning && !currentState.isPaused) {
            const updatedTask = taskTimerService.logWindowTitle(
              currentState.currentTask,
              result.title
            );
            
            console.log('[FloatingTimer] 📝 Logged to task! Total windows tracked:', updatedTask.windowTitles.length);
            
            const newState = {
              ...currentState,
              currentTask: updatedTask
            };
            taskTimerService.saveTimerState(newState);
            setTimerState(newState);
          }
        } else {
          console.log('[FloatingTimer] ⏭️ Skipped - no active window (might be DocuFrame itself)');
          setCurrentWindowTitle('(DocuFrame)');
        }
      } catch (error) {
        console.error('[FloatingTimer] ❌ Error tracking window title:', error);
      }
    };
    
    // Track immediately
    trackWindowTitle();
    
    // Then track every 2 seconds for more responsive window switching detection
    const interval = setInterval(trackWindowTitle, 2000);
    console.log('[FloatingTimer] ⏱️ Window tracking interval set (every 2s)');
    
    return () => {
      console.log('[FloatingTimer] 🛑 Stopping window title tracking');
      clearInterval(interval);
    };
  }, [timerState.isRunning, timerState.isPaused]);
  
  // Notify main window when floating timer opens/closes
  useEffect(() => {
    // Notify main window that floating timer is open
    if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) {
      (window.electronAPI as any).sendToMainWindow('floating-timer-opened');
    }
    
    // Test window title API on mount
    const testWindowTitle = async () => {
      try {
        console.log('[FloatingTimer] 🧪 Testing getActiveWindowTitle API...');
        const result = await (window.electronAPI as any).getActiveWindowTitle();
        console.log('[FloatingTimer] Test result:', result);
      } catch (error) {
        console.error('[FloatingTimer] Test failed:', error);
      }
    };
    testWindowTitle();
    
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
        (window.electronAPI as any).resizeFloatingTimer(100, 100);
      } else {
        (window.electronAPI as any).resizeFloatingTimer(210, 120);
      }
    }
  }, [isMinimized]);
  
  // Reset panel indicator when minimized state changes
  useEffect(() => {
    if (!isMinimized) {
      setIsDraggingToPanel(false);
    }
  }, [isMinimized]);
  
  // Cleanup click timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    };
  }, [clickTimeout]);
  
  // Task timer functions
  const handleStartTimer = () => {
    if (timerState.isRunning && timerState.isPaused) {
      // Resume from pause
      console.log('[FloatingTimer] ▶️ Resuming timer');
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
      console.log('[FloatingTimer] ▶️ Starting new timer');
      const newTask = taskTimerService.startTask(taskName || 'New Task');
      console.log('[FloatingTimer] New task created:', newTask);
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
    
    console.log('[FloatingTimer] 💾 Stopping and saving task:', finalTask.id, 'with', finalTask.windowTitles?.length || 0, 'window titles');
    
    // Save task to daily log
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).saveTaskLog(today, finalTask);
      console.log('[FloatingTimer] Save result:', result);
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
  
  // Calculate progress percentage (cycles every hour)
  const secondsInHour = 60 * 60;
  const currentHour = Math.floor(currentTime / secondsInHour);
  const secondsInCurrentHour = currentTime % secondsInHour;
  const progressPercent = (secondsInCurrentHour / secondsInHour) * 100;
  
  // Alternate colors: blue for even hours (0,2,4...), purple for odd hours (1,3,5...)
  const isOddHour = currentHour % 2 === 1;
  const timerColor = isOddHour ? 'purple.400' : 'cyan.400';
  
  const bgColor = useColorModeValue('#1a1a1a', '#1a1a1a');
  
  // Minimized icon view
  if (isMinimized) {
    return (
      <Box
        w="100px"
        h="100px"
        bg="transparent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        {/* Drag ring - outer ring only (24px border for clearer separation) */}
        <Box
          position="absolute"
          w="90px"
          h="90px"
          borderRadius="full"
          border="20px solid transparent"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          cursor="move"
          pointerEvents="auto"
          transition="all 0.2s"
          zIndex={1}
          _hover={{
            boxShadow: "0 0 0 2px rgba(96, 165, 250, 0.3), inset 0 0 20px rgba(96, 165, 250, 0.2)",
          }}
        />
        
        {/* Clickable bubble in center */}
        <Box
          bg={bgColor}
          borderRadius="full"
          boxShadow={isDraggingToPanel 
            ? "0 0 0 8px rgba(96, 165, 250, 0.5), 0 0 20px rgba(96, 165, 250, 0.8), 0 4px 16px rgba(0,0,0,0.5)"
            : "0 2px 8px rgba(0,0,0,0.5)"
          }
          border="3px solid"
          borderColor={isDraggingToPanel
            ? 'blue.400'
            : timerState.isRunning 
              ? (timerState.isPaused ? 'yellow.400' : timerColor)
              : 'gray.600'
          }
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
          w="52px"
          h="52px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          position="relative"
          zIndex={10}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={(e) => {
            console.log('[FloatingTimer] Click on bubble');
            // Single click = pause/play timer (only if not dragging to panel)
            if (!isDraggingToPanel) {
              e.stopPropagation();
              
              const now = Date.now();
              const timeSinceLastClick = now - lastClickTime;
              
              // Check for double-click (within 300ms)
              if (timeSinceLastClick < 300 && timeSinceLastClick > 0) {
                // This is a double-click
                console.log('[FloatingTimer] ⚡ Double-click - Expanding to full view');
                if (clickTimeout) {
                  clearTimeout(clickTimeout);
                  setClickTimeout(null);
                }
                setIsMinimized(false);
                setLastClickTime(0); // Reset
              } else {
                // Single click - delay action to check for double-click
                setLastClickTime(now);
                
                // Clear any existing timeout
                if (clickTimeout) {
                  clearTimeout(clickTimeout);
                }
                
                // Delay single-click action to allow double-click to take precedence
                const timeout = setTimeout(() => {
                  console.log('[FloatingTimer] Timer toggle');
                  if (timerState.isRunning && !timerState.isPaused) {
                    handlePauseTimer();
                  } else if (timerState.isRunning && timerState.isPaused) {
                    handleStartTimer();
                  } else {
                    handleStartTimer();
                  }
                }, 300); // Wait for potential double-click
                
                setClickTimeout(timeout);
              }
            }
          }}
        >
          <CircularProgress
            value={progressPercent}
            size="40px"
            thickness="3px"
            color={timerState.isRunning 
              ? (timerState.isPaused ? 'yellow.400' : timerColor)
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
          
          {/* Hour counter badge */}
          {currentHour > 0 && (
            <Box
              position="absolute"
              top="-3px"
              left="-3px"
              bg={isOddHour ? 'purple.500' : 'cyan.500'}
              borderRadius="full"
              w="16px"
              h="16px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid"
              borderColor="gray.900"
              pointerEvents="none"
              zIndex={10}
            >
              <Text fontSize="8px" fontWeight="bold" color="white" fontFamily="mono" pointerEvents="none">
                {currentHour}
              </Text>
            </Box>
          )}
        </Box>
        {/* Corner Snap Indicators for minimized view */}
        {snapIndicator && snapIndicator !== 'panel' && (
          <>
            <Box position="absolute" top="0" left="0" w="20px" h="20px" borderLeft="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopLeftRadius="4px" />
            <Box position="absolute" top="0" right="0" w="20px" h="20px" borderRight="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopRightRadius="4px" />
            <Box position="absolute" bottom="0" left="0" w="20px" h="20px" borderLeft="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomLeftRadius="4px" />
            <Box position="absolute" bottom="0" right="0" w="20px" h="20px" borderRight="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomRightRadius="4px" />
          </>
        )}
      </Box>
    );
  }
  
  // Full window view - Compact design
  return (
    <Box
      w="210px"
      h="120px"
      bg="transparent"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <Box
        bg={bgColor}
        borderRadius="12px"
        boxShadow="0 4px 16px rgba(0,0,0,0.4)"
        overflow="hidden"
        w="206px"
        h="116px"
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
            
            {/* Window Tracking Indicator */}
            {timerState.isRunning && !timerState.isPaused && (
              <Flex align="center" justify="center" gap={0.5}>
                <Text fontSize="7px" color="gray.600" maxW="90px" isTruncated title={currentWindowTitle || 'Tracking...'}>
                  {currentWindowTitle || 'Tracking...'}
                </Text>
                {timerState.currentTask?.windowTitles && timerState.currentTask.windowTitles.length > 0 && (
                  <Badge colorScheme="purple" fontSize="6px" px={1} py={0}>
                    {timerState.currentTask.windowTitles.length}
                  </Badge>
                )}
              </Flex>
            )}
            
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
          <Flex align="center" justify="center" position="relative">
            <CircularProgress
              value={progressPercent}
              size="70px"
              thickness="5px"
              color={timerState.isRunning 
                ? (timerState.isPaused ? 'yellow.400' : timerColor)
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
                    color={timerColor}
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
            
            {/* Hour counter badge */}
            {currentHour > 0 && (
              <Box
                position="absolute"
                top="-2px"
                left="-2px"
                bg={isOddHour ? 'purple.500' : 'cyan.500'}
                borderRadius="full"
                w="20px"
                h="20px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                border="2px solid"
                borderColor="gray.900"
                zIndex={10}
              >
                <Text fontSize="10px" fontWeight="bold" color="white" fontFamily="mono">
                  {currentHour}
                </Text>
              </Box>
            )}
          </Flex>
        </Flex>
      </Box>
      
      {/* Corner Snap Indicators for full view */}
      {snapIndicator && snapIndicator !== 'panel' && (
        <>
          <Box position="absolute" top="0" left="0" w="40px" h="40px" borderLeft="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopLeftRadius="6px" />
          <Box position="absolute" top="0" right="0" w="40px" h="40px" borderRight="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopRightRadius="6px" />
          <Box position="absolute" bottom="0" left="0" w="40px" h="40px" borderLeft="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomLeftRadius="6px" />
          <Box position="absolute" bottom="0" right="0" w="40px" h="40px" borderRight="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomRightRadius="6px" />
        </>
      )}
    </Box>
  );
};

