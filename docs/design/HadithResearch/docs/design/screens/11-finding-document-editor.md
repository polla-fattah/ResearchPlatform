# 11 · Finding and document editor

**Release:** R1a · **Status:** Draft · **Requirements:** WRT-01 to 06, EVI-03, 05, 06

**Design:** `11 Finding Editor.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Write findings and documents in structured Markdown with citations and version history.

## Views in the design

- Editor
- Finding panel
- Citation
- Versions
- Conflict

## Entry points

Findings & Documents in project navigation.

## Actions

- Write and autosave
- Insert evidence citation
- Link finding to evidence
- Compare or restore a version
- Create finding or document

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Missing citation components are flagged, never guessed. |
| loading | Define skeleton or progress. |
| error | Offline or failed save shows an unsaved state and recovers the local draft; it never shows saved falsely. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | A stale save from a second session is rejected with a compare and recover path; text is never discarded. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
