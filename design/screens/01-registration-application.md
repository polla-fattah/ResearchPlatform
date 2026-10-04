# 01 · Registration and application

**Release:** R1a · **Status:** Draft · **Requirements:** ACC-01, ACC-02, ACC-03, ACC-04

## Purpose

Let a visitor apply for researcher access, verify their email, track the application, and sign in or recover access.

## Entry points

Public site header (Sign in / Apply); email verification link; approval or information-request email.

## Layout regions

- Application form
- Verification status
- Application status page with administrator reasons or requests
- Sign-in and recovery

## Actions

- Submit application
- Resend verification (rate limited)
- Answer an information request
- Sign in
- Recover password

## States

| State | Behaviour |
|---|---|
| normal | Describe the main layout in the wireframe. |
| empty | First visit: form with required fields marked; optional affiliation and biography clearly optional. |
| loading | Define skeleton or progress. |
| error | Expired or used verification link fails safely with a way to request a new one; errors keep the entered input. |
| forbidden | Pending or rejected applicants see their status page only, never researcher screens. |
| conflict | Not applicable in this screen unless noted. |

## Conventions applied

See [../conventions.md](../conventions.md): provenance labels, visibility labels, counted units, unknown states, bidirectional text, safe actions.

## Open questions

- [ ] Wireframe link:
- [ ] Specialist review of labels:

## Acceptance

Use the minimum acceptance criteria for the listed IDs in the SRS (`../Open_Hadith_Research_Platform_Requirements.md`, section 6) and the tests listed in section 14.4.
