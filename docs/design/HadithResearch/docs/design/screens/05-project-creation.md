# 05 · Project creation

**Release:** R1a · **Status:** Draft · **Requirements:** PRJ-01, 04

**Design:** `05 Project Creation.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Create a private project with a clear question and scope.

## Views in the design

- Create form
- Privacy note

## Entry points

Create project button on Home and Project index.

## Actions

- Create
- Cancel

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Validation errors are labelled and input is preserved. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
