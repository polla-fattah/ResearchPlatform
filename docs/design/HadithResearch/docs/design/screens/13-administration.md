# 13 · Administration

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-03, 07, 08, ADM-01, 03 to 06

**Design:** `13 Administration.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Let administrators approve applicants, suspend accounts, manage quotas and jobs, and review audit and operations dashboards.

## Views in the design

- Applications
- Accounts
- Limits
- Support access
- Audit
- Ops

## Entry points

Administrator-only area; multi-factor authentication required.

## Actions

- Approve, reject with reason or request information
- Suspend or reactivate with reason
- Grant time-bounded support access
- Review job failures

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Audit entries cannot be edited from this UI. |
| forbidden | Ordinary admin search never shows private evidence; expired support grants fail. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
