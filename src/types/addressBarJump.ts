/** Imperative API registered by FolderInfoBar for global keyboard → address-bar filter. */
export interface AddressBarJumpApi {
  isActive: () => boolean
  openAtCurrentDirectory: (opts?: { initialText?: string }) => void
  openAtParentDirectory: (opts?: { initialText?: string }) => void
  /** Open jump UI anchored so `path` is the active folder (must lie under current breadcrumbs / workspace root). Returns false if the path cannot be anchored. */
  openAtPath: (path: string, opts?: { initialText?: string }) => boolean
  appendFilterText: (text: string) => void
  /** When filter is open but typing pill may not be focused (e.g. grid focused). */
  globalBackspace: () => void
  close: () => void
  /** When jump UI is active but focus is on the grid (not the typing pill), apply Enter navigation. */
  applyEnterNavigation: () => void
}
