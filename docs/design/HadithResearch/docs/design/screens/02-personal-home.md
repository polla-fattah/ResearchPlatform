# 02 · Personal home

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-05, PRJ-02, EXP-06

**Design:** `02 Personal Home.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Show the researcher what to do next: recent projects, assigned tasks, pending exports, relevant updates.

## Views in the design

- Home with projects, next actions, exports

## Entry points

After sign-in; Home in account navigation.

## Actions

- Open or continue a project
- Create project
- Open a download

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | New account: empty home that points to creating a first project and saving a first source. |
| loading | Skeleton blocks; no layout shift. |
| error | Define error text; input is preserved. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
