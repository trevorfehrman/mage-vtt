import { useState, useCallback, type ReactNode } from "react"
import {
  type PanelImperativeHandle,
  usePanelRef,
  useDefaultLayout,
} from "react-resizable-panels"
import { PanelRightClose } from "lucide-react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "#/components/ui/resizable"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import { Button } from "#/components/ui/button"
import { useSessionShortcuts } from "#/hooks/use-session-shortcuts"

/**
 * The settled 4-section grid (docs/ui-direction.md), rendered in reduced form
 * for the covert-tier phase (PRD #11, issue #13): center = Character; right
 * rail = Activity Log + dice pool + chat. The left rail (video) and bottom
 * band (FFX-style initiative tracker) keep their slots in the design but are
 * not rendered until their tracks land — no placeholder surfaces.
 */
interface SessionLayoutProps {
  sessionName: string
  inviteCode: string
  presence?: ReactNode
  characterSheet?: ReactNode
  activityLog: ReactNode
  dicePoolBuilder: ReactNode
  chatInput: ReactNode
  onClearPool: () => void
}

export function SessionLayout({
  sessionName,
  inviteCode,
  presence,
  characterSheet,
  activityLog,
  dicePoolBuilder,
  chatInput,
  onClearPool,
}: SessionLayoutProps) {
  const rightPanelRef = usePanelRef()
  const [isAnimating, setIsAnimating] = useState(false)

  const animatedToggleRight = useCallback(() => {
    setIsAnimating(true)
    togglePanel(rightPanelRef)
    setTimeout(() => setIsAnimating(false), 250)
  }, [rightPanelRef])

  useSessionShortcuts({
    onClearPool,
    onToggleRight: animatedToggleRight,
  })

  const mainLayout = useDefaultLayout({
    id: "session-layout-v3",
    storage: localStorage,
  })

  const animClass = isAnimating
    ? "[&>[data-slot=resizable-panel]]:transition-[flex-basis,flex-grow] [&>[data-slot=resizable-panel]]:duration-200 [&>[data-slot=resizable-panel]]:ease-out"
    : ""

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="mv-panel flex items-center justify-between border-x-0 border-t-0 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="mv-h text-[15px] leading-none">{sessionName}</h1>
          {presence}
        </div>
        <div className="flex items-center gap-3">
          <span className="mv-data text-[11px]" style={{ color: "var(--dim)" }}>
            {inviteCode}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={animatedToggleRight}
                  className="cursor-pointer"
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle rail ]</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content — Character center · Activity/pool/chat right rail */}
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={mainLayout.defaultLayout}
        onLayoutChanged={mainLayout.onLayoutChanged}
        className={`flex-1 ${animClass}`}
      >
        <ResizablePanel id="center" defaultSize={70} minSize={40}>
          <div className="h-full overflow-y-auto p-4">
            {characterSheet ?? (
              <div className="flex h-full items-center justify-center" style={{ color: "var(--dim)" }}>
                <p className="text-sm">No character in this session yet.</p>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel
          id="right"
          panelRef={rightPanelRef}
          defaultSize={30}
          minSize={20}
          collapsedSize={0}
          collapsible
          className="mv-panel border-y-0 border-r-0"
        >
          <div className="flex h-full flex-col">
            {/* Activity log — fills available space */}
            <div className="flex-1 overflow-hidden">{activityLog}</div>
            {/* Dice pool — foot of the rail, above chat */}
            <div className="shrink-0">{dicePoolBuilder}</div>
            {/* Chat input — pinned to bottom */}
            <div className="shrink-0">{chatInput}</div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function togglePanel(ref: React.RefObject<PanelImperativeHandle | null>) {
  const panel = ref.current
  if (!panel) return
  if (panel.isCollapsed()) {
    panel.expand()
  } else {
    panel.collapse()
  }
}
