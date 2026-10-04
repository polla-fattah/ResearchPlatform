<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class ProjectApiTest extends TestCase
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

    public function test_full_project_lifecycle_and_collaboration(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $colleague = $this->createUser('Dr. Colleague');
        $outsider = $this->createUser('Outsider');

        // 1. Create Project (as Owner)
        Sanctum::actingAs($owner);
        $createRes = $this->postJson('/api/v1/projects', [
            'title' => 'Temporal Analysis of Kufan Narrators',
            'question' => 'How did the transmission chains evolve across generations in Kufa?',
            'scope' => 'First three Islamic centuries',
            'stage' => 'scoping',
        ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'owner_id' => $owner->id,
                    'title' => 'Temporal Analysis of Kufan Narrators',
                    'stage' => 'scoping',
                ],
            ]);

        $projectId = $createRes->json('data.id');

        // 2. List projects (owner sees it)
        $listRes = $this->getJson('/api/v1/projects');
        $listRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'title', 'stage', 'owner']
                ]
            ]);

        // 3. Outsider cannot view project
        Sanctum::actingAs($outsider);
        $outsiderRes = $this->getJson("/api/v1/projects/{$projectId}");
        $outsiderRes->assertStatus(403);

        // 4. Update project details (as Owner)
        Sanctum::actingAs($owner);
        $updateRes = $this->patchJson("/api/v1/projects/{$projectId}", [
            'scope' => 'First four Islamic centuries (updated)',
        ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'scope' => 'First four Islamic centuries (updated)',
                ],
            ]);

        // 5. Transition Stage to collecting
        $stageRes = $this->patchJson("/api/v1/projects/{$projectId}/stage", [
            'stage' => 'collecting',
            'rationale' => 'Literature review complete, beginning isnad extraction.',
        ]);

        $stageRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'stage' => 'collecting',
                ],
            ]);

        // 6. Add Colleague as Researcher
        $addMemberRes = $this->postJson("/api/v1/projects/{$projectId}/members", [
            'user_id' => $colleague->id,
            'role' => 'researcher',
        ]);

        $addMemberRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user_id' => $colleague->id,
                    'role' => 'researcher',
                ],
            ]);

        // 7. Colleague can now view project
        Sanctum::actingAs($colleague);
        $colleagueViewRes = $this->getJson("/api/v1/projects/{$projectId}");
        $colleagueViewRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $projectId,
                ],
            ]);

        // 8. Update colleague role to reviewer (as Owner)
        Sanctum::actingAs($owner);
        $updateRoleRes = $this->patchJson("/api/v1/projects/{$projectId}/members/{$colleague->id}", [
            'role' => 'reviewer',
        ]);

        $updateRoleRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'role' => 'reviewer',
                ],
            ]);

        // 9. Archive project
        $archiveRes = $this->postJson("/api/v1/projects/{$projectId}/archive");
        $archiveRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'is_archived' => true,
                ],
            ]);

        // 10. Delete project (soft delete with 30-day window)
        $delRes = $this->deleteJson("/api/v1/projects/{$projectId}");
        $delRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
