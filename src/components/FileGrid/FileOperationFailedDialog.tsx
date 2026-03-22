import React from 'react';
import { useColorModeValue } from '../ui/color-mode';
import { useDialogChrome } from '../ui/dialog-chrome';
import { Button, Dialog, Portal, Text, VStack } from '@chakra-ui/react';

export interface FileOperationFailedDialogProps {
  open: boolean;
  title: string;
  description: string;
  operationLabel: string;
  isRetrying: boolean;
  onRetry: () => void | Promise<void>;
  onCancel: () => void;
}

export const FileOperationFailedDialog: React.FC<FileOperationFailedDialogProps> = ({
  open,
  title,
  description,
  operationLabel,
  isRetrying,
  onRetry,
  onCancel,
}) => {
  const { surfaceBg: bgColor, borderColor } = useDialogChrome();
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Dialog.Root
      open={open}
      size="md"
      placement="center"
      onOpenChange={(e) => {
        if (!e.open) onCancel();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderWidth="1px" borderColor={borderColor}>
            <Dialog.Header>{title}</Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body>
              <VStack gap={3} align="stretch">
                <Text fontSize="sm" color={mutedColor}>
                  {operationLabel} could not be completed.
                </Text>
                <Text fontSize="sm" color={textColor} whiteSpace="pre-wrap" wordBreak="break-word">
                  {description}
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" mr={3} onClick={onCancel} disabled={isRetrying}>
                Cancel
              </Button>
              <Button colorPalette="blue" onClick={() => void onRetry()} disabled={isRetrying}>
                {isRetrying ? 'Retrying…' : 'Retry'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
