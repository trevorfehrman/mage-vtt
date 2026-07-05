import { useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import usePresence from "@convex-dev/presence/react"
import { api } from "../../../convex/_generated/api"
import { useCast } from "#/hooks/use-cast"
import { useDicePool } from "#/hooks/use-dice-pool"
import { SessionLayout } from "#/components/game/SessionLayout"
import { ActivityLog } from "#/components/game/ActivityLog"
import { CastPanel } from "#/components/game/CastPanel"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { ChatInput } from "#/components/game/ChatInput"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { SheetlessCastForm } from "#/components/game/SheetlessCastForm"
import { Roster } from "#/components/game/Roster"
import { HandEditForm } from "#/components/game/HandEditForm"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
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
  const roster = useQuery(api.characters.listForSession, {
    sessionId: sessionId as Id<"sessions">,
  })
  // The roster selection (issue #17). null = "my own character", the default —
  // it survives the own-character id arriving late and never dangles.
  const [selectedId, setSelectedId] = useState<Id<"characters"> | null>(null)
  const pool = useDicePool(sessionId as Id<"sessions">, character?._id)
  const rawCast = useCast(sessionId as Id<"sessions">, character?._id)
  const seedCharacter = useMutation(api.characters.seed)
  const seededRef = useRef(false)

  // One readout at a time: arming a cast clears the plain pool, and toggling
  // a plain trait stands a declared cast down — the foot of the rail always
  // shows the thing you touched last.
  const cast = {
    ...rawCast,
    armRote: (rote: Parameters<typeof rawCast.armRote>[0]) => {
      pool.reset()
      rawCast.armRote(rote)
    },
    armImprovised: (...args: Parameters<typeof rawCast.armImprovised>) => {
      pool.reset()
      rawCast.armImprovised(...args)
    },
  }
  const poolForSheet = {
    ...pool,
    toggleComponent: (component: { type: string; name: string; dots: number }) => {
      if (rawCast.state === "declaring") rawCast.cancel()
      pool.toggleComponent(component)
    },
  }

  // The caster's own decoded sheet — the cast panel's readout needs the real
  // ratings whichever roster sheet is being viewed.
  const mySheet = useMemo(() => {
    if (!character) return null
    const { _id, _creationTime, ...fields } = character
    return decodeSheet({ id: _id, ...fields })
  }, [character])

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

  // The affordances gated on this render only for the Storyteller (a Dev who
  // is also ST sees them too); the server refuses everyone else regardless
  // (issues #15, #19).
  const isStoryteller = session.members.some(
    (m) => m.userId === user._id && m.role === "storyteller",
  )

  // The viewed sheet is the roster selection, defaulting to your own
  // character (issue #17). A selection that no longer resolves — or a roster
  // still loading — falls back to your own sheet rather than a blank panel.
  const viewed =
    (selectedId != null
      ? roster?.find((c) => c._id === selectedId)
      : undefined) ?? character

  // Build character sheet content
  let sheetContent: React.ReactNode = undefined
  if (viewed === undefined) {
    sheetContent = (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Loading character...</p>
      </div>
    )
  } else if (viewed === null) {
    sheetContent = (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">Creating character...</p>
      </div>
    )
  } else {
    // Only your own sheet is a controller: cabal-mates' sheets render
    // read-only — no pool toggles, no cast forms (issue #17).
    const isMine = viewed._id === character?._id
    const { _id, _creationTime, ...fields } = viewed
    const sheet = decodeSheet({ id: _id, ...fields })

    sheetContent = sheet ? (
      <div className="grid gap-6">
        <CharacterSheet
          character={sheet}
          pool={isMine ? poolForSheet : undefined}
          cast={isMine ? cast : undefined}
        />
        {/* The hand-edit panel (issue #19): ST-only, on any sheet — the one
            edit affordance in the app; players never see edit controls. */}
        {isStoryteller && (
          <HandEditForm
            key={`${sheet.id}:${sheet.manaCurrent}:${sheet.willpowerCurrent}:${sheet.healthTrack.join(",")}`}
            sessionId={sessionId as Id<"sessions">}
            characterId={viewed._id}
            character={sheet}
          />
        )}
      </div>
    ) : (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p className="text-sm">This character sheet couldn&apos;t be read.</p>
      </div>
    )
  }

  // The roster strip — your own PC first, then cabal-mates by name.
  const rosterEntries = (roster ?? [])
    .map((c) => ({
      id: c._id,
      name: c.name,
      isMine: c._id === character?._id,
    }))
    .sort(
      (a, b) => Number(b.isMine) - Number(a.isMine) || a.name.localeCompare(b.name),
    )

  const characterSheet = (
    <>
      {rosterEntries.length > 0 && (
        <Roster
          entries={rosterEntries}
          selectedId={viewed?._id}
          onSelect={(id) =>
            // Picking your own character returns to the default (null), so
            // the selection keeps tracking your sheet across re-loads.
            setSelectedId(id === character?._id ? null : id)
          }
        />
      )}
      {sheetContent}
    </>
  )

  return (
    <SessionLayout
      sessionName={session.name}
      inviteCode={session.inviteCode}
      videoRail={<VideoRailPlaceholder />}
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
          isRolling={pool.state === "rolling" || rawCast.state === "casting"}
        />
      }
      dicePoolBuilder={
        // The foot of the rail is the readout: the pre-roll factor panel
        // while a cast is armed, the plain dice pool otherwise (issue #20).
        rawCast.state !== "idle" && mySheet ? (
          <CastPanel cast={cast} character={mySheet} />
        ) : (
          <DicePoolBuilder pool={pool} />
        )
      }
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
      onClearPool={() => {
        pool.reset()
        if (rawCast.state === "declaring") rawCast.cancel()
      }}
    />
  )
}
