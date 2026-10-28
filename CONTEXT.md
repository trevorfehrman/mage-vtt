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
The mage society a character belongs to (e.g. Mysterium). Grants Rote
Specialties.

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
The mage's morality/integrity trait. On the sheet it is a rank of 1–10 (a new
mage starts at 7; 0 exists only as the Storyteller's indefinite-Paradox edge
case, p. 268). Falls through acts of hubris and failed degeneration rolls;
rises only through experience. Governs how long a Paradox lasts and the Havoc
roll (MAG-56).
_Avoid_: Morality, Humanity, Sanity (those belong to other splats).

**Merit**:
A perk bought with dots — seven at creation (Mage p. 69, the fifth dot
costing two), 2 XP a dot after — from a closed catalog of the two core books'
offerings (`merits.ts`, MAG-59): the Rulebook's Mental, Physical and Social
families (WoD pp. 108–117) and the Mage book's Awakened family, "available to
only willworkers" (pp. 80–89). Most are a name, a rating and a sentence the
Storyteller applies by judgment: the catalog records the sentence (the
book's **effect**), the table applies it. Every entry also carries its
**mechanic**: the typed thing the app can act on, from a closed list of
kinds — nothing to compute (most), dice added to a roll (fixed, or by the
dots), a change to a derived number (Fast Reflexes → Initiative, Fleet of
Foot → Speed, Giant → Size and so Health, Iron Stamina → the wound penalty),
a gate on a flow (High Speech, the +2 chant), a spendable purse (Destiny). The
sheet, the tray and the flows read the mechanic; nothing in code names a
Merit. A Merit that adds dice is never added by the app: the player
**turns** it by hand on the sheet, for any roll (the book's "where it
applies" is the table's judgment), and the dice land in the pool as a
`merit` component under the Merit's name, so the tray's header and the
roll's record show it for the Storyteller to see. A Merit that changes a
derived number simply makes the number read higher — verdigris, with a few
words naming the source where it would otherwise be plain. Destiny is a
**purse** (MAG-67; see Mark). A
**named** Merit (Allies, Status, Language, Retainer…) is held once per thing
it names, the label written beside it as the book does: "Allies (Police) ••",
and each holding is its own entry — there is no single "dots of Allies". On
the sheet, Merits are a **ring of keys** (`MeritRing.tsx`; owner's direction
2026-10-27): a wheel at the left the hand turns through, the **key in hand**
at the middle, each key unique by its **mark** (one line glyph per Merit in
the Arcana glyphs' stroke, `merit-marks.tsx`, MAG-68) and hanging verdigris
when it has something to turn on this table, dim when it only opens things
in the story, ember when turned; a **reach** line from the ring to the
**keyhole** on the **door**, which holds what the key opens — the family,
the name and dots, the sentence, a Fighting Style's ladder — and at its foot
the act in the game's words only ("+2 dice", the purse's pips, "+2
Initiative"). Key-ness is gestured, never drawn (no teeth, no tags; dots are
dots). It arrives with the ingest; no door writes it, and High Speech's +2 is
refused to a sheet without the Merit.
_Avoid_: Feat, Advantage (the book's Advantages are the derived numbers —
Defense, Speed, Initiative, Health, Willpower).

**Derangement**:
A mental affliction in one of nine mild/severe pairs (WoD pp. 96–100;
`derangements.ts`, MAG-60), each with a trigger, a Resolve + Composure roll to
resist a bout, and the bout's penalty. A mage gets one **permanently** when a
Wisdom degeneration roll fails and the follow-up roll fails too (Mage p. 79) —
tied to the dot lost, gone when it is bought back — or **temporarily** from a
**Bedlam** Paradox (Mage pp. 268–271), for the Paradox's duration, in which
form it also carries a weakness to a kind of magic (Depression: −1 against
Death). The three starred severe forms (Schizophrenia, Multiple Personality,
Fugue) take a life-altering trauma to acquire — or a Bedlam, which inflicts
them freely.
_Avoid_: Condition, Flaw (other editions' words).

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

**Rote Specialty**:
One of the three Skills each Order codes its Rotes with (Mysterium:
Investigation, Occult, Survival; …). Casting a Rote **of your own Order**
whose pool uses one of them grants +1 die; a Rote learned from another Order
never grants it. The only specialty that touches a casting pool.
_Avoid_: confusing with a **Skill Specialty** ("Occult: Ghosts") — the mundane
per-Skill focus. Skill Specialties explicitly do **not** apply to rote casting
(Mage p. 76); a second namespace trap beside rote/rote-quality.

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
*before* the casting roll. Each success left loose takes one die off the cast
(p. 124) and pushes the effect one step up (Havoc → Bedlam → Anomaly →
Branding → Manifestation). A success contained by Backlash does neither: the
cast gets its die back (owner, 2026-10-25). Rolled only for Vulgar casting.

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
four-rung handshake between caster and Storyteller (ADR-0022: Declare → The
Price → Paradox → Resolved), not a single event. At most one unresolved Cast
per character.
_Avoid_: Roll (a Cast contains rolls; it is not one).

**The Tides**:
The scene-owned ambient price of vulgar magic (ADR-0022): the Sleeper witness
head count, the ambient circumstance modifiers ({source, dice}, signs in both
directions — a boon is as first-class as a hazard), and each caster's derived
prior-Paradox pips. Table-visible on the strip at all times; a Cast takes the
seed frozen at The Price and never mutates the Scene.
_Avoid_: Liabilities (retired — it was wrong-signed; a ghost's boon is not a
liability).

**The freeze**:
The Storyteller's lock on a Cast's price (ADR-0022): the Tides seed stamps
onto the card beside any personal adjustments, and from that click the ST is
irrevocably hands-off — "settled" never lies. Repairs are void-plus-redeclare
or out-of-band restitution, never an unfreeze.

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

**Live bet**:
The caster's Mitigation pick and Backlash boxes while they are still being
weighed: drafts on the Cast that every seat watches move, with nothing spent
or wounded until Commit or Cast. The Storyteller's adjustments are never
live bets; they stay private until the fix. (MAG-34)

**Point of no return**:
The caster committing (mitigation and any precommitted Willpower included)
against the frozen price. Before it, either party may cancel freely
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
together they cover both halves of solo playtesting. Taking any member's seat
but your own is announced in the Activity Log: every seat holds that member's
private Whispers, so every seat is secret-seeing (ADR-0013 amendment).
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

**Video tile**:
A Session member's seat in the left rail, the Storyteller's first and then the
players' in the order they joined (MAG-51). Clicking someone else's tile chooses
them for a Whisper (MAG-53): the chosen tile's border burns accent and a quill
rides its edge. A member with a sheet wears its
depletables inside the tile on every seat: the sheet's headline name at the
head, the whole health track and Will · Mana at the foot, a pending spend
shown as what would be left, in ember. The tiles share the rail's height, so a
full table never scrolls. The video itself is still a stand-in.
_Avoid_: Portrait, Card.

### The sheet

**Character Sheet**:
The record of a single character: identity (name, Path, Order, Virtue/Vice),
rated Traits, and current state (health, Willpower, Mana). The sheet records
what is **representable** — anything that fits in its boxes — not what was
legally earned: whether a change is allowed is a question about the *action*
(and may be fudged, leaving an Override), never about the sheet itself. A sheet
that can be written can always be read back.
_Avoid_: Stat block, character record.

**Sheet header**:
The top of the Character Sheet (MAG-52): the mage name with the halo beside
it when any of the words are written (MAG-61), then HEALTH over the track with Will · Mana
and Mana-a-turn (MAG-57, a cycle arrow and the number) beside it, then WISDOM
over its meter (MAG-56: ten cells, filled in the rank's own color, no numeral
and no tooltip — the cells say it); opposite, Gnosis with Defense · Initiative ·
Speed beneath it and the unspent XP (MAG-57) under those; then Path | Order |
ruling Arcana | Virtue | Vice, and the Magical Tool switch at its corner. On your own sheet (and any sheet for
the ST) the track and the meter are live: see **Mark**. Each player's depletables also ride their Video tile.
_Avoid_: Masthead, resource strip (the rail-foot HUD it replaced).

**Mark** (a sheet):
The paper gesture (MAG-63, owner's call 2026-10-27): the Storyteller says "take
two lethal" or "you lose a dot of Wisdom" and the player marks their own sheet.
Click a health box to cycle its wound (clear → bashing → lethal → aggravated →
clear), click beneath it to toggle the Resistant dot, click a Wisdom cell to
set the rank. Walks the normal ownership ladder (`markSheet`: the owner plainly,
an ST or Dev in their stead Override-recorded) and lands in the Chronicle as
"X marked Y: Health clear → 1 lethal". Healing and degeneration rolls stay
manual for now. The **purse mark** (MAG-67, ADR-0025) is the same gesture on
the three purses — Destiny, Willpower, Mana: spending is a roll's or a
cast's act (Destiny's staged pips land in the pool as a `purse` component
and the roll flow debits the sheet on resolve, as Willpower's spend does),
but refilling is the player's hand — click a gone Destiny pip and the purse
fills through it (click-through), the Chronicle reading "X marked Y: Destiny
2 → 4". Capacity is shape: Destiny's twice the Merit's dots, Willpower's
rating, Mana's Gnosis cap. The bane's cost is the same gesture in reverse. The inverse of the **Hand edit**, whose point is that the
owner may not.
_Avoid_: edit (the hand edit is the Storyteller's repair; a mark is the player's record).

**Skill Specialty**:
A narrow focus inside a Skill (MAG-58; WoD p. 54), written "Occult (Goetia)"
on the book's sheet: +1 die when the roll falls inside it — the player's
judgment, so the sheet only names it, bolted to the skill as the book writes
it — "Occult (Goetia)" — and the tray offers a chip ("Goetia +1") whenever the
skill is in the pool, the toggle for the +1, named "Specialty: Goetia" among
the pool's modifiers. Distinct from the **Rote Specialty**.

**Legacy**:
The mage's one specialization (MAG-61; Mage p. 93), chosen at Gnosis 3 or
higher, with up to three attainments opening at Gnosis 3, 5 and 7. A small
section between Arcana and Rotes, the reached attainments in ink and the rest
dim; absent until chosen. Nimbus (the signature of the mage's magic, a
sentence), Cabal (the mage's own group) and Consilium (the local mage
council) live behind the **halo**, a small radiant ring beside the mage's
name whose tooltip lists all three (owner, 2026-10-27).

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

**Live zone**:
The foot of the right rail while a Cast is live: the Cast takes the working
zone over on every seat, full width, framed in the Paradox red (MAG-48,
ADR-0022), with the Working slot above it (owner, 2026-10-25). It takes the
height it needs and never scrolls inside itself; the Chronicle shrinks to make
room. The table reads it as "pause — something that touches everyone is
happening", and every seat stays usable. A live Cast is never an Activity Log entry; its resolved record is.
_Avoid_: Pinned cast (the MAG-46 slot above a bystander's tray, retired),
live feed card (the feed never carries a live Cast).

**Working slot**:
The one place at the right rail's foot that the Message box and the dice tray
share (MAG-53): in a video-call game chat is a niche tool, so it gets no
permanent place of its own. The viewer flips between them at the Chronicle's
header (Dice | Message), where each hidden side carries its news: the dice
waiting on the felt, the lines unread (a whisper to you counted apart). Both
stay mounted, so a flip never loses a draft or a pool. It stands above a live
Cast on every seat (owner, 2026-10-25). Building a pool from the sheet or arming a cast brings the
tray back; Enter outside any field, or clicking a Video tile, brings the Message
box.
_Avoid_: Chat input (the line that sat under the Chronicle until MAG-53).

**Message box**:
The dice tray's partner in the Working slot, in the tray's grammar: a felt, a
grip, Send at the far right. One line to the table; while whispering, the
targets are named inside the felt with a × back to the table. Its tall form adds
only a row of people to toggle.

**Cast mark**:
How a Cast names itself in its header: the Arcanum's glyph standing for its
name, then the level in verdigris that intensifies with the level (MAG-48).
No "Vulgar" — the Cast card only exists for a vulgar cast.
_Avoid_: Headline (the old VULGAR PRIME 1 line it replaced).

**Message**:
A chat Activity — public, a Whisper, or a system notice.

**Roll**:
A dice-roll Activity: who rolled, the pool, the results, the successes, and its
visibility.

**Table name**:
The name a Session member goes by at the table: their sheet's headline there
(the shadow name when there is one), else their account name — so usually the
Storyteller goes by their account name (owner, 2026-10-25: the Chronicle names
people as the Video tiles do). Every narrated line, sender, whisper's people
and Override invoker wears it, written as the entry is (ADR-0009): an entry
keeps the name it was written with.
_Avoid_: display name (that is the account's own name), character name (a
member without a sheet still has one).

**Whisper**:
A private Message from one user to one or more others (commonly Storyteller ↔
Player), visible only to its sender and its targets — the Storyteller sees a
whisper only as one of those (owner, 2026-10-25). A group whisper (MAG-53)
names every member it reaches, in the Activity Log too; the targets are chosen
by clicking their Video tiles, or in the Message box's row of people.

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

**Felt**:
Any surface dice sit on — the tray where a pool is composed, the Cast card's
two printed areas (PARADOX above the chalk line, CAST below), a Chronicle roll
card's row of faces. One grammar on every felt (ADR-0024): a die is a diamond,
unrolled dice colored by where they came from, rolled dice by what they showed.
_Avoid_: Tray (that is one felt, the composing one), dice line.

**Sealed trigger**:
The declaration felt's commit button before the caster has chosen covert or
vulgar (MAG-32, ADR-0022): one bar, Covert left and Vulgar right, the spell's
Arcanum glyph the seal between them. Pressing a half opens it to that side
(Cast, or Draft Vulgar); the seal at the opened button's end closes it again.
A rote the book fixes to one aspect arrives already open.
_Avoid_: Covert/vulgar toggle (it is not a standing switch; nothing starts chosen).

**Shrunk tray** / **Tall tray**:
The dice tray's two forms, the viewer's choice (MAG-47, ADR-0021). The shrunk
tray is one line — the count, the options a throw carries, Roll — and still
composes and rolls; the tall tray is every control. The grip on the tray's top
edge flips between them, and the choice is remembered.
_Avoid_: Collapsed tray, minimized tray (the shrunk tray is not hidden; it rolls).

**Ghost** (of a die):
A die that is not (yet) real — dashed in its own ink over nothing, at 45%: a
price being weighed before the commit, a declared die Paradox ate before the
throw, a red die Mana bought off. One recipe for all of them (ADR-0024).
_Avoid_: Eaten die or pending die as looks of their own (they are the one
ghost; the words describe why it is ghosted, not how it is drawn).

**Hole**:
A Paradox die on the felt — reality's dice are scorch holes in the felt, the
Gnosis base in verdigris and the Tides' dice in Paradox red, their rim-burn
breathing at rest (ADR-0021's ambient-motion exception; ADR-0024).

**Trigger die**:
A rolled die at or above the Again threshold — the die that spawned an
explosion. A Cast records each explosion's trigger (`parentIndex` into the
roll's combined sequence: rolls, rote rerolls, explosions); `null` is a
legacy record whose trigger was never known (ADR-0024).
_Avoid_: Parent (the field's name, not the table's word), exploder.

**Burst**:
The chain of explosions a trigger die spawned, drawn beside it — the burst
order regroups a roll so every explosion stands next to its cause, one child
per trigger, a chain never a tree. Recorded and ordered today (ADR-0024); how
it moves is MAG-18's.

### Realtime

**Presence**:
Who is currently connected to a Session, shown as live online/offline indicators.
_Avoid_: Online status, Activity (that word is reserved for the feed).
