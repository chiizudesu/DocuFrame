# FileGrid.tsx Refactoring Plan

## Current State Analysis

**File Size:** ~5,900+ lines (237,538 characters)
**Main Component:** `FileGrid` (~5,600 lines)
**Sub-components:** `FileTableRow` (already extracted, ~200 lines)

## Issues Identified

1. **Massive component** - Single component handling too many responsibilities
2. **Large render function** - `renderListView()` is ~2,400 lines
3. **Inline components** - ContextMenu, BlankContextMenu, TemplateSubmenu, MoveToDialogWrapper defined inline
4. **Too many state variables** - 30+ useState hooks
5. **Complex handlers** - Many callback functions mixed with rendering logic
6. **Hard to maintain** - Difficult to navigate and understand

## Proposed Component Structure

### 1. **Core Components** (Extract from main component)

#### `FileTableRow.tsx` ✅ (Already exists)
- **Status:** Already extracted
- **Location:** `src/components/FileTableRow.tsx`
- **Purpose:** Renders individual table row
- **Size:** ~200 lines

#### `FileListView.tsx` (NEW)
- **Extract from:** `renderListView()` function (~2,400 lines)
- **Purpose:** Main list view rendering logic
- **Props:**
  - All file data (sortedFiles, groupedFiles)
  - Selection state
  - Column configuration
  - Event handlers
- **Estimated Size:** ~2,000 lines (will be further split)

#### `FileListViewHeader.tsx` (NEW)
- **Extract from:** Table header section in `renderListView()`
- **Purpose:** Column headers with sorting, resizing, reordering
- **Props:**
  - Column configuration
  - Sort state
  - Event handlers
- **Estimated Size:** ~300 lines

#### `FileListViewBody.tsx` (NEW)
- **Extract from:** Table body section in `renderListView()`
- **Purpose:** Renders file rows (uses FileTableRow)
- **Props:**
  - Files array
  - Selection state
  - Event handlers
- **Estimated Size:** ~400 lines

#### `FileGroupHeader.tsx` (NEW)
- **Extract from:** Grouped files header rendering
- **Purpose:** Renders index prefix group headers
- **Props:**
  - Group key
  - Group files
  - Index info
- **Estimated Size:** ~150 lines

### 2. **Context Menu Components** (Extract inline components)

#### `FileContextMenu.tsx` (NEW)
- **Extract from:** Inline `ContextMenu` component (~200 lines)
- **Purpose:** Right-click context menu for files
- **Props:**
  - Context menu state
  - Selected files
  - Event handlers
- **Estimated Size:** ~250 lines

#### `BlankContextMenu.tsx` (NEW)
- **Extract from:** Inline `BlankContextMenu` component (~50 lines)
- **Purpose:** Right-click context menu for empty space
- **Props:**
  - Menu state
  - Clipboard state
  - Event handlers
- **Estimated Size:** ~80 lines

#### `HeaderContextMenu.tsx` (NEW)
- **Extract from:** Inline header context menu rendering (~100 lines)
- **Purpose:** Right-click context menu for column headers
- **Props:**
  - Menu state
  - Column visibility
  - Event handlers
- **Estimated Size:** ~120 lines

#### `TemplateSubmenu.tsx` (NEW)
- **Extract from:** Inline `TemplateSubmenu` component (~100 lines)
- **Purpose:** Template submenu for folder context menu
- **Props:**
  - Templates
  - Position
  - Event handlers
- **Estimated Size:** ~130 lines

### 3. **Drag & Drop Components**

#### `DragOverlay.tsx` (NEW)
- **Extract from:** Drag overlay rendering in `renderListView()`
- **Purpose:** Visual feedback for drag and drop operations
- **Props:**
  - Drag state
  - Position
- **Estimated Size:** ~50 lines

#### `SelectionRectangle.tsx` (NEW)
- **Extract from:** Drag selection rectangle rendering
- **Purpose:** Visual feedback for drag selection
- **Props:**
  - Selection rectangle state
- **Estimated Size:** ~40 lines

### 4. **Hooks** (Extract custom hooks)

#### `useFileGridState.ts` (NEW)
- **Extract from:** All useState hooks (~30+ hooks)
- **Purpose:** Centralized state management
- **Returns:** State object and setters
- **Estimated Size:** ~200 lines

#### `useFileOperations.ts` (NEW)
- **Extract from:** File operation handlers (delete, copy, move, rename, etc.)
- **Purpose:** File operation logic
- **Returns:** Operation handlers
- **Estimated Size:** ~500 lines

#### `useDragAndDrop.ts` (NEW)
- **Extract from:** Drag and drop handlers
- **Purpose:** Drag and drop logic
- **Returns:** Drag handlers and state
- **Estimated Size:** ~400 lines

#### `useFileSelection.ts` (NEW)
- **Extract from:** Selection logic (click, shift-click, drag selection)
- **Purpose:** File selection management
- **Returns:** Selection handlers and state
- **Estimated Size:** ~300 lines

#### `useColumnManagement.ts` (NEW)
- **Extract from:** Column visibility, resizing, ordering logic
- **Purpose:** Column configuration management
- **Returns:** Column handlers and state
- **Estimated Size:** ~250 lines

#### `useFileSorting.ts` (NEW)
- **Extract from:** Sorting logic
- **Purpose:** File sorting functionality
- **Returns:** Sort handlers and sorted files
- **Estimated Size:** ~150 lines

#### `useNativeIcons.ts` (NEW)
- **Extract from:** Native icon loading logic
- **Purpose:** Windows native icon management
- **Returns:** Icon state and handlers
- **Estimated Size:** ~100 lines

### 5. **Utility Components**

#### `FileGridBackground.tsx` (NEW)
- **Extract from:** Background image rendering
- **Purpose:** Background image display
- **Props:**
  - Background URL
  - Error handler
- **Estimated Size:** ~30 lines

### 6. **Refactored Main Component**

#### `FileGrid.tsx` (REFACTORED)
- **Purpose:** Orchestrates all sub-components
- **Size:** ~300-400 lines (down from ~5,600)
- **Responsibilities:**
  - Composes sub-components
  - Manages high-level state coordination
  - Handles context integration

## Refactoring Strategy

### Phase 1: Extract Inline Components (Low Risk)
1. Extract `FileContextMenu.tsx`
2. Extract `BlankContextMenu.tsx`
3. Extract `HeaderContextMenu.tsx`
4. Extract `TemplateSubmenu.tsx`
5. Extract `MoveToDialogWrapper.tsx` (if not already separate)

### Phase 2: Extract Custom Hooks (Medium Risk)
1. Extract `useFileGridState.ts`
2. Extract `useFileSorting.ts`
3. Extract `useColumnManagement.ts`
4. Extract `useNativeIcons.ts`

### Phase 3: Extract View Components (Higher Risk)
1. Extract `FileListViewHeader.tsx`
2. Extract `FileGroupHeader.tsx`
3. Extract `FileListViewBody.tsx`
4. Extract `DragOverlay.tsx`
5. Extract `SelectionRectangle.tsx`
6. Extract `FileGridBackground.tsx`

### Phase 4: Extract Complex Logic Hooks (Higher Risk)
1. Extract `useFileOperations.ts`
2. Extract `useDragAndDrop.ts`
3. Extract `useFileSelection.ts`

### Phase 5: Refactor Main Component (Final Step)
1. Replace `renderListView()` with `FileListView` component
2. Simplify main component to orchestration only
3. Clean up imports and exports

## Benefits

1. **Maintainability:** Each component has a single responsibility
2. **Testability:** Smaller components are easier to test
3. **Reusability:** Components can be reused elsewhere
4. **Performance:** Better code splitting and memoization opportunities
5. **Readability:** Easier to understand and navigate
6. **Collaboration:** Multiple developers can work on different components

## File Structure After Refactoring

```
src/components/
├── FileGrid.tsx (300-400 lines) - Main orchestrator
├── FileTableRow.tsx (200 lines) - ✅ Already exists
├── FileListView.tsx (2000 lines) - Main list view
├── FileListViewHeader.tsx (300 lines)
├── FileListViewBody.tsx (400 lines)
├── FileGroupHeader.tsx (150 lines)
├── FileContextMenu.tsx (250 lines)
├── BlankContextMenu.tsx (80 lines)
├── HeaderContextMenu.tsx (120 lines)
├── TemplateSubmenu.tsx (130 lines)
├── DragOverlay.tsx (50 lines)
├── SelectionRectangle.tsx (40 lines)
├── FileGridBackground.tsx (30 lines)
└── hooks/
    ├── useFileGridState.ts (200 lines)
    ├── useFileOperations.ts (500 lines)
    ├── useDragAndDrop.ts (400 lines)
    ├── useFileSelection.ts (300 lines)
    ├── useColumnManagement.ts (250 lines)
    ├── useFileSorting.ts (150 lines)
    └── useNativeIcons.ts (100 lines)
```

## Estimated Impact

- **Before:** 1 file, ~5,900 lines
- **After:** 17 files, average ~300 lines per file
- **Main component reduction:** ~90% smaller
- **Maintainability improvement:** Significant

## Risk Assessment

- **Low Risk:** Extracting inline components (Phase 1)
- **Medium Risk:** Extracting hooks (Phase 2-3)
- **Higher Risk:** Extracting complex logic (Phase 4)
- **Mitigation:** 
  - Test after each phase
  - Keep original file as backup
  - Use TypeScript for type safety
  - Incremental refactoring

## Next Steps

1. Review and approve this plan
2. Start with Phase 1 (lowest risk)
3. Test thoroughly after each phase
4. Continue incrementally through all phases

