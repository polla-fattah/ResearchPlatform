# 10 · Comparison workspace

**Release:** R1a · **Status:** Draft · **Requirements:** ANA-01 to 05

**Design:** `10 Comparison Workspace.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Compare selected occurrences and chains side by side and inspect narrators and criticism.

## Views in the design

- Occurrences
- Chains
- Narrator dossier
- Criticism

## Entry points

Analysis in project navigation; Compare from selected results or evidence.

## Actions

- Select inputs
- Annotate differences
- Open narrator or ambiguity record
- Save analysis (inputs, settings, version)
- Rerun as new version

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Unresolved chain order is shown as uncertain; missing narrator information is labelled unknown. |
| loading | Define skeleton or progress. |
| error | When occurrence-specific wording is missing, show a limitation notice instead of invented variants. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
