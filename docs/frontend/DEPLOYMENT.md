# Deploying the frontend

The frontend is static files. `npm run build` writes them to `frontend/dist/`; any web server can serve them. It needs
three things from the server: a fallback to `index.html` for every address that is not a file (the app routes in the
browser), a forward of `/api` to the Laravel backend, and the security headers in `SECURITY.md`.

## Build

```
cd frontend
npm ci
npm run check          # lint, types, project rules, unit tests, build, bundle budget
# or only: npm run build
```

Settings are put into the files at build time (see `frontend/.env.example`): `VITE_API_BASE` (default `/api/v1`, same
origin), `VITE_RELEASE` (the newest release whose screens are on; the default `R1a` switches the later ones to disabled
until the live checks in `LIVE_CHECKS.md` pass), and the emergency `VITE_LENIENT_CONTRACT`.

## What the build contains

About 120 JavaScript files in `dist/assets/`, named with a hash of their content. The first visit to the sign-in page loads
9 of them (about 780 kB, about 250 kB compressed): the app's core, React, the form and validation libraries, i18n and the
query library. Every other screen is fetched the first time its route opens, and the document editor (CodeMirror, about
480 kB) when a document opens. `npm run budget` keeps it that way: no file over 600 kB, a first visit under 900 kB.

## Web server (nginx example)

```nginx
server {
  listen 443 ssl http2;
  server_name research.example.org;
  root /srv/openhadith/frontend/dist;

  # Files with a hash in their name never change: cache them for a year. index.html must always be fetched again,
  # because it names the current files.
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
  location = /index.html { add_header Cache-Control "no-cache"; }

  # The API, same origin. Do not log the query string of the recovery and verification pages.
  location /api/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; }

  # Every other address is a screen of the app.
  location / { try_files $uri /index.html; }

  gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
  # Add the headers from SECURITY.md (Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, ...).
}
```

After a release a browser that still has the old `index.html` open asks for files that no longer exist. The page then shows
"This page could not be loaded" with a Reload button (`RouteError`); keep the previous release's `assets/` for a day if you
want those people not to see it.

## Before the first real use

1. A backend that runs (PHP 8.4, PostgreSQL, the corpus tables) with the demo data, then the live checks and the contract
   suite in `LIVE_CHECKS.md`. Until they pass, the screens built from the backend's code are tagged `[live-owed]`.
2. The security fixes in the backend listed in `SECURITY.md` (several are P0).
3. The headers above on the real host, and a decision on an error-reporting service (`app/errorReporting.ts`).
4. The decision about the 1024 px minimum width in `ACCESSIBILITY.md`.
5. Real Sorani and Arabic strings (the interface falls back to English for every missing string).
