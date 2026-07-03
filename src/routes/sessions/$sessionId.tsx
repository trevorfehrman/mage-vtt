import { useEffect, useRef } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import usePresence from "@convex-dev/presence/react"
import { api } from "../../../convex/_generated/api"
import { useDicePool } from "#/hooks/use-dice-pool"
import { SessionLayout } from "#/components/game/SessionLayout"
import { VideoPlaceholder } from "#/components/game/VideoPlaceholder"
import { ActivityLog } from "#/components/game/ActivityLog"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { ChatInput } from "#/components/game/ChatInput"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { ImprovisedCastForm } from "#/components/game/ImprovisedCastForm"
import { PresenceIndicator } from "#/components/game/PresenceIndicator"
import { Schema } from "effect"
import { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import type { Id } from "../../../convex/_generated/dataModel"

// Doc → Sheet at the client boundary, same translation the server adapter does:
// the UI speaks the checked domain artifact, never the raw Convex document.
const decodeSheet = Schema.decodeUnknownSync(CharacterSheetData)

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

  // Presence — heartbeat for this session room
  const presenceState = usePresence(
    api.presence,
    sessionId,
    user?.name ?? user?._id ?? "",
  )

  const character = useQuery(api.characters.getForSession, {
    sessionId: sessionId as Id<"sessions">,
  })
  const seedCharacter = useMutation(api.characters.seed)
  const seededRef = useRef(false)

  // Lazy seed: if no character exists, seed Arctus once
  useEffect(() => {
    if (character === null && !seededRef.current) {
      seededRef.current = true
      seedCharacter({
        sessionId: sessionId as Id<"sessions">,
        data: { ...arctusData },
      }).catch(() => {
        seededRef.current = false
      })
    }
  }, [character, sessionId, seedCharacter])

  if (!session || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  // Build character sheet content
  let characterSheet: React.ReactNode = undefined
  if (character === undefined) {
    characterSheet = (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading character...</p>
      </div>
    )
  } else if (character === null) {
    characterSheet = (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Creating character...</p>
      </div>
    )
  } else {
    const { _id, _creationTime, ...fields } = character
    const sheet = decodeSheet({ id: _id, ...fields })

    characterSheet = (
      <div className="grid gap-6">
        <CharacterSheet character={sheet} pool={pool} />
        <ImprovisedCastForm
          sessionId={sessionId as Id<"sessions">}
          characterId={character._id}
          arcana={character.arcana}
        />
      </div>
    )
  }

  return (
    <SessionLayout
      sessionName={session.name}
      inviteCode={session.inviteCode}
      presence={
        <PresenceIndicator
          presenceState={presenceState}
          members={session.members}
        />
      }
      videoStrip={<VideoPlaceholder />}
      characterSheet={characterSheet}
      activityLog={
        <ActivityLog
          sessionId={sessionId as Id<"sessions">}
          isRolling={pool.state === "rolling"}
        />
      }
      dicePoolBuilder={<DicePoolBuilder pool={pool} />}
      chatInput={
        <ChatInput
          sessionId={sessionId as Id<"sessions">}
          members={session.members}
          currentUserId={user._id}
        />
      }
      onClearPool={pool.reset}
    />
  )
}
