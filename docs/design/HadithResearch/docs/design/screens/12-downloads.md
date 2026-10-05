# 12 · Downloads

**Release:** R1a · **Status:** Draft · **Requirements:** EXP-01 to 04, 06 to 10

**Design:** `12 Downloads.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Export a document, selected resources, a project or all research, and track export jobs.

## Views in the design

- New export
- Scope preview
- Jobs
- Parts
- Quota

## Entry points

Downloads in account navigation; Export actions on other screens.

## Actions

- Start export
- Cancel
- Retry
- Regenerate expired package
- Download part

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | No exports yet: explain scope options and expiry (7 days). |
| loading | Define skeleton or progress. |
| error | Partial or failed jobs are never labelled complete; exclusions are listed with reasons. |
| forbidden | Access revoked before download blocks the affected material and explains why. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
