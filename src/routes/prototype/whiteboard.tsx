// PROTOTYPE — throwaway. Answers decision-map ticket `whiteboard-tools`.
//
// The shared whiteboard: theater-of-the-mind, NOT a tactical grid (positions
// illustrative, decoupled from rules — app-capabilities §11). Owner's calls:
//   • Authority = FULLY COLLABORATIVE — anyone draws/erases and moves any token.
//   • Fidelity  = LIGHT-MAP — faint dot/ley-grid, portrait/initial tokens with a
//     Path-tinted ring, freeform ink on top.
// Rendered in the LOCKED identity (Cinzel/mono/Verdigris void — visual-identity.md
// + component-polish.md). Interactive: pick a tool, draw, drag tokens, erase.
// Real-time sync is conceptual (Convex) — faked here with two remote cursors.
// Mock data; no Convex. DELETE once specced.
import { useRef, useState, type PointerEvent as RPointerEvent } from "react"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/prototype/whiteboard")({ component: Whiteboard })

type Tool = "select" | "pen" | "line" | "text" | "token-pc" | "token-npc" | "erase"
type Stroke = { id: string; d: string; kind: "pen" | "line" }
type Token = { id: string; x: number; y: number; label: string; kind: "pc" | "npc" }
type Label = { id: string; x: number; y: number; text: string }

const TOOLS: { id: Tool; glyph: string; name: string }[] = [
  { id: "select", glyph: "▹", name: "Select" },
  { id: "pen", glyph: "✎", name: "Pen" },
  { id: "line", glyph: "╱", name: "Line" },
  { id: "text", glyph: "T", name: "Text" },
  { id: "token-pc", glyph: "●", name: "PC" },
  { id: "token-npc", glyph: "◍", name: "NPC" },
  { id: "erase", glyph: "⌫", name: "Erase" },
]

// pre-drawn scene so the canvas reads as a populated chapel
const SCENE_STROKES: Stroke[] = [
  { id: "s-ward", kind: "pen", d: "M330 250 C300 180 470 150 560 210 C640 262 560 360 470 360 C380 360 360 300 330 250 Z" },
  { id: "s-altar", kind: "line", d: "M452 292 L470 300" },
]
const SCENE_TOKENS: Token[] = [
  { id: "t-arctus", x: 560, y: 250, label: "Arctus", kind: "pc" },
  { id: "t-mara", x: 430, y: 340, label: "Mara", kind: "pc" },
  { id: "t-ghoul", x: 600, y: 320, label: "Ghoul α", kind: "npc" },
]
const SCENE_LABELS: Label[] = [
  { id: "l-font", x: 352, y: 430, text: "the font" },
  { id: "l-altar", x: 440, y: 285, text: "✷ altar" },
  { id: "l-ward", x: 470, y: 150, text: "~ ward line ~" },
]
const CURSORS = [
  { name: "Vera (ST)", x: 690, y: 200, tint: "#cdbd94" },
  { name: "Mara", x: 400, y: 300, tint: "#9a86c4" },
]

const r2 = (n: number) => Math.round(n)

function Whiteboard() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<Tool>("select")
  const [strokes, setStrokes] = useState<Stroke[]>(SCENE_STROKES)
  const [tokens, setTokens] = useState<Token[]>(SCENE_TOKENS)
  const [labels, setLabels] = useState<Label[]>(SCENE_LABELS)
  const [draft, setDraft] = useState<string | null>(null)

  const pts = useRef<[number, number][]>([])
  const lineStart = useRef<[number, number] | null>(null)
  const dragId = useRef<string | null>(null)
  const idc = useRef(0)
  const nid = (p: string) => `${p}${(idc.current += 1)}`

  const at = (e: RPointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect()
    return [r2(e.clientX - r.left), r2(e.clientY - r.top)]
  }
  const toPath = (ps: [number, number][]) => ps.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = at(e)
    if (tool === "pen") { pts.current = [p]; setDraft(toPath(pts.current)); svgRef.current?.setPointerCapture(e.pointerId) }
    else if (tool === "line") { lineStart.current = p; setDraft(`M${p[0]} ${p[1]} L${p[0]} ${p[1]}`); svgRef.current?.setPointerCapture(e.pointerId) }
    else if (tool === "token-pc") setTokens((t) => [...t, { id: nid("pc"), x: p[0], y: p[1], label: "New PC", kind: "pc" }])
    else if (tool === "token-npc") setTokens((t) => [...t, { id: nid("npc"), x: p[0], y: p[1], label: "New NPC", kind: "npc" }])
    else if (tool === "text") setLabels((l) => [...l, { id: nid("l"), x: p[0], y: p[1], text: "label…" }])
  }
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (draft !== null && tool === "pen") { pts.current.push(at(e)); setDraft(toPath(pts.current)) }
    else if (draft !== null && tool === "line" && lineStart.current) { const p = at(e); setDraft(`M${lineStart.current[0]} ${lineStart.current[1]} L${p[0]} ${p[1]}`) }
    else if (dragId.current) { const p = at(e); setTokens((t) => t.map((tk) => (tk.id === dragId.current ? { ...tk, x: p[0], y: p[1] } : tk))) }
  }
  const onUp = () => {
    if (draft !== null) { setStrokes((s) => [...s, { id: nid("s"), d: draft, kind: tool === "line" ? "line" : "pen" }]); setDraft(null); pts.current = []; lineStart.current = null }
    dragId.current = null
  }

  const tokenDown = (e: RPointerEvent, id: string) => {
    if (tool === "select") { e.stopPropagation(); dragId.current = id; svgRef.current?.setPointerCapture(e.pointerId) }
    else if (tool === "erase") { e.stopPropagation(); setTokens((t) => t.filter((tk) => tk.id !== id)) }
  }
  const eraseStroke = (e: RPointerEvent, id: string) => { if (tool === "erase") { e.stopPropagation(); setStrokes((s) => s.filter((st) => st.id !== id)) } }
  const eraseLabel = (e: RPointerEvent, id: string) => { if (tool === "erase") { e.stopPropagation(); setLabels((l) => l.filter((lb) => lb.id !== id)) } }

  const cursor = tool === "select" ? "default" : tool === "erase" ? "cell" : "crosshair"

  return (
    <div className="wb-root">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Manrope:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
      <style>{CSS}</style>

      <div className="wb-layer">
        {/* frame: session title + center tabs (Whiteboard active) */}
        <header className="wb-panel flex shrink-0 items-center gap-3 border-x-0 border-t-0 px-4 py-2">
          <h1 className="wb-h text-xl">The Fall of Arctus</h1>
          <div className="ml-2 flex gap-1">
            {["Whiteboard", "Character", "Rules"].map((t) => (
              <span key={t} className={`wb-tab ${t === "Whiteboard" ? "wb-tab-on" : ""}`}>{t}</span>
            ))}
          </div>
          <span className="wb-data ml-auto text-[11px]" style={{ color: "var(--dim)" }}>theater-of-mind · shared · fully collaborative</span>
        </header>

        {/* toolbar */}
        <div className="wb-panel flex shrink-0 items-center gap-2 border-x-0 px-3 py-1.5">
          <span className="wb-eyebrow mr-1">The Chapel</span>
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.name}
                className={`wb-tool ${tool === t.id ? "wb-tool-on" : ""} ${t.id === "token-npc" ? "wb-npc" : ""}`}>
                <span className="wb-tool-g">{t.glyph}</span>
                <span className="wb-tool-n">{t.name}</span>
              </button>
            ))}
          </div>
          <div className="ml-2 h-5 w-px" style={{ background: "var(--line)" }} />
          <button onClick={() => { setStrokes([]); setLabels([]) }} className="wb-tool" title="Clear ink"><span className="wb-tool-g">✕</span><span className="wb-tool-n">Clear ink</span></button>
          {/* presence — collaborators at the board */}
          <div className="ml-auto flex items-center gap-2">
            <span className="wb-eyebrow">At the board</span>
            {["V", "A", "M"].map((c, i) => (
              <span key={c} className="wb-data grid size-6 place-items-center rounded-full text-[10px] font-bold"
                style={{ background: "var(--raise)", border: `1px solid ${["#cdbd94", "var(--accent)", "#9a86c4"][i]}`, color: ["#cdbd94", "var(--accent)", "#9a86c4"][i] }}>{c}</span>
            ))}
          </div>
        </div>

        {/* the canvas */}
        <div className="wb-canvas relative min-h-0 flex-1">
          <svg
            ref={svgRef} className="absolute inset-0 h-full w-full" style={{ cursor, touchAction: "none" }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
          >
            <defs>
              <pattern id="wb-dots" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--ink)" opacity=".14" />
              </pattern>
            </defs>
            {/* faint ley dot-grid */}
            <rect width="100%" height="100%" fill="url(#wb-dots)" />

            {/* committed ink */}
            {strokes.map((s) => (
              <g key={s.id}>
                <path d={s.d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".8" style={{ pointerEvents: "none" }} />
                <path d={s.d} fill="none" stroke="transparent" strokeWidth="14" style={{ pointerEvents: tool === "erase" ? "stroke" : "none" }} onPointerDown={(e) => eraseStroke(e, s.id)} />
              </g>
            ))}
            {/* in-progress draft */}
            {draft && <path d={draft} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />}

            {/* text labels */}
            {labels.map((l) => (
              <text key={l.id} x={l.x} y={l.y} fontSize="13" fontStyle="italic" fill="var(--dim)" fontFamily="Manrope"
                style={{ cursor: tool === "erase" ? "cell" : "default", userSelect: "none" }} onPointerDown={(e) => eraseLabel(e, l.id)}>{l.text}</text>
            ))}

            {/* tokens */}
            {tokens.map((tk) => {
              const ring = tk.kind === "pc" ? "var(--accent)" : "#b56d60"
              return (
                <g key={tk.id} transform={`translate(${tk.x} ${tk.y})`} onPointerDown={(e) => tokenDown(e, tk.id)}
                  style={{ cursor: tool === "select" ? "grab" : tool === "erase" ? "cell" : "inherit" }}>
                  <circle r="17" fill="var(--panel)" stroke={ring} strokeWidth="1.5" />
                  <circle r="17" fill="none" stroke={ring} strokeWidth="1.5" opacity=".25" transform="scale(1.28)" />
                  <text y="4" textAnchor="middle" fontSize="12" fontFamily="'JetBrains Mono',monospace" fontWeight="700" fill="var(--ink)" style={{ userSelect: "none" }}>
                    {tk.label.slice(0, 3)}
                  </text>
                  <text y="31" textAnchor="middle" fontSize="10" fontFamily="'JetBrains Mono',monospace" fill={ring} style={{ userSelect: "none" }}>{tk.label}</text>
                </g>
              )
            })}

            {/* remote collaborators' cursors — the "fully collaborative" cue */}
            {CURSORS.map((c) => (
              <g key={c.name} transform={`translate(${c.x} ${c.y})`} style={{ pointerEvents: "none" }}>
                <path d="M0 0 L0 15 L4 11 L7 17 L9 16 L6 10 L11 10 Z" fill={c.tint} stroke="#000" strokeWidth=".5" />
                <rect x="12" y="10" width={c.name.length * 6.2 + 8} height="15" rx="2" fill={c.tint} />
                <text x="16" y="21" fontSize="10" fontFamily="'JetBrains Mono',monospace" fill="#0a0a0c">{c.name}</text>
              </g>
            ))}
          </svg>

          {/* hint */}
          <div className="wb-data pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px]"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--dim)" }}>
            {toolHint(tool)}
          </div>
        </div>
      </div>
    </div>
  )
}

function toolHint(t: Tool): string {
  switch (t) {
    case "select": return "drag any token to reposition — anyone at the table can"
    case "pen": return "click-drag to sketch freehand ink"
    case "line": return "click-drag to draw a straight ward-line"
    case "text": return "click to drop a label"
    case "token-pc": return "click to place a PC token (verdigris ring)"
    case "token-npc": return "click to place an NPC token (oxblood ring)"
    case "erase": return "click ink, a label, or a token to remove it"
  }
}

const CSS = `
.wb-root{min-height:100vh;height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;
  --bg:#08080c;--panel:#0e0d13;--raise:#16141d;--ink:#d7d2e0;--dim:#797488;--accent:#6fae97;
  --line:#1e2b27;--glow:rgba(111,174,151,.12);
  color:var(--ink);font-family:'Manrope',ui-sans-serif,system-ui,sans-serif;background:#08080c;}
.wb-layer{display:flex;flex-direction:column;height:100%}
.wb-panel{background:var(--panel);border:1px solid var(--line)}
.wb-h{font-family:'Cinzel',Georgia,serif;font-weight:600;letter-spacing:.01em;margin:0}
.wb-eyebrow{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.22em;font-size:9px;color:var(--dim)}
.wb-data{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.wb-tab{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;font-size:11px;
  padding:3px 10px;border-radius:3px;color:var(--dim);border:1px solid transparent}
.wb-tab-on{color:#0a0a0c;background:var(--accent);border-color:var(--accent)}
/* the tool palette */
.wb-tool{display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:3px;cursor:pointer;
  background:var(--raise);border:1px solid var(--line);color:var(--ink)}
.wb-tool:hover{border-color:var(--accent)}
.wb-tool-g{font-size:14px;line-height:1;width:15px;text-align:center}
.wb-tool-n{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.06em;font-size:10px}
.wb-tool-on{background:var(--accent);border-color:var(--accent);color:#0a0a0c}
.wb-npc.wb-tool-on{background:#b56d60;border-color:#b56d60}
.wb-canvas{background:
  radial-gradient(120% 90% at 50% -10%, var(--glow), transparent 45%),
  radial-gradient(140% 120% at 50% 130%, rgba(0,0,0,.5), transparent 55%),
  #08080c;
  box-shadow:inset 0 0 200px 30px rgba(0,0,0,.55)}
`
