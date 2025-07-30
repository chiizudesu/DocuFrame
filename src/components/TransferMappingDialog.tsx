import React, { useState, useEffect, ChangeEvent, useMemo } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  Input,
  IconButton,
  Box,
  Text,
  useToast,
  VStack,
  HStack,
  Flex,
  Spacer,
  useColorModeValue,
  Collapse,
  Badge,
  Divider,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, EditIcon, CheckIcon, CloseIcon, ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';

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
  const toast = useToast();

  // Color mode values
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg = useColorModeValue('gray.50', 'gray.600');
  const placeholderColor = useColorModeValue('gray.400', 'gray.500');
  const groupHeaderBg = useColorModeValue('gray.50', 'gray.800');
  const groupBorderColor = useColorModeValue('gray.300', 'gray.500');
  const groupHeaderHoverBg = useColorModeValue('gray.100', 'gray.700');

  // Smart grouping logic
  const { groupedMappings, indexMap } = useMemo(() => {
    const groups: GroupedMappings = {};
    const indexMap: { [key: string]: number[] } = {}; // Track original indices
    
    mappings.forEach((mapping, originalIndex) => {
      // Extract the letter prefix from filename template (e.g., "F -", "K -", "G -")
      const match = mapping.filename.match(/^([A-Z](?:-?\d+)?)\s*-/);
      const groupKey = match ? match[1] : 'Other';
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
        indexMap[groupKey] = [];
      }
      groups[groupKey].push(mapping);
      indexMap[groupKey].push(originalIndex);
    });

    // Sort groups by key and sort mappings within each group
    const sortedGroups: GroupedMappings = {};
    const sortedIndexMap: { [key: string]: number[] } = {};
    
    Object.keys(groups)
      .sort((a, b) => {
        // Put "Other" at the end
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .forEach(key => {
        // Sort by command name and maintain index mapping
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

  // Get original index from group and relative index
  const getOriginalIndex = (groupKey: string, relativeIndex: number): number => {
    return indexMap[groupKey]?.[relativeIndex] ?? -1;
  };

  // Get group display info
  const getGroupInfo = (groupKey: string) => {
    // Workpaper section descriptions mapping
    const workpaperDescriptions: { [key: string]: string } = {
      'A1': 'Permanent',
      'A2': 'Job Notes', 
      'A3': 'Other Checks',
      'A4': 'Financial Statements, Tax Returns & Minutes',
      'A5': 'Individuals',
      'C': 'Bank Reconciliation',
      'D': 'Accounts Receivable',
      'E': 'Other Current Assets',
      'E1': 'Inventory',
      'E2': 'Prepayments',
      'F': 'Fixed Assets',
      'F1': 'Non-Current Assets',
      'G': 'Accounts Payable',
      'H': 'Other Current Liabilities',
      'H1': 'Non-Current Liabilities',
      'I': 'Loans',
      'I2': 'Finance Lease',
      'I3': 'Operating Lease Commitments',
      'J': 'Investments',
      'K': 'GST',
      'L': 'Income Tax',
      'M': 'Imputation Credits',
      'M2': 'Imputation Credits to RE',
      'N': 'Shareholder/Beneficiary Current Accounts',
      'O': 'Equity, Capital, Accumulations',
      'P': 'Intangibles',
      'Q': 'Profit & Loss',
      'R': 'Entertainment',
      'S': 'Home Office',
      'W': 'Wages',
    };

    const description = workpaperDescriptions[groupKey] || (groupKey === 'Other' ? 'Non-standard mappings' : '');
    
    return { groupKey, description };
  };

  const toggleGroup = (groupKey: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupKey)) {
      newCollapsed.delete(groupKey);
    } else {
      newCollapsed.add(groupKey);
    }
    setCollapsedGroups(newCollapsed);
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(Object.keys(groupedMappings)));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  useEffect(() => {
    const loadMappings = async () => {
      if (isOpen) {
        try {
          const config = await window.electronAPI.getConfig();
          console.log('Loaded config:', config);
          if (config?.transferCommandMappings) {
            const mappingArray = Object.entries(config.transferCommandMappings).map(([command, filename]) => ({
              command,
              filename: filename as string
            }));
            setMappings(mappingArray);
          }
        } catch (error) {
          console.error('Error loading mappings:', error);
          toast({
            title: 'Error',
            description: 'Failed to load transfer mappings',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    };
    loadMappings();
  }, [isOpen, toast]);

  const handleSave = async () => {
    try {
      const transferCommandMappings = mappings.reduce((acc, { command, filename }) => {
        acc[command] = filename;
        return acc;
      }, {} as { [key: string]: string });

      const config = await window.electronAPI.getConfig();
      console.log('Current config before update:', config);
      
      const updatedConfig = {
        ...config,
        transferCommandMappings
      };
      
      console.log('Updated config to save:', updatedConfig);
      await window.electronAPI.setConfig(updatedConfig);
      
      toast({
        title: 'Success',
        description: 'Transfer mappings saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving transfer mappings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save transfer mappings',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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
      updatedMappings[editingIndex] = { 
        command: editCommand.trim(), 
        filename: editFilename.trim() 
      };
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
      if (action === 'add') {
        handleAdd();
      } else {
        saveEdit();
      }
    } else if (e.key === 'Escape' && action === 'edit') {
      cancelEdit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" isCentered>
              <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent maxH="85vh">
        <ModalHeader>
          <Flex align="center" justify="space-between" pr={8}>
            <Flex align="center" gap={3}>
              <Text>Transfer Command Mappings</Text>
              <Badge colorScheme="blue" variant="subtle">
                {mappings.length} total
              </Badge>
            </Flex>
            {Object.keys(groupedMappings).length > 1 && (
              <HStack spacing={1}>
                <Button size="xs" variant="ghost" onClick={expandAll} fontSize="xs">
                  Expand All
                </Button>
                <Button size="xs" variant="ghost" onClick={collapseAll} fontSize="xs">
                  Collapse All
                </Button>
              </HStack>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch" maxH="55vh" overflowY="auto">
            {/* Grouped Mappings */}
            {Object.entries(groupedMappings).map(([groupKey, groupMappings]) => {
              const { groupKey: displayKey, description } = getGroupInfo(groupKey);
              const isCollapsed = collapsedGroups.has(groupKey);
              
              return (
                <Box key={groupKey}>
                  {/* Group Header */}
                  <Box
                    bg={groupHeaderBg}
                    borderWidth={1}
                    borderColor={groupBorderColor}
                    borderRadius="md"
                    p={2}
                    cursor="pointer"
                    onClick={() => toggleGroup(groupKey)}
                    _hover={{ bg: groupHeaderHoverBg }}
                    transition="background 0.2s"
                  >
                    <Flex align="center" gap={2}>
                      <IconButton
                        aria-label="Toggle group"
                        icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroup(groupKey);
                        }}
                      />
                      <Box flex={1}>
                        <Flex align="center" justify="space-between">
                          <Flex align="center" gap={1}>
                            <Text fontWeight="semibold" fontSize="sm">
                              {displayKey}
                            </Text>
                            {description && (
                              <Text fontSize="sm" color={placeholderColor}>
                                [{description}]
                              </Text>
                            )}
                          </Flex>
                          <Badge colorScheme="blue" size="sm" variant="subtle">
                            {groupMappings.length}
                          </Badge>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>

                  {/* Group Content */}
                  <Collapse in={!isCollapsed}>
                    <VStack spacing={2} align="stretch" mt={1} ml={3}>
                      {groupMappings.map((mapping, relativeIndex) => {
                        const absoluteIndex = getOriginalIndex(groupKey, relativeIndex);
                        
                        return (
                          <Box
                            key={`${groupKey}-${relativeIndex}`}
                            bg={cardBg}
                            borderWidth={1}
                            borderColor={borderColor}
                            borderRadius="md"
                            p={3}
                            _hover={{ bg: hoverBg }}
                            transition="background 0.2s"
                            borderLeftWidth={3}
                            borderLeftColor="blue.300"
                          >
                            {editingIndex === absoluteIndex ? (
                              // Edit Mode
                              <Flex align="center" gap={3}>
                                <Input
                                  value={editCommand}
                                  onChange={(e) => setEditCommand(e.target.value)}
                                  placeholder="Command"
                                  size="sm"
                                  w="30%"
                                  onKeyDown={(e) => handleKeyPress(e, 'edit')}
                                  autoFocus
                                />
                                <Input
                                  value={editFilename}
                                  onChange={(e) => setEditFilename(e.target.value)}
                                  placeholder="Filename Template"
                                  size="sm"
                                  flex={1}
                                  onKeyDown={(e) => handleKeyPress(e, 'edit')}
                                />
                                <HStack spacing={1}>
                                  <IconButton
                                    aria-label="Save edit"
                                    icon={<CheckIcon />}
                                    onClick={saveEdit}
                                    colorScheme="green"
                                    size="sm"
                                    variant="ghost"
                                    isDisabled={!editCommand.trim() || !editFilename.trim()}
                                  />
                                  <IconButton
                                    aria-label="Cancel edit"
                                    icon={<CloseIcon />}
                                    onClick={cancelEdit}
                                    colorScheme="gray"
                                    size="sm"
                                    variant="ghost"
                                  />
                                </HStack>
                              </Flex>
                            ) : (
                              // Display Mode
                              <Flex align="center" gap={3} onClick={() => startEdit(absoluteIndex)} cursor="pointer">
                                <Text w="30%" fontWeight="medium" color="blue.500">
                                  {mapping.command}
                                </Text>
                                <Text flex={1} color="gray.700" _dark={{ color: 'gray.300' }}>
                                  {mapping.filename}
                                </Text>
                                <HStack spacing={1} onClick={(e) => e.stopPropagation()}>
                                  <IconButton
                                    aria-label="Edit mapping"
                                    icon={<EditIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEdit(absoluteIndex);
                                    }}
                                    colorScheme="blue"
                                    size="sm"
                                    variant="ghost"
                                    opacity={0.7}
                                    _hover={{ opacity: 1 }}
                                  />
                                  <IconButton
                                    aria-label="Delete mapping"
                                    icon={<DeleteIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(absoluteIndex);
                                    }}
                                    colorScheme="red"
                                    size="sm"
                                    variant="ghost"
                                    opacity={0.7}
                                    _hover={{ opacity: 1 }}
                                  />
                                </HStack>
                              </Flex>
                            )}
                          </Box>
                        );
                      })}
                    </VStack>
                  </Collapse>
                </Box>
              );
            })}

            {/* Empty State */}
            {mappings.length === 0 && (
              <Box
                textAlign="center"
                py={8}
                color={placeholderColor}
                borderWidth={1}
                borderColor={borderColor}
                borderRadius="md"
                borderStyle="dashed"
              >
                <Text fontSize="sm">No mappings defined yet</Text>
                <Text fontSize="xs" mt={1}>Add your first mapping below</Text>
              </Box>
            )}

            {/* Divider */}
            {mappings.length > 0 && <Divider />}

            {/* Add New Mapping Row */}
            <Box
              bg={cardBg}
              borderWidth={1}
              borderColor="blue.200"
              borderRadius="md"
              p={3}
              borderStyle="dashed"
              _hover={{ borderColor: 'blue.300', borderStyle: 'solid' }}
              transition="border 0.2s"
            >
              <Text fontSize="sm" fontWeight="medium" mb={3} color="blue.600">
                Add New Mapping
              </Text>
              <Flex align="center" gap={3}>
                <Input
                  value={newCommand}
                  onChange={(e) => setNewCommand(e.target.value)}
                  placeholder="e.g., FAR"
                  size="sm"
                  w="30%"
                  onKeyDown={(e) => handleKeyPress(e, 'add')}
                />
                <Input
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  placeholder="e.g., F - Fixed Assets Reconciliation"
                  size="sm"
                  flex={1}
                  onKeyDown={(e) => handleKeyPress(e, 'add')}
                />
                <IconButton
                  aria-label="Add mapping"
                  icon={<AddIcon />}
                  onClick={handleAdd}
                  colorScheme="blue"
                  size="sm"
                  isDisabled={!newCommand.trim() || !newFilename.trim()}
                />
              </Flex>
              <Text fontSize="xs" color={placeholderColor} mt={2}>
                Press Enter to add or click the + button
              </Text>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}; 