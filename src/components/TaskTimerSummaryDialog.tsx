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
  InputGroup,
  InputRightElement,
  Tooltip,
  Spacer,
  Textarea,
  ModalFooter,
  useDisclosure as useChakraDisclosure,
} from '@chakra-ui/react';
import { ChevronDown, ChevronRight, Clock, Trash2, ChevronLeft, Calendar, Plus, X, Edit2, Check, XCircle, Search } from 'lucide-react';
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
  const [customNarration, setCustomNarration] = useState('');
  const [taskSubTasks, setTaskSubTasks] = useState<Map<string, Array<{ name: string; timeSpent: number }>>>(new Map());
  const [analyzingTasks, setAnalyzingTasks] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [editingTaskDuration, setEditingTaskDuration] = useState(''); // HH:MM format
  const [editingTaskNarration, setEditingTaskNarration] = useState('');
  const [presetTaskOptions, setPresetTaskOptions] = useState<string[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useChakraDisclosure();
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  
  // Non-billable task names
  const NON_BILLABLE_TASKS = [
    'Internal - Meetings',
    'Internal - IT Issues',
    'Internal - Workflow Planning'
  ];
  
  // Check if a task name is non-billable
  const isNonBillableTask = (taskName: string): boolean => {
    return NON_BILLABLE_TASKS.some(nbTask => 
      taskName && taskName.toLowerCase().includes(nbTask.toLowerCase())
    );
  };
  
  // Search tasks dynamically (similar to FloatingTaskTimerWindow)
  const searchPresetTasks = async (searchValue: string) => {
    console.log('[TaskSummary] 🔍 searchPresetTasks called with:', searchValue);
    
    if (!searchValue.trim()) {
      console.log('[TaskSummary] ⚠️ Empty search value, returning non-billable tasks only');
      setPresetTaskOptions([...NON_BILLABLE_TASKS]);
      return;
    }
    
    try {
      const options: string[] = [];
      
      // Add non-billable tasks that match
      const nonBillableMatches = NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      );
      console.log('[TaskSummary] 📋 Non-billable matches:', nonBillableMatches);
      options.push(...nonBillableMatches);
      
      // Search client database
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      console.log('[TaskSummary] 📂 CSV Path:', csvPath);
      
      if (csvPath) {
        const rows = await window.electronAPI.readCsv(csvPath);
        console.log('[TaskSummary] 📊 Total rows in CSV:', rows?.length || 0);
        
        if (rows && rows.length > 0) {
          const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
          
          // Log first row structure for debugging
          if (rows.length > 0) {
            console.log('[TaskSummary] 🔍 First row keys:', Object.keys(rows[0]));
            console.log('[TaskSummary] 🔍 First row sample:', rows[0]);
          }
          
          const filtered = rows.filter((row: any) => {
            const clientNameField = clientNameFields.find(field => row[field] !== undefined);
            if (clientNameField && row[clientNameField]) {
              const clientValue = String(row[clientNameField]).toLowerCase();
              const matches = clientValue.includes(searchValue.toLowerCase());
              if (matches) {
                console.log('[TaskSummary] ✅ Match found:', row[clientNameField], 'using field:', clientNameField);
              }
              return matches;
            }
            return false;
          });
          
          console.log('[TaskSummary] 🎯 Filtered rows count:', filtered.length);
          console.log('[TaskSummary] 🎯 Filtered rows (first 5):', filtered.slice(0, 5).map((r: any) => {
            const field = clientNameFields.find(f => r[f] !== undefined);
            return field ? r[field] : 'N/A';
          }));
          
          const limitedFiltered = filtered.slice(0, 10); // Limit to 10 client results
          console.log('[TaskSummary] 📏 After limiting to 10:', limitedFiltered.length);
          
          const clientNames = limitedFiltered.map((row: any) => {
            const clientNameField = clientNameFields.find(field => row[field] !== undefined);
            return clientNameField ? String(row[clientNameField]) : null;
          }).filter((name: string | null): name is string => name !== null && name.trim() !== '');
          
          console.log('[TaskSummary] 📝 Client names extracted:', clientNames);
          console.log('[TaskSummary] 📝 Client names count:', clientNames.length);
          options.push(...clientNames);
        } else {
          console.log('[TaskSummary] ⚠️ No rows found in CSV or CSV is empty');
        }
      } else {
        console.log('[TaskSummary] ⚠️ No CSV path configured');
      }
      
      // Only show database client names and non-billable tasks, not custom task names
      const finalOptions = [...new Set(options)];
      console.log('[TaskSummary] ✅ Final options (unique):', finalOptions);
      console.log('[TaskSummary] ✅ Final options count:', finalOptions.length);
      console.log('[TaskSummary] 🔄 Setting presetTaskOptions state...');
      setPresetTaskOptions(finalOptions);
      console.log('[TaskSummary] ✅ presetTaskOptions state updated');
    } catch (error) {
      console.error('[TaskSummary] ❌ Error searching preset tasks:', error);
      const fallbackOptions = [...NON_BILLABLE_TASKS.filter(task => 
        task.toLowerCase().includes(searchValue.toLowerCase())
      )];
      console.log('[TaskSummary] 🔄 Using fallback options:', fallbackOptions);
      setPresetTaskOptions(fallbackOptions);
    }
  };
  
  // Load preset task options (initial load)
  const loadPresetTasks = async () => {
    console.log('[TaskSummary] 📥 loadPresetTasks called (initial load)');
    
    try {
      const config = await window.electronAPI.getConfig();
      const csvPath = (config as any).clientbasePath;
      console.log('[TaskSummary] 📂 CSV Path:', csvPath);
      
      if (!csvPath) {
        console.log('[TaskSummary] ⚠️ No CSV path configured, using non-billable tasks only');
        setPresetTaskOptions([...NON_BILLABLE_TASKS]);
        return;
      }
      
      const rows = await window.electronAPI.readCsv(csvPath);
      console.log('[TaskSummary] 📊 Total rows in CSV:', rows?.length || 0);
      
      if (!rows || rows.length === 0) {
        console.log('[TaskSummary] ⚠️ No rows found in CSV or CSV is empty');
        setPresetTaskOptions([...NON_BILLABLE_TASKS]);
        return;
      }
      
      // Log first row structure for debugging
      if (rows.length > 0) {
        console.log('[TaskSummary] 🔍 First row keys:', Object.keys(rows[0]));
        console.log('[TaskSummary] 🔍 First row sample:', rows[0]);
      }
      
      const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
      const clientNames = rows
        .map((row: any) => {
          const field = clientNameFields.find(f => row[f] !== undefined);
          return field ? String(row[field]) : null;
        })
        .filter((name: string | null): name is string => name !== null);
      
      console.log('[TaskSummary] 📝 All client names extracted:', clientNames);
      console.log('[TaskSummary] 📝 All client names count:', clientNames.length);
      
      const limitedClientNames = clientNames.slice(0, 50); // Limit to 50 most recent
      console.log('[TaskSummary] 📏 After limiting to 50:', limitedClientNames.length);
      console.log('[TaskSummary] 📏 Limited client names (first 10):', limitedClientNames.slice(0, 10));
      
      // Only combine client names and non-billable tasks (no custom task names)
      const uniqueTaskNames = new Set([
        ...limitedClientNames,
        ...NON_BILLABLE_TASKS
      ]);
      const finalOptions = Array.from(uniqueTaskNames).sort();
      console.log('[TaskSummary] ✅ Final options (unique, sorted):', finalOptions);
      console.log('[TaskSummary] ✅ Final options count:', finalOptions.length);
      setPresetTaskOptions(finalOptions);
    } catch (error) {
      console.error('[TaskSummary] ❌ Error loading preset tasks:', error);
      console.log('[TaskSummary] 🔄 Using fallback (non-billable tasks only)');
      setPresetTaskOptions([...NON_BILLABLE_TASKS]);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      loadPresetTasks();
    }
  }, [isOpen, tasks]);
  
  // Load preset tasks when edit modal opens
  useEffect(() => {
    if (isEditModalOpen) {
      console.log('[TaskSummary] 🔓 Edit modal opened, loading preset tasks...');
      loadPresetTasks();
    }
  }, [isEditModalOpen]);
  
  // Search when editingTaskName changes in edit modal
  useEffect(() => {
    if (isEditModalOpen && editingTaskName !== undefined) {
      const trimmed = editingTaskName.trim();
      if (trimmed.length > 0) {
        console.log('[TaskSummary] 🔄 editingTaskName changed, triggering search:', trimmed);
        setShowPresetDropdown(true);
        searchPresetTasks(trimmed);
      } else if (trimmed.length === 0 && editingTaskName.length === 0) {
        // Only load all if the field was cleared (not on initial load)
        console.log('[TaskSummary] 📥 editingTaskName is empty, loading all tasks');
        setShowPresetDropdown(false);
        loadPresetTasks();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTaskName, isEditModalOpen]);
  
  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditModalOpen) {
        handleCancelEdit();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isEditModalOpen]);
  
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
  
  // Check for editTaskId when tasks are loaded
  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      const editTaskId = sessionStorage.getItem('editTaskId');
      if (editTaskId) {
        sessionStorage.removeItem('editTaskId');
        const task = tasks.find(t => t.id === editTaskId);
        if (task) {
          // Small delay to ensure modal is ready
          setTimeout(() => {
            setTaskToEdit(task);
            setEditingTaskName(task.name);
            setEditingTaskDuration(taskTimerService.formatDuration(task.duration));
            setEditingTaskNarration(task.narration || '');
            onEditModalOpen();
          }, 100);
        }
      }
    }
  }, [tasks, isOpen, onEditModalOpen]);
  
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
  
  const handleStartEdit = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion
    console.log('[TaskSummary] ✏️ handleStartEdit called for task:', task.name);
    setTaskToEdit(task);
    setEditingTaskName(task.name);
    setEditingTaskDuration(taskTimerService.formatDuration(task.duration));
    setEditingTaskNarration(task.narration || '');
    console.log('[TaskSummary] 📝 Setting editingTaskName to:', task.name);
    onEditModalOpen();
  };
  
  const handleOpenEditFromChunk = (task: Task) => {
    console.log('[TaskSummary] ✏️ handleOpenEditFromChunk called for task:', task.name);
    setTaskToEdit(task);
    setEditingTaskName(task.name);
    setEditingTaskDuration(taskTimerService.formatDuration(task.duration));
    setEditingTaskNarration(task.narration || '');
    console.log('[TaskSummary] 📝 Setting editingTaskName to:', task.name);
    onEditModalOpen();
  };
  
  const handleCancelEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTaskId(null);
    setEditingTaskName('');
    setEditingTaskDuration('');
    setEditingTaskNarration('');
    setTaskToEdit(null);
    onEditModalClose();
  };
  
  const handleSaveEdit = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!taskToEdit) return;
    
    // Parse duration (HH:MM:SS or HH:MM format)
    let newDuration = taskToEdit.duration;
    if (editingTaskDuration) {
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
    }
    
    // Update task
    const updatedTask: Task = {
      ...taskToEdit,
      name: editingTaskName || taskToEdit.name,
      duration: newDuration,
      narration: editingTaskNarration || undefined,
      // Recalculate endTime based on new duration
      endTime: new Date(new Date(taskToEdit.startTime).getTime() + newDuration * 1000).toISOString()
    };
    
    try {
      const result = await (window.electronAPI as any).saveTaskLog(selectedDate, updatedTask);
      if (result.success) {
        await loadTasksForDate(selectedDate);
        handleCancelEdit();
      } else {
        alert('Failed to save task changes');
      }
    } catch (error) {
      console.error('[TaskTimer] Error saving task:', error);
      alert('Error saving task changes');
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
      pausedDuration: 0,
      narration: customNarration.trim() || undefined
    };
    
    try {
      const result = await (window.electronAPI as any).saveTaskLog(selectedDate, customTask);
      if (result.success) {
        // Reload tasks
        await loadTasksForDate(selectedDate);
        // Reset form
        setCustomTaskName('');
        setCustomDuration('');
        setCustomNarration('');
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
                      <Th width="100px" py={2}></Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                  {tasks.map((task) => {
                    const isExpanded = expandedTasks.has(task.id);
                    const isEditing = editingTaskId === task.id;
                    return (
                      <React.Fragment key={task.id}>
                        <Tr 
                          _hover={{ bg: hoverBg }}
                          cursor={isEditing ? "default" : "pointer"}
                          onClick={() => !isEditing && toggleTaskExpanded(task.id)}
                        >
                          <Td py={2}>
                            <Icon 
                              as={isExpanded ? ChevronDown : ChevronRight} 
                              boxSize={4} 
                              color="gray.500" 
                            />
                          </Td>
                          <Td fontWeight="medium" py={2}>
                            <Flex align="center" gap={2}>
                              <Text>{task.name}</Text>
                              {isNonBillableTask(task.name) && (
                                <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5}>
                                  Non-Billable
                                </Badge>
                              )}
                            </Flex>
                          </Td>
                          <Td py={2}>
                            <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                              {taskTimerService.formatDuration(task.duration)}
                            </Badge>
                          </Td>
                          <Td fontSize="xs" color="gray.600" py={2}>
                            {taskTimerService.formatTimestamp(task.startTime)}
                          </Td>
                          <Td py={2}>
                            <Flex gap={1} justify="flex-end">
                              {isEditing ? (
                                <>
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="green"
                                    onClick={(e) => handleSaveEdit(task.id, e)}
                                    aria-label="Save"
                                    icon={<Check size={14} />}
                                  />
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="gray"
                                    onClick={handleCancelEdit}
                                    aria-label="Cancel"
                                    icon={<XCircle size={14} />}
                                  />
                                </>
                              ) : (
                                <>
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="blue"
                                    onClick={(e) => handleStartEdit(task, e)}
                                    aria-label="Edit task"
                                    icon={<Edit2 size={14} />}
                                  />
                                  <IconButton
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={(e) => handleDeleteTask(task.id, e)}
                                    aria-label="Delete task"
                                    icon={<Trash2 size={14} />}
                                  />
                                </>
                              )}
                            </Flex>
                          </Td>
                        </Tr>
                        
                        {/* Expanded Details - Narration and Sub-tasks */}
                        <Tr>
                          <Td colSpan={6} p={0} border="none">
                            <Collapse in={isExpanded} animateOpacity>
                              <Box bg={detailsBg} px={4} py={3} borderTopWidth="1px" borderColor={borderColor}>
                                <VStack spacing={4} align="stretch">
                                  {/* Narration Section */}
                                  {task.narration && task.narration.trim() && (
                                    <Box
                                      bg={useColorModeValue('white', 'gray.800')}
                                      border="1px solid"
                                      borderColor={borderColor}
                                      borderRadius="md"
                                      p={3}
                                    >
                                      <Text fontWeight="semibold" mb={2} fontSize="xs" color="gray.600">
                                        Narration
                                      </Text>
                                      <Text fontSize="xs" color={useColorModeValue('gray.700', 'gray.300')} whiteSpace="pre-wrap">
                                        {task.narration}
                                      </Text>
                                    </Box>
                                  )}
                                  
                                  {/* Activity Log / Sub-tasks Section */}
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
                                        Activity Log
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
                                </VStack>
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
                  <Box position="relative">
                    <InputGroup>
                      <Input
                        value={customTaskName}
                        onChange={async (e) => {
                          const value = e.target.value;
                          setCustomTaskName(value);
                          if (value.length > 0) {
                            setShowPresetDropdown(true);
                            await searchPresetTasks(value); // Search dynamically
                          } else {
                            setShowPresetDropdown(false);
                            await loadPresetTasks(); // Load all when empty
                          }
                        }}
                        onFocus={async () => {
                          if (customTaskName.length > 0) {
                            setShowPresetDropdown(true);
                            await searchPresetTasks(customTaskName);
                          } else {
                            await loadPresetTasks();
                          }
                        }}
                        placeholder="Search task or client name..."
                        bg={useColorModeValue('white', 'gray.700')}
                      />
                      <InputRightElement>
                        <Icon as={Search} boxSize={4} color="gray.400" />
                      </InputRightElement>
                    </InputGroup>
                    {showPresetDropdown && customTaskName && presetTaskOptions.length > 0 && (
                      <Box
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg={bgColor}
                        border="1px solid"
                        borderColor={borderColor}
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
                                _hover={{ bg: hoverBg }}
                                onClick={() => {
                                  setCustomTaskName(option);
                                  setShowPresetDropdown(false);
                                }}
                                borderBottom={idx < Math.min(4, presetTaskOptions.length - 1) ? '1px solid' : 'none'}
                                borderColor={borderColor}
                              >
                                <Flex align="center" gap={2}>
                                  <Text fontSize="sm" color={textColor}>
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
                <FormControl>
                  <FormLabel>Narration (Optional)</FormLabel>
                  <Textarea
                    value={customNarration}
                    onChange={(e) => setCustomNarration(e.target.value)}
                    placeholder="Describe what you did in this task..."
                    bg={useColorModeValue('white', 'gray.700')}
                    rows={4}
                    resize="vertical"
                  />
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
        
        {/* Edit Task Modal */}
        <Modal isOpen={isEditModalOpen} onClose={onEditModalClose} size="lg">
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent bg={bgColor}>
            <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
              Edit Task
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody py={6}>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      value={editingTaskName}
                      onChange={(e) => {
                        setEditingTaskName(e.target.value);
                        setShowPresetDropdown(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowPresetDropdown(editingTaskName.length > 0)}
                      placeholder="Enter task name or select from presets..."
                      bg={useColorModeValue('white', 'gray.700')}
                      autoFocus
                    />
                    {showPresetDropdown && presetTaskOptions.length > 0 && (
                      <Box
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg={bgColor}
                        border="1px solid"
                        borderColor={borderColor}
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={1000}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                      {presetTaskOptions
                        .filter(option => 
                          option.toLowerCase().includes(editingTaskName.toLowerCase())
                        )
                        .slice(0, 5)
                        .map((option, idx) => (
                              <Box
                                key={idx}
                                px={3}
                                py={2}
                                cursor="pointer"
                                _hover={{ bg: hoverBg }}
                                onClick={() => {
                                  setEditingTaskName(option);
                                  setShowPresetDropdown(false);
                                }}
                                borderBottom={idx < Math.min(4, presetTaskOptions.filter(o => o.toLowerCase().includes(editingTaskName.toLowerCase())).length - 1) ? '1px solid' : 'none'}
                                borderColor={borderColor}
                              >
                                <Flex align="center" gap={2}>
                                  <Text fontSize="sm" color={textColor}>
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
                
                <FormControl>
                  <FormLabel>Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={editingTaskDuration}
                    onChange={(e) => setEditingTaskDuration(e.target.value)}
                    placeholder="01:30:00"
                    bg={useColorModeValue('white', 'gray.700')}
                    maxLength={8}
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Format: HH:MM:SS or HH:MM (e.g., 01:30:00 or 01:30)
                  </Text>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Narration</FormLabel>
                  <Textarea
                    value={editingTaskNarration}
                    onChange={(e) => setEditingTaskNarration(e.target.value)}
                    placeholder="Describe what you did in this task..."
                    bg={useColorModeValue('white', 'gray.700')}
                    rows={6}
                    resize="vertical"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Optional: Add a detailed description of the work completed
                  </Text>
                </FormControl>
                
                <Flex justify="flex-end" gap={2} mt={4}>
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
                  <Th width="100px" py={2}></Th>
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
                          <Td fontWeight="medium" py={2}>
                            <Flex align="center" gap={2}>
                              <Text>{task.name}</Text>
                              {isNonBillableTask(task.name) && (
                                <Badge colorScheme="orange" fontSize="xs" px={2} py={0.5}>
                                  Non-Billable
                                </Badge>
                              )}
                            </Flex>
                          </Td>
                          <Td py={2}>
                            <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                              {taskTimerService.formatDuration(task.duration)}
                            </Badge>
                          </Td>
                          <Td fontSize="xs" color="gray.600" py={2}>
                            {taskTimerService.formatTimestamp(task.startTime)}
                          </Td>
                          <Td py={2}>
                            <Flex gap={1} justify="flex-end">
                              <IconButton
                                size="xs"
                                variant="ghost"
                                colorScheme="blue"
                                onClick={(e) => handleStartEdit(task, e)}
                                aria-label="Edit task"
                                icon={<Edit2 size={14} />}
                              />
                              <IconButton
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={(e) => handleDeleteTask(task.id, e)}
                                aria-label="Delete task"
                                icon={<Trash2 size={14} />}
                              />
                            </Flex>
                          </Td>
                        </Tr>
                        
                    {/* Expanded Details - Narration and Sub-tasks */}
                        <Tr>
                      <Td colSpan={5} p={0} border="none">
                            <Collapse in={isExpanded} animateOpacity>
                              <Box bg={detailsBg} px={4} py={3} borderTopWidth="1px" borderColor={borderColor}>
                                <VStack spacing={4} align="stretch">
                                  {/* Narration Section */}
                                  {task.narration && task.narration.trim() && (
                                    <Box
                                      bg={useColorModeValue('white', 'gray.800')}
                                      border="1px solid"
                                      borderColor={borderColor}
                                      borderRadius="md"
                                      p={3}
                                    >
                                      <Text fontWeight="semibold" mb={2} fontSize="xs" color="gray.600">
                                        Narration
                                      </Text>
                                      <Text fontSize="xs" color={useColorModeValue('gray.700', 'gray.300')} whiteSpace="pre-wrap">
                                        {task.narration}
                                      </Text>
                                    </Box>
                                  )}
                                  
                                  {/* Activity Log / Sub-tasks Section */}
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
                                        Activity Log
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
                                </VStack>
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
                <Box position="relative">
                  <InputGroup>
                    <Input
                      value={customTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setCustomTaskName(value);
                        if (value.length > 0) {
                          setShowPresetDropdown(true);
                          await searchPresetTasks(value); // Search dynamically
                        } else {
                          setShowPresetDropdown(false);
                          await loadPresetTasks(); // Load all when empty
                        }
                      }}
                      onFocus={async () => {
                        if (customTaskName.length > 0) {
                          setShowPresetDropdown(true);
                          await searchPresetTasks(customTaskName);
                        } else {
                          await loadPresetTasks();
                        }
                      }}
                      placeholder="Search task or client name..."
                      bg={useColorModeValue('white', 'gray.700')}
                    />
                    <InputRightElement>
                      <Icon as={Search} boxSize={4} color="gray.400" />
                    </InputRightElement>
                  </InputGroup>
                  {showPresetDropdown && customTaskName && presetTaskOptions.length > 0 && (
                    <Box
                      position="absolute"
                      top="100%"
                      left="0"
                      right="0"
                      mt={1}
                      bg={bgColor}
                      border="1px solid"
                      borderColor={borderColor}
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
                              _hover={{ bg: hoverBg }}
                              onClick={() => {
                                setCustomTaskName(option);
                                setShowPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, presetTaskOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor={borderColor}
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm" color={textColor}>
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
              <FormControl>
                <FormLabel>Narration (Optional)</FormLabel>
                <Textarea
                  value={customNarration}
                  onChange={(e) => setCustomNarration(e.target.value)}
                  placeholder="Describe what you did in this task..."
                  bg={useColorModeValue('white', 'gray.700')}
                  rows={4}
                  resize="vertical"
                />
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
    
      {/* Edit Task Modal */}
      <Modal isOpen={isEditModalOpen} onClose={onEditModalClose} size="lg">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg={bgColor}>
          <ModalHeader borderBottomWidth="1px" borderColor={borderColor}>
            Edit Task
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={6}>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Task Name</FormLabel>
                <Box position="relative">
                  <Input
                    value={editingTaskName}
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('[TaskSummary] ⌨️ Edit modal input onChange triggered, value:', value);
                      setEditingTaskName(value);
                      // Search will be triggered by useEffect watching editingTaskName
                    }}
                    onFocus={async () => {
                      console.log('[TaskSummary] 🎯 Edit modal input onFocus, current value:', editingTaskName);
                      console.log('[TaskSummary] 📊 Current presetTaskOptions count:', presetTaskOptions.length);
                      if (editingTaskName.length > 0) {
                        setShowPresetDropdown(true);
                        console.log('[TaskSummary] 🔍 Calling searchPresetTasks on focus with:', editingTaskName);
                        await searchPresetTasks(editingTaskName);
                      } else {
                        console.log('[TaskSummary] 📥 Input empty on focus, calling loadPresetTasks');
                        await loadPresetTasks();
                      }
                    }}
                    placeholder="Enter task name or select from presets..."
                    bg={useColorModeValue('white', 'gray.700')}
                    autoFocus
                  />
                  {showPresetDropdown && presetTaskOptions.length > 0 && (
                    <Box
                      position="absolute"
                      top="100%"
                      left="0"
                      right="0"
                      mt={1}
                      bg={bgColor}
                      border="1px solid"
                      borderColor={borderColor}
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
                              _hover={{ bg: hoverBg }}
                              onClick={() => {
                                setEditingTaskName(option);
                                setShowPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, presetTaskOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor={borderColor}
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm" color={textColor}>
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
              
              <FormControl>
                <FormLabel>Duration (HH:MM:SS)</FormLabel>
                <Input
                  value={editingTaskDuration}
                  onChange={(e) => setEditingTaskDuration(e.target.value)}
                  placeholder="01:30:00"
                  bg={useColorModeValue('white', 'gray.700')}
                  maxLength={8}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Format: HH:MM:SS or HH:MM (e.g., 01:30:00 or 01:30)
                </Text>
              </FormControl>
              
              <FormControl>
                <FormLabel>Narration</FormLabel>
                <Textarea
                  value={editingTaskNarration}
                  onChange={(e) => setEditingTaskNarration(e.target.value)}
                  placeholder="Describe what you did in this task..."
                  bg={useColorModeValue('white', 'gray.700')}
                  rows={6}
                  resize="vertical"
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Optional: Add a detailed description of the work completed
                </Text>
              </FormControl>
              
              <Flex justify="flex-end" gap={2} mt={4}>
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
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

