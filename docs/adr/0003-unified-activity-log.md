# Chat and rolls share one unified Activity Log

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
