import { describe, expect, it } from "@effect/vitest"
import { layoutStorage } from "#/lib/layout-storage"

/**
 * MAG-43, the server half (see the module doc for why a no-op is the only
 * safe value). Vitest's default environment is node: no `window`.
 */
describe("layoutStorage on the server (no window)", () => {
  it("returns a storage that reads nothing and swallows writes", () => {
    expect(typeof window).toBe("undefined")
    const storage = layoutStorage()
    expect(storage.getItem("any-key")).toBeNull()
    expect(() => storage.setItem("any-key", "v")).not.toThrow()
    expect(storage.getItem("any-key")).toBeNull()
  })
})
