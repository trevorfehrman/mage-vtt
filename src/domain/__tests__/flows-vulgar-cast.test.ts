import { Effect, Layer, Random } from "effect"
import { describe, expect, it } from "@effect/vitest"
import type { CharacterSheet } from "../character"
import { closeScene } from "../flows/scene"
import {
  cancelCast,
  containParadox,
  declineDraft,
  draftCast,
  editLiabilities,
  engageCast,
  killDraft,
  lockIntention,
  lockLiabilities,
  rollCastDice,
  rollParadox,
  setMagicalTool,
  voidCast,
} from "../flows/vulgar-cast"
import { CastId, CharacterId, PlayerId, SceneId, SessionId } from "../ids"
import { Membership } from "../membership"
import { CurrentActor } from "../ports/current-actor"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import {
  makeInMemory,
  type StoredCast,
  type StoredScene,
} from "../testing/in-memory"

/**
 * Flow tests for the Vulgar Cast ladder (issue #43, ADR-0016) — scripted whole
 * handshakes against one in-memory store with seeded dice, plus the refusal
 * matrix (wrong actor, wrong status, cardinality breaches), asserted at the
 * port boundary. Zero Convex. Actors alternate per beat, so each call provides
 * its own `CurrentActor` over the shared store layer.
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
} = {}) =>
  makeInMemory({
    members: [aldous, briar, stella],
    // The store-level actor is a placeholder; every beat overrides it.
    actor: { userId: PLAYER, isDev: false },
    sheets: [opts.sheet ?? makeSheet()],
    ...(opts.scenes ? { scenes: opts.scenes } : {}),
    ...(opts.casts ? { casts: opts.casts } : {}),
  })

const activeScene = (overrides?: Partial<StoredScene>): StoredScene => ({
  id: SCENE,
  sessionId: SESSION,
  name: "The Docks",
  status: "active",
  sleeperWitnesses: false,
  openedAt: 0,
  ...overrides,
})

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

/** `storedCast` advanced to a rung, with the fields its prior beats stamp. */
const castAt = (
  status: StoredCast["status"],
  overrides?: Partial<StoredCast>,
): StoredCast => {
  const stage =
    status === "draft"
      ? {}
      : {
          sceneId: SCENE,
          gnosis: 1,
          sleeperWitnesses: false,
          witnessCount: 0,
          priorParadoxRolls: 0,
        }
  const commitment =
    status === "intentionLocked" ||
    status === "paradoxRolled" ||
    status === "contained" ||
    status === "resolved"
      ? { manaMitigation: 0 }
      : {}
  const paradox =
    status === "paradoxRolled" || status === "contained" || status === "resolved"
      ? { paradoxSuccesses: 2, paradoxIsDramaticFailure: false }
      : {}
  const containment =
    status === "contained" || status === "resolved" ? { containedSuccesses: 1 } : {}
  return storedCast({ status, ...stage, ...commitment, ...paradox, ...containment, ...overrides })
}

describe("Flows.vulgarCast — the whole handshake (issue #43)", () => {
  it.effect("draft → engage → both locks → Paradox → containment → cast → resolved", () =>
    Effect.gen(function* () {
      const store = seed({
        scenes: [activeScene({ sleeperWitnesses: true })],
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

      // Beat 2 — the ST engages it onto the stage; liability defaults freeze.
      yield* engageCast({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      const engaged = store.casts[0]!
      expect(engaged.status).toBe("engaged")
      expect(engaged.sceneId).toBe(SCENE)
      expect(engaged.gnosis).toBe(1)
      expect(engaged.sleeperWitnesses).toBe(true) // from the Scene toggle
      expect(engaged.witnessCount).toBe(1) // the toggle's "one or more", countable
      expect(engaged.priorParadoxRolls).toBe(0)

      // Beat 3 — the ST locks liabilities against a frozen pool.
      yield* lockLiabilities({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.casts[0]!.status).toBe("liabilitiesLocked")
      // Gnosis 1 → base 1, +2 witnesses = 3 dice, narrated to the table.
      expect(store.messages[2]!.text).toContain("3-die Paradox pool")

      // Beat 4 — the caster locks intention: Mana commits atomically.
      yield* lockIntention({
        sessionId: SESSION,
        castId,
        manaMitigation: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.status).toBe("intentionLocked")
      expect(store.casts[0]!.manaMitigation).toBe(1)
      // 10 − (0 spell cost + 1 mitigation); no rule bent, no Override.
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(9)
      expect(store.messages[3]!.text).toContain("point of no return")
      expect(store.messages[3]!.override).toBeNull()

      // Beat 5 — the ST's own Paradox roll: 3 − 1 mitigated = 2 dice.
      yield* rollParadox({ sessionId: SESSION, castId }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.rolls).toHaveLength(1)
      const paradoxEntry = store.rolls[0]!
      expect(paradoxEntry.userId).toBe(ST_USER) // the ST's act, the ST's entry
      expect(paradoxEntry.result.poolSize).toBe(2)
      // This seed rolls ≥1 success, so the ladder waits on containment.
      const paradoxSuccesses = store.casts[0]!.paradoxSuccesses!
      expect(paradoxSuccesses).toBeGreaterThan(0)
      expect(store.casts[0]!.status).toBe("paradoxRolled")

      // Beat 6 — the caster bets flesh: contain 1 as Resistant bashing.
      yield* containParadox({
        sessionId: SESSION,
        castId,
        containedSuccesses: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))
      expect(store.casts[0]!.status).toBe("contained")
      expect(store.casts[0]!.containedSuccesses).toBe(1)
      const track = store.sheets.get(CHARACTER)!.healthTrack
      expect(track.filter((b) => b.severity === "bashing" && b.resistant)).toHaveLength(1)

      // Beat 7 — the climax: declared 4 − uncontained, its own roll entry.
      yield* rollCastDice({ sessionId: SESSION, castId }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
      )
      const resolved = store.casts[0]!
      const uncontained = paradoxSuccesses - 1
      expect(resolved.status).toBe("resolved")
      expect(resolved.castPool).toBe(4 - uncontained)
      expect(store.rolls).toHaveLength(2)
      const castEntry = store.rolls[1]!
      expect(castEntry.userId).toBe(PLAYER) // attribution follows the owner
      expect(castEntry.result.poolSize).toBe(Math.max(4 - uncontained, 0))
      expect(resolved.castSuccesses).toBe(castEntry.result.successes)
      // Resolution records the severity of what got loose.
      expect(resolved.severity).toBe(uncontained === 0 ? "none" : "havoc")

      // Every beat landed its own atomic Activity entry (ADR-0009):
      // five system messages + the two rolls.
      expect(store.messages.length + store.rolls.length).toBe(7)

      // The resolved Cast now prices the next one: the accumulator derives
      // from Cast history, never a tally (ADR-0012).
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
      expect(store.casts[1]!.priorParadoxRolls).toBe(1)
    }).pipe(Random.withSeed("docks")), // 2 Paradox successes, no explosions
  )

  it.effect("a zero-success Paradox roll auto-skips containment — no empty ceremony", () =>
    Effect.gen(function* () {
      // Full mitigation empties the pool: the roll still happens as a chance
      // die (the rules' gamble is honest), and this seed's chance die misses.
      const store = seed({
        casts: [castAt("intentionLocked", { manaMitigation: 1 })],
      })

      yield* rollParadox({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      expect(store.rolls[0]!.result.isChanceDie).toBe(true)
      expect(store.rolls[0]!.result.successes).toBe(0)
      expect(store.casts[0]!.status).toBe("contained")
      expect(store.casts[0]!.containedSuccesses).toBe(0)
      expect(store.rolls[0]!.summary).toContain("Nothing to contain")
    }).pipe(Random.withSeed("skip-seed")),
  )

  it.effect("the martyr path: the last box fills and the cast still flies", () =>
    Effect.gen(function* () {
      const oneBoxLeft = makeSheet({
        healthTrack: ["bashing", "bashing", "bashing", "bashing", "bashing", "bashing", "empty"],
      })
      const store = seed({
        sheet: oneBoxLeft,
        casts: [castAt("paradoxRolled", { paradoxSuccesses: 3 })],
      })
      const castId = CastId.make("cast-prior")

      // Cap = min(3 successes, 1 empty box) = 1: the martyr play.
      yield* containParadox({
        sessionId: SESSION,
        castId,
        containedSuccesses: 1,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      const track = store.sheets.get(CHARACTER)!.healthTrack
      expect(track.every((b) => b.severity !== "empty")).toBe(true)
      expect(store.messages[0]!.text).toContain("going down with the spell")

      // The martyr's fireball still flies: 4 declared − 2 uncontained = 2 dice.
      yield* rollCastDice({ sessionId: SESSION, castId }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
      )
      expect(store.casts[0]!.status).toBe("resolved")
      expect(store.casts[0]!.castPool).toBe(2)
      expect(store.casts[0]!.severity).toBe("bedlam") // 2 uncontained
    }).pipe(Random.withSeed("martyr-seed")),
  )

  it.effect("containing zero is a legal choice — everything manifests", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("paradoxRolled")] })

      yield* containParadox({
        sessionId: SESSION,
        castId: CastId.make("cast-prior"),
        containedSuccesses: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts[0]!.status).toBe("contained")
      expect(store.casts[0]!.containedSuccesses).toBe(0)
      expect(store.sheetPatches).toHaveLength(0) // no wounds written
      expect(store.messages[0]!.text).toContain("lets the Paradox run")
    }),
  )

  it.effect("downtime engagement: no Scene, no witnesses, no accumulation", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [storedCast()] })

      yield* engageCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )

      const engaged = store.casts[0]!
      expect(engaged.status).toBe("engaged")
      expect(engaged.sceneId).toBeUndefined()
      expect(engaged.sleeperWitnesses).toBe(false)
      expect(engaged.witnessCount).toBe(0)
      expect(engaged.priorParadoxRolls).toBe(0)
    }),
  )

  it.effect("the dramatic-failure grace prefills the accumulator default (issue #44)", () =>
    Effect.gen(function* () {
      // Two resolved rolls this Scene, the latest a dramatic failure: Paradox
      // leaves the caster alone, so the default forgives that Cast's +1.
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

      expect(store.casts[2]!.priorParadoxRolls).toBe(1)
    }),
  )
})

describe("Flows.vulgarCast — negotiation richness (issue #44)", () => {
  const CAST = CastId.make("cast-prior")

  it.effect("the ST's liability buttons reshape the pool the roll then uses", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

      // Three presses of the liability buttons, each its own realtime patch.
      yield* editLiabilities({
        sessionId: SESSION,
        castId: CAST,
        witnessCount: 3,
      }).pipe(as(ST_USER), Effect.provide(store.layer))
      yield* editLiabilities({
        sessionId: SESSION,
        castId: CAST,
        priorParadoxRolls: 2,
      }).pipe(as(ST_USER), Effect.provide(store.layer))
      yield* editLiabilities({
        sessionId: SESSION,
        castId: CAST,
        discretionaryModifiers: [{ source: "Ley line nexus", dice: 1 }],
      }).pipe(as(ST_USER), Effect.provide(store.layer))

      // Partial edits accumulate on the document; negotiation is table talk,
      // so no Activity entries land (ADR-0016: deliberation is not a reveal).
      const engaged = store.casts[0]!
      expect(engaged.witnessCount).toBe(3)
      expect(engaged.priorParadoxRolls).toBe(2)
      expect(engaged.discretionaryModifiers).toEqual([
        { source: "Ley line nexus", dice: 1 },
      ])
      expect(store.messages).toHaveLength(0)

      // The lock narrates the edited pool: base 1, +2 successive, +2
      // witnesses, +1 ley line = 6 dice.
      yield* lockLiabilities({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.messages[0]!.text).toContain("6-die Paradox pool")

      yield* lockIntention({
        sessionId: SESSION,
        castId: CAST,
        manaMitigation: 0,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      // The roll itself throws the edited pool, discretionary source and all.
      yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.rolls[0]!.result.poolSize).toBe(6)
      const names = store.rolls[0]!.components.map((c) => c.name)
      expect(names).toContain("Sleeper witnesses (3)")
      expect(names).toContain("Ley line nexus")
    }).pipe(Random.withSeed("negotiation")),
  )

  it.effect("the caster's magical-tool flag is theirs to change until the ST locks", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

      yield* setMagicalTool({
        sessionId: SESSION,
        castId: CAST,
        usesMagicalTool: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer))

      expect(store.casts[0]!.usesMagicalTool).toBe(true)
      expect(store.messages).toHaveLength(0) // table talk, no ceremony

      // The lock's narrated pool wears the tool: base 1, −1 tool = chance die
      // territory — but the pool floors at 0 dice.
      yield* lockLiabilities({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER),
        Effect.provide(store.layer),
      )
      expect(store.messages[0]!.text).toContain("0-die Paradox pool")
    }),
  )

  it.effect("liability edits are refused before engagement and after the ST's lock", () =>
    Effect.gen(function* () {
      const early = seed({ casts: [storedCast()] })
      const earlyExit = yield* editLiabilities({
        sessionId: SESSION, castId: CAST, witnessCount: 1,
      }).pipe(as(ST_USER), Effect.provide(early.layer), Effect.exit)
      expect(failureTag(earlyExit)).toBe("CastStatusConflict")

      const late = seed({ casts: [castAt("liabilitiesLocked")] })
      const lateExit = yield* editLiabilities({
        sessionId: SESSION, castId: CAST, witnessCount: 1,
      }).pipe(as(ST_USER), Effect.provide(late.layer), Effect.exit)
      expect(failureTag(lateExit)).toBe("CastStatusConflict")
      expect(late.casts[0]!.witnessCount).toBe(0)
    }),
  )

  it.effect("the liability buttons are the Storyteller's; the tool flag is the caster's", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

      // The caster reaching for the ST's side of the document…
      const casterExit = yield* editLiabilities({
        sessionId: SESSION, castId: CAST, witnessCount: 5,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      expect(failureTag(casterExit)).toBe("NotStoryteller")

      // …and a third player reaching for the caster's.
      const strangerExit = yield* setMagicalTool({
        sessionId: SESSION, castId: CAST, usesMagicalTool: true,
      }).pipe(as(OTHER_PLAYER), Effect.provide(store.layer), Effect.exit)
      expect(failureTag(strangerExit)).toBe("NotYourCharacter")

      expect(store.casts[0]!.witnessCount).toBe(0)
      expect(store.casts[0]!.usesMagicalTool).toBe(false)
    }),
  )

  it.effect("the tool flag freezes with the liabilities — the caster committed against that pool", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("liabilitiesLocked")] })

      const exit = yield* setMagicalTool({
        sessionId: SESSION, castId: CAST, usesMagicalTool: true,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("CastStatusConflict")
      expect(store.casts[0]!.usesMagicalTool).toBe(false)
    }),
  )

  it.effect("malformed liabilities are refused with the typed error", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

      const cases = [
        { witnessCount: -1 },
        { witnessCount: 1.5 },
        { priorParadoxRolls: -2 },
        { discretionaryModifiers: [{ source: "   ", dice: 1 }] },
        { discretionaryModifiers: [{ source: "Nexus", dice: 0 }] },
        { discretionaryModifiers: [{ source: "Nexus", dice: 1.5 }] },
      ]
      for (const bad of cases) {
        const exit = yield* editLiabilities({
          sessionId: SESSION, castId: CAST, ...bad,
        }).pipe(as(ST_USER), Effect.provide(store.layer), Effect.exit)
        expect(failureTag(exit)).toBe("InvalidLiability")
      }
      expect(store.casts[0]!.witnessCount).toBe(0)
      expect(store.casts[0]!.discretionaryModifiers).toBeUndefined()
    }),
  )

  it.effect("an ST toggling the tool in the caster's stead is Override-stamped (ADR-0015)", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

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

  it.effect("either party cancels freely before the caster's lock", () =>
    Effect.gen(function* () {
      const asCaster = seed({ casts: [castAt("engaged")] })
      yield* cancelCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(PLAYER),
        Effect.provide(asCaster.layer),
      )
      expect(asCaster.casts[0]!.status).toBe("cancelled")

      const asST = seed({ casts: [castAt("liabilitiesLocked")] })
      yield* cancelCast({ sessionId: SESSION, castId: CastId.make("cast-prior") }).pipe(
        as(ST_USER),
        Effect.provide(asST.layer),
      )
      expect(asST.casts[0]!.status).toBe("cancelled")
    }),
  )
})

describe("Flows.vulgarCast.voidCast — the Override-stamped repair", () => {
  it.effect("void restores committed Mana and containment Health, stamped as repair", () =>
    Effect.gen(function* () {
      // As if mid-ladder: 3 Mana spent (1 cost + 2 mitigation), 2 boxes bet.
      const woundedSheet = makeSheet({
        manaCurrent: 7,
        healthTrack: [
          { severity: "bashing", resistant: true },
          { severity: "bashing", resistant: true },
          "empty", "empty", "empty", "empty", "empty",
        ],
      })
      const store = seed({
        sheet: woundedSheet,
        casts: [
          castAt("contained", {
            spellManaCost: 1,
            manaMitigation: 2,
            containedSuccesses: 2,
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
      expect(sheet.healthTrack.every((b) => b.severity === "empty")).toBe(true)
      expect(store.messages[0]!.text).toContain("3 Mana and 2 Health restored")
      expect(store.messages[0]!.override?.kind).toBe("repair")
    }),
  )

  it.effect("void before commitment restores nothing — there is nothing to restore", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

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
        casts: [castAt("intentionLocked")],
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
      const store = seed({ casts: [castAt("engaged")] })

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
          castAt("liabilitiesLocked", {
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
      const lockEarly = yield* lockLiabilities({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)
      const rollEarly = yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)
      // …and the caster reaching past the ST.
      const intentEarly = yield* lockIntention({ sessionId: SESSION, castId: CAST, manaMitigation: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const containEarly = yield* containParadox({ sessionId: SESSION, castId: CAST, containedSuccesses: 0 }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const castEarly = yield* rollCastDice({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)

      for (const exit of [lockEarly, rollEarly, intentEarly, containEarly, castEarly]) {
        expect(failureTag(exit)).toBe("CastStatusConflict")
      }
      expect(store.casts[0]!.status).toBe("draft")
      expect(store.rolls).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("the caster's lock by the wrong player is refused", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("liabilitiesLocked")] })

      const exit = yield* lockIntention({
        sessionId: SESSION,
        castId: CAST,
        manaMitigation: 0,
      }).pipe(as(OTHER_PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.casts[0]!.status).toBe("liabilitiesLocked")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("mitigation past the pool or past the sheet's Mana is refused", () =>
    Effect.gen(function* () {
      // Pool: Gnosis 1 base, no witnesses = 1 die.
      const overPool = seed({ casts: [castAt("liabilitiesLocked")] })
      const poolExit = yield* lockIntention({
        sessionId: SESSION, castId: CAST, manaMitigation: 2,
      }).pipe(as(PLAYER), Effect.provide(overPool.layer), Effect.exit)
      expect(failureTag(poolExit)).toBe("InvalidMitigation")

      const broke = seed({
        sheet: makeSheet({ manaCurrent: 0 }),
        casts: [castAt("liabilitiesLocked")],
      })
      const manaExit = yield* lockIntention({
        sessionId: SESSION, castId: CAST, manaMitigation: 1,
      }).pipe(as(PLAYER), Effect.provide(broke.layer), Effect.exit)
      expect(failureTag(manaExit)).toBe("InsufficientMana")
      expect(broke.sheetPatches).toHaveLength(0)
      expect(broke.casts[0]!.status).toBe("liabilitiesLocked")
    }),
  )

  it.effect("free cancel is refused after the point of no return", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("intentionLocked")] })

      const casterExit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const stExit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(ST_USER), Effect.provide(store.layer), Effect.exit)

      // Brutal and symmetric inside the contract (ADR-0015).
      expect(failureTag(casterExit)).toBe("CastStatusConflict")
      expect(failureTag(stExit)).toBe("CastStatusConflict")
      expect(store.casts[0]!.status).toBe("intentionLocked")
    }),
  )

  it.effect("a third player cannot cancel someone else's negotiation", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("engaged")] })

      const exit = yield* cancelCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(OTHER_PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.casts[0]!.status).toBe("engaged")
    }),
  )

  it.effect("the Paradox roll cannot be fired by the caster", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("intentionLocked")] })

      const exit = yield* rollParadox({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.rolls).toHaveLength(0)
      expect(store.casts[0]!.status).toBe("intentionLocked")
    }),
  )

  it.effect("containment past the cap (successes, Health) is refused", () =>
    Effect.gen(function* () {
      // 2 successes but only 1 empty box: cap = 1.
      const store = seed({
        sheet: makeSheet({
          healthTrack: ["bashing", "bashing", "bashing", "bashing", "bashing", "bashing", "empty"],
        }),
        casts: [castAt("paradoxRolled")],
      })

      const overSuccesses = yield* containParadox({
        sessionId: SESSION, castId: CAST, containedSuccesses: 3,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)
      const overHealth = yield* containParadox({
        sessionId: SESSION, castId: CAST, containedSuccesses: 2,
      }).pipe(as(PLAYER), Effect.provide(store.layer), Effect.exit)

      expect(failureTag(overSuccesses)).toBe("InvalidContainment")
      expect(failureTag(overHealth)).toBe("InvalidContainment")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.casts[0]!.status).toBe("paradoxRolled")
    }),
  )

  it.effect("the climax roll belongs to the caster alone (of the players)", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("contained")] })

      const exit = yield* rollCastDice({ sessionId: SESSION, castId: CAST }).pipe(
        as(OTHER_PLAYER),
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.rolls).toHaveLength(0)
    }),
  )

  it.effect("void is refused to players and on terminal Casts", () =>
    Effect.gen(function* () {
      const live = seed({ casts: [castAt("engaged")] })
      const playerExit = yield* voidCast({ sessionId: SESSION, castId: CAST }).pipe(
        as(PLAYER), Effect.provide(live.layer), Effect.exit)
      expect(failureTag(playerExit)).toBe("NotStoryteller")
      expect(live.casts[0]!.status).toBe("engaged")

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
        casts: [castAt("engaged", { sessionId: SessionId.make("session-2") })],
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

describe("Flows.vulgarCast — the in-stead door stays visible (ADR-0015)", () => {
  it.effect("an ST locking intention for the caster carries a storyteller-action Override", () =>
    Effect.gen(function* () {
      const store = seed({ casts: [castAt("liabilitiesLocked")] })

      yield* lockIntention({
        sessionId: SESSION,
        castId: CastId.make("cast-prior"),
        manaMitigation: 0,
      }).pipe(as(ST_USER), Effect.provide(store.layer))

      // Visible rule-bending: the row and its narration both wear the marker.
      expect(store.casts[0]!.status).toBe("intentionLocked")
      expect(store.casts[0]!.override?.kind).toBe("storyteller-action")
      expect(store.messages[0]!.override?.kind).toBe("storyteller-action")
    }),
  )
})
