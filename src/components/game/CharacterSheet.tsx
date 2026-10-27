import { type CSSProperties, type ReactNode } from "react"
import {
  attainmentGnosis,
  rulingArcanaOf,
  specialtyComponentName,
  type ArcanumName,
  type CharacterSheet as CharacterSheetData,
  type SkillKey,
  type SkillSpecialty,
} from "#/domain/character"
import type { HealthBox } from "#/domain/damage"
import type { PoolComponentInput, PoolComponentType } from "#/domain/dice"
import type { SheetMark } from "#/domain/flows/hand-edit"
import {
  ArcanaGlyph,
  OrderGlyph,
  StatGlyph,
  ViceGlyph,
  VirtueGlyph,
  PathGlyph,
  arcanumRealm,
  arcanumTint,
  isGrossArcanum,
  isPreciousArcanum,
  pathTint,
} from "./ArcanaGlyph"
import { ArcanaSubstance, hasSubstance } from "./ArcanaSubstance"
import { RoteBook } from "./RoteBook"
import { TraitSky } from "./TraitSky"
import { Separator } from "#/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "#/components/ui/tooltip"
import { DotRating } from "./DotRating"
import { healthBoxGlyph, ResistantDot } from "./HealthGlyphs"
import { ToolSwitch } from "./ToolSwitch"
import { PoolNumerals } from "./CastHeaderStats"
import { cycleBox, toggleResistant, woundPenalty } from "#/domain/health"
import { WisdomMeter } from "./WisdomMeter"
import type { useCast } from "#/hooks/use-cast"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>
type CastAPI = ReturnType<typeof useCast>

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
  /** The viewer's armed spend, weighed in the header as on their tile. */
  pendingMana?: number | undefined
  pendingWillpower?: number | undefined
  /** Flips the standing tool fact (issue #107). Present only on the
   * viewer's own sheet; a refusal speaks at the switch. */
  onSetMagicalTool?: ((hasMagicalTool: boolean) => Promise<unknown>) | undefined
  /** The paper gesture (MAG-63): mark the track or set Wisdom from the sheet.
   * Present on your own sheet and, for the Storyteller, on anyone's; the
   * server's ladder decides and a refusal speaks at the mark. */
  onMarkSheet?: ((mark: SheetMark) => Promise<unknown>) | undefined
}


/**
 * The sheet is the dice-pool input surface (docs/component-polish.md): every
 * rated Attribute / Skill / Arcanum is a toggle button feeding the pool.
 */
export function CharacterSheet({
  character,
  pool,
  cast,
  pendingMana = 0,
  pendingWillpower = 0,
  onSetMagicalTool,
  onMarkSheet,
}: CharacterSheetProps) {
  const penalty = woundPenalty(character.healthTrack)
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
      {/* Header — corner-ticked: one of the two "important" surfaces (MAG-52,
          owner 2026-10-24, from a rig audition). Who and what they carry: the
          mage name, and beneath it HEALTH over the track with Will · Mana
          beside it, then WISDOM over its meter (MAG-56); opposite, Gnosis
          with the combat ratings beneath it. Then what kind
          of mage: Path | Order | ruling Arcana | Virtue | Vice, one emblem
          grammar, with the standing tool fact at the corner. The given name
          and concept line is gone (owner: players know who they are). */}
      <div className="mv-cornered mv-panel grid gap-4 p-4">
        <div className="flex items-start justify-between gap-6">
          <div className="grid gap-3">
            <h2 className="mv-h text-[30px] leading-none">
              {character.shadowName ?? character.name}
            </h2>
            {/* the nimbus (MAG-61; Mage p. 90): the signature of the mage's
                magic, a sentence in the player's words under the name */}
            {character.nimbus !== undefined && (
              <Eyebrowed label="Nimbus">
                <p
                  className="max-w-[46ch] text-[13px] italic leading-snug"
                  style={{ color: "var(--dim)" }}
                >
                  {character.nimbus}
                </p>
              </Eyebrowed>
            )}
            {/* the depletables under eyebrows in the emblem row's grammar
                (owner, 2026-10-27): HEALTH over the track and its penalty,
                Will · Mana beside them on the same baseline, WISDOM over
                the meter beneath at the row's full width */}
            <div className="mv-data flex flex-wrap items-end gap-x-5 gap-y-2 whitespace-nowrap">
              <Eyebrowed label="Health">
                <span className="flex items-center gap-2" style={{ height: 20 }}>
                  <span className="flex">
                    <HealthTrack
                      track={character.healthTrack}
                      onMark={
                        onMarkSheet ? (healthTrack) => void onMarkSheet({ healthTrack }) : undefined
                      }
                    />
                  </span>
                  {penalty < 0 && (
                    <span
                      className="text-[13px] leading-none font-bold"
                      style={{ color: "var(--bad)" }}
                      title="Wound penalty — it rides every roll"
                    >
                      {penalty}
                    </span>
                  )}
                </span>
              </Eyebrowed>
              {/* Will · Mana: a pending spend shows what would be left,
                  in ember */}
              <span className="flex items-center" style={{ height: 20 }}>
                <PoolNumerals
                  sheet={character}
                  pendingMana={pendingMana}
                  pendingWillpower={pendingWillpower}
                  size={15}
                  manaPerTurn
                />
              </span>
            </div>
            {/* Wisdom (MAG-56): the meter, beneath the body's row at its
                width — the held cells filled in the rank's own color, the
                lost ones hollow; the number lives in its tooltip */}
            <Eyebrowed label="Wisdom">
              <WisdomMeter
                wisdom={character.wisdom}
                onSet={onMarkSheet ? (wisdom) => void onMarkSheet({ wisdom }) : undefined}
              />
            </Eyebrowed>
          </div>
          <div className="mv-data grid shrink-0 justify-items-end gap-3 text-right">
            <span className="flex items-baseline gap-2 leading-none">
              <span className="text-[15px]" style={{ color: "var(--dim)" }}>GNOSIS</span>
              <span className="mv-accent text-[32px] font-semibold">{character.gnosis}</span>
            </span>
            {/* the combat ratings in the depletables' grammar: a glyph for
                the label, the numeral beside it (a tooltip names each) */}
            <TooltipProvider>
              <div className="flex items-center gap-4 leading-none" style={{ fontSize: 15, height: 20 }}>
                <Rating label="Defense" stat="defense" value={character.defense} />
                <Rating label="Initiative" stat="initiative" value={character.initiative} />
                <Rating label="Speed" stat="speed" value={character.speed} />
              </div>
              {/* unspent experience (MAG-57): the one advancement number the
                  sheet keeps so it isn't on paper; the Storyteller's to edit */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    tabIndex={0}
                    className="flex items-baseline gap-1.5 leading-none"
                    style={{ fontSize: 15 }}
                    aria-label={`${character.experience} experience unspent`}
                  >
                    <span style={{ color: "var(--dim)" }}>XP</span>
                    <span style={{ color: "var(--ink)" }}>{character.experience}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {character.experience} experience unspent
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex items-end justify-between gap-6">
          <div className="flex flex-wrap items-stretch gap-x-4 gap-y-3">
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
            <Separator orientation="vertical" className="!h-auto self-stretch" />
            <EmblemGroup label="Virtue">
              <Emblem
                glyph={
                  <span className="inline-flex" style={{ color: "var(--accent)" }}>
                    <VirtueGlyph virtue={character.virtue} size={22} />
                  </span>
                }
                name={character.virtue}
              />
            </EmblemGroup>
            <Separator orientation="vertical" className="!h-auto self-stretch" />
            <EmblemGroup label="Vice">
              <Emblem
                glyph={
                  <span
                    className="inline-flex"
                    style={{ color: "color-mix(in srgb, var(--bad) 70%, var(--dim))" }}
                  >
                    <ViceGlyph vice={character.vice} size={22} />
                  </span>
                }
                name={character.vice}
              />
            </EmblemGroup>
            {/* the company the mage keeps (MAG-61): names only, in the same
                row, present only when written */}
            {character.cabal !== undefined && (
              <>
                <Separator orientation="vertical" className="!h-auto self-stretch" />
                <EmblemGroup label="Cabal">
                  <Emblem name={character.cabal} />
                </EmblemGroup>
              </>
            )}
            {character.consilium !== undefined && (
              <>
                <Separator orientation="vertical" className="!h-auto self-stretch" />
                <EmblemGroup label="Consilium">
                  <Emblem name={character.consilium} />
                </EmblemGroup>
              </>
            )}
          </div>
          {/* the standing tool fact (issue #107) at the corner: the viewer's
              own sheet flips it; anyone else's states it when it holds */}
          <span className="mv-data flex shrink-0 items-center" style={{ height: 22 }}>
            {onSetMagicalTool !== undefined ? (
              <ToolSwitch magicalTool={character.magicalTool} onSetMagicalTool={onSetMagicalTool} />
            ) : (
              character.magicalTool && <ToolSwitch magicalTool />
            )}
          </span>
        </div>
      </div>

      {/* The trait matrix — directly beneath the title card: the mundane
          traits paint the person before the magic does (owner call
          2026-07-17, reversing 2026-07-16's magic-first order). Three shared
          category columns ("social is column 3" holds for both zones), two
          zones told apart by color alone. The section header doubles as the
          legend. One label set, no hairlines — the muscle memory is "click
          once in the attribute zone, once in the skill zone, that's the
          pool." Full width keeps names from ever breaking.

          The section is the sheet's only containerless stretch (#84, owner
          verdict 2026-07-18): the firmament (SheetSky, mounted behind the
          whole center panel) shows through unobstructed here and nowhere
          else — TraitSky anchors the roll-fired meteors to these columns,
          and the halo class holds the rows legible against the galaxy. */}
      <Section
        title={
          <>
            <span style={{ color: "var(--zone-attr)" }}>Attributes</span>
            <span style={{ color: "var(--dim)" }}> & </span>
            <span style={{ color: "var(--zone-skill)" }}>Skills</span>
          </>
        }
      >
        <div className="relative">
          <TraitSky pool={pool} traitColumns={traitColumnsOf(character)} />
          <div className="mv-sky-halo relative z-10 grid grid-cols-3 gap-x-6">
            {SHEET_CATEGORIES.map((category) => (
              <CategoryColumn
                key={category}
                label={category.charAt(0).toUpperCase() + category.slice(1)}
                attributes={CATEGORY_ATTRIBUTES[category].map(
                  ([name, pick]): [string, number] => [name, pick(character)],
                )}
                skills={(Object.entries(character.skills[category]) as [SkillKey, number][])
                  .filter(([, dots]) => dots > 0)
                  .map(([key, dots]) => ({
                    name: formatSkillName(key),
                    dots,
                    specialty: character.specialtyFor(key),
                  }))}
                onToggle={toggle}
                isActive={isActive}
                canToggle={canToggle}
                interactive={interactive}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Arcana — the magic dashboard, after the human traits. */}
      <Section title="Arcana">
        <ArcanaDashboard arcana={character.arcana} ruling={ruling} cast={cast} />
      </Section>

      {/* Legacy (MAG-61; Mage p. 93) — the mage's one specialization, its
          attainments opening at Gnosis 3, 5 and 7: the reached ones in ink,
          the rest waiting in the dim. Absent until chosen, and then a small
          section of its own between the Arcana it grows from and the Rotes. */}
      {character.legacy !== undefined && (
        <Section title="Legacy">
          <div className="mv-panel grid gap-3 rounded-[3px] p-4">
            <span className="mv-h text-[22px] leading-none">{character.legacy.name}</span>
            <ol className="grid gap-1.5">
              {character.legacy.attainments.map((attainment, i) => {
                const at = attainmentGnosis(i)
                const reached = character.gnosis >= at
                return (
                  <li key={attainment} className="flex items-baseline gap-3 text-[14px]">
                    <span
                      className="mv-data w-[5.5em] shrink-0 text-[11px] uppercase tracking-wider"
                      style={{ color: reached ? "var(--accent)" : "var(--dim)" }}
                    >
                      Gnosis {at}
                    </span>
                    <span style={{ color: reached ? "var(--ink)" : "var(--dim)" }}>{attainment}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </Section>
      )}

      {/* Rotes — the character's book (issue #89), directly under the Arcana
          it belongs to: the sheet's magic stays contiguous (owner call
          2026-07-16). A framed table of contents turning to a page per rote,
          the cast verb a recitation on the page (issue #20); the same book
          inert on read-only sheets. */}
      {character.rotes.length > 0 && (
        <Section title="Rotes">
          <RoteBook character={character} cast={cast} />
        </Section>
      )}
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

/** A combat rating in the numerals' grammar: its glyph, its number, and a
 * tooltip naming it on hover or focus (ADR-0021's focus ring). */
function Rating({
  label,
  stat,
  value,
}: {
  label: string
  stat: "defense" | "initiative" | "speed"
  value: number
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="flex items-center gap-1.5">
          <span className="inline-flex" style={{ color: "var(--dim)" }}>
            <StatGlyph stat={stat} size={16} />
          </span>
          <span style={{ color: "var(--ink)" }}>{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/** The title card's eyebrow shell: a small-caps label over whatever it names. */
function Eyebrowed({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <span className="mv-eyebrow">{label}</span>
      {children}
    </div>
  )
}

function EmblemGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Eyebrowed label={label}>
      <span className="flex items-center gap-4">{children}</span>
    </Eyebrowed>
  )
}

function Emblem({ glyph, name }: { glyph?: ReactNode; name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {glyph}
      <span className="whitespace-nowrap text-[13px]" style={{ color: "var(--ink)" }}>
        {name}
      </span>
    </span>
  )
}

/**
 * The health track — the body's row of boxes, living in the header's number
 * column since the Vitals fold-in. Resistant dots hang beneath their boxes.
 *
 * With `onMark` (MAG-63) it is the paper sheet: click a box to cycle its
 * wound (clear → bashing → lethal → aggravated → clear), click beneath it to
 * toggle the Resistant dot — the rules are the domain's (`cycleBox`,
 * `toggleResistant`), the same the Storyteller's form uses. Each click
 * sends the whole track as it will show. Without it, the track is the
 * read-only record it was.
 */
function HealthTrack({
  track,
  onMark,
}: {
  track: CharacterSheetData["healthTrack"]
  onMark?: ((track: ReadonlyArray<HealthBox>) => void) | undefined
}) {
  const boxStyle = (box: HealthBox): CSSProperties => ({
    borderColor: box.severity === "empty" ? "var(--line)" : "var(--accent)",
    background:
      box.severity === "empty" || box.severity === "bashing" ? "transparent" : "var(--glow)",
    color: "var(--accent)",
  })
  const boxClass =
    "mv-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
  const replacing = (i: number, next: HealthBox) => track.map((b, j) => (j === i ? next : b))
  return (
    <span className="flex gap-1">
      {track.map((box, i) => (
        <span key={i} className="relative">
          {onMark ? (
            <button
              type="button"
              onClick={() => onMark(replacing(i, cycleBox(box)))}
              className={`${boxClass} cursor-pointer`}
              style={boxStyle(box)}
              title="Click to mark the wound: clear → bashing → lethal → aggravated"
              aria-label={`Health box ${i + 1}: ${box.severity}. Click to mark the next wound.`}
            >
              {healthBoxGlyph(box.severity)}
            </button>
          ) : (
            <span className={boxClass} style={boxStyle(box)}>
              {healthBoxGlyph(box.severity)}
            </span>
          )}
          {/* the Resistant mark hangs below its box like a diacritic — out of
              the layout, so the track aligns by its boxes alone; with onMark
              the slot beneath is the toggle (a wound only — #118) */}
          {onMark ? (
            <button
              type="button"
              onClick={() => onMark(replacing(i, toggleResistant(box)))}
              disabled={box.severity === "empty"}
              className="absolute left-1/2 top-full flex h-[9px] w-5 -translate-x-1/2 cursor-pointer items-start justify-center pt-[2px] disabled:cursor-default"
              title={
                box.severity === "empty"
                  ? "Resistant marks a wound; this box is clear"
                  : box.resistant
                    ? "Resistant — heals only naturally. Click to clear the dot."
                    : "Click to mark this wound Resistant (heals only naturally)"
              }
              aria-label={`Health box ${i + 1}: ${box.resistant ? "Resistant" : "not Resistant"}. Click to toggle.`}
              aria-pressed={box.resistant}
            >
              <ResistantDot resistant={box.resistant} />
            </button>
          ) : (
            <span className="absolute left-1/2 top-full mt-[2px] flex -translate-x-1/2">
              <ResistantDot resistant={box.resistant} />
            </span>
          )}
        </span>
      ))}
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

/** The matrix's column order — "social is column 3" holds for both zones. */
const SHEET_CATEGORIES = ["mental", "physical", "social"] as const

/**
 * Each trait's home column (0 mental · 1 physical · 2 social), keyed by the
 * display name the pool stores — the meteor's lane map (TraitSky).
 */
function traitColumnsOf(character: CharacterSheetData): Record<string, number> {
  return Object.fromEntries(
    SHEET_CATEGORIES.flatMap((category, column) => [
      ...CATEGORY_ATTRIBUTES[category].map(
        ([name]): [string, number] => [name, column],
      ),
      ...Object.keys(character.skills[category]).map(
        (key): [string, number] => [formatSkillName(key), column],
      ),
    ]),
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
  skills: ReadonlyArray<SkillEntry>
  onToggle: (component: PoolComponentInput) => void
  isActive: (type: PoolComponentType, name: string) => boolean
  canToggle: boolean
  interactive: boolean
}) {
  const zone = (type: PoolComponentType, traits: ReadonlyArray<SkillEntry>, color?: string) =>
    traits.map(({ name, dots, specialty }) => {
      const active = isActive(type, name)
      const component = specialty && {
        type: "modifier" as const,
        name: specialtyComponentName(specialty),
        dots: 1,
      }
      const specialtyActive = component !== undefined && isActive(component.type, component.name)
      return (
        <div key={name} className="relative">
          <TraitRow
            interactive={interactive}
            canToggle={canToggle}
            active={active}
            onToggle={() => {
              onToggle({ type, name, dots })
              // the specialty rides its skill: toggling the skill off takes
              // the +1 with it, since a specialty without its skill is nothing
              if (active && specialtyActive && component) onToggle(component)
            }}
            className="mv-sky-row -mx-2 flex items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left"
          >
            <span
              className="whitespace-nowrap text-[14px]"
              style={color ? { color } : undefined}
            >
              {name}
            </span>
            <DotRating current={dots} active={active} {...(color ? { color } : {})} />
          </TraitRow>
          {specialty && component && (
            <SpecialtyMark
              specialty={specialty}
              armable={interactive && canToggle && active}
              armed={specialtyActive}
              onToggle={() => onToggle(component)}
            />
          )}
        </div>
      )
    })

  return (
    <div className="grid content-start gap-1">
      <span className="mv-data text-[11px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {label}
      </span>
      {zone("attribute", attributes.map(([name, dots]) => ({ name, dots })), "var(--zone-attr)")}
      {skills.length > 0 && <span aria-hidden className="h-2" />}
      {zone("skill", skills, "var(--zone-skill)")}
    </div>
  )
}

/** A matrix row: a trait's display name and dots, and for a skill, its specialty if it carries one. */
interface SkillEntry {
  name: string
  dots: number
  specialty?: SkillSpecialty | undefined
}

/**
 * The specialty's mark (MAG-58; WoD p. 54): a focus — a ring with a point
 * at its center — floating between the skill's name and its dots, outside
 * the row's button so the two stay separate controls. Inert on a read-only
 * sheet and while the skill is out of the pool; once the skill is in, the
 * mark is the toggle for the +1 (the player's call whether the roll falls
 * inside the specialty), lit ember when armed like every armed selection.
 */
function SpecialtyMark({
  specialty,
  armable,
  armed,
  onToggle,
}: {
  specialty: SkillSpecialty
  armable: boolean
  armed: boolean
  onToggle: () => void
}) {
  const color = armed ? "var(--ember)" : armable ? "var(--accent)" : "var(--dim)"
  const words = `Specialty: ${specialty.label} · +1 die when the roll falls inside it`
  const glyph = (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ color }}>
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.6" fill="currentColor" />
    </svg>
  )
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {armable ? (
            <button
              type="button"
              onClick={onToggle}
              aria-pressed={armed}
              aria-label={words}
              className="absolute top-1/2 right-[52px] grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full"
            >
              {glyph}
            </button>
          ) : (
            <span
              tabIndex={0}
              aria-label={words}
              className="absolute top-1/2 right-[52px] grid size-5 -translate-y-1/2 place-items-center"
            >
              {glyph}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {words}
          {armable && (armed ? " · in the pool" : " · click to add it")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const selection = cast?.context.selection
  const armedArcanum = selection?.method === "improvised" ? selection.arcanum : null

  return (
    <div className="grid grid-cols-5 gap-2">
      {ARCANA_CANON.map((name) => {
        const dots = arcana[name] ?? 0
        const rated = dots > 0
        const isRuling = ruling.includes(name)
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        const gross = isGrossArcanum(name)
        const armed = armedArcanum === name
        const castable = cast !== undefined && rated && cast.state !== "casting"
        const tileVar = {
          "--tile": rated ? arcanumTint(name) : "var(--dim)",
        } as CSSProperties

        return (
          <button
            key={name}
            type="button"
            disabled={!castable}
            onClick={() => {
              if (!cast) return
              if (armed) cast.cancel()
              else cast.armImprovised(name, dots)
            }}
            title={
              rated
                ? `${displayName}${isRuling ? " — Ruling Arcanum" : ""}: ${
                    armed ? "disarm" : "arm an improvised spell"
                  }`
                : `${displayName} — unrated: this mage cannot cast here yet`
            }
            className={`mv-arcana ${isRuling ? "mv-cornered" : ""} ${
              gross ? "mv-arcana-gross" : "mv-arcana-sub"
            } mv-realm-${arcanumRealm(name)} ${
              armed ? "mv-arcana-lit mv-arcana-armed" : ""
            } relative aspect-square rounded-[4px]`}
            style={tileVar}
          >
            <span aria-hidden className="mv-arcana-bloom" />
            {/* the substance — the Arcanum's living matter — mounts only
             * while armed, so concurrent shader canvases stay bounded */}
            {armed && <ArcanaSubstance arcanum={name} />}
            {armed && isPreciousArcanum(name) && !hasSubstance(name) && (
              <span aria-hidden className="mv-arcana-fx" />
            )}
            {/* the glyph owns the tile's true center; name and dots hang
                below. Unrated tiles ghost their CONTENTS only — the tile
                itself stays solid so the firmament (#84) never shines
                through a made object. */}
            <span
              className={`mv-arcana-glyph absolute inset-0 grid place-items-center ${
                rated ? "" : "opacity-60"
              }`}
            >
              <ArcanaGlyph arcanum={name} size={34} variant={gross ? "seal" : "line"} />
            </span>
            <span
              className={`absolute inset-x-0 bottom-4 grid justify-items-center ${
                rated ? "" : "opacity-60"
              }`}
            >
              <span className="mv-arcana-caption grid justify-items-center gap-1 rounded-[3px] px-2 py-1">
                <span className="mv-arcana-name text-[12px]" style={{ color: "var(--ink)" }}>
                  {displayName}
                </span>
                <DotRating current={dots} color={arcanumTint(name)} />
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Convert camelCase skill keys to display names: "animalKen" → "Animal Ken" */
function formatSkillName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
}
