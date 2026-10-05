# 30 · Narrator dossier: dates and teachers

**Release:** R2 · **Status:** Draft — specialist review required before build · **Requirements:** ANA-10, ANA-11, EVI-08

**Design:** `30 Narrator Dossier.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Date intervals.

## Views in the design

- Date intervals
- Meeting/audition evidence
- Temporal check result
- Teacher-specific assessment
- Historical assertions with alternatives

## Entry points

See [../navigation-map.md](../navigation-map.md).

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Says why it is empty and offers the next action. |
| loading | Skeleton or job progress; long jobs show an acknowledgement. |
| error | Input kept; actionable message; partial results never labelled complete. |
| forbidden | Does not reveal whether a private object exists. |
| conflict | As drawn, or not applicable if the screen does not write shared data. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of the analysis model and sample content (sample texts in the design are placeholders).
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`) and the matching section 14 tests.
