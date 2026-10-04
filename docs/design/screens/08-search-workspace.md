# 08 · Search workspace

**Release:** R1a · **Status:** Draft · **Requirements:** SEA-01, SEA-02, SEA-03, SEA-04, SEA-05, SEA-06, SEA-07, SEA-08

## Purpose

Search the corpus, understand why results matched, save queries and preserve result sets.

## Entry points

Searches in project navigation; global search.

## Layout regions

- Query box with visible mode (exact original / normalized)
- Typed filters (book, author, chapter, section, report type, narrator, chain relationship, critic, hukm, dates)
- Results with type, locator, matched passage, chain info, match reason
- Run history for a saved query
- Selection bar

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
| normal | Describe the main layout in the wireframe. |
| empty | No matches: suggest relaxing filters; state which mode was used. |
| loading | Long-running queries show progress and a job acknowledgement. |
| error | Interrupted search is marked partial and never labelled complete; retry offered. |
| forbidden | Define the response without revealing private existence. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
