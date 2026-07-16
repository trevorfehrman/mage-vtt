# Arcana shine & substance: library survey

> **Note on convention:** this file establishes `docs/research/` with dated filenames
> (`YYYY-MM-DD-topic.md`) as the research-notes convention for this repo. No prior
> convention existed; `docs/` previously held only `adr/`, `agents/`, `census/`.
>
> Researched 2026-07-16 against primary sources (library source code on GitHub, npm
> registry, MDN, Chromium/WebKit source, Bugzilla). Every claim is tagged
> **[VERIFIED]** (source was read) or **[INFERRED]** (extrapolation from verified facts).

## TL;DR

Two design directions were under audition when this survey started (hand-rolled surface
specular vs. border-traveling light) and a third was added mid-survey (each Arcanum as a
distinct **substance** — flame, smoke, spiral, liquid metal, …). The survey's headline
finding: **Paper Shaders' catalog matches 8 of the 10 Arcana substances almost by name**
(God Rays → Prime, Neuro Noise → Mind, Smoke Ring → Spirit, Spiral → Time, Liquid Metal
→ Matter, Gem Smoke → Death, Metaballs → Life, Dot Orbit → Space), is Apache-2.0,
zero-dependency, WebGL2, SSR-safe, and pauses itself offscreen/hidden — but **ten
always-on canvases is not viable**: Chromium's per-renderer WebGL context cap is **16 on
desktop and 8 on Android** (10 tiles alone would evict contexts on Android), and WebKit's
is 16. The workable shape is a **layered hybrid**: the existing hand-rolled CSS material
system stays as the always-on idle layer (zero contexts, zero JS), and a substance shader
mounts **only on lit/armed tiles** (0–2 concurrent in practice), crossfaded in.

### Ranked recommendation (by direction, library picks under each)

1. **Hybrid layers — CSS material idle + Paper Shaders substance when lit.** *(build this)*
   Idle: the existing `mv-arcana-*` gradients/keyframes (keep; they cost ~nothing and are
   already contained, tinted, reduced-motion-gated). Lit/armed: mount the tile's substance
   shader (`@paper-design/shaders-react`, install as a dependency) inside the tile,
   crossfade over the bloom. Substance colors come from a TS-side realm-token map (shaders
   take concrete color props, not CSS `var()` — see §1). Emission/absorption survives as
   the *treatment* of the substance: Subtle tiles blend the shader `screen`-ish behind the
   glyph; Gross tiles mask it into the medallion rim.
2. **Border-traveling light as an ARMED accent, emission tiles only.** Vendor Magic UI's
   **Border Beam** (MIT, ~60 lines, `motion` + CSS `offset-path: rect(...)` — the cleanest
   contained border-light technique found; §3) or hand-roll the `@property <angle>` conic
   variant (§6). A traveling rim light *contradicts* the absorption grammar — a Gross tile's
   rim should gather, not patrol. Recommendation: traveling beam on Subtle-armed only;
   Gross-armed keeps/deepens the existing inward inset glow (possibly a slow conic *mask*
   rotation of the existing rim gradient, which reads as "drawing in").
3. **Pure per-arcanum substance, all ten ambient.** Only viable via **pre-rendered loops**
   (one ~2–4s video/animated-AVIF per Arcanum, colors baked per material) or a
   **single shared custom-GLSL canvas** behind the grid (one context, ten viewports).
   Both are real but heavier engineering; do not do ten live canvases (§9).
4. **Surface specular status quo.** Already built, already good, and it remains the idle
   base layer of option 1 regardless. No library beats it at its own job.

**Library ranking:** Paper Shaders ≫ Magic UI (vendor 1–2 files) ≈ hand-rolled modern CSS
> React Bits (mine its GLSL, don't adopt its per-component canvases) > Aceternity
(reverse-engineer Glowing Effect's conic-mask; skip the rest) > hover.dev (technique
reference only). Rejected: shadergradient (stale), whatamesh (stale, license unclear),
animate-ui (redundant with Motion), CSS paint worklets (no Safari/Firefox), 21st.dev /
uiverse (aggregators, per-item licensing).

**Install implication:** `motion` gets installed either way (already sanctioned by
ADR-0021 and needed for the rail-foot pilot); Paper Shaders is the only other install
this report recommends.

---

## Local grounding (what exists today)

- Idle material system is pure CSS: `mv-arcana-bloom` radial gradients (emission = halo
  out from glyph, absorption = light gathered at rim), `mv-arcana-fx` specular drift
  (`mv-glint`), `mv-breath`, `mv-thrum`, all inside
  `@media (prefers-reduced-motion: no-preference)` — [`src/styles.css`](../../src/styles.css) ~340–495. [VERIFIED]
- Per-tile tint is a `--tile` custom property set inline from `arcanumTint()` →
  `var(--realm-*)`; five realm tokens at `src/styles.css` ~42 (gold `#d3b46a`, lunargent
  `#cdd6e2`, rusted iron `#b4693c`, mossy stone `#9aa471`, dark lead `#868e9c`). [VERIFIED]
- Ten tiles render simultaneously in a 5×2 grid
  ([`CharacterSheet.tsx` `ArcanaDashboard`](../../src/components/game/CharacterSheet.tsx) ~447–511);
  Gross = {forces, time, space, life, matter} renders the seal medallion, Subtle the line
  glyph ([`ArcanaGlyph.tsx`](../../src/components/game/ArcanaGlyph.tsx)). [VERIFIED]
- ADR-0021: Motion is the sanctioned animation layer, `motion` **not yet installed**
  ([`package.json`](../../package.json) has no motion/framer-motion); ambient motion
  sanctioned *only* for the Arcana material system, reduced-motion gated. [VERIFIED]
- Stack: React 19.2, Tailwind v4.1, TanStack Start (Vite + Nitro SSR), `tw-animate-css`
  already present. [VERIFIED]

## Platform facts (the constraints everything hangs on)

### WebGL context limits — the 10-tile ceiling is real

- **Chromium**: default per-renderer-process cap is **16 active WebGL contexts on
  desktop, 8 on Android, 4 on workers** — read directly from
  [`content/renderer/webgraphicscontext3d_provider_impl.cc` lines 122–127](https://github.com/chromium/chromium/blob/main/content/renderer/webgraphicscontext3d_provider_impl.cc)
  (`prefs.max_active_webgl_contexts = 8u` under `IS_ANDROID`, else `16u`), overridable via
  the `--max-active-webgl-contexts` switch
  ([`content_switches.cc` ~line 505](https://github.com/chromium/chromium/blob/main/content/public/common/content_switches.cc)). [VERIFIED]
- On overflow Chromium **silently force-loses the oldest context** with the console
  warning `"WARNING: Too many active WebGL contexts. Oldest context will be lost."` —
  [`third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc` ~lines 453–510](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc)
  (`ForciblyLoseOldestContext`, called from `AddActiveContext`). [VERIFIED]
- **WebKit/Safari**: `maxActiveContexts = 16`, `maxActiveWorkerContexts = 4`; the oldest
  is recycled with `"There are too many active WebGL contexts on this page, the oldest
  context will be lost."` and — note — WebKit uses `SyntheticLostContext` so the page
  **cannot** `preventDefault()` its way out —
  [`Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp` lines 190–191, 326–335, 5631–5639](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp). [VERIFIED]
- Contexts count against the cap until actually lost/GC'd, not merely when their canvas
  leaves the DOM; the standard remedy is calling
  `gl.getExtension('WEBGL_lose_context').loseContext()` on teardown — MDN best practices
  ("lose contexts eagerly",
  [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices))
  [VERIFIED that MDN recommends eager loss]; real-world eviction from non-released
  contexts is documented in e.g.
  [openlayers#16118](https://github.com/openlayers/openlayers/issues/16118) and
  [crbug 40939743](https://issues.chromium.org/issues/40939743). [VERIFIED titles/existence; INFERRED mechanics]

**Consequence:** 10 always-mounted tile canvases = 10 of 16 desktop slots (fragile: a
map canvas, a dice-tray canvas, or a second sheet blows it) and **exceeds the Android cap
of 8 outright**. Any WebGL answer must bound concurrent canvases. [INFERRED from verified caps]

### CSS `@property` — safe to use

`@property` is **Baseline 2024** ("newly available" across all major engines since July
2024) — [MDN @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property).
Registering `syntax: "<angle>"` makes a custom property interpolable in keyframes — the
foundation of the rotating-conic border technique. [VERIFIED]

### CSS Paint API (Houdini worklets) — rejected

Chromium-only: Firefox unsupported, Safari disabled-by-default across all versions —
[caniuse css-paint-api](https://caniuse.com/css-paint-api). Reject. [VERIFIED]

### The `motion` package (framer-motion successor) — current API

- npm `motion` 12.42.2, MIT, last publish 2026-06-30 (`npm view motion`). [VERIFIED]
- `useMotionTemplate` is current, imported from `motion/react`, tagged-template that
  recomputes when embedded motion values change —
  [motion.dev/docs/react-use-motion-template](https://motion.dev/docs/react-use-motion-template). [VERIFIED]
- `animate()` (hybrid, from `"motion"`, ~18kb; mini 2.3kb) animates MotionValues
  directly, animates colors/strings, supports `repeat: Infinity`, `repeatType:
  "loop"|"reverse"|"mirror"` — [motion.dev/docs/animate](https://motion.dev/docs/animate). [VERIFIED]

### SVG `feTurbulence` — animating `baseFrequency` is the expensive path

- Turbulence is generated on the CPU per filter-region pixel; changing `baseFrequency`
  (SMIL or JS) invalidates and re-renders the filter every frame. Firefox has a long
  history of feTurbulence performance bugs:
  [Bug 422371 "SVG feTurbulence filter is far too slow"](https://bugzilla.mozilla.org/show_bug.cgi?id=422371)
  (improved by ~2021 per closing comments) and
  [Bug 1583828 "Slow SVG filter animation"](https://bugzilla.mozilla.org/show_bug.cgi?id=1583828). [VERIFIED bugs exist and describe slowness; INFERRED per-pixel-CPU mechanism]
- Honest sizing for *this* app: an Arcana tile is small (~100–130px square). Ten
  tile-sized filter regions re-rendered at a **stepped** cadence (e.g. update `seed` or
  `baseFrequency` 6–10×/s for flame flicker, not 60fps) is plausibly fine on desktop and
  worth a measurement spike; continuous 60fps animation of `baseFrequency` across ten
  elements is the known-bad pattern. [INFERRED]
- Displacement (`feDisplacementMap` fed by static turbulence) where the *displaced
  content* animates cheaply is the classic mitigation. [INFERRED, widely documented pattern]

---

## Candidates

### 1. Paper Shaders — `@paper-design/shaders-react` ★ top pick for substances

**Facts** (npm + [github.com/paper-design/shaders](https://github.com/paper-design/shaders) + source):

- v0.0.77, **Apache-2.0**, last publish 2026-07-02; `shaders-react` 410KB unpacked with a
  single dependency (`@paper-design/shaders`, 819KB unpacked, **zero dependencies**)
  (`npm view`). ~3.1k stars, active TypeScript monorepo. [VERIFIED]
- **WebGL2 per instance**: each mount creates its own canvas and calls
  `canvas.getContext('webgl2')` —
  [`packages/shaders/src/shader-mount.ts` line 94](https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shader-mount.ts). [VERIFIED]
- **Self-pausing**: IntersectionObserver pauses when out of viewport, `visibilitychange`
  pauses when tab hidden (lines 111, 123, 202–212); `speed: 0` cancels the rAF loop
  entirely (line 528) and renders a single static frame. Idle-mounted-but-static cost ≈ one
  GPU context + one framebuffer, **no per-frame work**. [VERIFIED]
- **SSR-safe**: React wrapper is `'use client'`, renders the container div during SSR
  ("allows the shader mount to still take up space during server rendering" — comment in
  [`shaders-react/src/shader-mount.tsx`](https://github.com/paper-design/shaders/blob/main/packages/shaders-react/src/shader-mount.tsx));
  props use React-19-style `ref` as a prop. [VERIFIED]
- **Teardown gap**: `dispose()` deletes program/textures and removes the canvas but does
  **not** call `WEBGL_lose_context.loseContext()` (read `dispose` at
  [`shader-mount.ts` lines 562–608](https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shader-mount.ts)) —
  so rapid mount/unmount churn can accumulate not-yet-GC'd contexts toward the cap.
  Mitigate by keeping a lit tile's mount alive at `speed 0` instead of unmounting, or
  wrap/patch teardown. [VERIFIED absence; INFERRED consequence]
- Colors are **props** (`colors={[...]}` etc.), not CSS vars — the realm tokens must be
  mirrored in a small TS map (they're plain hex constants in `styles.css`, trivial), or
  resolved once via `getComputedStyle`. [VERIFIED prop shape via llms.txt; INFERRED integration]
- Catalog (35 shaders) from [shaders.paper.design/llms.txt](https://shaders.paper.design/llms.txt);
  additional shaders visible in the repo tree not yet in llms.txt (**Gem Smoke**,
  Heatmap, Halftone CMYK — `packages/shaders-react/src/shaders/`). All shaders share
  `speed` (0 = static), `frame`, `scale/rotation/offset`, `minPixelRatio`,
  `maxPixelCount` perf caps. [VERIFIED]

**Per-arcanum substance mapping** (shader names VERIFIED in catalog/repo; the *fit* is
[INFERRED] design judgment — config directions assume desaturated material palettes, low
speed):

| Arcanum (realm, S/G) | Paper Shader | Config direction |
|---|---|---|
| Prime (Aether, S) | **God Rays** — "animated light rays radiating from center, up to 5 colors" | gold + off-white rays, low intensity, centered on glyph — literally the emission grammar |
| Forces (Aether, G) | **Grain Gradient** (7 abstract forms) or **Warp** | molten gold turbulence, high grain, slow — no true "flame" shader exists; Warp's noise-swirled field is the closest licking-flame read |
| Fate (Arcadia, S) | **Simplex Noise** bands or **Waves** | thin lunargent thread-lines; NB React Bits *Threads* is the stronger thread match (§2) |
| Time (Arcadia, S) | **Spiral** — "single-colored animated spiral morphing" | lunargent on panel-dark, slow inward rotation |
| Mind (Pandemonium, S) | **Neuro Noise** — "glowing web-like fluid lines" | rusted-iron tint, low alpha — near-nominal match |
| Space (Pandemonium, G) | **Dot Orbit** — "dots orbiting cell centers" | sparse iron-spark starfield, large cells; alternatively React Bits *Galaxy* |
| Spirit (Wild, S) | **Smoke Ring** — "radial multi-color gradient with layered noise" | mossy-stone ring breathing around the glyph — near-nominal match |
| Life (Wild, G) | **Metaballs** — "up to 20 gooey balls merging into organic shapes" | 4–6 slow stone-green blobs, masked to the medallion |
| Death (Stygia, S) | **Gem Smoke** (repo; new) or Smoke Ring | lead-grey smoke veil, barely moving |
| Matter (Stygia, G) | **Liquid Metal** — "futuristic liquid metal for logos or shapes" | dark-lead liquid metal *inside the medallion disc* — near-nominal match; it's an image filter, so feed it the seal shape |

That's 8/10 strong (Forces and Fate are the stretches). **Pulsing Border** ("luminous
color trails forming glowing contour") also exists if a shader-based border light is ever
wanted — but a WebGL canvas per tile *for a border* is the wrong cost model vs. §3/§6. [VERIFIED it exists]

**Sketch — substance mounted only while lit** (~the whole integration):

```tsx
// ArcanaSubstance.tsx — client-only by nature ('use client' lives in the lib)
import { GodRays, NeuroNoise, Spiral /* … */ } from "@paper-design/shaders-react"

const REALM_HEX = { aether: "#d3b46a", arcadia: "#cdd6e2", pandemonium: "#b4693c",
  wild: "#9aa471", stygia: "#868e9c" } as const // mirror of --realm-* tokens

// per-arcanum component + props table elided; each entry ~2 lines
export function ArcanaSubstance({ arcanum, lit }: { arcanum: string; lit: boolean }) {
  const reduced = useReducedMotion()             // from motion/react
  if (!lit) return null                          // 0 contexts idle; bounded when lit
  const { Comp, props } = SUBSTANCES[arcanum]
  return (
    <span aria-hidden className="mv-arcana-substance"> {/* absolute inset-0, overflow hidden,
      rounded inherit, opacity 0 → 1 via CSS transition ~350ms (crossfades over the bloom) */}
      <Comp {...props} width="100%" height="100%"
        speed={reduced ? 0 : props.speed}        // reduced motion ⇒ static frame
        maxPixelCount={160 * 160} />              {/* tiles are small; cap DPR cost */}
    </span>
  )
}
```

Mount latency (context create + 2-shader compile) is typically tens of ms [INFERRED —
not benchmarked here]; the CSS bloom already transitions in over 0.45s, which fully
covers it.

### 2. React Bits — reactbits.dev / [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)

- **License: MIT + Commons Clause** — free to use *inside* an application (commercial
  ok); forbidden to resell/redistribute the components themselves —
  [LICENSE.md](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md). Fine for
  this app, fine to vendor. [VERIFIED]
- 43.5k stars, pushed 2026-07-15, 1 open issue; installed via **shadcn CLI**
  (`npx shadcn@latest add @react-bits/<Name>-TS-TW`) or jsrepo or copy-paste; variants
  JS/TS × CSS/Tailwind; docs site itself runs **tailwindcss ^4.0.3** (repo
  `package.json`), and registry items declare their own deps (e.g. `Aurora-TS-TW` →
  `ogl@^1.0.11` — fetched from `https://reactbits.dev/r/Aurora-TS-TW`). [VERIFIED]
- **Dependency weight**: background/substance components are mostly **OGL** (Aurora,
  Galaxy, Threads, LightRays, Orb all `import { Renderer, Program, Mesh, Triangle } from 'ogl'`
  — read from source); some are **three.js + @react-three/fiber** (Silk) — those are
  disqualified by the no-three constraint. OGL itself: npm `ogl` 1.0.11, **Unlicense**
  (public domain), 423KB unpacked, but last published **2025-01-27** — ~18 months stale. [VERIFIED]
- Components are `useEffect`-mounted canvases → SSR-safe as empty containers; Aurora's
  cleanup **does** call `gl.getExtension('WEBGL_lose_context')?.loseContext()`
  ([Aurora.jsx line ~196](https://github.com/DavidHDev/react-bits/blob/main/src/content/Backgrounds/Aurora/Aurora.jsx))
  — better teardown hygiene than Paper Shaders — but there is **no IntersectionObserver /
  visibility pausing**; the rAF loop runs whenever mounted. [VERIFIED for Aurora; INFERRED similar for siblings]
- Substance-relevant catalog (all VERIFIED to exist in
  [`src/content/Backgrounds/`](https://github.com/DavidHDev/react-bits/tree/main/src/content/Backgrounds)):
  **Threads** (→ Fate, the best thread-substance anywhere), **Galaxy** (→ Space),
  **DarkVeil** (→ Death), **LightRays** (→ Prime), Aurora, Lightning, Plasma, Ferrofluid,
  LiquidChrome, Silk (three.js). These are designed as full-bleed hero *backgrounds* —
  vendoring one into a 120px tile means trimming interaction code and re-parameterizing
  scale. [VERIFIED existence; INFERRED adaptation cost]

**Verdict:** don't adopt wholesale (same 1-context-per-tile problem, no auto-pause, OGL
staleness); **mine it** — the license permits vendoring, and Threads/Galaxy/DarkVeil GLSL
can be ported into whatever mount strategy wins (including into a Paper-Shaders-style
custom `ShaderMount`, whose `fragmentShader` prop is public). [VERIFIED that ShaderMount takes arbitrary fragment shaders]

### 3. Magic UI — [magicuidesign/magicui](https://github.com/magicuidesign/magicui) ★ top pick for border light

**MIT** (LICENSE.md), 21.5k stars, pushed 2026-07-02, **0 open issues** (they aggressively
close), shadcn-CLI registry, and the registry items are **Tailwind v4 native** (v4-only
syntax like `border-(length:--border-beam-width)`, `bg-linear-to-l`, `mask-intersect`;
keyframes delivered as registry `cssVars.theme`, i.e. `@theme` variables). [VERIFIED from
fetched sources of all four components + license + repo API]

- **Shine Border** — *pure CSS*, no motion dep: an absolutely-positioned overlay whose
  background is a `radial-gradient(transparent, transparent, <colors>, transparent)` at
  `background-size: 300% 300%`, clipped to a 1px frame by the classic two-layer mask
  (`mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)` +
  `mask-composite: exclude`, thickness = `padding`), animated by a `background-position`
  keyframe (`motion-safe:animate-shine`) —
  [source](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/shine-border.tsx).
  Takes `shineColor` → trivially re-skinned to `var(--tile)` since it lands in inline
  `backgroundImage`. Idle cost: one composited gradient animation; ~zero JS. Already
  `motion-safe:`-gated. Reads as a soft light *washing* the rim — closer to specular than
  to neon. **Best pure-CSS candidate.** [VERIFIED]
- **Border Beam** — the traveling-comet border. Key technique: a small gradient square
  with **`offsetPath: rect(0 auto auto 0 round <r>)`** animated `offsetDistance:
  ["0%","100%"]` via `motion`, inside a frame masked by
  `mask-intersect [mask-clip:padding-box,border-box]` so only the border ring shows —
  [source](https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/border-beam.tsx).
  Contained by construction, per-tile colors via `--color-from/--color-to` custom props
  (set them to `var(--tile)` mixes). Compositor-friendly (offset-path animation), but it
  *is* a perpetual Motion animation per instance — use event-driven (armed), not ambient.
  **Best traveling-light candidate; vendor it.** [VERIFIED]
- **Magic Card** — pointer-tracking radial spotlight + border glow:
  `useMotionValue(mouseX/Y)` → `useMotionTemplate` radial-gradient in a padding-box/
  border-box **two-layer background** (`linear-gradient(...) padding-box,
  radial-gradient(... ) border-box`). Depends on motion **and next-themes** (strip the
  theme hook when vendoring). Zero-cost idle (only moves on pointermove). Relevant as the
  *hover* specular upgrade, not ambient. [VERIFIED]
- **Neon Gradient Card** — blurred duplicate glow layers; measures itself with
  ResizeObserver; aesthetically neon by construction. Skip. [VERIFIED technique; judgment INFERRED]

**Sketch — vendored Border Beam re-skinned to the material system** (armed Subtle tiles):

```tsx
// mv-armed-beam: ~all of it. Vendored from Magic UI border-beam (MIT), de-libbed.
export function ArmedBeam({ duration = 6 }: { duration?: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]
      border border-transparent
      mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)]
      mask-intersect [mask-clip:padding-box,border-box]">
      <motion.span
        className="absolute aspect-square w-8"
        style={{
          offsetPath: `rect(0 auto auto 0 round 8px)`,
          background: `linear-gradient(to left,
            color-mix(in srgb, var(--tile) 90%, white), var(--tile), transparent)`,
        }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </span>
  )
}
// Gross tiles do NOT get this — absorption keeps the inward inset glow instead.
```

### 4. Aceternity UI — ui.aceternity.com

Free components are served as shadcn registry JSON (fetched
`https://ui.aceternity.com/registry/{glowing-effect,moving-border,background-gradient}.json`
and read full sources). **License of free components is not stated in the registry
payloads**; the site sells a Pro tier — verify licensing before vendoring verbatim
(technique-level reimplementation is safe). [VERIFIED sources; license gap VERIFIED-absent]

- **Glowing Effect** (the Cursor-style border): the genuinely good idea here is the
  **conic-gradient mask window**: the border layer paints a multi-stop
  `repeating-conic-gradient`, and an `after` pseudo masks it with
  `conic-gradient(from calc((var(--start) - var(--spread)) * 1deg), transparent,
  #fff, transparent …)` + `mask-clip: padding-box, border-box` + `mask-composite:
  intersect` — so only a `2·spread`-degree arc of rim is lit, and JS merely animates the
  `--start` angle toward the pointer (`animate()` from `motion/react`, rAF-throttled
  document-level pointermove). Zero cost idle except the global listener. Caveats: uses
  `background-attachment: fixed` inside the mask (historically flaky in Safari
  [INFERRED]) and a **document-level** pointermove per instance — ten tiles would want
  one shared listener. **Reverse-engineer the arc-mask; don't lift.** [VERIFIED technique]
- **Moving Border**: SVG `<rect>` + `getTotalLength()/getPointAtLength()` sampled in
  `useAnimationFrame`, position piped through `useMotionTemplate` into a transform —
  i.e. main-thread JS math **every frame, forever**. The Magic UI `offset-path` approach
  does the same visual declaratively. Skip. [VERIFIED]
- **Background Gradient**: two stacked synthwave radial-gradient layers (one `blur-xl`),
  `backgroundPosition` looped by motion. Glow deliberately bleeds outside the element —
  violates containment; palette is the definition of neon. Skip. [VERIFIED]

### 5. Hover.dev aurora technique (Motion color-cycling into a gradient)

The AuroraHero component exists and is **free** on
[hover.dev](https://www.hover.dev/components/heros), built on motion. [VERIFIED existence/free]
The technique — cycle a color MotionValue and template it into a gradient — checks out
against **current** motion docs (not stale framer-motion): `animate()` animates
MotionValues and colors with `repeat: Infinity` ([animate docs](https://motion.dev/docs/animate));
`useMotionTemplate` recomposes the string reactively
([docs](https://motion.dev/docs/react-use-motion-template)). [VERIFIED API shape]

```tsx
const color = useMotionValue(REALM_HEX.aether)
useEffect(() => {
  const controls = animate(color, [REALM_HEX.aether, "#e8d9a8", REALM_HEX.aether],
    { duration: 9, repeat: Infinity, ease: "easeInOut" })
  return () => controls.stop()
}, [])
const backgroundImage = useMotionTemplate`
  radial-gradient(ellipse 55% 40% at 32% 26%, ${color}12, transparent 70%)`
return <motion.span aria-hidden className="mv-arcana-fx" style={{ backgroundImage }} />
```

Honest assessment: this re-implements what `mv-glint` already does in CSS, but with a
per-frame JS style write per tile. For *ambient* surface specular, CSS keyframes win
outright; the Motion variant only earns its cost when the value must react to app state
(arming, pool size). Use for **event-driven** moments only. [INFERRED]

### 6. Hand-rolled modern CSS (the do-nothing-new baseline, upgraded)

All primitives verified available:

- `@property --angle { syntax: "<angle>"; …}` + conic-gradient rotation — Baseline 2024
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)). Josh Comeau's
  rainbow-button article is the canonical write-up of registering typed properties and
  letting `var()` reactivity repaint a gradient (his uses the JS twin
  `CSS.registerProperty` + transitions on `<color>` props —
  [joshwcomeau.com/react/rainbow-button](https://www.joshwcomeau.com/react/rainbow-button/)). [VERIFIED]
- Two-layer padding-box/border-box gradient border and mask-composite frame clipping —
  exactly the idioms Magic UI and Aceternity ship (§3, §4 sources). [VERIFIED]
- Blurred-duplicate glow layer — Neon Gradient Card / Background Gradient idiom. [VERIFIED]

**~20-line rotating-conic rim, absorption-compatible** (light *gathers* rather than travels
— rotate the mask over the existing rim gradient):

```css
@property --mv-rim-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }

.mv-arcana-armed-rim {            /* overlay: absolute inset-0, radius inherit */
  padding: 1px;                    /* rim thickness */
  background: conic-gradient(from var(--mv-rim-angle),
    transparent 0deg,
    color-mix(in srgb, var(--tile) 80%, white) 40deg,
    var(--tile) 90deg,
    transparent 170deg);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;         /* only the 1px frame shows */
}
@media (prefers-reduced-motion: no-preference) {
  .mv-arcana-sub  .mv-arcana-armed-rim { animation: mv-rim-turn 8s linear infinite; }
  .mv-arcana-gross .mv-arcana-armed-rim { animation: mv-rim-turn 14s linear infinite reverse; }
}
@keyframes mv-rim-turn { to { --mv-rim-angle: 360deg; } }
```

Does this beat the libraries for our case? **For the border direction: essentially yes.**
Magic UI's two techniques compile down to ~this plus `offset-path`; the only thing a
library adds is the comet's `offsetDistance` ergonomics (worth vendoring those 25 lines).
Note one real caveat: animating a registered custom property re-rasterizes the gradient
per frame (it is *not* a pure compositor animation like `background-position` or
`offset-distance`) — at 10 tile-sized elements this is still cheap, but `offset-path` and
`background-position` variants are strictly lighter. [INFERRED, consistent with @property
being a paint-triggering animation]

### 7. SVG `feTurbulence` / `feDisplacementMap` as substances

The only *procedural organic* option with zero WebGL contexts and full CSS-var tinting
(the SVG lives in the DOM; fills can be `currentColor`/`var(--tile)`).

- Right shape for: **Forces flame-lick** (turbulence-displaced glyph or rim), **Death/
  Spirit smoke wisps** (slow displacement of a blurred shape), **heat shimmer** on armed.
- Wrong shape for: continuous 60fps `baseFrequency` sweeps on all ten tiles (§platform
  facts; [Bug 422371](https://bugzilla.mozilla.org/show_bug.cgi?id=422371),
  [Bug 1583828](https://bugzilla.mozilla.org/show_bug.cgi?id=1583828)). [VERIFIED bugs]
- Budget pattern: static `feTurbulence` (generated once) + animate only the cheap side —
  displaced element's transform, or step `seed`/`baseFrequency` at 6–10Hz on **lit tiles
  only**, gated by reduced-motion. Needs a measurement spike before committing; Safari
  filter performance is the thing to test. [INFERRED]

Verdict: legitimate **third engine** for 2–3 specific substances if the Paper Shaders
route is rejected; not a full-catalog answer.

### 8. Others (high bar, mostly rejected)

- **shadergradient** (shadergradient.co): npm `shadergradient` 1.3.5, MIT, but last
  published **2024-10-22** (~21 months stale) (`npm view`); three.js-based per its docs
  site [INFERRED — site not deep-read]. Rejected: stale + three. [VERIFIED npm facts]
- **whatamesh** ([jordienr/whatamesh](https://github.com/jordienr/whatamesh)): Stripe-
  gradient derivative, canvas mesh gradient, 24 commits, **no license found**, no recent
  activity. Rejected. [VERIFIED]
- **animate-ui** ([imskyleen/animate-ui](https://github.com/imskyleen/animate-ui)):
  3.9k stars, shadcn-CLI distribution of Motion-based *UI component* animations
  (accordions, counters, etc.), repo license reads NOASSERTION via API, last push
  2025-12-31. Rejected: overlaps the already-sanctioned Motion layer, adds nothing for
  materials. [VERIFIED metadata]
- **21st.dev**: community component *marketplace/aggregator* ("Creator Studio", shadcn
  publishing); no uniform license across items — each entry needs individual vetting.
  Use as a discovery index only. [VERIFIED nature; license variability INFERRED]
- **uiverse.io**: not investigated in depth (aggregator of CSS snippets, per-item
  licensing); nothing surfaced that the verified candidates don't already cover. [NOT VERIFIED — flagged as skipped]
- **CSS paint worklets**: rejected on platform support (§platform facts). [VERIFIED]

---

## The 10-simultaneous-tiles problem, rigorously

| Approach | 10 concurrent | Notes |
|---|---|---|
| CSS gradients/keyframes (current) | ✅ trivially | compositor/paint only; already shipped |
| SVG filters, stepped animation, lit-only | ✅ with care | measure Safari; keep filter regions tile-sized |
| Motion-driven JS gradients | ⚠️ | 10 per-frame style writes; fine for *event* moments, wasteful ambient |
| WebGL canvas per tile (Paper/React Bits/OGL) | ❌ ambient | 10/16 desktop slots, **> 8 Android cap**; eviction is silent (verified engine sources above) |
| Hybrid: CSS idle + shader on lit/armed | ✅ | bounded concurrency (0–2 typical); the recommended shape |
| Pre-rendered loops (video/animated AVIF) | ✅ | zero contexts; colors baked per material; see below |
| One shared canvas, ten viewports, custom GLSL | ✅ (1 context) | scissor/viewport per tile in a single `<canvas>` behind the grid; most engineering, only needed if all-ten-ambient-substances becomes a hard requirement [INFERRED] |

**Is the hybrid actually workable?** Yes, with two specifics: (1) *Mount latency* —
context creation + compile of a small fragment shader is tens of ms [INFERRED]; the
existing 0.45s bloom transition fully masks it (crossfade the canvas in via CSS opacity).
(2) *Context churn* — Paper Shaders' `dispose()` doesn't eagerly lose the context
(verified §1), so a user strobing tiles could stack unreleased contexts until GC. Bound
it: keep at most N (say 3) substance mounts alive in an LRU, parking hidden ones at
`speed 0` / `display:none` rather than unmounting per toggle; or add an eager
`WEBGL_lose_context` call in a thin wrapper. Paper Shaders' own IntersectionObserver +
visibility pausing (verified) handles scrolled-away and hidden-tab cases for free.

**Pre-rendered loops as the third path** [analysis INFERRED except where linked]: render
each substance once (offline, from the same shaders), export a 2–4s seamless loop per
Arcanum as H.264/WebM + animated AVIF fallback, play via
`<video muted autoplay loop playsinline>` — muted inline autoplay is permitted by
[Chrome's autoplay policy](https://developer.chrome.com/blog/autoplay). Ten simultaneous
tile-sized videos decode in hardware and are cheap. Costs: colors are **baked** (fine —
exactly 10 fixed material/substance pairs; but every palette iteration = re-render),
loop seams take craft, assets ≈ 100–300KB each, DPR is fixed, and pausing for
reduced-motion needs JS (`matchMedia` → `video.pause()`, or swap in a poster). Verdict:
the escape hatch if all-ten-ambient substances becomes a hard requirement; not the first
build.

## Whole-app secondary map (ambient banned elsewhere — event-driven only)

- **Cast-card arming / refusal**: vendored Border Beam one-shot (run the `offsetDistance`
  animation once, no `repeat`) or the Glowing Effect arc-mask pointed at the pool button. Motion.
- **Dice-roll moments**: a single Paper Shaders **God Rays** (crit) or **Static Radial
  Gradient** flash behind the roll card — one canvas, mounted for the moment, disposed.
  Context budget irrelevant at n=1.
- **Feed entrances / scene strip**: pure Motion (`AnimatePresence`, layout) per ADR-0021 —
  no candidate library needed.
- **Magic Card pointer spotlight**: a hover-specular upgrade for rote/spell cards later —
  zero idle cost, on-brand if tinted by `--tile`. Vendor from Magic UI when wanted.

## Per-candidate summary table

| Candidate | License | Maintenance (as of 2026-07-16) | Runtime/bundle | TW4 / R19 / SSR | Recommendation |
|---|---|---|---|---|---|
| Paper Shaders | Apache-2.0 [V] | v0.0.77 pub 2026-07-02; active; pre-1.0 API churn risk [V] | 410KB+819KB unpacked, zero deps, tree-shakeable ESM [V npm / I shaking] | TW-agnostic / R19-style ref [V] / `'use client'` + SSR placeholder [V] | **Install** (substances, lit-only) |
| Magic UI | MIT [V] | 21.5k★, pushed 2026-07-02, 0 open issues [V] | shine-border: CSS-only; border-beam/magic-card: motion [V] | TW4-native registry [V] / motion peer / `"use client"` [V] | **Vendor** shine-border + border-beam (~100 lines) |
| React Bits | MIT + Commons Clause [V] | 43.5k★, pushed 2026-07-15 [V] | per-component; ogl 1.0.11 (Unlicense, stale 2025-01) [V] | TW4 variants via shadcn registry [V] / useEffect-canvas SSR-safe [V] | **Mine GLSL** (Threads/Galaxy/DarkVeil); don't adopt canvases |
| Aceternity | not stated in registry payloads [V-absent] | active site; registry JSON served [V] | glowing-effect: CSS masks + motion `animate` + doc-level listener [V] | TW classes v3-era but portable / motion / client [V src, I port] | **Reverse-engineer** arc-mask only |
| hover.dev aurora | free tier, site license unread [V existence] | commercial site [V] | motion (useMotionValue/Template) [V technique] | n/a — technique | Technique reference only |
| Hand-rolled CSS | n/a | n/a | ~zero; @property anims repaint [I] | native everything | **Keep as idle base**; add conic rim if wanted |
| SVG feTurbulence | n/a | engine feature | CPU filter re-render on param change [V bugs / I mechanism] | native, tints via currentColor | Spike for Forces/Death if shaders rejected |
| shadergradient / whatamesh / animate-ui / paint worklets / 21st.dev / uiverse | MIT / none / NOASSERTION / n/a / varies | stale / stale / slowing / n/a / n/a | — | — | **Rejected** (reasons in §8) |

## Final framing against the emission/absorption grammar

- **Emission (Subtle)** tolerates light that *moves outward or along*: God-Rays-class
  substances, the traveling Border Beam, glint drift. All three shine candidates fit.
- **Absorption (Gross)** is contradicted by a patrolling rim comet — light should
  *arrive and sink*. Gross tiles should get: substances that read as mass (Liquid Metal,
  Metaballs, Galaxy), the existing inward inset glow, and at most a slow *reverse* conic
  gather (§6 sketch runs Gross reversed and slower) — never the beam.
- The five-material realm system and the per-arcanum substance system **compose** rather
  than compete: material = idle body (CSS, all ten, always), substance = lit soul
  (shader, 0–2 at a time). That layering is exactly what the context-limit math forces
  anyway — the platform constraint and the design grammar point at the same architecture.
