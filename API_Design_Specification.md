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
| `POST` | `/projects/{id}/submissions` | Freeze package & submit for editorial review | Owner | `PUB-01`, `PUB-02` |
| `GET` | `/editor/submissions` | Editorial review queue (by stage, age) | Editor | `ADM-02` |
| `POST` | `/editor/submissions/{id}/assign` | Assign nonconflicted peer reviewer | Editor | `PUB-04`, `PUB-05` |
| `POST` | `/editor/submissions/{id}/review` | Submit review recommendation & comments | Assigned Reviewer | `PUB-04` |
| `POST` | `/editor/submissions/{id}/decision` | Issue editorial verdict (approve, revise, reject)| Editor | `PUB-03` |
| `POST` | `/editor/submissions/{id}/release` | Release approved package to public website | Editor | `PUB-07` |
| `GET` | `/public/research` | Search & browse peer-reviewed research outputs | Public | `PUB-08`, `PUB-09` |
| `GET` | `/public/research/{slug}` | View published research article, citations, DOI | Public | `PUB-08` |

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
