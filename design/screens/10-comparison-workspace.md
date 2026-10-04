# 10 · Comparison workspace

**Release:** R1a · **Status:** Draft · **Requirements:** ANA-01, ANA-02, ANA-03, ANA-04, ANA-05

## Purpose

Compare selected occurrences and chains side by side and inspect narrators and criticism.

## Entry points

Analysis in project navigation; Compare from selected results or evidence.

## Layout regions

- Side-by-side occurrence view with source headers
- Chain list view with narrator and formula inspection
- Narrator dossier (identity, teachers/students, related reports, attributed criticism)
- Criticism comparison with exact qawl text
- Inspector panel and saved-analysis bar

## Actions

- Select inputs
- Annotate differences
- Open narrator or ambiguity record
- Save analysis (inputs, settings, version)
- Rerun as new version

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Unresolved chain order is shown as uncertain; missing narrator information is labelled unknown. |
| loading | Define skeleton or progress. |
| error | When occurrence-specific wording is missing, show a limitation notice instead of invented variants. |
| forbidden | Define the response without revealing private existence. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
