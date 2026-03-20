import { useColorModeValue } from './color-mode'
import { docuFramePalette as P, DF_SESSION_RAIL_BG } from '../../docuFrameColors'

/** Shared surfaces for modal dialogs + settings — matches main shell (v2 grays). */
export function useDialogChrome() {
  const surfaceBg = useColorModeValue('white', P.dark.canvas)
  /** Dark: tab strip (#2d3748) so title bar reads above canvas (#171923); avoids “flat” merge with surface. */
  const titleBarBg = useColorModeValue('#f8fafc', P.dark.tabStrip)
  const cardBg = useColorModeValue('#f8fafc', P.dark.tabStrip)
  const inputBg = useColorModeValue('white', '#4A5568')
  const borderColor = useColorModeValue(P.light.border, P.dark.border)
  const textColor = useColorModeValue('gray.800', 'white')
  const secondaryTextColor = useColorModeValue('gray.600', P.dark.subtext)
  const selectedBg = useColorModeValue(P.light.rowSelected, P.dark.rowSelected)
  const accentText = useColorModeValue('blue.600', '#69c3f4')

  return {
    surfaceBg,
    titleBarBg,
    cardBg,
    inputBg,
    borderColor,
    textColor,
    secondaryTextColor,
    selectedBg,
    accentText,
    sessionRailBg: DF_SESSION_RAIL_BG,
  }
}
