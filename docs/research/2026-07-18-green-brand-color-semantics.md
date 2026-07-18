# Green-brand color semantics: how systems untangle brand ≠ semantic

> Researched 2026-07-18 against primary sources (official design-system docs,
> first-party design blogs, GDC talks, engine/game documentation, W3C). Every claim is
> tagged **[VERIFIED]** (source was read) or **[INFERRED]** (extrapolation from
> verified facts). Wayfinder ticket: issue #97 (map: #95). This report names patterns
> and maps them onto the verdigris/ember situation; it does **not** make the decision —
> that belongs to a later grilling session.

## TL;DR

The "brand color = semantic color" collision has a standard first move and a menu of
second moves. The first move, converged on independently by every major design system
surveyed, is a **semantic-role token layer**: meaning lives in the token name
(`feedback`/`support`/`sentiment` families) architecturally separated from the
brand/`action`/`accent` family, so the two can never silently collide (Curtis's
option→decision tokens; Carbon `support-*` vs `interactive`; SLDS's "reserved for"
language; W3C DTCG aliases). The second moves, observed in shipped systems, form a
spectrum: **evict** the brand hue from product UI so the semantic hue is freed
(Shopify Polaris — brand green went neutral near-black); **merge** brand and success
under two token names holding one hex, kept legible by rationing the hue (Spotify —
`brightAccent` = `positive` = #1ed760); **split the hue** at hard tonal distance
(Wise lime #9FE870 brand vs forest #054D28 success; Pinterest brand at ramp step 450,
error at 500/300); **pull apart in hue** until they read as different colors (Airbnb
Rausch pink-red vs Arches orange-red); or hold the semantic palette **outside** the
brand's palettes entirely, static under brand drift (Material 3's error role, the lone
baseline semantic role — success notably absent from M3's baseline). Game UIs answer a
prior question: they spend hue on **identity/taxonomy** (rarity, class, god, role —
where green means dexterity and red means Heroic) and carry affirm/cancel on
**position, button glyphs, platform convention, and friction** — with WCAG 1.4.1 as
the floor: color is never the only carrier. For mage-vtt the survey's sharpest
observations: verdigris currently does brand *and* success work with no token seam
between them; the ember sits on the hue most systems spend on *warning*; and the
games' answer — identity colors never moonlight as affirm/cancel — is the pattern
closest to the repo's own declared grammar. The decision stays open for the grilling
session (§ Applicability).

---

## Local grounding (the knot as it exists today)

- The brand/theme color is verdigris `--accent: #6fae97`, which is also mapped to
  shadcn `--primary` — [`src/styles.css`](../../src/styles.css) ~23, ~86. [VERIFIED]
- Verdigris currently carries **go/success** semantics: roll successes render
  `var(--accent)` ([`ActivityLog.tsx`](../../src/components/game/ActivityLog.tsx) ~218,
  ~273; [`CastCard.tsx`](../../src/components/game/CastCard.tsx) ~258, ~270, ~735). [VERIFIED]
- Destructive/failure is `--bad: #b56d60` (muted terracotta), mapped to shadcn
  `--destructive`; paradox successes and dramatic failure render `var(--bad)`. [VERIFIED]
- The secondary "caster's hand" color is ember `--ember: #e29659`, worn on pool-building
  **selection** (`styles.css` ~26–31, ~303–306: "selection burns ember, not verdigris —
  the pool is the caster's hand") — an orange that flirts with cancel/danger semantics. [VERIFIED]
- The declared color grammar (owner, 2026-07-18): *verdigris is the world's magic; the
  ember is the player's own act.* Both hues therefore already carry **identity** duties
  in addition to their de-facto **semantic** duties — the exact collision this report
  researches. [VERIFIED]

---

## The token-architecture literature: the collision has a standard answer

Every major system independently converges on the same untangling move: **separate
"what the color is" from "what the color means," and reserve a dedicated slot for
status meanings that is architecturally distinct from the brand/accent slot.**

### Option tokens vs decision tokens (Nathan Curtis, EightShapes)

The original tier vocabulary. "Every design system offers **options**… A system's
strength comes from knowing how to apply options (like $color-neutral-20) to contexts…
This grounds the option as a **decision**." — "Tokens are decisions propagated through
a system," and "options aren't good enough"
([Tokens in Design Systems](https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421)). [VERIFIED]
His naming article goes further and names the two colliding **concept families**
directly: `feedback` (variants `success`/`warning`/`error`) vs `action` (aka
`interactive`, corralling call-to-action colors) — so `$color-feedback-success` and
`$color-action-primary` are separate families *by construction*; the brand can rebrand
without touching feedback
([Naming Tokens in Design Systems](https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676)). [VERIFIED]

### Color roles with a reserved semantic slot (Material Design 3)

M3's primary/secondary/tertiary are explicitly the **brand roles** ("customize to
represent your brand color"), while **error is the lone baseline semantic role** —
and it "is static and doesn't change even in dynamic color schemes" while brand roles
re-derive from the user's wallpaper seed
([m3.material.io/styles/color/roles](https://m3.material.io/styles/color/roles);
[material-components Color.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md)). [VERIFIED]
**Success is absent from the baseline scheme** — M3's own escape hatch is custom/static
colors: "You may need to apply static colors… to communicate semantic meaning, **like a
green success state**," and harmonization may "shift your static colors' hues slightly
warmer or cooler… **while retaining the semantic meaning associated with the colors'
hue range**"
([define-new-colors](https://m3.material.io/styles/color/advanced/define-new-colors)). [VERIFIED — via rendering proxy;
success-role absence independently corroborated by the GitHub Color.md]
That last quote is the strongest statement in the survey that *hue-range = meaning, and
brand drift must not violate it*.

### Role-based tokens with a `support-*` family (IBM Carbon)

"Tokens are role-based, and themes specify the color values that serve those roles…
Unlike hex codes, tokens apply universally across themes. For example, `$layer`,
`$border-subtle`, `$support-error`"
([Carbon color overview](https://carbondesignsystem.com/elements/color/overview/);
[tokens](https://carbondesignsystem.com/elements/color/tokens/)). [VERIFIED]
The semantic slot is the `support-*` family (`$support-error` Red 60,
`$support-success` Green 50, `$support-warning` Yellow 30, `$support-info` Blue 70);
the brand/interactive slot is separate (`$interactive` Blue 60 — "selected elements /
active elements / accent icons"). Note the subtlety: Carbon's brand IS blue and its
info color IS blue, and they resolve it **at the token layer with two different blues**
(Blue 60 vs Blue 70), not by abandoning the hue. [VERIFIED]

### Semantic meanings as parallel roles, brand included (Spectrum, Atlassian, SLDS)

- **Adobe Spectrum** names the collision explicitly: "Spectrum's semantic meanings
  include **informative, accent, negative, notice, and positive**" — and **blue carries
  both informative and accent**, resolved by giving blue two distinct semantic slots
  rather than one overloaded one. Also: "When using color with semantic meaning, you
  must also display text or an icon in order to ensure the meaning is not lost"
  ([spectrum.adobe.com/page/color-system](https://spectrum.adobe.com/page/color-system/)). [VERIFIED — via rendering proxy]
- **Atlassian**: "Color roles describe the intention behind the color" — success,
  danger, warning, information, discovery, and **brand** as a *parallel role among the
  semantic ones*, not the parent of them; plus guidance not to use "an accent when the
  color has semantic meaning"
  ([atlassian.design/foundations/color-new](https://atlassian.design/foundations/color-new/)). [VERIFIED]
- **Salesforce SLDS** has the clearest "don't spend brand on status" language: accent
  colors "express a brand's accent color… or draw attention to an action," while
  "**Error colors are reserved for**…", "**Success colors are reserved for**…" — the
  word *reserved* appears in every feedback definition and never in the accent
  definition
  ([SLDS global styling hooks guidance](https://v1.lightningdesignsystem.com/platforms/lightning/new-global-styling-hooks-guidance/)). [VERIFIED on v1 static page]

### Palette composition: semantic scales alongside, not from, the accent (Radix Colors)

"For most projects, you will need colors to communicate semantic meaning. Here are some
common pairings… **Error**: red, ruby, tomato, crimson — **Success**: green, teal,
jade, grass, mint — **Warning**: yellow, amber, orange — **Info**: blue, indigo, sky,
cyan" — chosen as *additional scales alongside* the accent scale picked for brand
([composing-a-palette](https://www.radix-ui.com/colors/docs/palette-composition/composing-a-palette)). [VERIFIED]
No explicit "don't use accent for semantic" prohibition exists in Radix docs — the
separation is structural, not prohibitional. [VERIFIED absence]
The 12-step scale also shows semantics-by-*step* within one hue: steps 1–2 app
backgrounds, 3–5 component states, 6–8 borders/focus, 9–10 solid ("step 9 has the
highest chroma"), 11–12 text
([understanding-the-scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)). [VERIFIED]

### Alias tokens as the standardized mechanism (W3C DTCG)

"A design token's value can be a reference to another token… Aliases are useful for:
Expressing design choices… **Creating semantic relationships between tokens**…"
— the curly-brace reference "always resolves to the `$value` property of the target
token" ([DTCG format spec](https://www.designtokens.org/TR/drafts/format/)). This is
the standardized mechanism under Curtis's option→decision layering: `{color.green.9}`
aliased as `color.feedback.success`. [VERIFIED]

### The accessibility backstop (WCAG 1.4.1)

"Color is not used as the only visual means of conveying information, indicating an
action, prompting a response, or distinguishing a visual element" (Level A) — with
"error is shown in red" alone listed among the failure examples
([Understanding SC 1.4.1](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)). [VERIFIED]
Implication: even a perfectly untangled token architecture doesn't license color-only
status; a brand-hued success is *survivable* if redundant cues exist — but the systems
above still reserve conventional hues on top. [INFERRED from verified SC + guidance]

---

## Game UIs: hue is spent on taxonomy; affirm/cancel lives elsewhere

Across every game examined, the color budget goes to persistent world-model categories
— rarity, class/attribute, god/faction, role — and dialogs/buttons deliberately do
**not** compete for those hues. Confirm/cancel is carried by position, button glyphs,
platform convention, and interaction friction.

### Rarity ladders: the canonical hue taxonomy, colliding with traffic-light hues on purpose

- **Diablo III**: grey junk / white normal / blue magic / yellow rare / orange
  legendary / **green set** ([diablowiki.net/Items](https://www.diablowiki.net/Items) — fetch 403'd,
  tier list confirmed via search excerpt and
  [purediablo.com](https://www.purediablo.com/d3s-item-colors-and-set-item-classification-changes)). [VERIFIED tier list, secondary]
- **Diablo IV**: white / blue / yellow / orange Legendary / gold Unique
  ([charlieintel](https://www.charlieintel.com/diablo/diablo-4-rarity-system-all-rarity-colors-explained-256002/)). [VERIFIED, secondary]
- **Path of Exile**: white Normal / blue Magic / yellow Rare / orange Unique
  ([vhpg.com/poe-rarity-colors](http://www.vhpg.com/poe-rarity-colors/)); socket colors
  carry *attribute* meaning — **red = strength, green = dexterity, blue =
  intelligence** — green means dex, not "go" (mapping confirmed only via search excerpt
  of the PoE wiki; wiki fetches were bot-blocked). [VERIFIED mapping via excerpt; flagged]
- **Hades**: boon rarity Common white / Rare blue / Epic purple / **Heroic red** /
  Legendary **orange outline** — red means Heroic rarity, not danger
  ([hades.fandom.com/wiki/Boons](https://hades.fandom.com/wiki/Boons)). Gods get
  identity via color **plus a unique pictogram** (Ares red sword, Artemis green bow,
  Athena yellow shield…) — identity is never hue-only
  ([inverse.com god-symbol guide](https://www.inverse.com/gaming/hades-symbol-meaning-guide-hera-dionysus-apollo-ares-aphrodite)). [VERIFIED, wiki/press]
- **Slay the Spire**: card *color* is spent on class identity (Ironclad red / Silent
  green / Defect blue / Watcher purple); rarity is a **banner color behind the name**;
  card *type* is a **frame silhouette** (Attacks "rectangular border with the bottom
  edge tapered down," Skills plain rectangle, Powers "oval border")
  ([slaythespire.wiki.gg/wiki/Cards](https://slaythespire.wiki.gg/wiki/Cards)). [VERIFIED]
- **FFXIV**: role identity = colored background + role **pictogram** on job icons
  (tank blue, **healer green, DPS red** — identities, not affirm/cancel); role colors
  are user-remappable, which only works because the pictogram carries the meaning
  independently ([Square Enix official UI guide](https://na.finalfantasyxiv.com/uiguide/communication/chat-np/chat_np_rolecolor.html)). [VERIFIED, first-party]

### Affirm/cancel: position, glyph, convention, friction — not hue

- Strongest primary evidence that confirm/cancel is a *platform-layer* semantic:
  Sony's PS5 change making **✕ = confirm / ○ = cancel globally** (reversing 26 years of
  Japanese convention) — the affirmative is a button glyph and its cultural meaning,
  zero color involved
  ([VGC](https://www.videogameschronicle.com/news/after-26-years-ps5-will-make-x-its-default-select-button-in-japan/),
  [Kotaku](https://kotaku.com/sony-is-changing-the-confirm-and-cancel-buttons-in-japa-1845273030)). [VERIFIED]
- **Destiny** (David Candland, GDC 2016, "Tenacious Design and The Interface of
  Destiny"): rarity background-colors are the color taxonomy ("our investment team
  introduced the concept of rarity, hence the background colors to symbolize them")
  while button prompts are **TrueType font glyphs**, context-sensitive and localized —
  affirm/cancel lives in the prompt layer
  ([gdcvault.com/play/1023460](https://gdcvault.com/play/1023460/Tenacious-Design-and-The-Interface),
  [transcript](https://archive.org/details/GDC2016Candland)). [VERIFIED]
- **FFXIV** destructive confirmations use **interaction friction**: per-item
  confirmation dialogs for rare/untradeable discards, plus a checkbox the player must
  tick before Yes activates
  ([official forum thread](https://forum.square-enix.com/ffxiv/threads/410230);
  checkbox partially sourced — the corroborating GameFAQs page 403'd). [VERIFIED existence; checkbox mechanics INFERRED/flagged]
- **Diablo dialog buttons** (neutral stone-textured OK/Cancel differentiated by
  position/label): game-UI databases were unreachable (403), so treat this specific
  claim as **unsourced inference**. [FLAGGED]

### Non-hue semantic carriers, ranked by observed semantic weight

1. **Icon glyph shape** — Slay the Spire enemy *intent* is carried entirely by icon
   shape: seven attack icons escalating **dagger → scythe by damage bracket** ("weapon
   icon changes according to the damage dealt"), distinct glyphs for defend, buff,
   debuff, sleeping, stunned; composites combine glyphs
   ([wiki/Intent](https://slaythespire.wiki.gg/wiki/Intent)). Glyph **size/menace
   encodes magnitude** — a quantitative channel with no hue at all. [VERIFIED]
2. **Frame/border silhouette and ornament** — Diablo IV's lead UI designer Angela Del
   Priore (Feb 2020 Quarterly Update, first-party): they "added secondary visual cues
   for indicating rarity via the border decoration," making "rarity indicators visually
   more subtle but hopefully with a wider range in accessibility"
   ([news.blizzard.com](https://news.blizzard.com/en-us/diablo4/23308274/diablo-iv-quarterly-update-february-2020)). The
   clearest primary statement of hue-kept-but-redundantly-encoded. [VERIFIED]
3. **Audio pitch/timbre per tier** — Diablo IV: "audio cues are different depending on
   the rarity" of ground loot, configurable per rarity; plus user-selectable highlight
   colors for players/enemies/objects — hue made *configurable* because it is not the
   sole channel
   ([Blizzard accessibility post via Can I Play That](https://caniplaythat.com/2023/05/23/diablo-iv-accessibility-detailed-by-blizzard/)). [VERIFIED]
4. **Interaction friction** — FFXIV's checkbox-gated destructive dialogs (above).
5. **Secondary badge color for orthogonal axes** — Hades laurel color: gold =
   run-temporary, blue = persistent. [VERIFIED, wiki]

### General-principle sources

- GDC 2019, Douglas Pennant (Creative Assembly), "Solving an Invisible Problem:
  Designing for Color-Blindness in Games": color must never be the sole carrier of
  essential information; it reinforces shape/pattern/position
  ([gdcvault](https://gdcvault.com/browse/gdc-19/play/1025754),
  [video](https://www.youtube.com/watch?v=KbFs9ghIIEI)). [VERIFIED]
- Tulleken & Bailey, "Color in games" (Game Developer): frames color-as-**identifier**
  (factions, players, areas) vs color-as-**signifier** (interaction affordances) — the
  game-design vocabulary for exactly this split
  ([gamedeveloper.com](https://www.gamedeveloper.com/design/color-in-games-an-in-depth-look-at-one-of-game-design-s-most-useful-tools)). [VERIFIED]
- Supergiant (Jen Zee, first-party interview): builds "the color script of the game…
  to catch any oddities or weakness"
  ([MCV/Develop](https://mcvuk.com/business-news/behind-the-art-of-hades-we-value-artistic-integrity-and-excellence-in-artistic-craft-at-supergiant-however-were-first-and-foremost-a-game-design-lead-team/)); no
  primary Supergiant statement on confirm/cancel affordances was found. [VERIFIED / FLAGGED gap]

---

## Green-brand systems: three distinct strategies for the same collision

### Shopify Polaris — evict the brand hue

Polaris resolved the collision by **removing green from the brand role entirely**. The
current `brand` role is neutral near-black (`--p-color-bg-fill-brand: rgba(48,48,48,1)`,
`--p-color-icon-brand: rgba(26,26,26,1)`), freeing green to mean only success
(`--p-color-bg-fill-success: rgba(4,123,93,1)`, `--p-color-text-success`,
`--p-color-icon-success`) — [token reference](https://polaris-react.shopify.com/tokens/color),
[color roles](https://polaris-react.shopify.com/design/colors/palettes-and-roles). [VERIFIED]
- The historical arc: in `@shopify/polaris-tokens@5.0.0` the brand green and success
  green were **literally the same hex** — `action-primary: rgba(0,128,96,1)` (#008060,
  Shopify green) = `text-success` — and links/focus leaned on **blue** (`interactive:
  rgba(44,110,203,1)`) so green wasn't overloaded further; the current system then
  de-greened the brand role to neutral black
  ([v5 tokens on unpkg](https://unpkg.com/@shopify/polaris-tokens@5.0.0/dist/json/colors.light.json)). [VERIFIED from shipped npm artifacts]
- Destructive: the `critical` role, red (`--p-color-bg-fill-critical:
  rgba(199,10,36,1)`) — "elements using critical must convey messaging that implies
  that an action is impossible, blocked, or has resulted in an error." [VERIFIED]
- Selected/active: **neutral gray, not brand and not green**
  (`--p-color-bg-surface-selected: rgba(241,241,241,1)`, `--p-color-bg-fill-selected:
  rgba(204,204,204,1)`), with a separate blue `emphasis` role for focus/active-in-editor
  (`--p-color-bg-fill-emphasis: rgba(0,91,211,1)`). [VERIFIED]

### Spotify Encore — merge brand and success, keep green scarce

The opposite move: in the Encore dark theme, `--essential-bright-accent: #1ed760`
(Spotify green, the brand accent) and `--essential-positive: #1ed760` are **the same
value**; in light theme both shift together to #159542. The semantic role *names* stay
distinct (`brightAccent` vs `positive`) but hold the same green — **layering by token
name, not by hue** (Spotify's shipped Encore CSS, first-party but undocumented:
[web-player CSS](https://open.spotifycdn.com/cdn/build/web-player/web-player.a34f7443.css)). [VERIFIED from shipped CSS; Encore docs are internal — flagged]
- The partner guidance keeps green scarce: "Spotify Green is our resting color, used
  whenever Spotify's voice needs to be recognizable"; "Don't introduce new colors
  outside our brand palette"
  ([developer.spotify.com/documentation/design](https://developer.spotify.com/documentation/design)). [VERIFIED]
- Destructive: the `negative` role, red (`--essential-negative: #ed2c3f` dark /
  `#e91429` light); full semantic set: `base`, `subdued`, `brightAccent`, `negative`,
  `warning` #ffa42b, `positive`, `announcement` blue. [VERIFIED from shipped CSS]
- Selected/active accents (liked heart, active nav) use `text-bright-accent` green —
  observation of the shipped CSS structure, not a documented rule. [INFERRED/flagged]

### Wise (Neptune) — keep both greens, shift the hue hard

Brand bright-lime **#9FE870** lives in *interactive* tokens
(`--color-interactive-accent`), never in *sentiment* tokens; success is a **different,
much darker green**: `--color-sentiment-positive: #054d28` (deep forest) — visually
unmistakable even though both are green. The package has an explicit sentiment layer
(`/sentiment/{negative, neutral, proposition, success, warning}/`)
([@transferwise/neptune-tokens@8.26.0 on unpkg](https://unpkg.com/@transferwise/neptune-tokens@8.26.0/themes/personal/tokens.css)). [VERIFIED from shipped npm package; prose docs auth-walled — flagged]
- Destructive: `--color-sentiment-negative: #cb272f` red; on the dark forest-green
  theme, negative flips to light pink #ffa8ad for contrast — sentiment recolors per
  theme but is always red-family, never green. [VERIFIED]
- In the brand-green marketing theme (whole background #9FE870), interactive controls
  invert to forest #163300 — **the brand green becomes ground, and interaction color
  stops being green-on-green**. [VERIFIED]

### Duolingo — brand-first, no public semantic layer

Public guidelines define brand hierarchy only: "**Feather Green** [#58CC02] is the core
color of our brand… When in doubt, lean in to green!" with secondary colors (Cardinal
red #FF4B4B, Macaw blue, Bee yellow) described only as "splashes of delight"
([design.duolingo.com/identity/color](https://design.duolingo.com/identity/color),
content extracted from the site's own JS bundle). **No semantic roles are documented at
all** — the app's observable green=correct / red=incorrect behavior has no public
primary source. [VERIFIED brand palette; semantic layer VERIFIED-absent]

**Cross-system synthesis:** three named strategies — (1) **evict the brand hue**
(Polaris: brand went neutral, green freed for success); (2) **merge brand and success**
(Spotify: same hex under two token names, green kept scarce so the doubling stays
legible); (3) **split the hue** (Wise: lime brand vs forest success, same hue family,
hard lightness/chroma separation). All three keep destructive in the red family.

---

## Red-brand systems: when red cannot mean error

The mirror case, and the richest source of *hue-splitting* technique — these systems
cannot cede the hue, so they engineer distance inside it.

### Pinterest Gestalt — same ramp, different steps

Pinterest's base red ramp is `color.red.pushpin.*`; brand red #E60023 is a *mid-ramp
step*, `pushpin.450`, and error tokens deliberately bind to adjacent steps, never 450:
`color.background.brand` = `pushpin.450` (#E60023) while `color.text.error` /
`icon.error` / `background.error.base` / `border.error` = `pushpin.500` (**#CC0000**)
and `background.error.weak` = `pushpin.100` (#FFE0E0). Dark mode moves error to
`pushpin.300` (#F47171) while brand stays pinned at 450
([gestalt-design-tokens JSON, official repo](https://github.com/pinterest/gestalt/tree/master/packages/gestalt-design-tokens/tokens)). [VERIFIED from token source]
- Hue detail: #E60023 leans blue/pink (blue 0x23, zero green); #CC0000 is a pure darker
  red — darker *and* hue-nudged away from the brand's pink-lean. [VERIFIED values; lean INFERRED]
- The visual-refresh theme pushes separation to **two steps**: brand = `red.300`
  #E60023, `background.error` = `red.400` #B2001A, `text.error`/`icon.error` =
  `red.500` #8A0F0F. [VERIFIED]
- Reinforcement, verbatim from the color-usage doc: "Don't use color exclusively to
  convey meaning. Color should only be used as an enhancement" — and error tokens ship
  as coordinated text/icon/background/border sets, so the *shape* of an error (pale
  wash + dark text + icon) is recognizable independent of hue
  ([docs source in repo](https://github.com/pinterest/gestalt/blob/master/docs/pages/foundations/color/usage.tsx)). [VERIFIED]

### Airbnb — two named hues, opposite hue shifts

Brand and error are *different named colors* pulled apart in opposite hue directions:
brand "Rausch" `--palette-rausch: #FF385C` (magenta-leaning) vs error "Arches"
`--palette-text-primary-error: #C13515` (burnt orange-leaning brick), with
`--palette-bg-primary-error: #FFF5F3`. Unmistakably different colors at a glance
(first-party token artifact: CSS custom properties served in airbnb.com production
HTML, fetched 2026-07-18; the DLS docs themselves are private — naming established in
[Saarinen, "Building a Visual Language"](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e)). [VERIFIED from shipped artifact; flagged as undocumented]

### Vodafone Brix — protected brand role + separate functional red

Primitives split at the palette layer: `--colorVodafoneRed: #e60000` (brand) vs
`--colorRed: #bd0000` (functional "Critical" red); semantic bindings keep them apart
(`colorObjectBrand` → VodafoneRed; `colorTextCritical`/`colorIconCritical`/
`colorBorderCritical` → colorRed), and **warning is pushed to orange entirely** — the
Vodafone UK team's own words: "Vodafone Red (brand colour) becomes Primary1 (digital
colour)… Fresh Orange (brand colour) becomes Warn (digital colour)"
([@vodafone_de/brix-components on npm](https://www.npmjs.com/package/@vodafone_de/brix-components);
[Vodafone UK Design blog on Figma variables](https://medium.com/vodafone-uk-design-experience/figma-variables-at-vodafone-uk-how-we-structured-taxonomy-for-a-complex-multi-brand-design-system-693b1b95675f)). [VERIFIED]
Wrinkle: at text/icon size, `colorTextBrand` *also* binds to #bd0000 — brand-vs-critical
distinction is held at object/background/border level, not text level (presumably a
contrast concession: #e60000 fails AA small-text on white). [VERIFIED binding; rationale INFERRED]

### YouTube / Google Material — error as a palette outside the brand's tonal palettes

YouTube's official brand colors are "Red, White, and Almost Black" with YouTube Red =
**#FF0033** ([brand.youtube/color](https://brand.youtube/color)). [VERIFIED]
The Material layer YouTube's apps build on keeps `error` as a **whole separate
reference palette** outside any brand tonal palette: `--md-ref-palette-error40:
#b3261e` → `--md-sys-color-error`
([material-tokens palette.css](https://github.com/material-foundation/material-tokens/blob/main/css/palette.css);
[Material Color.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md)). Brand #FF0033 is
vivid and blue-leaning; error #B3261E is darker, desaturated brick. [VERIFIED values;
"YouTube uses exactly these error values" is INFERRED from platform docs, not a YouTube statement]

### Rakuten ReX (historical) — error *brighter* than brand

Corporate Rakuten Red is crimson **#BF0000**
([official brand guideline PDF](https://global.rakuten.com/corp/news/assets/pdf/media/Rakuten_BrandGuideline_v2.5_en.pdf));
the ReX component library's shipped CSS colors invalid states **#DF0101** — brighter
and more saturated than brand — with success #047205 and focus blue #1364FF
(`@rakuten-rex/text-field` npm artifacts; ReX was discontinued 2021 — historical). [VERIFIED from npm artifact]

### Flagged: no public primary source

**Target (Nicollet)** — nicollet/design/praxis/pulse.target.com all fail DNS and have
zero Wayback captures; only third-party portfolios remain. **Netflix (Hawkins)** — the
one public TechBlog post contains no color-semantics content; no token reference
exists. **OneTrust, Coca-Cola, Verizon, Santander** — no public docs found. None of
these can be cited on this question. [VERIFIED absence]

---

## Named patterns (synthesis)

| # | Pattern | Who documents/ships it | One-line mechanics |
|---|---------|------------------------|--------------------|
| 1 | **Semantic-role token layer** (option→decision; `feedback` vs `action` families) | Curtis/EightShapes, W3C DTCG, Carbon (`support-*` vs `interactive`), Atlassian, SLDS ("reserved for"), M3 (roles) | Meaning lives in the token name, not the hex; brand and status are different token families that can never silently collide |
| 2 | **Evict the brand hue from the brand role** | Shopify Polaris (brand green → neutral near-black; green freed for success) | The most radical fix: the brand stops *being* the colliding hue in-product |
| 3 | **Merge brand and success, keep the hue scarce** | Spotify Encore (`brightAccent` = `positive` = #1ed760, same hex, two token names) | Accept the doubling; legibility survives because the green is rationed ("resting color") |
| 4 | **Split the hue: same family, hard lightness/chroma distance** | Wise (lime #9FE870 brand vs forest #054D28 success), Pinterest (ramp steps 450 vs 500/300), M3 harmonization ("retain the semantic meaning associated with the colors' hue range") | Kinship preserved; collision avoided by tone, sometimes reinforced by a slight hue nudge |
| 5 | **Two named hues, opposite shifts** | Airbnb (Rausch pink-red brand vs Arches orange-red error), Vodafone (warning pushed fully to orange) | Pull the pair apart in *hue* until they read as different colors at a glance |
| 6 | **Semantic palette outside the brand's palettes** | Material 3 (`error` ref palette; error static under dynamic color), YouTube-on-Material | Status colors are not derived from brand ramps at all and don't move when brand does |
| 7 | **Hue = identity/taxonomy; affirm/cancel = position + glyph + convention** | Diablo, PoE, Hades, Slay the Spire, FFXIV, Destiny (GDC), PS5 ✕/○ | Games spend the whole hue budget on world-model categories; go/stop lives in non-hue channels |
| 8 | **Redundant non-hue encoding** (never color alone) | WCAG 1.4.1, Pinterest, Spectrum ("must also display text or an icon"), Diablo IV border-decoration, Slay the Spire intent glyphs, FFXIV role pictograms | Icon shape, frame silhouette, position, friction, audio — color is an enhancement, not the message |

### Non-hue semantic carriers observed (consolidated)

- **Icon glyph shape** — status/intent carried entirely by pictogram (StS intent
  dagger→scythe escalation; FFXIV role icons; Spectrum/Pinterest icon+text mandates).
- **Frame silhouette & border ornament** — StS card-type frames; Diablo IV rarity
  border decoration (first-party: "secondary visual cues for indicating rarity via the
  border decoration").
- **Position & platform convention** — OK/confirm placement; PS5 ✕=confirm as a pure
  glyph-convention semantic; Destiny's context-sensitive prompt layer.
- **Interaction friction** — FFXIV checkbox-gated destructive dialogs; the destructive
  affordance is *cost*, not color.
- **Token shape** — an error is a coordinated *set* (pale wash + dark text + icon +
  border), recognizable by silhouette regardless of hue (Pinterest).
- **Weight/size** — StS intent glyphs scale with damage magnitude.
- **Audio** — Diablo IV per-rarity loot cues.
- **Motion** — no primary source in this survey documented motion as a status carrier;
  the repo's own grammar (emission/absorption, one-shot strike vs smoulder) is ahead of
  the literature here. [VERIFIED absence in surveyed sources]

---

## Applicability to mage-vtt (mapping only — no decision)

The knot restated in the survey's vocabulary: verdigris is simultaneously a **brand
role** (the world's magic — patina, stars, ambience) and a **feedback role** (roll
success), with no token-layer separation (`--accent` is used directly for both); ember
is simultaneously an **identity role** (the caster's hand) and sits in warning/orange
hue-space; `--bad` already exists as a separate destructive slot.

How each pattern would land, without choosing:

1. **Semantic-role layer (pattern 1)** is orthogonal to every other option and is what
   every surveyed system does first: introduce `--success` / `--fail` (or
   `--feedback-*`) tokens and re-point `ActivityLog`/`CastCard` at them, even if
   `--success` initially aliases `var(--accent)` Spotify-style. The decision about
   *values* then becomes reversible; today it is smeared across component files.
2. **Evict (pattern 2)** — Polaris's move would mean verdigris stops meaning
   "success": roll outcomes get some other treatment and verdigris retreats to pure
   world-identity. Radical but precedented by the greenest brand surveyed.
3. **Merge-and-ration (pattern 3)** — Spotify's move: verdigris *is* success, on
   purpose, under two token names — viable only if verdigris is kept scarce enough
   that "lit verdigris = good outcome" stays legible against ambient verdigris. The
   night-sky/patina ambience work pushes against scarcity. [INFERRED tension]
4. **Split the hue (pattern 4)** — Wise/Pinterest's move: a success green at hard
   tonal distance from #6fae97 (much darker forest or much brighter mint), kin but
   unmistakable. Same technique could separate ember-as-selection from any future
   warning orange (Pinterest holds brand vs error at one ramp step; Wise holds lime vs
   forest across the whole lightness axis).
5. **Opposite shifts (pattern 5)** — Airbnb's move applied to the ember: if ember
   (#e29659) must not read as warning, push any actual warning color away (toward
   yellow or red-brown) the way Airbnb pushed error to Arches — or push ember itself
   further from alarm-orange. Note Vodafone pushed *warning* fully to orange, i.e. the
   ember currently squats on the hue most systems spend on warning. [VERIFIED squatting; response INFERRED]
6. **Games' split (pattern 7)** maps cleanly onto the existing grammar: verdigris and
   ember are *identity* colors (world vs caster's hand) exactly like god/class/realm
   colors — and the surveyed games would say identity colors should **never** be asked
   to also carry affirm/cancel; that duty goes to position, glyphs, friction, and the
   realm-material system's existing non-hue channels (inversion, medallion vs line,
   emission vs absorption).
7. **Redundant encoding (pattern 8)** is the WCAG-backed floor regardless of choice:
   successes/failures in the log and cast cards should carry an icon/glyph/weight cue
   in addition to whatever hue wins. `roll.successes > 0 ? accent : dim` is currently
   hue-and-lightness-only. [VERIFIED current state]

Open questions for the grilling session: does "success" in a dice roll even want a
*status* color, or is it a *quantity* (games would render it as count + weight, not
green)? Is ember's selection duty an identity statement (keep) or a semantic accident
(re-token)? Does `--bad` (#b56d60) hold enough distance from ember (#e29659) once both
appear on the same card? — the pairs sit ~40° apart in hue but close in tone. [INFERRED]

---

## Flagged gaps and caveats (consolidated)

- Duolingo, Netflix, Target, OneTrust, Coca-Cola, Verizon, Santander: no public
  primary sources for semantic color; excluded from claims.
- Spotify Encore and Airbnb DLS docs are private; their claims here rest on shipped
  first-party artifacts (production CSS / npm packages), which prove values but not
  rationale.
- M3 and Spectrum quotes were extracted via a rendering proxy (their sites are
  client-rendered); spot-check in a browser if load-bearing.
- Diablo dialog-button neutrality is unsourced inference (game-UI databases 403'd);
  PoE socket-color mapping verified only via search excerpt; FFXIV discard-checkbox
  mechanics partially sourced.
- Radix has no explicit accent-for-semantic prohibition — structural separation only.
