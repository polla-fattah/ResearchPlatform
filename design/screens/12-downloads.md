# 12 · Downloads

**Release:** R1a · **Status:** Draft · **Requirements:** EXP-01, EXP-02, EXP-03, EXP-04, EXP-06, EXP-07, EXP-08, EXP-09, EXP-10

## Purpose

Export a document, selected resources, a project or all research, and track export jobs.

## Entry points

Downloads in account navigation; Export actions on other screens.

## Layout regions

- Scope chooser (personal and project material shown separately)
- Format chooser: HTML, Markdown, JSON, CSV, BibTeX/RIS, PDF, ZIP
- Scope preview with expected exclusions
- Job list with state, parts, expiry, retry
- Storage and quota display

## Actions

- Start export
- Cancel
- Retry
- Regenerate expired package
- Download part

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | No exports yet: explain scope options and expiry (7 days). |
| loading | Define skeleton or progress. |
| error | Partial or failed jobs are never labelled complete; exclusions are listed with reasons. |
| forbidden | Access revoked before download blocks the affected material and explains why. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
