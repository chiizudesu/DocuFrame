import React, { useEffect, useRef } from 'react';
import Sortable from 'sortablejs';
import { useColorModeValue } from "./ui/color-mode";
import { Box, Text, Flex, Icon } from '@chakra-ui/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { Folder, Star, FolderOpen } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { docuFramePalette as P } from '../docuFrameColors';

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
    mx="7px"
    mb="7px"
    borderRadius="3px"
    border="1px solid"
    borderColor={borderColor}
    bg={containerBg}
  >
    {/* Section header */}
    <Flex align="center" px="9px" h="24px" flexShrink={0}>
      <Text
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.01em"
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
    pl="8px"
    pr="5px"
    minH="24px"
    _hover={{ bg: hoverBg }}
    color={textColor}
    cursor={draggable ? 'grab' : 'default'}
    userSelect="none"
    onClick={onClick}
    role="group"
    {...rest}
  >
    <Icon boxSize="14px" mr="7px" color={iconColor} flexShrink={0} asChild>
      {iconOverride ?? <Folder />}
    </Icon>
    <Text
      fontSize="12.5px"
      lineHeight="24px"
      color="inherit"
      fontWeight="normal"
      flex={1}
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
    >
      {label}
    </Text>
    {rightSlot}
  </Flex>
);

// ── Main component ────────────────────────────────────────
export const ClientInfoPane: React.FC = () => {
  const {
    setCurrentDirectory,
    rootDirectory,
    quickAccessPaths,
    removeQuickAccessPath,
    reorderQuickAccessPaths,
    recentClientPaths,
  } = useAppContext();

  const bgColor        = useColorModeValue(P.light.sidebar, P.dark.sidebar);
  const textColor      = useColorModeValue('#334155', '#c8d0db');
  const titleColor     = useColorModeValue('#6b7280', '#7a8699');
  const hoverBg        = useColorModeValue('#f1f5f9', '#1f2637');
  const containerBg    = useColorModeValue('#f8fafc', '#1a1f2e');
  const borderColor    = useColorModeValue('#e2e8f0', '#2a3347');

  const [rootFolders, setRootFolders] = React.useState<Array<{ name: string; path: string }>>([]);
  const sortableListRef = useRef<HTMLDivElement>(null);
  const sortableRef     = useRef<Sortable | null>(null);
  const quickAccessPathsRef = useRef(quickAccessPaths);
  quickAccessPathsRef.current = quickAccessPaths;

  // SortableJS for pinned folders
  useEffect(() => {
    if (!sortableListRef.current) return;
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
  }, []);

  // Load root directory folders
  useEffect(() => {
    const load = async () => {
      if (!rootDirectory) { setRootFolders([]); return; }
      try {
        const entries = await window.electronAPI.getDirectoryContents(rootDirectory);
        const folders = Array.isArray(entries)
          ? entries.filter((item: any) => item?.type === 'folder' && typeof item?.name === 'string' && !item.name.startsWith('.'))
          : [];
        folders.sort((a: any, b: any) => a.name.localeCompare(b.name));
        setRootFolders(folders.map((f: any) => ({ name: f.name, path: f.path })));
      } catch { setRootFolders([]); }
    };
    load();
  }, [rootDirectory]);

  const hasPinned       = Array.isArray(quickAccessPaths) && quickAccessPaths.length > 0;
  const unpinnedFolders = rootFolders.filter(f => !quickAccessPaths?.includes(f.path));
  const hasRootFolders  = unpinnedFolders.length > 0;
  const hasRecent       = Array.isArray(recentClientPaths) && recentClientPaths.length > 0;

  const sectionProps = { containerBg, borderColor, titleColor };

  return (
    <Box h="100%" bg={bgColor} display="flex" flexDirection="column" overflow="hidden" minH={0}>
      <ScrollArea.Root
        type="auto"
        style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}
        className="sidebar-scroll-area"
      >
        <ScrollArea.Viewport style={{ height: '100%', width: '100%' }}>
          <Box pt="8px">

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

            {/* ── Root Folders ── */}
            {hasRootFolders && (
              <SectionContainer
                title={rootDirectory ? (rootDirectory.split(/[/\\]/).filter(Boolean).pop() ?? 'Folders') : 'Folders'}
                {...sectionProps}
              >
                {unpinnedFolders.map((folder) => (
                  <SidebarItem
                    key={folder.path}
                    label={folder.name}
                    textColor={textColor}
                    hoverBg={hoverBg}
                    onClick={() => setCurrentDirectory(folder.path)}
                  />
                ))}
              </SectionContainer>
            )}

            {/* ── Recent Clients ── */}
            {hasRecent && (
              <SectionContainer title="Recent Clients" {...sectionProps}>
                {recentClientPaths.map((clientPath) => (
                  <SidebarItem
                    key={clientPath}
                    label={clientPath.split(/[/\\]/).filter(Boolean).pop() ?? clientPath}
                    textColor={textColor}
                    hoverBg={hoverBg}
                    onClick={() => setCurrentDirectory(clientPath)}
                    iconOverride={<FolderOpen size={14} />}
                    iconColor="blue.400"
                  />
                ))}
              </SectionContainer>
            )}

            {/* Empty state */}
            {!hasPinned && !hasRootFolders && !hasRecent && (
              <Flex justify="center" align="center" py={6}>
                <Text fontSize="xs" color={titleColor}>No folders found</Text>
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
