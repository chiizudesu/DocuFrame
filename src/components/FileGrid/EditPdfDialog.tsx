import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import { useColorModeValue } from '../ui/color-mode';
import { useDialogChrome } from '../ui/dialog-chrome';
import { Box, Button, Dialog, Flex, HStack, IconButton, Input, Portal, Spinner, Text, VStack } from '@chakra-ui/react';
import { RotateCcw, Trash2, Undo2 } from 'lucide-react';
import type { FileItem } from '../../types';
import { usePdfDocument } from '../../pdf/pdfDocument';
import { PdfPageCanvas } from '../../pdf/PdfPageCanvas';
import { LazyPdfThumbnail } from '../../pdf/LazyPdfThumbnail';
import { getParentPath } from '../../utils/path';

export interface EditPdfOptions {
  /** Original 1-based page numbers in their new order (deleted pages absent) */
  pages: number[];
  /** Output base name without extension; equal to the original stem = overwrite */
  outputName: string;
}

export interface EditPdfDialogProps {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
  onSave: (file: FileItem, options: EditPdfOptions) => Promise<void>;
}

const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const TILE_W = 92;
const TILE_H = 118;

/** Reorder (drag) and delete pages of a PDF, then save over the original or as a new file. */
export const EditPdfDialog: React.FC<EditPdfDialogProps> = ({ open, file, onClose, onSave }) => {
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg, textColor } = useDialogChrome();
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const gridBg = useColorModeValue('#f1f5f9', '#11151f');
  const tileBg = useColorModeValue('white', '#1c2233');

  const [order, setOrder] = useState<number[]>([]);
  const [removed, setRemoved] = useState<number[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [outputName, setOutputName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [peekPage, setPeekPage] = useState<number | null>(null);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const sortableContainerRef = useRef<HTMLDivElement>(null);
  const sortableRef = useRef<Sortable | null>(null);
  const orderRef = useRef<number[]>([]);
  orderRef.current = order;
  const selectedPagesRef = useRef<Set<number>>(new Set());
  selectedPagesRef.current = selectedPages;
  /** Anchor for Shift+click range selection (position-independent page number) */
  const selectionAnchorRef = useRef<number | null>(null);
  /** Suppress the stray click browsers fire right after a drag ends */
  const lastDragEndRef = useRef(0);

  const stem = useMemo(() => (file ? file.name.replace(/\.pdf$/i, '') : ''), [file?.name]);

  const { doc, error: docError, isLoading } = usePdfDocument(open && file ? file.path : null, {
    versionTag: file?.modified,
  });
  const pageCount = doc?.numPages ?? 0;

  // Reset when the dialog opens / the document arrives
  useEffect(() => {
    if (!open || !file) return;
    setOrder([]);
    setRemoved([]);
    setSelectedPages(new Set());
    selectionAnchorRef.current = null;
    setOutputName(file.name.replace(/\.pdf$/i, ''));
    setError(null);
    setPeekPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.path]);
  useEffect(() => {
    if (!open || !pageCount) return;
    setOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
    setRemoved([]);
    setSelectedPages(new Set());
  }, [open, pageCount]);

  // Existing names — advisory conflict hint for save-as-new
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    (async () => {
      try {
        const parent = getParentPath(file.path);
        if (!parent) return;
        const contents = await (window.electronAPI as any).getDirectoryContents(parent);
        const items: FileItem[] = Array.isArray(contents) ? contents : contents?.files ?? [];
        if (!cancelled) setExistingNames(new Set(items.map((f) => String(f.name).toLowerCase())));
      } catch {
        /* hints only */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.path]);

  // SortableJS drag-reorder over the tile container (same pattern as the sidebar pins)
  useEffect(() => {
    const el = sortableContainerRef.current;
    if (!open || !el || order.length === 0) return;
    sortableRef.current = Sortable.create(el, {
      animation: 150,
      forceFallback: true,
      fallbackTolerance: 5,
      ghostClass: 'sortable-ghost',
      filter: '.pdf-tile-no-drag',
      preventOnFilter: false,
      onEnd: (evt) => {
        lastDragEndRef.current = Date.now();
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const current = [...orderRef.current];
        const draggedPage = current[oldIndex];
        const selected = selectedPagesRef.current;
        if (selected.has(draggedPage) && selected.size > 1) {
          // Group move: all selected pages travel together (keeping their relative order)
          // to where the dragged tile landed.
          const after = [...current];
          const [d] = after.splice(oldIndex, 1);
          after.splice(newIndex, 0, d);
          const group = current.filter((p) => selected.has(p));
          const rest = current.filter((p) => !selected.has(p));
          const insertAt = after.slice(0, newIndex).filter((p) => !selected.has(p)).length;
          const next = [...rest];
          next.splice(insertAt, 0, ...group);
          setOrder(next);
        } else {
          const [moved] = current.splice(oldIndex, 1);
          current.splice(newIndex, 0, moved);
          setOrder(current);
        }
      },
    });
    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
    // Re-init only on open/page-structure changes — not on every reorder
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.length > 0]);

  const handleTileClick = (page: number, e: React.MouseEvent) => {
    if (Date.now() - lastDragEndRef.current < 150) return;
    if (e.shiftKey && selectionAnchorRef.current !== null && order.includes(selectionAnchorRef.current)) {
      const from = order.indexOf(selectionAnchorRef.current);
      const to = order.indexOf(page);
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      const range = order.slice(lo, hi + 1);
      setSelectedPages((prev) => {
        const next = e.ctrlKey || e.metaKey ? new Set(prev) : new Set<number>();
        for (const p of range) next.add(p);
        return next;
      });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedPages((prev) => {
        const next = new Set(prev);
        if (next.has(page)) next.delete(page);
        else next.add(page);
        return next;
      });
    } else {
      setSelectedPages((prev) => (prev.size === 1 && prev.has(page) ? new Set() : new Set([page])));
    }
    selectionAnchorRef.current = page;
  };

  const removeSelectedPages = () => {
    const selected = selectedPagesRef.current;
    if (selected.size === 0) return;
    setOrder((prev) => prev.filter((p) => !selected.has(p)));
    setRemoved((prev) => [...prev, ...selected].sort((a, b) => a - b));
    setSelectedPages(new Set());
    selectionAnchorRef.current = null;
  };

  // Del / Backspace removes the selected pages while the dialog is open
  // (capture phase so the grid's global backspace navigation never fires behind the modal)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      removeSelectedPages();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const restorePage = (page: number) => {
    setRemoved((prev) => prev.filter((p) => p !== page));
    setOrder((prev) => {
      // Re-insert keeping original-number order relative to the current arrangement
      const at = prev.findIndex((p) => p > page);
      const next = [...prev];
      next.splice(at === -1 ? next.length : at, 0, page);
      return next;
    });
  };

  const resetChanges = () => {
    setOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
    setRemoved([]);
    setSelectedPages(new Set());
    selectionAnchorRef.current = null;
    setOutputName(stem);
    setError(null);
  };

  const isIdentityOrder = order.length === pageCount && order.every((p, i) => p === i + 1);
  const trimmedName = outputName.trim();
  const isOverwrite = trimmedName.toLowerCase() === stem.toLowerCase();
  const hasPageChanges = pageCount > 0 && (!isIdentityOrder || removed.length > 0);
  const hasChanges = hasPageChanges || (!isOverwrite && trimmedName.length > 0);

  const nameIssue = !trimmedName
    ? 'Name is empty'
    : INVALID_NAME_CHARS.test(trimmedName)
      ? 'Name contains invalid characters (< > : " / \\ | ? *)'
      : trimmedName.length > 150
        ? 'Name is too long'
        : null;
  const conflict = !nameIssue && !isOverwrite && existingNames.has(`${trimmedName.toLowerCase()}.pdf`);

  const canSave = hasChanges && !nameIssue && order.length > 0 && !isSaving;

  const handleSave = async () => {
    if (!file || !canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(file, { pages: order, outputName: trimmedName });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <Dialog.Root
      open={open}
      size="lg"
      placement="center"
      onOpenChange={(e) => {
        if (!e.open && !isSaving) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderWidth="1px" borderColor={borderColor} maxW="780px" position="relative">
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor} py={3}>
              <Text fontSize="md" fontWeight="600" color={textColor}>
                Edit PDF
              </Text>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body py={3}>
              <VStack gap={3} align="stretch">
                <Flex align="center" gap={3} wrap="wrap">
                  <Text fontSize="sm" color={mutedColor} lineClamp={1} title={file?.name} flex={1} minW="200px">
                    {file?.name}
                    {pageCount
                      ? ` — ${order.length} of ${pageCount} page${pageCount === 1 ? '' : 's'} kept`
                      : ''}
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={removeSelectedPages}
                    disabled={selectedPages.size === 0}
                    title="Remove selected pages (Del)"
                  >
                    <Trash2 size={12} style={{ marginRight: 4 }} />
                    Remove{selectedPages.size > 0 ? ` (${selectedPages.size})` : ''}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={resetChanges} disabled={!hasChanges || !pageCount}>
                    <RotateCcw size={12} style={{ marginRight: 4 }} />
                    Reset
                  </Button>
                </Flex>
                <Text fontSize="11px" color={mutedColor}>
                  Click / Ctrl+click / Shift+click to select · Del removes selected · drag moves the whole
                  selection · double-click to enlarge
                </Text>

                {/* Sortable thumbnail grid */}
                <Box
                  ref={gridScrollRef}
                  maxH="320px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="md"
                  bg={gridBg}
                  p={2}
                >
                  {!doc && (
                    <Flex h="120px" align="center" justify="center" gap={2}>
                      {isLoading && <Spinner size="sm" color="blue.400" />}
                      <Text fontSize="xs" color={mutedColor} whiteSpace="pre-wrap" textAlign="center">
                        {docError ? `Could not render pages (${docError})` : 'Loading pages…'}
                      </Text>
                    </Flex>
                  )}
                  {doc && (
                    <Flex ref={sortableContainerRef} wrap="wrap" gap={2} align="flex-start">
                      {order.map((page, i) => (
                        <Box
                          key={page}
                          w={`${TILE_W}px`}
                          cursor="grab"
                          userSelect="none"
                          onClick={(e) => handleTileClick(page, e)}
                          onDoubleClick={() => setPeekPage(page)}
                        >
                          <Flex
                            h={`${TILE_H}px`}
                            align="center"
                            justify="center"
                            bg={tileBg}
                            borderRadius="4px"
                            borderWidth="1px"
                            borderColor={borderColor}
                            position="relative"
                            boxShadow={selectedPages.has(page) ? '0 0 0 2px #3b82f6' : undefined}
                          >
                            <LazyPdfThumbnail doc={doc} pageNumber={page} rootRef={gridScrollRef} fitWidth={TILE_W - 8} fitHeight={TILE_H - 8} />
                            {selectedPages.has(page) && (
                              <Flex
                                position="absolute"
                                top="3px"
                                right="3px"
                                w="14px"
                                h="14px"
                                borderRadius="full"
                                bg="#3b82f6"
                                color="white"
                                fontSize="9px"
                                fontWeight="700"
                                align="center"
                                justify="center"
                              >
                                ✓
                              </Flex>
                            )}
                            {page !== i + 1 && (
                              <Box
                                position="absolute"
                                left="6px"
                                right="6px"
                                bottom="3px"
                                h="3px"
                                borderRadius="full"
                                bg="blue.400"
                                opacity={0.9}
                                title="Page moved"
                              />
                            )}
                          </Flex>
                          <Text fontSize="10px" color={mutedColor} textAlign="center" mt="2px" userSelect="none">
                            {i + 1}
                            {page !== i + 1 ? ` (was ${page})` : ''}
                          </Text>
                        </Box>
                      ))}
                    </Flex>
                  )}
                </Box>

                {/* Removed pages strip */}
                {removed.length > 0 && doc && (
                  <Box>
                    <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                      Removed pages ({removed.length}) — click to restore
                    </Text>
                    <Flex wrap="wrap" gap={2}>
                      {removed.map((page) => (
                        <Box
                          key={page}
                          w="56px"
                          cursor="pointer"
                          onClick={() => restorePage(page)}
                          title={`Restore page ${page}`}
                          userSelect="none"
                        >
                          <Flex
                            h="72px"
                            align="center"
                            justify="center"
                            bg={tileBg}
                            borderRadius="4px"
                            borderWidth="1px"
                            borderColor="red.400"
                            opacity={0.55}
                            position="relative"
                            _hover={{ opacity: 0.9 }}
                          >
                            <LazyPdfThumbnail doc={doc} pageNumber={page} rootRef={gridScrollRef} fitWidth={48} fitHeight={64} />
                            <Flex position="absolute" inset={0} align="center" justify="center">
                              <Undo2 size={16} color="var(--chakra-colors-red-400)" />
                            </Flex>
                          </Flex>
                          <Text fontSize="10px" color={mutedColor} textAlign="center" mt="2px">
                            {page}
                          </Text>
                        </Box>
                      ))}
                    </Flex>
                  </Box>
                )}

                {/* Save-as name */}
                <Flex align="center" gap={2}>
                  <Text fontSize="xs" color={mutedColor} flexShrink={0}>
                    Save as:
                  </Text>
                  <Input
                    size="xs"
                    bg={inputBg}
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    onKeyDown={stopKeys}
                    borderColor={nameIssue ? 'red.400' : undefined}
                  />
                  <Text fontSize="11px" color={mutedColor} flexShrink={0}>
                    .pdf
                  </Text>
                </Flex>
                {(nameIssue || conflict) && (
                  <Text fontSize="10px" color={nameIssue ? 'red.400' : 'orange.400'}>
                    {nameIssue ?? 'A file with this name exists — will save as “… (2)”'}
                  </Text>
                )}
                <Text fontSize="xs" color={mutedColor}>
                  {isOverwrite
                    ? 'Saving with the original name replaces the file (undo restores it).'
                    : 'Saving with a different name creates a new PDF next to the original.'}
                </Text>
                {error && (
                  <Text fontSize="sm" color="red.400" whiteSpace="pre-wrap">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer borderTopWidth="1px" borderColor={borderColor} py={2.5}>
              <HStack gap={2}>
                <Button size="sm" variant="ghost" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" colorPalette="blue" onClick={() => void handleSave()} disabled={!canSave}>
                  {isSaving ? 'Saving…' : isOverwrite ? 'Save (replace original)' : 'Save as new PDF'}
                </Button>
              </HStack>
            </Dialog.Footer>

            {/* Enlarged page peek */}
            {peekPage !== null && doc && (
              <Flex
                position="absolute"
                inset={0}
                bg="blackAlpha.700"
                align="center"
                justify="center"
                zIndex={5}
                cursor="zoom-out"
                onClick={() => setPeekPage(null)}
                borderRadius="inherit"
              >
                <Box bg={tileBg} p={2} borderRadius="md" boxShadow="0 8px 30px rgba(0,0,0,0.5)">
                  <PdfPageCanvas doc={doc} pageNumber={peekPage} fitWidth={560} fitHeight={520} />
                  <Text fontSize="xs" color={mutedColor} textAlign="center" mt={1}>
                    Page {peekPage}
                  </Text>
                </Box>
              </Flex>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
