# 07 · Resource picker

**Release:** R1a · **Status:** Draft · **Requirements:** LIB-01, 03, 07, SEA-08

**Design:** `07 Resource Picker.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Find and add corpus sources and external references to a library or project.

## Views in the design

- Corpus search
- External reference
- Duplicate prompt

## Entry points

Add resource buttons in My Library and project Resources.

## Actions

- Add corpus resource
- Add external reference with incomplete metadata
- Choose excerpt
- Resolve duplicate prompt

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Incomplete citation is allowed and visibly flagged; unknown metadata is never invented. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Duplicate additions show the existing association and allow a distinct excerpt. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
