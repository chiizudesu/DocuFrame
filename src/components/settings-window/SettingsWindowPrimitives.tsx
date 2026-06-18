import React from 'react';
import type { InputProps } from '@chakra-ui/react';
import {
  Box,
  Flex,
  VStack,
  Text,
  Input,
  IconButton,
  Icon,
} from '@chakra-ui/react';
import { FolderOpen } from 'lucide-react';
import { useColorModeValue } from '../ui/color-mode';
import { useDialogChrome } from '../ui/dialog-chrome';

/** Unified control height for inputs and compact buttons. */
export const SETTINGS_CONTROL_H = '28px';

/** Compact type scale shared across every settings pane. */
export const SETTINGS_FS = {
  pageTitle: '15px',
  pageSubtitle: '11.5px',
  eyebrow: '10px',
  rowTitle: '12px',
  hint: '10.5px',
  body: '12px',
  button: '11px',
} as const;

/** Resolved palette + a few settings-only accents, derived from the shared chrome. */
export function useSettingsTheme() {
  const chrome = useDialogChrome();
  const eyebrow = useColorModeValue('gray.500', 'gray.400');
  const mutedIcon = useColorModeValue('gray.400', 'gray.500');
  const focusBorder = useColorModeValue('blue.500', 'blue.400');
  return { ...chrome, eyebrow, mutedIcon, focusBorder, hairline: chrome.borderColor };
}

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

type SettingsPageProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/** Scrollable pane with a centered, constrained column and a page header. */
export function SettingsPage({ title, subtitle, children }: SettingsPageProps) {
  const { textColor, secondaryTextColor } = useSettingsTheme();
  const thumbBg = useColorModeValue('gray.300', 'gray.600');
  return (
    <Box
      flex="1"
      minH={0}
      h="full"
      overflowY="auto"
      overflowX="hidden"
      css={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: thumbBg, borderRadius: '4px' },
      }}
    >
      <Box maxW="600px" mx="auto" px={8} py={7}>
        <Box mb={7}>
          <Text fontSize={SETTINGS_FS.pageTitle} fontWeight="600" color={textColor} lineHeight="1.15" letterSpacing="-0.01em">
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={SETTINGS_FS.pageSubtitle} color={secondaryTextColor} mt={1.5} lineHeight="short">
              {subtitle}
            </Text>
          ) : null}
        </Box>
        <VStack align="stretch" gap={8}>
          {children}
        </VStack>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Block — an eyebrow-labelled section                                 */
/* ------------------------------------------------------------------ */

type SettingsBlockProps = {
  label?: string;
  children: React.ReactNode;
};

export function SettingsBlock({ label, children }: SettingsBlockProps) {
  const { eyebrow } = useSettingsTheme();
  return (
    <Box>
      {label ? (
        <Text
          fontSize={SETTINGS_FS.eyebrow}
          fontWeight="700"
          letterSpacing="0.08em"
          textTransform="uppercase"
          color={eyebrow}
          mb={2.5}
        >
          {label}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* List — ruled-ledger container (top rule + row dividers)             */
/* ------------------------------------------------------------------ */

export function SettingsList({ children }: { children: React.ReactNode }) {
  const { hairline } = useSettingsTheme();
  return (
    <Box
      borderTopWidth="1px"
      borderTopStyle="solid"
      borderColor={hairline}
      css={{
        '& > *': {
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: hairline,
        },
      }}
    >
      {children}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Row — horizontal label / control                                    */
/* ------------------------------------------------------------------ */

type SettingsRowProps = {
  title: string;
  hint?: string;
  control?: React.ReactNode;
  /** Stack control beneath the label instead of to the right (for wide controls). */
  stacked?: boolean;
  children?: React.ReactNode;
};

export function SettingsRow({ title, hint, control, stacked, children }: SettingsRowProps) {
  const { textColor, secondaryTextColor } = useSettingsTheme();

  if (stacked) {
    return (
      <Box py={2.5}>
        <Flex align="baseline" justify="space-between" gap={3} mb={hint ? 1 : 1.5}>
          <Text fontSize={SETTINGS_FS.rowTitle} fontWeight="500" color={textColor} lineHeight="short">
            {title}
          </Text>
          {control ? <Box flexShrink={0}>{control}</Box> : null}
        </Flex>
        {hint ? (
          <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} lineHeight="short" mb={1.5}>
            {hint}
          </Text>
        ) : null}
        {children}
      </Box>
    );
  }

  return (
    <Flex align="center" justify="space-between" gap={4} py={2.5} minH="38px">
      <Box flex="1" minW={0}>
        <Text fontSize={SETTINGS_FS.rowTitle} fontWeight="500" color={textColor} lineHeight="short">
          {title}
        </Text>
        {hint ? (
          <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} lineHeight="short" mt={0.5}>
            {hint}
          </Text>
        ) : null}
      </Box>
      {control ? <Box flexShrink={0}>{control}</Box> : null}
    </Flex>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

type PathInputRowProps = {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
  placeholder?: string;
  onBrowse: () => void;
  browseAriaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export function PathInputRow({
  value,
  onChange,
  readOnly,
  placeholder,
  onBrowse,
  browseAriaLabel = 'Browse',
  onKeyDown,
}: PathInputRowProps) {
  const { inputBg, hairline, focusBorder, mutedIcon } = useSettingsTheme();
  return (
    <Flex
      w="100%"
      align="stretch"
      borderWidth="1px"
      borderColor={hairline}
      borderRadius="md"
      overflow="hidden"
      h={SETTINGS_CONTROL_H}
      bg="white"
      _dark={{ bg: inputBg }}
      _focusWithin={{ borderColor: focusBorder }}
      transition="border-color 0.12s"
    >
      <Input
        flex={1}
        minW={0}
        border="none"
        borderRadius={0}
        h="full"
        px={2.5}
        fontSize={SETTINGS_FS.body}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        bg="transparent"
        _focus={{ boxShadow: 'none' }}
        onKeyDown={onKeyDown}
      />
      <IconButton
        aria-label={browseAriaLabel}
        variant="ghost"
        borderRadius={0}
        h="full"
        minW="30px"
        w="30px"
        flexShrink={0}
        borderLeftWidth="1px"
        borderLeftColor={hairline}
        onClick={onBrowse}
        size="xs"
        color={mutedIcon}
        _hover={{ color: 'blue.500' }}
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
};

/** Bordered shell for input + trailing control (e.g. API key + visibility toggle). */
export function AffixedInputRow({ inputProps, suffix }: AffixedInputRowProps) {
  const { hairline, focusBorder, inputBg } = useSettingsTheme();
  return (
    <Flex
      w="100%"
      align="stretch"
      borderWidth="1px"
      borderColor={hairline}
      borderRadius="md"
      overflow="hidden"
      h={SETTINGS_CONTROL_H}
      bg="white"
      _dark={{ bg: inputBg }}
      _focusWithin={{ borderColor: focusBorder }}
      transition="border-color 0.12s"
    >
      <Input
        flex={1}
        minW={0}
        border="none"
        borderRadius={0}
        h="full"
        px={2.5}
        bg="transparent"
        fontSize={SETTINGS_FS.body}
        _focus={{ boxShadow: 'none' }}
        {...inputProps}
      />
      <Flex align="center" flexShrink={0} borderLeftWidth="1px" borderLeftColor={hairline} h="full">
        {suffix}
      </Flex>
    </Flex>
  );
}
