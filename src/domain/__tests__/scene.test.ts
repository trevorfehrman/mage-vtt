import { describe, expect, it } from "@effect/vitest"
import { decodeActiveScene, decodeScenePips } from "../scene"

// The Scene strip's client seam (ADR-0005, issue #49): the `getActive` and
// `paradoxPips` queries decode through domain mirrors before the strip reads
// them — plain `it()`, pure decode leaves.
describe("Scene seam decode (issue #49, ADR-0022: the Tides)", () => {
  const sceneRow = {
    _id: "scn-1",
    _creationTime: 1,
    sessionId: "ses-1",
    name: "The Reliquary",
    status: "active",
    witnessCount: 3,
    circumstances: [{ source: "Ley-line surge", dice: 2 }],
    openedAt: 100,
  }

  it("decodes the active-scene row; status is the literal union", () => {
    const scene = decodeActiveScene(sceneRow)
    expect(scene?.name).toBe("The Reliquary")
    expect(scene?.status).toBe("active")
    expect(scene?.witnessCount).toBe(3)
    expect(scene?.circumstances).toEqual([{ source: "Ley-line surge", dice: 2 }])
  })

  it("a legacy row speaks the old boolean: true is one witness, no circumstances", () => {
    const { witnessCount: _w, circumstances: _c, ...legacy } = sceneRow
    const scene = decodeActiveScene({ ...legacy, sleeperWitnesses: true })
    expect(scene?.witnessCount).toBe(1)
    expect(scene?.circumstances).toEqual([])
    expect(decodeActiveScene({ ...legacy, sleeperWitnesses: false })?.witnessCount).toBe(0)
  })

  it("null passes through — downtime is an answer, not a failure", () => {
    expect(decodeActiveScene(null)).toBeNull()
  })

  it("a corrupt row degrades to null, never a crash", () => {
    expect(decodeActiveScene({ ...sceneRow, status: "paused" })).toBeNull()
  })
})

describe("ScenePip decode (issue #49)", () => {
  const pips = [
    { characterId: "chr-1", casterName: "Aldous", accumulator: 2 },
    { characterId: "chr-2", casterName: "Mira", accumulator: 1 },
  ]

  it("decodes the pips array in strip order", () => {
    expect(decodeScenePips(pips)).toEqual(pips)
  })

  it("a corrupt payload degrades to an empty strip, never a crash", () => {
    expect(decodeScenePips([{ characterId: "chr-1" }])).toEqual([])
    expect(decodeScenePips("nope")).toEqual([])
  })
})
