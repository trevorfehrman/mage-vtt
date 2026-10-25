import { useSyncExternalStore } from "react"
import {
  DEFAULT_TRAY_FORM,
  readTrayForm,
  type TrayForm,
} from "#/components/game/tray-form"

/**
 * The viewer's chosen form for the rail's two instruments, remembered in
 * this browser: the dice tray's (MAG-47) and the message box's (MAG-53),
 * each its own choice under its own key. Kept per browser on purpose (owner,
 * 2026-10-23: the table isn't built for phones, so there is no second device
 * to follow). Every instrument on the page reads its one store, so a flip
 * shows everywhere at once, and another tab's flip arrives through the
 * `storage` event. Storage can be missing or throw (private windows, blocked
 * site data): the instrument then keeps the default and still flips for this
 * page.
 */
export const TRAY_FORM_KEY = "mage-vtt:tray-form"
export const MESSAGE_FORM_KEY = "mage-vtt:message-form"

const formStore = (key: string) => {
  const listeners = new Set<() => void>()
  let fallback: TrayForm = DEFAULT_TRAY_FORM

  const read = (): TrayForm => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? fallback : readTrayForm(stored)
    } catch {
      return fallback
    }
  }

  const write = (form: TrayForm) => {
    fallback = form
    try {
      window.localStorage.setItem(key, form)
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

  return (): readonly [TrayForm, (form: TrayForm) => void] => {
    // the server renders the default; the stored choice lands on hydration
    const form = useSyncExternalStore(subscribe, read, () => DEFAULT_TRAY_FORM)
    return [form, write] as const
  }
}

export const useTrayForm = formStore(TRAY_FORM_KEY)
export const useMessageForm = formStore(MESSAGE_FORM_KEY)
