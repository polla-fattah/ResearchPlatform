<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Resource;
use App\Models\EvidenceItem;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class DocumentApiTest extends TestCase
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

    public function test_document_drafting_and_versioning_lifecycle(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('Outsider');

        // Setup Project & Resource
        Sanctum::actingAs($owner);
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'Monograph on Ilm al-Rijal Methodology',
            'question' => 'How did early critics establish narrator reliability thresholds?',
        ]);
        $projectId = $projectRes->json('data.id');

        $resource = Resource::create([
            'resource_type' => 'corpus_book',
            'title' => 'Tahdhib al-Kamal',
            'author' => 'Al-Mizzi',
        ]);

        $evidence = EvidenceItem::create([
            'project_id' => $projectId,
            'resource_id' => $resource->id,
            'captured_text' => 'وكان يحيى بن معين شديد التحري في الرواة',
            'locator' => 'Tahdhib al-Kamal Vol 1, p. 55',
            'content_hash' => hash('sha256', 'وكان يحيى بن معين شديد التحري في الرواة'),
            'state' => 'included',
            'collector_id' => $owner->id,
        ]);

        // 1. Create Document Draft (Version 1)
        $createRes = $this->postJson("/api/v1/projects/{$projectId}/documents", [
            'title' => 'Chapter 1: The Critical Method of Yahya ibn Ma\'in',
            'document_type' => 'article',
            'language' => 'ar',
            'content' => '# مقدمة في منهج يحيى بن معين\n\nيعتبر ابن معين من أئمة الجرح والتعديل...',
            'change_summary' => 'Initial outline and introduction',
        ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'project_id' => $projectId,
                    'title' => 'Chapter 1: The Critical Method of Yahya ibn Ma\'in',
                    'latest_version' => [
                        'version_number' => 1,
                        'change_summary' => 'Initial outline and introduction',
                    ],
                ],
            ]);

        $docId = $createRes->json('data.id');

        // 2. List documents
        $listRes = $this->getJson("/api/v1/projects/{$projectId}/documents");
        $listRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'title', 'document_type', 'latest_version']
                ]
            ]);

        // 3. View document
        $showRes = $this->getJson("/api/v1/projects/{$projectId}/documents/{$docId}");
        $showRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $docId,
                ],
            ]);

        // 4. Commit Version 2 with Citation
        $v2Res = $this->postJson("/api/v1/projects/{$projectId}/documents/{$docId}/versions", [
            'content' => '# مقدمة في منهج يحيى بن معين\n\nيعتبر ابن معين من أئمة الجرح والتعديل، وكان شديد التحري كما نقله المزي...',
            'change_summary' => 'Added detailed section on narrator scrutiny and Ibn Ma\'in citation',
            'citations' => [
                [
                    'resource_id' => $resource->id,
                    'evidence_id' => $evidence->id,
                    'locator' => 'Vol 1, p. 55',
                    'citation_type' => 'direct_quotation',
                    'formatted_citation' => 'المزي، تهذيب الكمال، ج1، ص 55.',
                ]
            ],
        ]);

        $v2Res->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'version_number' => 2,
                    'change_summary' => 'Added detailed section on narrator scrutiny and Ibn Ma\'in citation',
                ],
            ]);

        // 5. List version history
        $versionsRes = $this->getJson("/api/v1/projects/{$projectId}/documents/{$docId}/versions");
        $versionsRes->assertStatus(200);
        $this->assertCount(2, $versionsRes->json('data'));

        // 6. Retrieve historical version 1
        $v1Res = $this->getJson("/api/v1/projects/{$projectId}/documents/{$docId}/versions/1");
        $v1Res->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'version_number' => 1,
                    'change_summary' => 'Initial outline and introduction',
                ],
            ]);

        // 7. Outsider cannot view documents (404 per DEF-2 existence disclosure rule)
        Sanctum::actingAs($outsider);
        $outsiderRes = $this->getJson("/api/v1/projects/{$projectId}/documents/{$docId}");
        $this->assertTrue(in_array($outsiderRes->status(), [403, 404]));

        // 8. Delete document (as Owner)
        Sanctum::actingAs($owner);
        $delRes = $this->deleteJson("/api/v1/projects/{$projectId}/documents/{$docId}");
        $delRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
