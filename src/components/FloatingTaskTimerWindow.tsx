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
  VStack,
  Progress,
} from '@chakra-ui/react';
import { Play, Pause, Square, BarChart, X, GripVertical, Minimize2, Maximize2, Circle, Clock } from 'lucide-react';
import { taskTimerService, Task, TimerState } from '../services/taskTimer';
import { settingsService } from '../services/settings';

interface FloatingTaskTimerWindowProps {
  onClose: () => void;
  onOpenSummary: () => void;
}

// Work Shift Infographic Component
const WorkShiftInfographic: React.FC = () => {
  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [productivityTarget, setProductivityTarget] = useState(27000); // 7:30 hours in seconds
  const [todayTimeWorked, setTodayTimeWorked] = useState(0);
  const [currentTimeInShift, setCurrentTimeInShift] = useState(0);
  const [shiftProgress, setShiftProgress] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0); // Position of current time line (0-100)
  const [currentTimeGMT8, setCurrentTimeGMT8] = useState('');

  // GMT+8 offset (Philippines timezone)
  const GMT_8_OFFSET_MS = 8 * 60 * 60 * 1000;

  useEffect(() => {
    const loadWorkShift = async () => {
      try {
        const settings = await settingsService.getSettings() as any;
        if (settings.workShiftStart) setWorkShiftStart(settings.workShiftStart);
        if (settings.workShiftEnd) setWorkShiftEnd(settings.workShiftEnd);
        if (settings.productivityTargetHours) {
          // Convert hours (e.g., 7.5) to seconds
          setProductivityTarget(Math.round(settings.productivityTargetHours * 3600));
        }
      } catch (error) {
        console.error('Error loading work shift:', error);
      }
    };

    const calculateTodayTime = async () => {
      try {
        // Use GMT+8 date string like the timer service does
        const now = new Date();
        const gmt8Time = new Date(now.getTime() + GMT_8_OFFSET_MS);
        const todayString = gmt8Time.toISOString().split('T')[0];
        const result = await (window.electronAPI as any).getTaskLogs(todayString);
        if (result.success && result.tasks) {
          const totalSeconds = result.tasks.reduce((sum: number, task: any) => {
            return sum + (task.duration || 0);
          }, 0);
          setTodayTimeWorked(totalSeconds);
        }
      } catch (error) {
        console.error('Error calculating today time:', error);
      }
    };

    const calculateShiftProgress = () => {
      // Get current time in GMT+8 (Philippines timezone) - same method as timer service
      const now = new Date();
      
      // Format current time in GMT+8 for display using Intl API (same as timer service)
      const gmt8TimeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      });
      setCurrentTimeGMT8(gmt8TimeString);
      
      // Get current time components in GMT+8
      const gmt8Hours = parseInt(gmt8TimeString.split(':')[0]);
      const gmt8Minutes = parseInt(gmt8TimeString.split(':')[1]);
      const currentMinutes = gmt8Hours * 60 + gmt8Minutes;
      
      const [startHour, startMin] = workShiftStart.split(':').map(Number);
      const [endHour, endMin] = workShiftEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      // Calculate progress based on minutes of day
      const shiftDurationMinutes = endMinutes - startMinutes;
      const elapsedMinutes = currentMinutes - startMinutes;
      
      // Calculate position of current time line (0-100%)
      let timePosition = 0;
      if (currentMinutes < startMinutes) {
        setCurrentTimeInShift(0);
        setShiftProgress(0);
        timePosition = 0;
      } else if (currentMinutes > endMinutes) {
        setCurrentTimeInShift(shiftDurationMinutes * 60);
        setShiftProgress(100);
        timePosition = 100;
      } else {
        setCurrentTimeInShift(elapsedMinutes * 60);
        setShiftProgress((elapsedMinutes / shiftDurationMinutes) * 100);
        timePosition = (elapsedMinutes / shiftDurationMinutes) * 100;
      }
      setCurrentTimePosition(timePosition);
    };

    loadWorkShift();
    calculateTodayTime();
    calculateShiftProgress();
    
    const interval = setInterval(() => {
      calculateShiftProgress();
      calculateTodayTime(); // Also refresh today's time
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [workShiftStart, workShiftEnd, productivityTarget]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <Flex
      direction="column"
      w="280px"
      px={4}
      py={4}
      bg="gray.800"
      borderLeft="1px solid"
      borderColor="whiteAlpha.100"
      gap={4}
    >
      {/* Work Shift Progress */}
      <Box>
        <Flex align="center" gap={2} mb={2}>
          <Icon as={Clock} boxSize={4} color="gray.400" />
          <Text fontSize="11px" fontWeight="600" color="gray.300" textTransform="uppercase" letterSpacing="0.05em">
            Work Shift
          </Text>
        </Flex>
        <Flex align="center" justify="space-between" mb={2}>
          <Text fontSize="10px" color="gray.500">
            {workShiftStart} - {workShiftEnd}
          </Text>
          <Text fontSize="10px" color="green.400" fontWeight="600">
            {currentTimeGMT8}
          </Text>
        </Flex>
        <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="md" overflow="visible">
          {/* Progress Bar Background */}
          <Box
            position="absolute"
            left="0"
            top="0"
            h="100%"
            w="100%"
            bg="whiteAlpha.100"
            borderRadius="md"
          />
          {/* Progress Fill */}
          <Box
            position="absolute"
            left="0"
            top="0"
            h="100%"
            w={`${Math.min(100, Math.max(0, shiftProgress))}%`}
            bg={shiftProgress >= 100 ? 'red.500' : shiftProgress >= 80 ? 'orange.500' : 'cyan.500'}
            transition="width 0.3s ease"
            borderRadius={shiftProgress >= 100 ? "md" : "md 0 0 md"}
            overflow="hidden"
          />
          {/* Current Time Indicator Line */}
          {currentTimePosition > 0 && (
            <Box
              position="absolute"
              left={currentTimePosition >= 100 ? "calc(100% - 3px)" : `${currentTimePosition}%`}
              top="-4px"
              w="2px"
              h="32px"
              bg="green.400"
              borderRadius="full"
              zIndex={10}
              boxShadow="0 0 8px rgba(72, 187, 120, 0.8)"
              transform={currentTimePosition >= 100 ? "none" : "translateX(-50%)"}
              sx={{
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                    boxShadow: '0 0 8px rgba(72, 187, 120, 0.8)',
                  },
                  '50%': {
                    opacity: 0.7,
                    boxShadow: '0 0 12px rgba(72, 187, 120, 1)',
                  },
                },
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          )}
          {/* Percentage Text */}
          <Flex
            position="absolute"
            left="0"
            top="0"
            w="100%"
            h="100%"
            align="center"
            justify="center"
            zIndex={2}
            pointerEvents="none"
          >
            <Text fontSize="9px" fontWeight="600" color="white" textShadow="0 1px 2px rgba(0,0,0,0.5)">
              {shiftProgress.toFixed(0)}%
            </Text>
          </Flex>
        </Box>
        <Text fontSize="9px" color="gray.400" mt={1}>
          {formatTime(currentTimeInShift)} elapsed
        </Text>
      </Box>

      {/* Today's Time Worked */}
      <Box>
        <Flex align="center" justify="space-between" mb={2}>
          <Text fontSize="11px" fontWeight="600" color="gray.300" textTransform="uppercase" letterSpacing="0.05em">
            Today's Time
          </Text>
          <Text fontSize="9px" color="gray.500">
            Target: {formatTime(productivityTarget)}
          </Text>
        </Flex>
        <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="'Helvetica Neue', 'Helvetica', 'Arial', sans-serif" letterSpacing="0.02em" mb={2}>
          {formatTime(todayTimeWorked)}
        </Text>
        {/* Productivity Progress Bar */}
        <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="md" overflow="hidden" mb={1}>
          <Box
            position="absolute"
            left="0"
            top="0"
            h="100%"
            w={`${Math.min(100, (todayTimeWorked / productivityTarget) * 100)}%`}
            bg={todayTimeWorked >= productivityTarget ? 'green.500' : todayTimeWorked >= productivityTarget * 0.8 ? 'cyan.500' : 'blue.500'}
            transition="width 0.3s ease"
            borderRadius="md"
          />
          <Flex
            position="absolute"
            left="0"
            top="0"
            w="100%"
            h="100%"
            align="center"
            justify="center"
            zIndex={1}
            pointerEvents="none"
          >
            <Text fontSize="9px" fontWeight="600" color="white" textShadow="0 1px 2px rgba(0,0,0,0.5)">
              {((todayTimeWorked / productivityTarget) * 100).toFixed(0)}%
            </Text>
          </Flex>
        </Box>
        <Text fontSize="9px" color="gray.400">
          {todayTimeWorked >= productivityTarget ? 'Target achieved!' : `${formatTime(Math.max(0, productivityTarget - todayTimeWorked))} remaining`}
        </Text>
      </Box>
    </Flex>
  );
};

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
  // Default to expanded when opened from function panel
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Load timer state from localStorage on mount
  useEffect(() => {
    const savedState = taskTimerService.getTimerState();
    
    // Check if task is from a different day - if so, auto-stop and clear
    if (savedState.currentTask && taskTimerService.isTaskFromDifferentDay(savedState.currentTask)) {
      console.log('[FloatingTimer] Task is from a different day, auto-stopping and clearing...');
      
      // Auto-save the task if it was running (save it to yesterday's log)
      if (savedState.isRunning) {
        const taskStartDate = new Date(savedState.currentTask.startTime);
        const taskDateGMT8 = new Date(taskStartDate.getTime() + (8 * 60 * 60 * 1000));
        const taskDateString = taskDateGMT8.toISOString().split('T')[0];
        
        const finalTask: Task = {
          ...savedState.currentTask,
          endTime: new Date(savedState.currentTask.startTime).toISOString(), // End at start of next day
          duration: taskTimerService.calculateDuration(savedState.currentTask, false),
          isPaused: false
        };
        
        // Save to the task's original date
        (window.electronAPI as any).saveTaskLog(taskDateString, finalTask).catch((error: any) => {
          console.error('[TaskTimer] Error auto-saving task from previous day:', error);
        });
      }
      
      // Clear timer state
      const clearedState = {
        currentTask: null,
        isRunning: false,
        isPaused: false
      };
      taskTimerService.saveTimerState(clearedState);
      setTimerState(clearedState);
      setTaskName('New Task');
      setCurrentTime(0);
      setPauseStartTime(null);
      return;
    }
    
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
      // Don't handle 'top' snap anymore - we use expand button instead
      if (corner === 'top') {
        setSnapIndicator(null);
        return;
      }
      
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
    
    const handleSetExpandedState = (expanded: boolean) => {
      console.log('[FloatingTimer] Received set-expanded-state:', expanded);
      setIsExpanded(expanded);
      // Also trigger resize to apply expanded state immediately
      if (expanded) {
        setTimeout(() => {
          if (window.electronAPI && (window.electronAPI as any).resizeFloatingTimer) {
            (window.electronAPI as any).resizeFloatingTimer(1068, 300);
          }
        }, 100);
      }
    };
    
    // Listen for snap notifications from main process
    if ((window.electronAPI as any).onMessage) {
      (window.electronAPI as any).onMessage('corner-snapped', handleCornerSnapped);
      (window.electronAPI as any).onMessage('dock-to-panel', handleDockToPanel);
      (window.electronAPI as any).onMessage('set-expanded-state', handleSetExpandedState);
    }
    
    return () => {
      if ((window.electronAPI as any).removeListener) {
        (window.electronAPI as any).removeListener('corner-snapped', handleCornerSnapped);
        (window.electronAPI as any).removeListener('dock-to-panel', handleDockToPanel);
        (window.electronAPI as any).removeListener('set-expanded-state', handleSetExpandedState);
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
          return;
        }
        
        // Check if title exists and is not empty (handle empty strings properly)
        const hasTitle = result.title && typeof result.title === 'string' && result.title.trim().length > 0;
        
        if (hasTitle) {
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
          console.log('[FloatingTimer] ⏭️ Skipped - no active window title (title is empty, might be DocuFrame itself or API issue)');
          console.log('[FloatingTimer] Debug - result.title value:', result.title, 'type:', typeof result.title);
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
  
  // Resize window when minimized or expanded state changes
  useEffect(() => {
    if (window.electronAPI && (window.electronAPI as any).resizeFloatingTimer) {
      if (isMinimized) {
        (window.electronAPI as any).resizeFloatingTimer(122, 122); // Reduced by 15%: 143 * 0.85 = 122
      } else if (isExpanded) {
        // Expanded mode - optimized for 1068x300 when snapped
        (window.electronAPI as any).resizeFloatingTimer(1068, 300);
      } else {
        (window.electronAPI as any).resizeFloatingTimer(210, 120);
      }
    }
  }, [isMinimized, isExpanded]);

  // Set expanded state on mount if opened from function panel
  useEffect(() => {
    // Default to expanded when window first opens
    if (isExpanded) {
      // Small delay to ensure window is ready
      setTimeout(() => {
        if (window.electronAPI && (window.electronAPI as any).resizeFloatingTimer) {
          (window.electronAPI as any).resizeFloatingTimer(1068, 300);
        }
      }, 50);
    }
  }, []); // Run once on mount
  
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
    const minutes = Math.floor(currentTime / 60);
    const seconds = currentTime % 60;
    
    return (
      <Box
        w="122px"
        h="122px"
        bg="transparent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        {/* Progress circle as outer circle */}
        <Box
          position="absolute"
          w="122px"
          h="122px"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          cursor="move"
          pointerEvents="auto"
          zIndex={1}
        >
          <CircularProgress
            value={progressPercent}
            size="122px"
            thickness="6px"
            color={timerState.isRunning 
              ? (timerState.isPaused ? 'yellow.400' : timerColor)
              : 'gray.600'
            }
            trackColor="whiteAlpha.200"
            capIsRound
            pointerEvents="none"
          />
        </Box>
        
        {/* Clickable bubble in center */}
        <Box
          bg={bgColor}
          borderRadius="full"
          boxShadow={isDraggingToPanel 
            ? "0 0 0 8px rgba(96, 165, 250, 0.5), 0 0 20px rgba(96, 165, 250, 0.8), 0 4px 16px rgba(0,0,0,0.5)"
            : "0 2px 8px rgba(0,0,0,0.5)"
          }
          border="4px solid"
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
          w="98px"
          h="98px"
          display="flex"
          flexDirection="column"
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
          {/* MM:SS Display - MM bold, SS as subtext - bigger to fit circle */}
          <VStack spacing={0} align="center">
            <Text 
              fontSize="36px" 
              fontWeight="bold" 
              color="white" 
              fontFamily="mono" 
              lineHeight="1"
            pointerEvents="none"
          >
              {minutes.toString().padStart(2, '0')}
              </Text>
            <Text 
              fontSize="18px" 
              fontWeight="medium" 
              color="gray.400" 
              fontFamily="mono" 
              lineHeight="1"
              pointerEvents="none"
              mt="-3px"
            >
              {seconds.toString().padStart(2, '0')}
            </Text>
          </VStack>
          
          {/* Hour counter badge */}
          {currentHour > 0 && (
            <Box
              position="absolute"
              top="-4px"
              left="-4px"
              bg={isOddHour ? 'purple.500' : 'cyan.500'}
              borderRadius="full"
              w="22px"
              h="22px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid"
              borderColor="gray.900"
              pointerEvents="none"
              zIndex={10}
            >
              <Text fontSize="10px" fontWeight="bold" color="white" fontFamily="mono" pointerEvents="none">
                {currentHour}
              </Text>
            </Box>
          )}
        </Box>
        {/* Corner Snap Indicators for minimized view */}
        {snapIndicator && snapIndicator !== 'panel' && (
          <>
            <Box position="absolute" top="0" left="0" w="26px" h="26px" borderLeft="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopLeftRadius="4px" />
            <Box position="absolute" top="0" right="0" w="26px" h="26px" borderRight="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderTopRightRadius="4px" />
            <Box position="absolute" bottom="0" left="0" w="26px" h="26px" borderLeft="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-left' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomLeftRadius="4px" />
            <Box position="absolute" bottom="0" right="0" w="26px" h="26px" borderRight="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-right' ? 1 : 0.3} pointerEvents="none" transition="all 0.2s" borderBottomRightRadius="4px" />
          </>
        )}
      </Box>
    );
  }
  
  // Full window view - Compact design (flexible when expanded)
  return (
    <React.Fragment>
    <Box
      w={isExpanded ? "100%" : "210px"}
      h={isExpanded ? "300px" : "120px"}
      maxH={isExpanded ? "300px" : "none"}
      bg="transparent"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <Box
        bg={bgColor}
        borderRadius={isExpanded ? "0" : "12px"}
        boxShadow="0 4px 16px rgba(0,0,0,0.4)"
        overflow="hidden"
        w={isExpanded ? "100%" : "206px"}
        h={isExpanded ? "300px" : "116px"}
      >
        {/* Compact Header */}
        <Flex
          px={2}
          py={1}
          align="center"
          justify="space-between"
          cursor="grab"
          bg={isExpanded ? "gray.800" : "transparent"}
          borderBottom={isExpanded ? "1px solid" : "none"}
          borderColor={isExpanded ? "whiteAlpha.100" : "transparent"}
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <Flex align="center" gap={1}>
            <Icon as={GripVertical} boxSize={3.5} color="gray.500" />
            <Text fontSize="10px" fontWeight="semibold" color="white">
              Timer
            </Text>
          </Flex>
          <Flex gap={1}>
            <Tooltip label={isExpanded ? "Collapse" : "Expand"}>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                p={0.5}
                minW="auto"
                h="auto"
                _hover={{ bg: 'whiteAlpha.200' }}
                color="gray.400"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <Icon as={isExpanded ? Minimize2 : Maximize2} boxSize={3.5} />
              </Button>
            </Tooltip>
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
                <Icon as={Circle} boxSize={3.5} fill="none" strokeWidth={2} />
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
        
        {/* Main Content - Different layout for expanded vs compact */}
        {isExpanded ? (
          // Expanded layout optimized for 1068x300 - Timer as central piece with left sidebar
          <Flex 
            direction="row"
            h="100%"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {/* Left Sidebar - Control Buttons (Icons Only) */}
            <Flex
              direction="column"
              align="center"
              justify="flex-start"
              gap={3}
              px={3}
              py={4}
              bg="gray.800"
              borderRight="1px solid"
              borderColor="whiteAlpha.100"
              minW="60px"
            >
              <Tooltip label="Start" placement="right">
                <Button
                  size="md"
                  onClick={handleStartTimer}
                  isDisabled={timerState.isRunning && !timerState.isPaused}
                  bg={timerState.isRunning && !timerState.isPaused ? "whiteAlpha.200" : "whiteAlpha.100"}
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  w="44px"
                  h="44px"
                  p={0}
                  borderRadius="md"
                >
                  <Icon as={Play} boxSize={5} />
                </Button>
              </Tooltip>
              
              <Tooltip label="Pause" placement="right">
                <Button
                  size="md"
                  onClick={handlePauseTimer}
                  isDisabled={!timerState.isRunning || timerState.isPaused}
                  bg={timerState.isRunning && !timerState.isPaused ? "whiteAlpha.200" : "whiteAlpha.100"}
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  w="44px"
                  h="44px"
                  p={0}
                  borderRadius="md"
                >
                  <Icon as={Pause} boxSize={5} />
                </Button>
              </Tooltip>
              
              <Tooltip label="Stop" placement="right">
                <Button
                  size="md"
                  onClick={handleStopTimer}
                  isDisabled={!timerState.isRunning}
                  bg="whiteAlpha.100"
                  color="white"
                  _hover={{ bg: 'whiteAlpha.300' }}
                  _disabled={{ opacity: 0.4 }}
                  w="44px"
                  h="44px"
                  p={0}
                  borderRadius="md"
                >
                  <Icon as={Square} boxSize={5} />
                </Button>
              </Tooltip>
              
              <Box w="32px" h="1px" bg="whiteAlpha.200" my={1} />
              
              <Tooltip label="Summary" placement="right">
                <Button
                  size="md"
                  variant="ghost"
                  onClick={onOpenSummary}
                  color="gray.300"
                  _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  w="44px"
                  h="44px"
                  p={0}
                  borderRadius="md"
                >
                  <Icon as={BarChart} boxSize={5} />
                </Button>
              </Tooltip>
            </Flex>
            
            {/* Main Content Area - Split into center and right */}
            <Flex 
              direction="row"
              flex={1}
              bg="gray.900"
            >
              {/* Center Section - Timer */}
              <Flex 
                direction="column"
                flex={1}
                px={8}
                py={6}
                gap={3}
                align="center"
                justify="center"
                position="relative"
              >
                {/* Task Name Input - Compact, positioned above timer */}
                <Box 
                  as="input"
                  type="text"
                  value={taskName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (!timerState.isRunning) {
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
                    }
                  }}
                  placeholder="Task name..."
                  fontSize="13px"
                  fontWeight="medium"
                  width="100%"
                  maxW="500px"
                  bg="whiteAlpha.100"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="sm"
                  outline="none"
                  color="white"
                  _placeholder={{ color: 'gray.500' }}
                  _hover={{ borderColor: timerState.isRunning ? 'whiteAlpha.200' : 'whiteAlpha.300' }}
                  _focus={{ borderColor: timerState.isRunning ? 'whiteAlpha.200' : timerColor, boxShadow: timerState.isRunning ? 'none' : `0 0 0 2px ${timerColor}40` }}
                  textAlign="center"
                  px={3}
                  py={1.5}
                  cursor={timerState.isRunning ? "not-allowed" : "text"}
                  transition="all 0.2s"
                  position="absolute"
                  top="20px"
                  readOnly={timerState.isRunning}
                  opacity={timerState.isRunning ? 0.7 : 1}
                />
                
                {/* Central Timer Display - Centered Vertically */}
                <VStack spacing={3} align="center" justify="center" flex={1}>
                  <Text 
                    fontSize="7xl" 
                    fontWeight="700" 
                    fontFamily="'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    color="white"
                    lineHeight="1"
                    textAlign="center"
                    letterSpacing="0.02em"
                    textShadow="0 2px 8px rgba(0,0,0,0.3)"
                  >
                    {taskTimerService.formatDuration(currentTime)}
                  </Text>
                  
                  {/* Progress Bar - Horizontal */}
                  <Box w="100%" maxW="600px">
                    <Progress
                      value={progressPercent}
                      size="md"
                      colorScheme={timerState.isRunning 
                        ? (timerState.isPaused ? 'yellow' : isOddHour ? 'purple' : 'cyan')
                        : 'gray'
                      }
                      bg="whiteAlpha.200"
                      borderRadius="full"
                      hasStripe={timerState.isRunning && !timerState.isPaused}
                      isAnimated={timerState.isRunning && !timerState.isPaused}
                    />
                  </Box>
                  
                  {/* Window Tracking Indicator */}
                  {timerState.isRunning && !timerState.isPaused && (
                    <Flex align="center" justify="center" gap={2}>
                      <Text fontSize="11px" color="gray.400" maxW="400px" isTruncated title={currentWindowTitle || 'Tracking...'}>
                        {currentWindowTitle || 'Tracking...'}
                      </Text>
                      {timerState.currentTask?.windowTitles && timerState.currentTask.windowTitles.length > 0 && (
                        <Badge colorScheme="purple" fontSize="9px" px={1.5} py={0.5}>
                          {timerState.currentTask.windowTitles.length}
                        </Badge>
                      )}
                    </Flex>
                  )}
                </VStack>
              </Flex>
              
              {/* Right Section - Infographic */}
              <WorkShiftInfographic />
            </Flex>
          </Flex>
        ) : (
          // Compact layout - Original side-by-side design
          <Flex 
            px={2} 
            pb={2} 
            gap={2} 
            direction="row"
            align="center"
            justify="flex-start"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
          {/* Left side: Timer and Controls */}
          <Flex direction="column" flex={1} gap={1}>
            {/* Task Name Input */}
            <Box 
              as="input"
              type="text"
              value={taskName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (!timerState.isRunning) {
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
              _hover={{ color: timerState.isRunning ? 'gray.400' : 'gray.300' }}
              _focus={{ color: timerState.isRunning ? 'gray.400' : 'white' }}
              textAlign="center"
              px={1}
              py={0.5}
              cursor={timerState.isRunning ? "not-allowed" : "text"}
              transition="all 0.2s"
              readOnly={timerState.isRunning}
              opacity={timerState.isRunning ? 0.7 : 1}
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
          <Flex align="center" justify="center" position="relative" flex="0 0 auto">
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
        )}
      </Box>
      
      {/* Corner Snap Indicators for full view - Disabled when expanded to allow FancyZones */}
      {!isExpanded && snapIndicator && snapIndicator !== 'panel' && snapIndicator !== 'top' && (
        <Box position="absolute" top="0" left="0" right="0" bottom="0" pointerEvents="none">
          <Box position="absolute" top="0" left="0" w="40px" h="40px" borderLeft="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-left' ? 1 : 0.3} transition="all 0.2s" borderTopLeftRadius="6px" />
          <Box position="absolute" top="0" right="0" w="40px" h="40px" borderRight="2px solid" borderTop="2px solid" borderColor={snapIndicator === 'top-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'top-right' ? 1 : 0.3} transition="all 0.2s" borderTopRightRadius="6px" />
          <Box position="absolute" bottom="0" left="0" w="40px" h="40px" borderLeft="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-left' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-left' ? 1 : 0.3} transition="all 0.2s" borderBottomLeftRadius="6px" />
          <Box position="absolute" bottom="0" right="0" w="40px" h="40px" borderRight="2px solid" borderBottom="2px solid" borderColor={snapIndicator === 'bottom-right' ? 'cyan.400' : 'whiteAlpha.300'} opacity={snapIndicator === 'bottom-right' ? 1 : 0.3} transition="all 0.2s" borderBottomRightRadius="6px" />
        </Box>
      )}
    </Box>
    
    </React.Fragment>
  );
};

