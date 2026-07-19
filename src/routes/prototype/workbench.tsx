// The workbench (#72; ADR-0021) — the polish campaign's reference surface.
// Durable, unlike the census-era prototypes: cluster passes check their work
// against this page, and new vocabulary lands here first.
//
// Two floors:
//   I  — the mv-* vocabulary sheet: every shared class and restyled shadcn
//        primitive in every state it owns (rest / lit / disabled / gated /
//        empty; hover and keyboard focus are live — Tab around).
//   II — the prop-driven game components under mock data, in their key
//        states.
//
// Explicitly NOT a Storybook: the Convex-hook-wired components (CastCard,
// CombatTracker, SceneStrip, ChatInput, …) are verified by driving the live
// app — no prop-seams get added for this gallery's sake (ADR-0021).
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { decodeSheet, initialCurrentState } from "#/domain/character";
import { arctusData } from "#/domain/fixtures/arctus";
import type { MessageEntry, RollEntry } from "#/domain/activity";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import { FeedEntry } from "#/components/ui/entrance";
import { GateButton } from "#/components/ui/gate-button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import { MessageItem, RollItem } from "#/components/game/ActivityLog";
import {
  ArcanaGlyph,
  OrderGlyph,
  PathGlyph,
  arcanumTint,
  isGrossArcanum,
} from "#/components/game/ArcanaGlyph";
import { DicePoolBuilder } from "#/components/game/DicePoolBuilder";
import { DotRating } from "#/components/game/DotRating";
import { ResourceStrip } from "#/components/game/ResourceStrip";
import { SecondSeatControl } from "#/components/game/SecondSeatControl";
import { useDicePool } from "#/hooks/use-dice-pool";
import type { SessionMemberRow } from "#/domain/session";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/prototype/workbench")({
  component: Workbench,
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = "proto-workbench" as Id<"sessions">;
const CASTER = "dev:proto-arctus";
const T0 = 1752800000000;

const arctusSheet = decodeSheet({
  id: "proto-character",
  sessionId: SESSION_ID,
  userId: CASTER,
  sessionMemberId: "proto-member",
  ...arctusData,
  ...initialCurrentState(arctusData),
});

const chatMsg: MessageEntry = {
  _tag: "message",
  _id: "proto-msg-1" as MessageEntry["_id"],
  senderId: "dev:proto-morrigan",
  senderName: "Morrigan",
  text: "The funeral party is still filing out upstairs. Two of them lingering.",
  visibilityType: "public",
  timestamp: T0 - 180000,
};

const priorRoll: RollEntry = {
  _tag: "roll",
  _id: "proto-roll-1" as RollEntry["_id"],
  userId: CASTER,
  displayName: "The Little Bear",
  components: [
    { type: "attribute", name: "Wits", dots: 2 },
    { type: "skill", name: "Investigation", dots: 3 },
  ],
  poolSize: 5,
  rolls: [8, 3, 9, 1, 10],
  explosions: [7],
  roteRerolls: [],
  successes: 3,
  isChanceDie: false,
  isDramaticFailure: false,
  isExceptionalSuccess: false,
  visibility: "public",
  againThreshold: 10,
  isRoteAction: false,
  summary: "Wits + Investigation — reading the warding knot",
  timestamp: T0 - 120000,
};

const rosterFixture: ReadonlyArray<SessionMemberRow> = [
  {
    _id: "proto-member-1" as SessionMemberRow["_id"],
    _creationTime: T0,
    sessionId: SESSION_ID,
    userId: CASTER,
    role: "player",
    displayName: "The Little Bear",
  },
  {
    _id: "proto-member-2" as SessionMemberRow["_id"],
    _creationTime: T0,
    sessionId: SESSION_ID,
    userId: "dev:proto-morrigan",
    role: "player",
    displayName: "Morrigan",
  },
  {
    _id: "proto-member-3" as SessionMemberRow["_id"],
    _creationTime: T0,
    sessionId: SESSION_ID,
    userId: "dev:proto-st",
    role: "storyteller",
    displayName: "Sagequeen",
  },
];

const ARCANA = [
  "death",
  "fate",
  "forces",
  "life",
  "matter",
  "mind",
  "prime",
  "space",
  "spirit",
  "time",
];
const PATHS = ["acanthus", "mastigos", "moros", "obrimos", "thyrsus"];
const ORDERS = [
  "adamantine arrow",
  "free council",
  "guardians of the veil",
  "mysterium",
  "silver ladder",
];

// ── Scaffolding ──────────────────────────────────────────────────────────────

/** The named-boundary rule made flesh: an eyebrow + rule header, never
 * control-shaped geometry. */
function Bench({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-1 pt-2">
        <div className="flex items-baseline gap-3">
          <h2 className="mv-eyebrow">{title}</h2>
          {note && (
            <span className="text-[11px]" style={{ color: "var(--dim)" }}>
              {note}
            </span>
          )}
        </div>
        <div className="mv-rule" />
      </div>
      {children}
    </section>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <span
        className="mv-data text-[9px] uppercase tracking-wider"
        style={{ color: "var(--dim)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ── Floor I benches ──────────────────────────────────────────────────────────

const IDENTITY_TOKENS = [
  ["--bg", "app void"],
  ["--panel", "panels"],
  ["--raise", "raised controls"],
  ["--ink", "primary text"],
  ["--dim", "secondary text (amended, ≥4.5:1)"],
  ["--accent", "Verdigris — the world's magic, the trigger"],
  ["--ember", "the caster's hand — armed, reversible"],
  ["--bad", "harm"],
  ["--mana", "Mana's identity blue"],
  ["--line", "borders"],
] as const;

const REALM_TOKENS = [
  ["--realm-aether", "Aether"],
  ["--realm-arcadia", "Arcadia"],
  ["--realm-pandemonium", "Pandemonium"],
  ["--realm-wild", "Primal Wild"],
  ["--realm-stygia", "Stygia"],
] as const;

function TokenBench() {
  return (
    <Bench
      title="Tokens"
      note="the identity's palette — values live in styles.css, guarded by the token-contrast test"
    >
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {IDENTITY_TOKENS.map(([name, role]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span
              className="inline-block size-4 rounded-[2px] border"
              style={{ background: `var(${name})`, borderColor: "var(--line)" }}
            />
            <span className="mv-data text-[10px]">{name}</span>
            <span className="text-[10px]" style={{ color: "var(--dim)" }}>
              {role}
            </span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {REALM_TOKENS.map(([name, role]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span
              className="inline-block size-4 rounded-full border"
              style={{ background: `var(${name})`, borderColor: "var(--line)" }}
            />
            <span className="mv-data text-[10px]">{role}</span>
          </span>
        ))}
      </div>
    </Bench>
  );
}

function TypeBench() {
  return (
    <Bench
      title="Type roles"
      note="14px primary · 12–13px secondary · 11px labels · 9px floor"
    >
      <div className="grid gap-2">
        <p className="mv-h text-[17px]">
          Cinzel carries the named things — mv-h
        </p>
        <p className="text-[13px]">
          Manrope carries the prose; primary trait and row names sit at 14px and
          never wrap.
        </p>
        <p className="mv-data text-[12px]">
          JetBrains Mono carries the data — mv-data · GNOSIS 2 · MANA 11 · WILL
          6
        </p>
        <p className="mv-eyebrow">
          The eyebrow marks a boundary — mv-eyebrow, 9px, the floor
        </p>
        <p className="mv-book-text text-[13px] italic">
          Spectral speaks only from the Rote book's pages — mv-book-text.
        </p>
      </div>
    </Bench>
  );
}

function SurfaceBench() {
  return (
    <Bench
      title="Surfaces"
      note="boundaries are named (eyebrow + rule), never control-shaped geometry"
    >
      <div className="flex flex-wrap gap-4">
        <div className="mv-panel w-52 rounded-[3px] p-3">
          <span className="mv-eyebrow">mv-panel</span>
          <p className="pt-1 text-[12px]">
            A made object — it occludes the firmament.
          </p>
        </div>
        <div className="mv-panel mv-cornered w-52 rounded-[3px] p-3">
          <span className="mv-eyebrow">mv-panel mv-cornered</span>
          <p className="pt-1 text-[12px]">
            Corner-ticks mark the important surfaces only.
          </p>
        </div>
        <div className="mv-panel w-52 rounded-[3px] p-3">
          <span className="mv-eyebrow">mv-empty</span>
          <div className="mv-empty h-16">an empty felt rolls a chance die</div>
        </div>
      </div>
    </Bench>
  );
}

/** One control class across its states. Hover and focus are live. */
function ControlRow({
  label,
  shape,
  on,
  gate,
}: {
  label: string;
  /** The specimen's shape classes (padding, radius, size). */
  shape: string;
  /** The class's lit modifier, when it has one. */
  on?: string;
  /** The refusal this control can hit, when it can be gated. */
  gate?: string;
}) {
  const cls = (extra = "") => `${label} ${shape} ${extra}`;
  return (
    <>
      <span
        className="mv-data self-center text-[10px]"
        style={{ color: "var(--dim)" }}
      >
        .{label}
      </span>
      <span>
        <button type="button" className={cls()}>
          Rest
        </button>
      </span>
      <span>
        {on ? (
          <button type="button" className={cls(on)}>
            Lit
          </button>
        ) : (
          "—"
        )}
      </span>
      <span>
        <button type="button" disabled className={cls("disabled:opacity-40")}>
          Disabled
        </button>
      </span>
      <span>
        {gate ? (
          <GateButton gate={gate} className={cls()}>
            Gated
          </GateButton>
        ) : (
          "—"
        )}
      </span>
    </>
  );
}

function ControlBench() {
  const pad = "rounded-[3px] px-3 py-1.5 text-[12px]";
  return (
    <Bench
      title="Controls"
      note="hover and Tab are live — every control takes the one shared focus ring; a gate keeps pointer events and explains itself"
    >
      <div
        className="grid items-center gap-x-6 gap-y-3"
        style={{
          gridTemplateColumns: "6rem repeat(4, auto)",
          justifyContent: "start",
        }}
      >
        <span className="mv-eyebrow">class</span>
        <span className="mv-eyebrow">rest</span>
        <span className="mv-eyebrow">lit</span>
        <span className="mv-eyebrow">disabled</span>
        <span className="mv-eyebrow">gated</span>
        <ControlRow
          label="mv-btn"
          shape={pad}
          gate="The scene isn't yours to touch yet."
        />
        <ControlRow
          label="mv-mini"
          shape=""
          on="mv-mini-on"
          gate="Willpower is a spend — it needs your sheet to fund it."
        />
        <ControlRow
          label="mv-chip"
          shape="rounded-full px-3 py-1 text-[11px]"
        />
        <ControlRow
          label="mv-trait"
          shape="rounded-[3px] px-3 py-1.5 text-[13px]"
          on="mv-trait-on"
        />
        <ControlRow
          label="mv-roll"
          shape={pad}
          gate="Not enough Mana — need 2, have 1."
        />
      </div>
      <p className="text-[11px]" style={{ color: "var(--dim)" }}>
        The refusing treatment (<span className="mv-data">mv-refuse</span>) dims
        like disabled but keeps pointer events — hover a gated control and it
        explains itself. That's the <span className="mv-data">GateButton</span>{" "}
        contract.
      </p>
    </Bench>
  );
}

function FieldBench() {
  return (
    <Bench
      title="Fields"
      note="mv-field — focus speaks at the border; labels take the eyebrow grammar"
    >
      <div className="grid max-w-3xl grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="wb-field-rest">Intent</Label>
          <Input id="wb-field-rest" placeholder="What is the spell for?" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wb-field-filled">Filled</Label>
          <Input
            id="wb-field-filled"
            defaultValue="Quicken the corpse below the chapel"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wb-field-disabled">Disabled</Label>
          <Input
            id="wb-field-disabled"
            disabled
            placeholder="Not while the dice fly"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wb-field-invalid">Invalid</Label>
          <Input
            id="wb-field-invalid"
            aria-invalid
            defaultValue="thirteen dice"
          />
        </div>
      </div>
    </Bench>
  );
}

function EntranceBench() {
  const [entries, setEntries] = useState<ReadonlyArray<number>>([1]);
  const [nextId, setNextId] = useState(2);
  return (
    <Bench
      title="Entrance"
      note="FeedEntry — a Chronicle entry lands (rises and settles, exits fade); dice accrete with entranceSpring — the live tray below runs it"
    >
      <div className="flex items-start gap-4">
        <div className="grid gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEntries((e) => [...e, nextId]);
              setNextId((n) => n + 1);
            }}
          >
            Land an entry
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEntries((e) => e.slice(1))}
            disabled={entries.length === 0}
          >
            Let one go
          </Button>
        </div>
        <div className="mv-panel min-h-24 w-80 rounded-[3px] p-2">
          <div className="grid gap-1.5">
            <AnimatePresence initial={false}>
              {entries.map((id) => (
                <FeedEntry key={id}>
                  <div
                    className="rounded-[3px] border px-2 py-1.5 text-[12px]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="mv-data" style={{ color: "var(--dim)" }}>
                      beat {id} ·
                    </span>{" "}
                    something lands in the Chronicle
                  </div>
                </FeedEntry>
              ))}
            </AnimatePresence>
            {entries.length === 0 && (
              <div className="mv-empty h-16">
                the Chronicle waits for its first beat
              </div>
            )}
          </div>
        </div>
      </div>
    </Bench>
  );
}

function ShadcnBench() {
  return (
    <TooltipProvider>
      <Bench
        title="Restyled primitives"
        note="shadcn machinery, mv voice (restyled, not banned) — button · select · dialog · tooltip"
      >
        <div className="grid gap-4">
          <Spec label="button variants">
            <Button>Default — the trigger</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </Spec>
          <div className="flex flex-wrap items-end gap-6">
            <Spec label="select — the styled control (native selects are banned where this exists)">
              <Select defaultValue="occult">
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Pick the rote's skill" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Rote skill</SelectLabel>
                    <SelectItem value="occult">Occult</SelectItem>
                    <SelectItem value="investigation">Investigation</SelectItem>
                    <SelectItem value="medicine" disabled>
                      Medicine (untrained)
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select disabled>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Disabled" />
                </SelectTrigger>
                <SelectContent />
              </Select>
            </Spec>
            <Spec label="dialog">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Open the dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a new session</DialogTitle>
                    <DialogDescription>
                      An important surface: the panel wears its corner-ticks.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-1.5">
                    <Label htmlFor="wb-dialog-name">Session name</Label>
                    <Input
                      id="wb-dialog-name"
                      placeholder="Friday Night Mage"
                    />
                  </div>
                  <DialogFooter showCloseButton>
                    <Button>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Spec>
            <Spec label="tooltip">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="mv-btn rounded-[3px] px-3 py-1.5 text-[12px]"
                  >
                    Hover me
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  A raised dark label — the gate-reason's vehicle.
                </TooltipContent>
              </Tooltip>
            </Spec>
          </div>
        </div>
      </Bench>
    </TooltipProvider>
  );
}

// ── Floor II benches ─────────────────────────────────────────────────────────

function DotBench() {
  return (
    <Bench
      title="DotRating"
      note="7px dots — the one size below the 9px type floor, being marks not text"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <Spec label="empty">
          <DotRating current={0} />
        </Spec>
        <Spec label="partial">
          <DotRating current={3} />
        </Spec>
        <Spec label="full">
          <DotRating current={5} />
        </Spec>
        <Spec label="in the pool (ember)">
          <DotRating current={3} active />
        </Spec>
        <Spec label="zone tint">
          <DotRating current={3} color="var(--realm-aether)" />
        </Spec>
        <Spec label="lit context (--mv-dot-ring)">
          <span
            style={
              {
                "--mv-dot-ring": "color-mix(in srgb, var(--accent) 50%, white)",
              } as CSSProperties
            }
          >
            <DotRating current={2} />
          </span>
        </Spec>
      </div>
    </Bench>
  );
}

function GlyphBench() {
  return (
    <Bench
      title="Glyphs"
      note="optically normalized to one 18×18 target; Subtle Arcana are line-light, Gross are struck medallions (seal)"
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {ARCANA.map((a) => (
            <span key={a} className="grid justify-items-center gap-1">
              <ArcanaGlyph
                arcanum={a}
                size={22}
                variant={isGrossArcanum(a) ? "seal" : "line"}
              />
              <span
                className="mv-data text-[9px] uppercase"
                style={{ color: arcanumTint(a) }}
              >
                {a}
              </span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {PATHS.map((p) => (
            <span key={p} className="grid justify-items-center gap-1">
              <PathGlyph path={p} size={20} className="mv-accent" />
              <span
                className="mv-data text-[9px] uppercase"
                style={{ color: "var(--dim)" }}
              >
                {p}
              </span>
            </span>
          ))}
          <span className="w-4" />
          {ORDERS.map((o) => (
            <span key={o} className="grid justify-items-center gap-1">
              <OrderGlyph order={o} size={20} className="mv-accent" />
              <span
                className="mv-data text-[9px] uppercase"
                style={{ color: "var(--dim)" }}
              >
                {o}
              </span>
            </span>
          ))}
        </div>
      </div>
    </Bench>
  );
}

function RailFootBench() {
  const sheetless = useDicePool(SESSION_ID);
  const funded = useDicePool(SESSION_ID, "proto-character" as Id<"characters">);
  const staged = useDicePool(SESSION_ID, "proto-character" as Id<"characters">);
  if (!arctusSheet) return null;
  return (
    <Bench
      title="The rail foot"
      note="the pilot's own components, live — build a pool, fold the tray; Roll meets the seam's honest refusal (no real session behind this bench)"
    >
      <div className="flex flex-wrap items-start gap-6">
        <Spec label="funded seat — the tray">
          <div className="mv-panel w-[430px] rounded-[3px]">
            <DicePoolBuilder pool={funded} character={arctusSheet} />
          </div>
        </Spec>
        <Spec label="sheetless seat — the Willpower gate refuses with its reason">
          <div className="mv-panel w-[430px] rounded-[3px]">
            <DicePoolBuilder pool={sheetless} />
          </div>
        </Spec>
        <Spec label="masthead — spends being weighed (pending ghosts on both pools)">
          <div className="mv-panel w-[430px] rounded-[3px]">
            <ResourceStrip character={arctusSheet} pendingWillpower pendingMana={2} />
          </div>
        </Spec>
        <Spec label="the stage — memory/judgment boundary: the rail's panel ends, the void breathes, the console opens masthead-first">
          <div className="mv-panel w-[430px] rounded-[3px]">
            {/* a feed stand-in, so the seam has a memory to end */}
            <p
              className="px-3 py-2 text-center text-[11px] italic"
              style={{ color: "var(--dim)" }}
            >
              — the chronicle&apos;s last beat —
            </p>
            <div className="mv-stage-ground">
              <ResourceStrip character={arctusSheet} />
              <div className="mv-stage">
                <DicePoolBuilder pool={staged} character={arctusSheet} />
              </div>
            </div>
          </div>
        </Spec>
      </div>
    </Bench>
  );
}

function FeedBench() {
  return (
    <Bench
      title="Feed entries"
      note="MessageItem and RollItem under fixture data"
    >
      <div className="mv-panel w-[380px] rounded-[3px] p-2">
        <div className="grid gap-2">
          <MessageItem message={chatMsg} />
          <RollItem roll={priorRoll} />
        </div>
      </div>
    </Bench>
  );
}

function SeatBench() {
  const [seat, setSeat] = useState<Id<"sessionMembers"> | null>(null);
  return (
    <Bench
      title="Second Seat"
      note="the seat dropdown rides the restyled select"
    >
      <SecondSeatControl
        members={rosterFixture}
        ownUserId={CASTER}
        seatId={seat}
        onSeat={setSeat}
      />
    </Bench>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

function Workbench() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8">
      <header className="grid gap-1">
        <h1 className="mv-h text-[22px]">The Workbench</h1>
        <p className="text-[12px]" style={{ color: "var(--dim)" }}>
          The polish campaign's reference surface (ADR-0021, #72). Floor I — the
          shared vocabulary in every state. Floor II — the prop-driven
          components under mock data. The rubric it serves:{" "}
          <span className="mv-data">docs/component-standards.md</span>.
        </p>
      </header>

      <TokenBench />
      <TypeBench />
      <SurfaceBench />
      <ControlBench />
      <FieldBench />
      <EntranceBench />
      <ShadcnBench />

      <header className="grid gap-1 pt-4">
        <h1 className="mv-h text-[17px]">Floor II — the components</h1>
      </header>

      <DotBench />
      <GlyphBench />
      <RailFootBench />
      <FeedBench />
      <SeatBench />
    </div>
  );
}
