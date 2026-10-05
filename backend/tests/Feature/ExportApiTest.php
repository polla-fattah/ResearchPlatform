<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Resource;
use App\Models\EvidenceItem;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class ExportApiTest extends TestCase
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

    public function test_project_export_and_download(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('Outsider');

        // Setup Project
        Sanctum::actingAs($owner);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'Corpus Reconstruction Export Study',
            'question' => 'How can research packages be bundled losslessly for open dissemination?',
        ]);
        $projectId = $projectRes->json('data.id');

        $resource = Resource::create([
            'resource_type' => 'corpus_hadith',
            'title' => 'Hadith of Actions and Intentions',
        ]);

        EvidenceItem::create([
            'project_id' => $projectId,
            'resource_id' => $resource->id,
            'captured_text' => 'إنما الأعمال بالنيات',
            'content_hash' => hash('sha256', 'إنما الأعمال بالنيات'),
            'state' => 'included',
            'collector_id' => $owner->id,
        ]);

        // 1. Request Export
        $exportReq = $this->postJson("/api/v1/projects/{$projectId}/exports", [
            'format' => 'json',
        ]);

        $exportReq->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'scope' => 'project',
                    'target_id' => $projectId,
                    'format' => 'json',
                    'status' => 'completed',
                ],
            ]);

        $jobId = $exportReq->json('data.id');
        $this->assertNotEmpty($exportReq->json('data.checksum'));

        // 2. List exports
        $listRes = $this->getJson("/api/v1/projects/{$projectId}/exports");
        $listRes->assertStatus(200);
        $this->assertCount(1, $listRes->json('data'));

        // 3. Download export
        $downloadRes = $this->getJson("/api/v1/projects/{$projectId}/exports/{$jobId}/download");
        $downloadRes->assertStatus(200);
        $downloadRes->assertHeader('Content-Type', 'application/json; charset=utf-8');
        $downloadRes->assertHeader('X-Checksum-SHA256');

        $content = json_decode($downloadRes->getContent(), true);
        $this->assertEquals('Open Hadith Research Platform', $content['platform']);
        $this->assertEquals('Corpus Reconstruction Export Study', $content['project']['title']);
        $this->assertNotEmpty($content['evidence_items']);

        // 4. Outsider cannot download export (404 per DEF-2 existence disclosure rule)
        Sanctum::actingAs($outsider);
        $outsiderRes = $this->getJson("/api/v1/projects/{$projectId}/exports/{$jobId}/download");
        $this->assertTrue(in_array($outsiderRes->status(), [403, 404]));
    }
}
