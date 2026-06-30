import React, { useMemo } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { Box, Text, Flex, IconButton } from '@chakra-ui/react';
import { ListChecks, Check, X, Layers } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import {
  extractIndexPrefix,
  getAllIndexKeys,
  WORKPAPER_DESCRIPTIONS,
} from '../utils/indexPrefix';
import { docuFramePalette, DF_SESSION_RAIL_BG, dfHomeIconColor } from '../docuFrameColors';

const PANE_WIDTH = 420;

interface SectionRow {
  key: string;
  description: string;
  count: number;
  checked: boolean;
}

export const SectionChecklistPane: React.FC = () => {
  const {
    folderItems,
    isSectionPaneOpen,
    setIsSectionPaneOpen,
    currentManualActiveSections,
    currentDeactivatedSections,
    setSectionActive,
    sessionLayerViewEnabled,
  } = useAppContext();

  // Colors — aligned to docuFramePalette
  const headerBg = useColorModeValue(docuFramePalette.light.footer, docuFramePalette.dark.tabStrip);
  const borderColor = useColorModeValue(docuFramePalette.light.border, docuFramePalette.dark.border);
  const bgColor = useColorModeValue(docuFramePalette.light.canvas, docuFramePalette.dark.canvas);
  const textColor = useColorModeValue('#334155', 'white');
  const subColor = useColorModeValue(docuFramePalette.light.subtext, docuFramePalette.dark.subtext);
  const rowHoverBg = useColorModeValue(docuFramePalette.light.rowHover, docuFramePalette.dark.rowHover);
  const pillBg = useColorModeValue('#e2e8f0', '#2a3142');
  const pillText = useColorModeValue('#334155', '#CBD5E0');
  const countBg = useColorModeValue('#cce4f7', '#1a365d');
  const checkboxBorder = useColorModeValue('#94a3b8', '#4a5568');
  const accent = DF_SESSION_RAIL_BG;
  const iconColor = useColorModeValue(dfHomeIconColor.light, dfHomeIconColor.dark);
  const bannerBg = useColorModeValue('#fefce8', '#422006');
  const bannerBorder = useColorModeValue('#fde047', '#854d0e');
  const bannerText = useColorModeValue('#713f12', '#fde68a');

  // Count files per known section prefix in the current folder
  const presentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (folderItems || []).forEach((item) => {
      if (item.type === 'folder') return;
      const prefix = extractIndexPrefix(item.name);
      if (prefix && WORKPAPER_DESCRIPTIONS[prefix]) {
        counts[prefix] = (counts[prefix] ?? 0) + 1;
      }
    });
    return counts;
  }, [folderItems]);

  // Ordered section list — AA first, then the rest alphabetically (matches layer-view ordering)
  const rows = useMemo<SectionRow[]>(() => {
    const keys = getAllIndexKeys();
    const ordered = ['AA', ...keys.filter((k) => k !== 'AA')];
    const manualSet = new Set(currentManualActiveSections);
    const deactivatedSet = new Set(currentDeactivatedSections);
    return ordered.map((key) => {
      const count = presentCounts[key] ?? 0;
      const checked = (count > 0 && !deactivatedSet.has(key)) || manualSet.has(key);
      return { key, description: WORKPAPER_DESCRIPTIONS[key] ?? '', count, checked };
    });
  }, [presentCounts, currentManualActiveSections, currentDeactivatedSections]);

  const activeCount = rows.filter((r) => r.checked).length;

  const toggle = (row: SectionRow) => {
    setSectionActive(row.key, !row.checked, row.count > 0);
  };

  return (
    <Box w={`${PANE_WIDTH}px`} h="100%" bg={bgColor} display="flex" flexDirection="column" overflow="hidden">
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
          <ListChecks size={15} color={subColor} />
          <Text fontSize="sm" fontWeight="600" color={textColor}>
            Workpaper Sections
          </Text>
          <Box
            px={1.5}
            py={0.5}
            borderRadius="full"
            bg={countBg}
            fontSize="10px"
            fontWeight="700"
            color={textColor}
            lineHeight="1"
          >
            {activeCount}
          </Box>
        </Flex>
        <IconButton
          aria-label="Close workpaper sections"
          size="xs"
          variant="ghost"
          onClick={() => setIsSectionPaneOpen(false)}
          _focus={{ outline: 'none', boxShadow: 'none' }}
          _focusVisible={{ outline: 'none', boxShadow: 'none' }}
        >
          <X size={14} />
        </IconButton>
      </Flex>

      {/* Layer-view-off hint */}
      {!sessionLayerViewEnabled && (
        <Flex
          align="center"
          gap={2}
          px={3}
          py={2}
          bg={bannerBg}
          borderBottomWidth="1px"
          borderBottomStyle="solid"
          borderBottomColor={bannerBorder}
          flexShrink={0}
        >
          <Layers size={13} color={bannerText} />
          <Text fontSize="11px" color={bannerText}>
            Layer view is off — turn it on to see these sections applied.
          </Text>
        </Flex>
      )}

      {/* Intro */}
      <Box px={3} pt={2.5} pb={1.5} flexShrink={0}>
        <Text fontSize="11px" color={subColor} lineHeight="1.45">
          Tick a section to show its header (a drop target appears even with no file yet). Untick to
          fold its files into <Text as="span" fontWeight="600" color={textColor}>Other</Text> for this session.
        </Text>
      </Box>

      {/* Checklist */}
      <Box flex="1" overflowY="auto" px={1.5} pb={3} className="enhanced-scrollbar">
        {rows.map((row) => (
          <Flex
            key={row.key}
            align="center"
            gap={2.5}
            px={2}
            py={1.5}
            borderRadius="6px"
            cursor="pointer"
            onClick={() => toggle(row)}
            _hover={{ bg: rowHoverBg }}
            transition="background 0.12s"
          >
            {/* Checkbox */}
            <Flex
              align="center"
              justify="center"
              w="17px"
              h="17px"
              borderRadius="4px"
              flexShrink={0}
              borderWidth="1.5px"
              borderStyle="solid"
              borderColor={row.checked ? accent : checkboxBorder}
              bg={row.checked ? accent : 'transparent'}
              transition="all 0.12s"
            >
              {row.checked && <Check size={12} color="white" strokeWidth={3} />}
            </Flex>

            {/* Index pill */}
            <Box
              minW="34px"
              textAlign="center"
              px={1.5}
              py={0.5}
              borderRadius="4px"
              bg={pillBg}
              fontSize="11px"
              fontWeight="700"
              color={pillText}
              flexShrink={0}
            >
              {row.key}
            </Box>

            {/* Description */}
            <Text
              flex="1"
              fontSize="12px"
              color={row.checked ? textColor : subColor}
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {row.description}
            </Text>

            {/* File count */}
            {row.count > 0 && (
              <Box
                px={1.5}
                py={0.5}
                borderRadius="full"
                bg={countBg}
                fontSize="10px"
                fontWeight="700"
                color={textColor}
                flexShrink={0}
                lineHeight="1"
              >
                {row.count}
              </Box>
            )}
          </Flex>
        ))}
      </Box>
    </Box>
  );
};
