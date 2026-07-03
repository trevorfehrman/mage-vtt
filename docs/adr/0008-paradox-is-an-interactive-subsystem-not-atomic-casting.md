# Paradox is a separate interactive subsystem, not part of atomic casting

Spellcasting is split by Aspect. The first `castSpell` thread handles **Covert**
improvised casting only — which by the rules never rolls Paradox — and is a single
atomic mutation (read sheet → build pool → spend Mana → roll → log). **Vulgar**
casting, and the entire Paradox subsystem, is deferred to its own later thread and
is explicitly *not* modeled as one atomic function. A `castSpell` invoked for a
Vulgar spell fails with a typed `VulgarCastingNotYetSupported` error rather than
silently skipping Paradox.

## Why

Reading the rulebook (Mage 1e, pp. 126–128) showed the design sketch's atomic
`applyParadoxDamage(...)` was not faithful. Paradox is a **Storyteller-driven
negotiation with two human decision points and intermediate state that must be
seen before the next decision**:

1. The **Storyteller** rolls the Paradox pool *before* the casting roll.
2. **Mitigation** (pre-roll): the caster may spend Mana, one point per die, to
   shrink that pool.
3. **Backlash** (post-roll): after successes are revealed, the caster may
   voluntarily absorb *some or all* of them as Resistant bashing damage, capped by
   remaining Health.

None of these fit a single server-side mutation: the player must see the Paradox
roll before choosing how much to contain. Covert casting has none of this, so it
is a complete, correct, and much smaller first spell thread — and it still
exercises everything the thread exists to prove (the `CharacterSheet` mirror,
`spendMana`, roll + activity-log write). It does not even need `healthTrack` on
the mirror, since nothing damages health.

## Consequences

- **What the Paradox thread will first need** (now known from the rules): a
  **Scene** concept (pools grow +1 per prior Paradox roll in the same Scene),
  **Storyteller-rolls-Paradox** authority, and a **two-step interaction**
  (mitigate → ST rolls → contain).
- **Health/Resistant damage** is out of scope until then. Note the rules
  distinguish *Resistant* damage (backlash) from ordinary damage; the current
  `HealthTrack` does not track that distinction and will need to when Paradox
  lands.
- **Covert-only v1 leaf gaps** shrink to: `spendMana(current, cost) → remaining |
  InsufficientMana`; composing total Mana cost (`improvisedManaCost` + sympathetic
  surcharge); and a `CastingPool → DicePool` conversion respecting the per-component
  dot limit.
