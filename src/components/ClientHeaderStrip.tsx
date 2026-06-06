import React, { useState, useEffect } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Flex, Text } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { useAppContext } from '../context/AppContext';
import { useClientInfo } from '../hooks/useClientInfo';
import { showToast } from "@/components/ui/toaster";
import { normalizePath, getParentPath, joinPath } from '../utils/path';

/**
 * Client header strip — appears above the file grid when navigated
 * into any subfolder under root. Shows client info if detected in CSV,
 * otherwise shows folder name with "Client not detected" label.
 * Includes subfolder navigation pills on the right.
 */
export const ClientHeaderStrip: React.FC = () => {
  const { currentDirectory, rootDirectory, setCurrentDirectory } = useAppContext();
  const {
    clientInfo,
    clientName,
    getClientName,
    getIRDNumber,
    getAddress,
    hasClientLink,
    jobYearsWithLinks,
    openJobLink,
    clientFolderPath,
  } = useClientInfo(currentDirectory, rootDirectory);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [subfolders, setSubfolders] = useState<Array<{ name: string; path: string }>>([]);

  // Only show when inside a client subfolder (at least 1 level below root)
  const normalizedRoot = normalizePath(rootDirectory);
  const normalizedCurrent = normalizePath(currentDirectory);
  const isInsideRoot = normalizedRoot && normalizedCurrent && normalizedCurrent !== normalizedRoot && normalizedCurrent.startsWith(normalizedRoot);

  // Derive the client folder path (root + first segment)
  const sep = typeof navigator !== 'undefined' && navigator.platform.startsWith('Win') ? '\\' : '/';
  const rootWithSep = normalizedRoot ? (normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep) : '';
  const relative = isInsideRoot && normalizedCurrent ? normalizedCurrent.slice(rootWithSep.length) : '';
  const firstSegment = relative.split(sep).filter(Boolean)[0] || '';
  const clientFolder = firstSegment ? rootWithSep + firstSegment : '';

  // Detect which subfolder we're currently in
  const relativeFromClient = clientFolder && normalizedCurrent ? normalizedCurrent.slice(clientFolder.length).split(sep).filter(Boolean) : [];
  const currentSubfolder = relativeFromClient[0] || '';

  // Load subfolders of the client folder
  useEffect(() => {
    if (!clientFolder) { setSubfolders([]); return; }
    let mounted = true;
    const load = async () => {
      try {
        const entries = await window.electronAPI.getDirectoryContents(clientFolder);
        const folders = Array.isArray(entries)
          ? entries.filter((item: any) => item?.type === 'folder' && typeof item?.name === 'string' && !item.name.startsWith('.'))
          : [];
        folders.sort((a: any, b: any) => a.name.localeCompare(b.name));
        if (mounted) setSubfolders(folders.map((f: any) => ({ name: f.name, path: f.path })));
      } catch {
        if (mounted) setSubfolders([]);
      }
    };
    load();
    return () => { mounted = false; };
  }, [clientFolder]);

  // Colors (hooks must be called before early returns)
  const bg = useColorModeValue('#f0f4f8', '#1c2233');
  const borderColor = useColorModeValue('#e2e8f0', '#2a3347');
  const textColor = useColorModeValue('#1a202c', '#e2e8f0');
  const subtextColor = useColorModeValue('#64748b', '#7a8699');
  const initialsBg = useColorModeValue('blue.500', '#2C5282');
  const labelColor = useColorModeValue('#94a3b8', '#566478');
  const valueBg = useColorModeValue('rgba(0,0,0,0.04)', 'rgba(255,255,255,0.05)');
  const valueHoverBg = useColorModeValue('rgba(0,0,0,0.08)', 'rgba(255,255,255,0.09)');
  const linkColor = useColorModeValue('blue.600', '#69c3f4');
  const pillBg = useColorModeValue('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.06)');
  const pillHoverBg = useColorModeValue('rgba(0,0,0,0.10)', 'rgba(255,255,255,0.12)');
  const pillActiveBg = useColorModeValue('blue.500', '#2C5282');
  const pillActiveColor = useColorModeValue('white', 'white');
  const pillColor = useColorModeValue('#475569', '#a0aec0');

  if (!isInsideRoot || !clientName) return null;

  const displayName = getClientName() || clientName;
  const hasInfo = !!clientInfo;
  const irdNumber = getIRDNumber();
  const address = getAddress();

  // Generate initials from client name
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  const handleCopy = async (text: string, field: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast({ title: 'Failed to copy', status: 'error', duration: 2000, position: 'bottom' });
    }
  };

  return (
    <Box
      flexShrink={0}
      bg={bg}
      borderBottom="1px solid"
      borderColor={borderColor}
      px={4}
      py={2}
      userSelect="none"
    >
      <Flex align="center" gap={3} minW={0}>
        {/* Initials avatar */}
        <Flex
          flexShrink={0}
          w="36px"
          h="36px"
          borderRadius="6px"
          bg={initialsBg}
          color="white"
          fontSize="14px"
          fontWeight="700"
          align="center"
          justify="center"
          letterSpacing="0.02em"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {initials}
        </Flex>

        {/* Name + meta row */}
        <Flex direction="column" minW={0} gap={0.5}>
          <Text
            fontSize="15px"
            fontWeight="600"
            color={textColor}
            lineClamp={1}
            minW={0}
          >
            {displayName}
          </Text>
          {!hasInfo ? (
            <Text fontSize="11px" color={subtextColor} fontStyle="italic">
              Client not detected
            </Text>
          ) : (
            <Flex align="center" gap={3} minW={0} overflow="hidden">
              {irdNumber && (
                <Tooltip
                  content="Copied to clipboard"
                  showArrow
                  open={copiedField === 'ird'}
                  disabled={copiedField !== 'ird'}
                  positioning={{ placement: 'bottom' }}
                >
                  <Flex
                    align="center"
                    gap={1}
                    cursor="pointer"
                    px="5px"
                    py="1px"
                    borderRadius="3px"
                    bg={valueBg}
                    _hover={{ bg: valueHoverBg }}
                    transition="background 0.15s ease"
                    onClick={() => handleCopy(irdNumber, 'ird')}
                    flexShrink={0}
                  >
                    <Text fontSize="10px" fontWeight="600" color={labelColor} textTransform="uppercase" letterSpacing="0.04em">
                      IR#
                    </Text>
                    <Text fontSize="12px" fontWeight="500" color={textColor}>
                      {irdNumber}
                    </Text>
                  </Flex>
                </Tooltip>
              )}
              {jobYearsWithLinks.length > 0 && (
                <Flex align="center" gap={1} flexShrink={0}>
                  <Text fontSize="10px" fontWeight="600" color={labelColor} textTransform="uppercase" letterSpacing="0.04em">
                    XPM
                  </Text>
                  {jobYearsWithLinks.map((year) => (
                    <Box
                      key={year}
                      as="button"
                      px="5px"
                      py="1px"
                      borderRadius="3px"
                      bg={valueBg}
                      color={linkColor}
                      fontSize="12px"
                      fontWeight="500"
                      cursor="pointer"
                      border="none"
                      transition="background 0.15s ease"
                      _hover={{ bg: valueHoverBg }}
                      _focus={{ outline: 'none' }}
                      onClick={() => openJobLink(year)}
                    >
                      {year}
                    </Box>
                  ))}
                </Flex>
              )}
              {address && (
                <Tooltip
                  content="Copied to clipboard"
                  showArrow
                  open={copiedField === 'address'}
                  disabled={copiedField !== 'address'}
                  positioning={{ placement: 'bottom' }}
                >
                  <Flex
                    align="center"
                    gap={1}
                    cursor="pointer"
                    px="5px"
                    py="1px"
                    borderRadius="3px"
                    bg={valueBg}
                    _hover={{ bg: valueHoverBg }}
                    transition="background 0.15s ease"
                    onClick={() => handleCopy(address, 'address')}
                    minW={0}
                    overflow="hidden"
                    flexShrink={1}
                  >
                    <Text fontSize="10px" fontWeight="600" color={labelColor} textTransform="uppercase" letterSpacing="0.04em" flexShrink={0}>
                      ADDR
                    </Text>
                    <Text fontSize="12px" fontWeight="500" color={subtextColor} lineClamp={1} minW={0}>
                      {address}
                    </Text>
                  </Flex>
                </Tooltip>
              )}
            </Flex>
          )}
        </Flex>

        {/* Spacer */}
        <Box flex={1} minW={2} />

        {/* Subfolder navigation pills */}
        {subfolders.length > 0 && (
          <Flex align="center" gap="4px" flexShrink={0} flexWrap="wrap" justifyContent="flex-end" maxW="55%">
            {subfolders.map((sub) => {
              const isActive = sub.name === currentSubfolder;
              return (
                <Box
                  key={sub.path}
                  as="button"
                  px="8px"
                  py="3px"
                  borderRadius="3px"
                  bg={isActive ? pillActiveBg : pillBg}
                  color={isActive ? pillActiveColor : pillColor}
                  fontSize="11px"
                  fontWeight={isActive ? '600' : '500'}
                  cursor="pointer"
                  border="none"
                  userSelect="none"
                  transition="background 0.15s ease, color 0.15s ease"
                  _hover={{ bg: isActive ? pillActiveBg : pillHoverBg }}
                  _focus={{ outline: 'none' }}
                  onClick={() => setCurrentDirectory(sub.path)}
                  title={sub.name}
                >
                  {sub.name}
                </Box>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Box>
  );
};
