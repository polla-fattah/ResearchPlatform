# Frontend work list, part 2 (everything after Phase 1 screens)

**Written 7 Oct 2026.** Successor to `FRONTEND_TODO.md`, whose Phases A to C are finished (screens 01 to 14 and the state-management
consolidation). Its rules (section 0 "How to work", section 1 standards, section 2 definition of done, section 3 state-management
rules S1 to S12) **still apply unchanged**; read them first. This file adds: what is owed, the exact per-screen recipe, and every remaining
task with its sub-steps, in the order to do them. Tick with `- [x]`, add one line to the progress log at the end, then take the next task.
Never stop to ask "next".

Companions: `FRONTEND_DEVELOPMENT_PLAN.md` (design, screen to API table), `../api/API_REQUESTS_FROM_FRONTEND.md` (backend requests, next free number **C-22**),
mockups `../design/HadithResearch/*.dc.html`.

---

## 0. Where things stand (7 Oct 2026)

- Built and tested: 01 Registration, 02 Home, 03/03b Library and project resources, 04/05/06 Projects, 07 Picker, 08 Search, 08s Saved searches, 09 Evidence,
  10 Comparison, 11 Findings and documents, 12 Downloads, 13 Administration, 14 Settings. 558 unit tests, `npm run check` and `npm run audit` green.
- Pushed to GitHub `main` (commit `60673b1`). The user wants work on `main`; the session branch is `main-c9tjyv` (keep both in step: push `HEAD:main` and the branch).
- **Owed live checks** (could not run on Linux: the backend needs PHP 8.4, the cloud container has 8.3): contract suite `account-write.test.ts`, and the browser
  click-through of screen 14. They are task **P0.1** below.
- Two defects found in the other agent's commits are already fixed; the rule stays: **never trust "done" from another agent, verify by section 2.**

## 1. Two working modes (pick at the start of every session)

Run `php -v` and `curl -s http://127.0.0.1:8000/up`.

- **Mode LIVE** (PHP 8.4 present, backend starts): follow section 2 of the old file exactly, including probes, contract tests and browser check.
- **Mode CODE-ONLY** (PHP 8.3, as in the cloud container): read controllers, routes, requests, resources and the backend's own feature tests to learn shapes;
  build schemas tolerant of extra fields; write MSW tests from those shapes; write the contract test file anyway (it skips when the server is unreachable);
  and **tag the task `[live-owed]`** in the progress log. Nothing may be shown as verified that was not. Every `[live-owed]` task is run in Mode LIVE at the next
  checkpoint before that phase is signed off. Never fabricate data to make up for it.

## 2. Per-screen recipe (copy these sub-steps into each task; all must be ticked)

1. **Read**: mockup copy (`node scripts/extract-mockup.mjs "<name>"`), every state it shows, its requirement ids, the SRS lines in `docs/requirements`.
2. **Backend**: controller, routes, form requests, resources, policies, and the backend feature tests; probe live if Mode LIVE. Note permission differences per role and 403/404 behaviour.
3. **Schemas and calls** in `src/api` (one function per endpoint, Zod tolerant of extras, keys from `qk`, invalidators from `invalidate`); writes verify the read-back (`NOT_PERSISTED`).
4. **Route and features**: register in `router.tsx` `BUILT`, flip the release flag in `src/app/features.ts` when the screen belongs to R1b or later.
5. **UI**: all states (loading, first-run empty, filtered empty, error with retry keeping input, not available, conflict where 409 is possible), `can(...)` gating, logical CSS only, `BidiText`, `usePreferences`, i18n through `merge-i18n.mjs`, no mockup review bars, no invented numbers.
6. **State** (S1 to S12): server data only in TanStack Query, shareable state in the URL, dialogs mounted only while open, forms with more than two fields on React Hook Form + Zod, no effect-driven syncing.
7. **Tests**: model unit tests; MSW tests for each state, each write payload, each role difference, each error; contract test file in `src/test/contract/<area>-write.test.ts` with cleanup and `it.fails` for known backend defects.
8. **Docs**: C-item in the request file, plan row, progress line, this file ticked. Update `API-n` row status.
9. **Gate**: `npm run check` (includes audit) green; in Mode LIVE also the contract suite and a browser pass on project 60 with the console clean; servers stopped.
10. **Git**: commit with a clear message, push `HEAD:main` and `main-c9tjyv`. (This list supersedes the old "do not commit" rule: the user now wants work pushed to `main`.)

---

## 3. Tasks

### Phase P · Owed from Phase 1 (do first when a live backend exists)

- [ ] **P0.1 Live verification of screen 14** `[live-owed]`: run `account-write.test.ts` (all pass, the five `it.fails` still fail for the stated reasons); browser pass on `/settings` for each tab (profile with public preview, display, security: password, two-step enrolment with a real authenticator code, sessions; notifications; support; account closure up to the dialog, not submitting on the demo account); fix whatever differs from the schemas.
- [ ] **P0.2 Full contract suite with writes** against the seeded backend; the expected-fail set must match the request file; update counts in the progress log.
- [ ] **P0.3 Phase 1 click-through** of every R1a screen (01 to 14) on project 60: read `document.querySelector('main').innerText` and the console on each; list any defect as a fix task before moving on.
- [ ] **P0.4 Request-file summary**: refresh the summary table (statuses ✅/🟡/❌) for API-1 to API-10 from what the live checks show; note anything the backend agent has since fixed (re-read the backend `git log` first).
- [ ] **P0.5 Phase 1 sign-off**: set "Phase 1 done" in the plan, tick this phase, and record the final test counts.

### Phase D · R1b: collaboration and announcements

Flip `src/app/features.ts` R1b flags on one screen at a time as each is finished. Shared prerequisites first.

- [ ] **D0 Shared prerequisites**
  - [x] D0.1 (`resolveDiscussion` added; the rest already existed) `useProject().can(action)` actions needed by D1 to D5 (invite, change role, remove, transfer, comment, task, publish); one table in `domain/roles.ts` with tests per role.
  - [x] D0.2 Unread notification count in the shell (query with `staleTime`, refetch on window focus, one place), badge text for screen readers.
  - [x] D0.3 (not needed: the member name is shown inline; no `UserChip` was warranted) `UserChip` component (name via `BidiText`, display code, no email unless the API gives one and the viewer may see it) used by members, discussion, activity.
  - [x] D0.4 (`Pagination` with the page in the address is enough; discussions, tasks and notifications use it) `useInfinitePaged` or an extension of `Pagination` for lists the API pages (discussions, tasks, activity); URL holds the page.
- [x] **D1 Members and invitations (15)** (7 Oct 2026, Mode CODE-ONLY, `[live-owed]`)
  - [x] D1.1 Read mockup 15, `CollaborationController`, `ProjectInvitation`, `AuthPolicyService`; list endpoints, role vocabulary (backend `reviewer` shown as "Project reviewer").
  - [x] D1.2 Members list: role, contribution summary, joined date, "you" marker; empty/forbidden states.
  - [x] D1.3 Invite by user search (`users/search`, debounced via `useDraftParam`), by email when allowed, role chooser, message; pending invitations list with resend and revoke; owner cannot be invited.
  - [x] D1.4 Accept/decline for the invited person (from notifications and a direct link); expired and used invitation states.
  - [x] D1.5 Change role (confirmation, reason if the API takes one), remove member (dependency warning: their evidence stays attributed), leave project, transfer ownership (type-the-project-name confirmation).
  - [x] D1.6 Tests, contract `members-write.test.ts` with a second throwaway account and full cleanup; C-item.
- [x] **D2 Discussion and tasks (16)** (7 Oct 2026, Mode CODE-ONLY, `[live-owed]`)
  - [x] D2.1 Threads (code `D-nnnn`) with paging; create thread linked to evidence, finding, document or nothing; resolve/reopen.
  - [x] D2.2 Comments with mentions (member search in the composer), edit and delete rules per role, own-comment markers; no optimistic edits without a rollback test.
  - [x] D2.3 Tasks (code `T-nnnn`): create, assignee, due date, status transitions, filters in the URL, overdue as text plus icon; link to the object.
  - [x] D2.4 "From this object" entry points: a Discussion panel on Evidence and Findings that opens the right thread.
  - [x] D2.5 Tests, contract `discussion-write.test.ts`, C-item.
- [x] **D3 Notifications (17)** (7 Oct 2026, Mode CODE-ONLY, `[live-owed]`): list with category and read state filters (URL), mark read/unread, mark all, open target object, unread badge (D0.2), preferences link to settings; category set differs from the design (record in the request file); empty and forbidden states; tests and contract.
- [x] **D4 Activity (18)** (7 Oct 2026, Mode CODE-ONLY, `[live-owed]`): project feed with filters (actor, type, date), structured entries rendered from `ProjectActivity` fields only (no guessed sentences), paging; honest note about the 100-item cap if still true; tests and contract.
- [ ] **D5 Announcement editor (19)**: draft, preview (same renderer as the public page), publish (owner only, confirmation, what becomes public listed), unpublish if the API has it (else note and C-item), history if available; co-author consent note; tests and contract.
- [ ] **D6 Public announcements list and page (20l, 20)**: public layout without sign-in, no private data (assert the response whitelist in a contract test), slug routes, not-found page, share-safe metadata, RTL.
- [ ] **D7 Collaboration interest form (40)**: public form (needs a public endpoint; if missing, build the honest unavailable state and file the request), owner's inbox from `collaboration-requests`, status handling, rate limit and spam-protection honesty; tests.
- [ ] **D8 Phase 2 checkpoint**: as P0.1 to P0.5 for screens 15 to 20 and 40; R1b flags on; plan updated.

### Phase E · R1c: review and publication

- [ ] **E0 Prerequisites**: editor and reviewer role guards (`checkEditor`, assignment-based reviewer access), blinding rules read from the SRS into a small tested `domain/blinding.ts`.
- [ ] **E1 Submission builder (21)**: pre-publication validation (`validate-pre-publication`) with per-item results (incomplete citation, unresolved evidence, rights), fix-links back to the object, submit with confirmation, status and history; tests and contract.
- [ ] **E2 Editorial console (22)**: queue, assignment of reviewers with conflict display (note the missing candidate list), decisions with reasons, access limited to editors (assert a non-editor gets the neutral not-available page); tests and contract.
- [ ] **E3 Reviewer workspace (23)**: "my assignments", accept/decline, review form, blinding rules applied in the UI and verified against what the API returns (never hide only visually data the server sends: file a defect if it does); tests and contract.
- [ ] **E4 Public publication page and citation export (24)**: public page, citation formats from `cite`, version and correction notices, no private data; tests.
- [ ] **E5 Public research search (25)**: search with filters the API supports, facets only if the API returns counts, URL-held query, paging; tests.
- [ ] **E6 Phase 3 checkpoint**: as P0.1 to P0.5.

### Phase F · R2: advanced analysis and exchange

Scholarly wording is for specialist review: keep every label in i18n (English now), never show fixture judgments, no invented probabilities.

- [ ] **F1 Matn alignment (26)**: `analyses/collate` aligned view, variant markers, baseline switch, notes; honest limits.
- [ ] **F2 Isnad graph (27)**: React Flow graph plus an accessible list/table alternative with the same data, keyboard navigation, topology and temporal checks.
- [ ] **F3 Hadith family and shawahid (28)**: `families`, grouping, add/remove members, evidence links.
- [ ] **F4 Ilal case file (29)**: `ilal-cases` CRUD, argument sections, linked evidence, status; no automatic verdicts.
- [ ] **F5 Narrator dossier (30)**: corpus narrator endpoints, assessments, assertions, geospatial; unknown stays neutral; criticism wording exact.
- [ ] **F6 Book structure and terminology (31)**: `books/{id}/structure`, concordance; virtualised long trees.
- [ ] **F7 Argument map (32)**: nodes and edges (`title/content`; relations `supports/refutes/qualifies/replies_to/alternative_to`), React Flow plus list alternative.
- [ ] **F8 Search run comparison and schedules (35)**: compare on saved result sets, subscriptions; note that runs cannot be listed if still true.
- [ ] **F9 Project templates (37)**: list, create from project, apply to a new project.
- [ ] **F10 Export and package import (38)**: extend Downloads with graph export and `import-package` (file upload needs the backend; request if missing).
- [ ] **F11 Rich-text editor (34)**: only after the citation-markup contract is agreed (API-8); until then the Markdown editor stays the only editor.
- [ ] **F12 Uploads and RIS import (36)**: BibTeX exists; RIS and uploads are request-only until the backend has them.
- [ ] **F13 Dataset builder (33)** and **F14 Public dataset and dossier pages (39)**: backend does not exist; build the honest unavailable state and the request (API-15); no mock data.
- [ ] **F15 Phase 4 checkpoint**: as P0.1 to P0.5.

### Phase G · Hardening

- [ ] **G1 Accessibility**: keyboard order and visible focus on every screen, focus return after dialogs, landmarks, form labels and error association, token-pair contrast table, reduced motion, screen-reader text for provenance and states, editor shortcuts documented; axe run in a Playwright pass; fix and test.
- [ ] **G2 RTL**: all screens in `ckb`, `ar` and a pseudo-RTL locale; mirrored layout, `BidiText` coverage, numerals, Hijri dates; screenshots reviewed; human translators still needed for real strings.
- [ ] **G3 Performance**: route-level code splitting (bundle over 700 kB), virtualised long lists (search results, evidence, audit, tree views), `staleTime` tuning, no layout shift, CodeMirror and React Flow loaded lazily.
- [ ] **G4 Playwright journeys**: apply and sign in (UC-01), project to evidence to finding (UC-02), search to evidence, export (UC-07), invitation accept, admin approval; against the seeded backend; CI-ready script.
- [ ] **G5 Security pass**: token storage and expiry handling, no secrets or emails in logs and URLs, 5xx text never shown, CSP-compatible build, dependency audit (`npm audit`), error-reporting hook.
- [ ] **G6 Production build and docs**: environment config and base URL, `frontend/README.md` complete (setup, scripts, state-management table, i18n workflow, release flags), CI workflow running `npm run check` and the contract suite against a seeded backend, final plan and request-file clean-up.
- [ ] **G7 Final regression and handover**: full checkpoint, a summary for the user at the top of the plan (what is built, what depends on the backend, the open request list by priority, what needs human translators and scholars).

---

## 4. Rules for ordering and blocking

- Strict order inside a phase, except where a task says it is blocked. A blocked task gets its honest unavailable state, a request-file entry, a log line, and the loop moves on.
- A `[live-owed]` task is never counted as verified. A phase checkpoint cannot be ticked while any `[live-owed]` task in the phase is unverified.
- After each task: `git status`, commit, push (`HEAD:main` and the session branch). If the push is refused with 403, say so once and keep working; never use the connector to rewrite whole files by hand.
- Check `git log` of `backend/` at the start of each session; the backend agent works in parallel. Re-read its changes before relying on a shape.

## 5. Progress log (append one line per finished task: date, task, tests, mode, notes)

- 2026-10-07 · List created · docs only.

- 2026-10-07 · D1 Members and invitations (15) in `features/members/` `[live-owed]` · members table (owner first, only accepted rows, member's own counts, never the project-wide findings figure), invite by e-mail with the link handed over because no e-mail is sent, open invitations with expired judged against the load time, resend, withdraw, change role (never owner, read-back), remove with only what the server does, leave, invitation page (title, inviter, role, can/cannot from the permission table; accept, decline, expired, not available) · Members tab added to the project shell · 592 unit tests · contract file `members-write.test.ts` written from the code, not run · transfer not offered (no way to see or answer it) · gaps in C-22.

- 2026-10-07 · D2 Discussion and tasks (16) in `features/discussion/` `[live-owed]` · discussions list (open/resolved/all in the address, counts of the page loaded), thread view (replies, who started it from the first reply, link to the object, decision with who and when and "never changes the corpus"), reply with the text kept on failure and read-back, resolve (decision and reason required, alternative kept), new discussion (project, or an item through `?new=1&targetType&targetId`), tasks (state and mine filters on the server, overdue judged at load time, create with assignee from members, edit, done and blocked through their own actions with a reason) · `ItemDiscussions` on the evidence inspector and finding · shared `RefreshNotice` for a failed refresh over kept data · 619 unit tests · `discussion-write.test.ts` written from the code, not run · gaps in C-23.

- 2026-10-07 · D3 Notifications (17) in `features/notifications/` `[live-owed]` · list (kind filter on the server, unread-only on the loaded page, both in the address), read one (also when opened) or all, read-back, links only where they can honestly lead (invitation none, task through the assigned-task lookup), unread count beside Notifications in the account rail from the query Home shares, any other kind shown by its own name · test for the rail and the project tabs updated · 637 unit tests · `notifications-write.test.ts` written from the code, not run · gaps in C-24.

- 2026-10-07 · D4 Activity (18) in `features/activity/` `[live-owed]` · feed grouped by the person's day, filters (who from the members, object, action, range as a plain day cut from the app clock so the key changes daily) and page all in the address, links to the objects, the server's sentence shown as written with the kind translated, an invitation's sentence withheld from everyone but the owner (it names the e-mail address) · Activity tab enabled · 651 unit tests · `activity-write.test.ts` written from the code, not run · gaps in C-25.

## 6. Decision log (decisions taken without asking)

- 2026-10-07 · Work is pushed to `main` as the user asked; the session branch is kept equal to it.
- 2026-10-07 · In a cloud container without PHP 8.4 the backend cannot run; tasks are built from the backend code (Mode CODE-ONLY) and tagged `[live-owed]` instead of being blocked.
- 2026-10-07 · Project tabs are enabled per screen as each is built (no `release` prop on the Members tab); the default release stays R1a until the D8 checkpoint.
- 2026-10-07 · Ownership transfer is not offered: the server has no way to see, cancel or answer a pending transfer, and a button that creates invisible records is worse than a note (C-22).
- 2026-10-07 · People are invited by e-mail address, not by name search, because the invitation endpoint takes only an e-mail (C-22).
- 2026-10-07 · Tasks are a filtered table, not the mockup's four columns: the server pages tasks and a column view would hide how many there are.
- 2026-10-07 · Mentions, reopening and the three-way decision outcome are not built: the server stores none of them, and a field that is not kept would be false (C-23).
- 2026-10-07 · A discussion is opened from the list the screen already loaded (there is no single-thread read); one that is not on the loaded page says so (C-23).
- 2026-10-07 · The server's notification text is shown as written (it is English and carries the project title); only the kind and the controls are translated, because rebuilding the sentence would need data the row does not carry (C-24).
- 2026-10-07 · No CSV export button on Activity: the server has none and a button that did nothing would be false (C-25).
