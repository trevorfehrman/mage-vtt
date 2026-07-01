import { useState, useCallback, type ReactNode } from "react"
import {
  type PanelImperativeHandle,
  usePanelRef,
  useDefaultLayout,
} from "react-resizable-panels"
import { PanelLeftClose, PanelRightClose } from "lucide-react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "#/components/ui/resizable"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "#/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip"
import { Button } from "#/components/ui/button"
import { useSessionShortcuts } from "#/hooks/use-session-shortcuts"

interface SessionLayoutProps {
  sessionName: string
  inviteCode: string
  presence?: ReactNode
  videoStrip: ReactNode
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
  videoStrip,
  characterSheet,
  activityLog,
  dicePoolBuilder,
  chatInput,
  onClearPool,
}: SessionLayoutProps) {
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const [activeTab, setActiveTab] = useState("map")
  const [isAnimating, setIsAnimating] = useState(false)

  const animatedToggle = useCallback(
    (ref: React.RefObject<PanelImperativeHandle | null>) => {
      setIsAnimating(true)
      togglePanel(ref)
      setTimeout(() => setIsAnimating(false), 250)
    },
    [],
  )

  // Wrap the shortcuts to also trigger animation
  const animatedToggleLeft = useCallback(
    () => animatedToggle(leftPanelRef),
    [animatedToggle, leftPanelRef],
  )
  const animatedToggleRight = useCallback(
    () => animatedToggle(rightPanelRef),
    [animatedToggle, rightPanelRef],
  )

  useSessionShortcuts({
    leftPanelRef,
    rightPanelRef,
    onTabChange: setActiveTab,
    onClearPool,
    onToggleLeft: animatedToggleLeft,
    onToggleRight: animatedToggleRight,
  })

  const mainLayout = useDefaultLayout({
    id: "session-layout-v2",
    storage: localStorage,
  })

  const animClass = isAnimating
    ? "[&>[data-slot=resizable-panel]]:transition-[flex-basis,flex-grow] [&>[data-slot=resizable-panel]]:duration-200 [&>[data-slot=resizable-panel]]:ease-out"
    : ""

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="session-panel flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-2">
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => animatedToggle(leftPanelRef)}
                  className="cursor-pointer"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle video [ </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <h1 className="text-lg font-semibold">{sessionName}</h1>
          {presence}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs font-mono">
            {inviteCode}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => animatedToggle(rightPanelRef)}
                  className="cursor-pointer"
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle activity ]</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content area */}
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={mainLayout.defaultLayout}
        onLayoutChanged={mainLayout.onLayoutChanged}
        className={`flex-1 ${animClass}`}
      >
        {/* Left panel — Video strip */}
        <ResizablePanel
          id="left"
          panelRef={leftPanelRef}
          defaultSize={15}
          minSize={10}
          collapsedSize={0}
          collapsible
          className="session-panel rounded-none border-t-0 border-b-0 border-l-0"
        >
          <div className="h-full overflow-y-auto p-3">
            {videoStrip}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Center panel — Tabs: Map / Character Sheet */}
        <ResizablePanel id="center" defaultSize={55} minSize={30}>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col"
          >
            <div className="shrink-0 border-b border-[var(--line)] px-4 pt-2">
              <TabsList variant="line">
                <TabsTrigger value="map" className="cursor-pointer">
                  Map
                </TabsTrigger>
                <TabsTrigger value="sheet" className="cursor-pointer">
                  Character Sheet
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="map" className="flex-1 overflow-y-auto p-4">
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm">Map canvas — coming soon</p>
              </div>
            </TabsContent>
            <TabsContent value="sheet" className="flex-1 overflow-y-auto p-4">
              {characterSheet ?? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <p className="text-sm">Character sheet — coming soon</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle />

        {/* Right panel — Activity Log + Dice Pool + Chat Input */}
        <ResizablePanel
          id="right"
          panelRef={rightPanelRef}
          defaultSize={30}
          minSize={15}
          collapsedSize={0}
          collapsible
          className="session-panel rounded-none border-t-0 border-b-0 border-r-0"
        >
          <div className="flex h-full flex-col">
            {/* Activity log — fills available space */}
            <div className="flex-1 overflow-hidden">
              {activityLog}
            </div>
            {/* Dice pool builder — collapsible, above chat */}
            <div className="shrink-0">
              {dicePoolBuilder}
            </div>
            {/* Chat input — pinned to bottom */}
            <div className="shrink-0">
              {chatInput}
            </div>
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
