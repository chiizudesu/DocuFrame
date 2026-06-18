import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Flex, IconButton, Portal, Spinner, Text } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Moon, Plus, Sun, X } from 'lucide-react';
import { usePdfDocument } from '../../pdf/pdfDocument';
import { PdfPageCanvas } from '../../pdf/PdfPageCanvas';
import { useDialogChrome } from '../ui/dialog-chrome';
import { useColorModeValue } from '../ui/color-mode';
import { useAppContext } from '../../context/AppContext';
import type { FileItem } from '../../types';

const POPUP_W = 420;
const POPUP_H = 540;
const HEADER_H = 30;
const TOOLBAR_H = 34;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
/** Crisp pdf.js re-render happens this long after the last zoom change;
 * in between, the existing canvas is CSS-scaled so zooming never stutters. */
const ZOOM_RERENDER_DEBOUNCE_MS = 160;

/** Files the popup can preview (image list mirrors the read-image-as-data-url mime map) */
export const POPUP_PREVIEWABLE_RE = /\.(pdf|png|jpe?g|gif|webp|bmp|svg|ico|xlsx?|xlsm|csv|docx?)$/i;

interface PopupTarget {
  file: FileItem;
  anchorRect: DOMRect;
}

/** Imperative opener — the row's Eye button calls this; the mounted popup listens. */
let popupOpenListener: ((target: PopupTarget) => void) | null = null;

/** Open the floating PDF preview popup anchored to `anchorEl` (e.g. the file row).
 * Returns false when no popup is mounted or the anchor is gone. */
export function openPdfPreviewPopup(file: FileItem, anchorEl: Element | null): boolean {
  if (!popupOpenListener || !anchorEl) return false;
  const rect = anchorEl.getBoundingClientRect();
  if (!rect || rect.width === 0) return false;
  popupOpenListener({ file, anchorRect: rect });
  return true;
}

function computePopupPosition(anchorRect: DOMRect): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Prefer hugging the right edge of the row (usually overlaps the grid edge / preview gutter)
  let left = anchorRect.right - POPUP_W - 8;
  if (anchorRect.right + POPUP_W + 16 <= vw) left = anchorRect.right + 8;
  left = Math.min(Math.max(8, left), vw - POPUP_W - 8);
  let top = anchorRect.top - 40;
  top = Math.min(Math.max(8, top), vh - POPUP_H - 8);
  return { left, top };
}

/** Singleton floating PDF preview, opened from a row's Eye button.
 * Separate from the Preview Pane — interactive (zoom / pan / page nav) and transient. */
export const HoverPdfPreview: React.FC<{ files: FileItem[] }> = ({ files }) => {
  const { setSelectedFiles, setIsPreviewPaneOpen, currentDirectory } = useAppContext();
  const { surfaceBg, titleBarBg, borderColor, textColor, secondaryTextColor } = useDialogChrome();
  const canvasBg = useColorModeValue('#e2e8f0', '#11151f');

  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [page, setPage] = useState(1);
  /** Live zoom target — applied instantly via CSS transform */
  const [zoom, setZoom] = useState(1);
  /** Zoom the pdf.js canvas is asked to render at (debounced behind `zoom`) */
  const [renderZoom, setRenderZoom] = useState(1);
  /** Zoom of the last canvas render that actually completed */
  const [appliedZoom, setAppliedZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 });

  const popupRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const popupHoveredRef = useRef(false);
  const targetRef = useRef<PopupTarget | null>(null);
  targetRef.current = target;
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const panRef = useRef({ x: 0, y: 0 });
  panRef.current = pan;
  const renderZoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** PDF content wrapper — its transform is also set imperatively on canvas swap (see onRenderSize) */
  const pdfWrapRef = useRef<HTMLDivElement>(null);

  const kind: 'pdf' | 'image' | 'spreadsheet' | 'docx' | null = target
    ? (() => {
        const n = target.file.name.toLowerCase();
        if (n.endsWith('.pdf')) return 'pdf' as const;
        if (/\.(xlsx?|xlsm|csv)$/.test(n)) return 'spreadsheet' as const;
        if (/\.docx?$/.test(n)) return 'docx' as const;
        return 'image' as const;
      })()
    : null;

  const { doc, error: pdfError, isLoading: pdfLoading } = usePdfDocument(
    kind === 'pdf' && target ? target.file.path : null,
    { versionTag: target?.file.modified },
  );
  const pageCount = doc?.numPages ?? 0;

  // Image loading (data URL via IPC — same any-path story as the PDF buffer loader)
  const [img, setImg] = useState<{ url: string | null; loading: boolean; error: string | null }>({
    url: null,
    loading: false,
    error: null,
  });
  useEffect(() => {
    if (!target || kind !== 'image') {
      setImg({ url: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setImg({ url: null, loading: true, error: null });
    (window.electronAPI as any)
      .readImageAsDataUrl(target.file.path)
      .then((res: { success?: boolean; dataUrl?: string; error?: string }) => {
        if (cancelled) return;
        if (res?.success && res.dataUrl) setImg({ url: res.dataUrl, loading: false, error: null });
        else setImg({ url: null, loading: false, error: res?.error || 'Could not load image' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setImg({ url: null, loading: false, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.file.path, kind]);

  // Spreadsheet loading
  interface SheetPreview { name: string; columns: { header: string; width: number }[]; rows: string[][] }
  const [spreadsheet, setSpreadsheet] = useState<{
    data: { sheets: SheetPreview[]; truncated: boolean } | null;
    activeSheet: number;
    loading: boolean;
    error: string | null;
  }>({ data: null, activeSheet: 0, loading: false, error: null });

  useEffect(() => {
    if (!target || kind !== 'spreadsheet') {
      setSpreadsheet({ data: null, activeSheet: 0, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setSpreadsheet({ data: null, activeSheet: 0, loading: true, error: null });
    (window.electronAPI as any)
      .readSpreadsheetPreview(target.file.path)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success) setSpreadsheet({ data: { sheets: res.sheets, truncated: !!res.truncated }, activeSheet: 0, loading: false, error: null });
        else setSpreadsheet({ data: null, activeSheet: 0, loading: false, error: res?.error || 'Could not load spreadsheet' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setSpreadsheet({ data: null, activeSheet: 0, loading: false, error: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.file.path, kind]);

  // DOCX loading
  const [docxHtml, setDocxHtml] = useState<{ html: string | null; loading: boolean; error: string | null }>({
    html: null, loading: false, error: null,
  });

  useEffect(() => {
    if (!target || kind !== 'docx') {
      setDocxHtml({ html: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setDocxHtml({ html: null, loading: true, error: null });
    (window.electronAPI as any)
      .readDocxAsHtml(target.file.path)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success && res.html) setDocxHtml({ html: res.html, loading: false, error: null });
        else setDocxHtml({ html: null, loading: false, error: res?.error || 'Could not load document' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setDocxHtml({ html: null, loading: false, error: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.file.path, kind]);

  const error = kind === 'image' ? img.error
    : kind === 'spreadsheet' ? spreadsheet.error
    : kind === 'docx' ? docxHtml.error
    : pdfError;
  const isLoading = kind === 'image' ? img.loading
    : kind === 'spreadsheet' ? spreadsheet.loading
    : kind === 'docx' ? docxHtml.loading
    : pdfLoading;

  /** Light/dark content background toggle for spreadsheet & docx previews */
  const [contentLightBg, setContentLightBg] = useState(true);
  const contentBg = contentLightBg ? '#ffffff' : canvasBg;
  const contentTextColor = contentLightBg ? '#1a202c' : textColor;
  const contentBorderColor = contentLightBg ? '#e2e8f0' : borderColor;
  const isDocKind = kind === 'spreadsheet' || kind === 'docx';

  /** Re-render the canvas crisp shortly after zooming settles */
  const scheduleCrispRender = useCallback(() => {
    if (renderZoomTimerRef.current) clearTimeout(renderZoomTimerRef.current);
    renderZoomTimerRef.current = setTimeout(() => {
      renderZoomTimerRef.current = null;
      setRenderZoom(zoomRef.current);
    }, ZOOM_RERENDER_DEBOUNCE_MS);
  }, []);

  const close = useCallback(() => {
    popupHoveredRef.current = false;
    if (renderZoomTimerRef.current) {
      clearTimeout(renderZoomTimerRef.current);
      renderZoomTimerRef.current = null;
    }
    setTarget(null);
  }, []);
  useEffect(() => {
    return () => {
      if (renderZoomTimerRef.current) clearTimeout(renderZoomTimerRef.current);
    };
  }, []);

  // Register as the imperative open target (one mounted popup per list)
  useEffect(() => {
    popupOpenListener = (next: PopupTarget) => {
      setTarget((prev) => (prev?.file.path === next.file.path ? null : next));
    };
    return () => {
      popupOpenListener = null;
    };
  }, []);

  // Reset view state when the target file changes
  useEffect(() => {
    setPage(1);
    setZoom(1);
    setRenderZoom(1);
    setAppliedZoom(1);
    setPan({ x: 0, y: 0 });
  }, [target?.file.path]);

  // Close when navigating away or when the file disappears from the listing
  useEffect(() => {
    close();
  }, [currentDirectory, close]);
  useEffect(() => {
    const current = targetRef.current;
    if (current && !files.some((f) => f.path === current.file.path)) close();
  }, [files, close]);

  // Global dismissal: Escape always; arrows only while the mouse is over the popup.
  // Scroll or mousedown outside the popup closes it; starting a drag closes it.
  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (!popupHoveredRef.current || kind !== 'pdf') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        e.stopPropagation();
        setPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        e.stopPropagation();
        setPage((p) => Math.min(pageCount || 1, p + 1));
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) close();
    };
    const onScroll = (e: Event) => {
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) return;
      close();
    };
    const onDragStart = (e: DragEvent) => {
      // Don't close if the drag originated inside the popup (e.g. panning doc content)
      if (popupRef.current && e.target instanceof Node && popupRef.current.contains(e.target)) return;
      close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('dragstart', onDragStart, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('dragstart', onDragStart, true);
    };
  }, [target, pageCount, close, kind]);

  const viewportW = POPUP_W - 2;
  const viewportH = POPUP_H - HEADER_H - TOOLBAR_H - 2;

  const clampPan = useCallback(
    (p: { x: number; y: number }, z: number) => {
      if (kind === 'spreadsheet' || kind === 'docx') {
        // Top-left origin: pan range is [-(scaledSize - viewport), margin] with some slack
        const slack = 40;
        const minX = Math.min(0, -(pageSize.w * z - viewportW)) - slack;
        const minY = Math.min(0, -(pageSize.h * z - viewportH)) - slack;
        return {
          x: Math.min(slack, Math.max(minX, p.x)),
          y: Math.min(slack, Math.max(minY, p.y)),
        };
      }
      const maxX = Math.max(0, (pageSize.w * z - viewportW) / 2) + 40;
      const maxY = Math.max(0, (pageSize.h * z - viewportH) / 2) + 40;
      return {
        x: Math.min(maxX, Math.max(-maxX, p.x)),
        y: Math.min(maxY, Math.max(-maxY, p.y)),
      };
    },
    [pageSize.w, pageSize.h, viewportW, viewportH, kind],
  );

  // Wheel zoom around the cursor (native listener — React onWheel is passive)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !target) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom((prevZoom) => {
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor));
        if (nextZoom === prevZoom) return prevZoom;
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;
        setPan((prevPan) => {
          const ratio = nextZoom / prevZoom;
          return clampPan({ x: (prevPan.x - cx) * ratio + cx, y: (prevPan.y - cy) * ratio + cy }, nextZoom);
        });
        return nextZoom;
      });
      scheduleCrispRender();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [target, clampPan, scheduleCrispRender]);

  // Drag to pan
  const dragStateRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    setPan(clampPan({ x: drag.panX + (e.clientX - drag.startX), y: drag.panY + (e.clientY - drag.startY) }, zoom));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragStateRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const openInPreviewPane = () => {
    if (!target) return;
    setSelectedFiles([target.file.name]);
    setIsPreviewPaneOpen(true);
    close();
  };

  const position = useMemo(() => (target ? computePopupPosition(target.anchorRect) : null), [target]);

  if (!target || !position) return null;

  return (
    <Portal>
      <Box
        ref={popupRef}
        position="fixed"
        left={`${position.left}px`}
        top={`${position.top}px`}
        w={`${POPUP_W}px`}
        h={`${POPUP_H}px`}
        zIndex={10050}
        bg={surfaceBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        boxShadow="0 12px 32px rgba(0,0,0,0.45)"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        onMouseEnter={() => {
          popupHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          popupHoveredRef.current = false;
        }}
      >
        {/* Header */}
        <Flex h={`${HEADER_H}px`} align="center" px={2} gap={2} bg={titleBarBg} flexShrink={0}>
          <Text fontSize="xs" fontWeight="600" color={textColor} flex={1} lineClamp={1} title={target.file.name}>
            {target.file.name}
          </Text>
          <IconButton aria-label="Close preview" size="2xs" variant="ghost" minW="20px" h="20px" color={secondaryTextColor} onClick={close}>
            <X size={13} />
          </IconButton>
        </Flex>
        {/* Page viewport */}
        <Box
          ref={viewportRef}
          flex={1}
          position="relative"
          overflow="hidden"
          bg={canvasBg}
          cursor={dragStateRef.current ? 'grabbing' : zoom > 1 ? 'grab' : 'default'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={() => {
            setZoom(1);
            setRenderZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          {kind === 'pdf' && doc && (
            <Flex
              ref={pdfWrapRef}
              position="absolute"
              inset={0}
              align="center"
              justify="center"
              // Live zoom is pure CSS (no stutter); the canvas re-renders crisp once zooming settles,
              // at which point appliedZoom catches up and the scale factor returns to 1.
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / appliedZoom})` }}
            >
              <PdfPageCanvas
                doc={doc}
                pageNumber={page}
                fitWidth={viewportW}
                fitHeight={viewportH}
                zoom={renderZoom}
                onRenderSize={(w, h) => {
                  // The canvas was just resized in this same JS task. Update the wrapper's
                  // transform imperatively NOW so the size change and the scale-factor change
                  // hit the same paint — going through React state alone lets a frame slip
                  // through where the new canvas is shown with the old scale (visible flicker).
                  const wrap = pdfWrapRef.current;
                  if (wrap) {
                    wrap.style.transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current / renderZoom})`;
                  }
                  setAppliedZoom(renderZoom);
                  setPageSize((prev) =>
                    prev.w === w / renderZoom && prev.h === h / renderZoom ? prev : { w: w / renderZoom, h: h / renderZoom },
                  );
                }}
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
              />
            </Flex>
          )}
          {kind === 'image' && img.url && (
            <Flex
              position="absolute"
              inset={0}
              align="center"
              justify="center"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <img
                src={img.url}
                alt={target.file.name}
                draggable={false}
                style={{
                  maxWidth: `${viewportW}px`,
                  maxHeight: `${viewportH}px`,
                  objectFit: 'contain',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
                }}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setPageSize({ w: el.offsetWidth, h: el.offsetHeight });
                }}
              />
            </Flex>
          )}
          {kind === 'spreadsheet' && spreadsheet.data && (
            <Flex
              position="absolute"
              inset={0}
              align="flex-start"
              justify="flex-start"
              userSelect="none"
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            >
              <Box
                ref={(el: HTMLDivElement | null) => {
                  if (el) {
                    const r = el.getBoundingClientRect();
                    const w = r.width / zoom;
                    const h = r.height / zoom;
                    if (Math.abs(w - pageSize.w) > 2 || Math.abs(h - pageSize.h) > 2) setPageSize({ w, h });
                  }
                }}
                p={2}
                bg={contentBg}
                borderRadius="md"
                boxShadow="0 2px 12px rgba(0,0,0,0.35)"
              >
                <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      {spreadsheet.data.sheets[spreadsheet.activeSheet]?.columns.map((col, i) => (
                        <th key={i} style={{
                          padding: '3px 6px',
                          borderBottom: `2px solid ${contentBorderColor}`,
                          textAlign: 'left',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          maxWidth: `${col.width}px`,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: contentTextColor,
                        }}>
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheet.data.sheets[spreadsheet.activeSheet]?.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{
                            padding: '2px 6px',
                            borderBottom: `1px solid ${contentBorderColor}`,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                            color: contentTextColor,
                          }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {spreadsheet.data.truncated && (
                  <Text fontSize="10px" color={contentLightBg ? '#718096' : secondaryTextColor} mt={1} textAlign="center">
                    Preview truncated (100 rows × 20 cols)
                  </Text>
                )}
              </Box>
            </Flex>
          )}
          {kind === 'docx' && docxHtml.html && (
            <Flex
              position="absolute"
              inset={0}
              align="flex-start"
              justify="flex-start"
              userSelect="none"
              draggable={false}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
            >
              <Box
                ref={(el: HTMLDivElement | null) => {
                  if (el) {
                    const r = el.getBoundingClientRect();
                    const w = r.width / zoom;
                    const h = r.height / zoom;
                    if (Math.abs(w - pageSize.w) > 2 || Math.abs(h - pageSize.h) > 2) setPageSize({ w, h });
                  }
                }}
                p={3}
                bg={contentBg}
                borderRadius="md"
                boxShadow="0 2px 12px rgba(0,0,0,0.35)"
                w={`${viewportW}px`}
              >
                <Box
                  fontSize="12px"
                  lineHeight="1.5"
                  color={contentTextColor}
                  dangerouslySetInnerHTML={{ __html: docxHtml.html }}
                  css={{
                    '& p': { margin: '0.4em 0' },
                    '& table': { borderCollapse: 'collapse', width: '100%' },
                    '& td, & th': { border: `1px solid ${contentBorderColor}`, padding: '2px 4px' },
                    '& img': { maxWidth: '100%' },
                    '& h1': { fontSize: '1.4em', fontWeight: 700, margin: '0.5em 0' },
                    '& h2': { fontSize: '1.2em', fontWeight: 600, margin: '0.4em 0' },
                    '& h3': { fontSize: '1.1em', fontWeight: 600, margin: '0.3em 0' },
                    '& ul, & ol': { paddingLeft: '1.5em', margin: '0.3em 0' },
                  }}
                />
              </Box>
            </Flex>
          )}
          {isLoading && (
            <Flex position="absolute" inset={0} align="center" justify="center">
              <Spinner size="sm" color="blue.400" />
            </Flex>
          )}
          {error && (
            <Flex position="absolute" inset={0} align="center" justify="center" px={4}>
              <Text fontSize="xs" color={secondaryTextColor} textAlign="center" whiteSpace="pre-wrap">
                {`Can't preview this ${kind === 'image' ? 'image' : kind === 'spreadsheet' ? 'spreadsheet' : kind === 'docx' ? 'document' : 'PDF'}\n${error}`}
              </Text>
            </Flex>
          )}
        </Box>
        {/* Toolbar */}
        <Flex h={`${TOOLBAR_H}px`} align="center" px={2} gap={1} bg={titleBarBg} flexShrink={0}>
          {kind === 'pdf' && (
            <>
              <IconButton
                aria-label="Previous page"
                size="2xs"
                variant="ghost"
                minW="22px"
                h="22px"
                color={secondaryTextColor}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </IconButton>
              <Text fontSize="11px" color={secondaryTextColor} minW="48px" textAlign="center" userSelect="none">
                {pageCount ? `${page} / ${pageCount}` : '–'}
              </Text>
              <IconButton
                aria-label="Next page"
                size="2xs"
                variant="ghost"
                minW="22px"
                h="22px"
                color={secondaryTextColor}
                disabled={!pageCount || page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount || 1, p + 1))}
              >
                <ChevronRight size={14} />
              </IconButton>
            </>
          )}
          {kind === 'image' && (
            <Text fontSize="11px" color={secondaryTextColor} userSelect="none">
              Image
            </Text>
          )}
          {kind === 'spreadsheet' && spreadsheet.data && spreadsheet.data.sheets.length > 1 && (
            <Flex gap={0} overflow="hidden">
              {spreadsheet.data.sheets.map((sheet, i) => (
                <Box
                  key={i}
                  as="button"
                  fontSize="10px"
                  px={2}
                  py={1}
                  color={i === spreadsheet.activeSheet ? textColor : secondaryTextColor}
                  fontWeight={i === spreadsheet.activeSheet ? 600 : 400}
                  borderBottom={i === spreadsheet.activeSheet ? '2px solid' : 'none'}
                  borderColor="blue.400"
                  onClick={() => setSpreadsheet((prev) => ({ ...prev, activeSheet: i }))}
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  maxW="80px"
                  title={sheet.name}
                  cursor="pointer"
                  _hover={{ color: textColor }}
                >
                  {sheet.name}
                </Box>
              ))}
            </Flex>
          )}
          {kind === 'spreadsheet' && (!spreadsheet.data || spreadsheet.data.sheets.length <= 1) && (
            <Text fontSize="11px" color={secondaryTextColor} userSelect="none">
              Spreadsheet
            </Text>
          )}
          {kind === 'docx' && (
            <Text fontSize="11px" color={secondaryTextColor} userSelect="none">
              Document
            </Text>
          )}
          <Box flex={1} />
          {isDocKind && (
            <IconButton
              aria-label="Toggle background"
              title={contentLightBg ? 'Dark background' : 'Light background'}
              size="2xs"
              variant="ghost"
              minW="22px"
              h="22px"
              color={secondaryTextColor}
              onClick={() => setContentLightBg((v) => !v)}
            >
              {contentLightBg ? <Moon size={12} /> : <Sun size={12} />}
            </IconButton>
          )}
          <IconButton
            aria-label="Zoom out"
            size="2xs"
            variant="ghost"
            minW="22px"
            h="22px"
            color={secondaryTextColor}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => {
              setZoom((z) => Math.max(MIN_ZOOM, z / 1.25));
              scheduleCrispRender();
            }}
          >
            <Minus size={13} />
          </IconButton>
          <Text fontSize="11px" color={secondaryTextColor} minW="38px" textAlign="center" userSelect="none">
            {Math.round(zoom * 100)}%
          </Text>
          <IconButton
            aria-label="Zoom in"
            size="2xs"
            variant="ghost"
            minW="22px"
            h="22px"
            color={secondaryTextColor}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => {
              setZoom((z) => Math.min(MAX_ZOOM, z * 1.25));
              scheduleCrispRender();
            }}
          >
            <Plus size={13} />
          </IconButton>
          <Box w="6px" />
          <IconButton
            aria-label="Open in preview pane"
            title="Open in preview pane"
            size="2xs"
            variant="ghost"
            minW="22px"
            h="22px"
            color={secondaryTextColor}
            onClick={openInPreviewPane}
          >
            <ExternalLink size={13} />
          </IconButton>
        </Flex>
      </Box>
    </Portal>
  );
};
