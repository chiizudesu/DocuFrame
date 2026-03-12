import React, { useState } from 'react';
import { Box, Flex, Text, Tooltip, useColorModeValue, useToast } from '@chakra-ui/react';
import { useAppContext } from '../context/AppContext';
import { useClientInfo } from '../hooks/useClientInfo';

const labelStyle = {
  fontSize: '10px',
  fontWeight: 'semibold' as const,
  color: 'whiteAlpha.600',
  letterSpacing: 'wider',
  textTransform: 'uppercase' as const,
  userSelect: 'none' as const,
};

const Block: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  cursor?: string;
  truncate?: boolean;
  fontWeight?: string;
  maxW?: string | number;
}> = ({ children, onClick, cursor = 'default', truncate, fontWeight = 'medium', maxW }) => (
  <Box
    as={onClick ? 'button' : 'div'}
    px={2}
    py={1}
    borderRadius="md"
    bg="transparent"
    onClick={onClick}
    cursor={cursor}
    border="none"
    userSelect="none"
    _hover={onClick ? { bg: 'green.600' } : undefined}
    _focus={{ outline: 'none', boxShadow: 'none' }}
    _focusVisible={{ outline: 'none', boxShadow: 'none' }}
    transition="background 0.15s"
    flexShrink={truncate ? 1 : 0}
    minW={truncate ? 0 : undefined}
    maxW={maxW}
    overflow={truncate ? 'hidden' : undefined}
    textAlign="left"
  >
    <Text
      as="span"
      fontSize="sm"
      fontWeight={fontWeight}
      color="white"
      userSelect="none"
      noOfLines={truncate ? 1 : undefined}
      overflow={truncate ? 'hidden' : undefined}
      textOverflow={truncate ? 'ellipsis' : undefined}
    >
      {children}
    </Text>
  </Box>
);

const Section: React.FC<{
  children: React.ReactNode;
  hasBorder?: boolean;
  flexShrink?: number;
}> = ({ children, hasBorder = true, flexShrink = 0 }) => (
  <Flex
    align="center"
    gap={1.5}
    px={3}
    py={1}
    userSelect="none"
    borderRight={hasBorder ? '1px solid' : undefined}
    borderColor={hasBorder ? 'whiteAlpha.300' : undefined}
    flexShrink={flexShrink}
    minW={flexShrink ? 0 : undefined}
    overflow={flexShrink ? 'hidden' : undefined}
  >
    {children}
  </Flex>
);

export const ClientInfoBar: React.FC = () => {
  const { currentDirectory, rootDirectory } = useAppContext();
  const toast = useToast();
  const {
    clientInfo,
    getClientName,
    getIRDNumber,
    getAddress,
    openClientLink,
    openJobLink,
    hasClientLink,
    has2025JobLink,
    has2026JobLink,
  } = useClientInfo(currentDirectory, rootDirectory);

  const noClientBg = useColorModeValue('gray.100', 'gray.700');
  const noClientColor = useColorModeValue('gray.600', 'gray.300');

  const hasClient = !!clientInfo;
  const clientBg = useColorModeValue('green.600', 'green.700'); // Light theme: softer green; dark: unchanged
  const bg = hasClient ? clientBg : noClientBg;
  const color = hasClient ? 'white' : noClientColor;
  const [showCopiedIrd, setShowCopiedIrd] = useState(false);
  const [showCopiedAddress, setShowCopiedAddress] = useState(false);

  const handleCopyIrd = async () => {
    const ird = getIRDNumber();
    if (!ird) return;
    try {
      await navigator.clipboard.writeText(ird);
      setShowCopiedIrd(true);
      setTimeout(() => setShowCopiedIrd(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
        position: 'bottom',
      });
    }
  };

  const handleCopyAddress = async () => {
    const address = getAddress();
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setShowCopiedAddress(true);
      setTimeout(() => setShowCopiedAddress(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
        position: 'bottom',
      });
    }
  };

  return (
    <Flex
      align="center"
      h="25px"
      pl={hasClient ? 0 : 3}
      pr={3}
      bg={bg}
      color={color}
      fontSize="sm"
      fontWeight="medium"
      transition="background 0.2s, color 0.2s"
      overflow="hidden"
      minW={0}
      userSelect="none"
    >
      {hasClient ? (
        <Flex align="center" flexWrap="nowrap" minW={0} overflow="hidden" flex={1} userSelect="none">
          <Section flexShrink={1}>
            <Block
              onClick={hasClientLink ? openClientLink : undefined}
              cursor={hasClientLink ? 'pointer' : 'default'}
              truncate
              fontWeight="semibold"
              maxW="200px"
            >
              {getClientName() || '-'}
            </Block>
          </Section>
          <Section>
            <Text {...labelStyle}>IR #</Text>
            <Tooltip
              label="Copied to clipboard"
              placement="bottom"
              hasArrow
              isOpen={showCopiedIrd}
            >
              <Box as="span" display="inline-block">
                <Block onClick={handleCopyIrd} cursor="pointer">
                  {getIRDNumber() || '-'}
                </Block>
              </Box>
            </Tooltip>
          </Section>
          {(has2025JobLink || has2026JobLink) && (
            <Section>
              <Text {...labelStyle}>XPM</Text>
              {has2025JobLink && (
                <Block onClick={() => openJobLink('2025')} cursor="pointer">
                  2025
                </Block>
              )}
              {has2026JobLink && (
                <Block onClick={() => openJobLink('2026')} cursor="pointer">
                  2026
                </Block>
              )}
            </Section>
          )}
          <Box flex={1} minW={2} />
          <Flex align="center" gap={1.5} px={3} py={1} flexShrink={1} minW={0} overflow="hidden" ml="auto" userSelect="none">
            <Text {...labelStyle}>ADDRESS</Text>
            <Tooltip
              label="Copied to clipboard"
              placement="bottom"
              hasArrow
              isOpen={showCopiedAddress}
            >
              <Box as="span" display="inline-block">
                <Block onClick={handleCopyAddress} cursor="pointer" truncate fontWeight="normal">
                  {getAddress() || '-'}
                </Block>
              </Box>
            </Tooltip>
          </Flex>
        </Flex>
      ) : (
        <Text as="span" opacity={0.8} userSelect="none">
          No client detected
        </Text>
      )}
    </Flex>
  );
};
