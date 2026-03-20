import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';
import { docuFramePalette as P } from './docuFrameColors';

/**
 * DocuFrame theme: extends Chakra v3 defaults with pre-v3 parity where we had `extendTheme`:
 * - Dark mode: df.* uses classic Chakra-style grays (v2 parity, commit 4fe05e63 era).
 * - Tooltip / menu / popover surfaces matching the old light gray panels in light mode.
 */
const docuFrameConfig = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: {
            value: { _light: '{colors.white}', _dark: P.dark.canvas },
          },
          subtle: {
            value: { _light: '{colors.gray.50}', _dark: P.dark.sidebar },
          },
          muted: {
            value: { _light: '{colors.gray.100}', _dark: P.dark.toolbar },
          },
          emphasized: {
            value: { _light: '{colors.gray.200}', _dark: '{colors.gray.600}' },
          },
          panel: {
            value: { _light: '{colors.white}', _dark: P.dark.toolbar },
          },
        },
        /** App shell + file grid — use `bg="df.canvas"` etc. */
        df: {
          canvas: { value: { _light: P.light.canvas, _dark: P.dark.canvas } },
          listRow: { value: { _light: P.light.listRow, _dark: P.dark.listRow } },
          sidebar: { value: { _light: P.light.sidebar, _dark: P.dark.sidebar } },
          tabStrip: { value: { _light: P.light.tabStrip, _dark: P.dark.tabStrip } },
          toolbar: { value: { _light: P.light.toolbar, _dark: P.dark.toolbar } },
          footer: { value: { _light: P.light.footer, _dark: P.dark.footer } },
          border: { value: { _light: P.light.border, _dark: P.dark.border } },
          tableHeader: { value: { _light: P.light.tableHeader, _dark: P.dark.tableHeader } },
          tableBorder: { value: { _light: P.light.tableBorder, _dark: P.dark.tableBorder } },
          headerDivider: { value: { _light: P.light.headerDivider, _dark: P.dark.headerDivider } },
          rowHover: { value: { _light: P.light.rowHover, _dark: P.dark.rowHover } },
          chromeHover: {
            value: { _light: P.light.chromeHover, _dark: P.dark.chromeHover },
          },
          rowSelected: { value: { _light: P.light.rowSelected, _dark: P.dark.rowSelected } },
          tabActive: { value: { _light: P.light.tabActive, _dark: P.dark.tabActive } },
          tabInactive: { value: { _light: P.light.tabInactive, _dark: P.dark.tabInactive } },
          subtext: { value: { _light: P.light.subtext, _dark: P.dark.subtext } },
          /** Modal dialogs / settings — same palette as shell */
          dialogSurface: { value: { _light: '{colors.white}', _dark: P.dark.canvas } },
          dialogTitleBar: { value: { _light: '#f8fafc', _dark: P.dark.toolbar } },
          dialogCard: { value: { _light: '#f8fafc', _dark: P.dark.tabStrip } },
          dialogInput: { value: { _light: '{colors.white}', _dark: '#4A5568' } },
          dialogAccent: { value: { _light: '{colors.blue.600}', _dark: '#69c3f4' } },
        },
      },
    },
    // Deep-merge into default slot recipes; partial objects are valid at runtime but not in TS recipe types.
    slotRecipes: {
      tooltip: {
        base: {
          content: {
            '--tooltip-bg': {
              _light: '{colors.gray.100}',
              _dark: '{colors.gray.800}',
            },
            bg: 'var(--tooltip-bg)',
            color: { _light: '{colors.gray.800}', _dark: '{colors.white}' },
            borderWidth: { _light: '1px', _dark: '0' },
            borderColor: { _light: '{colors.gray.200}', _dark: 'transparent' },
            maxW: 'none',
            overflow: 'visible',
          },
          arrow: {
            '--arrow-background': 'var(--tooltip-bg)',
          },
        },
      },
      menu: {
        base: {
          content: {
            bg: { _light: '{colors.white}', _dark: P.dark.toolbar },
            color: { _light: '{colors.gray.800}', _dark: '{colors.white}' },
            borderWidth: '1px',
            borderColor: { _light: '{colors.gray.200}', _dark: P.dark.border },
          },
        },
      },
      popover: {
        base: {
          content: {
            '--popover-bg': { _light: '{colors.white}', _dark: P.dark.toolbar },
            bg: 'var(--popover-bg)',
            color: { _light: '{colors.gray.800}', _dark: '{colors.white}' },
            borderWidth: '1px',
            borderColor: { _light: '{colors.gray.200}', _dark: P.dark.border },
          },
          arrow: {
            '--arrow-background': 'var(--popover-bg)',
          },
        },
      },
      /**
       * Default solid checkbox uses semantic `border` for the unchecked frame — on df.dark.canvas (#171923)
       * it reads as near-invisible. Slightly lifted border vs shell border, no light fill (still 1px).
       */
      checkbox: {
        variants: {
          variant: {
            solid: {
              control: {
                borderWidth: '1px',
                borderColor: {
                  _light: '{colors.gray.500}',
                  /** Between P.dark.border (#4a5568) and subtext — visible, not “white” */
                  _dark: '#5f6c7e',
                },
                _light: { bg: '{colors.white}' },
                _dark: { bg: 'transparent' },
                '&:is([data-state=checked], [data-state=indeterminate])': {
                  bg: 'colorPalette.solid',
                  color: 'colorPalette.contrast',
                  borderColor: 'colorPalette.solid',
                },
              },
            },
          },
        },
      },
    } as unknown as NonNullable<import('@chakra-ui/react').SystemConfig['theme']>['slotRecipes'],
  },
});

export const system = createSystem(defaultConfig, docuFrameConfig);
