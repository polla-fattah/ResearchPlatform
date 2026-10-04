<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\Publication;
use App\Models\Announcement;
use Laravel\Sanctum\Sanctum;

class ScholarlyCaseStudyTest extends TestCase
{
    public function test_seeded_scholarly_case_study_endpoints_and_integrity(): void
    {
        // 1. Verify Public Monograph Endpoint
        $pubRes = $this->getJson('/api/v1/public/research/the-niyyah-tradition-critical-monograph');
        $pubRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'public_slug' => 'the-niyyah-tradition-critical-monograph',
                    'title' => 'The Anatomy of a Gharīb Bottleneck: Transmission Dynamics of the Niyyah Tradition',
                    'status' => 'published',
                    'version_string' => '1.0.0',
                ],
            ]);

        $pubData = $pubRes->json('data');
        $this->assertEquals('Dr. Polla Abdulhamid Fattah', $pubData['project']['owner']['display_name']);
        $this->assertCount(2, $pubData['submission']['reviews']);
        $this->assertEquals('approve', $pubData['submission']['decision']['decision']);

        // 2. Verify Public Announcement Endpoint
        $annRes = $this->getJson('/api/v1/public/announcements/niyyah-isnad-dynamics-2nd-century');
        $annRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'public_slug' => 'niyyah-isnad-dynamics-2nd-century',
                    'status' => 'published',
                ],
            ]);

        // 3. Authenticate as Dr. Polla and inspect full Project Workspace
        $polla = User::where('email', 'polla@sue.edu.krd')->firstOrFail();
        Sanctum::actingAs($polla);

        $project = ResearchProject::where('owner_id', $polla->id)
            ->where('title', 'like', '%Niyyah%')
            ->firstOrFail();
        $projectId = $project->id;

        // Verify Workspace Overview
        $projectRes = $this->getJson("/api/v1/projects/{$projectId}");
        $projectRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $projectId,
                    'stage' => 'completed',
                ],
            ]);

        // Verify Evidence Items with Annotations
        $evidenceRes = $this->getJson("/api/v1/projects/{$projectId}/evidence");
        $evidenceRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(3, count($evidenceRes->json('data')));

        // Verify Analysis Runs (Matn, Isnad, Criticism matrix)
        $analysisRes = $this->getJson("/api/v1/projects/{$projectId}/analyses");
        $analysisRes->assertStatus(200);
        $runs = $analysisRes->json('data');
        $this->assertGreaterThanOrEqual(3, count($runs));

        $types = array_column($runs, 'analysis_type');
        $this->assertContains('matn_comparison', $types);
        $this->assertContains('isnad_comparison', $types);
        $this->assertContains('criticism_matrix', $types);

        // Verify Findings linked to Evidence
        $findingsRes = $this->getJson("/api/v1/projects/{$projectId}/findings");
        $findingsRes->assertStatus(200);
        $findings = $findingsRes->json('data');
        $this->assertCount(2, $findings);
        $this->assertEquals('supported', $findings[0]['status']);

        // Verify Documents and Citations
        $docsRes = $this->getJson("/api/v1/projects/{$projectId}/documents");
        $docsRes->assertStatus(200);
        $this->assertNotEmpty($docsRes->json('data'));

        // Verify Collaboration Threads and Tasks
        $threadsRes = $this->getJson("/api/v1/projects/{$projectId}/threads");
        $threadsRes->assertStatus(200);
        $this->assertNotEmpty($threadsRes->json('data'));

        $tasksRes = $this->getJson("/api/v1/projects/{$projectId}/tasks");
        $tasksRes->assertStatus(200);
        $this->assertNotEmpty($tasksRes->json('data'));
        $this->assertEquals('done', $tasksRes->json('data.0.status'));
    }
}
