# 🌐 Open Hadith Research Platform — API Design Specification
**Version:** 1.0.0 (RESTful OpenAPI Architecture)  
**Standard:** Open Hadith Research Platform SRS (v0.2 / R1a–R1c)  
**Backend Framework:** Laravel 13 (PHP 8.5) with PostgreSQL (`hadith_research_platform` + `hadiths_v2`)  

---

## 🏛️ 1. Architecture & Global Standards

### 1.1 Base URL & Content Negotiation
* **Base API Endpoint:** `https://api.hadith.local/api/v1`
* **Headers:**
  ```http
  Accept: application/json
  Content-Type: application/json
  Authorization: Bearer <sanctum_token>
  Accept-Language: ar | ckb | en
  ```

### 1.2 Unified Response Envelope
Every API response returns a predictable envelope format:

#### Success Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-10-04T23:00:00Z",
    "version": "v1",
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total_items": 150,
      "total_pages": 8
    }
  }
}
```

#### Error Envelope (`4xx Client Error`, `5xx Server Error`)
```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You are not authorized to view this private project.",
    "details": []
  }
}
```

### 1.3 Concurrency & Idempotency
* **Optimistic Locking:** Endpoints modifying documents (`/documents/{id}/versions`) support the `If-Match: "<version_number>"` header or require `expected_version` in the payload (`WRT-05`, `COL-06`).
* **Idempotency:** Critical mutation endpoints (freezing submissions, triggering export builds) support `Idempotency-Key: <UUID>` (`EXP-06`, `PUB-02`).

---

## 📋 2. Comprehensive Endpoint Index

```text
/api/v1
├── /auth                      # Authentication & Registration
├── /applications              # Researcher Onboarding Queue
├── /corpus                    # Read-Only Classical Corpus (hadiths_v2)
├── /library                   # Personal Library & Favourites
├── /projects                  # Research Workspaces
│   └── /{id}
│       ├── /members           # Collaborators & Roles
│       ├── /resources         # Project-Scoped Resources
│       ├── /searches          # Saved Queries & Runs
│       ├── /result-sets       # Frozen Result Sets
│       ├── /evidence          # Captured Evidence Items
│       ├── /analyses          # Isnad & Matn Workbenches
│       ├── /findings          # Scientific Claims & Rationale
│       ├── /documents         # Structured Markdown Documents
│       ├── /discussions       # Comment Threads
│       ├── /tasks             # Research Action Items
│       ├── /announcements     # Direct Public Announcements
│       └── /submissions       # Frozen Editorial Packages
├── /editor                    # Editorial Review & Publication Queue
├── /public                    # Public Website (Announcements & Research)
├── /exports                   # Async Packaging & Offline Downloads
└── /admin                     # System Moderation, Quotas & Audit Logs
```

---

## 🔐 Module 1: Authentication & Scholar Applications

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/auth/register` | Submit initial applicant registration | Public | `ACC-01` |
| `POST` | `/auth/verify-email` | Verify email token | Public | `ACC-02` |
| `POST` | `/auth/login` | Authenticate and obtain Sanctum bearer token | Public | `ACC-04` |
| `POST` | `/auth/logout` | Revoke active access token | Bearer | `ACC-04` |
| `GET` | `/auth/me` | Retrieve current authenticated user & profile | Bearer | `ACC-05` |
| `PUT` | `/auth/profile` | Update profile fields & public display flags | Bearer | `ACC-06` |
| `POST` | `/applications` | Submit application for researcher status | Bearer | `ACC-01` |
| `GET` | `/applications/my-status` | Check application review status | Bearer | `ACC-01` |

---

## 📜 Module 2: Corpus Access Adapter (`hadiths_v2`)
*Read-only high-performance gateway into the classical database.*

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/corpus/search` | Search Hadiths (exact phrase vs normalized lexical) | Public / Bearer | `SEA-01` |
| `GET` | `/corpus/hadiths/{id}` | Get canonical Hadith text, type, and occurrences | Public / Bearer | `DATA-02` |
| `GET` | `/corpus/hadiths/{id}/occurrences` | List book references, chapter, and section locators | Public / Bearer | `DATA-04` |
| `GET` | `/corpus/books` | List classical books with filters (century, author) | Public / Bearer | `DATA-01` |
| `GET` | `/corpus/books/{id}` | Book metadata & chapter table-of-contents | Public / Bearer | `DATA-04` |
| `GET` | `/corpus/narrators` | Search and filter narrators (tabaqah, rutba, dates) | Public / Bearer | `ANA-03` |
| `GET` | `/corpus/narrators/{id}` | Narrator dossier (biography, teachers, students) | Public / Bearer | `ANA-03` |
| `GET` | `/corpus/narrators/{id}/criticism` | List Jarh wa Ta'dil statements (`alem_qawl_details`)| Public / Bearer | `ANA-04` |
| `GET` | `/corpus/sanads/{id}` | Reconstruct ordered narrator transmission chain | Public / Bearer | `ANA-02` |

---

## 📚 Module 3: Personal Library ("My Library")

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/library/items` | List user's saved resources (filter by favourite, tag) | Bearer | `LIB-01` |
| `POST` | `/library/items` | Save a corpus record or external URL to library | Bearer | `LIB-01` |
| `PATCH`| `/library/items/{id}` | Update personal notes or toggle favourite | Bearer | `LIB-02` |
| `DELETE`| `/library/items/{id}`| Remove association from library (leaves corpus intact)| Bearer | `LIB-09` |
| `GET` | `/library/collections`| List custom named collections | Bearer | `LIB-02` |
| `POST`| `/library/collections`| Create a collection | Bearer | `LIB-02` |
| `POST`| `/library/collections/{id}/items` | Add resource to collection | Bearer | `LIB-02` |

---

## 🔬 Module 4: Project Workspaces

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects` | List projects (owned vs shared, stage filters) | Bearer | `PRJ-01` |
| `POST` | `/projects` | Create a new isolated research workspace | Bearer | `PRJ-01` |
| `GET` | `/projects/{id}` | Project overview, statistics, and open questions | Project Role | `PRJ-05` |
| `PUT` | `/projects/{id}` | Update title, question, scope, or stage | Owner / Researcher| `PRJ-04` |
| `POST` | `/projects/{id}/archive` | Archive/unarchive project | Owner | `PRJ-07` |
| `DELETE`| `/projects/{id}` | Soft-delete project (30-day recovery window) | Owner | `PRJ-07` |
| `GET` | `/projects/{id}/members` | List active project collaborators | Project Role | `COL-01` |
| `POST` | `/projects/{id}/members` | Invite an approved researcher to a role | Owner | `COL-01` |
| `DELETE`| `/projects/{id}/members/{userId}` | Revoke project membership | Owner | `COL-02` |

---

## 🔎 Module 5: Searches & Frozen Result Sets

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects/{id}/searches` | List saved queries for this project | Project Role | `SEA-04` |
| `POST` | `/projects/{id}/searches` | Save a search definition (text + filters) | Owner / Researcher| `SEA-04` |
| `POST` | `/projects/{id}/searches/{queryId}/run` | Execute saved search and record a `search_run` | Owner / Researcher| `SEA-05` |
| `GET` | `/projects/{id}/result-sets` | List frozen result sets | Project Role | `SEA-06` |
| `POST` | `/projects/{id}/result-sets` | Freeze an immutable snapshot of search results | Owner / Researcher| `SEA-06` |
| `GET` | `/projects/{id}/result-sets/{setId}` | Retrieve frozen members and snapshot data | Project Role | `SEA-07` |

---

## 📎 Module 6: Evidence & Annotations

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects/{id}/evidence` | List captured evidence items (filter by state) | Project Role | `EVI-01` |
| `POST` | `/projects/{id}/evidence` | Capture evidence passage with exact locator & hash | Owner / Researcher| `EVI-01` |
| `PATCH`| `/projects/{id}/evidence/{eviId}` | Update state (included, reviewed, excluded, unresolved)| Owner / Researcher| `EVI-02` |
| `DELETE`| `/projects/{id}/evidence/{eviId}` | Delete evidence (checks dependency warnings) | Owner / Researcher| `EVI-06` |
| `GET` | `/projects/{id}/annotations` | List annotations (private vs project-shared) | Project Role | `EVI-04` |
| `POST` | `/projects/{id}/annotations` | Create annotation (source quote, judgment, machine)| Project Role | `EVI-03` |

---

## 🧪 Module 7: Analysis Workbench

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/projects/{id}/analyses/matn-compare` | Side-by-side textual occurrence comparison | Project Role | `ANA-01` |
| `POST` | `/projects/{id}/analyses/isnad-compare`| Chain comparison, alignment & formula inspection | Project Role | `ANA-02` |
| `POST` | `/projects/{id}/analyses/criticism-matrix`| Filtered critic statement matrix for target narrators| Project Role | `ANA-04` |
| `GET` | `/projects/{id}/analyses` | List saved analysis runs with input versions | Project Role | `ANA-05` |
| `POST` | `/projects/{id}/analyses/save` | Persist an analysis run with annotations | Owner / Researcher| `ANA-05` |

---

## ✍️ Module 8: Findings, Writing & Documents

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects/{id}/findings` | List research findings and questions | Project Role | `WRT-01` |
| `POST` | `/projects/{id}/findings` | Create finding (claim, reasoning, status) | Owner / Researcher| `WRT-01` |
| `POST` | `/projects/{id}/findings/{fId}/evidence` | Link evidence to finding (supporting/opposing) | Owner / Researcher| `EVI-05` |
| `GET` | `/projects/{id}/documents` | List Markdown research documents | Project Role | `WRT-02` |
| `POST` | `/projects/{id}/documents` | Create new document | Owner / Researcher| `WRT-02` |
| `GET` | `/projects/{id}/documents/{docId}` | Get current document content & metadata | Project Role | `WRT-03` |
| `POST` | `/projects/{id}/documents/{docId}/versions`| Save revision (Markdown text, conflict check) | Owner / Researcher| `WRT-03`, `WRT-05` |
| `GET` | `/projects/{id}/documents/{docId}/versions`| Retrieve revision history | Project Role | `WRT-05` |
| `POST` | `/projects/{id}/documents/{docId}/cite` | Insert formatted citation anchored to evidence | Owner / Researcher| `WRT-04`, `WRT-06` |

---

## 📢 Module 9: Announcements & Public Releases

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects/{id}/announcement` | Preview current project announcement draft | Project Role | `ANN-02` |
| `POST` | `/projects/{id}/announcement` | Draft or update public announcement | Owner | `ANN-01` |
| `POST` | `/projects/{id}/announcement/publish` | Direct-publish announcement to public site | Owner | `ANN-01` |
| `POST` | `/projects/{id}/announcement/unpublish`| Take announcement offline | Owner | `ANN-04` |
| `GET` | `/public/announcements` | Public feed of announced research projects | Public | `ANN-05` |
| `GET` | `/public/announcements/{slug}` | View public announcement details & scope | Public | `ANN-05` |

---

## 🏛️ Module 10: Editorial Review & Peer-Reviewed Publishing

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/projects/{id}/validate-pre-publication` | Pre-submission validation (unresolved evidence, private links, co-author checks) | Project Role | `WRT-07`, `PUB-12` |
| `POST` | `/projects/{id}/submissions` | Freeze package & submit for editorial review (checksum, COI, rights) | Owner | `PUB-01`, `PUB-02` |
| `GET` | `/projects/{id}/submissions` | List submission and revision history for project | Project Role | `PUB-06` |
| `GET` | `/editor/submissions` | Editorial review queue (filter by stage, age, action required) | Editor | `ADM-02`, `PUB-03` |
| `POST` | `/editor/submissions/{id}/assign` | Assign nonconflicted peer reviewer (enforces COI checks) | Editor | `PUB-04`, `PUB-05` |
| `POST` | `/editor/submissions/{id}/review` | Submit review recommendation, score, comments & COI declaration | Assigned Reviewer | `PUB-04`, `PUB-06` |
| `POST` | `/editor/submissions/{id}/decision` | Issue editorial verdict (accept, revise, reject; enforces COI) | Editor | `PUB-03`, `PUB-05` |
| `POST` | `/editor/submissions/{id}/release` | Atomic publication release to catalog with DOI & license | Editor | `PUB-07` |
| `POST` | `/editor/publications/{id}/corrigenda` | Publish formal corrigenda / errata amendment with audit trail | Editor | `PUB-10` |
| `POST` | `/editor/publications/{id}/retract` | Retract publication with public notice & reason | Editor | `PUB-11` |
| `GET` | `/public/research` | Search & browse peer-reviewed research catalog | Public | `PUB-08`, `PUB-09` |
| `GET` | `/public/research/{slug}` | View published research article, citations, DOI, corrigenda | Public | `PUB-08`, `PUB-10` |
| `GET` | `/public/research/{slug}/cite` | Export formal citation formats (bibtex, ris, apa) | Public | `PUB-08` |

---

## 📦 Module 11: Async Exports & Portability

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `POST` | `/exports` | Enqueue export job (project, library, account-wide) | Bearer | `EXP-01` |
| `GET` | `/exports/{jobId}` | Poll export status & progress (queued, running, done)| Bearer | `EXP-06` |
| `GET` | `/exports/{jobId}/download` | Download completed ZIP package (signed, expiring)| Bearer | `EXP-08` |
| `GET` | `/exports/{jobId}/manifest` | Inspect export manifest (checksums, exclusions) | Bearer | `EXP-07` |

---

## ⚙️ Module 12: Admin & Corpus Errata Proposals

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/admin/applications` | List pending researcher applications | Admin | `ACC-03` |
| `POST` | `/admin/applications/{id}/decide` | Approve or reject applicant with reason | Admin | `ACC-03` |
| `POST` | `/admin/users/{id}/suspend` | Suspend user account with recorded audit reason | Admin | `ACC-07` |
| `GET` | `/admin/audit-logs` | Query security and data audit events | Admin | `ADM-05` |
| `POST` | `/corpus/proposals` | Propose correction to canonical corpus text | Bearer | `EVI-07` |
| `GET` | `/admin/corpus/proposals` | Review queue for corpus correction proposals | Corpus Editor | `EVI-07` |

---

## 🤝 Module 13: Project Collaboration, Tasks & Discussions (R1b)

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/projects/{id}/invitations` | List pending and historical project invitations | Owner | `COL-01` |
| `POST` | `/projects/{id}/invitations` | Invite an approved researcher by email with role | Owner | `COL-01` |
| `POST` | `/invitations/{token}/accept` | Accept project invitation | Bearer | `COL-01` |
| `POST` | `/invitations/{token}/decline` | Decline project invitation | Bearer | `COL-01` |
| `PUT` | `/projects/{id}/members/{userId}` | Update member role (`co_investigator`, `contributor`, `observer`) | Owner | `COL-02` |
| `DELETE` | `/projects/{id}/members/{userId}` | Revoke project membership immediately | Owner | `COL-02` |
| `GET` | `/projects/{id}/discussions` | List discussion & dispute review threads (filter by target) | Project Role | `COL-03`, `COL-07` |
| `POST` | `/projects/{id}/discussions` | Start discussion thread pinned to evidence, finding, or text | Contributor+ | `COL-03` |
| `GET` | `/discussions/{threadId}/comments` | List comments within a discussion thread | Project Role | `COL-03` |
| `POST` | `/discussions/{threadId}/comments` | Post comment or rebuttal in discussion thread | Contributor+ | `COL-03` |
| `POST` | `/discussions/{threadId}/resolve` | Resolve dispute thread with rationale & alternative views | Co-Investigator+ | `COL-07` |
| `GET` | `/projects/{id}/tasks` | List research tasks (filter by status, assignee) | Project Role | `COL-04` |
| `POST` | `/projects/{id}/tasks` | Create assignable research task | Contributor+ | `COL-04` |
| `PUT` | `/projects/{id}/tasks/{taskId}` | Update task details, assignee, or due date | Contributor+ | `COL-04` |
| `POST` | `/projects/{id}/tasks/{taskId}/complete`| Mark task as completed | Assignee / Owner | `COL-04` |
| `POST` | `/projects/{id}/tasks/{taskId}/block` | Mark task as blocked with recorded blocking reason | Assignee / Owner | `COL-04` |
| `GET` | `/projects/{id}/activity` | Query project activity feed (actor, action, date) | Project Role | `COL-08` |
| `POST` | `/projects/{id}/documents/{docId}/lock` | Acquire exclusive edit lock on document | Contributor+ | `COL-06` |
| `POST` | `/projects/{id}/documents/{docId}/unlock` | Release document edit lock | Lock Holder / Owner| `COL-06` |

---

## 🔔 Module 14: Notification Center & Preferences (R1b)

| Method | Endpoint | Description | Auth | Requirement |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/notifications` | List user notifications (unread first) | Bearer | `COL-05` |
| `PATCH` | `/notifications/{id}/read` | Mark individual notification as read | Bearer | `COL-05` |
| `POST` | `/notifications/mark-all-read` | Mark all notifications as read | Bearer | `COL-05` |
| `GET` | `/notifications/preferences` | Retrieve scholar notification preferences | Bearer | `COL-05` |
| `PUT` | `/notifications/preferences` | Update email digest and category notification preferences | Bearer | `COL-05` |

---

## 💻 Sample Payload Specifications

### 1. Capture Evidence (`POST /api/v1/projects/{id}/evidence`)
```json
{
  "resource_id": 4082,
  "captured_text": "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى",
  "locator": "صحيح البخاري، كتاب بدء الوحي، حديث رقم 1، ص 6",
  "source_version": "hadiths_v2_canonical",
  "state": "included"
}
```

### 2. Save Document Revision with Optimistic Concurrency (`POST /api/v1/projects/{id}/documents/{id}/versions`)
```json
{
  "expected_version": 3,
  "change_summary": "Added comparison between Kufa and Basra transmission lines",
  "content": "# دراسة طرق حديث الأعمال بالنيات\n\n## مقدمة\nيعتبر هذا الحديث من جوامع الكلم..."
}
```

### 3. Enqueue Account-Wide Export (`POST /api/v1/exports`)
```json
{
  "scope": "account",
  "formats": ["zip", "markdown", "json", "csv"],
  "include_personal_library": true
}
```
Response:
```json
{
  "success": true,
  "data": {
    "job_id": 9182,
    "status": "queued",
    "check_status_url": "/api/v1/exports/9182"
  }
}
```

### 4. Pre-Publication Validation (`POST /api/v1/projects/{id}/validate-pre-publication`)
Response:
```json
{
  "success": true,
  "data": {
    "can_submit": true,
    "blocker_count": 0,
    "warning_count": 0,
    "issues": []
  }
}
```

### 5. Peer-Reviewed Submission Package Freeze (`POST /api/v1/projects/{id}/submissions`)
```json
{
  "title": "A Collation and Critical Isnad Analysis of Hadith al-Niyyat",
  "abstract": "This study provides a multi-witness comparison across Hijazi and Iraqi transmission lines...",
  "keywords": ["isnād", "hadith al-niyyat", "madār", "rijāl"],
  "rights_declaration": true,
  "coi_declared": false
}
```
Response:
```json
{
  "success": true,
  "data": {
    "submission_id": 14,
    "project_id": 1,
    "status": "submitted",
    "version": 1,
    "package_checksum": "5d41402abc4b2a76b9719d911017c592...",
    "frozen_at": "2026-10-05T02:00:00Z"
  }
}
```

### 6. Citation Export Formats (`GET /api/v1/public/research/{slug}/cite?format=bibtex`)
Response:
```
@article{fattah2026_hadith_al_niyyat,
  title = {A Collation and Critical Isnad Analysis of Hadith al-Niyyat},
  author = {Fattah, Polla},
  year = {2026},
  doi = {10.5555/hadith.2026.0001},
  url = {http://localhost:8000/api/v1/public/research/hadith-al-niyyat-analysis}
}
```

---

## Module 7: Advanced Computational Analysis Workbench (Release 2a)

### 1. Classical Sequence Collation & Critical Apparatus (`POST /api/v1/projects/{id}/analyses/collate`)
Performs dynamic programming sequence collation (Needleman-Wunsch with affine gap penalty) across Classical Arabic textual witnesses, classifying operations into additions (*ziyādāt*), omissions (*saqṭ*), and substitutions (*badal*), and generating a formal *al-Hāmish al-Naqdī* critical apparatus.

Request:
```json
{
  "baseline_text": "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى",
  "variants": [
    {
      "id": "rec_hijazi",
      "label": "Recension of Yahya ibn Sa'id (Hijaz)",
      "text": "إنما الأعمال بالنيات فمن كانت هجرته إلى الله ورسوله"
    },
    {
      "id": "rec_iraqi",
      "label": "Recension of Hammad ibn Zayd (Basra)",
      "text": "الأعمال بالنية"
    }
  ],
  "save_run": true
}
```
Response:
```json
{
  "success": true,
  "data": {
    "collation": {
      "baseline_text": "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى",
      "comparisons": [
        {
          "variant_id": "rec_hijazi",
          "label": "Recension of Yahya ibn Sa'id (Hijaz)",
          "collation": {
            "alignment_score": 12.0,
            "similarity_percentage": 75.0,
            "summary": {
              "total_aligned_slots": 11,
              "matches": 3,
              "substitutions": 0,
              "additions_ziyadah": 8,
              "omissions_saqt": 4
            },
            "apparatus_criticus": [
              {
                "slot": 4,
                "type": "ziyadah",
                "variant": "فمن كانت هجرته إلى الله ورسوله",
                "apparatus_entry": "Slot 4: [زيادة]: فمن كانت هجرته إلى الله ورسوله (Recension of Yahya ibn Sa'id (Hijaz))"
              }
            ]
          }
        }
      ]
    },
    "saved_run": {
      "id": 42,
      "analysis_type": "sequence_collation",
      "version_number": 1
    }
  }
}
```

### 2. Isnād Topological DAG & Madār al-Isnād Detection (`POST /api/v1/projects/{id}/analyses/isnad-topology`)
Builds a directed acyclic transmission graph from either corpus `sanad_ids` or researcher-supplied `custom_chains`, executes betweenness centrality and out-degree analysis, detects the primary *Madār al-Isnād* (Common Link) and partial common links, exports Cytoscape.js visualization elements, and formulates a mathematical proof certificate.

Request:
```json
{
  "custom_chains": [
    [
      {"id": 1, "name": "Al-Bukhari"},
      {"id": 2, "name": "Al-Humaydi"},
      {"id": 3, "name": "Sufyan ibn Uyaynah"},
      {"id": 100, "name": "Yahya ibn Sa'id al-Ansari"},
      {"id": 200, "name": "Muhammad ibn Ibrahim al-Taymi"},
      {"id": 300, "name": "Alqamah ibn Waqqas"},
      {"id": 400, "name": "Umar ibn al-Khattab"}
    ],
    [
      {"id": 10, "name": "Muslim ibn al-Hajjaj"},
      {"id": 11, "name": "Abdullah ibn Maslamah"},
      {"id": 12, "name": "Malik ibn Anas"},
      {"id": 100, "name": "Yahya ibn Sa'id al-Ansari"},
      {"id": 200, "name": "Muhammad ibn Ibrahim al-Taymi"},
      {"id": 300, "name": "Alqamah ibn Waqqas"},
      {"id": 400, "name": "Umar ibn al-Khattab"}
    ]
  ],
  "direction": "author_to_source",
  "save_run": true
}
```
Response:
```json
{
  "success": true,
  "data": {
    "topology": {
      "total_sanads_analyzed": 2,
      "total_unique_narrators": 10,
      "total_transmission_edges": 9,
      "madar_al_isnad": {
        "narrator_id": 100,
        "name": "Yahya ibn Sa'id al-Ansari",
        "out_degree": 2,
        "in_degree": 1,
        "branching_ratio": 2.0,
        "chain_coverage": 100.0,
        "centrality_score": 7.0
      },
      "partial_common_links": [],
      "graph_topology": {
        "cytoscape": {
          "nodes": [
            {
              "data": {
                "id": "100",
                "label": "Yahya ibn Sa'id al-Ansari",
                "role": "primary_madar",
                "frequency": 2,
                "out_degree": 2,
                "in_degree": 1
              }
            }
          ],
          "edges": []
        }
      },
      "formal_proof": {
        "theorem": "Topological Convergence Theorem (Madār al-Isnād)",
        "pivot_narrator": "Yahya ibn Sa'id al-Ansari",
        "evidence": "All 2 transmission lines coalesce upon narrator #100 with 2 independent outgoing transmission arcs (Coverage: 100%).",
        "status": "verified_common_link"
      }
    }
  }
}
```

### 3. Temporal CSP Constraint Satisfaction (`POST /api/v1/projects/{id}/analyses/temporal-check`)
Applies interval arithmetic constraints over Hijri lifespans ($T_{min}=7$ AH lower bound for *al-Tamyīz*) to mathematically prove *Ittiṣāl* (continuity) or flag *Inqiṭāʿ* (anachronistic lacunae) and pseudo-attributions.

Request:
```json
{
  "teacher_name": "Nafi' Mawla Ibn Umar",
  "teacher_death": 117,
  "student_name": "Malik ibn Anas",
  "student_birth": 93,
  "student_death": 179,
  "min_audition_age": 7,
  "save_run": true
}
```
Response:
```json
{
  "success": true,
  "data": {
    "temporal_verification": {
      "status": "feasible_overlap",
      "verdict": "ITTISAL_CHRONOLOGICALLY_FEASIBLE",
      "tamyiz_age_used": 7,
      "proof_certificate": {
        "teacher": "Nafi' Mawla Ibn Umar",
        "student": "Malik ibn Anas",
        "earliest_audition_year": 100,
        "latest_meeting_year": 117,
        "overlap_window_years": 17,
        "audition_possible": true,
        "is_anachronistic": false,
        "formal_formula": "overlap = teacher_death (117) - (student_birth (93) + min_age (7)) = 17 years >= 0"
      }
    }
  }
}
```

### 4. Hadith Family Clustering & Mutābaʿah Classification
- `GET /api/v1/projects/{id}/families`: Retrieves all Hadith families with their members and relationships.
- `POST /api/v1/projects/{id}/families`: Creates a new canonical Hadith family cluster.
  ```json
  {
    "canonical_title": "Hadith al-Niyyat",
    "root_companion": "Umar ibn al-Khattab",
    "core_theme": "Sincerity and intentions"
  }
  ```
- `POST /api/v1/projects/{id}/families/{familyId}/members`: Attaches an evidence item or sanad as `mutabaah_tammah`, `mutabaah_qasirah`, `shahid`, or `candidate`.
  ```json
  {
    "evidence_id": 45,
    "relationship_type": "mutabaah_tammah",
    "convergence_narrator": "Yahya ibn Sa'id al-Ansari",
    "convergence_depth": 1,
    "scholarly_notes": "Parallel recitation confirming transmission integrity"
  }
  ```
- `DELETE /api/v1/projects/{id}/families/{familyId}/members/{memberId}`: Removes a member from the family cluster.

### 5. Structured ʿIlal (Hidden Defect) Investigation Dossiers
- `GET /api/v1/projects/{id}/ilal-cases`: Lists all ʿIlal investigation cases.
- `POST /api/v1/projects/{id}/ilal-cases`: Opens an ʿIlal investigation dossier.
  ```json
  {
    "title": "Discrepancy in Basran transmission of Hadith al-Niyyat",
    "discrepancy_category": "ikhtilaf_sanad",
    "competing_variants": [
      {"chain_id": 101, "narrator": "Hammad ibn Zayd", "state": "Muttasil"},
      {"chain_id": 102, "narrator": "Hammad ibn Salamah", "state": "Mursal"}
    ],
    "critics_judgments": [
      {"critic": "Al-Daraqutni", "verdict": "Prefers Hammad ibn Zayd due to superior memory"}
    ],
    "resolution_notes": "Preliminary investigation underway"
  }
  ```
- `GET /api/v1/projects/{id}/ilal-cases/{caseId}`: Returns complete investigation dossier.
- `PATCH /api/v1/projects/{id}/ilal-cases/{caseId}`: Resolves or updates dossier (`status`: `resolved_authentic`, `resolved_defective`, `inconclusive`).

### 6. Teacher-Specific Narrator Assessment Matrix
- `GET /api/v1/projects/{id}/narrator-assessments?narrator_id={id}`: Queries critic assessments conditioned on specific teachers.
- `POST /api/v1/projects/{id}/narrator-assessments`: Records conditioned assessment.
  ```json
  {
    "narrator_id": 501,
    "teacher_id": 702,
    "assessment_category": "weakened_specifically",
    "critic_name": "Ahmad ibn Hanbal",
    "qawl_text": "His narrations from this specific teacher contain munkarat because his notes were lost in transit."
  }
  ```


