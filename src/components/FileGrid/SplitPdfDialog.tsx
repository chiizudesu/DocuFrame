import React, { useEffect, useState } from 'react';
import { useColorModeValue } from '../ui/color-mode';
import { useDialogChrome } from '../ui/dialog-chrome';
import { Button, Dialog, Portal, Text, VStack, Input, RadioGroup, HStack } from '@chakra-ui/react';
import type { FileItem } from '../../types';

export interface SplitPdfDialogProps {
  open: boolean;
  file: FileItem | null;
  onClose: () => void;
  /** Returns the created file names so the caller can refresh + highlight */
  onSplit: (file: FileItem, options: { mode: 'singles' | 'ranges'; ranges?: string }) => Promise<void>;
}

export const SplitPdfDialog: React.FC<SplitPdfDialogProps> = ({ open, file, onClose, onSplit }) => {
  const { surfaceBg: bgColor, borderColor } = useDialogChrome();
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const [mode, setMode] = useState<'ranges' | 'singles'>('ranges');
  const [ranges, setRanges] = useState('');
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    setMode('ranges');
    setRanges('');
    setError(null);
    setPageCount(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electronAPI.getPdfPageCount(file.path);
        if (!cancelled && result?.success) setPageCount(result.pageCount);
      } catch {
        if (!cancelled) setPageCount(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.path]);

  const handleSplit = async () => {
    if (!file) return;
    if (mode === 'ranges' && !ranges.trim()) {
      setError('Enter page ranges, e.g. 1-3, 5');
      return;
    }
    setIsSplitting(true);
    setError(null);
    try {
      await onSplit(file, mode === 'singles' ? { mode } : { mode, ranges: ranges.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      size="sm"
      placement="center"
      onOpenChange={(e) => {
        if (!e.open && !isSplitting) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderWidth="1px" borderColor={borderColor}>
            <Dialog.Header>Split PDF</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={3} align="stretch">
                <Text fontSize="sm" color={mutedColor} lineClamp={1} title={file?.name}>
                  {file?.name}
                  {pageCount !== null ? ` — ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}
                </Text>
                <RadioGroup.Root
                  value={mode}
                  onValueChange={(e) => setMode((e.value as 'ranges' | 'singles') ?? 'ranges')}
                  size="sm"
                >
                  <VStack gap={2} align="stretch">
                    <RadioGroup.Item value="ranges">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>Extract page ranges</RadioGroup.ItemText>
                    </RadioGroup.Item>
                    {mode === 'ranges' && (
                      <Input
                        size="sm"
                        placeholder={pageCount ? `e.g. 1-3, 5 (1-${pageCount})` : 'e.g. 1-3, 5'}
                        value={ranges}
                        onChange={(e) => setRanges(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleSplit();
                          e.stopPropagation();
                        }}
                        autoFocus
                      />
                    )}
                    <RadioGroup.Item value="singles">
                      <RadioGroup.ItemHiddenInput />
                      <RadioGroup.ItemIndicator />
                      <RadioGroup.ItemText>Split into single pages</RadioGroup.ItemText>
                    </RadioGroup.Item>
                  </VStack>
                </RadioGroup.Root>
                <Text fontSize="xs" color={mutedColor}>
                  Each range becomes its own PDF next to the original. The original is not modified.
                </Text>
                {error && (
                  <Text fontSize="sm" color="red.400" whiteSpace="pre-wrap">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={2}>
                <Button variant="ghost" onClick={onClose} disabled={isSplitting}>
                  Cancel
                </Button>
                <Button colorPalette="blue" onClick={() => void handleSplit()} disabled={isSplitting}>
                  {isSplitting ? 'Splitting…' : 'Split'}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
