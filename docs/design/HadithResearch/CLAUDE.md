# Hadith Research Platform — R1a screens

Source specs: local folder ResearchPlatform/design (screens/*.md, conventions.md). Plan + coverage tracker: `00 Plan.dc.html` — update screen status there after each screen.

## Visual system (no external DS; keep consistent)
- Fonts: Newsreader (headings, serif), IBM Plex Sans (UI), IBM Plex Mono (IDs/locators), Noto Naskh Arabic (Arabic/Sorani source text, dir="rtl").
- Paper #F5F1E8 · surface #FFFDF8 · ink #1D1A15 · muted #6A6257 · rule #E3DBCB · accent (deep teal) #1F5A57, accent-soft #E3EEEC · warn (only real errors) #9A3B24 / #F6E5DF.
- Provenance (text + icon, never colour alone): Source = ink left rule 3px + "❝ Source"; Researcher note = #2F4E7A on #E8EDF5; Attributed to [critic] = #7A5413 on #F5ECD9; Suggestion (not accepted) = dashed #8A8276.
- Visibility badge: Private (lock) · Project · Public announcement · Public publication — mono 11px uppercase outlined.
- Neutral states (Unknown/Unresolved/Incomplete citation/Partial run/Limitation notice/Uncertain order): dashed #8A8276 border, #6A6257 text, never red.
- Counts always carry units ("42 occurrences").
- Every screen file has a dark review bar on top: screen id, req IDs, view switcher, 6-state switcher (normal/empty/loading/error/forbidden/conflict).
- App shell: left account rail (Home · My Library · Projects · Saved Searches · Notifications[R1b] · Downloads · Profile/Settings); project screens add project header + project nav tabs.
- Desktop only (decision): workspaces target ≥1024px; no mobile layouts. Below that, show a "use a larger screen" notice. Replaces conventions.md §8 360px rule.
- UI copy in English for review; R1a ships Sorani/Arabic (terminology pending specialist review).
