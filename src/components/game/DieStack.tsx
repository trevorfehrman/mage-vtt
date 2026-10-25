import { Children, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react"
import { AnimatePresence } from "motion/react"
import { SIZE_LADDER, type DieSize } from "./die-look"

/**
 * The shrunk tray's dice in one row that stacks when it runs out of room
 * (owner, 2026-10-25): each die stands in a slot that shrinks as the felt
 * fills, so the dice slide under one another instead of wrapping, the first
 * drawn on top. The slots shrink evenly (flex does the arithmetic), down to
 * a sliver each; the last keeps its whole die. The die itself never shrinks
 * — it hangs from its slot's left edge, whole, over the next one. The count
 * is the Roll button's, not the stack's.
 *
 * The dice are translucent, so each sits on an underlay of the felt's own
 * ground — a stacked die hides the one beneath instead of muddying it.
 */
interface DieStackProps {
  /** Keyed pool dice, first on top. They spring in, but leave at once: no
   * presence here, because a leaving die's slot would hold its room until
   * its exit finished, and a quick run of skims would pile those slots up
   * and crush the row (owner, 2026-10-25). The rest glide into the gap. */
  children: ReactNode
  size: DieSize
}

const GAP = 10
const SLIVER = 5

export function DieStack({ children, size }: DieStackProps) {
  const px = SIZE_LADDER[size].px
  // a diamond's tips stand ~4px outside its box on every side
  const tip = Math.ceil(px * 0.21)
  const dice = Children.toArray(children) as Array<ReactElement>
  return (
    <span
      className="flex min-w-0 flex-1 items-center"
      // clip only the row's run, never the tips above and below
      style={{ paddingLeft: tip + 2, paddingRight: tip + 2, overflowX: "clip" }}
    >
      {dice.map((die, i) => {
          const last = i === dice.length - 1
          return (
            <span
              key={die.key ?? i}
              className="relative"
              style={{
                flex: last ? "0 0 auto" : "0 1 auto",
                width: last ? px : px + GAP,
                minWidth: last ? px : SLIVER,
                height: px,
                zIndex: dice.length - i,
              }}
            >
              {/* the underlay: the felt's ground, in the die's own diamond */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded-[4px]"
                style={{
                  width: px,
                  transform: "rotate(45deg)",
                  background: "color-mix(in srgb, var(--accent) 6%, var(--bg))",
                }}
              />
              <span className="absolute inset-y-0 left-0" style={{ width: px }}>
                {die}
              </span>
            </span>
          )
        })}
    </span>
  )
}

/**
 * The tall tray's dice: two rows that wrap, as they always have, and no
 * third — when the pool outgrows them, the last place holds a "+N" for the
 * dice past the felt's edge (owner, 2026-10-25). The rows' capacity is
 * measured from the felt's own width, so it holds as the rail resizes.
 */
interface DieRowsProps {
  children: ReactNode
  size: DieSize
  rows: number
}

export function DieRows({ children, size, rows }: DieRowsProps) {
  const px = SIZE_LADDER[size].px
  const ref = useRef<HTMLSpanElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    // no observer (a test's DOM): every die shows, as before the cap
    if (el === null || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const dice = Children.toArray(children)
  const perRow = Math.max(1, Math.floor((width + GAP) / (px + GAP)))
  const room = width === 0 ? dice.length : perRow * rows
  const over = dice.length > room
  const shown = over ? dice.slice(0, room - 1) : dice
  return (
    <span ref={ref} className="flex min-w-0 flex-1 flex-wrap content-start gap-2.5 overflow-hidden p-1">
      <AnimatePresence initial={false}>{shown}</AnimatePresence>
      {over && (
        <span
          className="mv-data grid place-items-center font-bold"
          style={{ width: px, height: px, fontSize: 11, color: "var(--ink)" }}
          title={`${dice.length - shown.length} more dice past the felt's edge`}
        >
          +{dice.length - shown.length}
        </span>
      )}
    </span>
  )
}
