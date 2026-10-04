<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Resource;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class EvidenceApiTest extends TestCase
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

    public function test_evidence_workflow_and_annotations(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('Outsider');

        // Create resource
        $resource = Resource::create([
            'resource_type' => 'corpus_hadith',
            'corpus_table' => 'hadiths',
            'corpus_id' => 202,
            'title' => 'Hadith of the Seven Under the Shade of Allah',
            'author' => 'Al-Bukhari',
        ]);

        // Create project (as Owner)
        Sanctum::actingAs($owner);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'Study on Mutaba\'at of Shaded Believers',
            'question' => 'How consistent are the narrations regarding the seven shaded groups?',
        ]);
        $projectId = $projectRes->json('data.id');

        // 1. Attach resource to project
        $attachRes = $this->postJson("/api/v1/projects/{$projectId}/resources", [
            'resource_id' => $resource->id,
            'inclusion_rationale' => 'Core canonical reference for comparative analysis',
            'tags' => ['hadith_mutabaah', 'bukhari'],
        ]);
        $attachRes->assertStatus(201)
            ->assertJson(['success' => true]);

        // 2. List project resources
        $listResRes = $this->getJson("/api/v1/projects/{$projectId}/resources");
        $listResRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'title']
                ]
            ]);

        // 3. Create Evidence Item
        $evidenceRes = $this->postJson("/api/v1/projects/{$projectId}/evidence", [
            'resource_id' => $resource->id,
            'captured_text' => 'سبعة يظلهم الله في ظله يوم لا ظل إلا ظله إمام عادل',
            'locator' => 'Sahih al-Bukhari, Hadith #660, Vol 1, p. 133',
            'state' => 'included',
        ]);

        $evidenceRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'project_id' => $projectId,
                    'resource_id' => $resource->id,
                    'state' => 'included',
                    'locator' => 'Sahih al-Bukhari, Hadith #660, Vol 1, p. 133',
                ],
            ]);

        $evidenceId = $evidenceRes->json('data.id');
        $this->assertNotEmpty($evidenceRes->json('data.content_hash'));

        // 4. List evidence items
        $listEvRes = $this->getJson("/api/v1/projects/{$projectId}/evidence?state=included");
        $listEvRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'captured_text', 'state', 'resource', 'collector']
                ]
            ]);

        // 5. Add annotation to evidence item
        $annoRes = $this->postJson("/api/v1/projects/{$projectId}/evidence/{$evidenceId}/annotations", [
            'annotation_kind' => 'scholarly_judgment',
            'body' => 'Notice the emphasis placed on the just leader (imam adil) as the first category.',
            'visibility' => 'project_shared',
        ]);

        $annoRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'annotation_kind' => 'scholarly_judgment',
                ],
            ]);

        // 6. View evidence details with annotation
        $showEvRes = $this->getJson("/api/v1/projects/{$projectId}/evidence/{$evidenceId}");
        $showEvRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $evidenceId,
                ],
            ])
            ->assertJsonStructure([
                'data' => ['id', 'annotations']
            ]);

        // 7. Outsider cannot access project evidence
        Sanctum::actingAs($outsider);
        $outsiderRes = $this->getJson("/api/v1/projects/{$projectId}/evidence");
        $outsiderRes->assertStatus(403);

        // 8. Update evidence state (as Owner)
        Sanctum::actingAs($owner);
        $updateEvRes = $this->patchJson("/api/v1/projects/{$projectId}/evidence/{$evidenceId}", [
            'state' => 'reviewed',
        ]);
        $updateEvRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => ['state' => 'reviewed'],
            ]);

        // 9. Delete evidence item
        $delEvRes = $this->deleteJson("/api/v1/projects/{$projectId}/evidence/{$evidenceId}");
        $delEvRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // 10. Detach resource from project
        $detachRes = $this->deleteJson("/api/v1/projects/{$projectId}/resources/{$resource->id}");
        $detachRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
