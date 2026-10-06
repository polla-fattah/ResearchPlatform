# Open Hadith Research: frontend

React 19 + TypeScript + Vite. Built from the mockups in `../docs/design/HadithResearch/` against the Laravel API in `../backend/`.

- Plan and status of every screen: [`../docs/frontend/FRONTEND_DEVELOPMENT_PLAN.md`](../docs/frontend/FRONTEND_DEVELOPMENT_PLAN.md); the working list and its log: [`FRONTEND_TODO_NEXT.md`](../docs/frontend/FRONTEND_TODO_NEXT.md)
- Requests to the backend (every gap and defect found, C-1 to C-44, by priority): [`../docs/api/API_REQUESTS_FROM_FRONTEND.md`](../docs/api/API_REQUESTS_FROM_FRONTEND.md)
- What still has to be checked against a live backend: [`LIVE_CHECKS.md`](../docs/frontend/LIVE_CHECKS.md)
- Security notes and recommended headers: [`SECURITY.md`](../docs/frontend/SECURITY.md) · accessibility and right-to-left checks: [`ACCESSIBILITY.md`](../docs/frontend/ACCESSIBILITY.md) · deploying: [`DEPLOYMENT.md`](../docs/frontend/DEPLOYMENT.md)

## Run

```bash
cd ../backend && php artisan serve      # API on http://127.0.0.1:8000
cd ../frontend && npm install && npm run dev
```

Vite proxies `/api` to the backend (`VITE_API_PROXY` overrides the target).

| Command | What it does |
|---|---|
| `npm run dev` | dev server; `/dev/kit` shows the component kit and the six states |
| `npm run check` | lint + typecheck + audit + unit tests + build + bundle budget (run before committing) |
| `npm run budget` | after a build: fails if a JavaScript file is over 600 kB or a first visit loads over 900 kB |
| `npm run e2e` | browser checks of the BUILT app in Chromium (Playwright): accessibility with axe on 18 screens, right-to-left in Sorani and Arabic, dialogs and focus, seven journeys. The API is answered by `e2e/support/mockApi.ts`. Run `npm run build` first; set `PLAYWRIGHT_CHROMIUM_PATH` if Chromium is not found |
| `npm run audit` | project rules a linter cannot see: logical CSS only, tokens not hex colours, no missing or hard-coded text, no mockup review bars or fixture data, and the state rules below |
| `npm test` / `npm run test:watch` | Vitest + Testing Library + MSW |
| `npm run test:contract` | contract tests against a running backend; set `CONTRACT_EMAIL`/`CONTRACT_PASSWORD` for signed-in tests and `CONTRACT_WRITE=1` for the write flows (they create and clean up `[contract-test]` data) |
| `node scripts/merge-i18n.mjs <section>` | merges `src/i18n/locales/<section>.en.json` (the section's inner object) into `en.json` and deletes the part file |
| `node scripts/extract-mockup.mjs [--data] "<mockup name>"` | prints a design mockup's visible text (and with `--data` its inline fixtures) |

Environment (all optional, see `.env.example`): `VITE_API_BASE` (default `/api/v1`, same origin), `VITE_API_PROXY` (dev server only), `VITE_RELEASE` (`R1a` | `R1b` | `R1c` | `R2`, default `R1a`; screens of a later release render disabled until enabled), `VITE_LENIENT_CONTRACT` (emergency only, see Rules).

## Where things stand

All 41 mockups are registered. Screens 01 to 32, 35 to 38 and 40 are built from the backend's code and the designs; the dataset builder and public dataset pages (33, 39) and the rich-text editor (34) are shown as "not available yet" on purpose (their reasons are in the plan). **None of the screens built in phases D to F has run against a live backend** (the cloud session cannot run PHP 8.4); each is tagged `[live-owed]` in the todo and has a contract test that was written from the backend's code and not yet run. Defects found in the backend while reading it are listed in the requests file, several as P0 or P1.

## Layout

```
src/api/        http client, error normaliser (3 backend error shapes), Zod schemas, typed calls
src/app/        router, guards, auth, preferences, release flags, screen registry (all 41 mockups)
src/components/ StateBoundary (six states), BidiText, badges, ConfirmAction, Pagination, Button
src/domain/     roles (SRS matrix), display codes, vocabularies
src/i18n/       en (source), ckb and ar (pending specialist review), numerals/Hijri formatting
src/layouts/    public layout, account shell, project shell
src/pages/      placeholder per unbuilt screen, route error page, component kit
src/features/   one folder per screen or group of screens: api calls and schemas live in src/api, the folder holds the page, its dialogs, its model (pure functions) and its tests
src/test/       MSW server, helpers, shared mocks; contract/ holds the tests that need a running backend
e2e/            Playwright specs and the in-memory API for them
scripts/        audit.mjs (project rules), bundle-budget.mjs, merge-i18n.mjs, extract-mockup.mjs
```

## State management

Every piece of state has one owner (full rules S1 to S12 in `../docs/frontend/FRONTEND_TODO.md`):

| State | Lives in | How |
|---|---|---|
| Server data | TanStack Query only | `useQuery`; never copied into `useState` or context. Keys come from `src/api/queryKeys.ts` (`qk.project(id).evidence.list(q)`). |
| What a write changed | named invalidators | `invalidate.evidenceChanged(qc, projectId)` from `src/api/invalidate.ts`; components never write key arrays. |
| Shareable view state (filters, search text, page, tab, selected id) | the address | `useQueryParams()` and `useDraftParam('q', { delay: 300 })` from `src/hooks/useQueryParams.ts`. No `useState` for these. |
| Failed refetch keeps the old list | the query cache | `useLastLoaded(qk.projects.lists)`. |
| A write's error | the mutation | `<MutationNotice error={mutation.error} title="..." />`; one wording for every failure in `src/api/errorMessage.ts`. |
| A ticked set of rows | scoped to its results | `useKeyedSelection(resultsKey)`; empty again when the results change. |
| The current time | one app clock | `useNow()`; render never calls `Date.now()`. |
| Drafts and dialogs | the component that owns them | a dialog is `<Modal>` mounted only while open, so its state resets by unmounting. |
| App-wide | auth and display preferences only | their providers; no other global store. |

A `useEffect` is for timers, subscriptions and DOM APIs. If it calls `setState` to mirror other state, derive the value, put it in the address, or give the component a `key`.

## Rules

- Logical CSS properties only (`margin-inline-start`, never `margin-left`): the whole UI flips RTL for Sorani and Arabic.
- Colours come from `src/styles/tokens.css`; provenance is text + icon, never colour alone; unknown or incomplete states are dashed, never red.
- Forbidden and not-found look identical (403 and 404 are treated the same).
- Role checks go through `src/domain/roles.ts`, never ad hoc.
- Endpoints that do not exist yet get an MSW handler tagged `// PENDING API-n`.
- Every reply is checked against its Zod schema in every build; a reply that does not match is refused (the screen shows its error state) and reported without the data. Schemas keep only the fields a screen may show, which is also how blinded fields are kept out (`src/domain/blinding.ts`).
- Pages are loaded when their route opens (`lazyNamed` in `src/app/router.tsx`); keep a new page out of the first visit unless a new visitor needs it, and run `npm run budget`.
- A dialog is `<Modal>` or `<ConfirmAction>`; both give focus back to the button that opened them.
- Where the server cannot do something the design shows (or does it wrongly), the screen says so in plain words, draws nothing that would look like it works, and the gap goes into the requests file with a contract test marked `it.fails`. Never fixture data on a screen.
- Strings: `src/i18n/locales/<section>.en.json` merged with `scripts/merge-i18n.mjs`; Sorani and Arabic are filled by specialist translators from `docs/design/terminology.md` and fall back to English until then.

## Working with the live backend

1. Run the backend (PHP 8.4, PostgreSQL, the corpus) with `ScholarlyDemoSeeder`; `php artisan serve` listens on port 8000.
2. `npm run dev` (strict contract checks are on; a mismatch shows as an error state and in the console).
3. `CONTRACT_EMAIL=… CONTRACT_PASSWORD=… CONTRACT_WRITE=1 npm run test:contract`, then the browser checks listed in `LIVE_CHECKS.md`. A passing live check ticks the checkpoint it belongs to (P0.1 to P0.5, D8, E6, F15).
