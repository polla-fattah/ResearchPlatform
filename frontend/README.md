# Open Hadith Research: frontend

React 19 + TypeScript + Vite. Built from the mockups in `../docs/design/HadithResearch/` against the Laravel API in `../backend/`.

- Plan: [`../docs/frontend/FRONTEND_DEVELOPMENT_PLAN.md`](../docs/frontend/FRONTEND_DEVELOPMENT_PLAN.md)
- Requests to the backend: [`../docs/api/API_REQUESTS_FROM_FRONTEND.md`](../docs/api/API_REQUESTS_FROM_FRONTEND.md)

## Run

```bash
cd ../backend && php artisan serve      # API on http://127.0.0.1:8000
cd ../frontend && npm install && npm run dev
```

Vite proxies `/api` to the backend (`VITE_API_PROXY` overrides the target).

| Command | What it does |
|---|---|
| `npm run dev` | dev server; `/dev/kit` shows the component kit and the six states |
| `npm run check` | lint + typecheck + audit + unit tests + build (run before committing) |
| `npm run audit` | project rules a linter cannot see: logical CSS only, tokens not hex colours, no missing or hard-coded text, no mockup review bars or fixture data, and the state rules below |
| `npm test` / `npm run test:watch` | Vitest + Testing Library + MSW |
| `npm run test:contract` | contract tests against a running backend; set `CONTRACT_EMAIL`/`CONTRACT_PASSWORD` for signed-in tests and `CONTRACT_WRITE=1` for the write flows (they create and clean up `[contract-test]` data) |
| `node scripts/merge-i18n.mjs <section>` | merges `src/i18n/locales/<section>.en.json` (the section's inner object) into `en.json` and deletes the part file |
| `node scripts/extract-mockup.mjs [--data] "<mockup name>"` | prints a design mockup's visible text (and with `--data` its inline fixtures) |

Environment: `VITE_API_BASE` (default `/api/v1`), `VITE_RELEASE` (`R1a` | `R1b` | `R1c` | `R2`, default `R1a`; later releases render disabled until enabled).

## Layout

```
src/api/        http client, error normaliser (3 backend error shapes), Zod schemas, typed calls
src/app/        router, guards, auth, preferences, release flags, screen registry (all 41 mockups)
src/components/ StateBoundary (six states), BidiText, badges, ConfirmAction, Pagination, Button
src/domain/     roles (SRS matrix), display codes, vocabularies
src/i18n/       en (source), ckb and ar (pending specialist review), numerals/Hijri formatting
src/layouts/    public layout, account shell, project shell
src/pages/      placeholder per unbuilt screen, sign-in, status, component kit
src/test/       MSW server, helpers, contract tests
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
