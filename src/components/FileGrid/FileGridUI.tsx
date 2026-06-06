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
  Separator,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
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
  ChevronRight,
  FilePlus2,
  Archive,
  Mail,
  Info,
  Image as ImageIcon,
  Star,
  Sparkles,
  Layers,
  ArrowRightLeft,
  Type,
  X,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  FileEdit,
  Link2,
  CloudUpload,
  Terminal,
} from 'lucide-react'
import type { FileItem } from '../../types'
import { useFileGridNavigationRefs } from '../../context/AppContext'
import { joinPath, normalizePath } from '../../utils/path'
import { docuFramePalette } from '../../docuFrameColors'

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
  handleMenuAction: (action: string) => void;
  handlePaste: () => void;
  handleCloseContextMenu: () => void;
  quickAccessPaths: string[];
  setTemplates: (templates: Array<{ name: string; path: string }>) => void;
  setTemplateSubmenuPosition: (position: { x: number; y: number } | null) => void;
  setTemplateSubmenuOpen: (open: boolean) => void;
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
  setTemplates,
  setTemplateSubmenuPosition,
  setTemplateSubmenuOpen,
  setMoveToFiles,
  setIsMoveToDialogOpen,
}) => {
  const { addressBarJumpRef } = useFileGridNavigationRefs();
  const menuRef = useRef<HTMLDivElement>(null);
  const boxBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderCol = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const hoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const separatorColor = useColorModeValue(docuFramePalette.light.tableBorder, docuFramePalette.dark.tableBorder);
  const tooltipBg = useColorModeValue('gray.800', 'gray.200');
  const tooltipColor = useColorModeValue('white', 'gray.800');
  const [latestFileName, setLatestFileName] = useState<string | null>(null);

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

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!contextMenu.isOpen || !el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = contextMenu.position.x;
    let y = contextMenu.position.y;
    if (x + rect.width > vw - 4) x = contextMenu.position.x - rect.width;
    if (y + rect.height > vh - 4) y = contextMenu.position.y - rect.height;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';
  });

  if (!contextMenu.isOpen || !contextMenu.fileItem) return null;

  const selectedPDFs = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.pdf'));
  const showMergePDFs = selectedPDFs.length > 1;
  const fileName = contextMenu.fileItem.name.toLowerCase();
  const isZipFile = fileName.endsWith('.zip');
  const isEmlFile = fileName.endsWith('.eml');
  const selectedZipFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.zip'));
  const selectedEmlFiles = selectedFiles.filter(filename => filename.toLowerCase().endsWith('.eml'));
  const showExtractZips = selectedZipFiles.length > 1 || (isZipFile && selectedZipFiles.length >= 1);
  const showExtractEmls = selectedEmlFiles.length > 1 || (isEmlFile && selectedEmlFiles.length >= 1);
  const isFile = contextMenu.fileItem.type === 'file';
  const isFolder = contextMenu.fileItem.type === 'folder';
  const isSingleFile = selectedFiles.length === 1;
  const hasFileSpecific = fileName.endsWith('.pdf') || showMergePDFs || showExtractZips || showExtractEmls;

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
  const iconStyle = { marginRight: '6px', flexShrink: 0 } as const;
  const rowProps = { align: 'center' as const, px: 2.5, py: '3px', cursor: 'pointer' as const, _hover: { bg: hoverBg } };

  return (
    <Box
      ref={menuRef}
      position="fixed"
      top={contextMenu.position.y}
      left={contextMenu.position.x}
      opacity={0}
      bg={boxBg}
      borderRadius="0"
      zIndex="modal"
      minW="170px"
      maxW="260px"
      border="1px solid"
      borderColor={borderCol}
    >
      <Box py={0.5}>
        {/* ── Open ── */}
        <Flex {...rowProps} onClick={() => handleMenuAction('open')}>
          <ExternalLink size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Open</Text>
        </Flex>
        {isFile && isSingleFile && (
          <Flex {...rowProps} onClick={() => handleMenuAction('open_with_notepad')}>
            <FileEdit size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Open with Notepad</Text>
          </Flex>
        )}

        {/* ── Edit / Rename Group ── */}
        <Separator borderColor={separatorColor} my={0.5} />
        {isSingleFile && (
          <Flex {...rowProps} onClick={() => handleMenuAction('rename')}>
            <Edit2 size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Rename</Text>
          </Flex>
        )}
        {isFile && isSingleFile && (
          <>
            <Flex {...rowProps} onClick={() => handleMenuAction('smart_rename')}>
              <Sparkles size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Smart Rename</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => handleMenuAction('proper_case_rename')}>
              <Type size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Proper Case</Text>
            </Flex>
            <Tooltip
              content={latestFileName ? `${latestFileName}` : 'Loading...'}
              showArrow
              openDelay={300}
              positioning={{ placement: "right" }}
              contentProps={{ bg: tooltipBg, color: tooltipColor }}
            >
              <Flex {...rowProps} onClick={() => handleMenuAction('replace_with_latest')}>
                <ArrowRightLeft size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Replace with Latest File</Text>
              </Flex>
            </Tooltip>
          </>
        )}

        {/* ── Index Prefix Group (files only) ── */}
        {isFile && (
          <>
            <Separator borderColor={separatorColor} my={0.5} />
            <Flex {...rowProps} onClick={() => handleMenuAction('assign_prefix')}>
              <Layers size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Manage Index Prefix</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => handleMenuAction('remove_prefix')}>
              <X size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Remove Prefix</Text>
            </Flex>
          </>
        )}

        {/* ── Folder Actions (folders only) ── */}
        {isFolder && (
          <>
            <Separator borderColor={separatorColor} my={0.5} />
            {quickAccessPaths.includes(contextMenu.fileItem.path) ? (
              <Flex {...rowProps} onClick={() => handleMenuAction('unpin_quick_access')}>
                <Star size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Unpin from Quick Access</Text>
              </Flex>
            ) : (
              <Flex {...rowProps} onClick={() => handleMenuAction('pin_quick_access')}>
                <Star size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Pin to Quick Access</Text>
              </Flex>
            )}
            <Flex
              {...rowProps}
              onClick={() => handleMenuAction('open_new_tab')}
            >
              <ExternalLink size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Open folder in new tab</Text>
            </Flex>
            <Flex
              {...rowProps}
              position="relative"
              onMouseEnter={async () => {
                try {
                  const result = await (window.electronAPI as any).getWorkpaperTemplates();
                  if (result.success) {
                    setTemplates(result.templates || []);
                    setTemplateSubmenuPosition({ x: contextMenu.position.x + 170, y: contextMenu.position.y });
                    setTemplateSubmenuOpen(true);
                  }
                } catch (error) {
                  console.error('Error loading templates:', error);
                }
              }}
            >
              <FileSpreadsheet size={iconSz} style={iconStyle} />
              <Text fontSize="xs">New Template</Text>
              <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
            </Flex>
          </>
        )}

        {/* ── File-Specific Actions ── */}
        {hasFileSpecific && (
          <>
            <Separator borderColor={separatorColor} my={0.5} />
            {fileName.endsWith('.pdf') && (
              <Flex {...rowProps} onClick={() => handleMenuAction('extract_text')}>
                <FileText size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Extract Text</Text>
              </Flex>
            )}
            {fileName.endsWith('.pdf') && selectedPDFs.length >= 1 && (
              <Flex {...rowProps} onClick={() => handleMenuAction('upload_to_vaults')}>
                <CloudUpload size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Upload to Vaults Repo</Text>
              </Flex>
            )}
            {showMergePDFs && (
              <Flex {...rowProps} onClick={() => handleMenuAction('merge_pdfs')}>
                <FilePlus2 size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Merge PDFs ({selectedPDFs.length})</Text>
              </Flex>
            )}
            {showExtractZips && (
              <Flex {...rowProps} onClick={() => handleMenuAction('extract_zip')}>
                <Archive size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Extract ZIP{selectedZipFiles.length > 1 ? `s (${selectedZipFiles.length})` : ''}</Text>
              </Flex>
            )}
            {showExtractEmls && (
              <Flex {...rowProps} onClick={() => handleMenuAction('extract_eml')}>
                <Mail size={iconSz} style={iconStyle} />
                <Text fontSize="xs">Extract Attachments{selectedEmlFiles.length > 1 ? ` (${selectedEmlFiles.length})` : ''}</Text>
              </Flex>
            )}
          </>
        )}

        {/* ── Clipboard ── */}
        <Separator borderColor={separatorColor} my={0.5} />
        <Flex {...rowProps} onClick={() => { handleMenuAction('copy_path'); handleCloseContextMenu(); }}>
          <Link2 size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Copy Path</Text>
        </Flex>
        {isFile && (
          <Flex {...rowProps} onClick={() => {
            const filesToMove = getClipboardFiles();
            setMoveToFiles(filesToMove);
            addressBarJumpRef.current?.close();
            setIsMoveToDialogOpen(true);
            handleCloseContextMenu();
          }}>
            <ArrowRightLeft size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Move to...</Text>
          </Flex>
        )}
        <Flex {...rowProps} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'cut' }); handleCloseContextMenu(); }}>
          <Scissors size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Cut</Text>
        </Flex>
        <Flex {...rowProps} onClick={() => { setClipboard({ files: getClipboardFiles(), operation: 'copy' }); handleCloseContextMenu(); }}>
          <Copy size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Copy</Text>
        </Flex>
        <Flex {...rowProps} onClick={() => { handlePaste(); handleCloseContextMenu(); }} opacity={clipboard.files.length > 0 ? 1 : 0.5} pointerEvents={clipboard.files.length > 0 ? 'auto' : 'none'}>
          <FileSymlink size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Paste</Text>
        </Flex>

        {/* ── Destructive & Info ── */}
        <Separator borderColor={separatorColor} my={0.5} />
        <Flex {...rowProps} onClick={() => handleMenuAction('delete')}>
          <Trash2 size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Delete</Text>
        </Flex>
        <Flex {...rowProps} onClick={() => handleMenuAction('properties')}>
          <Info size={iconSz} style={iconStyle} />
          <Text fontSize="xs">Properties</Text>
        </Flex>
      </Box>
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
}) => {
  const boxBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderCol = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const hoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const separatorColor = useColorModeValue(docuFramePalette.light.tableBorder, docuFramePalette.dark.tableBorder);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [newSubmenuOpen, setNewSubmenuOpen] = useState(false);
  const [newSubmenuPos, setNewSubmenuPos] = useState<{ x: number; y?: number; bottom?: number; flowUp: boolean }>({ x: 0, flowUp: false });
  const [templates, setTemplates] = useState<Array<{ name: string; path: string }>>([]);

  const SUBMENU_EST_HEIGHT = 420;
  const iconSz = 14;
  const iconStyle = { marginRight: '6px', flexShrink: 0 } as const;
  const rowProps = { align: 'center' as const, px: 2.5, py: '3px', cursor: 'pointer' as const, _hover: { bg: hoverBg } };

  useEffect(() => {
    if (!blankContextMenu.isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inMenu = menuRef.current?.contains(target);
      const inSubmenu = submenuRef.current?.contains(target);
      if (!inMenu && !inSubmenu) {
        setBlankContextMenu({ ...blankContextMenu, isOpen: false });
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [blankContextMenu, setBlankContextMenu]);

  useEffect(() => {
    if (!blankContextMenu.isOpen) setNewSubmenuOpen(false);
  }, [blankContextMenu.isOpen]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!blankContextMenu.isOpen || !el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = blankContextMenu.position.x;
    let y = blankContextMenu.position.y;
    if (x + rect.width > vw - 4) x = blankContextMenu.position.x - rect.width;
    if (y + rect.height > vh - 4) y = blankContextMenu.position.y - rect.height;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';
  });

  if (!blankContextMenu.isOpen) return null;
  return (
    <>
      <Box ref={menuRef} position="fixed" top={blankContextMenu.position.y} left={blankContextMenu.position.x} opacity={0} bg={boxBg} borderRadius="0" zIndex="modal" minW="170px" maxW="240px" border="1px solid" borderColor={borderCol}>
        <Box py={0.5}>
          <Flex
            {...rowProps}
            onMouseEnter={async (e) => {
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const flowUp = rect.top + SUBMENU_EST_HEIGHT > window.innerHeight;
              const flowLeft = rect.right + 180 > window.innerWidth;
              setNewSubmenuPos(
                flowUp
                  ? { x: flowLeft ? rect.left - 180 : rect.right + 2, bottom: window.innerHeight - rect.bottom + 3, flowUp: true }
                  : { x: flowLeft ? rect.left - 180 : rect.right + 1, y: rect.top - 5, flowUp: false }
              );
              setNewSubmenuOpen(true);
              try {
                const result = await (window.electronAPI as any).getWorkpaperTemplates();
                if (result.success) setTemplates(result.templates || []);
              } catch {
                setTemplates([]);
              }
            }}
          >
            <FolderPlus size={iconSz} style={iconStyle} />
            <Text fontSize="xs">New</Text>
            <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
          </Flex>
          <Separator borderColor={separatorColor} my={0.5} />
          <Flex {...rowProps} onClick={() => { handlePaste(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }} opacity={clipboard.files.length > 0 ? 1 : 0.5} pointerEvents={clipboard.files.length > 0 ? 'auto' : 'none'}>
            <FileSymlink size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Paste</Text>
          </Flex>
          <Flex {...rowProps} onClick={() => { onPasteImage(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}>
            <ImageIcon size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Paste Image</Text>
          </Flex>
          <Separator borderColor={separatorColor} my={0.5} />
          <Flex {...rowProps} onClick={() => { onCopyPath(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}>
            <Link2 size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Copy Path</Text>
          </Flex>
          <Flex {...rowProps} onClick={() => { onOpenPowerShell(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); }}>
            <Terminal size={iconSz} style={iconStyle} />
            <Text fontSize="xs">Open PowerShell</Text>
          </Flex>
        </Box>
      </Box>
      {newSubmenuOpen && (
        <Box
          ref={submenuRef}
          position="fixed"
          {...(newSubmenuPos.flowUp
            ? { bottom: newSubmenuPos.bottom, left: newSubmenuPos.x }
            : { top: newSubmenuPos.y, left: newSubmenuPos.x })}
          bg={boxBg}
          borderRadius="0"
          zIndex="modal"
          minW="170px"
          maxW="240px"
          border="1px solid"
          borderColor={borderCol}
          onMouseLeave={() => setNewSubmenuOpen(false)}
        >
          <Box py={0.5}>
            <Flex {...rowProps} onClick={() => { onCreateFolder(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); setNewSubmenuOpen(false); }}>
              <Folder size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Folder</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => { onCreateTextFile(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); setNewSubmenuOpen(false); }}>
              <FileText size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Text File</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => { onCreateSpreadsheet(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); setNewSubmenuOpen(false); }}>
              <FileSpreadsheet size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Excel File</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => { onCreateWordDoc(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); setNewSubmenuOpen(false); }}>
              <FileEdit size={iconSz} style={iconStyle} />
              <Text fontSize="xs">Word Document</Text>
            </Flex>
            <Flex {...rowProps} onClick={() => { onCreateShortcut(); setBlankContextMenu({ ...blankContextMenu, isOpen: false }); setNewSubmenuOpen(false); }}>
              <Link2 size={iconSz} style={iconStyle} />
              <Text fontSize="xs">New Shortcut</Text>
            </Flex>
            {templates.length > 0 && (
              <>
                <Separator borderColor={separatorColor} my={0.5} />
                {templates.map((template) => (
                  <Flex
                    key={template.path}
                    {...rowProps}
                    h="22px"
                    minH="22px"
                    maxH="22px"
                    overflow="hidden"
                    align="center"
                    flexWrap="nowrap"
                    onClick={() => {
                      onCreateFromTemplate(template.path, template.name);
                      setBlankContextMenu({ ...blankContextMenu, isOpen: false });
                      setNewSubmenuOpen(false);
                    }}
                  >
                    {/\.docx?$/i.test(template.name) ? <FileEdit size={12} style={iconStyle} /> : /\.xlsx?$/i.test(template.name) ? <FileSpreadsheet size={12} style={iconStyle} /> : <FileText size={12} style={iconStyle} />}
                    <Text fontSize="xs" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{template.name}</Text>
                  </Flex>
                ))}
              </>
            )}
          </Box>
        </Box>
      )}
    </>
  );
};

// TemplateSubmenu Component
export interface TemplateSubmenuProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  templates: Array<{ name: string; path: string }>;
  folderPath: string;
  onClose: () => void;
  onCreateFromTemplate: (templatePath: string, templateName: string) => void;
}

export const TemplateSubmenu: React.FC<TemplateSubmenuProps> = ({
  isOpen,
  position,
  templates,
  folderPath,
  onCreateFromTemplate,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const boxBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const borderCol = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const hoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const subtextColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!isOpen || !el || !position) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = position.x;
    let y = position.y;
    if (x + rect.width > vw - 4) x = position.x - rect.width - 170;
    if (y + rect.height > vh - 4) y = vh - rect.height - 4;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';
  });

  if (!isOpen || !position) return null;

  return (
    <Box
      ref={menuRef}
      position="fixed"
      top={position.y}
      left={position.x}
      opacity={0}
      bg={boxBg}
      borderRadius="0"
      zIndex="modal"
      minW="170px"
      maxW="240px"
      border="1px solid"
      borderColor={borderCol}
      onMouseLeave={onClose}
    >
      <Box py={0.5}>
        {templates.length === 0 ? (
          <Flex align="center" px={2.5} py="3px">
            <Text fontSize="xs" color={subtextColor}>No templates</Text>
          </Flex>
        ) : (
          templates.map((template) => (
            <Flex
              key={template.path}
              align="center"
              px={2.5}
              cursor="pointer"
              _hover={{ bg: hoverBg }}
              h="22px"
              minH="22px"
              maxH="22px"
              overflow="hidden"
              flexWrap="nowrap"
              onClick={() => {
                onCreateFromTemplate(template.path, template.name);
                onClose();
              }}
            >
              {/\.docx?$/i.test(template.name) ? <FileEdit size={12} style={{ marginRight: '6px', flexShrink: 0 }} /> : /\.xlsx?$/i.test(template.name) ? <FileSpreadsheet size={12} style={{ marginRight: '6px', flexShrink: 0 }} /> : <FileText size={12} style={{ marginRight: '6px', flexShrink: 0 }} />}
              <Text fontSize="xs" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">{template.name}</Text>
            </Flex>
          ))
        )}
      </Box>
    </Box>
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
  columnVisibility: {
    name: boolean;
    size: boolean;
    modified: boolean;
    type: boolean;
  };
  toggleColumnVisibility: (column: string) => void;
  closeHeaderContextMenu: () => void;
}

export const HeaderContextMenu: React.FC<HeaderContextMenuProps> = ({
  headerContextMenu,
  columnVisibility,
  toggleColumnVisibility,
  closeHeaderContextMenu,
}) => {
  const menuBg = useColorModeValue(docuFramePalette.light.listRow, docuFramePalette.dark.tabStrip);
  const menuBorderColor = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const menuHoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
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
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = headerContextMenu.position.x;
    let y = headerContextMenu.position.y;
    if (x + rect.width > vw - 4) x = headerContextMenu.position.x - rect.width;
    if (y + rect.height > vh - 4) y = headerContextMenu.position.y - rect.height;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = '1';
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
        borderRadius="0"
        minW="150px"
        py={0.5}
      >
        {['name', 'size', 'modified', 'type'].map((column) => {
          const columnLabels: Record<string, string> = {
            name: 'Name',
            size: 'Size',
            modified: 'Modified',
            type: 'Type'
          };
          const isChecked = columnVisibility[column as keyof typeof columnVisibility];
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
                <Text fontSize="xs">{columnLabels[column]}</Text>
              </Checkbox.Label></Checkbox.Root>
            </Flex>
          );
        })}
      </Box>
    </Portal>
  );
};




