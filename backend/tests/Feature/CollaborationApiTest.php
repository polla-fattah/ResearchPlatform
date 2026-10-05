<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\ProjectMembership;
use App\Models\ProjectInvitation;
use App\Models\DiscussionThread;
use App\Models\Comment;
use App\Models\Task;
use App\Models\Document;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\ProjectActivity;
use Laravel\Sanctum\Sanctum;

class CollaborationApiTest extends TestCase
{
    protected User $owner;
    protected User $colleague;
    protected User $outsider;
    protected ResearchProject $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::firstOrCreate(
            ['email' => 'polla@hadith.ac.krd'],
            ['display_name' => 'Dr. Polla Fattah', 'password' => 'Password123!', 'status' => 'approved', 'is_admin' => true]
        );

        $this->colleague = User::firstOrCreate(
            ['email' => 'colleague@hadith.ac.krd'],
            ['display_name' => 'Dr. Zaid Al-Iraqi', 'password' => 'Password123!', 'status' => 'approved']
        );

        $this->outsider = User::firstOrCreate(
            ['email' => 'outsider@hadith.ac.krd'],
            ['display_name' => 'Outsider User', 'password' => 'Password123!', 'status' => 'approved']
        );

        $this->project = ResearchProject::firstOrCreate(
            ['owner_id' => $this->owner->id, 'title' => 'Niyyah Hadith Collaboration Test'],
            ['question' => 'How did the Niyyah transmission branch in 2nd century?', 'stage' => 'collecting']
        );

        // Ensure clean test fixture state
        ProjectMembership::where('project_id', $this->project->id)->where('user_id', $this->colleague->id)->delete();
        ProjectInvitation::where('project_id', $this->project->id)->delete();
        Notification::where('user_id', $this->colleague->id)->delete();
    }

    public function test_col_01_invitation_lifecycle(): void
    {
        Sanctum::actingAs($this->owner);

        // 1. Send invitation
        $res = $this->postJson("/api/v1/projects/{$this->project->id}/invitations", [
            'email' => $this->colleague->email,
            'role' => 'researcher',
            'expires_days' => 7,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'researcher')
            ->assertJsonPath('data.status', 'pending');

        $token = $res->json('data.token');
        $this->assertNotEmpty($token);

        // 2. List invitations
        $listRes = $this->getJson("/api/v1/projects/{$this->project->id}/invitations");
        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 3. Colleague accepts invitation
        Sanctum::actingAs($this->colleague);
        $acceptRes = $this->postJson("/api/v1/invitations/{$token}/accept");
        $acceptRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'accepted')
            ->assertJsonPath('data.role', 'researcher');

        // Verify membership created
        $this->assertDatabaseHas('project_memberships', [
            'project_id' => $this->project->id,
            'user_id' => $this->colleague->id,
            'role' => 'researcher',
            'status' => 'accepted',
        ]);

        // Verify invitation marked accepted
        $this->assertDatabaseHas('project_invitations', [
            'token' => $token,
            'status' => 'accepted',
        ]);
    }

    public function test_col_02_member_role_update_and_revocation(): void
    {
        // Add colleague as researcher first
        ProjectMembership::updateOrCreate(
            ['project_id' => $this->project->id, 'user_id' => $this->colleague->id],
            ['role' => 'researcher', 'status' => 'accepted']
        );

        Sanctum::actingAs($this->owner);

        // 1. Update role to reviewer
        $res = $this->putJson("/api/v1/projects/{$this->project->id}/members/{$this->colleague->id}", [
            'role' => 'reviewer',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'reviewer');

        // 2. Revoke membership
        $delRes = $this->deleteJson("/api/v1/projects/{$this->project->id}/members/{$this->colleague->id}");
        $delRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('project_memberships', [
            'project_id' => $this->project->id,
            'user_id' => $this->colleague->id,
            'status' => 'revoked',
        ]);
    }

    public function test_col_03_and_07_discussions_and_dispute_resolution(): void
    {
        Sanctum::actingAs($this->owner);

        // 1. Create a dispute review thread
        $res = $this->postJson("/api/v1/projects/{$this->project->id}/discussions", [
            'title' => 'Dispute on Yahya ibn Sa\'id Madar attribution',
            'thread_type' => 'dispute_review',
            'target_type' => 'project',
            'target_id' => $this->project->id,
            'context_quote' => 'Yahya ibn Sa\'id transmits from Muhammad ibn Ibrahim',
            'context_locator' => 'Sahih al-Bukhari #1',
            'initial_comment' => 'Is there any secondary Basran path bypassing Yahya?',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.thread_type', 'dispute_review');

        $threadId = $res->json('data.id');

        // 2. Add comment
        $commentRes = $this->postJson("/api/v1/discussions/{$threadId}/comments", [
            'content' => 'All classical routes converge upon Yahya; no sound mutaba\'ah bypasses him.',
        ]);
        $commentRes->assertStatus(201)
            ->assertJsonPath('success', true);

        // 3. Resolve dispute thread with scholarly rationale
        $resolveRes = $this->postJson("/api/v1/discussions/{$threadId}/resolve", [
            'resolution_notes' => 'Consensus reached: Yahya is the unquestioned Madar al-Isnad.',
            'alternative_interpretation' => 'Minor anomalous claims in al-Daraqutni classified as shadh.',
        ]);

        $resolveRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.is_resolved', true)
            ->assertJsonPath('data.resolution_notes', 'Consensus reached: Yahya is the unquestioned Madar al-Isnad.');
    }

    public function test_col_04_task_management_lifecycle(): void
    {
        Sanctum::actingAs($this->owner);

        // 1. Create task
        $res = $this->postJson("/api/v1/projects/{$this->project->id}/tasks", [
            'title' => 'Collate Kufan variant narrations',
            'description' => 'Compare Sufyan al-Thawri chain in Sunan Abi Dawud #2201',
            'assignee_id' => $this->colleague->id,
            'due_date' => now()->addDays(5)->toDateString(),
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'open');

        $taskId = $res->json('data.id');

        // 2. Block task
        $blockRes = $this->postJson("/api/v1/projects/{$this->project->id}/tasks/{$taskId}/block", [
            'blocking_reason' => 'Waiting for manuscript manuscript scan from library',
        ]);
        $blockRes->assertStatus(200)
            ->assertJsonPath('data.status', 'blocked')
            ->assertJsonPath('data.blocking_reason', 'Waiting for manuscript manuscript scan from library');

        // 3. Complete task
        $compRes = $this->postJson("/api/v1/projects/{$this->project->id}/tasks/{$taskId}/complete");
        $compRes->assertStatus(200)
            ->assertJsonPath('data.status', 'done');
    }

    public function test_col_05_notification_center_and_preferences(): void
    {
        Sanctum::actingAs($this->colleague);

        // Create notification
        Notification::create([
            'user_id' => $this->colleague->id,
            'type' => 'mention',
            'title' => 'Mentioned in Discussion',
            'message' => 'Dr. Polla mentioned you in a discussion.',
            'is_read' => false,
        ]);

        // 1. List notifications
        $res = $this->getJson('/api/v1/notifications');
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.unread_count', 1);

        $notifId = $res->json('data.notifications.0.id');

        // 2. Mark as read
        $readRes = $this->patchJson("/api/v1/notifications/{$notifId}/read");
        $readRes->assertStatus(200)
            ->assertJsonPath('data.is_read', true);

        // 3. Update preferences
        $prefRes = $this->putJson('/api/v1/notifications/preferences', [
            'notify_mentions' => true,
            'notify_exports' => false,
            'email_digest' => 'weekly',
        ]);

        $prefRes->assertStatus(200)
            ->assertJsonPath('data.notify_exports', false)
            ->assertJsonPath('data.email_digest', 'weekly');
    }

    public function test_col_06_document_concurrency_locking(): void
    {
        $doc = Document::firstOrCreate(
            ['project_id' => $this->project->id, 'title' => 'Draft Monograph'],
            ['document_type' => 'article', 'language' => 'ar']
        );
        $doc->update(['locked_by' => null, 'locked_at' => null]);

        Sanctum::actingAs($this->owner);

        // 1. Acquire lock
        $res = $this->postJson("/api/v1/projects/{$this->project->id}/documents/{$doc->id}/lock");
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.locked_by', $this->owner->id);

        // 2. Colleague tries to acquire same lock -> 423 Locked
        ProjectMembership::updateOrCreate(
            ['project_id' => $this->project->id, 'user_id' => $this->colleague->id],
            ['role' => 'co_investigator', 'status' => 'accepted']
        );

        Sanctum::actingAs($this->colleague);
        $lockRes = $this->postJson("/api/v1/projects/{$this->project->id}/documents/{$doc->id}/lock");
        $lockRes->assertStatus(423);

        // 3. Owner releases lock
        Sanctum::actingAs($this->owner);
        $unlockRes = $this->postJson("/api/v1/projects/{$this->project->id}/documents/{$doc->id}/unlock");
        $unlockRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 4. Colleague can now acquire lock
        Sanctum::actingAs($this->colleague);
        $reLockRes = $this->postJson("/api/v1/projects/{$this->project->id}/documents/{$doc->id}/lock");
        $reLockRes->assertStatus(200)
            ->assertJsonPath('data.locked_by', $this->colleague->id);
    }

    public function test_col_08_project_activity_feed(): void
    {
        Sanctum::actingAs($this->owner);

        ProjectActivity::create([
            'project_id' => $this->project->id,
            'actor_id' => $this->owner->id,
            'action' => 'evidence_added',
            'object_type' => 'evidence',
            'object_id' => 1,
            'summary' => 'Added Sahih al-Bukhari #1 to evidence basket',
            'created_at' => now(),
        ]);

        $res = $this->getJson("/api/v1/projects/{$this->project->id}/activity");
        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => [['id', 'action', 'summary', 'created_at']]]);
    }
}
