import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Session roster (PRD #11, issue #17): the Character panel's character
 * picker. Every session member sees every PC and can open any sheet; your own
 * character is the default. Sheets other than your own render read-only — no
 * pool toggles, no cast forms — and the strip says so. No portraits, no NPCs,
 * no edit affordances in this slice.
 */
interface RosterEntry {
  id: Id<"characters">
  name: string
  isMine: boolean
}

interface RosterProps {
  entries: RosterEntry[]
  selectedId: Id<"characters"> | undefined
  onSelect: (id: Id<"characters">) => void
}

export function Roster({ entries, selectedId, onSelect }: RosterProps) {
  const selected = entries.find((e) => e.id === selectedId)

  return (
    <div className="mx-auto mb-4 flex w-full max-w-3xl items-center gap-2">
      <div className="flex flex-1 flex-wrap gap-1.5">
        {entries.map((entry) => {
          const active = entry.id === selectedId
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry.id)}
              className={`mv-chip rounded-[3px] px-2.5 py-1 text-[12px] leading-none ${
                active ? "mv-trait-on" : ""
              }`}
            >
              {entry.name}
              {entry.isMine && (
                <span className="mv-accent ml-1.5" title="Your character">
                  ◆
                </span>
              )}
            </button>
          )
        })}
      </div>
      {selected && !selected.isMine && (
        <span className="mv-eyebrow shrink-0" title="Another player's sheet">
          Read-only
        </span>
      )}
    </div>
  )
}
