# Live checks owed (run these where the backend can start)

**Why this file exists.** From 7 Oct 2026 the frontend was built in a cloud container whose PHP is 8.3, while the backend
(Laravel 13) needs PHP 8.4, so the backend could not be started and nothing below has been run against a real server.
Every screen in this list was built from the backend's code (controllers, models, routes) and tested with mocked
responses. The contract tests exist, but they have never been executed. A phase checkpoint (the `D8`, `E6`, `F15` boxes in
`FRONTEND_TODO_NEXT.md`) is **not** ticked until the checks for its screens below are done.

## How to run

1. Start the backend as in `FRONTEND_TODO.md` section 0 (PowerShell recipe), seeded with `ScholarlyDemoSeeder`.
2. From `frontend/`:
   `$env:CONTRACT_EMAIL='polla@sue.edu.krd'; $env:CONTRACT_PASSWORD='password123'; $env:CONTRACT_WRITE='1'; npm run test:contract`
3. Read the result as follows.
   - A normal `it(...)` that fails: the test was written from the code and the server does something else. Decide which is
     right (look at the controller and the response), then fix the test or the screen. Do not loosen a test to make it pass.
   - An `it.fails(...)` that **passes** (reported as a failure): the backend defect was fixed. Turn it into a normal `it`,
     update the request file item and the plan.
   - An `it.fails(...)` that fails (reported as passing): still broken, as the request file says.
4. Stop the backend afterwards.

## Contract files, in the order they were written

| File | Screen | Request file | Not yet run |
|---|---|---|---|
| `account-write.test.ts` | 14 Settings | C-21 | yes (5 expected-fail) |
| `members-write.test.ts` | 15 Members | C-22 | yes (5 expected-fail) |
| `discussion-write.test.ts` | 16 Discussion and tasks | C-23 | yes (7 expected-fail) |
| `notifications-write.test.ts` | 17 Notifications | C-24 | yes (3 expected-fail) |
| `activity-write.test.ts` | 18 Activity | C-25 | yes (3 expected-fail) |
| `announcement-write.test.ts` | 19 Announcement | C-26 | yes (5 expected-fail) |
| `public-announcements.test.ts` | 20 Public announcements (no sign-in, read-only) | C-27 | yes (1 expected-fail) |
| `collaboration-write.test.ts` | 40 Interest form and inbox | C-28 | yes (3 expected-fail, two are P0) |
| `submission-write.test.ts` | 21 Submission | C-29 | yes (6 expected-fail, two are P0) |
| `review-write.test.ts` | 23 Reviewer workspace (two throwaway accounts, a package, an assignment) | C-31 | yes (3 expected-fail, one is P0) |
| `public-research.test.ts` | 24 and 25 Public research (no sign-in, read-only) | C-32 | yes (3 expected-fail) |
| `alignment-write.test.ts` | 26 Matn alignment | C-33 | yes (3 expected-fail) |
| `isnad-write.test.ts` | 27 Isnād graph | C-34 | yes (4 expected-fail) |
| `families-write.test.ts` | 28 Hadith families | C-35 | yes (4 expected-fail) |
| `ilal-write.test.ts` | 29 ʿIlal cases | C-36 | yes (4 expected-fail) |
| `narrator-write.test.ts` | 30 Narrator dossier | C-37 | yes (5 expected-fail) |
| `books-read.test.ts` | 31 Book structure and terms | C-38 | no, read only (5 expected-fail) |
| `argument-write.test.ts` | 32 Argument map | C-39 | yes (5 expected-fail) |
| `search-compare-write.test.ts` | 35 Search run comparison | C-40 | yes (5 expected-fail) |
| `templates-write.test.ts` | 37 Project templates | C-41 | yes for the create part (3 expected-fail) |
| `editorial-write.test.ts` | 22 Editorial console (needs an administrator; leaves one retracted publication) | C-30 | yes (3 expected-fail) |

Each write test creates throwaway data (`[contract-test]` projects, one declined throwaway account) and cleans up. If a
run dies half way, trash the leftover `[contract-test]` projects from the demo account.

## Browser checks (project 60, signed in as the demo account; read the console for errors on each)

- **14 Settings** `/settings`: every tab; profile preview follows what is typed; display saved and still there after reload;
  password form; two-step enrolment with a real authenticator code (do not turn it on for the demo account without turning
  it off again); sessions; notification switches; Support tab note; the closure dialog (open and cancel, do not send).
- **15 Members** `/projects/60/members`: the table (owner first, revoked people absent), invite dialog, link copy, resend,
  withdraw, role change, remove, the permission table, the invitation page `/invitations/<token>` for a second account
  (accept, decline, expired).
- **16 Discussion** `/projects/60/discussion`: open, reply, resolve; new discussion; the same from an evidence item and a
  finding ("Discussions about this"); tasks create, edit, done, blocked, filters.
- **17 Notifications** `/notifications` and the number beside the rail link: invite a second account and watch it appear,
  mark read, mark all.
- **18 Activity** `/projects/60/activity`: filters, paging, the owner sees the invited address, a viewer does not.
- **19 Announcement** `/projects/60/announcement`: draft, preview, publish, then open `/announcements/<slug>` in a window
  where nobody is signed in, edit while public, unpublish, history.
- **20 Public** `/announcements` and `/announcements/<slug>` signed out: nothing private anywhere on the page.
- **21 Submission** `/projects/60/submission`: choose a document, read the check, freeze and submit (a throwaway project, not 60); the packages table; check that no reviewer name or note appears anywhere on the page or in the page's data after an editor has reviewed.
- **22 Editorial** `/editor` as the demo administrator with a package submitted by a second account: queue filters, the case, assign (the author must be blocked), decide (approval needs a finished review), release, correction, retraction; and as an ordinary researcher: the page must look like it does not exist.
- **23 Peer review** `/review` as the assigned reviewer: the gate, declining, reading the package, sending a review; look at the page's data (network tab) for the authors' names and the project: they are expected to be there (C-31 P0) and must not be on the page.
- **24/25 Public research** `/research` and `/research/<slug>` signed out, after the editorial run released and retracted a throwaway publication: the list, the retracted filter, the page with its banner, the citation formats (RIS and APA are expected to answer BibTeX); look at the network answer for reviewer and editor fields (expected there, C-32) and make sure none is on the page.
- **26 Matn alignment** `/projects/60/analysis/matn?h=…` with two or three of the demo's reports: the alignment, the baseline switch, save and reopen; compare a few slots by eye with the original wording.
- **37 Project templates** `/projects/templates`: with at least one template inserted by hand, it is listed with its tasks; creating from it gives a private project with the title, question and language chosen and the template's tasks under Tasks; with the table empty, the empty state and the blank-project link show; "Start from a template instead" on the new project page leads here.
- **35 Search run comparison** `/projects/60/searches/compare?query=<id>`: pick two runs of a query that was run twice with the corpus changed in between; new, gone and kept lists add up to the run sizes; a record's text appears; subscribing and switching off persist after a reload; the note says nothing is rerun or sent (remove it when the backend schedules reruns); a viewer sees no controls.
- **32 Argument map** `/projects/60/argument-map`: add a claim and an answer (the answer is created, then linked); the outline numbering matches the graph; remove a relation and a point; a point linked to evidence shows its text and locator, one without says reasoning only; a viewer sees no buttons; no other project's evidence or points ever appear (after C-39's P0 is fixed, try a direct call with another project's ids and expect a refusal).
- **31 Book structure and terms** `/projects/60/analysis/books/<id>`: the chapter counts add up to the book's total; a chapter's report list is plausible for its count; a large book (about 1,900 chapters) loads without a long wait and the filter stays responsive; the word-form search for a common word says "at least" at the limit; a snippet shows the word or the not-located note; Arabic titles run right to left.
- **30 Narrator dossier** `/projects/60/analysis/narrators/<id of a narrator with places>`: identity matches the corpus; add, edit and delete a claim with alternatives; record an assessment for a teacher found by search and see it grouped under the teacher's name; the places table shows stated and inferred stops, a stop without a year shows Unknown; a viewer sees no buttons; Arabic names run right to left.
- **29 ʿIlal cases** `/projects/60/analysis/ilal`: open a case, add two versions and a critic statement, conclude it; reload and see all of it; a second browser adding a version at the same time keeps both; a viewer sees no forms; Sorani/Arabic text runs in its own direction.
- **28 Hadith families** `/projects/60/analysis/families`: create a family, add a corpus report and a piece of evidence, classify and remove; a report number that does not exist is refused; a viewer sees no buttons; Sorani/Arabic titles run in their own direction.
- **27 Isnād graph** `/projects/60/analysis/isnad?h=…` with reports that have several chains: the graph and the table agree, the arrows run teacher to student, the candidates and the "begins/ends" roles look right for known chains, the page in Sorani/Arabic puts the earliest transmitters on the right, keyboard focus reaches the nodes and the table.
- **40 Interest** `/announcements/<slug>/interest`: expected to fail with "The request was not sent" until C-28 is fixed;
  then the inbox on the members screen.

## Things to look at in the results

- The shapes assumed from code: member rows (`status`, `contribution_summary`), notification `target_type`, activity
  `summary`, the announcement `status` after a save without a status, the `data` of `GET /notifications`.
- Whether the backend agent has fixed any of C-21 to C-28 in the meantime (`git log -- backend`).
- Whether `useProject().role` is right for a person who was removed (the project should answer 404, and the shell then says
  "Project not available").

When all of these are done, tick `P0.1` to `P0.5` and `D8` in `FRONTEND_TODO_NEXT.md`, record the final counts in its log,
and delete the corresponding rows above.
