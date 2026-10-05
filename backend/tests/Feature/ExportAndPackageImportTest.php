<?php

namespace Tests\Feature;

use App\Models\ArgumentEdge;
use App\Models\ArgumentNode;
use App\Models\ProjectMembership;
use App\Models\ResearchProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExportAndPackageImportTest extends TestCase
{
    protected User $user;
    protected ResearchProject $project;

    protected function setUp(): void
    {
        parent::setUp();

        $uid = uniqid();
        $this->user = User::create([
            'display_name' => "Dr. Exporter {$uid}",
            'email' => "exporter_{$uid}@hadith.local",
            'password' => bcrypt('password123'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->project = ResearchProject::create([
            'title' => 'Project for Graph Export & Packaging',
            'owner_id' => $this->user->id,
            'question' => 'How can argumentation networks be exported portably?',
            'scope' => 'Graph export scope',
            'stage' => 'analysing',
            'is_deleted' => false,
        ]);

        ProjectMembership::create([
            'project_id' => $this->project->id,
            'user_id' => $this->user->id,
            'role' => 'owner',
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);
    }

    public function test_user_can_export_argumentation_graph_as_cytoscape(): void
    {
        $node1 = ArgumentNode::create([
            'project_id' => $this->project->id,
            'node_type' => 'premise',
            'title' => 'Nafi is trustworthy',
            'content' => 'Nafi Mawla Ibn Umar is agreed upon as thiqah thabt.',
            'confidence_level' => 'qati',
        ]);

        $node2 = ArgumentNode::create([
            'project_id' => $this->project->id,
            'node_type' => 'conclusion',
            'title' => 'Sound Chain',
            'content' => 'Transmission from Nafi to Malik is the Golden Chain (Silsilat al-Dhahab).',
            'confidence_level' => 'qati',
        ]);

        $edge = ArgumentEdge::create([
            'project_id' => $this->project->id,
            'source_node_id' => $node1->id,
            'target_node_id' => $node2->id,
            'relation_type' => 'supports',
            'weight' => 1.0,
            'rationale' => 'Praise of transmitters supports chain soundness.',
        ]);

        $response = $this->actingAs($this->user)
            ->getJson("/api/v1/projects/{$this->project->id}/exports/graph?format=cytoscape");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.format', 'cytoscape')
            ->assertJsonPath('data.summary.total_nodes', 2)
            ->assertJsonPath('data.summary.total_edges', 1)
            ->assertJsonPath('data.graph.nodes.0.data.id', "arg_{$node1->id}")
            ->assertJsonPath('data.graph.edges.0.data.relation', 'supports');
    }

    public function test_user_can_preview_research_package_import(): void
    {
        $packageData = [
            'platform' => 'Open Hadith Research Platform',
            'export_version' => '1.0',
            'project' => [
                'title' => 'Historical Takhrīj of Hadith al-Iftiraq',
                'owner' => 'Dr. Zayd',
                'question' => 'Investigation into parallel Syrian paths.',
                'scope' => 'Takhrīj study',
            ],
            'resources' => [
                ['title' => 'Sunan Abi Dawud', 'locator' => '#4597'],
            ],
            'evidence_items' => [
                ['text' => 'Tafarraqa al-Yahud...', 'source' => 'Sunan Abi Dawud'],
                ['text' => 'Wa tafarraqa al-Nasara...', 'source' => 'Sunan al-Tirmidhi'],
            ],
            'findings' => [
                ['title' => 'Multiple independent transmission lines'],
            ],
            'documents' => [
                ['title' => 'Comprehensive Takhrīj Monograph'],
            ],
            'argument_nodes' => [
                ['title' => 'Premise A'],
            ],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/projects/import-package', [
                'package_data' => $packageData,
                'preview_only' => true,
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.original_title', 'Historical Takhrīj of Hadith al-Iftiraq')
            ->assertJsonPath('data.original_owner', 'Dr. Zayd')
            ->assertJsonPath('data.resources_count', 1)
            ->assertJsonPath('data.evidence_count', 2)
            ->assertJsonPath('data.findings_count', 1)
            ->assertJsonPath('data.documents_count', 1)
            ->assertJsonPath('data.arguments_count', 1);
    }

    public function test_user_can_import_research_package_into_new_workspace(): void
    {
        $packageData = [
            'platform' => 'Open Hadith Research Platform',
            'export_version' => '1.0',
            'project' => [
                'title' => 'Syrian Transmissions of al-Zuhri',
                'owner' => 'Dr. Khalid',
                'question' => 'How did al-Awzai transmit from al-Zuhri?',
                'scope' => 'Regional transmission',
            ],
            'resources' => [],
            'evidence_items' => [],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/projects/import-package', [
                'package_data' => $packageData,
                'new_title' => 'Custom Imported Syrian Transmissions',
                'preview_only' => false,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.project.title', 'Custom Imported Syrian Transmissions')
            ->assertJsonPath('data.project.owner_id', $this->user->id);

        $newProjectId = $response->json('data.project.id');
        $this->assertDatabaseHas('research_projects', [
            'id' => $newProjectId,
            'title' => 'Custom Imported Syrian Transmissions',
            'owner_id' => $this->user->id,
        ]);

        $this->assertDatabaseHas('project_memberships', [
            'project_id' => $newProjectId,
            'user_id' => $this->user->id,
            'role' => 'owner',
            'status' => 'accepted',
        ]);
    }

    public function test_import_rejects_malformed_package_without_project_title(): void
    {
        $response = $this->actingAs($this->user)
            ->postJson('/api/v1/projects/import-package', [
                'package_data' => [
                    'platform' => 'Open Hadith Research Platform',
                    'project' => [], // Missing title
                ],
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'INVALID_PACKAGE');
    }
}
