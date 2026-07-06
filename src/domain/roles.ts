import { Schema } from "effect"

// Session roles
export const SessionRole = Schema.Literals(["player", "storyteller"])
export type SessionRole = typeof SessionRole.Type
