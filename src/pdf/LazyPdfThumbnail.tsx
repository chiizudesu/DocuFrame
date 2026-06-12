import React, { useEffect, useRef, useState } from 'react';
import { Box, Flex } from '@chakra-ui/react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfPageCanvas } from './PdfPageCanvas';

/** Thumbnail that only renders once scrolled near the viewport of its scroll container.
 * Shared by the split / edit / merge dialogs. */
export const LazyPdfThumbnail: React.FC<{
  doc: PDFDocumentProxy;
  pageNumber: number;
  rootRef: React.RefObject<HTMLDivElement | null>;
  fitWidth: number;
  fitHeight: number;
}> = ({ doc, pageNumber, rootRef, fitWidth, fitHeight }) => {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = holderRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setVisible(true);
        }
      },
      { root: rootRef.current, rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef, visible]);
  return (
    <Flex ref={holderRef} w="100%" h="100%" align="center" justify="center">
      {visible ? (
        <PdfPageCanvas doc={doc} pageNumber={pageNumber} fitWidth={fitWidth} fitHeight={fitHeight} />
      ) : (
        <Box w={`${fitWidth - 8}px`} h={`${fitHeight - 8}px`} borderRadius="2px" bg="rgba(127,127,127,0.12)" />
      )}
    </Flex>
  );
};
