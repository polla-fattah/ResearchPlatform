# 01 · Registration and application

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-01 to 04

**Design:** `01 Registration.dc.html` (HadithResearch design project). Layout, content and all six states are drawn there; this spec holds only what the design cannot show.

## Purpose

Let a visitor apply for researcher access, verify their email, track the application, and sign in or recover access.

## Views in the design

- Apply
- Verify email
- Application status
- Sign in
- Recover

## Entry points

Public site header (Sign in / Apply); email verification link; approval or information-request email.

## Actions

- Submit application
- Resend verification (rate limited)
- Answer an information request
- Sign in
- Recover password

## States

| State | Behaviour |
|---|---|
| normal | As drawn in the design file. |
| empty | First visit: form with required fields marked; optional affiliation and biography clearly optional. |
| loading | Define skeleton or progress. |
| error | Expired or used verification link fails safely with a way to request a new one; errors keep the entered input. |
| forbidden | Pending or rejected applicants see their status page only, never researcher screens. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance, visibility, counted units, neutral unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
