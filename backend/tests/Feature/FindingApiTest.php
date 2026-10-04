<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Resource;
use App\Models\EvidenceItem;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class FindingApiTest extends TestCase
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

    public function test_finding_and_evidence_synthesis_lifecycle(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('Outsider');

        // Setup Project & Resource
        Sanctum::actingAs($owner);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'Evaluation of Shurayh al-Qadi Narrations',
            'question' => 'Did Shurayh reliably narrate directly from Ali ibn Abi Talib?',
        ]);
        $projectId = $projectRes->json('data.id');

        $resource = Resource::create([
            'resource_type' => 'corpus_hadith',
            'title' => 'Judgments of Shurayh',
        ]);

        $ev1 = EvidenceItem::create([
            'project_id' => $projectId,
            'resource_id' => $resource->id,
            'captured_text' => 'قضى علي وشريح حاضر وأقره على ذلك',
            'locator' => 'Musannaf Ibn Abi Shaybah #1820',
            'content_hash' => hash('sha256', 'قضى علي وشريح حاضر وأقره على ذلك'),
            'state' => 'included',
            'collector_id' => $owner->id,
        ]);

        $ev2 = EvidenceItem::create([
            'project_id' => $projectId,
            'resource_id' => $resource->id,
            'captured_text' => 'لم يسمع شريح من علي إلا في موضع واحد',
            'locator' => 'Al-Jarh wa al-Ta\'dil Vol 4, p. 332',
            'content_hash' => hash('sha256', 'لم يسمع شريح من علي إلا في موضع واحد'),
            'state' => 'included',
            'collector_id' => $owner->id,
        ]);

        // 1. Create Finding with linked evidence
        $createFindingRes = $this->postJson("/api/v1/projects/{$projectId}/findings", [
            'question' => 'Direct hearing of Shurayh from Ali',
            'claim' => 'Shurayh had direct contact and heard from Ali in specific judicial sittings.',
            'reasoning' => 'Multiple corroborating early reports confirm his judicial appointment and presence in Kufa.',
            'status' => 'supported',
            'evidence_links' => [
                [
                    'evidence_id' => $ev1->id,
                    'relation_type' => 'supporting',
                    'interpretation' => 'Direct witness testimony of Shurayh in the presence of Ali.',
                ]
            ],
        ]);

        $createFindingRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'project_id' => $projectId,
                    'status' => 'supported',
                ],
            ]);

        $findingId = $createFindingRes->json('data.id');

        // 2. List findings
        $listRes = $this->getJson("/api/v1/projects/{$projectId}/findings");
        $listRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'question', 'claim', 'status', 'evidence_items']
                ]
            ]);

        // 3. Link additional evidence (opposing view)
        $linkRes = $this->postJson("/api/v1/projects/{$projectId}/findings/{$findingId}/evidence", [
            'evidence_id' => $ev2->id,
            'relation_type' => 'opposing',
            'interpretation' => 'Scholarly critique questioning frequency of hearing.',
        ]);

        $linkRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // 4. View single finding
        $showRes = $this->getJson("/api/v1/projects/{$projectId}/findings/{$findingId}");
        $showRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $findingId,
                ],
            ]);
        $this->assertCount(2, $showRes->json('data.evidence_items'));

        // 5. Outsider cannot view finding
        Sanctum::actingAs($outsider);
        $outsiderRes = $this->getJson("/api/v1/projects/{$projectId}/findings/{$findingId}");
        $outsiderRes->assertStatus(403);

        // 6. Update finding (as Owner)
        Sanctum::actingAs($owner);
        $updateRes = $this->patchJson("/api/v1/projects/{$projectId}/findings/{$findingId}", [
            'status' => 'disputed',
            'limitations' => 'Further verification needed from Kufan local isnads.',
        ]);
        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'disputed',
                ],
            ]);

        // 7. Unlink evidence
        $unlinkRes = $this->deleteJson("/api/v1/projects/{$projectId}/findings/{$findingId}/evidence/{$ev2->id}");
        $unlinkRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // 8. Delete finding
        $delRes = $this->deleteJson("/api/v1/projects/{$projectId}/findings/{$findingId}");
        $delRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
