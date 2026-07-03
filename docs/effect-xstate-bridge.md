# Effect ↔ XState Bridge

How XState v5 machines and the Effect domain (`src/domain/`) should interface in
Mage VTT. Research asset for the `effect-xstate-bridge` ticket.

Sources — Sandro Maglione:
- [Getting started with XState and Effect — Audio Player](https://www.sandromaglione.com/articles/getting-started-with-xstate-and-effect-audio-player)
- [State management with XState State Machines and Effect](https://www.sandromaglione.com/newsletter/state-management-with-xstate-state-machines-and-effect)
- [State machines and Actors in XState v5](https://www.sandromaglione.com/articles/state-machines-and-actors-in-xstate-v5)
- repo: [SandroMaglione/getting-started-xstate-and-effect](https://github.com/SandroMaglione/getting-started-xstate-and-effect)

XState v5 actor API confirmed against Context7 (`/statelyai/xstate`).

---

## TL;DR

**XState orchestrates; Effect executes; the actor is the seam.** Machine context
stays plain serializable data — Effects never live in context or `assign`. Every
Effect runs in exactly one place: **inside an actor** (`fromPromise` for async,
`fromCallback` for subscriptions), or via `Effect.runSync` inside a sync action.

But this project has a wrinkle Sandro's articles don't: **it is a multiplayer,
rules-enforcing VTT, so the important Effects (dice, paradox, mana, damage) are
already server-authoritative in Convex.** That splits the bridge into two flavors
(see [Two boundary flavors](#two-boundary-flavors)). Getting this distinction
right is the whole ticket — most of the domain Effect logic must **not** be
lifted into client-side XState actors.

---

## Sandro's pattern (the baseline)

Division of responsibility, straight from the articles:

> "XState allows for a clear separation of business logic and UI. The component
> is only responsible to render the UI and send events."
> "Every machine executes some effects. These effects are triggered by events."

- **XState owns:** state definitions, transitions, event routing, orchestration.
- **Effect owns:** side-effect implementation, typed success/error, execution.

Concretely, in the audio-player repo:

1. Each machine action/actor is a **standalone Effect-returning function** in a
   separate `effect.ts` file — never inlined into the machine:
   ```ts
   export const onLoad = ({...}): Effect.Effect<OnLoadSuccess, OnLoadError> => // ...
   ```
2. **Sync** side effects run inline in the action via `Effect.runSync`:
   ```ts
   onPause: ({ context: { audioRef } }) => onPause({ audioRef }).pipe(Effect.runSync)
   ```
3. **Typed errors are caught before crossing back into the machine** —
   `Effect.catchTag("OnLoadError", ...)` — and converted to plain events
   (`self.send({ type: "error" })`). The machine only ever sees events, never a
   raw Effect failure.

**Gap in the articles:** they use bare `Effect.runSync`/`runPromise` with no
services. They never wire a `Layer`/`Runtime`. For anything needing a service
(Convex client, seeded `Random`, telemetry) we must supply our own runtime — see
[Providing services](#providing-services-the-part-sandro-skips).

---

## Async actors: the `fromPromise` shape

For async work, XState v5 derives an actor from a Promise with `fromPromise`, and
an Effect becomes that Promise via `Effect.runPromise`:

```ts
const machine = setup({
  types: { context: {} as Ctx, events: {} as Ev },
  actors: {
    // Effect → Promise → actor
    roll: fromPromise<DiceRollResult, RollInput>(({ input }) =>
      Effect.runPromise(rollPool(input.pool, input.options)),
    ),
  },
}).createMachine({
  states: {
    rolling: {
      invoke: {
        src: "roll",
        input: ({ context }) => ({ pool: context.pool, options: context.options }),
        onDone: { target: "complete", actions: assign(({ event }) => ({ result: event.output })) },
        onError: { target: "building", actions: assign(({ event }) => ({ error: String(event.error) })) },
      },
    },
  },
})
```

Key points:
- `input: ({ context }) => ...` reads context **at invoke time** — the idiomatic
  way to feed the machine's state into the Effect.
- `onDone` → `event.output` is the Effect's success value; `onError` →
  `event.error` is the failure. The `rolling`/`complete`/`error` lifecycle is
  driven by the **actor**, not by hand-sent events.
- `fromCallback` is the analog for **long-lived subscriptions** (a Convex live
  query, remote cursors on the whiteboard) — it can `sendBack` events over time
  and returns a cleanup function.

---

## Two boundary flavors

The critical adaptation for this codebase. Not every Effect should run in a
client actor.

### A. Server-authoritative Effects — stay in Convex

The dice roll, paradox accrual, mana spend, and damage application **must not be
computed on the client** — a multiplayer rules engine can't trust a client to
roll its own dice (`app-capabilities.md`: "rules-enforcing engine",
server-side enforcement). These Effects already run server-side today:

```
convex/rolls.ts → runConvexEffect(buildPool(...)) → runConvexEffect(rollPool(...))
```

via the existing bridge `convex/lib/effect.ts` (`runConvexEffect`: `Effect →
Promise<A>`, typed failures → `ConvexError`, defects → thrown). **This bridge
stays and is the correct pattern.** For these, the client machine's actor wraps
the **Convex mutation call**, not the domain Effect:

```ts
actors: {
  submitRoll: fromPromise(({ input }) => convexClient.mutation(api.rolls.create, input)),
}
```

The Effect executes on the server; the actor just awaits the round-trip and maps
`onDone`/`onError` to machine states. This is the shape `use-dice-pool.ts`
already implements imperatively — it should become an invoked actor (see
[Applying it](#applying-it)), but the roll logic does **not** move client-side.

### B. Client-local Effects — Sandro's pattern directly

Effects that are purely local and non-authoritative can run in a client actor via
`Effect.runPromise`/`runSync`:
- **Local pre-validation** — e.g. `buildPool` (fails with `InvalidPoolComponent`)
  run client-side for instant feedback *before* the authoritative server roll.
- **Canvas geometry**, tool-state derivations, optimistic tick previews.

The dividing test: **would a malicious client corrupt shared game state?**
Yes → flavor A (Convex). No → flavor B is fine.

> Note: plain sync arithmetic (`calcPoolSize`, `toggleComponent` in the current
> machine) is **neither** — it's just functions called inside `assign`. Don't
> wrap trivial pure math in Effect; reserve Effect for typed-error or
> service-bearing logic.

---

## Providing services (the part Sandro skips)

Bare `Effect.runPromise(effect)` only works when `effect`'s requirement channel is
`never`. For flavor-B actors that need services (a seeded `Random` for
deterministic previews, a telemetry service, a Convex client handle), build a
`ManagedRuntime` once at module scope and run through it inside the actor:

```ts
const runtime = ManagedRuntime.make(Layer.mergeAll(RandomLive, TelemetryLive))

actors: {
  preview: fromPromise(({ input }) => runtime.runPromise(buildPool(input.components))),
}
```

Module-level per CLAUDE.md ("store parameterized layers in module-level
constants; memoization is by reference"). `Effect.provide` goes once, here at the
runtime — not per call. Server-authoritative Effects don't need this on the
client; their layers live in the Convex runtime.

---

## Machine hygiene (holds for all three machines)

- **Context is plain serializable data only** — the current `dicePoolMachine`
  already does this (no Effects in context). Keep it that way for devtools,
  persistence, and Convex sync.
- **Effects run only in actors/actions, never in guards or `assign`.** Guards
  stay synchronous predicates.
- **Typed errors are mapped to events/`onError` at the seam.** The machine's
  event union is the contract; a domain `TaggedError` never leaks past the actor.
- **Effect functions live in `src/domain/`** (already true); the machine imports
  them. One-way dependency: machine → domain, never domain → machine.

---

## Applying it to the three machines

### `dice-pool` (exists — `src/machines/dice-pool.ts`)
Today it's a **pure UI machine** (zero Effect) and the roll is fired imperatively
in `use-dice-pool.ts`:
```ts
send({ type: "ROLL" }); await createRoll({...snapshot.context...}); send({ type: "ROLL_COMPLETE" })
```
Recommended change (mechanical, low-risk): replace the imperative try/catch with
an **invoked flavor-A actor** wrapping `api.rolls.create`, using
`input: ({ context }) => ...` and `onDone`/`onError`. This deletes the
`ROLL_COMPLETE`/`ROLL_ERROR` events, drives `rolling → complete`/`building` from
the actor lifecycle, and removes the stale-`snapshot.context`-after-`send` read
in the hook. **The roll Effect stays in Convex.** Optionally add a flavor-B
`buildPool` validation actor for instant client-side pool feedback.

### `initiative` (planned — ADR-0001, Tick-based)
- **Roll 1d10 + Dex + Composure** → server-authoritative (flavor A, Convex),
  same as dice.
- **Tick decrement, action costs, tie-break (Wits > Dex > Composure > Willpower
  > coin flip)** → pure domain logic; belongs in `src/domain/initiative.ts`
  (already exists). The machine orchestrates turn flow (whose tick is 0, action
  selection, advancing the timeline) and calls the domain via flavor-B
  actors/sync actions. The coin-flip tiebreak needs `Random` → use the
  `ManagedRuntime` from [Providing services](#providing-services-the-part-sandro-skips)
  with a seeded layer for deterministic tests (`Random.withSeed`).

### `canvas` / whiteboard tools (planned — `whiteboard-tools.md`)
- **Tool selection, in-progress drag/draw** → pure client UI machine; little or
  no Effect (flavor B at most, for geometry).
- **Persistence + real-time sync** (fully collaborative, last-write-wins) →
  Convex. Incoming remote updates (other cursors, element changes) are a
  **`fromCallback` actor** wrapping the Convex live subscription, `sendBack`-ing
  events into the machine. Outgoing edits → flavor-A mutations.

---

## Recommendation

1. Adopt Sandro's separation as the house rule: **machine = orchestration, domain
   Effect = execution, actor = seam**; context stays plain data; errors map to
   events at the seam.
2. **Keep authoritative Effects server-side in Convex** (`runConvexEffect`) — do
   not lift dice/paradox/mana/damage into client actors. Client actors wrap the
   *mutation*, not the domain Effect.
3. Use `fromPromise` for request/response (rolls, saves), `fromCallback` for
   Convex live subscriptions (whiteboard sync, presence).
4. For client-local Effects that need services, run through a module-level
   `ManagedRuntime` — the one thing Sandro's intro articles omit.
5. First concrete step (deferred to `/implement`): refactor `use-dice-pool.ts`
   from the imperative roll to an invoked actor. Low-risk, guarded by the
   existing `dice-pool.test.ts` + the 180-test domain suite.
