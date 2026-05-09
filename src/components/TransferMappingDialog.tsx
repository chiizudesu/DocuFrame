import React, { useState, useEffect, useMemo } from 'react';
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
import { LuCheck, LuChevronDown, LuChevronRight, LuPencil, LuPlus, LuTrash2, LuX } from 'react-icons/lu';

interface TransferMapping {
  command: string;
  filename: string;
}

interface GroupedMappings {
  [key: string]: TransferMapping[];
}

interface TransferMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferMappingDialog: React.FC<TransferMappingDialogProps> = ({ isOpen, onClose }) => {
  const [mappings, setMappings] = useState<TransferMapping[]>([]);
  const [newCommand, setNewCommand] = useState('');
  const [newFilename, setNewFilename] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCommand, setEditCommand] = useState('');
  const [editFilename, setEditFilename] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
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

  // Smart grouping logic
  const { groupedMappings, indexMap } = useMemo(() => {
    const groups: GroupedMappings = {};
    const indexMap: { [key: string]: number[] } = {};

    mappings.forEach((mapping, originalIndex) => {
      const match = mapping.filename.match(/^([A-Z](?:-?\d+)?)\s*-/);
      const groupKey = match ? match[1] : 'Other';

      if (!groups[groupKey]) {
        groups[groupKey] = [];
        indexMap[groupKey] = [];
      }
      groups[groupKey].push(mapping);
      indexMap[groupKey].push(originalIndex);
    });

    const sortedGroups: GroupedMappings = {};
    const sortedIndexMap: { [key: string]: number[] } = {};

    Object.keys(groups)
      .sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .forEach(key => {
        const combined = groups[key].map((mapping, idx) => ({
          mapping,
          originalIndex: indexMap[key][idx]
        }));
        combined.sort((a, b) => a.mapping.command.localeCompare(b.mapping.command));
        sortedGroups[key] = combined.map(item => item.mapping);
        sortedIndexMap[key] = combined.map(item => item.originalIndex);
      });

    return { groupedMappings: sortedGroups, indexMap: sortedIndexMap };
  }, [mappings]);

  const getOriginalIndex = (groupKey: string, relativeIndex: number): number => {
    return indexMap[groupKey]?.[relativeIndex] ?? -1;
  };

  const getGroupInfo = (groupKey: string) => {
    const workpaperDescriptions: { [key: string]: string } = {
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
    const description = workpaperDescriptions[groupKey] || (groupKey === 'Other' ? 'Non-standard mappings' : '');
    return { groupKey, description };
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
          }
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
    <Dialog.Root open={isOpen} size='md' placement='center' onOpenChange={e => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            maxH="85vh"
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
              <Flex align="center" justify="space-between" pr={10}>
                <Flex align="center" gap={2}>
                  <Text fontSize="sm" fontWeight="600" color={textColor}>Transfer Command Mappings</Text>
                  <Badge colorPalette="blue" variant="subtle" size="sm">{mappings.length} total</Badge>
                </Flex>
                {Object.keys(groupedMappings).length > 1 && (
                  <HStack gap={1}>
                    <Button size="xs" variant="ghost" onClick={expandAll} fontSize="xs">Expand All</Button>
                    <Button size="xs" variant="ghost" onClick={collapseAll} fontSize="xs">Collapse All</Button>
                  </HStack>
                )}
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />
            <Dialog.Body p={0} display="flex" flexDirection="column" flex="1" minH={0} overflow="hidden">
              <Box flex="1" minH={0} overflowY="auto" px={3} pt={2} pb={2}>
                <VStack gap={1} align="stretch">
                  {Object.entries(groupedMappings).map(([groupKey, groupMappings]) => {
                    const { groupKey: displayKey, description } = getGroupInfo(groupKey);
                    const isCollapsed = collapsedGroups.has(groupKey);

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
                          <Flex align="center" gap={1.5}>
                            <Box color={secondaryTextColor} display="flex" alignItems="center">
                              {isCollapsed ? <LuChevronRight size={13} /> : <LuChevronDown size={13} />}
                            </Box>
                            <Flex align="center" justify="space-between" flex={1}>
                              <Flex align="center" gap={1.5}>
                                <Text fontWeight="600" fontSize="xs" color={textColor}>{displayKey}</Text>
                                {description && (
                                  <Text fontSize="xs" color={secondaryTextColor}>{description}</Text>
                                )}
                              </Flex>
                              <Badge colorPalette="blue" size="sm" variant="subtle">{groupMappings.length}</Badge>
                            </Flex>
                          </Flex>
                        </Box>
                        <Collapsible.Root open={!isCollapsed}>
                          <Collapsible.Content>
                            <VStack gap={0} align="stretch" mt={0.5} ml={2}>
                              {groupMappings.map((mapping, relativeIndex) => {
                                const absoluteIndex = getOriginalIndex(groupKey, relativeIndex);
                                return (
                                  <Box
                                    key={`${groupKey}-${relativeIndex}`}
                                    bg={bgColor}
                                    borderWidth={1}
                                    borderColor={borderColor}
                                    borderRadius="sm"
                                    px={2}
                                    py={1}
                                    _hover={{ bg: rowHoverBg }}
                                    transition="background 0.15s"
                                    borderLeftWidth={2}
                                    borderLeftColor="blue.300"
                                    mt="1px"
                                  >
                                    {editingIndex === absoluteIndex ? (
                                      <Flex align="center" gap={2}>
                                        <Input
                                          value={editCommand}
                                          onChange={(e) => setEditCommand(e.target.value)}
                                          placeholder="Command"
                                          size="xs"
                                          w="28%"
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
                                        <Text w="28%" fontSize="xs" fontWeight="600" color={accentText} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                                          {mapping.command}
                                        </Text>
                                        <Text flex={1} fontSize="xs" color={textColor} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                                          {mapping.filename}
                                        </Text>
                                        <HStack gap={0.5} onClick={(e) => e.stopPropagation()} flexShrink={0}>
                                          <IconButton aria-label="Edit mapping" onClick={(e) => { e.stopPropagation(); startEdit(absoluteIndex); }} colorPalette="blue" size="xs" variant="ghost" opacity={0.6} _hover={{ opacity: 1 }}><LuPencil /></IconButton>
                                          <IconButton aria-label="Delete mapping" onClick={(e) => { e.stopPropagation(); handleDelete(absoluteIndex); }} colorPalette="red" size="xs" variant="ghost" opacity={0.6} _hover={{ opacity: 1 }}><LuTrash2 /></IconButton>
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
                    <Box textAlign="center" py={5} color={secondaryTextColor} borderWidth={1} borderColor={borderColor} borderRadius="sm" borderStyle="dashed">
                      <Text fontSize="xs">No mappings defined yet. Add your first mapping below.</Text>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Add new mapping */}
              <Box px={3} py={2} borderTop="1px solid" borderColor={borderColor} bg={cardBg} flexShrink={0}>
                <Flex align="center" gap={2}>
                  <Input
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                    placeholder="Command (e.g. FAR)"
                    size="xs"
                    w="28%"
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
              <Button size="sm" variant="outline" mr={2} onClick={onClose}>Cancel</Button>
              <Button size="sm" colorPalette="blue" onClick={handleSave}>Save Changes</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
