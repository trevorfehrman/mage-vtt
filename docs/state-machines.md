# State Machines — XState v5

## Where XState Fits

XState manages **client-side stateful interactions** — things with explicit states, transitions, and guards. Convex handles persistent state; XState handles the UI flow.

## Planned Machines

### Dice Pool Builder
The core interactive mechanic. Players click stats on their character sheet to build a dice pool.

States: `idle` → `building` → `ready` → `rolling` → `exploding` → `complete`

- `idle`: No pool being built
- `building`: Player clicking stats to add to pool. Storyteller can add/subtract modifiers.
- `ready`: Pool is complete, "Roll" button enabled
- `rolling`: Dice are being rolled (animation), results calculated
- `exploding`: 10s detected, player can click to reroll (or auto-roll)
- `complete`: Final results displayed to all players

Events: `ADD_STAT`, `REMOVE_STAT`, `ADD_MODIFIER`, `ROLL`, `REROLL_EXPLODING`, `RESET`

### Canvas Tool State
Manages the whiteboard/map drawing tool selection.

States: `select` | `draw` | `erase`
Sub-states for draw: `idle` | `drawing` (pointer down)

### Game Session Flow
Top-level session lifecycle.

States: `lobby` → `characterSelect` → `playing` → `paused` → `ended`

### Character Creation Wizard
Multi-step guided flow with AI assistance.

States: `concept` → `path` → `order` → `attributes` → `skills` → `arcana` → `merits` → `review` → `complete`

Each state can invoke an AI suggestion actor.

## Integration with Effect

XState actors can invoke Effects. For example, the dice roll machine can use Effect to:
- Validate the pool (Effect Schema)
- Generate random numbers (Effect Random — testable with TestRandom)
- Persist the result to Convex (Effect wrapping a Convex mutation)

## Integration with Convex

XState state is local (client-side). Results that need to persist (dice rolls, character changes) are committed to Convex via mutations. Other players see the results via Convex subscriptions.
