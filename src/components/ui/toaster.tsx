"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
})

const placementMap: Record<string, "top-start" | "top" | "top-end" | "bottom-start" | "bottom" | "bottom-end"> = {
  top: "top",
  "top-right": "top-end",
  "top-left": "top-start",
  bottom: "bottom",
  "bottom-right": "bottom-end",
  "bottom-left": "bottom-start",
}

/** Drop-in helper for legacy `useToast()` / `toast({ ... })` call sites */
export function showToast(options: {
  title?: string
  description?: string
  status?: "info" | "warning" | "success" | "error" | "loading"
  duration?: number
  isClosable?: boolean
  position?: string
}) {
  const pos = options.position ? placementMap[options.position] ?? options.position : undefined
  toaster.create({
    title: options.title,
    description: options.description,
    type: (options.status === "warning" ? "info" : options.status ?? "info") as
      | "info"
      | "success"
      | "error"
      | "loading",
    duration: options.duration,
    meta: { closable: options.isClosable !== false },
    ...(pos && { placement: pos }),
  })
}

export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {(toast as { closable?: boolean }).closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
