import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { healthBox } from "../damage"
import { handEditSheet, markSheet, setMagicalTool } from "../flows/hand-edit"
import { CharacterId, PlayerId, SceneId, SessionId, SessionMemberId } from "../ids"
import { Membership } from "../membership"
import { failureTag, makeAldousSheet as makeSheet } from "../testing/fixtures"
import { makeInMemory } from "../testing/in-memory"

/**
 * Flow tests for `Flows.handEdit.handEditSheet` (PRD #11, issue #19) — the
 * fudge/repair path, asserted at the port boundary through the in-memory
 * adapter. The ladder is inverted: ownership grants nothing; only the
 * session's Storyteller and the Dev pass, every pass Override-stamped
 * (kind `repair`, ADR-0006) and narrated as a system Activity entry.
 */

const SESSION = SessionId.make("session-1")
const OTHER_SESSION = SessionId.make("session-2")
const PLAYER = PlayerId.make("user-aldous")
const OTHER_PLAYER = PlayerId.make("user-briar")
const ST_USER = PlayerId.make("user-stella")
const DEV_USER = PlayerId.make("user-trevor")
const CHARACTER = CharacterId.make("char-aldous")
const ST_CHARACTER = CharacterId.make("char-stella")

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

const stellaSheet = makeSheet({
  id: ST_CHARACTER,
  userId: ST_USER,
  sessionMemberId: SessionMemberId.make("member-stella"),
  name: "Stella",
})

const seed = (actor: { userId: PlayerId; isDev?: boolean }) =>
  makeInMemory({
    members: [aldous, briar, stella],
    actor: { userId: actor.userId, isDev: actor.isDev ?? false },
    sheets: [makeSheet(), stellaSheet],
  })

describe("Flows.handEdit.handEditSheet (issue #19)", () => {
  it.effect("the owning Player is rejected — the ladder is inverted, sheet untouched", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: 3,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("a member who is neither owner nor Storyteller is rejected", () =>
    Effect.gen(function* () {
      const store = seed({ userId: OTHER_PLAYER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: 3,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect(
    "the Storyteller hand-edits a player's sheet: value applied, repair Override, system Activity entry",
    () =>
      Effect.gen(function* () {
        const store = seed({ userId: ST_USER })

        yield* handEditSheet({
          sessionId: SESSION,
          characterId: CHARACTER,
          manaCurrent: 3,
        }).pipe(Effect.provide(store.layer))

        // The value lands
        expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(3)
        expect(store.sheetPatches).toEqual([
          { characterId: CHARACTER, patch: { manaCurrent: 3 } },
        ])

        // One system Activity entry, attributed to the *editor* (a hand edit
        // is the ST's own act — not the owner's action), Override-stamped
        expect(store.rolls).toHaveLength(0)
        expect(store.messages).toHaveLength(1)
        const entry = store.messages[0]!
        expect(entry.visibility).toBe("system")
        expect(entry.senderId).toBe(ST_USER)
        expect(entry.senderName).toBe("Stella")
        expect(entry.override).not.toBeNull()
        expect(entry.override!.kind).toBe("repair")
        expect(entry.override!.invokedByUserId).toBe(ST_USER)
        expect(entry.override!.invokedByName).toBe("Stella")

        // The narrative names editor, target, and the change old → new
        expect(entry.text).toContain("Stella")
        expect(entry.text).toContain("Aldous")
        expect(entry.text).toContain("Mana 10 → 3")
      }),
  )

  it.effect("the Storyteller may hand-edit their own sheet — the ladder consults role, not ownership", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: ST_CHARACTER,
        willpowerCurrent: 2,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(ST_CHARACTER)!.willpowerCurrent).toBe(2)
      expect(store.messages[0]!.override!.kind).toBe("repair")
    }),
  )

  it.effect("the Dev (not even a member) hand-edits with the repair Override, named by id", () =>
    Effect.gen(function* () {
      const store = seed({ userId: DEV_USER, isDev: true })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        willpowerCurrent: 5,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(5)
      const entry = store.messages[0]!
      expect(entry.override!.kind).toBe("repair")
      expect(entry.override!.invokedByUserId).toBe(DEV_USER)
      // No membership to draw a display name from — the id is the fallback
      expect(entry.override!.invokedByName).toBe(DEV_USER)
    }),
  )

  it.effect("capacity is shape: Willpower above its printed rating is refused", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      // Aldous's Willpower rating is 6 (effective Resolve + Composure). The
      // pool's size is the form, not its state — overfill doesn't fit the
      // boxes. Raising the cap means editing the stats that print it, when
      // such a door exists.
      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        willpowerCurrent: 9,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(6)
    }),
  )

  it.effect("capacity is shape: Mana above the Gnosis-printed pool is refused", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      // Gnosis 1 prints a 10-Mana pool.
      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: 11,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("a pool filled to exactly its capacity is a legal fudge", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        willpowerCurrent: 6, // the printed rating, restored to full
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(6)
      expect(store.messages).toHaveLength(1)
    }),
  )

  it.effect("the health track is hand-editable and narrated", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [
          healthBox("lethal"),
          healthBox("bashing"),
          ...Array.from({ length: 5 }, () => healthBox("empty")),
        ],
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack).toEqual([
        healthBox("lethal"),
        healthBox("bashing"),
        ...Array.from({ length: 5 }, () => healthBox("empty")),
      ])
      expect(store.messages[0]!.text).toContain("Health")
    }),
  )

  it.effect("the door collapses a Resistant dot under an empty box (#118)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [
          healthBox("empty", true),
          healthBox("bashing", true),
          ...Array.from({ length: 5 }, () => healthBox("empty")),
        ],
      }).pipe(Effect.provide(store.layer))

      // The orphan normalizes away; the real wound keeps its dot.
      expect(store.sheets.get(CHARACTER)!.healthTrack.slice(0, 2)).toEqual([
        healthBox("empty"),
        healthBox("bashing", true),
      ])
    }),
  )

  it.effect("resistance is hand-settable per box, and the narration counts the dots (issue #41)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [
          healthBox("bashing", true),
          healthBox("bashing"),
          ...Array.from({ length: 5 }, () => healthBox("empty")),
        ],
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack.slice(0, 2)).toEqual([
        healthBox("bashing", true),
        healthBox("bashing"),
      ])
      expect(store.messages[0]!.text).toContain("2 bashing (1 resistant)")
    }),
  )

  it.effect("resistance is hand-clearable per box — the representable is editable (ADR-0011)", () =>
    Effect.gen(function* () {
      const store = makeInMemory({
        members: [aldous, briar, stella],
        actor: { userId: ST_USER, isDev: false },
        sheets: [
          makeSheet({
            healthTrack: [
              healthBox("bashing", true),
              ...Array.from({ length: 6 }, () => healthBox("empty")),
            ],
          }),
        ],
      })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [
          healthBox("bashing"),
          ...Array.from({ length: 6 }, () => healthBox("empty")),
        ],
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack[0]).toEqual(healthBox("bashing"))
      expect(store.messages[0]!.text).toContain(
        "Health 1 bashing (1 resistant) → 1 bashing",
      )
    }),
  )

  it.effect("several values land as one patch and one entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: 2,
        willpowerCurrent: 4,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 2, willpowerCurrent: 4 } },
      ])
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]!.text).toContain("Mana 10 → 2")
      expect(store.messages[0]!.text).toContain("Willpower 6 → 4")
    }),
  )

  it.effect("Wisdom is hand-editable and narrated — degeneration is the Storyteller's to record (MAG-56)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 6,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(6)
      expect(store.sheetPatches).toEqual([{ characterId: CHARACTER, patch: { wisdom: 6 } }])
      expect(store.messages[0]!.text).toContain("Wisdom 7 → 6")
    }),
  )

  it.effect("a Wisdom the rank cannot hold is refused InvalidHandEdit, untouched", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 11,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(7)
    }),
  )

  it.effect("an empty edit is refused InvalidHandEdit", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("an unrepresentable value is refused InvalidHandEdit, untouched", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: -1,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
    }),
  )

  it.effect("a malformed health box is refused InvalidHandEdit", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [{ severity: "mangled", resistant: false }],
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a track with the wrong box count is refused — shape isn't state", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [healthBox("bashing"), healthBox("empty")], // Aldous has 7 boxes
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.healthTrack).toHaveLength(7)
    }),
  )

  it.effect("values outside the narrow patch surface are stripped, not written", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      // Sneak a Trait past the types: the decode admits only the narrow
      // surface (ADR-0011's compensating control), so gnosis never lands.
      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        manaCurrent: 5,
        gnosis: 10,
      } as never).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.gnosis).toBe(1)
      expect(store.sheetPatches).toEqual([
        { characterId: CHARACTER, patch: { manaCurrent: 5 } },
      ])
    }),
  )

  it.effect("a character outside the session is not found (no cross-session leak)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: OTHER_SESSION,
        characterId: CHARACTER,
        manaCurrent: 3,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("DocumentNotFound")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )
})

describe("Flows.handEdit.handEditSheet: unspent experience (MAG-57)", () => {
  it.effect("the Storyteller records a balance, narrated old → new", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        experienceUnspent: 12,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.experience).toBe(12)
      expect(store.messages[0]!.text).toContain("Experience 0 → 12")
    }),
  )

  it.effect("a negative balance doesn't fit the sheet", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        experienceUnspent: -1,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )
})

/**
 * The mark-sheet door (MAG-63): the paper gesture. The ladder is the normal
 * one — the owner marks their own sheet plainly, an ST or Dev in their stead
 * is Override-recorded, and a stranger is refused — the inverse of the hand
 * edit above.
 */
describe("Flows.handEdit.markSheet (MAG-63)", () => {
  const twoLethal = [
    healthBox("lethal"),
    healthBox("lethal", true),
    healthBox("empty"),
    healthBox("empty"),
    healthBox("empty"),
    healthBox("empty"),
    healthBox("empty"),
  ]

  it.effect("the owning Player marks their own track: applied, no Override, a system entry in their name", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: twoLethal,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack[0]!.severity).toBe("lethal")
      expect(store.sheets.get(CHARACTER)!.healthTrack[1]!.resistant).toBe(true)
      expect(store.messages).toHaveLength(1)
      const entry = store.messages[0]!
      expect(entry.visibility).toBe("system")
      expect(entry.senderId).toBe(PLAYER)
      expect(entry.override).toBeNull()
      expect(entry.text).toContain("Aldous marked Aldous")
      expect(entry.text).toContain("Health clear → 2 lethal (1 resistant)")
    }),
  )

  it.effect("the owning Player sets their own Wisdom", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 6,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(6)
      expect(store.messages[0]!.text).toContain("Wisdom 7 → 6")
    }),
  )

  it.effect("the Storyteller marks a player's sheet in their stead — Override-recorded", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 5,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(5)
      const entry = store.messages[0]!
      expect(entry.senderId).toBe(ST_USER)
      expect(entry.override).not.toBeNull()
      expect(entry.text).toContain("Stella marked Aldous")
    }),
  )

  it.effect("a Dev who is no member marks in the owner's stead — admitted, Override-recorded, named by id", () =>
    Effect.gen(function* () {
      const store = seed({ userId: DEV_USER, isDev: true })

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 4,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(4)
      const entry = store.messages[0]!
      expect(entry.override).not.toBeNull()
      expect(entry.text).toContain(`${DEV_USER} marked Aldous`)
    }),
  )

  it.effect("a member who is neither owner nor Storyteller is refused, sheet untouched", () =>
    Effect.gen(function* () {
      const store = seed({ userId: OTHER_PLAYER })

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 5,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.sheets.get(CHARACTER)!.wisdom).toBe(7)
    }),
  )

  it.effect("an empty mark, a track of the wrong length, and a Wisdom off the rank are refused", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      const empty = yield* markSheet({ sessionId: SESSION, characterId: CHARACTER }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )
      expect(failureTag(empty)).toBe("InvalidHandEdit")

      const short = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: twoLethal.slice(0, 3),
      }).pipe(Effect.provide(store.layer), Effect.exit)
      expect(failureTag(short)).toBe("InvalidHandEdit")

      const off = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        wisdom: 11,
      }).pipe(Effect.provide(store.layer), Effect.exit)
      expect(failureTag(off)).toBe("InvalidHandEdit")

      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a Resistant dot under an empty box collapses at the door (#118)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: [
          { severity: "empty", resistant: true },
          ...twoLethal.slice(1).map((box) => ({ ...box })),
        ],
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack[0]!.resistant).toBe(false)
    }),
  )
})

// The purse mark (MAG-67): the player refills Destiny, Willpower and Mana by
// their own hand, through the same door as the track and Wisdom.
describe("Flows.handEdit.markSheet: the purse mark (MAG-67)", () => {
  const withDestiny = (destinyCurrent: number) =>
    makeInMemory({
      members: [aldous, briar, stella],
      actor: { userId: PLAYER, isDev: false },
      sheets: [makeSheet({ merits: [{ name: "Destiny", dots: 2 }], destinyCurrent })],
    })

  it.effect("the owning Player refills their Destiny: applied, no Override, the Chronicle names the purse", () =>
    Effect.gen(function* () {
      const store = withDestiny(1)

      yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, destinyCurrent: 4 }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.sheets.get(CHARACTER)!.destiny).toBe(4)
      expect(store.sheetPatches).toEqual([{ characterId: CHARACTER, patch: { destinyCurrent: 4 } }])
      const entry = store.messages[0]!
      expect(entry.override).toBeNull()
      expect(entry.text).toBe("Aldous marked Aldous: Destiny 1 → 4")
    }),
  )

  it.effect("a purse never fills past its capacity — Destiny •• holds four, Willpower its rating, Mana its Gnosis cap", () =>
    Effect.gen(function* () {
      const store = withDestiny(1)

      const destiny = yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, destinyCurrent: 5 }).pipe(
        Effect.provide(store.layer), Effect.flip,
      )
      expect(destiny.message).toBe("Destiny holds at most 4.")
      // Aldous: Resolve 2 + Composure 3 + 1 (Moros) = Willpower 6; Gnosis 1 = Mana 10
      const will = yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, willpowerCurrent: 7 }).pipe(
        Effect.provide(store.layer), Effect.flip,
      )
      expect(will.message).toBe("Willpower holds at most 6.")
      const mana = yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, manaCurrent: 11 }).pipe(
        Effect.provide(store.layer), Effect.flip,
      )
      expect(mana.message).toBe("Mana holds at most 10.")
      expect(store.sheetPatches).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("Willpower and Mana take the same mark, in one Chronicle line", () =>
    Effect.gen(function* () {
      const store = makeInMemory({
        members: [aldous, briar, stella],
        actor: { userId: PLAYER, isDev: false },
        sheets: [makeSheet({ willpowerCurrent: 2, manaCurrent: 3 })],
      })

      yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, willpowerCurrent: 6, manaCurrent: 10 }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(6)
      expect(store.sheets.get(CHARACTER)!.manaCurrent).toBe(10)
      expect(store.messages[0]!.text).toBe("Aldous marked Aldous: Mana 3 → 10, Willpower 2 → 6")
    }),
  )

  it.effect("a sheet without the Destiny Merit has no purse to mark", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      const err = yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, destinyCurrent: 1 }).pipe(
        Effect.provide(store.layer), Effect.flip,
      )
      expect(err.message).toBe("Destiny holds at most 0.")
    }),
  )
})

describe("Flows.handEdit.setMagicalTool (issue #107)", () => {
  it.effect("the owner flips their standing tool fact plainly — a quiet write", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      yield* setMagicalTool({
        sessionId: SESSION,
        characterId: CHARACTER,
        hasMagicalTool: true,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.magicalTool).toBe(true)
      expect(store.messages).toHaveLength(0) // a sheet fact, not a reveal

      yield* setMagicalTool({
        sessionId: SESSION,
        characterId: CHARACTER,
        hasMagicalTool: false,
      }).pipe(Effect.provide(store.layer))
      expect(store.sheets.get(CHARACTER)!.magicalTool).toBe(false)
    }),
  )

  it.effect("another player is refused — the fact is the owner's", () =>
    Effect.gen(function* () {
      const store = seed({ userId: OTHER_PLAYER })

      const exit = yield* setMagicalTool({
        sessionId: SESSION,
        characterId: CHARACTER,
        hasMagicalTool: true,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotYourCharacter")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("the Storyteller may flip it in the owner's stead (the authority ladder)", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* setMagicalTool({
        sessionId: SESSION,
        characterId: CHARACTER,
        hasMagicalTool: true,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.magicalTool).toBe(true)
    }),
  )
})

/**
 * The derangement marks (MAG-60): the player takes one by its cause and the
 * flow works out what it hangs from — the dot one above Wisdom now, or the
 * Bedlam clock: the open Scene at Wisdom 5+, an expiry from the Wisdom
 * table below. Shedding is the mark in reverse; a bought-back dot sheds
 * its own.
 */
describe("Flows.handEdit.markSheet — derangements (MAG-60)", () => {
  const openScene = {
    id: SceneId.make("scene-1"),
    sessionId: SESSION,
    name: "The Archive",
    status: "active" as const,
    witnessCount: 0,
    circumstances: [],
    openedAt: 0,
  }
  const seedWith = (sheet: ReturnType<typeof makeSheet>, scenes: ReadonlyArray<typeof openScene> = []) =>
    makeInMemory({
      members: [aldous, briar, stella],
      actor: { userId: PLAYER, isDev: false },
      sheets: [sheet],
      scenes,
    })

  it.effect("a permanent one hangs from the dot one above Wisdom now", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet({ wisdom: 6 }))

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Phobia", cause: "lostDot" },
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.derangementsHeld).toEqual([
        { name: "Phobia", hold: { _tag: "lostDot", rank: 7 } },
      ])
      expect(store.messages[0]!.text).toContain("Derangements none → Phobia (dot 7)")
    }),
  )

  it.effect("at Wisdom 10 there is no lost dot to hang one from", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet({ wisdom: 10 }))

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Phobia", cause: "lostDot" },
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("a Bedlam one at Wisdom 7 binds to the open Scene", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet(), [openScene])

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Depression", cause: "bedlam" },
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.derangementsHeld).toEqual([
        { name: "Depression", hold: { _tag: "scene", sceneId: "scene-1" } },
      ])
      expect(store.messages[0]!.text).toContain("Depression (Bedlam, this scene)")
    }),
  )

  it.effect("a Bedlam one at Wisdom 7 with no Scene open is refused", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet())

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Depression", cause: "bedlam" },
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
    }),
  )

  it.effect("a Bedlam one at Wisdom 2 stamps the table's 24 hours from the clock", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet({ wisdom: 2 }))

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Anxiety", cause: "bedlam" },
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.derangementsHeld).toEqual([
        { name: "Anxiety", hold: { _tag: "until", expiresAt: 24 * 3_600_000 } },
      ])
      expect(store.messages[0]!.text).toContain("Anxiety (Bedlam, 24 hours)")
    }),
  )

  it.effect("one dot carries one derangement: a second name on the same lost dot is refused", () =>
    Effect.gen(function* () {
      const store = seedWith(
        makeSheet({ wisdom: 6, derangements: [{ name: "Phobia", hold: { _tag: "lostDot", rank: 7 } }] }),
      )

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Suspicion", cause: "lostDot" },
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
      expect(store.sheetPatches).toHaveLength(0)
    }),
  )

  it.effect("an unknown name doesn't fit the sheet", () =>
    Effect.gen(function* () {
      const store = seedWith(makeSheet())

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Ennui", cause: "lostDot" },
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("InvalidHandEdit")
    }),
  )

  it.effect("shedding puts one down and leaves the rest; a name not held is refused", () =>
    Effect.gen(function* () {
      const held = [
        { name: "Phobia" as const, hold: { _tag: "lostDot" as const, rank: 7 as const } },
        { name: "Depression" as const, hold: { _tag: "scene" as const, sceneId: "scene-1" } },
      ]
      const store = seedWith(makeSheet({ wisdom: 6, derangements: held }), [openScene])

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        shedDerangement: "Phobia",
      }).pipe(Effect.provide(store.layer))
      expect(store.sheets.get(CHARACTER)!.derangementsHeld.map((d) => d.name)).toEqual(["Depression"])
      expect(store.messages[0]!.text).toContain("Derangements Phobia (dot 7), Depression (Bedlam, this scene) → Depression (Bedlam, this scene)")

      const exit = yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        shedDerangement: "Phobia",
      }).pipe(Effect.provide(store.layer), Effect.exit)
      expect(failureTag(exit)).toBe("InvalidHandEdit")
    }),
  )

  it.effect("a mark writes the list whole: what no longer stands leaves the row with it", () =>
    Effect.gen(function* () {
      const held = [
        { name: "Depression" as const, hold: { _tag: "scene" as const, sceneId: "scene-gone" } },
        { name: "Anxiety" as const, hold: { _tag: "until" as const, expiresAt: 0 } },
      ]
      const store = seedWith(makeSheet({ wisdom: 6, derangements: held }), [openScene])

      yield* markSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        derangement: { name: "Phobia", cause: "lostDot" },
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.derangementsHeld).toEqual([
        { name: "Phobia", hold: { _tag: "lostDot", rank: 7 } },
      ])
    }),
  )

  it.effect("buying the dot back sheds the derangement it carried", () =>
    Effect.gen(function* () {
      const held = [
        { name: "Phobia" as const, hold: { _tag: "lostDot" as const, rank: 7 as const } },
        { name: "Suspicion" as const, hold: { _tag: "lostDot" as const, rank: 6 as const } },
      ]
      const store = seedWith(makeSheet({ wisdom: 5, derangements: held }))

      yield* markSheet({ sessionId: SESSION, characterId: CHARACTER, wisdom: 6 }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.sheets.get(CHARACTER)!.derangementsHeld).toEqual([
        { name: "Phobia", hold: { _tag: "lostDot", rank: 7 } },
      ])
      expect(store.messages[0]!.text).toContain("Wisdom 5 → 6, Derangements Phobia (dot 7), Suspicion (dot 6) → Phobia (dot 7)")
      expect(store.sheetPatches[0]!.patch.derangements).toHaveLength(1)
    }),
  )
})
