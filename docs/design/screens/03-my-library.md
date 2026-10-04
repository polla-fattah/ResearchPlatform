# 03 · My Library

**Release:** R1a · **Status:** Draft · **Requirements:** LIB-01, LIB-02, LIB-03, LIB-05, LIB-07, LIB-08, LIB-09

## Purpose

Hold the researcher's saved sources, references, collections, tags and private notes across all projects.

## Entry points

Account navigation; Save to My Library from corpus pages.

## Layout regions

- Search and filter bar (type, source, date)
- Collections sidebar
- Item list with type icon and ID
- Item detail with personal notes and linked projects

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
| normal | Describe the main layout in the wireframe. |
| empty | Explain how to save the first source; no blank table. |
| loading | Define skeleton or progress. |
| error | A deleted or merged corpus target shows a status and the preserved snapshot, with the saved locator still visible (LIB-08). |
| forbidden | Define the response without revealing private existence. |
| conflict | Saving the same book twice prompts reuse; two different page passages create two excerpts (LIB-07). |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
