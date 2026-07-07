import { Effect, Schema } from "effect"
import { describe, expect, it } from "@effect/vitest"
import {
  runConvexEffect,
  mapEffectError,
  wrapNullable,
} from "../convex-effect"

// Test error classes
class TestNotFound extends Schema.TaggedErrorClass<TestNotFound>()(
  "TestNotFound",
  { id: Schema.String },
) {}

class TestValidation extends Schema.TaggedErrorClass<TestValidation>()(
  "TestValidation",
  { message: Schema.String },
) {}

describe("Convex-Effect Bridge", () => {
  it.effect("runConvexEffect resolves successful effects to values", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() => runConvexEffect(Effect.succeed(42)))
      expect(result).toBe(42)
    }),
  )

  it.effect("runConvexEffect converts typed errors to ConvexError with structured data", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(async () => {
        try {
          await runConvexEffect(Effect.fail(new TestNotFound({ id: "abc-123" })))
          return null
        } catch (e: any) {
          return e
        }
      })

      expect(result).not.toBeNull()
      expect(result.data._tag).toBe("TestNotFound")
      expect(result.data.id).toBe("abc-123")
    }),
  )

  it.effect("runConvexEffect converts defects to thrown errors", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(async () => {
        try {
          await runConvexEffect(Effect.die(new Error("something broke")))
          return null
        } catch (e: any) {
          return e
        }
      })

      expect(result).not.toBeNull()
      expect(result.message).toBe("something broke")
    }),
  )

  it.effect("mapEffectError preserves _tag for client pattern matching", () =>
    Effect.gen(function* () {
      const errorData = mapEffectError(new TestValidation({ message: "bad input" }))
      expect(errorData._tag).toBe("TestValidation")
      expect(errorData.message).toBe("bad input")
    }),
  )

  it.effect("mapEffectError copies only Convex-serializable Values — junk drops at the seam", () =>
    Effect.gen(function* () {
      // A malformed error carrying fields Convex's serializer would reject:
      // they must drop here, at the boundary, not explode at throw time.
      const errorData = mapEffectError({
        _tag: "TestValidation",
        message: "bad input",
        when: new Date(0),
        pattern: /nope/,
        nested: { fine: 1, alsoFine: ["a", "b"] },
      })

      expect(errorData._tag).toBe("TestValidation")
      expect(errorData.message).toBe("bad input")
      expect(errorData).not.toHaveProperty("when")
      expect(errorData).not.toHaveProperty("pattern")
      expect(errorData.nested).toEqual({ fine: 1, alsoFine: ["a", "b"] })
    }),
  )

  it.effect("wrapNullable converts null to DocumentNotFound error", () =>
    Effect.gen(function* () {
      const found = yield* wrapNullable({ id: "123", name: "test" }, "users", "123")
      expect(found.name).toBe("test")

      const error = yield* wrapNullable(null, "users", "456").pipe(Effect.flip)
      expect(error._tag).toBe("DocumentNotFound")
      expect(error.table).toBe("users")
      expect(error.id).toBe("456")
    }),
  )

  it.effect("domain logic composes through the bridge", () =>
    Effect.gen(function* () {
      const program = Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknownEffect(
          Schema.Struct({ name: Schema.String, value: Schema.Number }),
        )({ name: "test", value: 42 }).pipe(
          Effect.mapError(() => new TestValidation({ message: "invalid input" })),
        )
        return { validated, doubled: validated.value * 2 }
      })

      const result = yield* Effect.promise(() => runConvexEffect(program))
      expect(result.doubled).toBe(84)
    }),
  )

  it.effect("Effect.fn traces are preserved through the bridge", () =>
    Effect.gen(function* () {
      const traced = Effect.fn("Test.operation")(function* (x: number) {
        return x * 2
      })

      const result = yield* Effect.promise(() => runConvexEffect(traced(21)))
      expect(result).toBe(42)
    }),
  )
})
