<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\EvidenceItem;
use App\Models\Finding;
use App\Models\Submission;
use App\Models\ReviewAssignment;
use App\Models\EditorialDecision;
use App\Models\Publication;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class EditorialPublishingApiTest extends TestCase
{
    protected User $editor;
    protected User $author;
    protected User $coAuthor;
    protected User $independentReviewer;
    protected ResearchProject $project;
    protected Document $document;

    protected function setUp(): void
    {
        parent::setUp();

        $uid = uniqid();

        $this->editor = User::create([
            'display_name' => 'Prof. Chief Editor',
            'email' => "editor_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
            'is_admin' => true,
        ]);

        $this->author = User::create([
            'display_name' => 'Dr. Lead Researcher',
            'email' => "author_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
        ]);

        $this->coAuthor = User::create([
            'display_name' => 'Dr. Co-Investigator',
            'email' => "coauthor_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
        ]);

        $this->independentReviewer = User::create([
            'display_name' => 'Dr. External Specialist',
            'email' => "reviewer_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
        ]);

        $this->project = ResearchProject::create([
            'owner_id' => $this->author->id,
            'title' => 'Critical Edition of the Niyyah Transmissions',
            'question' => 'How did the Basran transmission recensions bifurcate in 150-180 AH?',
            'stage' => 'writing',
        ]);

        ProjectMembership::create([
            'project_id' => $this->project->id,
            'user_id' => $this->author->id,
            'role' => 'owner',
            'status' => 'accepted',
        ]);

        ProjectMembership::create([
            'project_id' => $this->project->id,
            'user_id' => $this->coAuthor->id,
            'role' => 'co_investigator',
            'status' => 'accepted',
        ]);

        $this->document = Document::create([
            'project_id' => $this->project->id,
            'title' => 'Monograph Draft: Early Niyyah Recensions',
            'document_type' => 'monograph',
            'language' => 'ar',
        ]);

        DocumentVersion::create([
            'document_id' => $this->document->id,
            'version_number' => 1,
            'content' => "# Introduction to Niyyah Transmission\n\nAll primary paths converge on Yahya ibn Sa'id.",
            'author_id' => $this->author->id,
            'created_at' => now(),
        ]);
    }

    public function test_wrt_07_pre_publication_validation(): void
    {
        Sanctum::actingAs($this->author);

        $res = $this->postJson("/api/v1/projects/{$this->project->id}/validate-pre-publication", [
            'document_ids' => [$this->document->id],
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_valid', true)
            ->assertJsonPath('data.issue_count', 0);
    }

    public function test_pub_01_and_02_submission_and_package_freezing(): void
    {
        Sanctum::actingAs($this->author);

        $res = $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'The Niyyah Hadith: Empirical Isnād and Matn Collation',
            'abstract' => 'Comprehensive historical and topological analysis of the early transmission paths.',
            'document_ids' => [$this->document->id],
            'keywords' => ['Niyyah', 'Yahya ibn Sa\'id', 'Common Link'],
            'rights_declaration' => 'CC-BY-4.0',
            'coi_declared' => true,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.version_number', 1)
            ->assertJsonPath('data.status', 'submitted');

        $submissionId = $res->json('data.id');
        $checksum = $res->json('data.package_checksum');

        $this->assertNotEmpty($checksum);
        $this->assertDatabaseHas('submissions', [
            'id' => $submissionId,
            'version_number' => 1,
            'package_checksum' => $checksum,
        ]);
    }

    public function test_pub_04_and_05_conflict_of_interest_and_peer_review_enforcement(): void
    {
        // 1. Author submits
        Sanctum::actingAs($this->author);
        $subRes = $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'Peer Review Enforcement Study',
            'abstract' => 'Testing editorial workflows.',
            'document_ids' => [$this->document->id],
        ]);
        $submissionId = $subRes->json('data.id');

        // 2. Editor attempts to assign Author as reviewer -> 422 Conflict of Interest (PUB-05)
        Sanctum::actingAs($this->editor);
        $coiAuthorRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $this->author->id,
        ]);
        $coiAuthorRes->assertStatus(422)
            ->assertJsonPath('error.code', 'CONFLICT_OF_INTEREST');

        // 3. Editor attempts to assign Co-Author / Project Team Member as reviewer -> 422 Conflict of Interest (PUB-05)
        $coiTeamRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $this->coAuthor->id,
        ]);
        $coiTeamRes->assertStatus(422)
            ->assertJsonPath('error.code', 'CONFLICT_OF_INTEREST');

        // 4. Editor assigns Independent Reviewer -> 201 Created
        $assignRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $this->independentReviewer->id,
            'due_date' => now()->addDays(14)->toDateString(),
            'coi_confirmed' => true,
        ]);
        $assignRes->assertStatus(201)
            ->assertJsonPath('success', true);

        // 5. Editor attempts to approve without any completed peer reviews -> 422 PEER_REVIEW_REQUIRED (PUB-04)
        $prematureApproval = $this->postJson("/api/v1/editor/submissions/{$submissionId}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Attempting premature approval without completed review.',
        ]);
        $prematureApproval->assertStatus(422)
            ->assertJsonPath('error.code', 'PEER_REVIEW_REQUIRED');

        // 6. Independent Reviewer submits scholarly evaluation with score
        Sanctum::actingAs($this->independentReviewer);
        $reviewRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/review", [
            'recommendation' => 'approve',
            'score' => 9,
            'reviewer_notes' => 'Extremely thorough collation of variants across all 4 canonical Sunan.',
            'coi_confirmed' => true,
        ]);
        $reviewRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 7. Author attempts to make editorial decision on their own paper -> 403 Forbidden (PUB-05)
        Sanctum::actingAs($this->author);
        $authorDecide = $this->postJson("/api/v1/editor/submissions/{$submissionId}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Author self-approving.',
        ]);
        $authorDecide->assertStatus(403);

        // 8. Editor makes formal approval decision -> 200 Success
        Sanctum::actingAs($this->editor);
        $decisionRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Unanimously accepted following exemplary peer review evaluation.',
            'coi_confirmed' => true,
        ]);
        $decisionRes->assertStatus(200)
            ->assertJsonPath('data.submission_status', 'approved');
    }

    public function test_adm_02_editorial_queue_filtering(): void
    {
        Sanctum::actingAs($this->author);
        $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'Triage Queue Item',
            'abstract' => 'Item for triage testing.',
            'document_ids' => [$this->document->id],
        ]);

        Sanctum::actingAs($this->editor);

        // Filter by stage 'triage'
        $triageRes = $this->getJson('/api/v1/editor/submissions?stage=triage');
        $triageRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertNotEmpty($triageRes->json('data'));

        // Filter by action_required 'assign_reviewer'
        $actionRes = $this->getJson('/api/v1/editor/submissions?action_required=assign_reviewer');
        $actionRes->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    public function test_pub_06_revision_cycle(): void
    {
        // 1. Initial submission
        Sanctum::actingAs($this->author);
        $subRes = $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'Pre-revision draft',
            'abstract' => 'Needs additional manuscript comparison.',
            'document_ids' => [$this->document->id],
        ]);
        $initialSubId = $subRes->json('data.id');

        // 2. Editor requests revisions
        Sanctum::actingAs($this->editor);
        $this->postJson("/api/v1/editor/submissions/{$initialSubId}/decision", [
            'decision' => 'request_revisions',
            'decision_notes' => 'Please incorporate the recension of Abu Dawud #2201.',
        ]);

        // 3. Author submits Version 2 with author response notes
        Sanctum::actingAs($this->author);
        $revRes = $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'Pre-revision draft (Revised)',
            'abstract' => 'Now incorporates Abu Dawud variant transmission.',
            'document_ids' => [$this->document->id],
            'parent_submission_id' => $initialSubId,
            'author_response_notes' => 'Added exhaustive collation with Abu Dawud in Section 3.',
        ]);

        $revRes->assertStatus(201)
            ->assertJsonPath('data.version_number', 2)
            ->assertJsonPath('data.parent_submission_id', $initialSubId);
    }

    public function test_pub_07_to_11_publication_release_corrigenda_retraction_and_citation(): void
    {
        // 1. Submit
        Sanctum::actingAs($this->author);
        $subRes = $this->postJson("/api/v1/projects/{$this->project->id}/submissions", [
            'title' => 'The Niyyah Monograph: Final Canonical Release',
            'abstract' => 'Peer-reviewed definitive monograph on early transmissions.',
            'document_ids' => [$this->document->id],
            'rights_declaration' => 'CC-BY-SA-4.0',
        ]);
        $subId = $subRes->json('data.id');

        // 2. Assign reviewer, submit review, and approve
        Sanctum::actingAs($this->editor);
        $this->postJson("/api/v1/editor/submissions/{$subId}/assign", [
            'reviewer_id' => $this->independentReviewer->id,
            'coi_confirmed' => true,
        ]);

        Sanctum::actingAs($this->independentReviewer);
        $this->postJson("/api/v1/editor/submissions/{$subId}/review", [
            'recommendation' => 'approve',
            'score' => 10,
            'reviewer_notes' => 'Outstanding academic contribution.',
            'coi_confirmed' => true,
        ]);

        Sanctum::actingAs($this->editor);
        $this->postJson("/api/v1/editor/submissions/{$subId}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Approved for immediate publication release.',
            'coi_confirmed' => true,
        ]);

        // 3. Release Publication atomically (PUB-07)
        $slug = 'niyyah-monograph-' . uniqid();
        $releaseRes = $this->postJson("/api/v1/editor/submissions/{$subId}/release", [
            'public_slug' => $slug,
            'version_string' => '1.0.0',
            'license' => 'CC-BY-SA-4.0',
        ]);

        $releaseRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.public_slug', $slug)
            ->assertJsonPath('data.license', 'CC-BY-SA-4.0');

        $pubId = $releaseRes->json('data.id');
        $doi = $releaseRes->json('data.doi');
        $this->assertNotEmpty($doi);

        // 4. Add Corrigendum / Versioned Erratum (PUB-10)
        $corrigendumRes = $this->postJson("/api/v1/editor/publications/{$pubId}/corrigenda", [
            'notice' => 'Corrected typographical error in footnote 42 citing al-Mizzi Tahdhib.',
            'new_version_string' => '1.0.1',
            'affected_sections' => ['Footnote 42', 'Bibliography'],
        ]);

        $corrigendumRes->assertStatus(200)
            ->assertJsonPath('data.version_string', '1.0.1')
            ->assertJsonPath('data.corrigenda.0.new_version', '1.0.1');

        // 5. Export Citation in BibTeX format (PUB-08)
        $citeRes = $this->getJson("/api/v1/public/research/{$slug}/cite?format=bibtex");
        $citeRes->assertStatus(200)
            ->assertJsonPath('data.format', 'bibtex');
        $this->assertStringContainsString('@article', $citeRes->json('data.citation'));

        // 6. Retract publication and preserve transparent status (PUB-11)
        $retractRes = $this->postJson("/api/v1/editor/publications/{$pubId}/retract", [
            'retraction_reason' => 'Retracted upon discovery of newly surfaced conflicting Damascus codex.',
        ]);

        $retractRes->assertStatus(200)
            ->assertJsonPath('data.status', 'retracted')
            ->assertJsonPath('data.retraction_reason', 'Retracted upon discovery of newly surfaced conflicting Damascus codex.');

        // Public page still resolvable with retraction status
        $publicDetail = $this->getJson("/api/v1/public/research/{$slug}");
        $publicDetail->assertStatus(200)
            ->assertJsonPath('data.status', 'retracted');
    }
}
