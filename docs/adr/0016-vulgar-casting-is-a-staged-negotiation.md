# Vulgar casting is a staged negotiation: the Cast pipeline

Vulgar casting is modeled as a first-class **Cast** document walking a status
ladder, with one Convex mutation per dramatic beat:

```
draft → engaged (negotiation) → ST locks liabilities → caster locks intention
      → ST rolls Paradox → caster contains → caster rolls the cast → resolved
                                              (terminals: cancelled, voided)
```

The Cast document is the single source of truth; the client XState machine is a
projection of it (rehydrated on reconnect), never an owner of pending state.
The Scene's stage is exclusive — at most one engaged Cast at a time; drafts
queue in the wings (at most one unresolved Cast per character, killable by
owner or ST). The caster's lock is the point of no return: before it, either
party cancels freely in-fiction; after it, the Cast plays out or the ST voids
it (Override-stamped, per ADR-0015). There are no timeouts anywhere — pending
Casts persist until a human resolves, cancels, or voids them.

## Why

ADR-0008 established that Paradox is an interactive subsystem and deferred its
shape. Reading the procedure closely (Mage 1e pp. 124–126) fixed most of it:
mitigation is blind pre-roll insurance, the Paradox roll always precedes and
penalizes the casting roll, and containment is an informed post-roll choice —
so the casting pool cannot exist as a number until mid-procedure, and two
different humans own decisions in strict alternation.

Two genuine trade-offs were resolved:

- **One mutation per beat, not per round-trip minimum.** Same-actor steps
  could collapse (declare+mitigate, contain+roll), halving latency. Rejected:
  every mutation is a realtime event on every spectator's screen, so mutation
  boundaries are the table's dramatic beats — the ST's roll, the containment
  sacrifice, and the climax cast-click must land as separate gasps. Vulgar
  casting is a contested spectacle; the app is built to exploit that, and
  spectator drama outranks round-trip count. (Declare+mitigate did collapse —
  deliberation before commitment is table *talk*, not a reveal.)
- **Negotiation before commitment, not player-declared liabilities with ST
  veto.** The player declares intent; the ST presses the liability buttons
  (witnesses, discretionary modifiers) and the pool visibly reassembles live
  for everyone before either side locks. This mirrors real-table flow, puts
  the fiddly UI on the ST by design, and replaces an approval round-trip (or
  a redo loop) with a conversation that costs nothing — the ST was already a
  mandatory mid-cast participant.

Covert casting deliberately stays atomic (fire-and-forget, no Cast document):
it has one party, no Paradox, and no contract to enforce — unification with
vulgar casting happens at the combat-action level (tick costs), not in the
document shape.

## Consequences

- New durable nouns: `scenes` (ST-opened/closed, one active per Session) and
  `casts`. Resolved Cast documents are the system of record for the per-(scene,
  caster) Paradox accumulator — derived by reading Cast history, never by
  counting Activity Log entries (ADR-0012) and never a stored tally.
- The live Cast card in the Activity feed is a projection of the Cast document
  with role-dependent controls; immutable log entries accrue alongside it per
  beat (ADR-0009). The card is the venue, the table is the truth.
- Scene close is refused while a Cast is on stage; drafts auto-cancel.
- The health track must represent Resistant damage (containment writes it), so
  the health-box vocabulary widens from a severity literal to
  (severity, resistant) — recorded at write time even though healing rules
  that consume it come later.
- Every step mutation checks actor authority and document status, refusing
  with typed errors on the ADR-0010 taxonomy; this is the first *multi-party
  contract* under ADR-0015's second regime.
- The waiting-on-a-human states this introduces (and their reconnect story)
  are the pattern combat and all future interactive subsystems inherit.
