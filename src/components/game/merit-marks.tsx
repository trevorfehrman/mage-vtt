// The marks (MAG-68): one line glyph per Merit, in the Arcana glyphs' stroke
// — a 24-box, 1.4 stroke, round caps, a bindi or barb as signature — so each
// key on the ring is unique by its mark and the door bears it as a sigil.
// The record is total over the Merit vocabulary: the compiler refuses a
// Merit without a mark. Each mark's one-line brief is the comment above it;
// the gallery (/prototype/merit-keys) lines every mark up beside every glyph
// the app already draws, because a mark must not collide with any of them
// (the open book was the Mysterium's before it was Encyclopedic Knowledge's).
// Key-ness is gestured, never drawn: no teeth, no tags. The turned mark
// tilts clockwise, toward the tray, and burns ember.
import type { ReactNode } from "react"
import { motion } from "motion/react"
import type { MeritName } from "#/domain/merits"

export const MARKS: Record<MeritName, ReactNode> = {
  // ── Mental (MAG-68, batch 1) ──
  // the plumb line — a bar, a string, the bob hanging true
  "Common Sense": <><path d="M7.5 4 H16.5" /><path d="M12 4 V15.5" /><circle cx="12" cy="17.6" r="1.6" fill="currentColor" stroke="none" /></>,
  // the knot in the thread — a line with one loop tied in it, so it is not forgotten
  "Eidetic Memory": <><path d="M3 13 H8.6 M15.4 13 H20" /><circle cx="12" cy="13" r="3.4" /><circle cx="21" cy="13" r="1.3" fill="currentColor" stroke="none" /></>,
  // the ring of facts — many small things that together make a whole
  // (the open book was the Mysterium's, the whorl was Forces'; the lineup rule)
  "Encyclopedic Knowledge": <><circle cx="12.0" cy="5.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="16.9" cy="7.1" r="1.25" fill="currentColor" stroke="none" /><circle cx="19.0" cy="12.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="16.9" cy="16.9" r="1.25" fill="currentColor" stroke="none" /><circle cx="12.0" cy="19.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="7.1" cy="16.9" r="1.25" fill="currentColor" stroke="none" /><circle cx="5.0" cy="12.0" r="1.25" fill="currentColor" stroke="none" /><circle cx="7.1" cy="7.1" r="1.25" fill="currentColor" stroke="none" /></>,
  // the sprig — a stem, two leaves, the bud
  "Holistic Awareness": <><path d="M12 20.5 V8" /><path d="M12 15 Q7.5 14.5 6.5 10" /><path d="M12 11.5 Q16.5 11 17.5 6.5" /><circle cx="12" cy="5.4" r="1.4" fill="currentColor" stroke="none" /></>,
  // the spoken line — one breath of speech, from its first word
  Language: <><path d="M4.5 12 C7 7 10 7 12 12 S17 17 19.5 12" /><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  // the still pool — a round undisturbed over its waterline, the mind at its center
  "Meditative Mind": <><circle cx="12" cy="10" r="6" /><path d="M4 20 H20" /><circle cx="12" cy="10" r="1.3" fill="currentColor" stroke="none" /></>,
  // ── Social (MAG-68, batch 2) ──
  // the two links — a chain of two, held together
  Allies: <><path d="M9.5 8.5 A3.5 3.5 0 1 0 9.5 15.5" /><path d="M9.5 8.5 H11 A3.5 3.5 0 0 1 11 15.5 H9.5" /><path d="M14.5 8.5 A3.5 3.5 0 1 1 14.5 15.5" /><path d="M14.5 8.5 H13 A3.5 3.5 0 0 0 13 15.5 H14.5" /></>,
  // the velvet rope — two posts and the rope that drops for you
  Barfly: <><path d="M5 20 V9" /><path d="M19 20 V9" /><path d="M5 10.5 Q12 16.5 19 10.5" /><circle cx="5" cy="7.4" r="1.2" fill="currentColor" stroke="none" /><circle cx="19" cy="7.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the signature — a name everyone knows, in one flourish
  Fame: <><path d="M3.5 16 C5 8 9 8 9 13 S12.5 18 13.5 11 S18 6 18.5 12 S21 16 20.5 14" /><circle cx="20.5" cy="17.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the stair — each step lifts the next (the rays were Holistic's sprig again)
  Inspiring: <><path d="M3.5 20 H8.5 V15 H13.5 V10 H18.5 V5" /><circle cx="20.5" cy="3.6" r="1.3" fill="currentColor" stroke="none" /></>,
  // the crook and the stave — the shepherd's guide beside the one it guides
  // (two staves with bindis were two of Faith's candles)
  Mentor: <><path d="M8 20.5 V7 A2.6 2.6 0 0 1 13.2 7" /><path d="M16.5 20.5 V12" /><circle cx="16.5" cy="9.8" r="1.3" fill="currentColor" stroke="none" /></>,
  // the tally — four strokes and the fifth across: wealth counted
  Resources: <><path d="M6 6 V18 M9.5 6 V18 M13 6 V18 M16.5 6 V18" /><path d="M4 16.5 L18.5 7.5" /><circle cx="20" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the one who follows — the mage solid, the follower a step behind
  // (a ring on a line was a magnifier, or Obrimos' key)
  Retainer: <><circle cx="8.5" cy="8.5" r="1.8" fill="currentColor" stroke="none" /><circle cx="14.5" cy="14.5" r="4" /></>,
  // the drawn gaze — every line in the room comes to one point
  "Striking Looks": <><path d="M4 4 L9 9 M20 4 L15 9 M4 20 L9 15 M20 20 L15 15" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  // ── Awakened (MAG-68, batch 3) ──
  // the pendant — a Supernal thing hung on the world by one thread
  // (the sealed urn read as a bin at 26px)
  Artifact: <><path d="M12 2.5 V8" /><path d="M12 8.5 L16 13 L12 17.5 L8 13 Z" /><circle cx="12" cy="20.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the sliver moon — a clue seen by its light
  Dream: <><path d="M14.5 4 A8 8 0 1 0 14.5 20 A6.2 6.2 0 1 1 14.5 4 Z" /><circle cx="16.5" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  // the braced square — a plain thing, reinforced
  "Enhanced Item": <><path d="M5 5 H19 V19 H5 Z" /><path d="M5 19 L19 5" /><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the bond — two sparks, one thread between them
  Familiar: <><path d="M6 16.5 Q10 3 18 8.5" /><circle cx="6" cy="17" r="1.5" fill="currentColor" stroke="none" /><circle cx="18.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" /></>,
  // the welling — Mana rising from the ground in rings (the basin on its
  // foot was a smiling face at 26px)
  Hallow: <><path d="M8 14.5 A4 4 0 0 0 16 14.5" /><path d="M4.5 11.5 A7.5 7.5 0 0 0 19.5 11.5" /><circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none" /></>,
  // the set stone — a ring, and the spell set in it
  "Imbued Item": <><circle cx="12" cy="13.5" r="5.5" /><circle cx="12" cy="7.5" r="1.4" fill="currentColor" stroke="none" /></>,
  // the follower who sees — Retainer's ring, with its eye open
  "Sleepwalker Retainer": <><circle cx="8.5" cy="8.5" r="1.8" fill="currentColor" stroke="none" /><circle cx="14.5" cy="14.5" r="4" /><circle cx="14.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the held stone — another's soul stone, in the fist
  Thrall: <><path d="M7 5.5 Q3.5 12 7 18.5" /><path d="M17 5.5 Q20.5 12 17 18.5" /><path d="M12 8.5 L15 12 L12 15.5 L9 12 Z" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  // ── Physical (MAG-68, batch 4) ──
  // the even pair — one line, a hand to either side at the same height
  Ambidextrous: <><path d="M12 3.5 V20.5" /><circle cx="6.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  // the slip — the body bends aside, the blow passes
  "Brawling Dodge": <><path d="M12 3 C12 9 6 10 6 13 C6 16 12 16.5 12 21" /><circle cx="17" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  // the needle — it always finds north
  "Direction Sense": <><path d="M12 20.5 V5" /><path d="M8.5 8.5 L12 4.5 L15.5 8.5" /><circle cx="12" cy="20.5" r="1.3" fill="currentColor" stroke="none" /></>,
  // the blade in two parts — struck out of the hand
  Disarm: <><path d="M5 19 L11 13" /><path d="M13.5 10.5 L19 5" /><circle cx="19.5" cy="19" r="1.3" fill="currentColor" stroke="none" /></>,
  // the flick — two strokes before the eye catches up
  "Fast Reflexes": <><path d="M6.5 17 L10.5 7" /><path d="M12.5 17 L16.5 7" /><circle cx="19" cy="5.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the point — the blade, and the ring where it balances
  "Fighting Finesse": <><path d="M5.5 18.5 L10.4 13.6 M13.6 10.4 L18.5 5.5" /><circle cx="12" cy="12" r="2.3" /></>,
  // the stance — rooted, the belt tied
  "Fighting Style: Kung Fu": <><path d="M5 20 L12 6 L19 20" /><path d="M8.3 14.5 H15.7" /><circle cx="12" cy="3.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the pair upright — two blades, a hilt in each hand (the opposite bars
  // were Gunslinger's twin at 26px)
  "Fighting Style: Two Weapons": <><path d="M8 3.5 V16.5" /><path d="M16 3.5 V16.5" /><circle cx="8" cy="19.5" r="1.4" fill="currentColor" stroke="none" /><circle cx="16" cy="19.5" r="1.4" fill="currentColor" stroke="none" /></>,
  // the heel and the wind behind it
  "Fleet of Foot": <><path d="M3.5 9.5 H10" /><path d="M3.5 13.5 H8" /><path d="M5.5 17.5 H9" /><circle cx="16" cy="12" r="2.2" fill="currentColor" stroke="none" /></>,
  // the drop-in — back onto the line, anywhere along it (the opened ring
  // was Dream's crescent at 26px)
  "Fresh Start": <><path d="M3.5 16 H20.5" /><path d="M12 4 V12.5" /><path d="M8.8 9.5 L12 12.8 L15.2 9.5" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the one who stands over — planted, head above the rest
  Giant: <><path d="M12 20 V7.5" /><path d="M5 20 H19" /><circle cx="12" cy="4.6" r="1.5" fill="currentColor" stroke="none" /></>,
  // the double muzzle — two barrels, one direction
  Gunslinger: <><path d="M4 9.5 H14" /><circle cx="16.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" /><path d="M4 14.5 H14" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></>,
  // the unbroken — a line the wound does not break
  "Iron Stamina": <><path d="M3.5 12 H20.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  // the gut that holds anything
  "Iron Stomach": <><path d="M7 6 V13 A5 5 0 0 0 17 13 V6" /><circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" /></>,
  // the roof — nothing gets in
  "Natural Immunity": <><path d="M4.5 11.5 L12 4.5 L19.5 11.5" /><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" /></>,
  // the draw — out before the eye
  "Quick Draw": <><path d="M7.5 16.5 L18 6" /><path d="M12.5 6 H18 V11.5" /><circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none" /></>,
  // the stitch — the wound closes
  "Quick Healer": <><path d="M3.5 12 H20.5" /><path d="M9.5 8.5 L14.5 15.5 M14.5 8.5 L9.5 15.5" /></>,
  // the bearer — shoulders under the weight
  "Strong Back": <><path d="M4.5 14 Q12 8.5 19.5 14" /><path d="M12 11 V20.5" /><circle cx="12" cy="5.5" r="1.7" fill="currentColor" stroke="none" /></>,
  // the bellows — drawn in, held
  "Strong Lungs": <><path d="M8 5.5 Q14 12 8 18.5" /><path d="M16 5.5 Q10 12 16 18.5" /><circle cx="12" cy="21" r="1.2" fill="currentColor" stroke="none" /></>,
  // the swerve — the road thrown around what is in it (two curved tracks
  // were Fast Reflexes' two strokes at 26px)
  "Stunt Driver": <><path d="M3.5 16 H8.5 C10 16 10 7 12 7 C14 7 14 16 15.5 16 H20.5" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" /></>,
  // the drop that does not take — poison, shed
  "Toxin Resistance": <><path d="M12 3.5 C8.5 9 7 12 7 14.5 A5 5 0 0 0 17 14.5 C17 12 15.5 9 12 3.5 Z" /><circle cx="12" cy="21.5" r="1.1" fill="currentColor" stroke="none" /></>,
  // the parry — the blade stands, the stroke glances off
  "Weaponry Dodge": <><path d="M13 3.5 V20.5" /><path d="M5 16.5 L11 10.5" /><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none" /></>,
  // ── Awakened and others ──
  // the Atlantean tongue — a tongue of flame rising from parted lips
  "High Speech": <><path d="M6 15 Q12 20 18 15" /><path d="M12 14.5 C9.8 11.5 13.4 9.4 12 5.6" /><circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the lidded eye, a barb of warning above it
  "Danger Sense": <><path d="M4 12.5 Q12 5.5 20 12.5 Q12 19.5 4 12.5 Z" /><circle cx="12" cy="12.5" r="1.6" fill="currentColor" stroke="none" /><path d="M12 5.5 V2.6 M12 2.6 L10.8 3.8 M12 2.6 L13.2 3.8" /></>,
  // the compass star, a point of fate at its heart
  Destiny: <><path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  // the crest — a chevron over its bar, the standing marked at the peak
  Status: <><path d="M5 16 L12 6.5 L19 16" /><path d="M7.5 19.5 H16.5" /><circle cx="12" cy="4.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the arch — a doorway over its threshold, a hearth within
  Sanctum: <><path d="M6 20 V11 A6 6 0 0 1 18 11 V20" /><path d="M3.5 20 H20.5" /><circle cx="12" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></>,
  // the stacked tome — its spine and leaves, one leaf turned
  Library: <><path d="M6 5 V19" /><path d="M6 5 H18 M6 9.5 H18 M6 14 H18 M6 18.5 H13" /><circle cx="17" cy="18.5" r="1.1" fill="currentColor" stroke="none" /></>,
  // the eclipse — a disc veiled by a second, the hidden self a sliver
  Occultation: <><circle cx="12" cy="12" r="7" /><path d="M9.5 5.5 A7 7 0 0 1 9.5 18.5" /><circle cx="7.6" cy="12" r="1.1" fill="currentColor" stroke="none" /></>,
  // the guard — a chevron brought down, the blow landed beneath it
  "Fighting Style: Boxing": <><path d="M5.5 7.5 L12 14 L18.5 7.5" /><path d="M12 14 V19.5" /><circle cx="12" cy="4.4" r="1.2" fill="currentColor" stroke="none" /></>,
  // the web — three knots and the threads between them
  Contacts: <><path d="M6 17 L12 7 L18 17 Z" /><circle cx="6" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="17" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="7" r="1.3" fill="currentColor" stroke="none" /></>,
}

export function Mark({ name, size, turned }: { name: MeritName; size: number | "100%"; turned: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: turned ? "rotate(22deg)" : "rotate(0deg)",
        transformOrigin: "50% 50%",
        transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1), filter 0.3s",
        filter: turned ? "drop-shadow(0 0 5px var(--ember-glow))" : undefined,
      }}
    >
      {MARKS[name]}
    </svg>
  )
}

/** The keyhole: the one iconic shape, a round over a tapered slot, in the
 * marks' stroke. Lit, the round fills ember and glows — the key is turned. */
export function Keyhole({ size, lit }: { size: number; lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ filter: lit ? "drop-shadow(0 0 5px var(--ember-glow))" : undefined, transition: "filter 0.3s" }}
    >
      <path d="M14.3 12.3 L16 20 H8 L9.7 12.3 A4.6 4.6 0 1 1 14.3 12.3 Z" />
      <motion.circle
        cx="12"
        cy="8.6"
        r="1.6"
        fill="currentColor"
        stroke="none"
        style={{ transformOrigin: "12px 8.6px", transformBox: "fill-box" }}
        initial={false}
        animate={{ scale: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
        transition={lit ? { type: "spring", stiffness: 700, damping: 16, delay: 0.22 } : { duration: 0.15 }}
      />
    </svg>
  )
}

