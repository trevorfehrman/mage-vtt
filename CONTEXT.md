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

**Improvised spell**:
A spell cast from raw Supernal understanding — no training, any effect the
mage's Arcanum dots allow, decided in the moment. Dice pool = Gnosis + Arcanum.
Compare Rote.

**Rote**:
A practiced spell learned through training and experience points, chosen from
the book. Dice pool = Attribute + Skill + Arcanum (listed per rote; usually
larger than an improvised pool). Compare Improvised spell.
_Avoid_: confusing with the **rote quality / rote action** — the generic
reroll-failed-dice-once dice mechanic. Casting a Rote does **not** grant the
rote quality; they are unrelated mechanics that share a name.

**Practice**:
The tier of effect an Arcanum dot rating unlocks (1 dot: Knowing/Compelling/
Unveiling … 3: Weaving/Fraying/Perfecting … 5: Making/Unmaking). A mage can
only attempt effects whose level his Arcanum dots meet — the level of the
effect, not merely knowing the Arcanum, gates the cast.

**Aspect** (**Covert** / **Vulgar**):
Whether a spell's effect is deniable (**Covert** — subtle, explains away as
coincidence) or blatantly impossible (**Vulgar**). Only Vulgar spells risk
Paradox; Covert spells never roll it.

**Paradox**:
Reality's backlash against Vulgar magic. The Storyteller rolls a Paradox pool
*before* the casting roll; successes both penalize the cast (–1 die each) and,
unless contained, manifest as an escalating effect (Havoc → Bedlam → Anomaly →
Branding → Manifestation). Rolled only for Vulgar casting.

**Backlash**:
A caster voluntarily absorbing Paradox successes as Resistant bashing damage,
one wound per success, to stop them from manifesting. Partial and health-capped —
a post-roll decision, not automatic.

**Scene**:
A unit of narrative time within a Session — one location, one event, with the
Storyteller deciding where it begins and ends (WoD Core p. 121). Some effects
accumulate across it — notably a caster's Paradox pool grows +1 die per prior
Paradox roll **made for that same caster** in the same Scene (per-caster, not
scene-global).
_Avoid_: Turn (that is one action), Session (that is the whole campaign room).

**Cast**:
A declared spellcasting working through its lifecycle — for Vulgar magic, a
multi-step negotiation between caster and Storyteller (declare → negotiate
liabilities → lock → Paradox roll → contain → casting roll), not a single
event. At most one unresolved Cast per character.
_Avoid_: Roll (a Cast contains rolls; it is not one).

**Draft** (a Cast "in the wings"):
A Cast a player has declared but the Storyteller has not yet engaged. Free to
create, free for its owner or the Storyteller to kill; has no mechanical
weight until engaged.

**On stage**:
The at-most-one engaged Cast in a Scene — from Storyteller engagement to a
terminal status. The stage is exclusive; Drafts queue in the wings.

**Mitigation**:
The caster spending Mana (1 per die) to shrink the Paradox pool *before* it
is rolled — blind insurance against a roll whose outcome nobody knows yet.
Compare Backlash, which is chosen *after* seeing the roll.

**Point of no return**:
The caster locking in their intention (mitigation included) after the
Storyteller locks liabilities. Before it, either party may cancel freely
in-fiction; after it, the only exits are playing the Cast out or a
Storyteller void (Override-stamped).

**Again** (10-again / 9-again / 8-again):
The reroll-on-high-die rule for a roll. 10-again is standard; 9- and 8-again are
easier thresholds granted by some effects.

**Success**:
A die showing 8, 9, or 10. Five or more successes on one roll is an exceptional
success.

**Tick**:
The unit of the house-ruled initiative system. A participant acts when their
Ticks reach 0; actions cost Ticks to take.

**Combat**:
A tracked fight inside a Scene — a roster of participants and their Tick
counters. At most one active Combat per Scene, though a Scene may host several
in sequence. Participants are sheet-backed (a character) or hand-entered (the
Storyteller's paper NPC).
_Avoid_: Encounter, battle, combat mode (a Combat is an object in a Scene, not
a state the Scene switches into).

**Resistant damage**:
Damage that cannot be healed by Awakened magic (it heals naturally) — the dot
beneath the health box. Paradox Backlash inflicts Resistant bashing. A property
of the individual wound, travelling with it as wounds shift.

### Roles

**Storyteller** (**ST**):
The player running the game. May roll hidden, whisper privately, and see all
information.
_Avoid_: GM, DM, Game Master, Dungeon Master.

**Player**:
A participant controlling a single character.

**Dev** (**god-mode**):
A global, cross-session repair authority held by the app operator, not a session
role. Exists to un-fork state and help players mid-session. Orthogonal to
Storyteller/Player membership: a Dev is still a Player or Storyteller in any given
Session, and additionally may bypass **write** authority (act as any character's
owner, and take Storyteller-gated actions). God-mode is a **write-path** capability
only: it never widens **read** visibility, so it cannot see hidden Rolls, Whispers,
or Storyteller-secret content. Seeing a forked secret to repair it is a separate,
explicit, opt-in, logged action — never implied by god-mode.
_Avoid_: Admin, superuser (this is a single-operator repair capability, not a
role tier in the Session).

**Second Seat**:
A Dev reading a Session from another member's seat: read visibility and table
chrome resolve as if the target member were looking — their hidden-Roll
redaction, their Whispers, their "my character." A **replacement**, never a
union: taking a player's seat costs a Storyteller-Dev their wider sight for as
long as they sit there. Read-path only — actions taken while in a Second Seat
are still the Dev's own writes (god-mode, Override-stamped); no write ever
wears the target's name. Distinct from god-mode, which is write-path only;
together they cover both halves of solo playtesting. Taking a seat with *more*
sight than your own (secret-seeing) is announced in the Activity Log; taking a
narrower seat is silent.
_Avoid_: impersonation (identity never swaps on writes), spectating (a Second
Seat is a specific member's scope, not a god view).

### The table

**Session**:
The persistent game room players join by invite code, where characters live and
play happens. Represents the ongoing campaign, not a single sitting.
_Avoid_: Chronicle, Table, Room, Game, Lobby. ("Chronicle Name" survives only as
a free-text label on the character sheet.)

**Session member**:
A player's or Storyteller's membership in a Session — the join between a user and
a Session, and what a character is attached to. Its identity is the **(user,
session) pair**, not its surrogate row id: the same person rejoining a Session is
the same member, and character ownership is decided by matching that pair.

**Invite code**:
The short code that admits a user to a Session as a new session member.

### The sheet

**Character Sheet**:
The record of a single character: identity (name, Path, Order, Virtue/Vice),
rated Traits, and current state (health, Willpower, Mana). The sheet records
what is **representable** — anything that fits in its boxes — not what was
legally earned: whether a change is allowed is a question about the *action*
(and may be fudged, leaving an Override), never about the sheet itself. A sheet
that can be written can always be read back.
_Avoid_: Stat block, character record.

**Hand edit**:
A direct, free-form change to a Character Sheet value made outside any game
action — the fudge/repair path. Storyteller- or Dev-only, and always carries an
Override. Bounded by the sheet's printed capacities (pools fill to their
derived maxima, the health track keeps its box count): **capacity is shape,
not state** — exceeding a cap means hand-editing the stat that prints it, when
such a door exists. Contrast an **action-mediated write**, where the engine computes and
applies sheet changes as the consequence of a declared action (a cast spending
Mana); players change their own sheet only through actions, never by hand.
_Avoid_: Manual edit meaning "player self-service" — players do not hand-edit,
even their own sheet.

**Working copy**:
Client-held, unsent edits that exist nowhere until submitted — the state behind
a form. Discarding one is free and invisible to every other actor; submitting
one is a single write the server validates whole. A working copy belongs to one
person on one screen. Contrast a **Draft**, which is a durable server document
(a Cast in the wings) that other actors can already see and act on.
_Avoid_: Draft for unsent client state — Draft is taken by the Cast ladder.

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

**Override**:
A provenance marker on an Activity recording that a rule was bent to produce it —
a god-mode action or repair by the Dev, or the Storyteller acting in a player's
stead (e.g. casting from their sheet). Names the invoker on top of the action's
normal owner, so rule-bending is transparent at the table. Absent on ordinary
Activity.
_Avoid_: Audit entry, admin flag.

**Hidden roll**:
A Roll visible only to the Storyteller (and the roller), used for secret checks.
Orthogonal to a spell's Aspect: a Covert spell is usually rolled publicly (the
table sees the dice; the fiction's witnesses notice nothing), and an NPC's spell
is usually a Hidden roll regardless of Aspect.
_Avoid_: Secret roll, covert roll (Covert is an Aspect in the fiction, not table
visibility).

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
