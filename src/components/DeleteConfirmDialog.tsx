import React, { useRef, useEffect } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, Box, Text, Flex, Dialog, Portal } from '@chakra-ui/react';
import { Trash2, Folder, FileText, AlertTriangle, Undo2 } from 'lucide-react';
import { docuFramePalette as P } from '../docuFrameColors';
import type { FileItem } from '../types';

interface DeleteConfirmDialogProps {
  open: boolean;
  items: FileItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app delete confirmation — replaces the off-theme native OS dialog.
 * Matches the shell (sharp corners, dialog-chrome surfaces, Rajdhani accent) with a
 * red danger treatment. Deletes now go to the app trash, so it reassures that Ctrl+Z undoes.
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({ open, items, onConfirm, onCancel }) => {
  const { surfaceBg, titleBarBg, borderColor, textColor, secondaryTextColor } = useDialogChrome();
  const wellBg = useColorModeValue('#ffffff', P.dark.toolbar);
  const rowBorder = useColorModeValue(P.light.border, P.dark.border);
  const iconColor = useColorModeValue('#3b82f6', '#63B3ED');

  // Danger accents (no red in the palette — kept local to this destructive surface)
  const dangerTint = useColorModeValue('rgba(239,68,68,0.10)', 'rgba(239,68,68,0.16)');
  const dangerBorder = useColorModeValue('rgba(239,68,68,0.35)', 'rgba(239,68,68,0.45)');
  const dangerText = useColorModeValue('#dc2626', '#f87171');
  const dangerHover = useColorModeValue('#b91c1c', '#ef4444');
  const reassureColor = useColorModeValue('#0f766e', '#5eead4');

  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => confirmRef.current?.focus());
  }, [open]);

  const count = items.length;
  const single = count === 1 ? items[0] : null;
  const folderCount = items.filter((i) => i.type === 'folder').length;
  const fileCount = count - folderCount;

  const title = single
    ? `Delete ${single.type === 'folder' ? 'folder' : 'file'}?`
    : `Delete ${count} items?`;

  const subtitle = single
    ? null
    : [fileCount && `${fileCount} file${fileCount === 1 ? '' : 's'}`, folderCount && `${folderCount} folder${folderCount === 1 ? '' : 's'}`]
        .filter(Boolean)
        .join(' · ');

  return (
    <Dialog.Root open={open} size="sm" placement="center" onOpenChange={(e) => { if (!e.open) onCancel(); }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={surfaceBg}
            maxW="430px"
            borderRadius={0}
            borderTop="3px solid"
            borderTopColor={dangerText}
            boxShadow="0 24px 60px -16px rgba(0,0,0,0.55)"
            display="flex"
            flexDirection="column"
            overflow="hidden"
            onKeyDown={(e) => {
              // Keep Enter/Escape inside the dialog — otherwise the grid's global
              // Enter handler opens the file we're deleting ("Windows cannot find …").
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); }
              else if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
            }}
          >
            {/* Header — danger glyph + title */}
            <Flex
              align="center"
              gap={3}
              bg={titleBarBg}
              borderBottom="1px solid"
              borderColor={borderColor}
              px={4}
              py={3}
            >
              <Flex
                flexShrink={0}
                w="38px"
                h="38px"
                borderRadius="8px"
                bg={dangerTint}
                border="1px solid"
                borderColor={dangerBorder}
                color={dangerText}
                align="center"
                justify="center"
              >
                <Trash2 size={19} strokeWidth={2.2} />
              </Flex>
              <Box minW={0}>
                <Text
                  fontSize="15px"
                  fontWeight="700"
                  color={textColor}
                  lineClamp={1}
                  style={{ fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.01em' }}
                >
                  {title}
                </Text>
                {subtitle && (
                  <Text fontSize="11px" color={secondaryTextColor} mt="1px">
                    {subtitle}
                  </Text>
                )}
              </Box>
            </Flex>

            <Box px={4} py={3.5}>
              {/* The single name, or a scrollable well for many */}
              {single ? (
                <Flex
                  align="center"
                  gap={2}
                  bg={wellBg}
                  border="1px solid"
                  borderColor={rowBorder}
                  borderRadius="6px"
                  px={3}
                  py={2.5}
                >
                  <Box flexShrink={0} color={single.type === 'folder' ? iconColor : secondaryTextColor} lineHeight={0}>
                    {single.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                  </Box>
                  <Text fontSize="13px" color={textColor} lineClamp={1} title={single.name}>
                    {single.name}
                  </Text>
                </Flex>
              ) : (
                <Box
                  bg={wellBg}
                  border="1px solid"
                  borderColor={rowBorder}
                  borderRadius="6px"
                  maxH="180px"
                  overflowY="auto"
                >
                  {items.map((item, i) => (
                    <Flex
                      key={item.path}
                      align="center"
                      gap={2}
                      px={3}
                      py={1.5}
                      borderTop={i === 0 ? undefined : '1px solid'}
                      borderColor={rowBorder}
                    >
                      <Box flexShrink={0} color={item.type === 'folder' ? iconColor : secondaryTextColor} lineHeight={0}>
                        {item.type === 'folder' ? <Folder size={15} /> : <FileText size={15} />}
                      </Box>
                      <Text fontSize="12.5px" color={textColor} lineClamp={1} title={item.name}>
                        {item.name}
                      </Text>
                    </Flex>
                  ))}
                </Box>
              )}

              {/* Folder warning + undo reassurance */}
              {folderCount > 0 && (
                <Flex align="center" gap={1.5} mt={3} color={dangerText}>
                  <AlertTriangle size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  <Text fontSize="11.5px">
                    {folderCount === 1 && single ? 'This folder and all its contents will be removed.' : 'Folders are removed with all their contents.'}
                  </Text>
                </Flex>
              )}
              <Flex align="center" gap={1.5} mt={folderCount > 0 ? 1.5 : 3} color={reassureColor}>
                <Undo2 size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <Text fontSize="11.5px">Moved to trash — press Ctrl+Z to undo.</Text>
              </Flex>
            </Box>

            <Flex
              justify="flex-end"
              gap={2}
              px={4}
              py={3}
              borderTop="1px solid"
              borderColor={borderColor}
              bg={titleBarBg}
            >
              <Button size="sm" variant="outline" borderRadius="6px" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                ref={confirmRef}
                size="sm"
                borderRadius="6px"
                bg={dangerText}
                color="white"
                _hover={{ bg: dangerHover }}
                _focusVisible={{ outline: '2px solid', outlineColor: dangerBorder, outlineOffset: '1px' }}
                onClick={onConfirm}
              >
                <Trash2 size={15} /> Delete
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
