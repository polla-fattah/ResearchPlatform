# 📜 Open Hadith Research Platform
### Computational Research Workspace & Editorial Peer-Review System
*Salahaddin University-Erbil (SUE) & Artificial Intelligence and Innovation Centre (AIIC)*

---

## 🌟 Overview
The **Open Hadith Research Platform** is an empirical, scholar-in-the-loop research environment designed for rigorous academic investigations in Hadith studies. 

The platform implements a **dual-database architecture**:
1. **Canonical Corpus Adapter (`hadiths_v2`)**: A read-only gateway providing high-performance full-text search, graph traversal, and biographical criticism queries across 1.13M Hadith occurrences and 49,800+ narrators.
2. **Research Platform Store (`hadith_research_platform`)**: An isolated transactional workspace enabling scholars to formulate research hypotheses, assemble evidence, annotate variant texts, run lexical/topological comparisons, invite collaborators, and publish peer-reviewed monographs through formal editorial governance.

---

## 📂 Repository Structure

```text
ResearchPlatform/
├── backend/            # Laravel 11 REST API service (Sanctum, PostgreSQL, 39 test suites)
│   ├── app/            # Eloquent models, controllers, services & policies
│   ├── database/       # Seeders & core system migrations
│   ├── routes/api.php  # 130 registered API routes across 14 modules
│   └── tests/          # Comprehensive test suites (890+ assertions, 100% green)
│
├── docs/               # Complete project documentation & specifications
│   ├── requirements/   # Master requirements (Open_Hadith_Research_Platform_Requirements.md) & Backlog.csv
│   ├── architecture/   # Entity Relationship Diagrams & SQL schemas
│   ├── api/            # API specifications (OpenAPI 3.1, Postman, Bruno)
│   ├── design/         # UI conventions, navigation maps & 13 screen blueprints
│   └── README.md       # Master documentation index
│
├── .gitignore          # Repository gitignore (excludes secrets, vendor & build caches)
└── README.md           # Master platform guide
```

---

## 🚀 Quick Start (Backend)

### 1. Requirements
* PHP 8.2+ with `pdo_pgsql`, `mbstring`, `openssl`, `curl` extensions.
* Composer 2+.
* PostgreSQL 15+ with `hadiths_v2` (corpus) and `hadith_research_platform` databases.

### 2. Environment Configuration
Navigate to `backend/` and configure `.env`:
```bash
cd backend
cp .env.example .env
```
Ensure database credentials are set:
```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=hadith_research_platform
DB_USERNAME=postgres
DB_PASSWORD=your_password

DB_CORPUS_HOST=127.0.0.1
DB_CORPUS_PORT=5432
DB_CORPUS_DATABASE=hadiths_v2
DB_CORPUS_USERNAME=postgres
DB_CORPUS_PASSWORD=your_password
```

### 3. Install & Seed
```bash
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed --class=ScholarlyDemoSeeder
```

### 4. Running the Test Suite
The backend is backed by 39 comprehensive feature test suites covering authentication, evidence tracking, document revision conflicts, editorial peer-review workflows, and COI enforcement:
```bash
php artisan test
```

### 5. API Documentation
* **Interactive Browser UI:** Start the server with `php artisan serve` and visit [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).
* **API Specifications:** OpenAPI 3.1, Postman v2.1, and Bruno collections are located in [`docs/api/`](file:///c:/Users/polla/Drives/PollaFattah/UNi/Research/Projects/Hadith/ResearchPlatform/docs/api).

---

## 🏛️ Implementation Releases

* **Release 1a (MVP):** Researcher accounts, personal library, workspaces, evidence capture, finding synthesis, document versioning, and canonical corpus adapter.
* **Release 1b (Collaboration):** Role-based collaborator invitations, anchored discussion threads, research task management, and document edit locks.
* **Release 1c (Publishing):** Multi-stage editorial review queues, conflict-of-interest (COI) blocking, peer-review scoring, revision cycles, DOI minting, versioned corrigenda, and citation export (BibTeX/RIS/APA).
