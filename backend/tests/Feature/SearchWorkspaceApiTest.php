<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Corpus\CorpusHadith;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class SearchWorkspaceApiTest extends TestCase
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

    public function test_saved_searches_and_frozen_result_sets_lifecycle(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $outsider = $this->createUser('External Scholar');

        Sanctum::actingAs($owner);

        // 1. Create a Project Workspace
        $projectRes = $this->postJson('/api/v1/projects', [
            'title' => 'Investigations into Innamal A\'malu Bin-Niyyat',
            'question' => 'How did the early transmission variants of the Niyyah Hadith propagate across Hijaz and Iraq?',
        ]);
        $projectRes->assertStatus(201);
        $projectId = $projectRes->json('data.id');

        // 2. Save a Search Definition
        $searchRes = $this->postJson("/api/v1/projects/{$projectId}/searches", [
            'name' => 'Niyyah Hadith Variants',
            'query_text' => 'النيات',
            'search_mode' => 'normalized',
            'filter_criteria' => [
                'type' => 'marfu',
            ],
        ]);

        $searchRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Niyyah Hadith Variants',
                    'query_text' => 'النيات',
                    'search_mode' => 'normalized',
                ],
            ]);

        $queryId = $searchRes->json('data.id');

        // 3. List Saved Searches
        $listRes = $this->getJson("/api/v1/projects/{$projectId}/searches");
        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
        $this->assertCount(1, $listRes->json('data'));

        // 4. Retrieve single saved search
        $getRes = $this->getJson("/api/v1/projects/{$projectId}/searches/{$queryId}");
        $getRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $queryId,
                ],
            ]);

        // 5. Execute Saved Search (Run against corpus)
        $runRes = $this->postJson("/api/v1/projects/{$projectId}/searches/{$queryId}/run");
        $runRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'search_run' => [
                        'saved_query_id' => $queryId,
                        'corpus_version' => 'hadiths_v2.0',
                        'status' => 'completed',
                    ],
                ],
            ]);

        $searchRunId = $runRes->json('data.search_run.id');
        $this->assertNotNull($searchRunId);
        $this->assertArrayHasKey('execution_duration_ms', $runRes->json('data.search_run'));

        // 6. Freeze an Immutable Result Set Snapshot
        $freezeRes = $this->postJson("/api/v1/projects/{$projectId}/result-sets", [
            'name' => 'Primary Hijazi Canonical Cohort v1',
            'search_run_id' => $searchRunId,
            'items' => [
                [
                    'resource_type' => 'corpus_hadith',
                    'corpus_id' => 1,
                    'snapshot_data' => [
                        'arabic_text' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى',
                        'book' => 'Sahih al-Bukhari',
                        'hadith_number' => '1',
                    ],
                ],
                [
                    'resource_type' => 'corpus_hadith',
                    'corpus_id' => 2,
                    'snapshot_data' => [
                        'arabic_text' => 'الأعمال بالنية ولكل امرئ ما نوى',
                        'book' => 'Sahih Muslim',
                        'hadith_number' => '1907',
                    ],
                ],
            ],
        ]);

        $freezeRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Primary Hijazi Canonical Cohort v1',
                    'is_frozen' => true,
                    'total_count' => 2,
                ],
            ]);

        $resultSetId = $freezeRes->json('data.id');

        // 7. List Result Sets
        $setsList = $this->getJson("/api/v1/projects/{$projectId}/result-sets");
        $setsList->assertStatus(200);
        $this->assertCount(1, $setsList->json('data'));

        // 8. Retrieve Frozen Result Set and check members snapshot immutability
        $viewSet = $this->getJson("/api/v1/projects/{$projectId}/result-sets/{$resultSetId}");
        $viewSet->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $resultSetId,
                    'is_frozen' => true,
                    'total_count' => 2,
                ],
            ]);

        $members = $viewSet->json('data.members');
        $this->assertCount(2, $members);
        $this->assertEquals(1, $members[0]['ordinal_position']);
        $this->assertEquals('Sahih al-Bukhari', $members[0]['snapshot_data']['book']);

        // 9. Unauthorized outsider cannot view or create searches on this private project
        Sanctum::actingAs($outsider);
        $deniedRes = $this->getJson("/api/v1/projects/{$projectId}/searches");
        $deniedRes->assertStatus(403);
    }
}
