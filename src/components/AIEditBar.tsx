import React, { useRef, useState } from 'react';
import { Box, HStack, Input, IconButton, Select, Spinner, useColorModeValue } from '@chakra-ui/react';
import { Send } from 'lucide-react';
import { AI_AGENTS, editTemplateStream } from '../services/aiService';

interface AIEditBarProps {
  currentTemplate: string;
  onTemplateUpdated: (newTemplate: string) => void;
  onError: (message: string) => void;
}

export const AIEditBar: React.FC<AIEditBarProps> = ({ currentTemplate, onTemplateUpdated, onError }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<string>('claude');

  const itemBgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleApply = async () => {
    const trimmed = inputRef.current?.value?.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    let buffer = '';
    try {
      await editTemplateStream(currentTemplate, trimmed, agent as any, (chunk: string) => {
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
    <Box mt={2} p={2} bg={itemBgColor} borderRadius="md" border="1px solid" borderColor={borderColor}>
      <HStack spacing={2}>
        <Select
          size="xs"
          w="130px"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          flexShrink={0}
        >
          {AI_AGENTS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </Select>
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
          isDisabled={loading}
        />
        <IconButton
          aria-label="Apply AI edit"
          icon={loading ? <Spinner size="xs" /> : <Send size={14} />}
          size="xs"
          colorScheme="blue"
          onClick={handleApply}
          isDisabled={loading}
        />
      </HStack>
    </Box>
  );
};
