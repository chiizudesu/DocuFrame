import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDialogChrome } from './ui/dialog-chrome';
import {
  Button,
  VStack,
  Text,
  Box,
  Alert,
  Flex,
  Icon,
  Dialog,
  Portal,
  Field,
  NativeSelect,
} from '@chakra-ui/react';
import { CloudUpload } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { settingsService } from '../services/settings';
import {
  CLIENT_DB_FY_YEARS,
  getClientName,
  type ClientDbRow,
} from '../services/clientDatabaseCsv';

export interface UploadToVaultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePaths: string[];
  targetDir: string;
}

export const UploadToVaultsDialog: React.FC<UploadToVaultsDialogProps> = ({
  isOpen,
  onClose,
  sourcePaths,
  targetDir,
}) => {
  const defaultYear = useMemo(() => {
    const y = String(new Date().getFullYear());
    return (CLIENT_DB_FY_YEARS as readonly string[]).includes(y)
      ? y
      : CLIENT_DB_FY_YEARS[CLIENT_DB_FY_YEARS.length - 1];
  }, []);

  const [clientName, setClientName] = useState('');
  const [year, setYear] = useState(() => defaultYear);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const { addLog, setStatus } = useAppContext();
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    inputBg,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();

  const progressListenerAdded = useRef(false);
  useEffect(() => {
    if (progressListenerAdded.current) return;
    progressListenerAdded.current = true;
    window.electronAPI.onVaultUploadProgress((_event, data) => {
      setProgressMsg(data.message);
    });
    return () => {
      window.electronAPI.removeAllListeners('vault-upload-progress');
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccessMsg(null);
    setProgressMsg(null);
    setClientName('');
    setYear(defaultYear);
    let cancelled = false;
    setClientsLoading(true);
    (async () => {
      try {
        const settings = await settingsService.getSettings();
        const csvPath = settings.clientbasePath?.trim();
        if (!csvPath) {
          if (!cancelled) setClientOptions([]);
          return;
        }
        const rows = (await window.electronAPI.readCsv(csvPath)) as ClientDbRow[];
        const names = [
          ...new Set(
            (Array.isArray(rows) ? rows : [])
              .map((r) => getClientName(r))
              .filter((n): n is string => Boolean(n)),
          ),
        ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        if (!cancelled) setClientOptions(names);
      } catch {
        if (!cancelled) setClientOptions([]);
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, defaultYear]);

  const handleClose = () => {
    setError(null);
    setSuccessMsg(null);
    setProgressMsg(null);
    setClientName('');
    onClose();
  };

  const handleSubmit = async () => {
    const name = clientName.trim();
    const y = year.trim();
    if (!name) { setError('Select a client.'); return; }
    if (!/^\d{4}$/.test(y)) { setError('Year must be four digits (e.g. 2026).'); return; }
    if (sourcePaths.length === 0 || !targetDir.trim()) { setError('Missing PDF files or destination folder.'); return; }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setProgressMsg(null);

    try {
      const result = await window.electronAPI.uploadClientPdfsToVaults({
        sourcePaths,
        clientName: name,
        year: y,
        targetDir: targetDir.trim(),
      });

      setProgressMsg(null);
      if (result.success) {
        addLog(result.message, 'response');
        if (result.stderr) addLog(result.stderr, 'info');
        setStatus(result.message, 'success');
        setSuccessMsg(result.message);
      } else {
        const detail = result.stderr ? `${result.message}\n${result.stderr}` : result.message;
        addLog(detail, 'error');
        setStatus(result.message, 'error');
        setError(detail);
      }
    } catch (err) {
      setProgressMsg(null);
      const msg = err instanceof Error ? err.message : 'Upload failed';
      addLog(msg, 'error');
      setStatus('Upload to Vaults failed', 'error');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const basenames = sourcePaths.map((p) => p.replace(/^.*[/\\]/, ''));
  const canSubmit = !isLoading && !!clientName.trim() && /^\d{4}$/.test(year.trim());

  return (
    <Dialog.Root
      open={isOpen}
      placement="center"
      onOpenChange={(e) => { if (!e.open) handleClose(); }}
    >
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
            w="440px"
            maxW="440px"
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
                <Icon color="blue.400" asChild><CloudUpload /></Icon>
                <Text fontSize="sm" fontWeight="600" color={textColor}>Upload to Vaults Repo</Text>
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />

            <Dialog.Body overflow="hidden" px={3} py={3}>
              {error && (
                <Alert.Root status="error" mb={3} borderRadius="md">
                  <Alert.Indicator />
                  <Box fontSize="xs" whiteSpace="pre-wrap">{error}</Box>
                </Alert.Root>
              )}
              {successMsg && (
                <Alert.Root status="success" mb={3} borderRadius="md">
                  <Alert.Indicator />
                  <Box fontSize="xs">{successMsg}</Box>
                </Alert.Root>
              )}

              <VStack align="stretch" gap={3}>
                <Box>
                  <Text fontSize="xs" fontWeight="600" color={textColor} mb={1}>
                    {sourcePaths.length} PDF{sourcePaths.length === 1 ? '' : 's'} to upload
                  </Text>
                  <Box
                    maxH="80px"
                    overflowY="auto"
                    borderWidth="1px"
                    borderColor={borderColor}
                    borderRadius="md"
                    px={2}
                    py={1}
                  >
                    {basenames.map((n) => (
                      <Text key={n} fontSize="xs" color={secondaryTextColor}>{n}</Text>
                    ))}
                  </Box>
                </Box>

                <Box>
                  <Text fontSize="xs" fontWeight="600" color={textColor} mb={0.5}>Destination</Text>
                  <Text fontSize="xs" color={secondaryTextColor} wordBreak="break-all">
                    {targetDir ? `${targetDir}\\{client}\\{year}\\` : '(not set)'}
                  </Text>
                </Box>

                <Flex gap={3} align="flex-end">
                  <Field.Root flex={1}>
                    <Field.Label fontSize="xs" fontWeight="600" color={textColor}>Client</Field.Label>
                    <NativeSelect.Root size="xs" disabled={clientsLoading || clientOptions.length === 0 || isLoading}>
                      <NativeSelect.Field
                        w="full"
                        bg={inputBg}
                        borderColor={borderColor}
                        color={textColor}
                        value={clientName}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClientName(e.target.value)}
                      >
                        <option value="" style={{ background: 'inherit', color: 'inherit' }}>
                          {clientsLoading ? 'Loading…' : clientOptions.length === 0 ? 'Configure clientbase in Settings' : 'Select client…'}
                        </option>
                        {clientOptions.map((name) => (
                          <option key={name} value={name} style={{ background: 'inherit', color: 'inherit' }}>{name}</option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                  <Field.Root w="90px" flexShrink={0}>
                    <Field.Label fontSize="xs" fontWeight="600" color={textColor}>Year</Field.Label>
                    <NativeSelect.Root size="xs" disabled={isLoading}>
                      <NativeSelect.Field
                        bg={inputBg}
                        borderColor={borderColor}
                        color={textColor}
                        value={year}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(e.target.value)}
                      >
                        {CLIENT_DB_FY_YEARS.map((y) => (
                          <option key={y} value={y} style={{ background: 'inherit', color: 'inherit' }}>{y}</option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </Flex>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer px={3} py={2} borderTopWidth="1px" borderColor={borderColor}>
              {progressMsg && (
                <Text fontSize="xs" color={secondaryTextColor} flex={1} mr={2} truncate>
                  {progressMsg}
                </Text>
              )}
              <Button size="xs" variant="outline" borderRadius="md" onClick={handleClose} disabled={isLoading}>
                {successMsg ? 'Close' : 'Cancel'}
              </Button>
              {!successMsg && (
                <Button
                  size="xs"
                  borderRadius="md"
                  colorPalette="blue"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  loading={isLoading}
                  loadingText="Uploading…"
                >
                  Upload and push
                </Button>
              )}
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
