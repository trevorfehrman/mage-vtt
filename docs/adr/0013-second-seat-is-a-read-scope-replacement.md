# Second Seat is a read-scope replacement, never impersonation

A Dev can read a Session from any member's seat (the **Second Seat**,
CONTEXT.md): identity-sensitive queries accept an optional, Dev-gated `seat`
argument that swaps the caller's *entire* read scope for the target member's —
a replacement, not a union. Writes are structurally untouched: no mutation has
a seat argument, so every action taken while seated is still the Dev's own,
flowing through the existing god-mode paths with their Override stamps
(ADR-0006). Taking a seat with *more* sight than your own (e.g. a player-Dev
sitting in the Storyteller's seat) emits a system Activity entry naming the
Dev; taking a narrower seat is silent.

## Why

Solo playtesting needs the second chair — hidden-roll redaction, player
chrome, "my character" — without a second sign-in, which the operator has
ruled out as too cumbersome. Full impersonation (swapping identity for reads
*and* writes) was rejected because it would put a silent identity-forging
affordance in the codebase and break the ADR-0006 convention that every
acted-in-another's-stead write is Override-stamped. Read-only replacement
composes with the already-built write half (god-mode casts in a player's
stead, #8) to cover the whole loop.

## Consequences

- **God-mode's glossary entry stays true as written.** "God-mode never widens
  read visibility" survives because Second Seat is a distinct capability, not
  part of god-mode — and its one widening case is announced in the log,
  honoring the "explicit, opt-in, logged" clause for secret-seeing.
- **Stateless by choice.** The seat lives in client state and travels as a
  query arg resolved by one shared server helper (allowlist-checked); there is
  no server-side seat row to forget you're sitting in. A refresh stands you
  back up in your own seat. The alternative (a seat table consulted at the
  `memberOf` choke point) was rejected because that helper also serves
  mutations, making the read-only guarantee a matter of discipline instead of
  structure.
- **Losing sight is the point.** A Storyteller-Dev seated as a player cannot
  see hidden rolls while seated — replacement semantics are what make the
  playtest honest.
