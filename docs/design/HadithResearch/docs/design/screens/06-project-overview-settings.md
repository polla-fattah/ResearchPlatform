# 06 · Project overview and settings

**Release:** R1a · **Status:** Draft · **Requirements:** PRJ-03 to 07

**Design:** `06 Project Overview.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Orient the researcher in one project: scope, stage, evidence counts by state, open questions, next actions.

## Views in the design

- Overview
- Copy to project
- Settings

## Entry points

Opening a project; Overview in project navigation.

## Actions

- Change stage
- Copy resources, queries or analyses to another project (with visibility preview)
- Archive
- Trash and restore

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Empty project: first steps are collecting sources and saving a search. |
| loading | Define skeleton or progress. |
| error | Progress numbers always show their denominator or are labelled as manual estimates. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
