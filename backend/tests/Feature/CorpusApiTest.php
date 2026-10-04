<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorpusApiTest extends TestCase
{
    public function test_can_list_corpus_books(): void
    {
        $response = $this->getJson('/api/v1/corpus/books?per_page=5');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'title']
                ],
                'meta' => [
                    'pagination' => ['current_page', 'per_page', 'total_items', 'total_pages']
                ]
            ]);
    }

    public function test_can_get_corpus_book_detail(): void
    {
        // First get a valid book id
        $booksResponse = $this->getJson('/api/v1/corpus/books?per_page=1');
        $bookId = $booksResponse->json('data.0.id');

        $response = $this->getJson("/api/v1/corpus/books/{$bookId}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $bookId,
                ]
            ]);
    }

    public function test_can_search_corpus_hadiths(): void
    {
        $response = $this->getJson('/api/v1/corpus/search?per_page=5');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'full_hadith', 'matn']
                ],
                'meta' => [
                    'pagination' => ['current_page', 'per_page', 'total_items', 'total_pages']
                ]
            ]);
    }

    public function test_can_search_with_arabic_full_text_search_and_trigram_modes(): void
    {
        // 1. Full-Text Search with Arabic stemming
        $ftsRes = $this->getJson('/api/v1/corpus/search?q=النيات&mode=fts&per_page=5');
        $ftsRes->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertNotEmpty($ftsRes->json('data'));

        // 2. Normalized Trigram Substring Search
        $trgmRes = $this->getJson('/api/v1/corpus/search?q=النيات&mode=normalized&per_page=5');
        $trgmRes->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertNotEmpty($trgmRes->json('data'));

        // 3. Exact Substring Search
        $exactRes = $this->getJson('/api/v1/corpus/search?q=النية&mode=exact&per_page=5');
        $exactRes->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_can_filter_hadiths_by_book_using_indexed_reference(): void
    {
        $bookRes = $this->getJson('/api/v1/corpus/books?per_page=1');
        $bookId = $bookRes->json('data.0.id');

        $response = $this->getJson("/api/v1/corpus/search?book_id={$bookId}&per_page=5");
        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_can_get_hadith_detail_with_chains(): void
    {
        $searchResponse = $this->getJson('/api/v1/corpus/search?per_page=1');
        $hadithId = $searchResponse->json('data.0.id');

        $response = $this->getJson("/api/v1/corpus/hadiths/{$hadithId}");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $hadithId,
                ]
            ])
            ->assertJsonStructure([
                'data' => ['id', 'full_hadith', 'matn', 'references']
            ]);
    }

    public function test_can_get_narrator_detail_and_criticisms(): void
    {
        // Fetch narrator 1 (or any narrator existing in the DB)
        $response = $this->getJson('/api/v1/corpus/narrators/1');

        if ($response->status() === 200) {
            $response->assertJson([
                'success' => true,
                'data' => ['id' => 1]
            ])->assertJsonStructure([
                'data' => ['id', 'name', 'shyookh_count', 'students_count']
            ]);

            $critRes = $this->getJson('/api/v1/corpus/narrators/1/criticism');
            $critRes->assertStatus(200)
                ->assertJson(['success' => true]);
        } else {
            $this->assertEquals(404, $response->status());
        }
    }
}
