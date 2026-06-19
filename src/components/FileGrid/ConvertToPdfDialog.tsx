import React from 'react'
import { useColorModeValue } from '../ui/color-mode'
import { useDialogChrome } from '../ui/dialog-chrome'
import { Box, Dialog, Flex, Portal, Text } from '@chakra-ui/react'
import { FileText } from 'lucide-react'

export interface ConvertToPdfDialogProps {
  open: boolean
  fileName: string
}

export const ConvertToPdfDialog: React.FC<ConvertToPdfDialogProps> = ({ open, fileName }) => {
  const { surfaceBg, borderColor } = useDialogChrome()
  const subtitleColor = useColorModeValue('gray.500', 'gray.400')
  const barTrackBg = useColorModeValue('gray.100', 'rgba(255,255,255,0.06)')
  const barGradient = useColorModeValue(
    'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), rgba(96,165,250,0.85), rgba(59,130,246,0.6), transparent)',
    'linear-gradient(90deg, transparent, rgba(96,165,250,0.5), rgba(147,197,253,0.75), rgba(96,165,250,0.5), transparent)',
  )
  const iconBg = useColorModeValue('blue.50', 'rgba(59,130,246,0.12)')
  const iconColor = useColorModeValue('#3b82f6', '#93c5fd')

  return (
    <Dialog.Root open={open} size="sm" placement="center" closeOnInteractOutside={false} closeOnEscape={false}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.500" backdropFilter="blur(3px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg={surfaceBg}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="10px"
            overflow="hidden"
            boxShadow="0 20px 60px -12px rgba(0,0,0,0.4)"
          >
            <Dialog.Body py={6} px={6}>
              <Flex direction="column" align="center" gap={4}>
                {/* Icon */}
                <Flex
                  align="center"
                  justify="center"
                  w="44px"
                  h="44px"
                  borderRadius="10px"
                  bg={iconBg}
                >
                  <FileText size={22} color={iconColor} />
                </Flex>

                {/* Text */}
                <Flex direction="column" align="center" gap={1}>
                  <Text fontSize="sm" fontWeight={600}>
                    Converting to PDF
                  </Text>
                  <Text
                    fontSize="xs"
                    color={subtitleColor}
                    textAlign="center"
                    maxW="260px"
                    overflow="hidden"
                    textOverflow="ellipsis"
                    whiteSpace="nowrap"
                    title={fileName}
                  >
                    {fileName}
                  </Text>
                </Flex>

                {/* Loading bar */}
                <Box
                  w="100%"
                  h="3px"
                  borderRadius="full"
                  bg={barTrackBg}
                  overflow="hidden"
                  position="relative"
                >
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    h="100%"
                    w="40%"
                    borderRadius="full"
                    css={{
                      background: barGradient,
                      animation: 'convertBarSweep 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  />
                </Box>
              </Flex>
            </Dialog.Body>

          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
