/**
 * PROTOTYPE — THROWAWAY. Do not ship. (Rote-section look grilling, issue #89.)
 *
 * The Rotes section as a book: dot-leader table of contents → in-place page →
 * recite. Book voices switchable via `?rotebook=A|B|C` on the live session
 * route; watermark audition via the floating bar. Motion page turn: forward
 * slips left, back slips right, contents rises.
 *
 * Round 2 (owner feedback 2026-07-17): fixed section height (no layout shift),
 * leaders centered, ToC totals read as DICE, Contents top-left, power
 * shorthand (Arcanum glyph + level dots) top-right, Order glyph coupled,
 * folio "1 of 3", watermark bottom-right clipping, pool block rebuilt in the
 * sheet's trait language (zone-colored dots, hero total, "Rote Specialty +1"
 * in words), Spectral is the default voice.
 *
 * Page content is HARDCODED from spells.json for Corvin's three spells —
 * KnownRote doesn't carry it yet; plumbing it is #89 implementation scope.
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { KnownRote } from "#/domain/character"
import type { useCast } from "#/hooks/use-cast"
import { ArcanaGlyph, OrderGlyph, arcanumTint, isGrossArcanum } from "./ArcanaGlyph"
import { DotRating } from "./DotRating"

type CastAPI = ReturnType<typeof useCast>

/* ── Book voices under audition (B locked as winner 2026-07-17) ─────────── */

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Spectral:ital,wght@0,400;0,500;1,400&family=Alegreya:ital,wght@0,400;0,500;1,400&display=swap"

const VOICES = [
  { key: "A", name: "EB Garamond", family: "'EB Garamond', Georgia, serif", size: 15.5, lh: 1.62 },
  { key: "B", name: "Spectral", family: "'Spectral', Georgia, serif", size: 14.5, lh: 1.68 },
  { key: "C", name: "Alegreya", family: "'Alegreya', Georgia, serif", size: 15, lh: 1.6 },
] as const
type VoiceKey = (typeof VOICES)[number]["key"]

/* ── Hardcoded page content (from spells.json / Mage core) ──────────────── */

interface PoolTrait {
  name: string
  dots: number
  kind: "attribute" | "skill" | "arcanum"
  specialty?: boolean
}

interface PoolAlt {
  traits: PoolTrait[]
  bonus: number
  total: number
}

interface PageContent {
  roteName: string
  spellName: string
  arcanum: string
  level: number
  order: string
  practice: string
  action: string
  duration: string
  aspect: string
  cost: string
  pool: PoolAlt[]
  vs?: string
  paragraphs: string[]
  roteFlavor?: string
}

const PAGES: Record<string, PageContent> = {
  "Speak with the Dead": {
    roteName: "Clamor of the Dead",
    spellName: "Speak with the Dead",
    arcanum: "Death",
    level: 1,
    order: "Mysterium",
    practice: "Unveiling",
    action: "Instant",
    duration: "Prolonged (one scene)",
    aspect: "Covert",
    cost: "None — successes must equal or exceed the Potency of any power used to conceal the ghost",
    pool: [
      {
        traits: [
          { name: "Wits", dots: 2, kind: "attribute" },
          { name: "Occult", dots: 3, kind: "skill", specialty: true },
          { name: "Death", dots: 2, kind: "arcanum" },
        ],
        bonus: 1,
        total: 8,
      },
    ],
    paragraphs: [
      "The mage can see, hear and speak with ghosts within Twilight. He can also detect their unseen presence, if they are hiding or have chosen not to reveal themselves.",
      "He can see spirits within Twilight, too, but they appear hazy and indistinct and he cannot hear them, unless he also uses Spirit 1 while casting this spell. He cannot perceive mental projections unless he adds Mind 1 to the casting.",
    ],
    roteFlavor:
      "Mystagogues developed this rote to interrogate the restless dead directly — the archive that cannot burn.",
  },
  // NOTE: the rote's real name is truncated to "The Seal of" in spells.json
  // (parser clip) — display name below is a STAND-IN pending the corrections
  // pass. Matched by spellName, so the live row still finds its page.
  "Ectoplasmic Shaping": {
    roteName: "The Seal of the Grave",
    spellName: "Ectoplasmic Shaping",
    arcanum: "Death",
    level: 1,
    order: "Mysterium",
    practice: "Compelling",
    action: "Instant and contested",
    duration: "Prolonged (one scene)",
    aspect: "Vulgar",
    cost: "None — successes are used as Potency to wrest control of the ectoplasm from whoever currently commands it",
    pool: [
      {
        traits: [
          { name: "Presence", dots: 2, kind: "attribute" },
          { name: "Occult", dots: 3, kind: "skill", specialty: true },
          { name: "Death", dots: 2, kind: "arcanum" },
        ],
        bonus: 1,
        total: 8,
      },
    ],
    vs: "Contested — the target reflexively rolls Resolve + Gnosis (mage) or Resistance (ghost)",
    paragraphs: [
      "The mage can alter the form of an ectoplasmic manifestation, shaping it with his will into whatever form he desires.",
      "He must contend with the will of the mage who conjured the ectoplasm or the ghost who manifests through it.",
    ],
    roteFlavor:
      "Mystagogues stamp borrowed ectoplasm with the Order's seal, bending a dead thing's substance to a living scholar's argument.",
  },
  "Craftsman's Eye": {
    roteName: "Rube Goldberg's Brain",
    spellName: "Craftsman's Eye",
    arcanum: "Matter",
    level: 1,
    order: "Mysterium",
    practice: "Knowing",
    action: "Instant",
    duration: "Concentration",
    aspect: "Covert",
    cost: "None",
    pool: [
      {
        traits: [
          { name: "Intelligence", dots: 3, kind: "attribute" },
          { name: "Investigation", dots: 2, kind: "skill", specialty: true },
          { name: "Matter", dots: 3, kind: "arcanum" },
        ],
        bonus: 1,
        total: 9,
      },
      {
        traits: [
          { name: "Intelligence", dots: 3, kind: "attribute" },
          { name: "Science", dots: 3, kind: "skill" },
          { name: "Matter", dots: 3, kind: "arcanum" },
        ],
        bonus: 0,
        total: 9,
      },
    ],
    paragraphs: [
      "The mage can discover the proper function of an object with moving parts. At the Storyteller's discretion, this might aid Craft Skill rolls.",
    ],
    roteFlavor:
      "Elaborate moving-part puzzles and ancient machines of unknown purpose, among many other things, can be deciphered by means of this Mysterium rote.",
  },
}

const fallbackPage = (rote: KnownRote): PageContent => ({
  roteName: rote.name,
  spellName: rote.spellName,
  arcanum: rote.spellArcanum,
  level: rote.spellLevel,
  order: rote.order,
  practice: "—",
  action: "—",
  duration: "—",
  aspect: rote.spellAspect ?? "—",
  cost: "—",
  pool: [],
  paragraphs: ["(No page content wired for this spell in the prototype.)"],
})

const pageFor = (rote: KnownRote): PageContent =>
  PAGES[rote.spellName] ?? fallbackPage(rote)

const traitColor = (trait: PoolTrait, arcanum: string): string =>
  trait.kind === "attribute"
    ? "var(--zone-attr)"
    : trait.kind === "skill"
      ? "var(--zone-skill)"
      : arcanumTint(arcanum)

/** ToC right-hand column: unmistakably dice, never page numbers. Or-pools
 * name each alternative's skill: "9 Investigation or 9 Science dice". */
const tocDice = (page: PageContent): { text: string; suffix?: string } => {
  if (page.pool.length === 0) return { text: "—" }
  const text =
    page.pool.length > 1
      ? `${page.pool
          .map((a) => {
            const skill = a.traits.find((t) => t.kind === "skill")
            return `${a.total} ${skill?.name ?? "?"}`
          })
          .join(" or ")} dice`
      : `${page.pool[0]!.total} dice`
  return page.vs ? { text, suffix: "contested" } : { text }
}

/* ── Book order: dashboard-canonical Arcana, then level, then name (#88) ── */

const ARCANA_CANON = [
  "prime", "fate", "mind", "spirit", "death",
  "forces", "time", "space", "life", "matter",
]

const bookOrder = (rotes: readonly KnownRote[]): KnownRote[] =>
  [...rotes].sort((a, b) => {
    const ai = ARCANA_CANON.indexOf(a.spellArcanum.toLowerCase())
    const bi = ARCANA_CANON.indexOf(b.spellArcanum.toLowerCase())
    if (ai !== bi) return ai - bi
    if (a.spellLevel !== b.spellLevel) return a.spellLevel - b.spellLevel
    return a.name.localeCompare(b.name)
  })

/** Fixed book height: the ToC and every page live in the same frame, so the
 * turn never reflows the sheet below (owner call 2026-07-17). Sized so the
 * longest current page FITS — a book page never scrolls; if a spell outgrows
 * the frame the book answer is "continued overleaf", not a scrollbar. */
const BOOK_HEIGHT = 640

/* ── URL params (throwaway plumbing — no router integration) ────────────── */

const readParams = (): { enabled: boolean; voice: VoiceKey; wm: boolean } => {
  if (typeof window === "undefined") return { enabled: false, voice: "B", wm: false }
  const p = new URLSearchParams(window.location.search)
  const raw = p.get("rotebook")
  const voice = VOICES.find((v) => v.key === raw?.toUpperCase())?.key ?? "B"
  return { enabled: raw !== null, voice, wm: p.get("wm") === "1" }
}

const writeParams = (voice: VoiceKey, wm: boolean) => {
  const p = new URLSearchParams(window.location.search)
  p.set("rotebook", voice)
  if (wm) p.set("wm", "1")
  else p.delete("wm")
  window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`)
}

/* ── Gate: renders children (the real rows) unless ?rotebook is present ── */

export function RoteBookPrototypeGate({
  rotes,
  order,
  cast,
  children,
}: {
  rotes: readonly KnownRote[]
  order: string
  cast?: CastAPI | undefined
  children: ReactNode
}) {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    setEnabled(import.meta.env.DEV && readParams().enabled)
  }, [])
  if (!enabled) return <>{children}</>
  return <RoteBook rotes={rotes} order={order} cast={cast} />
}

/* ── The book ───────────────────────────────────────────────────────────── */

type View = { kind: "toc" } | { kind: "page"; index: number }

function RoteBook({
  rotes,
  order,
  cast,
}: {
  rotes: readonly KnownRote[]
  order: string
  cast?: CastAPI | undefined
}) {
  const [voice, setVoice] = useState<VoiceKey>(() => readParams().voice)
  const [wm, setWm] = useState(() => readParams().wm)
  const [view, setView] = useState<View>({ kind: "toc" })
  // -1 back / +1 forward / 0 = vertical (to or from contents)
  const [direction, setDirection] = useState(0)
  const reduced = useReducedMotion() ?? false

  const ordered = bookOrder(rotes)

  const armedName =
    cast?.context.selection?.method === "rote"
      ? cast.context.selection.rote.name
      : null
  const disarmIfArmed = (rote: KnownRote) => {
    if (cast && armedName === rote.name) cast.cancel()
  }

  const openPage = (index: number) => {
    setDirection(0)
    setView({ kind: "page", index })
  }
  const toContents = () => {
    if (view.kind === "page") disarmIfArmed(ordered[view.index]!)
    setDirection(0)
    setView({ kind: "toc" })
  }
  const leaf = (delta: -1 | 1) => {
    if (view.kind !== "page") return
    const next = view.index + delta
    if (next < 0 || next >= ordered.length) return
    disarmIfArmed(ordered[view.index]!)
    setDirection(delta)
    setView({ kind: "page", index: next })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))
        return
      if (view.kind !== "page") return
      if (e.key === "Escape") toContents()
      if (e.key === "ArrowRight") leaf(1)
      if (e.key === "ArrowLeft") leaf(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const voiceDef = VOICES.find((v) => v.key === voice) ?? VOICES[1]

  const slide = reduced ? 0 : 26
  const rise = reduced ? 0 : 10
  const variants = {
    enter: (d: number) => ({
      opacity: 0,
      x: d === 0 ? 0 : d * slide,
      y: d === 0 ? rise : 0,
    }),
    center: { opacity: 1, x: 0, y: 0 },
    exit: (d: number) => ({
      opacity: 0,
      x: d === 0 ? 0 : d * -slide,
      y: d === 0 ? -rise : 0,
    }),
  }

  return (
    <div className="relative" style={{ height: BOOK_HEIGHT }}>
      <link rel="stylesheet" href={FONTS_HREF} />
      {/* the smoulder — armed trigger burns low until released or cast */}
      <style>{`
        @keyframes proto-smoulder-drift {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes proto-smoulder-breathe {
          0%, 100% { box-shadow: 0 0 6px rgba(216,122,62,.22), inset 0 0 8px rgba(216,122,62,.12); }
          50% { box-shadow: 0 0 16px rgba(216,122,62,.42), inset 0 0 15px rgba(216,122,62,.22); }
        }
        .proto-smoulder {
          background-image: linear-gradient(100deg,
            rgba(216,122,62,.06) 15%, rgba(242,166,88,.24) 42%,
            rgba(150,60,35,.10) 58%, rgba(216,122,62,.06) 85%);
          background-size: 200% 100%;
          animation: proto-smoulder-drift 3.4s linear infinite,
                     proto-smoulder-breathe 2.6s ease-in-out infinite;
        }
        .proto-rune-lit .proto-rune-path {
          stroke-dasharray: 64;
          stroke-dashoffset: 64;
          animation: proto-rune-inscribe 0.5s ease-out forwards;
        }
        @keyframes proto-rune-inscribe {
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .proto-smoulder { animation: none; }
          .proto-rune-lit .proto-rune-path { animation: none; stroke-dashoffset: 0; }
        }
      `}</style>
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={view.kind === "toc" ? "toc" : `page-${view.index}`}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduced ? 0.12 : 0.26, ease: [0.25, 0.8, 0.35, 1] }}
          className="h-full"
        >
          {view.kind === "toc" ? (
            <Contents rotes={ordered} order={order} watermark={wm} onOpen={openPage} />
          ) : (
            <Page
              rote={ordered[view.index]!}
              index={view.index}
              count={ordered.length}
              prev={ordered[view.index - 1]}
              next={ordered[view.index + 1]}
              voice={voiceDef}
              watermark={wm}
              cast={cast}
              armed={armedName === ordered[view.index]!.name}
              onContents={toContents}
              onLeaf={leaf}
            />
          )}
        </motion.div>
      </AnimatePresence>
      <SwitcherBar
        voice={voiceDef}
        wm={wm}
        onCycle={(delta) => {
          const i = VOICES.findIndex((v) => v.key === voice)
          const nextVoice = VOICES[(i + delta + VOICES.length) % VOICES.length]!
          setVoice(nextVoice.key)
          writeParams(nextVoice.key, wm)
        }}
        onToggleWm={() => {
          setWm(!wm)
          writeParams(voice, !wm)
        }}
      />
    </div>
  )
}

/* ── Table of contents ──────────────────────────────────────────────────── */

function Contents({
  rotes,
  order,
  watermark,
  onOpen,
}: {
  rotes: readonly KnownRote[]
  order: string
  watermark: boolean
  onOpen: (index: number) => void
}) {
  return (
    <div
      className="relative grid h-full content-start gap-0.5 overflow-hidden rounded-[4px] px-4 py-3"
      style={{
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--dim) 22%, transparent)",
      }}
    >
      {/* the back of the index wears the Order's seal, embossed — this
          grimoire is an Order artifact before it is anything else */}
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center"
          style={{
            color: "var(--dim)",
            opacity: 0.07,
            filter:
              "drop-shadow(0 1.5px 0 rgba(0,0,0,.6)) drop-shadow(0 -1px 0 rgba(255,255,255,.06))",
          }}
        >
          <OrderGlyph order={order} size={210} />
        </span>
      )}
      {rotes.map((rote, i) => {
        const page = pageFor(rote)
        const dice = tocDice(page)
        return (
          <button
            key={rote.name}
            type="button"
            onClick={() => onOpen(i)}
            className="mv-trait -mx-2 flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left"
            title={`Turn to ${page.roteName}`}
          >
            <span style={{ color: arcanumTint(rote.spellArcanum) }}>
              <ArcanaGlyph
                arcanum={rote.spellArcanum.toLowerCase()}
                size={17}
                variant={isGrossArcanum(rote.spellArcanum) ? "seal" : "line"}
              />
            </span>
            <span className="whitespace-nowrap text-[14px]" style={{ color: "var(--ink)" }}>
              {page.roteName}
            </span>
            {/* leader meets the text at mid line-height on both ends */}
            <span
              aria-hidden
              className="mx-1 h-0 flex-1 self-center border-b border-dotted"
              style={{ borderColor: "color-mix(in srgb, var(--dim) 45%, transparent)" }}
            />
            <span className="mv-data whitespace-nowrap text-[12px]" style={{ color: "var(--ink)" }}>
              {dice.text}
              {dice.suffix && (
                <span style={{ color: "var(--dim)" }}> · {dice.suffix}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── A page ─────────────────────────────────────────────────────────────── */

function Page({
  rote,
  index,
  count,
  prev,
  next,
  voice,
  watermark,
  cast,
  armed,
  onContents,
  onLeaf,
}: {
  rote: KnownRote
  index: number
  count: number
  prev?: KnownRote | undefined
  next?: KnownRote | undefined
  voice: (typeof VOICES)[number]
  watermark: boolean
  cast?: CastAPI | undefined
  armed: boolean
  onContents: () => void
  onLeaf: (delta: -1 | 1) => void
}) {
  const page = pageFor(rote)
  const tint = arcanumTint(rote.spellArcanum)
  const canRecite = cast !== undefined && cast.state !== "casting"
  const totalDice = page.pool[0]?.total ?? 0

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[4px] px-4 pb-3 pt-2"
      style={{
        transition: "box-shadow 0.3s",
        boxShadow: armed
          ? `inset 0 0 0 1px color-mix(in srgb, ${tint} 55%, transparent), inset 0 0 42px color-mix(in srgb, ${tint} 10%, transparent)`
          : "inset 0 0 0 1px color-mix(in srgb, var(--dim) 22%, transparent)",
      }}
    >
      {/* watermark — the Arcanum's device, low in the bottom-right corner,
          clipping the page edge (owner call 2026-07-17). While the spell is
          readied it lifts in brightness, just enough to notice — the page's
          magic waking up under the words. */}
      {watermark && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-10 transition-opacity duration-500"
          style={{ color: tint, opacity: armed ? 0.22 : 0.055 }}
        >
          <ArcanaGlyph
            arcanum={rote.spellArcanum.toLowerCase()}
            size={240}
            variant={isGrossArcanum(rote.spellArcanum) ? "seal" : "line"}
          />
        </span>
      )}

      {/* top corners: the way back (left) · the spell's intrinsic power
          (right — Arcanum glyph + level dots, the Gnosis treatment) */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onContents}
          className="text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--dim)] transition-colors hover:text-[color:var(--ink)] hover:underline"
          title="Back to contents (Esc)"
        >
          ‹ Contents
        </button>
        {/* the power corner — the Gnosis treatment: this is the big signal
            of how mighty a spell this is */}
        <span
          className="flex items-center gap-2"
          title={`${page.arcanum} ${page.level} — minimum ${page.arcanum} to cast`}
        >
          <span style={{ color: tint }}>
            <ArcanaGlyph
              arcanum={page.arcanum.toLowerCase()}
              size={22}
              variant={isGrossArcanum(page.arcanum) ? "seal" : "line"}
            />
          </span>
          <span
            className="text-[10.5px] uppercase tracking-[0.18em]"
            style={{ color: tint }}
          >
            {page.arcanum}
          </span>
          <span className="mv-h text-[26px] leading-none" style={{ color: "var(--ink)" }}>
            {page.level}
          </span>
        </span>
      </div>

      {/* title block — breathing room, then the description standing alone */}
      <h3 className="mv-h mt-4 text-[21px] leading-tight" style={{ color: "var(--ink)" }}>
        {page.roteName}
      </h3>
      <p className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--dim)" }}>
        {page.spellName} ·
        <span className="inline-flex items-center gap-1">
          <OrderGlyph order={page.order} size={13} />
          {page.order} rote
        </span>
      </p>

      {/* the rulebook's own stat block, quoted */}
      <div
        className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 border-y py-2.5"
        style={{ borderColor: "color-mix(in srgb, var(--dim) 25%, transparent)" }}
      >
        {[
          ["Practice", page.practice],
          ["Action", page.action],
          ["Duration", page.duration],
          ["Aspect", page.aspect],
          ["Cost", page.cost],
        ].map(([label, value]) => (
          <StatRow key={label} label={label ?? ""} value={value ?? ""} />
        ))}
        {/* the pool in the sheet's own trait language: the total is the hero,
            the traits explain it, the specialty die speaks in words */}
        <span
          className="self-baseline text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--dim)" }}
        >
          Dice pool
        </span>
        <span className="grid gap-1.5">
          {page.pool.map((alt, i) => (
            <span
              key={alt.traits.map((t) => t.name).join("-")}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-none"
            >
              {i > 0 && (
                <span className="text-[11.5px] italic leading-none" style={{ color: "var(--dim)" }}>
                  or
                </span>
              )}
              <span className="flex items-baseline gap-1 leading-none">
                <span className="mv-data text-[21px] leading-none" style={{ color: "var(--ink)" }}>
                  {alt.total}
                </span>
                <span className="text-[10.5px] uppercase leading-none tracking-[0.14em]" style={{ color: "var(--dim)" }}>
                  dice
                </span>
              </span>
              <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 leading-none">
                {alt.traits.map((trait) => (
                  <span
                    key={trait.name}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-none"
                    style={{ color: traitColor(trait, page.arcanum) }}
                  >
                    {trait.name}
                    <DotRating current={trait.dots} color={traitColor(trait, page.arcanum)} />
                  </span>
                ))}
                {alt.bonus > 0 && (
                  <span
                    className="whitespace-nowrap text-[12px] leading-none"
                    style={{ color: "var(--accent)" }}
                    title="Casting your own Order's rote through one of its three specialty skills grants an extra die"
                  >
                    Rote Specialty +{alt.bonus}
                  </span>
                )}
              </span>
            </span>
          ))}
          {page.vs && (
            <span className="text-[11.5px] italic" style={{ color: "var(--dim)" }}>
              {page.vs}
            </span>
          )}
        </span>
      </div>

      {/* the book's words, in the book's voice */}
      {/* no inner scrollbar — a book page doesn't scroll; the frame is sized
          to fit, and overflow means the content needs "continued overleaf" */}
      <div
        className="mt-3.5 min-h-0 flex-1 overflow-hidden"
        style={{
          fontFamily: voice.family,
          fontSize: voice.size,
          lineHeight: voice.lh,
          color: "var(--ink)",
          maxWidth: "62ch",
        }}
      >
        {page.paragraphs.map((para, i) => (
          <p key={para.slice(0, 24)} className={i > 0 ? "mt-2.5" : ""}>
            {i === 0 && (
              <span
                className="mv-h float-left pr-1.5"
                style={{
                  color: tint,
                  fontSize: "3.05em",
                  lineHeight: 0.82,
                  paddingTop: "0.06em",
                }}
              >
                {para.charAt(0)}
              </span>
            )}
            {i === 0 ? para.slice(1) : para}
          </p>
        ))}
        {page.roteFlavor && (
          <p className="mt-2.5 italic" style={{ color: "var(--dim)" }}>
            {page.roteFlavor}
          </p>
        )}
      </div>

      {/* recitation */}
      {cast !== undefined && (
        <button
          type="button"
          disabled={!canRecite}
          onClick={() => {
            if (armed) cast.cancel()
            else cast.armRote(rote)
          }}
          className={`group relative mt-3 self-start px-1 pb-2 pt-1 text-[12px] uppercase tracking-[0.16em] transition-colors ${
            armed
              ? "proto-smoulder rounded-[3px] text-[#e8a670]"
              : "text-[color:var(--dim)] hover:text-[color:var(--ink)]"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <RuneMark seed={page.roteName} armed={armed} />
            <ScrambleLabel
              text={armed ? "Still the recitation" : `Recite — ${totalDice} dice`}
            />
          </span>
          {/* the inscription line the trigger rests on */}
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px transition-colors"
            style={{
              background: armed
                ? "linear-gradient(90deg, rgba(232,166,112,.85), rgba(150,60,35,.35))"
                : "color-mix(in srgb, var(--dim) 40%, transparent)",
            }}
          />
        </button>
      )}

      {/* page foot: leafing + folio */}
      <div className="mt-3 flex items-baseline justify-between gap-4">
        <button
          type="button"
          onClick={() => onLeaf(-1)}
          disabled={!prev}
          className="text-[11px] text-[color:var(--dim)] transition-colors hover:text-[color:var(--ink)] hover:underline disabled:opacity-0"
          title="Previous page (←)"
        >
          ‹ {prev ? pageFor(prev).roteName : ""}
        </button>
        <span className="mv-data text-[10.5px]" style={{ color: "var(--dim)" }}>
          {index + 1} of {count}
        </span>
        <button
          type="button"
          onClick={() => onLeaf(1)}
          disabled={!next}
          className="text-[11px] text-[color:var(--dim)] transition-colors hover:text-[color:var(--ink)] hover:underline disabled:opacity-0"
          title="Next page (→)"
        >
          {next ? pageFor(next).roteName : ""} ›
        </button>
      </div>
    </div>
  )
}

/** The rote's mudra as the grimoire notates it (mudras: the hand-signs that
 * activate rotes, "mnemonics for the imagination" — Mage p. 76/119). Derived
 * deterministically from the rote's name: same rote, same mark, always; every
 * rote in the book bears its own sign. A spine stroke is the shared alphabet;
 * the branches are the rote's own. On strike it inscribes itself ("each rune
 * must be handmade in the moment") before the smoulder takes over. */
const hashName = (name: string): number =>
  [...name].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) >>> 0, 5381)

const sigilPath = (name: string): string => {
  const h = hashName(name)
  const bit = (n: number) => (h >>> n) & 1
  const pick = (n: number, mod: number) => (h >>> n) % mod
  const ys = [4.5, 8.5, 12.5, 15.5]
  const side = (b: number) => (b ? 14.5 : 1.5)
  const y1 = ys[pick(2, 4)]!
  const y2 = ys[(pick(2, 4) + 1 + pick(5, 2)) % 4]!
  const y3 = ys[(pick(2, 4) + 2 + pick(7, 2)) % 4]!
  const branch = (y: number, b: number, reach: number) =>
    `M8 ${y} L${side(b)} ${y - reach}`
  const crossTick = `M${4 + pick(13, 3)} 16.5 L${9 + pick(15, 5)} ${14 + pick(17, 3)}`
  return [
    "M8 1.5 V18.5",
    branch(y1, bit(3), 2.5 + pick(9, 3)),
    branch(y2, 1 - bit(3), 1.5 + pick(11, 3)),
    bit(6) ? crossTick : branch(y3, bit(8), 2 + pick(19, 2)),
  ].join(" ")
}

/** The trigger label re-utters itself (owner idea, after MagicUI's HyperText):
 * on state change the new text resolves left to right while the unresolved
 * tail cycles through arcane letterforms — the words briefly become High
 * Speech before settling. Lore-apt: Sleepers hear High Speech as nonsense;
 * for a beat, so do we. Spaces hold, so the word-shape reads through. */
const ARCANE_CHARS = [
  ..."ᚠᚢᚦᚨᚱᚲᚷᚹᚻᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ",
  ..."🜁🜂🜃🜄🜍🜔🜚",
]

function ScrambleLabel({ text }: { text: string }) {
  const reduced = useReducedMotion() ?? false
  const [display, setDisplay] = useState(text)
  const prevText = useRef(text)
  useEffect(() => {
    if (prevText.current === text) return
    prevText.current = text
    if (reduced) {
      setDisplay(text)
      return
    }
    const frames = 14
    let frame = 0
    const id = setInterval(() => {
      frame += 1
      const reveal = Math.floor((frame / frames) * text.length)
      const settled = text.slice(0, reveal)
      const seething = [...text.slice(reveal)]
        .map((c) =>
          c === " "
            ? " "
            : ARCANE_CHARS[Math.floor(Math.random() * ARCANE_CHARS.length)],
        )
        .join("")
      setDisplay(frame >= frames ? text : settled + seething)
      if (frame >= frames) clearInterval(id)
    }, 35)
    return () => clearInterval(id)
  }, [text, reduced])
  return <span>{display}</span>
}

function RuneMark({ seed, armed }: { seed: string; armed: boolean }) {
  return (
    <svg
      width="15"
      height="19"
      viewBox="0 0 16 20"
      fill="none"
      aria-hidden
      className={armed ? "proto-rune-lit" : ""}
    >
      <path
        d={sigilPath(seed)}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        className="proto-rune-path"
      />
    </svg>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span
        className="self-baseline text-[10.5px] uppercase leading-5 tracking-[0.14em]"
        style={{ color: "var(--dim)" }}
      >
        {label}
      </span>
      <span className="self-baseline text-[13px] leading-5" style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </>
  )
}

/* ── Floating switcher (obviously not part of the design) ───────────────── */

function SwitcherBar({
  voice,
  wm,
  onCycle,
  onToggleWm,
}: {
  voice: (typeof VOICES)[number]
  wm: boolean
  onCycle: (delta: number) => void
  onToggleWm: () => void
}) {
  if (!import.meta.env.DEV) return null
  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-[12px] shadow-lg"
      style={{
        background: "#161420",
        borderColor: "color-mix(in srgb, var(--dim) 45%, transparent)",
        color: "var(--ink)",
      }}
    >
      <button type="button" onClick={() => onCycle(-1)} aria-label="Previous voice">
        ‹
      </button>
      <span className="mv-data whitespace-nowrap">
        {voice.key} — {voice.name}
      </span>
      <button type="button" onClick={() => onCycle(1)} aria-label="Next voice">
        ›
      </button>
      <span aria-hidden style={{ color: "var(--dim)" }}>
        |
      </span>
      <button type="button" onClick={onToggleWm} className="whitespace-nowrap">
        Watermark: {wm ? "on" : "off"}
      </button>
      <span aria-hidden className="whitespace-nowrap text-[10.5px]" style={{ color: "var(--dim)" }}>
        ← → leaf · Esc contents
      </span>
    </div>
  )
}
