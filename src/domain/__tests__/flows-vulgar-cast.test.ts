import { Effect, Layer, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { KnownRote, type CharacterSheet } from "../character"
import { closeScene } from "../flows/scene"
import { RotePool } from "../rote-pool"
import {
  adjustPrice,
  cancelCast,
  commitCast,
  declineDraft,
  draftCast,
  engageCast,
  killDraft,
  lockPrice,
  releaseCast,
  rollParadox,
  setDraftContainment,
  setMagicalTool,
  voidCast,
} from "../flows/vulgar-cast"
import { CastId, CharacterId, PlayerId, SceneId, SessionId } from "../ids"
import { Membership } from "../membership"
import { CurrentActor } from "../ports/current-actor"
import { SpellRef } from "../rote-cast"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import {
  makeInMemory,
  type StoredCast,
  type StoredScene,
} from "../testing/in-memory"

/**
 * Flow tests for the Vulgar Cast ladder (issue #43, ADR-0016 as amended by
 * ADR-0022) — scripted whole handshakes against one in-memory store with
 * seeded dice, plus the refusal matrix (wrong actor, wrong status, wrong
 * phase, cardinality breaches), asserted at the port boundary. Zero Convex.
 * Actors alternate per beat, so each call provides its own `CurrentActor`
 * over the shared store layer.
 */

const SESSION = SessionId.make("session-1")
const PLAYER = PlayerId.make("user-aldous")
const OTHER_PLAYER = PlayerId.make("user-briar")
const ST_USER = PlayerId.make("user-stella")
const CHARACTER = CharacterId.make("char-aldous")
const SCENE = SceneId.make("scene-prior")

const aldous = new Membership({
  userId: PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})

const briar = new Membership({
  userId: OTHER_PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Briar",
})

const stella = new Membership({
  userId: ST_USER,
  sessionId: SESSION,
  role: "storyteller",
  displayName: "Stella",
})

/** Per-beat actor: provided over the store layer, nearest provide wins. */
const as = (userId: PlayerId, isDev = false) =>
  Effect.provide(Layer.succeed(CurrentActor, { userId, isDev }))

const seed = (opts: {
  sheet?: CharacterSheet
  scenes?: ReadonlyArray<StoredScene>
  casts?: ReadonlyArray<StoredCast>
  spells?: ReadonlyArray<SpellRef>
} = {}) =>
  makeInMemory({
    members: [aldous, briar, stella],
    // The store-level actor is a placeholder; every beat overrides it.
    actor: { userId: PLAYER, isDev: false },
    sheets: [opts.sheet ?? makeSheet()],
    ...(opts.scenes ? { scenes: opts.scenes } : {}),
    ...(opts.casts ? { casts: opts.casts } : {}),
    ...(opts.spells ? { spells: opts.spells } : {}),
  })

const activeScene = (overrides?: Partial<StoredScene>): StoredScene => ({
  id: SCENE,
  sessionId: SESSION,
  name: "The Docks",
  status: "active",
  witnessCount: 0,
  circumstances: [],
  openedAt: 0,
  ...overrides,
})

/** A quiet frozen seed — downtime's Tides, and the frozen default in tests. */
const NO_TIDES = { witnessCount: 0, circumstances: [], priorParadoxRolls: 0 }

/** A stored Cast mid-ladder: Aldous's improvised Death 2 (pool 1+3, cost 0). */
const storedCast = (overrides?: Partial<StoredCast>): StoredCast => ({
  id: CastId.make("cast-prior"),
  sessionId: SESSION,
  characterId: CHARACTER,
  casterUserId: PLAYER,
  casterName: "Aldous",
  status: "draft",
  arcanum: "death",
  level: 2,
  usesMagicalTool: false,
  declaredComponents: [
    { type: "gnosis", name: "Gnosis", dots: 1 },
    { type: "arcanum", name: "Death", dots: 3 },
  ],
  declaredPool: 4,
  spellManaCost: 0,
  override: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

/**
 * `storedCast` advanced to a rung, with the fields its prior beats stamp.
 * `price` seeds the fluid phase — pass `{ tides: NO_TIDES }` for the frozen
 * one; `paradox` seeds the pre-roll phase — pass `paradoxSuccesses` for the
 * cockpit.
 */
const castAt = (
  status: StoredCast["status"],
  overrides?: Partial<StoredCast>,
): StoredCast => {
  const stage = status === "draft" ? {} : { sceneId: SCENE, gnosis: 1 }
  const commitment =
    status === "paradox" || status === "resolved"
      ? { tides: NO_TIDES, manaMitigation: 0 }
      : {}
  const resolution =
    status === "resolved"
      ? {
          paradoxSuccesses: 2,
          paradoxIsDramaticFailure: false,
          containedSuccesses: 1,
        }
      : {}
  return storedCast({ status, ...stage, ...commitment, ...resolution, ...overrides })
}

describe("Flows.vulgarCast — the whole handshake (ADR-0022)", () => {
  it.effect("draft → engage → freeze → commit → Paradox → the one Cast click → resolved", () =>
    Effect.gen(function* () {
      const store = seed({
        scenes: [activeScene({ witnessCount: 1 })],
      })

      // Beat 1 — the caster drafts into the wings.
      const castId = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 2,
        intent: "Rot the warehouse door off its hinges",
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts).toHaveLength(1)
      expect(store.casts[0]!.status).toBe("draft")
      expect(store.casts[0]!.declaredPool).toBe(4) // Gnosis 1 + Death 3
      expect(store.casts[0]!.spellManaCost).toBe(0) // Moros ruling
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]!.text).toContain("drafts a vulgar Death 2 cast")

      // Beat 2 — the ST engages it onto the stage: The Price opens fluid.
      yield* engageCast({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      const engaged = store.casts[0]!
      expect(engaged.status).toBe("price")
      expect(engaged.sceneId).toBe(SCENE)
      expect(engaged.gnosis).toBe(1)
      expect(engaged.tides).toBeUndefined() // nothing settled yet

      // Beat 3 — THE FREEZE: the Tides seed stamps off the Scene.
      yield* lockPrice({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      const frozen = store.casts[0]!
      expect(frozen.status).toBe("price") // same rung, caster phase
      expect(frozen.tides).toEqual({
        witnessCount: 1,
        circumstances: [],
        priorParadoxRolls: 0,
      })
      // Gnosis 1 → base 1, +2 witnesses = 3 dice, narrated to the table.
      expect(store.messages[2]!.text).toContain("3-die Paradox pool")

      // Beat 4 — the caster commits: Mana commits atomically.
      yield* commitCast({
        sessionId: SESSION,
        castId,
        manaMitigation: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.status).toBe("paradox")
      expect(store.casts[0]!.manaMitigation).toBe(1)
      // 10 − (0 spell cost + 1 mitigation); no rule bent, no Override.
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(9)
      expect(store.messages[3]!.text).toContain("point of no return")
      expect(store.messages[3]!.override).toBeNull()

      // Beat 5 — the ST's own Paradox roll: 3 − 1 mitigated = 2 dice. The
      // rung holds; the stamped successes flip its phase to the caster.
      yield* rollParadox({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.rolls).toHaveLength(1)
      const paradoxEntry = store.rolls[0]!
      expect(paradoxEntry.userId).toBe(ST_USER) // the ST's act, the ST's entry
      expect(paradoxEntry.result.poolSize).toBe(2)
      // This seed rolls ≥1 success, so the cockpit has something to contain.
      const paradoxSuccesses = store.casts[0]!.paradoxSuccesses!
      expect(paradoxSuccesses).toBeGreaterThan(0)
      expect(store.casts[0]!.status).toBe("paradox")

      // Beat 6 — the one Cast click: containment lands and the dice fly in a
      // single commitment (ADR-0022).
      yield* releaseCast({
        sessionId: SESSION,
        castId,
        containedSuccesses: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      const resolved = store.casts[0]!
      const uncontained = paradoxSuccesses - 1
      expect(resolved.status).toBe("resolved")
      expect(resolved.containedSuccesses).toBe(1)
      const track = store.sheets.get(CHARACTER)!.healthTrack
      expect(track.filter((b) => b.severity === "bashing" && b.resistant)).toHaveLength(1)
      expect(resolved.castPool).toBe(4 - uncontained)
      expect(store.rolls).toHaveLength(2)
      const castEntry = store.rolls[1]!
      expect(castEntry.userId).toBe(PLAYER) // attribution follows the owner
      expect(castEntry.result.poolSize).toBe(Math.max(4 - uncontained, 0))
      expect(castEntry.summary).toContain("contains 1 of")
      expect(resolved.castSuccesses).toBe(castEntry.result.successes)
      // Resolution records the severity of what got loose.
      expect(resolved.severity).toBe(uncontained === 0 ? "none" : "havoc")

      // Every commitment landed its own atomic Activity entry (ADR-0009):
      // four system messages + the two rolls.
      expect(store.messages.length + store.rolls.length).toBe(6)

      // The resolved Cast now prices the next one: the accumulator derives
      // from Cast history at the freeze, never a tally (ADR-0012).
      const nextId = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      yield* engageCast({ sessionId: SESSION, castId: nextId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      yield* lockPrice({ sessionId: SESSION, castId: nextId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.casts[1]!.tides?.priorParadoxRolls).toBe(1)
    }).pipe(Random.withSeed("docks")), // 2 Paradox successes, no explosions
  )

  it.effect("a zero-success Paradox roll leaves nothing to contain — the release still waits on the caster", () =>
    Effect.gen(function* () {
      // Full mitigation empties the pool: the roll still happens as a chance
      // die (the rules' gamble is honest), and this seed's chance die misses.
      const store = seed({
        casts: [castAt("paradox", { manaMitigation: 1 })],
      })
      const castId = CastId.make("cast-prior")

      yield* rollParadox({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.rolls[0]!.result.isChanceDie).toBe(true)
      expect(store.rolls[0]!.result.successes).toBe(0)
      expect(store.casts[0]!.status).toBe("paradox") // caster phase now
      expect(store.casts[0]!.paradoxSuccesses).toBe(0)
      expect(store.rolls[0]!.summary).toContain("Nothing to contain")

      // The one Cast click with nothing to contain: zero is the only choice.
      yield* releaseCast({
        sessionId: SESSION,
        castId,
        containedSuccesses: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.status).toBe("resolved")
      expect(store.casts[0]!.containedSuccesses).toBe(0)
      expect(store.casts[0]!.severity).toBe("none")
    }).pipe(Random.withSeed("skip-seed")),
  )

  it.effect("the martyr path: the last box fills and the cast still flies — one commitment", () =>
    Effect.gen(function* () {
      const oneBoxLeft = makeSheet({
        healthTrack: ["bashing", "bashing", "bashing", "bashing", "bashing", "bashing", "empty"],
      })
      const store = seed({
        sheet: oneBoxLeft,
        casts: [castAt("paradox", { paradoxSuccesses: 3, paradoxIsDramaticFailure: false })],
      })
      const castId = CastId.make("cast-prior")

      // Cap = min(3 successes, 1 empty box) = 1: the martyr play — and the
      // fireball flies in the same click, as a chance die: 4 declared −
      // 2 uncontained − 3 wound penalty (full track) = −1 (issue #45).
      yield* releaseCast({
        sessionId: SESSION,
        castId,
        containedSuccesses: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const track = store.sheets.get(CHARACTER)!.healthTrack
      expect(track.every((b) => b.severity !== "empty")).toBe(true)
      expect(store.casts[0]!.status).toBe("resolved")
      expect(store.casts[0]!.castPool).toBe(-1)
      expect(store.rolls[0]!.result.isChanceDie).toBe(true)
      expect(store.casts[0]!.severity).toBe("bedlam") // 2 uncontained

      // Resolution surfaces the full-bashing-track rule for the ST (PRD #39
      // story 28): the system message lands after the cast completes.
      expect(store.messages[0]!.text).toContain("unconscious")
    }).pipe(Random.withSeed("martyr-seed")),
  )

  it.effect("wound penalties shrink the cast pool a second time (issue #45)", () =>
    Effect.gen(function* () {
      // Four of seven boxes filled: the contained wound lands in the fifth —
      // the caster casts at −1. Declared 4 − 1 uncontained − 1 wound penalty
      // = 2 dice, the penalty readable on the entry.
      const wounded = makeSheet({
        healthTrack: ["bashing", "bashing", "bashing", "bashing", "empty", "empty", "empty"],
      })
      const store = seed({
        sheet: wounded,
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })

      yield* releaseCast({
        sessionId: SESSION,
        castId: CastId.make("cast-prior"),
        containedSuccesses: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts[0]!.castPool).toBe(2)
      expect(store.rolls[0]!.result.poolSize).toBe(2)
      const penalty = store.rolls[0]!.components.find((c) => c.name === "Wound penalty")
      expect(penalty?.dots).toBe(-1)
      // Short of a full track, no unconsciousness message accompanies the roll.
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("containing zero is a legal choice — everything manifests", () =>
    Effect.gen(function* () {
      const store = seed({
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })

      yield* releaseCast({
        sessionId: SESSION,
        castId: CastId.make("cast-prior"),
        containedSuccesses: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts[0]!.status).toBe("resolved")
      expect(store.casts[0]!.containedSuccesses).toBe(0)
      // No wounds written: the only sheet write would be containment's.
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.rolls[0]!.summary).toContain("lets all 2 Paradox successes run")
      expect(store.casts[0]!.severity).toBe("bedlam")
    }),
  )

  it.effect("the cockpit's draft containment is broadcast working state (ADR-0022)", () =>
    Effect.gen(function* () {
      const store = seed({
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })
      const castId = CastId.make("cast-prior")

      // Box clicks, un-clicks included — no ceremony, no sheet writes.
      yield* setDraftContainment({
        sessionId: SESSION, castId, draftContainedSuccesses: 2,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.draftContainedSuccesses).toBe(2)

      yield* setDraftContainment({
        sessionId: SESSION, castId, draftContainedSuccesses: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.draftContainedSuccesses).toBe(0)

      expect(store.messages).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.casts[0]!.status).toBe("paradox")
    }),
  )

  it.effect("downtime: no Scene seeds no Tides — engagement and freeze both quiet", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })
      const castId = CastId.make("cast-prior")

      yield* engageCast({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      const engaged = store.casts[0]!
      expect(engaged.status).toBe("price")
      expect(engaged.sceneId).toBeUndefined()
      expect(engaged.tides).toBeUndefined()

      yield* lockPrice({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.casts[0]!.tides).toEqual(NO_TIDES)
    }),
  )

  it.effect("the dramatic-failure grace prices the frozen seed (ADR-0012)", () =>
    Effect.gen(function* () {
      // Two resolved rolls this Scene, the latest a dramatic failure: Paradox
      // leaves the caster alone, so the seed forgives that Cast's +1.
      const store = seed({
        scenes: [activeScene()],
        casts: [
          castAt("resolved", { id: CastId.make("cast-one"), updatedAt: 1 }),
          castAt("resolved", {
            id: CastId.make("cast-two"),
            paradoxIsDramaticFailure: true,
            updatedAt: 2,
          }),
        ],
      })

      const castId = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      yield* engageCast({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      yield* lockPrice({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.casts[2]!.tides?.priorParadoxRolls).toBe(1)
    }),
  )
})

describe("Flows.vulgarCast — the Willpower precommitment (ADR-0022, WoD p. 133)", () => {
  it.effect("a Willpower draft adds +3 declared dice; the point waits for the commit", () =>
    Effect.gen(function* () {
      const store = seed()

      const castId = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 2,
        spendWillpower: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const cast = store.casts[0]!
      expect(cast.spendWillpower).toBe(true)
      expect(cast.declaredPool).toBe(7) // Gnosis 1 + Death 3 + Willpower 3
      expect(cast.declaredComponents).toContainEqual({
        type: "modifier",
        name: "Willpower",
        dots: 3,
      })
      expect(store.messages[0]!.text).toContain("Willpower behind it")
      // Blind precommitment: nothing deducted while the draft is free.
      const before = store.sheets.get(CHARACTER)!.willpowerCurrent

      yield* engageCast({ sessionId: SESSION, castId }).pipe(
        as(ST_USER), Effect.provide(store.layer))
      yield* lockPrice({ sessionId: SESSION, castId }).pipe(
        as(ST_USER), Effect.provide(store.layer))
      yield* commitCast({ sessionId: SESSION, castId, manaMitigation: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer))

      // The commit spends the point with the Mana, atomically.
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(before - 1)
      expect(store.messages.at(-1)!.text).toContain("precommitted Willpower")
    }),
  )

  it.effect("a Willpower draft on an empty pool is refused at declaration", () =>
    Effect.gen(function* () {
      const store = seed({ sheet: makeSheet({ willpowerCurrent: 0 }) })

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 2,
        spendWillpower: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InsufficientWillpower")
      expect(store.casts).toHaveLength(0)
    }),
  )
})

describe("Flows.vulgarCast — The Price (ADR-0022)", () => {
  const CAST = CastId.make("cast-prior")

  it.effect("the Scene's Tides and the ST's adjustments assemble the pool the roll then throws", () =>
    Effect.gen(function* () {
      // The world speaks through the Scene: 3 witnesses, a ley-line surge;
      // this caster carries 2 pips of resolved history.
      const store = seed({
        scenes: [
          activeScene({
            witnessCount: 3,
            circumstances: [{ source: "Ley line nexus", dice: 1 }],
          }),
        ],
        casts: [
          castAt("resolved", { id: CastId.make("cast-one"), updatedAt: 1 }),
          castAt("resolved", { id: CastId.make("cast-two"), updatedAt: 2 }),
          castAt("price"),
        ],
      })

      // The ST's personal adjustment — this caster's broken hand.
      yield* adjustPrice({
        sessionId: SESSION,
        castId: CAST,
        adjustments: [{ source: "Broken hand", dice: 1 }],
      }).pipe(as(ST_USER), Effect.provide(store.layer))
      expect(store.casts[2]!.adjustments).toEqual([
        { source: "Broken hand", dice: 1 },
      ])
      expect(store.messages).toHaveLength(0) // assembly is table talk

      // The freeze stamps seed + narrates the assembled pool: base 1 + 2
      // witnesses + 2 successive + 1 ley line + 1 broken hand = 7 dice.
      yield* lockPrice({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.casts[2]!.tides).toEqual({
        witnessCount: 3,
        circumstances: [{ source: "Ley line nexus", dice: 1 }],
        priorParadoxRolls: 2,
      })
      expect(store.messages[0]!.text).toContain("7-die Paradox pool")

      yield* commitCast({
        sessionId: SESSION,
        castId: CAST,
        manaMitigation: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      // The roll itself throws the stamped pool, every source readable.
      yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.rolls[0]!.result.poolSize).toBe(7)
      const names = store.rolls[0]!.components.map((c) => c.name)
      expect(names).toContain("Sleeper witnesses (3)")
      expect(names).toContain("Ley line nexus")
      expect(names).toContain("Broken hand")
    }).pipe(Random.withSeed("negotiation")),
  )

  it.effect("a post-freeze Scene edit never touches the frozen card — the next cast pays it", () =>
    Effect.gen(function* () {
      const store = seed({
        scenes: [activeScene({ witnessCount: 1 })],
        casts: [castAt("price")],
      })

      yield* lockPrice({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.casts[0]!.tides?.witnessCount).toBe(1)

      // The world changes after the freeze (the strip's editTides door is
      // scene-flow tested; here the store mutates directly): the card keeps
      // its snapshot — "settled" never lies.
      store.scenes[0] &&
        (store.scenes as Array<StoredScene>).splice(0, 1, {
          ...store.scenes[0],
          witnessCount: 5,
        })
      expect(store.casts[0]!.tides?.witnessCount).toBe(1)
    }),
  )

  it.effect("the caster's magical-tool flag is theirs to change until the freeze", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      yield* setMagicalTool({
        sessionId: SESSION,
        castId: CAST,
        usesMagicalTool: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts[0]!.usesMagicalTool).toBe(true)
      expect(store.messages).toHaveLength(0) // table talk, no ceremony

      // The freeze's narrated pool wears the tool: base 1, −1 tool = chance
      // die territory — but the pool floors at 0 dice.
      yield* lockPrice({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.messages[0]!.text).toContain("0-die Paradox pool")
    }),
  )

  it.effect("adjustments are refused before engagement and after the freeze — irrevocably hands-off", () =>
    Effect.gen(function* () {
      const early = seed({ casts: [storedCast()] })
      const earlyExit = yield* adjustPrice({
        sessionId: SESSION, castId: CAST, adjustments: [{ source: "Nexus", dice: 1 }],
      }).pipe(as(ST_USER), Effect.provide(early.layer), Effect.exit)
      expect(failureTag(earlyExit)).toBe("CastStatusConflict")

      const late = seed({ casts: [castAt("price", { tides: NO_TIDES })] })
      const lateExit = yield* adjustPrice({
        sessionId: SESSION, castId: CAST, adjustments: [{ source: "Nexus", dice: 1 }],
      }).pipe(as(ST_USER), Effect.provide(late.layer), Effect.exit)
      expect(failureTag(lateExit)).toBe("CastStatusConflict")
      expect(late.casts[0]!.adjustments).toBeUndefined()

      // And the freeze itself cannot land twice — no re-stamp, ever.
      const refreeze = yield* lockPrice({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(late.layer), Effect.exit)
      expect(failureTag(refreeze)).toBe("CastStatusConflict")
    }),
  )

  it.effect("the adjustments are the Storyteller's; the tool flag is the caster's", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      // The caster reaching for the ST's side of the document…
      const casterExit = yield* adjustPrice({
        sessionId: SESSION, castId: CAST, adjustments: [{ source: "Nexus", dice: 1 }],
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      expect(failureTag(casterExit)).toBe("NotStoryteller")

      // …and a third player reaching for the caster's.
      const strangerExit = yield* setMagicalTool({
        sessionId: SESSION, castId: CAST, usesMagicalTool: true,
      }).pipe(as(OTHER_PLAYER), Effect.provide(store.layer), Effect.exit)
      expect(failureTag(strangerExit)).toBe("NotYourCharacter")

      expect(store.casts[0]!.adjustments).toBeUndefined()
      expect(store.casts[0]!.usesMagicalTool).toBe(false)
    }),
  )

  it.effect("the tool flag freezes with the price — the caster commits against that pool", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price", { tides: NO_TIDES })] })

      const exit = yield* setMagicalTool({
        sessionId: SESSION, castId: CAST, usesMagicalTool: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("CastStatusConflict")
      expect(store.casts[0]!.usesMagicalTool).toBe(false)
    }),
  )

  it.effect("malformed adjustments are refused with the typed error", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      const cases = [
        [{ source: "   ", dice: 1 }],
        [{ source: "Nexus", dice: 0 }],
        [{ source: "Nexus", dice: 1.5 }],
      ]
      for (const bad of cases) {
        const exit = yield* adjustPrice({
          sessionId: SESSION, castId: CAST, adjustments: bad,
        }).pipe(as(ST_USER), Effect.provide(store.layer), Effect.exit)
        expect(failureTag(exit)).toBe("InvalidAdjustment")
      }
      expect(store.casts[0]!.adjustments).toBeUndefined()
    }),
  )

  it.effect("an ST toggling the tool in the caster's stead is Override-stamped (ADR-0015)", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      yield* setMagicalTool({
        sessionId: SESSION, castId: CAST, usesMagicalTool: true,
      }).pipe(as(ST_USER), Effect.provide(store.layer))

      expect(store.casts[0]!.usesMagicalTool).toBe(true)
      expect(store.casts[0]!.override?.kind).toBe("storyteller-action")
    }),
  )
})

describe("Flows.vulgarCast — the wings and free exits", () => {
  it.effect("the owner kills their own draft freely", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      yield* killDraft({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
      )

      expect(store.casts[0]!.status).toBe("cancelled")
      expect(store.messages[0]!.text).toContain("withdraws")
      expect(store.messages[0]!.override).toBeNull()
    }),
  )

  it.effect("the ST declines a draft with attribution", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      yield* declineDraft({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.casts[0]!.status).toBe("cancelled")
      expect(store.messages[0]!.text).toContain("Stella declines")
    }),
  )

  it.effect("either party cancels freely anywhere on The Price — a frozen price can be bailed on", () =>
    Effect.gen(function* () {
      const asCaster = seed({ casts: [castAt("price")] })
      yield* cancelCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(PLAYER),
        Effect.provide(asCaster.layer),
      )
      expect(asCaster.casts[0]!.status).toBe("cancelled")

      const asST = seed({ casts: [castAt("price", { tides: NO_TIDES })] })
      yield* cancelCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(asST.layer),
      )
      expect(asST.casts[0]!.status).toBe("cancelled")
    }),
  )
})

describe("Flows.vulgarCast.voidCast — the Override-stamped repair", () => {
  it.effect("void restores committed Mana and the precommitted Willpower, stamped as repair", () =>
    Effect.gen(function* () {
      // As if mid-Paradox: 3 Mana spent (1 cost + 2 mitigation), the point spent.
      const committedSheet = makeSheet({
        manaCurrent: 7,
        willpowerCurrent: 4,
      })
      const store = seed({
        sheet: committedSheet,
        casts: [
          castAt("paradox", {
            spellManaCost: 1,
            manaMitigation: 2,
            spendWillpower: true,
          }),
        ],
      })

      yield* voidCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.casts[0]!.status).toBe("voided")
      // The row itself carries the repair provenance (ADR-0006/0015).
      expect(store.casts[0]!.override?.kind).toBe("repair")
      const sheet = store.sheets.get(CHARACTER)!
      expect(sheet.manaCurrent).toBe(10)
      expect(sheet.willpowerCurrent).toBe(5)
      expect(store.messages[0]!.text).toContain("3 Mana and 1 Willpower restored")
      expect(store.messages[0]!.override?.kind).toBe("repair")
    }),
  )

  it.effect("void before commitment restores nothing — there is nothing to restore", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price", { tides: NO_TIDES })] })

      yield* voidCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.casts[0]!.status).toBe("voided")
      expect(store.sheetPatches).toHaveLength(0)
      // A voided Cast never resolves, so the accumulator never sees it.
    }),
  )
})

describe("Flows.scene.closeScene × Casts (issue #43)", () => {
  it.effect("Scene close is refused over a Cast on stage", () =>
    Effect.gen(function* () {
      const store = seed({
        scenes: [activeScene()],
        casts: [castAt("paradox")],
      })

      const exit = yield* closeScene({ sessionId: SESSION }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("CastOnStage")
      expect(store.scenes[0]!.status).toBe("active")
    }),
  )

  it.effect("Scene close auto-cancels drafts — they had no mechanical weight", () =>
    Effect.gen(function* () {
      const store = seed({
        scenes: [activeScene()],
        casts: [storedCast(), storedCast({ id: CastId.make("cast-other"), characterId: CharacterId.make("char-briar") })],
      })

      yield* closeScene({ sessionId: SESSION }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.scenes[0]!.status).toBe("closed")
      expect(store.casts.every((c) => c.status === "cancelled")).toBe(true)
      // The one close entry narrates the cancelled wings (ADR-0009).
      expect(store.messages[0]!.text).toContain("2 drafts in the wings were cancelled")
    }),
  )
})

describe("Flows.vulgarCast — the refusal matrix", () => {
  const CAST = CastId.make("cast-prior")

  it.effect("a second unresolved Cast per character is refused", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("CastAlreadyPending")
      expect(store.casts).toHaveLength(1)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("a declaration above the caster's Arcanum dots is refused", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 5, // Aldous has Death 3
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("ArcanumTooWeak")
      expect(store.casts).toHaveLength(0)
    }),
  )

  it.effect("drafting on someone else's character is refused", () =>
    Effect.gen(function* () {
      const store = seed()

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
      }).pipe(as(OTHER_PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.casts).toHaveLength(0)
    }),
  )

  it.effect("killing someone else's draft is refused", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      const exit = yield* killDraft({ sessionId: SESSION, castId: CAST }).pipe(
        as(OTHER_PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.casts[0]!.status).toBe("draft")
    }),
  )

  it.effect("declining and engaging are the Storyteller's doors", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      const decline = yield* declineDraft({ sessionId: SESSION, castId: CAST }).pipe(
        as(OTHER_PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )
      const engage = yield* engageCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(decline)).toBe("NotStoryteller")
      expect(failureTag(engage)).toBe("NotStoryteller")
      expect(store.casts[0]!.status).toBe("draft")
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("engaging while the stage is occupied is refused", () =>
    Effect.gen(function* () {
      const store = seed({
        casts: [
          castAt("price", {
            id: CastId.make("cast-onstage"),
            characterId: CharacterId.make("char-briar"),
            casterUserId: OTHER_PLAYER,
            casterName: "Briar",
          }),
          storedCast(),
        ],
      })

      const exit = yield* engageCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("StageOccupied")
      expect(store.casts[1]!.status).toBe("draft")
    }),
  )

  it.effect("beats out of ladder order are refused symmetrically", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      // The ST reaching past engagement…
      const freezeEarly = yield* lockPrice({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)
      const rollEarly = yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)
      // …and the caster reaching past the ST.
      const commitEarly = yield* commitCast({ sessionId: SESSION, castId: CAST, manaMitigation: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const draftEarly = yield* setDraftContainment({ sessionId: SESSION, castId: CAST, draftContainedSuccesses: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const releaseEarly = yield* releaseCast({ sessionId: SESSION, castId: CAST, containedSuccesses: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)

      for (const exit of [freezeEarly, rollEarly, commitEarly, draftEarly, releaseEarly]) {
        expect(failureTag(exit)).toBe("CastStatusConflict")
      }
      expect(store.casts[0]!.status).toBe("draft")
      expect(store.rolls).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("committing against a fluid price is refused — nothing is settled yet", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      const exit = yield* commitCast({
        sessionId: SESSION,
        castId: CAST,
        manaMitigation: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("CastStatusConflict")
      expect(store.casts[0]!.status).toBe("price")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("the caster's commit by the wrong player is refused", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price", { tides: NO_TIDES })] })

      const exit = yield* commitCast({
        sessionId: SESSION,
        castId: CAST,
        manaMitigation: 0,
      }).pipe(as(OTHER_PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.casts[0]!.status).toBe("price")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("mitigation past the pool or past the sheet's Mana is refused", () =>
    Effect.gen(function* () {
      // Pool: Gnosis 1 base, quiet Tides = 1 die.
      const overPool = seed({ casts: [castAt("price", { tides: NO_TIDES })] })
      const poolExit = yield* commitCast({
        sessionId: SESSION, castId: CAST, manaMitigation: 2,
      }).pipe(as(PLAYER), Effect.provide(overPool.layer), Effect.exit)
      expect(failureTag(poolExit)).toBe("InvalidMitigation")

      const broke = seed({
        sheet: makeSheet({ manaCurrent: 0 }),
        casts: [castAt("price", { tides: NO_TIDES })],
      })
      const manaExit = yield* commitCast({
        sessionId: SESSION, castId: CAST, manaMitigation: 1,
      }).pipe(as(PLAYER), Effect.provide(broke.layer), Effect.exit)
      expect(failureTag(manaExit)).toBe("InsufficientMana")
      expect(broke.sheetPatches).toHaveLength(0)
      expect(broke.casts[0]!.status).toBe("price")
    }),
  )

  it.effect("free cancel is refused after the point of no return", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("paradox")] })

      const casterExit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const stExit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)

      // Brutal and symmetric inside the contract (ADR-0015).
      expect(failureTag(casterExit)).toBe("CastStatusConflict")
      expect(failureTag(stExit)).toBe("CastStatusConflict")
      expect(store.casts[0]!.status).toBe("paradox")
    }),
  )

  it.effect("a third player cannot cancel someone else's negotiation", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price")] })

      const exit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(OTHER_PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.casts[0]!.status).toBe("price")
    }),
  )

  it.effect("the Paradox roll cannot be fired by the caster, nor rolled twice", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("paradox")] })

      const casterExit = yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )
      expect(failureTag(casterExit)).toBe("NotStoryteller")
      expect(store.rolls).toHaveLength(0)

      const rolled = seed({
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })
      const rerollExit = yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(rolled.layer),
        Effect.exit,
      )
      expect(failureTag(rerollExit)).toBe("CastStatusConflict")
      expect(rolled.rolls).toHaveLength(0)
    }),
  )

  it.effect("containment past the cap (successes, Health) is refused — draft and release alike", () =>
    Effect.gen(function* () {
      // 2 successes but only 1 empty box: cap = 1.
      const store = seed({
        sheet: makeSheet({
          healthTrack: ["bashing", "bashing", "bashing", "bashing", "bashing", "bashing", "empty"],
        }),
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })

      const overSuccesses = yield* releaseCast({
        sessionId: SESSION, castId: CAST, containedSuccesses: 3,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const overHealth = yield* releaseCast({
        sessionId: SESSION, castId: CAST, containedSuccesses: 2,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const overDraft = yield* setDraftContainment({
        sessionId: SESSION, castId: CAST, draftContainedSuccesses: 2,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(overSuccesses)).toBe("InvalidContainment")
      expect(failureTag(overHealth)).toBe("InvalidContainment")
      expect(failureTag(overDraft)).toBe("InvalidContainment")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.casts[0]!.status).toBe("paradox")
    }),
  )

  it.effect("the release belongs to the caster alone (of the players) — and never before the roll", () =>
    Effect.gen(function* () {
      const rolled = seed({
        casts: [castAt("paradox", { paradoxSuccesses: 2, paradoxIsDramaticFailure: false })],
      })
      const strangerExit = yield* releaseCast({
        sessionId: SESSION, castId: CAST, containedSuccesses: 0,
      }).pipe(as(OTHER_PLAYER), Effect.provide(rolled.layer), Effect.exit)
      expect(failureTag(strangerExit)).toBe("NotYourCharacter")
      expect(rolled.rolls).toHaveLength(0)

      const unrolled = seed({ casts: [castAt("paradox")] })
      const earlyExit = yield* releaseCast({
        sessionId: SESSION, castId: CAST, containedSuccesses: 0,
      }).pipe(as(PLAYER), Effect.provide(unrolled.layer), Effect.exit)
      expect(failureTag(earlyExit)).toBe("CastStatusConflict")
      expect(unrolled.rolls).toHaveLength(0)
    }),
  )

  it.effect("void is refused to players and on terminal Casts", () =>
    Effect.gen(function* () {
      const live = seed({ casts: [castAt("price")] })
      const playerExit = yield* voidCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER), Effect.provide(live.layer), Effect.exit)
      expect(failureTag(playerExit)).toBe("NotStoryteller")
      expect(live.casts[0]!.status).toBe("price")

      const terminal = seed({ casts: [castAt("resolved")] })
      const terminalExit = yield* voidCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(terminal.layer), Effect.exit)
      expect(failureTag(terminalExit)).toBe("CastStatusConflict")
      expect(terminal.casts[0]!.status).toBe("resolved")
    }),
  )

  it.effect("a Cast outside this session is not found, not leaked", () =>
    Effect.gen(function* () {
      const store = seed({
        casts: [castAt("price", { sessionId: SessionId.make("session-2") })],
      })

      const exit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("DocumentNotFound")
    }),
  )
})

describe("Flows.vulgarCast — the rote lane (issue #47)", () => {
  // Presence 2 + Occult 4 + Death 3 + Rote Specialty 1 = 10 dice on Aldous's
  // sheet: he is Mysterium and Occult is one of the Order's three (issue #87).
  const sealOfBone = new KnownRote({
    name: "Seal of Bone",
    spellName: "Ectoplasmic Shaping",
    spellArcanum: "Death",
    spellLevel: 1,
    order: "Mysterium",
    pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
  })

  // An "or" pool — the caster picks at declaration. Its spell rates level 4
  // against Aldous's Death 3: a trained Rote is the qualification, not a dot
  // check (the castRote convention; ADR-0011's fudged sheet still casts).
  const twoDoors = new KnownRote({
    name: "Two Doors",
    spellName: "Quicken Corpse",
    spellArcanum: "Death",
    spellLevel: 4,
    order: "Mysterium",
    pool: new RotePool({
      attribute: "Wits",
      skills: ["Athletics", "Larceny"],
      arcanum: "Death",
    }),
  })

  // The same pool learned from another Order: never the specialty die (issue #87).
  const borrowedSeal = new KnownRote({
    name: "Borrowed Seal",
    spellName: "Ectoplasmic Shaping",
    spellArcanum: "Death",
    spellLevel: 1,
    order: "Adamantine Arrow",
    pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
  })

  // A Covert spell behind a trained Rote: casts atomically, refuses the ladder.
  const graveMien = new KnownRote({
    name: "Grave Mien",
    spellName: "Speak with the Dead",
    spellArcanum: "Death",
    spellLevel: 2,
    order: "Mysterium",
    pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
  })

  // The reference rows the Aspect gate reads — never client input (PRD #11).
  const SPELLS = [
    new SpellRef({ name: "Ectoplasmic Shaping", arcanum: "Death", level: 1, aspect: "Vulgar" }),
    new SpellRef({ name: "Quicken Corpse", arcanum: "Death", level: 4, aspect: "Vulgar" }),
    new SpellRef({ name: "Speak with the Dead", arcanum: "Death", level: 2, aspect: "Covert" }),
  ]

  const roteSeed = (opts: Parameters<typeof seed>[0] = {}) =>
    seed({
      sheet: makeSheet({ knownRotes: [sealOfBone, twoDoors, borrowedSeal, graveMien] }),
      spells: SPELLS,
      ...opts,
    })

  it.effect("a rote draft freezes the resolved pool and stamps isRote", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Seal of Bone",
        intent: "Seal the crypt with grave-wax",
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const cast = store.casts[0]!
      expect(cast.status).toBe("draft")
      expect(cast.isRote).toBe(true)
      expect(cast.roteName).toBe("Seal of Bone")
      // The declaration derives from the Rote's spell, not client numbers.
      expect(cast.arcanum).toBe("death")
      expect(cast.level).toBe(1)
      // The pool freezes from the sheet through the same leaf castRote uses —
      // Rote Specialty die included (own Order + Occult, issue #87).
      expect(cast.declaredComponents).toEqual([
        { type: "attribute", name: "Presence", dots: 2 },
        { type: "skill", name: "Occult", dots: 4 },
        { type: "arcanum", name: "Death", dots: 3 },
        { type: "modifier", name: "Rote Specialty", dots: 1 },
      ])
      expect(cast.declaredPool).toBe(10)
      // A Rote skips the improvised Path cost (the castRote convention).
      expect(cast.spellManaCost).toBe(0)
      expect(store.messages[0]!.text).toContain('drafts the Rote "Seal of Bone"')
      expect(store.messages[0]!.text).toContain("vulgar")
    }),
  )

  it.effect("an \"or\" pool needs the caster's pick — refused without, frozen with", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      const unpicked = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Two Doors",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      expect(failureTag(unpicked)).toBe("RoteSkillChoiceRequired")
      expect(store.casts).toHaveLength(0)

      yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Two Doors",
        skillChoice: "Larceny",
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const cast = store.casts[0]!
      expect(cast.declaredComponents).toContainEqual({
        type: "skill",
        name: "Larceny",
        dots: 2,
      })
      expect(cast.declaredPool).toBe(7) // Wits 2 + Larceny 2 + Death 3
      expect(cast.level).toBe(4) // no ArcanumTooWeak gate on the rote lane
    }),
  )

  it.effect("a Rote learned from another Order freezes an unchanged pool — no specialty die", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Borrowed Seal",
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const cast = store.casts[0]!
      expect(cast.declaredPool).toBe(9) // Presence 2 + Occult 4 + Death 3
      expect(cast.declaredComponents).not.toContainEqual(
        expect.objectContaining({ name: "Rote Specialty" }),
      )
    }),
  )

  it.effect("a Willpower rote draft carries the three dice too (ADR-0022)", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Seal of Bone",
        spendWillpower: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const cast = store.casts[0]!
      expect(cast.spendWillpower).toBe(true)
      expect(cast.declaredPool).toBe(13) // 10 + Willpower 3
      expect(cast.declaredComponents).toContainEqual({
        type: "modifier",
        name: "Willpower",
        dots: 3,
      })
    }),
  )

  it.effect("an untrained Rote is refused", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Borrowed Thunder",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("RoteNotKnown")
      expect(store.casts).toHaveLength(0)
    }),
  )

  it.effect("a Covert rote refuses the ladder — the lanes stay disjoint", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Grave Mien",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("SpellNotVulgar")
      expect(store.casts).toHaveLength(0)
    }),
  )

  it.effect("a draft declares exactly one lane — mixed or empty is refused", () =>
    Effect.gen(function* () {
      const store = roteSeed()

      const mixed = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Seal of Bone",
        arcanum: "death",
        level: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const empty = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const halfImprovised = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const strayPick = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        arcanum: "death",
        level: 1,
        skillChoice: "Larceny",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      for (const exit of [mixed, empty, halfImprovised, strayPick]) {
        expect(failureTag(exit)).toBe("InvalidCastDeclaration")
      }
      expect(store.casts).toHaveLength(0)
    }),
  )

  it.effect("one unresolved Cast per character counts across both lanes", () =>
    Effect.gen(function* () {
      const store = roteSeed({ casts: [castAt("price")] })

      const exit = yield* draftCast({
        sessionId: SESSION,
        characterId: CHARACTER,
        roteName: "Seal of Bone",
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("CastAlreadyPending")
      expect(store.casts).toHaveLength(1)
    }),
  )

  it.effect("the rote flag prices the Paradox pool: −1 die (p. 127)", () =>
    Effect.gen(function* () {
      const store = roteSeed({
        scenes: [activeScene({ witnessCount: 1 })],
        casts: [
          castAt("price", {
            isRote: true,
            roteName: "Seal of Bone",
          }),
        ],
      })
      const castId = CastId.make("cast-prior")

      // Base 1 (Gnosis 1) + 2 witnesses − 1 rote = 2 dice, narrated at the freeze.
      yield* lockPrice({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.messages[0]!.text).toContain("2-die Paradox pool")

      yield* commitCast({ sessionId: SESSION, castId, manaMitigation: 0 }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
      )

      // The roll itself wears the modifier, readable in the entry's components.
      yield* rollParadox({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.rolls[0]!.result.poolSize).toBe(2)
      expect(store.rolls[0]!.components.map((c) => c.name)).toContain("Rote casting")
    }).pipe(Random.withSeed("rote-paradox")),
  )
})

describe("Flows.vulgarCast — the in-stead door stays visible (ADR-0015)", () => {
  it.effect("an ST committing for the caster carries a storyteller-action Override", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("price", { tides: NO_TIDES })] })

      yield* commitCast({
        sessionId: SESSION,
        castId: CastId.make("cast-prior"),
        manaMitigation: 0,
      }).pipe(as(ST_USER), Effect.provide(store.layer))

      // Visible rule-bending: the row and its narration both wear the marker.
      expect(store.casts[0]!.status).toBe("paradox")
      expect(store.casts[0]!.override?.kind).toBe("storyteller-action")
      expect(store.messages[0]!.override?.kind).toBe("storyteller-action")
    }),
  )
})
