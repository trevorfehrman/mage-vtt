import type { ReactNode } from "react"
import {
  rulingArcanaOf,
  type ArcanumName,
  type CharacterSheet as CharacterSheetData,
  type KnownRote,
} from "#/domain/character"
import type { BoxSeverity } from "#/domain/damage"
import type { PoolComponentType } from "#/domain/dice"
import { formatRotePool } from "#/domain/rote-pool"
import { ArcanaGlyph } from "./ArcanaGlyph"
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
  const { healthTrack, willpowerCurrent, manaCurrent } = character
  const canToggle =
    pool !== undefined && (pool.state === "idle" || pool.state === "building")
  const ruling = rulingArcanaOf(character.path)

  const toggle = (type: PoolComponentType, name: string, dots: number) => {
    if (!pool || !canToggle) return
    pool.toggleComponent({ type, name, dots })
  }

  const isActive = (type: PoolComponentType, name: string) =>
    pool?.isComponentActive(type, name) ?? false

  const interactive = pool !== undefined

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      {/* Header — corner-ticked: one of the two "important" surfaces */}
      <div className="mv-cornered mv-panel flex items-start justify-between gap-4 p-4">
        <div>
          <h2 className="mv-h text-3xl leading-none">{character.name}</h2>
          {character.shadowName && (
            <p className="mv-data mt-1 text-[12px] italic" style={{ color: "var(--dim)" }}>
              &ldquo;{character.shadowName}&rdquo;
            </p>
          )}
          <p className="mt-2 text-[13px]" style={{ color: "var(--ink)" }}>
            {character.path} <span style={{ color: "var(--dim)" }}>&middot;</span>{" "}
            {character.order}
            <span className="ml-1.5 inline-flex translate-y-[3px] gap-1">
              {ruling.map((a) => (
                <ArcanaGlyph key={a} arcanum={a} size={15} className="mv-accent" />
              ))}
            </span>
          </p>
          <p className="text-[12px]" style={{ color: "var(--dim)" }}>
            {character.concept} &middot; {character.virtue}/{character.vice}
          </p>
        </div>
        {/* Resource readouts — instrument style */}
        <div className="grid shrink-0 gap-1 text-right">
          <Resource
            label="GNOSIS"
            node={<span className="mv-accent font-semibold">{character.gnosis}</span>}
          />
          <Resource
            label="MANA"
            node={<Pips filled={manaCurrent} max={Math.min(character.maxMana, 10)} />}
            sub={`${manaCurrent}/${character.maxMana}`}
          />
          <Resource
            label="WILL"
            node={<Pips filled={willpowerCurrent} max={character.willpower} />}
            sub={`${willpowerCurrent}/${character.willpower}`}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Attributes */}
        <Section title="Attributes">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <StatColumn
              label="Mental"
              stats={[
                ["Intelligence", character.attributes.mental.intelligence],
                ["Wits", character.attributes.mental.wits],
                ["Resolve", character.attributes.mental.resolve],
              ]}
              type="attribute"
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
            <StatColumn
              label="Physical"
              stats={[
                ["Strength", character.attributes.physical.strength],
                ["Dexterity", character.attributes.physical.dexterity],
                ["Stamina", character.attributes.physical.stamina],
              ]}
              type="attribute"
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
            <StatColumn
              label="Social"
              stats={[
                ["Presence", character.attributes.social.presence],
                ["Manipulation", character.attributes.social.manipulation],
                ["Composure", character.attributes.social.composure],
              ]}
              type="attribute"
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <SkillColumn
              label="Mental"
              skills={Object.entries(character.skills.mental) as [string, number][]}
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
            <SkillColumn
              label="Physical"
              skills={Object.entries(character.skills.physical) as [string, number][]}
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
            <SkillColumn
              label="Social"
              skills={Object.entries(character.skills.social) as [string, number][]}
              onToggle={toggle}
              isActive={isActive}
              canToggle={canToggle}
              interactive={interactive}
            />
          </div>
        </Section>
      </div>

      {/* Arcana */}
      <Section title="Arcana">
        <ArcanaList
          arcana={character.arcana}
          ruling={ruling}
          onToggle={toggle}
          isActive={isActive}
          canToggle={canToggle}
          interactive={interactive}
          cast={cast}
        />
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
          <div className="mv-data flex gap-6 text-[12px]">
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

function Section({ title, children }: { title: string; children: ReactNode }) {
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

function Resource({ label, node, sub }: { label: string; node: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="mv-eyebrow">{label}</span>
      <span className="mv-data text-[12px]">{node}</span>
      {sub && (
        <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
          {sub}
        </span>
      )}
    </div>
  )
}

function Pips({ filled, max }: { filled: number; max: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="text-[10px]"
          style={{ color: i < filled ? "var(--accent)" : "var(--line)" }}
        >
          ◆
        </span>
      ))}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
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

function StatColumn({
  label,
  stats,
  type,
  onToggle,
  isActive,
  canToggle,
  interactive,
}: {
  label: string
  stats: [string, number][]
  type: PoolComponentType
  onToggle: (type: PoolComponentType, name: string, dots: number) => void
  isActive: (type: PoolComponentType, name: string) => boolean
  canToggle: boolean
  interactive: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="mv-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {label}
      </span>
      {stats.map(([name, dots]) => {
        const active = isActive(type, name)
        return (
          <TraitRow
            key={name}
            interactive={interactive}
            canToggle={canToggle}
            active={active}
            onToggle={() => onToggle(type, name, dots)}
            className="flex items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left"
          >
            <span className="text-[12px]">{name}</span>
            <DotRating current={dots} active={active} />
          </TraitRow>
        )
      })}
    </div>
  )
}

function SkillColumn({
  label,
  skills,
  onToggle,
  isActive,
  canToggle,
  interactive,
}: {
  label: string
  skills: [string, number][]
  onToggle: (type: PoolComponentType, name: string, dots: number) => void
  isActive: (type: PoolComponentType, name: string) => boolean
  canToggle: boolean
  interactive: boolean
}) {
  const nonZero = skills.filter(([, dots]) => dots > 0)
  if (nonZero.length === 0) return null

  return (
    <div className="grid gap-1">
      <span className="mv-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {label}
      </span>
      {nonZero.map(([key, dots]) => {
        const displayName = formatSkillName(key)
        const active = isActive("skill", displayName)
        return (
          <TraitRow
            key={key}
            interactive={interactive}
            canToggle={canToggle}
            active={active}
            onToggle={() => onToggle("skill", displayName, dots)}
            className="flex items-center justify-between gap-2 rounded-[3px] px-2 py-1 text-left"
          >
            <span className="text-[12px]">{displayName}</span>
            <DotRating current={dots} active={active} />
          </TraitRow>
        )
      })}
    </div>
  )
}

function ArcanaList({
  arcana,
  ruling,
  onToggle,
  isActive,
  canToggle,
  interactive,
  cast,
}: {
  arcana: Record<string, number | undefined>
  ruling: readonly string[]
  onToggle: (type: PoolComponentType, name: string, dots: number) => void
  isActive: (type: PoolComponentType, name: string) => boolean
  canToggle: boolean
  interactive: boolean
  cast?: CastAPI | undefined
}) {
  const entries = Object.entries(arcana)
    .filter(([, dots]) => dots != null && dots > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number)) as [ArcanumName, number][]

  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
      {entries.map(([name, dots]) => {
        const isRuling = ruling.includes(name)
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        const active = isActive("arcanum", displayName)
        const armed =
          cast?.context.selection?.method === "improvised" &&
          cast.context.selection.arcanum === name
        return (
          <div key={name} className="flex items-center gap-1">
            <TraitRow
              interactive={interactive}
              canToggle={canToggle}
              active={active}
              onToggle={() => onToggle("arcanum", displayName, dots)}
              className="flex flex-1 items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left"
            >
              <ArcanaGlyph arcanum={name} size={19} className={active ? "mv-accent" : ""} />
              <span className="flex-1 text-[13px]">
                {displayName}
                {isRuling && (
                  <span className="mv-accent ml-1" title="Ruling Arcanum">
                    ◆
                  </span>
                )}
              </span>
              <DotRating current={dots} active={active} />
            </TraitRow>
            {/* The improvised-cast trigger (issue #20): row toggles the pool,
                this arms a cast — two controls, one surface. */}
            {cast && (
              <button
                type="button"
                onClick={() => cast.armImprovised(name, dots)}
                disabled={cast.state === "casting"}
                title={`Cast improvised ${displayName}`}
                className={`mv-mini shrink-0 ${armed ? "mv-mini-on" : ""}`}
              >
                ✦
              </button>
            )}
          </div>
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
      <span className="flex-1 text-[13px]">
        {rote.name}
        <span className="ml-1.5 text-[11px]" style={{ color: "var(--dim)" }}>
          {rote.spellName} · {rote.spellArcanum} {rote.spellLevel}
        </span>
      </span>
      <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
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
