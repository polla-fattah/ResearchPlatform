# 04 · Project index

**Release:** R1a · **Status:** Draft · **Requirements:** PRJ-01, 02, 04, 07

**Design:** `04 Project Index.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

List all projects the researcher owns or has joined and let them filter and open them.

## Views in the design

- Owned/shared
- Filters
- Archive
- Trash

## Entry points

Projects in account navigation.

## Actions

- Open project
- Create project
- Archive or unarchive
- Move to trash and restore

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | No projects: explain what a project is and offer creation. |
| loading | Define skeleton or progress. |
| error | Define error text; input is preserved. |
| forbidden | A removed project disappears from the list (R1b). |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
