<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Finding;
use App\Models\EvidenceItem;
use App\Models\Resource;
use App\Models\EmailVerification;
use App\Models\ResearcherApplication;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class Batch1ImplementationTest extends TestCase
{
    public function test_email_verification_is_expired_method()
    {
        $token1 = 'token_' . Str::random(24);
        $verification = EmailVerification::create([
            'email' => 'test_' . Str::random(8) . '@example.org',
            'token' => $token1,
            'expires_at' => now()->subMinutes(5),
        ]);

        $this->assertTrue($verification->isExpired());

        $token2 = 'token_' . Str::random(24);
        $validVerification = EmailVerification::create([
            'email' => 'valid_' . Str::random(8) . '@example.org',
            'token' => $token2,
            'expires_at' => now()->addMinutes(60),
        ]);

        $this->assertFalse($validVerification->isExpired());
    }

    public function test_admin_support_grant_creation_and_listing()
    {
        $admin = User::create(['email' => 'admin_test_' . Str::random(6) . '@example.org', 'display_name' => 'Admin User', 'password' => Hash::make('password'), 'is_admin' => true, 'status' => 'approved']);
        $researcher = User::create(['email' => 'researcher_test_' . Str::random(6) . '@example.org', 'display_name' => 'Researcher User', 'password' => Hash::make('password'), 'status' => 'approved']);
        $project = ResearchProject::create([
            'owner_id' => $researcher->id,
            'title' => 'Project For Grant',
            'scope' => 'Grant testing',
        ]);

        Sanctum::actingAs($researcher);

        $res = $this->postJson('/api/v1/researcher/support-grants', [
            'admin_id' => $admin->id,
            'scope' => 'project',
            'object_id' => $project->id,
            'reason' => 'Need technical support',
            'expires_days' => 7,
        ]);

        $res->assertStatus(201);
        $this->assertDatabaseHas('support_grants', [
            'admin_id' => $admin->id,
            'granted_by' => $researcher->id,
            'scope' => 'project',
            'object_id' => $project->id,
            'status' => 'active',
        ]);

        // Researcher listing grants
        $listRes = $this->getJson('/api/v1/researcher/support-grants');
        $listRes->assertStatus(200);
        $listRes->assertJsonFragment(['object_id' => $project->id]);
    }

    public function test_admin_cannot_re_decide_already_decided_application()
    {
        $admin = User::create(['email' => 'admin_decide_' . Str::random(6) . '@example.org', 'display_name' => 'Admin Decide', 'password' => Hash::make('password'), 'is_admin' => true, 'status' => 'approved']);
        $applicant = User::create(['email' => 'app_user_' . Str::random(6) . '@example.org', 'display_name' => 'Applicant User', 'password' => Hash::make('password'), 'status' => 'pending']);
        $app = ResearcherApplication::create([
            'user_id' => $applicant->id,
            'status' => 'approved',
            'research_statement' => 'Hadith studies',
        ]);

        Sanctum::actingAs($admin);

        $res = $this->postJson("/api/v1/admin/applications/{$app->id}/decide", [
            'decision' => 'rejected',
            'reason' => 'Changed my mind',
        ]);

        $res->assertStatus(409);
        $res->assertJsonPath('error.code', 'CONFLICT');
    }

    public function test_document_scoping_and_concurrency_and_dependencies()
    {
        $user = User::create(['email' => 'doc_user_' . Str::random(6) . '@example.org', 'display_name' => 'Doc User', 'password' => Hash::make('password'), 'status' => 'approved']);
        $project1 = ResearchProject::create(['owner_id' => $user->id, 'title' => 'Project 1']);
        $project2 = ResearchProject::create(['owner_id' => $user->id, 'title' => 'Project 2']);

        $resDoc = Document::create(['project_id' => $project1->id, 'title' => 'Doc 1']);
        $v1 = DocumentVersion::create([
            'document_id' => $resDoc->id,
            'version_number' => 1,
            'content' => 'Initial content',
            'author_id' => $user->id,
            'created_at' => now(),
        ]);

        Sanctum::actingAs($user);

        // Foreign project scoping: reading project 1 doc version via project 2 should 404
        $res = $this->getJson("/api/v1/projects/{$project2->id}/documents/{$resDoc->id}/versions/1");
        $res->assertStatus(404);

        // Same project should return 200 and sanitized author without email
        $resOk = $this->getJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}/versions/1");
        $resOk->assertStatus(200);
        $this->assertStringNotContainsString('"email"', $resOk->getContent());

        // Concurrency conflict when committing new version with wrong expected_version
        $conflictRes = $this->postJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}/versions", [
            'content' => 'New revision',
            'expected_version' => 99,
        ]);
        $conflictRes->assertStatus(409);
        $conflictRes->assertJsonPath('error.code', 'CONFLICT');

        // Successful commit clears draft
        $this->putJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}/draft", [
            'content' => 'Autosaved draft',
            'base_version' => 1,
        ])->assertStatus(200);

        $commitRes = $this->postJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}/versions", [
            'content' => 'Committed v2',
            'expected_version' => 1,
        ]);
        $commitRes->assertStatus(201);

        $draftCheck = $this->getJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}/draft");
        $this->assertNull($draftCheck->json('data.draft_content'));

        // Delete with dependencies: link finding, attempt delete without confirm
        $finding = Finding::create([
            'project_id' => $project1->id,
            'question' => 'Q?',
            'claim' => 'C',
            'reasoning' => 'R',
            'status' => 'provisional',
        ]);
        $resDoc->findings()->attach($finding->id);

        $delRes = $this->deleteJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}");
        $delRes->assertStatus(409);
        $delRes->assertJsonPath('error.code', 'HAS_DEPENDENCIES');

        $forceDel = $this->deleteJson("/api/v1/projects/{$project1->id}/documents/{$resDoc->id}?confirm=true");
        $forceDel->assertStatus(200);
    }

    public function test_findings_withdrawn_status_and_evidence_scoping()
    {
        $user = User::create(['email' => 'findings_user_' . Str::random(6) . '@example.org', 'display_name' => 'Findings User', 'password' => Hash::make('password'), 'status' => 'approved']);
        $project1 = ResearchProject::create(['owner_id' => $user->id, 'title' => 'Project 1']);
        $project2 = ResearchProject::create(['owner_id' => $user->id, 'title' => 'Project 2']);

        $res = Resource::create(['resource_type' => 'book', 'title' => 'Book A']);
        $evForeign = EvidenceItem::create([
            'project_id' => $project2->id,
            'resource_id' => $res->id,
            'captured_text' => 'Foreign text',
            'content_hash' => hash('sha256', 'Foreign text'),
        ]);

        Sanctum::actingAs($user);

        // Store finding with foreign evidence should fail 422
        $failStore = $this->postJson("/api/v1/projects/{$project1->id}/findings", [
            'question' => 'What is X?',
            'claim' => 'Claim X',
            'reasoning' => 'Reasoning X',
            'evidence_links' => [
                ['evidence_id' => $evForeign->id, 'relation_type' => 'supporting']
            ]
        ]);
        $failStore->assertStatus(422);

        // Store finding with valid status withdrawn
        $okStore = $this->postJson("/api/v1/projects/{$project1->id}/findings", [
            'question' => 'What is Y?',
            'claim' => 'Claim Y',
            'reasoning' => 'Reasoning Y',
            'status' => 'withdrawn',
        ]);
        $okStore->assertStatus(201);
        $okStore->assertJsonPath('data.status', 'withdrawn');
        $findingId = $okStore->json('data.id');

        // Optimistic locking on update
        $fUpdate = $this->patchJson("/api/v1/projects/{$project1->id}/findings/{$findingId}", [
            'claim' => 'Claim Y updated',
            'expected_version' => 1,
        ]);
        $fUpdate->assertStatus(200);
        $this->assertEquals(2, $fUpdate->json('data.version'));

        // Stale update
        $staleUpdate = $this->patchJson("/api/v1/projects/{$project1->id}/findings/{$findingId}", [
            'claim' => 'Stale update',
            'expected_version' => 1,
        ]);
        $staleUpdate->assertStatus(409);
    }
}
