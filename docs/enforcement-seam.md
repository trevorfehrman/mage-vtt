# The Rules-Enforcement Seam (Convex ↔ Effect)

How server-side rules enforcement is structured: the seam between Convex's
runtime (auth, DB, transactions) and the pure Effect domain in `src/domain/`.
Produced by a `design-it-twice` exploration (four parallel interface designs);
this records the chosen shape and why. See ADR-0004.

## Problem

The app is a **rules-enforcing engine** (`docs/app-capabilities.md`): the server —
not the client — builds pools, rolls, computes paradox/mana/damage, and mutates
sheets. Today only `convex/rolls.ts` does this, and it inlines a repeated **dance**:

> authenticate → resolve session membership + authorize → run domain Effect(s) via
> `runConvexEffect` → hand-map the result into `ctx.db.insert` → insert an activity
> log message → map errors.

Every future enforced flow (cast-a-spell, combat action, initiative, sheet edits,
dev god-mode) would copy-paste steps 1–2 and 4–6; only the domain Effect and which
docs it touches vary. That dance currently lives behind **no module** — the
interface a new-flow author faces is the entire Convex + Effect + domain surface.

The `runConvexEffect` adapter (`convex/lib/effect.ts`, `Effect<A,E,never> →
Promise<A>`, typed failures → `ConvexError`, defects → throw) passes the deletion
test and **stays**. The dance around it is what this seam captures.

## Prior art: confect

[confect](https://github.com/rjdellecese/confect) is this seam productized —
"access Convex platform capabilities via Effect services," schema + arg/return
validators in Effect Schema, typed errors consumed at each call site, handlers
that *are* Effects with `ctx` exposed as services (`ConfectMutationCtx` etc.).
Two of our four independent design agents reinvented its core idea, confirming
**ctx-as-Effect-service is the idiomatic shape**.

**Decision: hand-roll, don't adopt confect.** The decisive fact is a **version
incompatibility**: confect (`@confect/server` 9.1.4) is built on **Effect v3**
(`effect: "^3.21.2"`, plus the v3-era `@effect/*` line); we are on **Effect v4
beta** by decision (`effect-v4-bump`, settled). Adopting it would mean reversing
that decision, or running two Effect majors side by side — and the latter is
toxic: our v4 domain Effects (imported into Convex functions) cannot execute
inside a v3 handler (different fiber runtimes; `Context.Tag`/`Layer` resolve by
reference *per Effect instance*, so services silently fail across the two copies).
There is no clean quarantine, because the whole point is to run our v4 domain
rules through the handler.

The one thing confect solves that all four designs punted on — unifying Convex
`v.*` validators with Effect `Schema` — we build ourselves instead (Effect v4,
~one module). See the **`schema-bridge`** slice / ADR-0005. **Re-evaluate confect
only if it ships an Effect-v4 release** — at which point the version gate opens and
its schema-unification value becomes available without abandoning v4.

## Chosen shape

A hybrid of the two designs that converged (ports & adapters + free-Effect flow):

- **Leaf domain rules stay `R = never`.** `dice.ts`, `paradox.ts`,
  `mana-economy.ts`, `spellcasting.ts` remain pure calculators. The 155+ domain
  tests are untouched. This containment is the whole cost-control story.
- **A thin flow layer** (`src/domain/flows/*`) carries `R = GameStore |
  CurrentActor`. It's the *only* code that gains a requirement, and it stitches
  pure rules to persistence with a free-form `Effect.gen` (not a rigid record —
  the benchmark interleaves a second Paradox roll that hooks can't express).
- **Two ports** (`Context.Tag` services):
  - `GameStore` — data access, with **domain-specific write helpers** (`insertRoll`
    hides the 15-field `diceRolls` map; `insertMessage`, `patchSheet`) and typed
    reads that fail `DocumentNotFound` instead of returning null.
  - `CurrentActor` + `Authz` helpers — identity and the player / storyteller /
    **dev** (global god-mode) tier, via `requireMember` / `requireStoryteller` /
    `requireOwnedCharacter`.
- **Ports speak Effect-Schema domain mirrors** (`CharacterSheet`, `Session`,
  `SessionMember` in `src/domain/`), decoded at the adapter — **not** Convex's
  generated `Doc<T>`. Chosen deliberately (see ADR-0004): it keeps the domain
  Convex-free and matches the codebase's brand/Schema-everything ethos, at the cost
  of mirroring `schema.ts` + decode-at-adapter.
- **`Clock` service for time** (deterministic under `TestClock`), never `Date.now()`.
- **Invariant — every enforced mutation emits an activity-log line** (structural,
  not copy-paste; upholds ADR-0003's unified activity log).
- **Two adapters make the seam real:** `ConvexLive` (backed by `ctx.db` +
  `requireUser`) and `InMemory` (Maps + injected actor). A **conformance test**
  runs the same assertions against both to prevent drift. `Effect.provide` happens
  **once**, at the `enforcedMutation` boundary; `ConvexLive` is per-request (Convex
  `ctx` is request-scoped) so only the flow references above it are module constants.

### Interface (sketch)

```ts
// convex/lib/enforce.ts — the one Convex entry point
export const enforcedMutation = <Args extends PropertyValidators, A, E>(config: {
  args: Args
  flow: (args: Infer<Args>) => Effect.Effect<A, E, GameStore | CurrentActor>
}) => mutation({
  args: config.args,
  handler: async (ctx, args) => {
    const user  = await requireUser(ctx)                 // auth, once
    const layer = ConvexLive.layer(ctx, user)            // both ports
    return runConvexEffect(config.flow(args).pipe(Effect.provide(layer)))
  },
})

// src/domain/ports/game-store.ts
export class GameStore extends Context.Tag("GameStore")<GameStore, {
  readonly getSession:    (id: SessionId) => Effect.Effect<Session, DocumentNotFound>
  readonly getMembership: (s: SessionId, u: PlayerId) => Effect.Effect<SessionMember, NotAMember>
  readonly getSheet:      (id: CharacterId) => Effect.Effect<CharacterSheet, DocumentNotFound>
  readonly insertRoll:    (draft: RollDraft) => Effect.Effect<RollId>       // hides the 15-field map
  readonly insertMessage: (draft: MessageDraft) => Effect.Effect<MessageId>
  readonly patchSheet:    (id: CharacterId, p: SheetPatch) => Effect.Effect<void, DocumentNotFound>
}>() {}

export class CurrentActor extends Context.Tag("CurrentActor")<CurrentActor, Actor>() {}
```

### `castSpell` (benchmark) and `rolls.create`

```ts
// src/domain/flows/cast-spell.ts
export const castSpell = Effect.fn("Flows.castSpell")(function* (args: CastSpellArgs) {
  const member = yield* requireMember(args.sessionId)             // the dance → one line
  const sheet  = yield* requireOwnedCharacter(member, args.characterId)

  const casting = yield* calculateImprovisedPool({ gnosis: sheet.gnosis, /*…*/ })   // pure leaves
  const roll    = yield* rollPool(yield* buildPool(toComponents(casting)))
  const paradox = yield* resolveParadox((yield* rollPool(paradoxPoolFrom(sheet))).successes)
  const mana    = yield* spendMana(sheet.manaCurrent, casting.manaCost)             // InsufficientMana
  const health  = yield* applyParadoxDamage(sheet.healthTrack, paradox)

  const store = yield* GameStore                                  // writes: atomic via Convex txn
  yield* store.patchSheet(sheet.id, { manaCurrent: mana, healthTrack: health })
  const rollId = yield* store.insertRoll(rollDraft(roll, member, args.sessionId))
  yield* store.insertMessage(spellLog(member, roll, paradox, args.sessionId))
  return rollId
})

// convex/spells.ts — the entire Convex surface
export const cast = enforcedMutation({ args: castSpellArgs, flow: castSpell })
```

`rolls.create` collapses the same way — auth + membership + the message insert +
`runConvexEffect` all vanish into the seam; only `buildPool`/`rollPool` + the roll
draft remain.

### Testability (the payoff)

Enforced flows are unit-tested with **zero Convex**: provide `InMemory.layer({
sessions, members, sheets })` + a `CurrentActor` layer + `Random.withSeed(...)`,
and assert on authority (`NotYourCharacter`), mana economy, paradox damage, and the
collected writes — through the same port interface production uses.

## Atomicity

Inherited, not implemented. A Convex mutation is one ACID transaction: `ConvexLive`
write methods call `ctx.db` eagerly, and `runConvexEffect` throws on any typed
failure or defect, aborting the whole mutation. So a spell that fails
`InsufficientMana` after patching the sheet writes nothing. **Reject** any
write-buffer/commit-log design — it would duplicate and desync from Convex's txn.
(`InMemory` need not roll back; tests assert either success or failure.)

## Scope & non-goals

- **Enforced writes only.** Read/query handlers (`rolls.list` visibility filtering,
  pagination) stay plain Convex `query`s — that's where `ctx.db` is expressive and
  a port would leak a fat query-builder. `GameStore` is doc-level, added-to per the
  rule of two, never a mirror of `ctx.db`.
- **Trivial one-write mutations** (rename a session, post a chat line) don't need
  the seam; `runConvexEffect` already covers the simplest case.
- **Arg/return validator ↔ Schema unification is its own slice** (`schema-bridge`,
  ADR-0005): a DIY `schemaToConvexValidator` on Effect v4 that lets us define
  schemas once in Effect Schema and derive the Convex `v.*` side, deleting this
  seam's hand-maintained mirror-tax. Sequenced *after* the seam (the seam ships
  with hand mirrors; the bridge retrofits them). Feasible because Effect v4 ships
  a maintained `Schema → JSON-Schema` compiler we project onto Convex validators,
  with a `ConvexId(...)` annotation convention for Convex-native types.

## Alternatives explored (design-it-twice)

Four parallel designs under different constraints; full briefs in session history.

1. **Minimal** — `enforce({args, authorize, load, decide, persist})`, domain
   pinned `R = never`, `Reader`/`Writer` ports. Cheapest, but can't interleave
   read→decide→read; needed a service escape hatch anyway.
2. **Flexible** — `runFlow(ctx, flow)`, free Effect, generic `Repo` + `Authz`
   services. Converged with #4; generic `Repo.insert` left the 15-field map in the
   flow. Its Clock + free-Effect ergonomics are folded into the chosen shape.
3. **Common-case** — `enforce({…, rule → Commit})`, declarative write-plan applied
   after success; contributed the "every mutation logs" invariant. Declarative
   writes can't reference intra-commit ids; imperative `load` left reads untyped.
4. **Ports & adapters** — `enforcedMutation` + `GameStore`/`CurrentActor` ports +
   Schema mirrors + conformance test. **The chosen skeleton.**

## Downstream

Implementation deferred to `/grill-with-docs` (this slice) → `/to-prd` →
`/implement`, guarded by the existing domain suite + the new conformance test.
This seam **gates** the automated flows (spellcasting, combat) — build it first.
