import React, { useState } from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, Input, Textarea, Box, Flex, Button, Text, Tag, useColorModeValue, IconButton, Tooltip, Tabs, TabList, Tab, TabPanels, TabPanel, VStack, useDisclosure } from '@chakra-ui/react';
import { X, Save, RefreshCw, Code2, Pencil, Trash2, Plus } from 'lucide-react';
interface Placeholder {
  name: string;
  description?: string;
}
interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  templateContent: string;
  placeholders: Placeholder[];
  onSave: () => void;
}
export const TemplateManager: React.FC<TemplateManagerProps> = ({
  isOpen,
  onClose,
  templateName,
  templateContent,
  placeholders,
  onSave
}) => {
  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose
  } = useDisclosure();
  const CreateNewView = () => <Box position="relative" h="full">
      <Box p={4} h="calc(100vh - 220px)">
        <VStack spacing={4} align="stretch">
          <Box>
            <Text mb={1} fontSize="sm" fontWeight="medium">
              Template Name
            </Text>
            <Input placeholder="Enter template name..." size="sm" bg="white" />
          </Box>
          <Box>
            <Text mb={1} fontSize="sm" fontWeight="medium">
              Description
            </Text>
            <Textarea placeholder="Brief description of this template..." size="sm" rows={3} bg="white" />
          </Box>
          <Box flex={1}>
            <Text mb={1} fontSize="sm" fontWeight="medium">
              Template Content
            </Text>
            <Textarea placeholder="Paste your template content here..." size="sm" bg="white" h="calc(100% - 2rem)" />
          </Box>
        </VStack>
      </Box>
      <Box position="absolute" bottom={0} right={0} p={4} bg="white" borderTopWidth="1px" w="full">
        <Flex justify="flex-end">
          <Button size="sm" colorScheme="blue" leftIcon={<Plus size={14} />}>
            Create Template
          </Button>
        </Flex>
      </Box>
    </Box>;
  const BrowseTemplatesView = () => <VStack spacing={4} align="stretch" p={4}>
      <Text fontSize="sm" fontWeight="medium" color="gray.600">
        Templates
      </Text>
      <Box borderWidth="1px" borderRadius="md" bg="white" p={3}>
        <Flex justify="space-between" align="start" mb={2}>
          <VStack align="start" spacing={1}>
            <Text fontWeight="medium" fontSize="sm">
              2025 Annual Accounts Company
            </Text>
            <Text fontSize="xs" color="gray.500">
              Modified: 6/16/2025
            </Text>
          </VStack>
          <Flex gap={1}>
            <IconButton aria-label="Edit template" icon={<Pencil size={14} />} size="xs" variant="ghost" />
            <IconButton aria-label="Delete template" icon={<Trash2 size={14} />} size="xs" variant="ghost" />
          </Flex>
        </Flex>
        <Flex gap={2}>
          <Tag size="sm" colorScheme="blue">
            FINANCIAL
          </Tag>
          <Tag size="sm" colorScheme="blue">
            TAX
          </Tag>
        </Flex>
      </Box>
    </VStack>;
  const EditTemplateView = () => <Box position="relative" h="full">
      <Flex gap={6} p={4} h="calc(100vh - 220px)">
        {/* Main Content Column */}
        <Box flex={1}>
          <VStack spacing={4} align="stretch">
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="medium">
                Template Name
              </Text>
              <Input value={templateName} size="sm" bg="white" />
            </Box>
            <Box>
              <Text mb={1} fontSize="sm" fontWeight="medium">
                Description
              </Text>
              <Textarea size="sm" rows={2} bg="white" placeholder="Enter template description..." />
            </Box>
            <Box flex={1}>
              <Flex justify="space-between" align="center" mb={2}>
                <Text fontSize="sm" fontWeight="medium">
                  Template Content
                </Text>
                <Button size="xs" variant="ghost" leftIcon={<Code2 size={14} />}>
                  Visual Editor
                </Button>
              </Flex>
              <Box borderWidth="1px" borderRadius="md" p={3} bg="white" h="calc(100% - 2rem)" fontFamily="mono" fontSize="sm" overflowY="auto">
                {templateContent}
              </Box>
            </Box>
          </VStack>
        </Box>
        {/* Placeholders Column */}
        <Box w="300px">
          <Text mb={2} fontSize="sm" fontWeight="medium">
            Placeholders
          </Text>
          <Box borderWidth="1px" borderRadius="md" bg="white" h="calc(100% - 2rem)" overflowY="auto">
            <VStack spacing={0} align="stretch" divider={<Box borderBottomWidth="1px" />}>
              {placeholders.map((placeholder, index) => <Flex key={index} p={3} align="center" justify="space-between" fontSize="sm" _hover={{
              bg: 'gray.50'
            }}>
                  <Text>{placeholder.name}</Text>
                  <IconButton aria-label="Edit placeholder" icon={<Pencil size={14} />} size="xs" variant="ghost" />
                </Flex>)}
            </VStack>
          </Box>
        </Box>
      </Flex>
      {/* Fixed Save Button */}
      <Box position="absolute" bottom={0} right={0} p={4} bg="white" borderTopWidth="1px" w="full">
        <Flex justify="flex-end">
          <Button size="sm" colorScheme="blue" leftIcon={<Save size={14} />} onClick={onSave}>
            Save Changes
          </Button>
        </Flex>
      </Box>
    </Box>;
  return <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent maxH="85vh" maxW="1000px">
        <ModalHeader borderBottomWidth="1px" bg={bgColor} p={3}>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={3}>
              <Text fontSize="md">Template Manager</Text>
              <Tag size="sm" colorScheme="blue">
                1
              </Tag>
            </Flex>
            <ModalCloseButton position="relative" top={0} right={0} />
          </Flex>
        </ModalHeader>
        <Tabs>
          <Box borderBottomWidth="1px" bg={bgColor}>
            <TabList px={4}>
              <Tab py={2} fontSize="sm">
                Browse
              </Tab>
              <Tab py={2} fontSize="sm">
                Edit
              </Tab>
              <Tab py={2} fontSize="sm">
                Create New
              </Tab>
            </TabList>
          </Box>
          <TabPanels>
            <TabPanel p={0}>
              <BrowseTemplatesView />
            </TabPanel>
            <TabPanel p={0}>
              <EditTemplateView />
            </TabPanel>
            <TabPanel p={0}>
              <CreateNewView />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </ModalContent>
    </Modal>;
};