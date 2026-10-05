<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\ProjectTemplate;
use App\Models\SavedQuery;
use App\Models\SearchRun;
use App\Models\GeographicalPlace;
use App\Models\NarratorTrajectory;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class AdvancedResearchWorkbenchR2bTest extends TestCase
{
    protected User $researcher;
    protected User $externalScholar;
    protected ResearchProject $project;

    protected function setUp(): void
    {
        parent::setUp();

        $uid = uniqid();

        $this->researcher = User::create([
            'display_name' => "Dr. Polla Tester {$uid}",
            'email' => "tester_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->externalScholar = User::create([
            'display_name' => "Dr. Visiting Scholar {$uid}",
            'email' => "visiting_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->project = ResearchProject::create([
            'title' => "Advanced Research Workspace {$uid}",
            'owner_id' => $this->researcher->id,
            'question' => 'Methodological investigation of historical trajectories and arguments',
            'stage' => 'analysing',
            'is_deleted' => false,
        ]);
    }

    /**
     * ANA-12: Test Book Structure and Lexical Concordance.
     */
    public function test_book_structure_and_lexical_concordance(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Book Structure drill-down
        $resStructure = $this->getJson("/api/v1/corpus/books/1/structure");
        $resStructure->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'book_id',
                    'book_title',
                    'total_chapters',
                    'total_occurrences',
                    'chapters',
                ],
            ]);

        // 2. Lexical Concordance search
        $resConcordance = $this->getJson("/api/v1/corpus/concordance?q=الاعمال&limit=10");
        $resConcordance->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'search_term',
                    'total_matches',
                    'book_distribution',
                    'concordance_samples',
                ],
            ]);
    }

    /**
     * EVI-08: Test Historical Assertions with Competing Alternatives.
     */
    public function test_historical_assertions_lifecycle(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Create Assertion
        $createRes = $this->postJson("/api/v1/projects/{$this->project->id}/assertions", [
            'subject_type' => 'narrator',
            'subject_name' => 'Al-Hasan al-Basri',
            'assertion_claim' => 'He did not hear directly from Ali ibn Abi Talib in Medina prior to Ali\'s departure to Kufa.',
            'uncertainty_level' => 'highly_probable',
            'competing_alternatives' => [
                ['view' => 'He heard as an infant or young child', 'scholar' => 'Ibn Hibban'],
                ['view' => 'He never met Ali in person', 'scholar' => 'Ahmad ibn Hanbal'],
            ],
            'adjudication_notes' => 'Early biographical consensus strongly confirms inqita.',
        ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('data.uncertainty_level', 'highly_probable')
            ->assertJsonPath('data.subject_name', 'Al-Hasan al-Basri');

        $assertionId = $createRes->json('data.id');

        // 2. List Assertions
        $listRes = $this->getJson("/api/v1/projects/{$this->project->id}/assertions?subject_type=narrator");
        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertCount(1, $listRes->json('data'));

        // 3. Update Assertion
        $updateRes = $this->patchJson("/api/v1/projects/{$this->project->id}/assertions/{$assertionId}", [
            'uncertainty_level' => 'certain',
            'adjudication_notes' => 'Final synthesis confirms zero verified auditions.',
        ]);
        $updateRes->assertStatus(200)
            ->assertJsonPath('data.uncertainty_level', 'certain');

        // 4. Delete Assertion
        $delRes = $this->deleteJson("/api/v1/projects/{$this->project->id}/assertions/{$assertionId}");
        $delRes->assertStatus(200);
    }

    /**
     * WRT-08: Test Structured Argumentation Graph (Premises, Claims, Objections, Replies).
     */
    public function test_argumentation_graph_workflow(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Create Claim Node
        $claimRes = $this->postJson("/api/v1/projects/{$this->project->id}/argument-nodes", [
            'node_type' => 'claim',
            'title' => 'Yahya ibn Sa\'id is the sole genuine Madar of the Niyyah tradition',
            'content' => 'All authentic muttasil lines coalesce on Yahya with zero sound bypasses.',
            'order_index' => 1,
        ]);
        $claimRes->assertStatus(201);
        $claimId = $claimRes->json('data.id');

        // 2. Create Objection Node
        $objRes = $this->postJson("/api/v1/projects/{$this->project->id}/argument-nodes", [
            'node_type' => 'objection',
            'title' => 'Alleged parallel transmission through Abu Hurairah',
            'content' => 'Al-Bazzar recorded a variant attributing the same wording to Abu Hurairah.',
            'order_index' => 2,
        ]);
        $objRes->assertStatus(201);
        $objId = $objRes->json('data.id');

        // 3. Create Reply Node
        $replyRes = $this->postJson("/api/v1/projects/{$this->project->id}/argument-nodes", [
            'node_type' => 'reply',
            'title' => 'Weakness of al-Bazzar chain',
            'content' => 'The sanad contains Da\'ud ibn al-Muhabbar, who is universally deemed abandoned (matruk).',
            'order_index' => 3,
        ]);
        $replyRes->assertStatus(201);
        $replyId = $replyRes->json('data.id');

        // 4. Create Edges
        // Edge 1: Objection refutes Claim
        $edge1 = $this->postJson("/api/v1/projects/{$this->project->id}/argument-edges", [
            'source_node_id' => $objId,
            'target_node_id' => $claimId,
            'relation_type' => 'refutes',
            'notes' => 'Raises potential bypass of the common link',
        ]);
        $edge1->assertStatus(201);

        // Edge 2: Reply replies_to Objection
        $edge2 = $this->postJson("/api/v1/projects/{$this->project->id}/argument-edges", [
            'source_node_id' => $replyId,
            'target_node_id' => $objId,
            'relation_type' => 'replies_to',
            'notes' => 'Invalidates the objection via transmitter defect',
        ]);
        $edge2->assertStatus(201);

        // 5. Query Full Argumentation Graph
        $graphRes = $this->getJson("/api/v1/projects/{$this->project->id}/argument-graph");
        $graphRes->assertStatus(200)
            ->assertJsonPath('data.summary.total_nodes', 3)
            ->assertJsonPath('data.summary.total_relations', 2)
            ->assertJsonStructure([
                'data' => [
                    'nodes',
                    'edges',
                    'cytoscape' => ['nodes', 'edges'],
                ],
            ]);
    }

    /**
     * PRJ-08: Test Project Creation Templates.
     */
    public function test_project_templates_and_instantiation(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. List Templates
        $listRes = $this->getJson('/api/v1/project-templates');
        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $templates = $listRes->json('data');
        $this->assertNotEmpty($templates);

        $templateId = $templates[0]['id'];

        // 2. Instantiate Project from Template
        $instRes = $this->postJson("/api/v1/project-templates/{$templateId}/instantiate", [
            'title' => 'New Monograph on Basran Transmitters',
            'custom_question' => 'How did the Basran school evaluate solitary transmissions?',
            'primary_language' => 'ar',
        ]);

        $instRes->assertStatus(201)
            ->assertJsonPath('data.title', 'New Monograph on Basran Transmitters')
            ->assertJsonPath('data.stage', 'scoping');

        $newProjId = $instRes->json('data.id');

        // Verify template prepopulated tasks exist
        $tasksRes = $this->getJson("/api/v1/projects/{$newProjId}/tasks");
        $tasksRes->assertStatus(200);
        $this->assertGreaterThan(0, count($tasksRes->json('data')));
    }

    /**
     * ANN-06: Test Verified Collaboration-Interest Requests.
     */
    public function test_collaboration_interest_requests(): void
    {
        // 1. External scholar submits request
        Sanctum::actingAs($this->externalScholar);

        $reqRes = $this->postJson("/api/v1/projects/{$this->project->id}/collaboration-requests", [
            'message' => 'I have inspected early Damascus manuscripts of this tradition and would like to collaborate.',
            'contact_email' => 'visiting@hadith.ac.krd',
        ]);

        $reqRes->assertStatus(201)
            ->assertJsonPath('data.status', 'pending');

        $requestId = $reqRes->json('data.id');

        // 2. Project owner lists requests
        Sanctum::actingAs($this->researcher);

        $listRes = $this->getJson("/api/v1/projects/{$this->project->id}/collaboration-requests");
        $listRes->assertStatus(200);
        $this->assertCount(1, $listRes->json('data'));

        // 3. Project owner accepts request and grants 'researcher' role
        $updateRes = $this->patchJson("/api/v1/projects/{$this->project->id}/collaboration-requests/{$requestId}", [
            'status' => 'accepted',
            'decision_notes' => 'Welcome aboard; your Damascus manuscript scans will be vital.',
            'role_to_grant' => 'researcher',
        ]);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.status', 'accepted');

        // 4. Verify external scholar is now an accepted project member
        $membersRes = $this->getJson("/api/v1/projects/{$this->project->id}/members");
        $membersRes->assertStatus(200);
        $memberUserIds = collect($membersRes->json('data'))->pluck('user_id')->toArray();
        $this->assertContains($this->externalScholar->id, $memberUserIds);
    }

    /**
     * ANA-13: Test Geospatial Places, Narrator Trajectories, and Isnād Flow.
     */
    public function test_geospatial_transmission_networks_and_trajectories(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Get Historical Places FeatureCollection
        $placesRes = $this->getJson('/api/v1/geospatial/places');
        $placesRes->assertStatus(200)
            ->assertJsonPath('data.type', 'FeatureCollection');

        $places = $placesRes->json('data.features');
        $this->assertNotEmpty($places);
        $medinaPlaceId = $places[0]['properties']['id'];
        $uniqueNarratorId = rand(60000, 99999);

        // 2. Record Narrator Trajectory
        $trajRes = $this->postJson('/api/v1/geospatial/trajectories', [
            'narrator_id' => $uniqueNarratorId,
            'place_id' => $medinaPlaceId,
            'trajectory_type' => 'birth',
            'year_hijri_start' => 93,
            'evidence_text' => 'Born in Medina during the caliphate of al-Walid.',
            'is_inferred' => false,
        ]);
        $trajRes->assertStatus(201)
            ->assertJsonPath('data.trajectory_type', 'birth');

        // 3. Get Narrator Trajectory
        $narratorTrajRes = $this->getJson("/api/v1/geospatial/narrators/{$uniqueNarratorId}/trajectory");
        $narratorTrajRes->assertStatus(200)
            ->assertJsonPath('data.total_trajectory_points', 1)
            ->assertJsonPath('data.geojson.type', 'Feature');

        // 4. Compute Isnād Geographic Flow
        $flowRes = $this->postJson('/api/v1/geospatial/isnad-flow', [
            'narrator_ids' => [$uniqueNarratorId, $uniqueNarratorId + 1],
        ]);
        $flowRes->assertStatus(200)
            ->assertJsonPath('data.narrator_count', 2);
    }

    /**
     * LIB-10: Test BibTeX Reference Ingestion and Parsing.
     */
    public function test_bibtex_reference_ingestion(): void
    {
        Sanctum::actingAs($this->researcher);

        $uid = uniqid();
        $bibtex = <<<BIB
@book{bukhari_sahih_{$uid},
  title = {Al-Jami al-Sahih {$uid}},
  author = {Muhammad ibn Isma'il al-Bukhari},
  year = {1895},
  publisher = {Dar al-Sha'b},
  url = {https://hadith.example.org/bukhari}
}
@article{juynboll_common_link_{$uid},
  title = {Some Isnād-Analytical Methods Illustrated {$uid}},
  author = {G. H. A. Juynboll},
  year = {1989},
  journal = {Al-Qantara},
  doi = {10.3989/alqantara.1989.v10.i2.353}
}
BIB;

        // 1. Preview BibTeX
        $previewRes = $this->postJson('/api/v1/library/bibtex/preview', [
            'bibtex' => $bibtex,
        ]);
        $previewRes->assertStatus(200)
            ->assertJsonPath('data.total_parsed', 2);

        // 2. Import BibTeX
        $importRes = $this->postJson('/api/v1/library/bibtex/import', [
            'bibtex' => $bibtex,
        ]);
        $importRes->assertStatus(201)
            ->assertJsonPath('data.imported_count', 2);
    }

    /**
     * SEA-09 & SEA-10: Test Search Run Comparison & Subscriptions.
     */
    public function test_search_subscriptions_and_run_diff_comparisons(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Create a Saved Query
        $query = SavedQuery::create([
            'owner_type' => 'project',
            'owner_id' => $this->project->id,
            'name' => 'Basran Niyyah Occurrences',
            'query_text' => 'الاعمال بالنيات',
            'search_mode' => 'normalized',
        ]);

        // 2. Create Search Subscription
        $subRes = $this->postJson("/api/v1/projects/{$this->project->id}/search-subscriptions", [
            'saved_query_id' => $query->id,
            'frequency' => 'weekly',
        ]);
        $subRes->assertStatus(201)
            ->assertJsonPath('data.frequency', 'weekly')
            ->assertJsonPath('data.is_active', true);

        $subId = $subRes->json('data.id');

        // 3. Toggle Subscription
        $toggleRes = $this->patchJson("/api/v1/projects/{$this->project->id}/search-subscriptions/{$subId}/toggle");
        $toggleRes->assertStatus(200)
            ->assertJsonPath('data.is_active', false);

        // 4. Compare Two Search Runs via explicit result arrays
        $compareRes = $this->postJson("/api/v1/projects/{$this->project->id}/search-runs/compare", [
            'ids_1' => [101, 102, 103],
            'ids_2' => [102, 103, 104, 105],
        ]);

        $compareRes->assertStatus(200)
            ->assertJsonPath('data.diff.added_count', 2)
            ->assertJsonPath('data.diff.removed_count', 1)
            ->assertJsonPath('data.diff.retained_count', 2)
            ->assertJsonPath('data.diff.added_ids', [104, 105])
            ->assertJsonPath('data.diff.removed_ids', [101]);
    }

    /**
     * EXP-05 & EXP-11: Test Graph Network Export and Research Package Ingestion.
     */
    public function test_graph_export_and_project_package_import(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Export Graph Network
        $exportGraphRes = $this->getJson("/api/v1/projects/{$this->project->id}/exports/graph?format=cytoscape");
        $exportGraphRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'project_id',
                    'format',
                    'graph' => ['nodes', 'edges'],
                ],
            ]);

        // 2. Package Ingestion (Import research package into a new workspace)
        $packagePayload = [
            'project' => [
                'title' => 'Imported Damascus Monograph',
                'question' => 'How were Syrian hadiths transmitted during the Umayyad era?',
                'scope' => 'Syrian recensions of the early 2nd century',
                'owner' => 'Dr. External Scholar',
            ],
            'resources' => [
                ['id' => 1, 'title' => 'Tarikh Dimashq by Ibn Asakir'],
            ],
            'evidence_items' => [
                ['id' => 1, 'captured_text' => 'Sample manuscript excerpt from Bab al-Barid'],
            ],
            'findings' => [],
            'documents' => [],
            'argument_nodes' => [],
        ];

        // Preview only
        $previewRes = $this->postJson('/api/v1/projects/import-package', [
            'package_data' => $packagePayload,
            'preview_only' => true,
        ]);
        $previewRes->assertStatus(200)
            ->assertJsonPath('data.original_title', 'Imported Damascus Monograph')
            ->assertJsonPath('data.resources_count', 1);

        // Actual import
        $importRes = $this->postJson('/api/v1/projects/import-package', [
            'package_data' => $packagePayload,
            'new_title' => 'Cloned Damascus Monograph',
        ]);
        $importRes->assertStatus(201)
            ->assertJsonPath('data.project.title', 'Cloned Damascus Monograph')
            ->assertJsonPath('data.project.owner_id', $this->researcher->id);
    }
}
