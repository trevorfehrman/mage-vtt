import { useEffect, useRef } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import usePresence from "@convex-dev/presence/react"
import { api } from "../../../convex/_generated/api"
import { useDicePool } from "#/hooks/use-dice-pool"
import { SessionLayout } from "#/components/game/SessionLayout"
import { ActivityLog } from "#/components/game/ActivityLog"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { ChatInput } from "#/components/game/ChatInput"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { ImprovisedCastForm } from "#/components/game/ImprovisedCastForm"
import { SheetlessCastForm } from "#/components/game/SheetlessCastForm"
import { PresenceIndicator } from "#/components/game/PresenceIndicator"
import { Schema } from "effect"
import { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import type { Id } from "../../../convex/_generated/dataModel"

// Doc → Sheet at the client boundary, same translation the server adapter does:
// the UI speaks the checked domain artifact, never the raw Convex document.
// Failure degrades to null (rendered as a message) — a corrupt document must
// not take the whole session page down with it.
const decodeSheet = (input: unknown): CharacterSheetData | null => {
  try {
    return Schema.decodeUnknownSync(CharacterSheetData)(input)
  } catch {
    return null
  }
}

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

  // Presence — heartbeat for this session room
  const presenceState = usePresence(
    api.presence,
    sessionId,
    user?.name ?? user?._id ?? "",
  )

  const character = useQuery(api.characters.getForSession, {
    sessionId: sessionId as Id<"sessions">,
  })
  const pool = useDicePool(sessionId as Id<"sessions">, character?._id)
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

    characterSheet = sheet ? (
      <div className="grid gap-6">
        <CharacterSheet character={sheet} pool={pool} />
        <ImprovisedCastForm
          sessionId={sessionId as Id<"sessions">}
          characterId={character._id}
          arcana={character.arcana}
        />
      </div>
    ) : (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">This character sheet couldn&apos;t be read.</p>
      </div>
    )
  }

  // The affordance renders only for the Storyteller (a Dev who is also ST
  // sees it too); the server refuses everyone else regardless (issue #15).
  const isStoryteller = session.members.some(
    (m) => m.userId === user._id && m.role === "storyteller",
  )

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
      characterSheet={characterSheet}
      activityLog={
        <ActivityLog
          sessionId={sessionId as Id<"sessions">}
          isRolling={pool.state === "rolling"}
        />
      }
      dicePoolBuilder={<DicePoolBuilder pool={pool} />}
      storytellerTools={
        isStoryteller ? (
          <SheetlessCastForm sessionId={sessionId as Id<"sessions">} />
        ) : undefined
      }
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
