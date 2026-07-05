import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { handEditSheet } from "../flows/hand-edit"
import { CharacterId, PlayerId, SessionId, SessionMemberId } from "../ids"
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
        willpowerCurrent: 7,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(7)
      const entry = store.messages[0]!
      expect(entry.override!.kind).toBe("repair")
      expect(entry.override!.invokedByUserId).toBe(DEV_USER)
      // No membership to draw a display name from — the id is the fallback
      expect(entry.override!.invokedByName).toBe(DEV_USER)
    }),
  )

  it.effect("representability, not game legality: Willpower may exceed the rated maximum", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      // Aldous's Willpower rating is 6; fudging past it is the point
      // (ADR-0011) — the box holds any non-negative integer.
      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        willpowerCurrent: 9,
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.willpowerCurrent).toBe(9)
    }),
  )

  it.effect("the health track is hand-editable and narrated", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* handEditSheet({
        sessionId: SESSION,
        characterId: CHARACTER,
        healthTrack: ["lethal", "bashing", "empty", "empty", "empty", "empty", "empty"],
      }).pipe(Effect.provide(store.layer))

      expect(store.sheets.get(CHARACTER)!.healthTrack).toEqual([
        "lethal",
        "bashing",
        "empty",
        "empty",
        "empty",
        "empty",
        "empty",
      ])
      expect(store.messages[0]!.text).toContain("Health")
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
        healthTrack: ["mangled"],
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
        healthTrack: ["bashing", "empty"], // Aldous has 7 boxes
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
