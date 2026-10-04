<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Submission;
use App\Models\Publication;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class EditorialApiTest extends TestCase
{
    private function createUser(string $name = 'Scholar', bool $isAdmin = false, string $status = 'approved'): User
    {
        return User::create([
            'display_name' => $name,
            'email' => 'user_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => $status,
            'is_admin' => $isAdmin,
        ]);
    }

    public function test_editorial_review_queue_and_peer_reviewed_publishing_lifecycle(): void
    {
        $author = $this->createUser('Dr. Polla (Author)');
        $editor = $this->createUser('Chief Editor', true);
        $reviewer = $this->createUser('Dr. Peer Reviewer');
        $randomScholar = $this->createUser('Random Scholar');

        // 1. Author creates project and submits for peer review
        Sanctum::actingAs($author);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'The Niyyah Tradition: Critical Textual and Isnād Analysis',
            'question' => 'How did the early transmission variants of Innamal A\'malu Bin-Niyyat propagate across Hijaz and Iraq?',
            'scope' => 'Comparative analysis of 14 early canonical and musnad transmission lines.',
        ]);
        $projectRes->assertStatus(201);
        $projectId = $projectRes->json('data.id');

        $submissionRes = $this->postJson("/api/v1/projects/{$projectId}/submissions", [
            'title' => 'Critical Monograph: The Niyyah Tradition',
            'abstract' => 'This study examines the textual variants and transmission lines of the Niyyah hadith across the 2nd century Hijazi and Iraqi networks.',
        ]);
        $submissionRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'submitted',
                    'version_number' => 1,
                ],
            ]);
        $submissionId = $submissionRes->json('data.id');

        // 2. Editor views Editorial Review Queue
        Sanctum::actingAs($editor);
        $queueRes = $this->getJson('/api/v1/editor/submissions');
        $queueRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
        $this->assertNotEmpty($queueRes->json('data'));

        // 3. Conflict of Interest check: Editor cannot assign author as their own reviewer
        $coiRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $author->id,
        ]);
        $coiRes->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error' => [
                    'code' => 'CONFLICT_OF_INTEREST',
                ],
            ]);

        // 4. Editor assigns valid non-conflicted peer reviewer
        $assignRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $reviewer->id,
        ]);
        $assignRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'submission_id' => $submissionId,
                    'reviewer_id' => $reviewer->id,
                ],
            ]);

        // Check submission transitioned to in_review
        $this->assertEquals('in_review', Submission::find($submissionId)->status);

        // Duplicate assignment rejected
        $dupRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/assign", [
            'reviewer_id' => $reviewer->id,
        ]);
        $dupRes->assertStatus(422)
            ->assertJson([
                'error' => [
                    'code' => 'ALREADY_ASSIGNED',
                ],
            ]);

        // 5. Unauthorized random scholar cannot submit review
        Sanctum::actingAs($randomScholar);
        $unauthReview = $this->postJson("/api/v1/editor/submissions/{$submissionId}/review", [
            'recommendation' => 'approve',
            'reviewer_notes' => 'Attempting unauthorized review.',
        ]);
        $unauthReview->assertStatus(403);

        // 6. Assigned reviewer submits evaluation
        Sanctum::actingAs($reviewer);
        $reviewRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/review", [
            'recommendation' => 'approve',
            'reviewer_notes' => 'Rigorous methodology with complete Madar identification and exhaustive textual collation.',
        ]);
        $reviewRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'recommendation' => 'approve',
                ],
            ]);

        // 7. Editor issues formal Editorial Decision (Approve)
        Sanctum::actingAs($editor);
        $decisionRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/decision", [
            'decision' => 'approve',
            'decision_notes' => 'Accepted for publication based on peer reviewer consensus and editorial validation.',
        ]);
        $decisionRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'submission_status' => 'approved',
                    'decision' => [
                        'decision' => 'approve',
                    ],
                ],
            ]);

        $this->assertEquals('approved', Submission::find($submissionId)->status);

        // 8. Editor releases approved package to Public Domain
        $slug = 'niyyah-critical-monograph-' . uniqid();
        $releaseRes = $this->postJson("/api/v1/editor/submissions/{$submissionId}/release", [
            'public_slug' => $slug,
            'version_string' => '1.0.0',
        ]);
        $releaseRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'public_slug' => $slug,
                    'version_string' => '1.0.0',
                    'status' => 'published',
                ],
            ]);

        $publicationId = $releaseRes->json('data.id');

        // 9. Public Research Portal (Unauthenticated access)
        // Reset actor to guest
        $this->app['auth']->forgetGuards();

        $publicListRes = $this->getJson('/api/v1/public/research');
        $publicListRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
        $this->assertNotEmpty($publicListRes->json('data'));

        $publicDetailRes = $this->getJson("/api/v1/public/research/{$slug}");
        $publicDetailRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $publicationId,
                    'public_slug' => $slug,
                    'title' => 'Critical Monograph: The Niyyah Tradition',
                    'status' => 'published',
                ],
            ]);

        $publicData = $publicDetailRes->json('data');
        $this->assertNotEmpty($publicData['published_content']);
        $this->assertEquals($author->display_name, $publicData['project']['owner']['display_name']);
    }
}
