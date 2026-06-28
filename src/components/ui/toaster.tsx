"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

/** Must match every `toaster.create({ placement })` — Ark Toaster only renders toasts whose placement equals the group placement (@zag-js/toast getToastsByPlacement). */
const TOASTER_PLACEMENT = "top" as const

export const toaster = createToaster({
  placement: TOASTER_PLACEMENT,
  pauseOnPageIdle: true,
  // zag injects offsets.top as the group's inline `top`, so a CSS var works here.
  // Layout publishes --df-toast-top (toolbar bottom edge); falls back to 1rem.
  offsets: { top: "var(--df-toast-top, 1rem)", right: "1rem", bottom: "1rem", left: "1rem" },
})

/** IPC / async boundaries may yield plain objects instead of `Error` — use for user-visible messages. */
export function getErrorMessageFromUnknown(error: unknown): string {
  if (error == null) return "Unknown error"
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
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
  // `options.position` is ignored: per-toast placement must equal the group placement (TOASTER_PLACEMENT) or Ark renders no toasts.
  // setTimeout(0) lets blur / unmount settle before the toast state update runs,
  // which prevents it being silently swallowed when called inside an onBlur / form-submit.
  setTimeout(() => {
    toaster.create({
      title: options.title,
      description: options.description,
      type: (options.status === "warning" ? "info" : options.status ?? "info") as
        | "info"
        | "success"
        | "error"
        | "loading",
      duration: options.duration ?? 5000,
      placement: TOASTER_PLACEMENT,
    })
  }, 0)
}

export const Toaster = () => {
  return (
    <Portal>
      {/*
        Zag positions the toast group full-width at the top; default pointer-events let that region
        steal clicks from the app. Pass events through the region; only each toast card is interactive.
      */}
      <ChakraToaster
        toaster={toaster}
        insetInline="4"
        zIndex={2147483647}
        pointerEvents="none"
      >
        {(toast) => (
          <Toast.Root width={{ md: "sm" }} pointerEvents="auto">
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
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
