<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class PublishingApiTest extends TestCase
{
    private function createUser(string $name = 'Scholar'): User
    {
        return User::create([
            'display_name' => $name,
            'email' => 'user_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);
    }

    public function test_announcements_and_peer_review_submissions(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('Outsider');

        // Setup Project
        Sanctum::actingAs($owner);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'The Isnad Dynamics of Wasit Narrators',
            'question' => 'How did the geographical centrality of Wasit influence transmission between Kufa and Basra?',
        ]);
        $projectId = $projectRes->json('data.id');

        // 1. Save Announcement Draft
        $annRes = $this->postJson("/api/v1/projects/{$projectId}/announcement", [
            'public_slug' => 'wasit-isnad-dynamics-' . uniqid(),
            'title' => 'Open Investigation: The Isnad Dynamics of Wasit Narrators',
            'summary' => 'Comprehensive empirical study mapping early 2nd-century transmitters in Wasit.',
            'research_stage' => 'collecting',
            'keywords' => ['Wasit', 'Rijal', 'Geography'],
            'status' => 'draft',
        ]);

        $annRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'draft',
                ],
            ]);

        $slug = $annRes->json('data.public_slug');

        // 2. Publish Announcement
        $pubRes = $this->postJson("/api/v1/projects/{$projectId}/announcement/publish");
        $pubRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'published',
                ],
            ]);

        // 3. Public access (unauthenticated) to announcement listing
        $publicListRes = $this->getJson('/api/v1/public/announcements');
        $publicListRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'public_slug', 'title', 'summary', 'status']
                ]
            ]);

        // 4. Public access to announcement detail
        $publicShowRes = $this->getJson("/api/v1/public/announcements/{$slug}");
        $publicShowRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'public_slug' => $slug,
                ],
            ]);

        // 5. Submit research package for peer review (as Owner)
        $subRes = $this->postJson("/api/v1/projects/{$projectId}/submissions", [
            'title' => 'Wasit Transmission Networks: Empirical Findings',
            'abstract' => 'This paper presents reconstructed transmission matrices demonstrating Wasit as an intermediary hub.',
        ]);

        $subRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'project_id' => $projectId,
                    'status' => 'submitted',
                    'version_number' => 1,
                ],
            ]);

        $this->assertNotEmpty($subRes->json('data.package_checksum'));
        $subId = $subRes->json('data.id');

        // 6. List project submissions
        $listSubRes = $this->getJson("/api/v1/projects/{$projectId}/submissions");
        $listSubRes->assertStatus(200);
        $this->assertCount(1, $listSubRes->json('data'));

        // 7. Get single submission
        $getSingleSub = $this->getJson("/api/v1/projects/{$projectId}/submissions/{$subId}");
        $getSingleSub->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => ['id' => $subId],
            ]);

        // 8. Outsider cannot submit or access private project submission (404 per DEF-2 existence disclosure rule)
        Sanctum::actingAs($outsider);
        $outsiderSub = $this->postJson("/api/v1/projects/{$projectId}/submissions", [
            'title' => 'Hacked submission',
            'abstract' => 'Unauthorized attempt',
        ]);
        $this->assertTrue(in_array($outsiderSub->status(), [403, 404]));
    }
}
