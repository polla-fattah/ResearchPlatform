<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\ProjectMembership;
use App\Models\ResearchProject;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAndEdgeCasesTest extends TestCase
{
    protected User $scholarA;
    protected User $scholarB;
    protected ResearchProject $projectA;

    protected function setUp(): void
    {
        parent::setUp();

        $uid = uniqid();
        $this->scholarA = User::create([
            'display_name' => "Scholar A {$uid}",
            'email' => "scholar_a_{$uid}@hadith.local",
            'password' => bcrypt('password123'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->scholarB = User::create([
            'display_name' => "Scholar B {$uid}",
            'email' => "scholar_b_{$uid}@hadith.local",
            'password' => bcrypt('password123'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->projectA = ResearchProject::create([
            'title' => "Confidential Research Project A {$uid}",
            'owner_id' => $this->scholarA->id,
            'question' => 'Private empirical study.',
            'scope' => 'Private scope',
            'stage' => 'collecting',
            'is_deleted' => false,
        ]);

        ProjectMembership::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->scholarA->id,
            'role' => 'owner',
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);
    }

    public function test_unauthenticated_request_is_rejected_with_401(): void
    {
        $response = $this->getJson("/api/v1/projects/{$this->projectA->id}/findings");
        $response->assertStatus(401);
    }

    public function test_unauthorized_user_cannot_access_another_researchers_private_project(): void
    {
        // Scholar B attempts to access Scholar A's project evidence
        $response = $this->actingAs($this->scholarB)
            ->getJson("/api/v1/projects/{$this->projectA->id}/evidence");

        $response->assertStatus(403);
    }

    public function test_unauthorized_user_cannot_add_members_to_project(): void
    {
        $uid = uniqid();
        $outsider = User::create([
            'display_name' => "Outsider {$uid}",
            'email' => "outsider_{$uid}@hadith.local",
            'password' => bcrypt('password123'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $response = $this->actingAs($this->scholarB)
            ->postJson("/api/v1/projects/{$this->projectA->id}/invitations", [
                'invitee_email' => $outsider->email,
                'role' => 'contributor',
            ]);

        $response->assertStatus(403);
    }

    public function test_author_cannot_triage_or_approve_own_submission_due_to_conflict_of_interest(): void
    {
        // Give Scholar A editorial permissions platform-wide
        $this->scholarA->update(['is_admin' => true]);

        $submission = Submission::create([
            'project_id' => $this->projectA->id,
            'submitted_by' => $this->scholarA->id,
            'title' => 'Self Submission Monograph',
            'abstract' => 'Trying to self approve.',
            'status' => 'submitted',
            'version_number' => 1,
            'frozen_package' => json_encode(['title' => 'Self Submission Monograph']),
            'package_checksum' => hash('sha256', 'Self Submission Monograph'),
            'created_at' => now(),
        ]);

        // Scholar A attempts to make editorial decision on own submission
        $response = $this->actingAs($this->scholarA)
            ->postJson("/api/v1/editor/submissions/{$submission->id}/decision", [
                'decision' => 'approved',
                'editorial_notes' => 'Self approving my own work.',
            ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'CONFLICT_OF_INTEREST');
    }

    public function test_document_lock_expires_after_15_minutes_and_can_be_reacquired(): void
    {
        $doc = Document::create([
            'project_id' => $this->projectA->id,
            'title' => 'Shared Manuscript',
            'current_version' => 1,
            'locked_by' => $this->scholarA->id,
            'locked_at' => now()->subMinutes(20), // Expired lock (> 15 mins)
        ]);

        // Add scholar B as collaborator
        ProjectMembership::create([
            'project_id' => $this->projectA->id,
            'user_id' => $this->scholarB->id,
            'role' => 'contributor',
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        // Scholar B attempts to acquire expired lock
        $response = $this->actingAs($this->scholarB)
            ->postJson("/api/v1/projects/{$this->projectA->id}/documents/{$doc->id}/lock");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.locked_by', $this->scholarB->id);

        $doc->refresh();
        $this->assertEquals($this->scholarB->id, $doc->locked_by);
    }

    public function test_invalid_bibtex_syntax_returns_clean_result_with_zero_parsed(): void
    {
        $response = $this->actingAs($this->scholarA)
            ->postJson("/api/v1/projects/{$this->projectA->id}/references/preview-bibtex", [
                'bibtex' => 'This is plain random text with no BibTeX or RIS entries at all.',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_parsed', 0);
    }

    public function test_toggle_nonexistent_search_subscription_returns_404(): void
    {
        $response = $this->actingAs($this->scholarA)
            ->patchJson("/api/v1/projects/{$this->projectA->id}/search-subscriptions/999999/toggle");

        $response->assertStatus(404);
    }
}
