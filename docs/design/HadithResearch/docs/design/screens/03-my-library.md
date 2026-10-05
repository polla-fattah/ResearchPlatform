# 03 · My Library

**Release:** R1a · **Status:** Draft · **Requirements:** LIB-01, 02, 03, 05, 07, 08, 09

**Design:** `03 My Library.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Hold the researcher's saved sources, references, collections, tags and private notes across all projects.

## Views in the design

- Library
- Item detail
- Add to project with sharing preview
- Duplicate prompt

## Entry points

Account navigation; Save to My Library from corpus pages.

## Actions

- Favourite
- Tag
- Add to collection
- Add private note
- Add to project (with sharing preview)
- Remove association
- Add external reference

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Explain how to save the first source; no blank table. |
| loading | Define skeleton or progress. |
| error | A deleted or merged corpus target shows a status and the preserved snapshot, with the saved locator still visible (LIB-08). |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Saving the same book twice prompts reuse; two different page passages create two excerpts (LIB-07). |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
