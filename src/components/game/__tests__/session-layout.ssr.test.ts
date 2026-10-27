import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "@effect/vitest"
import { SessionLayout } from "#/components/game/SessionLayout"

/**
 * MAG-43: the session shell server-renders without touching localStorage.
 * Before the fix `useDefaultLayout` read the bare global during render, SSR
 * threw, and React logged "Switched to client rendering" on every session
 * page. The chrome reaches the server's HTML; the panel group, whose saved
 * layout only the browser knows, does not.
 */
describe("SessionLayout on the server", () => {
  it("renders the chrome and withholds the panel group", () => {
    expect(typeof window).toBe("undefined")
    const html = renderToString(
      createElement(SessionLayout, {
        sessionName: "The Dressing Room",
        inviteCode: "PROTO-96",
        activityLog: "the feed",
        workingSlot: "the slot",
        onClearPool: () => {},
      }),
    )
    expect(html).toContain("The Dressing Room")
    expect(html).toContain("PROTO-96")
    expect(html).not.toContain('data-slot="resizable-panel')
    expect(html).not.toContain("the feed")
  })
})
