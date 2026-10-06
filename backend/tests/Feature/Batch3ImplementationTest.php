<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\ProjectInvitation;
use App\Models\Resource;
use App\Models\EvidenceItem;
use App\Models\Annotation;
use App\Models\Document;
use App\Models\Finding;
use App\Models\SavedQuery;
use App\Models\SearchRun;
use App\Models\ExportJob;
use App\Models\AnalysisRun;
use App\Models\DiscussionThread;
use App\Models\Task;
use App\Models\Notification;
use App\Models\Announcement;
use App\Models\ProjectActivity;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

class Batch3ImplementationTest extends TestCase
{
    private function createProjectAndUser(string $prefix, string $role = 'researcher')
    {
        $user = User::create([
            'email' => "{$prefix}_" . Str::random(6) . '@example.org',
            'display_name' => "User {$prefix}",
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => "Project {$prefix}",
            'scope' => 'Testing scope',
        ]);

        return [$user, $project];
    }

    public function test_c15_search_workspace_scoping_and_deduplication()
    {
        [$user, $project1] = $this->createProjectAndUser('c15_p1');
        [$otherUser, $project2] = $this->createProjectAndUser('c15_p2');

        $query2 = SavedQuery::create([
            'owner_type' => 'project',
            'owner_id' => $project2->id,
            'name' => 'Query P2',
            'query_text' => 'hadith query',
            'search_mode' => 'normalized',
            'filter_criteria' => ['matn' => 'hadith'],
        ]);

        $run2 = SearchRun::create([
            'saved_query_id' => $query2->id,
            'corpus_version' => '1.0',
            'status' => 'running',
            'execution_stats' => ['hits' => 10],
            'executed_at' => now(),
        ]);

        Sanctum::actingAs($user);

        // Cancel search run on project1 using project2's run ID should return 404
        $cancelRes = $this->postJson("/api/v1/projects/{$project1->id}/search-runs/{$run2->id}/cancel");
        $cancelRes->assertStatus(404);

        // Deduplication on bulk evidence: (project_id, resource_id, content_hash)
        $resource = Resource::create([
            'resource_type' => 'book',
            'title' => 'Sahih Bukhari Vol 1',
        ]);

        $evidencePayload = [
            'items' => [
                [
                    'resource_id' => $resource->id,
                    'captured_text' => 'Unique hadith text fragment A',
                    'state' => 'flagged',
                ],
                [
                    'resource_id' => $resource->id,
                    'captured_text' => 'Unique hadith text fragment A', // Duplicate within same resource
                    'state' => 'flagged',
                ]
            ]
        ];

        $bulkRes = $this->postJson("/api/v1/projects/{$project1->id}/evidence/bulk", $evidencePayload);
        $bulkRes->assertStatus(201);
        $data = $bulkRes->json('data');
        $this->assertEquals(1, $data['added_count']);
        $this->assertEquals(1, $data['skipped_count']);
    }

    public function test_c16_evidence_inspector_and_annotations()
    {
        [$user, $project] = $this->createProjectAndUser('c16');
        Sanctum::actingAs($user);

        $resource = Resource::create([
            'resource_type' => 'book',
            'title' => 'Sunan Abi Dawud',
        ]);

        $evidence = EvidenceItem::create([
            'project_id' => $project->id,
            'resource_id' => $resource->id,
            'collector_id' => $user->id,
            'captured_text' => 'Evidence excerpt to test state transition',
            'content_hash' => hash('sha256', 'Evidence excerpt to test state transition'),
            'state' => 'flagged',
        ]);

        // Transition to excluded without state_reason should fail 422
        $failRes = $this->patchJson("/api/v1/projects/{$project->id}/evidence/{$evidence->id}", [
            'state' => 'excluded',
        ]);
        $failRes->assertStatus(422);
        $this->assertEquals('STATE_REASON_REQUIRED', $failRes->json('error.code'));

        // Transition with state_reason should succeed
        $succRes = $this->patchJson("/api/v1/projects/{$project->id}/evidence/{$evidence->id}", [
            'state' => 'excluded',
            'state_reason' => 'Duplicate narration from secondary chain',
        ]);
        $succRes->assertStatus(200);
        $this->assertEquals('excluded', $succRes->json('data.state'));
        $this->assertEquals('Duplicate narration from secondary chain', $succRes->json('data.state_reason'));

        // Check index sanitizes collector to id, display_name
        $indexRes = $this->getJson("/api/v1/projects/{$project->id}/evidence");
        $indexRes->assertStatus(200);
        $firstItem = $indexRes->json('data.0');
        $this->assertArrayHasKey('collector', $firstItem);
        $this->assertArrayNotHasKey('email', $firstItem['collector']);
        $this->assertEquals($user->display_name, $firstItem['collector']['display_name']);

        // Check annotation fillable
        $annotation = Annotation::create([
            'target_type' => 'evidence',
            'target_id' => $evidence->id,
            'author_id' => $user->id,
            'annotation_kind' => 'scholarly_judgment',
            'body' => 'Historical marginalia note',
            'attributed_to' => 'Ibn Hajar al-Asqalani',
            'source_locator' => 'Fath al-Bari, Vol 1, p. 45',
        ]);

        $this->assertEquals('Ibn Hajar al-Asqalani', $annotation->attributed_to);
        $this->assertEquals('Fath al-Bari, Vol 1, p. 45', $annotation->source_locator);
    }

    public function test_c17_export_handling()
    {
        [$user, $project] = $this->createProjectAndUser('c17');
        Sanctum::actingAs($user);

        // Cancel on completed job returns 409 CONFLICT
        $job = ExportJob::create([
            'requester_id' => $user->id,
            'scope' => 'project',
            'target_id' => $project->id,
            'format' => 'json',
            'status' => 'completed',
            'completed_at' => now(),
            'expires_at' => now()->subDay(), // Expired
        ]);

        $cancelRes = $this->postJson("/api/v1/exports/{$job->id}/cancel");
        $cancelRes->assertStatus(409);
        $this->assertEquals('CONFLICT', $cancelRes->json('error.code'));

        // Download expired part returns 410
        $downRes = $this->getJson("/api/v1/exports/{$job->id}/parts/1");
        $downRes->assertStatus(410);
        $this->assertEquals('EXPORT_EXPIRED', $downRes->json('error.code'));

        // Non-existent part returns 404
        $jobActive = ExportJob::create([
            'requester_id' => $user->id,
            'scope' => 'project',
            'target_id' => $project->id,
            'format' => 'json',
            'status' => 'completed',
            'completed_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
        $part404Res = $this->getJson("/api/v1/exports/{$jobActive->id}/parts/99");
        $part404Res->assertStatus(404);
    }

    public function test_c19_comparison_workspace_and_analyses()
    {
        [$user, $project] = $this->createProjectAndUser('c19');
        Sanctum::actingAs($user);

        // Create AnalysisRun
        $analysis = AnalysisRun::create([
            'project_id' => $project->id,
            'created_by' => $user->id,
            'analysis_type' => 'isnad_topology',
            'input_params' => ['root_id' => 1],
            'output_data' => ['common_link' => ['narrator_id' => 1]],
            'version_number' => 1,
            'created_at' => now(),
        ]);

        // Show sanitizes creator
        $showRes = $this->getJson("/api/v1/projects/{$project->id}/analyses/{$analysis->id}");
        $showRes->assertStatus(200);
        $this->assertArrayNotHasKey('email', $showRes->json('data.creator'));
        $this->assertEquals($user->display_name, $showRes->json('data.creator.display_name'));

        // Delete analysis
        $delRes = $this->deleteJson("/api/v1/projects/{$project->id}/analyses/{$analysis->id}");
        $delRes->assertStatus(200);
        $this->assertDatabaseMissing('analysis_runs', ['id' => $analysis->id]);
    }

    public function test_c21_c22_c23_collaboration_security_and_workflows()
    {
        [$owner, $project] = $this->createProjectAndUser('c21_owner');

        // Test C-21: password change revokes other tokens
        $token1 = $owner->createToken('Device 1');
        $token2 = $owner->createToken('Device 2');
        $this->assertGreaterThanOrEqual(2, $owner->tokens()->count());

        $changeRes = $this->withHeader('Authorization', 'Bearer ' . $token1->plainTextToken)
            ->postJson('/api/v1/auth/password/change', [
                'current_password' => 'password123',
                'password' => 'new_password_12345',
                'password_confirmation' => 'new_password_12345',
            ]);
        $changeRes->assertStatus(200);
        // Only token1 remains
        $this->assertEquals(1, $owner->tokens()->count());
        $this->assertEquals($token1->accessToken->id, $owner->tokens()->first()->id);

        // Test C-22: member status filtering & invitation resend conflict
        Sanctum::actingAs($owner);

        $memberUser = User::create([
            'email' => 'member_' . Str::random(6) . '@example.org',
            'display_name' => 'Collaborator User',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);

        $membership = ProjectMembership::create([
            'project_id' => $project->id,
            'user_id' => $memberUser->id,
            'role' => 'researcher',
            'status' => 'revoked',
        ]);

        // Default /members only returns accepted
        $membersRes = $this->getJson("/api/v1/projects/{$project->id}/members");
        $membersRes->assertStatus(200);
        $this->assertEmpty($membersRes->json('data'));

        // All status returns revoked too
        $allMembersRes = $this->getJson("/api/v1/projects/{$project->id}/members?status=all");
        $allMembersRes->assertStatus(200);
        $this->assertCount(1, $allMembersRes->json('data'));

        // Invitation resend returns 409 if already accepted
        $invitation = ProjectInvitation::create([
            'project_id' => $project->id,
            'invited_by' => $owner->id,
            'email' => 'invitee_' . Str::random(6) . '@example.org',
            'role' => 'reviewer',
            'token' => Str::random(64),
            'status' => 'accepted',
            'expires_at' => now()->addDays(7),
        ]);

        $resendRes = $this->postJson("/api/v1/projects/{$project->id}/invitations/{$invitation->id}/resend");
        $resendRes->assertStatus(409);
        $this->assertEquals('CONFLICT', $resendRes->json('error.code'));

        // Test C-23: Discussion Target Scoping Validation
        [$otherUser, $otherProject] = $this->createProjectAndUser('other_proj');
        $otherDoc = Document::create([
            'project_id' => $otherProject->id,
            'created_by' => $otherUser->id,
            'title' => 'Other Doc',
            'content' => 'Content',
            'current_version' => 1,
            'state' => 'draft',
        ]);

        $threadFail = $this->postJson("/api/v1/projects/{$project->id}/discussions", [
            'title' => 'Cross-project discussion attempt',
            'target_type' => 'document',
            'target_id' => $otherDoc->id,
            'initial_comment' => 'Should fail',
        ]);
        $threadFail->assertStatus(422);
        $this->assertEquals('INVALID_TARGET', $threadFail->json('error.code'));

        // Create valid thread and test reopen
        $thread = DiscussionThread::create([
            'project_id' => $project->id,
            'title' => 'Valid Thread',
            'target_type' => 'project',
            'target_id' => $project->id,
            'is_resolved' => true,
            'resolved_by' => $owner->id,
            'resolved_at' => now(),
            'resolution_notes' => 'Old resolution',
        ]);

        $reopenRes = $this->postJson("/api/v1/discussions/{$thread->id}/reopen");
        $reopenRes->assertStatus(200);
        $this->assertFalse($reopenRes->json('data.is_resolved'));
    }

    public function test_c24_notifications_filtering_and_project_id()
    {
        [$user, $project] = $this->createProjectAndUser('c24');
        Sanctum::actingAs($user);

        // Create read and unread notifications with project_id
        $notif1 = Notification::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'type' => 'assignment',
            'title' => 'Task assigned',
            'message' => 'You were assigned a task',
            'target_type' => 'project',
            'target_id' => $project->id,
            'is_read' => false,
            'created_at' => now(),
        ]);

        $notif2 = Notification::create([
            'user_id' => $user->id,
            'project_id' => null,
            'type' => 'system',
            'title' => 'System Maintenance',
            'message' => 'Platform maintenance scheduled',
            'target_type' => 'system',
            'target_id' => 0,
            'is_read' => true,
            'created_at' => now(),
        ]);

        // Filter is_read=false
        $unreadRes = $this->getJson('/api/v1/notifications?is_read=false');
        $unreadRes->assertStatus(200);
        $items = $unreadRes->json('data.notifications');
        $this->assertCount(1, $items);
        $this->assertEquals($notif1->id, $items[0]['id']);
        $this->assertEquals($project->id, $items[0]['project_id']);

        // Filter is_read=true
        $readRes = $this->getJson('/api/v1/notifications?is_read=true');
        $readRes->assertStatus(200);
        $itemsRead = $readRes->json('data.notifications');
        $this->assertCount(1, $itemsRead);
        $this->assertEquals($notif2->id, $itemsRead[0]['id']);

        // Filter project_id
        $projRes = $this->getJson("/api/v1/notifications?project_id={$project->id}");
        $projRes->assertStatus(200);
        $this->assertCount(1, $projRes->json('data.notifications'));
    }

    public function test_c25_c26_c27_activity_and_announcements()
    {
        [$user, $project] = $this->createProjectAndUser('c25_26_27');
        Sanctum::actingAs($user);

        // Test C-25: Activity invitation email masking
        $inviteRes = $this->postJson("/api/v1/projects/{$project->id}/invitations", [
            'email' => 'scholar_secret_contact@institution.edu',
            'role' => 'reviewer',
        ]);
        $inviteRes->assertStatus(201);

        $activity = ProjectActivity::where('project_id', $project->id)
            ->where('action', 'invitation_created')
            ->first();
        $this->assertNotNull($activity);
        $this->assertStringNotContainsString('scholar_secret_contact@institution.edu', $activity->summary);
        $this->assertStringContainsStringIgnoringCase('An invitation was sent to join as reviewer', $activity->summary);

        // Test C-26 & C-27: Announcement slug validation & public sanitization
        // Invalid slug should fail 422
        $invalidSlugRes = $this->postJson("/api/v1/projects/{$project->id}/announcement", [
            'title' => 'Hadith Methodology Paper',
            'public_slug' => 'INVALID SLUG WITH SPACES',
            'summary' => 'Methodology paper summary',
            'research_stage' => 'in_progress',
        ]);
        $invalidSlugRes->assertStatus(422);

        // Valid announcement creation
        $slug = 'valid-hadith-paper-' . strtolower(Str::random(5));
        $annRes = $this->postJson("/api/v1/projects/{$project->id}/announcement", [
            'title' => 'Hadith Methodology Paper',
            'public_slug' => $slug,
            'summary' => 'Methodology paper summary',
            'research_stage' => 'in_progress',
            'status' => 'published',
        ]);
        $annRes->assertStatus(200);

        // Public announcement route sanitizes internal project IDs
        $publicRes = $this->getJson("/api/v1/public/announcements/{$slug}");
        $publicRes->assertStatus(200);
        $pubData = $publicRes->json('data');
        $this->assertArrayNotHasKey('project_id', $pubData);
        $this->assertArrayNotHasKey('id', $pubData['project'] ?? []);
    }
}
