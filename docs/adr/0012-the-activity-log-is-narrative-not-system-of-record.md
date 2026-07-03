# The Activity Log is narrative, not a system of record

Game mechanics never read the Activity Log. Rules-load-bearing numbers — "how
many Paradox rolls this Scene" (the +1-die accumulation), "how many active
spells does this character have" (spell tolerance) — live in dedicated state
(a scene counter, an active-effects table) written by the same enforced flows
that write the feed entry. The feed is the *story* of what happened; it is
never the database of what is *true*.

## Why

Mining the feed for mechanics looks cheap (the data seems to be right there)
but couples rules to a narrative record: the log can then never be pruned,
every entry-shape change becomes a silent rules change, and a Dev repair that
touches history (ADR-0006) would retroactively change live math. Keeping the
feed read-only-for-humans preserves ADR-0009's entries as atomic narration and
keeps state that rules depend on in schemas designed for querying it.

## Consequences

- A spell cast lands in the feed as an **ordinary Roll entry** (no structured
  spell columns): `components` already shows the pool (Gnosis + Arcanum) and
  the ADR-0009 `summary` narrates the rest. Feed-search niceties (a flat
  `arcanum` column, an entry `kind`) are additive, migration-free columns to be
  added when a real consumer exists — they are display/search aids, never
  rule inputs.
- When the vulgar-casting slice needs per-Scene Paradox accumulation
  (ADR-0008), that requires a Scene state model — not a feed query.
