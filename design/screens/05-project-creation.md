# 05 · Project creation

**Release:** R1a · **Status:** Draft · **Requirements:** PRJ-01, PRJ-04

## Purpose

Create a private project with a clear question and scope.

## Entry points

Create project button on Home and Project index.

## Layout regions

- Title, question, scope, language
- Privacy note: private by default
- Template choice (blank only in R1a; templates are PRJ-08 in R2)

## Actions

- Create
- Cancel

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Validation errors are labelled and input is preserved. |
| forbidden | Define the response without revealing private existence. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
