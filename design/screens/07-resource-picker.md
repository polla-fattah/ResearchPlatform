# 07 · Resource picker

**Release:** R1a · **Status:** Draft · **Requirements:** LIB-01, LIB-03, LIB-07, SEA-08

## Purpose

Find and add corpus sources and external references to a library or project.

## Entry points

Add resource buttons in My Library and project Resources.

## Layout regions

- Corpus search
- External reference form
- Source details panel
- Visibility choice

## Actions

- Add corpus resource
- Add external reference with incomplete metadata
- Choose excerpt
- Resolve duplicate prompt

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Incomplete citation is allowed and visibly flagged; unknown metadata is never invented. |
| forbidden | Define the response without revealing private existence. |
| conflict | Duplicate additions show the existing association and allow a distinct excerpt. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
