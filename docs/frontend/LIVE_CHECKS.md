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
