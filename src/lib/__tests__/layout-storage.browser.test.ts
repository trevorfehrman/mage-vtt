// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest"
import { layoutStorage } from "#/lib/layout-storage"

/**
 * MAG-43, the browser half: with a window present the storage IS
 * localStorage, so panel sizes still survive a reload.
 */
describe("layoutStorage in the browser (window present)", () => {
  it("hands back the real localStorage so sizes persist", () => {
    expect(typeof window).toBe("object")
    const storage = layoutStorage()
    storage.setItem("mag-43", "persisted")
    expect(window.localStorage.getItem("mag-43")).toBe("persisted")
    expect(storage.getItem("mag-43")).toBe("persisted")
    window.localStorage.removeItem("mag-43")
  })
})
