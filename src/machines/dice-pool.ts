import { assign, setup } from "xstate"

export interface PoolComponentInput {
  type: string
  name: string
  dots: number
}

interface DicePoolContext {
  components: PoolComponentInput[]
  poolSize: number
  againThreshold: number
  isRoteAction: boolean
  visibility: "public" | "hidden"
  error: string | null
}

type DicePoolEvent =
  | { type: "ADD_COMPONENT"; component: PoolComponentInput }
  | { type: "REMOVE_COMPONENT"; index: number }
  | { type: "SET_AGAIN_THRESHOLD"; value: number }
  | { type: "SET_ROTE_ACTION"; value: boolean }
  | { type: "SET_VISIBILITY"; value: "public" | "hidden" }
  | { type: "ROLL" }
  | { type: "ROLL_COMPLETE" }
  | { type: "ROLL_ERROR"; error: string }
  | { type: "RESET" }

function calcPoolSize(components: PoolComponentInput[]): number {
  return components.reduce((sum, c) => sum + c.dots, 0)
}

export const dicePoolMachine = setup({
  types: {
    context: {} as DicePoolContext,
    events: {} as DicePoolEvent,
  },
}).createMachine({
  id: "dicePool",
  initial: "idle",
  context: {
    components: [],
    poolSize: 0,
    againThreshold: 10,
    isRoteAction: false,
    visibility: "public",
    error: null,
  },
  states: {
    idle: {
      on: {
        ADD_COMPONENT: {
          target: "building",
          actions: assign({
            components: ({ context, event }) => [
              ...context.components,
              event.component,
            ],
            poolSize: ({ context, event }) =>
              calcPoolSize([...context.components, event.component]),
            error: null,
          }),
        },
      },
    },
    building: {
      on: {
        ADD_COMPONENT: {
          actions: assign({
            components: ({ context, event }) => [
              ...context.components,
              event.component,
            ],
            poolSize: ({ context, event }) =>
              calcPoolSize([...context.components, event.component]),
          }),
        },
        REMOVE_COMPONENT: [
          {
            guard: ({ context, event }) => {
              const next = context.components.filter(
                (_, i) => i !== event.index,
              )
              return next.length === 0
            },
            target: "idle",
            actions: assign({
              components: () => [],
              poolSize: 0,
            }),
          },
          {
            actions: assign({
              components: ({ context, event }) =>
                context.components.filter((_, i) => i !== event.index),
              poolSize: ({ context, event }) =>
                calcPoolSize(
                  context.components.filter((_, i) => i !== event.index),
                ),
            }),
          },
        ],
        SET_AGAIN_THRESHOLD: {
          actions: assign({
            againThreshold: ({ event }) => event.value,
          }),
        },
        SET_ROTE_ACTION: {
          actions: assign({
            isRoteAction: ({ event }) => event.value,
          }),
        },
        SET_VISIBILITY: {
          actions: assign({
            visibility: ({ event }) => event.value,
          }),
        },
        ROLL: "rolling",
        RESET: "idle",
      },
    },
    rolling: {
      on: {
        ROLL_COMPLETE: "complete",
        ROLL_ERROR: {
          target: "building",
          actions: assign({
            error: ({ event }) => event.error,
          }),
        },
      },
    },
    complete: {
      on: {
        RESET: {
          target: "idle",
          actions: assign({
            components: () => [],
            poolSize: 0,
            againThreshold: 10,
            isRoteAction: false,
            visibility: () => "public" as const,
            error: null,
          }),
        },
      },
    },
  },
})
