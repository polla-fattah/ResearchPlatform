# 09 · Evidence inspector

**Release:** R1a · **Status:** Draft · **Requirements:** EVI-01 to 07, LIB-08

**Design:** `09 Evidence Inspector.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Show one piece of evidence with its exact passage, locator, provenance, status and notes.

## Views in the design

- Evidence
- Annotations
- Links
- Dependencies
- Correction

## Entry points

Opening evidence from Search, Resources, Analysis or a document citation.

## Actions

- Change state with reason
- Add annotation (private or shared)
- Link to finding
- Propose correction
- Open source, chain, narrator, judgment views

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Missing volume or page is labelled incomplete. |
| forbidden | Another author's private annotations are never shown or exported. |
| conflict | Removing or changing evidence that is in use shows its dependencies first. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
