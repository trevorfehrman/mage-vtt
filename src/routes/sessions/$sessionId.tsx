import { useEffect, useMemo, useRef, useState } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import usePresence from "@convex-dev/presence/react"
import { api } from "../../../convex/_generated/api"
import type { PoolComponentInput } from "#/domain/dice"
import { pooledDice } from "#/machines/dice-pool"
import { useLiveCasts } from "#/hooks/use-live-casts"
import { othersLiveCasts } from "#/domain/activity"
import { useCast } from "#/hooks/use-cast"
import { useScene } from "#/hooks/use-scene"
import { useDicePool } from "#/hooks/use-dice-pool"
import { useSession } from "#/hooks/use-session"
import { SessionLayout } from "#/components/game/SessionLayout"
import { ActivityLog } from "#/components/game/ActivityLog"
import {
  armedPreview,
  DeclarationFelt,
} from "#/components/game/DeclarationFelt"
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder"
import { CastCard } from "#/components/game/CastCard"
import { CastMount } from "#/components/game/CastMount"
import { MessageBox } from "#/components/game/MessageBox"
import { ChronicleSwitch, WorkingSlot } from "#/components/game/WorkingSlot"
import { CharacterSheet } from "#/components/game/CharacterSheet"
import { SheetSky } from "#/components/game/TraitSky"
import { Roster } from "#/components/game/Roster"
import { HandEditForm } from "#/components/game/HandEditForm"
import { SceneStrip } from "#/components/game/SceneStrip"
import { CombatTracker } from "#/components/game/CombatTracker"
import { VideoRail } from "#/components/game/VideoRail"
import { PresenceIndicator } from "#/components/game/PresenceIndicator"
import { SecondSeatControl } from "#/components/game/SecondSeatControl"
import { seamErrorMessage } from "#/lib/seam-errors"
import { isOnStage, stripTides } from "#/domain/cast"
import type { CharacterSheet as CharacterSheetData } from "#/domain/character"
import { decodeSheetDoc } from "#/lib/sheet-doc"
import { videoSeats, whisperable } from "#/domain/video-rail"
import { useActivity } from "#/hooks/use-activity"
import { useWorkingSlot } from "#/hooks/use-working-slot"
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
      // Every sit-down is announced (ADR-0013 amendment): each seat holds
      // that member's private Whispers. If the announcement can't be
      // recorded, stand back up — no unlogged secret-seeing.
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
  // The Scene's Tides, as the strip reads them: the sealed trigger names the
  // Paradox pool a vulgar cast would start from (MAG-32).
  const { scene, pips } = useScene(sessionId)

  // One unresolved Cast per character (issue #68): the same domain leaf the
  // draft flow refuses with, read plainly so the opened vulgar door (Draft Vulgar) can gate
  // instead of round-tripping into CastAlreadyPending.
  const hasPendingCast = useQuery(
    api.casts.hasPending,
    character ? { sessionId, characterId: character._id } : "skip",
  )

  const setMagicalTool = useMutation(api.characters.setMagicalTool)

  // The live cast holds the ST's working zone (the card takeover, owner
  // ruling 2026-07-19, superseding #110's postures; the live zone, MAG-48):
  // the engaged cast holds it through the entire ladder; with the stage free, the oldest
  // waiting draft stands as the offer (FIFO through the wings) — read off the
  // table's live casts, never the Chronicle (MAG-46). No StageOccupied
  // mirror travels with the offer: it only surfaces when the stage is free,
  // so the gate could never fire (the seam still refuses, inline).
  const live = useLiveCasts(sessionId, seatMember?._id)
  const { pendingOffer, stageCast, moreWaiting } = useMemo(() => {
    if (!live) return { pendingOffer: null, stageCast: null, moreWaiting: 0 }
    // The live casts arrive oldest-first — the first draft is the oldest.
    const drafts = live.filter((c) => c.status === "draft")
    const onStage = live.find((c) => isOnStage(c.status)) ?? null
    return {
      pendingOffer: drafts[0] ?? null,
      stageCast: onStage,
      // Behind an engaged cast the whole wings queue waits; behind the offer
      // itself, everyone but the offer.
      moreWaiting: onStage ? drafts.length : Math.max(0, drafts.length - 1),
    }
  }, [live])

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
  const mySheet = useMemo(
    () => (character ? decodeSheetDoc(character) : null),
    [character],
  )

  // Every sheet at the table, decoded once: the video rail wears each
  // player's depletables on their tile (MAG-51), live on every seat.
  const rosterSheets = useMemo(
    () => (roster ?? []).flatMap((doc) => decodeSheetDoc(doc) ?? []),
    [roster],
  )

  // The watched cockpit's sheet (2026-07-19 polish, note 14): the ST's zone
  // card renders the CASTER's health track, decoded off the roster.
  const casterSheetOf = (characterId: string) => {
    const doc = roster?.find((c) => c._id === characterId)
    return doc ? decodeSheetDoc(doc) : null
  }

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

  // The working slot (MAG-53): it reads the feed the Chronicle reads (one
  // shared subscription) to count what arrives while the tray shows.
  const feed = useActivity(sessionId, seatMember?._id)
  const slot = useWorkingSlot(feed, seatMember?.userId ?? user?._id ?? "")
  const sendMessage = useMutation(api.messages.send)
  // Building a pool from the sheet or arming a cast is the tray's business:
  // either brings the tray back if the message box was showing.
  const pooledNow = pooledDice(pool.context)
  const rollIntent = useRef({ pooled: pooledNow, casting: rawCast.state !== "idle" })
  useEffect(() => {
    const casting = rawCast.state !== "idle"
    const prev = rollIntent.current
    if (pooledNow > prev.pooled || (casting && !prev.casting)) slot.setMode("dice")
    rollIntent.current = { pooled: pooledNow, casting }
  })

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

  // The caster's own live cast (the card takeover; was #110's posture): the
  // viewer's pending vulgar cast, read off the same live casts as the offer.
  // It stands in the working zone above the slot (MAG-53); the tray below
  // it rolls plain pools mid-cast, and the seam refuses any other cast
  // (MAG-50, loosening issue #109).
  const viewerUserId = effectiveMember?.userId ?? user._id
  const myPendingCast = live?.find((c) => c.casterUserId === viewerUserId) ?? null

  // The ST's zone cast: the engaged cast through the whole ladder — during
  // beats where the ST has no move they watch the cast live, never a freed
  // roller — else the oldest waiting offer.
  const stZoneCast = isStoryteller ? (stageCast ?? pendingOffer) : null

  // Every other caster's live cast, for this seat's live zone (MAG-46,
  // MAG-48): oldest first, so an in-progress cast never moves around. The
  // Storyteller's zone cast is read above, so none come here for them.
  const others = othersLiveCasts(
    { userId: viewerUserId, role: isStoryteller ? "storyteller" : "player" },
    live ?? [],
  )
  // The live zone's casts, in its order (MAG-48): the ST's, the caster's
  // own, then every other caster's. Present, they take the zone over.
  const zoneCasts = [
    ...(stZoneCast ? [stZoneCast] : []),
    ...(myPendingCast ? [myPendingCast] : []),
    ...others,
  ]

  // Build character sheet content
  // The viewer's armed spend, weighed wherever their depletables show — the
  // sheet's header and their own video tile. The ghost means "armed on the
  // felt, spent on the roll/cast": whichever posture holds the felt. Mana is
  // what the declaring felt has armed (auto + rider, issue #107). A live
  // cast holds the whole zone and its header weighs its own spend (MAG-48).
  const pendingWillpower =
    rawCast.state === "idle" ? pool.context.spendWillpower : rawCast.context.spendWillpower
  const pendingMana =
    rawCast.state !== "idle" && mySheet
      ? (armedPreview(rawCast.context, mySheet)?.manaCost ?? 0)
      : 0

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
    const sheet = decodeSheetDoc(viewed)

    sheetContent = sheet ? (
      <div className="grid gap-6">
        <CharacterSheet
          character={sheet}
          pool={mayDrivePool ? poolForSheet : undefined}
          cast={isMine ? cast : undefined}
          // your own sheet weighs your armed spend and flips your tool fact
          // (issue #107, seated on the sheet by MAG-52) — the refusal
          // speaks at the switch
          pendingMana={isMine ? pendingMana : 0}
          pendingWillpower={isMine && pendingWillpower ? 1 : 0}
          onSetMagicalTool={
            isMine
              ? (hasMagicalTool) =>
                  setMagicalTool({ sessionId, characterId: viewed._id, hasMagicalTool })
              : undefined
          }
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

  // The roster strip — your own PC first, then cabal-mates by name. Chips
  // wear the mage name (shadow name); the given name is the sheet's business.
  const rosterEntries = (roster ?? [])
    .map((c) => ({
      id: c._id,
      name: c.shadowName ?? c.name,
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

  // The table, seat by seat: the video tiles, and the people a whisper can
  // reach. A whisper is always the signed-in user's own write — the server
  // sends it as them, seated or not (ADR-0013: the seat replaces what you
  // read, not who you are) — so "you" here is the user, not the seat.
  const seats = videoSeats(session.members, rosterSheets)
  const people = whisperable(seats, user._id)

  return (
    <SessionLayout
      sessionName={session.name}
      inviteCode={session.inviteCode}
      videoRail={
        <VideoRail
          seats={seats}
          pending={
            mySheet
              ? {
                  characterId: mySheet.id,
                  mana: pendingMana,
                  willpower: pendingWillpower ? 1 : 0,
                }
              : null
          }
          // click a face to whisper them (MAG-53); the sender is the user
          whisper={{ choice: slot.whisper, self: user._id }}
        />
      }
      presence={
        <PresenceIndicator
          presenceState={presenceState}
          members={session.members}
        />
      }
      secondSeat={
        user.isDev ? (
          <SecondSeatControl
            seats={seats}
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
      // The firmament (#84): the galaxy behind everything a container isn't.
      // It answers the pool wherever the pool was built.
      sheetSky={<SheetSky pool={pool} />}
      characterSheet={characterSheet}
      activityLog={
        <ActivityLog
          sessionId={sessionId}
          isRolling={pool.state === "rolling" || rawCast.state === "casting"}
          // The pool's dice in flight; an empty pool casts one chance die.
          // Cast rolls leave it undefined and read plural.
          rollingDiceCount={
            pool.state === "rolling"
              ? Math.max(1, pooledDice(pool.context))
              : undefined
          }
          // The live Cast card's role gates (issue #43): chrome follows the
          // seat (ADR-0013); the server refuses wrong actors regardless.
          isStoryteller={isStoryteller}
          viewerUserId={effectiveMember?.userId ?? user._id}
          mySheet={mySheet}
          {...seatArg}
          headerEnd={
            <ChronicleSwitch
              mode={slot.mode}
              setMode={slot.setMode}
              unread={slot.unread}
              pooled={pooledNow}
              diceRef={slot.switchRef}
            />
          }
        />
      }
      liveCasts={
        // A live cast takes the working zone over on every seat (MAG-48),
        // in place of the tray: the Storyteller's engaged cast or oldest
        // offer, the caster's own, and every other caster's, oldest first.
        // Each watches the CASTER's track (note 14).
        zoneCasts.length > 0 &&
        zoneCasts.map((c) => (
          <CastMount key={c._id}>
            <CastCard
              cast={c}
              sessionId={sessionId}
              isStoryteller={isStoryteller}
              viewerUserId={viewerUserId}
              mySheet={mySheet}
              casterSheet={c === myPendingCast ? mySheet : casterSheetOf(c.characterId)}
              moreWaiting={c === stZoneCast ? moreWaiting : 0}
            />
          </CastMount>
        ))
      }
      workingSlot={
        <WorkingSlot
          mode={slot.mode}
          tray={
            // The console: the posture alone now (MAG-52) — the depletables
            // left the masthead for the sheet's header and each video tile.
            // Arming a cast puts the felt in its declaring posture (issue #107)
            // — same instrument, same slot. A live cast stands above the slot
            // now (MAG-53), so every seat keeps a tray during one; the seam
            // still refuses the caster's own rolls until MAG-50 loosens it.
            <>
              {/* Each posture keyed so a change remounts through the assembly
                  beat (.mv-assemble): the zone doesn't swap, it re-marshals
                  beneath the masthead (styles.css). */}
              {rawCast.state !== "idle" && mySheet ? (
                <div key="declaring" className="mv-assemble mv-stage">
                  <DeclarationFelt
                    cast={cast}
                    character={mySheet}
                    hasPendingCast={hasPendingCast === true}
                    tides={stripTides(scene, pips, mySheet.id)}
                  />
                </div>
              ) : (
                <div key="resting" className="mv-assemble mv-stage">
                  <DicePoolBuilder pool={pool} character={mySheet ?? undefined} />
                </div>
              )}
            </>
          }
          message={
            <MessageBox
              people={people}
              whisper={slot.whisper}
              onSend={(text, targets) =>
                sendMessage({
                  sessionId,
                  text,
                  ...(targets.length > 0 && { whisperTargetIds: [...targets] }),
                })
              }
              onEscape={slot.escape}
              inputRef={slot.inputRef}
            />
          }
        />
      }
      combatTracker={
        // The bottom band (issue #60). Chrome follows the seat (ADR-0013):
        // "my face" is the seat's character, and a seated ST-Dev sees player
        // chrome; the server refuses wrong actors regardless.
        <CombatTracker
          sessionId={sessionId}
          isStoryteller={isStoryteller}
          myCharacterId={character?._id}
          roster={(roster ?? []).map((c) => ({ id: c._id, name: c.name }))}
        />
      }
      onClearPool={() => {
        pool.reset()
        if (rawCast.state === "declaring") rawCast.cancel()
      }}
    />
  )
}
