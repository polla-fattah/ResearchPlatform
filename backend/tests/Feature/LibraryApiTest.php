<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Resource;
use Illuminate\Support\Facades\Hash;

class LibraryApiTest extends TestCase
{
    private function authenticateUser(): array
    {
        $user = User::create([
            'display_name' => 'Dr. Scholar Test',
            'email' => 'scholar_' . uniqid() . '@hadith.local',
            'password' => Hash::make('password123'),
            'status' => 'approved',
        ]);

        $token = $user->createToken('test_token')->plainTextToken;

        return [$user, $token];
    }

    public function test_user_can_add_item_to_library_and_list(): void
    {
        [$user, $token] = $this->authenticateUser();

        // 1. Add item
        $res = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/library/items', [
                'resource_type' => 'corpus_hadith',
                'corpus_table' => 'hadiths',
                'corpus_id' => 101,
                'title' => 'Hadith on Fasting in Ramadan',
                'author' => 'Al-Bukhari',
                'personal_notes' => 'Crucial for Chapter 2 literature review',
                'is_favourite' => true,
            ]);

        $res->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user_id' => $user->id,
                    'is_favourite' => true,
                    'personal_notes' => 'Crucial for Chapter 2 literature review',
                    'resource' => [
                        'title' => 'Hadith on Fasting in Ramadan',
                        'resource_type' => 'corpus_hadith',
                    ],
                ],
            ]);

        $itemId = $res->json('data.id');

        // 2. List items
        $listRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/library/items');

        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'user_id', 'resource_id', 'is_favourite', 'personal_notes', 'resource']
                ],
                'meta' => [
                    'pagination' => ['total_items', 'current_page']
                ]
            ]);

        // 3. Update notes
        $updateRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->patchJson("/api/v1/library/items/{$itemId}", [
                'personal_notes' => 'Updated notes for Chapter 2',
                'is_favourite' => false,
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'personal_notes' => 'Updated notes for Chapter 2',
                    'is_favourite' => false,
                ],
            ]);

        // 4. Collections
        $collRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/library/collections', [
                'name' => 'Rijal al-Kufa Collection',
                'description' => 'Narrators and transmitters residing in Kufa',
            ]);

        $collRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'Rijal al-Kufa Collection',
                ],
            ]);

        $collId = $collRes->json('data.id');
        $resourceId = $res->json('data.resource.id');

        // Add resource to collection
        $addColRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/v1/library/collections/{$collId}/items", [
                'resource_id' => $resourceId,
            ]);

        $addColRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // Remove from collection
        $remColRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/library/collections/{$collId}/items/{$resourceId}");

        $remColRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // 5. Delete item from library
        $delRes = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson("/api/v1/library/items/{$itemId}");

        $delRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }
}
