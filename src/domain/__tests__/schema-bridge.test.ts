import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"
import { v, type GenericValidator } from "convex/values"
import {
  ConvexBytes,
  ConvexId,
  ConvexInt64,
  schemaToConvexValidator,
} from "../schema-bridge"

/** Convex validators compare cleanly through their structural `.json` form. */
const json = (validator: GenericValidator): unknown =>
  (validator as unknown as { readonly json: unknown }).json

describe("schemaToConvexValidator", () => {
  describe("primitives", () => {
    it("string -> v.string()", () => {
      expect(json(schemaToConvexValidator(Schema.String))).toEqual(json(v.string()))
    })

    it("boolean -> v.boolean()", () => {
      expect(json(schemaToConvexValidator(Schema.Boolean))).toEqual(json(v.boolean()))
    })

    it("Number (NaN/Infinity sentinel anyOf) -> v.number()", () => {
      expect(json(schemaToConvexValidator(Schema.Number))).toEqual(json(v.number()))
    })

    it("Int (integer) -> v.number()", () => {
      expect(json(schemaToConvexValidator(Schema.Int))).toEqual(json(v.number()))
    })
  })

  describe("enums / literals", () => {
    it("single Literal -> v.literal", () => {
      expect(json(schemaToConvexValidator(Schema.Literal("public")))).toEqual(
        json(v.literal("public")),
      )
    })

    it("Literals -> v.union of literals, order preserved", () => {
      expect(
        json(schemaToConvexValidator(Schema.Literals(["storyteller", "player"]))),
      ).toEqual(json(v.union(v.literal("storyteller"), v.literal("player"))))
    })
  })

  describe("arrays", () => {
    it("array of number -> v.array(v.number())", () => {
      expect(json(schemaToConvexValidator(Schema.Array(Schema.Number)))).toEqual(
        json(v.array(v.number())),
      )
    })

    it("array of struct -> v.array(v.object(...))", () => {
      const schema = Schema.Array(
        Schema.Struct({ name: Schema.String, dots: Schema.Number }),
      )
      expect(json(schemaToConvexValidator(schema))).toEqual(
        json(v.array(v.object({ name: v.string(), dots: v.number() }))),
      )
    })
  })

  describe("objects & optionality", () => {
    it("required fields stay required; optionalKey -> v.optional", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.optionalKey(Schema.String),
      })
      expect(json(schemaToConvexValidator(schema))).toEqual(
        json(v.object({ a: v.string(), b: v.optional(v.string()) })),
      )
    })

    it("resolves a top-level $ref (Schema.Class) against definitions", () => {
      class Point extends Schema.Class<Point>("Point")({
        x: Schema.Number,
        y: Schema.Number,
      }) {}
      expect(json(schemaToConvexValidator(Point))).toEqual(
        json(v.object({ x: v.number(), y: v.number() })),
      )
    })

    it("resolves a nested $ref field", () => {
      class Inner extends Schema.Class<Inner>("Inner")({ n: Schema.String }) {}
      const schema = Schema.Struct({ inner: Inner, flag: Schema.Boolean })
      expect(json(schemaToConvexValidator(schema))).toEqual(
        json(v.object({ inner: v.object({ n: v.string() }), flag: v.boolean() })),
      )
    })
  })

  describe("unions", () => {
    it("union of structs (anyOf) -> v.union of objects", () => {
      const schema = Schema.Union([
        Schema.Struct({ kind: Schema.Literal("a"), x: Schema.String }),
        Schema.Struct({ kind: Schema.Literal("b"), y: Schema.String }),
      ])
      expect(json(schemaToConvexValidator(schema))).toEqual(
        json(
          v.union(
            v.object({ kind: v.literal("a"), x: v.string() }),
            v.object({ kind: v.literal("b"), y: v.string() }),
          ),
        ),
      )
    })
  })

  describe("convex-native annotation convention", () => {
    it("ConvexId(table) -> v.id(table)", () => {
      expect(json(schemaToConvexValidator(ConvexId("sessions")))).toEqual(
        json(v.id("sessions")),
      )
    })

    it("ConvexInt64 -> v.int64()", () => {
      expect(json(schemaToConvexValidator(ConvexInt64))).toEqual(json(v.int64()))
    })

    it("ConvexBytes -> v.bytes()", () => {
      expect(json(schemaToConvexValidator(ConvexBytes))).toEqual(json(v.bytes()))
    })

    it("ConvexId inside a struct field -> v.id(table)", () => {
      const schema = Schema.Struct({
        sessionId: ConvexId("sessions"),
        name: Schema.String,
      })
      expect(json(schemaToConvexValidator(schema))).toEqual(
        json(v.object({ sessionId: v.id("sessions"), name: v.string() })),
      )
    })
  })

  describe("loud failure on unsupported constructs", () => {
    it("throws rather than mis-compiling an unrepresentable node", () => {
      // `Schema.Unknown` produces a node with no `type` we can project onto v.*
      expect(() => schemaToConvexValidator(Schema.Unknown)).toThrow(
        /unsupported/i,
      )
    })
  })
})
