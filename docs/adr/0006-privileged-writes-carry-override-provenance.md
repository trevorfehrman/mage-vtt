# Privileged writes carry an Override provenance marker

Any enforced write produced by bending a rule — a **god-mode action** (the Dev
invoking a flow they lack normal authority for, e.g. casting for another player's
character) or a **repair** (the Dev direct-setting state outside the rules) —
carries a structured **Override** marker on the resulting Activity records
(`{ invokedByUserId, invokedByName, kind: "godmode-action" | "storyteller-action"
| "repair" }`). Normal actions leave it absent. This makes every rule-bending act transparently
attributable at the table, rendered as a subtle UI badge.

## Why

The Dev (god-mode) can act as any character's owner and take Storyteller-gated
actions (ADR-0004 authority model). Attribution of the *action itself* follows the
character's owner — a god-mode cast must look like the owner's own action so it is
visible to them under read-visibility scoping. That correctness requirement would
otherwise make god-mode intervention **invisible**. The operator's explicit bar is
that anything they do which violates the rules must be transparent, so a separate
provenance marker records *who invoked it* on top of *whose action it is*.

## Consequences

- **The Storyteller acting in a player's stead is also a bypass** (decided in the
  `castSpell` grilling): ST full-control within their session is legitimate
  authority, but exercising it *as another player's character* — e.g. casting from
  their sheet — bypasses the ownership rule and is marked `storyteller-action`.
  Without the marker, attribution-follows-owner would make the ST's act look like
  the player's own.
- **Fires on bypass, not on identity.** The marker appears only when an authority
  check that would have failed for a normal actor was actually overridden — not
  merely because the actor `isDev`. The Dev casting their *own* character's spell
  bends no rule and is unmarked. The marker's meaning is precisely "a rule was
  bent here."
- **Stamped structurally, not by hand.** The `Authz` helpers record that a bypass
  occurred (invoker, kind) into request scope; the `GameStore` write helpers read
  it and stamp every record the mutation writes. A flow author cannot forget to
  mark a privileged action, because they never write the mark themselves — the
  same "structural, not copy-paste" discipline as the every-mutation-logs
  invariant (ADR-0003).
- **Additive schema change**, distinct from the schema-bridge slice (ADR-0005):
  the Override field is new product data, not a derived validator.
- **Erosion risk this ADR guards against.** The field is `null` on the vast
  majority of writes; a future reader may be tempted to "simplify it away." It is
  a deliberate transparency guarantee, not dead weight — do not remove it.
