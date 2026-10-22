import type { LayoutStorage } from "react-resizable-panels"

/**
 * A storage for react-resizable-panels' `useDefaultLayout` that is safe to
 * hand over during server render (MAG-43).
 *
 * The hook reads `storage.getItem` DURING render, and it defaults
 * `storage: undefined` back to the bare `localStorage` global — so on the
 * server (no `window`) the only value that doesn't throw is a storage that
 * exists and does nothing. Server render then falls through to the panels'
 * `defaultSize`s; the client hydrates from the browser's saved sizes as before.
 */
const serverLayoutStorage: LayoutStorage = {
  getItem: () => null,
  setItem: () => {},
}

export function layoutStorage(): LayoutStorage {
  return typeof window === "undefined" ? serverLayoutStorage : window.localStorage
}
