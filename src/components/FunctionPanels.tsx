import React, { useState, useEffect, useTransition } from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Tabs, TabList, TabPanels, TabPanel, Tab, Divider, Image } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Settings, Mail, Star, RotateCcw, Copy, Download, CheckCircle2, Eye, Building2, Calculator, Sparkles, Brain, Users, ChevronLeft, ChevronRight, Play, Pause, Square, BarChart, Maximize2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { useColorModeValue } from '@chakra-ui/react';
import { TransferMappingDialog } from './TransferMappingDialog';
import { OrgCodesDialog } from './OrgCodesDialog';
import { MergePDFDialog } from './MergePDFDialog';
import { ExtractionResultDialog } from './ExtractionResultDialog';
import { LateClaimsDialog } from './LateClaimsDialog';
import { AIEditorDialog } from './AIEditorDialog';
import { AITemplaterDialog } from './AITemplaterDialog';
import { DocumentAnalysisDialog } from './DocumentAnalysisDialog';
import { ManageTemplatesDialog } from './ManageTemplatesDialog';
import { UpdateDialog } from './UpdateDialog';
import { Calculator as CalculatorDialog } from './Calculator';
import { ClientSearchOverlay } from './ClientSearchOverlay';
import { DraggableFileItem } from './DraggableFileItem';
import { TaskTimerSummaryDialog } from './TaskTimerSummaryDialog';

import { getAppVersion } from '../utils/version';
import { taskTimerService, Task, TimerState } from '../services/taskTimer';

// Add client search shortcut functionality
const useClientSearchShortcut = (setClientSearchOpen: (open: boolean) => void) => {
  const [clientSearchShortcut, setClientSearchShortcut] = useState('Alt+F');
  const [enableClientSearchShortcut, setEnableClientSearchShortcut] = useState(true);

  useEffect(() => {
    const loadShortcutSettings = async () => {
      try {
        const settings = await (window.electronAPI as any).getConfig();
        console.log('[ClientSearch] Loading settings:', settings);
        setClientSearchShortcut(settings.clientSearchShortcut || 'Alt+F');
        setEnableClientSearchShortcut(settings.enableClientSearchShortcut !== false);
        console.log('[ClientSearch] Shortcut enabled:', settings.enableClientSearchShortcut !== false);
      } catch (error) {
        console.error('Error loading client search shortcut settings:', error);
      }
    };
    loadShortcutSettings();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableClientSearchShortcut) {
        console.log('[ClientSearch] Shortcut disabled');
        return;
      }
      
      // Check for both uppercase and lowercase F, and also handle different key formats
      const key = event.key.toLowerCase();
      const isAltF = event.altKey && key === 'f';
      
      console.log('[ClientSearch] Key pressed:', {
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        isAltF,
        enableClientSearchShortcut
      });
      
      if (isAltF) {
        event.preventDefault();
        console.log('[ClientSearch] Alt+F shortcut triggered');
        // Trigger client search
        setClientSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableClientSearchShortcut, setClientSearchOpen]);

  return { clientSearchShortcut, setClientSearchShortcut, enableClientSearchShortcut, setEnableClientSearchShortcut };
};

const GSTPreviewTooltip: React.FC<{ currentDirectory: string }> = ({ currentDirectory }) => {
  const [preview, setPreview] = useState<{ original: string; preview: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(null);
    setError(null);
    setLoading(true);
    window.electronAPI.executeCommand('gst_rename_preview', currentDirectory)
      .then((result: any) => {
        setLoading(false);
        if (result && result.success && Array.isArray(result.files) && result.files.length > 0) {
          setPreview(result.files);
        } else {
          setPreview([]);
        }
      })
      .catch((_err: any) => {
        setLoading(false);
        setError('Failed to load preview');
      });
  }, [currentDirectory]);
  
  // Avoid unused variable warning
  void error;

  if (loading) return <Box p={2} fontSize="sm">Loading preview...</Box>;
  if (error) return <Box p={2} color="red.400" fontSize="sm">{error}</Box>;
  if (!preview || preview.length === 0) return <Box p={2} fontSize="sm">Rename files according to GST standards</Box>;

  return (
    <Box p={2} w="fit-content" overflowX="auto">
      <Box maxH="320px" overflowY="auto" display="flex" flexDirection="column" gap={2}>
        {preview.map((item, idx) => (
          <Box
            key={idx}
            fontSize="sm"
            borderRadius="lg"
            bg={useColorModeValue('gray.100', 'gray.700')}
            px={3}
            py={2}
            boxShadow="sm"
            borderWidth="1px"
            borderColor={useColorModeValue('gray.200', 'gray.600')}
            w="fit-content"
            overflow="visible"
            display="flex"
            flexDirection="column"
            gap={1}
          >
            <Text whiteSpace="normal" wordBreak="break-all" title={item.original} fontWeight="medium" overflow="visible">
              {item.original}
            </Text>
            <Text whiteSpace="normal" wordBreak="break-all" color="green.400" title={item.preview} fontWeight="medium" overflow="visible">
              {item.preview}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export const FunctionPanels: React.FC = () => {
  const {
    addLog,
    setStatus,
    currentDirectory,
    setFolderItems,
    folderItems,
    selectedFiles,
    setLogFileOperation
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const [isOrgCodesOpen, setOrgCodesOpen] = useState(false);
  const [isMergePDFOpen, setMergePDFOpen] = useState(false);
  const [isExtractionResultOpen, setExtractionResultOpen] = useState(false);
  const [isLateClaimsOpen, setLateClaimsOpen] = useState(false);
  const [isAIEditorOpen, setAIEditorOpen] = useState(false);
  const [isAITemplaterOpen, setAITemplaterOpen] = useState(false);
  const [isDocumentAnalysisOpen, setDocumentAnalysisOpen] = useState(false);
  const [isManageTemplatesOpen, setManageTemplatesOpen] = useState(false);
  const [isCalculatorOpen, setCalculatorOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isClientSearchOpen, setClientSearchOpen] = useState(false);
  const [isTaskTimerSummaryOpen, setTaskTimerSummaryOpen] = useState(false);
  
  // Task Timer state
  const [timerState, setTimerState] = useState<TimerState>({ currentTask: null, isRunning: false, isPaused: false });
  const [taskName, setTaskName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  
  // File Transfer state
  const [latestDownloads, setLatestDownloads] = useState<any[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [nativeIcons, setNativeIcons] = useState<Map<string, string>>(new Map());
  
  // Use transition to prevent flickering during updates (like VBA's Application.screenupdating = false)
  const [, startTransition] = useTransition();

  // Use client search shortcut hook
  useClientSearchShortcut(setClientSearchOpen);
  
  // Load timer state from localStorage on mount
  useEffect(() => {
    const savedState = taskTimerService.getTimerState();
    
    // Check if task is from a different day - if so, auto-stop and clear
    if (savedState.currentTask && taskTimerService.isTaskFromDifferentDay(savedState.currentTask)) {
      console.log('[FunctionPanels] Task is from a different day, auto-stopping and clearing...');
      
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
      setTaskName(currentDirectory.split('\\').pop() || 'New Task');
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
    } else {
      // Default to current directory name
      setTaskName(currentDirectory.split('\\').pop() || 'New Task');
    }
  }, [currentDirectory]);
  
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
          console.log('[FunctionPanels] Timer state changed from other window:', newState);
          setTimerState(newState);
          
          if (newState.currentTask) {
            setTaskName(newState.currentTask.name);
            const duration = taskTimerService.calculateDuration(newState.currentTask, newState.isPaused);
            setCurrentTime(duration);
          } else {
            setTaskName(currentDirectory.split('\\').pop() || 'New Task');
            setCurrentTime(0);
          }
        } catch (error) {
          console.error('[FunctionPanels] Error parsing storage change:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentDirectory]);
  
  // Hide/show timer panel based on floating timer state
  const [isFloatingTimerOpen, setIsFloatingTimerOpen] = useState(false);
  const [isFloatingTimerNearPanel, setIsFloatingTimerNearPanel] = useState(false);
  
  useEffect(() => {
    const handleFloatingTimerOpened = () => {
      console.log('[FunctionPanels] Floating timer opened - hiding panel timer');
      setIsFloatingTimerOpen(true);
    };
    
    const handleFloatingTimerClosed = () => {
      console.log('[FunctionPanels] Floating timer closed - showing panel timer');
      setIsFloatingTimerOpen(false);
      setIsFloatingTimerNearPanel(false);
    };
    
    const handleFloatingTimerNearPanel = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[FunctionPanels] Floating timer near panel:', customEvent.detail?.isNear);
      setIsFloatingTimerNearPanel(customEvent.detail?.isNear || false);
    };
    
    window.addEventListener('floating-timer-opened', handleFloatingTimerOpened);
    window.addEventListener('floating-timer-closed', handleFloatingTimerClosed);
    window.addEventListener('floating-timer-near-panel', handleFloatingTimerNearPanel as EventListener);
    
    return () => {
      window.removeEventListener('floating-timer-opened', handleFloatingTimerOpened);
      window.removeEventListener('floating-timer-closed', handleFloatingTimerClosed);
      window.removeEventListener('floating-timer-near-panel', handleFloatingTimerNearPanel as EventListener);
    };
  }, []);
  
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
      addLog(`Resumed task: ${taskName}`, 'info');
    } else if (!timerState.isRunning) {
      // Start new task
      const newTask = taskTimerService.startTask(taskName || currentDirectory.split('\\').pop() || 'New Task');
      setTimerState({
        currentTask: newTask,
        isRunning: true,
        isPaused: false
      });
      setCurrentTime(0);
      addLog(`Started task: ${newTask.name}`, 'info');
      setStatus(`Task timer started: ${newTask.name}`, 'success');
    }
  };
  
  const handlePauseTimer = () => {
    if (timerState.isRunning && !timerState.isPaused) {
      setPauseStartTime(Date.now());
      setTimerState({
        ...timerState,
        isPaused: true
      });
      addLog(`Paused task: ${taskName}`, 'info');
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
      addLog(`Completed task: ${finalTask.name} (${taskTimerService.formatDuration(finalTask.duration)})`, 'response');
      setStatus(`Task completed: ${taskTimerService.formatDuration(finalTask.duration)}`, 'success');
    } catch (error) {
      console.error('[TaskTimer] Error saving task log:', error);
      addLog(`Error saving task log: ${error}`, 'error');
    }
    
    // Reset timer state
    setTimerState({
      currentTask: null,
      isRunning: false,
      isPaused: false
    });
    setCurrentTime(0);
    setPauseStartTime(null);
    setTaskName(currentDirectory.split('\\').pop() || 'New Task');
    
    // Clear localStorage
    taskTimerService.saveTimerState({
      currentTask: null,
      isRunning: false,
      isPaused: false
    });
  };
  
  // Function to log file operations (exported via context)
  const logFileOperation = React.useCallback((operation: string, details?: string) => {
    console.log('[TaskTimer] logFileOperation called:', {
      operation,
      details,
      isRunning: timerState.isRunning,
      isPaused: timerState.isPaused,
      hasTask: !!timerState.currentTask,
      taskName: timerState.currentTask?.name
    });
    
    if (timerState.isRunning && timerState.currentTask && !timerState.isPaused) {
      const updatedTask = taskTimerService.logFileOperation(timerState.currentTask, operation, details);
      setTimerState({
        ...timerState,
        currentTask: updatedTask
      });
      console.log(`[TaskTimer] ✓ Operation logged successfully:`, operation, 'Total operations:', updatedTask.fileOperations.length);
    } else {
      console.log('[TaskTimer] ✗ Operation NOT logged - Timer not running or paused');
    }
  }, [timerState]);
  
  // Register logFileOperation with context so other components can use it
  React.useEffect(() => {
    setLogFileOperation(() => logFileOperation);
  }, [logFileOperation, setLogFileOperation]);

  // Memoized function to load latest downloads - can be called externally
  const loadLatestDownloads = React.useCallback(async () => {
    try {
      // Use transfer preview to get latest 3 files from downloads
      const previewResult = await window.electronAPI.transfer({ 
        numFiles: 3,
        command: 'preview',
        currentDirectory: currentDirectory
      });
      
      if (previewResult.success && previewResult.files) {
        const newFiles = previewResult.files.slice(0, 3);
        
        // Compare with current downloads to prevent unnecessary updates (and flickering)
        const hasChanged = (prev: any[], next: any[]) => {
          if (prev.length !== next.length) return true;
          for (let i = 0; i < prev.length; i++) {
            if (prev[i]?.path !== next[i]?.path || prev[i]?.name !== next[i]?.name) {
              return true;
            }
          }
          return false;
        };
        
        // Check if data actually changed
        setLatestDownloads(prev => {
          if (hasChanged(prev, newFiles)) {
            return newFiles;
          }
          return prev;
        });
      } else {
        setLatestDownloads(prev => {
          if (prev.length === 0) return prev;
          return [];
        });
      }
    } catch (error) {
      console.error('[FileTransfer] Failed to load latest downloads:', error);
      setLatestDownloads(prev => {
        if (prev.length === 0) return prev;
        return [];
      });
    }
  }, [currentDirectory, startTransition]);

  // Load latest downloads on mount and set up file watcher
  useEffect(() => {
    loadLatestDownloads();
    
    // Set up a fallback auto-refresh interval every 5 seconds
    const refreshInterval = setInterval(() => {
      if (!document.hidden) { // Only refresh if tab is visible
        loadLatestDownloads();
      }
    }, 5000); // Check every 5 seconds as fallback
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadLatestDownloads]);

  // File watcher disabled to avoid conflicts with FileGrid watcher
  // Using 5-second auto-refresh as reliable fallback instead
  // If needed in future, ensure proper cleanup and coordination with FileGrid watcher

  // Listen for folder refresh events to also refresh downloads
  useEffect(() => {
    const handleFolderRefresh = () => {
      loadLatestDownloads();
    };

    // Listen for custom refresh event
    window.addEventListener('folderRefresh', handleFolderRefresh);
    
    return () => {
      window.removeEventListener('folderRefresh', handleFolderRefresh);
    };
  }, [loadLatestDownloads]);

  // Reset current file index when downloads list changes
  useEffect(() => {
    if (currentFileIndex >= latestDownloads.length) {
      startTransition(() => {
        setCurrentFileIndex(Math.max(0, latestDownloads.length - 1));
      });
    }
  }, [latestDownloads, currentFileIndex, startTransition]);

  // Load native icon for the current file
  useEffect(() => {
    if (latestDownloads.length === 0 || currentFileIndex >= latestDownloads.length) {
      return;
    }

    const currentFile = latestDownloads[currentFileIndex];
    if (!currentFile || !currentFile.path || nativeIcons.has(currentFile.path)) {
      return;
    }

    const loadIconForFile = async (filePath: string) => {
      try {
        const iconData = await window.electronAPI.getFileIcon(filePath);
        if (iconData) {
          setNativeIcons(prev => {
            const newMap = new Map(prev);
            newMap.set(filePath, iconData);
            return newMap;
          });
        }
      } catch (error) {
        console.warn(`Failed to get icon for ${filePath}:`, error);
      }
    };

    loadIconForFile(currentFile.path);
  }, [latestDownloads, currentFileIndex, nativeIcons]);

  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string;
    availableVersion?: string;
    releaseNotes?: string;
    downloadSize?: string;
    isDownloading: boolean;
    downloadProgress?: number;
    isDownloaded: boolean;
    error?: string;
  }>({
    currentVersion: getAppVersion(),
    availableVersion: undefined,
    releaseNotes: undefined,
    downloadSize: undefined,
    isDownloading: false,
    downloadProgress: undefined,
    isDownloaded: false,
    error: undefined
  });
  const [extractionResult, setExtractionResult] = useState<{
    type: 'zip' | 'eml';
    extractedFiles: string[];
    sourceFiles: string[];
  } | null>(null);
  const bgColor = useColorModeValue('#f8fafc', 'gray.900');
  const headerBgColor = useColorModeValue('#f1f5f9', 'gray.900');
  const buttonHoverBg = useColorModeValue('#e2e8f0', 'gray.700');
  const borderColor = useColorModeValue('#cbd5e1', 'gray.700');

  const handleAction = async (action: string) => {
    if (action === 'transfer_mapping') {
      setTransferMappingOpen(true);
      setStatus('Opened transfer mapping', 'info');
      return;
    }
    if (action === 'org_codes') {
      setOrgCodesOpen(true);
      setStatus('Opened Org Codes manager', 'info');
      return;
    }
    if (action === 'merge_pdfs') {
      setMergePDFOpen(true);
      setStatus('Opened Merge PDF dialog', 'info');
      return;
    }
    if (action === 'gst_template') {
      addLog('Opening GST Template');
      setStatus('Opening GST Template...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('gst_template', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('GST Template opened', 'success');
        } else {
          addLog(result.message, 'error');
          setStatus('Failed to open GST Template', 'error');
        }
      } catch (error) {
        const errorMsg = `Error opening GST Template: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('Failed to open GST Template', 'error');
        console.error('[FunctionPanels] GST Template error:', error);
      }
      return;
    }

    // Handle GST Rename button action
    if (action === 'gst_rename') {
      addLog('Executing GST Rename command');
      setStatus('Executing GST Rename...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('gst_rename', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('GST Rename completed', 'success');
          
          // Log file operation
          logFileOperation('GST Rename', `Renamed files in ${currentDirectory}`);
          
          // Refresh folder view to show renamed files
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show renamed files', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('GST Rename failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing GST Rename: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('GST Rename failed', 'error');
        console.error('[FunctionPanels] GST Rename error:', error);
      }
      return;
    }

    if (action === 'copy_notes') {
      const notes = `- Depreciation run for the period.\n- Fixed Asset Register reconciles to the Balance Sheet\n- No additions or disposals during the period.`;
      try {
        await navigator.clipboard.writeText(notes);
        setStatus('Notes copied to clipboard', 'success');
        addLog('Copied notes to clipboard', 'response');
      } catch (err) {
        setStatus('Failed to copy notes', 'error');
        addLog('Failed to copy notes to clipboard', 'error');
      }
      return;
    }

    if (action === 'late_claims') {
      setLateClaimsOpen(true);
      setStatus('Opened Late Claims Calculator', 'info');
      return;
    }

    if (action === 'ai_editor') {
      setAIEditorOpen(true);
      setStatus('Opened AI Email Editor', 'info');
      return;
    }

    if (action === 'ai_templater') {
      setAITemplaterOpen(true);
      setStatus('Opened AI Templater', 'info');
      return;
    }

    if (action === 'analyze_docs') {
      setDocumentAnalysisOpen(true);
      setStatus('Opened Document Analysis', 'info');
      return;
    }

    if (action === 'manage_templates') {
      setManageTemplatesOpen(true);
      setStatus('Opened Template Manager', 'info');
      return;
    }

    if (action === 'calculator') {
      setCalculatorOpen(true);
      setStatus('Opened Calculator', 'info');
      return;
    }

    if (action === 'client_search') {
      console.log('[ClientSearch] Button clicked - opening client search');
      setClientSearchOpen(true);
      setStatus('Opened Client Search', 'info');
      return;
    }



    // Handle extract_zips action
    if (action === 'extract_zips') {
      addLog('Executing Extract ZIPs command');
      setStatus('Extracting ZIP files...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('extract_zips', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('ZIP extraction completed', 'success');
          
          // Log file operation
          logFileOperation('Extract ZIPs', `Extracted ${result.extractedFiles?.length || 0} files from ZIP archives`);
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'zip',
              extractedFiles: result.extractedFiles,
              sourceFiles: [] // We'll get this info from the result if needed
            });
            setExtractionResultOpen(true);
          }
          
          // Refresh folder view to show extracted files
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show extracted files', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('ZIP extraction failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Extract ZIPs: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('ZIP extraction failed', 'error');
        console.error('[FunctionPanels] Extract ZIPs error:', error);
      }
      return;
    }

    // Handle extract_eml action
    if (action === 'extract_eml') {
      addLog('Executing Extract EML command');
      setStatus('Extracting EML attachments...', 'info');
      
      try {
        const result = await window.electronAPI.executeCommand('extract_eml', currentDirectory);
        
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('EML extraction completed', 'success');
          
          // Log file operation
          logFileOperation('Extract EML', `Extracted ${result.extractedFiles?.length || 0} attachments from EML files`);
          
          // Show extraction result dialog
          if (result.extractedFiles && result.extractedFiles.length > 0) {
            setExtractionResult({
              type: 'eml',
              extractedFiles: result.extractedFiles,
              sourceFiles: [] // We'll get this info from the result if needed
            });
            setExtractionResultOpen(true);
          }
          
          // Refresh folder view to show extracted attachments
          try {
            const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
            setFolderItems(contents);
            addLog('Folder view refreshed to show extracted attachments', 'info');
          } catch (refreshError) {
            console.error('Failed to refresh folder view:', refreshError);
            addLog('Warning: Failed to refresh folder view. Please refresh manually.', 'error');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('EML extraction failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Extract EML: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('EML extraction failed', 'error');
        console.error('[FunctionPanels] Extract EML error:', error);
      }
      return;
    }

    if (action === 'gst_transfer') {
      addLog('Executing Transfer Latest (transfer 1)');
      setStatus('Transferring latest file from DL...', 'info');
      try {
        const result = await window.electronAPI.transfer({ numFiles: 1, command: 'transfer', currentDirectory });
        if (result.success) {
          addLog(result.message, 'response');
          setStatus('Transfer Latest completed', 'success');
          
          // Log file operation with renamed filename
          if (result.files && result.files.length > 0) {
            const fileName = result.files[0].name;
            const dirName = currentDirectory.split('\\').pop() || currentDirectory;
            logFileOperation(`${fileName} transferred to ${dirName}`);
          }
          
          // Refresh downloads panel
          loadLatestDownloads();
          
          // Refresh folder view
          setStatus('Refreshing folder...', 'info');
          if (window.electronAPI && typeof window.electronAPI.getDirectoryContents === 'function') {
            const contents = await window.electronAPI.getDirectoryContents(currentDirectory);
            if (typeof setFolderItems === 'function') setFolderItems(contents);
            setStatus('Folder refreshed', 'success');
          }
        } else {
          addLog(result.message, 'error');
          setStatus('Transfer Latest failed', 'error');
        }
      } catch (error) {
        const errorMsg = `Error executing Transfer Latest: ${error}`;
        addLog(errorMsg, 'error');
        setStatus('Transfer Latest failed', 'error');
        console.error('[FunctionPanels] Transfer Latest error:', error);
      }
      return;
    }

    // Handle update action
    if (action === 'update') {
      setIsUpdateDialogOpen(true);
      setStatus('Opened update dialog', 'info');
      return;
    }

    addLog(`Executing action: ${action}`);
    // Get user-friendly function names
    const functionNames: { [key: string]: string } = {
      gst_template: 'GST Template',
      gst_rename: 'GST Rename',
      gst_transfer: 'Transfer Latest',
      copy_notes: 'Copy Notes',
      merge_pdfs: 'Merge PDFs',
      extract_zips: 'Extract Zips',
      extract_eml: 'Extract EML',
      transfer_mapping: 'Transfer Map',
      ai_editor: 'AI Editor',
      update: 'Update',
      download_reports: 'Download Reports',
      check_unreconciled: 'Bank Lines',
      view_report: 'View Report',
      org_codes: 'Org Codes'
    };
    const friendlyName = functionNames[action] || action;
    setStatus(`Executing ${friendlyName}...`, 'info');
  };

  const handleCheckForUpdates = async () => {
    addLog('Checking for updates...', 'info');
    setUpdateInfo(prev => ({ ...prev, error: undefined }));
    
    try {
      const result = await window.electronAPI.executeCommand('update', currentDirectory);
      
      if (result.success) {
        addLog('Update check completed', 'response');
        // For now, simulate no update available
        setUpdateInfo(prev => ({
          ...prev,
          availableVersion: undefined,
          error: undefined
        }));
      } else {
        addLog(result.message, 'error');
        setUpdateInfo(prev => ({
          ...prev,
          error: result.message
        }));
      }
    } catch (error) {
      const errorMsg = `Error checking for updates: ${error}`;
      addLog(errorMsg, 'error');
      setUpdateInfo(prev => ({
        ...prev,
        error: errorMsg
      }));
    }
  };

  const handleDownloadUpdate = async () => {
    addLog('Downloading update...', 'info');
    setUpdateInfo(prev => ({ 
      ...prev, 
      isDownloading: true, 
      downloadProgress: 0,
      error: undefined 
    }));
    
    // Simulate download progress
    const progressInterval = setInterval(() => {
      setUpdateInfo(prev => {
        if (prev.downloadProgress! >= 100) {
          clearInterval(progressInterval);
          return {
            ...prev,
            isDownloading: false,
            isDownloaded: true
          };
        }
        return {
          ...prev,
          downloadProgress: (prev.downloadProgress || 0) + 10
        };
      });
    }, 500);
  };

  const handleInstallUpdate = async () => {
    addLog('Installing update...', 'info');
    try {
      await window.electronAPI.quitAndInstall();
    } catch (error) {
      const errorMsg = `Error installing update: ${error}`;
      addLog(errorMsg, 'error');
      setUpdateInfo(prev => ({
        ...prev,
        error: errorMsg
      }));
    }
  };

  const FunctionButton: React.FC<{
    icon: React.ElementType;
    label: string;
    action: string;
    description?: string;
    color?: string;
    isDisabled?: boolean;
  }> = ({
    icon,
    label,
    action,
    description,
    color = 'blue.400',
    isDisabled = false
  }) => {
    const isLong = label.length > 18;
    // Always call useAppContext to maintain hook order
    const { currentDirectory } = useAppContext();
    if (action === 'gst_rename') {
      // Custom tooltip for GST Rename
      const [showPreview, setShowPreview] = useState(false);
      return (
        <Box onMouseEnter={() => setShowPreview(true)} onMouseLeave={() => setShowPreview(false)}>
          <Tooltip
            isOpen={showPreview}
            placement="bottom"
            hasArrow
            label={<GSTPreviewTooltip currentDirectory={currentDirectory} />}
            bg={useColorModeValue('white', 'gray.800')}
            color={useColorModeValue('gray.800', 'white')}
            p={0}
            minW="340px"
            borderRadius="md"
            boxShadow="lg"
          >
            <Button
              variant="ghost"
              display="flex"
              flexDirection="column"
              height="80px"
              minWidth={isLong ? '90px' : '62px'}
              maxWidth="120px"
              width="fit-content"
              py={2}
              px={1}
              _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
              onClick={() => !isDisabled && handleAction(action)}
              isDisabled={isDisabled}
              opacity={isDisabled ? 0.5 : 1}
              cursor={isDisabled ? 'not-allowed' : 'pointer'}
            >
              <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
                <Icon as={icon} boxSize={7} color={isDisabled ? 'gray.400' : color} />
              </Flex>
              <Text
                as="span"
                fontSize="11px"
                textAlign="center"
                lineHeight="1.1"
                fontWeight="medium"
                width="100%"
                whiteSpace="normal"
                wordBreak="break-word"
                minHeight="24px"
                maxHeight="24px"
                display="inline-block"
                overflow="hidden"
              >
                {(() => {
                  const words = label.split(' ');
                  if (words.length === 1) {
                    return <>{label}<br /></>;
                  } else if (words.length === 2) {
                    return <>{words[0]}<br />{words[1]}</>;
                  } else {
                    const mid = Math.ceil(words.length / 2);
                    return <>{words.slice(0, mid).join(' ')}<br />{words.slice(mid).join(' ')}</>;
                  }
                })()}
              </Text>
            </Button>
          </Tooltip>
        </Box>
      );
    }
    return (
      <Tooltip label={description || action} placement="bottom" hasArrow>
        <Button
          variant="ghost"
          display="flex"
          flexDirection="column"
          height="80px"
          minWidth={isLong ? '90px' : '62px'}
          maxWidth="120px"
          width="fit-content"
          py={2}
          px={1}
          _hover={{ bg: isDisabled ? undefined : buttonHoverBg }}
          onClick={() => !isDisabled && handleAction(action)}
          isDisabled={isDisabled}
          opacity={isDisabled ? 0.5 : 1}
          cursor={isDisabled ? 'not-allowed' : 'pointer'}
        >
          <Flex flex="1" align="center" justify="center" mb={1} width={isLong ? '42px' : '36px'} mx="auto">
            <Icon as={icon} boxSize={7} color={isDisabled ? 'gray.400' : color} />
          </Flex>
          <Text
            as="span"
            fontSize="11px"
            textAlign="center"
            lineHeight="1.1"
            fontWeight="medium"
            width="100%"
            whiteSpace="normal"
            wordBreak="break-word"
            minHeight="24px"
            maxHeight="24px"
            display="inline-block"
            overflow="hidden"
          >
            {(() => {
              const words = label.split(' ');
              if (words.length === 1) {
                return <>{label}<br /></>;
              } else if (words.length === 2) {
                return <>{words[0]}<br />{words[1]}</>;
              } else {
                const mid = Math.ceil(words.length / 2);
                return <>{words.slice(0, mid).join(' ')}<br />{words.slice(mid).join(' ')}</>;
              }
            })()}
          </Text>
        </Button>
      </Tooltip>
    );
  };
  return <>
    <Flex direction="column">
      <Tabs variant="line" colorScheme="indigo" size="sm">
        <Flex align="center" justify="space-between" px={2} bg={headerBgColor} borderBottom="2px" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.1)">
          <TabList borderBottom="none">
            <Tab py={1} px={3} fontSize="sm" color={useColorModeValue('#3b82f6', 'white')} _selected={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontWeight: 'semibold'
          }}>
              Functions
            </Tab>
            <Tab py={1} px={3} fontSize="sm" color={useColorModeValue('#3b82f6', 'white')} _selected={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontWeight: 'semibold'
          }}>
              Deprecated
            </Tab>
          </TabList>
          <ThemeToggle />
        </Flex>
        <TabPanels>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={0} align="stretch">
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Download} label="Transfer Latest" action="gst_transfer" description="Transfer latest file from DL to current path" color="blue.600" />
                  <FunctionButton icon={FileEdit} label="GST Rename" action="gst_rename" description="Rename files according to GST standards" color="green.400" />
                  <FunctionButton icon={Calculator} label="Late Claims" action="late_claims" description="Calculate GST late claims adjustments" color="orange.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  GST
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={FilePlus2} label="Merge PDFs" action="merge_pdfs" description="Combine multiple PDF files into one document" color="red.400" />
                  <FunctionButton icon={Archive} label="Extract Zips" action="extract_zips" description="Extract all ZIP files in current directory" color="orange.400" />
                  <FunctionButton icon={Mail} label="Extract EML" action="extract_eml" description="Extract attachments from EML files" color="cyan.400" />
                  <FunctionButton icon={Settings} label="Transfer Map" action="transfer_mapping" description="Edit transfer command mappings" color="gray.600" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  File Management
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Star} label="AI Editor" action="ai_editor" description="Email AI editor for content generation" color="yellow.400" />
                  <FunctionButton icon={Sparkles} label="AI Templater" action="ai_templater" description="Create AI templates for content generation" color="purple.400" />
                  <FunctionButton icon={Brain} label="Analyze Docs" action="analyze_docs" description="AI-powered document analysis and insights" color="blue.400" />
                  <FunctionButton icon={FileEdit} label="Manage Templates" action="manage_templates" description="Create, edit, and manage template YAMLs" color="indigo.400" />
                  <FunctionButton icon={RotateCcw} label="Update" action="update" description="Update application and components" color="pink.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  Utilities
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
                minW="600px"
                maxW="600px"
              >
                <Flex direction="column" gap={1}>
                  {latestDownloads.length === 0 ? (
                    <Flex direction="column" justify="center" align="center" py={2} gap={1}>
                      <Icon as={Download} boxSize={6} color={useColorModeValue('gray.400', 'gray.500')} />
                      <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')} textAlign="center" fontWeight="medium">
                        No files in downloads
                      </Text>
                    </Flex>
                   ) : (
                    <Flex align="center" justify="center" gap={1.5} minH="60px" mt="13px">
                      {/* Previous button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          startTransition(() => {
                            setCurrentFileIndex(prev => Math.max(0, prev - 1));
                          });
                        }}
                        isDisabled={currentFileIndex === 0}
                        _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        px={2}
                      >
                        <Icon as={ChevronLeft} boxSize={5} />
                      </Button>

                      {/* Current file */}
                      <Box flex={1}>
                         <DraggableFileItem
                           file={latestDownloads[currentFileIndex]}
                           isSelected={false}
                           onSelect={() => {}}
                           onContextMenu={() => {}}
                           index={currentFileIndex}
                           selectedFiles={[]}
                           sortedFiles={latestDownloads}
                          onDragStateReset={() => {}}
                           isCut={false}
                           onFileMouseDown={() => {}}
                          onFileClick={() => {
                            // Handle file click - could be used to open the file directly
                          }}
                           onFileMouseUp={() => {}}
                          onFileDragStart={(file, _index, event) => {
                            // Let the parent know we're dragging this file
                            addLog(`Dragging ${file.name} from downloads`);
                            
                            // Set proper drag effect 
                            event.dataTransfer.effectAllowed = 'copy';
                            
                            // Create a custom ghost image for smoother drag
                            try {
                              const dragElement = document.createElement('div');
                              dragElement.style.position = 'absolute';
                              dragElement.style.top = '-1000px';
                              dragElement.style.padding = '4px 8px';
                              dragElement.style.background = 'white';
                              dragElement.style.border = '1px solid #3182ce';
                              dragElement.style.borderRadius = '4px';
                              dragElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                              dragElement.style.color = '#1a202c';
                              dragElement.style.fontSize = '14px';
                              dragElement.innerText = file.name;
                              document.body.appendChild(dragElement);
                              event.dataTransfer.setDragImage(dragElement, 10, 10);
                              setTimeout(() => document.body.removeChild(dragElement), 0);
                            } catch (err) {
                              console.warn('[FileTransfer] Error creating drag ghost:', err);
                            }
                            
                            // Refresh downloads after a short delay (file might be moved)
                            setTimeout(() => {
                              loadLatestDownloads();
                            }, 1000);
                          }}
                           onNativeIconLoaded={(filePath, iconData) => {
                             setNativeIcons(prev => {
                               const newMap = new Map(prev);
                               newMap.set(filePath, iconData);
                               return newMap;
                             });
                           }}
                         >
                          <Box
                            px={3}
                            py={2}
                            borderRadius="md"
                            bg={useColorModeValue('white', 'gray.700')}
                            _hover={{
                              bg: useColorModeValue('gray.50', 'gray.600'),
                              transform: 'translateY(-1px)',
                              boxShadow: 'sm'
                            }}
                            cursor="grab"
                            transition="all 0.2s"
                            border="1px solid"
                            borderColor={useColorModeValue('gray.200', 'gray.600')}
                          >
                            <Flex align="center" gap={2}>
                               {nativeIcons.has(latestDownloads[currentFileIndex].path) ? (
                                 <Image
                                   src={nativeIcons.get(latestDownloads[currentFileIndex].path)}
                                   boxSize={4}
                                   alt={`${latestDownloads[currentFileIndex].name} icon`}
                                   flexShrink={0}
                                 />
                               ) : (
                                 <Icon as={FileText} boxSize={4} color={useColorModeValue('blue.500', 'blue.300')} flexShrink={0} />
                               )}
                              <Box flex={1} minW={0}>
                                <Text 
                                  fontSize="sm" 
                                  fontWeight="medium"
                                  color={useColorModeValue('gray.800', 'gray.100')}
                                  noOfLines={1}
                                  overflow="hidden"
                                  textOverflow="ellipsis"
                                >
                                  {latestDownloads[currentFileIndex].name}
                                </Text>
                                <Text 
                                  fontSize="xs" 
                                  color={useColorModeValue('gray.500', 'gray.400')}
                                  mt={0}
                                >
                                  {currentFileIndex + 1} of {latestDownloads.length}
                                </Text>
                              </Box>
                            </Flex>
                          </Box>
                        </DraggableFileItem>
                      </Box>

                      {/* Next button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          startTransition(() => {
                            setCurrentFileIndex(prev => Math.min(latestDownloads.length - 1, prev + 1));
                          });
                        }}
                        isDisabled={currentFileIndex === latestDownloads.length - 1}
                        _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        px={2}
                      >
                        <Icon as={ChevronRight} boxSize={5} />
                      </Button>
                    </Flex>
                  )}
                </Flex>
                 <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={2} textAlign="center" fontWeight="medium">
                  File Transfer
                </Text>
              </Box>
              {(!isFloatingTimerOpen || isFloatingTimerNearPanel) && (
                <>
                  <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
                  <Box 
                    p={2} 
                    bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                    borderRadius="md" 
                    boxShadow={isFloatingTimerNearPanel 
                      ? '0 0 0 3px rgba(96, 165, 250, 0.6), 0 1px 2px rgba(0,0,0,0.08)'
                      : useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')
                    }
                    minW="260px"
                    maxW="260px"
                    border={isFloatingTimerNearPanel ? '2px solid' : 'none'}
                    borderColor="blue.400"
                    transition="all 0.2s"
                  >
                    <Flex direction="column" gap={2} minH="60px" mt="13px">
                      {/* Task Name - Top, Left Aligned, Bigger */}
                      <Box>
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
                      placeholder="Task name..."
                      fontSize="md"
                      fontWeight="bold"
                      width="100%"
                      bg="transparent"
                      border="none"
                      outline="none"
                      color={useColorModeValue('gray.800', 'gray.100')}
                      _placeholder={{ color: useColorModeValue('gray.400', 'gray.500') }}
                      _hover={{ 
                        bg: useColorModeValue('gray.50', 'rgba(255,255,255,0.05)'),
                        borderRadius: 'md'
                      }}
                      textAlign="left"
                      px={1}
                      py={0.5}
                      cursor="text"
                      transition="background 0.15s ease"
                    />
                    {/* Line separator */}
                    <Box 
                      h="1px" 
                      bg={useColorModeValue('gray.300', 'gray.600')} 
                      mt={1}
                      mb={0.5}
                    />
                  </Box>
                  
                  {/* Control Buttons & Timer Pill */}
                  <Flex gap={1} align="center" justify="space-between">
                    {/* Buttons on left */}
                    <Flex gap={0.5}>
                      <Tooltip label={timerState.isRunning && timerState.isPaused ? "Resume" : "Start"} placement="bottom">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={handleStartTimer}
                          isDisabled={timerState.isRunning && !timerState.isPaused}
                          p={1}
                          minW="auto"
                          h="auto"
                          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        >
                          <Icon as={Play} boxSize={3.5} />
                        </Button>
                      </Tooltip>
                      
                      <Tooltip label="Pause" placement="bottom">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={handlePauseTimer}
                          isDisabled={!timerState.isRunning || timerState.isPaused}
                          p={1}
                          minW="auto"
                          h="auto"
                          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        >
                          <Icon as={Pause} boxSize={3.5} />
                        </Button>
                      </Tooltip>
                      
                      <Tooltip label="Stop & Save" placement="bottom">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={handleStopTimer}
                          isDisabled={!timerState.isRunning}
                          p={1}
                          minW="auto"
                          h="auto"
                          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        >
                          <Icon as={Square} boxSize={3.5} />
                        </Button>
                      </Tooltip>
                      
                      <Box mx={1} h="18px" w="1px" bg={useColorModeValue('gray.300', 'gray.600')} />
                      
                      <Tooltip label="Show Summary" placement="bottom">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setTaskTimerSummaryOpen(true)}
                          p={1}
                          minW="auto"
                          h="auto"
                          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        >
                          <Icon as={BarChart} boxSize={3.5} />
                        </Button>
                      </Tooltip>
                      
                      <Tooltip label="Pop Out Timer" placement="bottom">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await (window.electronAPI as any).openFloatingTimer();
                            } catch (error) {
                              console.error('[TaskTimer] Error opening floating timer:', error);
                            }
                          }}
                          p={1}
                          minW="auto"
                          h="auto"
                          _hover={{ bg: useColorModeValue('gray.200', 'gray.600') }}
                        >
                          <Icon as={Maximize2} boxSize={3.5} />
                        </Button>
                      </Tooltip>
                    </Flex>
                    
                    {/* Timer Pill on right */}
                    <Flex
                      px={2}
                      py={0.5}
                      borderRadius="full"
                      bg={timerState.isRunning 
                        ? (timerState.isPaused ? useColorModeValue('#e5e7eb', '#4b5563') : useColorModeValue('#dbeafe', '#1e3a8a'))
                        : useColorModeValue('#e5e7eb', '#4b5563')
                      }
                      align="center"
                      justify="center"
                    >
                      <Text 
                        fontSize="xs" 
                        fontWeight="semibold" 
                        fontFamily="mono"
                        color={timerState.isRunning 
                          ? (timerState.isPaused ? useColorModeValue('#6b7280', '#9ca3af') : useColorModeValue('#1e3a8a', '#60a5fa'))
                          : useColorModeValue('#6b7280', '#9ca3af')
                        }
                        letterSpacing="tight"
                      >
                        {taskTimerService.formatDuration(currentTime)}
                      </Text>
                    </Flex>
                  </Flex>
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={2} textAlign="center" fontWeight="medium">
                  Task Timer
                </Text>
              </Box>
                </>
              )}
            </Flex>
          </TabPanel>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={0} align="stretch">
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={FileText} label="GST Template" action="gst_template" description="Open GST template for processing" color="blue.400" />
                  <FunctionButton icon={Copy} label="Copy Notes" action="copy_notes" description="Copy asset notes to clipboard" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  GST Functions
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Download} label="Download Reports" action="download_reports" description="Download Xero reports for processing" color="blue.400" />
                  <FunctionButton icon={CheckCircle2} label="Bank Lines" action="check_unreconciled" description="Process bank transaction lines" color="orange.400" />
                  <FunctionButton icon={Eye} label="View Report" action="view_report" description="View generated Xero reports" color="green.400" />
                  <FunctionButton icon={Building2} label="Org Codes" action="org_codes" description="Manage Xero organization codes via OAuth" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  Xero
                </Text>
              </Box>
              <Divider orientation="vertical" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box 
                p={2} 
                bg={useColorModeValue('#f1f5f9', 'rgba(255,255,255,0.03)')} 
                borderRadius="md" 
                boxShadow={useColorModeValue('0 1px 2px rgba(0,0,0,0.08)', '0 1px 2px rgba(0,0,0,0.4)')}
              >
                <Flex gap={1}>
                  <FunctionButton icon={Users} label="Search Clients" action="client_search" description="Search client database for contacts" color="purple.400" />
                  <FunctionButton icon={Calculator} label="Calculator" action="calculator" description="Windows-style calculator with history" color="green.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center" fontWeight="medium">
                  Deprecated
                </Text>
              </Box>
            </Flex>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
    <TransferMappingDialog isOpen={isTransferMappingOpen} onClose={() => setTransferMappingOpen(false)} />
    <OrgCodesDialog isOpen={isOrgCodesOpen} onClose={() => setOrgCodesOpen(false)} />
    <MergePDFDialog 
      isOpen={isMergePDFOpen} 
      onClose={() => setMergePDFOpen(false)} 
      currentDirectory={currentDirectory}
      onFileOperation={logFileOperation}
    />
    <ExtractionResultDialog 
      isOpen={isExtractionResultOpen} 
      onClose={() => setExtractionResultOpen(false)} 
      type={extractionResult?.type || 'zip'}
      extractedFiles={extractionResult?.extractedFiles || []}
      sourceFiles={extractionResult?.sourceFiles || []}
    />
    <LateClaimsDialog isOpen={isLateClaimsOpen} onClose={() => setLateClaimsOpen(false)} currentDirectory={currentDirectory} />
    <AIEditorDialog isOpen={isAIEditorOpen} onClose={() => setAIEditorOpen(false)} />
    <AITemplaterDialog isOpen={isAITemplaterOpen} onClose={() => setAITemplaterOpen(false)} currentDirectory={currentDirectory} />
    <DocumentAnalysisDialog 
      isOpen={isDocumentAnalysisOpen} 
      onClose={() => setDocumentAnalysisOpen(false)} 
      currentDirectory={currentDirectory}
      selectedFiles={selectedFiles}
      folderItems={folderItems}
    />
    <ManageTemplatesDialog isOpen={isManageTemplatesOpen} onClose={() => setManageTemplatesOpen(false)} currentDirectory={currentDirectory} />
    <CalculatorDialog isOpen={isCalculatorOpen} onClose={() => setCalculatorOpen(false)} />
    <UpdateDialog 
      isOpen={isUpdateDialogOpen} 
      onClose={() => setIsUpdateDialogOpen(false)}
      onCheckForUpdates={handleCheckForUpdates}
      onDownloadUpdate={handleDownloadUpdate}
      onInstallUpdate={handleInstallUpdate}
      updateInfo={updateInfo}
      />
    <ClientSearchOverlay 
      isOpen={isClientSearchOpen} 
      onClose={() => setClientSearchOpen(false)} 
    />
    <TaskTimerSummaryDialog
      isOpen={isTaskTimerSummaryOpen}
      onClose={() => setTaskTimerSummaryOpen(false)}
    />

  </>;
};