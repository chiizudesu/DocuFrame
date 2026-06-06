/**
 * DocuFrame shell + file list — v2 Chakra-era parity.
 * Dark: title bar strip + function row + grid = #171923; FolderInfoBar + tab pills = #2d3748; flat list rows.
 */
export const docuFramePalette = {
  light: {
    canvas: '#f8fafc',
    listRow: '#ffffff',
    sidebar: '#ffffff',
    tabStrip: '#e2e8f0',
    toolbar: '#ffffff',
    footer: '#f1f5f9',
    border: '#cbd5e1',
    tableHeader: '#f1f5f9',
    tableBorder: '#d1d5db',
    headerDivider: '#cbd5e1',
    rowHover: '#f1f5f9',
    /** Hover on #f8fafc folder bar strip — slate tint, same hue as strip */
    chromeHover: '#e2e8f0',
    rowSelected: '#cce4f7',
    tabActive: '#ffffff',
    tabInactive: '#f1f5f9',
    subtext: '#64748b',
  },
  dark: {
    /** Main body: sidebar, file grid, function row */
    canvas: '#171923',
    /** Same as canvas — list rows / header have no separate “card” fill */
    listRow: '#171923',
    sidebar: '#171923',
    /** Tab strip — darkest chrome layer, sits behind tabs */
    tabStrip: '#161d2b',
    /** Function icon row — near-canvas, subtly lifted so it reads as chrome not content */
    toolbar: '#1a2130',
    footer: '#171923',
    border: '#4a5568',
    tableHeader: '#171923',
    tableBorder: '#4A5568',
    headerDivider: '#4a5568',
    /** File grid row hover — subtle on #171923 */
    rowHover: '#2a3142',
    /** Hover on #2d3748 chrome (tabs, folder bar strip) */
    chromeHover: '#4a5568',
    /** Hover on #4A5568 address well — lighter same cool-gray family (visible vs. well bg) */
    addressWellHover: '#6b7b90',
    rowSelected: '#1a365d',
    tabActive: '#232d3e',
    tabInactive: '#1a2232',
    subtext: '#CBD5E0',
  },
} as const

/** Home / folder accent — v2 FolderInfoBar folder icon */
export const dfHomeIconColor = { light: '#3b82f6', dark: '#63B3ED' } as const

/** Layer / preview / AI mgr toolbar toggles when on; AI dialog left session rail; minimized session icons */
export const DF_SESSION_RAIL_BG = '#2C5282' as const

/** Slightly lighter than rail for pressed/hover on solid toggles */
export const DF_TOOLBAR_TOGGLE_ACTIVE_HOVER_BG = '#355691' as const

/** Group header pill text on #1A365D — ~10% less saturated than #F7FAFC */
export const DF_GROUP_HEADER_PILL_TEXT = '#F0F4F7' as const

/** Layer view group header label + count + add control */
export const DF_GROUP_HEADER_LAYER_TEXT = '#72CDF4' as const

/** Layer view header vertical gap strips — matches main canvas so separators read as slots */
export const DF_GROUP_HEADER_GAP_BG = '#171923' as const
