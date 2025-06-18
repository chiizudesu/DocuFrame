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
  Divider,
  Checkbox,
  IconButton,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  HStack,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { FileText, Plus, Edit2, Trash2, Save, Download, Upload, RefreshCw } from 'lucide-react';
import * as yaml from 'js-yaml';
import { settingsService } from '../services/settings';

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
}

export const ManageTemplatesDialog: React.FC<ManageTemplatesDialogProps> = ({ isOpen, onClose, currentDirectory }) => {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateFile | null>(null);
  const [editMode, setEditMode] = useState<'visual' | 'raw'>('visual');
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
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<{original: string, suggested: string, accepted: boolean}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [createStep, setCreateStep] = useState<'input' | 'placeholders' | 'yaml'>('input');
  
  // Edit state
  const [editedTemplate, setEditedTemplate] = useState<any>(null);
  const [editedRawYaml, setEditedRawYaml] = useState('');
  
  // Delete confirmation
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [templateToDelete, setTemplateToDelete] = useState<TemplateFile | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const selectedBgColor = useColorModeValue('blue.50', 'blue.900');

  // Load template folder path from settings
  useEffect(() => {
    const loadTemplatePath = async () => {
      try {
        const folderPath = await settingsService.getTemplateFolderPath();
        console.log('[ManageTemplatesDialog] Loaded template folder path:', folderPath);
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
      console.log('[ManageTemplatesDialog] Loading templates from:', templateFolderPath);
      if (!templateFolderPath) {
        console.log('[ManageTemplatesDialog] No template folder path configured');
        setError('Template folder path not configured. Please set it in Settings.');
        setTemplates([]);
        return;
      }

      const files = await (window as any).electronAPI.getDirectoryContents(templateFolderPath);
      console.log('[ManageTemplatesDialog] Found files in template folder:', files);
      const yamlFiles = files.filter((file: any) => 
        file.type === 'file' && 
        (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))
      );
      console.log('[ManageTemplatesDialog] Filtered YAML files:', yamlFiles);
      
      const templatePromises = yamlFiles.map(async (file: any) => {
        try {
          const content = await (window as any).electronAPI.readTextFile(file.path);
          const parsed = yaml.load(content);
          
          return {
            name: file.name,
            path: file.path,
            content,
            parsed,
            lastModified: file.modified || new Date().toISOString()
          };
        } catch (err) {
          console.error(`Failed to load template ${file.name}:`, err);
          return null;
        }
      });
      
      const loadedTemplates = (await Promise.all(templatePromises)).filter(Boolean) as TemplateFile[];
      setTemplates(loadedTemplates);
      
      if (loadedTemplates.length === 0) {
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
    setEditedRawYaml(template.content);
    setActiveTab(1); // Switch to edit tab
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !editedTemplate) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      let yamlContent: string;
      
      if (editMode === 'raw') {
        // Validate raw YAML
        yaml.load(editedRawYaml);
        yamlContent = editedRawYaml;
      } else {
        // Generate YAML from visual editor
        yamlContent = yaml.dump(editedTemplate, {
          indent: 2,
          lineWidth: -1,
          noRefs: true
        });
      }
      
      await (window as any).electronAPI.writeTextFile(selectedTemplate.path, yamlContent);
      
      setSuccess('Template saved successfully!');
      await loadTemplates(); // Reload templates
      
      // Update selected template
      const updatedTemplate = templates.find(t => t.path === selectedTemplate.path);
      if (updatedTemplate) {
        setSelectedTemplate(updatedTemplate);
        setEditedTemplate({ ...updatedTemplate.parsed });
        setEditedRawYaml(updatedTemplate.content);
      }
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
        setEditedRawYaml('');
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

  const handleAnalyzeText = async () => {
    if (!rawText.trim() || !newTemplateName.trim()) {
      setError('Please provide both template name and raw text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // First, try AI-powered analysis
      let detections: {original: string, suggested: string, accepted: boolean}[] = [];
      
      try {
        const { analyzeTemplateForPlaceholders } = await import('../services/openai');
        const aiDetections = await analyzeTemplateForPlaceholders(rawText, newTemplateName);
        detections = aiDetections;
        console.log('[Template Analysis] AI detected placeholders:', aiDetections);
      } catch (aiError) {
        console.log('[Template Analysis] AI analysis failed, falling back to regex:', aiError);
        
        // Fallback to regex-based analysis
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
              original: value,
              suggested: suggestedName,
              accepted: true
            });
          }
        });
      }

      setDetectedPlaceholders(detections);
      setCreateStep('placeholders');
      
    } catch (err) {
      setError(`Failed to analyze text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmPlaceholders = () => {
    let processedText = rawText;
    
    detectedPlaceholders.forEach(placeholder => {
      if (placeholder.accepted) {
        const globalRegex = new RegExp(placeholder.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedText = processedText.replace(globalRegex, `{{${placeholder.suggested}}}`);
      }
    });
    
    try {
      const acceptedPlaceholders = detectedPlaceholders
        .filter(p => p.accepted)
        .map(p => p.suggested);
      
      const yamlObject = {
        name: newTemplateName,
        description: newTemplateDescription.trim() || `Template for ${newTemplateName}`,
        categories: acceptedPlaceholders.length > 0 ? acceptedPlaceholders : ['document'],
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
      setSuccess('Template processed! Review the YAML before saving.');
    } catch (err) {
      setError(`Failed to generate YAML: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
      
      setSuccess(`Template saved as ${filename}`);
      
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
      setCreateStep('input');
      
      // Switch to browse tab to show the new template
      setActiveTab(0);
      
    } catch (err) {
      setError(`Failed to save template: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('[Template Creation] Save failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePlaceholder = (index: number, field: 'suggested' | 'accepted', value: string | boolean) => {
    setDetectedPlaceholders(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const updateTemplateField = (field: string, value: any) => {
    setEditedTemplate((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setEditedTemplate(null);
    setEditedRawYaml('');
    setNewTemplateName('');
    setNewTemplateFilename('');
    setNewTemplateDescription('');
    setNewTemplateContent('');
    setRawText('');
    setDetectedPlaceholders([]);
    setCreateStep('input');
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

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="5xl" isCentered>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent 
          maxH="90vh"
          maxW="85vw"
          w="900px"
          bg={bgColor}
          borderRadius="lg"
          boxShadow="xl"
        >
          <ModalHeader 
            bg={useColorModeValue('gray.50', 'gray.700')} 
            borderBottom="1px solid" 
            borderColor={borderColor}
            borderTopRadius="lg"
            py={3}
          >
            <Flex align="center">
              <FileText size={20} style={{ marginRight: '8px' }} />
              <Text fontSize="lg" fontWeight="semibold">Template Manager</Text>
              <Badge ml={3} colorScheme="blue">{templates.length} templates</Badge>
            </Flex>
          </ModalHeader>
          <ModalCloseButton top={4} right={4} />
          
          <ModalBody p={0}>
            <Tabs index={activeTab} onChange={setActiveTab} variant="line" colorScheme="blue" height="550px" display="flex" flexDirection="column">
              <TabList px={4} pt={3} borderBottom="1px solid" borderColor={borderColor}>
                <Tab>Browse Templates</Tab>
                <Tab isDisabled={!selectedTemplate}>Edit Template</Tab>
                <Tab>Create New</Tab>
                <IconButton
                  aria-label="Refresh templates"
                  icon={<RefreshCw size={16} />}
                  size="sm"
                  variant="ghost"
                  onClick={loadTemplates}
                  isLoading={isLoading}
                  ml="auto"
                />
              </TabList>
              
              <TabPanels flex="1" overflow="hidden">
                {/* Browse Templates Tab */}
                <TabPanel h="full" p={4}>
                  <VStack spacing={4} align="stretch" h="full">
                    {error && (
                      <Alert status="error" borderRadius="md">
                        <AlertIcon />
                        {error}
                      </Alert>
                    )}
                    
                    {success && (
                      <Alert status="success" borderRadius="md">
                        <AlertIcon />
                        {success}
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
                        <VStack spacing={2} align="stretch">
                          {templates.map((template, index) => (
                            <Box
                              key={index}
                              p={4}
                              bg={selectedTemplate?.path === template.path ? selectedBgColor : itemBgColor}
                              borderRadius="md"
                              border="1px solid"
                              borderColor={selectedTemplate?.path === template.path ? 'blue.400' : borderColor}
                              cursor="pointer"
                              _hover={{ borderColor: 'blue.300' }}
                              onClick={() => handleSelectTemplate(template)}
                            >
                              <Flex justify="space-between" align="center">
                                <Box flex="1">
                                  <Text fontWeight="semibold" fontSize="md">
                                    {template.parsed?.name || template.name}
                                  </Text>
                                  <Text fontSize="sm" color="gray.500" mt={1}>
                                    {template.parsed?.description || 'No description'}
                                  </Text>
                                  <HStack mt={2} spacing={2}>
                                    {template.parsed?.categories?.map((cat: string, catIndex: number) => (
                                      <Badge key={catIndex} size="sm" colorScheme="blue">{cat}</Badge>
                                    ))}
                                  </HStack>
                                </Box>
                                <VStack spacing={2} align="end">
                                  <Text fontSize="xs" color="gray.400">
                                    Modified: {new Date(template.lastModified).toLocaleDateString()}
                                  </Text>
                                  <HStack>
                                    <IconButton
                                      aria-label="Edit template"
                                      icon={<Edit2 size={16} />}
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="blue"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectTemplate(template);
                                      }}
                                    />
                                    <IconButton
                                      aria-label="Delete template"
                                      icon={<Trash2 size={16} />}
                                      size="sm"
                                      variant="ghost"
                                      colorScheme="red"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTemplate(template);
                                      }}
                                    />
                                  </HStack>
                                </VStack>
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </VStack>
                </TabPanel>
                
                {/* Edit Template Tab */}
                <TabPanel h="full" p={4}>
                  {selectedTemplate ? (
                    <Box maxW="100%" mx="auto" h="full">
                      <Flex direction="column" h="full">
                        {/* Header Section - Compact */}
                        <Box
                          p={3}
                          bg={useColorModeValue('white', 'gray.800')}
                          borderRadius="md"
                          border="1px solid"
                          borderColor={borderColor}
                          boxShadow="sm"
                          mb={3}
                        >
                          {/* Alert Messages */}
                          {(error || success) && (
                            <Box mb={3}>
                              {error && (
                                <Alert status="error" borderRadius="md" mb={2} py={2}>
                                  <AlertIcon />
                                  <Text fontSize="sm">{error}</Text>
                                </Alert>
                              )}
                              {success && (
                                <Alert status="success" borderRadius="md" py={2}>
                                  <AlertIcon />
                                  <Text fontSize="sm">{success}</Text>
                                </Alert>
                              )}
                            </Box>
                          )}
                          
                          {/* Template Info and Controls */}
                          <Flex justify="space-between" align="center" gap={4}>
                            <Box flex="1">
                              <Text fontSize="md" fontWeight="bold" color={useColorModeValue('gray.800', 'white')} mb={0}>
                                {selectedTemplate.name}
                              </Text>
                              <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.300')}>
                                {selectedTemplate.parsed?.description || 'No description'}
                              </Text>
                            </Box>
                            
                            <HStack spacing={2}>
                              <Select 
                                value={editMode} 
                                onChange={(e) => setEditMode(e.target.value as 'visual' | 'raw')} 
                                w="140px"
                                size="sm"
                                bg={useColorModeValue('white', 'gray.700')}
                                borderColor={useColorModeValue('gray.300', 'gray.600')}
                              >
                                <option value="visual">Visual Editor</option>
                                <option value="raw">Raw YAML</option>
                              </Select>
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
                            </HStack>
                          </Flex>
                        </Box>
                        
                        {/* Content Section */}
                        <Box
                          flex="1"
                          bg={useColorModeValue('white', 'gray.800')}
                          borderRadius="md"
                          border="1px solid"
                          borderColor={borderColor}
                          boxShadow="sm"
                          overflow="hidden"
                          display="flex"
                          flexDirection="column"
                        >
                          {editMode === 'visual' ? (
                            <Flex h="full">
                              {/* Left Panel - Form Fields */}
                              <Box
                                w="300px"
                                p={4}
                                borderRight="1px solid"
                                borderColor={borderColor}
                                bg={useColorModeValue('gray.50', 'gray.750')}
                                overflowY="auto"
                              >
                                <VStack spacing={4} align="stretch">
                                  {/* Template Name Section */}
                                  <Box>
                                    <Text fontSize="md" fontWeight="semibold" mb={3} color={useColorModeValue('gray.800', 'white')}>
                                      Template Settings
                                    </Text>
                                    
                                    <FormControl>
                                      <FormLabel fontSize="xs" fontWeight="semibold" color={useColorModeValue('gray.700', 'gray.300')} mb={1}>
                                        Template Name
                                      </FormLabel>
                                      <Input
                                        value={editedTemplate?.name || ''}
                                        onChange={(e) => updateTemplateField('name', e.target.value)}
                                        placeholder="Enter template name..."
                                        size="sm"
                                        bg={useColorModeValue('white', 'gray.700')}
                                        borderColor={useColorModeValue('gray.300', 'gray.600')}
                                        _focus={{
                                          borderColor: 'blue.400',
                                          boxShadow: '0 0 0 1px blue.400'
                                        }}
                                      />
                                    </FormControl>
                                    
                                    <FormControl>
                                      <FormLabel fontSize="xs" fontWeight="semibold" color={useColorModeValue('gray.700', 'gray.300')} mb={1}>
                                        Description
                                      </FormLabel>
                                      <Textarea
                                        value={editedTemplate?.description || ''}
                                        onChange={(e) => updateTemplateField('description', e.target.value)}
                                        placeholder="Brief description..."
                                        rows={2}
                                        size="sm"
                                        bg={useColorModeValue('white', 'gray.700')}
                                        borderColor={useColorModeValue('gray.300', 'gray.600')}
                                        _focus={{
                                          borderColor: 'blue.400',
                                          boxShadow: '0 0 0 1px blue.400'
                                        }}
                                      />
                                    </FormControl>
                                  </Box>
                                  
                                  {/* Placeholders Section */}
                                  <Box flex="1">
                                    <Text fontSize="md" fontWeight="semibold" mb={3} color={useColorModeValue('gray.800', 'white')}>
                                      Placeholders
                                    </Text>
                                    
                                    {(() => {
                                      const templateContent = editedTemplate?.template || '';
                                      const placeholderMatches = templateContent.match(/\{\{([^}]+)\}\}/g) || [];
                                      const placeholders = [...new Set(placeholderMatches.map((match: string) => match.slice(2, -2).trim()))];
                                      
                                                                             return placeholders.length > 0 ? (
                                         <VStack spacing={2} align="stretch">
                                           {placeholders.map((placeholder, index) => (
                                             <Box 
                                               key={index}
                                               p={2} 
                                               bg={useColorModeValue('white', 'gray.700')} 
                                               borderRadius="md"
                                               border="1px solid"
                                               borderColor={useColorModeValue('gray.200', 'gray.600')}
                                             >
                                               <HStack>
                                                 <Box 
                                                   w={2} 
                                                   h={2} 
                                                   bg="blue.400" 
                                                   borderRadius="full" 
                                                   flexShrink={0}
                                                 />
                                                 <Code 
                                                   fontSize="xs" 
                                                   bg="transparent" 
                                                   p={0}
                                                   wordBreak="break-all"
                                                   whiteSpace="pre-wrap"
                                                   overflow="hidden"
                                                   textOverflow="ellipsis"
                                                 >
                                                   {`{{${placeholder}}}`}
                                                 </Code>
                                               </HStack>
                                             </Box>
                                           ))}
                                         </VStack>
                                      ) : (
                                        <Box 
                                          p={3} 
                                          bg={useColorModeValue('gray.100', 'gray.700')} 
                                          borderRadius="md"
                                          textAlign="center"
                                        >
                                          <Text fontSize="xs" color="gray.500">
                                            No placeholders found
                                          </Text>
                                          <Text fontSize="xs" color="gray.400" mt={1}>
                                            Use {`{{variable_name}}`} format
                                          </Text>
                                        </Box>
                                      );
                                    })()}
                                  </Box>
                                </VStack>
                              </Box>
                              
                              {/* Right Panel - Template Content */}
                              <Box flex="1" p={4} display="flex" flexDirection="column">
                                <Text fontSize="md" fontWeight="semibold" mb={3} color={useColorModeValue('gray.800', 'white')}>
                                  Template Content
                                </Text>
                                <FormControl flex="1" display="flex" flexDirection="column">
                                  <Textarea
                                    value={editedTemplate?.template || ''}
                                    onChange={(e) => updateTemplateField('template', e.target.value)}
                                    placeholder="Enter your template content with placeholders like {{client_name}}, {{date}}, etc..."
                                    fontFamily="mono"
                                    fontSize="sm"
                                    resize="none"
                                    flex="1"
                                    bg={useColorModeValue('gray.50', 'gray.900')}
                                    border="1px solid"
                                    borderColor={useColorModeValue('gray.300', 'gray.600')}
                                    borderRadius="md"
                                    _focus={{
                                      borderColor: 'blue.400',
                                      boxShadow: '0 0 0 1px blue.400'
                                    }}
                                  />
                                </FormControl>
                              </Box>
                            </Flex>
                          ) : (
                            <Box p={4} h="full" display="flex" flexDirection="column">
                              <Text fontSize="md" fontWeight="semibold" mb={3} color={useColorModeValue('gray.800', 'white')}>
                                Raw YAML Content
                              </Text>
                              <FormControl flex="1" display="flex" flexDirection="column">
                                <Textarea
                                  value={editedRawYaml}
                                  onChange={(e) => setEditedRawYaml(e.target.value)}
                                  fontFamily="mono"
                                  fontSize="sm"
                                  resize="none"
                                  flex="1"
                                  bg={useColorModeValue('gray.50', 'gray.900')}
                                  border="1px solid"
                                  borderColor={useColorModeValue('gray.300', 'gray.600')}
                                  borderRadius="md"
                                  _focus={{
                                    borderColor: 'blue.400',
                                    boxShadow: '0 0 0 1px blue.400'
                                  }}
                                  placeholder="# YAML content will appear here..."
                                />
                              </FormControl>
                            </Box>
                          )}
                        </Box>
                      </Flex>
                    </Box>
                  ) : (
                    <Flex direction="column" align="center" justify="center" h="full" textAlign="center">
                      <Edit2 size={48} color={useColorModeValue('#CBD5E0', '#4A5568')} />
                      <Text color="gray.500" fontSize="lg" mt={4} fontWeight="medium">
                        No Template Selected
                      </Text>
                      <Text color="gray.400" fontSize="sm" mt={2}>
                        Select a template from the Browse tab to edit it
                      </Text>
                    </Flex>
                  )}
                </TabPanel>
                
                {/* Create New Tab */}
                <TabPanel h="full" p={4} display="flex" flexDirection="column">
                  <VStack spacing={4} align="stretch" flex="1" minH="0">
                    {error && (
                      <Alert status="error" borderRadius="md" py={2}>
                        <AlertIcon />
                        <Text fontSize="sm">{error}</Text>
                      </Alert>
                    )}
                    
                    {success && (
                      <Alert status="success" borderRadius="md" py={2}>
                        <AlertIcon />
                        <Text fontSize="sm">{success}</Text>
                      </Alert>
                    )}
                    
                    {createStep === 'input' && (
                      <>
                        <HStack spacing={4} align="end">
                          <FormControl flex="1">
                            <FormLabel fontSize="sm">Template Name</FormLabel>
                            <Input
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              placeholder="Enter template name..."
                              size="sm"
                            />
                          </FormControl>
                          
                          <FormControl flex="1">
                            <FormLabel fontSize="sm">
                              File Name 
                              <Text as="span" fontSize="xs" color="gray.500" ml={1}>
                                (optional)
                              </Text>
                            </FormLabel>
                            <Input
                              value={newTemplateFilename}
                              onChange={(e) => setNewTemplateFilename(e.target.value)}
                              placeholder="my_template.yaml"
                              size="sm"
                            />
                          </FormControl>
                        </HStack>
                        
                        {newTemplateName && (
                          <Text fontSize="xs" color="gray.500" mt={-2}>
                            Auto-generated filename: {newTemplateName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()}_template.yaml
                          </Text>
                        )}
                        
                        <FormControl>
                          <FormLabel fontSize="sm">Description</FormLabel>
                          <Textarea
                            value={newTemplateDescription}
                            onChange={(e) => setNewTemplateDescription(e.target.value)}
                            placeholder="Brief description of this template..."
                            rows={2}
                            size="sm"
                          />
                        </FormControl>
                        
                        <FormControl flex="1" display="flex" flexDirection="column" minH="0">
                          <FormLabel fontSize="sm">Paste Raw Text (with hardcoded values to be converted to placeholders)</FormLabel>
                          <Textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Paste your email template with actual values that should become placeholders..."
                            flex="1"
                            resize="none"
                            minH="150px"
                          />
                        </FormControl>
                        
                        <Box pt={2}>
                          <Button
                            leftIcon={<Plus size={16} />}
                            colorScheme="blue"
                            onClick={handleAnalyzeText}
                            isLoading={isAnalyzing}
                            isDisabled={!newTemplateName.trim() || !rawText.trim()}
                            size="sm"
                          >
                            {isAnalyzing ? 'Analyzing with AI...' : 'Analyze & Create Placeholders'}
                          </Button>
                        </Box>
                      </>
                    )}
                    
                    {createStep === 'placeholders' && (
                      <>
                        <Text fontWeight="bold" fontSize="sm">Detected Placeholders</Text>
                        <Text fontSize="xs" color="gray.500">
                          Review the detected values and choose which ones to convert to placeholders:
                        </Text>
                        {detectedPlaceholders.length === 0 ? (
                          <Alert status="info" borderRadius="md" py={2}>
                            <AlertIcon />
                            <Text fontSize="sm">No placeholders were automatically detected. You can manually add them in the YAML step.</Text>
                          </Alert>
                        ) : (
                          <Alert status="success" borderRadius="md" py={2}>
                            <AlertIcon />
                            <Text fontSize="sm">Found {detectedPlaceholders.length} potential placeholder{detectedPlaceholders.length > 1 ? 's' : ''} using AI analysis!</Text>
                          </Alert>
                        )}
                        
                        <Box flex="1" overflowY="auto" minH="0">
                          <VStack spacing={2} align="stretch">
                            {detectedPlaceholders.map((placeholder, index) => (
                              <HStack key={index} p={2} bg={itemBgColor} borderRadius="md">
                                <Checkbox
                                  isChecked={placeholder.accepted}
                                  onChange={(e) => updatePlaceholder(index, 'accepted', e.target.checked)}
                                  size="sm"
                                />
                                <Code fontSize="xs" flex="1">{placeholder.original}</Code>
                                <Text fontSize="xs" color="gray.500">→</Text>
                                <Input
                                  value={placeholder.suggested}
                                  onChange={(e) => updatePlaceholder(index, 'suggested', e.target.value)}
                                  size="sm"
                                  w="180px"
                                />
                              </HStack>
                            ))}
                          </VStack>
                        </Box>
                        
                        <Box pt={2}>
                          <HStack>
                            <Button variant="ghost" onClick={() => setCreateStep('input')} size="sm">
                              Back
                            </Button>
                            <Button
                              colorScheme="blue"
                              onClick={handleConfirmPlaceholders}
                              size="sm"
                            >
                              Generate Template
                            </Button>
                          </HStack>
                        </Box>
                      </>
                    )}
                    
                    {createStep === 'yaml' && (
                      <>
                        <Text fontWeight="bold" fontSize="sm">Generated Template YAML</Text>
                        <Text fontSize="xs" color="gray.500">
                          Review and edit the generated YAML before saving:
                        </Text>
                        
                        <Textarea
                          value={newTemplateContent}
                          onChange={(e) => setNewTemplateContent(e.target.value)}
                          fontFamily="mono"
                          fontSize="sm"
                          flex="1"
                          resize="none"
                          minH="150px"
                        />
                        
                        <Box pt={2}>
                          <HStack>
                            <Button variant="ghost" onClick={() => setCreateStep('placeholders')} size="sm">
                              Back
                            </Button>
                            <Button
                              leftIcon={<Save size={16} />}
                              colorScheme="green"
                              onClick={handleCreateTemplate}
                              isLoading={isLoading}
                              size="sm"
                            >
                              Save Template
                            </Button>
                          </HStack>
                        </Box>
                      </>
                    )}
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Template
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirmDeleteTemplate} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}; 