import React, { useState } from 'react';
import { Box, Flex, Button, Icon, Text, Tooltip, Tabs, TabList, TabPanels, TabPanel, Tab, Heading, Divider } from '@chakra-ui/react';
import { FileText, FilePlus2, FileEdit, Archive, Receipt, Move, FileSymlink, Clipboard, FileCode, AlertCircle, Settings, Mail, Star, RotateCcw, Copy, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';
import { useColorModeValue } from '@chakra-ui/react';
import { TransferMappingDialog } from './TransferMappingDialog';

export const FunctionPanels: React.FC = () => {
  const {
    addLog,
    setStatus
  } = useAppContext();
  const [isTransferMappingOpen, setTransferMappingOpen] = useState(false);
  const bgColor = useColorModeValue('#f1f5f9', 'gray.900');
  const headerBgColor = useColorModeValue('#ffffff', 'gray.900');
  const headerTextColor = useColorModeValue('#334155', 'white');
  const buttonHoverBg = useColorModeValue('#e2e8f0', 'gray.700');
  const borderColor = useColorModeValue('#cbd5e1', 'gray.700');
  const handleAction = (action: string) => {
    if (action === 'transfer_mapping') {
      setTransferMappingOpen(true);
      setStatus('Opened transfer mapping', 'info');
      return;
    }
    addLog(`Executing action: ${action}`);
    // Get user-friendly function names
    const functionNames: { [key: string]: string } = {
      gst_template: 'GST Template',
      gst_rename: 'GST Rename',
      copy_notes: 'Copy Notes',
      merge_pdfs: 'Merge PDFs',
      extract_zips: 'Extract Zips',
      extract_eml: 'Extract EML',
      transfer_mapping: 'Transfer Map',
      ai_editor: 'AI Editor',
      update: 'Update'
    };
    const friendlyName = functionNames[action] || action;
    setStatus(`Executing ${friendlyName}...`, 'info');
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
  }) => {
    const isLong = label.length > 18;
    return (
      <Tooltip label={description || action} placement="bottom" hasArrow>
        <Button
          variant="ghost"
          display="flex"
          flexDirection="column"
          height="112px"
          minWidth={isLong ? '96px' : '68px'}
          maxWidth="130px"
          width="fit-content"
          py={3}
          px={2}
          _hover={{ bg: buttonHoverBg }}
          onClick={() => handleAction(action)}
        >
          <Flex flex="1" align="center" justify="center" mb={2} width={isLong ? '48px' : '40px'} mx="auto">
            <Icon as={icon} boxSize={9} color={color} />
          </Flex>
          <Text
            as="span"
            fontSize="12px"
            textAlign="center"
            lineHeight="1.2"
            fontWeight="medium"
            width="100%"
            whiteSpace="normal"
            wordBreak="break-word"
            minHeight="34px"
            maxHeight="34px"
            display="inline-block"
            overflow="hidden"
          >
            {(() => {
              const words = label.split(' ');
              if (words.length === 1) {
                return <>{label}<br /></>;
              } else if (words.length === 2) {
                return <>{words[0]}<br />{words[1]}</>;
              } else {
                const mid = Math.ceil(words.length / 2);
                return <>{words.slice(0, mid).join(' ')}<br />{words.slice(mid).join(' ')}</>;
              }
            })()}
          </Text>
        </Button>
      </Tooltip>
    );
  };
  return <>
    <Flex direction="column">
      <Tabs variant="line" colorScheme="indigo" size="sm">
        <Flex align="center" justify="space-between" px={2} bg={headerBgColor} borderBottom="2px" borderColor={borderColor} boxShadow="0 1px 3px rgba(0,0,0,0.1)">
          <TabList borderBottom="none">
            <Tab py={1} px={3} fontSize="sm" color={useColorModeValue('#3b82f6', 'white')} _selected={{
            color: '#3b82f6',
            borderColor: '#3b82f6',
            fontWeight: 'semibold'
          }}>
              Functions
            </Tab>
          </TabList>
          <ThemeToggle />
        </Flex>
        <TabPanels>
          <TabPanel p={2} bg={bgColor}>
            <Flex gap={6}>
              <Box>
                <Flex gap={1}>
                  <FunctionButton icon={FileText} label="GST Template" action="gst_template" description="Open GST template for processing" color="blue.400" />
                  <FunctionButton icon={FileEdit} label="GST Rename" action="gst_rename" description="Rename files according to GST standards" color="green.400" />
                  <FunctionButton icon={Copy} label="Copy Notes" action="copy_notes" description="Copy asset notes to clipboard" color="purple.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center">
                  GST Functions
                </Text>
              </Box>
              <Divider orientation="vertical" h="70px" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box>
                <Flex gap={1}>
                  <FunctionButton icon={FilePlus2} label="Merge PDFs" action="merge_pdfs" description="Combine multiple PDF files into one document" color="red.400" />
                  <FunctionButton icon={Archive} label="Extract Zips" action="extract_zips" description="Extract all ZIP files in current directory" color="orange.400" />
                  <FunctionButton icon={Mail} label="Extract EML" action="extract_eml" description="Extract attachments from EML files" color="cyan.400" />
                  <FunctionButton icon={Settings} label="Transfer Map" action="transfer_mapping" description="Edit transfer command mappings" color="gray.600" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center">
                  File Management
                </Text>
              </Box>
              <Divider orientation="vertical" h="70px" borderColor={useColorModeValue('#e2e8f0', 'gray.600')} />
              <Box>
                <Flex gap={1}>
                  <FunctionButton icon={Star} label="AI Editor" action="ai_editor" description="Email AI editor for content generation" color="yellow.400" />
                  <FunctionButton icon={RotateCcw} label="Update" action="update" description="Update application and components" color="pink.400" />
                </Flex>
                <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.400')} mt={1} textAlign="center">
                  Utilities
                </Text>
              </Box>
            </Flex>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
    <TransferMappingDialog isOpen={isTransferMappingOpen} onClose={() => setTransferMappingOpen(false)} />
  </>;
};