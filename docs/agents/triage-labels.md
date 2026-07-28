# Triage Labels

The skills speak in terms of five canonical triage roles. In this repo's Linear
tracker (team `mage-vtt`) those roles split across **two axes**: lifecycle is a
workflow **state**, routing is a **label**. An issue is in exactly one state and
wears at most one routing label.

| Canonical role  | In our Linear tracker            | Kind  | Meaning                                  |
| --------------- | -------------------------------- | ----- | ---------------------------------------- |
| `needs-triage`  | `needs-triage` label (Backlog)   | label | Maintainer needs to evaluate this issue  |
| `needs-info`    | `needs-info` label *(see note)*  | label | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` label (Todo) | label | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human` label (Todo) | label | Requires human implementation            |
| `wontfix`       | **Canceled** state               | state | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), apply the
corresponding Linear label via `save_issue` `labels`, and set the paired state
where one is shown.

Notes:
- Linear's API **cannot create workflow states**, so the agent/human/triage routing
  lives on labels; only lifecycle position (Backlog / Todo / In Progress / Done /
  Canceled) uses states.
- `ready-for-agent`, `ready-for-human`, and `needs-triage` labels already exist.
  **`needs-info` has no label yet** — create it on first use with
  `create_issue_label` (name `needs-info`, team `mage-vtt`).
