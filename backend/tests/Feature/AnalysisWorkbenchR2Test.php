<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearchProject;
use App\Models\EvidenceItem;
use App\Models\HadithFamily;
use App\Models\HadithFamilyMember;
use App\Models\IlalCase;
use App\Models\NarratorTeacherAssessment;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class AnalysisWorkbenchR2Test extends TestCase
{
    protected User $researcher;
    protected ResearchProject $project;

    protected function setUp(): void
    {
        parent::setUp();

        $uid = uniqid();

        $this->researcher = User::create([
            'display_name' => "Dr. Analyst {$uid}",
            'email' => "analyst_{$uid}@hadith.ac.krd",
            'password' => Hash::make('Password123!'),
            'status' => 'approved',
            'is_admin' => false,
        ]);

        $this->project = ResearchProject::create([
            'title' => "Advanced Analysis Project {$uid}",
            'owner_id' => $this->researcher->id,
            'question' => 'Investigating Basran variant recensions',
            'stage' => 'analyzing',
            'is_deleted' => false,
        ]);
    }

    /**
     * ANA-06: Test bioinformatics-inspired sequence collation with ziyadah, saqt, and badal.
     */
    public function test_sequence_collation_engine_identifies_ziyadah_saqt_and_badal(): void
    {
        Sanctum::actingAs($this->researcher);

        $baseline = "انما الاعمال بالنيات وانما لكل امرئ ما نوى";
        $variant1 = "انما الاعمال بالنيات فمن كانت هجرته الى الله ورسوله"; // addition (ziyadah)
        $variant2 = "الاعمال بالنيه"; // omission (saqt) + substitution (badal)

        $response = $this->postJson("/api/v1/projects/{$this->project->id}/analyses/collate", [
            'baseline_text' => $baseline,
            'variants' => [
                ['id' => 'var_1', 'label' => 'Hijazi Recension', 'text' => $variant1],
                ['id' => 'var_2', 'label' => 'Basran Shorter Recension', 'text' => $variant2],
            ],
            'save_run' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'collation' => [
                        'baseline_text',
                        'comparisons' => [
                            '*' => [
                                'variant_id',
                                'label',
                                'collation' => [
                                    'alignment_score',
                                    'similarity_percentage',
                                    'summary' => [
                                        'total_aligned_slots',
                                        'matches',
                                        'substitutions',
                                        'additions_ziyadah',
                                        'omissions_saqt',
                                    ],
                                    'apparatus_criticus',
                                ],
                            ],
                        ],
                    ],
                    'saved_run' => ['id', 'analysis_type', 'version_number'],
                ],
            ]);

        $comparisons = $response->json('data.collation.comparisons');
        $this->assertCount(2, $comparisons);

        // Variant 1 should show additions (ziyadah)
        $this->assertGreaterThan(0, $comparisons[0]['collation']['summary']['additions_ziyadah']);

        // Variant 2 should show omissions (saqt)
        $this->assertGreaterThan(0, $comparisons[1]['collation']['summary']['omissions_saqt']);
    }

    /**
     * ANA-07: Test topological transmission DAG and Madar al-Isnad detection.
     */
    public function test_isnad_graph_topology_analysis_runs_successfully(): void
    {
        Sanctum::actingAs($this->researcher);

        // Define 3 classical transmission chains converging on Yahya ibn Sa'id al-Ansari (Common Link)
        // Chains ordered from Author down to Companion (canonical recitation order)
        $customChains = [
            [
                ['id' => 10, 'name' => 'Al-Bukhari'],
                ['id' => 11, 'name' => 'Al-Humaydi'],
                ['id' => 12, 'name' => 'Sufyan ibn Uyaynah'],
                ['id' => 100, 'name' => 'Yahya ibn Sa\'id al-Ansari'], // Common Link
                ['id' => 200, 'name' => 'Muhammad ibn Ibrahim al-Taymi'],
                ['id' => 300, 'name' => 'Alqamah ibn Waqqas al-Laythi'],
                ['id' => 400, 'name' => 'Umar ibn al-Khattab'],
            ],
            [
                ['id' => 20, 'name' => 'Muslim ibn al-Hajjaj'],
                ['id' => 21, 'name' => 'Abdullah ibn Maslamah'],
                ['id' => 22, 'name' => 'Malik ibn Anas'],
                ['id' => 100, 'name' => 'Yahya ibn Sa\'id al-Ansari'], // Common Link
                ['id' => 200, 'name' => 'Muhammad ibn Ibrahim al-Taymi'],
                ['id' => 300, 'name' => 'Alqamah ibn Waqqas al-Laythi'],
                ['id' => 400, 'name' => 'Umar ibn al-Khattab'],
            ],
            [
                ['id' => 30, 'name' => 'Abu Dawud al-Sijistani'],
                ['id' => 31, 'name' => 'Muhammad ibn Kathir'],
                ['id' => 12, 'name' => 'Sufyan al-Thawri'],
                ['id' => 100, 'name' => 'Yahya ibn Sa\'id al-Ansari'], // Common Link
                ['id' => 200, 'name' => 'Muhammad ibn Ibrahim al-Taymi'],
                ['id' => 300, 'name' => 'Alqamah ibn Waqqas al-Laythi'],
                ['id' => 400, 'name' => 'Umar ibn al-Khattab'],
            ],
        ];

        $response = $this->postJson("/api/v1/projects/{$this->project->id}/analyses/isnad-topology", [
            'custom_chains' => $customChains,
            'direction' => 'author_to_source',
            'save_run' => true,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.topology.total_sanads_analyzed', 3)
            ->assertJsonPath('data.topology.madar_al_isnad.narrator_id', 100)
            ->assertJsonPath('data.topology.formal_proof.status', 'verified_common_link')
            ->assertJsonStructure([
                'data' => [
                    'topology' => [
                        'total_sanads_analyzed',
                        'total_unique_narrators',
                        'total_transmission_edges',
                        'madar_al_isnad' => [
                            'narrator_id',
                            'name',
                            'out_degree',
                            'in_degree',
                            'centrality_score',
                        ],
                        'graph_topology' => [
                            'nodes',
                            'edges',
                            'cytoscape' => ['nodes', 'edges'],
                        ],
                        'formal_proof' => [
                            'theorem',
                            'pivot_narrator',
                            'evidence',
                            'status',
                        ],
                    ],
                    'saved_run' => ['id', 'analysis_type', 'version_number'],
                ],
            ]);
    }

    /**
     * ANA-10: Test Temporal CSP constraint verification for Ittisal vs Inqita.
     */
    public function test_temporal_csp_chronological_verification(): void
    {
        Sanctum::actingAs($this->researcher);

        // Case 1: Feasible overlap between Malik ibn Anas (b. 93 AH, d. 179 AH) and Nafi' Mawla Ibn Umar (d. 117 AH)
        // Malik reached age 7 in 100 AH. Nafi' died 117 AH. Overlap = 17 years.
        $feasibleResponse = $this->postJson("/api/v1/projects/{$this->project->id}/analyses/temporal-check", [
            'teacher_name' => "Nafi' Mawla Ibn Umar",
            'teacher_death' => 117,
            'student_name' => "Malik ibn Anas",
            'student_birth' => 93,
            'student_death' => 179,
            'save_run' => true,
        ]);

        $feasibleResponse->assertStatus(200)
            ->assertJsonPath('data.temporal_verification.status', 'feasible_overlap')
            ->assertJsonPath('data.temporal_verification.verdict', 'ITTISAL_CHRONOLOGICALLY_FEASIBLE')
            ->assertJsonPath('data.temporal_verification.proof_certificate.audition_possible', true);

        // Case 2: Anachronistic Inqita - Teacher died before student reached Tamyiz (age 7)
        // Teacher died in 100 AH, Student born in 98 AH (student was age 2 when teacher died)
        $inqitaResponse = $this->postJson("/api/v1/projects/{$this->project->id}/analyses/temporal-check", [
            'teacher_name' => "Urwah ibn al-Zubayr",
            'teacher_death' => 100,
            'student_name' => "Young Student",
            'student_birth' => 98,
            'student_death' => 170,
        ]);

        $inqitaResponse->assertStatus(200)
            ->assertJsonPath('data.temporal_verification.status', 'anachronistic_inqita')
            ->assertJsonPath('data.temporal_verification.verdict', 'INQITA_CONFIRMED')
            ->assertJsonPath('data.temporal_verification.proof_certificate.is_anachronistic', true)
            ->assertJsonPath('data.temporal_verification.proof_certificate.audition_possible', false);

        // Case 3: Pseudo-attribution - Teacher died BEFORE student was even born
        $pseudoResponse = $this->postJson("/api/v1/projects/{$this->project->id}/analyses/temporal-check", [
            'teacher_name' => "Al-Hasan al-Basri",
            'teacher_death' => 110,
            'student_name' => "Anachronistic Narrator",
            'student_birth' => 125,
            'student_death' => 195,
        ]);

        $pseudoResponse->assertStatus(200)
            ->assertJsonPath('data.temporal_verification.status', 'pseudo_attribution')
            ->assertJsonPath('data.temporal_verification.verdict', 'IMPOSSIBLE_MEETING')
            ->assertJsonPath('data.temporal_verification.proof_certificate.is_anachronistic', true);
    }

    /**
     * ANA-08: Test Hadith Family clustering and Mutaba'ah / Shahid membership.
     */
    public function test_hadith_family_clustering_and_mutabaah_classification(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Create a Hadith Family
        $createResponse = $this->postJson("/api/v1/projects/{$this->project->id}/families", [
            'canonical_title' => 'Hadith of Actions and Intentions (Innama al-A\'mal)',
            'root_companion' => 'Umar ibn al-Khattab',
            'core_theme' => 'Sincerity and intentionality in religious acts',
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.canonical_title', 'Hadith of Actions and Intentions (Innama al-A\'mal)');

        $familyId = $createResponse->json('data.id');

        // Create resource and evidence item for linking
        $res = \App\Models\Resource::create([
            'resource_type' => 'corpus_hadith',
            'corpus_table' => 'hadiths',
            'corpus_id' => 1,
            'title' => 'Hadith of Intentions',
            'author' => 'Al-Bukhari',
        ]);

        $evidence = EvidenceItem::create([
            'project_id' => $this->project->id,
            'resource_id' => $res->id,
            'captured_text' => 'انما الاعمال بالنيات',
            'content_hash' => hash('sha256', 'انما الاعمال بالنيات'),
            'state' => 'included',
            'collector_id' => $this->researcher->id,
        ]);

        // 2. Attach a Mutaba'ah Tammah member
        $memberResponse1 = $this->postJson("/api/v1/projects/{$this->project->id}/families/{$familyId}/members", [
            'evidence_id' => $evidence->id,
            'relationship_type' => 'mutabaah_tammah',
            'convergence_narrator' => 'Yahya ibn Sa\'id al-Ansari',
            'convergence_depth' => 1,
            'scholarly_notes' => 'Direct parallel transmission through Yahya',
        ]);

        $memberResponse1->assertStatus(201)
            ->assertJsonPath('data.relationship_type', 'mutabaah_tammah');

        $memberId1 = $memberResponse1->json('data.id');

        // 3. Attach a Shahid member (Companion-level witness)
        $memberResponse2 = $this->postJson("/api/v1/projects/{$this->project->id}/families/{$familyId}/members", [
            'relationship_type' => 'shahid',
            'convergence_narrator' => 'Abu Sa\'id al-Khudri',
            'scholarly_notes' => 'Independent witness through another companion',
        ]);

        $memberResponse2->assertStatus(201)
            ->assertJsonPath('data.relationship_type', 'shahid');

        // 4. List family with all members
        $listResponse = $this->getJson("/api/v1/projects/{$this->project->id}/families");
        $listResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $families = $listResponse->json('data');
        $this->assertCount(1, $families);
        $this->assertCount(2, $families[0]['members']);

        // 5. Delete one member
        $delResponse = $this->deleteJson("/api/v1/projects/{$this->project->id}/families/{$familyId}/members/{$memberId1}");
        $delResponse->assertStatus(200);

        $listAfter = $this->getJson("/api/v1/projects/{$this->project->id}/families");
        $this->assertCount(1, $listAfter->json('data.0.members'));
    }

    /**
     * ANA-09: Test 'Ilal investigation case dossier lifecycle.
     */
    public function test_ilal_case_investigation_dossier_lifecycle(): void
    {
        Sanctum::actingAs($this->researcher);

        // 1. Create an 'Ilal case
        $createResponse = $this->postJson("/api/v1/projects/{$this->project->id}/ilal-cases", [
            'title' => 'Discrepancy in Basran transmission of Hadith al-Niyyat',
            'discrepancy_category' => 'ikhtilaf_sanad',
            'competing_variants' => [
                ['chain_id' => 101, 'narrator' => 'Hammad ibn Zayd', 'state' => 'Muttasil'],
                ['chain_id' => 102, 'narrator' => 'Hammad ibn Salamah', 'state' => 'Mursal'],
            ],
            'critics_judgments' => [
                ['critic' => 'Al-Daraqutni', 'verdict' => 'Prefers Hammad ibn Zayd due to superior memory'],
            ],
            'resolution_notes' => 'Preliminary investigation underway',
        ]);

        $createResponse->assertStatus(201)
            ->assertJsonPath('data.status', 'under_investigation')
            ->assertJsonPath('data.discrepancy_category', 'ikhtilaf_sanad');

        $caseId = $createResponse->json('data.id');

        // 2. View case details
        $viewResponse = $this->getJson("/api/v1/projects/{$this->project->id}/ilal-cases/{$caseId}");
        $viewResponse->assertStatus(200)
            ->assertJsonPath('data.id', $caseId);

        // 3. Resolve case
        $updateResponse = $this->patchJson("/api/v1/projects/{$this->project->id}/ilal-cases/{$caseId}", [
            'status' => 'resolved_authentic',
            'preferred_version' => 'Muttasil chain of Hammad ibn Zayd',
            'resolution_notes' => 'Resolved: The mursal transmission is an anomaly (shadh) by a lesser student.',
        ]);

        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'resolved_authentic')
            ->assertJsonPath('data.preferred_version', 'Muttasil chain of Hammad ibn Zayd');
    }

    /**
     * ANA-11: Test teacher-specific narrator assessment.
     */
    public function test_teacher_specific_narrator_assessment(): void
    {
        Sanctum::actingAs($this->researcher);

        // Record that Narrator 501 is weakened specifically when transmitting from Teacher 702
        $response = $this->postJson("/api/v1/projects/{$this->project->id}/narrator-assessments", [
            'narrator_id' => 501,
            'teacher_id' => 702,
            'assessment_category' => 'weakened_specifically',
            'critic_name' => 'Ahmad ibn Hanbal',
            'qawl_text' => 'His narrations from this specific teacher contain munkarat because his notes were lost in transit.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.assessment_category', 'weakened_specifically')
            ->assertJsonPath('data.narrator_id', 501)
            ->assertJsonPath('data.teacher_id', 702);

        // Query assessments filtered by narrator_id
        $queryResponse = $this->getJson("/api/v1/projects/{$this->project->id}/narrator-assessments?narrator_id=501");
        $queryResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertCount(1, $queryResponse->json('data'));
        $this->assertEquals('weakened_specifically', $queryResponse->json('data.0.assessment_category'));
    }
}
