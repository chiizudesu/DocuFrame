import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useColorModeValue } from "./ui/color-mode";
import { keyframes } from '@emotion/react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  VStack,
  Button,
  Icon,
  Text,
  Progress,
  useDisclosure,
  Switch,
  IconButton,
  Badge,
  Slider,
  Field,
  Dialog,
  Portal,
} from '@chakra-ui/react';
import { Tooltip } from '@/components/ui/tooltip';
import { Play, Pause, Square, X, Settings, Minus, Plus, ChevronLeft, ChevronRight, Folder, LayoutTemplate, Smartphone, Monitor } from 'lucide-react';
import { taskTimerService, Task } from '../services/taskTimer';
import { settingsService } from '../services/settings';
import { docuFramePalette as P } from '../docuFrameColors';

interface FloatingTaskTimerWindowProps {
  onClose: () => void;
}

type TimerPhase = 'idle' | 'session';

const POMODORO_STORAGE_KEY = 'docuframe_pomodoro_state';

interface PomodoroState {
  phase: TimerPhase;
  currentTime: number;
  isPaused: boolean;
  pauseStartTime: number | null;
  currentTask: Task | null;
  sessionTargetSeconds: number;
  sessionsCompletedToday: number;
}

const DEFAULT_SESSION_MIN = 25;
const DEFAULT_TARGET_HOURS = 8;

/** Default floating timer size on open (landscape bar). */
const FLOATING_TIMER_OPEN_W = 1068;
const FLOATING_TIMER_OPEN_H = 300;
/** Default size when forcing portrait layout from the title bar. */
const FLOATING_TIMER_PORTRAIT_W = 331;
const FLOATING_TIMER_PORTRAIT_H = 625;

const FLOATING_TIMER_LAYOUT_PREF_KEY = 'docuframe_floating_timer_layout_pref';

type FloatingTimerLayoutPreference = 'auto' | 'portrait' | 'landscape';
/** Avoid layout flip-flop when width ≈ height (e.g. FancyZones animation). */
const LAYOUT_HYSTERESIS_PX = 20;
/** Title bar approximate height for body `calc(100% - …)`. */
const TITLE_BAR_PX = 32;
/** Optical nudge — timer digits sit slightly below strict vertical center. */
const TIMER_DISPLAY_NUDGE_Y_PX = 15;

// TODO: set to true for testing — short session
const TEST_MODE = false;
const TEST_SESSION_SEC = 10;

// Default: three ascending bell tones — C5, E5, G5; volume 50-200%
const playDefaultBell = (volumePercent: number = 100) => {
  try {
    const mult = volumePercent / 100;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    ([[523, 0], [659, 0.28], [784, 0.56]] as [number, number][]).forEach(([freq, delay]) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = audioContext.currentTime + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35 * mult, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  } catch {}
};

const MAX_SOUND_SECONDS = 5;

let currentPlayingAudio: HTMLAudioElement | null = null;

const stopCurrentSound = () => {
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
    currentPlayingAudio = null;
  }
};

// Play custom file (max 5s) or default bell; volumePercent 50-200
const playPomodoroSound = async (customSoundPath?: string, volumePercent: number = 100) => {
  stopCurrentSound();
  const vol = volumePercent / 100;
  if (!customSoundPath) {
    playDefaultBell(volumePercent);
    return;
  }
  try {
    const result = await (window.electronAPI as any).getFileUrlForAudio?.(customSoundPath);
    if (!result?.success || !result.url) {
      playDefaultBell(volumePercent);
      return;
    }
    const audio = new Audio(result.url);
    currentPlayingAudio = audio;
    // Use Web Audio API for volume > 100%
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.min(2, Math.max(0, vol * 0.7));
    src.connect(gainNode);
    gainNode.connect(ctx.destination);
    audio.play().catch(() => {
      currentPlayingAudio = null;
      playDefaultBell(volumePercent);
    });
    const stopAt = setTimeout(() => {
      if (currentPlayingAudio === audio) currentPlayingAudio = null;
      audio.pause();
      audio.currentTime = 0;
    }, MAX_SOUND_SECONDS * 1000);
    audio.addEventListener('ended', () => {
      clearTimeout(stopAt);
      if (currentPlayingAudio === audio) currentPlayingAudio = null;
    });
  } catch {
    playDefaultBell(volumePercent);
  }
};

// Always clamp to >= 0 before formatting
const formatTime = (seconds: number) => {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const GMT_8_OFFSET_MS = 8 * 60 * 60 * 1000;
const sessionBlinkKeyframes = keyframes`0%, 100% { opacity: 1 } 50% { opacity: 0.45 }`;

// ---------------------------------------------------------------------------
// Work Shift Infographic (right panel)
// ---------------------------------------------------------------------------
const WorkShiftInfographic: React.FC<{
  tasks: Array<{ name: string; duration: number; completed?: boolean }>;
  sessionMinutes: number;
  pomodoroTargetHours: number;
  currentSessionIndex?: number; // 0-based; when in session phase, this box blinks blue
  isSessionActive?: boolean;
  /** `side`: right column in landscape. `stacked`: full-width top band in portrait. */
  variant?: 'side' | 'stacked';
  /** Matches floating timer title bar / control chrome. */
  panelBg: string;
  panelBorder: string;
}> = ({ tasks, sessionMinutes, pomodoroTargetHours, currentSessionIndex = -1, isSessionActive = false, variant = 'side', panelBg, panelBorder }) => {
  const labelMuted = useColorModeValue('#475569', P.dark.subtext);
  const behindBoxBg = useColorModeValue('#b8c4d4', P.dark.tabInactive);
  const onMutedBadgeText = useColorModeValue('#0f172a', 'whiteAlpha.900');
  const barLabelText = useColorModeValue('#0f172a', 'white');
  const barLabelShadow = useColorModeValue('none', '0 1px 3px rgba(0,0,0,0.6)');

  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [currentTimeGMT8, setCurrentTimeGMT8] = useState('');
  const [shiftProgress, setShiftProgress] = useState(0);
  const [currentTimeInShift, setCurrentTimeInShift] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [timeDifference, setTimeDifference] = useState(0);
  const [loggedTimeProgress, setLoggedTimeProgress] = useState(0);
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState(0);

  // Filter out tasks with non-positive durations to prevent negative totals
  const validTasks = tasks.filter((t) => (t.duration || 0) > 0);
  const todayTimeWorked = validTasks.reduce((s, t) => s + t.duration, 0);
  const completedSessions = validTasks.filter((t) => t.name === 'Session' && t.completed === true).length;

  // Total session slots from daily target (hours) and session length
  const totalSlots = Math.max(1, Math.floor((pomodoroTargetHours * 60) / sessionMinutes));

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsService.getSettings() as any;
        if (settings.workShiftStart) setWorkShiftStart(settings.workShiftStart);
        if (settings.workShiftEnd) setWorkShiftEnd(settings.workShiftEnd);
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const gmt8Str24 = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' });
      const displayAmPm = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
      setCurrentTimeGMT8(displayAmPm);
      const gmt8h = parseInt(gmt8Str24.split(':')[0], 10);
      const gmt8m = parseInt(gmt8Str24.split(':')[1], 10);
      const currentMinutes = gmt8h * 60 + gmt8m;

      const [sh, sm] = workShiftStart.split(':').map(Number);
      const [eh, em] = workShiftEnd.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const shiftDurMin = endMin - startMin;
      const shiftDurSec = shiftDurMin * 60;
      setShiftDurationSeconds(shiftDurSec);

      let elapsed = currentMinutes - startMin;
      let timePos = 0;
      if (currentMinutes < startMin) {
        setCurrentTimeInShift(0);
        setShiftProgress(0);
        timePos = 0;
      } else if (currentMinutes > endMin) {
        setCurrentTimeInShift(shiftDurMin * 60);
        setShiftProgress(100);
        timePos = 100;
      } else {
        setCurrentTimeInShift(elapsed * 60);
        setShiftProgress((elapsed / shiftDurMin) * 100);
        timePos = (elapsed / shiftDurMin) * 100;
      }
      setCurrentTimePosition(timePos);
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [workShiftStart, workShiftEnd]);

  useEffect(() => {
    setTimeDifference(todayTimeWorked - currentTimeInShift);
  }, [todayTimeWorked, currentTimeInShift]);

  useEffect(() => {
    if (shiftDurationSeconds > 0) {
      setLoggedTimeProgress(Math.min(100, (todayTimeWorked / shiftDurationSeconds) * 100));
    }
  }, [todayTimeWorked, shiftDurationSeconds]);

  const formatTimeDiff = (seconds: number) => {
    const abs = Math.abs(seconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    return `${seconds >= 0 ? '+' : '-'}${h}:${m.toString().padStart(2, '0')}`;
  };

  const isStacked = variant === 'stacked';

  return (
    <Flex
      direction="column"
      w={isStacked ? '100%' : '320px'}
      flexShrink={0}
      px={isStacked ? 2 : 3}
      py={isStacked ? 1.5 : 2}
      bg={panelBg}
      borderLeft={isStacked ? undefined : '1px solid'}
      borderBottom={isStacked ? '1px solid' : undefined}
      borderColor={panelBorder}
      gap={isStacked ? 1.5 : 2}
      overflow="hidden"
    >
      {/* Current time + ahead/behind */}
      <Flex align="center" justify="space-between">
        <Badge px={3} py={1} borderRadius="sm" bg="green.500" color="white" fontSize="13px" fontWeight="700" letterSpacing="0.05em" boxShadow="none">
          {currentTimeGMT8}
        </Badge>
        <Box bg={timeDifference >= 0 ? 'blue.500' : behindBoxBg} borderRadius="sm" px={3} py={1}>
          <Text fontSize="12px" color={timeDifference >= 0 ? 'white' : onMutedBadgeText} fontWeight="600" fontFamily="mono">
            {timeDifference >= 0 ? 'Ahead' : 'Behind'} {formatTimeDiff(timeDifference)}
          </Text>
        </Box>
      </Flex>

      {/* Shift time bar */}
      <Box>
        <Flex justify="space-between" mb={1}>
          <Text fontSize="11px" color={labelMuted} fontWeight="500">Shift Time</Text>
          <Text fontSize="11px" color={shiftProgress > 100 ? 'red.400' : 'cyan.400'} fontWeight="600">{formatTime(currentTimeInShift)}</Text>
        </Flex>
        <Box position="relative" h="22px" bg="whiteAlpha.100" borderRadius="sm" overflow="visible">
          <Box position="absolute" left="0" top="0" h="100%" w={`${Math.min(100, Math.max(0, shiftProgress))}%`} bg={shiftProgress > 100 ? 'red.500' : 'cyan.500'} transition="width 0.3s ease" borderRadius="sm" />
          {currentTimePosition > 0 && (
            <Box position="absolute" left={`${Math.min(100, currentTimePosition)}%`} top="-3px" w="2px" h="28px" bg="green.400" borderRadius="full" zIndex={10} boxShadow="0 0 8px rgba(72,187,120,0.9)" transform="translateX(-50%)" />
          )}
          <Flex position="absolute" left="0" top="0" w="100%" h="100%" align="center" justify="center" zIndex={2} pointerEvents="none">
            <Text fontSize="10px" fontWeight="700" color={barLabelText} textShadow={barLabelShadow}>{shiftProgress.toFixed(0)}%</Text>
          </Flex>
        </Box>
      </Box>

      {/* Logged time bar */}
      <Box>
        <Flex justify="space-between" mb={1}>
          <Text fontSize="11px" color={labelMuted} fontWeight="500">Logged Time</Text>
          <Text fontSize="11px" color="blue.400" fontWeight="600">{formatTime(todayTimeWorked)}</Text>
        </Flex>
        <Box position="relative" h="22px" bg="whiteAlpha.100" borderRadius="sm" overflow="hidden">
          <Box position="absolute" left="0" top="0" h="100%" w={`${Math.min(100, loggedTimeProgress)}%`} bg="green.500" borderRadius="sm" transition="width 0.3s ease" />
          {loggedTimeProgress > 0 && (
            <Flex position="absolute" left="0" top="0" w="100%" h="100%" align="center" justify="center" zIndex={2} pointerEvents="none">
              <Text fontSize="10px" fontWeight="700" color={barLabelText} textShadow={barLabelShadow}>{loggedTimeProgress.toFixed(0)}%</Text>
            </Flex>
          )}
        </Box>
      </Box>

      {/* Sessions — box grid, directly below Logged Time */}
      <Box>
        <Flex justify="space-between" align="center" mb={1}>
          <Text fontSize="11px" color={labelMuted} fontWeight="500">Sessions</Text>
          <Text fontSize="11px" color="green.400" fontWeight="600">{completedSessions} / {totalSlots}</Text>
        </Flex>
        <Flex align="center" gap="3px" wrap="wrap">
          {Array.from({ length: totalSlots }, (_, i) => {
            const isCurrent = isSessionActive && i === currentSessionIndex;
            return (
              <Box
                key={i}
                w={totalSlots <= 16 ? "16px" : totalSlots <= 24 ? "14px" : "11px"}
                h="14px"
                borderRadius="3px"
                bg={isCurrent ? 'blue.500' : i < completedSessions ? 'green.500' : 'whiteAlpha.150'}
                border="1px solid"
                borderColor={isCurrent ? 'blue.400' : i < completedSessions ? 'green.400' : 'whiteAlpha.300'}
                flexShrink={0}
                animation={isCurrent ? `${sessionBlinkKeyframes} 1s ease-in-out infinite` : undefined}
              />
            );
          })}
        </Flex>
      </Box>
    </Flex>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const FloatingTaskTimerWindow: React.FC<FloatingTaskTimerWindowProps> = ({ onClose }) => {
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>({
    phase: 'idle',
    currentTime: 0,
    isPaused: false,
    pauseStartTime: null,
    currentTask: null,
    sessionTargetSeconds: TEST_MODE ? TEST_SESSION_SEC : DEFAULT_SESSION_MIN * 60,
    sessionsCompletedToday: 0,
  });
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MIN);
  const [targetHours, setTargetHours] = useState(DEFAULT_TARGET_HOURS);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(100);
  const [customSoundPath, setCustomSoundPath] = useState('');
  const [soundFolder, setSoundFolder] = useState('');
  const [soundFiles, setSoundFiles] = useState<string[]>([]);
  const [soundFileIndex, setSoundFileIndex] = useState(0);
  const { open: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const soundEnabledRef = useRef(true);
  const customSoundPathRef = useRef('');
  const soundVolumeRef = useRef(100);

  const layoutModeRef = useRef<'stacked' | 'row' | null>(null);
  const viewportRafRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : FLOATING_TIMER_OPEN_W,
    h: typeof window !== 'undefined' ? window.innerHeight : FLOATING_TIMER_OPEN_H,
  }));
  const [layoutFromSize, setLayoutFromSize] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );
  const [layoutPreference, setLayoutPreference] = useState<FloatingTimerLayoutPreference>(() => {
    try {
      const raw = localStorage.getItem(FLOATING_TIMER_LAYOUT_PREF_KEY);
      if (raw === 'portrait' || raw === 'landscape' || raw === 'auto') return raw;
    } catch {}
    return 'auto';
  });

  const useStackedLayout =
    layoutPreference === 'portrait' ? true : layoutPreference === 'landscape' ? false : layoutFromSize;

  const syncViewportAndLayout = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setViewport({ w, h });
    const prev = layoutModeRef.current;
    let next: 'stacked' | 'row';
    if (prev === null) {
      next = h > w ? 'stacked' : 'row';
    } else if (prev === 'stacked') {
      next = w > h + LAYOUT_HYSTERESIS_PX ? 'row' : 'stacked';
    } else {
      next = h > w + LAYOUT_HYSTERESIS_PX ? 'stacked' : 'row';
    }
    layoutModeRef.current = next;
    setLayoutFromSize(next === 'stacked');
  }, []);

  const scheduleSyncViewportAndLayout = useCallback(() => {
    if (viewportRafRef.current != null) return;
    viewportRafRef.current = requestAnimationFrame(() => {
      viewportRafRef.current = null;
      syncViewportAndLayout();
    });
  }, [syncViewportAndLayout]);

  useEffect(() => {
    syncViewportAndLayout();
    const ro = new ResizeObserver(() => scheduleSyncViewportAndLayout());
    ro.observe(document.documentElement);
    window.addEventListener('resize', scheduleSyncViewportAndLayout);
    return () => {
      if (viewportRafRef.current != null) {
        cancelAnimationFrame(viewportRafRef.current);
        viewportRafRef.current = null;
      }
      ro.disconnect();
      window.removeEventListener('resize', scheduleSyncViewportAndLayout);
    };
  }, [syncViewportAndLayout, scheduleSyncViewportAndLayout]);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await settingsService.getSettings() as any;
        const sessionMin = s.pomodoroSessionMinutes ?? DEFAULT_SESSION_MIN;
        const tgtHrs = s.pomodoroTargetHours ?? DEFAULT_TARGET_HOURS;
        const sound = s.pomodoroSoundEnabled !== false;
        const vol = s.pomodoroSoundVolume ?? 100;
        const customPath = s.pomodoroCustomSoundPath || '';
        const folder = s.pomodoroSoundFolder || '';
        setSessionMinutes(sessionMin);
        setTargetHours(tgtHrs);
        setSoundEnabled(sound);
        setSoundVolume(vol);
        soundVolumeRef.current = vol;
        setCustomSoundPath(folder ? customPath : '');
        setSoundFolder(folder);
        soundEnabledRef.current = sound;
        customSoundPathRef.current = folder ? customPath : '';
        setPomodoroState(prev => ({ ...prev, sessionTargetSeconds: TEST_MODE ? TEST_SESSION_SEC : sessionMin * 60 }));
        // Scan folder and restore index (soundOptions = [default, ...files])
        if (folder) {
          try {
            const result = await (window.electronAPI as any).listSoundFiles(folder);
            if (result.success && result.files) {
              setSoundFiles(result.files);
              const idx = customPath ? result.files.findIndex((f: string) => f === customPath) + 1 : 0;
              setSoundFileIndex(idx >= 1 ? idx : 0);
            }
          } catch {}
        }
      } catch {}
    };
    load();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(POMODORO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.phase && parsed.phase !== 'idle') {
          const task = parsed.currentTask;
          if (task && taskTimerService.isTaskFromDifferentDay(task)) {
            localStorage.removeItem(POMODORO_STORAGE_KEY);
            return;
          }
          setPomodoroState(prev => {
            const merged = { ...prev, ...parsed } as PomodoroState;
            if (TEST_MODE) merged.sessionTargetSeconds = TEST_SESSION_SEC;
            if ((merged as { phase?: string }).phase === 'break') {
              merged.phase = 'session';
              merged.currentTime = merged.sessionTargetSeconds;
              merged.currentTask = taskTimerService.startTask('Session');
            }
            delete (merged as { breakTargetSeconds?: number }).breakTargetSeconds;
            return merged;
          });
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (pomodoroState.phase !== 'idle') {
      try { localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(pomodoroState)); } catch {}
    }
  }, [pomodoroState]);

  // Countdown tick
  useEffect(() => {
    if (pomodoroState.phase === 'idle' || pomodoroState.isPaused) return;
    const interval = setInterval(() => {
      setPomodoroState(prev => {
        if (prev.currentTime <= 0) return prev;
        return { ...prev, currentTime: prev.currentTime - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoroState.phase, pomodoroState.isPaused]);

  // When a check-in session ends: log it, chime, start the next session immediately (no breaks).
  useEffect(() => {
    if (pomodoroState.phase !== 'session' || pomodoroState.isPaused || pomodoroState.currentTime > 0) return;
    const doTransition = async () => {
      const today = taskTimerService.getTodayDateString();
      const task = pomodoroState.currentTask;
      if (task) {
        const finalTask: Task & { completed?: boolean } = {
          ...task,
          endTime: new Date().toISOString(),
          duration: pomodoroState.sessionTargetSeconds,
          isPaused: false,
          completed: true,
        };
        await (window.electronAPI as any).saveTaskLog(today, finalTask);
        window.dispatchEvent(new Event('task-updated'));
      }
      if (soundEnabledRef.current) playPomodoroSound(customSoundPathRef.current || undefined, soundVolumeRef.current);
      setPomodoroState(prev => ({
        ...prev,
        phase: 'session',
        currentTime: prev.sessionTargetSeconds,
        currentTask: taskTimerService.startTask('Session'),
        sessionsCompletedToday: prev.sessionsCompletedToday + 1,
      }));
    };
    doTransition();
  }, [pomodoroState.phase, pomodoroState.isPaused, pomodoroState.currentTime]);

  useEffect(() => {
    const handleDockToPanel = () => onClose();
    if ((window.electronAPI as any).onMessage) {
      (window.electronAPI as any).onMessage('dock-to-panel', handleDockToPanel);
    }
    return () => {
      if ((window.electronAPI as any).removeListener) {
        (window.electronAPI as any).removeListener('dock-to-panel', handleDockToPanel);
      }
    };
  }, [onClose]);

  useEffect(() => {
    const api = (window.electronAPI as any)?.resizeFloatingTimer;
    if (!api) return;
    if (layoutPreference === 'portrait') api(FLOATING_TIMER_PORTRAIT_W, FLOATING_TIMER_PORTRAIT_H);
    else if (layoutPreference === 'landscape') api(FLOATING_TIMER_OPEN_W, FLOATING_TIMER_OPEN_H);
    else api(FLOATING_TIMER_OPEN_W, FLOATING_TIMER_OPEN_H);
  }, []);

  const cycleLayoutPreference = useCallback(() => {
    // Always flip to the opposite of the currently displayed layout so one click always changes what you see.
    // If currently stacked (portrait display) → go to landscape; if row → go to portrait.
    const next: FloatingTimerLayoutPreference = useStackedLayout ? 'landscape' : 'portrait';
    setLayoutPreference(next);
    try {
      localStorage.setItem(FLOATING_TIMER_LAYOUT_PREF_KEY, next);
    } catch {}
    queueMicrotask(() => {
      const api = (window.electronAPI as any)?.resizeFloatingTimer;
      if (!api) return;
      if (next === 'portrait') api(FLOATING_TIMER_PORTRAIT_W, FLOATING_TIMER_PORTRAIT_H);
      else if (next === 'landscape') api(FLOATING_TIMER_OPEN_W, FLOATING_TIMER_OPEN_H);
    });
  }, [useStackedLayout]);

  const layoutButtonTooltip = useStackedLayout
    ? 'Portrait layout — click to switch to landscape'
    : 'Landscape layout — click to switch to portrait';

  useEffect(() => {
    if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) (window.electronAPI as any).sendToMainWindow('floating-timer-opened');
    return () => {
      if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) (window.electronAPI as any).sendToMainWindow('floating-timer-closed');
    };
  }, []);

  const handleClose = () => {
    if (window.electronAPI && (window.electronAPI as any).sendToMainWindow) (window.electronAPI as any).sendToMainWindow('floating-timer-closed');
    setTimeout(onClose, 100);
  };

  const handleStartTimer = () => {
    if (pomodoroState.phase === 'idle') {
      setPomodoroState(prev => ({ ...prev, phase: 'session', currentTime: prev.sessionTargetSeconds, currentTask: taskTimerService.startTask('Session'), isPaused: false, pauseStartTime: null }));
    } else {
      setPomodoroState(prev => ({ ...prev, isPaused: false, pauseStartTime: null }));
    }
  };

  const handlePauseTimer = () => setPomodoroState(prev => ({ ...prev, isPaused: true, pauseStartTime: Date.now() }));

  const handleStopTimer = async () => {
    const task = pomodoroState.currentTask;
    if (task && pomodoroState.phase !== 'idle') {
      const targetSec = pomodoroState.sessionTargetSeconds;
      const elapsed = Math.max(0, targetSec - pomodoroState.currentTime);
      const finalTask: Task & { completed?: boolean } = { ...task, endTime: new Date().toISOString(), duration: elapsed, isPaused: false };
      const today = taskTimerService.getTodayDateString();
      await (window.electronAPI as any).saveTaskLog(today, finalTask);
      window.dispatchEvent(new Event('task-updated'));
    }
    setPomodoroState(prev => ({ ...prev, phase: 'idle', currentTime: 0, currentTask: null, isPaused: false, pauseStartTime: null }));
    localStorage.removeItem(POMODORO_STORAGE_KEY);
  };

  const saveSettings = async (sessionMin: number, sound: boolean, tgtHrs: number, customPath?: string, folder?: string, volume?: number) => {
    const cp = customPath !== undefined ? customPath : customSoundPath;
    const sf = folder !== undefined ? folder : soundFolder;
    const vol = volume !== undefined ? volume : soundVolume;
    setSessionMinutes(sessionMin);
    setSoundEnabled(sound);
    setTargetHours(tgtHrs);
    setSoundVolume(vol);
    setCustomSoundPath(cp);
    setSoundFolder(sf);
    soundEnabledRef.current = sound;
    customSoundPathRef.current = cp;
    soundVolumeRef.current = vol;
    setPomodoroState(prev => ({ ...prev, sessionTargetSeconds: TEST_MODE ? TEST_SESSION_SEC : sessionMin * 60 }));
    const s = await settingsService.getSettings() as any;
    await settingsService.setSettings({ ...s, pomodoroSessionMinutes: sessionMin, pomodoroSoundEnabled: sound, pomodoroTargetHours: tgtHrs, pomodoroCustomSoundPath: cp, pomodoroSoundFolder: sf, pomodoroSoundVolume: vol });
  };

  // soundOptions = [default, ...custom files]; index 0 = default ('')
  const soundOptions = ['', ...soundFiles];

  const handleSelectSoundFolder = async () => {
    stopCurrentSound();
    const folder = await (window.electronAPI as any).selectDirectory();
    if (!folder) return;
    const result = await (window.electronAPI as any).listSoundFiles(folder);
    const files: string[] = result.success ? result.files : [];
    setSoundFiles(files);
    setSoundFolder(folder);
    setSoundFileIndex(0);
    setCustomSoundPath('');
    customSoundPathRef.current = '';
    const s = await settingsService.getSettings() as any;
    await settingsService.setSettings({ ...s, pomodoroSoundFolder: folder, pomodoroCustomSoundPath: '' });
  };

  const handleCycleSoundPrev = () => {
    if (soundOptions.length <= 1) return;
    stopCurrentSound();
    const idx = (soundFileIndex - 1 + soundOptions.length) % soundOptions.length;
    const path = soundOptions[idx];
    setSoundFileIndex(idx);
    setCustomSoundPath(path);
    customSoundPathRef.current = path;
    saveSettings(sessionMinutes, soundEnabled, targetHours, path, soundFolder);
  };

  const handleCycleSoundNext = () => {
    if (soundOptions.length <= 1) return;
    stopCurrentSound();
    const idx = (soundFileIndex + 1) % soundOptions.length;
    const path = soundOptions[idx];
    setSoundFileIndex(idx);
    setCustomSoundPath(path);
    customSoundPathRef.current = path;
    saveSettings(sessionMinutes, soundEnabled, targetHours, path, soundFolder);
  };

  const handleSettingsSaveAndClose = async () => {
    await saveSettings(sessionMinutes, soundEnabled, targetHours, customSoundPath, soundFolder, soundVolume);
    onSettingsClose();
  };

  const targetSeconds = pomodoroState.sessionTargetSeconds;
  const rawProgressPercent =
    targetSeconds > 0 ? ((targetSeconds - pomodoroState.currentTime) / targetSeconds) * 100 : 0;
  const progressPercent =
    pomodoroState.phase === 'idle' ? 0 : Math.min(100, Math.max(0, rawProgressPercent));
  const canvasBg = useColorModeValue('#dfe6ee', P.dark.canvas);
  /** Title bar, button strips, infographic panel — darker than main canvas. */
  const titleBarBg = useColorModeValue('#a6b4c4', '#1e2533');
  /** Darker than before — reads clearly on `titleBarBg` and main shell. */
  const shellBorder = useColorModeValue('#5d6f82', '#2f3844');
  const labelSubtext = useColorModeValue('#475569', P.dark.subtext);
  const soundRowBg = useColorModeValue('#b8c6d4', P.dark.rowHover);
  const onCanvasText = useColorModeValue('#0f172a', 'white');
  /** Settings modal only — slightly darker than surrounding chrome in light mode */
  const settingsSurface = useColorModeValue('#c5ced9', P.dark.tabStrip);
  const settingsTitleColor = useColorModeValue('#0f172a', 'white');
  const settingsValueColor = useColorModeValue('#0f172a', 'white');
  const sessionsHintColor = useColorModeValue('green.800', 'green.400');
  const stepperBorder = useColorModeValue('gray.600', 'whiteAlpha.300');
  const stepperFg = useColorModeValue('gray.900', 'white');
  const stepperHoverBg = useColorModeValue('blackAlpha.150', 'whiteAlpha.150');
  const soundGhostIconColor = useColorModeValue('gray.800', 'white');
  const folderPathColor = useColorModeValue('blue.800', 'blue.300');

  const progressTrackBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.200');

  const compactStepperBtn = {
    variant: 'outline' as const,
    size: 'xs' as const,
    minW: '22px',
    h: '22px',
    p: 0,
    borderWidth: '1px',
    borderColor: stepperBorder,
    color: stepperFg,
    _hover: { bg: stepperHoverBg },
  };

  // Load tasks for infographic
  const [infographicTasks, setInfographicTasks] = useState<Array<{ name: string; duration: number; completed?: boolean }>>([]);
  useEffect(() => {
    const load = async () => {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any).getTaskLogs(today);
      if (result.success && result.tasks) {
        setInfographicTasks(result.tasks.map((t: any) => ({ name: t.name || '', duration: Math.max(0, t.duration || 0), completed: t.completed })));
      }
    };
    load();
    const handler = () => load();
    window.addEventListener('task-updated', handler);
    return () => window.removeEventListener('task-updated', handler);
  }, [pomodoroState.sessionsCompletedToday]);

  const completedSessionsCount = infographicTasks.filter((t) => t.name === 'Session' && t.completed === true).length;
  const sessionNumber = pomodoroState.phase === 'session' && pomodoroState.currentTask ? completedSessionsCount + 1 : completedSessionsCount;

  const phaseColor = pomodoroState.phase === 'session' ? 'green' : 'gray';
  const phaseBg = pomodoroState.phase === 'session' ? 'green.500' : 'gray.600';

  const timerFontPx = useStackedLayout
    ? Math.max(84, Math.min(
        Math.round(viewport.w * 0.44),
        Math.round(viewport.h * 0.18)
      ))
    : Math.max(
        144,
        Math.min(
          516,
          Math.min(Math.max(0, viewport.w - 400), Math.max(0, viewport.h - TITLE_BAR_PX - 72)) * 0.88
        )
      );
  const timerDisplayPx = Math.round(timerFontPx * 0.9);

  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  const timerProgressBar = (
    <Box w="100%">
      <Progress.Root
        value={progressPercent}
        size="sm"
        colorPalette={pomodoroState.phase === 'idle' ? 'gray' : pomodoroState.isPaused ? 'yellow' : phaseColor}
        borderRadius="full"
        bg={progressTrackBg}
        striped={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused}
        animated={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused}
      >
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
    </Box>
  );

  const portraitTimerDigits = (
    <Flex align="center" justify="center" direction="column" gap={0} fontFamily="'Rajdhani', sans-serif" fontWeight="700" color={onCanvasText}>
      <Text fontVariantNumeric="tabular-nums" fontSize={`${timerDisplayPx}px`} lineHeight="1">
        {String(Math.floor(pomodoroState.currentTime / 60)).padStart(2, '0')}
      </Text>
      <Text fontVariantNumeric="tabular-nums" fontSize={`${timerDisplayPx}px`} lineHeight="1" opacity={0.75}>
        {String(Math.floor(pomodoroState.currentTime) % 60).padStart(2, '0')}
      </Text>
    </Flex>
  );

  const landscapeTimerDigits = (
    <Flex align="center" justify="center" gap={0} fontFamily="'Rajdhani', sans-serif" fontSize={`${timerDisplayPx}px`} fontWeight="700" color={onCanvasText} lineHeight="1">
      <Text as="span" w="1.2em" textAlign="right" fontVariantNumeric="tabular-nums" display="block">
        {String(Math.floor(pomodoroState.currentTime / 60)).padStart(2, '0')}
      </Text>
      <Text as="span" w="0.4em" textAlign="center" display="block" opacity={Math.floor(pomodoroState.currentTime) % 2 === 0 ? 1 : 0} transition="opacity 0.1s">
        :
      </Text>
      <Text as="span" w="1.2em" textAlign="left" fontVariantNumeric="tabular-nums" display="block">
        {String(Math.floor(pomodoroState.currentTime) % 60).padStart(2, '0')}
      </Text>
    </Flex>
  );

  return (
    <>
      <Box
        w="100%"
        h="100%"
        minH="100vh"
        bg={canvasBg}
        boxShadow="0 4px 16px rgba(0,0,0,0.4)"
        border="1px solid"
        borderColor={shellBorder}
        overflow="hidden"
        position="relative"
        display="flex"
        flexDirection="column"
      >
          {/* Title bar */}
          <Flex px={2} py={1} align="center" justify="space-between" cursor="grab" bg={titleBarBg} borderBottom="1px solid" borderColor={shellBorder} flexShrink={0} style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <Flex align="center" gap={2}>
              <Box px={3} py={1} borderRadius="md" bg={phaseBg} color="white" fontSize="12px" fontWeight="600">
                {pomodoroState.phase === 'idle' ? 'Ready' : 'Check-in'}
              </Box>
              {pomodoroState.phase === 'session' && (
                <Box px={3} py={1} borderRadius="md" bg="green.500" color="white" fontSize="12px" fontWeight="600">
                  #{sessionNumber}
                </Box>
              )}
            </Flex>
            <Flex gap={1} align="center">
              <Tooltip content={layoutButtonTooltip}>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={cycleLayoutPreference}
                  p={0.5}
                  minW="auto"
                  h="auto"
                  _hover={{ bg: 'whiteAlpha.200' }}
                  color={labelSubtext}
                  aria-label={layoutButtonTooltip}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  <Icon boxSize={3.5} asChild>
                    {layoutPreference === 'auto' ? <LayoutTemplate /> : layoutPreference === 'portrait' ? <Smartphone /> : <Monitor />}
                  </Icon>
                </Button>
              </Tooltip>
              <Tooltip content="Settings">
                <Button size="xs" variant="ghost" onClick={onSettingsOpen} p={0.5} minW="auto" h="auto" _hover={{ bg: 'whiteAlpha.200' }} color={labelSubtext} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                  <Icon boxSize={3.5} asChild><Settings /></Icon>
                </Button>
              </Tooltip>
              <Tooltip content="Close">
                <Button size="xs" variant="ghost" onClick={handleClose} p={0.5} minW="auto" h="auto" _hover={{ bg: 'whiteAlpha.200' }} color={labelSubtext} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                  <Icon boxSize={3.5} asChild><X /></Icon>
                </Button>
              </Tooltip>
            </Flex>
          </Flex>

          {/* Body: landscape = sidebar + timer + infographic; portrait (stacked) = infographic + timer + controls */}
          {useStackedLayout ? (
            <Flex direction="column" flex={1} minH={0} style={noDragStyle}>
              <WorkShiftInfographic
                variant="stacked"
                panelBg={titleBarBg}
                panelBorder={shellBorder}
                tasks={infographicTasks}
                sessionMinutes={sessionMinutes}
                pomodoroTargetHours={targetHours}
                currentSessionIndex={pomodoroState.phase === 'session' ? infographicTasks.filter((t) => t.name === 'Session' && t.completed === true).length : -1}
                isSessionActive={pomodoroState.phase === 'session' && !pomodoroState.isPaused}
              />
              <Flex direction="column" flex={1} minH={0} px={4} py={2} bg={canvasBg}>
                <Flex flex={1} direction="column" minH={0} minW={0}>
                  <Box flex={1} minH={0} minW={0} />
                  <Flex align="center" justify="center" flexShrink={0} w="100%">
                    <Box style={{ transform: `translateY(${TIMER_DISPLAY_NUDGE_Y_PX}px)` }}>
                      {portraitTimerDigits}
                    </Box>
                  </Flex>
                  <Box flex={1} minH={0} minW={0} />
                </Flex>
              </Flex>
              <Box flexShrink={0} px={4} pt={4} pb={3} bg={canvasBg} borderTop="1px solid" borderColor={shellBorder}>
                {timerProgressBar}
              </Box>
              <HStack
                flexShrink={0}
                justify="center"
                align="center"
                gap={3}
                py={3}
                px={3}
                bg={titleBarBg}
                borderTop="1px solid"
                borderColor={shellBorder}
                wrap="wrap"
              >
                <Tooltip content="Start" positioning={{ placement: 'top' }}>
                  <Button size="md" onClick={handleStartTimer} disabled={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused} bg={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused ? 'gray.600' : 'green.500'} color="white" _hover={{ bg: pomodoroState.phase !== 'idle' && !pomodoroState.isPaused ? 'gray.600' : 'green.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Play /></Icon>
                  </Button>
                </Tooltip>
                <Tooltip content="Pause" positioning={{ placement: 'top' }}>
                  <Button size="md" onClick={handlePauseTimer} disabled={pomodoroState.phase === 'idle' || pomodoroState.isPaused} bg={pomodoroState.phase === 'idle' || pomodoroState.isPaused ? 'gray.600' : 'yellow.500'} color="white" _hover={{ bg: pomodoroState.phase === 'idle' || pomodoroState.isPaused ? 'gray.600' : 'yellow.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Pause /></Icon>
                  </Button>
                </Tooltip>
                <Tooltip content="Stop" positioning={{ placement: 'top' }}>
                  <Button size="md" onClick={handleStopTimer} disabled={pomodoroState.phase === 'idle'} bg={pomodoroState.phase === 'idle' ? 'gray.600' : 'red.500'} color="white" _hover={{ bg: pomodoroState.phase === 'idle' ? 'gray.600' : 'red.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Square /></Icon>
                  </Button>
                </Tooltip>
              </HStack>
            </Flex>
          ) : (
            <Flex direction="row" flex={1} minH={0} style={noDragStyle}>
              <Flex direction="column" align="center" justify="flex-start" gap={3} px={3} py={4} bg={titleBarBg} borderRight="1px solid" borderColor={shellBorder} minW="60px" flexShrink={0}>
                <Tooltip content="Start" positioning={{ placement: 'right' }}>
                  <Button size="md" onClick={handleStartTimer} disabled={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused} bg={pomodoroState.phase !== 'idle' && !pomodoroState.isPaused ? 'gray.600' : 'green.500'} color="white" _hover={{ bg: pomodoroState.phase !== 'idle' && !pomodoroState.isPaused ? 'gray.600' : 'green.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Play /></Icon>
                  </Button>
                </Tooltip>
                <Tooltip content="Pause" positioning={{ placement: 'right' }}>
                  <Button size="md" onClick={handlePauseTimer} disabled={pomodoroState.phase === 'idle' || pomodoroState.isPaused} bg={pomodoroState.phase === 'idle' || pomodoroState.isPaused ? 'gray.600' : 'yellow.500'} color="white" _hover={{ bg: pomodoroState.phase === 'idle' || pomodoroState.isPaused ? 'gray.600' : 'yellow.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Pause /></Icon>
                  </Button>
                </Tooltip>
                <Tooltip content="Stop" positioning={{ placement: 'right' }}>
                  <Button size="md" onClick={handleStopTimer} disabled={pomodoroState.phase === 'idle'} bg={pomodoroState.phase === 'idle' ? 'gray.600' : 'red.500'} color="white" _hover={{ bg: pomodoroState.phase === 'idle' ? 'gray.600' : 'red.400' }} _disabled={{ opacity: 0.4 }} w="44px" h="44px" p={0} borderRadius="md">
                    <Icon boxSize={5} color="white" asChild><Square /></Icon>
                  </Button>
                </Tooltip>
              </Flex>
              <Flex direction="row" flex={1} minW={0} bg={canvasBg}>
                <Flex direction="column" flex={1} minW={0} minH={0} px={6} pt={3} pb={2}>
                  <Flex flex={1} direction="column" minH={0} minW={0}>
                    <Box flex={1} minH={0} minW={0} />
                    <Flex align="center" justify="center" flexShrink={0} w="100%">
                      <Box style={{ transform: `translateY(${TIMER_DISPLAY_NUDGE_Y_PX}px)` }}>
                        {landscapeTimerDigits}
                      </Box>
                    </Flex>
                    <Box flex={1} minH={0} minW={0} />
                  </Flex>
                  <Box flexShrink={0} w="100%" pt={5} pb={2}>
                    {timerProgressBar}
                  </Box>
                </Flex>
                <WorkShiftInfographic
                  variant="side"
                  panelBg={titleBarBg}
                  panelBorder={shellBorder}
                  tasks={infographicTasks}
                  sessionMinutes={sessionMinutes}
                  pomodoroTargetHours={targetHours}
                  currentSessionIndex={pomodoroState.phase === 'session' ? infographicTasks.filter((t) => t.name === 'Session' && t.completed === true).length : -1}
                  isSessionActive={pomodoroState.phase === 'session' && !pomodoroState.isPaused}
                />
              </Flex>
            </Flex>
          )}
      </Box>
      <Dialog.Root open={isSettingsOpen} placement="center" onOpenChange={e => {
        if (!e.open) {
          onSettingsClose();
        }
      }}>
        <Portal>

          <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <Dialog.Positioner>
            <Dialog.Content
              bg={settingsSurface}
              maxW="min(640px, calc(100vw - 32px))"
              borderWidth="1px"
              borderColor={shellBorder}
              rounded="md"
              overflow="hidden"
            >
              <Dialog.Header fontSize="sm" fontWeight="600" pb={1} pt={3} px={5} color={settingsTitleColor}>
                Focus timer settings
              </Dialog.Header>
              <Dialog.CloseTrigger />
              <Dialog.Body pb={4} pt={2} px={5} overflow="visible">
                <Flex gap={5} align="stretch">
                  <Box flex={1} minW={0}>
                    <Grid templateColumns="minmax(0, 1fr) 7.75rem" columnGap={4} rowGap={2.5} w="full" alignItems="center">
                      <GridItem minW={0}>
                        <Text fontSize="xs" fontWeight="500" color={labelSubtext}>
                          Check-in interval (min)
                        </Text>
                      </GridItem>
                      <GridItem justifySelf="end">
                        <HStack gap={1} w="7.75rem" justify="flex-end">
                          <IconButton
                            aria-label="Decrease check-in interval"
                            onClick={() => { const v = Math.max(5, sessionMinutes - 5); saveSettings(v, soundEnabled, targetHours); }}
                            {...compactStepperBtn}
                          >
                            <Icon boxSize={3} asChild><Minus /></Icon>
                          </IconButton>
                          <Text fontSize="sm" fontWeight="semibold" w="3.25rem" textAlign="center" color={settingsValueColor} fontVariantNumeric="tabular-nums">
                            {sessionMinutes}
                          </Text>
                          <IconButton
                            aria-label="Increase check-in interval"
                            onClick={() => { const v = Math.min(60, sessionMinutes + 5); saveSettings(v, soundEnabled, targetHours); }}
                            {...compactStepperBtn}
                          >
                            <Icon boxSize={3} asChild><Plus /></Icon>
                          </IconButton>
                        </HStack>
                      </GridItem>

                      <GridItem minW={0}>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" fontWeight="500" color={labelSubtext}>
                            Daily target
                          </Text>
                          <Text fontSize="10px" fontWeight="600" color={sessionsHintColor}>
                            → {Math.round((targetHours * 60) / sessionMinutes)} sessions
                          </Text>
                        </VStack>
                      </GridItem>
                      <GridItem justifySelf="end">
                        <HStack gap={1} w="7.75rem" justify="flex-end">
                          <IconButton
                            aria-label="Decrease target"
                            onClick={() => { const v = Math.max(1, targetHours - 0.5); saveSettings(sessionMinutes, soundEnabled, v); }}
                            {...compactStepperBtn}
                          >
                            <Icon boxSize={3} asChild><Minus /></Icon>
                          </IconButton>
                          <Text fontSize="sm" fontWeight="semibold" w="3.25rem" textAlign="center" color={settingsValueColor} fontVariantNumeric="tabular-nums">
                            {targetHours % 1 === 0 ? `${targetHours}h` : `${Math.floor(targetHours)}h 30m`}
                          </Text>
                          <IconButton
                            aria-label="Increase target"
                            onClick={() => { const v = Math.min(16, targetHours + 0.5); saveSettings(sessionMinutes, soundEnabled, v); }}
                            {...compactStepperBtn}
                          >
                            <Icon boxSize={3} asChild><Plus /></Icon>
                          </IconButton>
                        </HStack>
                      </GridItem>

                      <GridItem colSpan={2} borderTopWidth="1px" borderColor={shellBorder} pt={3} mt={1}>
                        <Field.Root>
                          <Grid templateColumns="minmax(0, 1fr) 7.75rem" columnGap={4} alignItems="center" w="full">
                            <GridItem minW={0}>
                              <Field.Label fontSize="xs" fontWeight="500" mb={0} color={labelSubtext}>
                                Sound notifications
                              </Field.Label>
                            </GridItem>
                            <GridItem justifySelf="end">
                              <Flex justify="flex-end" w="7.75rem">
                                <Switch.Root
                                  size="sm"
                                  checked={soundEnabled}
                                  onCheckedChange={(d) => {
                                    const v = d.checked === true;
                                    soundEnabledRef.current = v;
                                    saveSettings(sessionMinutes, v, targetHours);
                                  }}
                                  colorPalette="green"
                                >
                                  <Switch.HiddenInput />
                                  <Switch.Control>
                                    <Switch.Thumb />
                                  </Switch.Control>
                                </Switch.Root>
                              </Flex>
                            </GridItem>
                          </Grid>

                          <Flex align="center" gap={1.5} mb={2} mt={3}>
                            <Tooltip content="Select ringtones folder">
                              <IconButton
                                aria-label="Select folder"
                                variant="outline"
                                size="xs"
                                minW="22px"
                                h="22px"
                                p={0}
                                borderColor={stepperBorder}
                                color={stepperFg}
                                _hover={{ bg: stepperHoverBg }}
                                onClick={handleSelectSoundFolder}
                              >
                                <Icon boxSize={3} asChild><Folder /></Icon>
                              </IconButton>
                            </Tooltip>
                            <Text fontSize="xs" color={soundFolder ? folderPathColor : labelSubtext} flex={1} truncate>
                              {soundFolder || 'No folder selected'}
                            </Text>
                            {soundFolder && (
                              <Tooltip content="Clear folder">
                                <IconButton
                                  aria-label="Clear folder"
                                  variant="ghost"
                                  size="xs"
                                  minW="22px"
                                  h="22px"
                                  p={0}
                                  colorPalette="red"
                                  onClick={() => {
                                    stopCurrentSound();
                                    setSoundFolder('');
                                    setSoundFiles([]);
                                    setSoundFileIndex(0);
                                    saveSettings(sessionMinutes, soundEnabled, targetHours, '', '');
                                  }}
                                >
                                  <Icon boxSize={3} asChild><X /></Icon>
                                </IconButton>
                              </Tooltip>
                            )}
                          </Flex>

                          <Flex align="center" gap={1} bg={soundRowBg} borderRadius="sm" px={2} py={1.5} borderWidth="1px" borderColor={shellBorder}>
                            <Tooltip content="Test sound">
                              <IconButton
                                aria-label="Test sound"
                                size="xs"
                                minW="22px"
                                h="22px"
                                p={0}
                                colorPalette="green"
                                variant="solid"
                                onClick={() => playPomodoroSound(customSoundPath || undefined, soundVolumeRef.current)}
                              >
                                <Icon boxSize={3} asChild><Play /></Icon>
                              </IconButton>
                            </Tooltip>
                            <IconButton
                              aria-label="Previous sound"
                              variant="ghost"
                              size="xs"
                              minW="22px"
                              h="22px"
                              p={0}
                              color={soundGhostIconColor}
                              disabled={soundOptions.length < 2}
                              onClick={handleCycleSoundPrev}
                            >
                              <Icon boxSize={3} asChild><ChevronLeft /></Icon>
                            </IconButton>
                            <Text fontSize="xs" color={settingsValueColor} flex={1} textAlign="center" truncate>
                              {soundFileIndex === 0 ? 'Default bell' : customSoundPath.split(/[\\/]/).pop() || '—'}
                            </Text>
                            {soundOptions.length > 1 && (
                              <Text fontSize="10px" color={labelSubtext} whiteSpace="nowrap">
                                {soundFileIndex + 1}/{soundOptions.length}
                              </Text>
                            )}
                            <IconButton
                              aria-label="Next sound"
                              variant="ghost"
                              size="xs"
                              minW="22px"
                              h="22px"
                              p={0}
                              color={soundGhostIconColor}
                              disabled={soundOptions.length < 2}
                              onClick={handleCycleSoundNext}
                            >
                              <Icon boxSize={3} asChild><ChevronRight /></Icon>
                            </IconButton>
                          </Flex>
                        </Field.Root>
                      </GridItem>
                    </Grid>
                  </Box>

                  <Flex
                    direction="column"
                    align="center"
                    w="56px"
                    flexShrink={0}
                    borderLeftWidth="1px"
                    borderColor={shellBorder}
                    pl={4}
                    alignSelf="stretch"
                  >
                    <Field.Root alignItems="center" gap={0.5} w="full" flex={1}>
                      <Field.Label fontSize="10px" fontWeight="600" color={labelSubtext} mb={0} textTransform="uppercase" letterSpacing="0.04em">
                        Vol.
                      </Field.Label>
                      <Text fontSize="xs" fontWeight="semibold" color={settingsValueColor} mb={1}>
                        {soundVolume}%
                      </Text>
                      <Box flex={1} minH="120px" maxH="200px" w="full" display="flex" justifyContent="center" py={1}>
                        <Slider.Root
                          aria-label={['Sound volume']}
                          value={[soundVolume]}
                          min={50}
                          max={200}
                          step={5}
                          orientation="vertical"
                          h="100%"
                          onValueChange={(e) => {
                            const v = e.value[0];
                            setSoundVolume(v);
                            soundVolumeRef.current = v;
                            saveSettings(sessionMinutes, soundEnabled, targetHours, undefined, undefined, v);
                          }}
                        >
                          <Slider.Control h="100%">
                            <Slider.Track>
                              <Slider.Range bg="green.500" />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                    </Field.Root>
                  </Flex>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer px={5} py={3} borderTopWidth="1px" borderColor={shellBorder} display="flex" flexWrap="wrap" alignItems="center" gap={3}>
                <Text fontSize="xs" color={labelSubtext} flex="1" minW="160px">
                  Values save as you change them.
                </Text>
                <Button variant="ghost" size="sm" onClick={onSettingsClose}>
                  Cancel
                </Button>
                <Button colorPalette="green" size="sm" onClick={handleSettingsSaveAndClose}>
                  Save &amp; close
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>

        </Portal>
      </Dialog.Root>
    </>
  );
};
