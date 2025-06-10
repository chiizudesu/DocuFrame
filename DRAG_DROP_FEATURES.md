# Enhanced Folder Navigation with Drag & Drop

## New Features Added

### 🎯 Drag & Drop Functionality

Your DocuFrame application now supports comprehensive drag-and-drop operations similar to Windows File Explorer:

#### 1. **External File Upload**
- **Drag files from Windows Explorer** directly into any folder in DocuFrame
- **Drop onto folders** to upload files to specific directories
- **Drop onto empty space** to upload to the current directory
- **Visual feedback** with blue overlay and upload icon during drag operations
- **Conflict resolution** - automatically prompts when files already exist with options to Replace, Skip, or Cancel

#### 2. **Internal File Operations**
- **Drag files/folders within DocuFrame** to move or copy them
- **Hold Ctrl while dragging** to copy instead of move
- **Multi-select support** - drag multiple selected files at once
- **Smart drag images** using system file icons
- **Visual feedback** with folder highlighting and border changes

#### 3. **System File Icons**
- **Windows file associations** - displays actual system icons for files
- **Automatic icon loading** for better visual recognition
- **Performance optimized** - icons load asynchronously

### 🎮 How to Use

#### External Upload (from Windows Explorer):
1. Open Windows File Explorer alongside DocuFrame
2. Select files in Windows Explorer
3. Drag them into DocuFrame
4. Drop on a folder or empty space
5. Confirm any file conflicts if prompted

#### Internal Move/Copy:
1. Select files/folders in DocuFrame (single or multiple)
2. Drag the selected items
3. **Move**: Drop on target folder
4. **Copy**: Hold Ctrl + Drop on target folder
5. Watch for visual feedback during the operation

#### Visual Indicators:
- **Blue border** around folders when hovering during drag
- **Blue overlay** on entire view when dragging external files
- **Opacity change** on dragged items
- **Upload icon** and message during external file drops
- **System icons** displayed for files (Windows only)

### 💡 Technical Details

#### Enhanced Components:
- **DraggableFileItem**: New wrapper component for individual files/folders
- **FileGrid**: Enhanced with container-level drag-and-drop support
- **Main Process**: New IPC handlers for file operations and icon retrieval

#### New IPC APIs:
```typescript
// File operations
uploadFiles(files, targetDirectory): Promise<OperationResult[]>
moveFiles(files, targetDirectory): Promise<OperationResult[]>
copyFiles(files, targetDirectory): Promise<OperationResult[]>

// System integration
getFileIcon(filePath): Promise<string | null>
```

#### Supported Operations:
- ✅ Upload files from external sources
- ✅ Move files/folders within the app
- ✅ Copy files/folders with Ctrl modifier
- ✅ Multi-file selection and operations
- ✅ System file icon display
- ✅ Conflict resolution dialogs
- ✅ Progress feedback and status updates

### 🔧 Browser Compatibility

The drag-and-drop functionality is optimized for Electron applications and takes advantage of:
- Native file system access
- System file icon APIs
- Desktop application drag-and-drop events
- Windows file association integration

### 📱 User Experience

The implementation follows Windows File Explorer conventions:
- **Familiar drag-and-drop behavior**
- **Standard keyboard modifiers** (Ctrl for copy)
- **Consistent visual feedback**
- **Proper conflict resolution**
- **Status updates and logging**

This creates an intuitive file management experience that Windows users will immediately understand and appreciate. 