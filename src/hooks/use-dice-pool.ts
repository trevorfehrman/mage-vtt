import { useMachine } from "@xstate/react"
import { useMutation } from "convex/react"
import { ConvexError } from "convex/values"
import { api } from "../../convex/_generated/api"
import { dicePoolMachine } from "#/machines/dice-pool"
import type { Id } from "../../convex/_generated/dataModel"

/** Map the seam's tagged errors (ADR-0010) to readable messages. */
function rollErrorMessage(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === "object" && err.data !== null) {
    const data = err.data as Record<string, unknown>
    switch (data._tag) {
      case "InsufficientWillpower":
        return "No Willpower left to spend."
      case "NotYourCharacter":
        return "That's not your character's Willpower."
      case "NotAMember":
        return "You're not a member of this session."
    }
  }
  return err instanceof Error ? err.message : "Roll failed"
}

export function useDicePool(
  sessionId: Id<"sessions">,
  characterId?: Id<"characters">,
) {
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
        ...(snapshot.context.spendWillpower && characterId
          ? { willpower: { characterId } }
          : {}),
      })
      send({ type: "ROLL_COMPLETE" })
    } catch (err) {
      send({
        type: "ROLL_ERROR",
        error: rollErrorMessage(err),
      })
    }
  }

  return {
    state: snapshot.value as string,
    context: snapshot.context,
    /** Willpower spends need a sheet to fund them. */
    canSpendWillpower: characterId !== undefined,
    addComponent: (component: { type: string; name: string; dots: number }) =>
      send({ type: "ADD_COMPONENT", component }),
    removeComponent: (index: number) =>
      send({ type: "REMOVE_COMPONENT", index }),
    toggleComponent: (component: { type: string; name: string; dots: number }) =>
      send({ type: "TOGGLE_COMPONENT", component }),
    isComponentActive: (type: string, name: string): boolean =>
      snapshot.context.components.some(
        (c) => c.type === type && c.name === name,
      ),
    setAgainThreshold: (value: number) =>
      send({ type: "SET_AGAIN_THRESHOLD", value }),
    setRoteAction: (value: boolean) =>
      send({ type: "SET_ROTE_ACTION", value }),
    setSpendWillpower: (value: boolean) =>
      send({ type: "SET_SPEND_WILLPOWER", value }),
    setVisibility: (value: "public" | "hidden") =>
      send({ type: "SET_VISIBILITY", value }),
    roll,
    reset: () => send({ type: "RESET" }),
  }
}
