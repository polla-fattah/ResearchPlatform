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
| `npm run check` | lint + typecheck + unit tests + build (run before committing) |
| `npm test` / `npm run test:watch` | Vitest + Testing Library + MSW |
| `npm run test:contract` | read-only contract tests against a running backend (public endpoints) |

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

## Rules

- Logical CSS properties only (`margin-inline-start`, never `margin-left`): the whole UI flips RTL for Sorani and Arabic.
- Colours come from `src/styles/tokens.css`; provenance is text + icon, never colour alone; unknown or incomplete states are dashed, never red.
- Forbidden and not-found look identical (403 and 404 are treated the same).
- Role checks go through `src/domain/roles.ts`, never ad hoc.
- Endpoints that do not exist yet get an MSW handler tagged `// PENDING API-n`.
