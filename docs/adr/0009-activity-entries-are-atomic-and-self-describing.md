# Each enforced flow emits one atomic, self-describing Activity entry

An enforced flow writes **one** Activity entry that carries both its structured
data *and* its human-readable narrative and its own visibility — not a rich row
plus a shadow "system" message linked by a coincidental timestamp. For rolls and
casts this means a single `diceRolls` row with a `summary` field (e.g. "Aldous
casts *Pyros* — 3 successes"); the reader renders narrative headline + expandable
dice as one feed item. The Activity Log is still assembled at read time by merging
`diceRolls` + `messages` (ADR-0003); the `messages` table remains for real chat and
Whispers.

## Why

`rolls.create` today writes a `diceRolls` row **and** a `messages` row with an
identical timestamp, and `activity.ts` deduplicates them by matching timestamps.
That pattern has two defects: the shadow message is **redundant** when the roll is
visible (deduped away), and it **leaks** when the roll is hidden — it is written
`visibilityType: "system"` (public) even for hidden rolls, so "X rolled 3
successes" shows to everyone. Collapsing narrative onto the roll entry makes both
failure modes structurally impossible: one row, one timestamp, one `visibility`
field governing both the sentence and the dice.

## Consequences

- **Deletes the dedup hack** (`activity.ts` lines that suppress system messages by
  timestamp) and **fixes the hidden-roll leak** by construction when the tracer
  bullet re-implements `rolls.create`.
- **Additive schema change:** a `summary` field on `diceRolls` (in the same family
  as the `Override` field, ADR-0006).
- **The invariant is enforced by the conformance test, not the type system.** Free
  `Effect.gen` flows cannot type-force "you wrote a log line," so the conformance
  test asserts every flow, run against `InMemory`, produces ≥1 Activity entry. A
  flow that silently writes nothing fails the test.
- **`Override` auto-stamps the single entry** — one place, not two.
- A separate narrative *message* row remains available for the rare case a flow
  genuinely wants a distinct chat-style line, but it is not the default, because it
  reintroduces the keep-two-things-in-sync surface this ADR removes.
