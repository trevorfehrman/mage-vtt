# Typed errors are a client-facing contract, organized in four categories

Enforced flows surface a closed, co-located set of `Schema.TaggedErrorClass`
failures. `runConvexEffect` maps a typed **Fail** to a `ConvexError` whose `.data`
is `{ _tag, ...fields }`; a **Die** (defect) is rethrown as a generic error. The
client switches on `_tag`, grouped into four actionable categories plus a generic
fallback. Errors are defined **beside the code that raises them** — not in a
central grab-bag.

## Categories

- **Authorization** — `NotAMember`, `NotYourCharacter`, `NotStoryteller` (in
  `authz.ts`). Distinct tags, *not* a stringly `Unauthorized { reason }`, so tests
  and the client can switch on the specific case.
- **Not found** — a single generic `DocumentNotFound { table, id }` (in domain
  `ports/`, imported by the bridge). Ports fail this instead of returning null; we
  do *not* proliferate per-entity `CharacterNotFound`/`SessionNotFound`.
- **Rules / precondition** — `InsufficientMana`, `VulgarCastingNotYetSupported`
  (later `SpellLimitExceeded`), each in the leaf that raises it.
- **Validation** — `InvalidPoolComponent` and kin, in `dice.ts` etc.
- **Unknown / defect** — any `Die`, or an unrecognized `_tag`, renders as a generic
  "something went wrong."

## Why

The client had no error handling yet, so the taxonomy is greenfield — and the
existing `src/domain/errors.ts` was dead code (defined-but-unused, and duplicated
`session.ts`'s `SessionNotFound`). The codebase's real pattern is co-located
errors, so we keep that and delete the grab-bag.

The **Fail/Die split** is load-bearing: expected, actionable failures carry a
`_tag` the UI can respond to specifically; bugs (defects) surface generically and
are never dressed up as handleable — pretending a bug is actionable hides it.

## Consequences

- **`_tag`s are public API.** Because the client dispatches on them, renaming an
  error tag is a breaking change. Treat the tag set as a contract; add freely,
  rename deliberately.
- **Delete `src/domain/errors.ts`** and its duplicate `SessionNotFound` during the
  tracer-bullet cleanup, leaving one home per error.
- **Forward-compatible client:** unknown `_tag`s fall through to the generic
  category, so adding a new server error never breaks an older client — it just
  degrades to the generic message until the client learns the new tag.
