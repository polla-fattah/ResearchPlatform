<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearcherApplication;
use App\Models\ResearchProject;
use App\Services\AuditService;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class AdminApiTest extends TestCase
{
    private function createUser(string $name, bool $isAdmin = false, string $status = 'approved'): User
    {
        return User::create([
            'display_name' => $name,
            'email' => 'user_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => $status,
            'is_admin' => $isAdmin,
        ]);
    }

    public function test_admin_and_editorial_controls(): void
    {
        $admin = $this->createUser('Admin Scholar', true);
        $researcher = $this->createUser('Dr. Regular', false);
        $applicant = $this->createUser('Applicant Scholar', false, 'pending');

        $application = ResearcherApplication::create([
            'user_id' => $applicant->id,
            'status' => 'pending',
            'research_statement' => 'PhD in Hadith Studies from University of Nottingham.',
        ]);

        // 1. Regular user gets 403 on admin routes
        Sanctum::actingAs($researcher);
        $unauthRes = $this->getJson('/api/v1/admin/users');
        $unauthRes->assertStatus(403);

        // 2. Admin can list users
        Sanctum::actingAs($admin);
        $usersRes = $this->getJson('/api/v1/admin/users');
        $usersRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'display_name', 'email', 'status', 'is_admin']
                ]
            ]);

        // 3. Admin suspends a user
        $suspendRes = $this->patchJson("/api/v1/admin/users/{$researcher->id}/status", [
            'status' => 'suspended',
            'reason' => 'Violation of academic code of conduct',
        ]);
        $suspendRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $researcher->id,
                    'status' => 'suspended',
                ],
            ]);

        // 4. Admin decides on researcher application (Approves)
        $appDecideRes = $this->postJson("/api/v1/admin/applications/{$application->id}/decide", [
            'decision' => 'approved',
            'decision_reason' => 'Verified academic credentials and publications.',
        ]);

        $appDecideRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'approved',
                    'user' => [
                        'id' => $applicant->id,
                        'status' => 'approved',
                    ],
                ],
            ]);

        // 5. Researcher submits a corpus correction proposal
        $applicant->refresh();
        Sanctum::actingAs($applicant);
        $proposalRes = $this->postJson('/api/v1/corpus/proposals', [
            'corpus_table' => 'hadiths',
            'corpus_id' => 101,
            'current_value' => 'الأعمال بالنيات',
            'proposed_value' => 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
            'evidence_notes' => 'Confirmed in the primary manuscript of Sahih al-Bukhari folio 2a.',
        ]);

        $proposalRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'corpus_table' => 'hadiths',
                    'status' => 'submitted',
                ],
            ]);

        $proposalId = $proposalRes->json('data.id');

        // 6. Admin reviews corpus proposals
        Sanctum::actingAs($admin);
        $listPropRes = $this->getJson('/api/v1/admin/corpus/proposals');
        $listPropRes->assertStatus(200);

        // 7. Admin accepts the proposal
        $acceptPropRes = $this->postJson("/api/v1/admin/corpus/proposals/{$proposalId}/decide", [
            'status' => 'accepted',
        ]);
        $acceptPropRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $proposalId,
                    'status' => 'accepted',
                ],
            ]);

        // 8. Admin queries global audit logs
        $auditLogsRes = $this->getJson('/api/v1/admin/audit-logs');
        $auditLogsRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'action', 'object_type', 'actor']
                ]
            ]);

        // 9. Project activity stream
        $project = ResearchProject::create([
            'owner_id' => $admin->id,
            'title' => 'Audit Project',
            'question' => 'Testing activity stream',
        ]);

        AuditService::log(
            actorId: $admin->id,
            action: 'project_created',
            objectType: 'project',
            objectId: $project->id,
            details: ['project_id' => $project->id]
        );

        $activityRes = $this->getJson("/api/v1/projects/{$project->id}/activity");
        $activityRes->assertStatus(200);
        $this->assertNotEmpty($activityRes->json('data'));
    }
}
