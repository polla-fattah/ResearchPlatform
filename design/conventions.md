# UI conventions

Rules the SRS requires but does not draw. Every screen spec applies them. Change a rule here, not in individual screens. Status: **Draft for specialist review**.

## 1. Provenance labels (EVI-03, BR-08)

Four kinds of text must always be visually and textually distinct, in the UI, in previews and in exports:

| Kind | Label | Rule |
|---|---|---|
| Source quotation | Source | Original wording, never edited; shows locator |
| Personal interpretation | Researcher note | Attributed to the author |
| Attributed scholarly judgment | Attributed to [critic] | Always links to its source; exact qawl text kept |
| Machine suggestion | Suggestion (not accepted) | Cannot be shown as a scholar statement until accepted (R3) |

Labels use text and an icon, never colour alone. To be decided: exact visual treatment (border, tint, icon) in the design system.

## 2. Visibility labels (BR-02, §4.2)

A persistent badge shows the visibility class of any item: **Private**, **Project**, **Public announcement**, **Public publication**. A private note opened inside a shared project is labelled Private on the note itself. Sharing always goes through a preview that lists exactly what will be visible to whom.

## 3. Counts (§4.5)

Every number states its unit: occurrences, unique report records, chains, narrators, excerpts. Progress bars show the denominator or are labelled "manual estimate". No bare totals.

## 4. Unknown, uncertain and partial states (BR-11)

These are valid states, not errors, and have their own treatment: **Unknown**, **Unresolved**, **Incomplete citation**, **Partial run**, **Limitation notice**, **Uncertain order**. They use neutral styling, never an error colour, and are never hidden or replaced by a default value. A partial or cancelled run is never labelled complete.

## 5. Bidirectional text (NFR-13/14)

- Direction is set per block, not per page. Arabic and Sorani blocks are RTL; English is LTR; mixed lines isolate each run.
- Source quotations always display the original text; normalized text is shown separately and labelled.
- Numerals, dates and Hijri dates follow the user's display preference; Hijri source dates are shown as stored and labelled when converted.
- Tables, citations, editor, HTML and PDF export are tested with the same mixed-direction fixtures.

## 6. Safe actions

- **Dependency warning** before removing or changing anything in use (EVI-06).
- **Sharing preview** before adding to a project or publishing (LIB-05, PRJ-06, PUB-01).
- **Recovery deadline** shown before any deletion (30 days, §12.2).
- **Conflict dialog** for concurrent edits: shows both versions with a compare and recover path (COL-06, WRT-05).
- **Irreversible actions** (release, withdraw, delete) need explicit confirmation naming the object.

## 7. Forms and errors

- Errors are labelled, say what to do next, and keep the user's input.
- Errors never reveal whether a private object or an email address exists (§10.3).
- Autosave shows pending, saved, and failed states, and never shows saved when it is not (NFR-03).

## 8. Accessibility and responsive behaviour (NFR-11/12)

- Everything is keyboard-operable with visible focus and accessible names.
- Status is never colour-only; text contrast at least 4.5:1.
- Layouts work from 360 px; complex comparisons may scroll horizontally inside a labelled region without making the page overflow.

## 9. Language and terminology

- R1a UI languages: Sorani and Arabic; English in R2 (A04). Content can be in all three from R1.
- UI language, content language, numerals and time zone are separate settings (NFR-14).
- Labels for Hadith terms come from [terminology.md](terminology.md) and need specialist approval before use.
