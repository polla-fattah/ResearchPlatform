# R1a MVP — Personal Research Core

**Derived from:** `Open_Hadith_Research_Platform_Requirements.md` v0.2. The SRS is authoritative; if this extract disagrees, the SRS wins.

## Goal

An approved researcher can run one complete investigation alone: apply and be approved, save sources, create private projects, run and preserve searches, collect evidence, compare passages and chains, write findings, and download everything they are entitled to. Nothing is shared or public in R1a.

## Out of R1a

- Membership, discussion, tasks, notifications (R1b)
- Public announcements (R1b)
- Submission, review, publication (R1c; needs A12)
- File uploads and full-book downloads (R2, after DATA-06 rights policy)
- WYSIWYG editor, advanced matn/isnād analysis, templates (R2)

## Entry conditions (R0 exit)

- DATA-01 to DATA-08 evidence accepted; rights policy and hosting decision recorded
- Permission model and policy-module design reviewed
- RTL spike passed for Markdown editor, HTML, and PDF
- Workload benchmark run; provisional NFR targets set

## Screens

Registration/application, Personal home, My Library, Project index, Project creation, Resource picker (corpus and external reference only), Search workspace, Evidence inspector, Comparison workspace, Finding/document editor (Markdown), Downloads, Administration (applications, suspension, quotas, jobs, audit).

## Requirements in scope

64 requirements.

### Authorization

| ID | Requirement | Acceptance criterion |
|---|---|---|
| SEC-01 | All protected object access (read, write, search, preview, export, file retrieval, background job) shall pass through one policy module that evaluates the requester, project role, object visibility, and the object's actual project. | A permission matrix generated from §3.2 and §12.1 runs as an automated test suite; no endpoint performs its own ad hoc role check. |

### Accounts, approval, profiles

| ID | Requirement | Acceptance criterion |
|---|---|---|
| ACC-01 | The system shall accept applications with display name, email, research interests, preferred language, and optional affiliation/biography. | Required fields validate; optional academic affiliation is not a mandatory credential; applicant receives a reference/status page. |
| ACC-02 | The system shall verify email ownership before an application enters the approval queue. | Expired/used verification links fail safely; repeated requests are rate-limited; an unverified applicant cannot create projects. |
| ACC-03 | Administrators shall approve, reject with a reason, or request more information; every decision is attributed and dated. | Pending/rejected accounts cannot call researcher APIs; approval enables the same account without recreating it. |
| ACC-04 | The system shall support secure login, logout, session expiry, password recovery, and session revocation. | Recovery does not reveal whether an email is registered; revoked sessions fail on the next protected request. |
| ACC-05 | Approved accounts shall have personal home, library, owned/shared projects, notification preferences, and downloads. | Two accounts see their own data; owning one project imposes no one-project limitation. |
| ACC-06 | Researchers shall control public profile fields independently of private account data. | Email is private by default; opting into a public profile exposes only selected fields and public research. |
| ACC-07 | Administrators shall suspend/reactivate access with an audit reason; researchers may request account closure. | Suspension blocks new writes/shares/downloads; data is retained for resolution; closure handles owned projects and existing publications explicitly. |
| ACC-08 | Administrative and editorial accounts shall use multi-factor authentication (TOTP with single-use recovery codes in R1a; other methods later); researchers shall be offered it. | A privileged action requires a fully authenticated session; recovery events are audited. |

### Personal library

| ID | Requirement | Acceptance criterion |
|---|---|---|
| LIB-01 | Researchers shall save books, chapters, sections, reports, occurrences, chains, narrators, judgments, and source passages from the corpus. | Save/open preserves exact object type and ID; a report occurrence is distinguishable from a report-level record. |
| LIB-02 | My Library shall support named collections, tags, favourites, personal notes, search, and filtering by type/source/date. | An item may appear in multiple collections without duplicating the canonical record. |
| LIB-03 | Researchers shall add an external bibliographical reference with URL or identifiers, author, title, date where known, and access date. | An incomplete citation is permitted and visibly flagged; unknown metadata is not fabricated. |
| LIB-05 | Researchers shall add a personal item to one or more projects with an explicit preview of shared content. | Private notes are unchecked by default; a collaborator sees only the selected shared content. |
| LIB-06 | Project resources shall have project-local tags, inclusion rationale, and collection membership independent of My Library. | Changing a project tag does not rename a personal tag or modify another project's association. |
| LIB-07 | Duplicate additions shall identify an existing association while allowing distinct excerpts from the same source. | Saving the same book twice prompts reuse; saving two different page passages produces two identifiable excerpts. |
| LIB-08 | Source unavailability or changes shall not silently destroy saved research references. | A deleted/merged/changed corpus target shows a status and preserved permitted snapshot; the original saved locator remains visible. |
| LIB-09 | Removing a library association shall not delete its source or another project's resource. | Removing a personal favourite leaves previously shared project evidence intact. |

### Projects

| ID | Requirement | Acceptance criterion |
|---|---|---|
| PRJ-01 | Approved researchers shall create multiple projects, each with a unique ID, title, question, scope, language, owner, and private workspace. | Creating Project B neither changes Project A nor shares its resources or members. |
| PRJ-02 | The project index shall distinguish owned/shared projects and filter by stage, tag, title, archived state, and recent activity. | A membership invitation does not show the workspace until accepted; a removed project disappears from the former member's list. |
| PRJ-03 | Every project shall contain independently scoped resources, queries, evidence, analyses, tasks, discussions, findings, documents, and publication records. | Direct API requests cannot use an authorized project ID to retrieve an item belonging to a different project. |
| PRJ-04 | Projects shall use explicit stages: scoping, collecting, analysing, writing, reviewing, completed. Archived state shall be separate. | Owners can move backwards with an activity entry; archiving an unfinished project does not mark it completed. |
| PRJ-05 | Project overview shall expose scope, milestones, evidence counts by state, open questions, and next actions. | Numerical progress identifies its denominator or manual-estimate basis. |
| PRJ-06 | Authorized researchers shall copy selected resources, queries, and analyses into another project with provenance and a visibility preview. | Membership, private comments, and publication authority are not copied; changes in the destination do not mutate the source project. |
| PRJ-07 | Owners shall transfer ownership (available from R1b, when memberships exist), archive/unarchive, or soft-delete/restore a project. | Transfer requires acceptance; a trashed project is read-only during recovery and does not silently remove a public publication. |

### Search and result sets

| ID | Requirement | Acceptance criterion |
|---|---|---|
| SEA-01 | Search shall support original-text exact phrase and normalized lexical modes with mode visibly identified. | Exact and normalized results can differ; highlights point to the original text; original Arabic/Sorani wording is never overwritten. |
| SEA-02 | Search shall support typed filters for book/author/chapter/section, report type, narrator, known chain relationship, critic, recorded hukm, and available dates. | Unsupported or incomplete fields are labelled; unknown dates can be included explicitly rather than silently excluded. |
| SEA-03 | Results shall show type, source locator, relevant passage, available chain information, and why the item matched. | Counts state whether they represent reports or occurrences; grouped results can expand to source occurrences. |
| SEA-04 | Researchers shall save a named query with text, filter structure, mode, sort, and personal/project scope. | Reopening reconstructs the query; sharing a project query does not expose unrelated personal searches. |
| SEA-05 | Every saved-query execution shall record execution time, query-definition version, corpus/index identity, result count, and completion status. | A partial/cancelled search is not labelled complete; rerunning creates a separate run record. |
| SEA-06 | Researchers shall preserve selected results or all results from a completed run as a result set with immutable membership. | “All results” includes all matched pages at that run; limits/truncation are explicit and require a deliberate reduced selection. |
| SEA-07 | Result-set membership and saved evidence shall remain stable when the live corpus changes. | A subsequent run can differ without silently adding/removing members of the earlier set. |
| SEA-08 | Researchers shall review selected results individually or in bulk and add them to project resources/evidence. | Bulk operations return per-item outcomes, preserve provenance, and do not create unnoticed duplicates. |

### Evidence and annotations

| ID | Requirement | Acceptance criterion |
|---|---|---|
| EVI-01 | Researchers shall create evidence from an exact source span or record, retaining original text, locator, source version/snapshot, collector, and timestamp. | A citation opens the precise selected source where available; missing volume/page is labelled incomplete. |
| EVI-02 | Evidence shall support candidate, included, reviewed, excluded, and unresolved states, with reasons for exclusion and unresolved status. | State changes are attributed; reviewed does not imply authentic, correct, or agreed. |
| EVI-03 | Annotations shall distinguish source quotation, personal interpretation, attributed scholarly judgment, and machine suggestion. | Export and public preview preserve these labels; unaccepted machine text cannot appear as an attributed scholar statement. |
| EVI-04 | Annotations shall support private-to-author or project-shared visibility, with explicit promotion from private to shared. | Owners and publication reviewers cannot read another author's private annotations through exports, search, or document links. |
| EVI-05 | Evidence shall link to findings as supporting, opposing, contextual, or unresolved evidence. | One item can support several findings without duplicating its source; opposite interpretations remain possible. |
| EVI-06 | Deleting or changing referenced evidence shall report dependencies and preserve prior document/submission versions. | A user is warned before removing a used link; a published citation does not silently change its quoted content. |
| EVI-07 | Researchers shall propose corpus corrections with the current value, proposed value, evidence, and explanation. | Proposal enters a separate corpus-editor queue; acceptance in a research project does not update canonical data. |

### Analysis workbench

| ID | Requirement | Acceptance criterion |
|---|---|---|
| ANA-01 | Researchers shall open a saved side-by-side comparison of selected source occurrences with source headers and annotation links. | Original wording is visible; lacking occurrence-specific wording produces a limitation notice rather than invented variants. |
| ANA-02 | Researchers shall compare selected chains as readable ordered lists with narrator and formula inspection. | Unresolved ordering is displayed as uncertain; narrator clicks open the correct identity or ambiguity record. |
| ANA-03 | A narrator dossier shall combine identity fields, available teachers/students, related reports, and attributed criticism. | Every assessment links to its available source; missing information is labelled unknown. |
| ANA-04 | A criticism comparison shall filter by target narrator, critic, expression, book, and recorded category while preserving exact qawl text. | Different critics' wording is not replaced by a single numerical score; normalized labels remain separate. |
| ANA-05 | Analyses shall save their input IDs/versions, settings, creator, time, annotations, and output version. | Reopening restores the selected inputs; rerunning against changed data creates a new analysis version. |

### Findings and documents

| ID | Requirement | Acceptance criterion |
|---|---|---|
| WRT-01 | Findings shall contain a title/question, claim or conclusion, reasoning, supporting/opposing evidence, limitations, contributors, and status. | A finding can be provisional or inconclusive; missing required public-submission fields are reported before submission. |
| WRT-02 | Projects shall support multiple documents and multiple findings, with many-to-many links between them. | A main article and a chain summary are separate documents; editing one document creates a version, not another unrelated draft. |
| WRT-03 | The R1a editor shall be a structured Markdown editor with live preview supporting headings, paragraphs, lists, tables, quotations, footnotes/citations, per-block text direction for Arabic/Sorani/English, and autosave. | Mixed-direction text and citations survive save/reload/export; last successful save and unsaved state are visible. |
| WRT-04 | Inserting evidence into writing shall create an explicit citation and retain original versus researcher-edited text. | Paraphrase is not presented as an exact quotation; deleting a bibliography entry reports dependent citations. |
| WRT-05 | Documents shall support version history, comparison, and restoration without deleting subsequent history. | Restoring an older version creates a new current version; attribution of earlier contributions remains. A stale save from a second session of the same user is rejected as a conflict. |
| WRT-06 | Citation generation shall use source metadata including work, edition, volume/page or stable alternative locator, and source-specific report number where available. | Missing components are flagged; the system does not confuse source numbering with global report IDs. |

### Downloads

| ID | Requirement | Acceptance criterion |
|---|---|---|
| EXP-01 | Researchers shall download a document, selected resources, an entire project, or all currently authorized research across their account. | Account-wide export supports multiple projects; scope preview shows personal and shared material separately. |
| EXP-02 | Complete project exports shall include metadata, resources, saved queries/runs/result sets, evidence, analyses, tasks/discussions, findings/documents, citations, eligible revision histories, research activity, and permitted attachments. | Private-to-other-user content is excluded; the manifest enumerates included objects and explains unavailable/omitted files. |
| EXP-03 | Account-wide export shall include personal library/notes and each selected authorized project's shared research plus the requester's applicable private annotations. | It does not include other members' personal libraries, private notes, credentials, or operational security logs. |
| EXP-04 | Exports shall offer human-readable HTML/Markdown, Unicode JSON, CSV for tabular data, BibTeX/RIS references, PDF for selected documents, and ZIP packages. | A package opens offline with a local index; Arabic/Sorani render in PDF; references retain stable IDs. |
| EXP-06 | Large exports shall be resumable background jobs with queued/running/complete/partial/failed/cancelled/expired states. | Closing the browser does not cancel a job; retries do not create conflicting duplicate packages; partial output is never labelled complete. |
| EXP-07 | Every export shall record requester, scope, content versions, corpus identity where available, generation time, format/schema version, counts, exclusions, and checksums for files. | Users can verify package contents and distinguish a missing eligible file from an intentionally excluded restricted item. |
| EXP-08 | Authorization and rights shall be checked at request, generation, and download; download links shall be authenticated and expire. | Revocation before retrieval prevents download of affected private material; jobs are rebuilt or cancelled when their authorized scope changes. |
| EXP-09 | Export limits shall partition eligible material into linked packages rather than silently truncating “all research.” | A large export yields a complete manifest across numbered parts or an explicit failure with retry options. |
| EXP-10 | Researchers shall be able to regenerate expired downloads, see storage/quota limits, and retry failures. | Seven-day expiry applies to generated packages, not the underlying research; regeneration rechecks current access. |

### Administration

| ID | Requirement | Acceptance criterion |
|---|---|---|
| ADM-01 | Administration shall manage application queues, approval reasons, suspensions, platform roles, and appeal/contact requests. | Role changes are audited; editors cannot grant themselves administrator powers. |
| ADM-03 | Authorized staff shall manage application and invitation rate limits, abuse reports, upload/export quotas, allowed file types, job failures, rights flags, and public-content reports. | Policy changes do not silently destroy research; affected users receive an actionable explanation. |
| ADM-04 | Support access to private content shall be explicitly granted for a scope and duration, with reason and audit. | Ordinary admin searches do not reveal private evidence; expired support grants fail. |
| ADM-05 | Deletions, transfers, submissions, decisions, releases, rights changes, exports, and privileged actions shall be audited. | Audit entries identify actor/action/object/time/outcome and cannot be edited through normal research UI. |
| ADM-06 | Operational dashboards shall monitor indexing, queue latency, errors, storage, backup results, and export completeness. | Operators can detect failed jobs without reading private research content unnecessarily. |

## Acceptance tests for the R1a gate

AT-01, AT-02, AT-03, AT-05, AT-06, AT-07, AT-08, AT-13 (personal library and owned projects), AT-15, AT-18, AT-19, AT-20, AT-21, AT-22, and the archive/restore part of AT-16. Details are in §14.2 and §14.4 of the SRS.

## Gate

All R1a acceptance criteria and tests pass; no unresolved high-severity permission or data-loss defects; expert-reviewed scholarly fixtures; successful restore drill; product signoff.
