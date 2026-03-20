import React from 'react';
import type { BoxProps, InputProps } from '@chakra-ui/react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  IconButton,
  Icon,
} from '@chakra-ui/react';
import { FolderOpen } from 'lucide-react';
import { useColorModeValue } from '../ui/color-mode';

/** Unified control height for path rows, inputs, and compact buttons */
export const SETTINGS_CONTROL_H = '26px';

export function SettingsScrollPanel({ children, ...rest }: BoxProps) {
  const thumbBg = useColorModeValue('gray.300', 'gray.600');
  return (
    <Box
      flex="1"
      minH={0}
      h="full"
      overflowY="auto"
      overflowX="hidden"
      px={5}
      py={2.5}
      css={{
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': {
          background: thumbBg,
          borderRadius: '2px',
        },
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

type SettingsSectionProps = {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  textColor: string;
  secondaryTextColor: string;
  mb?: number | string;
};

export function SettingsSection({
  title,
  description,
  children,
  textColor,
  secondaryTextColor,
  mb = 4,
}: SettingsSectionProps) {
  return (
    <Box mb={mb}>
      {title ? (
        <Heading size="xs" fontWeight="semibold" mb={description ? 0.5 : 1} color={textColor}>
          {title}
        </Heading>
      ) : null}
      {description ? (
        <Text
          fontSize="xs"
          color={secondaryTextColor}
          mb={1.5}
          lineHeight="short"
          title={description.length > 120 ? description : undefined}
        >
          {description}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

type SettingsGroupProps = {
  borderColor: string;
  cardBg: string;
  children: React.ReactNode;
};

export function SettingsGroup({ borderColor, cardBg, children }: SettingsGroupProps) {
  return (
    <Box
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      bg={cardBg}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

type SettingsToggleRowProps = {
  title: string;
  description?: string;
  control: React.ReactNode;
  showDivider?: boolean;
  borderColor: string;
  textColor: string;
  secondaryTextColor: string;
};

export function SettingsToggleRow({
  title,
  description,
  control,
  showDivider,
  borderColor,
  textColor,
  secondaryTextColor,
}: SettingsToggleRowProps) {
  return (
    <Box
      px={2.5}
      py={1}
      borderBottomWidth={showDivider ? '1px' : 0}
      borderColor={borderColor}
    >
      <Flex align="center" gap={2.5} minH="26px">
        <Box flex="1" minW={0}>
          <Text fontSize="xs" fontWeight="semibold" color={textColor} lineHeight="short">
            {title}
          </Text>
          {description ? (
            <Text fontSize="10px" color={secondaryTextColor} lineHeight="short" mt={0.5}>
              {description}
            </Text>
          ) : null}
        </Box>
        <Box flexShrink={0}>{control}</Box>
      </Flex>
    </Box>
  );
}

type PathInputRowProps = {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
  placeholder?: string;
  onBrowse: () => void;
  inputBg: string;
  borderColor: string;
  browseAriaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export function PathInputRow({
  value,
  onChange,
  readOnly,
  placeholder,
  onBrowse,
  inputBg,
  borderColor,
  browseAriaLabel = 'Browse',
  onKeyDown,
}: PathInputRowProps) {
  return (
    <Flex
      w="100%"
      align="stretch"
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
      h={SETTINGS_CONTROL_H}
    >
      <Input
        flex={1}
        minW={0}
        border="none"
        borderRadius={0}
        h="full"
        fontSize="xs"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        bg="white"
        _dark={{ bg: inputBg }}
        _focus={{ boxShadow: 'none' }}
        onKeyDown={onKeyDown}
      />
      <IconButton
        aria-label={browseAriaLabel}
        variant="ghost"
        borderRadius={0}
        h="full"
        minW="28px"
        w="28px"
        flexShrink={0}
        borderLeftWidth="1px"
        borderLeftColor={borderColor}
        onClick={onBrowse}
        size="xs"
      >
        <Icon boxSize={3.5} asChild>
          <FolderOpen />
        </Icon>
      </IconButton>
    </Flex>
  );
}

type AffixedInputRowProps = {
  inputProps: InputProps;
  suffix: React.ReactNode;
  borderColor: string;
};

/** Shared bordered shell for input + trailing control (e.g. API key + visibility). */
export function AffixedInputRow({ inputProps, suffix, borderColor }: AffixedInputRowProps) {
  return (
    <Flex
      w="100%"
      align="stretch"
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      overflow="hidden"
      h={SETTINGS_CONTROL_H}
    >
      <Input
        flex={1}
        minW={0}
        border="none"
        borderRadius={0}
        h="full"
        fontSize="xs"
        _focus={{ boxShadow: 'none' }}
        {...inputProps}
      />
      <Flex
        align="center"
        flexShrink={0}
        borderLeftWidth="1px"
        borderLeftColor={borderColor}
        h="full"
      >
        {suffix}
      </Flex>
    </Flex>
  );
}
