# Complete Rules Encoding Plan

Every mechanical system from the Mage: The Awakening 1e core rulebook, mapped to implementation status and planned domain module.

## Verification Method

Each section references the PDF page range. After implementation, we verify completeness by:
1. Reading the extracted page text for that range
2. Listing every rule/mechanic mentioned
3. Confirming each has a corresponding test

---

## Phase 1: Character Foundation ✅ COMPLETE

### Character Creation (pages 64-76)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Concept, Virtue, Vice | ✅ | character.ts | 1 |
| Attribute allocation 5/4/3, base 1 per attr | ✅ | character.ts | 2 |
| Skill allocation 11/7/4 | ✅ | character.ts | 1 |
| Skill Specialties (3 general) | ❌ | character.ts | — |
| Path selection + resistance bonus | ✅ | character.ts | 1 |
| Order selection + rote specialties | ✅ | character.ts | 1 |
| Arcana allocation (6 dots, ruling req) | ✅ | character.ts | 1 |
| Starting Gnosis (1) | ❌ | character.ts | — |
| Starting Wisdom (7) + tradeoff | ✅ | character.ts | 1 |
| Merit selection (7 dots, prereqs) | ✅ | merits.ts | 5 |
| Derived stats (health, willpower, defense, init, speed) | ✅ | character.ts | 1 |
| Max Mana from Gnosis table | ✅ | character.ts | 1 |

### Gnosis Effects (pages 76-78)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Gnosis table (mana, paradox, aura, time per roll) | ✅ data | character-rules.json | — |
| Arcana mastery limits per Gnosis | ✅ data | character-rules.json | — |
| Gnosis-based validation in character | ❌ | character.ts | — |

### Merits (pages 79-91)
| Rule | Status | Module | Tests |
|---|---|---|---|
| 9 Mage-specific Merits | ✅ | merits.ts | 1 |
| Dot range validation | ✅ | merits.ts | 1 |
| Prerequisite validation | ✅ | merits.ts | 1 |
| WoD core Merits (Allies, Contacts, Resources, etc.) | ❌ | merits.ts | — |

### Health & Damage (WoD core rules)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Health track (Stamina + Size boxes) | ✅ | health.ts | 1 |
| Bashing/Lethal/Aggravated damage | ✅ | health.ts | 3 |
| Severity sorting | ✅ | health.ts | 2 |
| Overflow upgrade mechanic | ✅ | health.ts | 2 |
| Wound penalties (-1/-2/-3) | ✅ | health.ts | 1 |
| Healing rates (bashing/lethal/aggravated) | ❌ | health.ts | — |
| Incapacitation / bleeding out | ❌ | health.ts | — |

### Dice System (WoD core rules)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Roll d10 pool, count successes (8-10) | ✅ | dice.ts | 1 |
| Exploding 10s (recursive) | ✅ | dice.ts | 1 |
| Chance die (pool ≤ 0) | ✅ | dice.ts | 1 |
| Dramatic failure (chance die rolls 1) | ✅ | dice.ts | 1 |
| Exceptional success (5+ successes) | ✅ | dice.ts | via schema |
| Pool components validation | ✅ | dice.ts | 2 |
| Modifier dice (bonus/penalty) | ✅ | dice.ts | 1 |

### Resources (pages 76-78)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Willpower (Resolve + Composure, spend/recover) | ❌ | resources.ts | — |
| Mana (max from Gnosis, spend per turn limit, recover) | ❌ | resources.ts | — |
| Wisdom (moral stat, degeneration rolls) | ❌ | resources.ts | — |
| XP / Arcane XP tracking | ❌ | resources.ts | — |

---

## Phase 2: Spellcasting System (pages 109-131)

The largest and most complex system. This is the core of what makes Mage different.

### Spell Structure (pages 109-113)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Imago (spell in the mind's eye) | ❌ | spellcasting.ts | — |
| Improvised vs Rote casting | ❌ | spellcasting.ts | — |
| Improvised dice pool: Gnosis + Arcanum | ❌ | spellcasting.ts | — |
| Rote dice pool: Attribute + Skill + Arcanum | ❌ | spellcasting.ts | — |
| Instant vs Extended casting | ❌ | spellcasting.ts | — |
| Extended casting: target successes, time per roll | ❌ | spellcasting.ts | — |
| Conjunctional spells (multiple Arcana) | ❌ | spellcasting.ts | — |
| Combined spells (p. 130) | ❌ | spellcasting.ts | — |

### Spell Aspects (pages 114-116)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Covert vs Vulgar distinction | ❌ | spellcasting.ts | — |
| Improbable magic (covert but unlikely) | ❌ | spellcasting.ts | — |
| Sleeper witnesses affect Paradox | ❌ | spellcasting.ts | — |
| Hiding magic in plain sight | ❌ | spellcasting.ts | — |

### Spell Range (pages 116-117)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Sensory range (default) | ❌ | spellcasting.ts | — |
| Sympathetic range (with Space 2) | ❌ | spellcasting.ts | — |
| Sympathetic connection levels (Intimate → Unknown) | ❌ | spellcasting.ts | — |
| Sympathetic dice penalties | ❌ | spellcasting.ts | — |

### Spell Factors (pages 117-122)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Potency (spell power / damage) | ❌ | spell-factors.ts | — |
| Duration (transitory → indefinite) | ❌ | spell-factors.ts | — |
| Target factor (number/size affected) | ❌ | spell-factors.ts | — |
| Advanced spell factor table (dice penalties) | ❌ | spell-factors.ts | — |
| Aimed spells (Dexterity + Firearms/Athletics) | ❌ | spell-factors.ts | — |

### Paradox (pages 123-127)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Paradox dice pool calculation | ❌ | paradox.ts | — |
| Vulgar without witnesses | ❌ | paradox.ts | — |
| Vulgar with Sleeper witnesses | ❌ | paradox.ts | — |
| Paradox outcomes: Havoc | ❌ | paradox.ts | — |
| Paradox outcomes: Bedlam | ❌ | paradox.ts | — |
| Paradox outcomes: Branding | ❌ | paradox.ts | — |
| Paradox outcomes: Manifestation (Abyssal entity) | ❌ | paradox.ts | — |
| Containing Paradox (Wisdom roll) | ❌ | paradox.ts | — |
| Paradox and Demesnes (vulgar = covert) | ❌ | paradox.ts | — |

### Counterspelling & Dispelling (pages 127-129)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Counterspell (reflexive, same Arcanum) | ❌ | counterspell.ts | — |
| Counterspell with Prime (any spell) | ❌ | counterspell.ts | — |
| Dispelling existing spells | ❌ | counterspell.ts | — |
| Spell control (maintaining/relinquishing) | ❌ | counterspell.ts | — |
| Spell tolerance (max active spells = Gnosis) | ✅ | character.ts | 1 |

### Mage Sight (pages 110-111)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Active Mage Sight (costs 1 Mana) | ❌ | mage-sight.ts | — |
| Peripheral Mage Sight (reflexive Wits + Composure) | ❌ | mage-sight.ts | — |
| Scrutiny (extended Intelligence + Arcanum) | ❌ | mage-sight.ts | — |

### Resonance & Scrutiny (pages 276-282)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Resonance types (subtle vs gross) | ❌ | resonance.ts | — |
| Scrutinizing beings and objects | ❌ | resonance.ts | — |
| Scrutinizing spells (composition, potency, etc.) | ❌ | resonance.ts | — |
| Resonance qualities | ❌ | resonance.ts | — |

### Enchanted Items & Artifacts (pages 283-288)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Enhanced items (altered properties) | ❌ | items.ts | — |
| Imbued items (spell powers) | ❌ | items.ts | — |
| Artifacts (Supernal origin) | ❌ | items.ts | — |

### Demesnes (pages 280-282)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Demesne creation (soul stone) | ❌ | demesne.ts | — |
| Vulgar = Covert within Demesne | ❌ | demesne.ts | — |
| Path-flavored atmosphere | ❌ data only | — | — |

### Creative Thaumaturgy (pages 289-293)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Improvised spell guidelines | ❌ | creative-thaumaturgy.ts | — |
| Practice levels (Knowing → Unmaking) | ❌ data | — | — |
| Archmastery (6+ dots, pages 290-293) | ❌ | — | — |

---

## Phase 3: Spells Reference Data ✅ MOSTLY COMPLETE

### All 10 Arcana spell lists (pages 133-275)
| Arcanum | Spells | Rotes | Status |
|---|---|---|---|
| Death | 43 | extracted | ✅ in Convex |
| Fate | 32 | extracted | ✅ in Convex |
| Forces | 50 | extracted | ✅ in Convex |
| Life | 47 | extracted | ✅ in Convex |
| Matter | 29 | extracted | ✅ in Convex |
| Mind | 39 | extracted | ✅ in Convex |
| Prime | 33 | extracted | ✅ in Convex |
| Space | 29 | extracted | ✅ in Convex |
| Spirit | 33 | extracted | ✅ in Convex |
| Time | 24 | extracted | ✅ in Convex |

365 spells, 372 rotes — all in Convex as structured data.

---

## Phase 4: Combat & Conflict

### Combat System (WoD core + homebrew)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Tick-based initiative (HOMEBREW) | ❌ | initiative.ts | — |
| Attack rolls (Attribute + Skill + weapon) | ❌ | combat.ts | — |
| Defense (lower Dex/Wits + Athletics) | ✅ derived | character.ts | 1 |
| Dodge (double Defense, costs action) | ❌ | combat.ts | — |
| Armor (general vs ballistic) | ❌ | combat.ts | — |
| Ranged combat (Dex + Firearms) | ❌ | combat.ts | — |
| Cover bonuses | ❌ | combat.ts | — |
| Grappling | ❌ | combat.ts | — |
| Weapon stats | ❌ data | combat.ts | — |
| Damage application (attack successes) | ❌ | combat.ts + health.ts | — |

### Social Conflict (WoD core)
| Rule | Status | Module | Tests |
|---|---|---|---|
| Persuasion / Intimidation / Manipulation rolls | ❌ | — | — |
| Social combat (extended actions) | ❌ | — | — |

---

## Phase 5: Antagonists & NPCs (pages 293-343)

### NPC Systems
| Rule | Status | Module | Tests |
|---|---|---|---|
| Spirit stat blocks (Power/Finesse/Resistance) | ❌ | spirits.ts | — |
| Spirit Numina (powers) | ❌ data | — | — |
| Ghost stat blocks | ❌ | ghosts.ts | — |
| Abyssal entity stat blocks | ❌ | — | — |
| NPC mage templates | ❌ | — | — |

---

## Phase 6: Legacies (pages 343-370)

### Legacy System
| Rule | Status | Module | Tests |
|---|---|---|---|
| Legacy creation/joining rules | ❌ | legacies.ts | — |
| Attainments (Legacy powers) | ❌ | legacies.ts | — |
| Example Legacies (stat blocks) | ❌ data | — | — |

---

## Phase 7: App-Level Systems (not from book)

### Session Management
| Feature | Status | Module | Tests |
|---|---|---|---|
| Create session | ✅ | session.ts | 1 |
| Join via invite code | ✅ | session.ts | 1 |
| Reject invalid/duplicate joins | ✅ | session.ts | 2 |
| Assign character to session | ✅ | session.ts | 2 |

### Chat
| Feature | Status | Module | Tests |
|---|---|---|---|
| Public messages | ✅ | chat.ts | 1 |
| Whisper visibility | ✅ | chat.ts | 2 |
| System messages | ✅ | chat.ts | 1 |
| Storyteller sees all | ✅ | chat.ts | 1 |

### Dice Roll Visibility
| Feature | Status | Module | Tests |
|---|---|---|---|
| Public rolls (all see) | ❌ | dice.ts | — |
| Hidden rolls (ST only) | ❌ | dice.ts | — |

### Infrastructure
| Feature | Status | Notes |
|---|---|---|
| Auth (Better Auth + Google) | ✅ | Working |
| Convex backend | ✅ | Schema + data loaded |
| Convex-Effect wrapper | ❌ | Needed for server-side Effect |
| Real-time sync | ❌ | Convex subscriptions |
| RAG query endpoint | ❌ | Data in Convex, no query function |
| Vercel deployment | ✅ | Working |
| CI | ✅ | 40 tests passing |

---

## Implementation Order

1. ~~Phase 1: Character Foundation~~ ✅ (40 tests)
2. **Phase 1 gaps**: Resources, skill specialties, gnosis defaults, healing, incapacitation, roll visibility, WoD core merits
3. **Phase 2: Spellcasting** — the big one. Spell dice pools, factors, paradox, counterspelling.
4. **Phase 4: Combat** — tick initiative, attack/defense, weapon/armor, grappling
5. **Phase 3**: Already done (spells in Convex), but need spellcasting logic to USE them
6. **Phase 5-6**: Antagonists and Legacies — lower priority, mostly data + stat blocks
7. **Phase 7**: App infrastructure, Convex integration, UI

## Completeness Verification

For each phase, after implementation:
1. Read every extracted page in the range
2. Highlight each mechanical rule/formula/table
3. Confirm a test exercises that rule
4. Any rule without a test gets one added

This ensures nothing is missed from the source material.
