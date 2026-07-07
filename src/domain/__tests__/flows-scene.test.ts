import { Effect } from "effect"
import { describe, expect, it } from "@effect/vitest"
import { closeScene, openScene, setSceneWitnesses } from "../flows/scene"
import { PlayerId, SessionId } from "../ids"
import { Membership } from "../membership"
import { failureTag } from "../testing/fixtures"
import { makeInMemory, type StoredScene } from "../testing/in-memory"
import { SceneId } from "../ids"

/**
 * Flow tests for the Scene lifecycle (issue #42, PRD #39) — the ST-controlled
 * narrative container, asserted at the port boundary through the in-memory
 * adapter. Open/close are Storyteller-authority actions with plain provenance
 * (ADR-0015: no Override — the ST acting as ST bends no rule), each narrated
 * as one system Activity entry. At most one Scene is active per Session; no
 * Scene open is a legal state (downtime), so absence refuses nothing except
 * the flows that need one.
 */

const SESSION = SessionId.make("session-1")
const OTHER_SESSION = SessionId.make("session-2")
const PLAYER = PlayerId.make("user-aldous")
const ST_USER = PlayerId.make("user-stella")
const OUTSIDER = PlayerId.make("user-vagrant")
const DEV_USER = PlayerId.make("user-trevor")

const aldous = new Membership({
  userId: PLAYER,
  sessionId: SESSION,
  role: "player",
  displayName: "Aldous",
})

const stella = new Membership({
  userId: ST_USER,
  sessionId: SESSION,
  role: "storyteller",
  displayName: "Stella",
})

const seed = (
  actor: { userId: PlayerId; isDev?: boolean },
  scenes?: ReadonlyArray<StoredScene>,
) =>
  makeInMemory({
    members: [aldous, stella],
    actor: { userId: actor.userId, isDev: actor.isDev ?? false },
    ...(scenes ? { scenes } : {}),
  })

const activeScene = (overrides?: Partial<StoredScene>): StoredScene => ({
  id: SceneId.make("scene-prior"),
  sessionId: SESSION,
  name: "The Docks",
  status: "active",
  sleeperWitnesses: false,
  openedAt: 0,
  ...overrides,
})

describe("Flows.scene.openScene (issue #42)", () => {
  it.effect("the Storyteller opens a named Scene: active row, plain system entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const sceneId = yield* openScene({
        sessionId: SESSION,
        name: "The Docks",
      }).pipe(Effect.provide(store.layer))

      expect(store.scenes).toHaveLength(1)
      const scene = store.scenes[0]!
      expect(scene.id).toBe(sceneId)
      expect(scene.sessionId).toBe(SESSION)
      expect(scene.name).toBe("The Docks")
      expect(scene.status).toBe("active")
      // Witnesses default quiet — the ST arms the +2 liability deliberately.
      expect(scene.sleeperWitnesses).toBe(false)

      // One system Activity entry, plain provenance (ADR-0015): the ST
      // acting as ST bends no rule, so no Override.
      expect(store.messages).toHaveLength(1)
      const entry = store.messages[0]!
      expect(entry.visibility).toBe("system")
      expect(entry.senderId).toBe(ST_USER)
      expect(entry.text).toContain("Stella")
      expect(entry.text).toContain("The Docks")
      expect(entry.override).toBeNull()
    }),
  )

  it.effect("the Scene name is trimmed before it lands", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* openScene({ sessionId: SESSION, name: "  The Docks  " }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.scenes[0]!.name).toBe("The Docks")
    }),
  )

  it.effect("a blank name is refused InvalidSceneName, zero writes", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* openScene({ sessionId: SESSION, name: "   " }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("InvalidSceneName")
      expect(store.scenes).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("a player is refused NotStoryteller, zero writes", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      const exit = yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.scenes).toHaveLength(0)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("authority precedes validation: a player's blank name is refused NotStoryteller", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER })

      const exit = yield* openScene({ sessionId: SESSION, name: "   " }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      // The refusal names who you are, not what you typed — a non-Storyteller
      // never receives validation feedback for a door that isn't theirs.
      expect(failureTag(exit)).toBe("NotStoryteller")
    }),
  )

  it.effect("a non-member is refused NotAMember", () =>
    Effect.gen(function* () {
      const store = seed({ userId: OUTSIDER })

      const exit = yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotAMember")
      expect(store.scenes).toHaveLength(0)
    }),
  )

  it.effect("a second concurrent open is refused SceneAlreadyOpen, zero writes", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, [activeScene()])

      const exit = yield* openScene({ sessionId: SESSION, name: "The Chantry" }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("SceneAlreadyOpen")
      expect(store.scenes).toHaveLength(1)
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("a closed Scene does not block a new open; another session's active Scene doesn't either", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, [
        activeScene({ id: SceneId.make("scene-a"), status: "closed", closedAt: 5 }),
        activeScene({
          id: SceneId.make("scene-b"),
          sessionId: OTHER_SESSION,
          name: "Elsewhere",
        }),
      ])

      yield* openScene({ sessionId: SESSION, name: "The Chantry" }).pipe(
        Effect.provide(store.layer),
      )

      expect(
        store.scenes.filter((s) => s.sessionId === SESSION && s.status === "active"),
      ).toHaveLength(1)
    }),
  )

  it.effect("a Dev in a player's chair passes with a godmode Override on the entry", () =>
    Effect.gen(function* () {
      const devMember = new Membership({
        userId: DEV_USER,
        sessionId: SESSION,
        role: "player",
        displayName: "Trevor",
      })
      const store = makeInMemory({
        members: [aldous, stella, devMember],
        actor: { userId: DEV_USER, isDev: true },
      })

      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.scenes).toHaveLength(1)
      const entry = store.messages[0]!
      expect(entry.override).not.toBeNull()
      expect(entry.override!.kind).toBe("godmode-action")
    }),
  )
})

describe("Flows.scene.closeScene (issue #42)", () => {
  it.effect("the Storyteller closes the active Scene: status, closedAt, plain system entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, [activeScene()])

      yield* closeScene({ sessionId: SESSION }).pipe(Effect.provide(store.layer))

      const scene = store.scenes[0]!
      expect(scene.status).toBe("closed")
      expect(scene.closedAt).toBeDefined()

      expect(store.messages).toHaveLength(1)
      const entry = store.messages[0]!
      expect(entry.visibility).toBe("system")
      expect(entry.text).toContain("Stella")
      expect(entry.text).toContain("The Docks")
      expect(entry.override).toBeNull()
    }),
  )

  it.effect("no active Scene is refused NoActiveScene", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* closeScene({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NoActiveScene")
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("a player is refused NotStoryteller, the Scene stays open", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER }, [activeScene()])

      const exit = yield* closeScene({ sessionId: SESSION }).pipe(
        Effect.provide(store.layer),
        Effect.exit,
      )

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.scenes[0]!.status).toBe("active")
    }),
  )

  it.effect("the full lifecycle: open, close, open again — each beat its own entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      yield* openScene({ sessionId: SESSION, name: "The Docks" }).pipe(
        Effect.provide(store.layer),
      )
      yield* closeScene({ sessionId: SESSION }).pipe(Effect.provide(store.layer))
      yield* openScene({ sessionId: SESSION, name: "The Chantry" }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.scenes.map((s) => [s.name, s.status])).toEqual([
        ["The Docks", "closed"],
        ["The Chantry", "active"],
      ])
      expect(store.messages).toHaveLength(3)
    }),
  )
})

describe("Flows.scene.setSceneWitnesses (issue #42)", () => {
  it.effect("the Storyteller arms the Sleeper-witnesses default — a quiet write, no entry", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, [activeScene()])

      yield* setSceneWitnesses({ sessionId: SESSION, sleeperWitnesses: true }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.scenes[0]!.sleeperWitnesses).toBe(true)
      // The strip shows the toggle live to everyone; the log narrates
      // dramatic beats, not knob positions (issue #42's acceptance is
      // open/close entries only).
      expect(store.messages).toHaveLength(0)
    }),
  )

  it.effect("the toggle disarms too", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER }, [
        activeScene({ sleeperWitnesses: true }),
      ])

      yield* setSceneWitnesses({ sessionId: SESSION, sleeperWitnesses: false }).pipe(
        Effect.provide(store.layer),
      )

      expect(store.scenes[0]!.sleeperWitnesses).toBe(false)
    }),
  )

  it.effect("no active Scene is refused NoActiveScene", () =>
    Effect.gen(function* () {
      const store = seed({ userId: ST_USER })

      const exit = yield* setSceneWitnesses({
        sessionId: SESSION,
        sleeperWitnesses: true,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NoActiveScene")
    }),
  )

  it.effect("a player is refused NotStoryteller — visible to all, the ST's to change", () =>
    Effect.gen(function* () {
      const store = seed({ userId: PLAYER }, [activeScene()])

      const exit = yield* setSceneWitnesses({
        sessionId: SESSION,
        sleeperWitnesses: true,
      }).pipe(Effect.provide(store.layer), Effect.exit)

      expect(failureTag(exit)).toBe("NotStoryteller")
      expect(store.scenes[0]!.sleeperWitnesses).toBe(false)
    }),
  )
})
