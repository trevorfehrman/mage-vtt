import { useRef, useState } from "react"
import { useMachine } from "@xstate/react"
import { useMutation } from "convex/react"
import { fromPromise } from "xstate"
import { api } from "../../convex/_generated/api"
import {
  castMachine,
  type CastError,
  type CastSubmission,
  type DraftSubmission,
} from "#/machines/cast"
import { seamFailure } from "#/lib/seam-errors"
import type { ArcanumName, KnownRote } from "#/domain/character"
import type { Id } from "../../convex/_generated/dataModel"

/** A seam refusal keeps its typed tag (issue #36); anything else is prose only. */
const castError = (err: unknown): CastError =>
  seamFailure(err) ?? {
    tag: null,
    message: err instanceof Error ? err.message : "The cast failed.",
  }

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
  const draftCast = useMutation(api.casts.draft)

  // The machine is created once; the actors read through these refs so they
  // always see the current characterId (which arrives after first render) and
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
      throw castError(err)
    }
  }

  // The Vulgar draft (issue #43/#69): one mutation for both routes — the
  // server resolves the Rote's pool and stamps isRote for Paradox pricing.
  const draftRef = useRef<(input: DraftSubmission) => Promise<void>>(null)
  draftRef.current = async (input) => {
    if (!characterId) throw new Error("No character to draft from.")
    try {
      const { method: _, ...args } = input
      await draftCast({ sessionId, characterId, ...args })
    } catch (err) {
      throw castError(err)
    }
  }

  const [machine] = useState(() =>
    castMachine.provide({
      actors: {
        submitCast: fromPromise(({ input }) => submitRef.current!(input)),
        submitDraft: fromPromise(({ input }) => draftRef.current!(input)),
      },
    }),
  )
  const [snapshot, send] = useMachine(machine)

  return {
    state: snapshot.value as "idle" | "declaring" | "casting" | "drafting",
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
    setIntent: (value: string) => send({ type: "SET_INTENT", value }),
    setUsesMagicalTool: (value: boolean) =>
      send({ type: "SET_USES_MAGICAL_TOOL", value }),
    cast: () => send({ type: "CAST" }),
    draftVulgar: () => send({ type: "DRAFT_VULGAR" }),
    cancel: () => send({ type: "CANCEL" }),
  }
}
