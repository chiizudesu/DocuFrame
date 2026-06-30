import React, { useEffect, useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from "@/components/ui/toaster"
import {
  Button,
  Text,
  Box,
  VStack,
  HStack,
  Checkbox,
  Icon,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { CheckCircle, Folder, FileText, ShieldAlert } from 'lucide-react';

export interface FileProperties {
  name: string;
  extension: string;
  size: number;
  /** Raw timestamps (ISO / Date string); formatted in the dialog. */
  modified: string;
  created?: string;
  accessed?: string;
  path: string;
  isBlocked: boolean;
  isDirectory?: boolean;
  readonly?: boolean;
}

interface CustomPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileProperties | null;
  onUnblock: () => Promise<void>;
}

/** Friendly type names for the formats accountants actually handle. */
const TYPE_NAMES: Record<string, string> = {
  pdf: 'PDF Document',
  xlsx: 'Excel Worksheet', xls: 'Excel Worksheet', xlsm: 'Excel Worksheet',
  csv: 'CSV (Comma delimited)',
  docx: 'Word Document', doc: 'Word Document',
  txt: 'Text Document',
  png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image',
  zip: 'Compressed (zipped) Folder',
  eml: 'Email Message', msg: 'Outlook Message',
};

const fmtDate = (s?: string): string => {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/** Windows-style: humanized unit + exact byte count. */
const fmtSize = (n: number, isDir?: boolean): string => {
  if (isDir) return '—';
  if (!n || n < 0) return '0 bytes';
  if (n < 1024) return `${n} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n, i = -1;
  do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(2)} ${units[i]} (${n.toLocaleString()} bytes)`;
};

export const CustomPropertiesDialog: React.FC<CustomPropertiesDialogProps> = ({
  isOpen,
  onClose,
  file,
  onUnblock,
}) => {
  const [unblockChecked, setUnblockChecked] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [unblocked, setUnblocked] = useState(false);
  const {
    surfaceBg,
    titleBarBg,
    borderColor,
    inputBg,
    textColor: valueColor,
    secondaryTextColor: labelColor,
  } = useDialogChrome();

  const pathBg = useColorModeValue('gray.50', inputBg);
  const pathColor = useColorModeValue('gray.700', 'gray.300');
  const rowDivider = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const iconTint = useColorModeValue('blue.500', 'blue.300');
  const iconWashBg = useColorModeValue('blue.50', 'whiteAlpha.100');

  useEffect(() => {
    if (isOpen) {
      setUnblockChecked(false);
      setUnblocking(false);
      setUnblocked(false);
    }
  }, [isOpen, file]);

  const handleUnblock = async () => {
    setUnblocking(true);
    try {
      await onUnblock();
      setUnblocked(true);
      showToast({ title: 'File unblocked', status: 'success', duration: 2000, isClosable: true });
    } catch (err) {
      showToast({
        title: 'Failed to unblock file',
        description: err instanceof Error ? err.message : 'Unknown error',
        status: 'error', duration: 3000, isClosable: true,
      });
    } finally {
      setUnblocking(false);
    }
  };

  if (!file) return null;

  const ext = file.extension.toLowerCase();
  const typeLabel = file.isDirectory
    ? 'File folder'
    : TYPE_NAMES[ext] || (ext ? `${ext.toUpperCase()} File` : 'File');

  /** Label/value line — fixed label column keeps values aligned like the Windows General tab. */
  const Row: React.FC<{ label: string; value?: string; mono?: boolean; children?: React.ReactNode }> = ({
    label, value, mono, children,
  }) => (
    <HStack align="flex-start" gap={3} py="3px">
      <Text
        w="78px" flexShrink={0} pt="1px" fontSize="11px" lineHeight="1.5"
        color={labelColor} fontWeight="semibold" letterSpacing="0.03em"
      >
        {label}
      </Text>
      <Box flex={1} minW={0}>
        {children ?? (
          <Text
            fontSize="xs" color={valueColor} lineHeight="1.5"
            fontFamily={mono ? 'mono' : undefined}
            wordBreak={mono ? 'break-all' : undefined}
          >
            {value}
          </Text>
        )}
      </Box>
    </HStack>
  );

  const Divider = () => <Box borderTop="1px solid" borderColor={rowDivider} my={2} />;

  return (
    <Dialog.Root open={isOpen} size="md" placement="center" onOpenChange={e => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={surfaceBg} borderRadius="lg" border="1px solid" borderColor={borderColor}>
            <Dialog.Header bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              <Text fontSize="sm" fontWeight="semibold">Properties</Text>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body py={5}>
              {/* Identity — solid icon + name + type, like the Windows header */}
              <HStack gap={3} align="center" mb={4}>
                <Box
                  flexShrink={0} w="42px" h="42px" borderRadius="md" bg={iconWashBg}
                  display="flex" alignItems="center" justifyContent="center" color={iconTint}
                >
                  <Icon boxSize="22px" asChild>
                    {file.isDirectory ? <Folder fill="currentColor" strokeWidth={1.5} /> : <FileText strokeWidth={1.6} />}
                  </Icon>
                </Box>
                <Box minW={0}>
                  <Text fontSize="sm" fontWeight="semibold" color={valueColor} lineClamp={2} title={file.name}>
                    {file.name}
                  </Text>
                  <Text fontSize="11px" color={labelColor} mt="1px">{typeLabel}</Text>
                </Box>
              </HStack>

              <VStack align="stretch" gap={0}>
                <Row label="Type" value={typeLabel} />
                <Row label="Location" mono value={file.path} />

                <Divider />

                <Row label="Size" value={fmtSize(file.size, file.isDirectory)} />

                <Divider />

                <Row label="Created" value={fmtDate(file.created)} />
                <Row label="Modified" value={fmtDate(file.modified)} />
                <Row label="Accessed" value={fmtDate(file.accessed)} />

                {(file.readonly || file.isBlocked) && (
                  <>
                    <Divider />
                    <Row label="Attributes">
                      <HStack gap={2} flexWrap="wrap">
                        {file.readonly && (
                          <Box as="span" px={2} py="1px" borderRadius="full" bg={iconWashBg} color={iconTint} fontSize="11px" fontWeight="medium">
                            Read-only
                          </Box>
                        )}
                        {file.isBlocked && !unblocked && (
                          <HStack as="span" gap={1} px={2} py="1px" borderRadius="full" bg="orange.subtle" color="orange.fg" fontSize="11px" fontWeight="medium">
                            <ShieldAlert size={12} /> <Text as="span">Blocked</Text>
                          </HStack>
                        )}
                      </HStack>
                    </Row>
                  </>
                )}
              </VStack>

              {file.isBlocked && (
                <Box w="100%" mt={4} pt={3} borderTop="1px solid" borderColor={borderColor}>
                  <Checkbox.Root
                    checked={unblockChecked || unblocked}
                    disabled={unblocking || unblocked}
                    onCheckedChange={async (d) => {
                      const next = d.checked === true;
                      setUnblockChecked(next);
                      if (next && !unblocked) await handleUnblock();
                    }}
                    colorPalette="blue"
                    size="sm"
                  ><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Checkbox.Label>Unblock this file</Checkbox.Label></Checkbox.Root>
                  <Tooltip content="Unblock removes the security zone marking (Zone.Identifier) so the file can be opened without warning.">
                    <Text fontSize="11px" color={labelColor} mt={1}>
                      Removes the security block (Zone.Identifier) added to files from the internet.
                    </Text>
                  </Tooltip>
                  {unblocked && (
                    <HStack mt={2} color="green.500">
                      <CheckCircle size={15} />
                      <Text fontSize="xs">File is now unblocked</Text>
                    </HStack>
                  )}
                </Box>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={onClose} size="sm">Close</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
