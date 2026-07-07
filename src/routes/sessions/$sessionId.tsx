import { useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import usePresence from "@convex-dev/presence/react"
import { api } from "../../../convex/_generated/api"
import type { PoolComponentInput } from "#/domain/dice"
import { useCast } from "#/hooks/use-cast"
import { useDicePool } from "#/hooks/use-dice-pool"
import { useSession } from "#/hooks/use-session"
import { SessionLayout } from "#/components/game/SessionLayout"
import { ActivityLog } from "#/components/game/ActivityLog"
import { CastPanel } from "#/components/game/CastPanel"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { ChatInput } from "#/components/game/ChatInput"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { SheetlessCastForm } from "#/components/game/SheetlessCastForm"
import { Roster } from "#/components/game/Roster"
import { HandEditForm } from "#/components/game/HandEditForm"
import { SceneStrip } from "#/components/game/SceneStrip"
import { VideoRailPlaceholder } from "#/components/game/VideoRailPlaceholder"
import { PresenceIndicator } from "#/components/game/PresenceIndicator"
import { SecondSeatControl } from "#/components/game/SecondSeatControl"
import { seamErrorMessage } from "#/lib/seam-errors"
import {
  decodeSheet,
  type CharacterSheet as CharacterSheetData,
} from "#/domain/character"
import { arctusData } from "#/domain/fixtures/arctus"
import type { Id } from "../../../convex/_generated/dataModel"

// Remount-key fragment for the hand-edit form: one token per box, `*` marking
// a Resistant dot, so any remote track change resets the form's draft.
const trackKey = (track: CharacterSheetData["healthTrack"]): string =>
  track.map((b) => `${b.severity}${b.resistant ? "*" : ""}`).join(",")

export const Route = createFileRoute("/sessions/$sessionId")({
  params: {
    // The one boundary assertion (route param → Convex Id brand): a Convex Id
    // has no client-side validator — the server is the validator, and every
    // query below refuses a bogus id with a typed error. Typing it here means
    // the page body carries zero casts instead of one per query call.
    parse: (raw) => ({ sessionId: raw.sessionId as Id<"sessions"> }),
    stringify: (params) => ({ sessionId: params.sessionId }),
  },
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
  component: SessionPage,
  // The membership gate (issue #37) refuses non-members with a typed error
  // instead of thinned results; render the refusal as table language rather
  // than an unhandled crash.
  errorComponent: ({ error }) => (
    <div className="grid min-h-screen place-items-center">
      <p className="mv-data text-[13px]" style={{ color: "var(--bad)" }}>
        {seamErrorMessage(error, {
          overrides: { NotAMember: "You're not a member of this session — join with an invite code." },
        })}
      </p>
    </div>
  ),
})

function SessionPage() {
  const { sessionId } = Route.useParams()
  // Decoded at the seam (issue #49): members carry the SessionRole literal
  // union, not raw strings, and every consumer below shares the one mirror.
  const session = useSession(sessionId)
  const user = useQuery(api.auth.getCurrentUser)

  // Presence — heartbeat for this session room. Untouched by the Second Seat:
  // a seat never fakes a heartbeat (ADR-0013).
  const presenceState = usePresence(
    api.presence,
    sessionId,
    user?.name ?? user?._id ?? "",
  )

  // The Second Seat (ADR-0013): client state only — a refresh stands you back
  // up in your own seat. Validated against the live roster so a stale id
  // degrades to your own seat instead of a server refusal.
  const [seatId, setSeatId] = useState<Id<"sessionMembers"> | null>(null)
  const seatMember = seatId
    ? session?.members.find((m) => m._id === seatId)
    : undefined
  const seatArg = seatMember ? { seat: seatMember._id } : {}
  const announceSeat = useMutation(api.seat.announce)
  const takeSeat = (id: Id<"sessionMembers"> | null) => {
    setSeatId(id)
    if (id) {
      // Every sit-down is reported; the server announces only widening seats
      // (ADR-0013) and stays silent for narrower ones. If the announcement
      // can't be recorded, stand back up — no unlogged widened reading.
      announceSeat({
        sessionId,
        target: id,
      }).catch(() => setSeatId(null))
    }
  }

  const character = useQuery(api.characters.getForSession, {
    sessionId,
    ...seatArg,
  })
  const roster = useQuery(api.characters.listForSession, {
    sessionId,
  })
  // The roster selection (issue #17). null = "my own character", the default —
  // it survives the own-character id arriving late and never dangles.
  const [selectedId, setSelectedId] = useState<Id<"characters"> | null>(null)

  // The viewed sheet is the roster selection, defaulting to your own
  // character (issue #17). A selection that no longer resolves — or a roster
  // still loading — falls back to your own sheet rather than a blank panel.
  const viewed =
    (selectedId != null
      ? roster?.find((c) => c._id === selectedId)
      : undefined) ?? character

  // The pool anchors to the viewed sheet, not your own: a roll built from a
  // sheet lands as that sheet's owner, Override-marked when the roller isn't
  // them (ADR-0006) — the "help my players" flow. Casting stays bound to
  // your own (or seat's) character.
  const pool = useDicePool(sessionId, viewed?._id)
  const rawCast = useCast(sessionId, character?._id)

  // Switching sheets clears the pool: its components carry the previous
  // sheet's dots while the roll would anchor to the new one — a stale mix
  // must never travel. Ref-guarded so it fires only on an actual change.
  const pooledSheetRef = useRef(viewed?._id)
  useEffect(() => {
    if (pooledSheetRef.current !== viewed?._id) {
      pooledSheetRef.current = viewed?._id
      pool.reset()
    }
  })
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
    toggleComponent: (component: PoolComponentInput) => {
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

  // Lazy seed: if no character exists, seed Arctus once. Never while seated —
  // a characterless seat must read as empty, not conjure a sheet for the
  // Dev's own membership.
  useEffect(() => {
    if (character === null && seatId === null && !seededRef.current) {
      seededRef.current = true
      seedCharacter({
        sessionId,
        data: { ...arctusData },
      }).catch(() => {
        seededRef.current = false
      })
    }
  }, [character, seatId, sessionId, seedCharacter])

  if (!session || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  // All chrome derives from the effective member (ADR-0013): while seated,
  // role and identity resolve as the seat member — an ST-Dev in a player's
  // seat sees player chrome, and their own sight is lost until they stand up.
  const ownMember = session.members.find((m) => m.userId === user._id)
  const effectiveMember = seatMember ?? ownMember

  // The affordances gated on this render only for the Storyteller (a Dev who
  // is also ST sees them too); the server refuses everyone else regardless
  // (issues #15, #19).
  const isStoryteller = effectiveMember?.role === "storyteller"

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
    // Your own sheet is a full controller; an ST/Dev may also drive a
    // player's sheet with the plain pool (the "help my players" flow — the
    // server ladder decides, this gate only mirrors it). Cast controls stay
    // your own sheet's. A seated Dev's raw isDev is masked: dev sight is
    // lost while seated (ADR-0013), so only the seat's own sheet drives.
    const isMine = viewed._id === character?._id
    const mayDrivePool = isMine || isStoryteller || (user.isDev && !seatMember)
    const { _id, _creationTime, ...fields } = viewed
    const sheet = decodeSheet({ id: _id, ...fields })

    sheetContent = sheet ? (
      <div className="grid gap-6">
        <CharacterSheet
          character={sheet}
          pool={mayDrivePool ? poolForSheet : undefined}
          cast={isMine ? cast : undefined}
        />
        {/* The hand-edit panel (issue #19): ST-only, on any sheet — the one
            edit affordance in the app; players never see edit controls. */}
        {isStoryteller && (
          <HandEditForm
            key={`${sheet.id}:${sheet.manaCurrent}:${sheet.willpowerCurrent}:${trackKey(sheet.healthTrack)}`}
            sessionId={sessionId}
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
      secondSeat={
        user.isDev ? (
          <SecondSeatControl
            members={session.members}
            ownUserId={user._id}
            seatId={seatMember?._id ?? null}
            onSeat={takeSeat}
          />
        ) : undefined
      }
      sceneStrip={
        // Chrome follows the seat (ADR-0013): a seated ST-Dev in a player's
        // chair sees player chrome; the server refuses non-ST writes anyway.
        <SceneStrip
          sessionId={sessionId}
          isStoryteller={isStoryteller}
        />
      }
      characterSheet={characterSheet}
      activityLog={
        <ActivityLog
          sessionId={sessionId}
          isRolling={pool.state === "rolling" || rawCast.state === "casting"}
          // The live Cast card's role gates (issue #43): chrome follows the
          // seat (ADR-0013); the server refuses wrong actors regardless.
          isStoryteller={isStoryteller}
          viewerUserId={effectiveMember?.userId ?? user._id}
          mySheet={mySheet}
          {...seatArg}
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
          <SheetlessCastForm sessionId={sessionId} />
        ) : undefined
      }
      chatInput={
        <ChatInput
          sessionId={sessionId}
          members={session.members}
          // Chrome follows the seat (ADR-0013): whisper targets exclude the
          // seat member, not the Dev. Sends are still the Dev's own writes.
          currentUserId={effectiveMember?.userId ?? user._id}
        />
      }
      onClearPool={() => {
        pool.reset()
        if (rawCast.state === "declaring") rawCast.cancel()
      }}
    />
  )
}
