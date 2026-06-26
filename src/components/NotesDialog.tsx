import React, { useState, useEffect, useRef } from 'react';
import { useColorModeValue } from './ui/color-mode';
import { useDialogChrome } from './ui/dialog-chrome';
import { showToast } from '@/components/ui/toaster';
import {
  Button,
  Input,
  IconButton,
  Box,
  Text,
  Flex,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Check as LuCheck, Copy as LuCopy, Pencil as LuPencil, Plus as LuPlus, Trash2 as LuTrash2, X as LuX } from 'lucide-react';
import { SETTINGS_FS, SETTINGS_CONTROL_H } from './settings-window/SettingsWindowPrimitives';
import { docuFramePalette as P } from '../docuFrameColors';
import type { Note } from '../types';

interface NotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Hero copy-feedback + contentEditable placeholder. One injected stylesheet, no dep.
const NOTES_CSS = `
@keyframes notesCopyIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes notesShine { from { transform: translateX(-130%) skewX(-18deg); } to { transform: translateX(130%) skewX(-18deg); } }
.notes-editable[data-placeholder]:empty::before { content: attr(data-placeholder); opacity: 0.5; pointer-events: none; }
.notes-editable a { color: #3b82f6; text-decoration: underline; }
.notes-editable ul, .notes-editable ol { padding-left: 1.25em; margin: 0.25em 0; }
`;

/**
 * Strip script/style, inline event handlers, javascript: URLs, and <img> on save.
 * Notes are the user's own locally-stored paste, so this is light defence, not a real
 * sanitizer. Images are dropped to keep config.json small (text + links only).
 * ponytail: if notes ever become shareable or need images, swap in DOMPurify + a blob store.
 */
const sanitize = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, img').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const bad = /^on/i.test(attr.name) ||
        (/^(href|src)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value));
      if (bad) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
};

const htmlToText = (html: string): string => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.innerText || el.textContent || '').trim();
};

/** Inline editor — uncontrolled contentEditable (controlling one fights the caret). */
const NoteEditor: React.FC<{
  initial?: Note;
  onSave: (title: string, html: string) => void;
  onCancel: () => void;
  inputBg: string;
  borderColor: string;
  textColor: string;
  secondaryTextColor: string;
}> = ({ initial, onSave, onCancel, inputBg, borderColor, textColor, secondaryTextColor }) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = initial?.html ?? '';
    // Focus title for a new note, body when editing existing content.
    // (mount-only — initial is fixed per editor instance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    const html = sanitize(bodyRef.current?.innerHTML ?? '');
    onSave(title.trim() || 'Untitled note', html);
  };

  return (
    <Flex direction="column" gap={2} h="100%">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        h={SETTINGS_CONTROL_H}
        fontSize={SETTINGS_FS.body}
        fontWeight="600"
        bg={inputBg}
        borderColor={borderColor}
        autoFocus={!initial}
        flexShrink={0}
      />
      <Box
        ref={bodyRef}
        className="notes-editable"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Paste or type your note here — formatting, links and bullets are kept."
        flex="1"
        minH="180px"
        overflowY="auto"
        bg={inputBg}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="md"
        px={2.5}
        py={2}
        fontSize={SETTINGS_FS.body}
        color={textColor}
        lineHeight="1.5"
        _focus={{ outline: 'none', borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)' }}
        css={{ '& *': { maxWidth: '100%' } }}
      />
      <Flex justify="space-between" align="center" flexShrink={0}>
        <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor}>Paste keeps formatting · images are dropped</Text>
        <Flex gap={2}>
          <Button size="xs" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button size="xs" colorPalette="blue" onClick={save}><LuCheck /> Save note</Button>
        </Flex>
      </Flex>
    </Flex>
  );
};

export const NotesDialog: React.FC<NotesDialogProps> = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    surfaceBg: bgColor,
    titleBarBg,
    borderColor,
    textColor,
    secondaryTextColor,
  } = useDialogChrome();
  const rowHoverBg = useColorModeValue(P.light.rowHover, P.dark.rowHover);
  // Input wells: darker than the chrome default so they don't wash out on the dark canvas.
  const fieldBg = useColorModeValue('white', P.dark.toolbar);

  useEffect(() => {
    if (!isOpen) return;
    setEditing(null);
    (async () => {
      try {
        const config = await window.electronAPI.getConfig();
        setNotes(config?.notes ?? []);
      } catch (error) {
        console.error('Error loading notes:', error);
        showToast({ title: 'Error', description: 'Failed to load notes', status: 'error', duration: 3000, isClosable: true });
      }
    })();
  }, [isOpen]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // Each mutation persists immediately — a snippet library, not a form with a Save button.
  const persist = async (next: Note[]) => {
    setNotes(next);
    try {
      const config = await window.electronAPI.getConfig();
      await window.electronAPI.setConfig({ ...config, notes: next });
    } catch (error) {
      console.error('Error saving notes:', error);
      showToast({ title: 'Error', description: 'Failed to save notes', status: 'error', duration: 3000, isClosable: true });
    }
  };

  const handleSaveNote = (title: string, html: string) => {
    if (editing === 'new') {
      persist([...notes, { id: crypto.randomUUID(), title, html }]);
    } else if (editing) {
      persist(notes.map((n) => (n.id === editing.id ? { ...n, title, html } : n)));
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => persist(notes.filter((n) => n.id !== id));

  const copyNote = async (note: Note) => {
    const text = htmlToText(note.html);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([note.html || text], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      // Fallback for environments without rich ClipboardItem support
      await navigator.clipboard.writeText(text);
    }
    setCopiedId(note.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 900);
  };

  return (
    <Dialog.Root open={isOpen} size="lg" placement="center" onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={bgColor}
            maxH="85vh"
            maxW="480px"
            borderRadius={0}
            boxShadow="xl"
            display="flex"
            flexDirection="column"
            overflow="hidden"
          >
            <style>{NOTES_CSS}</style>
            <Dialog.Header
              bg={titleBarBg}
              borderBottom="1px solid"
              borderColor={borderColor}
              borderRadius={0}
              py={1.5}
              minH="31px"
            >
              <Flex align="center" gap={2} pr={10}>
                <Text fontSize="13px" fontWeight="600" letterSpacing="0.01em" color={textColor}>Notes</Text>
                {notes.length > 0 && (
                  <Text fontSize={SETTINGS_FS.hint} fontWeight="600" color={secondaryTextColor}>{notes.length}</Text>
                )}
              </Flex>
            </Dialog.Header>
            <Dialog.CloseTrigger />

            <Dialog.Body p={editing ? 4 : 3} display="flex" flexDirection="column" flex="1" minH={0} overflow="hidden">
              {editing ? (
                <NoteEditor
                  initial={editing === 'new' ? undefined : editing}
                  onSave={handleSaveNote}
                  onCancel={() => setEditing(null)}
                  inputBg={fieldBg}
                  borderColor={borderColor}
                  textColor={textColor}
                  secondaryTextColor={secondaryTextColor}
                />
              ) : (
                <Box flex="1" minH={0} overflowY="auto">
                  {notes.length > 0 && (
                    <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden">
                      {notes.map((note, i) => {
                        const isCopied = copiedId === note.id;
                        const preview = htmlToText(note.html);
                        return (
                          <Flex
                            key={note.id}
                            className="group"
                            position="relative"
                            role="button"
                            aria-label={`Copy note ${note.title}`}
                            onClick={() => copyNote(note)}
                            align="center"
                            gap={2}
                            px={2.5}
                            py={2}
                            borderTop={i === 0 ? undefined : '1px solid'}
                            borderColor={borderColor}
                            cursor="pointer"
                            _hover={{ bg: rowHoverBg }}
                            transition="background 0.15s"
                          >
                            <Box flex="1" minW={0}>
                              <Text fontSize={SETTINGS_FS.rowTitle} fontWeight="600" color={textColor} lineClamp={1}>
                                {note.title}
                              </Text>
                              <Text fontSize={SETTINGS_FS.hint} color={secondaryTextColor} lineClamp={1}>
                                {preview || 'Empty note'}
                              </Text>
                            </Box>

                            {/* hover actions */}
                            <Flex
                              gap={0.5}
                              flexShrink={0}
                              opacity={0}
                              _groupHover={{ opacity: 1 }}
                              transition="opacity 0.15s"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconButton aria-label="Edit note" size="2xs" variant="ghost" colorPalette="blue" onClick={() => setEditing(note)}><LuPencil /></IconButton>
                              <IconButton aria-label="Delete note" size="2xs" variant="ghost" colorPalette="red" onClick={() => handleDelete(note.id)}><LuTrash2 /></IconButton>
                            </Flex>
                            <Box flexShrink={0} color={secondaryTextColor} opacity={0.6} _groupHover={{ display: 'none' }}>
                              <LuCopy size={13} />
                            </Box>

                            {/* hero copy feedback */}
                            {isCopied && (
                              <Flex
                                position="absolute"
                                inset={0}
                                align="center"
                                justify="center"
                                gap={2}
                                bg="green.500"
                                color="white"
                                zIndex={2}
                                overflow="hidden"
                                style={{ animation: 'notesCopyIn 0.18s ease-out' }}
                              >
                                <Box
                                  position="absolute"
                                  top={0}
                                  bottom={0}
                                  w="40%"
                                  bg="whiteAlpha.400"
                                  filter="blur(8px)"
                                  style={{ animation: 'notesShine 0.7s ease-out' }}
                                />
                                <LuCheck size={15} />
                                <Text fontSize={SETTINGS_FS.body} fontWeight="700" zIndex={1}>Copied</Text>
                              </Flex>
                            )}
                          </Flex>
                        );
                      })}
                    </Box>
                  )}

                  {/* add row */}
                  <Flex
                    role="button"
                    aria-label="Add note"
                    onClick={() => setEditing('new')}
                    align="center"
                    justify="center"
                    gap={1.5}
                    mt={notes.length > 0 ? 2 : 0}
                    py={2.5}
                    border="1.5px dashed"
                    borderColor={borderColor}
                    borderRadius="md"
                    color={secondaryTextColor}
                    cursor="pointer"
                    transition="background 0.15s, color 0.15s"
                    _hover={{ bg: rowHoverBg, color: textColor }}
                  >
                    <LuPlus size={15} />
                    <Text fontSize={SETTINGS_FS.body} fontWeight="600">New note</Text>
                  </Flex>

                  {notes.length === 0 && (
                    <Text mt={3} fontSize={SETTINGS_FS.hint} color={secondaryTextColor} textAlign="center">
                      No notes yet. Create one, paste in formatted text, then click a row to copy it anywhere.
                    </Text>
                  )}
                </Box>
              )}
            </Dialog.Body>

            {!editing && (
              <Dialog.Footer borderTopWidth="1px" borderColor={borderColor} py={2}>
                <Flex justify="flex-end" w="100%">
                  <Button size="xs" variant="outline" onClick={onClose}>Close</Button>
                </Flex>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
