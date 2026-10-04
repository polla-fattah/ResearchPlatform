# 📖 Open Hadith Research Platform — Documentation Center

Welcome to the comprehensive documentation index for the **Open Hadith Research Platform**. This directory houses the formal system requirements, technical architecture diagrams, database schemas, REST API contracts, UI/UX designs, and traceability backlogs.

---

## 🧭 Documentation Map

```text
docs/
├── requirements/               # Functional requirements, user stories & backlog
│   ├── Open_Hadith_Research_Platform_Requirements.md  # Master system requirements (R1–R3)
│   ├── Backlog.csv                                    # Traceability backlog & implementation status
│   ├── milestones/
│   │   └── R1a_MVP.md                                 # Release 1a MVP milestone specification
│   └── archive/
│       └── Open_Hadith_Research_Platform_Requirements_v0.1.md  # Legacy v0.1 draft
│
├── architecture/               # Data models, relational schemas & ERD
│   ├── HadithResearchPlatform_ERD.md                  # Entity-Relationship diagram & data model
│   └── hadith_research_platform_schema.sql            # PostgreSQL DDL for hadith_research_platform
│
├── api/                        # REST API contracts & developer collections
│   ├── API_Design_Specification.md                    # Endpoint specifications & sample payloads
│   ├── openapi.json                                   # OpenAPI 3.1 specification (95 routes)
│   ├── OpenHadith_Platform.postman_collection.json    # Postman v2.1 export
│   └── bruno/                                         # Bruno API collection
│       ├── bruno.json
│       └── environments/Local.bru
│
├── design/                     # UX conventions, UI flows, terminology & screen specs
│   ├── README.md                                      # Design system overview
│   ├── conventions.md                                 # Typography, direction, color & dialog patterns
│   ├── navigation-map.md                              # Application hierarchy & route transitions
│   ├── terminology.md                                 # Arabic / English scholarly glossary
│   ├── ui.pdf                                         # Vector UI designs & layout sketches
│   ├── System analysis and cuts.zip                   # Original analytical source material
│   └── screens/                                       # 13 dedicated screen specifications
│       ├── 01-registration-application.md
│       ├── 02-personal-home.md
│       ├── 03-my-library.md
│       ├── 04-project-index.md
│       ├── 05-project-creation.md
│       ├── 06-project-overview-settings.md
│       ├── 07-resource-picker.md
│       ├── 08-search-workspace.md
│       ├── 09-evidence-inspector.md
│       ├── 10-comparison-workspace.md
│       ├── 11-finding-document-editor.md
│       ├── 12-downloads.md
│       ├── 13-administration.md
│       └── _template.md
│
└── inputs/                     # Reference data & prompt artifacts
```

---

## 📂 Section Overviews

### 1. Requirements & Backlog ([`docs/requirements/`](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/requirements))
* [**Open_Hadith_Research_Platform_Requirements.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/requirements/Open_Hadith_Research_Platform_Requirements.md): The exhaustive product requirements document detailing all 12 operational modules across Epics E01 to E12.
* [**Backlog.csv**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/requirements/Backlog.csv): The requirement-level traceability matrix containing status tracking for all functional requirements across Releases R1a, R1b, R1c, R2, and R3.
* [**milestones/R1a_MVP.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/requirements/milestones/R1a_MVP.md): Detailed acceptance criteria and scope boundary for the foundational Minimum Viable Product.

### 2. Architecture & Database ([`docs/architecture/`](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/architecture))
* [**HadithResearchPlatform_ERD.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/architecture/HadithResearchPlatform_ERD.md): Visual Mermaid diagrams and entity descriptions representing the workspace data model.
* [**hadith_research_platform_schema.sql**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/architecture/hadith_research_platform_schema.sql): Complete DDL with tables, foreign keys, triggers, enum types, and indexes for PostgreSQL.

### 3. API Contracts & Collections ([`docs/api/`](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api))
* [**API_Design_Specification.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api/API_Design_Specification.md): Human-readable tables of all 14 API modules, role requirements, parameter definitions, and sample JSON request/response payloads.
* [**openapi.json**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api/openapi.json): Standard OpenAPI 3.1 specification (95 operations).
* [**OpenHadith_Platform.postman_collection.json**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api/OpenHadith_Platform.postman_collection.json): Importable collection for Postman v2.1 with pre-configured Bearer token variables.
* [**bruno/**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api/bruno): Git-friendly API testing collection using the Bruno client.

### 4. UI/UX Design System ([`docs/design/`](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/design))
* [**conventions.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/design/conventions.md): RTL layout rules, typography tokens for classical Arabic and Sorani Kurdish, and color scales.
* [**navigation-map.md**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/design/navigation-map.md): Application route hierarchy from public landing page to private workspaces and editorial queues.
* [**screens/**](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/design/screens): Granular screen blueprints covering form fields, action buttons, table columns, and validation states.

---

## 🛠️ Regenerating API Documentation
API documentation artifacts can be regenerated at any time using the Artisan command:
```bash
cd backend
php artisan docs:generate
```
This updates both the repository specs in `docs/api/` and the public web documentation in `backend/public/docs/`.
