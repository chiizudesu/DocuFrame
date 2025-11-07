# Floating Timer Backend Implementation Guide

This file contains the necessary Electron main process code that needs to be added to support the standalone floating timer window.

## 1. Add IPC Handler to Open Floating Timer Window

Add this to your Electron main process file (usually `main.js` or `main.ts`):

```javascript
// Import required modules at the top
const { BrowserWindow, ipcMain, screen } = require('electron');

// Store reference to floating timer window
let floatingTimerWindow = null;

// IPC Handler: Open Floating Timer Window
ipcMain.handle('openFloatingTimer', async () => {
  // Don't create multiple instances
  if (floatingTimerWindow && !floatingTimerWindow.isDestroyed()) {
    floatingTimerWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  floatingTimerWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: width - 420, // Position near right edge
    y: 100, // 100px from top
    frame: false, // Frameless for custom design
    transparent: true, // Transparent background
    alwaysOnTop: true, // Always on top of other windows
    resizable: false,
    skipTaskbar: false, // Show in taskbar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // Use your preload path
    },
  });

  // Load the floating timer route
  if (process.env.NODE_ENV === 'development') {
    floatingTimerWindow.loadURL('http://localhost:3000/#floating-timer');
  } else {
    floatingTimerWindow.loadFile(path.join(__dirname, '../build/index.html'), {
      hash: 'floating-timer',
    });
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    floatingTimerWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Clean up reference when window is closed
  floatingTimerWindow.on('closed', () => {
    floatingTimerWindow = null;
  });

  return true;
});

// Optional: Handle messages from floating timer to main window
ipcMain.on('sendToMainWindow', (event, channel, ...args) => {
  const mainWindow = BrowserWindow.getAllWindows().find(
    (win) => !win.webContents.getURL().includes('#floating-timer')
  );
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
});
```

## 2. Add to Preload Script

Add this to your `preload.js` file:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... your existing API methods ...
  
  // Add this new method for opening floating timer
  openFloatingTimer: () => ipcRenderer.invoke('openFloatingTimer'),
  
  // Add this for communication between windows
  sendToMainWindow: (channel, ...args) => 
    ipcRenderer.send('sendToMainWindow', channel, ...args),
});
```

## 3. Features Implemented

### Frontend (Already Complete)
- ✅ Standalone window component (`FloatingTaskTimerWindow.tsx`)
- ✅ Minimized icon mode (circular progress indicator)
- ✅ Full expanded view with timer controls
- ✅ Timer state persistence via localStorage
- ✅ Compact design (380px x ~280px expanded, 64px icon when minimized)
- ✅ Dark themed UI matching reference design
- ✅ Circular progress visualization
- ✅ Play/Pause/Stop controls
- ✅ Task name editing
- ✅ View summary button
- ✅ Close button returns to main window

### Backend (Needs Implementation)
- ⏳ IPC handler to create floating window
- ⏳ Window positioning and sizing
- ⏳ Always-on-top functionality
- ⏳ Transparent frameless window
- ⏳ Communication between floating window and main window

## 4. Window Behavior

### Minimized Mode
- Small circular icon with timer progress
- Shows abbreviated time (MM:SS)
- Click to expand to full view
- Draggable (via electron window drag)
- Can be positioned anywhere on screen (including multi-monitor)

### Expanded Mode
- Full timer interface with controls
- Task name input
- Large timer display
- Control buttons (Play/Pause/Stop)
- Circular progress indicator
- View summary button
- Minimize and close buttons in header

### State Persistence
- Timer state stored in localStorage
- Shared between main window and floating window
- Continues running when switching between views
- When floating window closes, timer continues in main window panel

## 5. Multi-Monitor Support

The window is created using Electron's `BrowserWindow` with `alwaysOnTop: true`, which allows it to:
- Be dragged to any monitor
- Stay on top of other applications
- Maintain position when switching monitors
- Snap to screen edges (handled by OS)

## 6. Testing Checklist

After implementing the backend:
- [ ] Click "Pop Out Timer" button in main window
- [ ] Floating window opens near top-right corner
- [ ] Timer state syncs between windows
- [ ] Minimize button creates compact icon view
- [ ] Icon is clickable to expand
- [ ] Window can be dragged across monitors
- [ ] Window stays on top of other apps
- [ ] Close button closes floating window
- [ ] Timer continues in main window after closing floating window
- [ ] Task name changes persist across windows
- [ ] Start/Pause/Stop work correctly
- [ ] View Summary opens summary in main window

## 7. Optional Enhancements

Consider adding these features:
- Keyboard shortcuts to toggle floating window (e.g., `Alt+T`)
- Remember last position when reopening
- Auto-minimize when idle
- Custom opacity/transparency slider
- Hover to expand (when minimized)
- Click-through mode when paused

