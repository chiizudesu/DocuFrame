import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Button, Box, Text, Flex, Input, Dialog, Portal, chakra } from '@chakra-ui/react';
import { Search } from 'lucide-react';
import { getAllIndexKeys, getIndexInfo, extractIndexPrefix } from '../utils/indexPrefix';
import { useAppContext } from '../context/AppContext';
import type { FileItem } from '../types';

interface IndexPrefixDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (indexKey: string | null, isCopy?: boolean) => void;
  currentPrefix?: string | null;
  title?: string;
  files?: FileItem[];
  allowCopy?: boolean;
}

const IndexPrefixDialogInner: React.FC<IndexPrefixDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentPrefix,
  title = 'Select Index Prefix',
  files = [],
  allowCopy = false,
}) => {
  const { folderItems } = useAppContext();
  const [selectedIndex, setSelectedIndex] = useState<string | null>(currentPrefix || null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    selectedBg,
    textColor,
    secondaryTextColor: descColor,
  } = useDialogChrome();
  const hoverBg = useColorModeValue('gray.50', 'df.rowHover');
  const keyColor = useColorModeValue('blue.600', 'blue.300');
  const countBg = useColorModeValue('gray.100', 'whiteAlpha.200');
  const sectionLabelColor = useColorModeValue('gray.500', 'gray.400');
  const currentMarker = useColorModeValue('blue.500', 'blue.300');

  const allKeys = useMemo(() => getAllIndexKeys(), []);

  // How many files in the current folder carry each prefix — "active" sections
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of folderItems || []) {
      if (item.type === 'folder') continue;
      const prefix = extractIndexPrefix(item.name);
      if (prefix) map[prefix] = (map[prefix] || 0) + 1;
    }
    return map;
  }, [folderItems]);

  const activeKeys = useMemo(
    () => allKeys.filter(k => counts[k] > 0 || k === currentPrefix),
    [allKeys, counts, currentPrefix]
  );

  const query = search.trim().toLowerCase();

  // Searching always covers every section; otherwise active-first with opt-in "show all"
  const visibleKeys = useMemo(() => {
    if (query) {
      const keyHits = allKeys.filter(k => k.toLowerCase().startsWith(query));
      const descHits = allKeys.filter(
        k => !k.toLowerCase().startsWith(query) && getIndexInfo(k).description.toLowerCase().includes(query)
      );
      return [...keyHits, ...descHits];
    }
    if (activeKeys.length === 0) return allKeys;
    if (showAll) return [...activeKeys, ...allKeys.filter(k => !activeKeys.includes(k))];
    return activeKeys;
  }, [query, showAll, activeKeys, allKeys]);

  const restKeys = useMemo(
    () => (showAll && !query ? allKeys.filter(k => !activeKeys.includes(k)) : []),
    [showAll, query, allKeys, activeKeys]
  );

  const applySelection = (key: string | null, isCopy: boolean) => {
    onSelect(key, key === null ? false : isCopy);
    onClose();
  };

  const moveSelection = (delta: number) => {
    if (visibleKeys.length === 0) return;
    const current = selectedIndex && visibleKeys.includes(selectedIndex) ? visibleKeys.indexOf(selectedIndex) : -1;
    const next = current === -1
      ? (delta > 0 ? 0 : visibleKeys.length - 1)
      : Math.min(Math.max(current + delta, 0), visibleKeys.length - 1);
    const key = visibleKeys[next];
    setSelectedIndex(key);
    listRef.current
      ?.querySelector(`[data-index-key="${key}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectedIndex && visibleKeys.includes(selectedIndex) ? selectedIndex : visibleKeys[0];
      if (target) applySelection(target, false);
    }
  };

  // Reset transient state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIndex(currentPrefix || null);
      setSearch('');
      setShowAll(false);
    }
  }, [isOpen, currentPrefix]);

  const renderRow = (indexKey: string) => {
    const info = getIndexInfo(indexKey);
    const isSelected = selectedIndex === indexKey;
    const isCurrent = currentPrefix === indexKey;
    const count = counts[indexKey] || 0;
    return (
      <Flex
        key={indexKey}
        data-index-key={indexKey}
        align="center"
        gap={2}
        px={2}
        py="5px"
        cursor="pointer"
        bg={isSelected ? selectedBg : undefined}
        borderLeftWidth="2px"
        borderLeftColor={isSelected ? 'blue.400' : 'transparent'}
        onClick={() => setSelectedIndex(indexKey)}
        onDoubleClick={() => applySelection(indexKey, false)}
        _hover={{ bg: isSelected ? selectedBg : hoverBg }}
        transition="background 0.1s ease"
        userSelect="none"
      >
        <Text
          fontWeight="bold"
          fontSize="sm"
          color={keyColor}
          w="30px"
          flexShrink={0}
          fontVariantNumeric="tabular-nums"
        >
          {indexKey}
        </Text>
        <Text fontSize="sm" color={textColor} truncate flex="1">
          {info.description}
        </Text>
        {isCurrent && (
          <Text fontSize="10px" fontWeight={600} color={currentMarker} flexShrink={0}>
            current
          </Text>
        )}
        {count > 0 && (
          <Text
            fontSize="11px"
            fontWeight={600}
            color={descColor}
            bg={countBg}
            px="6px"
            py="1px"
            borderRadius="full"
            flexShrink={0}
            fontVariantNumeric="tabular-nums"
          >
            {count}
          </Text>
        )}
      </Flex>
    );
  };

  const sectionLabel = (label: string) => (
    <Text
      fontSize="9px"
      fontWeight={700}
      letterSpacing="0.1em"
      color={sectionLabelColor}
      px={2}
      pt={2}
      pb={1}
      userSelect="none"
    >
      {label}
    </Text>
  );

  const hasActiveView = !query && activeKeys.length > 0;

  return (
    <Dialog.Root
      open={isOpen}
      size='md'
      placement='center'
      initialFocusEl={() => searchRef.current}
      onOpenChange={e => {
        if (!e.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content bg={bgColor} borderRadius="lg" maxW="480px">
            <Dialog.Header fontSize="lg" pb={2} bg={titleBarBg} borderBottomWidth="1px" borderColor={borderColor}>
              <Flex align="baseline" gap={2} w="100%" minW={0}>
                <Text>{title}</Text>
                {files.length > 0 && (
                  <Text fontSize="xs" color={descColor} fontWeight="normal" truncate>
                    {files.length === 1 ? files[0].name : `${files.length} files · ${files[0].name} +${files.length - 1}`}
                  </Text>
                )}
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body pt={3} pb={2} px={3}>
              <Flex
                align="center"
                gap={2}
                px={2}
                mb={2}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="md"
              >
                <Search size={13} color="var(--chakra-colors-gray-400)" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Type to filter sections… ↑↓ to move, Enter to apply"
                  size="sm"
                  variant="outline"
                  border="none"
                  px={0}
                  _focus={{ boxShadow: 'none', outline: 'none' }}
                  _focusVisible={{ boxShadow: 'none', outline: 'none' }}
                />
              </Flex>
              <Box ref={listRef} maxH="340px" overflowY="auto" mx={-1} px={1}>
                {visibleKeys.length === 0 && (
                  <Text fontSize="sm" color={descColor} px={2} py={4} textAlign="center">
                    No sections match “{search.trim()}”
                  </Text>
                )}
                {hasActiveView && sectionLabel(`IN THIS FOLDER · ${activeKeys.length}`)}
                {(hasActiveView ? activeKeys : visibleKeys).map(renderRow)}
                {restKeys.length > 0 && (
                  <>
                    {sectionLabel('ALL SECTIONS')}
                    {restKeys.map(renderRow)}
                  </>
                )}
                {hasActiveView && (
                  <chakra.button
                    display="block"
                    w="100%"
                    textAlign="left"
                    px={2}
                    py="6px"
                    mt={1}
                    fontSize="xs"
                    fontWeight={600}
                    color={keyColor}
                    cursor="pointer"
                    _hover={{ bg: hoverBg }}
                    _focus={{ outline: 'none' }}
                    onClick={() => setShowAll(v => !v)}
                  >
                    {showAll ? '− Show active only' : `+ Show all ${allKeys.length} sections`}
                  </chakra.button>
                )}
              </Box>
            </Dialog.Body>
            <Dialog.Footer pt={2} gap={2} flexWrap="wrap">
              {currentPrefix && (
                <Button
                  variant="ghost"
                  colorPalette="red"
                  size="sm"
                  mr="auto"
                  onClick={() => applySelection(null, false)}
                >
                  Remove
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} size="sm">
                Cancel
              </Button>
              {allowCopy && selectedIndex && (
                <Button
                  colorPalette="green"
                  size="sm"
                  onClick={() => applySelection(selectedIndex, true)}
                >
                  Add Copy
                </Button>
              )}
              <Button
                colorPalette="blue"
                size="sm"
                disabled={!selectedIndex}
                onClick={() => selectedIndex && applySelection(selectedIndex, false)}
              >
                {currentPrefix ? 'Change Prefix' : 'Apply Prefix'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export const IndexPrefixDialog = memo(IndexPrefixDialogInner);
