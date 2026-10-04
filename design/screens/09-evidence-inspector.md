# 09 · Evidence inspector

**Release:** R1a · **Status:** Draft · **Requirements:** EVI-01, EVI-02, EVI-03, EVI-04, EVI-05, EVI-06, EVI-07, LIB-08

## Purpose

Show one piece of evidence with its exact passage, locator, provenance, status and notes.

## Entry points

Opening evidence from Search, Resources, Analysis or a document citation.

## Layout regions

- Exact captured text with language and direction
- Locator and source version/hash
- State: candidate, included, reviewed, excluded, unresolved, with reasons
- Annotations by kind and visibility
- Linked findings with relation type
- Dependencies list
- Propose corpus correction

## Actions

- Change state with reason
- Add annotation (private or shared)
- Link to finding
- Propose correction
- Open source, chain, narrator, judgment views

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Missing volume or page is labelled incomplete. |
| forbidden | Another author's private annotations are never shown or exported. |
| conflict | Removing or changing evidence that is in use shows its dependencies first. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
