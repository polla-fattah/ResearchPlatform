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
    lock_version INTEGER DEFAULT 1,
    locked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
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
-- 7. COLLABORATION, DISCUSSIONS, TASKS & NOTIFICATIONS (R1b)
-- ----------------------------------------------------------------------------
CREATE TABLE project_invitations (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- co_investigator, contributor, reviewer, observer
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired, revoked
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    invited_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE discussion_threads (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    thread_type VARCHAR(50) NOT NULL DEFAULT 'discussion', -- discussion, dispute_review
    target_type VARCHAR(50) NOT NULL,    -- project, evidence, analysis, finding, document, passage
    target_id BIGINT NOT NULL,
    title VARCHAR(500) NOT NULL,
    context_quote TEXT,
    context_locator VARCHAR(255),
    alternative_interpretation TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
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

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- invitation, mention, assignment, review_decision, export_ready
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_type VARCHAR(50),
    target_id BIGINT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    notify_invitations BOOLEAN DEFAULT TRUE,
    notify_mentions BOOLEAN DEFAULT TRUE,
    notify_assignments BOOLEAN DEFAULT TRUE,
    notify_reviews BOOLEAN DEFAULT TRUE,
    notify_exports BOOLEAN DEFAULT TRUE,
    email_digest VARCHAR(20) DEFAULT 'instant', -- instant, daily, weekly, never
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_activities (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL, -- member_joined, role_changed, member_removed, evidence_added, discussion_opened, task_completed
    object_type VARCHAR(50) NOT NULL,
    object_id BIGINT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    parent_submission_id BIGINT REFERENCES submissions(id) ON DELETE SET NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(500) NOT NULL,
    abstract TEXT NOT NULL,
    keywords JSONB DEFAULT '[]'::jsonb,
    rights_declaration VARCHAR(100) DEFAULT 'CC-BY-4.0',
    coi_declared BOOLEAN DEFAULT TRUE,
    author_response_notes TEXT,
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
    score INTEGER,                       -- 1-10 scholarly assessment score
    reviewer_notes TEXT,
    coi_confirmed BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMP WITH TIME ZONE,
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
    coi_confirmed BOOLEAN DEFAULT FALSE,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE publications (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE RESTRICT,
    submission_id BIGINT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
    public_slug VARCHAR(255) NOT NULL UNIQUE,
    doi VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    abstract TEXT NOT NULL,
    published_content JSONB NOT NULL,
    version_string VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    license VARCHAR(100) NOT NULL DEFAULT 'CC-BY-4.0',
    status VARCHAR(50) NOT NULL DEFAULT 'published', -- published, retracted, under_errata_review
    retraction_reason TEXT,
    retracted_at TIMESTAMP WITH TIME ZONE,
    corrigenda JSONB DEFAULT '[]'::jsonb,
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

-- ----------------------------------------------------------------------------
-- 13. RELEASE 2: ADVANCED ANALYSIS WORKBENCH, FAMILIES & ILAL INVESTIGATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE hadith_families (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    canonical_title TEXT NOT NULL,
    root_companion VARCHAR(255),
    core_theme TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hadith_family_members (
    id BIGSERIAL PRIMARY KEY,
    family_id BIGINT NOT NULL REFERENCES hadith_families(id) ON DELETE CASCADE,
    evidence_id BIGINT REFERENCES evidence_items(id) ON DELETE SET NULL,
    corpus_hadith_id BIGINT,
    corpus_sanad_id BIGINT,
    relationship_type VARCHAR(50) NOT NULL, -- mutabaah_tammah, mutabaah_qasirah, shahid, candidate
    convergence_narrator VARCHAR(255),
    convergence_depth INTEGER,
    scholarly_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ilal_cases (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    discrepancy_category VARCHAR(100) NOT NULL, -- irsal_vs_ittisal, waqf_vs_raf, ziyadah_thiqah, tashif, qalb, ikhtilaf_sanad, shudhudh
    competing_variants JSONB DEFAULT '[]'::jsonb,
    critics_judgments JSONB DEFAULT '[]'::jsonb,
    preferred_version TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'under_investigation', -- under_investigation, resolved_authentic, resolved_defective, inconclusive
    resolution_notes TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE narrator_teacher_assessments (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    narrator_id BIGINT NOT NULL,
    teacher_id BIGINT NOT NULL,
    assessment_category VARCHAR(50) NOT NULL, -- sound, weakened_specifically, mudallis_from_him, unsubstantiated
    critic_name VARCHAR(255),
    qawl_text TEXT NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hadith_families_project ON hadith_families(project_id);
CREATE INDEX idx_hadith_family_members_family ON hadith_family_members(family_id);
CREATE INDEX idx_ilal_cases_project ON ilal_cases(project_id);
CREATE INDEX idx_narrator_teacher_project ON narrator_teacher_assessments(project_id);
CREATE INDEX idx_narrator_teacher_pair ON narrator_teacher_assessments(narrator_id, teacher_id);

-- ----------------------------------------------------------------------------
-- 14. RELEASE 2b & RELEASE 3: ADVANCED CAPABILITIES SCHEMA
-- ----------------------------------------------------------------------------

-- Historical Assertions (EVI-08)
CREATE TABLE historical_assertions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    subject_type VARCHAR(50) NOT NULL, -- narrator, event, report, text_reading
    subject_id BIGINT NULL,
    subject_name VARCHAR(255) NOT NULL,
    assertion_claim TEXT NOT NULL,
    uncertainty_level VARCHAR(50) DEFAULT 'probable', -- certain, highly_probable, probable, contested, speculative
    competing_alternatives JSONB DEFAULT '[]'::jsonb,
    adjudication_notes TEXT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hist_assertions_project ON historical_assertions(project_id);
CREATE INDEX idx_hist_assertions_subject ON historical_assertions(subject_type, subject_id);

-- Structured Argumentation Graph (WRT-08)
CREATE TABLE argument_nodes (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL, -- premise, claim, objection, reply, qualification, alternative_conclusion
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    evidence_id BIGINT REFERENCES evidence_items(id) ON DELETE SET NULL,
    finding_id BIGINT REFERENCES findings(id) ON DELETE SET NULL,
    order_index INT DEFAULT 0,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_arg_nodes_project ON argument_nodes(project_id);

CREATE TABLE argument_edges (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    source_node_id BIGINT NOT NULL REFERENCES argument_nodes(id) ON DELETE CASCADE,
    target_node_id BIGINT NOT NULL REFERENCES argument_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL, -- supports, refutes, qualifies, replies_to, alternative_to
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_arg_edges_project ON argument_edges(project_id);
CREATE INDEX idx_arg_edges_endpoints ON argument_edges(source_node_id, target_node_id);

-- Project Creation Templates (PRJ-08)
CREATE TABLE project_templates (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    default_question TEXT NOT NULL,
    recommended_stages JSONB DEFAULT '[]'::jsonb,
    default_tasks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verified Collaboration-Interest Requests (ANN-06)
CREATE TABLE collaboration_requests (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined
    decision_notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_collab_req_project ON collaboration_requests(project_id);
CREATE INDEX idx_collab_req_requester ON collaboration_requests(requester_id);

-- Geographical Places & Narrator Trajectories (ANA-13)
CREATE TABLE geographical_places (
    id BIGSERIAL PRIMARY KEY,
    canonical_name_ar VARCHAR(255) NOT NULL,
    canonical_name_en VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    historical_notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE narrator_trajectories (
    id BIGSERIAL PRIMARY KEY,
    narrator_id BIGINT NOT NULL,
    place_id BIGINT NOT NULL REFERENCES geographical_places(id) ON DELETE CASCADE,
    trajectory_type VARCHAR(50) NOT NULL, -- birth, death, residence, rihlah, audition
    year_hijri_start INT NULL,
    year_hijri_end INT NULL,
    evidence_text TEXT NULL,
    is_inferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trajectories_narrator ON narrator_trajectories(narrator_id);
CREATE INDEX idx_trajectories_place ON narrator_trajectories(place_id);

-- Scheduled Search Subscriptions (SEA-10)
CREATE TABLE search_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saved_query_id BIGINT NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
    frequency VARCHAR(50) DEFAULT 'weekly', -- daily, weekly, monthly
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE NULL,
    last_result_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_sub_user ON search_subscriptions(user_id);
CREATE INDEX idx_search_sub_project ON search_subscriptions(project_id);


