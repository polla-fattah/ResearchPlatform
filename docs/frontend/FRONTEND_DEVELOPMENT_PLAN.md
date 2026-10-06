# Frontend Development Plan

**Revision 3 · 6 Oct 2026 (backend re-audit, §0b).** Revision 2 was 5 Oct. Supersedes the first draft after a second pass over the mockups, the SRS milestone files and the live backend.
Scope: React app in `frontend/`, built from the 41 mockups in `docs/design/HadithResearch/*.dc.html` against the Laravel API in `backend/` (`routes/api.php`, prefix `/api/v1`).
Missing or wrong backend behaviour is tracked in [`../api/API_REQUESTS_FROM_FRONTEND.md`](../api/API_REQUESTS_FROM_FRONTEND.md). References like **[API-3]** or **[DEF-2]** point into it.

## 0b. Backend re-audit, 6 Oct 2026: what changes in the plan

While Phase 0 was being built the backend agent added about 120 endpoints (309 routes now, from 187), so several first-draft gaps no longer exist. I re-verified each against the code and a running server (read-only calls); the evidence is in [the request file](../api/API_REQUESTS_FROM_FRONTEND.md) (summary table and Part C). The backend agent marked everything Done; my verification found **a mixed picture**.

**Now real and usable (build against the real API):** error envelope (all statuses), 404 for non-members, public-endpoint whitelist, annotation privacy, library duplicate 409, optimistic locking on documents and findings, project list with scopes, counts, `my_role`, tags, languages, milestones and questions, evidence history/dependencies/annotations, narrators/authors/critics/coverage lookups, richer corpus search (highlights, why-matched, chain summary, hukm label), search runs with stored hits, saved searches, sessions, notification preferences, members with contribution summary, `users/search`, reviewer assignments, public researchers, admin lists (users, applications, limits, jobs, closures, rights flags).

**Broken or fake (keep mocked or hidden until fixed):**
- HTTP 500: `GET /home`, `GET /projects/{id}/summary`, `GET /me/corpus-proposals`, `GET /corpus/hukms`, `GET /corpus/books/{id}/chapters` (C-5).
- Stubs that fabricate data: exports (jobs never run, fake parts, dummy download, invented preview counts) (C-7); `/admin/ops`; `/home` updates (C-9).
- **MFA can be bypassed** (C-4): the UI will not offer MFA enrolment or an MFA login step until the backend verifies codes.
- Not built at all: datasets, uploads, RIS import, public dataset/dossier pages (API-15), and all of DEF-10 (OpenAPI still stale).

**Security defects the UI cannot hide (reported, not ours to fix):** user and profile objects serialise `password_reset_token`, `mfa_secret`, `recovery_codes` (C-8); public apply skips email verification and throttling, and register returns the verification token (C-1, C-2); role vocabulary still conflicts and `co_investigator` keeps owner powers (C-3).

**Plan consequences**
1. The frontend never reads or stores the secret-bearing fields, and its Zod schemas strip them, so a backend fix changes nothing for us.
2. Phase 1 order is unchanged, but each step now says which parts are real and which are mocked (§6).
3. The corpus search item shape changed (`occurrences[]` replaced `references[]`); the schemas accept both until the backend confirms (C-6).
4. `expected_version` is optional on the server, so the client **always sends it** on document and finding saves.
5. Screen 01 uses the public `POST /applications` for the Apply form (it takes the password and the interests text in one call), and treats email verification as pending until C-1 is fixed.

## 0. What changed in revision 2

| # | Change | Why |
|---|---|---|
| 1 | The mockup data was never read in draft 1; this revision uses it (every `.dc.html` carries its fixtures and state logic in an inline script). | The specs under `docs/design/screens/` are thin; the mockups hold the real data shapes. |
| 2 | **R1a scope tightened** to `docs/requirements/milestones/R1a_MVP.md`: no uploads, no WYSIWYG, no advanced analysis, no sharing in R1a. Draft 1 wrongly put TipTap and uploads in Phase 1. | R1a editor is a structured **Markdown** editor with live preview, per-block direction and autosave (WRT-03). |
| 3 | Account status values are **`unverified \| pending \| approved \| suspended`** (draft 1 said `active`). | Read from `AdminController::updateUserStatus` and live data. |
| 4 | **Three different error shapes** exist, plus a status-code bug; the HTTP client must normalise all of them. | Verified live (see §3). |
| 5 | **OpenAPI is stale** (27 real routes missing, 9 listed paths do not exist), so types are written by hand and verified by contract tests. Draft 1 planned to generate them. | Route list vs `openapi.json` diff. |
| 6 | **Role vocabulary conflict** inside the backend; the frontend isolates it in one module. | Two incompatible role enums plus the SRS set. |
| 7 | The whole interface is **RTL** when the UI language is Sorani or Arabic (R1a ships both). RTL, Eastern-Arabic numerals, Hijri dates and time zone are core infrastructure in Phase 0, not polish. | Design `CLAUDE.md` and screen 14. |
| 8 | **Mock-first for missing APIs**: MSW handlers implement the contract requested in the API file, so phases are not blocked on the backend. | Many R1a screens need endpoints that do not exist yet. |
| 9 | Eleven backend defects found (privacy leaks, existence disclosure, no optimistic locking, etc.) are reported separately as **DEF-n**. | They affect what the UI can promise. |
| 10 | Release feature flags: R1b+ areas are shown **disabled** in R1a, as in the mockups ("Notifications [R1b]"). | Design rule. |

## 1. Sources of truth (in priority order)

1. **SRS** (`docs/requirements/Open_Hadith_Research_Platform_Requirements.md`) and the milestone extracts. They win any disagreement.
2. **Mockups** (`docs/design/HadithResearch/`) for layout, copy, states and data shape; `CLAUDE.md` there for the visual system.
3. **Backend code and feature tests** for what the API really does. The written `API_Design_Specification.md`, `openapi.json` and Postman/Bruno collections have drifted from the code and are only hints.
4. **Live responses** from `php artisan serve` for corpus shapes (read-only calls only).

## 2. Stack and decisions

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite 8 + React 19 + TypeScript 6 (installed) | |
| Routing | React Router (data router) | Layouts: public → account shell → project shell → admin/editor |
| Server state | TanStack Query | Pagination, retries, optimistic updates |
| Forms | React Hook Form + Zod | Map both 422 shapes onto fields |
| Styling | CSS variables (tokens from design `CLAUDE.md`) + CSS Modules, **logical properties only** (`margin-inline-start`, etc.) | RTL-safe by construction |
| i18n | i18next, keys in English first; `ckb` and `ar` after specialist review | `<html dir>` follows UI language |
| Dates/numbers | `Intl` with `ar-u-nu-arab`, Hijri via `Intl.DateTimeFormat('…-u-ca-islamic')`; user prefs from screen 14 | Hijri from sources shown as stored; converted dates labelled |
| Editor (R1a) | **CodeMirror 6** Markdown with live preview, per-block direction toggle, autosave, citation syntax `[@EV-0004 exact]` | WYSIWYG (TipTap) only in R2, screen 34 |
| Graphs | React Flow (+ d3 layout); Cytoscape elements come from the API as-is | Screens 27, 32 |
| API types | **Hand-written TS types + Zod schemas**, checked by contract tests against a running backend | Replaces draft 1's openapi codegen |
| Tests | Vitest + Testing Library; MSW for mocks and the six states; Playwright for journeys | |
| Fonts | Newsreader, IBM Plex Sans, IBM Plex Mono, Noto Naskh Arabic, self-hosted | |

Visual rules (from the design): desktop only ≥1024px with a "use a larger screen" notice below; paper `#F5F1E8`, surface `#FFFDF8`, ink `#1D1A15`, accent `#1F5A57`, warn `#9A3B24` for real errors only; provenance always text + icon; neutral states dashed, never red; counts always carry units; six states on every screen.

## 3. The backend as it actually behaves (verified 5 Oct 2026)

- **Run locally:** `php artisan serve` on `127.0.0.1:8000`; PostgreSQL on 5432; CORS is `Access-Control-Allow-Origin: *`. We still use the Vite proxy `/api → 127.0.0.1:8000`. Demo accounts come from `ScholarlyDemoSeeder`. The dev DB already holds demo data (25 public announcements, 22 publications) and the **real corpus** (1,400 books; 961 hits for "الوضوء").
- **Auth:** Sanctum bearer token from `POST /auth/login` or `/auth/register`. **Tokens never expire** (`config/sanctum.php`: `expiration => null`), login has no throttling, and the login/`me` payloads **do not include `is_admin`** or any role. [DEF-6, API-2]
- **Success envelope:** `{ success, message, data, meta:{ timestamp, version, pagination? } }`; `pagination = { current_page, per_page, total_items, total_pages, has_more }`. `per_page` max 100. Several lists are **not paginated** (discussions, tasks, threads; notifications capped at 50, activity at 100). [DEF-12]
- **Three error shapes** the client must normalise into one `ApiError { status, code, message, fields? }`:
  1. Envelope: `{ success:false, error:{ code, message, details } }` (explicit errors, e.g. `NOT_FOUND`, `LOCKED`, `CONFLICT_OF_INTEREST`).
  2. Laravel validation: `422 { message, errors:{ field:[…] } }`.
  3. Laravel default: `401 { message:"Unauthenticated." }` and, from uncaught `AuthorizationException` / `ModelNotFoundException`, `{ message }` for policy 403s and `findOrFail` 404s.
  - **Bug:** corpus not-found returns **HTTP 400** with `error.code:"404"` (8 call sites in `CorpusController`). The client maps `code:"404"` to not-found until fixed. [DEF-1]
- **Existence disclosure:** a missing project is 404 but a private one is 403. The design requires forbidden never to reveal existence, so the client renders **the same "not available" screen for 403 and 404** on every project-scoped route. [DEF-2]
- **Corpus shapes** (public, read-only): `hadith {id, full_hadith, matn, clean_matn, type, ehala, references[]}`; `reference {id, hadith_number, page_number, book{title, edition, publisher, century, author{name, kunya, nasab, shohra, deathdate}}, chapter, section, hukm{id,name}, sanads[]}`; `sanad {id, depth, sharh, narrator_nodes[]}`; `narrator {name, kunya, laqab, nasab, rutba, rutba_description, tadlis, has_ikhtilat, birthdate, deathdate, *_count}`; criticism = `{qawl, scholar{…}}`. Notes: the design's **"occurrence" = `reference`**; **`hukm.name` is transliterated** (e.g. `Sa7ee7`) so the UI needs a label map; birth/death dates are strings; `tabaqah` is often null (render as Unknown, never blank); chain order uncertainty is not flagged by the API.
- **Roles:** `ProjectController` uses `owner/researcher/reviewer/viewer`; `CollaborationController` uses `co_investigator/contributor/reviewer/observer`; `AuthPolicyService` mixes both; the SRS and design use **Owner / Researcher / Project reviewer / Viewer**. The frontend keeps one module, `domain/roles.ts`, that maps every backend value to the SRS role and derives permissions from SRS §3.2. [DEF-3]
- **Document locking:** `POST /documents/{id}/lock` returns `423 LOCKED` with the holder's name in the message; the lock lasts 15 min and is **re-acquired by the same user to extend it** (use as heartbeat every 5 min). There is no optimistic version check on saving. [DEF-8]

## 4. Cross-cutting infrastructure (Phase 0)

1. **HTTP client**: token handling, envelope unwrap, the three-shape normaliser, 401 → sign-in with "You were signed out" (design 01), request cancellation, idempotency keys for exports/submissions.
2. **`<StateBoundary>`**: one component rendering normal / empty / loading / error / forbidden / conflict consistently; error keeps input; forbidden = not-available; partial runs never labelled complete.
3. **Direction + language**: `<html dir>` and `lang` follow the UI language; `<BidiText>` isolates source text (`dir="rtl"`, Noto Naskh Arabic); per-block direction in the editor.
4. **Display codes**: the mockups show `PRJ-0012`, `EV-0004`, `OCC-ABD-000106`, `REP-000318`, `NAR-004417`. The API only has numeric ids. Plan: `formatCode(prefix, id)` zero-pads (`PRJ-0012`, `EV-0004`, `F-02`, `D-0014`, `SUB-0007`). For corpus objects we show **`OCC-{referenceId}` plus book, volume/page and source number as separate fields** instead of the book abbreviation embedded in the mockup codes. *Needs your confirmation (§9).*
5. **Roles & permissions** from `domain/roles.ts` + `usePermission(action, project)` implementing SRS §3.2; buttons are hidden or disabled with a reason, never silently missing.
6. **Release flags** (`features.ts`): `R1a` default; R1b/R1c/R2 areas render disabled with their tag, as in the mockups.
7. **Provenance and visibility primitives**: `ProvenanceTag` (Source / Researcher note / Attributed to / Suggestion), `VisibilityBadge` (Private / Project / Public announcement / Public publication), `CountedUnit`, `NeutralState` (Unknown / Incomplete citation / Partial run / Uncertain order).
8. **Mock-first**: `src/test/mocks/pending/` holds MSW handlers for endpoints requested in the API file, each tagged `// PENDING API-n`. Flip to the real endpoint when it ships; contract tests then run against the real backend.
9. **Contract tests**: a script hits a running backend (read-only for corpus/public; a scripted demo user for the rest) and validates responses with the Zod schemas, so drift fails CI.
10. **Design gap fixes** (confirm in §9): the Apply form (01) has no password field but `POST /auth/register` requires one.

## 5. App architecture and routes

```
frontend/src/
  api/          typed client + Zod schemas + query hooks per module
  app/          router, providers, auth guard, error boundary, features.ts
  domain/       roles.ts, codes.ts, corpus adapters (reference→Occurrence, hukm labels), evidence states
  layouts/      PublicLayout, AccountShell, ProjectShell, AdminLayout
  components/   ui primitives, StateBoundary, BidiText, ProvenanceTag, VisibilityBadge, ConfirmAction
  features/     one folder per screen group (§7)
  i18n/         en (source) / ckb / ar; terminology from docs/design/terminology.md
  styles/       tokens.css, fonts.css, base.css
  test/         MSW handlers (real + pending), fixtures, contract tests
```

Routes (from `navigation-map.md`): public `/`, `/apply`, `/sign-in`, `/announcements[/:slug]`, `/research[/:slug]`; account `/home`, `/library`, `/projects`, `/projects/new`, `/searches`, `/notifications`, `/downloads`, `/settings`; project `/projects/:id/{overview,resources,searches,evidence,analysis,discussion,findings,activity,members,submission,settings}`; `/admin/*`; `/editor`, `/review/:id`. Pending/unverified/rejected applicants can reach **only** the status page (ACC-03); this is enforced in the client route guard and must also be enforced by the backend [DEF-6].

## 6. Phases

Estimates are for one developer, assuming mock-first so backend delivery does not block UI work.

### Phase 0 · Foundations (≈1.5 weeks) · **Done 5 Oct 2026**
Delivered: Vite proxy, tokens and self-hosted fonts, router with guards and release flags, screen registry (all 41 mockups as placeholders), auth provider, HTTP client with the three-shape error normaliser, Zod schemas for auth and corpus, `StateBoundary`, `BidiText`, provenance/visibility/neutral badges, `CountedUnit`, `ConfirmAction`, `Pagination`, roles and display-code modules, i18n with RTL switching, numerals and Hijri formatting, MSW test harness, 49 unit tests, and read-only contract tests (`npm run test:contract`). Decisions applied: §9 recommendations (display codes `OCC-<id>`, password field on Apply, SRS role names, English as working language, stack as listed). Not yet done from the original list: route-level code splitting (add with Phase 1 screens), self-hosting only the weights in use.
Everything in §4; tokens, fonts, router, auth, CI (lint, typecheck, test, build); replace the Vite demo files; Vite proxy; first contract tests against corpus and public endpoints.

### Phase 1 · R1a Personal Research Core (≈8 weeks)
**Progress:** steps 1 (screen 01), 2 (Home), 3 (Projects: 04, 05, 06), 4 (Resource picker, 07) and 5 (My Library 03, Project resources 03b) done 6 Oct 2026. Step 6 (Search workspace, project screen 08) done 6 Oct 2026; the account page Saved Searches (08s) was deferred and then built 6 Oct 2026 (list, rename, delete, "Open in a project…", and "Save search → Only me" in the workspace); personal searches still cannot be run on their own (request file C-15). Step 7 (Evidence inspector, 09) done 6 Oct 2026; gaps in request file C-16. **Correction 6 Oct 2026:** steps 8, 9 and 10 were marked done after another agent added screens 10, 11 and 12 in commit `41fa191`. Review showed they are static ports of the mockups: they make no API calls, show fixture data (a fake analysis, a sample document, nine invented export jobs) and still carry the mockup's design-review bars. They are **not done** and are being rebuilt one at a time against the real API, in the order Downloads (12), Findings and document editor (11), Comparison (10). **Step 10 (Downloads, 12) rebuilt and done 6 Oct 2026** against the real endpoints (gaps in request file C-17). **Step 9 (Findings and document editor, 11) rebuilt and done 6 Oct 2026** (gaps in C-18). **Step 8 (Comparison, 10) rebuilt and done 6 Oct 2026** (gaps in C-19); no static mockup port is left in the code. **Step 11 (Profile and settings, 14) built 6 Oct 2026** (gaps in C-21; it was written in the previous session and committed by the user; this session reviewed it, fixed a broken test, and filed C-21; live contract and browser checks need the backend, which cannot start in this environment, see the TODO decision log). The ordered work list with acceptance criteria is `docs/frontend/FRONTEND_TODO.md`. Known gaps in step 5 are in the request file, C-13 and C-14: tags, notes, locator and snapshot are not stored by the backend, "used in projects", project-resource tag editing and collection filtering have no data yet, and the screens say so rather than showing empty values.

Order gives a usable slice at each step. *(⚠ = needs pending API)*
1. ✅ **Auth and onboarding** (01 done; 14 security tab still to do): apply, verify, status pages (pending / info requested / rejected / approved), sign-in, recovery, sessions. **Real:** apply, login, recovery, sessions, status, replies. **Mocked/hidden:** MFA (C-4); verification flow assumes C-1/C-2 get fixed.
2. ✅ **Account shell + Home** (02, built from `/projects`, `/me/exports`, `/me/tasks`, `/notifications/unread-count`; `/home` not used): projects, next actions, exports, updates. **Real:** `/projects`, `/me/tasks`, `/me/exports`. **Mocked until fixed:** `/home` (500, C-5), `/me/corpus-proposals` (500); the `updates` feed is fabricated (C-9) so it is not shown.
3. ✅ **Projects** (04, 05, 06 done): owned / shared / archived / trash tabs, create, overview with evidence counts by state, stage control with undo, archive, trash and restore, copy-to-project. **Real:** list, scopes, counts, create, stage, archive, trash/restore, milestones, questions. **Mocked until fixed:** `/projects/{id}/summary` (500, C-5).
4. ✅ **Corpus browsing and Resource picker** (07 done; hukm labels and book/narrator drill-down pages come with screens 10, 30, 31): books, hadith, narrators; duplicate prompt. **Real:** books, search, narrators, authors, critics, coverage, duplicate 409. **Mocked until fixed:** hukm list and book chapters (500, C-5).
5. ✅ **My Library + Project resources** (03, 03b): items, collections, tags, notes, add-to-project with sharing preview. ⚠ API-5
6. ✅ **Search workspace** (08): query, grouped results, filters with coverage notes, save query, runs, result sets, bulk add with per-item outcomes. ⚠ API-6
7. ✅ **Evidence inspector** (09): states with reasons, history, annotations (four kinds, private/project), link to finding, dependencies, correction proposals. ⚠ API-7
8. ✅ **Comparison workspace** (10): occurrences side by side, chains, narrator dossier, criticism matrix; saved analyses. Rebuilt against `analyses/*` and `corpus/*` 6 Oct 2026; gaps in request file C-19.
9. ✅ **Findings and document editor** (11): Markdown editor, citations, versions and compare, restore, autosave, conflict view. Rebuilt against the real API 6 Oct 2026; gaps in request file C-18.
10. ✅ **Downloads** (12), rebuilt 6 Oct 2026: scope preview, jobs, parts, manifest, quota, authenticated download, start again. **Real:** list, quota, preview, create (one idempotency key per attempt), cancel (queued or running only), manifest, part download. **Not offered (backend):** retry, other formats, resources and document scopes **[C-17]**.
11. ✅ **Administration** (13): applications, accounts and roles, corpus corrections, limits and jobs, support access, audit log, operations. Built against the live API 6 Oct 2026; MFA step-up is not offered because the server has none. Gaps in request file C-20 (two P0 defects: email verification and support grants crash).

### Phase 2 · R1b Collaboration and announcements (≈3 weeks)
Members and invitations (15), discussion and tasks (16), notifications (17), activity (18), announcement editor and public page (19, 20), collaboration-interest form (40). ⚠ API-11, API-12, API-13

### Phase 3 · R1c Review and publication (≈3 weeks)
Submission builder with pre-publication validation (21), editorial console (22), reviewer workspace (23), public publication page and citation export (24), public research search (25). ⚠ API-13, API-14

### Phase 4 · R2 Advanced analysis and exchange (≈5 weeks)
Matn alignment (26), isnād graph (27), hadith family (28), ʿilal case (29), narrator dossier (30), book structure and concordance (31), argument map (32), search-run comparison and schedules (35), project templates (37), package import and graph export (38); then WYSIWYG editor (34), uploads and RIS import (36), dataset builder (33), public dataset and dossier pages (39). ⚠ API-15. Screens 26–32 need specialist review of labels before final copy.

### Phase 5 · Hardening (≈2 weeks)
Accessibility audit, RTL review with a Sorani/Arabic reader, performance (virtualised result lists, route splitting), Playwright journeys (UC-01, UC-02, UC-07, onboarding), production build config.

## 7. Screen → API coverage (revised)

✅ sufficient · ⚠️ exists with gaps · ❌ missing. Release = SRS release the screen belongs to.

| # | Screen (release) | Backend today | Status / gaps |
|---|---|---|---|
| 01 | Registration (R1a) | `auth/register`, `auth/login`, `applications`, `applications/my-status` | ⚠️ no verify/resend/recovery, no info-request/reply, no throttle **[API-1, DEF-6, DEF-13]** |
| 02 | Home (R1a) | `projects`, `notifications`, per-project tasks/exports | ⚠️ needs aggregate, next actions, cross-project lists **[API-3]** |
| 03 | My Library (R1a) | `library/items`, `collections`, `bibtex/*` | ⚠️ no tags, excerpts, snapshot/source status, share options **[API-5, DEF-9]** |
| 03b | Project resources (R1a) | `projects/{id}/resources` | ⚠️ no origin, project collections **[API-5]** |
| 04 | Project index (R1a) | `GET projects` (filters `stage`, `is_archived`, `q`) | ⚠️ no trash list/restore, tab counts, tags, `my_role`, next action **[API-4]** |
| 05 | Project creation (R1a) | `POST projects` | ⚠️ single `primary_language` vs multi-language; no tags **[API-4]** |
| 06 | Overview and settings (R1a) | `projects/{id}`, `stage`, `archive`, `DELETE` | ⚠️ no summary counts, milestones, open questions, copy-to-project, restore **[API-4]** |
| 07 | Resource picker (R1a) | `corpus/books`, `corpus/search`, `library/items`, `resources` | ✅ (⚠️ duplicate prompt **[DEF-9]**) |
| 08 | Search workspace (R1a) | `corpus/search`, `searches`, `run`, `search-runs`, `result-sets`, bulk add | ✅ built 6 Oct 2026 (project screen). ⚠️ runs are synchronous, capped at 100 and report-level; bulk add goes through My Library; evidence dedupe by wording; no sort, coverage or book filter; personal searches cannot run **[C-15]** |
| 09 | Evidence inspector (R1a) | `evidence`, `annotations`, `history`, `dependencies`, `findings` link, `corpus/proposals` | ✅ built 6 Oct 2026. ⚠️ attribution dropped, collector contact details in list rows, foreign evidence linkable, reasons not enforced, no origin or corpus version, removal permanent **[C-16]** |
| 10 | Comparison (R1a) | `analyses/*`, `corpus/*` | ✅ built and verified against the live backend; gaps (demo runs in another shape, word-set matn comparison, criticism matrix without wording or verdict, no names/delete/inputs-changed signal, no uncertain-order data) in **C-19** |
| 11 | Finding and document editor (R1a) | `findings`, `documents`, `versions`, `lock`, `draft`, `cite` | ✅ built and verified against the live backend; gaps (no draft clearing on save, finding versions and `withdrawn` not enforced, wrong missing-component flags) in **C-18** |
| 12 | Downloads (R1a) | `exports`, `exports/preview`, `exports/quota`, `exports/{id}/manifest`, part download | ✅ rebuilt 6 Oct 2026. ⚠️ synchronous single-part JSON ZIP, no retry, expiry and access not enforced, thin manifest, no delete **[C-17]** |
| 13 | Administration (R1a) | `admin/users`, `applications`, `audit-logs`, `corpus/proposals`, `limits`, `support-grants`, `jobs`, `ops` | ✅ built and verified against the live backend (own shell, seven views); limits are read-only because the server does not apply them, no step-up, no outcome in the audit log; **P0:** email verification and support grants return 500 **[C-20]** |
| 14 | Profile and settings (R1a) | `auth/profile`, `auth/password/change`, `auth/sessions`, `auth/mfa/*`, `notifications/preferences`, `auth/account/close` | ✅ built 6 Oct 2026 in `features/settings` (profile and public fields with preview, display saved to the account, security: password, two-step sign-in, sessions; notifications; account closure). Gaps in C-21. |
| 15 | Members (R1b) | `members`, `invitations`, accept/decline, `leave` | ✅ built 7 Oct 2026 from the backend code (not yet run live): members with roles and contributions, invite by e-mail with a copyable link, resend, withdraw, change role, remove, leave, the invitation page, the role table. Transfer not offered. Gaps in C-22. |
| 16 | Discussion and tasks (R1b) | `discussions`, `comments`, `resolve`, `tasks` | ✅ built 7 Oct 2026 from the backend code (not yet run live): discussions with replies, decisions, new discussion (also from an evidence item or a finding), tasks with filters, create, edit, done, blocked. No mentions, no reopen, no outcome. Gaps in C-23. |
| 17 | Notifications (R1b) | `notifications`, prefs | ⚠️ category set differs from design, no filters/unread count **[API-12]** |
| 18 | Activity (R1b) | `projects/{id}/activity` | ✅ (⚠️ capped at 100, few filters) |
| 19 | Announcement editor (R1b) | `announcement`, `publish` | ⚠️ no unpublish, history, co-author consent **[API-13]** |
| 20 | Public announcement (R1b) | `public/announcements*` | ✅ (**leaks owner email, `is_admin`** **[DEF-5]**) |
| 21 | Submission (R1c) | `validate-pre-publication`, `submissions` | ✅ |
| 22 | Editorial console (R1c) | `editor/*` | ⚠️ no candidate list with conflicts; **any approved user passes the gate** **[API-14, DEF-7]** |
| 23 | Reviewer workspace (R1c) | `editor/submissions/{id}/review` | ⚠️ no "my assignments", accept/decline **[API-14]** |
| 24 | Public publication (R1c) | `public/research/{slug}`, `cite` | ✅ |
| 25 | Public search (R1c) | `public/research` | ⚠️ no filters/facets **[API-13]** |
| 26–29 | Alignment, isnād graph, families, ʿilal (R2) | `analyses/collate`, `isnad-topology`, `temporal-check`, `families`, `ilal-cases` | ✅ |
| 30 | Narrator dossier (R2) | `corpus/narrators/*`, `narrator-assessments`, `assertions`, `geospatial/*` | ✅ |
| 31 | Book structure (R2) | `corpus/books/{id}/structure`, `concordance` | ✅ |
| 32 | Argument map (R2) | `argument-graph`, nodes, edges | ✅ (fields `title/content`, relation set `supports/refutes/qualifies/replies_to/alternative_to`; the written spec says otherwise, follow the code) |
| 33 | Dataset builder (R2) | none | ❌ **[API-15]** |
| 34 | Rich-text editor (R2) | `documents` | client-side; needs the citation markup contract **[API-8]** |
| 35 | Search-run compare (R2) | `search-runs/compare`, `search-subscriptions` | ⚠️ compare works only on saved result sets, runs cannot be listed **[API-6]** |
| 36 | Uploads and import (R2) | `library/bibtex/*` | ❌ uploads, RIS, scan status **[API-15]** |
| 37 | Project templates (R2) | `project-templates*` | ✅ |
| 38 | Export/import (R2) | `exports/graph`, `projects/import-package` | ⚠️ JSON body only, no file upload **[API-9]** |
| 39 | Public dataset/dossier (R2) | none | ❌ **[API-15]** |
| 40 | Collaboration interest (R2) | `collaboration-requests` (authenticated, project-scoped) | ⚠️ needs a public endpoint **[API-13]** |

## 8. Definition of done (per screen)

1. Matches the mockup at ≥1024px with all six states (use the mockup's state switcher as the checklist).
2. English strings in i18n files; `ckb` and `ar` keys present (values may await review). Layout verified in RTL.
3. Source text uses `<BidiText>`; counts carry units; provenance and visibility are text + icon.
4. Typed API hooks, Zod schema, MSW handler (real or pending), one Vitest test; keyboard operable.
5. Destructive actions use `ConfirmAction`; no input is lost on error; forbidden and missing look identical.
6. Role-gated controls come from `usePermission`, never ad hoc checks.

## 9. Risks and decisions needed from you

**Decisions**
1. **Display codes** (§4.4): accept `OCC-{referenceId}` + separate book/page/number, instead of codes like `OCC-ABD-000106` that the corpus cannot produce?
2. **Password on the Apply form**: add password + confirmation to screen 01 (the API needs it), or keep apply passwordless and set the password in the verify step?
3. **Role names**: use the SRS set (Owner, Researcher, Project reviewer, Viewer) everywhere in the UI, regardless of what the backend ends up storing?
4. **English UI**: mockups say "English arrives in R2". Keep English as the working language for review builds and ship `ckb` and `ar` first?
5. **Stack**: confirm React Router, TanStack Query, React Hook Form + Zod, CSS Modules (not Tailwind), i18next, CodeMirror 6, React Flow.

**Risks**
- **Backend gaps are large for R1a** (home, projects trash/restore/summary, search runs, exports, admin, auth). Mock-first keeps UI moving, but real integration depends on the other agent.
- **Privacy defects** (DEF-4, DEF-5, DEF-6) mean the UI cannot guarantee several design promises until the backend fixes them.
- **RTL interface everywhere** is the biggest design-system cost; test it from the first component.
- **Editor**: Markdown with citations, per-block direction and autosave without a server draft endpoint is fragile; local drafts (IndexedDB) are the fallback until **API-8** ships.
- **Contract drift**: three artifacts (spec, OpenAPI, Postman) disagree with the code; contract tests are the safety net.
