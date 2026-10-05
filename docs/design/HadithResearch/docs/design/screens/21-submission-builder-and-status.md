# 21 · Submission builder and status

**Release:** R1c · **Status:** Draft · **Requirements:** PUB-01, 02, 06, 12, WRT-07

**Design:** `21 Submission.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Select findings/docs.

## Views in the design

- Select findings/docs
- Authors and consent
- Rights and licence
- Public vs internal preview
- Freeze package
- Status and revision response

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
| conflict | Compare both versions and recover (conventions §6). |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`) and the matching section 14 tests.
