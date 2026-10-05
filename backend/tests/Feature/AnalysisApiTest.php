<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Corpus\CorpusSanad;
use App\Models\Corpus\CorpusNarrator;
use App\Models\Corpus\CorpusHadith;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class AnalysisApiTest extends TestCase
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

    public function test_analysis_workbench_full_lifecycle(): void
    {
        $owner = $this->createUser('Dr. Polla');
        $collaborator = $this->createUser('Co-Researcher');
        $outsider = $this->createUser('External Reviewer');

        Sanctum::actingAs($owner);

        // 1. Setup Project
        $projRes = $this->postJson('/api/v1/projects', [
            'title' => 'Comparative Analysis of the Niyyah and Basmalah Traditions',
            'question' => 'How do transmission formulas and lexical variations diverge across early regional centers?',
        ]);
        $projRes->assertStatus(201);
        $projectId = $projRes->json('data.id');

        // Add collaborator
        $this->postJson("/api/v1/projects/{$projectId}/members", [
            'user_id' => $collaborator->id,
            'role' => 'researcher',
        ])->assertStatus(201);

        // 2. Matn Compare with custom texts and save_run = true
        $matnRes = $this->postJson("/api/v1/projects/{$projectId}/analyses/matn-compare", [
            'custom_texts' => [
                [
                    'id' => 'variant_bukhari',
                    'label' => 'Bukhari #1',
                    'text' => 'إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى الله ورسوله فهجرته إلى الله ورسوله',
                ],
                [
                    'id' => 'variant_muslim',
                    'label' => 'Muslim #1907',
                    'text' => 'الأعمال بالنية ولكل امرئ ما نوى فمن هاجر إلى الله ورسوله فهجرته إلى ما هاجر إليه',
                ],
            ],
            'save_run' => true,
        ]);

        $matnRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'analysis' => [
                        'analysis_type' => 'matn_comparison',
                        'variant_count' => 2,
                    ],
                ],
            ]);

        $analysisData = $matnRes->json('data.analysis');
        $this->assertNotEmpty($analysisData['consensus_core_tokens']);
        $this->assertArrayHasKey('similarity_matrix', $analysisData);
        $this->assertArrayHasKey('diff_against_baseline', $analysisData);

        $savedRun = $matnRes->json('data.saved_run');
        $this->assertNotNull($savedRun);
        $this->assertEquals('matn_comparison', $savedRun['analysis_type']);
        $this->assertEquals(1, $savedRun['version_number']);

        // 3. Matn Compare using live corpus hadith IDs
        $corpusHadiths = CorpusHadith::limit(2)->pluck('id')->toArray();
        if (count($corpusHadiths) >= 2) {
            $corpusMatnRes = $this->postJson("/api/v1/projects/{$projectId}/analyses/matn-compare", [
                'hadith_ids' => $corpusHadiths,
                'save_run' => false,
            ]);
            $corpusMatnRes->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'data' => [
                        'analysis' => [
                            'analysis_type' => 'matn_comparison',
                            'variant_count' => 2,
                        ],
                    ],
                ]);
        }

        // 4. Isnad Compare using live corpus sanad IDs
        $sanadIds = CorpusSanad::has('narratorNodes')->limit(2)->pluck('id')->toArray();
        if (count($sanadIds) >= 2) {
            $isnadRes = $this->postJson("/api/v1/projects/{$projectId}/analyses/isnad-compare", [
                'sanad_ids' => $sanadIds,
                'save_run' => true,
            ]);

            $isnadRes->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'data' => [
                        'analysis' => [
                            'analysis_type' => 'isnad_comparison',
                            'chain_count' => 2,
                        ],
                    ],
                ]);

            $isnadData = $isnadRes->json('data.analysis');
            $this->assertArrayHasKey('common_links', $isnadData);
            $this->assertArrayHasKey('chains', $isnadData);
            $this->assertArrayHasKey('summary', $isnadData);
        }

        // 5. Criticism Matrix using live corpus narrator IDs
        $narratorIds = CorpusNarrator::limit(2)->pluck('id')->toArray();
        if (!empty($narratorIds)) {
            $critRes = $this->postJson("/api/v1/projects/{$projectId}/analyses/criticism-matrix", [
                'narrator_ids' => $narratorIds,
                'save_run' => true,
            ]);

            $critRes->assertStatus(200)
                ->assertJson([
                    'success' => true,
                    'data' => [
                        'analysis' => [
                            'analysis_type' => 'criticism_matrix',
                        ],
                    ],
                ]);

            $critData = $critRes->json('data.analysis');
            $this->assertArrayHasKey('matrix', $critData);
            $this->assertArrayHasKey('summary', $critData);
        }

        // 6. Explicitly save an analysis run via POST /projects/{id}/analyses/save
        $explicitSave = $this->postJson("/api/v1/projects/{$projectId}/analyses/save", [
            'analysis_type' => 'ilal_case',
            'input_params' => [
                'hadith_id' => 10,
                'focus' => 'ziyadah_thiqah',
            ],
            'output_data' => [
                'verdict' => 'acceptable_addition',
                'pivotal_scholar' => 'Al-Daraqutni',
            ],
        ]);

        $explicitSave->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'analysis_type' => 'ilal_case',
                    'version_number' => 1,
                ],
            ]);

        $savedAnalysisId = $explicitSave->json('data.id');

        // 7. List saved analysis runs for project
        $listRes = $this->getJson("/api/v1/projects/{$projectId}/analyses");
        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);
        $this->assertGreaterThanOrEqual(2, count($listRes->json('data')));

        // 8. Retrieve single saved analysis run
        $showRes = $this->getJson("/api/v1/projects/{$projectId}/analyses/{$savedAnalysisId}");
        $showRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $savedAnalysisId,
                    'analysis_type' => 'ilal_case',
                ],
            ]);

        // 9. Unauthorized outsider cannot view analyses (404 per DEF-2 existence disclosure rule)
        Sanctum::actingAs($outsider);
        $deniedRes = $this->getJson("/api/v1/projects/{$projectId}/analyses");
        $this->assertTrue(in_array($deniedRes->status(), [403, 404]));
    }
}
