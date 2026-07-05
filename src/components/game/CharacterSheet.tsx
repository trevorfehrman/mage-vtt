import type { ReactNode } from "react"
import type { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { DotRating } from "./DotRating"
import type { useDicePool } from "#/hooks/use-dice-pool"

type DicePoolAPI = ReturnType<typeof useDicePool>

// Path ruling arcana lookup
const PATH_RULING_ARCANA: Record<string, readonly string[]> = {
  Acanthus: ["time", "fate"],
  Mastigos: ["space", "mind"],
  Moros: ["matter", "death"],
  Obrimos: ["forces", "prime"],
  Thyrsus: ["life", "spirit"],
}

interface CharacterSheetProps {
  character: CharacterSheetData
  /**
   * The dice-pool controller. Absent = a read-only sheet (roster browsing,
   * issue #17): traits render as plain rows, not pool toggles — only your own
   * sheet is a controller.
   */
  pool?: DicePoolAPI | undefined
}

/**
 * The sheet is the dice-pool input surface (docs/component-polish.md): every
 * rated Attribute / Skill / Arcanum is a toggle button feeding the pool.
 */
export function CharacterSheet({ character, pool }: CharacterSheetProps) {
  const { healthTrack, willpowerCurrent, manaCurrent } = character
  const canToggle =
    pool !== undefined && (pool.state === "idle" || pool.state === "building")
  const ruling = PATH_RULING_ARCANA[character.path] ?? []

  const toggle = (type: string, name: string, dots: number) => {
    if (!pool || !canToggle) return
    pool.toggleComponent({ type, name, dots })
  }

  const isActive = (type: string, name: string) =>
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
        />
      </Section>

      {/* Vitals */}
      <Section title="Vitals">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="mv-eyebrow w-16">Health</span>
            <div className="flex gap-1">
              {healthTrack.map((box, i) => (
                <span
                  key={i}
                  className="mv-data grid size-5 place-items-center rounded-[2px] border text-[10px] font-bold"
                  style={{
                    borderColor: box === "empty" ? "var(--line)" : "var(--accent)",
                    background: box === "empty" || box === "bashing" ? "transparent" : "var(--glow)",
                    color: "var(--accent)",
                  }}
                >
                  {box === "bashing" ? "╱" : box === "lethal" ? "✕" : box === "aggravated" ? "✳" : ""}
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
  type: string
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
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
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
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
}: {
  arcana: Record<string, number | undefined>
  ruling: readonly string[]
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
  canToggle: boolean
  interactive: boolean
}) {
  const entries = Object.entries(arcana)
    .filter(([, dots]) => dots != null && dots > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][]

  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
      {entries.map(([name, dots]) => {
        const isRuling = ruling.includes(name)
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        const active = isActive("arcanum", displayName)
        return (
          <TraitRow
            key={name}
            interactive={interactive}
            canToggle={canToggle}
            active={active}
            onToggle={() => onToggle("arcanum", displayName, dots)}
            className="flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left"
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
