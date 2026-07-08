import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { Mana } from "../quantities"
import { issueMessages, standardSchemaFor, submitErrorMessage } from "#/lib/form"

/**
 * The flat-form helpers (ADR-0020, issue #70): domain Schemas feed TanStack
 * Form through Standard Schema with table language on the failures, and the
 * form-level error unwraps from TanStack's onSubmit slot (which stores the
 * whole `{ form, fields }` return of onSubmitAsync, not just the message).
 */

const GateShape = Schema.Struct({ mana: Mana })
const standard = standardSchemaFor(GateShape)

const issuesOf = (input: unknown) => {
  const result = standard["~standard"].validate(input)
  if (result instanceof Promise) throw new Error("expected sync validation")
  return "issues" in result ? (result.issues ?? []) : []
}

describe("standardSchemaFor", () => {
  it("accepts a valid working copy", () => {
    expect(issuesOf({ mana: 3 })).toEqual([])
  })

  it("keeps the check language for a failed .check() — already table-friendly", () => {
    const issues = issuesOf({ mana: 2.5 })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toEqual(["mana"])
    expect(issues[0]?.message).toBe("Expected an integer, got 2.5")
  })

  it("replaces the wrong-type default with table language", () => {
    const issues = issuesOf({ mana: "five" })
    expect(issues[0]?.path).toEqual(["mana"])
    expect(issues[0]?.message).toBe("That's the wrong kind of value.")
  })

  it("replaces the missing-key default with table language", () => {
    const issues = issuesOf({})
    expect(issues[0]?.path).toEqual(["mana"])
    expect(issues[0]?.message).toBe("This field is required.")
  })
})

describe("submitErrorMessage", () => {
  it("unwraps the form-level message from an onSubmitAsync return", () => {
    expect(submitErrorMessage({ form: "Not enough Mana: need 8, have 7." })).toBe(
      "Not enough Mana: need 8, have 7.",
    )
  })

  it("tolerates the fields key riding alongside — TanStack stores the whole return", () => {
    expect(
      submitErrorMessage({ form: "Refused.", fields: { mana: "too low" } }),
    ).toBe("Refused.")
  })

  it("passes a bare string through", () => {
    expect(submitErrorMessage("Something went wrong.")).toBe("Something went wrong.")
  })

  it("is null when there is no error or no form-level message", () => {
    expect(submitErrorMessage(undefined)).toBeNull()
    expect(submitErrorMessage(null)).toBeNull()
    expect(submitErrorMessage({ fields: { mana: "too low" } })).toBeNull()
  })
})

describe("issueMessages", () => {
  it("extracts messages from Standard Schema issues, skipping anything else", () => {
    expect(
      issueMessages([
        { message: "Expected an integer, got 2.5", path: ["mana"] },
        "not an issue object",
        null,
      ]),
    ).toEqual(["Expected an integer, got 2.5"])
  })

  it("is empty for no errors", () => {
    expect(issueMessages([])).toEqual([])
  })
})
