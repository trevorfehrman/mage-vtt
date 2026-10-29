# Notebook & whiteboard canvas: library survey

> **Convention:** `docs/research/YYYY-MM-DD-topic.md` (established by
> `2026-07-16-arcana-shine-library-survey.md`).
>
> Researched 2026-10-28 against primary sources: the npm registry (versions, dates,
> peer ranges), bundlephobia, GitHub source on `main`/`master` for tldraw and
> Excalidraw (license manager, props, CSS, type files), both projects' docs sites,
> both issue trackers via `gh`, the google/fonts repo. Every claim is tagged
> **[VERIFIED]** (source read) or **[INFERRED]** (extrapolated from verified facts).
> Nothing was installed. Repo context read: `docs/whiteboard-tools.md`,
> `src/routes/prototype/whiteboard.tsx` (247 lines, hand-rolled SVG: select / pen /
> line / text / PC token / NPC token / erase, fake remote cursors, no undo, no
> persistence).

## Decision (owner, 2026-10-28, after reading this)

The survey's recommendation below was **not taken as written**. The owner's calls, in order:

- **tldraw is disqualified** on the license alone ("the license situation is disqualifying, i don't trust them"), and no pause to wait on a hobby key.
- **The hand-rolled route is off the table**: owning a general-purpose editor (selection, undo, text editing, paste) for a note pad is the kind of thing that eats a project; the owner called it "piecemeal" and was right.
- **Konva (react-konva) is the first audition**: the canvas primitives plus Konva's own recipes for the five editor behaviors, with the page as a plain Schema array that Konva only renders — identity for free, editor from recipes. Rig: `src/routes/prototype/notebook.tsx` (`-notebook-page.ts` is the canvas-free page model; `-notebook-pad.tsx` the Konva pad).
- **React Flow (`@xyflow/react`, MIT; the paid tier gates examples and support, not features) is the second audition** on the same stamps — the brief sits between freehand and structured, and the owner wants to see both.
- **Excalidraw is the fallback** if neither feels right: finished editor, identity fight (filter-based dark theme, no toolbar prop, no custom fonts).

## TL;DR

**Recommendation: one hand-rolled "sketch kit" for both the notebook and the
whiteboard — `perfect-freehand` for ink, `rough.js` (seeded) for hand-drawn stamp
frames, an OFL handwriting font, pointer-event drag, a small command stack — built
outward from the existing whiteboard prototype. tldraw is the fallback if the
kit's editor ergonomics balloon; Excalidraw is ruled out.**

Why not just adopt tldraw, which is technically the best fit (custom `ShapeUtil`,
`hideUi`, `store.listen`/`mergeRemoteChanges` for Convex, presence records, a
`'draw'` dash style, font override via `assetUrls`)? Three verified facts:

1. **It is not free to ship.** The license forbids production use without a key;
   the SDK detects "production" as *any non-localhost https origin with
   `NODE_ENV=production`*, and in that state it **renders the editor for 5 s then
   unmounts it to a blank `display:none` div**
   ([LicenseProvider.tsx](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/license/LicenseProvider.tsx)
   `LICENSE_TIMEOUT = 5000`, `shouldHideEditorAfterDelay`) **[VERIFIED]**. The
   free paths are a 100-day trial, or a discretionary **hobby license that keeps
   a "made with tldraw" watermark** you agree to keep "visible, unobscured, and
   available to user-interaction" **[VERIFIED]**. Commercial pricing is
   "value-based", sales-quoted, no number published **[VERIFIED]**.
2. **552 KB gzipped** (1.86 MB min, React excluded; tldraw's own issue #10572
   says importing only `Tldraw` saves 3%) for a ~768×400 note pad under a title
   card **[VERIFIED]**.
3. The notebook's entire value is *feel* in a locked identity; tldraw's chrome
   can be removed, but its canvas interaction grammar (handles, snapping, rich-text
   editing) is tldraw's, not ours, and the watermark sits inside the pad.

Excalidraw is MIT and 353 KB gz, but **has no custom-shape API** (issue #5798 open
since 2022), **cannot hide its toolbar through props** (only `viewModeEnabled`,
which also disables editing), implements dark mode as a **canvas
`invert(93%) hue-rotate(180deg)` filter** over a `#121212` background, and has
**no supported custom-font path when embedded** (#9132, #10184 open) — three head-on
collisions with the identity **[VERIFIED]**.

The hand-rolled route costs real code (selection, move, undo stack, copy/paste,
text editing, persistence, cursors: ~1.5–2.5 k lines, see §4) but every primitive
it needs is tiny, MIT/OFL, and already half-built. **Settle it with the rig in §6
before committing** — it is cheap to build the same stamp pad in tldraw
(`hideUi` + one `ShapeUtil`) alongside the hand-rolled one and compare feel in an
afternoon.

---

## 1. tldraw (`tldraw`)

**Facts.** v5.6.0, published 2026-10-28 (5.5.0 → 5.6.0 in four weeks; last commit
2026-10-28) **[VERIFIED]**. License field `"SEE LICENSE IN LICENSE.md"`
**[VERIFIED]**. Peer `react ^18.2.0 || ^19.2.1` **[VERIFIED]** (React 19 issue
#5152 closed 2025-08). Bundlephobia: 1,859,684 B min / 552,201 B gz **[VERIFIED]**.
Depends on tiptap (rich text), radix-ui, react-intl, idb **[VERIFIED]**.

**License, quoted** ([LICENSE.md](https://github.com/tldraw/tldraw/blob/main/LICENSE.md)) **[VERIFIED]**:
"Not to use the Software in Production Environments" … "Production Environment
means any production deployment … where the software is used to provide
functionality to end users" … "The Software includes technical measures to verify
License Key validity, detect deployment environments, enforce usage restrictions
based on license type, and ensure proper watermark display. The Software may
collect and transmit usage data to tldraw." License states in
[LicenseManager.ts](https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/license/LicenseManager.ts):
`licensed | licensed-with-watermark | unlicensed | unlicensed-production | expired`.
Development = `http:` origin, or loopback host, or `NODE_ENV !== 'production'`
**[VERIFIED]**. In development without a key the editor works and shows the
watermark (`Watermark.tsx` renders for `unlicensed` and `licensed-with-watermark`)
**[VERIFIED]**. [tldraw.dev/community/license](https://tldraw.dev/community/license):
"When using the tldraw SDK under a hobby license, the 'made with tldraw' watermark
must be shown"; trial "free 100-day", "one trial license per commercial unit",
"collects information about where it is used" **[VERIFIED]**. Issue #10034 (open)
notes watermarked (incl. hobby) deployments ping a tracking image with
`license_id`, `url`, `environment` **[VERIFIED]**. **Bottom line:** we cannot ship
tldraw on `mage-vtt`'s domain without a key; the only $0 path is hobby +
permanent watermark + telemetry.

**Embed small, own toolbar.** `hideUi?: boolean` ("hide the user interface and only
display the canvas", `TldrawUi.tsx`) **[VERIFIED]**. `components` lets any of
`Toolbar, StylePanel, MenuPanel, PageMenu, NavigationPanel, ContextMenu,
ActionsMenu, HelpMenu, ZoomMenu, MainMenu, Minimap, QuickActions, HelperButtons,
DebugPanel, SharePanel, TopPanel, Dialogs, Toasts, RichTextToolbar, …` be set to
`null` or replaced; editor-level `Background, Grid, Cursor, CollaboratorCursor,
InFrontOfTheCanvas, OnTheCanvas, ShapeWrapper` likewise
([components.tsx](https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/context/components.tsx))
**[VERIFIED]**. Our stamp bar lives outside and calls `editor.createShapes` from
`onMount`'s editor **[VERIFIED]**. Camera: `options.cameraOptions` with `isLocked`,
`wheelBehavior: 'zoom'|'pan'|'none'`, `constraints.bounds/behavior` — a locked,
page-sized "sheet" is a config, not code **[VERIFIED]** (the top-level
`cameraOptions` prop is `@deprecated` in favor of `options.cameraOptions`).
"The `Tldraw` component must be wrapped in a parent container with an explicit
size" **[VERIFIED]**.

**Custom shapes.** `ShapeUtil` subclass with `getDefaultProps`, `getGeometry`,
`component` (returns `<HTMLContainer>`/SVG — so a stamp is a React component with
a number slot, a token is a portrait ring), `getIndicatorPath`, `static props`
validators (`T.number` …), registered via `shapeUtils={[…]}`;
`BaseBoxShapeUtil` for rectangular ones ([docs/shapes](https://tldraw.dev/docs/shapes))
**[VERIFIED]**. Shapes carry a `meta` field for arbitrary data **[INFERRED** from
docs listing; not read in source].

**Hand-drawn look.** Built-in `DefaultDashStyle` enum includes `draw` — "Hand-drawn,
sketchy line style" — per shape; the draw shape has `isPen` and `segments`
([TLDashStyle.ts](https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/styles/TLDashStyle.ts))
**[VERIFIED]**. Draw font = **Shantell Sans Informal** (`tldraw_draw*` keys in
`packages/assets/urls.js`); sans/serif/mono = IBM Plex **[VERIFIED]**. Override:
`assetUrls={{ fonts: { tldraw_draw: '/fonts/ours.woff2', … } }}` (prop typed
`{ fonts?: { [key]: string } }` in `TldrawEditor.tsx`; editor.css declares
`--tl-font-draw: 'tldraw_draw'`) **[VERIFIED]**. Custom shapes render whatever we
draw — rough.js inside a `ShapeUtil.component` is fine **[INFERRED]**.

**Editing ergonomics.** `editor.undo()/redo()/getCanUndo()/markHistoryStoppingPoint()/
bail()/selectAll()/duplicateShapes()/nudgeShapes()` in `Editor.ts`
**[VERIFIED]**; clipboard via `useClipboardEvents` (copy/cut/paste, incl.
external content) **[VERIFIED]**. **Scoping:** keyboard shortcuts attach to
`document.body` but early-return unless `editor.getInstanceState().isFocused`
([useKeyboardShortcuts.ts](https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/hooks/useKeyboardShortcuts.ts))
and `FocusManager` tracks focus on the container; `autoFocus` prop defaults
`true` — set it `false` for an embedded pad **[VERIFIED]**. So Cmd+Z only hits the
pad when it is focused **[VERIFIED]**; whether the *page* also sees it depends on
our own handlers **[INFERRED]**.

**Persistence.** `getSnapshot(store)` → `{ document, session }`; `loadSnapshot`;
`snapshot` prop for first load; `persistenceKey` (IndexedDB) is optional
**[VERIFIED]**. Incremental: `store.listen(cb, { source: 'user', scope: 'document' })`
gives `changes.added/updated([before,after])/removed`; apply remote via
`store.mergeRemoteChanges(() => { store.put(records); store.remove(ids) })`, which
"marks the changes as 'remote' … won't echo … stay out of undo/redo"
([sdk-features/collaboration](https://tldraw.dev/sdk-features/collaboration),
[Store.ts](https://github.com/tldraw/tldraw/blob/main/packages/store/src/lib/Store.ts))
**[VERIFIED]**. That is exactly a Convex-driven store: one record per Convex row,
LWW per record (matches `whiteboard-tools.md`'s conflict model). Size: a geo/stamp
record is a few hundred bytes of JSON; a draw shape grows with its `segments`
points — a busy note page is tens of KB **[INFERRED]**.

**Multiplayer.** `@tldraw/sync` needs its own WebSocket server (`TLSocketRoom`,
Cloudflare Durable Objects template or Node + `@tldraw/sync-core`; "client version
must match the server") **[VERIFIED]** — we would not use it. Presence without
sync: `InstancePresenceRecordType.create({ userId, userName, currentPageId,
color?, cursor: {x,y,type,rotation} })` put into the store, listened with
`scope: 'presence'`; rendered by the default `CollaboratorCursor` (overridable)
**[VERIFIED]**.

**Theming.** `colorScheme?: 'light'|'dark'|'system'` prop on `TldrawEditor`
(`inferDarkMode` is gone) **[VERIFIED]**; `.tl-theme__dark` CSS custom properties
in `editor.css` **[VERIFIED]**. Requires `import 'tldraw/tldraw.css'` (global
stylesheet; variables are scoped under `.tl-container`/`.tl-theme__*`)
**[VERIFIED** import; scoping **INFERRED]**.

**Gotchas.** No SSR: "tldraw is pretty tightly tied to the browser — text
measurement for layout" (maintainer, #6567, closed 2025-08) → render under
TanStack's `ClientOnly` (exported by `@tanstack/react-router` 1.170 in our
`node_modules`) + `React.lazy` **[VERIFIED]**. #6313 (open): `@tldraw/assets`'
Vite entry uses `?url` JSON imports that break on Vite 6+ — only bites if we
self-host assets via `imports.vite.js`; default CDN path unaffected
**[VERIFIED** issue; scope **INFERRED]**. #10721 (closed 2026-10): blocked license
tracking fetch threw an unhandled rejection **[VERIFIED]**.

## 2. Excalidraw (`@excalidraw/excalidraw`)

**Facts.** v0.18.1, published 2026-04-20; 0.18.0 was 2025-03-10 — one patch in 19
months while the monorepo commits daily (the app, not the package, moves)
**[VERIFIED]**. MIT **[VERIFIED]**. Peer `react ^17.0.2 || ^18.2.0 || ^19.0.0`
**[VERIFIED]**; #9186 (React 19) closed 2026-02, but #11500 (open) shows nested
`@radix-ui/*@1.0.x` still declaring `react ^16.8||^17||^18` → peer warnings
**[VERIFIED]**. Bundlephobia 1,124,502 B min / 352,695 B gz; unpacked 46.8 MB
**[VERIFIED]**. ESM-only since 0.18 **[VERIFIED]**.

**Embed, toolbar.** Fills its container **[VERIFIED]**. `UIOptions` only covers
`canvasActions` (export, clear, theme toggle, …), `tools.image`,
`dockedSidebarBreakpoint`, `welcomeScreen` — **no toolbar switch**
([ui-options](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options))
**[VERIFIED]**. In `LayerUI.tsx` the shapes toolbar renders whenever
`!appState.viewModeEnabled`; `zenModeEnabled` only adds a `zen-mode` class
**[VERIFIED]**. So: hide with CSS on `.App-toolbar` (unsupported, breakable) or
accept it **[INFERRED]**. Custom UI slots: `renderTopRightUI(isMobile, appState)`,
`<MainMenu>`, `<Footer>`, `<WelcomeScreen>`, `<Sidebar>` children **[VERIFIED]**.
Outside toolbar drives it via `excalidrawAPI.setActiveTool`,
`updateScene({ elements, captureUpdate })` **[VERIFIED]**.

**Custom shapes.** None. #5798 "How to add custom shape type?" open since
2022-10 **[VERIFIED]**. Workaround: a stamp = `convertToExcalidrawElements` skeleton
(rectangle + `label`, or a `frame` with children) sharing `groupIds`, tagged via
`customData?: Record<string, any>` on every element
([types.ts](https://github.com/excalidraw/excalidraw/blob/master/packages/element/src/types.ts))
**[VERIFIED]**; `convertToExcalidrawElements` is "in beta and subject to change"
**[VERIFIED]**. The group is still ordinary elements: users can ungroup, delete
the number, resize the frame — the stamp has no identity of its own
**[INFERRED]**. Reusable stamps could also be `LibraryItem`s
(`{id, status, elements, created}`) via `updateLibrary` **[VERIFIED]**.

**Hand-drawn look.** Per-element `roughness` with `ROUGHNESS = {architect:0,
artist:1, cartoonist:2}` **[VERIFIED]**; fonts `FONT_FAMILY = {Virgil:1,
Helvetica:2, Cascadia:3, Excalifont:5, Nunito:6, "Lilita One":7, "Comic Shanns":8}`,
default Excalifont **[VERIFIED]**. Fonts load from the esm.run CDN unless
`window.EXCALIDRAW_ASSET_PATH` is set to a self-hosted copy of `dist/prod/fonts`
**[VERIFIED]**. **Custom fonts: no public API** — `Fonts.register` is `private
static`; #9132 "Enable custom fonts when embedded as an npm package" and #10184
open **[VERIFIED]**.

**Ergonomics.** Undo/redo/copy/paste/multi-select built in; keyboard is scoped to
the component unless `handleKeyboardGlobally` (default `false`) **[VERIFIED]**.
No programmatic `undo()/redo()` on the API — only `history.clear()`
**[VERIFIED]**.

**Persistence.** `onChange(elements, appState, files)` fires on every change;
elements carry `version`/`versionNonce`/`isDeleted` for LWW merge
(`reconcileElements`, `getSceneVersion`, `hashElementsVersion` exported)
**[VERIFIED]**; newer delta API: `onIncrement(DurableIncrement | EphemeralIncrement)`
prop and `excalidrawAPI.onIncrement` **[VERIFIED** exists; semantics not read].
Scene JSON: `{ elements, appState, files }`; a freedraw element stores raw
`points` — a scribbled page is tens of KB **[INFERRED]**.

**Multiplayer.** Not in the package. Collab lives in `excalidraw-app/collab/`
(`socket.io-client`, Firebase) **[VERIFIED]**. The package exposes the hooks:
`isCollaborating`, `onPointerUpdate`, `updateScene({ collaborators: Map })` with
`Collaborator = { pointer, username, color, avatarUrl, selectedElementIds, id… }`
**[VERIFIED]** — enough to wire Convex presence ourselves.

**Theming.** Required `import "@excalidraw/excalidraw/index.css"` **[VERIFIED]**.
Dark theme: `.excalidraw.theme--dark` sets `--default-bg-color: #121212` and
`--theme-filter: invert(93%) hue-rotate(180deg)`; `DARK_THEME_FILTER` constant in
`constants.ts` **[VERIFIED]** — the canvas is inverted, so verdigris ink becomes
a different colour unless we pre-invert every colour we draw **[INFERRED]**.
Primary accent via `--color-primary*` overrides on `.excalidraw` **[VERIFIED]**.

**Gotchas.** "Excalidraw should be rendered on the client" → `ClientOnly`
**[VERIFIED]**. Vite: docs say define `process.env.IS_PREACT`; #9742 (open,
2025-07) "Importing excalidraw causes Vite to crash after tree shake" (Vite 6–7,
no maintainer reply) **[VERIFIED]**. #11639 (asset path ignored for fonts) was
user error, closed **[VERIFIED]**.

## 3. Ruled out in a line

- **Konva / react-konva** 10.9.0 / 19.3.2, MIT, peer `react ^19.3.0` **[VERIFIED]** —
  a canvas scene graph, not an editor: no shape model, undo, selection, text
  editing, or hand-drawn style; we'd write everything the hand-rolled route
  writes, on a 56 KB gz runtime we don't need (SVG already suffices)
  **[INFERRED]**.
- **Fabric.js** 7.4.0 MIT **[VERIFIED]** — imperative, no React binding, same
  "engine not editor" gap **[INFERRED]**.
- **Paper.js** 0.16.0, **Pixi** 8.22.0 (76 MB unpacked) MIT **[VERIFIED]** —
  vector/WebGL engines; wrong layer **[INFERRED]**.
- **React Flow (`@xyflow/react`)** 12.12.0 MIT **[VERIFIED]** — node/edge graphs,
  no ink **[INFERRED]**. **react-sketch-canvas** 8.0.0 — ink only, no objects
  **[INFERRED]**.

## 4. The hand-rolled route (costed)

**Pieces (all MIT/OFL, all tiny):**
- `perfect-freehand` 1.2.3 (2026-02), **2.0 KB gz**: `getStroke(points, {size,
  thinning, smoothing, streamline, simulatePressure, start/end taper})` → polygon
  outline we fill as one SVG path **[VERIFIED]** (it is what Excalidraw and tldraw
  use for ink **[VERIFIED** Excalidraw dep list; tldraw **INFERRED]**).
- `roughjs` 4.6.6 (last release 2023-11 — stable, not dead), **8.9 KB gz**:
  `rough.svg()`/`generator`, `roughness`, `bowing`, fill styles, and a `seed`
  option "for creating the exact shape when re-generating with the same
  parameters" — so a stamp's wobble is stable across renders and clients
  **[VERIFIED]**.
- Handwriting fonts on Google Fonts, all OFL (`ofl/*/OFL.txt`) **[VERIFIED]**:
  **Caveat** (variable weight; hurried, legible), **Kalam** (3 weights, steadier),
  **Patrick Hand** (neat), **Reenie Beanie** (fastest/messiest; thin — test
  legibility on dark), **Shantell Sans** (tldraw's; variable, informal axis).
  Pick two: body (Caveat) + a steadier label face (Kalam) **[INFERRED]**.
- Moving notes: pointer events (prototype already drags tokens); `@dnd-kit/core`
  6.3.1 (14 KB gz, last release 2024-12) is not needed for free-position dragging
  **[VERIFIED** facts; **INFERRED** fit].

**Free from the prototype:** pen/line ink, text drop, tokens with rings, erase,
tool palette in the locked skin, cursor overlay layout **[VERIFIED]**.

**We write (estimate, [INFERRED]):** element Schema (`src/domain`, branded ids,
`Match` over kinds) ~150 lines; renderer per kind incl. rough frames + stamp
number slot ~300; hit-testing/selection/marquee/move/nudge/delete ~300; command
stack (undo/redo as inverse ops or snapshots; XState machine for tool modes,
which the repo already plans) ~200; copy/paste (internal clipboard + Cmd+C/V
scoped to a focused pad) ~100; inline text edit ~150; Convex persistence
(one row per element, `_creationTime` order, LWW) + presence ~200; keyboard map
~50. **~1.5–2.5 k lines**, no resize/rotate handles in v1 (stamps are fixed-size
by design). What we never get: rich text, image paste, arrows that bind,
accessibility work tldraw has done.

## 5. Comparison

| | tldraw 5.6.0 | Excalidraw 0.18.1 | Hand-rolled kit |
|---|---|---|---|
| License | Key required in prod; hobby = watermark + telemetry; price unpublished | MIT | MIT/OFL parts |
| Size (gz) | 552 KB | 353 KB | ~15 KB libs + our code |
| React 19 / SSR | ✓ / client-only | ✓ (radix peer warns) / client-only | ✓ / SSR-able SVG |
| Hide chrome | `hideUi`, `components` nulls | No toolbar switch; CSS hack | n/a |
| Custom stamp/token shape | `ShapeUtil` ✓ | ✗ (grouped elements + `customData`) | native |
| Hand-drawn | `dash:'draw'`, Shantell Sans, font override | `roughness` 0/1/2, Excalifont, no custom font | rough.js seeded + any font |
| Undo/copy/select | ✓ programmatic | ✓ (no `undo()` API) | write it |
| Keyboard scoping | focus-gated | component-scoped | ours |
| Convex persistence | `store.listen` + `mergeRemoteChanges` | `onChange`/`onIncrement` + `reconcileElements` | trivial |
| Cursors | presence records + `CollaboratorCursor` | `collaborators` map | prototype has it |
| Dark/identity | CSS vars, `colorScheme` | invert filter over #121212 | native |

## 6. What to prototype first

The question is *feel*, so build the smallest pad that exercises every verb in
the owner's sentence, twice, in one day — under `src/routes/prototype/`:

1. **`notebook-kit.tsx` (hand-rolled, ~half day):** 768×420 SVG "page" with a
   paper texture in the void palette; stamp bar (Spell, Armor N, Boost +N,
   Condition −N, Mark, Scene, Blank) that drops a rough.js-framed card
   (`seed = hash(id)`, `roughness 1.2–1.8`, slight random rotation ±2°) with a
   Caveat title and a tappable number; pen via `perfect-freehand`; drag; marquee
   select; Delete; Cmd+Z/Shift+Cmd+Z over a 50-entry inverse-op stack; Cmd+C/V
   with a 12 px offset. Fonts: Caveat and Kalam side by side on two stamps.
2. **`notebook-tldraw.tsx` (~half day, dev-only, no key):** `<Tldraw hideUi
   autoFocus={false} colorScheme="dark" assetUrls={{fonts:{tldraw_draw: Caveat}}}
   options={{cameraOptions:{isLocked:true}}} shapeUtils={[StampUtil]} />` with the
   same stamp bar calling `editor.createShapes`. The watermark will show; that
   is part of what's being judged.

**Settles:** does seeded rough + handwriting font read as "notes under duress"
or as clip-art; is a fixed-size stamp enough or do people want to resize; does
tldraw's handle/snap grammar help or fight; and whether 552 KB + a watermark in
the mage's notebook is a price the owner will pay. If the hand-rolled pad feels
right, promote its element Schema to `src/domain/` and grow the whiteboard from
the same kit; if it feels thin, the tldraw rig already has the answers to
licensing (trial → commercial quote) and Convex wiring (§1) ready.
