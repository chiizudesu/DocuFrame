import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  Text,
  Box,
  Flex,
  useColorModeValue,
  Textarea,
  FormControl,
  FormLabel,
  Input,
  Alert,
  AlertIcon,
  Code,
  IconButton,
  Badge,
  HStack,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { FileText, Plus, Edit2, Trash2, Save, X, Minus, Check, ChevronDown, ChevronRight, Clipboard } from 'lucide-react';
import * as yaml from 'js-yaml';
import { settingsService } from '../services/settings';
import { parseTemplate, extractPlaceholderNames, extractConditionNames, loadTemplates as loadTemplatesFromService, type TemplateBlock } from '../services/templateService';
import { AIEditBar } from './AIEditBar';

interface TemplateFile {
  name: string;
  path: string;
  content: string;
  parsed: any;
  lastModified: string;
}

interface ManageTemplatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
  onMinimize?: () => void;
}

export const ManageTemplatesDialog: React.FC<ManageTemplatesDialogProps> = ({ isOpen, onClose, currentDirectory, onMinimize }) => {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateFile | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [templateFolderPath, setTemplateFolderPath] = useState<string>('');
  
  // New template creation state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateFilename, setNewTemplateFilename] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [rawText, setRawText] = useState('');
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<{type?: 'placeholder' | 'condition'; original: string; suggested: string; accepted: boolean}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [createStep, setCreateStep] = useState<'input' | 'categories' | 'yaml'>('input');
  const [categories, setCategories] = useState<string[]>([]);
  const [clipboardPasteStatus, setClipboardPasteStatus] = useState<'idle' | 'success' | 'empty' | 'error'>('idle');
  const [newCategory, setNewCategory] = useState('');
  
  // Edit state
  const [editedTemplate, setEditedTemplate] = useState<any>(null);
  const [lastSavedTemplate, setLastSavedTemplate] = useState<any>(null);
  // Collapsed conditional blocks in visual editor (Set of block keys)
  const [collapsedConditionalBlocks, setCollapsedConditionalBlocks] = useState<Set<string>>(new Set());
  
  // Delete confirmation
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [templateToDelete, setTemplateToDelete] = useState<TemplateFile | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const selectedBgColor = useColorModeValue('blue.50', 'blue.900');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedTextColor = useColorModeValue('gray.600', 'gray.300');
  const labelColor = useColorModeValue('gray.700', 'gray.300');
  const inputBg = useColorModeValue('white', 'gray.700');
  const inputBorderColor = useColorModeValue('gray.300', 'gray.600');
  const sidebarBg = useColorModeValue('gray.50', 'gray.750');
  const subtleBg = useColorModeValue('gray.100', 'gray.700');
  const contentBg = useColorModeValue('gray.50', 'gray.900');
  const scrollbarColor = useColorModeValue('#CBD5E0', '#4A5568');
  const editHeaderBg = useColorModeValue('gray.50', 'gray.800');
  const editLeftPanelBg = useColorModeValue('amber.50', 'gray.600');
  const rowHoverBg = useColorModeValue('gray.100', 'gray.600');
  const editRightPanelBg = useColorModeValue('gray.50', 'gray.900');
  const editContentBoxBg = useColorModeValue('white', 'gray.600');
  const editContentBoxBorder = useColorModeValue('gray.300', 'gray.500');
  const conditionalBlockBg = useColorModeValue('blue.50', 'blue.900');
  const conditionalBlockHoverBg = useColorModeValue('blue.100', 'blue.800');
  const placeholderItemBg = useColorModeValue('white', 'gray.700');
  const placeholderItemBorder = useColorModeValue('gray.300', 'gray.500');

  // Load template folder path from settings
  useEffect(() => {
    const loadTemplatePath = async () => {
      try {
        const folderPath = await settingsService.getTemplateFolderPath();
        setTemplateFolderPath(folderPath || '');
      } catch (error) {
        console.error('Failed to load template folder path:', error);
      }
    };
    loadTemplatePath();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!templateFolderPath) {
        setError('Template folder path not configured. Please set it in Settings.');
        setTemplates([]);
        return;
      }
      const loaded = await loadTemplatesFromService();
      const mapped: TemplateFile[] = loaded.map((t) => ({
        name: t.filename || t.path.split(/[/\\]/).pop() || '',
        path: t.path,
        content: t.content,
        parsed: t.parsed,
        lastModified: t.lastModified || new Date().toISOString()
      }));
      setTemplates(mapped);
      if (mapped.length === 0) {
        setError('No template files found in current directory');
      }
    } catch (err) {
      setError(`Failed to load templates: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (template: TemplateFile) => {
    setSelectedTemplate(template);
    setEditedTemplate({ ...template.parsed });
    setLastSavedTemplate(template.parsed);
    setEditingTemplateName(false);
    setCollapsedConditionalBlocks(new Set());
    setActiveTab(1); // Switch to Edit tab
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !editedTemplate) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const yamlContent = yaml.dump(editedTemplate, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });
      
      await (window as any).electronAPI.writeTextFile(selectedTemplate.path, yamlContent);
      setLastSavedTemplate(editedTemplate);
      await loadTemplates();
    } catch (err) {
      setError(`Failed to save template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (template: TemplateFile) => {
    setTemplateToDelete(template);
    onDeleteOpen();
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    try {
      await (window as any).electronAPI.deleteFile(templateToDelete.path);
      setSuccess(`Template "${templateToDelete.name}" deleted successfully!`);
      
      if (selectedTemplate?.path === templateToDelete.path) {
        setSelectedTemplate(null);
        setEditedTemplate(null);
        setLastSavedTemplate(null);
        setActiveTab(0);
      }
      
      await loadTemplates();
    } catch (err) {
      setError(`Failed to delete template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      onDeleteClose();
      setTemplateToDelete(null);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setClipboardPasteStatus('empty');
        setRawText('');
      } else {
        setRawText(text);
        setClipboardPasteStatus('success');
      }
    } catch {
      setClipboardPasteStatus('error');
      setRawText('');
    }
  };

  const handleClearTemplateContent = () => {
    setRawText('');
    setClipboardPasteStatus('idle');
  };

  const handleAnalyzeText = async () => {
    if (!rawText.trim() || !newTemplateName.trim()) {
      setError('Please provide both template name and raw text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // First, try AI-powered analysis
      let detections: {type?: 'placeholder' | 'condition'; original: string; suggested: string; accepted: boolean}[] = [];
      
      try {
        const { analyzeTemplateForPlaceholders } = await import('../services/aiService');
        const aiDetections = await analyzeTemplateForPlaceholders(rawText, newTemplateName, 'claude');
        detections = aiDetections;
        console.log('[Template Analysis] AI detected placeholders:', aiDetections);
      } catch (aiError) {
        console.log('[Template Analysis] AI analysis failed, falling back to regex:', aiError);
        
        // First: detect existing {{ placeholder }} patterns so Detected list matches Template Preview
        const existingPlaceholderRegex = /\{\{\s*([^#/}\s][^}]*?)\s*\}\}/g;
        let match;
        while ((match = existingPlaceholderRegex.exec(rawText)) !== null) {
          const original = match[0];
          const inner = match[1].trim();
          const suggested = inner.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'placeholder';
          if (!detections.some((d) => d.original === original)) {
            const existingCount = detections.filter((d) => d.suggested === suggested || d.suggested.startsWith(suggested + '_')).length;
            const suggestedName = existingCount > 0 ? `${suggested}_${existingCount + 1}` : suggested;
            detections.push({ type: 'placeholder', original, suggested: suggestedName, accepted: true });
          }
        }

        // Fallback patterns for values not already in {{ }} form
        const patterns = [
          { regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, suggest: 'date' },
          { regex: /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, suggest: 'date' },
          { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, suggest: 'date' },
          { regex: /\$[\d,]+\.?\d*/g, suggest: 'amount' },
          { regex: /\b\d+,?\d*\.?\d*\s*(dollars?|cents?)\b/gi, suggest: 'amount' },
          { regex: /\b\d{1,3}(,\d{3})*(\.\d{2})?\b/g, suggest: 'amount' },
          { regex: /\b(20\d{2})\b/g, suggest: 'tax_year' },
          { regex: /\b\d{2,3}-?\d{3}-?\d{3}\b/g, suggest: 'ird_number' },
          { regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, suggest: 'email' },
          { regex: /\b\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, suggest: 'phone' },
          { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, suggest: 'client_name' },
        ];

        patterns.forEach((pattern) => {
          let match;
          const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
          
          while ((match = regex.exec(rawText)) !== null) {
            const value = match[0];
            
            if (detections.some(d => d.original === value)) continue;
            
            const existingCount = detections.filter(d => d.suggested.startsWith(pattern.suggest)).length;
            const suggestedName = existingCount > 0 ? `${pattern.suggest}_${existingCount + 1}` : pattern.suggest;
            
            detections.push({
              type: 'placeholder',
              original: value,
              suggested: suggestedName,
              accepted: true
            });
          }
        });
      }

      setDetectedPlaceholders(detections);
      setCreateStep('categories');
      setSuccess('Define PDF categories for this template.');
      
    } catch (err) {
      setError(`Failed to analyze text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmCategories = () => {
    let processedText = rawText;
    detectedPlaceholders.forEach((placeholder) => {
      if (placeholder.accepted && (placeholder.type || 'placeholder') === 'placeholder') {
        const globalRegex = new RegExp(placeholder.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedText = processedText.replace(globalRegex, `{{${placeholder.suggested}}}`);
      }
    });

    // Convert accepted OR-block conditions to {{#if}}...{{#else}}...{{/if}}
    const acceptedConditions = detectedPlaceholders.filter((p) => p.accepted && p.type === 'condition');
    for (const cond of acceptedConditions) {
      let condOriginal = cond.original;
      detectedPlaceholders.forEach((p) => {
        if (p.accepted && (p.type || 'placeholder') === 'placeholder') {
          const globalRegex = new RegExp(p.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          condOriginal = condOriginal.replace(globalRegex, `{{${p.suggested}}}`);
        }
      });
      const idx = processedText.indexOf(condOriginal);
      if (idx === -1) continue;
      const orParts = condOriginal.split(/\n\s*OR\s*\n|\n\n\s*OR\s*\n\n/i);
      let replacement: string;
      if (orParts.length >= 2) {
        replacement = `{{#if ${cond.suggested}}}${orParts[0].trim()}{{#else}}${orParts.slice(1).join('\n\nOR\n\n').trim()}{{/if}}`;
      } else {
        const slashParts = condOriginal.split(/\s+\/\s+/);
        if (slashParts.length === 2) {
          replacement = `{{#if ${cond.suggested}}}${slashParts[0].trim()}{{#else}}${slashParts[1].trim()}{{/if}}`;
        } else continue;
      }
      processedText = processedText.substring(0, idx) + replacement + processedText.substring(idx + condOriginal.length);
    }
    
    try {
      const yamlObject = {
        name: newTemplateName,
        description: newTemplateDescription.trim() || `Template for ${newTemplateName}`,
        categories: categories.length > 0 ? categories : ['document'],
        template: processedText,
        created: new Date().toISOString().split('T')[0]
      };

      const yamlString = yaml.dump(yamlObject, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      setNewTemplateContent(yamlString);
      setCreateStep('yaml');
      setSuccess('Template generated! Review the YAML before saving.');
    } catch (err) {
      setError(`Failed to generate YAML: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateContent.trim()) {
      setError('Please generate YAML first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate YAML content
      yaml.load(newTemplateContent);
      
      // Determine filename
      let filename: string;
      if (newTemplateFilename.trim()) {
        // Use custom filename, ensure it has .yaml extension
        filename = newTemplateFilename.trim();
        if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) {
          filename += '.yaml';
        }
      } else {
        // Auto-generate from template name
        const sanitizedName = newTemplateName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
        filename = `${sanitizedName}_template.yaml`;
      }
      
      const fullPath = `${templateFolderPath}/${filename}`;
      console.log('[Template Creation] Saving template to:', fullPath);

      await (window as any).electronAPI.writeTextFile(fullPath, newTemplateContent);
      
      // Force reload templates to show the new one
      console.log('[Template Creation] Reloading templates after save');
      await loadTemplates();
      
      // Reset create form
      setNewTemplateName('');
      setNewTemplateFilename('');
      setNewTemplateDescription('');
      setNewTemplateContent('');
      setRawText('');
      setDetectedPlaceholders([]);
      setCategories([]);
      setNewCategory('');
      setCreateStep('input');
      setClipboardPasteStatus('idle');
      
      // Switch to browse tab to show the new template
      setActiveTab(0);
      
    } catch (err) {
      setError(`Failed to save template: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('[Template Creation] Save failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTemplateField = (field: string, value: any) => {
    setEditedTemplate((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAiTemplateUpdated = (newTemplate: string) => {
    if (!editedTemplate) return;
    setEditedTemplate({ ...editedTemplate, template: newTemplate });
  };

  const renderTextAsWords = (text: string, baseCharIndex: number) => {
    const tokens = text.split(/(\s+)/);
    let offset = 0;
    return tokens.map((token) => {
      const charIdx = baseCharIndex + offset;
      offset += token.length;
      return <Text as="span" key={`t-${charIdx}`} whiteSpace="pre-wrap">{token}</Text>;
    });
  };

  const renderTextWithPlaceholderPills = (text: string, baseCharIndex: number) => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const placeholderRegex = /\{\{([^#/][^}]*)\}\}/g;
    let match;
    while ((match = placeholderRegex.exec(text)) !== null) {
      const placeholderName = match[1].trim();
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      if (matchStart > lastIndex) {
        parts.push(...renderTextAsWords(text.substring(lastIndex, matchStart), baseCharIndex + lastIndex));
      }
      parts.push(
        <Badge
          key={`ph-${baseCharIndex}-${matchStart}`}
          colorScheme="yellow"
          fontSize="xs"
          px={2}
          py={1}
          borderRadius="md"
          fontFamily="mono"
        >
          {`{{${placeholderName}}}`}
        </Badge>
      );
      lastIndex = matchEnd;
    }
    if (lastIndex < text.length) {
      parts.push(...renderTextAsWords(text.substring(lastIndex), baseCharIndex + lastIndex));
    }
    return <Box as="span" display="inline">{parts}</Box>;
  };

  const renderBlocksWithConditionals = (
    blocks: TemplateBlock[],
    blockPath: string
  ): React.ReactNode[] => {
    return blocks.map((block, idx) => {
      const key = `${blockPath}-${idx}`;
      if (block.type === 'text') {
        return (
          <Box key={key} as="span" display="inline">
            {renderTextWithPlaceholderPills(block.content, 0)}
          </Box>
        );
      }
      const blockKey = `${block.condition}-${key}`;
      const isCollapsed = collapsedConditionalBlocks.has(blockKey);
      return (
        <Box
          key={key}
          mt={2}
          mb={2}
          border="1px solid"
          borderColor="blue.200"
          borderLeft="4px solid"
          borderLeftColor="blue.500"
          borderRadius="md"
          overflow="hidden"
          bg={conditionalBlockBg}
        >
          <Flex
            align="center"
            px={2}
            py={1}
            cursor="pointer"
            onClick={() => {
              setCollapsedConditionalBlocks((prev) => {
                const next = new Set(prev);
                if (next.has(blockKey)) next.delete(blockKey);
                else next.add(blockKey);
                return next;
              });
            }}
            _hover={{ bg: conditionalBlockHoverBg }}
          >
            {isCollapsed ? (
              <ChevronRight size={14} style={{ marginRight: 4 }} />
            ) : (
              <ChevronDown size={14} style={{ marginRight: 4 }} />
            )}
            <Badge colorScheme="purple" fontSize="xs" fontFamily="mono">
              IF {block.condition}
            </Badge>
          </Flex>
          {!isCollapsed && (
            <Box px={3} py={2} fontSize="sm" whiteSpace="pre-wrap">
              <Box mb={block.elseBlocks.length > 0 ? 2 : 0}>
                {renderBlocksWithConditionals(block.ifBlocks, `${key}-if`)}
              </Box>
              {block.elseBlocks.length > 0 && (
                <>
                  <Badge colorScheme="gray" fontSize="xs" mb={2}>ELSE</Badge>
                  <Box pl={2} borderLeft="2px solid" borderColor="gray.300">
                    {renderBlocksWithConditionals(block.elseBlocks, `${key}-else`)}
                  </Box>
                </>
              )}
            </Box>
          )}
        </Box>
      );
    });
  };

  const renderTemplateContentWithPills = (content: string) => {
    if (!content) return null;
    try {
      const parsed = parseTemplate(content);
      const rendered = renderBlocksWithConditionals(parsed.blocks, 'root');
      return <Box>{rendered}</Box>;
    } catch {
      return null;
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setEditedTemplate(null);
    setLastSavedTemplate(null);
    setEditingTemplateName(false);
    setIsEditingContent(false);
    setNewTemplateName('');
    setNewTemplateFilename('');
    setNewTemplateDescription('');
    setNewTemplateContent('');
    setRawText('');
    setDetectedPlaceholders([]);
    setCreateStep('input');
    setClipboardPasteStatus('idle');
    setCategories([]);
    setNewCategory('');
    setCollapsedConditionalBlocks(new Set());
    setActiveTab(0);
    setError(null);
    setSuccess(null);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, templateFolderPath]);

  const navItems = [
    { icon: <FileText size={16} />, label: 'Browse', idx: 0, disabled: false },
    { icon: <Edit2 size={16} />, label: 'Edit', idx: 1, disabled: !selectedTemplate },
    { icon: <Plus size={16} />, label: 'Create New', idx: 2, disabled: false },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="6xl" isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent 
          maxH="95vh"
          maxW="90vw"
          w="950px"
          bg={bgColor}
          borderRadius={0}
          boxShadow="xl"
        >
          <ModalHeader 
            bg={itemBgColor} 
            borderBottom="1px solid" 
            borderColor={borderColor}
            borderRadius={0}
            py={3}
          >
            <Flex align="center">
              <FileText size={20} style={{ marginRight: '8px' }} />
              <Text fontSize="lg" fontWeight="semibold">Template Manager</Text>
            </Flex>
          </ModalHeader>
          {onMinimize && (
            <IconButton
              aria-label="Minimize"
              icon={<Minus size={16} />}
              size="sm"
              variant="ghost"
              position="absolute"
              top={4}
              right={12}
              onClick={onMinimize}
            />
          )}
          <ModalCloseButton top={4} right={4} />
          
          <ModalBody p={0}>
            <Flex h="650px">
              {/* Vertical Sidebar Navigation */}
              <VStack
                w="160px"
                minW="160px"
                bg={sidebarBg}
                borderRight="1px solid"
                borderColor={borderColor}
                py={4}
                px={2}
                spacing={1}
                align="stretch"
              >
                {navItems.map(item => (
                  <Button
                    key={item.idx}
                    variant="ghost"
                    size="sm"
                    justifyContent="flex-start"
                    leftIcon={item.icon}
                    isDisabled={item.disabled}
                    bg={activeTab === item.idx ? selectedBgColor : 'transparent'}
                    borderLeft="3px solid"
                    borderLeftColor={activeTab === item.idx ? 'blue.400' : 'transparent'}
                    borderRadius={0}
                    onClick={() => !item.disabled && setActiveTab(item.idx)}
                    fontWeight={activeTab === item.idx ? 'semibold' : 'normal'}
                    fontSize="sm"
                    _hover={{ bg: activeTab === item.idx ? selectedBgColor : itemBgColor }}
                  >
                    {item.label}
                  </Button>
                ))}
                <Box flex="1" />
              </VStack>

              {/* Content Area */}
              <Box flex="1" overflow="hidden">
                {/* ===== BROWSE TAB ===== */}
                {activeTab === 0 && (
                  <Box h="full" px={6} py={4} overflowY="auto">
                    <VStack spacing={3} align="stretch" h="full">
                      {error && (
                        <Alert status="error" borderRadius="md" py={2}>
                          <AlertIcon />
                          <Text fontSize="sm">{error}</Text>
                        </Alert>
                      )}
                      
                      {isLoading ? (
                        <Box textAlign="center" py={8}>
                          <Text>Loading templates...</Text>
                        </Box>
                      ) : templates.length === 0 ? (
                        <Box textAlign="center" py={8}>
                          <Text color="gray.500">No template files found in template folder</Text>
                          <Text fontSize="sm" color="gray.400" mt={2}>
                            {templateFolderPath ? `Looking in: ${templateFolderPath}` : 'Template folder path not configured'}
                          </Text>
                          <Text fontSize="sm" color="gray.400" mt={1}>
                            Template files should end with .yaml or .yml
                          </Text>
                        </Box>
                      ) : (
                        <Box flex="1" overflowY="auto">
                          <VStack spacing={0} align="stretch">
                            {templates.map((template, index) => (
                              <Flex
                                key={index}
                                px={3}
                                py={2}
                                bg={selectedTemplate?.path === template.path ? selectedBgColor : itemBgColor}
                                cursor="pointer"
                                align="center"
                                gap={3}
                                _hover={{ bg: selectedTemplate?.path === template.path ? selectedBgColor : rowHoverBg }}
                                onClick={() => handleSelectTemplate(template)}
                                borderBottom="1px solid"
                                borderColor={borderColor}
                              >
                                <Text fontWeight="medium" fontSize="sm" flex="1" noOfLines={1}>
                                  {template.parsed?.name || template.name}
                                </Text>
                                <Text fontSize="xs" color="gray.500" flexShrink={0}>
                                  {new Date(template.lastModified).toLocaleDateString()}
                                </Text>
                                <HStack spacing={0} flexShrink={0}>
                                  <IconButton
                                    aria-label="Edit template"
                                    icon={<Edit2 size={14} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="blue"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectTemplate(template);
                                    }}
                                  />
                                  <IconButton
                                    aria-label="Delete template"
                                    icon={<Trash2 size={14} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTemplate(template);
                                    }}
                                  />
                                </HStack>
                              </Flex>
                            ))}
                          </VStack>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                )}

                {/* ===== EDIT TAB ===== */}
                {activeTab === 1 && (
                  <Box h="full" p={4}>
                    {selectedTemplate ? (
                      <Flex direction="column" h="full">
                        {/* Header Bar */}
                        <Box
                          p={3}
                          bg={editHeaderBg}
                          mb={3}
                        >
                          {error && (
                            <Box mb={3}>
                              <Alert status="error" borderRadius="md" py={2}>
                                <AlertIcon />
                                <Text fontSize="sm">{error}</Text>
                              </Alert>
                            </Box>
                          )}
                          <Flex justify="space-between" align="flex-start" gap={4}>
                            <Box flex="1">
                              {editingTemplateName ? (
                                <HStack spacing={2} align="center">
                                  <Input
                                    value={editedTemplate?.name || ''}
                                    onChange={(e) => updateTemplateField('name', e.target.value)}
                                    placeholder="Enter template name..."
                                    size="sm"
                                    bg={inputBg}
                                    borderColor={inputBorderColor}
                                    _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px blue.400' }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') setEditingTemplateName(false);
                                      if (e.key === 'Escape') setEditingTemplateName(false);
                                    }}
                                  />
                                  <IconButton
                                    aria-label="Done editing name"
                                    icon={<Check size={14} />}
                                    size="sm"
                                    colorScheme="blue"
                                    variant="ghost"
                                    onClick={() => setEditingTemplateName(false)}
                                  />
                                </HStack>
                              ) : (
                                <HStack spacing={2} align="center">
                                  <Text fontSize="md" fontWeight="bold" color={textColor}>
                                    {editedTemplate?.name || selectedTemplate.name}
                                    {selectedTemplate && editedTemplate && lastSavedTemplate && JSON.stringify(editedTemplate) !== JSON.stringify(lastSavedTemplate) && (
                                      <Text as="span" color="orange.500" ml={0.5}>*</Text>
                                    )}
                                  </Text>
                                  <IconButton
                                    aria-label="Edit template name"
                                    icon={<Edit2 size={14} />}
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => setEditingTemplateName(true)}
                                  />
                                </HStack>
                              )}
                              <Text fontSize="xs" color={mutedTextColor} fontWeight="normal" mt={1}>
                                {selectedTemplate.name}
                              </Text>
                            </Box>
                            <Button
                              leftIcon={<Save size={14} />}
                              colorScheme="blue"
                              size="sm"
                              onClick={handleSaveTemplate}
                              isLoading={isLoading}
                              loadingText="Saving..."
                            >
                              Save
                            </Button>
                          </Flex>
                        </Box>
                        
                        {/* Editor Content */}
                        <Box
                          flex="1"
                          bg={editRightPanelBg}
                          overflow="hidden"
                          display="flex"
                          flexDirection="column"
                        >
                          <Flex h="full">
                              {/* Left Panel - Template Name + Placeholders */}
                              <Box
                                w="260px"
                                minW="260px"
                                p={4}
                                bg={editLeftPanelBg}
                                borderRight="1px solid"
                                borderColor={borderColor}
                                overflowY="auto"
                              >
                                <VStack spacing={4} align="stretch">
                                  <Box flex="1" minH={0}>
                                    <Text fontSize="sm" fontWeight="semibold" mb={2} color={textColor}>
                                      Placeholders
                                    </Text>
                                    {(() => {
                                      const templateContent = editedTemplate?.template || '';
                                      const placeholders = extractPlaceholderNames(templateContent);
                                      return placeholders.length > 0 ? (
                                        <VStack spacing={1} align="stretch" mb={4}>
                                          {placeholders.map((placeholder, index) => (
                                            <Box
                                              key={index}
                                              px={2}
                                              py={1.5}
                                              bg={placeholderItemBg}
                                              border="1px solid"
                                              borderColor={placeholderItemBorder}
                                              borderRadius="md"
                                            >
                                              <HStack spacing={2}>
                                                <Box w={2} h={2} bg="blue.400" borderRadius="full" flexShrink={0} />
                                                <Code fontSize="xs" bg="transparent" p={0} wordBreak="break-all" whiteSpace="pre-wrap">
                                                  {placeholder}
                                                </Code>
                                              </HStack>
                                            </Box>
                                          ))}
                                        </VStack>
                                      ) : (
                                        <Box p={3} bg={subtleBg} borderRadius="md" textAlign="center" mb={4}>
                                          <Text fontSize="xs" color="gray.500">No placeholders found</Text>
                                        </Box>
                                      );
                                    })()}
                                    <Text fontSize="sm" fontWeight="semibold" mb={2} color={textColor}>
                                      Conditions
                                    </Text>
                                    {(() => {
                                      const templateContent = editedTemplate?.template || '';
                                      const conditions = extractConditionNames(templateContent);
                                      return conditions.length > 0 ? (
                                        <VStack spacing={1} align="stretch">
                                          {conditions.map((cond, index) => (
                                            <Box
                                              key={index}
                                              px={2}
                                              py={1.5}
                                              bg={placeholderItemBg}
                                              border="1px solid"
                                              borderColor={placeholderItemBorder}
                                              borderRadius="md"
                                            >
                                              <HStack spacing={2}>
                                                <Box w={2} h={2} bg="purple.400" borderRadius="full" flexShrink={0} />
                                                <Code fontSize="xs" bg="transparent" p={0} wordBreak="break-all" whiteSpace="pre-wrap">
                                                  {cond}
                                                </Code>
                                              </HStack>
                                            </Box>
                                          ))}
                                        </VStack>
                                      ) : (
                                        <Box p={3} bg={subtleBg} borderRadius="md" textAlign="center">
                                          <Text fontSize="xs" color="gray.500">No conditions</Text>
                                          <Text fontSize="xs" color="gray.400" mt={1}>Use {`{{#if name}}`} in template</Text>
                                        </Box>
                                      );
                                    })()}
                                  </Box>
                                </VStack>
                              </Box>
                              
                              {/* Right Panel - Template Content */}
                              <Box flex="1" p={4} display="flex" flexDirection="column" bg={editRightPanelBg}>
                                <HStack justify="space-between" mb={2}>
                                  <Text fontSize="sm" fontWeight="semibold" color={textColor}>Template Content</Text>
                                  <IconButton
                                    aria-label={isEditingContent ? 'Done editing' : 'Edit as raw text'}
                                    icon={isEditingContent ? <Check size={14} /> : <Edit2 size={14} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme={isEditingContent ? 'blue' : undefined}
                                    onClick={() => setIsEditingContent(!isEditingContent)}
                                  />
                                </HStack>
                                {isEditingContent ? (
                                  <Textarea
                                    value={editedTemplate?.template || ''}
                                    onChange={(e) => updateTemplateField('template', e.target.value)}
                                    fontFamily="mono"
                                    fontSize="sm"
                                    resize="none"
                                    flex="1"
                                    bg={editContentBoxBg}
                                    border="2px solid"
                                    borderColor={editContentBoxBorder}
                                    _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px blue.400' }}
                                    placeholder="Template content with {{placeholders}}..."
                                  />
                                ) : (
                                <Box
                                      flex="1"
                                      p={4}
                                      bg={editContentBoxBg}
                                      border="2px solid"
                                      borderColor={editContentBoxBorder}
                                      borderRadius="md"
                                      overflowY="auto"
                                      minH="200px"
                                      fontFamily="mono"
                                      fontSize="sm"
                                      lineHeight="tall"
                                      whiteSpace="pre-wrap"
                                      wordBreak="break-word"
                                      css={{
                                        '&::-webkit-scrollbar': { width: '8px' },
                                        '&::-webkit-scrollbar-track': { background: 'transparent' },
                                        '&::-webkit-scrollbar-thumb': { background: scrollbarColor, borderRadius: '4px' },
                                      }}
                                    >
                                      {renderTemplateContentWithPills(editedTemplate?.template || '')}
                                    </Box>

                                )}
                                <AIEditBar
                                  currentTemplate={editedTemplate?.template || ''}
                                  onTemplateUpdated={handleAiTemplateUpdated}
                                  onError={setError}
                                />
                              </Box>
                            </Flex>
                        </Box>
                      </Flex>
                    ) : (
                      <Flex direction="column" align="center" justify="center" h="full" textAlign="center">
                        <Edit2 size={48} color={scrollbarColor} />
                        <Text color="gray.500" fontSize="lg" mt={4} fontWeight="medium">No Template Selected</Text>
                        <Text color="gray.400" fontSize="sm" mt={2}>Select a template from the Browse tab to edit it</Text>
                      </Flex>
                    )}
                  </Box>
                )}

                {/* ===== CREATE NEW TAB ===== */}
                {activeTab === 2 && (
                  <Box h="full" px={6} py={4} overflowY="auto">
                    <VStack spacing={4} align="stretch" h="full" minH="0">
                      {error && (
                        <Alert status="error" borderRadius="md" py={2}>
                          <AlertIcon />
                          <Text fontSize="sm">{error}</Text>
                        </Alert>
                      )}

                      {/* Compact 2-row header - always visible */}
                      <Box w="full">
                        <Flex gap={4} wrap="wrap" align="flex-end" mb={3}>
                          <FormControl flex="1" minW="200px">
                            <FormLabel fontSize="sm">Template Name</FormLabel>
                            <Input
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              placeholder="Enter template name..."
                              size="sm"
                            />
                          </FormControl>
                          <FormControl flex="1" minW="200px">
                            <FormLabel fontSize="sm">
                              File Name
                              <Text as="span" fontSize="xs" color="gray.500" ml={1}>(optional)</Text>
                            </FormLabel>
                            <Input
                              value={newTemplateFilename}
                              onChange={(e) => setNewTemplateFilename(e.target.value)}
                              placeholder="my_template.yaml"
                              size="sm"
                            />
                          </FormControl>
                        </Flex>
                        <Flex gap={2} align="center" flexWrap="wrap">
                          <FormControl flex="1" minW="200px">
                            <FormLabel fontSize="sm">Template Content</FormLabel>
                            <HStack>
                              <Button
                                leftIcon={<Clipboard size={14} />}
                                size="sm"
                                variant="outline"
                                onClick={handlePasteFromClipboard}
                              >
                                Paste from Clipboard
                              </Button>
                              {clipboardPasteStatus === 'success' && (
                                <HStack spacing={1} color="green.500">
                                  <Check size={16} />
                                  <Text fontSize="xs" noOfLines={1} maxW="120px">
                                    {rawText.length} chars
                                  </Text>
                                </HStack>
                              )}
                              {clipboardPasteStatus === 'empty' && (
                                <HStack spacing={1} color="red.500">
                                  <X size={16} />
                                  <Text fontSize="xs">Clipboard empty</Text>
                                </HStack>
                              )}
                              {clipboardPasteStatus === 'error' && (
                                <HStack spacing={1} color="red.500">
                                  <X size={16} />
                                  <Text fontSize="xs">Paste failed</Text>
                                </HStack>
                              )}
                              {rawText && (
                                <Button size="xs" variant="ghost" onClick={handleClearTemplateContent}>
                                  Clear
                                </Button>
                              )}
                            </HStack>
                          </FormControl>
                          <Button
                            leftIcon={<Plus size={16} />}
                            colorScheme="blue"
                            size="sm"
                            onClick={handleAnalyzeText}
                            isLoading={isAnalyzing}
                            isDisabled={!newTemplateName.trim() || !rawText.trim()}
                            alignSelf="flex-end"
                          >
                            {isAnalyzing ? 'Analyzing...' : 'Analyze & Continue'}
                          </Button>
                        </Flex>
                        {newTemplateName && (
                          <Text fontSize="xs" color="gray.500" mt={1}>
                            Auto-generated filename: {newTemplateName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()}_template.yaml
                          </Text>
                        )}
                      </Box>
                      
                      {createStep === 'categories' && (
                        <Flex gap={6} flex="1" minH="0" align="stretch">
                          <VStack align="stretch" flex="1" spacing={3}>
                            <Text fontWeight="bold" fontSize="sm">Define PDF Categories</Text>
                            <HStack align="flex-end">
                              <FormControl flex="1">
                                <FormLabel fontSize="xs">Add category</FormLabel>
                                <Input
                                  value={newCategory}
                                  onChange={(e) => setNewCategory(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                                  placeholder="e.g., financial_statement, tax_return..."
                                  size="sm"
                                />
                              </FormControl>
                              <Button
                                leftIcon={<Plus size={14} />}
                                onClick={handleAddCategory}
                                size="sm"
                                colorScheme="blue"
                                isDisabled={!newCategory.trim() || categories.includes(newCategory.trim())}
                              >
                                Add
                              </Button>
                            </HStack>
                            <Box pt={2}>
                              <HStack>
                                <Button variant="ghost" onClick={() => setCreateStep('input')} size="sm">Back</Button>
                                <Button colorScheme="blue" onClick={handleConfirmCategories} size="sm" isDisabled={categories.length === 0}>Generate YAML</Button>
                              </HStack>
                            </Box>
                          </VStack>
                          <VStack align="stretch" flex="1" spacing={2}>
                            <Text fontSize="sm" fontWeight="semibold">Categories Added</Text>
                            {categories.length === 0 ? (
                              <Box p={4} bg={itemBgColor} borderRadius="md" textAlign="center" flex="1" minH="80px">
                                <Text fontSize="xs" color="gray.500">No categories yet</Text>
                              </Box>
                            ) : (
                              <VStack spacing={2} align="stretch" flex="1" overflowY="auto">
                                {categories.map((cat, index) => (
                                  <HStack key={index} p={2} bg={itemBgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
                                    <FileText size={14} />
                                    <Code fontSize="xs" flex="1">{cat}</Code>
                                    <IconButton aria-label="Remove category" icon={<X size={14} />} size="xs" variant="ghost" colorScheme="red"
                                      onClick={() => handleRemoveCategory(index)} />
                                  </HStack>
                                ))}
                              </VStack>
                            )}
                          </VStack>
                        </Flex>
                      )}
                      
                      {createStep === 'yaml' && (
                        <>
                          <Text fontWeight="bold" fontSize="sm">Generated Template YAML</Text>
                          <Text fontSize="xs" color="gray.500">Review and edit the generated YAML before saving:</Text>
                          
                          <Textarea
                            value={newTemplateContent}
                            onChange={(e) => setNewTemplateContent(e.target.value)}
                            fontFamily="mono" fontSize="sm" flex="1" resize="none" minH="150px"
                          />
                          
                          <Box pt={2}>
                            <HStack>
                              <Button variant="ghost" onClick={() => setCreateStep('categories')} size="sm">Back</Button>
                              <Button leftIcon={<Save size={16} />} colorScheme="green" onClick={handleCreateTemplate} isLoading={isLoading} size="sm">
                                Save Template
                              </Button>
                            </HStack>
                          </Box>
                        </>
                      )}
                    </VStack>
                  </Box>
                )}
              </Box>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Template</AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete &ldquo;{templateToDelete?.name}&rdquo;? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" onClick={confirmDeleteTemplate} ml={3}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}; 