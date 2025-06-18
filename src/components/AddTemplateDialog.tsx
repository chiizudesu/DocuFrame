import React, { useState } from 'react';
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
  Checkbox
} from '@chakra-ui/react';
import { FilePlus2, Save } from 'lucide-react';
import * as yaml from 'js-yaml';

interface AddTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDirectory: string;
}

export const AddTemplateDialog: React.FC<AddTemplateDialogProps> = ({ isOpen, onClose, currentDirectory }) => {
  const [templateName, setTemplateName] = useState('');
  const [rawText, setRawText] = useState('');
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<{original: string, suggested: string, accepted: boolean}[]>([]);
  const [processedText, setProcessedText] = useState('');
  const [editableYaml, setEditableYaml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<'input' | 'placeholders' | 'yaml'>('input');

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleAnalyzeText = () => {
    if (!rawText.trim() || !templateName.trim()) {
      setError('Please provide both template name and raw text');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Detect potential placeholders (numbers, dates, names, etc.)
      const detections: {original: string, suggested: string, accepted: boolean}[] = [];
      
      // Pattern matching for common hardcoded values
      const patterns = [
        // Dates (various formats)
        { regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, suggest: 'date' },
        { regex: /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, suggest: 'date' },
        { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, suggest: 'date' },
        
        // Money amounts
        { regex: /\$[\d,]+\.?\d*/g, suggest: 'amount' },
        { regex: /\b\d+,?\d*\.?\d*\s*(dollars?|cents?)\b/gi, suggest: 'amount' },
        
        // Numbers that might be amounts or quantities
        { regex: /\b\d{1,3}(,\d{3})*(\.\d{2})?\b/g, suggest: 'amount' },
        
        // Tax years
        { regex: /\b(20\d{2})\b/g, suggest: 'tax_year' },
        
        // IRD numbers
        { regex: /\b\d{2,3}-?\d{3}-?\d{3}\b/g, suggest: 'ird_number' },
        
        // Email addresses (might want to keep some parts)
        { regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, suggest: 'email' },
        
        // Phone numbers
        { regex: /\b\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, suggest: 'phone' },
        
        // Names (capitalized words that might be names)
        { regex: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, suggest: 'client_name' },
      ];

      let workingText = rawText;
      
      patterns.forEach((pattern, patternIndex) => {
        let match;
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        
        while ((match = regex.exec(rawText)) !== null) {
          const value = match[0];
          
          // Skip if already detected
          if (detections.some(d => d.original === value)) continue;
          
          // Generate unique placeholder name
          const existingCount = detections.filter(d => d.suggested.startsWith(pattern.suggest)).length;
          const suggestedName = existingCount > 0 ? `${pattern.suggest}_${existingCount + 1}` : pattern.suggest;
          
          detections.push({
            original: value,
            suggested: suggestedName,
            accepted: true
          });
        }
      });

      setDetectedPlaceholders(detections);
      setCurrentStep('placeholders');
      
    } catch (err) {
      setError(`Failed to analyze text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmPlaceholders = () => {
    let processedText = rawText;
    
    // Replace accepted placeholders
    detectedPlaceholders.forEach(placeholder => {
      if (placeholder.accepted) {
        const globalRegex = new RegExp(placeholder.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedText = processedText.replace(globalRegex, `{{${placeholder.suggested}}}`);
      }
    });
    
    setProcessedText(processedText);
    
    // Generate YAML
    try {
      const acceptedPlaceholders = detectedPlaceholders
        .filter(p => p.accepted)
        .map(p => p.suggested);
      
      const yamlObject = {
        name: templateName,
        description: `Template for ${templateName}`,
        categories: acceptedPlaceholders.length > 0 ? acceptedPlaceholders : ['document'],
        template: processedText,
        created: new Date().toISOString().split('T')[0]
      };

      const yamlString = yaml.dump(yamlObject, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      setEditableYaml(yamlString);
      setCurrentStep('yaml');
      setSuccess('Template processed! Review the YAML and placeholders before saving.');
    } catch (err) {
      setError(`Failed to generate YAML: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const updatePlaceholder = (index: number, field: 'suggested' | 'accepted', value: string | boolean) => {
    setDetectedPlaceholders(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSaveTemplate = async () => {
    if (!editableYaml.trim()) {
      setError('Please generate YAML first');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate YAML syntax
      const parsed = yaml.load(editableYaml);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid YAML structure');
      }

      // Generate filename
      const sanitizedName = templateName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
      const filename = `${sanitizedName}_template.yaml`;
      const fullPath = `${currentDirectory}/${filename}`;

      // Save file using electron API
      await (window as any).electronAPI.writeTextFile(fullPath, editableYaml);
      
      setSuccess(`Template saved as ${filename}`);
      
      // Reset form after successful save
      setTimeout(() => {
        setTemplateName('');
        setRawText('');
        setEditableYaml('');
        setSuccess(null);
        onClose();
      }, 2000);
      
    } catch (err) {
      setError(`Failed to save template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setTemplateName('');
    setRawText('');
    setDetectedPlaceholders([]);
    setProcessedText('');
    setEditableYaml('');
    setError(null);
    setSuccess(null);
    setCurrentStep('input');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent 
        bg={bgColor} 
        color={useColorModeValue('gray.900', 'white')} 
        borderRadius="lg"
        boxShadow="lg" 
        maxW="900px"
        maxH="90vh"
        w="95%"
      >
        <ModalHeader fontSize="lg" fontWeight="bold" textAlign="center" pb={2}>
          <Flex align="center" justify="center" gap={2}>
            <FilePlus2 size={22} />
            Add Template YAML
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6} overflow="hidden" display="flex" flexDirection="column">
          <VStack spacing={4} align="stretch" h="70vh">
            
            {currentStep === 'input' && (
              <>
                {/* Template Name */}
                <FormControl>
                  <FormLabel fontSize="sm">Template Name</FormLabel>
                  <Input
                    placeholder="Enter template name (e.g., 'Client Email')"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    size="sm"
                  />
                </FormControl>

                {/* Raw Text Input */}
                <FormControl flex="1" display="flex" flexDirection="column">
                  <FormLabel fontSize="sm">
                    Raw Email/Template Text
                    <Text fontSize="xs" color="gray.500" fontWeight="normal">
                      Paste your email template with hardcoded values (dates, amounts, names, etc.)
                    </Text>
                  </FormLabel>
                  <Textarea
                    placeholder="Dear John Smith,&#10;&#10;Your tax return for 2024 has been completed. The total amount is $1,250.00.&#10;&#10;Please contact us at (04) 123-4567 if you have any questions.&#10;&#10;Best regards,&#10;Tax Team"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    size="sm"
                    flex="1"
                    minH="200px"
                    resize="vertical"
                  />
                </FormControl>

                <Button
                  leftIcon={<FilePlus2 size={16} />}
                  colorScheme="blue"
                  onClick={handleAnalyzeText}
                  isLoading={isAnalyzing}
                  loadingText="Analyzing..."
                  isDisabled={!templateName.trim() || !rawText.trim()}
                  size="sm"
                >
                  Analyze Template
                </Button>
              </>
            )}

            {currentStep === 'placeholders' && (
              <>
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={2}>
                    Detected Values → Placeholders
                  </Text>
                  <Text fontSize="sm" color="gray.500" mb={4}>
                    Review and edit the detected values that will be converted to placeholders:
                  </Text>
                </Box>

                <Box 
                  flex="1" 
                  overflowY="auto" 
                  border="1px solid" 
                  borderColor={useColorModeValue('gray.200', 'gray.600')} 
                  borderRadius="md" 
                  p={4}
                  bg={useColorModeValue('gray.50', 'gray.700')}
                >
                  <VStack spacing={3} align="stretch">
                    {detectedPlaceholders.map((placeholder, index) => (
                      <Flex key={index} align="center" gap={3} p={3} bg={useColorModeValue('white', 'gray.600')} borderRadius="md" border="1px solid" borderColor={useColorModeValue('gray.200', 'gray.500')}>
                        <Checkbox
                          isChecked={placeholder.accepted}
                          onChange={(e) => updatePlaceholder(index, 'accepted', e.target.checked)}
                        />
                        <Box flex="1">
                          <Text fontSize="sm" fontWeight="medium" color="red.500">
                            "{placeholder.original}"
                          </Text>
                        </Box>
                        <Text fontSize="sm" color="gray.500" mx={2}>→</Text>
                        <Box flex="1">
                          <Input
                            size="sm"
                            value={placeholder.suggested}
                            onChange={(e) => updatePlaceholder(index, 'suggested', e.target.value)}
                            placeholder="placeholder_name"
                            fontSize="sm"
                          />
                        </Box>
                      </Flex>
                    ))}
                    
                    {detectedPlaceholders.length === 0 && (
                      <Text fontSize="sm" color="gray.500" textAlign="center" py={4}>
                        No potential placeholders detected. The template will be used as-is.
                      </Text>
                    )}
                  </VStack>
                </Box>

                <Flex gap={2}>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('input')}
                    size="sm"
                    flex="1"
                  >
                    Back
                  </Button>
                  <Button
                    leftIcon={<Save size={16} />}
                    colorScheme="green"
                    onClick={handleConfirmPlaceholders}
                    size="sm"
                    flex="2"
                  >
                    Generate YAML
                  </Button>
                </Flex>
              </>
            )}

            {currentStep === 'yaml' && (
              <>
                <Flex gap={4} flex="1" minH="0">
                  {/* Left side - Processed Template */}
                  <VStack flex="1" align="stretch" minH="0">
                    <Text fontSize="sm" fontWeight="semibold">Processed Template:</Text>
                    <Textarea
                      value={processedText}
                      isReadOnly
                      size="sm"
                      flex="1"
                      minH="150px"
                      bg={useColorModeValue('gray.100', 'gray.700')}
                      fontSize="xs"
                      resize="none"
                    />
                  </VStack>

                  {/* Right side - YAML Output */}
                  <VStack flex="1" align="stretch" minH="0">
                    <Text fontSize="sm" fontWeight="semibold">YAML Output (Editable):</Text>
                    <Textarea
                      value={editableYaml}
                      onChange={(e) => setEditableYaml(e.target.value)}
                      size="sm"
                      flex="1"
                      minH="150px"
                      fontFamily="mono"
                      fontSize="xs"
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      resize="none"
                    />
                  </VStack>
                </Flex>

                <Flex gap={2}>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('placeholders')}
                    size="sm"
                    flex="1"
                  >
                    Back
                  </Button>
                  <Button
                    leftIcon={<Save size={16} />}
                    colorScheme="green"
                    onClick={handleSaveTemplate}
                    isLoading={isSaving}
                    loadingText="Saving..."
                    size="sm"
                    flex="2"
                  >
                    Save Template
                  </Button>
                </Flex>
              </>
            )}

            {/* Status Messages */}
            {error && (
              <Alert status="error" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {success && (
              <Alert status="success" borderRadius="md" fontSize="sm">
                <AlertIcon />
                {success}
              </Alert>
            )}

            {/* Help Text */}
            <Box bg={useColorModeValue('gray.50', 'gray.700')} p={3} borderRadius="md" fontSize="xs">
              <Text fontWeight="semibold" mb={1}>Template Format Help:</Text>
              <Text>• Use <Code fontSize="xs">{'{{variable_name}}'}</Code> for placeholders</Text>
              <Text>• Categories will be auto-generated from placeholders</Text>
              <Text>• Example: <Code fontSize="xs">{'{{client_name}}'}</Code>, <Code fontSize="xs">{'{{tax_year}}'}</Code></Text>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}; 