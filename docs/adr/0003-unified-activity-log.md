# Chat and rolls share one unified Activity Log

> **Amended** (2026-10-25, MAG-53, the owner's call: "the ST should
> absolutely not be able to see every whisper at the table, only whispers
> to them, that's a super weird design choice"). A whisper is private to
> its sender and its targets — the Storyteller sees one only as one of
> those. The Storyteller still sees every Hidden roll. A whisper may name
> several targets (a group whisper) and carries their names as it carries
> its sender's (ADR-0009).

Chat messages and dice rolls are merged into a single chronological feed (the
Activity Log) — a discriminated union on `kind: "message" | "roll"` — rather
than the two separate panes the original brief described ("Chat Space" and
"Roll Space"). Visibility filtering (whispers, hidden rolls) is applied
server-side before items reach a client.

## Why

Interleaving rolls and messages by time gives a single readable narrative of
what happened at the table and matches the established VTT pattern (Roll20,
Foundry). The *inputs* stay separate (dice-pool builder, chat input); only the
*output* feed is unified. This is the more reversible of our decisions, recorded
mainly so the split-panel model isn't reintroduced by accident.
