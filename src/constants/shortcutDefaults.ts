/**
 * Built-in defaults when settings have never stored a value.
 * User-facing copy and recorders live in Settings; import this instead of scattering literals.
 */
export const DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT = 'Backspace'

/** Older builds used this; migrate to {@link DEFAULT_JUMP_MODE_ON_PARENT_SHORTCUT} on load */
export const LEGACY_JUMP_MODE_ON_PARENT_SHORTCUT = 'Ctrl+Backspace'
