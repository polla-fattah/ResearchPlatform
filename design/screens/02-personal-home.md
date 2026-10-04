# 02 · Personal home

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-05, PRJ-02, EXP-06

## Purpose

Show the researcher what to do next: recent projects, assigned tasks, pending exports, relevant updates.

## Entry points

After sign-in; Home in account navigation.

## Layout regions

- Recent and owned/shared projects
- Next actions
- Incomplete or finished exports
- Notifications summary (R1b adds tasks and review requests)

## Actions

- Open or continue a project
- Create project
- Open a download

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | New account: empty home that points to creating a first project and saving a first source. |
| loading | Skeleton blocks; no layout shift. |
| error | Define error text; input is preserved. |
| forbidden | Define the response without revealing private existence. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
