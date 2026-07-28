# Issue tracker: Linear

Issues and PRDs for this repo live in **Linear** — workspace `trevorfehrman`, team
`mage-vtt` (issue key `MAG`). Use the `mcp__linear-mage__*` MCP tools. (Migrated
from GitHub on 2026-07-28; the pre-migration GitHub issues are a frozen read-only
archive — `gh issue view <n>` still reads them, and every migrated issue carries a
`gh#NN` backlink.)

> **Access note:** the default `claude.ai Linear` connector is often OAuth'd to a
> *different* workspace (it will list teams that are not `mage-vtt`). Use the
> `linear-mage` server, authenticated to `trevorfehrman`. If its tools are absent:
> `claude mcp add --transport http linear-mage https://mcp.linear.app/mcp`, then
> `/mcp` → authenticate → pick the `trevorfehrman` workspace. Verify with
> `list_teams` — you should see `mage-vtt`.

## Conventions

- **Create an issue**: `save_issue` with `team: "mage-vtt"`, `title`, `description`
  (Markdown — literal characters, never HTML-escape), plus `labels`, `state`, and
  `project`/`milestone` (pass these as **UUIDs**, not names).
- **Read an issue**: `get_issue <MAG-nn>`; add `list_comments` for the thread.
- **List issues**: `list_issues` with `team: "mage-vtt"` and filters `state` /
  `label` / `project` / `milestone` / `assignee` (`"me"` for yours, `null` for
  unassigned).
- **Comment**: `save_comment`.
- **Labels / state**: `save_issue` with `labels` (replaces the whole set) and
  `state` (a state name, e.g. `Todo`, `Done`, `Canceled`).
- **Close**: set `state` to `Done` (or `Canceled` for `wontfix`) via `save_issue`.
- **Blocking**: native relations — `save_issue` with `blockedBy` / `blocks`
  (append-only; `removeBlockedBy` to clear). A ticket is unblocked when every
  blocker is Done.

Projects group multi-ticket campaigns; project **milestones** mark the parts; large
PRDs/Specs live as project **Documents** (`save_document` with a `project` parent).

## Pull requests as a triage surface

**PRs as a request surface: no.** Code PRs live on GitHub and are not a Linear
triage surface.

## Wayfinding operations

Wayfinder efforts run in Linear:

- **The map** is a Linear **project** (or a parent issue) — the index of the
  effort's decisions.
- **Tickets** are issues carrying a `wayfinder:*` label (create the label group on
  first use via `create_issue_label`, team `mage-vtt`) and native `blockedBy`
  relations instead of a `## Blocked by` body section.
- **Claiming**: assign yourself — `save_issue` with `assignee: "me"`. Open +
  unassigned = unclaimed.
- **The frontier**: `list_issues` filtered to the wayfinder label + open state, kept
  to issues with no assignee whose blockers are all Done.
- **Resolving**: `save_comment` the answer, set the issue `state` to `Done`, and
  note the decision on the map project.

## When a skill says "publish to the issue tracker"

Create a Linear issue: `save_issue` with `team: "mage-vtt"`.

## When a skill says "fetch the relevant ticket"

`get_issue <MAG-nn>` (add `list_comments` for the discussion).
