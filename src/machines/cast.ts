import { assertEvent, assign, fromPromise, setup } from "xstate"
import type { ArcanumName, KnownRote } from "#/domain/character"
import type { SeamFailure } from "#/lib/seam-errors"

/**
 * The casting machine (PRD #11, issue #20): sheet-as-controller orchestration
 * for both cast routes. The sheet arms a cast (a Rote entry or an Arcanum
 * row); `declaring` is the shared pre-roll factor panel; `casting` invokes the
 * `submitCast` actor — provided by the hook as a wrapper around the Convex
 * mutation, per the settled XState/Effect bridge (docs/effect-xstate-bridge.md:
 * the actor wraps the *mutation*; the authoritative Effects stay server-side).
 */

export type CastSelection =
  | { method: "improvised"; arcanum: ArcanumName; dots: number }
  | { method: "rote"; rote: KnownRote }

/**
 * A failed cast, typed (issue #36): the seam's tag rides along so downstream
 * UI can dispatch on the refusal, not just print it; `tag: null` marks a
 * non-seam failure (defect, network) carrying only prose.
 */
export interface CastError {
  readonly tag: SeamFailure["tag"] | null
  readonly message: string
}

export interface CastContext {
  selection: CastSelection | null
  /** Improvised only: the declared effect level (its Practice), 1..dots. */
  level: number
  /** Rote only: the picked "or" alternative; auto-set for single-skill pools. */
  skillChoice: string | null
  /** The bought floor (issue #107): Potency beyond 1 and the targets bracket. */
  potency: number
  targets: number
  /** Declared rider Mana — driven from the Mana strip, never a bench dial. */
  extraMana: number
  spendWillpower: boolean
  error: CastError | null
}

type CastEvent =
  | { type: "ARM_IMPROVISED"; arcanum: ArcanumName; dots: number }
  | { type: "ARM_ROTE"; rote: KnownRote }
  | { type: "SET_LEVEL"; value: number }
  | { type: "SET_SKILL_CHOICE"; value: string }
  | { type: "SET_POTENCY"; value: number }
  | { type: "SET_TARGETS"; value: number }
  | { type: "SET_EXTRA_MANA"; value: number }
  | { type: "SET_SPEND_WILLPOWER"; value: boolean }
  | { type: "CAST" }
  | { type: "DRAFT_VULGAR" }
  | { type: "CANCEL" }

/** What the submit actor sends over the wire — the mutation args minus ids.
 * The audit's evictions (issue #107) hold here too: no High Speech, no
 * hidden visibility, no per-cast tool — the sheet and the ST's ebb door own
 * those facts now. */
export type CastSubmission =
  | {
      method: "improvised"
      arcanum: ArcanumName
      level: number
      potency?: number
      targets?: number
      extraManaCost?: number
      spendWillpower?: boolean
    }
  | {
      method: "rote"
      roteName: string
      skillChoice?: string
      potency?: number
      targets?: number
      extraManaCost?: number
      spendWillpower?: boolean
    }

/**
 * The wire shape of a Vulgar draft (issue #43/#66/#69) — `casts.draft`'s args
 * minus ids: the declaration by route, plus the caster's extras when they act.
 * The tool is the sheet's standing fact; the server stamps it (issue #107).
 */
export type DraftSubmission =
  | {
      method: "improvised"
      arcanum: ArcanumName
      level: number
      potency?: number
      targets?: number
      extraManaCost?: number
      spendWillpower?: boolean
    }
  | {
      method: "rote"
      roteName: string
      skillChoice?: string
      potency?: number
      targets?: number
      extraManaCost?: number
      spendWillpower?: boolean
    }

const IDLE_CONTEXT: CastContext = {
  selection: null,
  level: 1,
  skillChoice: null,
  potency: 1,
  targets: 1,
  extraMana: 0,
  spendWillpower: false,
  error: null,
}

/** The submit actors throw a CastError (see use-cast.ts); anything else —
 * e.g. the unprovided-actor guard — is prose without a tag. */
const toCastError = (error: unknown): CastError =>
  typeof error === "object" && error !== null && "tag" in error && "message" in error
    ? (error as CastError)
    : {
        tag: null,
        message: error instanceof Error ? error.message : String(error),
      }

export const castMachine = setup({
  types: {
    context: {} as CastContext,
    events: {} as CastEvent,
  },
  actors: {
    submitCast: fromPromise<void, CastSubmission>(() => {
      throw new Error("submitCast actor must be provided (see use-cast.ts)")
    }),
    submitDraft: fromPromise<void, DraftSubmission>(() => {
      throw new Error("submitDraft actor must be provided (see use-cast.ts)")
    }),
  },
  actions: {
    /** Arming resets every declaration — each cast starts from a clean panel. */
    armImprovised: assign(({ event }) => {
      assertEvent(event, "ARM_IMPROVISED")
      return {
        ...IDLE_CONTEXT,
        selection: {
          method: "improvised" as const,
          arcanum: event.arcanum,
          dots: event.dots,
        },
      }
    }),
    armRote: assign(({ event }) => {
      assertEvent(event, "ARM_ROTE")
      return {
        ...IDLE_CONTEXT,
        selection: { method: "rote" as const, rote: event.rote },
        // A single-skill pool needs no pick; an "or" pool starts unpicked.
        skillChoice:
          event.rote.pool.skills.length === 1 ? event.rote.pool.skills[0] : null,
      }
    }),
  },
  guards: {
    /** An "or"-pool Rote is uncastable until the caster picks a skill. */
    canSubmit: ({ context }) =>
      context.selection !== null &&
      (context.selection.method === "improvised" || context.skillChoice !== null),
  },
}).createMachine({
  id: "cast",
  initial: "idle",
  context: IDLE_CONTEXT,
  states: {
    idle: {
      on: {
        ARM_IMPROVISED: { target: "declaring", actions: "armImprovised" },
        ARM_ROTE: { target: "declaring", actions: "armRote" },
      },
    },
    declaring: {
      on: {
        ARM_IMPROVISED: { actions: "armImprovised" },
        ARM_ROTE: { actions: "armRote" },
        SET_LEVEL: {
          actions: assign({
            level: ({ context, event }) => {
              const max =
                context.selection?.method === "improvised"
                  ? context.selection.dots
                  : 5
              return Math.min(Math.max(1, event.value), max)
            },
          }),
        },
        SET_SKILL_CHOICE: {
          actions: assign({ skillChoice: ({ event }) => event.value }),
        },
        SET_POTENCY: {
          actions: assign({ potency: ({ event }) => Math.max(1, event.value) }),
        },
        SET_TARGETS: {
          actions: assign({ targets: ({ event }) => Math.max(1, event.value) }),
        },
        SET_EXTRA_MANA: {
          actions: assign({ extraMana: ({ event }) => Math.max(0, event.value) }),
        },
        SET_SPEND_WILLPOWER: {
          actions: assign({ spendWillpower: ({ event }) => event.value }),
        },
        CAST: { target: "casting", guard: "canSubmit" },
        DRAFT_VULGAR: { target: "drafting", guard: "canSubmit" },
        CANCEL: { target: "idle", actions: assign(() => IDLE_CONTEXT) },
      },
    },
    casting: {
      invoke: {
        src: "submitCast",
        input: ({ context }: { context: CastContext }) => buildSubmission(context),
        // The result lands in the Activity Log; the panel just stands down.
        onDone: { target: "idle", actions: assign(() => IDLE_CONTEXT) },
        onError: {
          target: "declaring",
          actions: assign({ error: ({ event }) => toCastError(event.error) }),
        },
      },
    },
    drafting: {
      invoke: {
        src: "submitDraft",
        input: ({ context }: { context: CastContext }) =>
          buildDraftSubmission(context),
        // The draft is in the wings; the Cast card takes over (ADR-0016).
        onDone: { target: "idle", actions: assign(() => IDLE_CONTEXT) },
        onError: {
          target: "declaring",
          actions: assign({ error: ({ event }) => toCastError(event.error) }),
        },
      },
    },
  },
})

/**
 * The declared spell factors, present only when they act — one shape shared
 * by the wire submission and the panel's pool preview.
 */
export function declaredFactors(context: CastContext): {
  potency?: number
  targets?: number
  extraManaCost?: number
  spendWillpower?: boolean
} {
  return {
    ...(context.potency > 1 ? { potency: context.potency } : {}),
    ...(context.targets > 1 ? { targets: context.targets } : {}),
    ...(context.extraMana > 0 ? { extraManaCost: context.extraMana } : {}),
    ...(context.spendWillpower ? { spendWillpower: true } : {}),
  }
}

/** The wire shape of a Vulgar draft — the declaration by route, extras only
 * when they act. The
 * Willpower spend precommits at declaration (ADR-0022, WoD p. 133); the
 * bought floor and the rider ride the same way (issue #107). */
export function buildDraftSubmission(context: CastContext): DraftSubmission {
  if (context.selection === null) {
    throw new Error("Cannot build a draft submission with nothing armed")
  }
  const extras = declaredFactors(context)
  if (context.selection.method === "improvised") {
    return {
      method: "improvised",
      arcanum: context.selection.arcanum,
      level: context.level,
      ...extras,
    }
  }
  return {
    method: "rote",
    roteName: context.selection.rote.name,
    ...(context.skillChoice !== null ? { skillChoice: context.skillChoice } : {}),
    ...extras,
  }
}

/** The wire shape of the declaration — optional factors only when they act. */
export function buildSubmission(context: CastContext): CastSubmission {
  if (context.selection === null) {
    throw new Error("Cannot build a cast submission with nothing armed")
  }
  const factors = declaredFactors(context)
  if (context.selection.method === "improvised") {
    return {
      method: "improvised",
      arcanum: context.selection.arcanum,
      level: context.level,
      ...factors,
    }
  }
  return {
    method: "rote",
    roteName: context.selection.rote.name,
    ...(context.skillChoice !== null ? { skillChoice: context.skillChoice } : {}),
    ...factors,
  }
}
