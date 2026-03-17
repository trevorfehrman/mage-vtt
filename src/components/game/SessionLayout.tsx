import type { ReactNode } from "react"
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
import { usePanelShortcuts } from "#/hooks/use-panel-shortcuts"

interface SessionLayoutProps {
  sessionName: string
  inviteCode: string
  players: ReactNode
  diceRoller: ReactNode
  rollHistory: ReactNode
  chat: ReactNode
  bottomBar?: ReactNode
}

export function SessionLayout({
  sessionName,
  inviteCode,
  players,
  diceRoller,
  rollHistory,
  chat,
  bottomBar,
}: SessionLayoutProps) {
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()

  usePanelShortcuts(leftPanelRef, rightPanelRef)

  const mainLayout = useDefaultLayout({
    id: "session-layout",
    storage: localStorage,
  })

  const rightLayout = useDefaultLayout({
    id: "session-right",
    storage: localStorage,
  })

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
                  onClick={() => togglePanel(leftPanelRef)}
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle players [ </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <h1 className="text-lg font-semibold">{sessionName}</h1>
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
                  onClick={() => togglePanel(rightPanelRef)}
                >
                  <PanelRightClose className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle dice & chat ]</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* Main content area */}
      <ResizablePanelGroup orientation="vertical" className="flex-1">
        <ResizablePanel defaultSize={100} minSize={50}>
          <ResizablePanelGroup
            orientation="horizontal"
            defaultLayout={mainLayout.defaultLayout}
            onLayoutChanged={mainLayout.onLayoutChanged}
          >
            {/* Left panel — Players */}
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
                {players}
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Center panel — Map / Character Sheet tabs */}
            <ResizablePanel id="center" defaultSize={55} minSize={30}>
              <Tabs defaultValue="map" className="flex h-full flex-col">
                <div className="shrink-0 border-b border-[var(--line)] px-4 pt-2">
                  <TabsList>
                    <TabsTrigger value="map">Map</TabsTrigger>
                    <TabsTrigger value="sheet">Character Sheet</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="map" className="flex-1 overflow-y-auto p-4">
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <p className="text-sm">Map canvas — coming soon</p>
                  </div>
                </TabsContent>
                <TabsContent value="sheet" className="flex-1 overflow-y-auto p-4">
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <p className="text-sm">Character sheet — coming soon</p>
                  </div>
                </TabsContent>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle />

            {/* Right panel — Dice + Chat */}
            <ResizablePanel
              id="right"
              panelRef={rightPanelRef}
              defaultSize={30}
              minSize={15}
              collapsedSize={0}
              collapsible
              className="session-panel rounded-none border-t-0 border-b-0 border-r-0"
            >
              <ResizablePanelGroup
                orientation="vertical"
                defaultLayout={rightLayout.defaultLayout}
                onLayoutChanged={rightLayout.onLayoutChanged}
              >
                {/* Dice roller + Roll history */}
                <ResizablePanel id="dice" defaultSize={35} minSize={15}>
                  <div className="flex h-full flex-col overflow-y-auto p-3">
                    <div className="grid gap-4">
                      {diceRoller}
                      {rollHistory}
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle />

                {/* Chat */}
                <ResizablePanel id="chat" defaultSize={65} minSize={20}>
                  <div className="h-full overflow-hidden">
                    {chat}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {/* Bottom bar — future video */}
        {bottomBar && (
          <>
            <ResizableHandle />
            <ResizablePanel
              defaultSize={0}
              minSize={0}
              collapsedSize={0}
              collapsible
            >
              {bottomBar}
            </ResizablePanel>
          </>
        )}
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
