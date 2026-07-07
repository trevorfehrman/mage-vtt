import { useMachine } from "@xstate/react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"
import type { PoolComponentInput, PoolComponentType } from "#/domain/dice"
import { dicePoolMachine } from "#/machines/dice-pool"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../convex/_generated/dataModel"

const rollErrorMessage = (err: unknown): string =>
  seamErrorMessage(err, {
    overrides: { NotYourCharacter: "That's not your character's Willpower." },
    fallback: (e) => (e instanceof Error ? e.message : "Roll failed"),
  })

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
        // Anchor the roll to the sheet the pool was built from: attribution
        // follows its owner, Override-marked when that isn't the roller.
        ...(characterId ? { characterId } : {}),
        components: snapshot.context.components,
        againThreshold: snapshot.context.againThreshold,
        roteAction: snapshot.context.isRoteAction,
        visibility: snapshot.context.visibility,
        ...(snapshot.context.spendWillpower && characterId
          ? { willpower: { characterId } }
          : {}),
      })
      send({ type: "ROLL_COMPLETE" })
      // The settled interaction model: a roll consumes the pool and resets it
      // (docs/component-polish.md).
      send({ type: "RESET" })
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
    addComponent: (component: PoolComponentInput) =>
      send({ type: "ADD_COMPONENT", component }),
    removeComponent: (index: number) =>
      send({ type: "REMOVE_COMPONENT", index }),
    toggleComponent: (component: PoolComponentInput) =>
      send({ type: "TOGGLE_COMPONENT", component }),
    isComponentActive: (type: PoolComponentType, name: string): boolean =>
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
