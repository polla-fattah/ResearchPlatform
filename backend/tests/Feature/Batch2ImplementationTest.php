<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Resource;
use App\Models\EvidenceItem;
use App\Models\Submission;
use App\Models\Publication;
use App\Models\HadithFamily;
use App\Models\HadithFamilyMember;
use App\Models\Corpus\CorpusHadith;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class Batch2ImplementationTest extends TestCase
{
    public function test_c30_editorial_console_validation_and_doi()
    {
        $admin = User::create([
            'email' => 'admin_c30_' . Str::random(6) . '@example.org',
            'display_name' => 'Editor Lead',
            'password' => Hash::make('password'),
            'is_admin' => true,
            'status' => 'approved',
        ]);

        $author = User::create([
            'email' => 'author_c30_' . Str::random(6) . '@example.org',
            'display_name' => 'Author User',
            'password' => Hash::make('password'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $author->id,
            'title' => 'C30 Test Project',
            'scope' => 'Submission Testing',
        ]);

        $submission = Submission::create([
            'project_id' => $project->id,
            'submitted_by' => $author->id,
            'title' => 'C30 Test Submission',
            'abstract' => 'C30 Test Abstract',
            'version_number' => 1,
            'frozen_package' => ['project' => ['title' => 'C30 Project'], 'documents' => []],
            'package_checksum' => hash('sha256', 'c30_package'),
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($admin);

        // 1. Queue list does not have heavy frozen_package, has package_summary
        $listRes = $this->getJson('/api/v1/editor/submissions');
        $listRes->assertStatus(200);
        $item = collect($listRes->json('data.data') ?? $listRes->json('data'))->firstWhere('id', $submission->id);
        $this->assertNotNull($item);
        $this->assertArrayNotHasKey('frozen_package', $item);
        $this->assertArrayHasKey('package_summary', $item);

        // 2. Decide without coi_confirmed returns 422
        $decideRes = $this->postJson("/api/v1/editor/submissions/{$submission->id}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Looking good and ready',
            'coi_confirmed' => false,
            'override_peer_review' => true,
        ]);
        $decideRes->assertStatus(422);

        // 3. Decide with coi_confirmed succeeds
        $decideOk = $this->postJson("/api/v1/editor/submissions/{$submission->id}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Approved for release formally',
            'coi_confirmed' => true,
            'override_peer_review' => true,
        ]);
        $decideOk->assertStatus(200);
        $this->assertEquals('approved', $submission->fresh()->status);

        // 4. Deciding again on already-decided submission returns 409 CONFLICT
        $conflictDecide = $this->postJson("/api/v1/editor/submissions/{$submission->id}/decision", [
            'decision' => 'reject',
            'decision_notes' => 'Overwriting existing decision',
            'coi_confirmed' => true,
            'override_peer_review' => true,
        ]);
        $conflictDecide->assertStatus(409);

        // 5. Release publication validates DOI format
        $invalidDoiRes = $this->postJson("/api/v1/editor/submissions/{$submission->id}/release", [
            'public_slug' => 'c30-invalid-doi',
            'doi' => 'not-a-valid-doi',
        ]);
        $invalidDoiRes->assertStatus(422);

        // 6. Release publication without DOI does NOT invent a fake Zenodo DOI
        $releaseRes = $this->postJson("/api/v1/editor/submissions/{$submission->id}/release", [
            'public_slug' => 'c30-valid-pub-' . Str::random(6),
            'editorial_notes' => 'Ready for public reading',
        ]);
        $releaseRes->assertStatus(201);
        $pub = Publication::where('submission_id', $submission->id)->first();
        $this->assertNotNull($pub);
        $this->assertNull($pub->doi);
    }

    public function test_c32_public_research_sanitization_and_citation()
    {
        $author = User::create([
            'email' => 'author_c32_' . Str::random(6) . '@example.org',
            'display_name' => 'Public Author',
            'password' => Hash::make('password'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $author->id,
            'title' => 'Public Project C32',
            'scope' => 'Public Research Scope',
        ]);

        $submission = Submission::create([
            'project_id' => $project->id,
            'submitted_by' => $author->id,
            'title' => 'C32 Test Submission',
            'abstract' => 'C32 Test Abstract',
            'version_number' => 1,
            'frozen_package' => [
                'project' => ['title' => 'Public Project C32'],
                'documents' => [['id' => 999, 'title' => 'Doc Title', 'content' => 'Doc text']],
                'findings' => [['id' => 888, 'claim' => 'Finding claim', 'reasoning' => 'Proof']],
            ],
            'status' => 'released',
            'package_checksum' => hash('sha256', 'c32_package'),
            'submitted_at' => now(),
        ]);

        $publication = Publication::create([
            'project_id' => $project->id,
            'submission_id' => $submission->id,
            'public_slug' => 'c32-test-slug-' . Str::random(6),
            'title' => 'Published Paper C32',
            'abstract' => 'An abstract for public research',
            'version_string' => 'v1.0.0',
            'published_content' => $submission->frozen_package,
            'released_by' => $author->id,
            'status' => 'published',
            'published_at' => now(),
        ]);

        // 1. GET /api/v1/public/research/{slug} strips internal IDs on project and owner
        $res = $this->getJson("/api/v1/public/research/{$publication->public_slug}");
        $res->assertStatus(200);
        $data = $res->json('data');

        $this->assertArrayNotHasKey('id', $data['project'] ?? []);
        $this->assertArrayNotHasKey('id', $data['project']['owner'] ?? []);
        $this->assertArrayNotHasKey('releaser', $data);

        // 2. Citation export supports ?format=ris and ?format=apa
        $risRes = $this->getJson("/api/v1/public/research/{$publication->public_slug}/cite?format=ris");
        $risRes->assertStatus(200);
        $this->assertStringContainsString('TY  - JOUR', $risRes->json('data.citation'));

        $apaRes = $this->getJson("/api/v1/public/research/{$publication->public_slug}/cite?format=apa");
        $apaRes->assertStatus(200);
        $this->assertStringContainsString('Published Paper C32', $apaRes->json('data.citation'));
        $this->assertStringNotContainsString('10.5281/openhadith', $apaRes->json('data.citation'));

        // 3. Public research listing with status=all works
        $allRes = $this->getJson('/api/v1/public/research?status=all');
        $allRes->assertStatus(200);
    }

    public function test_c33_matn_alignment_validation_and_saved_run_params()
    {
        $user = User::create([
            'email' => 'collate_user_' . Str::random(6) . '@example.org',
            'display_name' => 'Collate User',
            'password' => Hash::make('password'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Collate Project',
            'scope' => 'Collate Scope',
        ]);

        Sanctum::actingAs($user);

        // 1. Empty/whitespace baseline returns 422 EMPTY_BASELINE
        $resEmpty = $this->postJson("/api/v1/projects/{$project->id}/analyses/collate", [
            'baseline_text' => '    ',
            'variants' => [
                ['id' => 'v1', 'label' => 'Variant 1', 'text' => 'Sample text'],
            ],
        ]);
        $resEmpty->assertStatus(422);
        $this->assertEquals('EMPTY_BASELINE', $resEmpty->json('error.code'));

        // 2. Successful collation with saved run stores variant ids and labels in input_params
        $resValid = $this->postJson("/api/v1/projects/{$project->id}/analyses/collate", [
            'baseline_text' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى',
            'variants' => [
                ['id' => 'v1', 'label' => 'Variant 1', 'text' => 'الأعمال بالنية ولكل امرئ ما نوى'],
            ],
            'save_run' => true,
        ]);
        $resValid->assertStatus(200);
        $this->assertArrayHasKey('collation', $resValid->json('data'));
        $savedRun = $resValid->json('data.saved_run');
        $this->assertNotNull($savedRun);
        $this->assertContains('v1', $savedRun['input_params']['variant_ids']);
        $this->assertContains('Variant 1', $savedRun['input_params']['variant_labels']);
    }

    public function test_c34_isnad_topology_cycle_detection_and_rules()
    {
        $user = User::create([
            'email' => 'isnad_user_' . Str::random(6) . '@example.org',
            'display_name' => 'Isnad User',
            'password' => Hash::make('password'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Isnad Project',
            'scope' => 'Isnad Scope',
        ]);

        Sanctum::actingAs($user);

        // 1. Cycle detection in custom chains: repeated narrator returns 422 CHAIN_CYCLE_DETECTED
        $resCycle = $this->postJson("/api/v1/projects/{$project->id}/analyses/isnad-topology", [
            'custom_chains' => [
                ['Malik', 'Nafi', 'Malik'],
                ['Malik', 'Ibn Shihab', 'Salim'],
            ],
        ]);
        $resCycle->assertStatus(422);
        $this->assertEquals('CHAIN_CYCLE_DETECTED', $resCycle->json('error.code'));

        // 2. Valid chains topology returns chains array and does not claim formal_proof/verified_common_link
        $resValid = $this->postJson("/api/v1/projects/{$project->id}/analyses/isnad-topology", [
            'custom_chains' => [
                ['Sufyan', 'Amr', 'Ibn Umar'],
                ['Sufyan', 'Zuhri', 'Salim', 'Ibn Umar'],
            ],
        ]);
        $resValid->assertStatus(200);
        $topology = $resValid->json('data.topology');
        $this->assertNotNull($topology);
        $this->assertArrayHasKey('chains', $topology);
        $this->assertArrayNotHasKey('formal_proof', $topology);
    }

    public function test_c35_hadith_families_crud_and_validation()
    {
        $user = User::create([
            'email' => 'family_user_' . Str::random(6) . '@example.org',
            'display_name' => 'Family User',
            'password' => Hash::make('password'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Family Project',
            'scope' => 'Family Scope',
        ]);

        $resource = Resource::create([
            'project_id' => $project->id,
            'resource_type' => 'hadith',
            'title' => 'Sample Hadith Resource',
            'source_metadata' => ['hadith_id' => 1],
            'created_by' => $user->id,
        ]);

        $evidence = EvidenceItem::create([
            'project_id' => $project->id,
            'resource_id' => $resource->id,
            'captured_text' => 'Sample evidence for family member',
            'collector_id' => $user->id,
            'state' => 'included',
            'content_hash' => hash('sha256', 'Sample evidence for family member'),
        ]);

        Sanctum::actingAs($user);

        // 1. Create family cluster
        $resCreate = $this->postJson("/api/v1/projects/{$project->id}/families", [
            'canonical_title' => 'Hadith of Actions by Intentions',
            'root_companion' => 'Umar ibn al-Khattab',
            'core_theme' => 'Niyyah',
        ]);
        $resCreate->assertStatus(201);
        $familyId = $resCreate->json('data.id');
        $this->assertNotNull($familyId);
        // Creator should only have id and display_name
        $this->assertArrayNotHasKey('email', $resCreate->json('data.creator') ?? []);

        // 2. Add member with NO source returns 422
        $resNoSource = $this->postJson("/api/v1/projects/{$project->id}/families/{$familyId}/members", [
            'relationship_type' => 'mutabaah_tammah',
        ]);
        $resNoSource->assertStatus(422);

        // 3. Add member with non-existent corpus_hadith_id returns 422
        $resInvalidHadith = $this->postJson("/api/v1/projects/{$project->id}/families/{$familyId}/members", [
            'corpus_hadith_id' => 999999999,
            'relationship_type' => 'shahid',
        ]);
        $resInvalidHadith->assertStatus(422);

        // 4. Add member with valid evidence_id succeeds (201)
        $resAddMember = $this->postJson("/api/v1/projects/{$project->id}/families/{$familyId}/members", [
            'evidence_id' => $evidence->id,
            'relationship_type' => 'mutabaah_tammah',
            'scholarly_notes' => 'Complete parallel transmission',
        ]);
        $resAddMember->assertStatus(201);
        $memberId = $resAddMember->json('data.id');

        // 5. Duplicate member in same family returns 422
        $resDuplicate = $this->postJson("/api/v1/projects/{$project->id}/families/{$familyId}/members", [
            'evidence_id' => $evidence->id,
            'relationship_type' => 'mutabaah_tammah',
        ]);
        $resDuplicate->assertStatus(422);
        $this->assertEquals('DUPLICATE_FAMILY_MEMBER', $resDuplicate->json('error.code'));

        // 6. Update family title (PATCH)
        $resUpdate = $this->patchJson("/api/v1/projects/{$project->id}/families/{$familyId}", [
            'canonical_title' => 'Hadith of Actions and Intentions (Revised)',
        ]);
        $resUpdate->assertStatus(200);
        $this->assertEquals('Hadith of Actions and Intentions (Revised)', $resUpdate->json('data.canonical_title'));

        // 7. Remove member
        $resRemoveMember = $this->deleteJson("/api/v1/projects/{$project->id}/families/{$familyId}/members/{$memberId}");
        $resRemoveMember->assertStatus(200);

        // 8. Delete family (DELETE)
        $resDelete = $this->deleteJson("/api/v1/projects/{$project->id}/families/{$familyId}");
        $resDelete->assertStatus(200);
        $this->assertNull(HadithFamily::find($familyId));
    }
}
