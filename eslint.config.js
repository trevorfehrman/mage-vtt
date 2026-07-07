/**
 * Guardrails, not a style bath (issue #56): each rule mechanically enforces a
 * documented convention that prose alone failed to hold. This config is the
 * source of truth for what is banned where; CLAUDE.md points here.
 */
import tseslint from "typescript-eslint"

/** ADR-0018: switch is banned everywhere, zero exceptions — dispatch is Match. */
const noSwitch = {
  selector: "SwitchStatement",
  message:
    "switch is banned — dispatch through Match: Match.exhaustive for closed unions, Match.orElse for open spaces (ADR-0018).",
}

/** ADR-0014: domain failures ride the Effect error channel. */
const noTry = {
  selector: "TryStatement",
  message:
    "domain failures ride the Effect error channel — Schema.TaggedErrorClass, not try/catch (ADR-0014). The one sanctioned try lives in convex-effect.ts.",
}

/** ADR-0014: ambient nondeterminism goes through Effect's service doors. */
const noAmbientDoors = [
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      "randomness goes through the Random service (Random.nextIntBetween, Random.withSeed) — ADR-0014.",
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "time goes through the Clock service (Clock.currentTimeMillis) — ADR-0014.",
  },
  {
    selector: "CallExpression[callee.object.name='process'][callee.property.name='exit']",
    message: "domain code never exits the process — fail through the Effect error channel.",
  },
]

export default [
  {
    ignores: [
      "dist/**",
      ".output/**",
      ".nitro/**",
      ".tanstack/**",
      ".vercel/**",
      "convex/_generated/**",
      "src/routeTree.gen.ts",
      // Throwaway prototypes marked DELETE-once-specced are not a convention
      // surface (ADR-0018 skips them rather than converting them).
      "src/routes/prototype/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    // "No allowlist, no inline disables" (ADR-0018) is itself mechanical: a
    // // eslint-disable comment is inert, not a negotiation.
    linterOptions: { noInlineConfig: true },
  },
  // Rule 1 — repo-wide switch ban. No allowlist, no inline disables.
  {
    files: ["src/**/*.{ts,tsx}", "convex/**/*.ts", "scripts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", noSwitch],
    },
  },
  // Rules 3 + 4 — the domain additionally bans try/catch and ambient
  // nondeterminism. (Later blocks replace, not merge, the rule for matching
  // files, so every block restates the full selector set that applies.)
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", noSwitch, noTry, ...noAmbientDoors],
    },
  },
  {
    // The seam's sanctioned try (convex-effect.ts) and tests asserting on
    // thrown validators keep every ban except the try ban.
    files: ["src/domain/convex-effect.ts", "src/domain/__tests__/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", noSwitch, ...noAmbientDoors],
    },
  },
  // Rule 2 — tests import @effect/vitest (it re-exports vitest and adds
  // it.effect / it.scoped), never bare vitest.
  {
    files: ["src/domain/__tests__/**/*.{ts,tsx}", "src/machines/__tests__/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "vitest",
              message:
                'import { describe, expect, it } from "@effect/vitest" instead — it re-exports vitest and adds it.effect / it.scoped.',
            },
          ],
        },
      ],
    },
  },
]
