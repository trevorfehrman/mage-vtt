# Build the enforcement seam as a tracer bullet through `rolls.create`

The enforcement seam (ADR-0004) is built first as a **tracer bullet**: one thin,
production-quality thread through *every* layer — `enforcedMutation` → `Authz`/
`CurrentActor` → `GameStore` → a real adapter → pure domain leaves → activity-log
line → error mapping — for a single flow, `rolls.create`. Everything else is built
around that thread. The schema-bridge derivation (ADR-0005) is **attempted inside
the bullet** rather than strictly deferred.

## Why

The seam's risk is **compositional**, not per-layer: each layer is individually
plausible; the open question is whether a single request threads cleanly through
all of them. A throwaway spike on any one layer (e.g. the bridge compiler alone)
would not surface that. A tracer bullet does, and it leaves keepable code.

`rolls.create` is the ideal subject:

- **It already exists and works**, giving a behavioral oracle — migrate it through
  the seam and diff against today's output.
- **It is the thinnest flow that still touches every layer** (auth-once,
  `requireMember` → `SessionMember` decode, pure `buildPool`/`rollPool`,
  `insertRoll`/`insertMessage`, both adapters, conformance test, `NotAMember`
  mapping, `Random.withSeed`).
- **It reads no character**, so the `CharacterSheet` mirror and the
  partial-vs-full-mirror question do not arise until `castSpell` is threaded
  second.

## Consequences

- **Refines ADR-0005 sequencing.** Instead of "seam ships with hand mirrors,
  bridge retrofits later," the bridge derivation is *tried within the bullet* for
  its 2–3 tables (`sessionMembers`, `diceRolls`, `messages`). If Effect v4-beta's
  `Schema → JSON-Schema` compiler works, one source of truth exists from day one;
  if it is flaky, those mirrors are hand-written and the bridge remains a
  known follow-up with a proven consumer waiting. The choice is made empirically,
  not by decree.
- **Build order:** (1) tracer bullet — `rolls.create`; (2) second thread —
  `castSpell` (introduces the `CharacterSheet` mirror and the missing leaf rules
  `spendMana` / paradox-damage application); (3) remaining flows, with god-mode /
  Override actually exercised (the bullet only scaffolds `CurrentActor.isDev` and
  the Override `Ref`; `rolls.create` never bypasses).
