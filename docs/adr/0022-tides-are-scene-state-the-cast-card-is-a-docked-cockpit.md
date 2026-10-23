# Tides are scene state; the cast card is a docked cockpit

> **Amended** (2026-10-23, owner calls after MAG-45 and MAG-17's tour).
> Three notes. **The Tides wait for the fix:** pass 3's "on every seat's
> card" is withdrawn for the ST's adjustments — while the Tides are fluid
> they are the ST's thoughts in progress, like the table, and no other seat
> sees them (pills, mood, red dice), the caster included. The feed query
> withholds them (`withheldFrom` in `src/domain/activity.ts`, the visibility
> policy's home), so it is data, not styling; the fix publishes them. **The
> eaten dice are public once rolled:** on the rolled rung every seat sees
> the cast dice Paradox would eat ghosted — the caster's follow their live
> containment bet, the other seats the default outlook (nothing contained).
> **The Mana's ghosts outlive the commit:** the Paradox dice a commit
> bought off stay ghosted at the row's end until the roll, and trail the
> rolled faces on the record, so the price still reads on the felt.

> **Amended** (2026-10-23, MAG-45 — the language audit across every rung
> and seat). Three notes. **The odds beneath the felt speak one register:**
> the 2026-10-22 amendment's "stands down on that beat and nowhere else" is
> withdrawn — the under-felt line had grown three voices across the rungs
> (the declared pool's success %, a bare Paradox %, the surviving pool's
> success %). Now every rung prints the mitigation table's own row — Mana ·
> dice · Paradox · success, the cast's success priced with reality rolling
> first (`castOddsUnderParadox`): the zero row before the commit (nothing
> spent yet; where the table itself stands the row stands down), the
> committed row after it, and once reality has rolled the Paradox cell
> carries the rolled count while the success % tracks the containment bet.
> **The Storyteller reads the table on the fluid rung**, read-only, off the
> felt's provisional pool (the scene seed joins at the fix, as pass 3 says),
> its affordable rows from the caster's Mana — so the ST sees what each
> ruling does to the player's choices before fixing. The other seats do not
> see it until the fix: the ST's thoughts in progress are the ST's. **The
> ST's hand is in the Tides box:** the block of chips beneath the card
> (issue #44's input, ebb/flood steppers, Add) is retired; each shore ends
> in a skeleton pill on the ST's seat while the Tides are fluid that opens
> into a live pill — prose in its text cell, the count in its number cell —
> Enter landing it on the document. Also: from the ST's roll onward the
> Paradox faces live in the PARADOX area (the cockpit's glyph row is gone),
> and the successes the containment bet absorbs ghost there from the row's
> end — the felt's one grammar for a price being weighed.

> **Amended** (2026-10-22, MAG-44): pass 3's "the Tides-phase odds line
> prices the spell" note is narrowed. On the commit beat — the last chance
> to change your mind — the mitigation table owns the number: each row
> carries, beside its Paradox %, the cast's own success % with THAT row's
> red dice rolling first and eating one casting die per success (Mage
> p. 124), no containment assumed (the floor; the ceiling is the bare pool).
> The under-felt odds line stands down on that beat and nowhere else. The
> owner's brief: the player reads the tradeoff across one row — Mana out,
> Paradox in, spell landing — and decides "I'll take the Paradox and some
> damage for a measly few points" or "I need at least one Mana". The
> leaf is `castOddsUnderParadox` in `src/domain/probability.ts`. Also:
> the dice a selected row buys off no longer vanish from the felt — they
> ghost in place from the Paradox row's end (the cockpit's own doctrine for
> eaten cast dice), so Mana erases the scene's red dice before Gnosis's.

> **Amended** (2026-07-19, vulgar polish pass 3): six notes. **The felt's
> Paradox pool goes provisional:** the red dice no longer wait for the fix —
> from engage the felt carries a PROVISIONAL pool (Gnosis base + rote/tool +
> the ST's live adjustments; the Scene seed joins at the fix), growing and
> shrinking as tags land, on every seat's card. **The base dice are green:**
> pass 2's "Gnosis base +N" badge is withdrawn — reality's base dice
> themselves render gnosis-green (the sheet's Gnosis color) wearing the red
> torn-circle glyph, so green base + tide tags = the felt's total without a
> badge ever implying the rank. **The Tides-phase odds line prices the
> spell:** the under-felt line speaks the declared pool's success % in every
> pre-roll phase's grammar; the Paradox % lives in the mitigation table's
> rows (and alone on the committed-but-unrolled beat). **The spend rides in
> the Commit button:** "Commit − 1 ◈" on a dark inset in Mana's blue,
> reversing pass 2's glyph column; Willpower joins the inset in its own
> color, and Will wears the Mana glyph SHAPE everywhere — hue is the whole
> identity. **The Resolution is four rows:** result word in caps and green,
> cast faces, Paradox faces bare, severity lore word alone — no glyphs, no
> counts, no "manifests", no "N contained" (the ghosted track boxes carry
> containment history). No Paradox manifesting = no fourth row, which
> retires the record's grace note — pass 2's "Resolution record" home below
> is withdrawn; the cockpit's quiet slot is the grace's one voice, and the
> record carries no dramatic-failure note (flagged to the owner). **The red
> softens:** `--paradox` steps down from the commissioned #ff2b2b to a
> blood red built the palette's way — still reserved for Paradox alone.
> Chrome riding along: the tide tags are filled chips (tide color ground,
> white text — the owner's explicit call, standing as a ~2.5:1 exception
> to ADR-0021's 4.5 contrast floor, flagged for his eye rather than
> silently darkened); the mitigation modifier never badges
> the felt; the masthead stacks Will over Mana and seats the tool fact
> (the sheet header sheds its numerals and toggle); the card's felt dice
> no longer layout-glide — the frame snaps, so the dice snap with it.
>
> **Amended** (2026-07-19, vulgar polish pass 2): the Paradox-roll merge —
> the owner flagged the separate Paradox roll card in the spectator feed, so
> the roll now gets the same treatment as the release: its faces stamp onto
> the Cast document (`paradoxRolls`/`paradoxExplosions`/`paradoxIsChanceDie`
> beside the existing successes) and `rollParadox` inserts no roll entry —
> a spectator's feed carries exactly ONE artifact per cast. The pass-1 note
> below ("the Paradox roll keeps its own roll entry") is withdrawn; the
> different-actor-beats rule stands for MUTATIONS (the roll is still its own
> ST-gated mutation), it just no longer implies a separate feed record. The
> dramatic-failure grace note that lived in the roll's summary now speaks
> from the card (cockpit quiet slot, Resolution record *(the Resolution
> half withdrawn by pass 3, above: no Paradox, no fourth row)*). Also chrome: the
> ST's cancel leaves the fluid Tides phase too (redundant beside Void
> pre-commitment — nothing is spent yet); the seam still honors either
> party's cancel, same posture as #114's fixed-price strip.
>
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
> owner did not flag it). *(Withdrawn by pass 2, above: the owner flagged
> it.)* ADR-0012 stands: the accumulator reads resolved
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
declare+mitigate but kept the rest apart. *(Pass-2 clarification, header
note: "own mutation" no longer implies "own feed record" — the Paradox
roll's faces stamp the Cast document and no roll entry lands.)*

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
