# 08 · Search workspace

**Release:** R1a · **Status:** Draft · **Requirements:** SEA-01 to 08

**Design:** `08 Search Workspace.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Search the corpus, understand why results matched, save queries and preserve result sets.

## Views in the design

- Query
- Results
- Run history
- Save result set
- Saved searches

## Entry points

Searches in project navigation; global search.

## Actions

- Run
- Save search
- Save selected results
- Save all results from a completed run
- Bulk add to resources or evidence
- Rerun

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | No matches: suggest relaxing filters; state which mode was used. |
| loading | Long-running queries show progress and a job acknowledgement. |
| error | Interrupted search is marked partial and never labelled complete; retry offered. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
