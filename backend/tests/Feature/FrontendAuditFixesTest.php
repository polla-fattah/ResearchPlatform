<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\ResearcherProfile;
use App\Models\ResearchProject;
use App\Models\EvidenceItem;
use App\Models\CorpusCorrectionProposal;
use App\Models\Corpus\CorpusBook;
use App\Models\Corpus\CorpusChapter;
use App\Models\Corpus\CorpusHukm;
use App\Services\TotpService;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class FrontendAuditFixesTest extends TestCase
{
    /**
     * C-4: Test RFC 6238 TOTP lifecycle: valid secret generation, confirm verification,
     * single-use recovery codes, replay/invalid code rejection, disable protection.
     */
    public function test_c4_mfa_cannot_be_bypassed_and_uses_real_totp(): void
    {
        $user = User::create([
            'display_name' => 'MFA Scholar',
            'email' => 'mfa_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);
        $user->profile()->create(['affiliation' => 'SUE']);

        Sanctum::actingAs($user);

        // 1. Enroll - must return valid 16-char Base32 secret
        $enrollRes = $this->postJson('/api/v1/auth/mfa/enroll');
        $enrollRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $secret = $enrollRes->json('data.secret');
        $this->assertEquals(16, strlen($secret));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]{16}$/', $secret);

        // 2. Confirm with bad code must fail (422)
        $badConfirm = $this->postJson('/api/v1/auth/mfa/confirm', [
            'code' => '000000',
        ]);
        $badConfirm->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        // 3. Confirm with real TOTP code must succeed and return recovery codes
        $validCode = TotpService::generateCode($secret);
        $goodConfirm = $this->postJson('/api/v1/auth/mfa/confirm', [
            'code' => $validCode,
        ]);
        $goodConfirm->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.mfa_enabled', true);

        $recoveryCodes = $goodConfirm->json('data.recovery_codes');
        $this->assertIsArray($recoveryCodes);
        $this->assertCount(5, $recoveryCodes);

        // 4. Verify recovery codes are hashed in DB, not plain
        $profile = $user->profile()->first();
        $this->assertTrue($user->fresh()->mfa_enabled);
        $this->assertNotContains($recoveryCodes[0], $profile->recovery_codes);

        // 5. Test Challenge Flow: wrong code rejected
        $challengeToken = 'ch_' . bin2hex(random_bytes(16));
        cache()->put("mfa_challenge:{$challengeToken}", $user->id, 300);

        $badChallenge = $this->postJson('/api/v1/auth/mfa/challenge', [
            'challenge_token' => $challengeToken,
            'code' => '123456',
        ]);
        $badChallenge->assertStatus(401);

        // 6. Test Challenge Flow: single-use recovery code consumed
        $challengeToken2 = 'ch_' . bin2hex(random_bytes(16));
        cache()->put("mfa_challenge:{$challengeToken2}", $user->id, 300);

        $goodChallenge = $this->postJson('/api/v1/auth/mfa/challenge', [
            'challenge_token' => $challengeToken2,
            'code' => $recoveryCodes[0],
        ]);
        $goodChallenge->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.email', $user->email);

        // Reusing the same recovery code must fail
        $challengeToken3 = 'ch_' . bin2hex(random_bytes(16));
        cache()->put("mfa_challenge:{$challengeToken3}", $user->id, 300);

        $reuseChallenge = $this->postJson('/api/v1/auth/mfa/challenge', [
            'challenge_token' => $challengeToken3,
            'code' => $recoveryCodes[0],
        ]);
        $reuseChallenge->assertStatus(401);

        // 7. Disable MFA requires password or code
        $badDisable = $this->postJson('/api/v1/auth/mfa/disable', [
            'password' => 'wrongpassword',
        ]);
        $badDisable->assertStatus(422);

        $goodDisable = $this->postJson('/api/v1/auth/mfa/disable', [
            'password' => 'password123',
        ]);
        $goodDisable->assertStatus(200)
            ->assertJsonPath('data.mfa_enabled', false);
    }

    /**
     * C-8: Test secrets never leak in User or ResearcherProfile serialization.
     */
    public function test_c8_secrets_never_leak_in_api_responses(): void
    {
        $user = User::create([
            'display_name' => 'Secure Author',
            'email' => 'secure_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
            'password_reset_token' => 'live_leaked_token_12345',
            'password_reset_expires_at' => now()->addHour(),
        ]);
        $user->profile()->create([
            'affiliation' => 'Salahaddin University-Erbil',
            'mfa_secret' => 'SECRETBASE32TEST',
            'recovery_codes' => [hash('sha256', 'code1')],
        ]);

        Sanctum::actingAs($user);

        // Check /auth/me
        $meRes = $this->getJson('/api/v1/auth/me');
        $meRes->assertStatus(200);

        $content = $meRes->getContent();
        $this->assertStringNotContainsString('password_reset_token', $content);
        $this->assertStringNotContainsString('live_leaked_token_12345', $content);
        $this->assertStringNotContainsString('mfa_secret', $content);
        $this->assertStringNotContainsString('SECRETBASE32TEST', $content);
        $this->assertStringNotContainsString('recovery_codes', $content);

        // Check project show does not leak member email or secrets to peers
        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Secret Test Project',
            'question' => 'How to preserve privacy?',
            'scope' => 'private',
            'status' => 'active',
        ]);

        $projectRes = $this->getJson("/api/v1/projects/{$project->id}");
        $projectRes->assertStatus(200);
        $projContent = $projectRes->getContent();
        $this->assertStringNotContainsString($user->email, $projContent);
    }

    /**
     * C-5: Test the five endpoints that previously returned HTTP 500 now return HTTP 200.
     */
    public function test_c5_fixed_endpoints_return_200_without_crashing(): void
    {
        $user = User::create([
            'display_name' => 'Scholar Tester',
            'email' => 'tester_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);
        $user->profile()->create(['affiliation' => 'SUE']);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Summary Test Project',
            'question' => 'Testing summary',
            'scope' => 'private',
            'status' => 'active',
        ]);

        Sanctum::actingAs($user);

        // 1. GET /home
        $homeRes = $this->getJson('/api/v1/home');
        $homeRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 2. GET /projects/{id}/summary
        $summaryRes = $this->getJson("/api/v1/projects/{$project->id}/summary");
        $summaryRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 3. GET /me/corpus-proposals
        $proposalsRes = $this->getJson('/api/v1/me/corpus-proposals');
        $proposalsRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 4. GET /corpus/hukms
        $hukmsRes = $this->getJson('/api/v1/corpus/hukms');
        $hukmsRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // 5. GET /corpus/books/{id}/chapters
        $book = CorpusBook::first();
        if ($book) {
            $chaptersRes = $this->getJson("/api/v1/corpus/books/{$book->id}/chapters");
            $chaptersRes->assertStatus(200)
                ->assertJsonPath('success', true);
        }
    }

    /**
     * C-1 & C-3: Account approval gating via EnsureAccountApproved middleware.
     * Unapproved / pending users must be blocked with 403 ACCOUNT_NOT_APPROVED.
     */
    public function test_c3_unapproved_accounts_blocked_on_researcher_routes(): void
    {
        $pendingUser = User::create([
            'display_name' => 'Pending Applicant',
            'email' => 'pending_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'pending',
        ]);
        $pendingUser->profile()->create(['affiliation' => 'Guest']);

        Sanctum::actingAs($pendingUser);

        // Project create should be blocked
        $projRes = $this->postJson('/api/v1/projects', [
            'title' => 'Illegal Project',
            'scope' => 'private',
        ]);
        $projRes->assertStatus(403)
            ->assertJsonPath('error.code', 'ACCOUNT_NOT_APPROVED');

        // Library routes should be blocked
        $libRes = $this->getJson('/api/v1/library/items');
        $libRes->assertStatus(403)
            ->assertJsonPath('error.code', 'ACCOUNT_NOT_APPROVED');

        // Home dashboard should be blocked
        $homeRes = $this->getJson('/api/v1/home');
        $homeRes->assertStatus(403)
            ->assertJsonPath('error.code', 'ACCOUNT_NOT_APPROVED');

        // But /auth/me and applications are allowed
        $meRes = $this->getJson('/api/v1/auth/me');
        $meRes->assertStatus(200);
    }

    /**
     * C-1: Test public application creates user with 'unverified' status,
     * issues 24-hr token, and applicant does not enter admin queue until verified.
     */
    public function test_c1_public_apply_creates_unverified_account_and_requires_email_step(): void
    {
        $email = 'applicant_' . uniqid() . '@hadith.local';
        $applyRes = $this->postJson('/api/v1/applications', [
            'display_name' => 'New Researcher Applicant',
            'email' => $email,
            'password' => 'secret123456',
            'password_confirmation' => 'secret123456',
            'affiliation' => 'Salahaddin University',
            'research_statement' => 'Computational Hadith text attribution research.',
            'research_interests' => ['Hadith Studies', 'Data Mining'],
        ]);

        $applyRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.application.status', 'pending');

        // Verify user in DB is unverified
        $user = User::where('email', $email)->first();
        $this->assertNotNull($user);
        $this->assertEquals('unverified', $user->status);

        // Verify admin queue excludes unverified applicant
        $admin = User::where('is_admin', true)->first();
        if ($admin) {
            Sanctum::actingAs($admin);
            $queueRes = $this->getJson('/api/v1/admin/applications');
            $queueRes->assertStatus(200);
            $queueContent = $queueRes->getContent();
            $this->assertStringNotContainsString($email, $queueContent);
        }
    }

    /**
     * C-7: Test real export archive packaging and real checksums.
     */
    public function test_c7_real_export_archive_and_download(): void
    {
        $user = User::create([
            'display_name' => 'Exporter Scholar',
            'email' => 'exporter_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);
        $user->profile()->create(['affiliation' => 'SUE']);

        $project = ResearchProject::create([
            'owner_id' => $user->id,
            'title' => 'Exportable Research Project',
            'question' => 'How to export correctly?',
            'scope' => 'private',
            'status' => 'active',
        ]);

        Sanctum::actingAs($user);

        // Preview counts must be real (0 since new project), not projects * 12
        $previewRes = $this->postJson('/api/v1/exports/preview', [
            'project_ids' => [$project->id],
            'scope' => 'project',
        ]);
        $previewRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.counts.evidence_items', 0);

        // Create export package
        $exportRes = $this->postJson('/api/v1/exports', [
            'project_ids' => [$project->id],
            'formats' => ['zip'],
            'scope' => 'project',
        ]);
        $exportRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.export_job.status', 'completed');

        $part = $exportRes->json('data.export_job.parts.0');
        $this->assertNotNull($part);
        $this->assertNotEmpty($part['checksum_sha256']);
        $this->assertGreaterThan(0, $part['size_bytes']);

        // Download real zip
        $jobId = $exportRes->json('data.job_id');
        $downloadRes = $this->get("/api/v1/exports/{$jobId}/parts/{$part['part_number']}/download");
        $downloadRes->assertStatus(200);
        $this->assertTrue(str_contains($downloadRes->headers->get('content-type') ?? '', 'zip') ||
                          str_contains($downloadRes->headers->get('content-disposition') ?? '', '.zip'));
    }

    /**
     * C-6: Corpus search locators (hadith_number, page_number, volume, edition),
     * total_occurrences count, and authors/critics pagination.
     */
    public function test_c6_corpus_search_locators_and_pagination(): void
    {
        // 1. Search hadiths
        $searchRes = $this->getJson('/api/v1/corpus/search?q=الأعمال&per_page=5');
        $searchRes->assertStatus(200)
            ->assertJsonPath('success', true);

        // Verify meta.counts.total_occurrences exists
        $totalOccurrences = $searchRes->json('meta.counts.total_occurrences');
        $this->assertNotNull($totalOccurrences);

        // If results exist, verify locator structure
        $items = $searchRes->json('data');
        if (!empty($items) && !empty($items[0]['occurrences'])) {
            $occ = $items[0]['occurrences'][0];
            $this->assertArrayHasKey('hadith_number', $occ);
            $this->assertArrayHasKey('page_number', $occ);
            $this->assertArrayHasKey('volume', $occ);
            $this->assertArrayHasKey('edition', $occ);
            $this->assertIsArray($occ['book']['author']);
            $this->assertArrayHasKey('name', $occ['book']['author']);
        }

        // 2. Authors pagination
        $authorsRes = $this->getJson('/api/v1/corpus/authors?per_page=10');
        $authorsRes->assertStatus(200);
        $this->assertLessThanOrEqual(10, count($authorsRes->json('data')));

        // 3. Critics pagination
        $criticsRes = $this->getJson('/api/v1/corpus/critics?per_page=10');
        $criticsRes->assertStatus(200);
        $this->assertLessThanOrEqual(10, count($criticsRes->json('data')));
    }
}
