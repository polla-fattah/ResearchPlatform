# 04 · Project index

**Release:** R1a · **Status:** Draft · **Requirements:** PRJ-01, PRJ-02, PRJ-04, PRJ-07

## Purpose

List all projects the researcher owns or has joined and let them filter and open them.

## Entry points

Projects in account navigation.

## Layout regions

- Owned and shared filter
- Filters: stage, tag, title, archived, recent activity
- Project rows with stage, last update, next action

## Actions

- Open project
- Create project
- Archive or unarchive
- Move to trash and restore

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | No projects: explain what a project is and offer creation. |
| loading | Define skeleton or progress. |
| error | Define error text; input is preserved. |
| forbidden | A removed project disappears from the list (R1b). |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
