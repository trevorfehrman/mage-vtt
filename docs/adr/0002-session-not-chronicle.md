# The campaign entity is named "Session", not "Chronicle"

The persistent game room — the thing a player joins by invite code and where a
character lives — is called a **Session** throughout the schema, Convex
functions, routes, and UI. In Mage canon the ongoing campaign is a *Chronicle*
and a "session" is a single sitting, so this is a deliberate deviation from
domain vocabulary.

## Why

"Session" is already pervasive in the code (`GameSession`, `sessionId`,
`sessionMemberId`, `/sessions/$sessionId`), and renaming to "Chronicle" would be
wide, churny, and buys little. We accept the small vocabulary infidelity to
avoid the refactor. "Chronicle" survives only as a free-text label on the
character sheet.

## Consequences

A Mage player reading the code may expect "Chronicle" and be tempted to rename —
don't. If we ever need to model individual sittings, introduce a *new* concept
(e.g. a real "Session"/sitting under a renamed "Chronicle") rather than
overloading the existing term.
