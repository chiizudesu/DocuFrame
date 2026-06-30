import { Portal, Tooltip as ChakraTooltip } from "@chakra-ui/react"
import * as React from "react"

export interface TooltipProps extends React.ComponentProps<typeof ChakraTooltip.Root> {
  showArrow?: boolean
  portalled?: boolean
  portalRef?: React.RefObject<HTMLElement | null>
  content: React.ReactNode
  contentProps?: React.ComponentProps<typeof ChakraTooltip.Content>
  disabled?: boolean
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props

    if (disabled) return <>{children}</>

    return (
      // lazyMount + unmountOnExit: only build the Positioner/Content/Arrow when the tooltip is
      // actually open. Previously ~40 tooltips mounted their full content eagerly and re-rendered
      // on every commit (see profiler: TooltipContent/Positioner/Arrow ≈ 130ms of self-time).
      <ChakraTooltip.Root lazyMount unmountOnExit {...rest}>
        <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef as React.RefObject<HTMLElement> | undefined}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content ref={ref} {...contentProps}>
              {showArrow && (
                <ChakraTooltip.Arrow>
                  <ChakraTooltip.ArrowTip />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    )
  },
)
