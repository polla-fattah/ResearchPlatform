# Design documentation

UI and UX design inputs derived from `../Open_Hadith_Research_Platform_Requirements.md` (v0.2). The SRS is authoritative for what a screen must do. This folder says how screens are organised, what they contain, and which shared rules they follow. It does not repeat requirements: each screen links to requirement IDs.

## Contents

| File | Purpose |
|---|---|
| [conventions.md](conventions.md) | Shared rules: provenance, visibility, counts, unknown states, bidirectional text, safe actions, accessibility |
| [navigation-map.md](navigation-map.md) | Navigation structure, screen index for all releases, journeys as screen paths |
| [terminology.md](terminology.md) | Sorani, Arabic and English labels (specialist review needed) |
| [screens/](screens/) | One short spec per screen (01–40, plus 03b) and a [template](screens/_template.md) |

The visual designs are in the HadithResearch design project (`NN Name.dc.html`, one file per screen, with all six states). Specs do not repeat layout; they hold requirement IDs, behaviour, state rules, open questions and acceptance.

## Workflow

1. Each screen spec names its design file. Change layout in the design, behaviour in the spec.
2. Every screen covers the six states: normal, empty, loading, error, forbidden, conflict (SRS §18, item 2).
3. Hadith specialists review provenance labels and terminology before final UI text.
4. Screen specs change status Draft → Reviewed → Approved. A screen is ready to build when approved and its requirement IDs have fixtures (SRS §18).

## Scope

Specs and designs exist for R1a (01–14, 03b), R1b (15–20), R1c (21–25) and R2 (26–40). All are Draft. Screens 26–32 (analysis views) need specialist review before build. Flesh out the R1b, R1c and R2 state tables before each release starts.
