import { useState, type RefObject } from "react"
import { useMessageForm } from "#/hooks/use-tray-form"
import { Felt } from "./Felt"

/**
 * The message box (MAG-53): the dice tray's partner in the rail's one slot,
 * wearing the tray's grammar — a felt, a grip on its top edge, the trigger at
 * the far right. Whispering cleanly is the job (owner, 2026-10-24: "i think
 * what we want is to just be able to whisper cleanly, if the expanded view
 * doesn't expand by much so be it"): who a line goes to is chosen at the
 * video tiles, or in the tall form's one row of people; nobody chosen is the
 * table. The shrunk line names a whisper's people inside the felt, with a ×
 * back to the table; a line to the table carries no label at all (owner,
 * 2026-10-25: it took too much room). The draft lives here, and the slot
 * keeps this mounted while the tray shows, so a flip never loses it.
 */
interface Person {
  readonly id: string
  readonly name: string
}

interface MessageBoxProps {
  /** everyone the viewer could whisper */
  readonly people: ReadonlyArray<Person>
  /** who the line is whispered to, by user id; empty is the table */
  readonly targets: ReadonlyArray<string>
  readonly onToggle: (id: string) => void
  readonly onClear: () => void
  readonly onSend: (text: string, targets: ReadonlyArray<string>) => Promise<unknown>
  /** Escape in the line: back to the tray */
  readonly onEscape: () => void
  readonly inputRef: RefObject<HTMLInputElement | null>
}

export function MessageBox({ people, targets, onToggle, onClear, onSend, onEscape, inputRef }: MessageBoxProps) {
  const [form, setForm] = useMessageForm()
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const tall = form === "tall"
  const chosen = people.filter((p) => targets.includes(p.id))
  const whisper = chosen.length > 0
  const words = draft.trim()
  const send = () => {
    if (!words) return
    setError(null)
    onSend(words, chosen.map((p) => p.id)).then(
      () => setDraft(""),
      (e: unknown) => setError(e instanceof Error ? e.message : "The message didn't send."),
    )
  }
  const grip = tall ? "Shrink the message box" : "Show who to whisper"

  return (
    <div className="relative border-t" style={{ borderColor: "var(--line)" }}>
      <button
        onClick={() => setForm(tall ? "shrunk" : "tall")}
        className="mv-grip"
        title={grip}
        aria-label={grip}
        aria-expanded={tall}
      >
        <span className="mv-grip-bar" />
      </button>
      {tall && (
        // the people, one row: toggle any of them; Table clears them
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-1.5">
          <button
            onClick={onClear}
            aria-pressed={!whisper}
            className={`mv-mini grow whitespace-nowrap ${!whisper ? "mv-mini-on" : ""}`}
          >
            Table
          </button>
          <span className="h-4 w-px" style={{ background: "var(--line)" }} />
          {people.map((p) => {
            const on = targets.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => onToggle(p.id)}
                aria-pressed={on}
                className={`mv-mini grow whitespace-nowrap ${on ? "mv-mini-on" : ""}`}
              >
                @ {p.name}
              </button>
            )
          })}
        </div>
      )}
      <div className="mx-3 flex items-center gap-1.5 py-2">
        <Felt className="flex h-8 min-w-0 flex-1 items-center">
          {whisper && (
            <>
              <span className="flex min-w-0 shrink items-center gap-1 pl-2.5" style={{ maxWidth: "55%" }}>
                <span
                  className="mv-data truncate text-[10px] uppercase"
                  style={{ letterSpacing: "0.06em", color: "var(--accent)" }}
                  title={`Whispering to ${chosen.map((p) => p.name).join(", ")}`}
                >
                  @ {chosen[0]!.name}
                  {chosen.length > 1 && ` +${chosen.length - 1}`}
                </span>
                <button
                  onClick={onClear}
                  className="mv-btn grid size-4 shrink-0 place-items-center rounded-[3px] border-0 text-[12px] leading-none"
                  style={{ color: "var(--dim)" }}
                  title="Back to the table"
                  aria-label="Stop whispering, talk to the table"
                >
                  ×
                </button>
              </span>
              <span className="mx-2 h-4 w-px shrink-0" style={{ background: "var(--line)" }} />
            </>
          )}
          <input
            ref={inputRef}
            aria-label={whisper ? "Whisper" : "Message the table"}
            placeholder={whisper ? "Whisper…" : "Message the table…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send()
              if (e.key === "Escape") {
                // never the session's Escape (it clears the dice pool)
                e.stopPropagation()
                onEscape()
              }
            }}
            className={`h-8 min-w-0 flex-1 bg-transparent pr-2.5 text-[13px] outline-none ${whisper ? "" : "pl-2.5"}`}
            style={{ color: "var(--ink)" }}
          />
        </Felt>
        <button
          onClick={send}
          disabled={!words}
          className="mv-roll h-8 shrink-0 rounded-[3px] text-[12px] disabled:opacity-40"
          style={{ minWidth: 76, padding: "0 10px" }}
        >
          {whisper ? "Whisper" : "Send"}
        </button>
      </div>
      {/* the seam's refusal, spoken under the line as the tray speaks its own */}
      {error && (
        <p className="px-3 pb-2 text-[12px]" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
