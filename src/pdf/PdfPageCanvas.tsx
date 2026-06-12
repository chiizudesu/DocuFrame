import React, { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export interface PdfPageCanvasProps {
  doc: PDFDocumentProxy;
  /** 1-based page number */
  pageNumber: number;
  /** Box the page should fit inside at zoom 1 (contain) */
  fitWidth: number;
  fitHeight: number;
  /** Multiplier on the fit scale (popup zoom); default 1 */
  zoom?: number;
  /** Reports the CSS pixel size of the rendered page */
  onRenderSize?: (width: number, height: number) => void;
  style?: React.CSSProperties;
}

/** Renders one PDF page into a canvas at devicePixelRatio, with render-task
 * cancellation. Renders offscreen then blits, so zoom/page changes don't flash. */
export const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  doc,
  pageNumber,
  fitWidth,
  fitHeight,
  zoom = 1,
  onRenderSize,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState(false);
  const onRenderSizeRef = useRef(onRenderSize);
  onRenderSizeRef.current = onRenderSize;

  useEffect(() => {
    let cancelled = false;
    let task: RenderTask | null = null;
    setRenderError(false);
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(fitWidth / baseViewport.width, fitHeight / baseViewport.height);
      const scale = Math.max(0.05, fitScale * zoom);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = page.getViewport({ scale: scale * dpr });

      const offscreen = document.createElement('canvas');
      offscreen.width = Math.ceil(viewport.width);
      offscreen.height = Math.ceil(viewport.height);
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;
      task = page.render({ canvasContext: offCtx, viewport } as Parameters<typeof page.render>[0]);
      await task.promise;
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      const cssW = offscreen.width / dpr;
      const cssH = offscreen.height / dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(offscreen, 0, 0);
      onRenderSizeRef.current?.(cssW, cssH);
    })().catch((err) => {
      if (cancelled) return;
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'RenderingCancelledException') return;
      setRenderError(true);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, fitWidth, fitHeight, zoom]);

  if (renderError) return null;
  return <canvas ref={canvasRef} style={{ display: 'block', ...style }} />;
};
