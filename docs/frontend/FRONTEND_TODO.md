# Frontend work list (autonomous)

**Superseded for remaining work by `FRONTEND_TODO_NEXT.md` (7 Oct 2026); this file keeps the rules and the history.**

**Written 6 Oct 2026.** This file is the single ordered list of everything left to build, with the rules for building it.
It is written so that work can continue **without asking the user anything**: pick the first unticked task, do it to the
definition of done below, tick it, log it, move on. Do not stop between screens. Do not rush and do not skip steps to
finish sooner; running out of budget part-way is fine, because the next session resumes from the first unticked box.

Companion documents: `FRONTEND_DEVELOPMENT_PLAN.md` (design, stack, phases), `../api/API_REQUESTS_FROM_FRONTEND.md`
(everything the backend must fix, items C-1 to C-17 so far), mockups in `../design/HadithResearch/*.dc.html`.

---

## 0. How to work (read this first in every session)

1. Open this file, find the first task that is not ticked (`- [ ]`). Do tasks strictly in order unless a task says it is blocked.
2. Before the task: `git status` and `git log --oneline -5` (the backend agent works in parallel and may have changed
   the backend or the docs); re-read the task's mockup and the backend controller and routes; **probe the live API**.
3. Build to the definition of done (section 2). Tick the box, add one line to the **progress log** at the end of this file.
4. Update `FRONTEND_DEVELOPMENT_PLAN.md` (progress line and the screen table row) and `API_REQUESTS_FROM_FRONTEND.md`
   (new C-item, and the API-n row status) in the same task, never later.
5. Then start the next task. **Never ask the user whether to continue, never wait for "next".** If a decision is needed,
   take the recommended option, write it in the decision log (end of this file) and go on.
6. If the backend cannot do something: build the honest "isn't available yet" state (section 3.4), file a request-file
   entry, and continue. Never fake data, never block on the backend.
7. Do **not** commit to git unless the user has asked. Do not edit anything under `backend/` (it belongs to another agent).
8. Never trust another agent's claim that something is done. A screen is done only when it meets section 2 here.

### Environment recipes (they survive a lost context)

- Repo root: `C:\Users\polla\Drives\PollaFattah\UNi\Research\Projects\Hadith\ResearchPlatform`. Frontend: `frontend/`. Backend (read-only for us): `backend/`.
- Checks (run from `frontend/`): `npm run check` (lint, typecheck, unit/integration tests, build) and `npm run audit` (section 4, once it exists).
- Live backend: start with PowerShell
  `Start-Process -FilePath php -ArgumentList artisan,serve,--port=8000 -WorkingDirectory <repo>\backend -WindowStyle Hidden`, wait about 10 s, check `http://127.0.0.1:8000/up`.
  Stop with PowerShell: `Get-NetTCPConnection -LocalPort 8000 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }` (run it twice; `php artisan serve` has a child process). **Always stop it when a task ends.**
- Demo account (local development only, seeded by `ScholarlyDemoSeeder`): `polla@sue.edu.krd` / `password123`. It is an approved admin that owns project 60 (the Niyyah study: 3 resources, 3 evidence items, findings, a document, runs, a result set, analyses).
- Contract tests: `$env:CONTRACT_EMAIL='polla@sue.edu.krd'; $env:CONTRACT_PASSWORD='password123'; $env:CONTRACT_WRITE='1'; npm run test:contract`. Files run one at a time on purpose. Write tests create `[contract-test]` data and must clean up (trash the project, delete library items). Known backend defects are recorded with `it.fails(...)` and flip when fixed.
- Browser check: `preview_start` name `frontend` (port 5173); sign in by running in the page `sessionStorage.setItem('oh.token', '<token>')` then navigating. Get a token with `POST /api/v1/auth/login` (PowerShell `Invoke-WebRequest`). Screenshots are flaky: retry, or read `document.querySelector('main').innerText`. Stop the preview afterwards.
- Probing the API: a small Node script using `fetch` with the bearer token (`/tmp` is not used; keep scratch files in the session scratchpad). In Git Bash a leading `/` argument is rewritten to a Windows path: use PowerShell for probes.
- **Writing files:** use the Write tool. Bash heredocs and `node -e` break on apostrophes ("unexpected EOF"). Never rewrite source files with PowerShell `Get-Content`/`Set-Content` (it corrupts UTF-8). Small edits: the Edit tool, or a Node script file.
- i18n: English is the working language. Add strings to `src/i18n/locales/en.json` under one top-level section per feature (write `src/i18n/locales/<section>.en.json` containing the **inner** object only, no wrapper key, then `node scripts/merge-i18n.mjs <section>` from `frontend/`). `ckb.json` and `ar.json` stay empty (specialist translation later; they fall back to English).
- Mockup text: strip tags from the `.dc.html` (`node scripts/extract-mockup.mjs [--data] "<name>"` from `frontend/`) and read the copy and states; the mockups carry their own "review bar" (View/State chips, requirement IDs, "sample" notices). **Never copy those into the product.**

---

## 1. Standards that apply to everything (decisions already made)

- Stack: Vite 8, React 19, TypeScript strict (`noUncheckedIndexedAccess`), React Router, TanStack Query, React Hook Form + Zod for real forms, CSS Modules with **logical properties only**, i18next, Vitest 5 + MSW + Testing Library, oxlint (react-compiler rules). CodeMirror 6 (document editor) and React Flow (graphs) when their screens come.
- The whole UI flips right-to-left for Sorani and Arabic (`<html dir>`): `margin-inline`, `padding-block`, `border-inline-start`, `inset-inline`, `text-align: start`. No `left`/`right`. Source and user text goes through `BidiText`. Numbers through `usePreferences().n`, dates through `.date`/`.relative`. Desktop only (width at least 1024 px).
- Colours and fonts come from the tokens in `src/styles` (`var(--ink)`, `var(--accent)`, `var(--warn)`, `var(--neutral)` ...). No hex colours in components.
- Roles: Owner, Researcher, Project reviewer, Viewer (`src/domain/roles.ts`, `useProject().can(action)`). 403 and 404 are shown identically as "not available" (a private object's existence is never revealed).
- Unknown or incomplete is a neutral dashed state (`NeutralState`), never red. "Reviewed" never implies "authentic". Provenance is text plus icon, never colour alone.
- Release flags: only R1a is live; R1b+ areas render disabled with their tag (`src/app/features.ts`).
- MFA is not offered (backend MFA is bypassable, request C-4). Display codes: `PRJ-0012`, `EV-0004`, `OCC-000088`, `REP-000001`, `EXP-0040` (`src/domain/codes.ts`).
- 5xx text is never shown (`userMessage`); a write the server accepted but did not keep is reported (`NOT_PERSISTED`, read back after the write).

## 2. Definition of done for one screen (every box, every time)

1. **Read** the mockup copy and every state it shows; read the backend controller and routes; **probe the real endpoints** (shapes, errors, permissions, empty data).
2. **Data layer** in `src/api`: Zod schemas tolerant of extra fields and the backend's habits (JSON columns as strings, empty array for empty object, ids as numbers); one function per endpoint; **keys from the central key factory** (section 3); writes verify what the server returned.
3. **UI** meets section 1, and every state: loading, empty (first run versus filtered), error with retry that keeps the user's input, forbidden/not available, conflict where the API can return 409. Permission gating through `can(...)`. Honest "not available yet" notes for anything the API cannot supply. No fixture data, no `Math.random`, no invented counts.
4. **State management** follows section 3 (this is checked in review: no copied server state, no effect-driven syncing, URL for shareable view state).
5. **Tests**: unit tests for pure model code; MSW integration tests for each state, each write (payload asserted), each permission difference, each error path, and the honest-unavailable notes. Tests must assert behaviour, not just that text exists.
6. **Contract tests** against the live backend in `src/test/contract/`: read shapes, and (opt-in `CONTRACT_WRITE=1`) write flows with cleanup. Known defects as `it.fails`.
7. **Browser check** on project 60 (or a throwaway project): open it, use it, read the console for errors.
8. **Docs**: new C-item in the request file for every backend gap, API-n row status, plan row and progress line, this file ticked and logged.
9. `npm run check`, `npm run audit` and the contract suite are green. Servers stopped.

## 3. State management rules (extra care here)

The aim: every piece of state has exactly one owner, and nothing is kept in two places.

- **S1 Server data lives only in TanStack Query.** Never copy query data into `useState`, context or refs. Derive it (`useMemo` only if costly). To keep showing the last list while a refetch fails, keep the query key stable and render `query.data` with an error banner, instead of a shadow copy.
- **S2 Shareable view state lives in the URL**: filters, search text, sort, tab, page, selected id, view. Use the shared hooks (`useQueryParams`, `useDebouncedParam`, task B2). The typed-but-not-yet-applied text of a search box is the only local copy and is owned by `useDebouncedParam`.
- **S3 Ephemeral UI state is local and as low as possible**: dialog open, draft form text, hover. A dialog or panel that owns a draft is **mounted only while open** (`Modal`), so its state resets by unmounting, never by an effect. Forms with more than two fields use React Hook Form + Zod.
- **S4 App-wide state is only** auth/session and display preferences, each in its provider with a single storage helper. No other global store (no Redux, Zustand, or module-level mutable variables).
- **S5 Query keys come from one factory** (`src/api/queryKeys.ts`), hierarchical, one namespace per domain (`['projects', ...]`, never both `'project'` and `'projects'`). Components never write raw key arrays: after a write they call a named invalidator from the api layer (for example `invalidate.evidence(qc, projectId)`), which knows everything that write affects (lists, details, counts, summaries).
- **S6 Mutations** use `useMutation`. The error shown comes from `mutation.error` (reset on retry); do not mirror it into `useState`. Success side effects are in `onSuccess`. Optimistic updates only for trivially reversible changes, with a test for the rollback.
- **S7 No effect may set state to mirror other state.** `useEffect` is for subscriptions, timers and DOM APIs only. If you reach for `useEffect(() => setX(...), [y])`: derive it, lift it to the URL, or give the component a `key`. No `eslint-disable` of the hooks rules.
- **S8 One idempotency key per user attempt** (`useState(() => crypto.randomUUID())`), reset by remounting the form.
- **S9 Selections** that depend on a result set are keyed by the query that produced them (`useKeyedSelection`, task B5) so they cannot outlive their results.
- **S10 Time and randomness are not read in render.** Use `query.dataUpdatedAt`, a `useState(() => ...)` initialiser, or the preferences clock.
- **S11 Component shape:** a page orchestrates URL state and queries and hands plain props to presentational children; keep components under about 250 lines by splitting per panel; data hooks live next to the feature (`queries.ts`) and return query objects, not copies.
- **S12 Autosave and long-running work** are explicit state machines (`idle | saving | saved | error | offline | conflict`), tested with fake timers, never booleans scattered through a component.

## 4. Task list

Tick with `- [x]`. Each task is one iteration of the loop in section 0. Sub-bullets are the checklist inside the task.

### Phase A. Finish what is half done, and clean the foundations

- [x] **A1 Downloads (12) rebuilt** against the real endpoints (done 6 Oct 2026; request file C-17).
- [x] **A2 Plan statuses corrected** after the review of the other agent's commit `41fa191` (screens 10, 11, 12 were static mockup ports).

### Phase B. State-management consolidation (do before building more screens)

- [x] **B0 Scripts** in `frontend/scripts/`: `merge-i18n.mjs <section>` (merges `src/i18n/locales/<section>.en.json` inner object into `en.json`), `extract-mockup.mjs <file>` (prints a mockup's visible text). Document both in `frontend/README.md`.
- [x] **B1 Central query keys and invalidators.** Create `src/api/queryKeys.ts` (one factory per domain: auth, projects, project detail/summary, resources, collections, library, corpus, search, runs, result sets, evidence, findings, documents, analyses, exports, notifications, admin ...) and `src/api/invalidate.ts` (named invalidators: `invalidate.project(qc, id)`, `.projects(qc)`, `.evidence(qc, id)`, `.library(qc)`, `.exports(qc)` ...). Migrate every `xxxKeys` object and every raw `invalidateQueries({ queryKey: [...] })` (known sites: evidence dialogs and state panel, library dialogs and pages, project resources, search bulk add, verify email). Fix the `'project'` versus `'projects'` split. Tests: a unit test that each invalidator hits the keys of the queries it should (use a real `QueryClient`).
- [x] **B2 URL state hooks.** `src/hooks/useQueryParams.ts` (typed get/set of search params with `replace`, page reset rule) and `useDebouncedParam(name, ms)` (returns `[typed, setTyped]`, applies to the URL after the delay, follows the URL when it changes from outside, **no effect that sets state**: implement with a `key`-less derived pattern or `useSyncExternalStore`-free approach reviewed in the task). Migrate `LibraryPage`, `EvidencePage`, `ProjectIndexPage`, `SearchPage`, `SearchFilters`, `CorpusPicker`, `DownloadsPage`; remove the three `eslint-disable react-hooks/exhaustive-deps` and the render-time sync in `SearchPage`. Tests: hook unit tests (debounce, external URL change, page reset, back button).
- [x] **B3 Remove shadow copies.** `ProjectIndexPage` `lastGood`; any other place that copies query data into state (grep `useState(` initialised from `.data`). Keep the list visible on a failed refetch by keeping the key stable. Test: failed refetch keeps rows plus banner.
- [x] **B4 One pattern for mutation errors.** Create `MutationNotice` (or `useMutationNotice`) that renders `mutation.error` with the right wording (`userMessage`, `NOT_PERSISTED`); migrate pages that mirror errors into `useState<string | null>` (library detail, evidence panels, search page, downloads, project overview and settings). Tests per migrated area stay green.
- [x] **B5 `useKeyedSelection`.** Replace the ad-hoc selection in `SearchPage` (and the picker if it applies). Unit test: selection cleared when the key changes.
- [x] **B6 Audit script** `frontend/scripts/audit.mjs` and `npm run audit`, added to `npm run check`. It fails on: physical CSS properties in `*.module.css` (`left|right` in margin/padding/border/inset/text-align/float); `t('key')` calls whose key is missing in `en.json`; English words in JSX text or `aria-label`/`placeholder`/`title` not passed through `t`; `data-screen-label`, `reviewBar`, "sample", "fixture", "illustrative" strings; `Math.random(`/`Date.now(`/`new Date(` in component render files; `eslint-disable` of react-hooks; raw `invalidateQueries({ queryKey: [` outside `api/`; hex colours in `*.tsx`/`*.module.css` outside the tokens file; `useEffect(() => set`. Start with an allowlist for the two legacy screens (`features/comparison`, `features/findings`) which are removed by tasks C1 and C2; the allowlist must be empty when both are rebuilt.
- [x] **B7 State-management write-up.** Add a short "State management" section to `frontend/README.md` summarising section 3, with the hook names and one example each.

### Phase C. Remaining Phase 1 screens (R1a)

- [x] **C1 Findings and document editor (11), rebuilt.** The existing `features/findings` is a static mockup port and must be deleted and rewritten. Mockup: `11 Finding Editor`. Backend: `findings`, `documents`, `versions`, `draft`, `cite`, finding links, document locks (`CollaborationController` lock/unlock), `expected_version` conflicts (`DocumentController::createVersion`). Sub-steps, each with tests:
  - [x] C1.1 Probe and contract-test every endpoint (findings CRUD, evidence links with relation, documents CRUD, draft get/put, versions list/get/create with `expected_version`, restore, cite, link/unlink finding, lock/unlock); write `findings-write.test.ts` and `documents-write.test.ts`; log gaps as C-18.
  - [x] C1.2 Verify and fix the other agent's `api/findings.ts`, `api/documents.ts`, `schemas/{findings,documents}.ts` (they were never tested live). Keep only what is correct.
  - [x] C1.3 Findings index and detail: list with status, question, claim, reasoning, limitations; create/edit (React Hook Form + Zod); status vocabulary `provisional | supported | inconclusive | disputed`; linked evidence with relation and interpretation; link and unlink evidence (reuse the evidence panels where sensible); delete with confirmation and dependency warning.
  - [x] C1.4 Documents list and open; create; rename; delete with confirmation.
  - [x] C1.5 Editor core: CodeMirror 6, Markdown source, live preview, per-block text direction (RTL/LTR) toggle, Sorani/Arabic input, keyboard accessible. Editor state is one reducer/store inside the editor feature (S11/S12).
  - [x] C1.6 Citations: insert `[@EV-0004 exact]` style citations from the evidence picker, validate codes against the project's evidence, formatted citation list with "p. unknown" for incomplete locators, uses `POST …/cite`.
  - [x] C1.7 Autosave as an explicit state machine (`idle | saving | saved | error | offline | conflict`), debounced draft `PUT`, restore of the draft on open, tested with fake timers.
  - [x] C1.8 Versions: list, view, compare two versions (diff), restore (creates a new version), create a version with `expected_version`; 409 conflict view showing current author, time and content with a safe merge choice (never silently overwrite).
  - [x] C1.9 Document locks if the API supports them honestly; otherwise an explained "not available" note.
  - [x] C1.10 Link findings to a document; "Used in" counts consistent with the evidence inspector.
  - [x] C1.11 Remove the legacy allowlist entry for `features/findings`; docs, plan row, request file C-18, audit and contract green.
- [x] **C2 Comparison workspace (10), rebuilt.** The existing `features/comparison` is a static mockup port and must be deleted and rewritten. Mockup: `10 Comparison Workspace`. Backend: `analyses` (`index`, `show`, `save`, `matn-compare`, `isnad-compare`, `criticism-matrix`, `collate`, `isnad-topology`, `temporal-check`) plus corpus lookups. Sub-steps:
  - [x] C2.1 Probe every analysis endpoint on project 60 (the seeded `criticism_matrix` analysis id 15 is real data), read what each returns and requires; contract tests `analyses-write.test.ts`; log gaps as C-19 (versions of a saved analysis, input-changed detection, narrator search, ambiguity handling).
  - [x] C2.2 Verify and fix `api/analyses.ts` and `schemas/analyses.ts`.
  - [x] C2.3 Saved analyses list and open (name, code `AN-nnnn`, version if the API has one, inputs, settings, author, saved time); empty/first-run state.
  - [x] C2.4 Select inputs: choose occurrences from the project's evidence and resources and from search results; selection model with the keyed-selection hook.
  - [x] C2.5 Occurrences view: side-by-side original wording, difference highlighting from `matn-compare`, notes per column via the real annotation API (not local state); "limited access" column state.
  - [x] C2.6 Chains view: chains side by side from `isnad-compare` with ambiguity candidates, uncertain order and unknown links as neutral states.
  - [x] C2.7 Narrator dossier view (from corpus narrator endpoints) and Criticism matrix view (`criticism-matrix`), with unknown shown as neutral.
  - [x] C2.8 Save, rerun and "inputs changed" behaviour exactly as far as the API supports it; anything beyond is an honest note.
  - [x] C2.9 Remove the legacy allowlist entry for `features/comparison`; docs, plan row, request file C-19, audit and contract green.
- [x] **C3 Saved Searches (08s, account).** Re-check request C-15 first. Build what is possible: list personal saved searches (`GET /saved-searches`), create from the search workspace ("Save for me" besides "Save to project"), rename, delete, and "Open in a project…" chooser that opens the project search with the definition prefilled. If personal runs are still missing, say so plainly.
- [x] **C4 Administration (13).** Mockup `13 Administration`. Backend `AdminController` (applications review queue, accounts, limits, support grants, audit, ops, corpus proposals queue). Admin-only route guard already exists (`RequireAdmin`). Sub-steps: probe all admin endpoints and permissions (including a non-admin 403); applications review (approve, reject, request info) with the verified-email rule; accounts list and status changes with confirmation; limits; support access grants (create/revoke); audit log (filter, pagination, no secrets); ops dashboard (queue depth, failed jobs, disk); corpus correction proposals decision; MFA step-up is not offered. Contract tests (read, and write with cleanup); log gaps as C-20.
- [x] **C5 Profile and settings (14).** Mockup `14 Profile and Settings`. Profile (affiliation, biography, research interests, public fields, `is_public`), display preferences (language, numerals, calendar, saved to the backend `display_preferences` and the local provider), sessions (list, sign out other sessions), security tab (password change, recovery; MFA not offered with a plain explanation), notification preferences (R1b flags), account closure request if the API has it. Contract tests; C-21.
- [ ] **C6 Phase 1 checkpoint.** First run the owed live checks: contract suite incl. `account-write.test.ts` and a browser click-through of screen 14 (not run in the Linux session). Full regression: `npm run check`, `npm run audit`, contract suite with writes, click through every R1a screen in the browser on project 60, console free of errors, update the plan (Phase 1 done), update the request file summary table.

### Phase D. Phase 2 (R1b): collaboration and announcements

Enable the R1b flag for these screens as they are built (`src/app/features.ts`); each follows the section 2 recipe (probe, schemas, UI with all states, tests, contract tests, docs).

- [ ] **D1 Members and invitations (15)**: members with roles and contribution summary, invite by user search (`users/search`), pending invitations, change role, remove, transfer ownership, leave. Roles use the SRS names only (backend vocab mapping in `roles.ts`).
- [ ] **D2 Discussion and tasks (16)**: threads (codes `D-`), comments with mentions, tasks (`T-`) with assignee, due date, status; links to evidence/findings.
- [ ] **D3 Notifications (17)**: list, read/unread, mark all, unread count in the shell, preferences.
- [ ] **D4 Activity (18)**: project activity feed from `ProjectActivity`, filters, structured entries where the API allows.
- [ ] **D5 Announcement editor (19)**: draft, preview, publish (owner only), unpublish.
- [ ] **D6 Public announcements list and page (20l, 20)**: public layout, no sign-in, no private data (verify the response whitelist).
- [ ] **D7 Collaboration interest form (40)**: public form and the owner's inbox (`collaboration-requests`), rate limits, spam protection honesty.
- [ ] **D8 Phase 2 checkpoint** as C6.

### Phase E. Phase 3 (R1c): review and publication

- [ ] **E1 Submission builder (21)** with pre-publication validation (incomplete citations, unresolved evidence, rights) and per-item results.
- [ ] **E2 Editorial console (22)** (editor role guard, `checkEditor`), assignments, decisions.
- [ ] **E3 Reviewer workspace (23)** with blinding rules as the SRS states them.
- [ ] **E4 Public publication page and citation export (24)**.
- [ ] **E5 Public research search (25)**.
- [ ] **E6 Phase 3 checkpoint** as C6.

### Phase F. Phase 4 (R2): advanced analysis and exchange

Screens 26 to 32 need specialist review of wording and judgments: build the full functionality on real data and real endpoints, keep all scholarly labels in i18n (English only for now) and never show fixture judgments. If a screen's backend does not exist, build the honest unavailable state and file the request.

- [ ] **F1 Matn alignment (26)** · [ ] **F2 Isnad graph (27)** (React Flow, accessible list alternative) · [ ] **F3 Hadith family and shawahid (28)** · [ ] **F4 Ilal case file (29)** · [ ] **F5 Narrator dossier (30)** · [ ] **F6 Book structure and terminology (31)** · [ ] **F7 Argument map (32)** · [ ] **F8 Search run comparison and schedules (35)** · [ ] **F9 Project templates (37)** · [ ] **F10 Export and package import (38)** (extends Downloads) · [ ] **F11 Rich-text editor (34)** · [ ] **F12 Uploads and RIS import (36)** · [ ] **F13 Dataset builder (33)** · [ ] **F14 Public dataset and dossier pages (39)**.
- [ ] **F15 Phase 4 checkpoint** as C6.

### Phase G. Hardening (Phase 5)

- [ ] **G1 Accessibility audit**: keyboard order, focus management in dialogs and the editor, labels, landmarks, contrast of every token pair, reduced motion, screen-reader text for provenance and states; fix and test.
- [ ] **G2 RTL review**: run every screen with `ckb` and `ar` (empty locales fall back to English, so also test with a pseudo-RTL locale); check mirrored layout, BidiText coverage, numerals, Hijri dates; fix. A human Sorani or Arabic reader must still review the real translations (cannot be done here).
- [ ] **G3 Performance**: route-level code splitting (the bundle is over 700 kB), virtualised long lists (search results, evidence, audit), query `staleTime` tuning, no layout shift.
- [ ] **G4 Playwright journeys**: apply and sign-in (UC-01), project create to evidence to finding (UC-02), search to evidence, export (UC-07), onboarding; run against the seeded backend.
- [ ] **G5 Production build and docs**: environment config, base URL, error reporting hook, `frontend/README.md` complete, final plan and request-file clean-up.
- [ ] **G6 Final regression** (as C6) and a summary for the user at the top of `FRONTEND_DEVELOPMENT_PLAN.md`.

---

## 5. Progress log (append one line per finished task: date, task, tests, notes)

- 2026-10-06 · A1 Downloads rebuilt · 282 unit tests, exports contract 7 pass + 4 expected-fail · C-17 filed.
- 2026-10-06 · A2 plan statuses corrected · docs only.
- 2026-10-06 · B4 `MutationNotice` + `errorMessage` (one wording; 7 mirrored-error states removed; `lastRun`/`busyId` now derived from the mutation) · B5 `useKeyedSelection` · B6 `npm run audit` (in `check`; legacy allowlist = comparison, findings) with colour tokens, `useNow` clock, `audit-ok` markers · B7 README state-management table · 326 unit tests.
- 2026-10-06 · B1 central `qk` keys + named `invalidate.*` (30 files migrated, the `'project'` vs `'projects'` split fixed) · B2 `useQueryParams`/`useDraftParam` replace three copied typed-search effects and the render-time sync (Library, Evidence, Projects, Search, Downloads, Resources, Picker tab) · B3 `lastGood` state replaced by `useLastLoaded` (reads the query cache); `Date.now()` out of render; hand-rolled dialogs moved to `Modal` · 311 tests, lint clean.
- 2026-10-06 · B0 scripts (`merge-i18n.mjs`, `extract-mockup.mjs`) added and documented in the README.

- 2026-10-06 · C1 Findings and document editor (11) rebuilt in `features/writing/` · editor is a pure reducer (`editorState`) plus one hook (`useDocumentEditor`): draft autosave, version save with `expected_version`, conflict dialog that never loses text (open theirs with mine shelved, save mine on top, decide later), offline local draft and retry, 15-minute edit lock, draft restored only when it sits on the current version (C-18) · citations from evidence with server-formatted wording, incomplete-locator flag, unknown-evidence notice · versions list, view, compare, restore · findings form with read-back guard (`NOT_PERSISTED`), evidence link/unlink by relation, submission gaps · 405 unit tests (89 in `features/writing`), contract 75 pass + 21 expected-fail, `npm run check` and audit green, legacy `features/findings` removed · gaps in C-18.

- 2026-10-06 · C2 Comparison workspace (10) rebuilt in `features/comparison/` (the last static mockup port is gone; the audit's legacy list is empty) · inputs and view live in the address (`?view`, `h`, `base`, `narrator`, `n`, `run`), computing is a query keyed by its inputs, storing is a mutation · Occurrences: original wording per report with the words that only some texts have marked (matched to the server's tokens or not marked at all), baseline switch, researcher notes through the evidence item that holds the report · Chains: columns, narrators in every/some chains, inspector, dossier link, an explicit note that uncertain order/unknown/ambiguity are not reported · Dossier from the corpus with Unknown for what it lacks · Criticism: who-said-what matrix plus exact `qawl` lists from the corpus (paged) · stored runs: server-shaped results drawn like the live view, any other shape shown as stored and labelled, run again as the next version · 450 unit tests (55 in `features/comparison`), contract 91 pass + 26 expected-fail (`analyses-write.test.ts`: 16 + 5), `npm run check` and audit green · gaps in C-19.

- 2026-10-06 · C3 Saved Searches (08s) built in `features/savedSearches/` · list (paged in the address), rename with read-back, delete with confirmation, "Open in a project…" (owned and shared projects, deduplicated, opens the project's search workspace with text, mode and filters in its address and runs nothing) · the search workspace's "Save search" now offers "This project" or "Only me" (a viewer can save for themselves, the project option is disabled for them) and links to Saved searches after saving · stated plainly that a personal search cannot be run on its own (C-15) · `saved-searches-write.test.ts` (7 + 1 expected-fail), 14 new page and model tests, search tests updated · live check on project 60 (probe data removed again).

- 2026-10-06 · C4 Administration (13) built in `features/admin/` with its own `AdminShell` (rail with counts, exit to the researcher view) and an Administration link in the researcher rail for administrators · Applications (queue by state with counts, detail with thread, approve/decline with confirmation, request information, reasons of at least five characters, read-back guard), Accounts and roles (search and state filter in the address, role dialog, suspend/reactivate with reason, own account protected, closure section, a plain note that there is no step-up), Corpus corrections (queue, accept/reject with confirmation, says the corpus is not changed), Limits, quotas and jobs (limits read-only with a note that the server does not apply them, export jobs by state, no retry), Support access (grants with active/expired state, give back), Audit log (filters in the address, details as recorded, no outcome shown), Operations (the four numbers the server reports, refreshes every minute, the rest listed as not reported) · `StoredValue` moved to `components/` and shared with the audit details · `admin-write.test.ts` (15 + 7 expected-fail), 55 admin tests · found two P0 backend defects (email verification 500, support grant creation 500) · `npm run check` and audit green, 521 unit tests, contract 113 pass + 34 expected-fail · gaps in C-20.

- 2026-10-06 · C5 Profile and settings (14) in `features/settings/` (profile with public-field preview, display preferences saved to the account and taken over by the preferences provider, security: password, real two-step sign-in with recovery codes shown once, sessions; notifications; account closure with password) · every save reads back what the server kept · fixed `CountedUnit` test broken by the provider now depending on auth · `npm run check` and audit green, 558 unit tests · `account-write.test.ts` written but NOT run here · gaps in C-21.

## 6. Decision log (decisions taken without asking, with the reason)

- 2026-10-06 · Downloads offers only "ZIP · Unicode JSON", account and selected-project scopes, no Retry: the backend produces nothing else and Retry strands the job (C-17).
- 2026-10-06 · Exports past `expires_at` display as Expired and withhold the download button even though the server would still serve the file: the 7-day rule is a product rule the server does not yet enforce.
- 2026-10-06 · Finding statuses offered: provisional, supported, inconclusive, disputed. "Withdrawn" is not offered because the server rejects it (C-18); the form says so.
- 2026-10-06 · The server's `missing_components` (author, year) is not repeated in the citation list: it reports them missing even when the author is known (C-18). Only the locator flag, computed from the evidence, is shown.
- 2026-10-06 · A draft saved on an older version is ignored on open, because the backend does not clear a draft when a version is saved and restoring it would undo newer work.
- 2026-10-06 · Stored analyses with a shape the service does not make (the demo's runs 13–15) are shown as stored, labelled "Stored in another format", not coerced into tables: drawing them as results would present hand-written data as something the server computed (C-19).
- 2026-10-06 · "Save analysis" and "Run again" only store through the compute endpoints with `save_run`, never `POST …/analyses/save`, so a stored result is always one the server computed. Narrator dossiers are therefore not stored (there is no compute endpoint for them).
- 2026-10-06 · Highlighting in Occurrences marks words by the server's own tokens; if the original wording does not line up with them it is shown unmarked with a note, rather than marked by guesswork.
- 2026-10-06 · Chains are the chains of the picked reports (first 12), because the server compares sanad ids and the corpus lists them under each report; there is no separate chain picker.
- 2026-10-06 · "Save search" in the workspace is available to every role: a viewer cannot add to the project but can keep a personal search, so the project option is disabled for them and "Only me" is preselected.
- 2026-10-06 · A personal search is not run on its own: the backend has no run endpoint and a run is a project record, so "Open in a project…" is the way to run one (C-15).
- 2026-10-06 · Limits are shown read-only: the server stores them but nothing applies them (C-20), so an edit form would look like it did something and do nothing. Reports and rights flags are not shown (hard-coded or empty on the server).
- 2026-10-06 · The audit log shows no "outcome" column: the server hard-codes "success" even for refused attempts (C-20). A refused attempt is recognised by its action name ("Tried to change their own role").
- 2026-10-06 · MFA step-up is not built: the server has no step-up check, and a screen that asked for a code that nothing verifies would be false assurance (C-20). The accounts view says these actions don't ask for a second step.
- 2026-10-06 · Applications can be decided only while waiting (pending or information requested) even though the server would allow a second decision, which flips the account (C-20).
- 2026-10-06 · An administrator cannot change their own role (the server refuses too) or suspend themselves (the server would allow it and lock them out).
- 2026-10-06 · Throwaway applicants made by the contract tests stay as declined accounts, because accounts cannot be deleted; a run costs one application out of ten allowed per hour.
- 2026-10-06 · No git commits are made by the frontend agent unless the user asks.
- 2026-10-07 · This Linux environment has PHP 8.3 and the backend needs 8.4, so the live backend cannot start: the contract suite and the browser check for C5 were not run. They stay owed and must be run in the Windows environment before the C6 checkpoint (listed as C6 prerequisite).
