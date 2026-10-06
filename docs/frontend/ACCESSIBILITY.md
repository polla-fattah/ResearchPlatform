# Accessibility and right-to-left checks

Result of the passes of 7 October 2026 (todo items G1 and G2). Everything here was checked in a real browser (Chromium,
through Playwright) against the BUILT app with its API answered from memory (`frontend/e2e/support/mockApi.ts`), and by unit
tests. It has not been checked with a screen reader or against the live backend (see "Still owed").

## How to run the checks

```
cd frontend
npm run build
npm run e2e        # the browser checks below; needs Chromium (PLAYWRIGHT_CHROMIUM_PATH if it is not found)
npm test           # includes the colour-contrast test of the design tokens
```

| File | What it checks |
|---|---|
| `e2e/a11y.spec.ts` | axe (WCAG 2.1 A and AA, best practices) on 18 screens, and the screen must show its data and not an error (an `alert`): sign-in, apply, public announcements and research, home, projects, overview, evidence, searches, analysis, findings, a document, argument map, members, library, downloads, settings, not-found. Serious and critical problems fail the test. |
| `e2e/rtl.spec.ts` | The same 18 screens in Sorani (`ckb`) and Arabic (`ar`): `dir="rtl"` and `lang` on the page, no sideways scrolling, the rail on the right, axe again, and a screenshot in `e2e/screenshots/` (not committed). The interface strings of both languages are still English until specialist translation, so this checks mirroring, not wording. |
| `e2e/dialogs.spec.ts` | Dialogs: focus moves in, Tab never reaches the page behind, axe passes while open, Escape closes, focus returns to the button that opened it; the skip link. |
| `e2e/journeys.spec.ts` | Seven whole journeys (see `FRONTEND_TODO_NEXT.md`, G4): sign in, sign out, accept an invitation, create a document and type in the editor, start an export, a page that fails to load, admin approval. |
| `src/styles/contrast.test.ts` | Contrast of every colour pair the interface draws text or outlines with. |

## Results

- **No serious or critical axe problems** on any of the 18 screens, in English, Sorani or Arabic.
- Found and fixed:
  - **Focus was lost when a dialog closed.** A dialog taken out of the page while open does not give focus back, so it fell to
    the top of the page (WCAG 2.4.3). `Modal` and `ConfirmAction` now return focus to the button that opened them
    (`components/useReturnFocus.ts`); both are tested, and the browser check passes.
  - Heading levels that skipped a level (document page, settings), two landmarks with the same name (the account rail and the
    project tabs), and the not-found page having no `main` landmark.
- Moderate and minor axe notes are printed by `a11y.spec.ts`; none is left open on these screens.

## Colour contrast of the tokens (`src/styles/tokens.css`)

Text needs 4.5:1; the outline of a control needs 3:1. All pairs below pass and are tested.

| Text colour | on paper | on surface | on white | on its soft background |
|---|---|---|---|---|
| ink | 15.4 | 17.1 | 17.3 | 14.6 (accent-soft), 14.0 (sunk) |
| ink-2 | 8.5 | 9.5 | 9.6 | 7.8 (sunk) |
| muted | 5.3 | 5.9 | 6.0 | 5.1 (accent-soft), 4.8 (sunk) |
| accent | 7.0 | 7.8 | 7.9 | 6.7 (accent-soft) |
| accent-dark | 10.9 | | | 10.4 (accent-soft) |
| warn | 6.2 | | 6.9 | 5.7 (warn-soft); warn-ink 9.5 |
| note / attributed | 7.5 / 6.0 | | | 7.2 / 5.8 |
| on-accent (button text) | | | | 7.9 on accent, 10.4 on pressed |

The dashed "neutral" outline of an unknown or unavailable state is 3.4 to 3.8:1 (passes for a control outline). The "faint"
colour (2.1 to 2.4:1) is used only for disabled and decorative text, which WCAG exempts, and a test keeps it out of text use by
documenting that it is below 3:1. Colour is never the only signal: provenance, state and validity always carry text or an icon.

## Other things in place

Skip link on every signed-in page; one `main` landmark per page; a global `:focus-visible` ring; reduced motion switches
animation and transition off (`base.css`); form labels and error messages are tied to their fields (`Field`); live status
lines use `role="status"` and failures `role="alert"`; every list, table and group has an accessible name; the graph canvases
(isnād, argument map) are announced as companions of a table or an outline that holds the same facts and is the way in by keyboard.

## Needs a decision (not changed)

**The workspaces are blocked below 1024 CSS pixels.** The design decided "desktop only" and replaced the 360 px rule of NFR-12
(`docs/design/HadithResearch/CLAUDE.md`). A person who zooms the browser makes the window narrower in CSS pixels: a 1280 px
screen at 150% is about 853 px wide, at 200% 640 px, at 400% 320 px, so the page shows "Use a larger screen" and nothing
else. That fails WCAG 1.4.4 (resize text to 200%) and 1.4.10 (reflow) for exactly the people who use zoom. Options, in order of effort:
lower the threshold (for example to 640 px) and make the layouts collapse to one column; keep the notice only for phone-sized
screens (by device width, not window width); or accept the barrier and record it as a known limitation in the release evidence.

## Still owed

- A pass with a screen reader (NVDA with Firefox, VoiceOver with Safari) on the main journeys, in Arabic and Sorani once the
  strings exist: reading order, names of the graph and outline views, announcements after saving, errors and dialogs.
- Keyboard walk-throughs of the two graphs and the document editor (CodeMirror), including the editor's shortcuts, which are not
  yet written down for users.
- Real Sorani and Arabic strings (specialist translation), then a second RTL pass for line breaking, numerals (Eastern
  Arabic-Indic digits are a display preference already) and Hijri dates in running text.
- High-contrast / forced-colours mode and print styles.
- Re-run `npm run e2e` against the live seeded backend once it exists, replacing the in-memory API.
