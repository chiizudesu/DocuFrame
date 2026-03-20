import React, { useRef, useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { useDialogChrome } from './ui/dialog-chrome';
import { Box, HStack, Input, IconButton, Spinner } from '@chakra-ui/react';
import { Send } from 'lucide-react';
import { editTemplateStream } from '../services/aiService';

interface AIEditBarProps {
  currentTemplate: string;
  onTemplateUpdated: (newTemplate: string) => void;
  onError: (message: string) => void;
}

export const AIEditBar: React.FC<AIEditBarProps> = ({ currentTemplate, onTemplateUpdated, onError }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { inputBg, textColor, secondaryTextColor } = useDialogChrome();
  const barBorder = useColorModeValue('gray.300', 'rgba(105, 195, 244, 0.32)');
  const barGlow = useColorModeValue('none', 'inset 0 0 0 1px rgba(105, 195, 244, 0.1)');
  const innerInputBg = useColorModeValue('white', '#2D3748');
  const innerInputBorder = useColorModeValue('gray.200', 'rgba(105, 195, 244, 0.25)');
  const innerInputFocusRing = useColorModeValue(
    '0 0 0 1px #3182ce',
    '0 0 0 1px rgba(105, 195, 244, 0.85)',
  );

  const handleApply = async () => {
    const trimmed = inputRef.current?.value?.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    let buffer = '';
    try {
      await editTemplateStream(currentTemplate, trimmed, (chunk: string) => {
        buffer += chunk;
      });
      if (buffer.trim()) {
        onTemplateUpdated(buffer.trim());
      }
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: any) {
      console.error('AI template edit failed:', err);
      onError(err.message || 'AI edit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      mt={2}
      p={2}
      bg={inputBg}
      borderRadius="md"
      border="1px solid"
      borderColor={barBorder}
      boxShadow={barGlow}
    >
      <HStack gap={2}>
        <Input
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading && inputRef.current?.value?.trim()) {
              handleApply();
            }
          }}
          placeholder="AI instruction, e.g. 'add a GST section after tax paragraph'..."
          size="xs"
          flex="1"
          disabled={loading}
          bg={innerInputBg}
          color={textColor}
          borderWidth="1px"
          borderColor={innerInputBorder}
          _placeholder={{ color: secondaryTextColor, opacity: 0.85 }}
          _focus={{
            borderColor: 'df.dialogAccent',
            boxShadow: innerInputFocusRing,
          }}
        />
        <IconButton
          aria-label="Apply AI edit"
          size="xs"
          colorPalette="blue"
          onClick={handleApply}
          disabled={loading}>{loading ? <Spinner size="xs" /> : <Send size={14} />}</IconButton>
      </HStack>
    </Box>
  );
};
