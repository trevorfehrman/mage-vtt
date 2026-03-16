# Domain Model

Domain types live in `src/domain/` and use Effect Schema. These are shared between client and Convex functions.

## Branded IDs

Every entity ID is branded to prevent accidental mixing:

```ts
const SessionId = Schema.String.pipe(Schema.brand("SessionId"))
const CharacterId = Schema.String.pipe(Schema.brand("CharacterId"))
const PlayerId = Schema.String.pipe(Schema.brand("PlayerId"))
const RoteId = Schema.String.pipe(Schema.brand("RoteId"))
const MapId = Schema.String.pipe(Schema.brand("MapId"))
const MessageId = Schema.String.pipe(Schema.brand("MessageId"))
```

## Core Entities

### Character
The central data model. Uses Schema.Class with all WoD attributes, skills, arcana, and derived stats. Derived values (defense, initiative, speed, willpower) are computed getters.

### GameSession
A game session (chronicle instance). Has a storyteller, members, active map, and game state.

### DiceRoll
Records a dice roll: who rolled, what pool, results, successes, visibility (public/hidden/whisper).

### Message
Chat message with visibility: public (all players), whisper (storyteller → specific player), or system.

## Tagged Unions

### DamageType
```ts
Bashing | Lethal | Aggravated
```

### MessageVisibility
```ts
Public | Hidden | Whisper(targetPlayerId)
```

### SessionRole
```ts
Player | Storyteller
```

### GameAction
```ts
Roll | CastSpell | AddRote | TakeDamage | HealDamage | SpendMana | SpendWillpower | ...
```

## Tagged Errors

```ts
InvalidDicePool — pool size < 0 without chance die rules
NotYourTurn — action attempted out of turn
InsufficientMana — spell requires more mana than available
SpellLimitExceeded — too many active spells
InvalidArcanum — arcanum level too low for spell
CharacterNotFound — character ID doesn't exist in session
```
