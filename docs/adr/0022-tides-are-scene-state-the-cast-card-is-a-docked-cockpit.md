# Tides are scene state; the cast card is a docked cockpit

> **Amended** (2026-07-19, #112 audit → #113): containment drafting is no
> longer broadcast working state — the per-click `setDraftContainment`
> mutation made the cockpit sluggish, and the owner reversed it. Containment
> selection is client-local; the Cast click is the first the server (and so
> the table) hears of the sacrifice. "One mutation per commitment" stands;
> the "drafting is broadcast" half and its no-poker-face consequence are
> withdrawn. Reconnecting mid-cockpit now resets the selection to zero.
>
> **Amended** (2026-07-19, #112 audit → #114): the two-colored rungs are
> withdrawn — the tracker wears one green in all weathers, and the
> whose-move job returns to "waiting on" prose in a dedicated status zone
> at the card's foot (the don't-make-me-think ruling outweighed the
> charter's prose ban). The rung's table name is **Tides**, not "The
> Price" (the wire status literal stays `"price"`). And a frozen price
> strips the Storyteller's cancel — chrome only for now; the server still
> honors either party's cancel, enforcement deferred with the ST-UI
> project.
>
> **Amended** (2026-07-19, the vulgar polish pass): two notes. **Vocabulary:**
> the settling verb is **fix**, not freeze — the button reads "Fix the
> Tides", the narration "fixes the Tides", the domain predicate is
> `isPriceFixed` — everywhere the table can read (the wire status literal
> stays `"price"`, as #114 ruled). **The resolution merge:** the release no
> longer inserts a separate roll entry beside the resolved card — the
> release roll's faces stamp onto the Cast document (`castRolls` and kin)
> and the resolved card IS the record, one card in the feed instead of two.
> The Paradox roll keeps its own roll entry (a different actor's beat; the
> owner did not flag it). ADR-0012 stands: the accumulator reads resolved
> Cast rows, which never stopped being written.
>
> **Amended** (2026-07-19, the card takeover): "docked, never a takeover"
> answered a question about the FEED, and for the feed it stands — record
> plus at most one live card. New doctrine for the **roll zones**: while a
> cast is live, the card IS the caster's and the Storyteller's roll zones —
> one artifact, rendered by seat, engage/decline included — and the feed
> carries the live card **only for spectators** (total absence for the two
> seats holding it). The takeover-rejection rationale below is superseded
> for those zones: burying the caster's plain roller is honest (the #109
> seam already refuses their rolls), and the ST watching a live cast has no
> other roll to make. On resolution the zones free and the record card
> lands in the feed for everyone, as before.

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

*(Amended 2026-07-19, the vulgar polish pass: the verb is **fix** — "Fix
the Tides" — everywhere the table reads; this section keeps its original
wording as adopted. The mechanics are unchanged.)*

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
ticket's original charter question). *(Amended 2026-07-19, #114: withdrawn —
the phases still gate the mutations, but the tracker renders one green and
the prose returned in a dedicated status zone; see the header note.)*

**One mutation per commitment; drafting is broadcast working state;
presentation may unpack a commitment into multiple beats.** *(Amended
2026-07-19, #113: the broadcast-drafting clause is withdrawn — containment
drafting is client-local until the Cast click.)* This refines
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

**Drafting lives on the Cast document.** *(Amended 2026-07-19, #113: it
doesn't anymore — this whole section is withdrawn; containment selection is
client-local and the Cast click is its first server contact.)* Box clicks and the Willpower
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

**The card, docked — never a takeover.** *(Amended 2026-07-19, the card
takeover: this answered the feed, where it stands for spectators — but the
roll zones ARE taken over now; see the header note.)* While a Cast is live
(engaged → resolved) its card pins to the foot end of the feed: the record
scrolls above it, the plain roller and input foot stay reachable below it.
On resolution the card releases into the record flow at its chronological
place, shrunk to its record form. The feed's identity, for #103: **pure
record, plus at most one docked cockpit while the stage is occupied.**

A takeover was rejected on the map's own standing rules: it buries the
sacred plain roller for the length of every vulgar cast, and it blinds the
table to its own record — the stage is exclusive but the world doesn't
pause; chat and plain rolls land in the feed mid-drama. *(Amended
2026-07-19: for the caster's and ST's roll zones this rationale is
superseded — the #109 seam already buries the caster's roller in law, and
the zone takeover leaves the feed's record fully readable beside the card.)*
An in-flow card was rejected because arriving entries scroll the live
cockpit off-screen, which is fatal for a two-colored "your move" rung.
Docking at the foot also honors the charting decision that the dice-fiddle
area lives in one place, every time: the cockpit *is* dice-fiddle.

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
