import React from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Tabs, TabList, TabPanels, TabPanel, Tab, Heading, Divider } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Receipt, Move, FileSymlink, Clipboard, FileCode, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { useColorModeValue } from '@chakra-ui/react';
export const FunctionPanels: React.FC = () => {
  const {
    addLog
  } = useAppContext();
  const bgColor = useColorModeValue('white', 'gray.900');
  const buttonHoverBg = useColorModeValue('gray.100', 'gray.700');
  const handleAction = (action: string) => {
    addLog(`Executing action: ${action}`);
  };
  const FunctionButton: React.FC<{
    icon: React.ElementType;
    label: string;
    action: string;
    description?: string;
    color?: string;
  }> = ({
    icon,
    label,
    action,
    description,
    color = 'blue.400'
  }) => <Tooltip label={description || action} placement="bottom" hasArrow>
      <Button variant="ghost" display="flex" flexDirection="column" height="91px" width="52px" py={2} px={1} minW="auto" _hover={{
      bg: buttonHoverBg
    }} onClick={() => handleAction(action)}>
        <Flex flex="1" align="center" justify="center" mb={1}>
          <Icon as={icon} boxSize={7} color={color} />
        </Flex>
        <Text fontSize="9px" textAlign="center" lineHeight="1.2" fontWeight="normal" width="100%" whiteSpace="normal" wordBreak="break-word" height="28px" display="flex" alignItems="center" justifyContent="center">
          {label}
        </Text>
      </Button>
    </Tooltip>;
  return <Flex direction="column">
      <Tabs variant="line" colorScheme="blue" size="sm">
        <Flex align="center" justify="space-between" px={2} bg={bgColor} borderBottom="2px" borderColor={useColorModeValue('gray.200', 'gray.700')}>
          <TabList borderBottom="none">
            <Tab py={1} px={3} fontSize="sm">
              Functions
            </Tab>
          </TabList>
          <ThemeToggle />
        </Flex>
        <TabPanels>
          <TabPanel p={2}>
            <Flex gap={6}>
              <Box>
                <Flex gap={1}>
                  <FunctionButton icon={FilePlus2} label="Merge PDFs" action="merge_pdfs" description="Combine multiple PDF files into one document" color="green.400" _hover={{
                  bg: buttonHoverBg
                }} />
                  <FunctionButton icon={FileText} label="Merge Inc PDFs" action="merge_inc_pdfs" description="Merge incrementally named PDF files" color="blue.400" />
                  <FunctionButton icon={FileEdit} label="Rename PDFs" action="rename_pdfs" description="Batch rename PDF files with pattern matching" color="purple.400" />
                  <FunctionButton icon={Archive} label="Extract Zips" action="extract_zips" description="Extract all ZIP files in current directory" color="orange.400" />
                  <FunctionButton icon={Move} label="Move Screenshot" action="move_screenshot" description="Automatically organize screenshots" color="cyan.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center">
                  File Management
                </Text>
              </Box>
              <Divider orientation="vertical" h="70px" borderColor={useColorModeValue('gray.200', 'gray.600')} />
              <Box>
                <Flex gap={1}>
                  <FunctionButton icon={FileSymlink} label="Batch Rename" action="batch_rename" description="Rename multiple files using patterns" color="yellow.400" />
                  <FunctionButton icon={FileText} label="Asset Notes" action="asset_notes" description="Generate asset notes from templates" color="pink.400" />
                  <FunctionButton icon={AlertCircle} label="GST Validation" action="gst_validation" description="Validate GST numbers in documents" color="red.400" />
                </Flex>
                <Text fontSize="xs" color="gray.400" mt={1} textAlign="center">
                  Utilities
                </Text>
              </Box>
            </Flex>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>;
};