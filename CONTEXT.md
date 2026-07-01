# Mage VTT

A virtual tabletop for running **Mage: The Awakening (1st Edition)** on the New
World of Darkness / Chronicles of Darkness 1st-Edition Storytelling System.
Combat and initiative are deliberately house-ruled (dynamic "Tick" initiative
adapted from *Scion: Hero*).

This file is the project's shared vocabulary — a glossary, not a spec. It
contains no implementation details.

## Language

### Game system

**Path**:
A mage's Supernal realm of origin — Acanthus, Mastigos, Moros, Obrimos, or
Thyrsus. Sets ruling Arcana and grants +1 Composure or +1 Resolve.

**Order**:
The mage society a character belongs to (e.g. Mysterium). Grants rote skills.

**Arcanum** (pl. **Arcana**):
One of ten domains of magic — Death, Fate, Forces, Life, Matter, Mind, Prime,
Space, Spirit, Time — each rated 0–5 dots.
_Avoid_: Sphere (that is Mage: The Ascension, a different game).

**Gnosis**:
A mage's Supernal attunement and magical potency, rated 1–10. Sets Mana capacity
and caps spellcasting.

**Mana**:
The spendable magical-energy resource. Maximum is set by Gnosis.

**Wisdom**:
The mage's morality/integrity trait, rated 0–10.
_Avoid_: Morality, Humanity, Sanity (those belong to other splats).

**Virtue / Vice**:
A character's two moral anchors (nWoD 1e); role-playing them restores Willpower.

**Rote**:
A practiced spell cast with a larger, pre-calculated dice pool, chosen from the
book by Arcanum.

**Again** (10-again / 9-again / 8-again):
The reroll-on-high-die rule for a roll. 10-again is standard; 9- and 8-again are
easier thresholds granted by some effects.

**Success**:
A die showing 8, 9, or 10. Five or more successes on one roll is an exceptional
success.

**Tick**:
The unit of the house-ruled initiative system. A participant acts when their
Ticks reach 0; actions cost Ticks to take.

### Roles

**Storyteller** (**ST**):
The player running the game. May roll hidden, whisper privately, and see all
information.
_Avoid_: GM, DM, Game Master, Dungeon Master.

**Player**:
A participant controlling a single character.

### The table

**Session**:
The persistent game room players join by invite code, where characters live and
play happens. Represents the ongoing campaign, not a single sitting.
_Avoid_: Chronicle, Table, Room, Game, Lobby. ("Chronicle Name" survives only as
a free-text label on the character sheet.)

**Session member**:
A player's or Storyteller's membership in a Session — the join between a user and
a Session, and what a character is attached to.

**Invite code**:
The short code that admits a user to a Session as a new session member.

### The feed

**Activity**:
Anything that happens in a Session and lands in the shared log — either a Message
or a Roll. The umbrella concept behind the Activity Log's discriminated entries.

**Activity Log**:
The single chronological feed showing all Activity (Messages and Rolls
interleaved by time), with visibility filtering applied server-side.
_Avoid_: Chat log, Roll history (those were the two separate panes this replaced).

**Message**:
A chat Activity — public, a Whisper, or a system notice.

**Roll**:
A dice-roll Activity: who rolled, the pool, the results, the successes, and its
visibility.

**Whisper**:
A private Message between two users (commonly Storyteller ↔ Player), visible only
to sender, target, and the Storyteller.

**Hidden roll**:
A Roll visible only to the Storyteller (and the roller), used for secret checks.

### Dice pools

**Dice pool**:
The set of dice a player assembles before rolling, shown live to everyone. Equals
the sum of its Traits plus a Modifier.

**Trait**:
A single rated stat — an Attribute, Skill, Arcanum, Gnosis, or Merit — toggled
into a dice pool from the character sheet. Each contributes its dots.
_Avoid_: Component (collides with React/XState components), Die source, Addend.

**Modifier**:
A flat bonus or penalty in dice added to a pool at the Storyteller's discretion,
on top of the Traits.

### Realtime

**Presence**:
Who is currently connected to a Session, shown as live online/offline indicators.
_Avoid_: Online status, Activity (that word is reserved for the feed).
