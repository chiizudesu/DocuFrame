import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useColorModeValue } from "../ui/color-mode";
import {
  Box,
  Text,
  Flex,
  Portal,
  Button,
  IconButton,
  Spinner,
  Badge,
  Checkbox,
  Icon,
} from '@chakra-ui/react';
import {
  FolderOpen,
  FileText,
  Trash2,
  Edit2,
  ExternalLink,
  Copy,
  Scissors,
  FileSymlink,
  ChevronUp,
  FilePlus2,
  Archive,
  Mail,
  Info,
  Image as ImageIcon,
  Star,
  Layers,
  ArrowRightLeft,
  Type,
  X,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  FileEdit,
  Link2,
  Terminal,
  Eye,
  Files,
  CalendarPlus,
  FileDown,
  ClipboardCopy,
  Check,
  List,
  Repeat2,
} from 'lucide-react'
import type { FileItem } from '../../types'
import { useFileGridNavigationRefs } from '../../context/AppContext'
import { joinPath, normalizePath, getClientFolderPath } from '../../utils/path'
import { getIndexInfo } from '../../utils/indexPrefix'
import { SubmenuGroup, ContextSubmenu, MenuRow, MenuSeparator, MenuSectionLabel, useMenuColors, placeMenuElement } from './menuPrimitives'
import { docuFramePalette } from '../../docuFrameColors'
import { ALL_COLUMN_IDS, COLUMN_LABELS } from './FileGridUtils'

// FileContextMenu Component
export interface FileContextMenuProps {
  contextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
    fileItem: FileItem | null;
  };
  selectedFiles: string[];
  selectedFilesSet: Set<string>;
  sortedFiles: FileItem[];
  clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
  setClipboard: (clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null }) => void;
  handleMenuAction: (action: string, payload?: string) => void;
  handlePaste: () => void;
  handleCloseContextMenu: () => void;
  quickAccessPaths: string[];
  /** Last-visited client folders for the Move to ▸ submenu */
  recentClientPaths: string[];
  /** Last-visited client sub-folders (full paths) offered as Move to ▸ targets */
  recentFolderPaths: string[];
  /** Workpaper index keys offered in the Apply prefix ▸ submenu */
  activeSectionKeys: string[];
  currentDirectory: string;
  /** Root folder — used to split a recent path into client name + sub-folder for display */
  rootDirectory: string;
  onCreateFromTemplate: (templatePath: string, templateName: string) => void;
  setMoveToFiles: (files: FileItem[]) => void;
  setIsMoveToDialogOpen: (open: boolean) => void;
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  contextMenu,
  selectedFiles,
  selectedFilesSet,
  sortedFiles,
  clipboard,
  setClipboard,
  handleMenuAction,
  handlePaste,
  handleCloseContextMenu,
  quickAccessPaths,
  recentClientPaths,
  recentFolderPaths,
  activeSectionKeys,
  currentDirectory,
  rootDirectory,
  onCreateFromTemplate,
  setMoveToFiles,
  setIsMoveToDialogOpen,
}) => {
  const { addressBarJumpRef } = useFileGridNavigationRefs();
  const menuRef = useRef<HTMLDivElement>(null);
  const boxBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderCol = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const subfolderTextCol = useColorModeValue('#94a3b8', '#64748b');
  const { shadow: menuShadow } = useMenuColors();
  const [latestFileName, setLatestFileName] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([]);

  useEffect(() => {
    if (!contextMenu.isOpen || !contextMenu.fileItem || contextMenu.fileItem.type !== 'file') return;
    setLatestFileName(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await (window.electronAPI as any).transfer({ preview: true, numFiles: 1 });
        if (!cancelled && result?.files && result.files.length > 0) {
          setLatestFileName(result.files[0].originalName || result.files[0].name);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch latest file name:', error);
          setLatestFileName(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [contextMenu.isOpen, contextMenu.fileItem?.path]);

  // Preload workpaper templates for the New Template ▸ submenu (folders only)
  useEffect(() => {
    if (!contextMenu.isOpen || contextMenu.fileItem?.type !== 'folder') return;
    let cancelled = false;
    (async () => {
      try {
        const result = await (window.electronAPI as any).getWorkpaperTemplates();
        if (!cancelled) setTemplates(result?.success ? result.templates || [] : []);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [contextMenu.isOpen, contextMenu.fileItem?.path, contextMenu.fileItem?.type]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!contextMenu.isOpen || !el) return;
    placeMenuElement(el, contextMenu.position);
  });

  if (!contextMenu.isOpen || !contextMenu.fileItem) return null;

  const selectedPDFs = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.pdf'));
  const showMergePDFs = selectedPDFs.length > 1;
  const fileName = contextMenu.fileItem.name.toLowerCase();
  const isZipFile = fileName.endsWith('.zip');
  const isEmlFile = fileName.endsWith('.eml');
  const isPdfFile = fileName.endsWith('.pdf');
  const selectedZipFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.zip'));
  const selectedEmlFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.eml'));
  const showExtractZips = selectedZipFiles.length > 1 || (isZipFile && selectedZipFiles.length >= 1);
  const showExtractEmls = selectedEmlFiles.length > 1 || (isEmlFile && selectedEmlFiles.length >= 1);
  const isFile = contextMenu.fileItem.type === 'file';
  const isFolder = contextMenu.fileItem.type === 'folder';
  const isSingleFile = selectedFiles.length === 1;
  const isOfficeDoc = /\.(docx?|xlsx?|xlsm|csv)$/i.test(contextMenu.fileItem.name);
  const effectiveCount = selectedFiles.length > 1 && selectedFilesSet.has(contextMenu.fileItem.name)
    ? selectedFiles.length
    : 1;
  // Roll forward: only offered when the filename contains a 4-digit year
  const yearMatch = isFile && isSingleFile ? contextMenu.fileItem.name.match(/20\d{2}/) : null;
  const nextYear = yearMatch ? String(Number(yearMatch[0]) + 1) : null;
  // Suggest the specific recent sub-folders (not just the client root), excluding where we already are.
  const moveToRecents = recentFolderPaths.filter(
    (p) => normalizePath(p) !== normalizePath(currentDirectory)
  ).slice(0, 5);

  /** Split a recent folder path into the client name (shown normally) and the sub-folder
   *  segments beneath it (shown grayed). Falls back to the leaf name when no client root. */
  const describeRecentTarget = (p: string): { clientName: string; subSegments: string[] } => {
    const norm = p.replace(/\\/g, '/').replace(/\/+$/, '');
    const allSegs = norm.split('/').filter(Boolean);
    const clientPath = rootDirectory ? getClientFolderPath(p, rootDirectory) : null;
    if (clientPath) {
      const cSegs = clientPath.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean);
      return {
        clientName: cSegs[cSegs.length - 1] || (allSegs[allSegs.length - 1] ?? p),
        subSegments: allSegs.slice(cSegs.length),
      };
    }
    return { clientName: allSegs[allSegs.length - 1] || p, subSegments: [] };
  };

  const getClipboardFiles = () => {
    if (
      selectedFiles.length > 1 &&
      contextMenu.fileItem &&
      typeof contextMenu.fileItem.name === 'string' &&
      selectedFilesSet.has(contextMenu.fileItem.name)
    ) {
      return sortedFiles.filter((f): f is FileItem => !!f && typeof f.name === 'string' && selectedFilesSet.has(f.name));
    } else if (contextMenu.fileItem) {
      return [contextMenu.fileItem];
    }
    return [];
  };

  const iconSz = 14;

  return (
    <Box
      ref={menuRef}
      position="fixed"
      top={contextMenu.position.y}
      left={contextMenu.position.x}
      opacity={0}
      bg={boxBg}
      borderRadius="8px"
      boxShadow={menuShadow}
      zIndex="modal"
      minW="200px"
      maxW="270px"
      maxH="calc(100vh - 12px)"
      overflowY="auto"
      overflowX="hidden"
      className="enhanced-scrollbar"
      border="1px solid"
      borderColor={borderCol}
    >
      <SubmenuGroup>
        <Box py="4px">
          {/* ── Open / Preview ── */}
          <MenuRow
            icon={<ExternalLink size={iconSz} />}
            label="Open"
            hint="Enter"
            emphasized
            onClick={() => handleMenuAction('open')}
          />
          {isPdfFile && isSingleFile && (
            <MenuRow
              icon={<Eye size={iconSz} />}
              label="Preview"
              onClick={() => handleMenuAction('preview')}
            />
          )}
          {isFile && isSingleFile && (
            <ContextSubmenu id="open-with" icon={<ExternalLink size={iconSz} />} label="Open with">
              <MenuRow
                icon={<FileSpreadsheet size={iconSz} />}
                label="Excel"
                onClick={() => handleMenuAction('open_with', 'excel')}
              />
              <MenuRow
                icon={<FileEdit size={iconSz} />}
                label="Word"
                onClick={() => handleMenuAction('open_with', 'word')}
              />
              <MenuRow
                icon={<FileText size={iconSz} />}
                label="Notepad"
                onClick={() => handleMenuAction('open_with_notepad')}
              />
              <MenuSeparator />
              <MenuRow
                icon={<ExternalLink size={iconSz} />}
                label="Choose another app..."
                onClick={() => handleMenuAction('open_with', 'openas')}
              />
            </ContextSubmenu>
          )}
          {isFolder && (
            <MenuRow
              icon={<ExternalLink size={iconSz} />}
              label="Open folder in new tab"
              onClick={() => handleMenuAction('open_new_tab')}
            />
          )}

          {/* ── Rename ── */}
          {isSingleFile && (
            <>
              <MenuSeparator />
              {isFile && <MenuSectionLabel label="Rename" />}
              <MenuRow
                icon={<Edit2 size={iconSz} />}
                label="Rename"
                hint="F2"
                onClick={() => handleMenuAction('rename')}
              />
              {isFile && (
                <>
                  <MenuRow
                    icon={<Type size={iconSz} />}
                    label="Proper Case"
                    onClick={() => handleMenuAction('proper_case_rename')}
                  />
                  <MenuRow
                    icon={<ArrowRightLeft size={iconSz} />}
                    label="Replace with Latest File"
                    title={latestFileName ? `Latest download: ${latestFileName}` : 'Loading latest download...'}
                    onClick={() => handleMenuAction('replace_with_latest')}
                  />
                  <MenuRow
                    icon={<Repeat2 size={iconSz} />}
                    label="Replace via Transfer Panel…"
                    title="Pick which download replaces this file (bumps its version)"
                    onClick={() => handleMenuAction('replace_via_transfer')}
                  />
                </>
              )}
            </>
          )}

          {/* ── Workpapers (files) ── */}
          {isFile && (
            <>
              <MenuSeparator />
              <MenuSectionLabel label="Workpapers" />
              <ContextSubmenu id="apply-prefix" icon={<Layers size={iconSz} />} label="Apply index" flyoutMaxH="min(72vh, 560px)" flyoutMinW="210px">
                {activeSectionKeys.map((key) => {
                  const info = getIndexInfo(key);
                  return (
                    <MenuRow
                      key={key}
                      label={info.description ? `${key} — ${info.description}` : key}
                      onClick={() => handleMenuAction('apply_prefix_quick', key)}
                    />
                  );
                })}
                {activeSectionKeys.length > 0 && <MenuSeparator />}
                <MenuRow
                  icon={<Layers size={iconSz} />}
                  label="Manage Index Prefix..."
                  onClick={() => handleMenuAction('assign_prefix')}
                />
                <MenuRow
                  icon={<X size={iconSz} />}
                  label="Remove Prefix"
                  onClick={() => handleMenuAction('remove_prefix')}
                />
              </ContextSubmenu>
              {isSingleFile && (
                <MenuRow
                  icon={<Files size={iconSz} />}
                  label="Duplicate"
                  onClick={() => handleMenuAction('duplicate')}
                />
              )}
              {isOfficeDoc && isSingleFile && (
                <MenuRow
                  icon={<FileDown size={iconSz} />}
                  label="Convert to PDF"
                  title="Requires Microsoft Office"
                  onClick={() => handleMenuAction('convert_to_pdf')}
                />
              )}
              <MenuRow
                icon={<Archive size={iconSz} />}
                label={effectiveCount > 1 ? `Add to ZIP (${effectiveCount})` : 'Add to ZIP'}
                onClick={() => handleMenuAction('zip_selection')}
              />
              {nextYear && (
                <MenuRow
                  icon={<CalendarPlus size={iconSz} />}
                  label={`Roll Forward to ${nextYear}`}
                  title="Copy this file with the year(s) in its name incremented"
                  onClick={() => handleMenuAction('roll_forward')}
                />
              )}
              {isPdfFile && (
                <ContextSubmenu id="pdf-tools" icon={<FileText size={iconSz} />} label="PDF" flyoutMinW="190px">
                  <MenuRow
                    icon={<FileText size={iconSz} />}
                    label="Extract Text"
                    onClick={() => handleMenuAction('extract_text')}
                  />
                  <MenuRow
                    icon={<FileEdit size={iconSz} />}
                    label="Edit PDF..."
                    title="Reorder or delete pages, then save"
                    onClick={() => handleMenuAction('edit_pdf')}
                  />
                  <MenuRow
                    icon={<Scissors size={iconSz} />}
                    label="Split PDF..."
                    onClick={() => handleMenuAction('split_pdf')}
                  />
                  {showMergePDFs && (
                    <MenuRow
                      icon={<FilePlus2 size={iconSz} />}
                      label={`Merge PDFs (${selectedPDFs.length})`}
                      onClick={() => handleMenuAction('merge_pdfs')}
                    />
                  )}
                </ContextSubmenu>
              )}
              {showExtractZips && (
                <MenuRow
                  icon={<Archive size={iconSz} />}
                  label={`Extract ZIP${selectedZipFiles.length > 1 ? `s (${selectedZipFiles.length})` : ''}`}
                  onClick={() => handleMenuAction('extract_zip')}
                />
              )}
              {showExtractEmls && (
                <MenuRow
                  icon={<Mail size={iconSz} />}
                  label={`Extract Attachments${selectedEmlFiles.length > 1 ? ` (${selectedEmlFiles.length})` : ''}`}
                  onClick={() => handleMenuAction('extract_eml')}
                />
              )}

              {/* ── Send ── */}
              <MenuSeparator />
              <MenuSectionLabel label="Send" />
              <ContextSubmenu id="move-to" icon={<ArrowRightLeft size={iconSz} />} label="Move to" flyoutMinW="200px">
                {moveToRecents.map((path) => {
                  const { clientName, subSegments } = describeRecentTarget(path);
                  return (
                    <MenuRow
                      key={path}
                      icon={<Folder size={iconSz} />}
                      title={path}
                      label={
                        <Box as="span" display="inline-flex" alignItems="baseline" minW={0} overflow="hidden">
                          <Text as="span" flexShrink={0}>{clientName}</Text>
                          {subSegments.length > 0 && (
                            <Text
                              as="span"
                              ml="5px"
                              color={subfolderTextCol}
                              whiteSpace="nowrap"
                              overflow="hidden"
                              textOverflow="ellipsis"
                            >
                              {subSegments.join(' › ')}
                            </Text>
                          )}
                        </Box>
                      }
                      onClick={() => handleMenuAction('move_to_recent', path)}
                    />
                  );
                })}
                {moveToRecents.length > 0 && <MenuSeparator />}
                <MenuRow
                  icon={<FolderOpen size={iconSz} />}
                  label="Choose folder..."
                  onClick={() => {
                    const filesToMove = getClipboardFiles();
                    setMoveToFiles(filesToMove);
                    addressBarJumpRef.current?.close();
                    setIsMoveToDialogOpen(true);
                    handleCloseContextMenu();
                  }}
                />
              </ContextSubmenu>
              <MenuRow
                icon={<ClipboardCopy size={iconSz} />}
                label={effectiveCount > 1 ? `Copy Files for Email (${effectiveCount})` : 'Copy File for Email'}
                title="Puts the actual file on the Windows clipboard — paste into Outlook, Teams or Explorer"
                onClick={() => handleMenuAction('copy_files_clipboard')}
              />
            </>
          )}

          {/* ── Folder actions ── */}
          {isFolder && (
            <>
              <MenuSeparator />
              <MenuSectionLabel label="Folder" />
              {quickAccessPaths.includes(contextMenu.fileItem.path) ? (
                <MenuRow
                  icon={<Star size={iconSz} />}
                  label="Unpin from Quick Access"
                  onClick={() => handleMenuAction('unpin_quick_access')}
                />
              ) : (
                <MenuRow
                  icon={<Star size={iconSz} />}
                  label="Pin to Quick Access"
                  onClick={() => handleMenuAction('pin_quick_access')}
                />
              )}
              <ContextSubmenu id="new-template" icon={<FileSpreadsheet size={iconSz} />} label="New Template" flyoutMinW="200px">
                {templates.length === 0 ? (
                  <MenuRow label="No templates" disabled />
                ) : (
                  templates.map((template) => (
                    <MenuRow
                      key={template.path}
                      icon={
                        /\.docx?$/i.test(template.name) ? <FileEdit size={12} /> :
                        /\.xlsx?$/i.test(template.name) ? <FileSpreadsheet size={12} /> :
                        <FileText size={12} />
                      }
                      label={template.name}
                      onClick={() => {
                        onCreateFromTemplate(template.path, template.name);
                        handleCloseContextMenu();
                      }}
                    />
                  ))
                )}
              </ContextSubmenu>
            </>
          )}

          {/* ── Clipboard ── */}
          <MenuSeparator />
          <MenuRow
            icon={<Link2 size={iconSz} />}
            label="Copy Path"
            onClick={() => { handleMenuAction('copy_path'); handleCloseContextMenu(); }}
          />
          <MenuRow
            icon={<Scissors size={iconSz} />}
            label="Cut"
            hint="Ctrl+X"
            onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'cut' }); handleCloseContextMenu(); }}
          />
          <MenuRow
            icon={<Copy size={iconSz} />}
            label="Copy"
            hint="Ctrl+C"
            onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'copy' }); handleCloseContextMenu(); }}
          />
          <MenuRow
            icon={<FileSymlink size={iconSz} />}
            label="Paste"
            hint="Ctrl+V"
            disabled={clipboard.files.length === 0}
            onClick={() => { handlePaste(); handleCloseContextMenu(); }}
          />

          {/* ── Destructive & Info ── */}
          <MenuSeparator />
          <MenuRow
            icon={<Trash2 size={iconSz} />}
            label="Delete"
            hint="Del"
            danger
            onClick={() => handleMenuAction('delete')}
          />
          <MenuRow
            icon={<Info size={iconSz} />}
            label="Properties"
            onClick={() => handleMenuAction('properties')}
          />
        </Box>
      </SubmenuGroup>
    </Box>
  );
};

// BlankContextMenu Component
export interface BlankContextMenuProps {
  blankContextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
  };
  clipboard: { files: FileItem[]; operation: 'cut' | 'copy' | null };
  handlePaste: () => void;
  setBlankContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number } }) => void;
  onPasteImage: () => void;
  currentDirectory: string;
  onCreateFolder: () => void;
  onCreateTextFile: () => void;
  onCreateSpreadsheet: () => void;
  onCreateWordDoc: () => void;
  onCreateShortcut: () => void;
  onCreateFromTemplate: (templatePath: string, templateName: string) => void;
  onCopyPath: () => void;
  onOpenPowerShell: () => void;
  groupByMode: 'auto' | 'type' | 'date';
  onSetGroupByMode: (mode: 'auto' | 'type' | 'date') => void;
  rowDensity: 'compact' | 'default' | 'comfortable';
  onSetRowDensity: (d: 'compact' | 'default' | 'comfortable') => void;
}

export const BlankContextMenu: React.FC<BlankContextMenuProps> = ({
  blankContextMenu,
  clipboard,
  handlePaste,
  setBlankContextMenu,
  onPasteImage,
  currentDirectory,
  onCreateFolder,
  onCreateTextFile,
  onCreateSpreadsheet,
  onCreateWordDoc,
  onCreateShortcut,
  onCreateFromTemplate,
  onCopyPath,
  onOpenPowerShell,
  groupByMode,
  onSetGroupByMode,
  rowDensity,
  onSetRowDensity,
}) => {
  const boxBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderCol = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const { shadow: menuShadow } = useMenuColors();
  const menuRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([]);

  const iconSz = 14;

  useEffect(() => {
    if (!blankContextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      // ContextSubmenu flyouts render inside menuRef, so one containment check covers them
      if (!menuRef.current?.contains(e.target as Node)) {
        setBlankContextMenu({ ...blankContextMenu, isOpen: false });
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [blankContextMenu, setBlankContextMenu]);

  // Preload workpaper templates for the New ▸ submenu
  useEffect(() => {
    if (!blankContextMenu.isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await (window.electronAPI as any).getWorkpaperTemplates();
        if (!cancelled) setTemplates(result?.success ? result.templates || [] : []);
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => { cancelled = true; };
  }, [blankContextMenu.isOpen]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!blankContextMenu.isOpen || !el) return;
    placeMenuElement(el, blankContextMenu.position);
  });

  if (!blankContextMenu.isOpen) return null;
  return (
    <>
      <Box ref={menuRef} position="fixed" top={blankContextMenu.position.y} left={blankContextMenu.position.x} opacity={0} bg={boxBg} borderRadius="8px" boxShadow={menuShadow} zIndex="modal" minW="180px" maxW="240px" maxH="calc(100vh - 12px)" overflowY="auto" overflowX="hidden" className="enhanced-scrollbar" border="1px solid" borderColor={borderCol}>
        <Box py="4px">
          <SubmenuGroup>
            <ContextSubmenu id="new" icon={<FolderPlus size={iconSz} />} label="New" flyoutMinW="190px" flyoutMaxH="min(70vh, 480px)">
              <MenuRow
                icon={<Folder size={iconSz} />}
                label="Folder"
                onClick={() => { onCreateFolder(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
              />
              <MenuRow
                icon={<FileText size={iconSz} />}
                label="Text File"
                onClick={() => { onCreateTextFile(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
              />
              <MenuRow
                icon={<FileSpreadsheet size={iconSz} />}
                label="Excel File"
                onClick={() => { onCreateSpreadsheet(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
              />
              <MenuRow
                icon={<FileEdit size={iconSz} />}
                label="Word Document"
                onClick={() => { onCreateWordDoc(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
              />
              <MenuRow
                icon={<Link2 size={iconSz} />}
                label="New Shortcut"
                onClick={() => { onCreateShortcut(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
              />
              {templates.length > 0 && (
                <>
                  <MenuSeparator />
                  {templates.map((template) => (
                    <MenuRow
                      key={template.path}
                      icon={
                        /\.docx?$/i.test(template.name) ? <FileEdit size={12} /> :
                        /\.xlsx?$/i.test(template.name) ? <FileSpreadsheet size={12} /> :
                        <FileText size={12} />
                      }
                      label={template.name}
                      onClick={() => {
                        onCreateFromTemplate(template.path, template.name);
                        setBlankContextMenu({ ...blankContextMenu, isOpen: false });
                      }}
                    />
                  ))}
                </>
              )}
            </ContextSubmenu>
            <MenuSeparator />
            <MenuRow
              icon={<FileSymlink size={iconSz} />}
              label="Paste"
              disabled={clipboard.files.length === 0}
              onClick={() => { handlePaste(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
            />
            <MenuRow
              icon={<ImageIcon size={iconSz} />}
              label="Paste Image"
              onClick={() => { onPasteImage(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
            />
            <MenuSeparator />
            <MenuRow
              icon={<Link2 size={iconSz} />}
              label="Copy Path"
              onClick={() => { onCopyPath(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
            />
            <MenuRow
              icon={<Terminal size={iconSz} />}
              label="Open PowerShell"
              onClick={() => { onOpenPowerShell(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}
            />
            <MenuSeparator />
            <ContextSubmenu id="group-by" icon={<Layers size={iconSz} />} label="Group by">
              {([
                { key: 'auto', label: 'Workpaper index' },
                { key: 'type', label: 'File type' },
                { key: 'date', label: 'Date modified' },
              ] as const).map(({ key, label }) => (
                <MenuRow
                  key={key}
                  icon={groupByMode === key ? <Check size={iconSz} /> : <Box w="14px" />}
                  label={label}
                  onClick={() => {
                    onSetGroupByMode(key);
                    setBlankContextMenu({ ...blankContextMenu, isOpen: false });
                  }}
                />
              ))}
            </ContextSubmenu>
            <ContextSubmenu id="density" icon={<List size={iconSz} />} label="Density">
              {([
                { key: 'compact', label: 'Compact' },
                { key: 'default', label: 'Default' },
                { key: 'comfortable', label: 'Comfortable' },
              ] as const).map(({ key, label }) => (
                <MenuRow
                  key={key}
                  icon={rowDensity === key ? <Check size={iconSz} /> : <Box w="14px" />}
                  label={label}
                  onClick={() => {
                    onSetRowDensity(key);
                    setBlankContextMenu({ ...blankContextMenu, isOpen: false });
                  }}
                />
              ))}
            </ContextSubmenu>
          </SubmenuGroup>
        </Box>
      </Box>
    </>
  );
};

// MoveToNavigation Component (used by MoveToDialogWrapper)
type MoveToFolderRow = FileItem & { id: string }

interface MoveToNavigationProps {
  currentDirectory: string;
  onSelectFolder: (path: string) => Promise<void>;
  onCancel: () => void;
  dialogRef?: React.RefObject<HTMLDivElement>;
}

const MoveToNavigation: React.FC<MoveToNavigationProps> = ({ currentDirectory, onSelectFolder, onCancel, dialogRef }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<MoveToFolderRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const selectedBg = useColorModeValue('blue.50', 'blue.900');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const pillBg = useColorModeValue('blue.100', 'blue.800');
  const pillColor = useColorModeValue('blue.800', 'blue.100');
  const { isQuickNavigating, addressBarJumpRef } = useFileGridNavigationRefs();
  const initializedRef = useRef(false);

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const isValid = await window.electronAPI.validatePath(dirPath);
      if (!isValid) {
        throw new Error(`Path is not valid: ${dirPath}`);
      }
      const directoryItems = await window.electronAPI.getDirectoryContents(dirPath);
      const foldersOnly = directoryItems.filter((item: FileItem & { isHidden?: boolean }) => item.type === 'folder' && !item.isHidden);
      setItems(foldersOnly.map((item) => ({ ...item, id: item.path })));
      const normalizedPath = normalizePath(dirPath);
      setCurrentPath(normalizedPath);
      setSelectedPath(normalizedPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to load directory: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    
    const initializePath = async () => {
      try {
        const parentPath = normalizePath(joinPath(...currentDirectory.split(/[\\/]/).filter(Boolean).slice(0, -1))) || currentDirectory;
        await loadDirectory(parentPath);
        setSelectedPath(parentPath);
        initializedRef.current = true;
      } catch (error) {
        console.error('Failed to load parent directory:', error);
        await loadDirectory(currentDirectory);
        setSelectedPath(currentDirectory);
        initializedRef.current = true;
      }
    };
    initializePath();
  }, [currentDirectory, loadDirectory]);

  const handleItemClick = useCallback(async (item: { path: string; type: string }) => {
    if (item.type === 'folder') {
      await loadDirectory(item.path);
    }
  }, [loadDirectory]);

  const goToParentDirectory = useCallback(async () => {
    if (!currentPath) {
      const parentPath = normalizePath(joinPath(...currentDirectory.split(/[\\/]/).filter(Boolean).slice(0, -1))) || currentDirectory;
      await loadDirectory(parentPath);
      return;
    }
    const parentPath = normalizePath(joinPath(...currentPath.split(/[\\/]/).filter(Boolean).slice(0, -1)));
    if (!parentPath || parentPath === currentPath) {
      return;
    } else {
      await loadDirectory(parentPath);
    }
  }, [currentPath, currentDirectory, loadDirectory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInDialog = dialogRef?.current?.contains(target) ?? false;
      const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (isQuickNavigating) return;
      if (addressBarJumpRef.current?.isActive()) return;
      
      const quickNavigateInput = document.querySelector('input[placeholder*="Search files"], input[placeholder*="Navigate"]');
      if (quickNavigateInput && quickNavigateInput instanceof HTMLElement) {
        const overlay = quickNavigateInput.closest('[style*="display"], [style*="opacity"]');
        if (overlay && overlay instanceof HTMLElement) {
          const style = window.getComputedStyle(overlay);
          if (style.display !== 'none' && style.opacity !== '0' && style.visibility !== 'hidden') {
            return;
          }
        }
      }

      if (!dialogRef?.current || !isInDialog) return;
      if (isInputField) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const firstItem = items.filter(item => {
          if (!filterKeyword.trim()) return true;
          return item.name.toLowerCase().includes(filterKeyword.toLowerCase().trim());
        })[0];
        
        if (firstItem) {
          onSelectFolder(firstItem.path);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword('');
        return;
      }

      if (e.key === 'Backspace' && filterKeyword.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword(prev => prev.slice(0, -1));
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setFilterKeyword(prev => prev + e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [filterKeyword, isQuickNavigating, dialogRef, items, onSelectFolder, addressBarJumpRef]);

  const filteredItems = useMemo(() => {
    if (!filterKeyword.trim()) {
      return items;
    }
    const keyword = filterKeyword.toLowerCase().trim();
    return items.filter(item => 
      item.name.toLowerCase().includes(keyword)
    );
  }, [items, filterKeyword]);

  return (
    <Box ref={dialogRef} h="400px" display="flex" flexDirection="column" border="1px solid" borderColor={borderColor} borderRadius="md">
      <Flex
        p={2}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        gap={2}
        bg={useColorModeValue('gray.50', 'gray.700')}
      >
        <IconButton
          aria-label="Parent directory"
          size="xs"
          onClick={goToParentDirectory}
          variant="ghost"><ChevronUp size={16} /></IconButton>
        <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} flex="1" lineClamp={1}>
          {currentPath || 'Computer'}
        </Text>
      </Flex>
      <Box flex="1" overflowY="auto" p={2}>
        {loading && (
          <Flex justify="center" align="center" h="100px">
            <Spinner size="md" />
          </Flex>
        )}
        
        {error && (
          <Text color="red.500" fontSize="sm" mb={2}>{error}</Text>
        )}
        
        {!loading && !error && filteredItems.length === 0 && (
          <Flex direction="column" align="center" justify="center" py={12} gap={3} opacity={0.5}>
            <Icon boxSize="32px" color={useColorModeValue('gray.400', 'gray.500')} asChild>
              <FolderOpen />
            </Icon>
            <Text fontSize="sm" color={useColorModeValue('gray.500', 'gray.400')} fontWeight="medium">
              {filterKeyword.trim() ? `No folders match "${filterKeyword}"` : 'This folder is empty'}
            </Text>
            <Text fontSize="xs" color={useColorModeValue('gray.400', 'gray.500')}>
              {filterKeyword.trim() ? 'Try a different search term' : 'Drop files here or create a new folder'}
            </Text>
          </Flex>
        )}
        
        {!loading && filteredItems.map((item, index) => (
          <Flex
            key={item.id || `${item.path}-${index}`}
            align="center"
            py={2}
            px={3}
            cursor="pointer"
            bg={selectedPath === item.path ? selectedBg : 'transparent'}
            _hover={{ bg: hoverBg }}
            borderRadius="md"
            onClick={() => handleItemClick(item)}
          >
            <Icon boxSize={4} color="blue.500" mr={3} asChild><Folder /></Icon>
            <Text fontSize="sm" flex="1" lineClamp={1}>
              {item.name}
            </Text>
          </Flex>
        ))}
      </Box>
      <Flex p={3} borderTop="1px solid" borderColor={borderColor} gap={2} align="center" justify="space-between">
        {filterKeyword.trim() && (
          <Badge
            colorPalette="blue"
            bg={pillBg}
            color={pillColor}
            px={3}
            py={1.5}
            borderRadius="full"
            fontSize="xs"
            display="flex"
            alignItems="center"
            gap={2}
            h="32px"
          >
            {filterKeyword}
            <IconButton
              aria-label="Clear filter"
              size="xs"
              variant="ghost"
              h="auto"
              minW="auto"
              p={0}
              onClick={() => setFilterKeyword('')}
              _hover={{ bg: 'transparent', opacity: 0.7 }}><X size={12} /></IconButton>
          </Badge>
        )}
        {!filterKeyword.trim() && <Box />}
        
        <Flex gap={2}>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            colorPalette="blue"
            onClick={async () => {
              if (selectedPath) {
                await onSelectFolder(selectedPath);
              }
            }}
            disabled={!selectedPath}
          >
            Move Here
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};

// MoveToDialogWrapper Component
export interface MoveToDialogWrapperProps {
  onClose: () => void;
  moveToFiles: FileItem[];
  currentDirectory: string;
  onSelectFolder: (destPath: string) => Promise<void>;
  refreshDirectory: (path: string) => Promise<void>;
  setStatus: (message: string, type?: 'default' | 'info' | 'success' | 'error') => void;
  addLog: (message: string, type?: 'error' | 'response' | 'command' | 'info') => void;
}

export const MoveToDialogWrapper: React.FC<MoveToDialogWrapperProps> = ({
  onClose,
  moveToFiles,
  currentDirectory,
  onSelectFolder,
  refreshDirectory,
  setStatus,
  addLog,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayBg = useColorModeValue('blackAlpha.600', 'blackAlpha.800');
  const { addressBarJumpRef } = useFileGridNavigationRefs();

  useEffect(() => {
    addressBarJumpRef.current?.close();

    const timer = setTimeout(() => {
      if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [addressBarJumpRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInDialog = dialogRef.current?.contains(target) ?? false;
      
      if (e.key === 'Escape' && isInDialog) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey || e.altKey) && isInDialog) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
      return;
    }
    
    const target = e.target as HTMLElement;
    if (dialogRef.current && !dialogRef.current.contains(target)) {
      onClose();
    }
  };

  return (
    <Portal>
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg={overlayBg}
        backdropFilter="blur(4px)"
        zIndex={9999}
        onClick={handleOverlayClick}
        cursor="pointer"
      />
      <Box
        ref={dialogRef}
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg={useColorModeValue('white', 'gray.800')}
        border="1px solid"
        borderColor={useColorModeValue('gray.200', 'gray.600')}
        borderRadius="md"
        boxShadow="xl"
        zIndex={10000}
        w="600px"
        display="flex"
        flexDirection="column"
        maxH="90vh"
        tabIndex={-1}
        outline="none"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Flex
          align="center"
          justify="space-between"
          p={4}
          borderBottom="1px solid"
          borderColor={useColorModeValue('gray.200', 'gray.600')}
        >
          <Text fontSize="lg" fontWeight="semibold">
            Move {moveToFiles.length} file{moveToFiles.length > 1 ? 's' : ''} to...
          </Text>
          <IconButton aria-label="Close" size="sm" variant="ghost" onClick={onClose}><X size={16} /></IconButton>
        </Flex>
        <Box p={4} flex="1" minH="0">
          <MoveToNavigation
            currentDirectory={currentDirectory}
            onSelectFolder={onSelectFolder}
            onCancel={onClose}
            dialogRef={dialogRef}
          />
        </Box>
      </Box>
    </Portal>
  );
};

// HeaderContextMenu Component
export interface HeaderContextMenuProps {
  headerContextMenu: {
    isOpen: boolean;
    position: { x: number; y: number };
  };
  columnVisibility: Record<string, boolean>;
  toggleColumnVisibility: (column: string) => void;
  closeHeaderContextMenu: () => void;
  /** Period column only applies inside GST folders; hide the toggle elsewhere */
  periodAvailable?: boolean;
}

export const HeaderContextMenu: React.FC<HeaderContextMenuProps> = ({
  headerContextMenu,
  columnVisibility,
  toggleColumnVisibility,
  closeHeaderContextMenu,
  periodAvailable = false,
}) => {
  const menuBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const menuBorderColor = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const menuHoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const { shadow: headerMenuShadow } = useMenuColors();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerContextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeHeaderContextMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [headerContextMenu.isOpen, closeHeaderContextMenu]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!headerContextMenu.isOpen || !el) return;
    placeMenuElement(el, headerContextMenu.position);
  });

  if (!headerContextMenu.isOpen) return null;

  return (
    <Portal>
      <Box
        ref={menuRef}
        data-column-menu
        position="fixed"
        left={headerContextMenu.position.x}
        top={headerContextMenu.position.y}
        opacity={0}
        zIndex={10000}
        bg={menuBg}
        border="1px solid"
        borderColor={menuBorderColor}
        borderRadius="8px"
        boxShadow={headerMenuShadow}
        minW="150px"
        maxH="calc(100vh - 12px)"
        overflowY="auto"
        className="enhanced-scrollbar"
        py="4px"
      >
        {ALL_COLUMN_IDS.filter((column) => column !== 'period' || periodAvailable).map((column) => {
          const isChecked = columnVisibility[column];
          const isGstOnly = column === 'period';
          return (
            <Flex
              key={column}
              align="center"
              px={2.5}
              py="3px"
              cursor="pointer"
              _hover={{ bg: menuHoverBg }}
              onClick={(e) => {
                e.stopPropagation();
                toggleColumnVisibility(column);
              }}
            >
              <Checkbox.Root
                checked={isChecked}
                onCheckedChange={() => toggleColumnVisibility(column)}
                mr={2}
                pointerEvents="none"
                size="sm"
              ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>
                <Text fontSize="xs">{COLUMN_LABELS[column]}</Text>
              </Checkbox.Label></Checkbox.Root>
              {isGstOnly && (
                <Text fontSize="9px" ml="auto" pl={2} opacity={0.55} letterSpacing="0.04em">
                  GST
                </Text>
              )}
            </Flex>
          );
        })}
      </Box>
    </Portal>
  );
};




