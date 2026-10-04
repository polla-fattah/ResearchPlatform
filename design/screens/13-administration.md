# 13 · Administration

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-03, ACC-07, ACC-08, ADM-01, ADM-03, ADM-04, ADM-05, ADM-06

## Purpose

Let administrators approve applicants, suspend accounts, manage quotas and jobs, and review audit and operations dashboards.

## Entry points

Administrator-only area; multi-factor authentication required.

## Layout regions

- Application queue with reasons and requests
- Suspension and role management
- Quotas, allowed types, job failures, rate limits and abuse reports
- Support access grants with scope and duration
- Audit viewer and operations dashboard

## Actions

- Approve, reject with reason or request information
- Suspend or reactivate with reason
- Grant time-bounded support access
- Review job failures

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | Define empty-state text and next action. |
| loading | Define skeleton or progress. |
| error | Audit entries cannot be edited from this UI. |
| forbidden | Ordinary admin search never shows private evidence; expired support grants fail. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
