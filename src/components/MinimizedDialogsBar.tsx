import React from 'react';
import {
  Box,
  HStack,
  IconButton,
  Tooltip,
  useColorModeValue,
  Flex,
} from '@chakra-ui/react';
import { Brain, Mail, FileType, FileText, FileSpreadsheet, X } from 'lucide-react';

export type DialogType = 'documentAnalysis' | 'aiEditor' | 'aiTemplater' | 'pdfToCsv' | 'manageTemplates';

export interface MinimizedDialog {
  type: DialogType;
  label: string;
}

interface MinimizedDialogsBarProps {
  minimizedDialogs: MinimizedDialog[];
  onRestore: (type: DialogType) => void;
  onClose: (type: DialogType) => void;
}

const getDialogIcon = (type: DialogType) => {
  switch (type) {
    case 'documentAnalysis':
      return Brain;
    case 'aiEditor':
      return Mail; // Changed from Sparkles to Mail
    case 'aiTemplater':
      return FileType; // Changed from Sparkles to FileType
    case 'pdfToCsv':
      return FileSpreadsheet;
    case 'manageTemplates':
      return FileText;
    default:
      return FileText;
  }
};

export const MinimizedDialogsBar: React.FC<MinimizedDialogsBarProps> = ({
  minimizedDialogs,
  onRestore,
  onClose,
}) => {
  const iconHoverBg = useColorModeValue('#5a6c7d', 'gray.600');
  const iconActiveBg = useColorModeValue('#64748b', 'blue.800');
  const iconColor = useColorModeValue('#e2e8f0', 'gray.300');
  
  // Don't render if no minimized dialogs
  if (minimizedDialogs.length === 0) {
    return null;
  }

  return (
    <HStack spacing={1} alignItems="center" mr={2}>
      {minimizedDialogs.map((dialog) => {
        const Icon = getDialogIcon(dialog.type);
        return (
          <Box
            key={dialog.type}
            position="relative"
            _hover={{
              '& .close-button': {
                opacity: 1,
              },
            }}
          >
            <Tooltip label={dialog.label} placement="bottom">
              <Flex
                align="center"
                justify="center"
                w="30px"
                h="30px"
                borderRadius="md"
                cursor="pointer"
                bg={iconActiveBg}
                color={iconColor}
                _hover={{ bg: iconHoverBg }}
                onClick={() => onRestore(dialog.type)}
                transition="all 0.2s"
              >
                <Icon size={16} />
              </Flex>
            </Tooltip>
            <IconButton
              aria-label={`Close ${dialog.label}`}
              icon={<X size={10} />}
              size="xs"
              position="absolute"
              top={-1}
              right={-1}
              variant="solid"
              colorScheme="red"
              borderRadius="full"
              minW="16px"
              h="16px"
              opacity={0}
              className="close-button"
              transition="opacity 0.2s"
              onClick={(e) => {
                e.stopPropagation();
                onClose(dialog.type);
              }}
            />
          </Box>
        );
      })}
    </HStack>
  );
};
