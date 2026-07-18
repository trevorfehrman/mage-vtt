# Tides are scene state; the cast card is a docked cockpit

Adopted from the 2026-07-18 stage-question grilling (issue #101, worked with
eyes on the #96 dressing-room rig). This ADR **amends ADR-0016**: the Cast
document as single source of truth, the exclusive stage, no timeouts,
void-anytime (ADR-0015), and typed refusals (ADR-0010) all stand. What
changes is who owns the liabilities, how many rungs the ladder has, where
one dramatic-beat boundary sits, and where the live card lives on screen.

## The Tides: seed + adjustment

The scene owns the ambient price of vulgar magic — the **Tides**: witness
count, ambient circumstance modifiers (`{source, dice}`, signs in both
directions — advantage circumstances are first-class), and the per-caster
prior-Paradox pips (already a projection of resolved Cast history,
ADR-0012). The Tides are table-visible at all times in the top chrome: the
Scene strip grows a witness-count stepper (superseding the boolean toggle
in the UI) and a tag row that appears when circumstances exist, with an
inline ST-only add/remove surface. The strip's "one line, deliberately not
a fifth panel" stance is renegotiated to "header chrome that can carry a
tag row"; the rail spends no height on standing state.

The Tides are the **seed**, not the whole price. At The Price rung the
frozen scene snapshot lands on the card and the ST may add **personal
adjustments** — facts about this caster's situation (a broken hand, hanging
from a ledge, a ghost's boon) — before locking. The card visibly
distinguishes inherited-from-scene from added-for-this-cast. Scene state is
never mutated by a cast; the ST reacts to the world by editing the scene,
to the caster by adjusting the card. The point of the split: players price
their own risk/reward off public ambient truth *before declaring*, without
bothering the ST; cast-specific facts still have a home that doesn't lie
to the table about the ambient state.

Color grammar note: the Tides are the world's magic and render verdigris;
the caster's hand (drafting, insurance, the Cast click) is ember.

## The freeze

The ST locks the price when satisfied. After that click the ST is
**irrevocably hands-off** — no unfreeze exists. "Settled" never lies: once
the caster sees the frozen price it cannot shift under them while they
weigh insurance and commitment. Repairs for a wrong freeze are the existing
trapdoors: void (Override-stamped, ADR-0006/0015) plus redeclare, or
out-of-band restitution (heal, grant back Mana or Willpower). Post-freeze
scene edits never touch the frozen card — the strip shows the new world,
the card keeps its snapshot, the divergence is visible, and the *next* cast
pays the new price.

## The collapsed ladder

```
Declare (caster) → The Price (ST assembles seed ± personal, locks
                 · caster insures, commits or bails)
                 → Paradox (ST rolls · caster contains & releases)
                 → Resolved            (terminals: cancelled, voided)
```

Rungs with two actors are **two-colored phases of one rung** — player-active
vs ST-active styling — which replaces "waiting on you" prose entirely (the
ticket's original charter question).

**One mutation per commitment; drafting is broadcast working state;
presentation may unpack a commitment into multiple beats.** This refines
ADR-0016's "one mutation per beat." That ADR fused mutation boundaries with
dramatic beats because drafting was private then — a reveal was the only
place drama could live. With drafting broadcast, suspense moves upstream of
the commitment, so contain + roll collapse into one **Cast**
click (one server commitment instead of two), and the card may still play
"the sacrifice lands" then "the dice fly" as sequential animations from one
event. Different-actor beats never fuse: the ST's Paradox roll and the
freeze remain their own mutations — same logic 0016 used when it collapsed
declare+mitigate but kept the rest apart.

## The cockpit

The Paradox phase is the card's cockpit moment: the caster's health track
renders inside the card; a literal dice-line shows the pool (Paradox
removes dice; health-box clicks buy them back; wound-penalty losses get a
third distinct treatment); a manifestation-severity tracker reacts live; an
odds line sits permanently beneath, read-only to the ST and bystanders —
spectator suspense is a design goal, not a leak.

**Willpower stays at declaration — precommitted, blind, by the book.**
Rules check (WoD core pp. 96/133, Mage p. 125): Willpower is +3 dice on
one roll — not a reroll — one point max, excluded only on
degeneration/Morality rolls, and has no Paradox lever (mitigation is Mana,
containment is health). The grill briefly relocated the toggle to the
cockpit as the "informed moment"; the owner's double-check reversed it.
WoD p. 133 pins the timing twice: going for broke is announced "before
the activity is performed," and the three dice are added during pool
composition "before all penalties for your roll have been applied — form
your pool, add all bonuses, including your three dice from Willpower, and
then subtract all penalties." The Paradox dice loss is such a penalty, and
Mage p. 125 runs the Paradox check only "after the player has figured out
all of the above elements." So the spend belongs in the cast builder, part
of the declared pool that Paradox later erodes — backlash is the only
post-Paradox liberty the book grants. The existing declaration-time
`spendWillpower` toggle (issue #12) was already correct; the cockpit
dice-line simply renders the Willpower dice as pool members, as losable to
Paradox as any other die.

**Drafting lives on the Cast document.** Box clicks and the Willpower
toggle write draft fields via cheap seam-checked mutations (actor is
caster, status is the Paradox phase, boxes in range — no rules consequence
until commit); the Cast click finalizes them. Spectators watch through the
same Convex reactivity as everything else; a reconnecting caster drops back
into their half-built sacrifice (0016's rehydration promise, kept). The
doc stays the single source of truth and the card stays an ADR-0020
class-1 projection — the "draft" is server-held, not a client working
copy. Consequence accepted deliberately: drafting is genuinely public,
un-clicks included. No poker face.

## The stage answer

**The card, docked — never a takeover.** While a Cast is live (engaged →
resolved) its card pins to the foot end of the feed: the record scrolls
above it, the plain roller and input foot stay reachable below it. On
resolution the card releases into the record flow at its chronological
place, shrunk to its record form. The feed's identity, for #103: **pure
record, plus at most one docked cockpit while the stage is occupied.**

A takeover was rejected on the map's own standing rules: it buries the
sacred plain roller for the length of every vulgar cast, and it blinds the
table to its own record — the stage is exclusive but the world doesn't
pause; chat and plain rolls land in the feed mid-drama. An in-flow card
was rejected because arriving entries scroll the live cockpit off-screen,
which is fatal for a two-colored "your move" rung. Docking at the foot
also honors the charting decision that the dice-fiddle area lives in one
place, every time: the cockpit *is* dice-fiddle.

## Consequences

- ADR-0016 carries an amendment note; its Why for "one mutation per beat"
  is superseded by the commitment/drafting/presentation split above.
- Schema moves are execution work, not this session's: witness count and
  ambient circumstances migrate to `SceneDoc`; `CastDoc` gains the frozen
  seed snapshot, personal adjustments, and draft fields; the status ladder
  collapses to the four-rung shape. The map's execution-revision pass
  (#76/#77/#79) picks this up; the machines (`cast-ladder`, `cast`) and
  the flows follow the document.
- The feed-hierarchy ticket (#103) inherits "record + one docked cockpit"
  as settled input.
- "Tides" is glossary vocabulary (CONTEXT.md when next touched): the
  scene-owned ambient price of vulgar magic. "Liabilities" retires — it
  was wrong-signed (a ghost's boon is not a liability).
- The Scene strip's growth is UI-polish-deferred; only its charter
  (identity row + Tides row, ST inline editing, always visible) is decided
  here.
