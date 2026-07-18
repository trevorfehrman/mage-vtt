import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { CharacterSheet, KnownRote } from "#/domain/character"
import {
  reciteDiceLabel,
  resolveRotePage,
  tocDicePhrase,
  type RotePageAlternative,
} from "#/domain/rote-book"
import { sortRotes } from "#/domain/rote-order"
import type { useCast } from "#/hooks/use-cast"
import { ArcanaGlyph, OrderGlyph, arcanumTint, isGrossArcanum } from "./ArcanaGlyph"
import { DotRating } from "./DotRating"

type CastAPI = ReturnType<typeof useCast>

/**
 * The Rotes section as the character's book (issue #89): a working grimoire
 * resting open to its table of contents, turning in place to a page per rote,
 * with the cast verb living on the page as a recitation. Look and every axis
 * owner-decided in the #89 grilling verdict; the page turn is the app's first
 * sanctioned Motion use (ADR-0021, amended 2026-07-17).
 *
 * Every number on the ToC and the pages resolves through the rote-book domain
 * leaf over #87's deepened rote-cast leaf — the row, the page, the CastPanel
 * and the log can never disagree. Read-only sheets (no cast controller)
 * render the same book inert: pages browsable, no recitation line.
 */

/** Fixed book height: the ToC and every page share the frame, so a turn never
 * reflows the sheet below (owner call 2026-07-17). Sized so every current page
 * fits whole — the real book's flavor paragraphs run longer than the
 * prototype's stand-ins — because a page never scrolls; if a spell ever
 * outgrows the frame the answer is "continued overleaf", never an inner
 * scrollbar. */
const BOOK_HEIGHT = 700

const frameShadow = "inset 0 0 0 1px color-mix(in srgb, var(--dim) 22%, transparent)"

type View = { kind: "toc" } | { kind: "page"; index: number }

export function RoteBook({
  character,
  cast,
}: {
  character: CharacterSheet
  cast?: CastAPI | undefined
}) {
  const [view, setView] = useState<View>({ kind: "toc" })
  // -1 back / +1 forward / 0 = vertical (to or from contents)
  const [direction, setDirection] = useState(0)
  const reduced = useReducedMotion() ?? false

  // Binding order = leafing order = the section order of #88.
  const ordered = sortRotes(character.rotes)

  const armedName =
    cast?.context.selection?.method === "rote"
      ? cast.context.selection.rote.name
      : null
  // Leaving a page stills its recitation — you cannot recite from a page
  // you're not on.
  const disarmIfArmed = (rote: KnownRote) => {
    if (cast && armedName === rote.name) cast.cancel()
  }

  const openPage = (index: number) => {
    setDirection(0)
    setView({ kind: "page", index })
  }
  const toContents = () => {
    if (view.kind === "page") {
      const open = ordered[view.index]
      if (open) disarmIfArmed(open)
    }
    setDirection(0)
    setView({ kind: "toc" })
  }
  const leaf = (delta: -1 | 1) => {
    if (view.kind !== "page") return
    const next = view.index + delta
    if (next < 0 || next >= ordered.length) return
    const open = ordered[view.index]
    if (open) disarmIfArmed(open)
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

  // The page-turn grammar (ADR-0021): forward slips left, back slips right,
  // contents rises. Reduced motion: fade only, quicker.
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
            <Contents
              character={character}
              rotes={ordered}
              onOpen={openPage}
            />
          ) : (
            <Page
              character={character}
              rote={ordered[view.index]!}
              index={view.index}
              count={ordered.length}
              prev={ordered[view.index - 1]}
              next={ordered[view.index + 1]}
              cast={cast}
              armed={armedName === ordered[view.index]!.name}
              onContents={toContents}
              onLeaf={leaf}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ── Table of contents ──────────────────────────────────────────────────── */

function Contents({
  character,
  rotes,
  onOpen,
}: {
  character: CharacterSheet
  rotes: ReadonlyArray<KnownRote>
  onOpen: (index: number) => void
}) {
  return (
    <div
      className="relative grid h-full content-start gap-0.5 overflow-hidden rounded-[4px] px-4 py-3"
      style={{ boxShadow: frameShadow }}
    >
      {/* the back of the index wears the Order's seal, embossed — this
          grimoire is an Order artifact before it is anything else */}
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
        <OrderGlyph order={character.order} size={210} />
      </span>
      {rotes.map((rote, i) => {
        const alternatives = resolveRotePage(character, rote)
        return (
          <button
            key={rote.name}
            type="button"
            onClick={() => onOpen(i)}
            className="mv-trait -mx-2 flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left"
            title={`Turn to ${rote.name}`}
          >
            <span style={{ color: arcanumTint(rote.spellArcanum) }}>
              <ArcanaGlyph
                arcanum={rote.spellArcanum.toLowerCase()}
                size={17}
                variant={isGrossArcanum(rote.spellArcanum) ? "seal" : "line"}
              />
            </span>
            <span className="whitespace-nowrap text-[14px]" style={{ color: "var(--ink)" }}>
              {rote.name}
            </span>
            {/* leader meets the text at mid line-height on both ends */}
            <span
              aria-hidden
              className="mx-1 h-0 flex-1 self-center border-b border-dotted"
              style={{ borderColor: "color-mix(in srgb, var(--dim) 45%, transparent)" }}
            />
            <span className="mv-data whitespace-nowrap text-[12px]" style={{ color: "var(--ink)" }}>
              {tocDicePhrase(alternatives)}
              {rote.pool.vs && <span style={{ color: "var(--dim)" }}> · contested</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ── A page ─────────────────────────────────────────────────────────────── */

function Page({
  character,
  rote,
  index,
  count,
  prev,
  next,
  cast,
  armed,
  onContents,
  onLeaf,
}: {
  character: CharacterSheet
  rote: KnownRote
  index: number
  count: number
  prev?: KnownRote | undefined
  next?: KnownRote | undefined
  cast?: CastAPI | undefined
  armed: boolean
  onContents: () => void
  onLeaf: (delta: -1 | 1) => void
}) {
  const tint = arcanumTint(rote.spellArcanum)
  const alternatives = resolveRotePage(character, rote)
  const page = rote.spellPage
  // Rows ingested before the page stamp (issue #89) have no page content —
  // the page opens anyway and degrades to placeholders.
  const paragraphs = page
    ? page.description.split(/\n\n+/)
    : ["This page awaits transcription — re-ingest the character to print the spell's text."]
  const canRecite = cast !== undefined && cast.state !== "casting"

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-[4px] px-4 pb-3 pt-2"
      style={{
        transition: "box-shadow 0.3s",
        // the armed state is the open page, lit — in the realm's tint: the
        // loaded magic is the Arcanum's, while the ember below stays the
        // caster's own and never floods the page
        boxShadow: armed
          ? `inset 0 0 0 1px color-mix(in srgb, ${tint} 55%, transparent), inset 0 0 42px color-mix(in srgb, ${tint} 10%, transparent)`
          : frameShadow,
      }}
    >
      {/* watermark — the Arcanum's device, low in the bottom-right corner,
          clipping the page edge. While the spell is readied it lifts in
          brightness, just enough to notice — the page's magic waking up
          under the words. */}
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

      {/* top corners: the way back (left) · the power corner (right) — the
          Gnosis treatment: the big signal of how mighty this spell is */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onContents}
          className="text-[10.5px] uppercase tracking-[0.18em] text-[color:var(--dim)] transition-colors hover:text-[color:var(--ink)] hover:underline"
          title="Back to contents (Esc)"
        >
          ‹ Contents
        </button>
        <span
          className="flex items-center gap-2"
          title={`${rote.spellArcanum} ${rote.spellLevel} — minimum ${rote.spellArcanum} to cast`}
        >
          <span style={{ color: tint }}>
            <ArcanaGlyph
              arcanum={rote.spellArcanum.toLowerCase()}
              size={22}
              variant={isGrossArcanum(rote.spellArcanum) ? "seal" : "line"}
            />
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.18em]" style={{ color: tint }}>
            {rote.spellArcanum}
          </span>
          <span className="mv-h text-[26px] leading-none" style={{ color: "var(--ink)" }}>
            {rote.spellLevel}
          </span>
        </span>
      </div>

      {/* title block */}
      <h3 className="mv-h mt-4 text-[21px] leading-tight" style={{ color: "var(--ink)" }}>
        {rote.name}
      </h3>
      <p className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--dim)" }}>
        {rote.spellName} ·
        <span className="inline-flex items-center gap-1">
          <OrderGlyph order={rote.order} size={13} />
          {rote.order} rote
        </span>
      </p>

      {/* the rulebook's own stat block, quoted */}
      <div
        className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 border-y py-2.5"
        style={{ borderColor: "color-mix(in srgb, var(--dim) 25%, transparent)" }}
      >
        <StatRow label="Practice" value={page?.practice ?? "—"} />
        <StatRow label="Action" value={page?.action ?? "—"} />
        <StatRow label="Duration" value={page?.duration ?? "—"} />
        <StatRow label="Aspect" value={rote.spellAspect ?? "—"} />
        <StatRow label="Cost" value={page?.cost ?? "—"} />
        {/* the pool in the sheet's own trait language: the total is the hero,
            the traits explain it, the specialty die speaks in words */}
        <span
          className="self-baseline text-[10.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--dim)" }}
        >
          Dice pool
        </span>
        <span className="grid gap-1.5">
          {alternatives.map((alt, i) => (
            <PoolLine key={alt.slot.name} alt={alt} first={i === 0} tint={tint} />
          ))}
          {rote.pool.vs && (
            <span className="text-[11.5px] italic" style={{ color: "var(--dim)" }}>
              Contested — the target rolls {rote.pool.vs.join(" + ")}
            </span>
          )}
        </span>
      </div>

      {/* the book's words, in the book's voice — no inner scrollbar: a page
          doesn't scroll, and overflow means "continued overleaf" */}
      <div
        className="mv-book-text mt-3.5 min-h-0 flex-1 overflow-hidden text-[14.5px] leading-[1.68]"
        style={{ color: "var(--ink)", maxWidth: "62ch" }}
      >
        {paragraphs.map((para, i) => (
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
        {page?.roteFlavor && (
          <p className="mt-2.5 italic" style={{ color: "var(--dim)" }}>
            {page.roteFlavor}
          </p>
        )}
      </div>

      {/* the recitation — absent on read-only sheets: the book stays open,
          the verb belongs to the caster alone */}
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
              ? "mv-smoulder rounded-[3px] text-[#e8a670]"
              : "text-[color:var(--dim)] hover:text-[color:var(--ink)]"
          }`}
        >
          <span className="flex items-center gap-2.5">
            <RuneMark seed={rote.name} armed={armed} />
            <ScrambleLabel
              text={
                armed
                  ? "Still the recitation"
                  : `Recite — ${reciteDiceLabel(alternatives)}`
              }
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
          ‹ {prev ? prev.name : ""}
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
          {next ? next.name : ""} ›
        </button>
      </div>
    </div>
  )
}

/** One pool alternative in the sheet's trait language: hero total, then the
 * traits in their zone colors, the specialty die in words. */
function PoolLine({
  alt,
  first,
  tint,
}: {
  alt: RotePageAlternative
  first: boolean
  tint: string
}) {
  const slotColor = alt.slot.kind === "skill" ? "var(--zone-skill)" : "var(--zone-attr)"
  const traits = [
    { name: alt.attribute.name, dots: alt.attribute.dots, color: "var(--zone-attr)" },
    { name: alt.slot.name, dots: alt.slot.dots, color: slotColor },
    { name: alt.arcanum.name, dots: alt.arcanum.dots, color: tint },
  ]
  return (
    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-none">
      {!first && (
        <span className="text-[11.5px] italic leading-none" style={{ color: "var(--dim)" }}>
          or
        </span>
      )}
      <span className="flex items-baseline gap-1 leading-none">
        <span className="mv-data text-[21px] leading-none" style={{ color: "var(--ink)" }}>
          {alt.total}
        </span>
        <span
          className="text-[10.5px] uppercase leading-none tracking-[0.14em]"
          style={{ color: "var(--dim)" }}
        >
          dice
        </span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 leading-none">
        {traits.map((trait) => (
          <span
            key={trait.name}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-none"
            style={{ color: trait.color }}
          >
            {trait.name}
            <DotRating current={trait.dots} color={trait.color} />
          </span>
        ))}
        {alt.specialty.eligible && (
          <span
            className="whitespace-nowrap text-[12px] leading-none"
            style={{ color: "var(--accent)" }}
            title="Casting your own Order's rote through one of its three specialty skills grants an extra die"
          >
            Rote Specialty +{alt.specialty.bonus}
          </span>
        )}
      </span>
    </span>
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

/* ── The recitation's marks ─────────────────────────────────────────────── */

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

function RuneMark({ seed, armed }: { seed: string; armed: boolean }) {
  return (
    <svg
      width="15"
      height="19"
      viewBox="0 0 16 20"
      fill="none"
      aria-hidden
      className={armed ? "mv-rune-lit" : ""}
    >
      <path
        d={sigilPath(seed)}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        className="mv-rune-path"
      />
    </svg>
  )
}

/** The trigger label re-utters itself (after MagicUI's HyperText): on state
 * change the new text resolves left to right while the unresolved tail cycles
 * through arcane letterforms — the words briefly become High Speech before
 * settling. Lore-apt: Sleepers hear High Speech as nonsense; for a beat, so
 * do we. Spaces hold, so the word-shape reads through. */
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
