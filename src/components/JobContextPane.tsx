import React, { useState, useCallback, useRef } from 'react';
import { useColorModeValue } from './ui/color-mode';
import {
  Box,
  Text,
  Flex,
  VStack,
  Badge,
  Button,
  IconButton,
  Spinner,
  Textarea,
} from '@chakra-ui/react';
import { Briefcase, RefreshCw, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { useJobContextSelection } from '../context/AppContext';
import { useYearNavigation } from '../hooks/useYearNavigation';
import { runJobContextAnalysis, type JobContextData } from '../services/jobContextService';
import {
  docuFramePalette,
  dfHomeIconColor,
  DF_GROUP_HEADER_LAYER_TEXT,
  DF_GROUP_HEADER_PILL_TEXT,
} from '../docuFrameColors';

const PANE_WIDTH = 420;

type AnalysisStatus = 'idle' | 'loading' | 'done' | 'error';

interface JobContextState {
  status: AnalysisStatus;
  data: JobContextData | null;
  error: string | null;
  userNotes: string;
}

function getEntityBadgeColor(entityType: string): string {
  const t = entityType.toLowerCase();
  if (t.includes('look-through') || t.includes('ltc')) return 'purple';
  if (t.includes('company')) return 'blue';
  if (t.includes('trust')) return 'green';
  if (t.includes('partnership')) return 'orange';
  return 'gray';
}

function formatDirForBanner(dir: string): string {
  const segments = dir.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.slice(-3).join(' / ');
}

interface DataRowProps {
  label: string;
  children: React.ReactNode;
  labelColor: string;
  borderColor: string;
}

const DataRow: React.FC<DataRowProps> = ({ label, children, labelColor, borderColor }) => (
  <Box
    borderBottomWidth="1px"
    borderBottomStyle="solid"
    borderBottomColor={borderColor}
    py={2.5}
    px={3}
  >
    <Text fontSize="10px" fontWeight="600" color={labelColor} textTransform="uppercase" letterSpacing="0.06em" mb={1}>
      {label}
    </Text>
    {children}
  </Box>
);

export const JobContextPane: React.FC = () => {
  const { currentDirectory, folderItems, setIsJobContextOpen, addLog, setStatus } = useJobContextSelection();
  const yearNav = useYearNavigation(currentDirectory);
  const isValidDirectory = yearNav !== null;

  const [state, setState] = useState<JobContextState>({
    status: 'idle',
    data: null,
    error: null,
    userNotes: '',
  });
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const analysingRef = useRef(false);

  // Colors — aligned to docuFramePalette, same pattern as ClientInfoPane
  const bgColor = useColorModeValue(docuFramePalette.light.canvas, docuFramePalette.dark.canvas);
  const headerBg = useColorModeValue(docuFramePalette.light.footer, docuFramePalette.dark.tabStrip);
  const borderColor = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const textColor = useColorModeValue('#334155', 'white');
  const secondaryTextColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);
  const labelColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);
  const rowValueColor = useColorModeValue('#334155', 'white');
  const emptyBg = useColorModeValue(
    docuFramePalette.light.rowSelected,
    `linear-gradient(180deg, ${docuFramePalette.dark.canvas} 0%, ${docuFramePalette.dark.rowSelected} 100%)`
  );
  const emptyIconColor = useColorModeValue(dfHomeIconColor.light, dfHomeIconColor.dark);
  const emptySubtextColor = useColorModeValue(
    docuFramePalette.light.subtext,
    DF_GROUP_HEADER_LAYER_TEXT
  );
  const emptyTitleColor = useColorModeValue('#334155', DF_GROUP_HEADER_PILL_TEXT);
  const bannerBg = useColorModeValue('#fefce8', '#422006');
  const bannerBorderColor = useColorModeValue('#fde047', '#854d0e');
  const bannerTextColor = useColorModeValue('#713f12', '#fde68a');
  const notesBg = useColorModeValue(docuFramePalette.light.footer, docuFramePalette.dark.tabStrip);
  const accentText = 'white';

  const handleAnalyse = useCallback(async () => {
    if (analysingRef.current) return;
    analysingRef.current = true;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    addLog('Job context analysis started');
    setStatus('Analysing job context...', 'info');
    try {
      const data = await runJobContextAnalysis(currentDirectory, folderItems);
      setState((prev) => ({ ...prev, status: 'done', data, error: null }));
      addLog('Job context analysis complete');
      setStatus('Job context ready', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setState((prev) => ({ ...prev, status: 'error', error: msg }));
      addLog(`Job context error: ${msg}`, 'error');
      setStatus('Job context analysis failed', 'error');
    } finally {
      analysingRef.current = false;
    }
  }, [currentDirectory, folderItems, addLog, setStatus]);

  const handleSaveNotes = useCallback(() => {
    setState((prev) => ({ ...prev, userNotes: notesInput }));
    setIsEditingNotes(false);
  }, [notesInput]);

  const handleCancelNotes = useCallback(() => {
    setNotesInput(state.userNotes);
    setIsEditingNotes(false);
  }, [state.userNotes]);

  const handleStartEditNotes = useCallback(() => {
    setNotesInput(state.userNotes);
    setIsEditingNotes(true);
  }, [state.userNotes]);

  const isDifferentDirectory = state.data !== null && state.data.analyzedDirectory !== currentDirectory;

  // — Placeholder: not in annual accounts directory —
  if (!isValidDirectory) {
    return (
      <Box
        w={`${PANE_WIDTH}px`}
        h="100%"
        bg={emptyBg}
        display="flex"
        flexDirection="column"
        overflow="hidden"
        position="relative"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px={3}
          py={2}
          borderBottomWidth="1px"
          borderBottomStyle="solid"
          borderBottomColor={borderColor}
          bg={headerBg}
          flexShrink={0}
        >
          <Flex align="center" gap={2}>
            <Briefcase size={15} color={labelColor} />
            <Text fontSize="sm" fontWeight="600" color={textColor}>Job Context</Text>
          </Flex>
          <IconButton
            aria-label="Close job context"
            size="xs"
            variant="ghost"
            onClick={() => setIsJobContextOpen(false)}
            _focus={{ outline: 'none', boxShadow: 'none' }}
            _focusVisible={{ outline: 'none', boxShadow: 'none' }}
          >
            <X size={14} />
          </IconButton>
        </Flex>

        {/* Empty state */}
        <VStack flex="1" justify="center" align="center" gap={3} px={6} textAlign="center">
          <Briefcase size={36} color={emptyIconColor} />
          <Text fontSize="sm" fontWeight="600" color={emptyTitleColor}>Navigate to a client year folder</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      w={`${PANE_WIDTH}px`}
      h="100%"
      bg={bgColor}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Header */}
      <Flex
        align="center"
        justify="space-between"
        px={3}
        py={2}
        borderBottomWidth="1px"
        borderBottomStyle="solid"
        borderBottomColor={borderColor}
        bg={headerBg}
        flexShrink={0}
      >
        <Flex align="center" gap={2}>
          <Briefcase size={15} color={labelColor} />
          <Text fontSize="sm" fontWeight="600" color={textColor}>Job Context</Text>
        </Flex>
        <Flex align="center" gap={1}>
          {state.status !== 'loading' && (
            <Button
              size="xs"
              variant="solid"
              bg="#3b82f6"
              color={accentText}
              _hover={{ opacity: 0.88 }}
              onClick={handleAnalyse}
            >
              {state.status === 'done' ? <><RefreshCw size={11} />Re-analyse</> : 'Analyse'}
            </Button>
          )}
          <IconButton
            aria-label="Close job context"
            size="xs"
            variant="ghost"
            onClick={() => setIsJobContextOpen(false)}
            _focus={{ outline: 'none', boxShadow: 'none' }}
            _focusVisible={{ outline: 'none', boxShadow: 'none' }}
          >
            <X size={14} />
          </IconButton>
        </Flex>
      </Flex>

      {/* Directory indicator */}
      <Box px={3} py={1.5} borderBottomWidth="1px" borderBottomStyle="solid" borderBottomColor={borderColor} flexShrink={0}>
        <Text
          fontSize="10px"
          color={secondaryTextColor}
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          title={currentDirectory}
        >
          {formatDirForBanner(currentDirectory)}
        </Text>
      </Box>

      {/* Different directory banner */}
      {isDifferentDirectory && (
        <Flex
          align="flex-start"
          gap={1.5}
          px={3}
          py={2}
          bg={bannerBg}
          borderBottomWidth="1px"
          borderBottomStyle="solid"
          borderBottomColor={bannerBorderColor}
          flexShrink={0}
        >
          <AlertTriangle size={13} color={bannerTextColor} style={{ marginTop: 1, flexShrink: 0 }} />
          <Text fontSize="10px" color={bannerTextColor} lineHeight="1.5">
            Context is from <strong>{formatDirForBanner(state.data!.analyzedDirectory)}</strong>. Click Re-analyse to refresh for current folder.
          </Text>
        </Flex>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <Box px={3} py={3} flexShrink={0}>
          <Text fontSize="xs" color="red.500">{state.error}</Text>
        </Box>
      )}

      {/* Loading overlay placeholder */}
      {state.status === 'loading' && (
        <VStack flex="1" justify="center" align="center" gap={3}>
          <Spinner size="md" color="blue.400" />
          <Text fontSize="xs" color={secondaryTextColor}>Analysing job context…</Text>
        </VStack>
      )}

      {/* Idle with no data */}
      {state.status === 'idle' && !state.data && (
        <VStack flex="1" justify="center" align="center" gap={3} px={6} textAlign="center">
          <Text fontSize="xs" color={emptySubtextColor}>Click Analyse to scan this directory and retrieve job context.</Text>
        </VStack>
      )}

      {/* Data rows */}
      {state.data !== null && state.status !== 'loading' && (
        <Box flex="1" overflowY="auto" overflowX="hidden">
          {/* Entity Type */}
          <DataRow label="Entity Type" labelColor={labelColor} borderColor={borderColor}>
            <Badge colorPalette={getEntityBadgeColor(state.data.entityType)} size="sm" variant="subtle">
              {state.data.entityType}
            </Badge>
          </DataRow>

          {/* Industry Classification */}
          <DataRow label="Industry Classification" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor}>{state.data.industryClassification || '—'}</Text>
          </DataRow>

          {/* Previous Budget */}
          <DataRow label="Previous Budget" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor} fontVariantNumeric="tabular-nums">{state.data.previousBudget || '—'}</Text>
          </DataRow>

          {/* Current Budget */}
          <DataRow label="Current Budget" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor} fontVariantNumeric="tabular-nums">{state.data.currentBudget || '—'}</Text>
          </DataRow>

          {/* Budgeted Hours */}
          <DataRow label="Budgeted Hours" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor}>
              {state.data.budgetedHours > 0 ? `${state.data.budgetedHours} hrs` : '—'}
            </Text>
          </DataRow>

          {/* Job Inclusions */}
          <DataRow label="Job Inclusions" labelColor={labelColor} borderColor={borderColor}>
            {state.data.jobInclusions.length === 0 ? (
              <Text fontSize="xs" color={rowValueColor}>—</Text>
            ) : (
              <VStack align="start" gap={0.5}>
                {state.data.jobInclusions.map((inc, i) => (
                  <Text key={i} fontSize="xs" color={rowValueColor}>
                    {inc.count > 1 ? `${inc.count}x ` : ''}{inc.type}
                  </Text>
                ))}
              </VStack>
            )}
          </DataRow>

          {/* AI Job Summary */}
          <DataRow label="AI Job Summary" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor} lineHeight="1.5">{state.data.aiJobSummary || '—'}</Text>
          </DataRow>

          {/* Risk Areas */}
          <DataRow label="Risk Areas" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor} lineHeight="1.6" whiteSpace="pre-wrap">{state.data.riskAreas || '—'}</Text>
          </DataRow>

          {/* Time Traps */}
          <DataRow label="Time Traps" labelColor={labelColor} borderColor={borderColor}>
            <Text fontSize="xs" color={rowValueColor} lineHeight="1.6" whiteSpace="pre-wrap">{state.data.timeTraps || '—'}</Text>
          </DataRow>

          {/* Notes */}
          <Box
            borderBottomWidth="1px"
            borderBottomStyle="solid"
            borderBottomColor={borderColor}
            py={2.5}
            px={3}
          >
            <Flex align="center" justify="space-between" mb={1}>
              <Text fontSize="10px" fontWeight="600" color={labelColor} textTransform="uppercase" letterSpacing="0.06em">
                Notes
              </Text>
              {!isEditingNotes ? (
                <IconButton
                  aria-label="Edit notes"
                  size="xs"
                  variant="ghost"
                  onClick={handleStartEditNotes}
                  _focus={{ outline: 'none', boxShadow: 'none' }}
                  _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                >
                  <Pencil size={12} />
                </IconButton>
              ) : (
                <Flex gap={1}>
                  <IconButton
                    aria-label="Save notes"
                    size="xs"
                    variant="ghost"
                    colorPalette="green"
                    onClick={handleSaveNotes}
                    _focus={{ outline: 'none', boxShadow: 'none' }}
                    _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                  >
                    <Check size={12} />
                  </IconButton>
                  <IconButton
                    aria-label="Cancel notes"
                    size="xs"
                    variant="ghost"
                    onClick={handleCancelNotes}
                    _focus={{ outline: 'none', boxShadow: 'none' }}
                    _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                  >
                    <X size={12} />
                  </IconButton>
                </Flex>
              )}
            </Flex>
            {isEditingNotes ? (
              <Textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                size="sm"
                rows={4}
                bg={notesBg}
                fontSize="xs"
                resize="vertical"
                placeholder="Add notes about this job…"
              />
            ) : (
              <Text
                fontSize="xs"
                color={state.userNotes ? rowValueColor : secondaryTextColor}
                lineHeight="1.5"
                whiteSpace="pre-wrap"
                minH="32px"
                cursor="text"
                onClick={handleStartEditNotes}
                _hover={{ opacity: 0.8 }}
              >
                {state.userNotes || 'Click pencil to add notes…'}
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};
