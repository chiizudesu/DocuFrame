import { extendTheme } from '@chakra-ui/react';

// Tooltip, Menu, Popover use light backgrounds in light mode
export const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: true,
  },
  components: {
    Tooltip: {
      baseStyle: (props: { colorMode: string }) => ({
        bg: props.colorMode === 'light' ? 'gray.100' : 'gray.800',
        color: props.colorMode === 'light' ? 'gray.800' : 'white',
        '--popper-arrow-bg': props.colorMode === 'light' ? 'var(--chakra-colors-gray-100)' : 'var(--chakra-colors-gray-800)',
        ...(props.colorMode === 'light' && { borderWidth: '1px', borderColor: 'gray.200' }),
      }),
    },
    Menu: {
      baseStyle: (props: { colorMode: string }) => ({
        list: {
          bg: props.colorMode === 'light' ? 'white' : 'gray.800',
          color: props.colorMode === 'light' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'light' ? 'gray.200' : 'gray.600',
        },
      }),
    },
    Popover: {
      baseStyle: (props: { colorMode: string }) => ({
        content: {
          bg: props.colorMode === 'light' ? 'white' : 'gray.800',
          color: props.colorMode === 'light' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'light' ? 'gray.200' : 'gray.600',
        },
      }),
    },
  },
});
