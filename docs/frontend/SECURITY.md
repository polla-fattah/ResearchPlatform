# Frontend security notes

Result of the security pass of 7 October 2026 (todo item G5). It was done by reading the code and running the checks that
need no backend. Nothing here was tested against a live server (the cloud session cannot run the backend), so a hands-on
test against a seeded server is still owed (see `LIVE_CHECKS.md`).

## What the app keeps in the browser

| What | Where | Lifetime |
|---|---|---|
| Sign-in token | memory, copied to `sessionStorage` | the tab; removed on sign-out and when the server answers 401 |
| Language, display preferences | `localStorage` (`oh.lang`, `oh.prefs`) | until cleared; not sensitive |
| Drafts the server could not take (connection dropped) | `localStorage` (`oh.draft.<project>.<document>`) | until sent, **removed on sign-out**; kept when a session only expires, so offline typing is not lost |

The token is never put in an address, a log line or a stored query result. Sign-out also clears the query cache.

## Where untrusted text could become markup

- One `dangerouslySetInnerHTML`: the Markdown preview (`features/writing/MarkdownPreview.tsx`). It renders with
  `html: false` (raw HTML in the text is escaped), images off, and `javascript:` links dropped (tested in
  `writingLogic.test.ts`). The text comes from collaborators, so this is the page's main exposure.
- Links built from server data: the DOI link (only for a registered-looking DOI) and the authenticator-app link in the
  two-factor setup, which is shown only when it starts with `otpauth://`. There is no `target="_blank"`.
- Everything else is drawn as text by React; names and titles go through `BidiText`.

## What a person is told when something fails

- A failed request shows the server's message only for 4xx answers (written for people); for 5xx and network errors a plain
  sentence is shown and never the server's text (`api/errorMessage.ts`).
- A page that breaks while it is drawn shows a fixed message inside its layout (`pages/RouteError.tsx`); the error and its
  stack are not shown. They go to `reportError` (`app/errorReporting.ts`). No reporting service is wired yet: nothing is
  sent anywhere. When one is chosen, call `setErrorReporter` once in `main.tsx`; do not send what a person typed, the token,
  e-mail addresses or research text, and drop the address's query string (it can hold a recovery token).
- Errors outside React (a failed script, an unawaited promise) are caught by `listenForUnhandledErrors` and reported the same way.

## Replies that do not match what the screen expects

Every reply is checked against its schema. A reply that does not match is refused in every build (the screen shows its error
state with a retry) and reported through `reportError('contract')` with the schema's complaints and no values from the reply.
Before 7 October 2026 only development and tests did this and the production build passed the reply on; a wrong shape then
crashed a layout (found by the browser journeys). `VITE_LENIENT_CONTRACT=1` restores the old behaviour for an emergency.

## Addresses that carry secrets

Recovery and verification links contain a token (and the recovery link the e-mail address) in the query string, and an
invitation link has its token in the path. These formats come from the backend's e-mails. The page adds
`<meta name="referrer" content="strict-origin-when-cross-origin">` so a link to another site never carries the address.
Ask the web server not to log query strings for `/recover/reset` and `/verify-email`.

## Recommended response headers (set by the web server that serves `dist/`)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

The build has no inline scripts and loads no third-party script, style or font (fonts are bundled), so `script-src 'self'`
holds. `style-src` needs `'unsafe-inline'` only because about 55 components set a `style` attribute; moving those into CSS
modules would allow `style-src 'self'`. `connect-src 'self'` assumes the API is on the same origin (the dev server proxies
`/api`); add the API origin if it is not.

## Dependencies

`npm audit --omit=dev` found 0 known vulnerabilities on 7 October 2026. Run it again before every release and weekly in CI.

## Findings in the backend that matter for security (not fixable in the frontend)

Found while reading the controllers; each is in `docs/api/API_REQUESTS_FROM_FRONTEND.md` with its test:

- **C-29, C-31:** in blind review, authors and reviewers are handed each other's identities; `bypass_warnings` passes errors.
- **C-28:** the public collaboration endpoint answers 500.
- **C-30:** an invented DOI; a decision can be repeated after release.
- **C-37:** any approved researcher can write to the narrator-places table that every project shares, with no delete.
- **C-39:** an argument-map link, or a relation to another project's point, reads that project's private evidence and points.
- **C-40:** another project's search runs can be compared and another project's saved query subscribed to; any editor can switch off a colleague's alert.
- **C-42:** package import imports nothing but looks as if it did; project export checksums do not match the file.
- **C-43:** the BibTeX import saves to a shared catalogue and tells a person about another person's entries.

Every `exists:<table>,id` rule that is not limited to the project is a possible cross-project read; the controllers should be
checked for that pattern as a whole.

## Still owed

A hands-on test against a seeded server (two accounts, two projects, one reviewer, one author): signing in and out, an expired
session, recovery and verification links, the invitation flow, and the cross-project cases above; a header check against the
deployed host; a decision on the error-reporting service.
