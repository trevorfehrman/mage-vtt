# Rules Gaps Audit

Full audit of both rulebooks against implemented domain modules. Originally conducted at 102 tests/17 modules. **All 67 gaps have been closed** — now at 155 tests across 24 modules.

## Summary

| Category | Gaps Found | Priority |
|---|---|---|
| Spellcasting subsystems (Mage) | 20 | HIGH — directly affects gameplay |
| Combat modifiers (WoD) | 20 | MEDIUM — most are edge cases |
| Mana economy (Mage) | 5 | HIGH — used every session |
| Paradox details (Mage) | 6 | HIGH — consequences of magic |
| Environmental hazards (WoD) | 8 | LOW — situational |
| Morality/Wisdom (both) | 4 | MEDIUM — degeneration system |
| Vehicles (WoD) | 1 system | LOW — rarely used |
| Objects/Structures (WoD) | 1 system | LOW — situational |
| Astral/Gauntlet (Mage) | 2 systems | LOW — specialized play |
| Duel Arcane (Mage) | 1 system | LOW — rare event |
| Dice variants (WoD) | 3 | MEDIUM — 9-again, 8-again, rote actions |

## HIGH PRIORITY GAPS (needed for typical session play)

### Spellcasting

1. **Mana cost for non-ruling improvised spells** (p.126) — costs 1 Mana unless primary Arcanum is ruling
2. **Rote Specialty +1 bonus** (p.75) — when casting rote with matching order skill
3. **Resistance against magic** (pp.121-122) — contested (Resistance + Gnosis) and automated (subtract Resistance)
4. **Spell Tolerance = Stamina** (p.128) — spells cast on a target beyond Stamina levy -1 to further casting
5. **Combined spells** (pp.128-129) — Gnosis 3/6/9 for 2/3/4 spells, -2 per additional, +1 Arcanum requirement
6. **Covert vs Vulgar classification logic** — no module derives this from spell properties
7. **Transitory duration penalty table** (p.119) — 1 turn/2 turns/3 turns/5 turns/10 turns
8. **Advanced prolonged duration table** (p.119) — with Arcanum +1: 24hr/-2, 2 days/-4, 1 week/-6, indefinite/-10
9. **Extended casting success-requirement tables** (pp.120-121) — different from instant penalty tables
10. **Concentration duration** (p.119) — no other actions, no Defense, Resolve + Composure if attacked
11. **Sympathetic casting drawbacks** (p.116) — loses Defense, always vulgar, +1 Arcanum for Pattern spells

### Mana Economy

12. **Pattern Restoration** (p.77) — 3 Mana per 1 bashing/lethal healed, daily limits by Gnosis
13. **Pattern Scouring** (pp.77-78) — sacrifice 1 Physical Attribute dot = 3 Mana (restores in 24hr)
14. **Oblation** (p.77) — Gnosis + Composure at Hallow, 1 Mana per success, capped by Hallow rating
15. **Mana per turn lookup** — Gnosis table column not connected to resources.ts
16. **Starting Mana = Wisdom** (p.69) — not enforced in character creation

### Paradox Details

17. **Paradox duration by Wisdom** (p.268) — Bedlam/Anomaly/Branding/Manifestation duration tables
18. **Paradox backlash** (p.124) — convert Paradox successes to Resistant bashing, one-for-one
19. **Havoc resolution** (p.268) — Wisdom roll, failure reverses spell
20. **Bedlam derangement severity** (p.268) — Arcanum 1-3 = mild, 4-5 = severe, per-Arcanum table
21. **Anomaly effects by Path** (pp.271-272) — area = 20 yards per Arcanum dot, Path-specific effects
22. **Branding severity** (pp.272-273) — 5 tiers from Uncanny Nimbus to Inhuman Feature

### Dice System

23. **9-again** — reroll 9s and 10s (used by Large Ax, Great Ax, and supernatural effects)
24. **8-again** — reroll 8, 9, and 10 (used by some supernatural effects)
25. **Rote action** — failed dice can be re-rolled once

## MEDIUM PRIORITY GAPS (come up in some sessions)

### Combat Modifiers

26. Defense degradation: -1 per attacker after the first
27. Dodge: double Defense as full action, degrades per attack
28. Grapple subsystem: initiate, break free, 8 overpowering maneuvers
29. Autofire: short/medium/long burst bonuses and targeting
30. Range penalties for firearms: short 0, medium -2, long -4
31. Shooting into close combat: -2 per combatant avoided
32. Cover/penetration: Durability rating, success pass-through
33. Charging: double Speed + attack, lose Defense
34. Going prone: -2 ranged against, +2 melee against
35. Specified targets: torso -1, leg/arm -2, head -3, hand -4, eye -5
36. Knockout/Knockdown/Stun effects
37. Killing blow against helpless targets
38. Armor dual-rating (general vs ballistic)
39. Weapon Strength requirements
40. Aimed spell attack modifiers (cover, armor, prone apply)

### Morality/Wisdom

41. Wisdom degeneration roll system (sin hierarchy, dice pools)
42. Derangement system (13 derangements with mechanical effects)
43. Wisdom effects on Social rolls with spirits
44. Morality system from WoD core (parallel to Wisdom)

### Character Advancement

45. XP cost table (not just stored in JSON — needs validation logic)
46. Arcana mastery caps by Gnosis (validation)
47. Gnosis-based attribute/skill maximums
48. Rote design rules (5 dots mastery, 10 castings, extended action)

### Resonance

49. Full scrutiny system with density modifiers and success thresholds
50. Disguising resonance (Occultation effect)
51. Sensing scrutiny (Wits + Composure)

## LOW PRIORITY GAPS (specialized situations)

52. Vehicle system (Durability, Acceleration, crash damage, etc.)
53. Object/Structure system (Durability + Size = Structure)
54. Environmental hazards: fire, falling, electrocution, explosives, poison, disease, temperature, deprivation, fatigue, drugs
55. Disbelief/Unraveling (Resolve + Composure vs Potency)
56. Duel Arcane (mage vs mage formal combat)
57. Astral journey mechanics (meditation, Willpower as Health)
58. Gauntlet Strength table
59. Spirit Influence system (5 levels, Essence costs)
60. Spirit Essence economy (daily cost, harvesting, theft)
61. Soul loss/Soul stone mechanics
62. Demesne creation and effects
63. Creative Thaumaturgy guidelines
64. Acamoth Investments
65. Goetic Struggle
66. Tass storage rules
67. Blood sacrifice rules

## Data Discrepancy Found

- ~~`spirits.ts` has Rank 4 max Essence = 30, but the book says 25 (p.317). Fix needed.~~ **FIXED.**

## Verification Approach

For each gap implemented:
1. Read the exact page(s) cited
2. Write a test that exercises the rule
3. Confirm the test matches the book's formula/table
