import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Sortable from 'sortablejs';
import { useDialogChrome } from './ui/dialog-chrome';
import { useColorModeValue } from './ui/color-mode';
import {
  Button,
  Checkbox,
  VStack,
  Input,
  Text,
  Box,
  Alert,
  Flex,
  Icon,
  Dialog,
  Portal,
  Spinner,
} from '@chakra-ui/react';
import { FileText, RotateCcw } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { FileItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { usePdfDocument } from '../pdf/pdfDocument';
import { LazyPdfThumbnail } from '../pdf/LazyPdfThumbnail';

interface MergePDFDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  preselectedFiles?: string[];
  onFileOperation?: (operation: string, details?: string) => void;
}

const SOURCE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#06b6d4'];
const PAGE_TILE_W = 64;
const PAGE_TILE_H = 82;

type DocStatus = 'loading' | 'ready' | 'error';

interface MergePageItem {
  id: string;
  fileName: string;
  page: number;
  included: boolean;
}

/** Invisible per-source loader — reports its pdf.js document up to the dialog. */
const SourcePdfLoader: React.FC<{
  file: FileItem;
  onStatus: (fileName: string, status: DocStatus, doc?: PDFDocumentProxy) => void;
}> = ({ file, onStatus }) => {
  const { doc, error, isLoading } = usePdfDocument(file.path, { versionTag: file.modified });
  useEffect(() => {
    if (doc) onStatus(file.name, 'ready', doc);
    else if (error) onStatus(file.name, 'error');
    else if (isLoading) onStatus(file.name, 'loading');
  }, [doc, error, isLoading, file.name, onStatus]);
  return null;
};

export const MergePDFDialog: React.FC<MergePDFDialogProps> = ({
  isOpen,
  onClose,
  currentDirectory,
  preselectedFiles = [],
  onFileOperation
}) => {
  // Memoize preselectedFiles to prevent infinite re-renders
  const memoizedPreselectedFiles = useMemo(() => preselectedFiles, [preselectedFiles?.join(',')]);

  const [pdfFiles, setPdfFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Page-level merge state
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [pageItems, setPageItems] = useState<MergePageItem[]>([]);
  const docObjsRef = useRef(new Map<string, PDFDocumentProxy>());
  const pageItemsRef = useRef<MergePageItem[]>([]);
  pageItemsRef.current = pageItems;
  const pageStripRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<Sortable | null>(null);

  const { addLog, setStatus } = useAppContext();
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    inputBg,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();
  const tileBg = useColorModeValue('white', '#1c2233');
  const stripBg = useColorModeValue('#f1f5f9', '#11151f');

  // Load PDF files from current directory
  useEffect(() => {
    if (isOpen && currentDirectory) {
      loadPDFFiles();
    }
  }, [isOpen, currentDirectory]);

  // Set preselected files when dialog opens and preselected files exist
  useEffect(() => {
    if (isOpen && memoizedPreselectedFiles.length > 0) {
      setSelectedFiles(memoizedPreselectedFiles);
    }
  }, [isOpen, memoizedPreselectedFiles]);

  const loadPDFFiles = async () => {
    try {
      setError(null);
      const contents = await (window.electronAPI as any).getDirectoryContents(currentDirectory);
      const pdfs = contents.filter((file: FileItem) =>
        file.type === 'file' && file.name.toLowerCase().endsWith('.pdf')
      );
      setPdfFiles(pdfs);

      if (pdfs.length === 0) {
        setError('No PDF files found in current directory');
      }
    } catch (err) {
      setError('Failed to load PDF files');
      console.error('Error loading PDF files:', err);
    }
  };

  const handleFileToggle = (filename: string) => {
    setSelectedFiles(prev =>
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === pdfFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(pdfFiles.map(f => f.name));
    }
  };

  // ── Page-level merge plumbing ─────────────────────────────
  const selectedFileItems = useMemo(
    () => selectedFiles.map((name) => pdfFiles.find((f) => f.name === name)).filter(Boolean) as FileItem[],
    [selectedFiles, pdfFiles],
  );

  const handleDocStatus = useCallback((fileName: string, status: DocStatus, doc?: PDFDocumentProxy) => {
    if (doc) docObjsRef.current.set(fileName, doc);
    setDocStatus((prev) => (prev[fileName] === status ? prev : { ...prev, [fileName]: status }));
  }, []);

  // Keep pageItems in sync with the selection: drop deselected files' pages,
  // append pages of newly ready files (in selection order). Existing order is preserved.
  useEffect(() => {
    setPageItems((prev) => {
      const selectedSet = new Set(selectedFiles);
      let next = prev.filter((it) => selectedSet.has(it.fileName));
      const present = new Set(next.map((it) => it.fileName));
      let changed = next.length !== prev.length;
      for (const name of selectedFiles) {
        if (present.has(name)) continue;
        const doc = docObjsRef.current.get(name);
        if (docStatus[name] === 'ready' && doc) {
          for (let p = 1; p <= doc.numPages; p++) {
            next.push({ id: `${name}::${p}`, fileName: name, page: p, included: true });
          }
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedFiles, docStatus]);

  const pageMode =
    selectedFiles.length >= 2 && selectedFiles.every((name) => docStatus[name] === 'ready');
  const failedSources = selectedFiles.filter((name) => docStatus[name] === 'error');
  const loadingSources = selectedFiles.filter((name) => !docStatus[name] || docStatus[name] === 'loading');
  const includedCount = pageItems.filter((it) => it.included).length;

  const sourceColor = (fileName: string) =>
    SOURCE_COLORS[Math.max(0, selectedFiles.indexOf(fileName)) % SOURCE_COLORS.length];

  // Drag-reorder over the page strip (same SortableJS pattern as the sidebar pins)
  useEffect(() => {
    const el = pageStripRef.current;
    if (!isOpen || !el || !pageMode || pageItems.length === 0) return;
    sortableRef.current = Sortable.create(el, {
      animation: 150,
      forceFallback: true,
      fallbackTolerance: 5,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const current = [...pageItemsRef.current];
        const [moved] = current.splice(oldIndex, 1);
        current.splice(newIndex, 0, moved);
        setPageItems(current);
      },
    });
    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pageMode, pageItems.length > 0]);

  const togglePage = (id: string) => {
    setPageItems((prev) => prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)));
  };

  const resetPages = () => {
    const next: MergePageItem[] = [];
    for (const name of selectedFiles) {
      const doc = docObjsRef.current.get(name);
      if (docStatus[name] === 'ready' && doc) {
        for (let p = 1; p <= doc.numPages; p++) {
          next.push({ id: `${name}::${p}`, fileName: name, page: p, included: true });
        }
      }
    }
    setPageItems(next);
  };

  const pagesModified = useMemo(() => {
    if (!pageMode) return false;
    if (pageItems.some((it) => !it.included)) return true;
    // Order differs from "all pages, in selection order"?
    let i = 0;
    for (const name of selectedFiles) {
      const doc = docObjsRef.current.get(name);
      if (!doc) return false;
      for (let p = 1; p <= doc.numPages; p++) {
        if (pageItems[i]?.fileName !== name || pageItems[i]?.page !== p) return true;
        i++;
      }
    }
    return i !== pageItems.length;
  }, [pageMode, pageItems, selectedFiles]);

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      setError('Please select at least 2 PDF files to merge');
      return;
    }

    if (!outputFilename.trim()) {
      setError('Please enter an output filename');
      return;
    }

    if (pageMode && includedCount === 0) {
      setError('All pages are excluded — include at least one page');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add .pdf extension if not present
      const filename = outputFilename.endsWith('.pdf')
        ? outputFilename
        : `${outputFilename}.pdf`;

      const payload: Record<string, unknown> = {
        files: selectedFiles,
        outputFilename: filename,
      };
      if (pageMode) {
        payload.pages = pageItems
          .filter((it) => it.included)
          .map((it) => ({ file: it.fileName, page: it.page }));
      }

      const result = await (window.electronAPI as any).executeCommand('merge_pdfs', currentDirectory, payload);

      if (result.success) {
        addLog(result.message, 'response');
        setStatus('PDFs merged successfully', 'success');

        // Log file operation for task timer
        if (onFileOperation) {
          onFileOperation('Merge PDFs', `Merged ${selectedFiles.length} PDFs into ${filename}`);
        }

        onClose();
        // Reset state for next use
        setSelectedFiles([]);
        setOutputFilename('');
        setPageItems([]);
        setDocStatus({});
      } else {
        addLog(result.message || 'Failed to merge PDFs', 'error');
        setStatus('PDF merge failed', 'error');
        setError(result.message || 'Failed to merge PDFs');
      }
    } catch (err) {
      setError('Error during PDF merge operation');
      console.error('Merge PDF error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setOutputFilename('');
    setError(null);
    setPageItems([]);
    setDocStatus({});
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} placement='center' onOpenChange={e => {
      if (!e.open) {
        handleClose();
      }
    }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            borderRadius={0}
            boxShadow="xl"
            display="flex"
            flexDirection="column"
            overflow="hidden"
            w="660px"
            maxW="660px"
          >
            <Dialog.Header
              bg={titleBarBg}
              borderBottomWidth="1px"
              borderColor={borderColor}
              borderRadius={0}
              py={1.5}
              px={3}
              minH="31px"
            >
              <Flex align="center" gap={2}>
                <Icon color="red.400" asChild><FileText /></Icon>
                <Text fontSize="sm" fontWeight="600" color={textColor}>
                  Merge PDF Files
                </Text>
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body overflowY="auto" overflowX="hidden" px={3} py={3}>
              {/* Invisible loaders — one pdf.js document per selected source */}
              {isOpen && selectedFileItems.map((file) => (
                <SourcePdfLoader key={file.path} file={file} onStatus={handleDocStatus} />
              ))}
              {error && (
                <Alert.Root status="error" mb={2}>
                  <Alert.Indicator />
                  {error}
                </Alert.Root>
              )}
              {pdfFiles.length > 0 && (
                <VStack align="stretch" gap={2}>
                  <Box>
                    <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                      Select PDF files to merge:
                    </Text>
                    <Box
                      h="170px"
                      overflowY="auto"
                      overflowX="hidden"
                      borderWidth="1px"
                      borderColor={borderColor}
                      borderRadius={0}
                      w="100%"
                    >
                      <Flex
                        position="sticky"
                        top={0}
                        bg={bgColor}
                        zIndex={1}
                        justify="space-between"
                        align="center"
                        px={2}
                        py={1}
                        borderBottomWidth="1px"
                        borderColor={borderColor}
                      >
                        <Text fontSize="xs" color={secondaryTextColor}>
                          {selectedFiles.length} of {pdfFiles.length} files selected
                        </Text>
                        <Button size="2xs" variant="ghost" onClick={handleSelectAll} flexShrink={0}>
                          {selectedFiles.length === pdfFiles.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      </Flex>
                      <VStack align="stretch" gap={0} px={2} py={1}>
                        {pdfFiles.map((file) => {
                          const selIndex = selectedFiles.indexOf(file.name);
                          return (
                            <Checkbox.Root
                              key={file.name}
                              checked={selIndex !== -1}
                              onCheckedChange={() => handleFileToggle(file.name)}
                              py={0.5}
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                              <Checkbox.Label>
                                <Flex align="center" gap={1}>
                                  {selIndex !== -1 ? (
                                    <Box w="8px" h="8px" borderRadius="full" bg={sourceColor(file.name)} flexShrink={0} />
                                  ) : (
                                    <Icon color="red.400" boxSize={3} asChild><FileText /></Icon>
                                  )}
                                  <Text fontSize="xs">{file.name}</Text>
                                </Flex>
                              </Checkbox.Label>
                            </Checkbox.Root>
                          );
                        })}
                      </VStack>
                    </Box>
                  </Box>

                  {/* Page strip: include / exclude / reorder pages across the selected PDFs */}
                  {selectedFiles.length >= 2 && (
                    <Box>
                      <Flex align="center" gap={2} mb={1}>
                        <Text fontSize="xs" fontWeight="600" color={textColor}>
                          Pages ({includedCount} of {pageItems.length} included)
                        </Text>
                        <Text fontSize="10px" color={secondaryTextColor}>
                          drag to reorder · click to include/exclude
                        </Text>
                        <Box flex={1} />
                        <Button size="2xs" variant="ghost" onClick={resetPages} disabled={!pagesModified}>
                          <RotateCcw size={11} style={{ marginRight: 3 }} />
                          Reset pages
                        </Button>
                      </Flex>
                      {loadingSources.length > 0 && (
                        <Flex align="center" gap={2} py={2}>
                          <Spinner size="xs" color="blue.400" />
                          <Text fontSize="xs" color={secondaryTextColor}>
                            Loading pages…
                          </Text>
                        </Flex>
                      )}
                      {failedSources.length > 0 && (
                        <Text fontSize="xs" color="orange.400" py={1}>
                          Couldn't read pages of {failedSources.join(', ')} — whole files will be merged in
                          selection order instead.
                        </Text>
                      )}
                      {pageMode && (
                        <Box
                          maxH="190px"
                          overflowY="auto"
                          borderWidth="1px"
                          borderColor={borderColor}
                          borderRadius="md"
                          bg={stripBg}
                          p={2}
                        >
                          <Flex ref={pageStripRef} wrap="wrap" gap={1.5} align="flex-start">
                            {pageItems.map((item) => {
                              const doc = docObjsRef.current.get(item.fileName);
                              const color = sourceColor(item.fileName);
                              return (
                                <Box
                                  key={item.id}
                                  w={`${PAGE_TILE_W}px`}
                                  cursor="grab"
                                  userSelect="none"
                                  onClick={() => togglePage(item.id)}
                                  title={`${item.fileName} — page ${item.page}${item.included ? '' : ' (excluded)'}`}
                                >
                                  <Flex
                                    h={`${PAGE_TILE_H}px`}
                                    align="center"
                                    justify="center"
                                    bg={tileBg}
                                    borderRadius="4px"
                                    borderWidth="1px"
                                    borderColor={item.included ? borderColor : 'red.400'}
                                    borderStyle={item.included ? 'solid' : 'dashed'}
                                    position="relative"
                                    opacity={item.included ? 1 : 0.35}
                                    overflow="hidden"
                                  >
                                    <Box position="absolute" top={0} left={0} right={0} h="3px" bg={color} />
                                    {doc && (
                                      <LazyPdfThumbnail
                                        doc={doc}
                                        pageNumber={item.page}
                                        rootRef={pageStripRef}
                                        fitWidth={PAGE_TILE_W - 8}
                                        fitHeight={PAGE_TILE_H - 12}
                                      />
                                    )}
                                  </Flex>
                                  <Text fontSize="9px" color={secondaryTextColor} textAlign="center" mt="1px" lineClamp={1}>
                                    p.{item.page}
                                  </Text>
                                </Box>
                              );
                            })}
                          </Flex>
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box>
                    <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                      Output filename:
                    </Text>
                    <Input
                      size="xs"
                      value={outputFilename}
                      onChange={(e) => setOutputFilename(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Enter filename (e.g., merged-document)"
                      autoFocus
                      bg={inputBg}
                      borderColor={borderColor}
                      borderRadius="md"
                    />
                    <Text fontSize="xs" color={secondaryTextColor} mt={1}>
                      .pdf extension will be added automatically if not present
                    </Text>
                  </Box>
                </VStack>
              )}
            </Dialog.Body>
            <Dialog.Footer px={3} py={2} borderTopWidth="1px" borderColor={borderColor}>
              <Button size="xs" variant="outline" borderRadius="md" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="xs"
                borderRadius="md"
                colorPalette="blue"
                onClick={handleMerge}
                disabled={isLoading || selectedFiles.length < 2 || !outputFilename.trim() || (pageMode && includedCount === 0)}
              >
                {pageMode && pagesModified ? `Merge ${includedCount} Pages` : 'Merge PDFs'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
