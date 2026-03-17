# State Machines — XState v5

## Current Status

XState v5 (`5.28.0`) and `@xstate/react` are installed. **No state machines are implemented yet.** The domain logic (dice pools, initiative, etc.) is pure Effect code. XState machines will be built when we move to UI implementation.

## Planned Machines

### Dice Pool Builder
The core interactive mechanic. Players click stats on their character sheet to build a dice pool.

States: `idle` → `building` → `ready` → `rolling` → `exploding` → `complete`

Events: `ADD_STAT`, `REMOVE_STAT`, `ADD_MODIFIER`, `ROLL`, `REROLL_EXPLODING`, `RESET`

The Effect domain logic (`dice.ts`) handles the actual rolling and success counting. The XState machine manages the UI flow and calls Effect functions as actions.

### Tick Initiative Tracker
The homebrew initiative system visualized as an FF10-style timeline.

States: `setup` → `rolling` → `active` → `acting` → `resolving`

The Effect domain logic (`initiative.ts`) handles tick calculation and action costs. The XState machine manages whose turn it is and animates the tracker.

### Canvas/Whiteboard Tool State
Manages drawing tool selection for the shared map.

States: `select` | `draw` | `erase`

### Game Session Flow
Top-level session lifecycle.

States: `lobby` → `characterSelect` → `playing` → `paused` → `ended`

### Character Creation Wizard
Multi-step guided flow with AI assistance.

States: `concept` → `path` → `order` → `attributes` → `skills` → `arcana` → `merits` → `review` → `complete`

## Integration Pattern (from Sandro Maglione)

XState defines WHAT happens (state transitions). Effect defines HOW it happens (typed side effects). They're interleaved:

```ts
// XState action → calls Effect function → Effect returns typed result
// Effect error → converts to XState event via self.send() → transitions state
```

Effect errors flow INTO the state machine as events. The machine's transition logic is informed BY Effect return types.
