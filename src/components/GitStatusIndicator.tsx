import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, chakra, Flex, IconButton, Popover, Portal, Spinner, Text } from '@chakra-ui/react';
import { ArrowDown, ArrowUp, Check, CloudOff, Download, GitBranch, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { useColorModeValue } from './ui/color-mode';
import { Tooltip } from './ui/tooltip';
import { showToast, getErrorMessageFromUnknown } from './ui/toaster';
import { docuFramePalette as P } from '../docuFrameColors';

interface RootGitStatus {
  isRepo: boolean;
  gitRoot?: string;
  branch?: string;
  upstream?: string;
  ahead: number;
  behind: number;
  changedCount: number;
  untrackedCount: number;
  fetchFailed?: boolean;
}

type GitAction = 'push' | 'pull' | 'discard' | 'refresh';

const STATUS_POLL_MS = 30_000;
const FETCH_POLL_MS = 5 * 60_000;

const suppressFocusRing = { outline: 'none', boxShadow: 'none' };

const gitApi = () => window.electronAPI as unknown as {
  rootGitStatus: (options?: { fetch?: boolean }) => Promise<RootGitStatus>;
  rootGitPush: () => Promise<{ success: boolean; message: string }>;
  rootGitPull: () => Promise<{ success: boolean; message: string }>;
  rootGitDiscard: () => Promise<{ success: boolean; message: string }>;
};

export const GitStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<RootGitStatus | null>(null);
  const [busy, setBusy] = useState<GitAction | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const lastFetchRef = useRef(0);
  const busyRef = useRef<GitAction | null>(null);
  busyRef.current = busy;

  const subtext = useColorModeValue(P.light.subtext, P.dark.subtext);
  const pillHoverBg = useColorModeValue(P.light.chromeHover, P.dark.rowHover);
  const panelBg = useColorModeValue('#ffffff', '#1f2733');
  const panelBorder = useColorModeValue(P.light.border, P.dark.border);
  const tileBg = useColorModeValue(P.light.footer, P.dark.toolbar);
  const headingColor = useColorModeValue('#334155', '#E2E8F0');
  const blue = useColorModeValue('#3b82f6', '#63B3ED');
  const amber = useColorModeValue('#b45309', '#F6AD55');
  const red = useColorModeValue('#dc2626', '#FC8181');
  const green = useColorModeValue('#15803d', '#68D391');
  const dangerHoverBg = useColorModeValue('#fee2e2', '#3b2326');

  const refresh = useCallback(async (withFetch: boolean) => {
    try {
      if (withFetch) lastFetchRef.current = Date.now();
      const next = await gitApi().rootGitStatus({ fetch: withFetch });
      setStatus(next);
    } catch (error) {
      console.error('[GitStatusIndicator] status failed:', error);
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const timer = setInterval(() => {
      if (busyRef.current) return; // don't race an in-flight push/pull
      const fetchDue = Date.now() - lastFetchRef.current > FETCH_POLL_MS;
      refresh(fetchDue);
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const runAction = async (action: GitAction, fn: () => Promise<{ success: boolean; message: string }>, title: string) => {
    setBusy(action);
    try {
      const result = await fn();
      if (result.success) {
        showToast({ title, description: result.message, status: 'success', duration: 4000, isClosable: true });
      } else {
        showToast({ title: `${title} failed`, description: result.message, status: 'error', duration: 8000, isClosable: true });
      }
    } catch (error) {
      showToast({ title: `${title} failed`, description: getErrorMessageFromUnknown(error), status: 'error', duration: 8000, isClosable: true });
    } finally {
      setBusy(null);
      refresh(true);
    }
  };

  // Root path not under git (or not yet loaded) — render nothing, footer stays clean
  if (!status?.isRepo) return null;

  const { branch, upstream, ahead, behind, fetchFailed } = status;
  const dirtyCount = status.changedCount + status.untrackedCount;
  const needsAttention = behind > 0 || dirtyCount > 0;
  const pillColor = behind > 0 || dirtyCount > 0 ? amber : ahead > 0 ? blue : subtext;
  const synced = ahead === 0 && behind === 0 && dirtyCount === 0;

  const summaryLabel = fetchFailed
    ? 'Remote unreachable — counts may be stale'
    : synced
      ? 'Up to date with remote'
      : [
          behind > 0 ? `${behind} behind` : '',
          ahead > 0 ? `${ahead} ahead` : '',
          dirtyCount > 0 ? `${dirtyCount} uncommitted` : '',
        ].filter(Boolean).join(' • ');

  const actionBtnProps = {
    size: 'sm' as const,
    variant: 'ghost' as const,
    borderRadius: 0,
    h: '24px',
    w: '24px',
    minW: '24px',
    color: subtext,
    _hover: { bg: pillHoverBg },
    _focus: suppressFocusRing,
    _focusVisible: suppressFocusRing,
  };

  return (
    <Popover.Root
      open={isOpen}
      closeOnInteractOutside
      onOpenChange={({ open }) => {
        setIsOpen(open);
        setConfirmingDiscard(false);
        if (open) refresh(true);
      }}
      positioning={{ placement: 'top-end', strategy: 'fixed', gutter: 6 }}
    >
      <style>{`
        @keyframes dfGitPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.78); }
        }
      `}</style>
      <Tooltip
        content={`${branch ?? 'git'} — ${summaryLabel}`}
        showArrow
        openDelay={300}
        closeDelay={0}
        positioning={{ placement: 'top', gutter: 8 }}
      >
        <Box display="inline-flex">
          <Popover.Trigger asChild>
            <Flex
              as="button"
              align="center"
              gap="5px"
              px="7px"
              h="20px"
              cursor="pointer"
              color={pillColor}
              borderRadius="3px"
              transition="background 0.12s ease, color 0.12s ease"
              _hover={{ bg: pillHoverBg }}
              _focus={suppressFocusRing}
              _focusVisible={suppressFocusRing}
              userSelect="none"
              aria-label="Git status for root path"
            >
              {fetchFailed ? <CloudOff size={11} strokeWidth={2.2} /> : <GitBranch size={11} strokeWidth={2.2} />}
              <Text fontSize="11px" fontWeight={500} lineHeight={1} maxW="140px" truncate>
                {branch ?? 'detached'}
              </Text>
              {behind > 0 && (
                <Flex align="center" gap="1px">
                  <ArrowDown size={10} strokeWidth={2.5} />
                  <Text fontSize="10px" fontWeight={600} lineHeight={1}>{behind}</Text>
                </Flex>
              )}
              {ahead > 0 && (
                <Flex align="center" gap="1px">
                  <ArrowUp size={10} strokeWidth={2.5} />
                  <Text fontSize="10px" fontWeight={600} lineHeight={1}>{ahead}</Text>
                </Flex>
              )}
              {dirtyCount > 0 && (
                <Text fontSize="10px" fontWeight={600} lineHeight={1}>±{dirtyCount}</Text>
              )}
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                flexShrink={0}
                bg={dirtyCount > 0 ? amber : behind > 0 ? amber : ahead > 0 ? blue : green}
                animation={needsAttention ? 'dfGitPulse 1.8s ease-in-out infinite' : undefined}
              />
            </Flex>
          </Popover.Trigger>
        </Box>
      </Tooltip>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            w="252px"
            borderWidth="1px"
            borderStyle="solid"
            borderColor={panelBorder}
            bg={panelBg}
            borderRadius="4px"
            boxShadow="0 8px 24px rgba(0,0,0,0.28)"
            zIndex={10000}
            _focus={suppressFocusRing}
            _focusVisible={suppressFocusRing}
            p={0}
            overflow="hidden"
          >
            <Popover.Body p={0}>
              {/* Header: branch identity + quick actions */}
              <Flex align="center" justify="space-between" px={3} pt={2.5} pb={2}>
                <Flex align="center" gap={2} minW={0}>
                  <GitBranch size={13} strokeWidth={2.2} color={pillColor} />
                  <Box minW={0}>
                    <Text fontSize="12px" fontWeight={600} color={headingColor} lineHeight="1.2" truncate>
                      {branch ?? 'detached HEAD'}
                    </Text>
                    <Text fontSize="10px" color={subtext} lineHeight="1.3" truncate>
                      {upstream ?? 'no upstream'}
                    </Text>
                  </Box>
                </Flex>
                <Tooltip content="Fetch & refresh" showArrow openDelay={0} closeDelay={0} positioning={{ placement: 'top', gutter: 6 }}>
                  <IconButton
                    aria-label="Fetch and refresh git status"
                    {...actionBtnProps}
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy('refresh');
                      try {
                        await refresh(true);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === 'refresh' ? <Spinner size="xs" /> : <RefreshCw size={13} strokeWidth={2} />}
                  </IconButton>
                </Tooltip>
              </Flex>

              {/* Stat tiles */}
              <Flex gap="1px" px={3} pb={2}>
                {[
                  { label: 'BEHIND', value: behind, tint: behind > 0 ? amber : subtext },
                  { label: 'AHEAD', value: ahead, tint: ahead > 0 ? blue : subtext },
                  { label: 'CHANGES', value: dirtyCount, tint: dirtyCount > 0 ? amber : subtext },
                ].map(tile => (
                  <Flex key={tile.label} direction="column" align="center" flex="1" bg={tileBg} py={1.5} gap="1px">
                    <Text fontSize="15px" fontWeight={700} lineHeight={1} color={tile.tint} fontVariantNumeric="tabular-nums">
                      {tile.value}
                    </Text>
                    <Text fontSize="8px" fontWeight={600} letterSpacing="0.08em" color={subtext}>
                      {tile.label}
                    </Text>
                  </Flex>
                ))}
              </Flex>

              {/* State line */}
              <Flex align="center" gap={1.5} px={3} pb={2}>
                {fetchFailed
                  ? <CloudOff size={11} strokeWidth={2.2} color={red} />
                  : synced
                    ? <Check size={11} strokeWidth={2.5} color={green} />
                    : null}
                <Text fontSize="10px" color={fetchFailed ? red : synced ? green : subtext} lineHeight="1.3">
                  {summaryLabel}
                </Text>
              </Flex>

              {/* Sync actions */}
              <Flex borderTopWidth="1px" borderColor={panelBorder}>
                <chakra.button
                  flex="1"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1.5}
                  py={2}
                  cursor="pointer"
                  color={behind > 0 ? amber : subtext}
                  transition="background 0.12s ease"
                  _hover={{ bg: pillHoverBg, _disabled: { bg: 'transparent' } }}
                  _disabled={{ opacity: busy === 'pull' ? 1 : 0.45, cursor: 'default' }}
                  _focus={suppressFocusRing}
                  _focusVisible={suppressFocusRing}
                  disabled={busy !== null}
                  onClick={() => runAction('pull', () => gitApi().rootGitPull(), 'Pull')}
                >
                  {busy === 'pull' ? <Spinner size="xs" /> : <Download size={12} strokeWidth={2.2} />}
                  <Text fontSize="11px" fontWeight={600}>Pull</Text>
                </chakra.button>
                <Box w="1px" bg={panelBorder} />
                <chakra.button
                  flex="1"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1.5}
                  py={2}
                  cursor="pointer"
                  color={ahead > 0 || dirtyCount > 0 ? blue : subtext}
                  transition="background 0.12s ease"
                  _hover={{ bg: pillHoverBg, _disabled: { bg: 'transparent' } }}
                  _disabled={{ opacity: busy === 'push' ? 1 : 0.45, cursor: 'default' }}
                  _focus={suppressFocusRing}
                  _focusVisible={suppressFocusRing}
                  disabled={busy !== null}
                  onClick={() => runAction('push', () => gitApi().rootGitPush(), 'Push')}
                >
                  {busy === 'push' ? <Spinner size="xs" /> : <Upload size={12} strokeWidth={2.2} />}
                  <Text fontSize="11px" fontWeight={600}>{dirtyCount > 0 ? 'Commit & push' : 'Push'}</Text>
                </chakra.button>
              </Flex>

              {/* Danger zone: two-step discard */}
              <chakra.button
                w="100%"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={1.5}
                py={2}
                borderTopWidth="1px"
                borderColor={panelBorder}
                cursor="pointer"
                color={red}
                bg={confirmingDiscard ? dangerHoverBg : undefined}
                transition="background 0.12s ease"
                _hover={{ bg: dangerHoverBg, _disabled: { bg: 'transparent' } }}
                _disabled={{ opacity: busy === 'discard' ? 1 : dirtyCount === 0 ? 0.4 : 0.45, cursor: 'default' }}
                _focus={suppressFocusRing}
                _focusVisible={suppressFocusRing}
                disabled={busy !== null || dirtyCount === 0}
                onClick={() => {
                  if (!confirmingDiscard) {
                    setConfirmingDiscard(true);
                    return;
                  }
                  setConfirmingDiscard(false);
                  runAction('discard', () => gitApi().rootGitDiscard(), 'Discard changes');
                }}
                onMouseLeave={() => setConfirmingDiscard(false)}
              >
                {busy === 'discard' ? <Spinner size="xs" /> : <RotateCcw size={12} strokeWidth={2.2} />}
                <Text fontSize="11px" fontWeight={600}>
                  {confirmingDiscard ? 'Click again to confirm — resets to HEAD' : 'Discard changes'}
                </Text>
              </chakra.button>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
