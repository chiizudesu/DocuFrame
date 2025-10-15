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
  IconButton
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Clock, FileText, Trash2, ChevronLeft, Calendar } from 'lucide-react';
import { Task, taskTimerService } from '../services/taskTimer';

interface TaskTimerSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskTimerSummaryDialog: React.FC<TaskTimerSummaryDialogProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(taskTimerService.getTodayDateString());
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');
  const detailsBg = useColorModeValue('gray.50', 'gray.900');
  
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
        setTasks(result.tasks);
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
  
  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
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
  
  return (
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
          <Flex align="center" justify="space-between" pr={10}>
            <Flex align="center" gap={2}>
              <Icon as={Clock} boxSize={5} color="blue.500" />
              <Text fontSize="lg">Task Summary</Text>
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
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody p={0} overflow="hidden">
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
                      <Th py={2}>Operations</Th>
                      <Th py={2}>Started</Th>
                      <Th width="60px" py={2}></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                  {tasks.map((task, index) => {
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
                          <Td py={2}>
                            <Badge colorScheme="green" variant="subtle" fontSize="xs">
                              {task.fileOperations.length}
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
                        
                        {/* Expanded Details */}
                        <Tr>
                          <Td colSpan={6} p={0} border="none">
                            <Collapse in={isExpanded} animateOpacity>
                              <Box bg={detailsBg} px={4} py={3} borderTopWidth="1px" borderColor={borderColor}>
                                <Text fontWeight="semibold" mb={2} fontSize="xs" color="gray.600">
                                  File Operations Log
                                </Text>
                                
                                {task.fileOperations.length === 0 ? (
                                  <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                    No file operations recorded for this task
                                  </Text>
                                ) : (
                                  <VStack align="stretch" spacing={1.5}>
                                    {task.fileOperations.map((op, opIndex) => (
                                      <Flex
                                        key={opIndex}
                                        p={2}
                                        bg={bgColor}
                                        borderRadius="md"
                                        borderWidth="1px"
                                        borderColor={borderColor}
                                        gap={2}
                                        align="start"
                                      >
                                        <Icon as={FileText} boxSize={3.5} color="blue.500" mt={0.5} flexShrink={0} />
                                        <Box flex={1}>
                                          <Flex justify="space-between" align="start">
                                            <Text fontWeight="medium" fontSize="xs">
                                              {op.operation}
                                            </Text>
                                            <Text fontSize="xs" color="gray.500">
                                              {taskTimerService.formatTimestamp(op.timestamp)}
                                            </Text>
                                          </Flex>
                                          {op.details && (
                                            <Text fontSize="xs" color="gray.600" mt={0.5}>
                                              {op.details}
                                            </Text>
                                          )}
                                        </Box>
                                      </Flex>
                                    ))}
                                  </VStack>
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
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

