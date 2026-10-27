// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "@effect/vitest"
import { SessionLayout } from "#/components/game/SessionLayout"

/**
 * MAG-43, the browser half: once mounted, the panel group is there with its
 * panels and the rail's content inside — and a layout this browser saved
 * before is the one restored. The saved-layout case is the one the first
 * attempt (6009907) broke: it hydrated squashed because the server had
 * rendered a group of its own.
 */
const LAYOUT_KEY = "react-resizable-panels:session-layout-v4"

// jsdom has no ResizeObserver; the group constructs one at mount to track
// its axis. A still observer is enough for a mount test.
class StillResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => vi.stubGlobal("ResizeObserver", StillResizeObserver))
afterAll(() => vi.unstubAllGlobals())
afterEach(() => {
  cleanup()
  window.localStorage.removeItem(LAYOUT_KEY)
})

const shell = (videoRail?: string) =>
  createElement(SessionLayout, {
    sessionName: "The Dressing Room",
    inviteCode: "PROTO-96",
    ...(videoRail !== undefined && { videoRail }),
    activityLog: "the feed",
    workingSlot: "the slot",
    onClearPool: () => {},
  })

const flexGrowById = (container: HTMLElement) =>
  Object.fromEntries(
    [...container.querySelectorAll<HTMLElement>('[data-slot="resizable-panel"]')].map((p) => [
      p.id,
      p.style.flexGrow,
    ]),
  )

describe("SessionLayout in the browser", () => {
  it("mounts the panel group once hydrated", () => {
    const { container } = render(shell())
    expect(container.querySelectorAll('[data-slot="resizable-panel-group"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-slot="resizable-panel"]')).toHaveLength(2)
    expect(container.textContent).toContain("the feed")
    expect(container.textContent).toContain("the slot")
  })

  it("restores the layout this browser saved", () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ left: 17.7, center: 49.235, right: 33.065 }))
    const { container } = render(shell("the tiles"))
    expect(container.querySelectorAll('[data-slot="resizable-panel"]')).toHaveLength(3)
    expect(flexGrowById(container)).toEqual({ left: "17.7", center: "49.235", right: "33.065" })
  })
})
