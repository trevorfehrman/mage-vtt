import { useRef, useState } from "react"
import { useMachine } from "@xstate/react"
import { useMutation } from "convex/react"
import { fromPromise } from "xstate"
import { api } from "../../convex/_generated/api"
import { castMachine, type CastSubmission } from "#/machines/cast"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { ArcanumName, KnownRote } from "#/domain/character"
import type { Id } from "../../convex/_generated/dataModel"

const castErrorMessage = (err: unknown): string =>
  seamErrorMessage(err, {
    fallback: (e) => (e instanceof Error ? e.message : "The cast failed."),
  })

/**
 * The casting controller (PRD #11, issue #20): wires the cast machine's
 * invoked `submitCast` actor to the Convex mutations — the settled bridge
 * shape (docs/effect-xstate-bridge.md: the actor wraps the mutation; the
 * authoritative Effects stay server-side). Seam errors surface by their
 * typed tag through the shared mapping.
 */
export function useCast(
  sessionId: Id<"sessions">,
  characterId?: Id<"characters">,
) {
  const castSpell = useMutation(api.characters.castSpell)
  const castRote = useMutation(api.characters.castRote)

  // The machine is created once; the actor reads through this ref so it always
  // sees the current characterId (which arrives after first render) and
  // mutation handles.
  const submitRef = useRef<(input: CastSubmission) => Promise<void>>(null)
  submitRef.current = async (input) => {
    if (!characterId) throw new Error("No character to cast from.")
    try {
      if (input.method === "improvised") {
        const { method: _, ...args } = input
        await castSpell({ sessionId, characterId, ...args })
      } else {
        const { method: _, ...args } = input
        await castRote({ sessionId, characterId, ...args })
      }
    } catch (err) {
      throw new Error(castErrorMessage(err))
    }
  }

  const [machine] = useState(() =>
    castMachine.provide({
      actors: {
        submitCast: fromPromise(({ input }) => submitRef.current!(input)),
      },
    }),
  )
  const [snapshot, send] = useMachine(machine)

  return {
    state: snapshot.value as "idle" | "declaring" | "casting",
    context: snapshot.context,
    armRote: (rote: KnownRote) => send({ type: "ARM_ROTE", rote }),
    armImprovised: (arcanum: ArcanumName, dots: number) =>
      send({ type: "ARM_IMPROVISED", arcanum, dots }),
    setLevel: (value: number) => send({ type: "SET_LEVEL", value }),
    setSkillChoice: (value: string) => send({ type: "SET_SKILL_CHOICE", value }),
    setPotency: (value: number) => send({ type: "SET_POTENCY", value }),
    setTargets: (value: number) => send({ type: "SET_TARGETS", value }),
    setHighSpeech: (value: boolean) => send({ type: "SET_HIGH_SPEECH", value }),
    setExtraMana: (value: number) => send({ type: "SET_EXTRA_MANA", value }),
    setSpendWillpower: (value: boolean) =>
      send({ type: "SET_SPEND_WILLPOWER", value }),
    setVisibility: (value: "public" | "hidden") =>
      send({ type: "SET_VISIBILITY", value }),
    cast: () => send({ type: "CAST" }),
    cancel: () => send({ type: "CANCEL" }),
  }
}
