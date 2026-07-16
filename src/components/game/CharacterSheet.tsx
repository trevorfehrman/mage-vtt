import { useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import {
  rulingArcanaOf,
  type ArcanumName,
  type CharacterSheet as CharacterSheetData,
  type KnownRote,
} from "#/domain/character"
import type { BoxSeverity } from "#/domain/damage"
import type { PoolComponentInput, PoolComponentType } from "#/domain/dice"
import { formatRotePool } from "#/domain/rote-pool"
import {
  ArcanaGlyph,
  OrderGlyph,
  PathGlyph,
  arcanumRealm,
  arcanumTint,
  isGrossArcanum,
  isPreciousArcanum,
  pathTint,
} from "./ArcanaGlyph"
import { ArcanaSubstance, hasSubstance } from "./ArcanaSubstance"
import { Separator } from "#/components/ui/separator"
import { DotRating } from "./DotRating"
import type { useCast } from "#/hooks/use-cast"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>
type CastAPI = ReturnType<typeof useCast>

/** One glyph per health box severity — shared with the hand-edit panel. */
const HEALTH_BOX_GLYPHS: Record<BoxSeverity, string> = {
  empty: "",
  bashing: "╱",
  lethal: "✕",
  aggravated: "✳",
}
export const healthBoxGlyph = (severity: BoxSeverity): string =>
  HEALTH_BOX_GLYPHS[severity]

/**
 * The dot beneath a health box — Resistant damage (issue #41), the wound
 * Awakened magic can't heal. The slot always renders so the track's boxes
 * don't shift when a dot appears; shared with the hand-edit panel.
 */
export function ResistantDot({ resistant }: { resistant: boolean }) {
  return (
    <span
      className="size-[5px] rounded-full"
      title={resistant ? "Resistant — heals only naturally" : undefined}
      style={{ background: resistant ? "var(--accent)" : "transparent" }}
    />
  )
}

interface CharacterSheetProps {
  character: CharacterSheetData
  /**
   * The dice-pool controller. Absent = a read-only sheet (roster browsing,
   * issue #17): traits render as plain rows, not pool toggles — only your own
   * sheet is a controller.
   */
  pool?: DicePoolAPI | undefined
  /**
   * The casting controller (issue #20): arms Rote entries and Arcanum cast
   * triggers. Absent on read-only sheets — Rotes render as inert rows.
   */
  cast?: CastAPI | undefined
}

/**
 * The sheet is the dice-pool input surface (docs/component-polish.md): every
 * rated Attribute / Skill / Arcanum is a toggle button feeding the pool.
 */
export function CharacterSheet({ character, pool, cast }: CharacterSheetProps) {
  const { healthTrack } = character
  const canToggle =
    pool !== undefined && (pool.state === "idle" || pool.state === "building")
  const ruling = rulingArcanaOf(character.path)

  const toggle = (component: PoolComponentInput) => {
    if (!pool || !canToggle) return
    pool.toggleComponent(component)
  }

  const isActive = (type: PoolComponentType, name: string) =>
    pool?.isComponentActive(type, name) ?? false

  const interactive = pool !== undefined

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      {/* Header — corner-ticked: one of the two "important" surfaces. Pure
          identity (owner call 2026-07-08): the mage name leads, the given name
          seconds it, and the at-a-glance resource meters live in the rail's
          ResourceStrip, not here. Gnosis stays — it's who the mage is, not a
          meter that drains. */}
      <div className="mv-cornered mv-panel flex items-stretch justify-between gap-6 p-4">
        {/* Left column: who (name · description) atop the identity emblems
            (Path | Order | ruling Arcana, hairline-divided). */}
        <div className="flex min-w-0 flex-col justify-between gap-4">
          <div className="grid gap-1.5">
            <h2 className="mv-h text-[30px] leading-none">
              {character.shadowName ?? character.name}
            </h2>
            <p className="text-[13px]" style={{ color: "var(--dim)" }}>
              {character.shadowName ? (
                <>
                  {character.name} &middot; {character.concept}
                </>
              ) : (
                character.concept
              )}
            </p>
          </div>
          <div className="flex items-stretch gap-4">
            <EmblemGroup label="Path">
              <Emblem
                glyph={
                  <span className="inline-flex" style={{ color: pathTint(character.path) }}>
                    <PathGlyph path={character.path} size={22} />
                  </span>
                }
                name={character.path}
              />
            </EmblemGroup>
            <Separator orientation="vertical" className="!h-auto self-stretch" />
            <EmblemGroup label="Order">
              <Emblem
                glyph={<OrderGlyph order={character.order} size={22} className="mv-accent" />}
                name={character.order}
              />
            </EmblemGroup>
            <Separator orientation="vertical" className="!h-auto self-stretch" />
            <EmblemGroup label="Ruling Arcana">
              {ruling.map((a) => (
                <Emblem
                  key={a}
                  glyph={
                    <span className="inline-flex" style={{ color: arcanumTint(a) }}>
                      <ArcanaGlyph
                        arcanum={a}
                        size={22}
                        variant={isGrossArcanum(a) ? "seal" : "line"}
                      />
                    </span>
                  }
                  name={a.charAt(0).toUpperCase() + a.slice(1)}
                />
              ))}
            </EmblemGroup>
          </div>
        </div>

        {/* Right column: three rows, evenly distributed — Gnosis (the level,
            dominant), its ceilings, the soul's poles. Live currents tick in
            the rail's ResourceStrip. */}
        <div className="mv-data flex shrink-0 flex-col items-end justify-between gap-2 text-right">
          <span className="flex items-baseline gap-2 leading-none">
            <span className="text-[15px]" style={{ color: "var(--dim)" }}>GNOSIS</span>
            <span className="mv-accent text-[32px] font-semibold">{character.gnosis}</span>
          </span>
          <span className="text-[12px]">
            <span style={{ color: "var(--dim)" }}>MANA </span>
            <span style={{ color: "var(--ink)" }}>{character.maxMana}</span>
            <span style={{ color: "var(--dim)" }}> · WILL </span>
            <span style={{ color: "var(--ink)" }}>{character.willpower}</span>
          </span>
          <span className="text-[12px]">
            <span style={{ color: "var(--dim)" }}>VIRTUE </span>
            <span style={{ color: "var(--ink)" }}>{character.virtue}</span>
            <span style={{ color: "var(--dim)" }}> · VICE </span>
            <span style={{ color: "var(--ink)" }}>{character.vice}</span>
          </span>
        </div>
      </div>

      {/* Arcana — the magic dashboard, directly beneath the title card:
          magic first, mundane traits after (owner call 2026-07-16). */}
      <Section title="Arcana">
        <ArcanaDashboard arcana={character.arcana} ruling={ruling} cast={cast} />
      </Section>

      {/* The trait matrix — three shared category columns ("social is column
          3" holds for both zones), two zones told apart by color alone:
          innate Attributes wear gold, trained Skills wear ink. The section
          header doubles as the legend. One label set, no hairlines — the
          muscle memory is "click once in the gold zone, once in the ink
          zone, that's the pool." Full width keeps names from ever breaking. */}
      <Section
        title={
          <>
            <span style={{ color: "var(--zone-attr)" }}>Attributes</span>
            <span style={{ color: "var(--dim)" }}> & </span>
            <span style={{ color: "var(--zone-skill)" }}>Skills</span>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-x-6">
          {(["mental", "physical", "social"] as const).map((category) => (
            <CategoryColumn
              key={category}
              label={category.charAt(0).toUpperCase() + category.slice(1)}
              attributes={CATEGORY_ATTRIBUTES[category].map(
                ([name, pick]): [string, number] => [name, pick(character)],
              )}
              skills={(Object.entries(character.skills[category]) as [string, number][])
                .filter(([, dots]) => dots > 0)
                .map(([key, dots]): [string, number] => [formatSkillName(key), dots])}
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
          ))}
        </div>
      </Section>

      {/* Rotes — castable entries (issue #20); inert rows on read-only sheets */}
      {character.rotes.length > 0 && (
        <Section title="Rotes">
          <div className="grid gap-1">
            {character.rotes.map((rote) => (
              <RoteRow key={rote.name} rote={rote} cast={cast} />
            ))}
          </div>
        </Section>
      )}

      {/* Vitals */}
      <Section title="Vitals">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="mv-eyebrow w-16">Health</span>
            <div className="flex gap-1">
              {healthTrack.map((box, i) => (
                <span key={i} className="flex flex-col items-center gap-[2px]">
                  <span
                    className="mv-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
                    style={{
                      borderColor:
                        box.severity === "empty" ? "var(--line)" : "var(--accent)",
                      background:
                        box.severity === "empty" || box.severity === "bashing"
                          ? "transparent"
                          : "var(--glow)",
                      color: "var(--accent)",
                    }}
                  >
                    {healthBoxGlyph(box.severity)}
                  </span>
                  <ResistantDot resistant={box.resistant} />
                </span>
              ))}
            </div>
          </div>
          <div className="mv-data flex gap-6 text-[13px]">
            <Stat label="Defense" value={character.defense} />
            <Stat label="Initiative" value={character.initiative} />
            <Stat label="Speed" value={character.speed} />
          </div>
        </div>
      </Section>
    </div>
  )
}

// --- Sub-components ---

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="mv-eyebrow">{title}</h3>
        <span className="mv-rule flex-1" />
      </div>
      {children}
    </section>
  )
}

function EmblemGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <span className="mv-eyebrow">{label}</span>
      <span className="flex items-center gap-4">{children}</span>
    </div>
  )
}

function Emblem({ glyph, name }: { glyph: ReactNode; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {glyph}
      <span className="whitespace-nowrap text-[13px]" style={{ color: "var(--ink)" }}>
        {name}
      </span>
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span>
      <span style={{ color: "var(--dim)" }}>{label} </span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </span>
  )
}

/**
 * One trait line. Interactive sheets render it as a pool-toggle button
 * (docs/component-polish.md); read-only sheets (issue #17) render the same
 * layout as an inert row — visibly not a control, rather than a disabled one.
 */
function TraitRow({
  interactive,
  canToggle,
  active,
  onToggle,
  className,
  children,
}: {
  interactive: boolean
  canToggle: boolean
  active: boolean
  onToggle: () => void
  className: string
  children: ReactNode
}) {
  if (!interactive) {
    return <div className={className}>{children}</div>
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!canToggle}
      className={`mv-trait ${active ? "mv-trait-on" : ""} ${className}`}
    >
      {children}
    </button>
  )
}

/** The nine attributes by category, with their sheet accessors. */
const CATEGORY_ATTRIBUTES: Record<
  "mental" | "physical" | "social",
  [string, (c: CharacterSheetData) => number][]
> = {
  mental: [
    ["Intelligence", (c) => c.attributes.mental.intelligence],
    ["Wits", (c) => c.attributes.mental.wits],
    ["Resolve", (c) => c.attributes.mental.resolve],
  ],
  physical: [
    ["Strength", (c) => c.attributes.physical.strength],
    ["Dexterity", (c) => c.attributes.physical.dexterity],
    ["Stamina", (c) => c.attributes.physical.stamina],
  ],
  social: [
    ["Presence", (c) => c.attributes.social.presence],
    ["Manipulation", (c) => c.attributes.social.manipulation],
    ["Composure", (c) => c.attributes.social.composure],
  ],
}

/**
 * One category column of the trait matrix: the category label, the gold
 * attribute zone, a breath, the ink skill zone. Color is the only zone
 * signifier — no rules, no repeated labels. Names arrive as display names
 * and never wrap.
 */
function CategoryColumn({
  label,
  attributes,
  skills,
  onToggle,
  isActive,
  canToggle,
  interactive,
}: {
  label: string
  attributes: [string, number][]
  skills: [string, number][]
  onToggle: (component: PoolComponentInput) => void
  isActive: (type: PoolComponentType, name: string) => boolean
  canToggle: boolean
  interactive: boolean
}) {
  const zone = (
    type: PoolComponentType,
    traits: [string, number][],
    color?: string,
  ) =>
    traits.map(([name, dots]) => {
      const active = isActive(type, name)
      return (
        <TraitRow
          key={name}
          interactive={interactive}
          canToggle={canToggle}
          active={active}
          onToggle={() => onToggle({ type, name, dots })}
          className="-mx-2 flex items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left"
        >
          <span
            className="whitespace-nowrap text-[14px]"
            style={color ? { color } : undefined}
          >
            {name}
          </span>
          <DotRating current={dots} active={active} {...(color ? { color } : {})} />
        </TraitRow>
      )
    })

  return (
    <div className="grid content-start gap-1">
      <span className="mv-data text-[11px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {label}
      </span>
      {zone("attribute", attributes, "var(--zone-attr)")}
      {skills.length > 0 && <span aria-hidden className="h-2" />}
      {zone("skill", skills, "var(--zone-skill)")}
    </div>
  )
}

/** The fixed canonical layout: 5 columns = 5 Supernal Realms, each column its
 * Realm's Arcana pair. Row-major over a grid-cols-5, so index i and i+5 share
 * a Realm (and a tint). */
const ARCANA_CANON: ArcanumName[] = [
  "prime", "fate", "mind", "spirit", "death",
  "forces", "time", "space", "life", "matter",
]

/**
 * The magic dashboard (owner call 2026-07-16): improvised casting is the
 * game's main verb, so every Arcanum is a chunky launcher tile — glyph, name,
 * rating, Realm tint. Press to arm the cast, press again to disarm; arming
 * blooms the Realm gradient into the tile. All ten Arcana always render in
 * canonical Realm columns: rated ones carry their tint and the cast action,
 * unrated ones are inert ghosts (the map of magic, including what this mage
 * can't yet touch). Ruling Arcana wear the corner-ticks. The old
 * toggle-into-pool behavior retired from this surface — the tile casts.
 */
function ArcanaDashboard({
  arcana,
  ruling,
  cast,
}: {
  arcana: Record<string, number | undefined>
  ruling: readonly string[]
  cast?: CastAPI | undefined
}) {
  // DEMO WIRING (#84, 2026-07-16): every tile toggles its material gradients
  // locally so the owner can audition emission/absorption and the per-realm
  // behaviors on all ten Arcana. Cast-arming returns once the look settles.
  void cast
  const [lit, setLit] = useState<ReadonlySet<string>>(new Set())
  const toggleLit = (name: string) =>
    setLit((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  return (
    <div className="grid grid-cols-5 gap-2">
      {ARCANA_CANON.map((name) => {
        const dots = arcana[name] ?? 0
        const isRuling = ruling.includes(name)
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        const gross = isGrossArcanum(name)
        const isLit = lit.has(name)
        const tileVar = { "--tile": arcanumTint(name) } as CSSProperties

        return (
          <button
            key={name}
            type="button"
            onClick={() => toggleLit(name)}
            title={`${displayName}${isRuling ? " — Ruling Arcanum" : ""} (demo: toggle material)`}
            className={`mv-arcana ${isRuling ? "mv-cornered" : ""} ${
              gross ? "mv-arcana-gross" : "mv-arcana-sub"
            } mv-realm-${arcanumRealm(name)} ${
              isLit ? "mv-arcana-lit" : ""
            } relative aspect-square rounded-[4px]`}
            style={tileVar}
          >
            <span aria-hidden className="mv-arcana-bloom" />
            {/* substance bench (#84): Prime + Matter mount a shader while
             * lit; the CSS glint stands down where a substance takes over */}
            {isLit && <ArcanaSubstance arcanum={name} />}
            {isLit && isPreciousArcanum(name) && !hasSubstance(name) && (
              <span aria-hidden className="mv-arcana-fx" />
            )}
            {/* the glyph owns the tile's true center; name and dots hang below */}
            <span className="mv-arcana-glyph absolute inset-0 grid place-items-center">
              <ArcanaGlyph arcanum={name} size={34} variant={gross ? "seal" : "line"} />
            </span>
            <span className="absolute inset-x-0 bottom-2 grid justify-items-center gap-1">
              <span className="mv-arcana-name text-[12px]" style={{ color: "var(--ink)" }}>
                {displayName}
              </span>
              <DotRating current={dots} color={arcanumTint(name)} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * One known Rote as a castable entry (issue #20): glyph, name, the spell it
 * fixes, and its pool prose. Clicking arms the cast in the shared pre-roll
 * panel; read-only sheets (no cast controller) render the same layout inert.
 */
function RoteRow({ rote, cast }: { rote: KnownRote; cast?: CastAPI | undefined }) {
  const armed =
    cast?.context.selection?.method === "rote" &&
    cast.context.selection.rote.name === rote.name
  return (
    <TraitRow
      interactive={cast !== undefined}
      canToggle={cast !== undefined && cast.state !== "casting"}
      active={armed}
      onToggle={() => cast?.armRote(rote)}
      className="flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left"
    >
      <ArcanaGlyph
        arcanum={rote.spellArcanum.toLowerCase()}
        size={19}
        className={armed ? "mv-accent" : ""}
      />
      <span className="flex-1 text-[14px]">
        {rote.name}
        <span className="ml-1.5 text-[12px]" style={{ color: "var(--dim)" }}>
          {rote.spellName} · {rote.spellArcanum} {rote.spellLevel}
        </span>
      </span>
      <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
        {formatRotePool(rote.pool)}
      </span>
    </TraitRow>
  )
}

/** Convert camelCase skill keys to display names: "animalKen" → "Animal Ken" */
function formatSkillName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
}
