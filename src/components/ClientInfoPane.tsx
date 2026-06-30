import React, { useEffect, useRef, useState, useCallback } from 'react';
import Sortable from 'sortablejs';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Text, Flex, Icon } from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Folder, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { docuFramePalette as P } from '../docuFrameColors';

// ── Deterministic avatar color from name ─────────────────
const AVATAR_COLORS = [
  '#2C5282', '#2B6CB0', '#2C7A7B', '#276749', '#744210',
  '#9B2C2C', '#702459', '#553C9A', '#2D3748', '#1A365D',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

// ── One Commander-style section container ─────────────────
interface SectionContainerProps {
  title: string;
  children: React.ReactNode;
  containerBg: string;
  borderColor: string;
  titleColor: string;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
  title,
  children,
  containerBg,
  borderColor,
  titleColor,
}) => (
  <Box
    mx="8px"
    mb="10px"
    borderRadius="4px"
    bg={containerBg}
    overflow="hidden"
  >
    {/* Section header */}
    <Flex
      align="center"
      px="9px"
      h="28px"
      flexShrink={0}
      gap="6px"
    >
      <Box
        w="2px"
        h="10px"
        bg="blue.400"
        borderRadius="full"
        flexShrink={0}
      />
      <Text
        fontSize="10.5px"
        fontWeight="700"
        letterSpacing="0.06em"
        textTransform="uppercase"
        color={titleColor}
        userSelect="none"
        lineHeight="1"
      >
        {title}
      </Text>
    </Flex>
    {/* Items */}
    <Box py="2px">
      {children}
    </Box>
  </Box>
);

// ── Compact sidebar row ───────────────────────────────────
interface SidebarItemProps {
  label: string;
  textColor: string;
  hoverBg: string;
  onClick: () => void;
  rightSlot?: React.ReactNode;
  iconOverride?: React.ReactNode;
  iconColor?: string;
  draggable?: boolean;
  'data-path'?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  label,
  textColor,
  hoverBg,
  onClick,
  rightSlot,
  iconOverride,
  iconColor = 'blue.400',
  draggable = false,
  ...rest
}) => (
  <Flex
    align="center"
    pl="10px"
    pr="5px"
    mx="3px"
    minH="28px"
    minW={0}
    overflow="hidden"
    borderRadius="3px"
    _hover={{ bg: hoverBg }}
    color={textColor}
    cursor="pointer"
    userSelect="none"
    onClick={onClick}
    role="group"
    transition="background 0.15s ease"
    {...rest}
  >
    <Icon boxSize="14px" mr="7px" color={iconColor} flexShrink={0} asChild>
      {iconOverride ?? <Folder />}
    </Icon>
    <Text
      fontSize="12.5px"
      lineHeight="28px"
      color="inherit"
      fontWeight="normal"
      flex={1}
      minW={0}
      w={0}
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
    >
      {label}
    </Text>
    {rightSlot}
  </Flex>
);

// ── Recent client row with subfolder pills ───────────────
interface RecentClientRowProps {
  clientPath: string;
  textColor: string;
  hoverBg: string;
  titleColor: string;
  onNavigate: (path: string) => void;
}

const RecentClientRow: React.FC<RecentClientRowProps> = ({
  clientPath,
  textColor,
  hoverBg,
  titleColor,
  onNavigate,
}) => {
  const [subfolders, setSubfolders] = useState<Array<{ name: string; path: string }>>([]);
  const clientName = clientPath.split(/[/\\]/).filter(Boolean).pop() ?? clientPath;
  const avatarColor = getAvatarColor(clientName);
  const initials = getInitials(clientName);

  // Pill colors — year pills get a subtle blue tint, category pills stay neutral
  const yearPillBg = useColorModeValue('rgba(59,130,246,0.08)', 'rgba(99,179,237,0.1)');
  const yearPillHoverBg = useColorModeValue('rgba(59,130,246,0.16)', 'rgba(99,179,237,0.2)');
  const yearPillColor = useColorModeValue('#2563eb', '#90cdf4');
  const catPillBg = useColorModeValue('rgba(0,0,0,0.04)', 'rgba(255,255,255,0.06)');
  const catPillHoverBg = useColorModeValue('rgba(0,0,0,0.08)', 'rgba(255,255,255,0.12)');
  const catPillColor = useColorModeValue('#64748b', 'rgba(200,208,219,0.85)');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const entries = await window.electronAPI.getDirectoryContents(clientPath);
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
    // Only re-load when the client itself changes — NOT on every navigation elsewhere.
    // (Was [clientPath, currentDirectory], which refetched all recent-client rows on each nav.)
  }, [clientPath]);

  const isYearPill = (name: string) => /^20\d{2}$/.test(name);

  return (
    <Box mx="3px" mb="6px">
      {/* Client header row — avatar + name */}
      <Flex
        align="center"
        pl="8px"
        pr="5px"
        minH="28px"
        minW={0}
        overflow="hidden"
        borderRadius="3px"
        cursor="default"
        userSelect="none"
        gap="8px"
      >
        {/* Mini initials avatar */}
        <Flex
          flexShrink={0}
          w="22px"
          h="22px"
          borderRadius="4px"
          bg={avatarColor}
          color="white"
          fontSize="9px"
          fontWeight="700"
          align="center"
          justify="center"
          letterSpacing="0.02em"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {initials}
        </Flex>
        <Tooltip content={clientName} showArrow openDelay={600} positioning={{ placement: 'right' }}>
          <Text
            fontSize="12px"
            lineHeight="28px"
            color={textColor}
            fontWeight="500"
            flex={1}
            minW={0}
            w={0}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            cursor="pointer"
            _hover={{ textDecoration: 'underline' }}
            onClick={() => onNavigate(clientPath)}
          >
            {clientName}
          </Text>
        </Tooltip>
      </Flex>
      {/* Subfolder pills — years vs categories differentiated */}
      {subfolders.length > 0 && (
        <Flex
          pl="38px"
          pr="5px"
          pb="2px"
          pt="2px"
          gap="4px"
          flexWrap="wrap"
          minW={0}
          overflow="hidden"
        >
          {subfolders.map((sub) => {
            const isYear = isYearPill(sub.name);
            return (
              <Box
                key={sub.path}
                as="button"
                px="6px"
                py="1px"
                borderRadius="3px"
                bg={isYear ? yearPillBg : catPillBg}
                color={isYear ? yearPillColor : catPillColor}
                fontSize={isYear ? '11.5px' : '10.5px'}
                fontWeight={isYear ? '600' : '500'}
                fontFamily="inherit"
                fontVariantNumeric={isYear ? 'tabular-nums' : undefined}
                letterSpacing={isYear ? '0.02em' : '0.01em'}
                cursor="pointer"
                border="none"
                userSelect="none"
                transition="background 0.15s ease, color 0.15s ease"
                _hover={{ bg: isYear ? yearPillHoverBg : catPillHoverBg, color: isYear ? yearPillColor : textColor }}
                _focus={{ outline: 'none' }}
                onClick={() => onNavigate(sub.path)}
                title={sub.name}
              >
                {sub.name}
              </Box>
            );
          })}
        </Flex>
      )}
    </Box>
  );
};

// ── Main component ────────────────────────────────────────
export const ClientInfoPane: React.FC = () => {
  const {
    setCurrentDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
    reorderQuickAccessPaths,
    recentClientPaths,
  } = useAppContext();

  const bgColor        = useColorModeValue(P.light.sidebar, P.dark.sidebar);
  const textColor      = useColorModeValue('#334155', '#c8d0db');
  const titleColor     = useColorModeValue('#6b7280', '#7a8699');
  const hoverBg        = useColorModeValue('#f1f5f9', '#242d42');
  const containerBg    = useColorModeValue('#f8fafc', '#1c2233');
  const borderColor    = useColorModeValue('#e2e8f0', '#2a3347');

  const sortableListRef = useRef<HTMLDivElement>(null);
  const sortableRef     = useRef<Sortable | null>(null);
  const quickAccessPathsRef = useRef(quickAccessPaths);
  quickAccessPathsRef.current = quickAccessPaths;

  // SortableJS for pinned folders — re-init when the section mounts/unmounts
  const hasPinned       = Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0;
  useEffect(() => {
    if (!hasPinned || !sortableListRef.current) return;
    sortableRef.current = Sortable.create(sortableListRef.current, {
      animation: 150,
      forceFallback: true,
      fallbackTolerance: 5,
      ghostClass: 'sortable-ghost',
      onEnd: (evt) => {
        const { oldIndex, newIndex } = evt;
        if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
        const current = [...quickAccessPathsRef.current];
        const [moved] = current.splice(oldIndex, 1);
        current.splice(newIndex, 0, moved);
        reorderQuickAccessPaths(current);
      },
    });
    return () => { sortableRef.current?.destroy(); sortableRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPinned]);

  const hasRecent       = Array.isArray(recentClientPaths) && recentClientPaths.length > 0;

  const sectionProps = { containerBg, borderColor, titleColor };

  return (
    <Box h="100%" bg={bgColor} display="flex" flexDirection="column" overflow="hidden" minH={0}>
      <ScrollArea.Root
        type="auto"
        style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}
        className="sidebar-scroll-area"
      >
        <ScrollArea.Viewport style={{ height: '100%', width: '100%', overflowX: 'hidden' }}>
          <Box pt="8px" overflow="hidden">

            {/* ── Pinned (Quick Access) ── */}
            {hasPinned && (
              <SectionContainer title="Quick Access" {...sectionProps}>
                <Box ref={sortableListRef} display="flex" flexDirection="column">
                  {quickAccessPaths.map((pinnedPath) => (
                    <SidebarItem
                      key={pinnedPath}
                      label={pinnedPath.split(/[/\\]/).filter(Boolean).pop() ?? pinnedPath}
                      textColor={textColor}
                      hoverBg={hoverBg}
                      onClick={() => setCurrentDirectory(pinnedPath)}
                      data-path={pinnedPath}
                      draggable
                      rightSlot={
                        <Box
                          as="span"
                          display="flex"
                          alignItems="center"
                          flexShrink={0}
                          px="4px"
                          opacity={0}
                          _groupHover={{ opacity: 1 }}
                          transition="opacity 0.15s"
                          onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeQuickAccessPath(pinnedPath); }}
                          title="Unpin"
                        >
                          <Icon boxSize="11px" color="yellow.500" fill="yellow.500" asChild><Star /></Icon>
                        </Box>
                      }
                    />
                  ))}
                </Box>
              </SectionContainer>
            )}

            {/* ── Recent Clients ── */}
            {hasRecent && (
              <SectionContainer title="Recent Clients" {...sectionProps}>
                {recentClientPaths.map((clientPath) => (
                  <RecentClientRow
                    key={clientPath}
                    clientPath={clientPath}
                    textColor={textColor}
                    hoverBg={hoverBg}
                    titleColor={titleColor}
                    onNavigate={setCurrentDirectory}
                  />
                ))}
              </SectionContainer>
            )}

            {/* Empty state */}
            {!hasPinned && !hasRecent && (
              <Flex direction="column" align="center" justify="center" py={8} gap={2} opacity={0.45}>
                <Icon boxSize="24px" color={titleColor} asChild>
                  <Folder />
                </Icon>
                <Text fontSize="xs" color={titleColor} fontWeight="medium">No folders found</Text>
                <Text fontSize="10px" color={titleColor} opacity={0.7}>
                  Set a root directory to get started
                </Text>
              </Flex>
            )}

          </Box>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </Box>
  );
};
