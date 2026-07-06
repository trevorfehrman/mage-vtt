import { Schema } from "effect"
import { NotAMember, NotStoryteller, NotYourCharacter } from "./authz"
import { InvalidPoolComponent } from "./dice"
import { ArcanumTooWeak, InvalidCastDeclaration } from "./flows/casting"
import { InvalidHandEdit } from "./flows/hand-edit"
import { RoteNotKnown } from "./flows/rote-cast"
import { InvalidSheetlessCast } from "./flows/sheetless-cast"
import { InsufficientMana } from "./mana-economy"
import { DocumentNotFound } from "./ports/errors"
import { RoteSkillChoiceRequired, VulgarCastingNotYetSupported } from "./rote-cast"
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
  // Not found
  DocumentNotFound,
  // Rules / precondition
  InsufficientMana,
  InsufficientWillpower,
  ArcanumTooWeak,
  VulgarCastingNotYetSupported,
  RoteNotKnown,
  RoteSkillChoiceRequired,
  // Validation
  InvalidCastDeclaration,
  InvalidSheetlessCast,
  InvalidHandEdit,
  InvalidPoolComponent,
])
export type SeamError = typeof SeamError.Type

export type SeamErrorTag = SeamError["_tag"]
