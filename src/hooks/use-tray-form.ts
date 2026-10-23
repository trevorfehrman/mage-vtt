import { useSyncExternalStore } from "react"
import {
  DEFAULT_TRAY_FORM,
  readTrayForm,
  type TrayForm,
} from "#/components/game/tray-form"

/**
 * The viewer's chosen dice-tray form (MAG-47), remembered in this browser.
 * Kept per browser on purpose (owner, 2026-10-23: the table isn't built for
 * phones, so there is no second device to follow). Every tray on the page
 * reads one store, so a flip shows everywhere at once, and another tab's
 * flip arrives through the `storage` event. Storage can be missing or throw
 * (private windows, blocked site data): the tray then keeps the default and
 * still flips for this page.
 */
export const TRAY_FORM_KEY = "mage-vtt:tray-form"

const listeners = new Set<() => void>()
let fallback: TrayForm = DEFAULT_TRAY_FORM

const read = (): TrayForm => {
  try {
    const stored = window.localStorage.getItem(TRAY_FORM_KEY)
    return stored === null ? fallback : readTrayForm(stored)
  } catch {
    return fallback
  }
}

const write = (form: TrayForm) => {
  fallback = form
  try {
    window.localStorage.setItem(TRAY_FORM_KEY, form)
  } catch {
    // the page's own copy above still holds the flip
  }
  listeners.forEach((l) => l())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function useTrayForm(): readonly [TrayForm, (form: TrayForm) => void] {
  // the server renders the default; the stored choice lands on hydration
  const form = useSyncExternalStore(subscribe, read, () => DEFAULT_TRAY_FORM)
  return [form, write] as const
}
