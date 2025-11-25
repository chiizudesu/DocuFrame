import React, { useState, useEffect, useRef } from 'react';
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
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  IconButton,
  Spinner,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Portal,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Textarea,
  useDisclosure,
} from '@chakra-ui/react';
import { Play, Pause, Square, BarChart, X, GripVertical, Minimize2, Maximize2, Circle, Clock, Search, ChevronDown, Trash2, Plus } from 'lucide-react';
import { taskTimerService, Task, TimerState } from '../services/taskTimer';
import { settingsService } from '../services/settings';
import { useAppContext } from '../context/AppContext';

interface FloatingTaskTimerWindowProps {
  onClose: () => void;
  onOpenSummary: () => void;
}

// Work Shift Infographic Component
interface WorkShiftInfographicProps {
  onEditTask?: (taskId: string) => Promise<void>;
  onAddCustomTask?: () => void;
}

const WorkShiftInfographic: React.FC<WorkShiftInfographicProps> = ({ onEditTask, onAddCustomTask }) => {
  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [productivityTarget, setProductivityTarget] = useState(27000); // 7:30 hours in seconds
  const [todayTimeWorked, setTodayTimeWorked] = useState(0);
  const [billableTimeWorked, setBillableTimeWorked] = useState(0);
  const [currentTimeInShift, setCurrentTimeInShift] = useState(0);
  const [shiftProgress, setShiftProgress] = useState(0);
  const [loggedTimeProgress, setLoggedTimeProgress] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0); // Position of current time line (0-100)
  const [currentTimeGMT8, setCurrentTimeGMT8] = useState('');
  const [timeDifference, setTimeDifference] = useState(0); // Difference in seconds (positive = ahead, negative = behind)
  const [tasks, setTasks] = useState<any[]>([]); // Store tasks for segment visualization
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState(0); // Store shift duration for calculations

  // Non-billable task names
  const NON_BILLABLE_TASKS = [
    'Internal - Meetings',
    'Internal - IT Issues',
    'Internal - Workflow Planning'
  ];

  // Helper function to check if a task is non-billable
  const isNonBillableTask = (taskName: string): boolean => {
    return NON_BILLABLE_TASKS.some(nbTask => 
      taskName && taskName.toLowerCase().includes(nbTask.toLowerCase())
    );
  };

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
          let totalSeconds = 0;
          let billableSeconds = 0;
          
          // Process tasks and mark them as billable/non-billable
          const processedTasks = result.tasks.map((task: any) => {
            const duration = task.duration || 0;
            totalSeconds += duration;
            
            // Check if task is billable (not in non-billable list)
            const isBillable = !NON_BILLABLE_TASKS.some(nbTask => 
              task.name && task.name.toLowerCase().includes(nbTask.toLowerCase())
            );
            if (isBillable) {
              billableSeconds += duration;
            }
            
            return {
              ...task,
              duration,
              isBillable
            };
          });
          
          setTasks(processedTasks);
          setTodayTimeWorked(totalSeconds);
          setBillableTimeWorked(billableSeconds);
          
          // Calculate logged time progress relative to shift duration
          const [startHour, startMin] = workShiftStart.split(':').map(Number);
          const [endHour, endMin] = workShiftEnd.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          const shiftDuration = (endMinutes - startMinutes) * 60;
          setShiftDurationSeconds(shiftDuration);
          
          const loggedProgress = shiftDuration > 0 
            ? Math.min(100, (totalSeconds / shiftDuration) * 100)
            : 0;
          setLoggedTimeProgress(loggedProgress);
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
      calculateTodayTime(); // Calculate today's time first
      calculateShiftProgress(); // Then calculate shift progress
    }, 60000); // Update every minute
    
    // Listen for task updates
    const handleTaskUpdate = () => {
      calculateTodayTime();
    };
    window.addEventListener('task-updated', handleTaskUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('task-updated', handleTaskUpdate);
    };
  }, [workShiftStart, workShiftEnd, productivityTarget]);

  // Recalculate time difference whenever todayTimeWorked or currentTimeInShift changes
  useEffect(() => {
    const diff = todayTimeWorked - currentTimeInShift;
    setTimeDifference(diff);
  }, [todayTimeWorked, currentTimeInShift]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatTimeDifference = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const hours = Math.floor(absSeconds / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const sign = seconds >= 0 ? '+' : '-';
    return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const productivityPercentage = todayTimeWorked > 0 
    ? (billableTimeWorked / todayTimeWorked) * 100 
    : 0;

  // Calculate task segments for logged time bar
  const calculateTaskSegments = () => {
    if (shiftDurationSeconds === 0 || tasks.length === 0) return [];
    
    // Calculate total duration
    const totalDuration = tasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    if (totalDuration === 0) return [];
    
    // Sort tasks: billable first (left), non-billable last (right)
    const sortedTasks = [...tasks].sort((a, b) => {
      const aIsBillable = !isNonBillableTask(a.name);
      const bIsBillable = !isNonBillableTask(b.name);
      
      // Billable tasks come first (return -1), non-billable come last (return 1)
      if (aIsBillable && !bIsBillable) return -1;
      if (!aIsBillable && bIsBillable) return 1;
      return 0; // Keep original order for same type
    });
    
    // Calculate segment widths based on duration (will add 2px gaps visually)
    let cumulativeLeft = 0;
    const gapPercent = 0.5; // Approximate 2px gap as percentage
    
    return sortedTasks.map((task, idx) => {
      const segmentWidth = (task.duration / shiftDurationSeconds) * 100;
      const left = cumulativeLeft;
      // Add gap after each segment except the last
      cumulativeLeft += segmentWidth + (idx < sortedTasks.length - 1 ? gapPercent : 0);
      
      return {
        ...task,
        left: Math.min(100, left),
        width: Math.min(100 - left, segmentWidth)
      };
    });
  };

  const taskSegments = calculateTaskSegments();
  
  // Popover styling (subdued, similar to ClientInfoPane)
  const popoverBg = useColorModeValue('white', 'gray.800');
  const popoverBorderColor = useColorModeValue('#e2e8f0', 'gray.600');

  return (
    <Flex
      direction="column"
      w="320px"
      px={3}
      py={3}
      bg="gray.800"
      borderLeft="1px solid"
      borderColor="whiteAlpha.100"
      gap={3}
    >
      {/* Current Time and Time Difference - One Line */}
      <Flex align="center" justify="space-between" gap={2}>
        <Flex align="center" gap={2}>
          <Badge
            px={3}
            py={1}
            borderRadius="sm"
            bg="green.500"
            color="white"
            fontSize="13px"
            fontWeight="700"
            letterSpacing="0.05em"
            boxShadow="0 2px 8px rgba(72, 187, 120, 0.4)"
          >
            {currentTimeGMT8}
          </Badge>
          <IconButton
            aria-label="Add custom task"
            icon={<Plus size={12} strokeWidth={3} style={{ strokeLinecap: 'square', strokeLinejoin: 'miter' }} />}
            size="xs"
            variant="ghost"
            colorScheme="green"
            color="green.400"
            border="1px solid"
            borderColor="green.400"
            borderRadius={3}
            _hover={{ bg: 'green.500', color: 'white', borderColor: 'green.500' }}
            onClick={onAddCustomTask}
          />
        </Flex>
        <Box
          bg={timeDifference >= 0 ? 'blue.500' : 'gray.600'}
          borderRadius="sm"
          px={3}
          py={1}
          textAlign="center"
        >
          <Text fontSize="12px" color="whiteAlpha.900" fontWeight="600" fontFamily="mono">
            {timeDifference >= 0 ? 'Ahead' : 'Behind'} {formatTimeDifference(timeDifference)}
          </Text>
        </Box>
      </Flex>

      {/* Comparison Progress Bars */}
      <Box>
        {/* Shift Time Progress Bar */}
        <Box mb={2}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="10px" color="gray.500" fontWeight="500">
              Shift Time
            </Text>
            <Text fontSize="10px" color={shiftProgress > 100 ? 'red.400' : 'cyan.400'} fontWeight="600">
              {formatTime(currentTimeInShift)}
            </Text>
          </Flex>
          <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="sm" overflow="visible">
            {/* Base progress bar (up to 100%) */}
            <Box
              position="absolute"
              left="0"
              top="0"
              h="100%"
              w={`${Math.min(100, Math.max(0, shiftProgress))}%`}
              bg={shiftProgress > 100 ? 'red.500' : 'cyan.500'}
              transition="width 0.3s ease"
              borderRadius="sm"
            />
            {/* Overlapping progress bar for excess (beyond 100%) */}
            {shiftProgress > 100 && (
              <Box
                position="absolute"
                left="100%"
                top="0"
                h="100%"
                w={`${Math.min(100, shiftProgress - 100)}%`}
                bg="red.600"
                transition="width 0.3s ease"
                borderRadius="0 sm sm 0"
                borderLeft="2px solid"
                borderColor="red.400"
              />
            )}
            {/* Current Time Indicator Line */}
            {currentTimePosition > 0 && (
              <Box
                position="absolute"
                left={`${Math.min(100, currentTimePosition)}%`}
                top="-4px"
                w="2px"
                h="32px"
                bg={currentTimePosition > 100 ? 'red.400' : 'green.400'}
                borderRadius="full"
                zIndex={10}
                boxShadow={currentTimePosition > 100 ? '0 0 8px rgba(248, 113, 113, 0.9)' : '0 0 8px rgba(72, 187, 120, 0.9)'}
                transform="translateX(-50%)"
                sx={{
                  '@keyframes pulse': {
                    '0%, 100%': {
                      opacity: 1,
                    },
                    '50%': {
                      opacity: 0.7,
                    },
                  },
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
            )}
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
              <Text fontSize="10px" fontWeight="700" color="white" textShadow="0 1px 3px rgba(0,0,0,0.6)">
                {shiftProgress.toFixed(0)}%
              </Text>
            </Flex>
          </Box>
        </Box>

        {/* Logged Time Progress Bar with Task Segments */}
        <Box mb={2}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="10px" color="gray.500" fontWeight="500">
              Logged Time
            </Text>
            <Text fontSize="10px" color="blue.400" fontWeight="600">
              {formatTime(todayTimeWorked)}
            </Text>
          </Flex>
          <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="sm" overflow="visible">
            {/* 85% Productivity Target Line */}
            <Box
              position="absolute"
              left="85%"
              top="0"
              bottom="0"
              w="1px"
              bg="green.400"
              opacity={0.5}
              zIndex={10}
              pointerEvents="none"
            />
            {/* Task Segments - only show segments within logged time progress */}
            <Box position="relative" h="100%" overflow="hidden" borderRadius="sm">
            {taskSegments.map((segment, idx) => {
              // Only render segment if it's within the logged time progress
              const segmentEnd = segment.left + segment.width;
              const segmentName = segment.name || `Task ${idx + 1}`;
              const segmentDuration = formatTime(segment.duration);
              
              if (segmentEnd > loggedTimeProgress) {
                // Clip segment to logged time progress
                const clippedWidth = Math.max(0, loggedTimeProgress - segment.left);
                if (clippedWidth <= 0) return null;
                
                return (
                  <Box
                    key={idx}
                    position="absolute"
                    left={`${segment.left}%`}
                    top="0"
                    h="100%"
                    w={`${clippedWidth}%`}
                    cursor="pointer"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (segment.id && onEditTask) {
                        // Load task and open edit modal directly
                        await onEditTask(segment.id);
                      }
                    }}
                    style={{
                      marginRight: idx < taskSegments.length - 1 && segmentEnd <= loggedTimeProgress ? '2px' : '0'
                    }}
                  >
                    <Popover placement="bottom" trigger="hover" openDelay={200} closeOnBlur={true}>
                      <PopoverTrigger>
                        <Box
                          w="100%"
                          h="100%"
                          bg={segment.isBillable ? 'blue.500' : 'orange.500'}
                          transition="all 0.3s ease"
                          borderRadius={segment.left === 0 ? 'sm 0 0 sm' : idx === taskSegments.length - 1 && segmentEnd <= loggedTimeProgress ? '0 sm sm 0' : '0'}
                          _hover={{ opacity: 0.9 }}
                        />
                      </PopoverTrigger>
                    <Portal>
                      <PopoverContent
                        bg={popoverBg}
                        border="1px solid"
                        borderColor={popoverBorderColor}
                        boxShadow="lg"
                        w="auto"
                        minW="150px"
                        maxW="250px"
                        zIndex={9999}
                      >
                        <PopoverArrow bg={popoverBg} borderColor={popoverBorderColor} />
                        <PopoverBody p={3}>
                          <VStack align="stretch" spacing={2}>
                            <Text fontSize="sm" fontWeight="semibold" color={useColorModeValue('gray.800', 'white')}>
                              {segmentName}
                            </Text>
                            <Flex align="center" gap={2}>
                              <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')}>
                                Duration:
                              </Text>
                              <Text fontSize="xs" fontWeight="medium" color={useColorModeValue('gray.800', 'gray.200')}>
                                {segmentDuration}
                              </Text>
                            </Flex>
                            {segment.narration && (
                              <Box>
                                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mb={1}>
                                  Narration:
                                </Text>
                                <Text fontSize="xs" color={useColorModeValue('gray.700', 'gray.300')} fontStyle="italic">
                                  {segment.narration}
                                </Text>
                              </Box>
                            )}
                            {segment.isBillable === false && (
                              <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5} width="fit-content">
                                Non-Billable
                              </Badge>
                            )}
                            <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.500')} fontStyle="italic" mt={1}>
                              Click to edit
                            </Text>
                          </VStack>
                        </PopoverBody>
                      </PopoverContent>
                    </Portal>
                    </Popover>
                  </Box>
                );
              }
              
              return (
                <Box
                  key={idx}
                  position="absolute"
                  left={`${segment.left}%`}
                  top="0"
                  h="100%"
                  w={`${segment.width}%`}
                  style={{
                    marginRight: idx < taskSegments.length - 1 ? '2px' : '0'
                  }}
                >
                  <Popover placement="bottom" trigger="hover" openDelay={200} closeOnBlur={true}>
                    <PopoverTrigger>
                      <Box
                        w="100%"
                        h="100%"
                        bg={segment.isBillable ? 'blue.500' : 'orange.500'}
                        transition="all 0.3s ease"
                        borderRadius={segment.left === 0 ? 'sm 0 0 sm' : idx === taskSegments.length - 1 ? '0 sm sm 0' : '0'}
                        cursor="pointer"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (segment.id && onEditTask) {
                            // Load task and open edit modal directly
                            await onEditTask(segment.id);
                          }
                        }}
                        onMouseDown={async (e) => {
                          // Also handle mousedown as fallback
                          if (e.button === 0 && segment.id && onEditTask) { // Left click only
                            e.stopPropagation();
                            await onEditTask(segment.id);
                          }
                        }}
                        _hover={{ opacity: 0.9 }}
                      />
                    </PopoverTrigger>
                  <Portal>
                    <PopoverContent
                      bg={popoverBg}
                      border="1px solid"
                      borderColor={popoverBorderColor}
                      boxShadow="lg"
                      w="auto"
                      minW="150px"
                      maxW="250px"
                      zIndex={9999}
                    >
                      <PopoverArrow bg={popoverBg} borderColor={popoverBorderColor} />
                      <PopoverBody p={3}>
                        <VStack align="stretch" spacing={1}>
                          <Text fontSize="sm" fontWeight="semibold" color={useColorModeValue('gray.800', 'white')}>
                            {segmentName}
                          </Text>
                          <Flex align="center" gap={2}>
                            <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')}>
                              Duration:
                            </Text>
                            <Text fontSize="xs" fontWeight="medium" color={useColorModeValue('gray.800', 'gray.200')}>
                              {segmentDuration}
                            </Text>
                          </Flex>
                          {segment.isBillable === false && (
                            <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5} width="fit-content">
                              Non-Billable
                            </Badge>
                          )}
                        </VStack>
                      </PopoverBody>
                    </PopoverContent>
                  </Portal>
                </Popover>
                </Box>
              );
            })}
            {/* Overall progress overlay for percentage */}
            {loggedTimeProgress > 0 && (
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
                <Text fontSize="10px" fontWeight="700" color="white" textShadow="0 1px 3px rgba(0,0,0,0.8)">
                  {loggedTimeProgress.toFixed(0)}%
                </Text>
              </Flex>
            )}
            </Box>
          </Box>
        </Box>
        
        {/* Today's Summary Section */}
        <Box mt={3}>
          <Flex align="center" gap={2} mb={2}>
            <Icon as={Clock} boxSize={3.5} color="gray.400" />
            <Text fontSize="11px" fontWeight="600" color="gray.300" textTransform="uppercase" letterSpacing="0.05em">
              Today's Summary
            </Text>
          </Flex>
          <VStack spacing={2} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontSize="10px" color="gray.500" fontWeight="500">
                Total Time
              </Text>
              <Text fontSize="11px" color="white" fontWeight="600">
                {formatTime(todayTimeWorked)}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="10px" color="gray.500" fontWeight="500">
                Billable Time
              </Text>
              <Text fontSize="11px" color="blue.400" fontWeight="600">
                {formatTime(billableTimeWorked)}
              </Text>
            </Flex>
            {productivityPercentage > 0 && (
              <Flex justify="space-between" align="center" pt={1} borderTop="1px solid" borderColor="whiteAlpha.100">
                <Text fontSize="10px" color="gray.500" fontWeight="500">
                  Productivity
                </Text>
                <Text fontSize="11px" color={productivityPercentage >= 85 ? 'green.400' : productivityPercentage >= 70 ? 'yellow.400' : 'orange.400'} fontWeight="600">
                  {productivityPercentage.toFixed(0)}%
                </Text>
              </Flex>
            )}
          </VStack>
        </Box>
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
  
  // Task search state
  const [taskSearchValue, setTaskSearchValue] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState<any[]>([]);
  const [isTaskSearchOpen, setIsTaskSearchOpen] = useState(false);
  const [isTaskSearchLoading, setIsTaskSearchLoading] = useState(false);
  const taskSearchInputRef = useRef<HTMLInputElement>(null);
  const taskSearchContainerRef = useRef<HTMLDivElement>(null);
  const editTaskInputRef = useRef<HTMLInputElement>(null);
  const editTaskDropdownRef = useRef<HTMLDivElement>(null);
  const { setStatus } = useAppContext();
  
  // Edit modal state
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [editingTaskDuration, setEditingTaskDuration] = useState('');
  const [editingTaskNarration, setEditingTaskNarration] = useState('');
  const [presetTaskOptions, setPresetTaskOptions] = useState<string[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  
  // Add custom task modal state
  const { isOpen: isAddCustomTaskModalOpen, onOpen: onAddCustomTaskModalOpen, onClose: onAddCustomTaskModalClose } = useDisclosure();
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskDuration, setCustomTaskDuration] = useState('');
  const [customTaskNarration, setCustomTaskNarration] = useState('');
  const [customTaskPresetOptions, setCustomTaskPresetOptions] = useState<string[]>([]);
  const [showCustomTaskPresetDropdown, setShowCustomTaskPresetDropdown] = useState(false);
  const customTaskInputRef = useRef<HTMLInputElement>(null);
  const customTaskDropdownRef = useRef<HTMLDivElement>(null);
  
  // Stop timer confirmation modal state
  const { isOpen: isStopTimerModalOpen, onOpen: onStopTimerModalOpen, onClose: onStopTimerModalClose } = useDisclosure();
  const [stopTimerTaskName, setStopTimerTaskName] = useState('');
  const [stopTimerDuration, setStopTimerDuration] = useState('');
  const [stopTimerNarration, setStopTimerNarration] = useState('');
  const [stopTimerPresetOptions, setStopTimerPresetOptions] = useState<string[]>([]);
  const [showStopTimerPresetDropdown, setShowStopTimerPresetDropdown] = useState(false);
  const stopTimerInputRef = useRef<HTMLInputElement>(null);
  const stopTimerDropdownRef = useRef<HTMLDivElement>(null);
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  
  // Non-billable tasks
  const NON_BILLABLE_TASKS = [
    'Internal - Meetings',
    'Internal - IT Issues',
    'Internal - Workflow Planning'
  ];
  
  // Helper function to check if a task is non-billable
  const isNonBillableTask = (taskName: string): boolean => {
    return NON_BILLABLE_TASKS.some(nbTask => 
      taskName && taskName.toLowerCase().includes(nbTask.toLowerCase())
    );
  };
  
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
          
          // Validate the state before restoring it
          // Don't restore if:
          // 1. Task has an endTime (completed tasks shouldn't be restored)
          // 2. Task is from a different day
          // 3. Task is not actually running
          if (newState.currentTask) {
            // Check if task is completed (has endTime)
            if (newState.currentTask.endTime) {
              console.log('[FloatingTimer] ⚠️ Ignoring storage change - task is completed (has endTime)');
              return;
            }
            
            // Check if task is from a different day
            if (taskTimerService.isTaskFromDifferentDay(newState.currentTask)) {
              console.log('[FloatingTimer] ⚠️ Ignoring storage change - task is from a different day');
              return;
            }
            
            // Only restore if task is actually running
            if (!newState.isRunning) {
              console.log('[FloatingTimer] ⚠️ Ignoring storage change - task is not running');
              return;
            }
          }
          
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
  
  // Task search handler
  const handleTaskSearch = async (value: string) => {
    setTaskSearchValue(value);
    if (!value.trim()) {
      setTaskSearchResults([]);
      return;
    }
    setIsTaskSearchLoading(true);
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = config.clientbasePath;
      if (!csvPath) {
        setTaskSearchResults([]);
        setIsTaskSearchLoading(false);
        return;
      }
      const rows = await window.electronAPI.readCsv(csvPath);
      if (!rows || rows.length === 0) {
        setTaskSearchResults([]);
        setIsTaskSearchLoading(false);
        return;
      }
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const filtered = rows.filter((row: any) => {
        const clientNameField = clientNameFields.find(field => row[field] !== undefined);
        if (clientNameField && row[clientNameField]) {
          const clientValue = String(row[clientNameField]).toLowerCase();
          return clientValue.includes(value.toLowerCase());
        }
        return false;
      }).slice(0, 3);
      
      // Add non-billable tasks that match search
      const nonBillableMatches = NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 3 - filtered.length);
      
      const results = [
        ...filtered.map((row: any) => {
          const clientNameField = clientNameFields.find(field => row[field] !== undefined);
          return {
            name: clientNameField ? row[clientNameField] : 'Unknown',
            type: 'client'
          };
        }),
        ...nonBillableMatches.map(task => ({ name: task, type: 'internal' }))
      ].slice(0, 3);
      
      setTaskSearchResults(results);
    } catch (error) {
      setTaskSearchResults([]);
    }
    setIsTaskSearchLoading(false);
  };
  
  const handleTaskSelect = (taskName: string) => {
    setTaskName(taskName);
    setTaskSearchValue(taskName); // Set to selected task name so it shows in the input
    setTaskSearchResults([]);
    setIsTaskSearchOpen(false);
    if (timerState.currentTask) {
      setTimerState({
        ...timerState,
        currentTask: {
          ...timerState.currentTask,
          name: taskName
        }
      });
    }
  };
  
  // Search tasks dynamically (similar to handleTaskSearch)
  const searchPresetTasks = async (searchValue: string) => {
    console.log('[FloatingTimer] 🔍 searchPresetTasks called with:', searchValue);
    
    if (!searchValue.trim()) {
      console.log('[FloatingTimer] ⚠️ Empty search value, returning non-billable tasks only');
      setPresetTaskOptions([...NON_BILLABLE_TASKS]);
      return;
    }
    
    try {
      const options: string[] = [];
      
      // Add non-billable tasks that match
      const nonBillableMatches = NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      );
      console.log('[FloatingTimer] 📋 Non-billable matches:', nonBillableMatches);
      options.push(...nonBillableMatches);
      
      // Search client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      console.log('[FloatingTimer] 📂 CSV Path:', csvPath);
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        console.log('[FloatingTimer] 📊 Total rows in CSV:', rows?.length || 0);
        
        if (rows && rows.length > 0) {
          const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
          
          // Log first row structure for debugging
          if (rows.length > 0) {
            console.log('[FloatingTimer] 🔍 First row keys:', Object.keys(rows[0]));
            console.log('[FloatingTimer] 🔍 First row sample:', rows[0]);
          }
          
          const filtered = rows.filter((row: any) => {
            const clientNameField = clientNameFields.find(field => row[field] !== undefined);
            if (clientNameField && row[clientNameField]) {
              const clientValue = String(row[clientNameField]).toLowerCase();
              const matches = clientValue.includes(searchValue.toLowerCase());
              if (matches) {
                console.log('[FloatingTimer] ✅ Match found:', row[clientNameField], 'using field:', clientNameField);
              }
              return matches;
            }
            return false;
          });
          
          console.log('[FloatingTimer] 🎯 Filtered rows count:', filtered.length);
          console.log('[FloatingTimer] 🎯 Filtered rows (first 5):', filtered.slice(0, 5).map((r: any) => {
            const field = clientNameFields.find(f => r[f] !== undefined);
            return field ? r[field] : 'N/A';
          }));
          
          const limitedFiltered = filtered.slice(0, 10); // Limit to 10 client results
          console.log('[FloatingTimer] 📏 After limiting to 10:', limitedFiltered.length);
          
          const clientNames = limitedFiltered.map((row: any) => {
            const clientNameField = clientNameFields.find(field => row[field] !== undefined);
            return clientNameField ? String(row[clientNameField]) : null;
          }).filter((name: string | null): name is string => name !== null && name.trim() !== '');
          
          console.log('[FloatingTimer] 📝 Client names extracted:', clientNames);
          console.log('[FloatingTimer] 📝 Client names count:', clientNames.length);
          options.push(...clientNames);
        } else {
          console.log('[FloatingTimer] ⚠️ No rows found in CSV or CSV is empty');
        }
      } else {
        console.log('[FloatingTimer] ⚠️ No CSV path configured');
      }
      
      // Only show database client names and non-billable tasks, not custom task names
      const finalOptions = [...new Set(options)];
      console.log('[FloatingTimer] ✅ Final options (unique):', finalOptions);
      console.log('[FloatingTimer] ✅ Final options count:', finalOptions.length);
      setPresetTaskOptions(finalOptions);
    } catch (error) {
      console.error('[FloatingTimer] ❌ Error searching preset tasks:', error);
      const fallbackOptions = [...NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      )];
      console.log('[FloatingTimer] 🔄 Using fallback options:', fallbackOptions);
      setPresetTaskOptions(fallbackOptions);
    }
  };
  
  // Load preset task options (initial load)
  const loadPresetTasks = async () => {
    console.log('[FloatingTimer] 📥 loadPresetTasks called (initial load)');
    
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      console.log('[FloatingTimer] 📂 CSV Path:', csvPath);
      const options: string[] = [...NON_BILLABLE_TASKS];
      console.log('[FloatingTimer] 📋 Starting with non-billable tasks:', options);
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        console.log('[FloatingTimer] 📊 Total rows in CSV:', rows?.length || 0);
        
        if (rows && rows.length > 0) {
          // Log first row structure for debugging
          if (rows.length > 0) {
            console.log('[FloatingTimer] 🔍 First row keys:', Object.keys(rows[0]));
            console.log('[FloatingTimer] 🔍 First row sample:', rows[0]);
          }
          
          const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
          const clientNames = rows
            .map((row: any) => {
              const field = clientNameFields.find(f => row[f] !== undefined);
              return field ? String(row[field]) : null;
            })
            .filter((name: string | null): name is string => name !== null && name.trim() !== '');
          
          console.log('[FloatingTimer] 📝 All client names extracted:', clientNames);
          console.log('[FloatingTimer] 📝 All client names count:', clientNames.length);
          
          const limitedClientNames = clientNames.slice(0, 50);
          console.log('[FloatingTimer] 📏 After limiting to 50:', limitedClientNames.length);
          console.log('[FloatingTimer] 📏 Limited client names (first 10):', limitedClientNames.slice(0, 10));
          options.push(...limitedClientNames);
        } else {
          console.log('[FloatingTimer] ⚠️ No rows found in CSV or CSV is empty');
        }
      } else {
        console.log('[FloatingTimer] ⚠️ No CSV path configured');
      }
      
      // Only show database client names and non-billable tasks (no custom task names)
      const finalOptions = [...new Set(options)].sort();
      console.log('[FloatingTimer] ✅ Final options (unique, sorted):', finalOptions);
      console.log('[FloatingTimer] ✅ Final options count:', finalOptions.length);
      setPresetTaskOptions(finalOptions);
    } catch (error) {
      console.error('[FloatingTimer] ❌ Error loading preset tasks:', error);
      console.log('[FloatingTimer] 🔄 Using fallback (non-billable tasks only)');
      setPresetTaskOptions([...NON_BILLABLE_TASKS]);
    }
  };
  
  useEffect(() => {
    loadPresetTasks();
  }, []);
  
  // Reload preset tasks when edit modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      loadPresetTasks();
    }
  }, [isEditModalOpen]);
  
  // Handle opening edit modal
  const handleOpenEditModal = async (taskId: string) => {
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).getTaskLogs(today);
      
      if (result.success && result.tasks) {
        const task = result.tasks.find((t: Task) => t.id === taskId);
        if (task) {
          setEditingTask(task);
          setEditingTaskName(task.name);
          setEditingTaskDuration(taskTimerService.formatDuration(task.duration));
          setEditingTaskNarration(''); // Don't load narration in timer edit modal
          setShowPresetDropdown(false); // Hide dropdown when modal opens
          await loadPresetTasks();
          onEditModalOpen();
        }
      }
    } catch (error) {
      console.error('Error loading task for edit:', error);
    }
  };
  
  // Handle opening add custom task modal
  const handleOpenAddCustomTaskModal = async () => {
    await loadCustomTaskPresetTasks();
    onAddCustomTaskModalOpen();
  };
  
  // Format duration input with automatic colons (hh:mm:ss)
  const formatDurationInput = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Limit to 6 digits (hhmmss)
    const limited = digits.slice(0, 6);
    
    // Format with colons
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 4) {
      return `${limited.slice(0, 2)}:${limited.slice(2)}`;
    } else {
      return `${limited.slice(0, 2)}:${limited.slice(2, 4)}:${limited.slice(4)}`;
    }
  };
  
  // Handle saving edit
  const handleSaveEdit = async () => {
    if (!editingTask || !editingTaskName.trim() || !editingTaskDuration.trim()) {
      return;
    }
    
    // Parse duration
    let newDuration = editingTask.duration;
    const durationMatch = editingTaskDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = durationMatch[3] ? parseInt(durationMatch[3]) : 0;
      newDuration = hours * 3600 + minutes * 60 + seconds;
    } else {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    
    // Update task (don't update narration in timer edit modal)
    const updatedTask: Task = {
      ...editingTask,
      name: editingTaskName.trim(),
      duration: newDuration,
      // Keep existing narration, don't update it from timer edit modal
      endTime: new Date(new Date(editingTask.startTime).getTime() + newDuration * 1000).toISOString()
    };
    
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).saveTaskLog(today, updatedTask);
      if (result.success) {
        onEditModalClose();
        setEditingTask(null);
        // Refresh the infographic by triggering a re-render
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save task changes');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task changes');
    }
  };
  
  // Handle deleting task
  const handleDeleteTask = async () => {
    if (!editingTask) {
      return;
    }
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the task "${editingTask.name}"?`)) {
      return;
    }
    
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).deleteTaskLog(today, editingTask.id);
      
      if (result.success) {
        onEditModalClose();
        setEditingTask(null);
        setEditingTaskName('');
        setEditingTaskDuration('');
        // Refresh the infographic by triggering a re-render
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task');
    }
  };
  
  // Handle canceling edit
  const handleCancelEdit = () => {
    setShowPresetDropdown(false); // Hide dropdown when modal closes
    onEditModalClose();
    setEditingTask(null);
    setEditingTaskName('');
    setEditingTaskDuration('');
    setEditingTaskNarration('');
  };
  
  // Handle saving custom task
  const handleSaveCustomTask = async () => {
    if (!customTaskName.trim() || !customTaskDuration.trim()) {
      return;
    }
    
    // Parse duration
    let duration = 0;
    const durationMatch = customTaskDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = durationMatch[3] ? parseInt(durationMatch[3]) : 0;
      duration = hours * 3600 + minutes * 60 + seconds;
    } else {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    
    try {
      const today = taskTimerService.getTodayDateString();
      const now = new Date();
      
      // Create new task
      const newTask: Task = {
        id: `custom-${Date.now()}`,
        name: customTaskName.trim(),
        startTime: new Date(now.getTime() - duration * 1000).toISOString(),
        endTime: now.toISOString(),
        duration: duration,
        isPaused: false,
        narration: customTaskNarration.trim() || undefined
      };
      
      const result = await (window.electronAPI as any).saveTaskLog(today, newTask);
      if (result.success) {
        onAddCustomTaskModalClose();
        setCustomTaskName('');
        setCustomTaskDuration('');
        setCustomTaskNarration('');
        setShowCustomTaskPresetDropdown(false);
        // Refresh the infographic by triggering a re-render
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save custom task');
      }
    } catch (error) {
      console.error('Error saving custom task:', error);
      alert('Error saving custom task');
    }
  };
  
  // Handle canceling add custom task
  const handleCancelAddCustomTask = () => {
    setShowCustomTaskPresetDropdown(false);
    onAddCustomTaskModalClose();
    setCustomTaskName('');
    setCustomTaskDuration('');
    setCustomTaskNarration('');
  };
  
  // Search preset tasks for custom task modal
  const searchCustomTaskPresetTasks = async (searchValue: string) => {
    if (!searchValue.trim()) {
      setCustomTaskPresetOptions([]);
      return;
    }
    
    try {
      const options: string[] = [];
      
      // Add non-billable tasks that match
      const nonBillableMatches = NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      );
      options.push(...nonBillableMatches);
      
      // Search client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        const clientNameFields = ['Client Name', 'Client', 'Name', 'Company'];
        
        const clientNames = rows
          .map((row: any) => {
            const field = clientNameFields.find(f => row[f] && row[f].trim());
            return field ? row[field].trim() : null;
          })
          .filter((name: string | null): name is string => name !== null && name.toLowerCase().includes(searchValue.toLowerCase()))
          .slice(0, 50);
        
        options.push(...clientNames);
      }
      
      const finalOptions = [...new Set(options)];
      setCustomTaskPresetOptions(finalOptions);
    } catch (error) {
      console.error('Error searching preset tasks:', error);
      setCustomTaskPresetOptions([]);
    }
  };
  
  // Load preset tasks for custom task modal
  const loadCustomTaskPresetTasks = async () => {
    try {
      const options: string[] = [];
      
      // Add all non-billable tasks
      options.push(...NON_BILLABLE_TASKS);
      
      // Load client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        const clientNameFields = ['Client Name', 'Client', 'Name', 'Company'];
        
        const clientNames = rows
          .map((row: any) => {
            const field = clientNameFields.find(f => row[f] && row[f].trim());
            return field ? row[field].trim() : null;
          })
          .filter((name: string | null): name is string => name !== null)
          .slice(0, 50);
        
        options.push(...clientNames);
      }
      
      const finalOptions = [...new Set(options)].sort();
      setCustomTaskPresetOptions(finalOptions);
    } catch (error) {
      console.error('Error loading preset tasks:', error);
      setCustomTaskPresetOptions(NON_BILLABLE_TASKS);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taskSearchContainerRef.current && !taskSearchContainerRef.current.contains(event.target as Node)) {
        setIsTaskSearchOpen(false);
      }
    };
    if (isTaskSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTaskSearchOpen]);
  
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
    
    const calculatedDuration = taskTimerService.calculateDuration(timerState.currentTask, false);
    const finalTask: Task = {
      ...timerState.currentTask,
      endTime: new Date().toISOString(),
      duration: calculatedDuration,
      pausedDuration: timerState.currentTask.pausedDuration + pauseDuration,
      isPaused: false
    };
    
    // Set up confirmation modal with current task data
    setPendingTask(finalTask);
    setStopTimerTaskName(finalTask.name);
    setStopTimerDuration(taskTimerService.formatDuration(calculatedDuration));
    setStopTimerNarration(finalTask.narration || '');
    await loadStopTimerPresetTasks();
    onStopTimerModalOpen();
  };
  
  // Load preset tasks for stop timer modal
  const loadStopTimerPresetTasks = async () => {
    try {
      const options: string[] = [];
      
      // Add all non-billable tasks
      options.push(...NON_BILLABLE_TASKS);
      
      // Load client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        const clientNameFields = ['Client Name', 'Client', 'Name', 'Company'];
        
        const clientNames = rows
          .map((row: any) => {
            const field = clientNameFields.find(f => row[f] && row[f].trim());
            return field ? row[field].trim() : null;
          })
          .filter((name: string | null): name is string => name !== null)
          .slice(0, 50);
        
        options.push(...clientNames);
      }
      
      const finalOptions = [...new Set(options)].sort();
      setStopTimerPresetOptions(finalOptions);
    } catch (error) {
      console.error('Error loading preset tasks:', error);
      setStopTimerPresetOptions(NON_BILLABLE_TASKS);
    }
  };
  
  // Search preset tasks for stop timer modal
  const searchStopTimerPresetTasks = async (searchValue: string) => {
    if (!searchValue.trim()) {
      setStopTimerPresetOptions([]);
      return;
    }
    
    try {
      const options: string[] = [];
      
      // Add non-billable tasks that match
      const nonBillableMatches = NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      );
      options.push(...nonBillableMatches);
      
      // Search client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        const clientNameFields = ['Client Name', 'Client', 'Name', 'Company'];
        
        const clientNames = rows
          .map((row: any) => {
            const field = clientNameFields.find(f => row[f] && row[f].trim());
            return field ? row[field].trim() : null;
          })
          .filter((name: string | null): name is string => name !== null && name.toLowerCase().includes(searchValue.toLowerCase()))
          .slice(0, 50);
        
        options.push(...clientNames);
      }
      
      const finalOptions = [...new Set(options)];
      setStopTimerPresetOptions(finalOptions);
    } catch (error) {
      console.error('Error searching preset tasks:', error);
      setStopTimerPresetOptions([]);
    }
  };
  
  // Handle confirming stop timer
  const handleConfirmStopTimer = async () => {
    if (!pendingTask || !stopTimerTaskName.trim() || !stopTimerDuration.trim()) {
      return;
    }
    
    // Parse duration
    let duration = pendingTask.duration;
    const durationMatch = stopTimerDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = durationMatch[3] ? parseInt(durationMatch[3]) : 0;
      duration = hours * 3600 + minutes * 60 + seconds;
    } else {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    
    // Update task with modified values
    const finalTask: Task = {
      ...pendingTask,
      name: stopTimerTaskName.trim(),
      duration: duration,
      narration: stopTimerNarration.trim() || undefined
    };
    
    console.log('[FloatingTimer] 💾 Stopping and saving task:', finalTask.id, 'with', finalTask.windowTitles?.length || 0, 'window titles');
    
    // Save task to daily log
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).saveTaskLog(today, finalTask);
      console.log('[FloatingTimer] Save result:', result);
      
      if (result.success) {
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
        
        // Close modal and reset state
        onStopTimerModalClose();
        setPendingTask(null);
        setStopTimerTaskName('');
        setStopTimerDuration('');
        setStopTimerNarration('');
        setShowStopTimerPresetDropdown(false);
        
        // Trigger task update event to refresh infographic
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save task');
      }
    } catch (error) {
      console.error('[TaskTimer] Error saving task log:', error);
      alert('Error saving task log');
    }
  };
  
  // Handle canceling stop timer
  const handleCancelStopTimer = () => {
    setShowStopTimerPresetDropdown(false);
    onStopTimerModalClose();
    setPendingTask(null);
    setStopTimerTaskName('');
    setStopTimerDuration('');
    setStopTimerNarration('');
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
        border={isExpanded ? "1px solid" : "none"}
        borderColor={isExpanded ? "whiteAlpha.200" : "transparent"}
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
              Time Logger
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
                  <Icon as={Play} boxSize={5} color="green.400" />
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
                  <Icon as={Pause} boxSize={5} color="yellow.400" />
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
                  <Icon as={Square} boxSize={5} color="red.400" />
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
                {/* Task Name Search Input - Compact, positioned above timer */}
                <Box 
                  position="absolute"
                  top="20px"
                  width="100%"
                  maxW="500px"
                  ref={taskSearchContainerRef}
                >
                  <InputGroup>
                    <Input
                      ref={taskSearchInputRef}
                      value={timerState.isRunning ? taskName : taskSearchValue}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!timerState.isRunning) {
                          const value = e.target.value;
                          setTaskSearchValue(value);
                          setTaskName(value);
                          setIsTaskSearchOpen(true);
                          handleTaskSearch(value);
                          if (timerState.currentTask) {
                            setTimerState({
                              ...timerState,
                              currentTask: {
                                ...timerState.currentTask,
                                name: value
                              }
                            });
                          }
                        }
                      }}
                      onFocus={() => {
                        if (!timerState.isRunning) {
                          setIsTaskSearchOpen(true);
                          if (taskSearchValue) {
                            handleTaskSearch(taskSearchValue);
                          }
                        }
                      }}
                      placeholder="Search task or client name..."
                      fontSize="14px"
                      fontWeight="500"
                      bg="whiteAlpha.100"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="sm"
                      outline="none"
                      color="white"
                      _placeholder={{ color: 'gray.500', fontWeight: 'normal' }}
                      _hover={{ 
                        borderColor: timerState.isRunning ? 'whiteAlpha.200' : 'whiteAlpha.300',
                        bg: timerState.isRunning ? 'whiteAlpha.100' : 'whiteAlpha.150'
                      }}
                      _focus={{ 
                        borderColor: timerState.isRunning ? 'whiteAlpha.200' : timerColor, 
                        boxShadow: timerState.isRunning ? 'none' : `0 0 0 2px ${timerColor}40`,
                        bg: 'whiteAlpha.150'
                      }}
                      textAlign="left"
                      pl={10}
                      pr={10}
                      py={2.5}
                      cursor={timerState.isRunning ? "not-allowed" : "text"}
                      transition="all 0.2s ease"
                      readOnly={timerState.isRunning}
                      opacity={timerState.isRunning ? 0.6 : 1}
                    />
                    <InputLeftElement pl={3}>
                      <Icon as={Search} boxSize={4} color={timerState.isRunning ? "gray.500" : "gray.400"} />
                    </InputLeftElement>
                    <InputRightElement pr={3}>
                      {isTaskSearchLoading && (
                        <Spinner size="xs" color="blue.400" />
                      )}
                    </InputRightElement>
                  </InputGroup>
                  
                  {/* Dropdown Results */}
                  {isTaskSearchOpen && !timerState.isRunning && (isTaskSearchLoading || taskSearchResults.length > 0 || taskSearchValue) && (
                    <Box
                      position="absolute"
                      top="100%"
                      left="0"
                      right="0"
                      mt={1}
                      bg="gray.800"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="md"
                      boxShadow="0 4px 12px rgba(0,0,0,0.4)"
                      maxH="200px"
                      overflowY="auto"
                      zIndex={1000}
                    >
                      {isTaskSearchLoading ? (
                        <Flex justify="center" align="center" py={4}>
                          <Text color="gray.500" fontSize="sm">Searching...</Text>
                        </Flex>
                      ) : taskSearchResults.length > 0 ? (
                        <VStack spacing={0} align="stretch" p={1}>
                          {taskSearchResults.map((result, idx) => (
                            <Box
                              key={idx}
                              px={3}
                              py={2}
                              cursor="pointer"
                              _hover={{ bg: 'whiteAlpha.100' }}
                              onClick={() => handleTaskSelect(result.name)}
                              borderBottom={idx < taskSearchResults.length - 1 ? '1px solid' : 'none'}
                              borderColor="whiteAlpha.100"
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="12px" fontWeight="500" color="white">
                                  {result.name}
                                </Text>
                                {result.type === 'internal' && (
                                  <Badge colorScheme="orange" fontSize="9px" px={1.5} py={0}>
                                    Internal
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      ) : taskSearchValue ? (
                        <Box textAlign="center" py={4}>
                          <Text color="gray.500" fontSize="sm">No results found</Text>
                        </Box>
                      ) : null}
                    </Box>
                  )}
                </Box>
                
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
              <WorkShiftInfographic onEditTask={handleOpenEditModal} onAddCustomTask={handleOpenAddCustomTaskModal} />
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
    
    {/* Edit Task Modal */}
    <Modal 
      isOpen={isEditModalOpen} 
      onClose={handleCancelEdit} 
      size="md"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={useColorModeValue('white', 'gray.800')} maxW="500px" maxH="90vh">
        <ModalHeader borderBottomWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.600')} py={3} fontSize="md">
          Edit Task
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4} overflowY="auto">
          <Flex direction="row" gap={4} align="flex-start">
            {/* Left Column - Task Name */}
            <Box flex={1}>
              <FormControl>
                <FormLabel fontSize="sm">Task Name</FormLabel>
                <Box position="relative">
                  <Input
                    ref={editTaskInputRef}
                    value={editingTaskName}
                    onChange={async (e) => {
                      const value = e.target.value;
                      setEditingTaskName(value);
                      // Only show dropdown if input is focused (onChange only fires when focused, but double-check)
                      const isFocused = document.activeElement === editTaskInputRef.current;
                      if (value.length > 0 && isFocused) {
                        setShowPresetDropdown(true);
                        await searchPresetTasks(value); // Search dynamically
                      } else if (isFocused) {
                        setShowPresetDropdown(false);
                        await loadPresetTasks(); // Load all when empty
                      } else {
                        setShowPresetDropdown(false);
                      }
                    }}
                    onFocus={async () => {
                      if (editingTaskName.length > 0) {
                        setShowPresetDropdown(true);
                        await searchPresetTasks(editingTaskName);
                      } else {
                        await loadPresetTasks();
                      }
                    }}
                    onBlur={(e) => {
                      // Use setTimeout to allow clicks on dropdown to register first
                      setTimeout(() => {
                        // Check if the new focus target is not within the dropdown
                        const relatedTarget = e.relatedTarget as HTMLElement;
                        if (
                          !editTaskDropdownRef.current?.contains(relatedTarget) &&
                          !editTaskInputRef.current?.contains(relatedTarget)
                        ) {
                          setShowPresetDropdown(false);
                        }
                      }, 200);
                    }}
                    placeholder="Enter task name or select from presets..."
                    bg={useColorModeValue('white', 'gray.700')}
                    size="sm"
                  />
                  {showPresetDropdown && presetTaskOptions.length > 0 && (
                    <Box
                      ref={editTaskDropdownRef}
                      position="absolute"
                      top="100%"
                      left="0"
                      right="0"
                      mt={1}
                      bg={useColorModeValue('white', 'gray.800')}
                      border="1px solid"
                      borderColor={useColorModeValue('gray.200', 'gray.600')}
                      borderRadius="md"
                      boxShadow="lg"
                      maxH="200px"
                      overflowY="auto"
                      zIndex={1000}
                    >
                      <VStack spacing={0} align="stretch" p={1}>
                        {presetTaskOptions
                          .slice(0, 5)
                          .map((option, idx) => (
                            <Box
                              key={idx}
                              px={3}
                              py={2}
                              cursor="pointer"
                              _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                              onClick={() => {
                                setEditingTaskName(option);
                                setShowPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, presetTaskOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor={useColorModeValue('gray.200', 'gray.600')}
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
                                  {option}
                                </Text>
                                {isNonBillableTask(option) && (
                                  <Badge colorScheme="orange" fontSize="xs" px={1.5} py={0}>
                                    Internal
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          ))}
                      </VStack>
                    </Box>
                  )}
                </Box>
                {isNonBillableTask(editingTaskName) && (
                  <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5} width="fit-content" mt={2}>
                    Non-Billable
                  </Badge>
                )}
              </FormControl>
            </Box>
            
            {/* Right Column - Duration */}
            <Box flex={1}>
              <FormControl>
                <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                <Input
                  value={editingTaskDuration}
                  onChange={(e) => {
                    const formatted = formatDurationInput(e.target.value);
                    setEditingTaskDuration(formatted);
                  }}
                  placeholder="013000"
                  bg={useColorModeValue('white', 'gray.700')}
                  maxLength={8}
                  size="sm"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Type numbers only (e.g., 013000 for 01:30:00)
                </Text>
              </FormControl>
            </Box>
          </Flex>
          
          <Flex justify="space-between" align="center" mt={4}>
            <IconButton
              aria-label="Delete task"
              icon={<Trash2 size={16} />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={handleDeleteTask}
            />
            <Flex gap={2}>
              <Button variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSaveEdit}
                isDisabled={!editingTaskName.trim() || !editingTaskDuration.trim()}
              >
                Save Changes
              </Button>
            </Flex>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
    
    {/* Add Custom Task Modal */}
    <Modal 
      isOpen={isAddCustomTaskModalOpen} 
      onClose={handleCancelAddCustomTask} 
      size="md"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={useColorModeValue('white', 'gray.800')} maxW="600px" maxH="90vh">
        <ModalHeader borderBottomWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.600')} py={3} fontSize="md">
          <Flex justify="space-between" align="center" w="100%" pr={8}>
            <Text>Add Custom Task</Text>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleSaveCustomTask}
              isDisabled={!customTaskName.trim() || !customTaskDuration.trim()}
            >
              Add Task
            </Button>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4} overflowY="auto">
          <Flex direction="row" gap={4} align="flex-start">
            {/* Left Column - Task Name and Duration (stacked) */}
            <Box flex={1}>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm">Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      ref={customTaskInputRef}
                      value={customTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setCustomTaskName(value);
                        const isFocused = document.activeElement === customTaskInputRef.current;
                        if (value.length > 0 && isFocused) {
                          setShowCustomTaskPresetDropdown(true);
                          await searchCustomTaskPresetTasks(value);
                        } else if (isFocused) {
                          setShowCustomTaskPresetDropdown(false);
                          await loadCustomTaskPresetTasks();
                        } else {
                          setShowCustomTaskPresetDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        if (customTaskName.length > 0) {
                          setShowCustomTaskPresetDropdown(true);
                          await searchCustomTaskPresetTasks(customTaskName);
                        } else {
                          await loadCustomTaskPresetTasks();
                        }
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          if (
                            !customTaskDropdownRef.current?.contains(relatedTarget) &&
                            !customTaskInputRef.current?.contains(relatedTarget)
                          ) {
                            setShowCustomTaskPresetDropdown(false);
                          }
                        }, 200);
                      }}
                      placeholder="Enter task name or select from presets..."
                      bg={useColorModeValue('white', 'gray.700')}
                      size="sm"
                      autoFocus
                    />
                    {showCustomTaskPresetDropdown && customTaskPresetOptions.length > 0 && (
                      <Box
                        ref={customTaskDropdownRef}
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg={useColorModeValue('white', 'gray.800')}
                        border="1px solid"
                        borderColor={useColorModeValue('gray.200', 'gray.600')}
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={1000}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                          {customTaskPresetOptions
                            .slice(0, 5)
                            .map((option, idx) => (
                              <Box
                                key={idx}
                                px={3}
                                py={2}
                                cursor="pointer"
                                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                                onClick={() => {
                                  setCustomTaskName(option);
                                  setShowCustomTaskPresetDropdown(false);
                                }}
                                borderBottom={idx < Math.min(4, customTaskPresetOptions.length - 1) ? '1px solid' : 'none'}
                                borderColor={useColorModeValue('gray.200', 'gray.600')}
                              >
                                <Flex align="center" gap={2}>
                                  <Text fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
                                    {option}
                                  </Text>
                                  {isNonBillableTask(option) && (
                                    <Badge colorScheme="orange" fontSize="xs" px={1.5} py={0}>
                                      Internal
                                    </Badge>
                                  )}
                                </Flex>
                              </Box>
                            ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                  {isNonBillableTask(customTaskName) && (
                    <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5} width="fit-content" mt={2}>
                      Non-Billable
                    </Badge>
                  )}
                </FormControl>
                
                <FormControl>
                  <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={customTaskDuration}
                    onChange={(e) => {
                      const formatted = formatDurationInput(e.target.value);
                      setCustomTaskDuration(formatted);
                    }}
                    placeholder="013000"
                    bg={useColorModeValue('white', 'gray.700')}
                    maxLength={8}
                    size="sm"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Type numbers only (e.g., 013000 for 01:30:00)
                  </Text>
                </FormControl>
              </VStack>
            </Box>
            
            {/* Right Column - Narration */}
            <Box flex={1}>
              <FormControl>
                <FormLabel fontSize="sm">Narration (Optional)</FormLabel>
                <Textarea
                  value={customTaskNarration}
                  onChange={(e) => setCustomTaskNarration(e.target.value)}
                  placeholder="Describe what you did in this task..."
                  bg={useColorModeValue('white', 'gray.700')}
                  size="sm"
                  rows={5}
                />
              </FormControl>
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
    
    {/* Stop Timer Confirmation Modal */}
    <Modal 
      isOpen={isStopTimerModalOpen} 
      onClose={handleCancelStopTimer} 
      size="md"
      isCentered
      scrollBehavior="inside"
    >
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={useColorModeValue('white', 'gray.800')} maxW="600px" maxH="90vh">
        <ModalHeader borderBottomWidth="1px" borderColor={useColorModeValue('gray.200', 'gray.600')} py={3} fontSize="md">
          <Flex justify="space-between" align="center" w="100%" pr={8}>
            <Text>Confirm Task</Text>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleConfirmStopTimer}
              isDisabled={!stopTimerTaskName.trim() || !stopTimerDuration.trim()}
            >
              Save
            </Button>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={4} overflowY="auto">
          <Flex direction="row" gap={4} align="flex-start">
            {/* Left Column - Task Name and Duration (stacked) */}
            <Box flex={1}>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm">Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      ref={stopTimerInputRef}
                      value={stopTimerTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setStopTimerTaskName(value);
                        const isFocused = document.activeElement === stopTimerInputRef.current;
                        if (value.length > 0 && isFocused) {
                          setShowStopTimerPresetDropdown(true);
                          await searchStopTimerPresetTasks(value);
                        } else if (isFocused) {
                          setShowStopTimerPresetDropdown(false);
                          await loadStopTimerPresetTasks();
                        } else {
                          setShowStopTimerPresetDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        if (stopTimerTaskName.length > 0) {
                          setShowStopTimerPresetDropdown(true);
                          await searchStopTimerPresetTasks(stopTimerTaskName);
                        } else {
                          await loadStopTimerPresetTasks();
                        }
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          const relatedTarget = e.relatedTarget as HTMLElement;
                          if (
                            !stopTimerDropdownRef.current?.contains(relatedTarget) &&
                            !stopTimerInputRef.current?.contains(relatedTarget)
                          ) {
                            setShowStopTimerPresetDropdown(false);
                          }
                        }, 200);
                      }}
                      placeholder="Enter task name or select from presets..."
                      bg={useColorModeValue('white', 'gray.700')}
                      size="sm"
                    />
                    {showStopTimerPresetDropdown && stopTimerPresetOptions.length > 0 && (
                      <Box
                        ref={stopTimerDropdownRef}
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg={useColorModeValue('white', 'gray.800')}
                        border="1px solid"
                        borderColor={useColorModeValue('gray.200', 'gray.600')}
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={1000}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                          {stopTimerPresetOptions
                            .slice(0, 5)
                            .map((option, idx) => (
                              <Box
                                key={idx}
                                px={3}
                                py={2}
                                cursor="pointer"
                                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
                                onClick={() => {
                                  setStopTimerTaskName(option);
                                  setShowStopTimerPresetDropdown(false);
                                }}
                                borderBottom={idx < Math.min(4, stopTimerPresetOptions.length - 1) ? '1px solid' : 'none'}
                                borderColor={useColorModeValue('gray.200', 'gray.600')}
                              >
                                <Flex align="center" gap={2}>
                                  <Text fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
                                    {option}
                                  </Text>
                                  {isNonBillableTask(option) && (
                                    <Badge colorScheme="orange" fontSize="xs" px={1.5} py={0}>
                                      Internal
                                    </Badge>
                                  )}
                                </Flex>
                              </Box>
                            ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                  {isNonBillableTask(stopTimerTaskName) && (
                    <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5} width="fit-content" mt={2}>
                      Non-Billable
                    </Badge>
                  )}
                </FormControl>
                
                <FormControl>
                  <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={stopTimerDuration}
                    onChange={(e) => {
                      const formatted = formatDurationInput(e.target.value);
                      setStopTimerDuration(formatted);
                    }}
                    placeholder="013000"
                    bg={useColorModeValue('white', 'gray.700')}
                    maxLength={8}
                    size="sm"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Type numbers only (e.g., 013000 for 01:30:00)
                  </Text>
                </FormControl>
              </VStack>
            </Box>
            
            {/* Right Column - Narration */}
            <Box flex={1}>
              <FormControl>
                <FormLabel fontSize="sm">Narration (Optional)</FormLabel>
                <Textarea
                  value={stopTimerNarration}
                  onChange={(e) => setStopTimerNarration(e.target.value)}
                  placeholder="Describe what you did in this task..."
                  bg={useColorModeValue('white', 'gray.700')}
                  size="sm"
                  rows={5}
                />
              </FormControl>
            </Box>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
    
    </React.Fragment>
  );
};

