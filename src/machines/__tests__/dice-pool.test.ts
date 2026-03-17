import { describe, test, expect } from "vitest"
import { createActor } from "xstate"
import { dicePoolMachine } from "../dice-pool"

function startMachine() {
  const actor = createActor(dicePoolMachine)
  actor.start()
  return actor
}

describe("dice-pool machine", () => {
  test("starts in idle with empty context", () => {
    const actor = startMachine()
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("idle")
    expect(snap.context.components).toEqual([])
    expect(snap.context.poolSize).toBe(0)
  })

  test("ADD_COMPONENT transitions idle → building", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("building")
    expect(snap.context.components).toHaveLength(1)
    expect(snap.context.poolSize).toBe(3)
  })

  test("multiple ADD_COMPONENT accumulates pool size", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "skill", name: "Brawl", dots: 2 },
    })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("building")
    expect(snap.context.components).toHaveLength(2)
    expect(snap.context.poolSize).toBe(5)
  })

  test("REMOVE_COMPONENT with remaining components stays in building", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "skill", name: "Brawl", dots: 2 },
    })
    actor.send({ type: "REMOVE_COMPONENT", index: 0 })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("building")
    expect(snap.context.components).toHaveLength(1)
    expect(snap.context.poolSize).toBe(2)
  })

  test("REMOVE_COMPONENT removing last component returns to idle", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "REMOVE_COMPONENT", index: 0 })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("idle")
    expect(snap.context.components).toHaveLength(0)
    expect(snap.context.poolSize).toBe(0)
  })

  test("SET_AGAIN_THRESHOLD updates context", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "SET_AGAIN_THRESHOLD", value: 9 })
    expect(actor.getSnapshot().context.againThreshold).toBe(9)
  })

  test("SET_ROTE_ACTION updates context", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "SET_ROTE_ACTION", value: true })
    expect(actor.getSnapshot().context.isRoteAction).toBe(true)
  })

  test("SET_VISIBILITY updates context", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "SET_VISIBILITY", value: "hidden" })
    expect(actor.getSnapshot().context.visibility).toBe("hidden")
  })

  test("ROLL transitions building → rolling", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "ROLL" })
    expect(actor.getSnapshot().value).toBe("rolling")
  })

  test("ROLL_COMPLETE transitions rolling → complete", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "ROLL" })
    actor.send({ type: "ROLL_COMPLETE" })
    expect(actor.getSnapshot().value).toBe("complete")
  })

  test("ROLL_ERROR transitions rolling → building with error", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "ROLL" })
    actor.send({ type: "ROLL_ERROR", error: "Network error" })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("building")
    expect(snap.context.error).toBe("Network error")
  })

  test("RESET from complete returns to idle with clean context", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "ROLL" })
    actor.send({ type: "ROLL_COMPLETE" })
    actor.send({ type: "RESET" })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe("idle")
    expect(snap.context.components).toEqual([])
    expect(snap.context.poolSize).toBe(0)
    expect(snap.context.againThreshold).toBe(10)
    expect(snap.context.isRoteAction).toBe(false)
    expect(snap.context.visibility).toBe("public")
    expect(snap.context.error).toBe(null)
  })

  test("RESET from building returns to idle", () => {
    const actor = startMachine()
    actor.send({
      type: "ADD_COMPONENT",
      component: { type: "attribute", name: "Strength", dots: 3 },
    })
    actor.send({ type: "RESET" })
    expect(actor.getSnapshot().value).toBe("idle")
  })

  test("invalid events are ignored", () => {
    const actor = startMachine()
    // Can't ROLL from idle
    actor.send({ type: "ROLL" })
    expect(actor.getSnapshot().value).toBe("idle")

    // Can't ROLL_COMPLETE from idle
    actor.send({ type: "ROLL_COMPLETE" })
    expect(actor.getSnapshot().value).toBe("idle")
  })
})
