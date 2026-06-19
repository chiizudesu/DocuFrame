import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from "@/components/ui/toaster"
import {
  Button,
  Input,
  IconButton,
  Box,
  Text,
  VStack,
  HStack,
  Flex,
  Collapsible,
  Badge,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Check as LuCheck, ChevronDown as LuChevronDown, ChevronRight as LuChevronRight, Pencil as LuPencil, Plus as LuPlus, Search as LuSearch, Trash2 as LuTrash2, TriangleAlert as LuTriangleAlert, X as LuX } from 'lucide-react';

interface TransferMapping {
  command: string;
  filename: string;
}

interface TransferMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONO_FONT = "'Cascadia Code', Consolas, ui-monospace, monospace";

/** Deterministic accent per workpaper section so the index rail reads like ledger tabs */
const GROUP_PALETTES = ['blue', 'teal', 'purple', 'orange', 'cyan', 'green', 'pink', 'yellow', 'red'] as const;
const groupPalette = (groupKey: string): string =>
  groupKey === 'Other' ? 'gray' : GROUP_PALETTES[groupKey.charCodeAt(0) % GROUP_PALETTES.length];

const WORKPAPER_DESCRIPTIONS: { [key: string]: string } = {
  'A1': 'Permanent', 'A2': 'Job Notes', 'A3': 'Other Checks',
  'A4': 'Financial Statements, Tax Returns & Minutes', 'A5': 'Individuals',
  'C': 'Bank Reconciliation', 'D': 'Accounts Receivable',
  'E': 'Other Current Assets', 'E1': 'Inventory', 'E2': 'Prepayments',
  'F': 'Fixed Assets', 'F1': 'Non-Current Assets', 'G': 'Accounts Payable',
  'H': 'Other Current Liabilities', 'H1': 'Non-Current Liabilities',
  'I': 'Loans', 'I2': 'Finance Lease', 'I3': 'Operating Lease Commitments',
  'J': 'Investments', 'K': 'GST', 'L': 'Income Tax',
  'M': 'Imputation Credits', 'M2': 'Imputation Credits to RE',
  'N': 'Shareholder/Beneficiary Current Accounts',
  'O': 'Equity, Capital, Accumulations', 'P': 'Intangibles',
  'Q': 'Profit & Loss', 'R': 'Entertainment', 'S': 'Home Office', 'W': 'Wages',
};

/** Command token styled as a typed keycap — these are literally what the user types */
const CommandKeycap: React.FC<{ command: string; bg: string; borderColor: string; color: string }> = ({ command, bg, borderColor, color }) => (
  <Box
    as="span"
    display="inline-block"
    fontFamily={MONO_FONT}
    fontSize="11px"
    fontWeight="600"
    lineHeight="1.4"
    px={1.5}
    py="1px"
    bg={bg}
    border="1px solid"
    borderColor={borderColor}
    borderBottomWidth="2px"
    borderRadius="4px"
    color={color}
    maxW="100%"
    overflow="hidden"
    textOverflow="ellipsis"
    whiteSpace="nowrap"
  >
    {command}
  </Box>
);

export const TransferMappingDialog: React.FC<TransferMappingDialogProps> = ({ isOpen, onClose }) => {
  const [mappings, setMappings] = useState<TransferMapping[]>([]);
  const [initialMappings, setInitialMappings] = useState<TransferMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const [editFilename, setEditFilename] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const newCommandRef = useRef<HTMLInputElement>(null);
  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    cardBg,
    textColor,
    secondaryTextColor,
    inputBg,
    accentText,
  } = useDialogChrome();
  const rowHoverBg = useColorModeValue('gray.100', 'gray.600');
  const groupHeaderHoverBg = useColorModeValue('gray.100', 'gray.700');
  const keycapBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const keycapBorder = useColorModeValue('gray.300', 'whiteAlpha.300');
  const columnLabelColor = useColorModeValue('gray.500', 'gray.400');
  const dirtyDotColor = useColorModeValue('orange.500', 'orange.300');

  const isSearching = searchQuery.trim().length > 0;

  // Filter (against command + filename), then group — indexMap always points into the
  // unfiltered `mappings` array so edit/delete stay correct while a search is active.
  const { groupedMappings, indexMap, visibleCount } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const candidates = mappings
      .map((mapping, originalIndex) => ({ mapping, originalIndex }))
      .filter(({ mapping }) =>
        !query ||
        mapping.command.toLowerCase().includes(query) ||
        mapping.filename.toLowerCase().includes(query)
      );

    const groups: { [key: string]: { mapping: TransferMapping; originalIndex: number }[] } = {};
    candidates.forEach(entry => {
      const match = entry.mapping.filename.match(/^([A-Z](?:-?\d+)?)\s*-/);
      const groupKey = match ? match[1] : 'Other';
      (groups[groupKey] ||= []).push(entry);
    });

    const sortedGroups: { [key: string]: TransferMapping[] } = {};
    const sortedIndexMap: { [key: string]: number[] } = {};
    Object.keys(groups)
      .sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .forEach(key => {
        const sorted = [...groups[key]].sort((a, b) => a.mapping.command.localeCompare(b.mapping.command));
        sortedGroups[key] = sorted.map(item => item.mapping);
        sortedIndexMap[key] = sorted.map(item => item.originalIndex);
      });

    return { groupedMappings: sortedGroups, indexMap: sortedIndexMap, visibleCount: candidates.length };
  }, [mappings, searchQuery]);

  // Commands defined more than once silently shadow each other on save — surface them
  const duplicateCommands = useMemo(() => {
    const counts = new Map<string, number>();
    mappings.forEach(m => {
      const key = m.command.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [mappings]);

  const changeCount = useMemo(() => {
    const initial = new Map(initialMappings.map(m => [m.command, m.filename]));
    const current = new Map(mappings.map(m => [m.command, m.filename]));
    let count = 0;
    current.forEach((filename, command) => {
      if (!initial.has(command) || initial.get(command) !== filename) count++;
    });
    initial.forEach((_, command) => {
      if (!current.has(command)) count++;
    });
    return count;
  }, [mappings, initialMappings]);

  const getOriginalIndex = (groupKey: string, relativeIndex: number): number => {
    return indexMap[groupKey]?.[relativeIndex] ?? -1;
  };

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupKey)) newCollapsed.delete(groupKey);
    else newCollapsed.add(groupKey);
    setCollapsedGroups(newCollapsed);
  };

  const collapseAll = () => setCollapsedGroups(new Set(Object.keys(groupedMappings)));
  const expandAll = () => setCollapsedGroups(new Set());

  useEffect(() => {
    const loadMappings = async () => {
      if (isOpen) {
        try {
          const config = await window.electronAPI.getConfig();
          if (config?.transferCommandMappings) {
            const mappingArray = Object.entries(config.transferCommandMappings).map(([command, filename]) => ({
              command,
              filename: filename as string
            }));
            setMappings(mappingArray);
            setInitialMappings(mappingArray);
          }
          setSearchQuery('');
          setEditingIndex(null);
          setNewCommand('');
          setNewFilename('');
        } catch (error) {
          console.error('Error loading mappings:', error);
          showToast({ title: 'Error', description: 'Failed to load transfer mappings', status: 'error', duration: 3000, isClosable: true });
        }
      }
    };
    loadMappings();
  }, [isOpen]);

  const handleSave = async () => {
    try {
      const transferCommandMappings = mappings.reduce((acc, { command, filename }) => {
        acc[command] = filename;
        return acc;
      }, {} as { [key: string]: string });
      const config = await window.electronAPI.getConfig();
      await window.electronAPI.setConfig({ ...config, transferCommandMappings });
      showToast({ title: 'Success', description: 'Transfer mappings saved successfully', status: 'success', duration: 3000, isClosable: true });
      window.dispatchEvent(new CustomEvent('transferMappingsUpdated'));
      onClose();
    } catch (error) {
      console.error('Error saving transfer mappings:', error);
      showToast({ title: 'Error', description: 'Failed to save transfer mappings', status: 'error', duration: 3000, isClosable: true });
    }
  };

  const handleAdd = () => {
    if (newCommand.trim() && newFilename.trim()) {
      setMappings([...mappings, { command: newCommand.trim(), filename: newFilename.trim() }]);
      setNewCommand('');
      setNewFilename('');
      newCommandRef.current?.focus();
    }
  };

  const handleDelete = (absoluteIndex: number) => {
    setMappings(mappings.filter((_, i) => i !== absoluteIndex));
  };

  const startEdit = (absoluteIndex: number) => {
    setEditingIndex(absoluteIndex);
    setEditCommand(mappings[absoluteIndex].command);
    setEditFilename(mappings[absoluteIndex].filename);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editCommand.trim() && editFilename.trim()) {
      const updatedMappings = [...mappings];
      updatedMappings[editingIndex] = { command: editCommand.trim(), filename: editFilename.trim() };
      setMappings(updatedMappings);
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditCommand('');
    setEditFilename('');
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: 'add' | 'edit') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (action === 'add') handleAdd();
      else saveEdit();
    } else if (e.key === 'Escape' && action === 'edit') {
      cancelEdit();
    }
  };

  return (
    <Dialog.Root open={isOpen} size='lg' placement='center' onOpenChange={e => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            maxH="85vh"
            maxW="660px"
            borderRadius={0}
            boxShadow="xl"
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            <Dialog.Header
              bg={titleBarBg}
              borderBottom="1px solid"
              borderColor={borderColor}
              borderRadius={0}
              py={1.5}
              minH="31px"
            >
              <Flex align="center" gap={2} pr={10}>
                <Text fontSize="sm" fontWeight="600" color={textColor}>Transfer Command Mappings</Text>
                <Badge colorPalette="blue" variant="subtle" size="sm">{mappings.length} total</Badge>
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body p={0} display="flex" flexDirection="column" flex="1" minH={0} overflow="hidden">
              {/* Toolbar: search + bulk expand/collapse */}
              <Flex
                align="center"
                gap={2}
                px={3}
                py={1.5}
                bg={cardBg}
                borderBottom="1px solid"
                borderColor={borderColor}
                flexShrink={0}
              >
                <Box position="relative" flex={1}>
                  <Box position="absolute" left="7px" top="50%" transform="translateY(-50%)" color={secondaryTextColor} pointerEvents="none">
                    <LuSearch size={12} />
                  </Box>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by command or filename…"
                    size="xs"
                    pl="24px"
                    bg={inputBg}
                    borderColor={borderColor}
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
                  />
                  {isSearching && (
                    <IconButton
                      aria-label="Clear search"
                      size="2xs"
                      variant="ghost"
                      position="absolute"
                      right="2px"
                      top="50%"
                      transform="translateY(-50%)"
                      onClick={() => setSearchQuery('')}
                    ><LuX /></IconButton>
                  )}
                </Box>
                {isSearching && (
                  <Text fontSize="xs" color={secondaryTextColor} flexShrink={0}>
                    {visibleCount} match{visibleCount === 1 ? '' : 'es'}
                  </Text>
                )}
                {!isSearching && Object.keys(groupedMappings).length > 1 && (
                  <HStack gap={0} flexShrink={0}>
                    <Button size="xs" variant="ghost" onClick={expandAll} fontSize="xs" color={secondaryTextColor}>Expand All</Button>
                    <Button size="xs" variant="ghost" onClick={collapseAll} fontSize="xs" color={secondaryTextColor}>Collapse All</Button>
                  </HStack>
                )}
              </Flex>

              {/* Column headers */}
              <Flex
                align="center"
                gap={2}
                px={3}
                pt={1.5}
                pb={0.5}
                flexShrink={0}
              >
                <Text w="26%" pl="26px" fontSize="10px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={columnLabelColor}>
                  Command
                </Text>
                <Text flex={1} fontSize="10px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={columnLabelColor}>
                  Filename Template
                </Text>
              </Flex>

              <Box flex="1" minH={0} overflowY="auto" px={3} pt={0.5} pb={2}>
                <VStack gap={1} align="stretch">
                  {Object.entries(groupedMappings).map(([groupKey, groupMappings]) => {
                    const description = WORKPAPER_DESCRIPTIONS[groupKey] || (groupKey === 'Other' ? 'Non-standard mappings' : '');
                    // Search results always show expanded so matches are never hidden
                    const isCollapsed = !isSearching && collapsedGroups.has(groupKey);
                    const palette = groupPalette(groupKey);

                    return (
                      <Box key={groupKey}>
                        <Box
                          bg={cardBg}
                          borderWidth={1}
                          borderColor={borderColor}
                          borderRadius="sm"
                          px={2}
                          py={1}
                          cursor="pointer"
                          onClick={() => toggleGroup(groupKey)}
                          _hover={{ bg: groupHeaderHoverBg }}
                          transition="background 0.15s"
                        >
                          <Flex align="center" gap={2}>
                            <Box color={secondaryTextColor} display="flex" alignItems="center">
                              {isCollapsed ? <LuChevronRight size={13} /> : <LuChevronDown size={13} />}
                            </Box>
                            <Badge
                              colorPalette={palette}
                              variant="subtle"
                              size="sm"
                              fontFamily={MONO_FONT}
                              fontWeight="700"
                              minW="26px"
                              justifyContent="center"
                            >
                              {groupKey === 'Other' ? '·' : groupKey}
                            </Badge>
                            <Flex align="center" justify="space-between" flex={1} minW={0}>
                              <Text fontSize="xs" color={textColor} fontWeight="500" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                                {description || (groupKey === 'Other' ? 'Other' : '')}
                              </Text>
                              <Text fontSize="xs" color={secondaryTextColor} flexShrink={0} ml={2}>
                                {groupMappings.length}
                              </Text>
                            </Flex>
                          </Flex>
                        </Box>
                        <Collapsible.Root open={!isCollapsed}>
                          <Collapsible.Content>
                            <VStack gap={0} align="stretch" mt={0.5} ml={2}>
                              {groupMappings.map((mapping, relativeIndex) => {
                                const absoluteIndex = getOriginalIndex(groupKey, relativeIndex);
                                const isDuplicate = duplicateCommands.has(mapping.command.trim().toLowerCase());
                                return (
                                  <Box
                                    key={`${groupKey}-${relativeIndex}`}
                                    bg={bgColor}
                                    borderWidth={1}
                                    borderColor={borderColor}
                                    borderRadius="sm"
                                    px={2}
                                    py={1}
                                    className="group"
                                    _hover={{ bg: rowHoverBg }}
                                    transition="background 0.15s"
                                    borderLeftWidth={2}
                                    borderLeftColor={`${palette}.400`}
                                    mt="1px"
                                  >
                                    {editingIndex === absoluteIndex ? (
                                      <Flex align="center" gap={2}>
                                        <Input
                                          value={editCommand}
                                          onChange={(e) => setEditCommand(e.target.value)}
                                          placeholder="Command"
                                          size="xs"
                                          w="26%"
                                          fontFamily={MONO_FONT}
                                          bg={inputBg}
                                          borderColor={borderColor}
                                          onKeyDown={(e) => handleKeyPress(e, 'edit')}
                                          autoFocus
                                        />
                                        <Input
                                          value={editFilename}
                                          onChange={(e) => setEditFilename(e.target.value)}
                                          placeholder="Filename Template"
                                          size="xs"
                                          flex={1}
                                          bg={inputBg}
                                          borderColor={borderColor}
                                          onKeyDown={(e) => handleKeyPress(e, 'edit')}
                                        />
                                        <HStack gap={0.5}>
                                          <IconButton aria-label="Save edit" onClick={saveEdit} colorPalette="green" size="xs" variant="ghost" disabled={!editCommand.trim() || !editFilename.trim()}><LuCheck /></IconButton>
                                          <IconButton aria-label="Cancel edit" onClick={cancelEdit} size="xs" variant="ghost"><LuX /></IconButton>
                                        </HStack>
                                      </Flex>
                                    ) : (
                                      <Flex align="center" gap={2} onClick={() => startEdit(absoluteIndex)} cursor="pointer">
                                        <Box w="26%" flexShrink={0}>
                                          <CommandKeycap command={mapping.command} bg={keycapBg} borderColor={keycapBorder} color={accentText} />
                                        </Box>
                                        <Flex flex={1} minW={0} align="center" gap={1.5}>
                                          <Text fontSize="xs" color={textColor} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                                            {mapping.filename}
                                          </Text>
                                          {isDuplicate && (
                                            <Badge colorPalette="orange" variant="subtle" size="sm" flexShrink={0} title="This command is defined more than once — only one mapping will be kept on save">
                                              <LuTriangleAlert size={10} /> duplicate
                                            </Badge>
                                          )}
                                        </Flex>
                                        <HStack gap={0.5} onClick={(e) => e.stopPropagation()} flexShrink={0} opacity={0} _groupHover={{ opacity: 1 }} transition="opacity 0.15s">
                                          <IconButton aria-label="Edit mapping" onClick={(e) => { e.stopPropagation(); startEdit(absoluteIndex); }} colorPalette="blue" size="xs" variant="ghost"><LuPencil /></IconButton>
                                          <IconButton aria-label="Delete mapping" onClick={(e) => { e.stopPropagation(); handleDelete(absoluteIndex); }} colorPalette="red" size="xs" variant="ghost"><LuTrash2 /></IconButton>
                                        </HStack>
                                      </Flex>
                                    )}
                                  </Box>
                                );
                              })}
                            </VStack>
                          </Collapsible.Content>
                        </Collapsible.Root>
                      </Box>
                    );
                  })}

                  {mappings.length === 0 && (
                    <Box textAlign="center" py={6} color={secondaryTextColor} borderWidth={1} borderColor={borderColor} borderRadius="sm" borderStyle="dashed">
                      <Text fontSize="xs" mb={1}>No mappings defined yet.</Text>
                      <Text fontSize="xs">
                        Type a command like <CommandKeycap command="far" bg={keycapBg} borderColor={keycapBorder} color={accentText} /> below and map it to a filename template.
                      </Text>
                    </Box>
                  )}

                  {mappings.length > 0 && visibleCount === 0 && (
                    <Box textAlign="center" py={6} color={secondaryTextColor} borderWidth={1} borderColor={borderColor} borderRadius="sm" borderStyle="dashed">
                      <Text fontSize="xs">No mappings match “{searchQuery.trim()}”.</Text>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Add new mapping */}
              <Box px={3} py={2} borderTop="1px solid" borderColor={borderColor} bg={cardBg} flexShrink={0}>
                <Flex align="center" gap={2}>
                  <Input
                    ref={newCommandRef}
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="Command (e.g. far)"
                    size="xs"
                    w="26%"
                    fontFamily={MONO_FONT}
                    bg={inputBg}
                    borderColor={borderColor}
                    onKeyDown={(e) => handleKeyPress(e, 'add')}
                  />
                  <Input
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    placeholder="Filename template (e.g. F - Fixed Assets Reconciliation)"
                    size="xs"
                    flex={1}
                    bg={inputBg}
                    borderColor={borderColor}
                    onKeyDown={(e) => handleKeyPress(e, 'add')}
                  />
                  <IconButton
                    aria-label="Add mapping"
                    onClick={handleAdd}
                    colorPalette="blue"
                    size="xs"
                    disabled={!newCommand.trim() || !newFilename.trim()}
                  ><LuPlus /></IconButton>
                </Flex>
              </Box>
            </Dialog.Body>
            <Dialog.Footer borderTopWidth="1px" borderColor={borderColor} py={2}>
              <Flex align="center" justify="space-between" w="100%">
                <Flex align="center" gap={1.5}>
                  {changeCount > 0 && (
                    <>
                      <Box w="6px" h="6px" borderRadius="full" bg={dirtyDotColor} />
                      <Text fontSize="xs" color={secondaryTextColor}>
                        {changeCount} unsaved change{changeCount === 1 ? '' : 's'}
                      </Text>
                    </>
                  )}
                </Flex>
                <HStack gap={2}>
                  <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
                  <Button size="sm" colorPalette="blue" onClick={handleSave} disabled={changeCount === 0}>Save Changes</Button>
                </HStack>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
