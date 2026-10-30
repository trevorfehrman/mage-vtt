import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { requireMember } from "./lib/auth"
import { isDevUser } from "./lib/dev"
import { NotebookRead, PAGES, Page } from "../src/domain/notebook"
import { schemaToConvexValidator } from "../src/domain/schema-bridge"

/**
 * The mage's notebook (MAG-75, ADR-0027): notes, read by no rule. These are
 * plain functions behind the membership gate, not the enforcement seam — a
 * note has no rule to enforce, no authority to fudge and no Chronicle line
 * to earn. Every member reads a character's notebook; the hand that drives
 * the sheet writes it — the character's own member, the Storyteller, or a
 * Dev — the same gate the sheet's marks walk on the client (`mayDrivePool`),
 * held here too so the API is no wider than the sheet.
 */

/** The character must be of the session the caller is a member of; a notebook is never reached across tables. */
async function characterOf(ctx: QueryCtx | MutationCtx, sessionId: Id<"sessions">, characterId: Id<"characters">) {
  const member = await requireMember(ctx, sessionId)
  const character = await ctx.db.get(characterId)
  if (character === null || character.sessionId !== sessionId) {
    throw new ConvexError("No such character at this table.")
  }
  return { member, character }
}

/** The hand that may write: the character's own member, the Storyteller, or a Dev (ADR-0027). */
async function requireHand(ctx: MutationCtx, sessionId: Id<"sessions">, characterId: Id<"characters">) {
  const { member, character } = await characterOf(ctx, sessionId, characterId)
  const mayWrite = member._id === character.sessionMemberId || member.role === "storyteller" || isDevUser(member.userId)
  if (!mayWrite) throw new ConvexError("That notebook is not yours to write.")
  return character
}

const pageIndex = v.number()
/** A page index is one of the nine; anything else is refused before the row is touched. */
const requirePage = (n: number): void => {
  if (!Number.isInteger(n) || n < 0 || n >= PAGES) throw new ConvexError(`The notebook has ${PAGES} pages.`)
}
/** The page's columns, each compiled from the domain Schema (ADR-0005): the mutation's args are the row's. */
const pageFields = {
  notes: schemaToConvexValidator(Page.fields.notes),
  ink: schemaToConvexValidator(Page.fields.ink),
  shapes: schemaToConvexValidator(Page.fields.shapes),
  order: schemaToConvexValidator(Page.fields.order),
}
/** The written pages of a character's notebook and the ribbon's page; a page with no row is blank (the client fills the nine). */
export const get = query({
  args: { sessionId: v.id("sessions"), characterId: v.id("characters") },
  returns: schemaToConvexValidator(NotebookRead),
  handler: async (ctx, args) => {
    await characterOf(ctx, args.sessionId, args.characterId)
    const pages = await ctx.db
      .query("notebookPages")
      .withIndex("by_characterId_page", (q) => q.eq("characterId", args.characterId))
      .collect()
    const notebook = await ctx.db
      .query("notebooks")
      .withIndex("by_characterId", (q) => q.eq("characterId", args.characterId))
      .unique()
    return {
      pages: pages.map(({ page, notes, ink, shapes, order }) => ({ page, notes, ink, shapes, order })),
      mark: notebook?.mark ?? 0,
    }
  },
})

/** One page written whole — the commit point's write (ADR-0027): the row is made on the first write and replaced thereafter. */
export const writePage = mutation({
  args: { sessionId: v.id("sessions"), characterId: v.id("characters"), page: pageIndex, ...pageFields },
  returns: v.id("notebookPages"),
  handler: async (ctx, args) => {
    await requireHand(ctx, args.sessionId, args.characterId)
    requirePage(args.page)
    const { sessionId, characterId, page, notes, ink, shapes, order } = args
    const existing = await ctx.db
      .query("notebookPages")
      .withIndex("by_characterId_page", (q) => q.eq("characterId", characterId).eq("page", page))
      .unique()
    const row = { sessionId, characterId, page, notes, ink, shapes, order }
    if (existing === null) return await ctx.db.insert("notebookPages", row)
    await ctx.db.replace(existing._id, row)
    return existing._id
  },
})

/** The ribbon laid at a page. */
export const setMark = mutation({
  args: { sessionId: v.id("sessions"), characterId: v.id("characters"), mark: pageIndex },
  returns: v.id("notebooks"),
  handler: async (ctx, args) => {
    await requireHand(ctx, args.sessionId, args.characterId)
    requirePage(args.mark)
    const existing = await ctx.db
      .query("notebooks")
      .withIndex("by_characterId", (q) => q.eq("characterId", args.characterId))
      .unique()
    const row = { sessionId: args.sessionId, characterId: args.characterId, mark: args.mark }
    if (existing === null) return await ctx.db.insert("notebooks", row)
    await ctx.db.patch(existing._id, { mark: args.mark })
    return existing._id
  },
})
