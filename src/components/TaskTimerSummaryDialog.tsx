import React, { useState, useEffect, useRef } from 'react';
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
  Textarea,
  useDisclosure,
  Spinner
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Clock, FileText, Trash2, ChevronLeft, Calendar, Sparkles, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Task, taskTimerService } from '../services/taskTimer';
import { analyzeWindowActivityStream } from '../services/claude';

interface TaskTimerSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskTimerSummaryDialog: React.FC<TaskTimerSummaryDialogProps> = ({ isOpen, onClose }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(taskTimerService.getTodayDateString());
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const analysisBoxRef = useRef<HTMLDivElement>(null);
  const { isOpen: isAnalysisOpen, onOpen: onAnalysisOpen, onClose: onAnalysisClose } = useDisclosure();
  
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
  
  const generateAIAnalysis = async () => {
    setIsAnalyzing(true);
    setIsStreaming(true);
    onAnalysisOpen();
    
    // Set a placeholder immediately so UI switches to results view
    setAiAnalysis(' '); // Single space to trigger results display
    
    try {
      // Compile all window title logs from all tasks
      let analysisText = `Window Activity Analysis for ${taskTimerService.formatDate(selectedDate)}\n\n`;
      analysisText += `Please analyze the following window activity data and provide insights about:\n`;
      analysisText += `1. What applications/tools were used most frequently\n`;
      analysisText += `2. Work patterns and focus areas\n`;
      analysisText += `3. Time distribution across different activities\n`;
      analysisText += `4. Any notable distractions or context switches\n\n`;
      analysisText += `=== WINDOW ACTIVITY DATA ===\n\n`;
      
      tasks.forEach((task, index) => {
        analysisText += `Task ${index + 1}: ${task.name}\n`;
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
              // Time until next window switch
              const nextLogTime = new Date(task.windowTitles[i + 1].timestamp).getTime();
              timeSpent = Math.floor((nextLogTime - logTime) / 1000); // in seconds
            } else {
              // Last window - time until task end or now
              const endTime = task.endTime ? new Date(task.endTime).getTime() : Date.now();
              timeSpent = Math.floor((endTime - logTime) / 1000); // in seconds
            }
            
            const timeSpentFormatted = taskTimerService.formatDuration(timeSpent);
            analysisText += `  [${taskTimerService.formatTimestamp(log.timestamp)}] ${log.windowTitle} (${timeSpentFormatted})\n`;
          }
        } else {
          analysisText += `No window activity recorded for this task.\n`;
        }
        
        analysisText += `\n---\n\n`;
      });
      
      // Use streaming version directly from renderer (like AIEditorDialog)
      let accumulatedText = '';
      await analyzeWindowActivityStream(
        analysisText,
        'haiku',
        (chunk) => {
          accumulatedText += chunk;
          setAiAnalysis(accumulatedText);
          
          // Auto-scroll to bottom
          setTimeout(() => {
            if (analysisBoxRef.current) {
              analysisBoxRef.current.scrollTop = analysisBoxRef.current.scrollHeight;
            }
          }, 0);
        }
      );
    } catch (error: any) {
      console.error('[TaskTimer] Error generating AI analysis:', error);
      setAiAnalysis(`Error: ${error.message || 'Failed to analyze window activity'}`);
    } finally {
      setIsAnalyzing(false);
      setIsStreaming(false);
    }
  };
  
  const copyAnalysisToClipboard = () => {
    navigator.clipboard.writeText(aiAnalysis);
  };
  
  const tableBg = useColorModeValue('gray.50', 'gray.800');
  const tableBorder = useColorModeValue('gray.300', 'gray.600');
  
  // Parse AI analysis table and format with timestamps
  const parseAndDisplayAnalysis = (analysis: string, tasks: Task[]) => {
    // Extract table from markdown
    const tableMatch = analysis.match(/\|.*\|/g);
    if (!tableMatch || tableMatch.length < 2) {
      // Fallback to markdown rendering if no table found
      return (
        <Box
          bg={bgColor}
          p={4}
          borderRadius="lg"
          boxShadow="sm"
          border="1px solid"
          borderColor={borderColor}
          sx={{
            '& h1, & h2, & h3, & h4': {
              fontWeight: 'bold',
              marginBottom: '0.25rem',
              marginTop: '0.5rem',
              '&:first-child': { marginTop: '0' }
            },
            '& h1': { fontSize: 'lg' },
            '& h2': { fontSize: 'md' },
            '& h3, & h4': { fontSize: 'sm', fontWeight: '600' },
            '& p': {
              marginBottom: '0.5rem',
              '&:last-child': { marginBottom: '0' }
            },
            '& ul, & ol': {
              marginLeft: '1.5rem',
              marginBottom: '0.5rem'
            },
            '& li': {
              marginBottom: '0.25rem'
            },
            '& code': {
              bg: useColorModeValue('gray.100', 'gray.800'),
              px: '0.25rem',
              py: '0.125rem',
              borderRadius: '0.25rem',
              fontSize: '0.875em'
            },
            '& pre': {
              bg: useColorModeValue('gray.100', 'gray.800'),
              p: '0.75rem',
              borderRadius: '0.5rem',
              overflow: 'auto',
              marginBottom: '0.5rem'
            },
            '& table': {
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '1rem'
            },
            '& th, & td': {
              border: `1px solid ${useColorModeValue('#e2e8f0', '#4a5568')}`,
              padding: '0.5rem',
              textAlign: 'left'
            },
            '& th': {
              fontWeight: 'bold',
              bg: useColorModeValue('gray.50', 'gray.700')
            }
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
        </Box>
      );
    }
    
    // Parse table rows (skip header)
    const rows = tableMatch.slice(2).filter(row => !row.match(/^\|[\s-:]+\|$/)); // Skip separator rows
    const summaryMatch = analysis.match(/Total time spent:.*/);
    
    // Create a map of task names to tasks for timestamp lookup
    const taskMap = new Map<string, Task>();
    tasks.forEach(task => taskMap.set(task.name, task));
    
    // Calculate totals
    let totalDuration = 0;
    let totalProductive = 0;
    
    return (
      <Box>
        <Table variant="simple" size="sm" colorScheme="blue">
          <Thead>
            <Tr>
              <Th>Task Name</Th>
              <Th>Total Duration</Th>
              <Th>Productive Time</Th>
              <Th>Achievements</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, idx) => {
              const cells = row.split('|').map(c => c.trim()).filter(c => c);
              if (cells.length < 4) return null;
              
              const taskName = cells[0];
              const durationStr = cells[1];
              const productiveStr = cells[2];
              const achievements = cells[3];
              
              // Parse duration (HH:MM format)
              const parseDuration = (str: string): number => {
                const match = str.match(/(\d+):(\d+)/);
                if (match) {
                  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60;
                }
                return 0;
              };
              
              const duration = parseDuration(durationStr);
              const productive = parseDuration(productiveStr);
              totalDuration += duration;
              totalProductive += productive;
              
              // Get task for timestamp lookup
              const task = taskMap.get(taskName);
              
              // Format achievements with timestamps
              const formatAchievements = (text: string): JSX.Element[] => {
                // Split by bullet points
                const bullets = text.split(/[•\-\*]/).filter(b => b.trim());
                return bullets.map((bullet, i) => {
                  const trimmed = bullet.trim();
                  if (!trimmed) return null;
                  
                  // Try to match achievement to window title and get timestamp
                  let timestamp = '';
                  if (task && task.windowTitles) {
                    const matchingLog = task.windowTitles.find(log => 
                      log.windowTitle.toLowerCase().includes(trimmed.toLowerCase().substring(0, 20)) ||
                      trimmed.toLowerCase().includes(log.windowTitle.toLowerCase().substring(0, 20))
                    );
                    if (matchingLog) {
                      const date = new Date(matchingLog.timestamp);
                      const hours = date.getHours().toString().padStart(2, '0');
                      const minutes = date.getMinutes().toString().padStart(2, '0');
                      const seconds = date.getSeconds().toString().padStart(2, '0');
                      timestamp = `${hours}:${minutes}:${seconds}`;
                    }
                  }
                  
                  return (
                    <Text key={i} fontSize="xs" mb={i < bullets.length - 1 ? 1 : 0} lineHeight="1.6">
                      {timestamp ? `•${timestamp} - ${trimmed}` : `•${trimmed}`}
                    </Text>
                  );
                }).filter(Boolean) as JSX.Element[];
              };
              
              return (
                <Tr key={idx}>
                  <Td fontWeight="medium">{taskName}</Td>
                  <Td>{durationStr}</Td>
                  <Td>{productiveStr}</Td>
                  <Td>
                    <VStack align="start" spacing={0.5}>
                      {formatAchievements(achievements)}
                    </VStack>
                  </Td>
                </Tr>
              );
            })}
            {/* Total row */}
            <Tr bg={tableBg} fontWeight="bold">
              <Td>Total</Td>
              <Td>{taskTimerService.formatDuration(totalDuration)}</Td>
              <Td>{taskTimerService.formatDuration(totalProductive)}</Td>
              <Td></Td>
            </Tr>
          </Tbody>
        </Table>
        {summaryMatch && (
          <Text mt={4} fontSize="sm" color="gray.400" fontStyle="italic">
            {summaryMatch[0]}
          </Text>
        )}
      </Box>
    );
  };
  
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
            <Flex align="center" justify="space-between" pr={10}>
              <Flex align="center" gap={2}>
                <Icon as={Clock} boxSize={5} color="blue.500" />
                <Text fontSize="lg">Task Summary</Text>
                
                {/* AI Analysis Button */}
                {tasks.length > 0 && (
                  <Button
                    size="sm"
                    leftIcon={<Sparkles size={14} />}
                    colorScheme="purple"
                    variant="outline"
                    onClick={generateAIAnalysis}
                    ml={4}
                  >
                    AI Analysis
                  </Button>
                )}
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
    
    {/* AI Analysis Modal */}
    <Modal isOpen={isAnalysisOpen} onClose={onAnalysisClose} size="3xl">
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg={bgColor} maxH="80vh">
        <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
          <Flex align="center" justify="space-between" pr={10}>
            <Flex align="center" gap={2}>
              <Icon as={Sparkles} boxSize={5} color="purple.500" />
              <Text fontSize="lg">AI Window Activity Analysis</Text>
            </Flex>
            <Button
              size="sm"
              leftIcon={<Copy size={14} />}
              onClick={copyAnalysisToClipboard}
              colorScheme="blue"
              variant="outline"
            >
              Copy
            </Button>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody py={4}>
          <Text fontSize="sm" color="gray.500" mb={3}>
            {isAnalyzing ? 'Analyzing your window activity...' : 'AI-generated summary of your window activity:'}
          </Text>
          <Box
            ref={analysisBoxRef}
            maxH="60vh"
            overflowY="auto"
            bg={detailsBg}
            borderRadius="lg"
            p={4}
            border="1px solid"
            borderColor={borderColor}
            minH="500px"
          >
            {!aiAnalysis.trim() && isAnalyzing && (
              <Flex align="center" justify="center" h="100%" direction="column" gap={4}>
                <Spinner size="lg" />
                <Text color="gray.500">Analyzing window activity...</Text>
              </Flex>
            )}
            {aiAnalysis.trim() && (
              <Box
                bg={bgColor}
                p={4}
                borderRadius="lg"
                boxShadow={useColorModeValue('sm', 'dark-lg')}
                border="1px solid"
                borderColor={useColorModeValue('gray.200', 'gray.700')}
              >
                {parseAndDisplayAnalysis(aiAnalysis, tasks)}
                {isStreaming && (
                  <Box
                    as="span"
                    display="inline-block"
                    w="2px"
                    h="1em"
                    bg="purple.500"
                    ml={1}
                    animation="blink 1s step-end infinite"
                    sx={{
                      '@keyframes blink': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0 },
                      }
                    }}
                  />
                )}
              </Box>
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
    </>
  );
};

