<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthApiTest extends TestCase
{
    public function test_user_can_register_via_api(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'display_name' => 'Dr. Researcher',
            'email' => 'scholar_' . uniqid() . '@hadith.local',
            'password' => 'secret1234',
            'preferred_language' => 'ar',
            'affiliation' => 'Salahaddin University-Erbil',
            'biography' => 'Specialist in Ilm al-Rijal',
            'research_interests' => ['Isnad Analysis', 'Ilal'],
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'display_name' => 'Dr. Researcher',
                        'status' => 'unverified',
                        'preferred_language' => 'ar',
                    ],
                ],
            ])
            ->assertJsonStructure([
                'data' => [
                    'user' => ['id', 'display_name', 'email', 'status'],
                    'token',
                ],
            ]);
    }

    public function test_user_can_login_and_access_profile(): void
    {
        $email = 'test_' . uniqid() . '@hadith.local';
        $user = User::create([
            'display_name' => 'Existing Scholar',
            'email' => $email,
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);
        $user->profile()->create([
            'affiliation' => 'UKH AIIC',
        ]);

        // Login
        $loginRes = $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => 'password123',
        ]);

        $loginRes->assertStatus(200)
            ->assertJsonStructure([
                'data' => ['user', 'token'],
            ]);

        $token = $loginRes->json('data.token');

        // Access protected me endpoint
        $meRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/auth/me');

        $meRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'email' => $email,
                    'status' => 'approved',
                    'profile' => [
                        'affiliation' => 'UKH AIIC',
                    ],
                ],
            ]);

        // Update profile
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson('/api/v1/auth/profile', [
                'display_name' => 'Prof. Existing Scholar',
                'affiliation' => 'Salahaddin University-Erbil',
                'research_interests' => ['Hadith Data Mining'],
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'display_name' => 'Prof. Existing Scholar',
                    'profile' => [
                        'affiliation' => 'Salahaddin University-Erbil',
                    ],
                ],
            ]);

        // Submit researcher application
        $appRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/applications', [
                'research_statement' => 'Investigating computational approaches to low-resource Hadith corpora and text attribution.',
                'sample_publications' => 'https://polla.dev/publications/hadith-mining-2024.pdf',
            ]);

        $appRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'pending',
                ],
            ]);

        // Check application status
        $statusRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/applications/my-status');

        $statusRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user_status' => 'approved',
                ],
            ]);

        // Logout
        $logoutRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/auth/logout');

        $logoutRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Successfully logged out.',
            ]);
    }
}

