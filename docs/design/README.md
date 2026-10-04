# Design documentation

UI and UX design inputs derived from `../Open_Hadith_Research_Platform_Requirements.md` (v0.2). The SRS is authoritative for what a screen must do. This folder says how screens are organised, what they contain, and which shared rules they follow. It does not repeat requirements: each screen links to requirement IDs.

## Contents

| File | Purpose |
|---|---|
| [conventions.md](conventions.md) | Shared rules: provenance, visibility, counts, unknown states, bidirectional text, safe actions, accessibility |
| [navigation-map.md](navigation-map.md) | Navigation structure, R1a screen index, journeys as screen paths |
| [terminology.md](terminology.md) | Sorani, Arabic and English labels (specialist review needed) |
| [screens/](screens/) | One spec per screen; R1a screens drafted, [template](screens/_template.md) for R1b and R1c |

## Workflow

1. Wireframes are drawn in a prototyping tool and linked from each screen spec.
2. Every screen covers the six states: normal, empty, loading, error, forbidden, conflict (SRS §18, item 2).
3. Hadith specialists review provenance labels and terminology before final UI text.
4. Screen specs change status Draft → Reviewed → Approved. A screen is ready to build when approved and its requirement IDs have fixtures (SRS §18).

## Scope

R1a screens are drafted now. Write R1b and R1c specs just before those releases start: Collaboration, Discussion and Tasks, Activity, Announcement editor and public page (R1b); Publication preparation, Editorial console, Public publication page (R1c).
