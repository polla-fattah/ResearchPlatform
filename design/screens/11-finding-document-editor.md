# 11 · Finding and document editor

**Release:** R1a · **Status:** Draft · **Requirements:** WRT-01, WRT-02, WRT-03, WRT-04, WRT-05, WRT-06, EVI-03, EVI-05, EVI-06

## Purpose

Write findings and documents in structured Markdown with citations and version history.

## Entry points

Findings & Documents in project navigation.

## Layout regions

- Markdown editor with live preview and per-block direction
- Finding panel: claim, reasoning, supporting/opposing evidence, limitations, status
- Citation inserter (quotation vs paraphrase)
- Version history and compare
- Save state indicator

## Actions

- Write and autosave
- Insert evidence citation
- Link finding to evidence
- Compare or restore a version
- Create finding or document

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Missing citation components are flagged, never guessed. |
| loading | Define skeleton or progress. |
| error | Offline or failed save shows an unsaved state and recovers the local draft; it never shows saved falsely. |
| forbidden | Define the response without revealing private existence. |
| conflict | A stale save from a second session is rejected with a compare and recover path; text is never discarded. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
