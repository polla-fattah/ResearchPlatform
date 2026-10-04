-- ============================================================================
-- Open Hadith Research Platform — Dedicated Research Database DDL Schema
-- Database: hadith_research_platform (PostgreSQL)
-- Specifications: Open_Hadith_Research_Platform_Requirements.md (v0.2 / R1)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. USERS & RESEARCHER IDENTITY
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(10) DEFAULT 'ar',
    status VARCHAR(50) NOT NULL DEFAULT 'unverified', -- unverified, pending, approved, suspended
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE researcher_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    affiliation VARCHAR(500),
    biography TEXT,
    research_interests JSONB DEFAULT '[]'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    public_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE researcher_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, info_requested, approved, rejected
    research_statement TEXT,
    sample_publications TEXT,
    decision_reason TEXT,
    decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. RESEARCH WORKSPACES & COLLABORATION
-- ----------------------------------------------------------------------------
CREATE TABLE research_projects (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(500) NOT NULL,
    question TEXT NOT NULL,
    scope TEXT,
    primary_language VARCHAR(10) DEFAULT 'ar',
    stage VARCHAR(50) NOT NULL DEFAULT 'scoping', -- scoping, collecting, analysing, writing, reviewing, completed
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    recovery_deadline TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_memberships (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- owner, researcher, reviewer, viewer
    status VARCHAR(50) NOT NULL DEFAULT 'invited', -- invited, accepted, revoked
    invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_user UNIQUE (project_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. RESOURCES & MY LIBRARY
-- ----------------------------------------------------------------------------
CREATE TABLE resources (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(50) NOT NULL, -- corpus_hadith, corpus_narrator, corpus_book, corpus_sanad, external_reference, file
    corpus_table VARCHAR(50),           -- links to hadiths_v2: hadiths, narrators, books, sanads
    corpus_id BIGINT,                  -- ID inside hadiths_v2 database
    title VARCHAR(1000) NOT NULL,
    author VARCHAR(500),
    source_metadata JSONB DEFAULT '{}'::jsonb,
    rights_status VARCHAR(50) DEFAULT 'open', -- open, restricted, unknown
    provenance TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE library_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    is_favourite BOOLEAN DEFAULT FALSE,
    personal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_resource UNIQUE (user_id, resource_id)
);

CREATE TABLE resource_collections (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL, -- user, project
    owner_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_resources (
    id BIGSERIAL PRIMARY KEY,
    collection_id BIGINT NOT NULL REFERENCES resource_collections(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_collection_resource UNIQUE (collection_id, resource_id)
);

CREATE TABLE project_resources (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    added_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    inclusion_rationale TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_resource UNIQUE (project_id, resource_id)
);

CREATE TABLE attachments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES research_projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    rights_status VARCHAR(50) DEFAULT 'restricted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. SEARCHES & RESULT SETS
-- ----------------------------------------------------------------------------
CREATE TABLE saved_queries (
    id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL, -- user, project
    owner_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    search_mode VARCHAR(50) DEFAULT 'normalized', -- exact, normalized
    filter_criteria JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE search_runs (
    id BIGSERIAL PRIMARY KEY,
    saved_query_id BIGINT NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
    corpus_version VARCHAR(50),
    match_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed', -- completed, partial, cancelled
    execution_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE result_sets (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    search_run_id BIGINT REFERENCES search_runs(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    is_frozen BOOLEAN DEFAULT TRUE,
    total_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE result_set_members (
    id BIGSERIAL PRIMARY KEY,
    result_set_id BIGINT NOT NULL REFERENCES result_sets(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    corpus_id BIGINT NOT NULL,
    ordinal_position INTEGER NOT NULL,
    snapshot_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. EVIDENCE, ANNOTATIONS & ANALYSIS WORKBENCH
-- ----------------------------------------------------------------------------
CREATE TABLE evidence_items (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    captured_text TEXT NOT NULL,
    locator VARCHAR(255),               -- Book/Volume/Page/Hadith#
    source_version VARCHAR(50),
    content_hash VARCHAR(64) NOT NULL,
    state VARCHAR(50) NOT NULL DEFAULT 'candidate', -- candidate, included, reviewed, excluded, unresolved
    exclusion_reason TEXT,
    collector_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotations (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,    -- evidence, source_span, document_block
    target_id BIGINT NOT NULL,
    span_start INTEGER,
    span_end INTEGER,
    annotation_kind VARCHAR(50) NOT NULL, -- source_quotation, interpretation, scholarly_judgment, machine_suggestion
    visibility VARCHAR(50) NOT NULL DEFAULT 'private', -- private, project_shared
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analysis_runs (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,  -- matn_comparison, isnad_comparison, narrator_dossier, criticism_matrix, ilal_case
    input_params JSONB NOT NULL,
    output_data JSONB NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 6. FINDINGS, DOCUMENTS & CITATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE findings (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    claim TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    limitations TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'provisional', -- provisional, supported, inconclusive, disputed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finding_evidence (
    id BIGSERIAL PRIMARY KEY,
    finding_id BIGINT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    evidence_id BIGINT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL, -- supporting, opposing, contextual, unresolved
    interpretation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_finding_evidence UNIQUE (finding_id, evidence_id)
);

CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    document_type VARCHAR(50) DEFAULT 'article', -- article, dossier, dataset_note
    language VARCHAR(10) DEFAULT 'ar',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_versions (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,              -- Structured Markdown
    author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_document_version UNIQUE (document_id, version_number)
);

CREATE TABLE citations (
    id BIGSERIAL PRIMARY KEY,
    document_version_id BIGINT NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    evidence_id BIGINT REFERENCES evidence_items(id) ON DELETE SET NULL,
    resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    locator VARCHAR(255),
    citation_type VARCHAR(50) DEFAULT 'direct_quotation', -- direct_quotation, paraphrase, reference
    formatted_citation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 7. COLLABORATION, DISCUSSIONS & TASKS
-- ----------------------------------------------------------------------------
CREATE TABLE discussion_threads (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,    -- project, evidence, analysis, finding, document
    target_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    thread_id BIGINT NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, in_progress, blocked, done
    blocking_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. ANNOUNCEMENTS, SUBMISSIONS & EDITORIAL PUBLISHING
-- ----------------------------------------------------------------------------
CREATE TABLE announcements (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL UNIQUE REFERENCES research_projects(id) ON DELETE CASCADE,
    public_slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    summary TEXT NOT NULL,
    research_stage VARCHAR(50) NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, published, unpublished, hidden
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE submissions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(500) NOT NULL,
    abstract TEXT NOT NULL,
    frozen_package JSONB NOT NULL,
    package_checksum VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted', -- submitted, in_review, revision_requested, approved, rejected
    submitted_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_assignments (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    reviewer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recommendation VARCHAR(50),          -- approve, request_revisions, reject
    reviewer_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_submission_reviewer UNIQUE (submission_id, reviewer_id)
);

CREATE TABLE editorial_decisions (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    editor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision VARCHAR(50) NOT NULL,       -- approve, request_revisions, reject
    decision_notes TEXT NOT NULL,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE publications (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE RESTRICT,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
    public_slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    abstract TEXT NOT NULL,
    published_content JSONB NOT NULL,
    version_string VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(50) NOT NULL DEFAULT 'published', -- published, withdrawn
    released_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    released_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 9. EXPORTS, AUDITS & CORPUS PROPOSALS
-- ----------------------------------------------------------------------------
CREATE TABLE export_jobs (
    id BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(50) NOT NULL,          -- project, library, account
    target_id BIGINT,
    format VARCHAR(20) NOT NULL,         -- zip, json, html, csv, pdf
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- queued, running, completed, partial, failed, expired
    download_url TEXT,
    file_size BIGINT,
    checksum VARCHAR(64),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
    id BIGSERIAL PRIMARY KEY,
    actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    object_type VARCHAR(100) NOT NULL,
    object_id BIGINT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE corpus_correction_proposals (
    id BIGSERIAL PRIMARY KEY,
    researcher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    corpus_table VARCHAR(50) NOT NULL,   -- hadiths, narrators, sanads, etc.
    corpus_id BIGINT NOT NULL,
    current_value TEXT NOT NULL,
    proposed_value TEXT NOT NULL,
    evidence_notes TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, accepted, rejected
    decided_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_project_owner ON research_projects(owner_id);
CREATE INDEX idx_project_members_user ON project_memberships(user_id);
CREATE INDEX idx_evidence_project ON evidence_items(project_id);
CREATE INDEX idx_evidence_resource ON evidence_items(resource_id);
CREATE INDEX idx_findings_project ON findings(project_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_annotations_target ON annotations(target_type, target_id);
CREATE INDEX idx_announcements_slug ON announcements(public_slug);
CREATE INDEX idx_publications_slug ON publications(public_slug);
CREATE INDEX idx_resources_corpus ON resources(corpus_table, corpus_id);
