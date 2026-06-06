import React, { useState } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Flex, Text } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { useAppContext } from '../context/AppContext';
import { useClientInfo } from '../hooks/useClientInfo';
import { showToast } from "@/components/ui/toaster"

const labelStyle = {
  fontSize: '9px',
  fontWeight: 'semibold' as const,
  color: 'whiteAlpha.500',
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
    _hover={onClick ? { bg: 'rgba(255, 255, 255, 0.14)' } : undefined}
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
      letterSpacing="0.01em"
      lineClamp={truncate ? 1 : undefined}
      overflow={truncate ? 'hidden' : undefined}
      textOverflow={truncate ? 'ellipsis' : undefined}
      whiteSpace={truncate ? undefined : 'nowrap'}
    >
      {children}
    </Text>
  </Box>
);

const Section: React.FC<{
  children: React.ReactNode;
  hasBorder?: boolean;
  flexShrink?: number;
  minW?: string | number;
}> = ({ children, hasBorder = true, flexShrink = 0, minW }) => (
  <Flex
    align="center"
    gap={1.5}
    px={3.5}
    py={1}
    userSelect="none"
    borderRight={hasBorder ? '1px solid' : undefined}
    borderColor={hasBorder ? 'rgba(255,255,255,0.08)' : undefined}
    flexShrink={flexShrink}
    minW={minW ?? (flexShrink ? 0 : undefined)}
    overflow={flexShrink ? 'hidden' : undefined}
    transition="background 0.2s ease"
    _hover={{ bg: 'rgba(255,255,255,0.04)' }}
  >
    {children}
  </Flex>
);

export const ClientInfoBar: React.FC = () => {
  const { currentDirectory, rootDirectory } = useAppContext();
  const {
    clientInfo,
    getClientName,
    getIRDNumber,
    getAddress,
    openClientLink,
    openJobLink,
    hasClientLink,
    jobYearsWithLinks,
  } = useClientInfo(currentDirectory, rootDirectory);

  const noClientBg = useColorModeValue('gray.100', 'gray.700');
  const noClientColor = useColorModeValue('gray.600', 'gray.300');

  const hasClient = !!clientInfo;
  const clientBg = useColorModeValue('blue.600', '#1e3a5f');
  const bg = hasClient ? clientBg : noClientBg;
  const color = hasClient ? 'white' : noClientColor;
  const [showCopiedName, setShowCopiedName] = useState(false);
  const [showCopiedIrd, setShowCopiedIrd] = useState(false);
  const [showCopiedAddress, setShowCopiedAddress] = useState(false);

  const handleCopyName = async () => {
    const name = getClientName();
    if (!name) return;
    try {
      await navigator.clipboard.writeText(name);
      setShowCopiedName(true);
      setTimeout(() => setShowCopiedName(false), 2000);
    } catch {
      showToast({
        title: 'Failed to copy',
        status: 'error',
        duration: 2000,
        position: 'bottom',
      });
    }
  };

  const handleCopyIrd = async () => {
    const ird = getIRDNumber();
    if (!ird) return;
    try {
      await navigator.clipboard.writeText(ird);
      setShowCopiedIrd(true);
      setTimeout(() => setShowCopiedIrd(false), 2000);
    } catch {
      showToast({
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
      showToast({
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
      h="30px"
      pl={hasClient ? 0 : 3}
      pr={3}
      bg={bg}
      color={color}
      fontSize="sm"
      fontWeight="medium"
      transition="background 0.3s ease, color 0.3s ease"
      borderTop="1px solid rgba(255,255,255,0.06)"
      overflow="hidden"
      minW={0}
      userSelect="none"
    >
      {hasClient ? (
        <Flex align="center" flexWrap="nowrap" minW={0} overflow="hidden" flex={1} userSelect="none">
          <Section flexShrink={0} minW="200px">
            <Tooltip
              content="Copied to clipboard"
              showArrow
              open={showCopiedName}
              disabled={!showCopiedName}
              positioning={{ placement: 'bottom' }}
            >
              <Box as="span" display="inline-block">
                <Block
                  onClick={handleCopyName}
                  cursor="pointer"
                  fontWeight="semibold"
                >
                  {getClientName() || '-'}
                </Block>
              </Box>
            </Tooltip>
          </Section>
          <Section>
            <Text {...labelStyle}>IR #</Text>
            <Tooltip
              content="Copied to clipboard"
              showArrow
              open={showCopiedIrd}
              disabled={!showCopiedIrd}
              positioning={{
                placement: "bottom"
              }}
            >
              <Box as="span" display="inline-block">
                <Block onClick={handleCopyIrd} cursor="pointer">
                  {getIRDNumber() || '-'}
                </Block>
              </Box>
            </Tooltip>
          </Section>
          {jobYearsWithLinks.length > 0 && (
            <Section>
              <Text {...labelStyle}>XPM</Text>
              {jobYearsWithLinks.map((year) => (
                <Block key={year} onClick={() => openJobLink(year)} cursor="pointer">
                  {year}
                </Block>
              ))}
            </Section>
          )}
          <Box flex={1} minW={2} />
          <Flex align="center" gap={1.5} px={3} py={1} flexShrink={1} minW={0} overflow="hidden" ml="auto" userSelect="none">
            <Text {...labelStyle}>ADDRESS</Text>
            <Tooltip
              content="Copied to clipboard"
              showArrow
              open={showCopiedAddress}
              disabled={!showCopiedAddress}
              positioning={{
                placement: "bottom"
              }}
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
        <Text as="span" opacity={0.6} userSelect="none" fontStyle="italic" fontSize="xs">
          No client detected
        </Text>
      )}
    </Flex>
  );
};
