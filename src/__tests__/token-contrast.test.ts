import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";

/**
 * The a11y floor's contrast planks (ADR-0021, enforced by #72): text tokens
 * must clear WCAG AA 4.5:1 on the surfaces they sit on. This is what forced
 * the --dim amendment (the Pass-4 #797488 measured ~4.3:1 on --panel); the
 * test guards the amendment forever, straight off the token source of truth.
 */

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

const token = (name: string): string => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  expect(
    match,
    `token --${name} must be a 6-digit hex in styles.css`,
  ).not.toBeNull();
  return match![1]!;
};

const channels = (hex: string): ReadonlyArray<number> =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

const luminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrast = (text: string, surface: string): number => {
  const a = luminance(text);
  const b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

describe("identity token contrast (the a11y floor)", () => {
  const surfaces = ["panel", "bg"] as const;
  const texts = ["ink", "dim"] as const;

  texts.forEach((text) =>
    surfaces.forEach((surface) =>
      it(`--${text} clears 4.5:1 on --${surface}`, () => {
        expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(
          4.5,
        );
      }),
    ),
  );
});
