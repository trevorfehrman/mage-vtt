import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { timeline, type CombatParticipant } from "#/domain/combat-tracker"
import { useCombat } from "#/hooks/use-combat"
import { seamErrorMessage } from "#/lib/seam-errors"
import type { Id } from "../../../convex/_generated/dataModel"

/**
 * The Combat tracker (issue #60): the FFX tick timeline as the bottom band.
 * Every participant rides the line ordered by Ticks; the settled next actor
 * (server-stamped, issue #59) is visually obvious on every screen. A player
 * rolls initiative by clicking their own face; the Storyteller clicks any
 * face and conducts the clock — preset costs, Aim/Dodge 1/2/3, a free-typed
 * cost — and nothing ever bills itself (ADR-0015). Aim/Dodge chrome rides
 * the chip as displayed memory, never an enforced modifier.
 *
 * Out of Combat the band collapses: a one-line start affordance for the ST,
 * nothing at all for players (the settled grid keeps the bottom band
 * unrendered until the combat phase). Player conduct controls never render;
 * the server refuses them regardless (ADR-0010). Placeholder initials stand
 * in for portraits — the FFX shuffle and real faces are #63.
 */

export function CombatTracker({
  sessionId,
  isStoryteller,
  myCharacterId,
  roster,
}: {
  sessionId: Id<"sessions">
  isStoryteller: boolean
  /** The viewer's own character — whose face is theirs to click. */
  myCharacterId?: Id<"characters"> | undefined
  /** The session's characters, for the ST's sheet-backed add picker. */
  roster: ReadonlyArray<{ id: Id<"characters">; name: string }>
}) {
  const combat = useCombat(sessionId)
  const start = useMutation(api.combats.start)
  const end = useMutation(api.combats.end)
  const addParticipant = useMutation(api.combats.addParticipant)
  const removeParticipant = useMutation(api.combats.removeParticipant)
  const rollInitiative = useMutation(api.combats.rollInitiative)
  const spendTicks = useMutation(api.combats.spendTicks)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The ST's cost target; also gates the cost bar's visibility.
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // A refusal describes the world it was refused against; when the live
  // Combat state moves, the stale message stands down (the SceneStrip
  // posture) — and a vanished selection deselects rather than dangles.
  const liveKey =
    combat === undefined
      ? "loading"
      : combat === null
        ? "none"
        : `${combat.id}:${combat.status}:${combat.nextActorId ?? ""}:${combat.participants
            .map(
              (p) =>
                `${p.id}@${p.ticks ?? "-"}${p.reminder ? `${p.reminder.kind}${p.reminder.bonus}` : ""}`,
            )
            .join(",")}`
  useEffect(() => {
    setError(null)
  }, [liveKey])
  useEffect(() => {
    if (
      selectedId !== null &&
      !(combat?.participants ?? []).some((p) => p.id === selectedId)
    ) {
      setSelectedId(null)
    }
  }, [combat, selectedId])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError(seamErrorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (combat === undefined) return null

  if (combat === null || combat.status === "ended") {
    // Out of combat the band stays collapsed; only the ST holds the door.
    if (!isStoryteller) return null
    return (
      <div
        className="mv-panel flex min-h-8 items-center gap-3 border-x-0 border-b-0 px-4 py-1"
        data-slot="combat-tracker"
      >
        <span className="mv-eyebrow shrink-0">Combat</span>
        <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
          No Combat — the Scene breathes
        </span>
        <button
          onClick={() => void run(() => start({ sessionId }))}
          disabled={busy}
          className="mv-mini ml-auto disabled:opacity-40"
        >
          {busy ? "…" : "⚔ Begin Combat"}
        </button>
        {error && (
          <span className="text-[11px]" style={{ color: "var(--bad)" }}>
            {error}
          </span>
        )}
      </div>
    )
  }

  const ordered = timeline(combat)
  const rolledTicks = ordered.flatMap((p) => (p.ticks !== undefined ? [p.ticks] : []))
  const frontTicks = rolledTicks.length > 0 ? Math.min(...rolledTicks) : 0
  const selected = ordered.find((p) => p.id === selectedId)

  const mayRoll = (p: CombatParticipant) =>
    p.initiative === undefined &&
    (isStoryteller || (p.kind === "sheet" && p.characterId === myCharacterId))

  return (
    <div
      className="mv-panel border-x-0 border-b-0 px-4 py-2"
      data-slot="combat-tracker"
    >
      <div className="flex items-end gap-4">
        <div className="flex shrink-0 flex-col leading-tight">
          <span className="mv-eyebrow">Ticks</span>
          <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
            turn order
          </span>
        </div>

        {/* The timeline: every face on one line, ordered by Ticks. */}
        <div className="flex min-w-0 flex-1 items-end gap-3 overflow-x-auto pb-0.5">
          {ordered.map((p) => (
            <ParticipantChip
              key={p.id}
              participant={p}
              isNext={combat.nextActorId === p.id}
              frontTicks={frontTicks}
              isMine={p.kind === "sheet" && p.characterId === myCharacterId}
              selectable={isStoryteller}
              selected={selectedId === p.id}
              rollable={mayRoll(p)}
              busy={busy}
              onRoll={() =>
                void run(() =>
                  rollInitiative({ sessionId, participantId: p.id }),
                )
              }
              onSelect={() =>
                setSelectedId((cur) => (cur === p.id ? null : p.id))
              }
            />
          ))}
          {ordered.length === 0 && (
            <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
              An empty field — add combatants.
            </span>
          )}
        </div>

        {isStoryteller && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              onClick={() => void run(() => end({ sessionId }))}
              disabled={busy}
              className="mv-mini disabled:opacity-40"
            >
              End Combat
            </button>
            <AddCombatantForm
              roster={roster.filter(
                (r) =>
                  !combat.participants.some(
                    (p) => p.kind === "sheet" && p.characterId === r.id,
                  ),
              )}
              busy={busy}
              onAddSheet={(characterId) =>
                run(() => addParticipant({ sessionId, characterId }))
              }
              onAddManual={(draft) => run(() => addParticipant({ sessionId, ...draft }))}
            />
          </div>
        )}
      </div>

      {/* The ST's cost bar for the selected face — the clock's only door. */}
      {isStoryteller && selected && (
        <CostBar
          participant={selected}
          busy={busy}
          onSpend={(spend) =>
            void run(() =>
              spendTicks({ sessionId, participantId: selected.id, ...spend }),
            )
          }
          onRemove={() =>
            void run(() =>
              removeParticipant({ sessionId, participantId: selected.id }),
            )
          }
        />
      )}

      {error && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * One face on the line: placeholder initials (real portraits are #63), the
 * Tick badge relative to the front of the queue, and any Aim/Dodge chrome.
 * The whole chip is the initiative button while unrolled; for the ST it is
 * also the cost-target selector once rolled.
 */
function ParticipantChip({
  participant: p,
  isNext,
  frontTicks,
  isMine,
  selectable,
  selected,
  rollable,
  busy,
  onRoll,
  onSelect,
}: {
  participant: CombatParticipant
  isNext: boolean
  frontTicks: number
  isMine: boolean
  selectable: boolean
  selected: boolean
  rollable: boolean
  busy: boolean
  onRoll: () => void
  onSelect: () => void
}) {
  const unrolled = p.initiative === undefined
  const initials = p.name.slice(0, 2).toUpperCase()
  const clickable = rollable || (selectable && !unrolled)

  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <span
        className="text-[9px] font-bold leading-none tracking-wider"
        style={{ color: isNext ? "var(--accent)" : "transparent" }}
      >
        ▶ ACTING
      </span>
      <button
        onClick={rollable ? onRoll : selectable && !unrolled ? onSelect : undefined}
        disabled={busy || !clickable}
        title={
          unrolled
            ? rollable
              ? `${p.name} — roll initiative (d10 + Dex + Composure)`
              : `${p.name} — awaiting initiative`
            : `${p.name}${p.kind === "manual" ? " (NPC)" : ""} — ${p.ticks} Ticks owed`
        }
        className="grid size-12 place-items-center rounded-[3px] border text-[13px] font-bold"
        style={{
          borderColor: selected
            ? "var(--accent)"
            : p.kind === "manual"
              ? "var(--bad)"
              : "var(--line)",
          background: isNext ? "var(--accent)" : "var(--panel)",
          color: isNext ? "var(--bg)" : "var(--ink)",
          opacity: unrolled ? 0.65 : 1,
          outline: isMine ? "1px solid var(--accent)" : "none",
          outlineOffset: "2px",
          cursor: clickable && !busy ? "pointer" : "default",
        }}
      >
        {initials}
      </button>
      <span
        className="mv-data max-w-14 truncate text-[10px] leading-tight"
        style={{ color: "var(--dim)" }}
      >
        {p.name}
      </span>
      <span
        className="mv-data text-[10px] font-bold leading-none"
        style={{ color: isNext ? "var(--accent)" : "var(--dim)" }}
      >
        {unrolled ? (
          rollable ? "roll d10" : "waiting"
        ) : isNext ? (
          "NOW"
        ) : (
          `+${(p.ticks ?? 0) - frontTicks}`
        )}
      </span>
      {/* Displayed memory, never enforced (ADR-0015). */}
      {p.reminder && (
        <span
          className="mv-data rounded-[2px] border px-1 text-[9px] leading-tight"
          style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          title={
            p.reminder.kind === "aim"
              ? `Aiming: +${p.reminder.bonus} dice on the next attack`
              : `Dodging: +${p.reminder.bonus} Defense`
          }
        >
          {p.reminder.kind === "aim"
            ? `+${p.reminder.bonus} next atk`
            : `+${p.reminder.bonus} Defense`}
        </span>
      )}
    </div>
  )
}

const PRESETS = [
  { action: "attack", label: "Attack 3" },
  { action: "castSpell", label: "Cast 5" },
  { action: "move", label: "Move 3" },
  { action: "useItem", label: "Use item 3" },
] as const

/** The ST's billing surface: presets, Aim/Dodge 1/2/3, and the free cost. */
function CostBar({
  participant,
  busy,
  onSpend,
  onRemove,
}: {
  participant: CombatParticipant
  busy: boolean
  onSpend: (spend: {
    action?: "attack" | "castSpell" | "move" | "useItem" | "aim" | "dodge"
    count?: number
    cost?: number
  }) => void
  onRemove: () => void
}) {
  const [freeCost, setFreeCost] = useState("")
  const rolled = participant.initiative !== undefined

  const submitFree = () => {
    const cost = Number(freeCost)
    if (freeCost.trim().length === 0 || Number.isNaN(cost)) return
    onSpend({ cost })
    setFreeCost("")
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t pt-1.5" style={{ borderColor: "var(--line)" }}>
      <span className="mv-data text-[10px] uppercase tracking-wider" style={{ color: "var(--dim)" }}>
        {participant.name}
      </span>
      {rolled ? (
        <>
          {PRESETS.map((preset) => (
            <button
              key={preset.action}
              onClick={() => onSpend({ action: preset.action })}
              disabled={busy}
              className="mv-mini disabled:opacity-40"
            >
              {preset.label}
            </button>
          ))}
          {(["aim", "dodge"] as const).map((action) => (
            <span key={action} className="flex items-center gap-0.5">
              <span className="mv-data text-[10px]" style={{ color: "var(--dim)" }}>
                {action === "aim" ? "Aim" : "Dodge"}
              </span>
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  onClick={() => onSpend({ action, count })}
                  disabled={busy}
                  className="mv-mini disabled:opacity-40"
                >
                  {count}
                </button>
              ))}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <input
              value={freeCost}
              onChange={(e) => setFreeCost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitFree()
              }}
              placeholder="ticks…"
              inputMode="numeric"
              className="mv-data w-14 rounded-[3px] border bg-transparent px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--line)" }}
            />
            <button
              onClick={submitFree}
              disabled={busy || freeCost.trim().length === 0}
              className="mv-mini disabled:opacity-40"
            >
              Bill
            </button>
          </span>
        </>
      ) : (
        <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
          Awaiting initiative — nothing to bill yet.
        </span>
      )}
      <button
        onClick={onRemove}
        disabled={busy}
        className="mv-mini ml-auto disabled:opacity-40"
        style={{ color: "var(--bad)" }}
      >
        Remove
      </button>
    </div>
  )
}

/**
 * The ST's add door, both lanes (issue #60): pick a real character from the
 * session, or hand-type the paper NPC (name + Dex/Composure/Wits/Willpower —
 * a row that never touches a sheet).
 */
function AddCombatantForm({
  roster,
  busy,
  onAddSheet,
  onAddManual,
}: {
  roster: ReadonlyArray<{ id: Id<"characters">; name: string }>
  busy: boolean
  onAddSheet: (characterId: Id<"characters">) => Promise<boolean>
  onAddManual: (draft: {
    name: string
    dexterity: number
    composure: number
    wits: number
    willpower: number
  }) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [stats, setStats] = useState({ dexterity: "2", composure: "2", wits: "2", willpower: "2" })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mv-mini">
        + Add combatant
      </button>
    )
  }

  const submitManual = async () => {
    const draft = {
      name,
      dexterity: Number(stats.dexterity),
      composure: Number(stats.composure),
      wits: Number(stats.wits),
      willpower: Number(stats.willpower),
    }
    if (await onAddManual(draft)) {
      setName("")
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {roster.length > 0 && (
        <select
          defaultValue=""
          disabled={busy}
          onChange={(e) => {
            const id = e.target.value as Id<"characters">
            if (id) {
              void onAddSheet(id).then((ok) => ok && setOpen(false))
            }
          }}
          className="mv-data w-40 rounded-[3px] border bg-transparent px-1.5 py-0.5 text-[11px] outline-none"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <option value="">Seat a character…</option>
          {roster.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="NPC name…"
          className="mv-data w-24 rounded-[3px] border bg-transparent px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--line)" }}
        />
        {(
          [
            ["dexterity", "Dex"],
            ["composure", "Com"],
            ["wits", "Wit"],
            ["willpower", "Wil"],
          ] as const
        ).map(([key, label]) => (
          <input
            key={key}
            value={stats[key]}
            onChange={(e) => setStats((s) => ({ ...s, [key]: e.target.value }))}
            title={label}
            placeholder={label}
            inputMode="numeric"
            className="mv-data w-9 rounded-[3px] border bg-transparent px-1 py-0.5 text-center text-[11px] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
          />
        ))}
        <button
          onClick={() => void submitManual()}
          disabled={busy || name.trim().length === 0}
          className="mv-mini disabled:opacity-40"
        >
          Add NPC
        </button>
        <button onClick={() => setOpen(false)} className="mv-mini">
          ×
        </button>
      </div>
    </div>
  )
}
