import type { ReactNode } from "react"
import type { SpellAspect } from "#/domain/rote-cast"
import { GateButton } from "#/components/ui/gate-button"
import { ArcanaGlyph } from "./ArcanaGlyph"
import { ParadoxGlyph } from "./ParadoxGlyph"

/**
 * The declaration's sealed trigger (MAG-32; owner, 2026-10-23: the caster
 * must choose covert or vulgar on purpose, where the Roll button lives).
 * The commit button arrives SEALED: one bar, Covert on the left half and
 * Vulgar on the right, the spell's Arcanum glyph the seal on the seam.
 * Pressing a half cracks it open to that side; the half under the pointer
 * takes its own ink first (`.mv-seal` in styles.css, no JS hover state).
 * The vulgar half names the Paradox pool it would start from, so the price
 * is read before the choice. Open, the bar is the commit button itself —
 * its own press — with the seal resting at its near end, pressed to close
 * it again. A rote the book fixes to one aspect arrives open and refuses to
 * reseal, saying why.
 */
export function SealedTrigger({
  arcanum,
  aspect,
  lockNote,
  busy,
  paradoxDice,
  onChoose,
  commit,
}: {
  arcanum: string
  aspect: SpellAspect | null
  /** Set when the book fixes the aspect: the reseal's refusal, in words. */
  lockNote: string | null
  busy: boolean
  /** The Paradox pool the vulgar side would start from. */
  paradoxDice: number
  onChoose: (aspect: SpellAspect | null) => void
  /** The open button, for the chosen side. */
  commit: ReactNode
}) {
  if (aspect !== null)
    return (
      <div className="mv-seal-open" data-side={aspect}>
        <GateButton
          gate={lockNote}
          onClick={() => onChoose(null)}
          disabled={busy}
          className="mv-btn mv-seal-reseal"
          title={lockNote ?? "Seal it again"}
          aria-label={lockNote ?? "Seal it again"}
        >
          <span className="mv-seal-mark">
            <ArcanaGlyph arcanum={arcanum} size={12} />
          </span>
        </GateButton>
        {commit}
      </div>
    )
  return (
    <div className="mv-seal">
      <button
        onClick={() => onChoose("Covert")}
        disabled={busy}
        className="mv-seal-half"
        data-side="Covert"
        title="Open it covert: it rolls now, no Paradox"
      >
        Covert
      </button>
      <button
        onClick={() => onChoose("Vulgar")}
        disabled={busy}
        className="mv-seal-half"
        data-side="Vulgar"
        title={`Open it vulgar: the Tides, then Paradox from ${paradoxDice} ${paradoxDice === 1 ? "die" : "dice"}`}
      >
        Vulgar
        <ParadoxGlyph size={10} title="Paradox" />
        {paradoxDice}
      </button>
      {/* the seam and the seal on it; both take the hot half's ink */}
      <span className="mv-seal-seam" />
      <span className="mv-seal-mark">
        <ArcanaGlyph arcanum={arcanum} size={12} />
      </span>
    </div>
  )
}
