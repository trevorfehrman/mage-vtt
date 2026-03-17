import { createFileRoute, redirect } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useDicePool } from "#/hooks/use-dice-pool"
import { SessionLayout } from "#/components/game/SessionLayout"
import { PlayerList } from "#/components/game/PlayerList"
import { DiceRoller } from "#/components/game/DiceRoller"
import { RollHistory } from "#/components/game/RollHistory"
import { ChatPanel } from "#/components/game/ChatPanel"
import type { Id } from "../../../convex/_generated/dataModel"

export const Route = createFileRoute("/sessions/$sessionId")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
  component: SessionPage,
})

function SessionPage() {
  const { sessionId } = Route.useParams()
  const session = useQuery(api.sessions.get, {
    sessionId: sessionId as Id<"sessions">,
  })
  const user = useQuery(api.auth.getCurrentUser)
  const pool = useDicePool(sessionId as Id<"sessions">)

  if (!session || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  return (
    <SessionLayout
      sessionName={session.name}
      inviteCode={session.inviteCode}
      players={<PlayerList members={session.members} />}
      diceRoller={<DiceRoller pool={pool} />}
      rollHistory={<RollHistory sessionId={sessionId as Id<"sessions">} />}
      chat={
        <ChatPanel
          sessionId={sessionId as Id<"sessions">}
          members={session.members}
          currentUserId={user._id}
        />
      }
    />
  )
}
