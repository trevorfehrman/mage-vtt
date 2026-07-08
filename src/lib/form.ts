import { Option, Schema, type SchemaIssue } from "effect"

/**
 * Flat-form plumbing (ADR-0020, issue #70): the one bridge from a domain
 * Schema to TanStack Form. The Schema supplies the rules (representability,
 * ADR-0011); TanStack supplies the slots — values, dirty, per-field errors.
 * Validation happens in Encoded space (the working copy is plain numbers and
 * strings); branding waits for `Schema.decodeSync` at the submit boundary.
 */

/** Table language for the structural failures whose defaults read as
 * developer debug output ("Expected string & minLength(1), got null"). Check
 * failures keep the built-in fallback — "Expected an integer, got 2.5" is
 * already something a Storyteller can act on. */
const LEAF_LANGUAGE: Record<SchemaIssue.Leaf["_tag"], string> = {
  InvalidType: "That's the wrong kind of value.",
  InvalidValue: "That value isn't allowed.",
  MissingKey: "This field is required.",
  UnexpectedKey: "That field doesn't belong here.",
  Forbidden: "That change isn't allowed.",
  OneOf: "Pick exactly one.",
}

/** A domain Schema as a Standard Schema v1 object, ready for
 * `useForm({ validators: { onChange: … } })`. */
export const standardSchemaFor = <S extends Parameters<typeof Schema.toStandardSchemaV1>[0]>(
  schema: S,
) =>
  Schema.toStandardSchemaV1(schema, {
    leafHook: (issue) => LEAF_LANGUAGE[issue._tag],
  })

/** What TanStack stores in `errorMap.onSubmit`: the *whole* `{ form, fields }`
 * return of an `onSubmitAsync` validator, not just the message. */
const SubmitReturn = Schema.Struct({ form: Schema.String })
const decodeSubmitReturn = Schema.decodeUnknownOption(SubmitReturn)

/** The form-level message out of `state.errorMap.onSubmit`, unwrapped. */
export const submitErrorMessage = (error: unknown): string | null => {
  if (typeof error === "string") return error
  return Option.getOrNull(
    Option.map(decodeSubmitReturn(error), (wrapped) => wrapped.form),
  )
}

/** Per-field messages out of `field.state.meta.errors`, which holds Standard
 * Schema issue objects when a Standard Schema validator is wired. */
export const issueMessages = (errors: ReadonlyArray<unknown>): Array<string> =>
  errors.flatMap((issue) =>
    Option.toArray(
      Option.map(
        decodeIssue(issue),
        (decoded) => decoded.message,
      ),
    ),
  )

const decodeIssue = Schema.decodeUnknownOption(
  Schema.Struct({ message: Schema.String }),
)
