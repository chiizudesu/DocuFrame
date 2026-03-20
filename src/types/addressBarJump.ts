/** Imperative API registered by FolderInfoBar for global keyboard → address-bar filter. */
export interface AddressBarJumpApi {
  isActive: () => boolean
  openAtCurrentDirectory: (opts?: { initialText?: string }) => void
  openAtParentDirectory: (opts?: { initialText?: string }) => void
  appendFilterText: (text: string) => void
  /** When filter is open but typing pill may not be focused (e.g. grid focused). */
  globalBackspace: () => void
  close: () => void
  /** When jump UI is active but focus is on the grid (not the typing pill), apply Enter navigation. */
  applyEnterNavigation: () => void
}
