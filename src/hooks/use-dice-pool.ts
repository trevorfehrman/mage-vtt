import { useMachine } from "@xstate/react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import { dicePoolMachine } from "#/machines/dice-pool"
import type { Id } from "../../convex/_generated/dataModel"

export function useDicePool(sessionId: Id<"sessions">) {
  const [snapshot, send] = useMachine(dicePoolMachine)
  const createRoll = useMutation(api.rolls.create)

  const roll = async () => {
    send({ type: "ROLL" })
    try {
      await createRoll({
        sessionId,
        components: snapshot.context.components,
        againThreshold: snapshot.context.againThreshold,
        roteAction: snapshot.context.isRoteAction,
        visibility: snapshot.context.visibility,
      })
      send({ type: "ROLL_COMPLETE" })
    } catch (err) {
      send({
        type: "ROLL_ERROR",
        error: err instanceof Error ? err.message : "Roll failed",
      })
    }
  }

  return {
    state: snapshot.value as string,
    context: snapshot.context,
    addComponent: (component: { type: string; name: string; dots: number }) =>
      send({ type: "ADD_COMPONENT", component }),
    removeComponent: (index: number) =>
      send({ type: "REMOVE_COMPONENT", index }),
    setAgainThreshold: (value: number) =>
      send({ type: "SET_AGAIN_THRESHOLD", value }),
    setRoteAction: (value: boolean) =>
      send({ type: "SET_ROTE_ACTION", value }),
    setVisibility: (value: "public" | "hidden") =>
      send({ type: "SET_VISIBILITY", value }),
    roll,
    reset: () => send({ type: "RESET" }),
  }
}
