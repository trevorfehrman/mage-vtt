# Convex is the Effect↔XState bridge; the client stays Effect-as-library

Effect (the rules engine, `src/domain/`) runs **server-side**; XState (the UI
projection) runs **client-side**; the two never meet in-process. **Convex is the
bridge between them** — across the network boundary, not inside a runtime. The
client machines' async actors wrap **Convex mutations**, never `Effect.runPromise`
(`use-cast.ts`: `submitCast`/`submitDraft` are `fromPromise(({input}) =>
convexMutation(input))`). So the in-process Effect↔XState adapter that Sandro's
pattern and confect-style setups need — a `ManagedRuntime` + interpreter shuttling
typed values between two co-located runtimes — **does not exist here and is not
wanted here.** That adapter solves a friction (Effect and XState sharing one
process) this architecture dissolved by putting a network between them.

The house rule, therefore: **the client uses Effect-as-a-library (`Schema`,
`Match`, the branded domain types — already true, free, and load-bearing:
`ladderControls`' exhaustive `Match` IS the "no invalid affordance" guarantee) but
NOT Effect-as-a-runtime.** No client-side `ManagedRuntime`, no Effect interpreter
loop, no lifting domain Effects into client actors. This extends ADR-0004: that
seam put authoritative Effect in Convex; this one says the *client* stays a plain
XState projection of Convex truth.

A client Effect **runtime** — and with it David K. Piano's "machine = pure
`transition` blueprint, Effect owns the loop" pattern — is adopted **demand-driven,
per machine, never preemptively.** The trigger is a machine that carries genuine
client-side *side-effecting* logic with typed errors, services, or a clock it wants
to own (`TestClock`): the planned initiative Tick timeline, canvas geometry/drag,
optimistic previews. The three machines that exist (`cast-ladder` — a pure
projection; `dice-pool` — a pure form reducer; `cast` — two actors that only await
a Convex round-trip) have no such logic, so they stay runtime-free.

## Why

Working backward from the goal — *no UI bugs in an app whose UI is dictated by
complex, server-authoritative rules, some of it shared between two seats (the ST
and caster on the vulgar flow)* — the authority that prevents invalid **shared**
state cannot live on a client: a client can't be trusted to roll its own dice, and
two seats need one truth. That authority is the server-side domain flow behind
`enforcedMutation` (ADR-0004), and the shared state machine IS the Convex document
(`cast-ladder` is written as a *projection* of it, not an owner — ADR-0016). The
fan-out "to all seats at once" is **Convex's reactive query engine, not Effect** —
Effect's entire footprint is the write boundary.

Given that, putting an Effect *runtime* on the client (which today has zero Effect
runtime) would **add** a runtime to chase benefits it doesn't actually gate:
- **Typed errors on the client** need only a `Schema` round-trip at the error seam
  (below), not a runtime.
- **Boundary-spanning OTel spans** are gated on trace-context propagation through
  Convex's opaque RPC — an Effect-independent transport problem a client runtime
  does not solve.
Adopting it app-wide now would be over-engineering: paying interpreter-loop
complexity for machines that have nothing for the loop to run. The pattern is
genuinely good; it earns its keep only where client side-effects exist.

## Consequences

- **Sanctioned typed-errors-over-the-wire pattern (do when wanted):** on typed
  failure, `runConvexEffect` (`convex/lib/effect.ts`) `Schema.encode`s the domain
  `TaggedError` into `ConvexError({ data })` instead of stringifying it; the client
  `Schema.decode`s `err.data` back into the domain error union at the actor seam,
  replacing `toCastError`'s heuristic reconstruction (`cast.ts`). Pure functions on
  both ends — Effect-as-library, no client runtime. This is the one present
  degradation worth fixing (the typed channel does not survive Convex today).
- **OTel boundary spans are deferred**, and when built the work is Convex
  trace-context propagation (smuggled through mutation args, extracted server-side)
  + the OTel Web SDK — decided independently of, and not blocked on, any client
  Effect adoption.
- **`docs/effect-xstate-bridge.md` stands for what it covers** (actors wrap the
  *mutation*; context is plain serializable data; errors map to events at the
  seam). This ADR adds the meta-rule it lacked: *no client Effect runtime until a
  machine demands it*, and names Convex as the bridge.
- **Trigger to revisit, not a refactor to schedule:** the first machine with real
  client-side side-effecting logic (initiative Tick clock is the likely first) is
  where the David K. Piano pattern gets designed and where a scoped client
  `ManagedRuntime` may enter — for that machine, behind its own grill.
- **No change to the running app.** This records why the current seam is correct
  and bounds when it may change; it schedules no build.
