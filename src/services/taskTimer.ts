// Task Timer Service
// Manages task timing, persistence, and file operation logging

export interface FileOperation {
  timestamp: string;
  operation: string;
  details?: string;
}

export interface Task {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  fileOperations: FileOperation[];
  isPaused: boolean;
  pausedDuration: number; // total time spent paused in seconds
}

export interface TimerState {
  currentTask: Task | null;
  isRunning: boolean;
  isPaused: boolean;
}

class TaskTimerService {
  private readonly STORAGE_KEY = 'docuframe_timer_state';
  private readonly GMT_8_OFFSET_MS = 8 * 60 * 60 * 1000; // GMT+8 in milliseconds
  
  // Get current timer state from localStorage
  getTimerState(): TimerState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[TaskTimer] Error loading timer state:', error);
    }
    
    return {
      currentTask: null,
      isRunning: false,
      isPaused: false
    };
  }
  
  // Save timer state to localStorage
  saveTimerState(state: TimerState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[TaskTimer] Error saving timer state:', error);
    }
  }
  
  // Start a new task (store actual UTC time)
  startTask(taskName: string): Task {
    const task: Task = {
      id: `task_${Date.now()}`,
      name: taskName,
      startTime: new Date().toISOString(), // Store actual UTC time
      duration: 0,
      fileOperations: [],
      isPaused: false,
      pausedDuration: 0
    };
    
    return task;
  }
  
  // Calculate current duration for a task
  calculateDuration(task: Task, isPaused: boolean): number {
    if (!task.startTime) return 0;
    
    const start = new Date(task.startTime).getTime();
    const end = task.endTime ? new Date(task.endTime).getTime() : Date.now();
    const totalMs = end - start;
    const totalSeconds = Math.floor(totalMs / 1000);
    
    // Subtract paused time
    return Math.max(0, totalSeconds - task.pausedDuration);
  }
  
  // Format duration as HH:MM:SS
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  
  // Log a file operation to the current task (store actual UTC time)
  logFileOperation(task: Task, operation: string, details?: string): Task {
    const fileOp: FileOperation = {
      timestamp: new Date().toISOString(), // Store actual UTC time
      operation,
      details
    };
    
    return {
      ...task,
      fileOperations: [...task.fileOperations, fileOp]
    };
  }
  
  // Get today's date in YYYY-MM-DD format (GMT+8)
  getTodayDateString(): string {
    // Get current time in GMT+8
    const now = new Date();
    const gmt8Time = new Date(now.getTime() + this.GMT_8_OFFSET_MS);
    return gmt8Time.toISOString().split('T')[0];
  }
  
  // Format timestamp for display (GMT+8) - converts UTC to GMT+8 for display only
  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila' // GMT+8 Philippines timezone
    });
  }
  
  // Format date for display (GMT+8)
  formatDate(dateString: string): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Manila'
    });
  }
}

export const taskTimerService = new TaskTimerService();

