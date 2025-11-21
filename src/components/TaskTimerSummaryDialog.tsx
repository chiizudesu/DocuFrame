import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Box,
  Text,
  Flex,
  Icon,
  Collapse,
  useColorModeValue,
  Divider,
  Badge,
  VStack,
  IconButton,
  useDisclosure,
  Spinner,
  FormControl,
  FormLabel,
  Input,
  Tooltip,
  Spacer
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Clock, Trash2, ChevronLeft, Calendar, Plus, X } from 'lucide-react';
import { Task, taskTimerService } from '../services/taskTimer';
import { analyzeTaskSubTasks as analyzeTaskSubTasksAPI } from '../services/claude';

interface TaskTimerSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskTimerSummaryDialog: React.FC<TaskTimerSummaryDialogProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(taskTimerService.getTodayDateString());
  const { isOpen: isAddTimeOpen, onOpen: onAddTimeOpen, onClose: onAddTimeClose } = useDisclosure();
  const [customTaskName, setCustomTaskName] = useState('');
  const [customDuration, setCustomDuration] = useState(''); // HH:MM format
  const [taskSubTasks, setTaskSubTasks] = useState<Map<string, Array<{ name: string; timeSpent: number }>>>(new Map());
  const [analyzingTasks, setAnalyzingTasks] = useState<Set<string>>(new Set());
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const detailsBg = useColorModeValue('gray.50', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'white');
  
  useEffect(() => {
    if (isOpen) {
      // Reset to today's date when dialog opens
      const today = taskTimerService.getTodayDateString();
      setSelectedDate(today);
      loadTasksForDate(today);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen) {
      loadTasksForDate(selectedDate);
    }
  }, [selectedDate, isOpen]);
  
  const loadTasksForDate = async (dateString: string) => {
    setLoading(true);
    try {
      const result = await (window.electronAPI as any).getTaskLogs(dateString);
      
      if (result.success && result.tasks) {
        // Migrate old tasks that don't have windowTitles field
        const migratedTasks = result.tasks.map((task: any) => ({
          ...task,
          windowTitles: task.windowTitles || []
        }));
        setTasks(migratedTasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('[TaskTimer] Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };
  
  const goToPreviousDay = () => {
    // Parse the date string correctly (YYYY-MM-DD)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day); // month is 0-indexed
    currentDate.setDate(currentDate.getDate() - 1);
    
    // Format back to YYYY-MM-DD
    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const newDay = String(currentDate.getDate()).padStart(2, '0');
    setSelectedDate(`${newYear}-${newMonth}-${newDay}`);
  };
  
  const goToNextDay = () => {
    // Parse the date string correctly (YYYY-MM-DD)
    const [year, month, day] = selectedDate.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day); // month is 0-indexed
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Format back to YYYY-MM-DD
    const newYear = currentDate.getFullYear();
    const newMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const newDay = String(currentDate.getDate()).padStart(2, '0');
    const nextDate = `${newYear}-${newMonth}-${newDay}`;
    
    const today = taskTimerService.getTodayDateString();
    
    // Don't allow going beyond today
    if (nextDate <= today) {
      setSelectedDate(nextDate);
    }
  };
  
  const goToToday = () => {
    setSelectedDate(taskTimerService.getTodayDateString());
  };
  
  const isToday = () => {
    return selectedDate === taskTimerService.getTodayDateString();
  };
  
  const toggleTaskExpanded = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
        // Trigger AI analysis when expanding
        if (!taskSubTasks.has(taskId) && task.windowTitles && task.windowTitles.length > 0) {
          analyzeTaskSubTasks(task);
        }
      }
      return newSet;
    });
  };
  
  const analyzeTaskSubTasks = async (task: Task) => {
    setAnalyzingTasks(prev => new Set(prev).add(task.id));
    
    try {
      // Build window activity data for this task
      let analysisText = `Task: ${task.name}\n`;
      analysisText += `Duration: ${taskTimerService.formatDuration(task.duration)}\n`;
      analysisText += `Started: ${taskTimerService.formatTimestamp(task.startTime)}\n`;
      if (task.endTime) {
        analysisText += `Ended: ${taskTimerService.formatTimestamp(task.endTime)}\n`;
      }
      analysisText += `\n`;
      
      if (task.windowTitles && task.windowTitles.length > 0) {
        analysisText += `Window Activity Log (${task.windowTitles.length} entries) with time spent:\n`;
        
        // Calculate time spent in each window
        for (let i = 0; i < task.windowTitles.length; i++) {
          const log = task.windowTitles[i];
          const logTime = new Date(log.timestamp).getTime();
          
          // Calculate time spent: difference to next log, or to task end, or to now if still running
          let timeSpent = 0;
          if (i < task.windowTitles.length - 1) {
            const nextLogTime = new Date(task.windowTitles[i + 1].timestamp).getTime();
            timeSpent = Math.floor((nextLogTime - logTime) / 1000);
          } else {
            const endTime = task.endTime ? new Date(task.endTime).getTime() : Date.now();
            timeSpent = Math.floor((endTime - logTime) / 1000);
          }
          
          const timeSpentFormatted = taskTimerService.formatDuration(timeSpent);
          analysisText += `  [${taskTimerService.formatTimestamp(log.timestamp)}] ${log.windowTitle} (${timeSpentFormatted})\n`;
        }
      }
      
      // Use the new function to analyze single task and return structured sub-tasks
      try {
        const subTasks = await analyzeTaskSubTasksAPI(analysisText, 'haiku');
        if (subTasks.length > 0) {
          setTaskSubTasks(prev => new Map(prev).set(task.id, subTasks));
        } else {
          // Fallback to native grouping if AI returns no results
          const subTasks = groupWindowTitlesIntoSubTasks(task);
          setTaskSubTasks(prev => new Map(prev).set(task.id, subTasks));
        }
      } catch (error) {
        // Fallback to native grouping if AI fails
        const subTasks = groupWindowTitlesIntoSubTasks(task);
        setTaskSubTasks(prev => new Map(prev).set(task.id, subTasks));
      }
    } catch (error: any) {
      console.error('[TaskTimer] Error analyzing task sub-tasks:', error);
    } finally {
      setAnalyzingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };
  
  const groupWindowTitlesIntoSubTasks = (task: Task): Array<{ name: string; timeSpent: number }> => {
    // Native logic to group window titles into high-level sub-tasks
    const subTaskMap = new Map<string, number>();
    
    if (!task.windowTitles || task.windowTitles.length === 0) {
      return [];
    }
    
    for (let i = 0; i < task.windowTitles.length; i++) {
      const log = task.windowTitles[i];
      const logTime = new Date(log.timestamp).getTime();
      
      // Calculate time spent
      let timeSpent = 0;
      if (i < task.windowTitles.length - 1) {
        const nextLogTime = new Date(task.windowTitles[i + 1].timestamp).getTime();
        timeSpent = Math.floor((nextLogTime - logTime) / 1000);
      } else {
        const endTime = task.endTime ? new Date(task.endTime).getTime() : Date.now();
        timeSpent = Math.floor((endTime - logTime) / 1000);
      }
      
      // Group by application/activity type
      const windowTitle = log.windowTitle.toLowerCase();
      let subTaskName = 'General Work';
      
      if (windowTitle.includes('xero') || windowTitle.includes('accounting')) {
        subTaskName = 'Accounting Work';
      } else if (windowTitle.includes('tax') || windowTitle.includes('ir3') || windowTitle.includes('ird')) {
        subTaskName = 'Tax Preparation';
      } else if (windowTitle.includes('pdf') || windowTitle.includes('document')) {
        subTaskName = 'Document Review';
      } else if (windowTitle.includes('email') || windowTitle.includes('outlook') || windowTitle.includes('gmail')) {
        subTaskName = 'Email Communication';
      } else if (windowTitle.includes('excel') || windowTitle.includes('spreadsheet')) {
        subTaskName = 'Data Analysis';
      } else if (windowTitle.includes('word') || windowTitle.includes('document')) {
        subTaskName = 'Document Creation';
      }
      
      const currentTime = subTaskMap.get(subTaskName) || 0;
      subTaskMap.set(subTaskName, currentTime + timeSpent);
    }
    
    return Array.from(subTaskMap.entries())
      .map(([name, timeSpent]) => ({ name, timeSpent }))
      .sort((a, b) => b.timeSpent - a.timeSpent);
  };
  
  const getTotalDuration = () => {
    return tasks.reduce((total, task) => total + task.duration, 0);
  };
  
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion
    
    try {
      const result = await (window.electronAPI as any).deleteTaskLog(selectedDate, taskId);
      
      if (result.success) {
        // Refresh the tasks list
        await loadTasksForDate(selectedDate);
      }
    } catch (error) {
      console.error('[TaskTimer] Error deleting task:', error);
    }
  };
  
  const handleAddCustomTime = async () => {
    if (!customTaskName.trim() || !customDuration.trim()) {
      return;
    }
    
    // Parse duration (HH:MM format)
    const durationMatch = customDuration.match(/^(\d{1,2}):(\d{2})$/);
    if (!durationMatch) {
      alert('Invalid duration format. Please use HH:MM (e.g., 01:30 for 1 hour 30 minutes)');
      return;
    }
    
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const totalSeconds = hours * 3600 + minutes * 60;
    
    // Create a task with the specified duration
    const now = new Date();
    const startTime = new Date(now.getTime() - totalSeconds * 1000);
    
    const customTask: Task = {
      id: `task_${Date.now()}`,
      name: customTaskName.trim(),
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration: totalSeconds,
      fileOperations: [],
      windowTitles: [],
      isPaused: false,
      pausedDuration: 0
    };
    
    try {
      const result = await (window.electronAPI as any).saveTaskLog(selectedDate, customTask);
      if (result.success) {
        // Reload tasks
        await loadTasksForDate(selectedDate);
        // Reset form
        setCustomTaskName('');
        setCustomDuration('');
        onAddTimeClose();
      } else {
        alert('Failed to save custom time entry');
      }
    } catch (error) {
      console.error('[TaskTimer] Error saving custom time entry:', error);
      alert('Error saving custom time entry');
    }
  };

  // Check if we're in a standalone window (no modal needed)
  const isStandaloneWindow = window.location.hash === '#task-summary';
  
  // If standalone window, always show content (like SettingsWindow)
  if (isStandaloneWindow) {
  return (
      <Box 
          bg={bgColor} 
        w="100vw"
        h="100vh"
          overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {/* Custom Title Bar */}
        <Flex
          align="center"
          width="100%"
          bg={useColorModeValue('#f8fafc', 'gray.800')}
          h="31px"
          style={{ WebkitAppRegion: 'drag', userSelect: 'none' } as React.CSSProperties}
          px={0}
          borderBottom="1px solid"
          borderColor={borderColor}
          flexShrink={0}
        >
          <Box display="flex" alignItems="center" gap={2} pl={3}>
            <Icon as={Clock} boxSize={3.5} color="blue.500" />
            <Text fontWeight="600" fontSize="sm" color={textColor} userSelect="none">
              Task Summary
            </Text>
          </Box>
          <Spacer />
          <Flex height="31px" align="center" gap={1} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Tooltip label="Add custom time entry">
              <IconButton
                aria-label="Add custom time entry"
                icon={<Plus size={14} />}
                size="sm"
                variant="ghost"
                onClick={onAddTimeOpen}
                color={textColor}
                _hover={{ bg: useColorModeValue('#e5e7eb', 'gray.600') }}
                _focus={{ boxShadow: 'none', bg: 'transparent' }}
                _active={{ bg: useColorModeValue('#d1d5db', 'gray.500') }}
                borderRadius={0}
                minW="44px"
                h="31px"
                p={0}
              />
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              color={textColor}
              _hover={{ bg: useColorModeValue('#e5e7eb', 'gray.600') }}
              _focus={{ boxShadow: 'none', bg: 'transparent' }}
              _active={{ bg: useColorModeValue('#d1d5db', 'gray.500') }}
              borderRadius={0}
              minW="44px"
              h="31px"
              p={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="default"
            >
              <Icon as={X} boxSize={3.5} />
            </Button>
          </Flex>
        </Flex>

        {/* Header */}
        <Flex
          borderBottomWidth="1px"
          borderColor={borderColor}
          py={3}
          px={6}
          align="center"
          justify="space-between"
          flexShrink={0}
          bg={bgColor}
        >
              <Flex align="center" gap={2}>
                <Icon as={Clock} boxSize={5} color="blue.500" />
                <Text fontSize="lg">Task Summary</Text>
          </Flex>
          
          <Spacer />
          
          <Flex align="center" gap={1}>
            {/* Add Custom Time Button */}
            <Tooltip label="Add custom time entry">
              <IconButton
                aria-label="Add custom time entry"
                icon={<Plus size={16} />}
                    size="sm"
                colorScheme="blue"
                    variant="outline"
                onClick={onAddTimeOpen}
              />
            </Tooltip>
              </Flex>
            
            {/* Date Navigation */}
            <Flex align="center" gap={2}>
              <IconButton
                aria-label="Previous day"
                icon={<ChevronLeft size={16} />}
                size="sm"
                variant="ghost"
                onClick={goToPreviousDay}
              />
              
              <Flex align="center" gap={2} minW="280px" justify="center">
                <Icon as={Calendar} boxSize={4} color="gray.500" />
                <Text fontSize="sm" fontWeight="medium">
                  {taskTimerService.formatDate(selectedDate)}
                </Text>
                {isToday() && (
                  <Badge colorScheme="blue" fontSize="xs" ml={1}>Today</Badge>
                )}
              </Flex>
              
              <IconButton
                aria-label="Next day"
                icon={<ChevronRight size={16} />}
                size="sm"
                variant="ghost"
                onClick={goToNextDay}
                isDisabled={isToday()}
              />
              
              {!isToday() && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={goToToday}
                  leftIcon={<Calendar size={14} />}
                  ml={2}
                >
                  Today
                </Button>
              )}
            </Flex>
          </Flex>
        
        {/* Body */}
        <Box flex="1" overflow="hidden" display="flex" flexDirection="column">
          {loading ? (
            <Flex justify="center" align="center" py={8}>
              <Text color="gray.500">Loading tasks...</Text>
            </Flex>
          ) : tasks.length === 0 ? (
            <Flex direction="column" justify="center" align="center" py={8} gap={2}>
              <Icon as={Clock} boxSize={12} color="gray.400" />
              <Text color="gray.500" fontSize="lg">No tasks logged for this date</Text>
              <Text color="gray.400" fontSize="sm">Start a task to begin tracking your work</Text>
            </Flex>
          ) : (
            <Box h="100%" overflow="hidden" display="flex" flexDirection="column">
              {/* Summary Stats */}
              <Flex gap={6} px={6} py={3} bg={detailsBg} borderBottomWidth="1px" borderColor={borderColor} flexShrink={0}>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">Total Tasks</Text>
                  <Text fontSize="xl" fontWeight="bold">{tasks.length}</Text>
                </Box>
                <Divider orientation="vertical" />
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">Total Time</Text>
                  <Text fontSize="xl" fontWeight="bold">{taskTimerService.formatDuration(getTotalDuration())}</Text>
                </Box>
              </Flex>
              
              {/* Tasks Table - Scrollable */}
              <Box flex="1" overflowY="auto" px={6} py={4}>
                <Table variant="simple" size="sm">
                  <Thead bg={detailsBg} position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th width="40px" py={2}></Th>
                      <Th py={2}>Task Name</Th>
                      <Th py={2}>Duration</Th>
                      <Th py={2}>Started</Th>
                      <Th width="60px" py={2}></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                  {tasks.map((task) => {
                    const isExpanded = expandedTasks.has(task.id);
                    return (
                      <React.Fragment key={task.id}>
                        <Tr 
                          _hover={{ bg: hoverBg }}
                          cursor="pointer"
                          onClick={() => toggleTaskExpanded(task.id)}
                        >
                          <Td py={2}>
                            <Icon 
                              as={isExpanded ? ChevronDown : ChevronRight} 
                              boxSize={4} 
                              color="gray.500" 
                            />
                          </Td>
                          <Td fontWeight="medium" py={2}>{task.name}</Td>
                          <Td py={2}>
                            <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                              {taskTimerService.formatDuration(task.duration)}
                            </Badge>
                          </Td>
                          <Td fontSize="xs" color="gray.600" py={2}>
                            {taskTimerService.formatTimestamp(task.startTime)}
                          </Td>
                          <Td py={2}>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              aria-label="Delete task"
                            >
                              <Icon as={Trash2} boxSize={3.5} />
                            </Button>
                          </Td>
                        </Tr>
                        
                        {/* Expanded Details - Sub-tasks */}
                        <Tr>
                          <Td colSpan={6} p={0} border="none">
                            <Collapse in={isExpanded} animateOpacity>
                              <Box bg={detailsBg} px={4} py={3} borderTopWidth="1px" borderColor={borderColor}>
                                {analyzingTasks.has(task.id) ? (
                                  <Flex align="center" gap={2} py={4}>
                                    <Spinner size="sm" />
                                    <Text fontSize="xs" color="gray.500">
                                      Analyzing activity...
                                    </Text>
                                  </Flex>
                                ) : taskSubTasks.has(task.id) ? (
                                  <Box>
                                    <Text fontWeight="semibold" mb={3} fontSize="xs" color="gray.600">
                                      Sub-tasks
                                    </Text>
                                    <Table variant="simple" size="sm">
                                      <Thead>
                                        <Tr>
                                          <Th py={2} fontSize="xs">Sub Task Name</Th>
                                          <Th py={2} fontSize="xs" isNumeric>Time Spent</Th>
                                        </Tr>
                                      </Thead>
                                      <Tbody>
                                        {taskSubTasks.get(task.id)?.map((subTask, idx) => (
                                          <Tr key={idx}>
                                            <Td py={2} fontSize="xs">{subTask.name}</Td>
                                            <Td py={2} fontSize="xs" isNumeric>
                                              {taskTimerService.formatDuration(subTask.timeSpent)}
                                            </Td>
                                          </Tr>
                                        ))}
                                      </Tbody>
                                    </Table>
                                  </Box>
                                ) : (
                                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                    No activity data available for this task
                                  </Text>
                                )}
                              </Box>
                            </Collapse>
                          </Td>
                        </Tr>
                      </React.Fragment>
                    );
                  })}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          )}
        </Box>
        
        {/* Custom Time Entry Modal */}
        <Modal isOpen={isAddTimeOpen} onClose={onAddTimeClose} size="md">
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent bg={bgColor}>
            <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
              Add Custom Time Entry
        </ModalHeader>
        <ModalCloseButton />
            <ModalBody py={6}>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Task Name</FormLabel>
                  <Input
                    value={customTaskName}
                    onChange={(e) => setCustomTaskName(e.target.value)}
                    placeholder="Enter task name"
                    bg={useColorModeValue('white', 'gray.700')}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Duration (HH:MM)</FormLabel>
                  <Input
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="01:30"
                    bg={useColorModeValue('white', 'gray.700')}
                    maxLength={5}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Format: HH:MM (e.g., 01:30 for 1 hour 30 minutes)
                  </Text>
                </FormControl>
                <Flex justify="flex-end" gap={2} mt={4}>
                  <Button variant="ghost" onClick={onAddTimeClose}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="blue"
                    onClick={handleAddCustomTime}
                    isDisabled={!customTaskName.trim() || !customDuration.trim()}
                  >
                    Add Entry
                  </Button>
                </Flex>
              </VStack>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    );
  }
  
  // Modal mode (for use in main app)
  if (!isOpen) return null;
  
  const headerContent = (
    <Flex align="center" justify="space-between" pr={10}>
      <Flex align="center" gap={2}>
        <Icon as={Clock} boxSize={5} color="blue.500" />
        <Text fontSize="lg">Task Summary</Text>
      </Flex>
      
      <Flex align="center" gap={1}>
        {/* Add Custom Time Button */}
        <Tooltip label="Add custom time entry">
          <IconButton
            aria-label="Add custom time entry"
            icon={<Plus size={16} />}
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={onAddTimeOpen}
          />
        </Tooltip>
      </Flex>
        
          {/* Date Navigation */}
          <Flex align="center" gap={2}>
        <IconButton
          aria-label="Previous day"
          icon={<ChevronLeft size={16} />}
          size="sm"
          variant="ghost"
          onClick={goToPreviousDay}
        />
        
        <Flex align="center" gap={2} minW="280px" justify="center">
          <Icon as={Calendar} boxSize={4} color="gray.500" />
          <Text fontSize="sm" fontWeight="medium">
            {taskTimerService.formatDate(selectedDate)}
          </Text>
          {isToday() && (
            <Badge colorScheme="blue" fontSize="xs" ml={1}>Today</Badge>
          )}
        </Flex>
        
        <IconButton
          aria-label="Next day"
          icon={<ChevronRight size={16} />}
          size="sm"
          variant="ghost"
          onClick={goToNextDay}
          isDisabled={isToday()}
        />
        
        {!isToday() && (
          <Button
            size="sm"
            variant="outline"
            onClick={goToToday}
            leftIcon={<Calendar size={14} />}
            ml={2}
          >
            Today
          </Button>
        )}
      </Flex>
    </Flex>
  );
  
  const bodyContent = (
    <>
          {loading ? (
            <Flex justify="center" align="center" py={8}>
              <Text color="gray.500">Loading tasks...</Text>
            </Flex>
          ) : tasks.length === 0 ? (
            <Flex direction="column" justify="center" align="center" py={8} gap={2}>
              <Icon as={Clock} boxSize={12} color="gray.400" />
              <Text color="gray.500" fontSize="lg">No tasks logged for this date</Text>
              <Text color="gray.400" fontSize="sm">Start a task to begin tracking your work</Text>
            </Flex>
          ) : (
            <Box h="100%" overflow="hidden" display="flex" flexDirection="column">
              {/* Summary Stats */}
              <Flex gap={6} px={6} py={3} bg={detailsBg} borderBottomWidth="1px" borderColor={borderColor} flexShrink={0}>
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">Total Tasks</Text>
                  <Text fontSize="xl" fontWeight="bold">{tasks.length}</Text>
                </Box>
                <Divider orientation="vertical" />
                <Box>
                  <Text fontSize="xs" color="gray.500" fontWeight="medium">Total Time</Text>
                  <Text fontSize="xl" fontWeight="bold">{taskTimerService.formatDuration(getTotalDuration())}</Text>
                </Box>
              </Flex>
              
              {/* Tasks Table - Scrollable */}
              <Box flex="1" overflowY="auto" px={6} py={4}>
                <Table variant="simple" size="sm">
                  <Thead bg={detailsBg} position="sticky" top={0} zIndex={1}>
                    <Tr>
                  <Th width="40px" py={2}></Th>
                  <Th py={2}>Task Name</Th>
                  <Th py={2}>Duration</Th>
                  <Th py={2}>Started</Th>
                  <Th width="60px" py={2}></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
              {tasks.map((task) => {
                    const isExpanded = expandedTasks.has(task.id);
                    return (
                      <React.Fragment key={task.id}>
                        <Tr 
                          _hover={{ bg: hoverBg }}
                          cursor="pointer"
                          onClick={() => toggleTaskExpanded(task.id)}
                        >
                          <Td py={2}>
                            <Icon 
                              as={isExpanded ? ChevronDown : ChevronRight} 
                              boxSize={4} 
                              color="gray.500" 
                            />
                          </Td>
                          <Td fontWeight="medium" py={2}>{task.name}</Td>
                          <Td py={2}>
                            <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                              {taskTimerService.formatDuration(task.duration)}
                            </Badge>
                          </Td>
                          <Td fontSize="xs" color="gray.600" py={2}>
                            {taskTimerService.formatTimestamp(task.startTime)}
                          </Td>
                          <Td py={2}>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              aria-label="Delete task"
                            >
                              <Icon as={Trash2} boxSize={3.5} />
                            </Button>
                          </Td>
                        </Tr>
                        
                    {/* Expanded Details - Sub-tasks */}
                        <Tr>
                      <Td colSpan={5} p={0} border="none">
                            <Collapse in={isExpanded} animateOpacity>
                              <Box bg={detailsBg} px={4} py={3} borderTopWidth="1px" borderColor={borderColor}>
                            {analyzingTasks.has(task.id) ? (
                              <Flex align="center" gap={2} py={4}>
                                <Spinner size="sm" />
                                            <Text fontSize="xs" color="gray.500">
                                  Analyzing activity...
                                            </Text>
                                          </Flex>
                            ) : taskSubTasks.has(task.id) ? (
                              <Box>
                                <Text fontWeight="semibold" mb={3} fontSize="xs" color="gray.600">
                                  Sub-tasks
                                </Text>
                                <Table variant="simple" size="sm">
                                  <Thead>
                                    <Tr>
                                      <Th py={2} fontSize="xs">Sub Task Name</Th>
                                      <Th py={2} fontSize="xs" isNumeric>Time Spent</Th>
                                    </Tr>
                                  </Thead>
                                  <Tbody>
                                    {taskSubTasks.get(task.id)?.map((subTask, idx) => (
                                      <Tr key={idx}>
                                        <Td py={2} fontSize="xs">{subTask.name}</Td>
                                        <Td py={2} fontSize="xs" isNumeric>
                                          {taskTimerService.formatDuration(subTask.timeSpent)}
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </Box>
                            ) : (
                              <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                No activity data available for this task
                                            </Text>
                                )}
                              </Box>
                            </Collapse>
                          </Td>
                        </Tr>
                      </React.Fragment>
                    );
                  })}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          )}
    </>
  );
  
  // Render as modal (for use in main app)
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent 
          bg={bgColor} 
          maxW="1000px"
          maxH="85vh" 
          h="700px"
          overflow="hidden"
          my="auto"
        >
          <ModalHeader borderBottomWidth="1px" borderColor={borderColor} py={3}>
            {headerContent}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0} overflow="hidden">
            {bodyContent}
        </ModalBody>
      </ModalContent>
    </Modal>
    
      {/* Custom Time Entry Modal */}
      <Modal isOpen={isAddTimeOpen} onClose={onAddTimeClose} size="md">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg={bgColor}>
        <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
            Add Custom Time Entry
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={6}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Task Name</FormLabel>
                <Input
                  value={customTaskName}
                  onChange={(e) => setCustomTaskName(e.target.value)}
                  placeholder="Enter task name"
                  bg={useColorModeValue('white', 'gray.700')}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Duration (HH:MM)</FormLabel>
                <Input
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="01:30"
                  bg={useColorModeValue('white', 'gray.700')}
                  maxLength={5}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Format: HH:MM (e.g., 01:30 for 1 hour 30 minutes)
                </Text>
              </FormControl>
              <Flex justify="flex-end" gap={2} mt={4}>
                <Button variant="ghost" onClick={onAddTimeClose}>
                  Cancel
                </Button>
            <Button
              colorScheme="blue"
                  onClick={handleAddCustomTime}
                  isDisabled={!customTaskName.trim() || !customDuration.trim()}
            >
                  Add Entry
            </Button>
          </Flex>
            </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
    </>
  );
};

