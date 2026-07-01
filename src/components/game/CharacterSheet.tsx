import { Character } from "#/domain/character"
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
  character: Character
  pool: DicePoolAPI
  healthTrack: string[]
  willpowerCurrent: number
  manaCurrent: number
}

export function CharacterSheet({
  character,
  pool,
  healthTrack,
  willpowerCurrent,
  manaCurrent,
}: CharacterSheetProps) {
  const canToggle = pool.state === "idle" || pool.state === "building"

  const toggle = (type: string, name: string, dots: number) => {
    if (!canToggle) return
    pool.toggleComponent({ type, name, dots })
  }

  const isActive = (type: string, name: string) =>
    pool.isComponentActive(type, name)

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{character.name}</h2>
        {character.shadowName && (
          <p className="text-sm text-muted-foreground italic">
            &ldquo;{character.shadowName}&rdquo;
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {character.path} &middot; {character.order} &middot;{" "}
          <span className="inline-flex items-center gap-1">
            Gnosis <DotRating current={character.gnosis} max={10} className="inline-flex" />
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {character.concept}
        </p>
        <p className="text-xs text-muted-foreground">
          {character.virtue} / {character.vice}
        </p>
      </div>

      {/* Attributes */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)] mb-2">
          Attributes
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
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
          />
        </div>
      </section>

      {/* Skills */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)] mb-2">
          Skills
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <SkillColumn
            label="Mental"
            skills={Object.entries(character.skills.mental) as [string, number][]}
            onToggle={toggle}
            isActive={isActive}
            canToggle={canToggle}
          />
          <SkillColumn
            label="Physical"
            skills={Object.entries(character.skills.physical) as [string, number][]}
            onToggle={toggle}
            isActive={isActive}
            canToggle={canToggle}
          />
          <SkillColumn
            label="Social"
            skills={Object.entries(character.skills.social) as [string, number][]}
            onToggle={toggle}
            isActive={isActive}
            canToggle={canToggle}
          />
        </div>
      </section>

      {/* Arcana */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)] mb-2">
          Arcana
        </h3>
        <ArcanaList
          arcana={character.arcana}
          path={character.path}
          onToggle={toggle}
          isActive={isActive}
          canToggle={canToggle}
        />
      </section>

      {/* Derived Stats */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--kicker)] mb-2">
          Derived Stats
        </h3>
        <div className="grid gap-2 text-sm">
          {/* Health */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-muted-foreground">Health</span>
            <div className="flex gap-0.5">
              {healthTrack.map((box, i) => (
                <span
                  key={i}
                  className={`inline-block size-4 rounded-sm border text-center text-[9px] leading-4 ${
                    box === "empty"
                      ? "border-[var(--line)] bg-transparent"
                      : box === "bashing"
                        ? "border-[var(--kicker)] bg-transparent text-[var(--kicker)]"
                        : box === "lethal"
                          ? "border-[var(--kicker)] bg-[var(--kicker)]/30 text-[var(--kicker)]"
                          : "border-[var(--kicker)] bg-[var(--kicker)] text-background"
                  }`}
                >
                  {box === "bashing" ? "/" : box === "lethal" ? "X" : box === "aggravated" ? "*" : ""}
                </span>
              ))}
            </div>
          </div>

          {/* Willpower */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-muted-foreground">Willpower</span>
            <DotRating current={willpowerCurrent} max={character.willpower} />
            <span className="text-xs text-muted-foreground">
              {willpowerCurrent}/{character.willpower}
            </span>
          </div>

          {/* Mana */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs text-muted-foreground">Mana</span>
            <span className="text-xs font-medium tabular-nums">
              {manaCurrent}/{character.maxMana}
            </span>
          </div>

          {/* Combat stats */}
          <div className="flex gap-6 mt-1">
            <div className="text-xs">
              <span className="text-muted-foreground">Defense </span>
              <span className="font-medium">{character.defense}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Initiative </span>
              <span className="font-medium">{character.initiative}</span>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Speed </span>
              <span className="font-medium">{character.speed}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// --- Sub-components ---

const ACTIVE_CLASSES = "bg-[var(--lagoon)]/10 ring-1 ring-[var(--lagoon)]"

function StatColumn({
  label,
  stats,
  type,
  onToggle,
  isActive,
  canToggle,
}: {
  label: string
  stats: [string, number][]
  type: string
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
  canToggle: boolean
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {stats.map(([name, dots]) => {
        const active = isActive(type, name)
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(type, name, dots)}
            disabled={!canToggle}
            className={`flex items-center justify-between rounded px-2 py-1 text-left cursor-pointer hover:bg-accent disabled:opacity-50 disabled:cursor-default ${
              active ? ACTIVE_CLASSES : ""
            }`}
          >
            <span className="text-xs">{name}</span>
            <DotRating current={dots} />
          </button>
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
}: {
  label: string
  skills: [string, number][]
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
  canToggle: boolean
}) {
  const nonZero = skills.filter(([, dots]) => dots > 0)
  if (nonZero.length === 0) return null

  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {nonZero.map(([key, dots]) => {
        const displayName = formatSkillName(key)
        const active = isActive("skill", displayName)
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle("skill", displayName, dots)}
            disabled={!canToggle}
            className={`flex items-center justify-between rounded px-2 py-1 text-left cursor-pointer hover:bg-accent disabled:opacity-50 disabled:cursor-default ${
              active ? ACTIVE_CLASSES : ""
            }`}
          >
            <span className="text-xs">{displayName}</span>
            <DotRating current={dots} />
          </button>
        )
      })}
    </div>
  )
}

function ArcanaList({
  arcana,
  path,
  onToggle,
  isActive,
  canToggle,
}: {
  arcana: Record<string, number | undefined>
  path: string
  onToggle: (type: string, name: string, dots: number) => void
  isActive: (type: string, name: string) => boolean
  canToggle: boolean
}) {
  const ruling = PATH_RULING_ARCANA[path] ?? []
  const entries = Object.entries(arcana)
    .filter(([, dots]) => dots != null && dots > 0)
    .sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][]

  if (entries.length === 0) return null

  return (
    <div className="grid gap-1">
      {entries.map(([name, dots]) => {
        const isRuling = ruling.includes(name)
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        const active = isActive("arcanum", displayName)
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle("arcanum", displayName, dots)}
            disabled={!canToggle}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left cursor-pointer hover:bg-accent disabled:opacity-50 disabled:cursor-default ${
              active ? ACTIVE_CLASSES : ""
            }`}
          >
            <span className="text-xs">
              {displayName}
              {isRuling && (
                <span className="ml-1 text-[var(--kicker)]" title="Ruling Arcanum">
                  &bull;
                </span>
              )}
            </span>
            <DotRating current={dots} />
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
