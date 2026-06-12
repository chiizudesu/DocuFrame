import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useColorModeValue } from '../ui/color-mode';
import { useDialogChrome } from '../ui/dialog-chrome';
import { Box, Button, Dialog, Flex, HStack, IconButton, Input, Portal, Spinner, Text, VStack } from '@chakra-ui/react';
import { Plus, Scissors, Trash2 } from 'lucide-react';
import type { FileItem } from '../../types';
import { usePdfDocument } from '../../pdf/pdfDocument';
import { PdfPageCanvas } from '../../pdf/PdfPageCanvas';
import { LazyPdfThumbnail } from '../../pdf/LazyPdfThumbnail';
import { getParentPath } from '../../utils/path';

export type SplitPdfOptions = { segments: Array<{ pages: number[]; name: string }> };

export interface SplitPdfDialogProps {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
  /** Returns the created file names so the caller can refresh + highlight */
  onSplit: (file: FileItem, options: SplitPdfOptions) => Promise<void>;
}

const SEGMENT_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#06b6d4'];
const INVALID_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const TILE_W = 92;
const TILE_H = 118;

/** "1-3, 5" from a sorted page list */
function pagesToLabel(pages: number[]): string {
  if (pages.length === 0) return '';
  const parts: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i++) {
    const p = pages[i];
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = p;
    prev = p;
  }
  return parts.join(', ');
}

/** Parse "1-3, 5" into sorted unique pages; null when invalid/out of bounds */
function parseRangesInput(text: string, pageCount: number): number[] | null {
  const segments = text.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  const pages = new Set<number>();
  for (const seg of segments) {
    const m = seg.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return null;
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    if (start < 1 || end > pageCount || start > end) return null;
    for (let p = start; p <= end; p++) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

/** Same convention as the legacy backend labels */
function defaultSegmentName(stem: string, pages: number[]): string {
  if (pages.length === 0) return stem;
  const label = pagesToLabel(pages);
  return pages.length === 1 ? `${stem} - Page ${pages[0]}` : `${stem} - Pages ${label}`;
}

function applyNamePattern(pattern: string, stem: string, index: number, start: number, end: number): string {
  return pattern
    .replace(/\{stem\}/g, stem)
    .replace(/\{n\}/g, String(index + 1))
    .replace(/\{start\}/g, String(start))
    .replace(/\{end\}/g, String(end));
}

interface Segment {
  id: number;
  pages: number[];
  /** Custom name; only meaningful when touched */
  name: string;
  touched: boolean;
}

export const SplitPdfDialog: React.FC<SplitPdfDialogProps> = ({ open, file, onClose, onSplit }) => {
  const { surfaceBg: bgColor, titleBarBg, borderColor, inputBg, textColor, secondaryTextColor } = useDialogChrome();
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const gridBg = useColorModeValue('#f1f5f9', '#11151f');
  const tileBg = useColorModeValue('white', '#1c2233');

  const [mode, setMode] = useState<'select' | 'points'>('select');
  const [segments, setSegments] = useState<Segment[]>([{ id: 1, pages: [], name: '', touched: false }]);
  const [activeSegId, setActiveSegId] = useState(1);
  const [splitPoints, setSplitPoints] = useState<Set<number>>(new Set());
  const [pointNames, setPointNames] = useState<Record<string, string>>({});
  const [patternText, setPatternText] = useState('');
  const [rangesText, setRangesText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [peekPage, setPeekPage] = useState<number | null>(null);
  const lastClickedPageRef = useRef<number | null>(null);
  const nextSegIdRef = useRef(2);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const stem = useMemo(() => (file ? file.name.replace(/\.pdf$/i, '') : ''), [file?.name]);

  const { doc, error: docError, isLoading } = usePdfDocument(open && file ? file.path : null, {
    versionTag: file?.modified,
  });
  // When pdf.js can't render the file, fall back to the IPC page count so
  // range-based selection still works without thumbnails.
  const [fallbackPageCount, setFallbackPageCount] = useState(0);
  useEffect(() => {
    if (!open || !file || !docError) {
      setFallbackPageCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electronAPI.getPdfPageCount(file.path);
        if (!cancelled && result?.success) setFallbackPageCount(result.pageCount);
      } catch {
        /* degraded mode only */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.path, docError]);
  const pageCount = doc?.numPages ?? fallbackPageCount;

  // Reset all state whenever the dialog opens for a file
  useEffect(() => {
    if (!open || !file) return;
    setMode('select');
    setSegments([{ id: 1, pages: [], name: '', touched: false }]);
    setActiveSegId(1);
    setSplitPoints(new Set());
    setPointNames({});
    setPatternText('');
    setRangesText('');
    setError(null);
    setPeekPage(null);
    lastClickedPageRef.current = null;
    nextSegIdRef.current = 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.path]);

  // Existing names in the directory — advisory conflict hints
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

  // ── Select mode helpers ──────────────────────────────────
  const pageToSegment = useMemo(() => {
    const map = new Map<number, Segment>();
    for (const seg of segments) for (const p of seg.pages) map.set(p, seg);
    return map;
  }, [segments]);

  const activeSegment = segments.find((s) => s.id === activeSegId) ?? segments[0];

  const updateActivePages = (updater: (pages: Set<number>) => void) => {
    const active = segments.find((s) => s.id === activeSegId) ?? segments[0];
    if (!active) return;
    const pages = new Set(active.pages);
    updater(pages);
    const sorted = [...pages].sort((a, b) => a - b);
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id === active.id) return { ...s, pages: sorted };
        // A page lives in exactly one output: assigning steals it from other segments
        const filtered = s.pages.filter((p) => !pages.has(p));
        return filtered.length === s.pages.length ? s : { ...s, pages: filtered };
      }),
    );
    setRangesText(pagesToLabel(sorted));
  };

  const handleTileClick = (page: number, e: React.MouseEvent) => {
    if (mode !== 'select') return;
    if (e.shiftKey && lastClickedPageRef.current !== null) {
      const from = Math.min(lastClickedPageRef.current, page);
      const to = Math.max(lastClickedPageRef.current, page);
      updateActivePages((pages) => {
        for (let p = from; p <= to; p++) pages.add(p);
      });
    } else {
      const inActive = activeSegment?.pages.includes(page);
      updateActivePages((pages) => {
        if (inActive) pages.delete(page);
        else pages.add(page);
      });
    }
    lastClickedPageRef.current = page;
  };

  const handleRangesInput = (text: string) => {
    setRangesText(text);
    const parsed = parseRangesInput(text, pageCount);
    if (parsed) {
      setSegments((prev) => {
        const activeId = prev.some((s) => s.id === activeSegId) ? activeSegId : prev[0]?.id;
        return prev.map((s) => {
          if (s.id === activeId) return { ...s, pages: parsed };
          const set = new Set(parsed);
          const filtered = s.pages.filter((p) => !set.has(p));
          return filtered.length === s.pages.length ? s : { ...s, pages: filtered };
        });
      });
    }
  };

  const addSegment = () => {
    const id = nextSegIdRef.current++;
    setSegments((prev) => [...prev, { id, pages: [], name: '', touched: false }]);
    setActiveSegId(id);
    setRangesText('');
    lastClickedPageRef.current = null;
  };

  const removeSegment = (id: number) => {
    const next = segments.filter((s) => s.id !== id);
    if (next.length === 0) return;
    setSegments(next);
    if (id === activeSegId) {
      setActiveSegId(next[0].id);
      setRangesText(pagesToLabel(next[0].pages));
    }
  };

  // ── Points mode helpers ──────────────────────────────────
  const pointSegments = useMemo(() => {
    if (!pageCount) return [] as Array<{ start: number; end: number }>;
    const pts = [...splitPoints].filter((p) => p >= 1 && p < pageCount).sort((a, b) => a - b);
    const segs: Array<{ start: number; end: number }> = [];
    let start = 1;
    for (const p of pts) {
      segs.push({ start, end: p });
      start = p + 1;
    }
    segs.push({ start, end: pageCount });
    return segs;
  }, [splitPoints, pageCount]);

  const pageToPointSegmentIndex = useMemo(() => {
    const map = new Map<number, number>();
    pointSegments.forEach((seg, i) => {
      for (let p = seg.start; p <= seg.end; p++) map.set(p, i);
    });
    return map;
  }, [pointSegments]);

  const toggleSplitPoint = (afterPage: number) => {
    setSplitPoints((prev) => {
      const next = new Set(prev);
      if (next.has(afterPage)) next.delete(afterPage);
      else next.add(afterPage);
      return next;
    });
  };

  const everyPage = () => {
    setMode('points');
    const pts = new Set<number>();
    for (let p = 1; p < pageCount; p++) pts.add(p);
    setSplitPoints(pts);
    if (!patternText) setPatternText('{stem} - Page {n}');
  };

  const pointSegmentName = (seg: { start: number; end: number }, index: number): string => {
    const key = `${seg.start}-${seg.end}`;
    if (pointNames[key] !== undefined) return pointNames[key];
    // Pattern only applies while its field is visible (many segments) — avoids invisible state
    if (pointSegments.length > 8 && patternText.trim()) {
      return applyNamePattern(patternText.trim(), stem, index, seg.start, seg.end);
    }
    const pages: number[] = [];
    for (let p = seg.start; p <= seg.end; p++) pages.push(p);
    return defaultSegmentName(stem, pages);
  };

  // ── Output rows (both modes normalize to this shape) ─────
  interface OutputRow {
    key: string;
    color: string;
    pagesLabel: string;
    pages: number[];
    name: string;
    isActive: boolean;
    onNameChange: (value: string) => void;
    onActivate?: () => void;
    onRemove?: () => void;
  }

  const outputRows: OutputRow[] = useMemo(() => {
    if (mode === 'select') {
      const withPages = segments.filter((s) => s.pages.length > 0 || s.id === activeSegId);
      return withPages.map((seg) => {
        const segIndex = segments.indexOf(seg);
        return {
          key: `seg-${seg.id}`,
          color: SEGMENT_COLORS[segIndex % SEGMENT_COLORS.length],
          pagesLabel: seg.pages.length ? pagesToLabel(seg.pages) : '—',
          pages: seg.pages,
          name: seg.touched ? seg.name : defaultSegmentName(stem, seg.pages),
          isActive: seg.id === activeSegId,
          onNameChange: (value: string) =>
            setSegments((prev) => prev.map((s) => (s.id === seg.id ? { ...s, name: value, touched: true } : s))),
          onActivate: () => {
            setActiveSegId(seg.id);
            setRangesText(pagesToLabel(seg.pages));
            lastClickedPageRef.current = null;
          },
          onRemove: withPages.length > 1 ? () => removeSegment(seg.id) : undefined,
        };
      });
    }
    return pointSegments.map((seg, i) => {
      const pages: number[] = [];
      for (let p = seg.start; p <= seg.end; p++) pages.push(p);
      return {
        key: `pt-${seg.start}-${seg.end}`,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        pagesLabel: pagesToLabel(pages),
        pages,
        name: pointSegmentName(seg, i),
        isActive: false,
        onNameChange: (value: string) => setPointNames((prev) => ({ ...prev, [`${seg.start}-${seg.end}`]: value })),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, segments, activeSegId, stem, pointSegments, pointNames, patternText]);

  const submittableRows = outputRows.filter((r) => r.pages.length > 0);

  /** Per-row validation error (blocks split); separate advisory conflict hint */
  const rowIssues = useMemo(() => {
    const issues = new Map<string, string>();
    const seen = new Map<string, string>();
    for (const row of submittableRows) {
      const name = row.name.trim();
      if (!name) {
        issues.set(row.key, 'Name is empty');
        continue;
      }
      if (INVALID_NAME_CHARS.test(name)) {
        issues.set(row.key, 'Name contains invalid characters (< > : " / \\ | ? *)');
        continue;
      }
      if (name.length > 150) {
        issues.set(row.key, 'Name is too long');
        continue;
      }
      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        issues.set(row.key, 'Duplicate output name');
        continue;
      }
      seen.set(lower, row.key);
    }
    return issues;
  }, [submittableRows]);

  const handleSplit = async () => {
    if (!file || submittableRows.length === 0 || rowIssues.size > 0) return;
    setIsSplitting(true);
    setError(null);
    try {
      await onSplit(file, { segments: submittableRows.map((r) => ({ pages: r.pages, name: r.name.trim() })) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSplitting(false);
    }
  };

  const showPatternField = mode === 'points' && pointSegments.length > 8;
  const splitCount = submittableRows.length;

  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <Dialog.Root
      open={open}
      size="lg"
      placement="center"
      onOpenChange={(e) => {
        if (!e.open && !isSplitting) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderWidth="1px" borderColor={borderColor} maxW="780px" position="relative">
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor} py={3}>
              <Text fontSize="md" fontWeight="600" color={textColor}>
                Split PDF
              </Text>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body py={3}>
              <VStack gap={3} align="stretch">
                <Flex align="center" gap={3} wrap="wrap">
                  <Text fontSize="sm" color={mutedColor} lineClamp={1} title={file?.name} flex={1} minW="200px">
                    {file?.name}
                    {pageCount ? ` — ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}
                  </Text>
                  <HStack gap={1}>
                    <Button
                      size="xs"
                      variant={mode === 'select' ? 'solid' : 'outline'}
                      colorPalette="blue"
                      onClick={() => setMode('select')}
                    >
                      Select pages
                    </Button>
                    <Button
                      size="xs"
                      variant={mode === 'points' ? 'solid' : 'outline'}
                      colorPalette="blue"
                      onClick={() => setMode('points')}
                    >
                      <Scissors size={12} style={{ marginRight: 4 }} />
                      Split at points
                    </Button>
                    <Button size="xs" variant="ghost" onClick={everyPage} disabled={!pageCount}>
                      Every page
                    </Button>
                  </HStack>
                </Flex>

                {mode === 'select' && (
                  <Flex align="center" gap={2}>
                    <Text fontSize="xs" color={mutedColor} flexShrink={0}>
                      Pages for output {Math.max(1, segments.findIndex((s) => s.id === activeSegId) + 1)}:
                    </Text>
                    <Input
                      size="xs"
                      maxW="220px"
                      bg={inputBg}
                      placeholder={pageCount ? `e.g. 1-3, 5 (1-${pageCount})` : 'e.g. 1-3, 5'}
                      value={rangesText}
                      onChange={(e) => handleRangesInput(e.target.value)}
                      onKeyDown={stopKeys}
                      borderColor={rangesText.trim() && !parseRangesInput(rangesText, pageCount) ? 'red.400' : undefined}
                    />
                    <Text fontSize="11px" color={mutedColor}>
                      Click thumbnails to toggle · Shift+click for a range
                    </Text>
                  </Flex>
                )}
                {mode === 'points' && (
                  <Text fontSize="11px" color={mutedColor}>
                    Click between pages to cut the document — every page ends up in exactly one output.
                  </Text>
                )}

                {/* Thumbnail grid */}
                <Box
                  ref={gridScrollRef}
                  maxH="300px"
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
                        {docError
                          ? `Could not render pages (${docError}) — selection still works via the range field`
                          : 'Loading pages…'}
                      </Text>
                    </Flex>
                  )}
                  {doc && (
                    <Flex wrap="wrap" gap={mode === 'points' ? 0 : 2} rowGap={2} align="center">
                      {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => {
                        const owner = mode === 'select' ? pageToSegment.get(page) : undefined;
                        const ownerIndex = owner ? segments.indexOf(owner) : -1;
                        const ownerColor = ownerIndex >= 0 ? SEGMENT_COLORS[ownerIndex % SEGMENT_COLORS.length] : null;
                        const isInActive = owner?.id === activeSegId;
                        const ptSegIndex = mode === 'points' ? pageToPointSegmentIndex.get(page) ?? 0 : 0;
                        const ptColor = SEGMENT_COLORS[ptSegIndex % SEGMENT_COLORS.length];
                        return (
                          <React.Fragment key={page}>
                            <Box
                              w={`${TILE_W}px`}
                              cursor={mode === 'select' ? 'pointer' : 'default'}
                              onClick={(e) => handleTileClick(page, e)}
                              onDoubleClick={() => setPeekPage(page)}
                              userSelect="none"
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
                                boxShadow={
                                  mode === 'select' && ownerColor
                                    ? `0 0 0 2px ${ownerColor}${isInActive ? '' : '99'}`
                                    : undefined
                                }
                                _hover={mode === 'select' ? { boxShadow: `0 0 0 2px ${SEGMENT_COLORS[Math.max(0, segments.findIndex((s) => s.id === activeSegId)) % SEGMENT_COLORS.length]}66` } : undefined}
                              >
                                <LazyPdfThumbnail doc={doc} pageNumber={page} rootRef={gridScrollRef} fitWidth={TILE_W - 8} fitHeight={TILE_H - 8} />
                                {mode === 'select' && ownerColor && (
                                  <Flex
                                    position="absolute"
                                    top="3px"
                                    right="3px"
                                    w="16px"
                                    h="16px"
                                    borderRadius="full"
                                    bg={ownerColor}
                                    color="white"
                                    fontSize="10px"
                                    fontWeight="700"
                                    align="center"
                                    justify="center"
                                  >
                                    {ownerIndex + 1}
                                  </Flex>
                                )}
                                {mode === 'points' && (
                                  <Box position="absolute" left="6px" right="6px" bottom="3px" h="3px" borderRadius="full" bg={ptColor} opacity={0.9} />
                                )}
                              </Flex>
                              <Text fontSize="10px" color={mutedColor} textAlign="center" mt="2px" userSelect="none">
                                {page}
                              </Text>
                            </Box>
                            {mode === 'points' && page < pageCount && (
                              <Flex
                                w="18px"
                                h={`${TILE_H}px`}
                                align="center"
                                justify="center"
                                cursor="pointer"
                                onClick={() => toggleSplitPoint(page)}
                                title={splitPoints.has(page) ? 'Remove split point' : `Split after page ${page}`}
                                role="group"
                              >
                                <Box
                                  w="2px"
                                  h={splitPoints.has(page) ? '100%' : '40%'}
                                  borderRadius="full"
                                  bg={splitPoints.has(page) ? 'red.400' : 'rgba(127,127,127,0.35)'}
                                  transition="all 0.12s ease"
                                  _groupHover={{ h: '100%', bg: splitPoints.has(page) ? 'red.300' : 'red.400' }}
                                />
                              </Flex>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </Flex>
                  )}
                </Box>

                {/* Output list */}
                <Flex align="center" gap={2}>
                  <Text fontSize="xs" fontWeight="600" color={textColor}>
                    Output files ({splitCount})
                  </Text>
                  {mode === 'select' && (
                    <Button size="2xs" variant="ghost" colorPalette="blue" onClick={addSegment}>
                      <Plus size={12} style={{ marginRight: 2 }} />
                      Add another output
                    </Button>
                  )}
                </Flex>
                {showPatternField && (
                  <Flex align="center" gap={2}>
                    <Text fontSize="xs" color={mutedColor} flexShrink={0}>
                      Name pattern:
                    </Text>
                    <Input
                      size="xs"
                      bg={inputBg}
                      value={patternText}
                      placeholder="{stem} - Page {n}"
                      onChange={(e) => {
                        setPatternText(e.target.value);
                        setPointNames({});
                      }}
                      onKeyDown={stopKeys}
                    />
                    <Text fontSize="10px" color={mutedColor} flexShrink={0}>
                      {'{stem} {n} {start} {end}'}
                    </Text>
                  </Flex>
                )}
                <VStack gap={1} align="stretch" maxH="170px" overflowY="auto">
                  {outputRows.length === 0 && (
                    <Text fontSize="xs" color={mutedColor}>
                      Select pages above to define the first output.
                    </Text>
                  )}
                  {outputRows.map((row) => {
                    const issue = rowIssues.get(row.key);
                    const conflict = !issue && row.name.trim() && existingNames.has(`${row.name.trim().toLowerCase()}.pdf`);
                    return (
                      <Box key={row.key}>
                        <Flex
                          align="center"
                          gap={2}
                          px={1.5}
                          py={1}
                          borderRadius="md"
                          bg={row.isActive ? 'rgba(59,130,246,0.08)' : undefined}
                          borderWidth="1px"
                          borderColor={row.isActive ? 'rgba(59,130,246,0.35)' : 'transparent'}
                          cursor={row.onActivate ? 'pointer' : 'default'}
                          onClick={row.onActivate}
                        >
                          <Box w="8px" h="8px" borderRadius="full" bg={row.color} flexShrink={0} />
                          <Text fontSize="11px" color={mutedColor} minW="74px" flexShrink={0} title={`Pages ${row.pagesLabel}`}>
                            {row.pages.length ? `p. ${row.pagesLabel}` : 'no pages'}
                          </Text>
                          <Input
                            size="xs"
                            bg={inputBg}
                            value={row.name}
                            onChange={(e) => row.onNameChange(e.target.value)}
                            onKeyDown={stopKeys}
                            onClick={(e) => e.stopPropagation()}
                            borderColor={issue ? 'red.400' : undefined}
                          />
                          <Text fontSize="11px" color={mutedColor} flexShrink={0}>
                            .pdf
                          </Text>
                          {row.onRemove && (
                            <IconButton
                              aria-label="Remove output"
                              size="2xs"
                              variant="ghost"
                              minW="20px"
                              h="20px"
                              color={mutedColor}
                              onClick={(e) => {
                                e.stopPropagation();
                                row.onRemove?.();
                              }}
                            >
                              <Trash2 size={12} />
                            </IconButton>
                          )}
                        </Flex>
                        {(issue || conflict) && (
                          <Text fontSize="10px" color={issue ? 'red.400' : 'orange.400'} pl="92px">
                            {issue ?? 'A file with this name exists — will save as “… (2)”'}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </VStack>

                <Text fontSize="xs" color={mutedColor}>
                  New PDFs are created next to the original. The original is not modified.
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
                <Button size="sm" variant="ghost" onClick={onClose} disabled={isSplitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  colorPalette="blue"
                  onClick={() => void handleSplit()}
                  disabled={isSplitting || splitCount === 0 || rowIssues.size > 0}
                >
                  {isSplitting ? 'Splitting…' : `Split → ${splitCount} PDF${splitCount === 1 ? '' : 's'}`}
                </Button>
              </HStack>
            </Dialog.Footer>

            {/* Enlarged page peek (double-click a thumbnail) */}
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
