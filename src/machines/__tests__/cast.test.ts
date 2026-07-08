import { describe, test, expect } from "@effect/vitest"
import { createActor, fromPromise, waitFor } from "xstate"
import {
  buildDraftSubmission,
  buildSubmission,
  castMachine,
  type CastSubmission,
  type DraftSubmission,
} from "../cast"
import { KnownRote } from "#/domain/character"
import { RotePool } from "#/domain/rote-pool"

const graveMien = new KnownRote({
  name: "Grave Mien",
  spellName: "Speak with the Dead",
  spellArcanum: "Death",
  spellLevel: 2,
  order: "Mysterium",
  pool: new RotePool({ attribute: "Presence", skills: ["Occult"], arcanum: "Death" }),
})

const orPoolRote = new KnownRote({
  name: "Witnessed Ward",
  spellName: "Ectoplasmic Shaping",
  spellArcanum: "Death",
  spellLevel: 1,
  order: "Mysterium",
  pool: new RotePool({
    attribute: "Wits",
    skills: ["Investigation", "Occult"],
    arcanum: "Death",
  }),
})

function startMachine(
  submit?: (input: CastSubmission) => Promise<void>,
  draft?: (input: DraftSubmission) => Promise<void>,
) {
  const machine =
    submit || draft
      ? castMachine.provide({
          actors: {
            ...(submit
              ? { submitCast: fromPromise(({ input }) => submit(input)) }
              : {}),
            ...(draft
              ? { submitDraft: fromPromise(({ input }) => draft(input)) }
              : {}),
          },
        })
      : castMachine
  const actor = createActor(machine)
  actor.start()
  return actor
}

describe("cast machine", () => {
  test("starts idle with no selection", () => {
    const actor = startMachine()
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("idle")
    expect(snap.context.selection).toBeNull()
  })

  test("ARM_IMPROVISED transitions idle → declaring with level 1 and default factors", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("declaring")
    expect(snap.context.selection).toEqual({
      method: "improvised",
      arcanum: "death",
      dots: 3,
    })
    expect(snap.context.level).toBe(1)
    expect(snap.context.potency).toBe(1)
    expect(snap.context.targets).toBe(1)
    expect(snap.context.highSpeech).toBe(false)
    expect(snap.context.extraMana).toBe(0)
    expect(snap.context.spendWillpower).toBe(false)
    expect(snap.context.visibility).toBe("public")
  })

  test("ARM_ROTE auto-picks the skill of a single-skill pool", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_ROTE", rote: graveMien })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("declaring")
    expect(snap.context.selection).toEqual({ method: "rote", rote: graveMien })
    expect(snap.context.skillChoice).toBe("Occult")
  })

  test("an 'or'-pool Rote cannot CAST until a skill is picked", () => {
    // A submit that stays in flight, so the casting state is observable.
    const actor = startMachine(() => new Promise(() => {}))
    actor.send({ type: "ARM_ROTE", rote: orPoolRote })
    expect(actor.getSnapshot().context.skillChoice).toBeNull()

    actor.send({ type: "CAST" })
    expect(actor.getSnapshot().value).toBe("declaring") // guard refused

    actor.send({ type: "SET_SKILL_CHOICE", value: "Investigation" })
    actor.send({ type: "CAST" })
    expect(actor.getSnapshot().value).toBe("casting")
  })

  test("re-arming from declaring resets the declared factors", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_POTENCY", value: 4 })
    actor.send({ type: "SET_HIGH_SPEECH", value: true })

    actor.send({ type: "ARM_ROTE", rote: graveMien })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("declaring")
    expect(snap.context.potency).toBe(1)
    expect(snap.context.highSpeech).toBe(false)
  })

  test("SET_LEVEL clamps to the armed Arcanum's dots", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_LEVEL", value: 5 })
    expect(actor.getSnapshot().context.level).toBe(3)
    actor.send({ type: "SET_LEVEL", value: 0 })
    expect(actor.getSnapshot().context.level).toBe(1)
  })

  test("factor setters clamp at their floors", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_POTENCY", value: 0 })
    actor.send({ type: "SET_TARGETS", value: -2 })
    actor.send({ type: "SET_EXTRA_MANA", value: -1 })
    const snap = actor.getSnapshot()
    expect(snap.context.potency).toBe(1)
    expect(snap.context.targets).toBe(1)
    expect(snap.context.extraMana).toBe(0)
  })

  test("CANCEL returns to idle with a clean context", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_POTENCY", value: 3 })
    actor.send({ type: "CANCEL" })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("idle")
    expect(snap.context.selection).toBeNull()
    expect(snap.context.potency).toBe(1)
  })

  test("a successful submit lands back in idle, disarmed", async () => {
    const submitted: CastSubmission[] = []
    const actor = startMachine(async (input) => {
      submitted.push(input)
    })
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_LEVEL", value: 2 })
    actor.send({ type: "CAST" })

    await waitFor(actor, (s) => s.matches("idle"))
    expect(actor.getSnapshot().context.selection).toBeNull()
    expect(submitted).toEqual([
      { method: "improvised", arcanum: "death", level: 2 },
    ])
  })

  test("a refused submit returns to declaring with the typed error, declaration intact", async () => {
    // The hook's actor throws a CastError (issue #36): the seam's tag rides
    // into context so UI can dispatch on the refusal, not just print it.
    const actor = startMachine(async () => {
      throw { tag: "InsufficientMana", message: "Not enough Mana: need 2, have 0." }
    })
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "SET_EXTRA_MANA", value: 2 })
    actor.send({ type: "CAST" })

    await waitFor(actor, (s) => s.matches("declaring"))
    const snap = actor.getSnapshot()
    expect(snap.context.error).toEqual({
      tag: "InsufficientMana",
      message: "Not enough Mana: need 2, have 0.",
    })
    expect(snap.context.extraMana).toBe(2) // fix the declaration, not retype it
  })

  test("re-arming resets the vulgar declaration's extras (issue #69's bug)", () => {
    // Intent typed for spell A must not ride into spell B's draft.
    const actor = startMachine()
    actor.send({ type: "ARM_ROTE", rote: graveMien })
    actor.send({ type: "SET_INTENT", value: "melt the lock" })
    actor.send({ type: "SET_USES_MAGICAL_TOOL", value: true })

    actor.send({ type: "ARM_ROTE", rote: orPoolRote })
    const snap = actor.getSnapshot()
    expect(snap.context.intent).toBe("")
    expect(snap.context.usesMagicalTool).toBe(false)
  })

  test("an 'or'-pool Rote cannot DRAFT_VULGAR until a skill is picked", () => {
    const actor = startMachine(undefined, () => new Promise(() => {}))
    actor.send({ type: "ARM_ROTE", rote: orPoolRote })

    actor.send({ type: "DRAFT_VULGAR" })
    expect(actor.getSnapshot().value).toBe("declaring") // guard refused

    actor.send({ type: "SET_SKILL_CHOICE", value: "Occult" })
    actor.send({ type: "DRAFT_VULGAR" })
    expect(actor.getSnapshot().value).toBe("drafting")
  })

  test("a successful draft stands down to idle — the Cast card takes over", async () => {
    const drafted: DraftSubmission[] = []
    const actor = startMachine(undefined, async (input) => {
      drafted.push(input)
    })
    actor.send({ type: "ARM_ROTE", rote: graveMien })
    actor.send({ type: "SET_INTENT", value: "  melt the lock  " })
    actor.send({ type: "SET_USES_MAGICAL_TOOL", value: true })
    actor.send({ type: "DRAFT_VULGAR" })

    await waitFor(actor, (s) => s.matches("idle"))
    expect(actor.getSnapshot().context.selection).toBeNull()
    expect(drafted).toEqual([
      {
        method: "rote",
        roteName: "Grave Mien",
        skillChoice: "Occult",
        intent: "melt the lock",
        usesMagicalTool: true,
      },
    ])
  })

  test("a refused draft returns to declaring with the typed error, declaration intact", async () => {
    const actor = startMachine(undefined, async () => {
      throw {
        tag: "SpellNotVulgar",
        message: "Speak with the Dead is Covert — cast it directly; the ladder is for Vulgar magic.",
      }
    })
    actor.send({ type: "ARM_ROTE", rote: graveMien })
    actor.send({ type: "SET_INTENT", value: "melt the lock" })
    actor.send({ type: "DRAFT_VULGAR" })

    await waitFor(actor, (s) => s.matches("declaring"))
    const snap = actor.getSnapshot()
    expect(snap.context.error?.tag).toBe("SpellNotVulgar")
    expect(snap.context.intent).toBe("melt the lock") // fix, don't retype
  })

  test("a non-seam failure lands as prose without a tag", async () => {
    const actor = startMachine(async () => {
      throw new Error("Network hiccup.")
    })
    actor.send({ type: "ARM_IMPROVISED", arcanum: "death", dots: 3 })
    actor.send({ type: "CAST" })

    await waitFor(actor, (s) => s.matches("declaring"))
    expect(actor.getSnapshot().context.error).toEqual({
      tag: null,
      message: "Network hiccup.",
    })
  })
})

describe("buildDraftSubmission", () => {
  test("improvised: arcanum and level ride; blank extras stay off the wire", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "forces", dots: 2 })
    actor.send({ type: "SET_LEVEL", value: 2 })
    expect(buildDraftSubmission(actor.getSnapshot().context)).toEqual({
      method: "improvised",
      arcanum: "forces",
      level: 2,
    })
  })

  test("whitespace-only intent stays off the wire", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_ROTE", rote: graveMien })
    actor.send({ type: "SET_INTENT", value: "   " })
    expect(buildDraftSubmission(actor.getSnapshot().context)).toEqual({
      method: "rote",
      roteName: "Grave Mien",
      skillChoice: "Occult",
    })
  })
})

describe("buildSubmission", () => {
  test("improvised: inactive factors stay off the wire", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_IMPROVISED", arcanum: "prime", dots: 1 })
    expect(buildSubmission(actor.getSnapshot().context)).toEqual({
      method: "improvised",
      arcanum: "prime",
      level: 1,
    })
  })

  test("rote: carries the pick and only the declared factors", () => {
    const actor = startMachine()
    actor.send({ type: "ARM_ROTE", rote: orPoolRote })
    actor.send({ type: "SET_SKILL_CHOICE", value: "Occult" })
    actor.send({ type: "SET_POTENCY", value: 3 })
    actor.send({ type: "SET_SPEND_WILLPOWER", value: true })
    actor.send({ type: "SET_VISIBILITY", value: "hidden" })
    expect(buildSubmission(actor.getSnapshot().context)).toEqual({
      method: "rote",
      roteName: "Witnessed Ward",
      skillChoice: "Occult",
      potency: 3,
      spendWillpower: true,
      visibility: "hidden",
    })
  })
})
