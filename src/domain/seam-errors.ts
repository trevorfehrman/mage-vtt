import { Schema } from "effect"
import { NotAMember, NotStoryteller, NotYourCharacter } from "./authz"
import { InvalidPoolComponent } from "./dice"
import { ArcanumTooWeak, HighSpeechNeedsMerit, InvalidCastDeclaration } from "./flows/casting"
import {
  CombatAlreadyActive,
  DuplicateCombatant,
  InitiativeAlreadyRolled,
  InitiativeNotRolled,
  InvalidCombatant,
  InvalidTickSpend,
  NoActiveCombat,
  ParticipantNotInCombat,
} from "./flows/combat"
import { InvalidHandEdit } from "./flows/hand-edit"
import { CasterHasPendingCast, OfferAwaitsAnswer } from "./flows/pending-lock"
import { RoteNotKnown } from "./flows/rote-cast"
import {
  CastOnStage,
  InvalidSceneName,
  InvalidTides,
  NoActiveScene,
  SceneAlreadyOpen,
} from "./flows/scene"
import {
  CastAlreadyPending,
  CastStatusConflict,
  InvalidAdjustment,
  InvalidContainment,
  InvalidMitigation,
  StageOccupied,
} from "./flows/vulgar-cast"
import { InsufficientMana } from "./mana-economy"
import { DocumentNotFound } from "./ports/errors"
import {
  RoteSkillChoiceRequired,
  SpellNotVulgar,
  VulgarCastingNotYetSupported,
} from "./rote-cast"
import { InsufficientWillpower } from "./willpower-economy"

/**
 * The enforcement seam's client-facing error union (ADR-0010, issue #36):
 * every typed Fail an enforced mutation can surface as `ConvexError.data`.
 *
 * This is aggregation, not a grab-bag — each class stays defined beside the
 * code that raises it (ADR-0010's co-location), and this module only imports
 * them so the client can decode an unknown payload against the whole contract
 * and then match it exhaustively. A tag missing here is invisible to the
 * client (it degrades to the generic fallback), so a flow that grows a new
 * error should add it to this union in the same change.
 */
export const SeamError = Schema.Union([
  // Authorization
  NotAMember,
  NotYourCharacter,
  NotStoryteller,
  // Not found — the one generic tag (ADR-0010); never per-entity variants.
  DocumentNotFound,
  // Rules / precondition
  InsufficientMana,
  InsufficientWillpower,
  ArcanumTooWeak,
  HighSpeechNeedsMerit,
  VulgarCastingNotYetSupported,
  SpellNotVulgar,
  RoteNotKnown,
  RoteSkillChoiceRequired,
  SceneAlreadyOpen,
  NoActiveScene,
  CastOnStage,
  CastAlreadyPending,
  CasterHasPendingCast,
  OfferAwaitsAnswer,
  StageOccupied,
  CastStatusConflict,
  InvalidContainment,
  CombatAlreadyActive,
  NoActiveCombat,
  ParticipantNotInCombat,
  DuplicateCombatant,
  InitiativeAlreadyRolled,
  InitiativeNotRolled,
  // Validation
  InvalidSceneName,
  InvalidTides,
  InvalidCombatant,
  InvalidTickSpend,
  InvalidCastDeclaration,
  InvalidAdjustment,
  InvalidMitigation,
  InvalidHandEdit,
  InvalidPoolComponent,
])
export type SeamError = typeof SeamError.Type

export type SeamErrorTag = SeamError["_tag"]
